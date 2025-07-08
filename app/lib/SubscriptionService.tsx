import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  initConnection, 
  getSubscriptions, 
  requestPurchase, 
  finishTransaction,
  getPurchaseHistory
} from 'expo-iap';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';

// Remplace l'import problématique par une définition locale minimaliste :
// type Product
export type Product = {
  productId: string;
  price: string;
  localizedPrice?: string;
  title?: string;
  description?: string;
  currency?: string;
};
// type Purchase
export type Purchase = {
  productId: string;
  transactionReceipt: string;
  transactionId?: string;
  transactionDate?: number;
};

// Types pour l'abonnement
export interface SubscriptionStatus {
  isActive: boolean;
  expiresAt: Date | null;
  productId: string | null;
  transactionId: string | null;
  loading: boolean;
}

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus;
  products: any[];
  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
  testConfiguration: () => Promise<void>;
  loading: boolean;
}

// Configuration des produits d'abonnement
const SUBSCRIPTION_PRODUCTS = Platform.select({
  ios: ['tcmarket-premium-monthly', 'tcmarket-premium-yearly'],
  android: ['tcmarket_premium_pokemon'],
  default: []
});

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

// Correction du typage pour les produits simulés (dev Android)
export type ProductSimu = {
  productId: string;
  price: string;
  localizedPrice?: string;
  title?: string;
  description?: string;
  currency?: string;
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isActive: false,
    expiresAt: null,
    productId: null,
    transactionId: null,
    loading: true
  });
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialisation des IAP
  useEffect(() => {
    console.log('[SubscriptionService] useEffect déclenché:', {
      isAuthenticated,
      userId: user?.id
    });
    
    if (isAuthenticated) {
      initializeIAP();
      checkSubscriptionStatus();
    }

    return () => {
      // Nettoyage si nécessaire
    };
  }, [isAuthenticated]);

  const initializeIAP = async () => {
    try {
      setLoading(true);
      
      console.log('[SubscriptionService] Initialisation IAP:', {
        platform: Platform.OS,
        isDev: __DEV__,
        products: SUBSCRIPTION_PRODUCTS,
        userId: user?.id
      });
      
      // Connexion aux services IAP (Google Play / App Store)
      await initConnection();
      console.log('[SubscriptionService] Connexion IAP établie');
      
      if (SUBSCRIPTION_PRODUCTS.length > 0) {
        try {
          const availableProducts = await getSubscriptions(SUBSCRIPTION_PRODUCTS);
          console.log('[SubscriptionService] Produits récupérés:', availableProducts);
          setProducts(availableProducts);

          if (availableProducts.length === 0) {
            console.warn('[SubscriptionService] Aucun produit trouvé dans les stores');
          }
        } catch (productError) {
          console.error('[SubscriptionService] Erreur récupération produits:', productError);
          throw productError;
        }
      } else {
        console.warn('[SubscriptionService] Aucun produit configuré pour', Platform.OS);
      }
    } catch (error) {
      console.error('[SubscriptionService] Erreur initialisation IAP:', error);
      
      // En cas d'erreur, ne pas charger de produits simulés
      // L'utilisateur doit voir l'erreur et corriger la configuration
      setProducts([]);
      
      Alert.alert(
        'Erreur de configuration',
        'Impossible de récupérer les abonnements depuis ' + 
        (Platform.OS === 'android' ? 'Google Play' : 'App Store') + 
        '. Vérifiez votre connexion internet et que les produits sont bien configurés.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!user) return;

    try {
      setSubscriptionStatus(prev => ({ ...prev, loading: true }));
      console.log('[SubscriptionService] Vérification du statut d\'abonnement pour:', user.id);

      // Vérifier l'état de l'abonnement via l'API backend
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[SubscriptionService] Erreur lors de la vérification:', error);
        setSubscriptionStatus({
          isActive: false,
          expiresAt: null,
          productId: null,
          transactionId: null,
          loading: false
        });
        return;
      }

      const now = new Date();
      const isActive = data && new Date(data.expires_at) > now;

      console.log('[SubscriptionService] Statut abonnement:', { isActive, data });

      setSubscriptionStatus({
        isActive: !!isActive,
        expiresAt: data?.expires_at ? new Date(data.expires_at) : null,
        productId: data?.product_id || null,
        transactionId: data?.transaction_id || null,
        loading: false
      });
    } catch (error) {
      console.error('[SubscriptionService] Erreur lors de la vérification du statut:', error);
      setSubscriptionStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const purchaseSubscription = async (productId: string): Promise<boolean> => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour effectuer un achat');
      return false;
    }

    try {
      setLoading(true);
      console.log('[SubscriptionService] Achat en cours pour:', productId);
      
      const product = products.find(p => p.productId === productId);
      if (!product) {
        Alert.alert('Erreur', 'Produit non trouvé. Veuillez réessayer.');
        return false;
      }
      
      // Effectuer l'achat réel via Google Play / App Store
      console.log('[SubscriptionService] Achat via', Platform.OS === 'android' ? 'Google Play' : 'App Store');
      let purchaseRequest;
      if (Platform.OS === 'ios') {
        purchaseRequest = { request: { sku: productId }, type: 'subs' as const };
      } else {
        purchaseRequest = {
          request: {
            skus: [productId],
            subscriptionOffers: []
          },
          type: 'subs' as const
        };
      }
      
      const purchase = await requestPurchase(purchaseRequest);
      
      if (purchase && !Array.isArray(purchase)) {
        console.log('[SubscriptionService] Achat effectué, validation en cours');
        
        const isValid = await validatePurchaseWithBackend(purchase as any);
        
        if (isValid) {
          await finishTransaction({ purchase, isConsumable: false });
          await checkSubscriptionStatus();
          return true;
        } else {
          Alert.alert('Erreur', 'Impossible de valider votre achat. Contactez le support.');
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[SubscriptionService] Erreur lors de l\'achat:', error);
      
      let errorMessage = 'Une erreur est survenue lors de l\'achat.';
      
      if ((error as Error).message?.includes('User cancelled')) {
        errorMessage = 'Achat annulé par l\'utilisateur.';
      } else if ((error as Error).message?.includes('Network')) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
      } else if ((error as Error).message?.includes('Invalid')) {
        errorMessage = 'Produit non valide. Contactez le support.';
      }
      
      Alert.alert('Erreur abonnement', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const validatePurchaseWithBackend = async (purchase: any): Promise<boolean> => {
    try {
      console.log('[SubscriptionService] Validation de l\'achat:', purchase);
      
      // Calculer la date d'expiration selon le produit
      const now = new Date();
      const expiresAt = new Date();
      
      if (purchase.productId.includes('monthly') || purchase.productId === 'tcmarket_premium_pokemon') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (purchase.productId.includes('yearly')) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1); // Par défaut 1 mois
      }
      
      console.log('[SubscriptionService] Création abonnement en base de données');
      
      // Désactiver les anciens abonnements
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: now.toISOString() })
        .eq('user_id', user!.id)
        .eq('status', 'active');
      
      // Créer le nouvel abonnement
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user!.id,
          product_id: purchase.productId,
          transaction_id: purchase.transactionId,
          platform: Platform.OS,
          status: 'active',
          expires_at: expiresAt.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      
      if (error) {
        console.error('[SubscriptionService] Erreur création abonnement:', error);
        return false;
      }
      
      console.log('[SubscriptionService] Abonnement créé avec succès, expire le:', expiresAt);
      return true;
    } catch (error) {
      console.error('[SubscriptionService] Erreur lors de la validation:', error);
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour restaurer vos achats');
      return false;
    }

    try {
      setLoading(true);
      
      // Récupérer l'historique des achats
      const purchases = await getPurchaseHistory();
      console.log('[SubscriptionService] Achats trouvés:', purchases.length);
      
      if (purchases.length === 0) {
        Alert.alert('Information', 'Aucun achat précédent trouvé');
        return false;
      }

      // Valider les achats précédents
      let restored = false;
      for (const purchase of purchases) {
        const isValid = await validatePurchaseWithBackend(purchase as any);
        if (isValid) {
          restored = true;
          break;
        }
      }

      if (restored) {
        await checkSubscriptionStatus();
        Alert.alert('Succès', 'Vos achats ont été restaurés avec succès !');
      } else {
        Alert.alert('Information', 'Aucun abonnement actif trouvé');
      }

      return restored;
    } catch (error) {
      console.error('[SubscriptionService] Erreur lors de la restauration:', error);
      Alert.alert('Erreur abonnement', 'Une erreur est survenue lors de la restauration de vos achats.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fonction de test pour vérifier la configuration
  const testConfiguration = async () => {
    console.log('[SubscriptionService] === TEST DE CONFIGURATION ===');
    console.log('[SubscriptionService] Plateforme:', Platform.OS);
    console.log('[SubscriptionService] Mode développement:', __DEV__);
    console.log('[SubscriptionService] Produits configurés:', SUBSCRIPTION_PRODUCTS);
    console.log('[SubscriptionService] Utilisateur connecté:', !!user);
    console.log('[SubscriptionService] Produits chargés:', products.length);
    console.log('[SubscriptionService] Statut abonnement:', subscriptionStatus);
    
    if (products.length > 0) {
      console.log('[SubscriptionService] Détails des produits:');
      products.forEach(product => {
        console.log(`  - ${product.productId}: ${product.price} (${product.title})`);
      });
    }
    
    console.log('[SubscriptionService] === FIN TEST ===');
  };

  return (
    <SubscriptionContext.Provider value={{
      subscriptionStatus,
      products,
      purchaseSubscription,
      restorePurchases,
      checkSubscriptionStatus,
      testConfiguration,
      loading
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Hook pour vérifier les restrictions
export function useSubscriptionRestrictions() {
  const { subscriptionStatus } = useSubscription();

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