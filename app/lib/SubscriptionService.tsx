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
  android: [
    'tcmarket_premium_pokemon:tcmarket-premium-monthly',
    'tcmarket_premium_pokemon:tcmarket-premium-yearly',
    'tcmarket_premium_pokemon:tcmarket-premium-yearly2'
  ],
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
      
      // Popin de diagnostic technique
      Alert.alert(
        'Diagnostic Technique',
        `Plateforme : ${Platform.OS}\n` +
        `Version : ${Platform.Version}\n` +
        `Mode dev : ${__DEV__ ? 'Oui' : 'Non'}\n` +
        `Produits configurés : ${SUBSCRIPTION_PRODUCTS.join(', ')}\n` +
        `User ID : ${user?.id || 'Non connecté'}`
      );
      
      // Connexion aux services IAP
      await initConnection();
      
      // Récupération des produits disponibles
      if (SUBSCRIPTION_PRODUCTS.length > 0) {
        try {
          const availableProducts = await getSubscriptions(SUBSCRIPTION_PRODUCTS);
          setProducts(availableProducts);
          
          if (availableProducts.length === 0) {
            Alert.alert(
              'Configuration IAP',
              'Aucun abonnement trouvé. Vérifiez la configuration Google Play Console.'
            );
          }
        } catch (productError) {
          Alert.alert(
            'Erreur abonnements',
            `Impossible de récupérer les abonnements :\n${(productError as Error).message}`
          );
          throw productError;
        }
      } else {
        Alert.alert(
          'Configuration IAP',
          `Aucun abonnement configuré pour cette plateforme : ${Platform.OS}`
        );
      }
    } catch (error) {
      Alert.alert(
        'Erreur IAP',
        `Erreur d'initialisation :\n${(error as Error).message}\n\n` +
        'Vérifiez votre connexion internet ou contactez le support.'
      );
      
      // Pour le développement Android, on peut simuler les produits
      if (__DEV__ && Platform.OS === 'android') {
        Alert.alert(
          'Mode développement',
          'Simulation des produits activée'
        );
        setProducts([
          {
            productId: 'tcmarket-premium-monthly',
            price: '4,99 €',
            localizedPrice: '4,99 €',
            title: 'TCMarket Premium Mensuel',
            description: 'Abonnement premium mensuel',
            currency: 'EUR'
          },
          {
            productId: 'tcmarket-premium-yearly',
            price: '49,99 €',
            localizedPrice: '49,99 €',
            title: 'TCMarket Premium Annuel',
            description: 'Abonnement premium annuel',
            currency: 'EUR'
          },
          {
            productId: 'tcmarket-premium-yearly2',
            price: '39,99 €',
            localizedPrice: '39,99 €',
            title: 'TCMarket Premium Annuel 2',
            description: 'Abonnement premium annuel (version 2)',
            currency: 'EUR'
          }
        ] as ProductSimu[]);
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
      Alert.alert('Erreur abonnement', 'Impossible de vérifier le statut de votre abonnement.');
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
      
      const product = products.find(p => p.productId === productId);
      if (!product) {
        Alert.alert('Erreur', 'Produit non trouvé. Veuillez réessayer.');
        return false;
      }
      
      // Mode développement : simuler l'achat
      if (__DEV__ && Platform.OS === 'android') {
        Alert.alert(
          'Mode développement',
          'Simulation d\'achat en cours...'
        );
        
        const mockPurchase = {
          productId: productId,
          transactionId: `dev_android_${Date.now()}`,
          transactionReceipt: `mock_receipt_${Date.now()}`,
          transactionDate: Date.now(),
        };
        
        const isValid = await validatePurchaseWithBackend(mockPurchase as any);
        
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
      
      Alert.alert(
        'Achat en cours',
        'Connexion au service de paiement...'
      );
      
      const purchase = await requestPurchase(purchaseRequest);
      
      if (purchase && !Array.isArray(purchase)) {
        Alert.alert(
          'Validation en cours',
          'Vérification de votre achat...'
        );
        
        const isValid = await validatePurchaseWithBackend(purchase as any);
        
        if (isValid) {
          await finishTransaction({ purchase, isConsumable: false });
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
      const { data, error } = await supabase.functions.invoke('validate-subscription', {
        body: {
          transactionReceipt: purchase.transactionReceipt,
          productId: purchase.productId,
          platform: Platform.OS,
        },
      });

      if (error) {
        console.error('[SubscriptionService] Erreur lors de la validation:', error);
        Alert.alert('Erreur abonnement', 'Erreur lors de la validation de l\'achat.');
        return false;
      }

      return data.success && data.isActive;
    } catch (error) {
      console.error('[SubscriptionService] Erreur lors de la validation:', error);
      Alert.alert('Erreur abonnement', 'Erreur lors de la validation de l\'achat.');
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