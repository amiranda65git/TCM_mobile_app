import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  connectAsync, 
  getProductsAsync, 
  purchaseItemAsync, 
  finishTransactionAsync,
  getPurchaseHistoryAsync,
  IAPProduct,
  IAPPurchase
} from 'expo-iap';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { Alert, Platform } from 'react-native';

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
  products: IAPProduct[];
  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  checkSubscriptionStatus: () => Promise<void>;
  testConfiguration: () => Promise<void>;
  loading: boolean;
}

// Configuration des produits d'abonnement
const SUBSCRIPTION_PRODUCTS = Platform.select({
  ios: ['tcmarket_premium_monthly', 'tcmarket_premium_yearly'],
  android: ['tcmarket_premium_monthly', 'tcmarket_premium_yearly'],
  default: []
});

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isActive: false,
    expiresAt: null,
    productId: null,
    transactionId: null,
    loading: true
  });
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialisation des IAP
  useEffect(() => {
    if (isAuthenticated) {
      initializeIAP();
      checkSubscriptionStatus();
    }

    return () => {
      // Nettoyage si nécessaire - disconnectAsync n'est plus disponible dans expo-iap v2+
    };
  }, [isAuthenticated]);

  const initializeIAP = async () => {
    try {
      setLoading(true);
      
      console.log('[SubscriptionService] Initialisation des IAP...');
      
      // Connexion aux services IAP
      await connectAsync();
      console.log('[SubscriptionService] Connexion aux services IAP réussie');

      // Récupération des produits disponibles
      if (SUBSCRIPTION_PRODUCTS.length > 0) {
        console.log('[SubscriptionService] Récupération des produits:', SUBSCRIPTION_PRODUCTS);
        const availableProducts = await getProductsAsync(SUBSCRIPTION_PRODUCTS);
        setProducts(availableProducts);
        console.log('[SubscriptionService] Produits récupérés:', availableProducts.map(p => ({ id: p.productId, price: p.price })));
        
        if (availableProducts.length === 0) {
          console.warn('[SubscriptionService] Aucun produit trouvé. Vérifiez la configuration Google Play Console.');
        }
      } else {
        console.warn('[SubscriptionService] Aucun produit configuré pour cette plateforme');
      }
    } catch (error) {
      console.error('[SubscriptionService] Erreur d\'initialisation IAP:', error);
      console.error('[SubscriptionService] Type d\'erreur:', error.constructor.name);
      console.error('[SubscriptionService] Message:', error.message);
      
      // Pour le développement Android, on peut simuler les produits
      if (__DEV__ && Platform.OS === 'android') {
        console.log('[SubscriptionService] Mode développement: simulation des produits');
        setProducts([
          {
            productId: 'tcmarket_premium_monthly',
            price: '4,99 €',
            localizedPrice: '4,99 €',
            title: 'TCMarket Premium Mensuel',
            description: 'Abonnement premium mensuel',
            currency: 'EUR'
          },
          {
            productId: 'tcmarket_premium_yearly',
            price: '49,99 €',
            localizedPrice: '49,99 €',
            title: 'TCMarket Premium Annuel',
            description: 'Abonnement premium annuel',
            currency: 'EUR'
          }
        ] as IAPProduct[]);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (!user) return;

    try {
      setSubscriptionStatus(prev => ({ ...prev, loading: true }));

      // Vérifier l'état de l'abonnement via Edge Function
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
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

      setSubscriptionStatus({
        isActive: data.isActive,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        productId: data.productId,
        transactionId: null,
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
      
      // Vérifier que le produit existe
      const product = products.find(p => p.productId === productId);
      if (!product) {
        Alert.alert('Erreur', 'Produit non trouvé. Veuillez réessayer.');
        return false;
      }
      
      console.log('[SubscriptionService] Tentative d\'achat pour:', productId);
      console.log('[SubscriptionService] Produit:', product);
      
      // Mode développement : simuler l'achat
      if (__DEV__ && Platform.OS === 'android') {
        console.log('[SubscriptionService] Mode développement: simulation d\'achat');
        
        // Simuler un achat réussi
        const mockPurchase = {
          productId: productId,
          transactionId: `dev_android_${Date.now()}`,
          transactionReceipt: `mock_receipt_${Date.now()}`,
          purchaseTime: Date.now(),
        };
        
        // Valider l'achat côté backend
        const isValid = await validatePurchaseWithBackend(mockPurchase as IAPPurchase);
        
        if (isValid) {
          await checkSubscriptionStatus();
          Alert.alert('Succès', 'Votre abonnement a été activé avec succès ! (Mode développement)');
          return true;
        } else {
          Alert.alert('Erreur', 'Impossible de valider votre achat. Vérifiez la configuration backend.');
          return false;
        }
      }
      
      // Effectuer l'achat réel
      const purchase = await purchaseItemAsync(productId);
      
      if (purchase) {
        console.log('[SubscriptionService] Achat réussi:', purchase.transactionId);
        
        // Valider l'achat côté backend
        const isValid = await validatePurchaseWithBackend(purchase);
        
        if (isValid) {
          // Finaliser la transaction
          await finishTransactionAsync(purchase, false);
          
          // Mettre à jour le statut de l'abonnement
          await checkSubscriptionStatus();
          
          Alert.alert('Succès', 'Votre abonnement a été activé avec succès !');
          return true;
        } else {
          Alert.alert('Erreur', 'Impossible de valider votre achat. Contactez le support.');
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[SubscriptionService] Erreur lors de l\'achat:', error);
      console.error('[SubscriptionService] Type d\'erreur:', error.constructor.name);
      console.error('[SubscriptionService] Message:', error.message);
      
      let errorMessage = 'Une erreur est survenue lors de l\'achat.';
      
      // Messages d'erreur spécifiques selon le type d'erreur
      if (error.message?.includes('User cancelled')) {
        errorMessage = 'Achat annulé par l\'utilisateur.';
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
      } else if (error.message?.includes('Invalid')) {
        errorMessage = 'Produit non valide. Contactez le support.';
      }
      
      Alert.alert('Erreur', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const validatePurchaseWithBackend = async (purchase: IAPPurchase): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-subscription', {
        body: {
          transactionReceipt: purchase.transactionReceipt,
          productId: purchase.productId,
          platform: Platform.OS,
        },
      });

      if (error) {
        console.error('[SubscriptionService] Erreur lors de la validation:', error);
        return false;
      }

      return data.success && data.isActive;
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
      const purchases = await getPurchaseHistoryAsync();
      console.log('[SubscriptionService] Achats trouvés:', purchases.length);
      
      if (purchases.length === 0) {
        Alert.alert('Information', 'Aucun achat précédent trouvé');
        return false;
      }

      // Valider les achats précédents
      let restored = false;
      for (const purchase of purchases) {
        const isValid = await validatePurchaseWithBackend(purchase);
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
      Alert.alert('Erreur', 'Une erreur est survenue lors de la restauration');
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