import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, { 
  PurchasesOffering, 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesEntitlementInfo 
} from 'react-native-purchases';
import { useAuth } from './auth';

// Types pour le contexte RevenueCat
export interface RevenueCatStatus {
  isActive: boolean;
  expiresAt: Date | null;
  productId: string | null;
  loading: boolean;
}

interface RevenueCatContextType {
  subscriptionStatus: RevenueCatStatus;
  offerings: PurchasesOffering[];
  packages: PurchasesPackage[];
  purchaseSubscription: (pack: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
  loading: boolean;
}

// Entitlements - L'ID de votre entitlement dans RevenueCat
const PREMIUM_ENTITLEMENT_ID = 'premium'; // À configurer dans RevenueCat dashboard

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<RevenueCatStatus>({
    isActive: false,
    expiresAt: null,
    productId: null,
    loading: true
  });
  const [offerings, setOfferings] = useState<PurchasesOffering[]>([]);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialisation de RevenueCat
  useEffect(() => {
    console.log('[RevenueCat] useEffect déclenché:', {
      isAuthenticated,
      userId: user?.id
    });
    
    if (isAuthenticated) {
      initializeRevenueCat();
      checkSubscriptionStatus();
    }

    return () => {
      // Nettoyage si nécessaire
    };
  }, [isAuthenticated]);

  const initializeRevenueCat = async () => {
    try {
      setLoading(true);
      
      console.log('[RevenueCat] Initialisation RevenueCat:', {
        platform: Platform.OS,
        isDev: __DEV__,
        userId: user?.id
      });
      
      // Configuration des clés API RevenueCat depuis les variables d'environnement
      const apiKey = Platform.select({
        ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
        android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
        default: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
      });

      if (!apiKey) {
        console.error('[RevenueCat] ⚠️ CLÉS API NON CONFIGURÉES');
        Alert.alert(
          'Configuration RequiSE', 
          'Les clés API RevenueCat ne sont pas configurées dans les variables d\'environnement. Veuillez ajouter EXPO_PUBLIC_REVENUECAT_IOS_API_KEY et EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY.'
        );
        setLoading(false);
        return;
      }

      // Initialiser RevenueCat
      await Purchases.configure({ apiKey });
      console.log('[RevenueCat] ✅ RevenueCat configuré avec succès');

      // Identifier l'utilisateur (optionnel mais recommandé)
      if (user?.id) {
        await Purchases.logIn(user.id);
        console.log('[RevenueCat] ✅ Utilisateur identifié:', user.id);
      }

      // Charger les offerings (produits)
      await loadOfferings();
      
    } catch (error) {
      console.error('[RevenueCat] ❌ Erreur initialisation:', error);
      Alert.alert(
        'Erreur de configuration',
        'Impossible d\'initialiser RevenueCat. Vérifiez votre configuration.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const loadOfferings = async () => {
    try {
      console.log('[RevenueCat] Chargement des offerings...');
      
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings récupérées:', offerings);
      
      if (offerings.current) {
        const currentOffering = offerings.current;
        setOfferings([currentOffering]);
        setPackages(currentOffering.availablePackages);
        
        console.log('[RevenueCat] ✅ Packages disponibles:', {
          count: currentOffering.availablePackages.length,
          packages: currentOffering.availablePackages.map(p => ({
            id: p.identifier,
            productId: p.product.identifier,
            price: p.product.priceString,
            title: p.product.title
          }))
        });
        
        if (currentOffering.availablePackages.length === 0) {
          console.warn('[RevenueCat] ⚠️ Aucun package trouvé dans l\'offering courante');
        }
      } else {
        console.warn('[RevenueCat] ⚠️ Aucune offering courante configurée');
        setOfferings([]);
        setPackages([]);
      }
    } catch (error) {
      console.error('[RevenueCat] ❌ Erreur lors du chargement des offerings:', error);
      setOfferings([]);
      setPackages([]);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!user) return;

    try {
      setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      console.log('[RevenueCat] Vérification du statut d\'abonnement...');

      const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] Info client récupérées:', customerInfo);

      // Vérifier l'entitlement premium
      const premiumEntitlement: PurchasesEntitlementInfo | undefined = 
        customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

      const isActive = !!premiumEntitlement;
      const expiresAt = premiumEntitlement?.expirationDate ? new Date(premiumEntitlement.expirationDate) : null;
      const productId = premiumEntitlement?.productIdentifier || null;

      console.log('[RevenueCat] ✅ Statut abonnement:', { 
        isActive, 
        expiresAt, 
        productId,
        entitlement: premiumEntitlement 
      });

      setSubscriptionStatus({
        isActive,
        expiresAt,
        productId,
        loading: false
      });
    } catch (error) {
      console.error('[RevenueCat] ❌ Erreur lors de la vérification du statut:', error);
      setSubscriptionStatus({
        isActive: false,
        expiresAt: null,
        productId: null,
        loading: false
      });
    }
  };

  const purchaseSubscription = async (packageToPurchase: PurchasesPackage): Promise<boolean> => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour effectuer un achat');
      return false;
    }

    try {
      setLoading(true);
      console.log('[RevenueCat] 🛒 Achat en cours:', {
        packageId: packageToPurchase.identifier,
        productId: packageToPurchase.product.identifier,
        price: packageToPurchase.product.priceString
      });
      
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      console.log('[RevenueCat] ✅ Achat réussi:', customerInfo);
      
      // Vérifier que l'entitlement est bien actif
      const premiumEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
      
      if (premiumEntitlement) {
        console.log('[RevenueCat] ✅ Entitlement premium activé');
        await checkSubscriptionStatus(); // Mettre à jour le statut
        return true;
      } else {
        console.error('[RevenueCat] ❌ Entitlement premium non trouvé après achat');
        Alert.alert('Erreur', 'L\'achat a été effectué mais l\'abonnement n\'est pas actif. Contactez le support.');
        return false;
      }
    } catch (error: any) {
      console.error('[RevenueCat] ❌ Erreur lors de l\'achat:', error);
      
      let errorMessage = 'Une erreur est survenue lors de l\'achat.';
      
      if (error.code === 'PURCHASES_ERROR_PURCHASE_CANCELLED') {
        errorMessage = 'Achat annulé par l\'utilisateur.';
      } else if (error.code === 'PURCHASES_ERROR_NETWORK_ERROR') {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
      } else if (error.code === 'PURCHASES_ERROR_PRODUCT_NOT_AVAILABLE_FOR_PURCHASE') {
        errorMessage = 'Produit non disponible pour l\'achat.';
      }
      
      Alert.alert('Erreur abonnement', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour restaurer vos achats');
      return false;
    }

    try {
      setLoading(true);
      console.log('[RevenueCat] 🔄 Restauration des achats...');
      
      const customerInfo = await Purchases.restorePurchases();
      console.log('[RevenueCat] Achats restaurés:', customerInfo);
      
      const premiumEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
      
      if (premiumEntitlement) {
        await checkSubscriptionStatus();
        Alert.alert('Succès', 'Vos achats ont été restaurés avec succès !');
        return true;
      } else {
        Alert.alert('Information', 'Aucun abonnement actif trouvé');
        return false;
      }
    } catch (error) {
      console.error('[RevenueCat] ❌ Erreur lors de la restauration:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la restauration de vos achats.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <RevenueCatContext.Provider value={{
      subscriptionStatus,
      offerings,
      packages,
      purchaseSubscription,
      restorePurchases,
      checkSubscriptionStatus,
      loading
    }}>
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}

// Hook pour vérifier les restrictions
export function useSubscriptionRestrictions() {
  const { subscriptionStatus } = useRevenueCat();

  const canAccessMarket = subscriptionStatus.isActive;
  const canAccessTrading = subscriptionStatus.isActive;
  
  const canScanCard = async (currentInventoryCount: number): Promise<boolean> => {
    if (subscriptionStatus.isActive) return true;
    return currentInventoryCount < 10;
  };

  const getMaxCollectionCards = (): number => {
    return subscriptionStatus.isActive ? Infinity : 10;
  };

  const canAccessFullCollection = subscriptionStatus.isActive;

  return {
    canAccessMarket,
    canAccessTrading,
    canScanCard,
    getMaxCollectionCards,
    canAccessFullCollection,
    isPremium: subscriptionStatus.isActive
  };
} 