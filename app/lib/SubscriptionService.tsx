import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  initConnection, 
  getProducts, 
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
  android: ['tcmarket-premium-monthly', 'tcmarket-premium-yearly', 'tcmarket-premium-yearly2'],
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
      
      console.log('[SubscriptionService] Initialisation des IAP...');
      
      // Connexion aux services IAP
      await initConnection();
      console.log('[SubscriptionService] Connexion aux services IAP réussie');

      // Récupération des produits disponibles
      if (SUBSCRIPTION_PRODUCTS.length > 0) {
        console.log('[SubscriptionService] Récupération des produits:', SUBSCRIPTION_PRODUCTS);
        const availableProducts = await getProducts(SUBSCRIPTION_PRODUCTS);
        setProducts(availableProducts);
        console.log('[SubscriptionService] Produits récupérés:', availableProducts.map((p: any) => ({ id: p.productId, price: p.price })));
        
        if (availableProducts.length === 0) {
          console.warn('[SubscriptionService] Aucun produit trouvé. Vérifiez la configuration Google Play Console.');
        }
      } else {
        console.warn('[SubscriptionService] Aucun produit configuré pour cette plateforme');
      }
    } catch (error) {
      console.error('[SubscriptionService] Erreur d\'initialisation IAP:', error);
      console.error('[SubscriptionService] Type d\'erreur:', (error as Error).constructor.name);
      console.error('[SubscriptionService] Message:', (error as Error).message);
      
      Alert.alert('Erreur abonnement', 'Impossible de récupérer les produits d\'abonnement. Vérifiez votre connexion internet ou contactez le support.');
      // Pour le développement Android, on peut simuler les produits
      if (__DEV__ && Platform.OS === 'android') {
        console.log('[SubscriptionService] Mode développement: simulation des produits');
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
      
      // Remplace 'id' par 'productId' pour la recherche de produit
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
        
        // Correction du mockPurchase pour inclure productId
        const mockPurchase = {
          productId: productId,
          transactionId: `dev_android_${Date.now()}`,
          transactionReceipt: `mock_receipt_${Date.now()}`,
          transactionDate: Date.now(),
        };
        
        // Valider l'achat côté backend
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
      
      // Effectuer l'achat réel pour un abonnement
      let purchaseRequest;
      if (Platform.OS === 'ios') {
        purchaseRequest = { request: { sku: productId }, type: 'subs' as const };
      } else {
        purchaseRequest = {
          request: {
            skus: [productId],
            subscriptionOffers: [] // Obligatoire même vide
          },
          type: 'subs' as const
        };
      }
      
      const purchase = await requestPurchase(purchaseRequest);
      
      if (purchase && !Array.isArray(purchase)) {
        console.log('[SubscriptionService] Achat réussi:', purchase.transactionId);
        
        // Valider l'achat côté backend
        const isValid = await validatePurchaseWithBackend(purchase as any);
        
        if (isValid) {
          // Finaliser la transaction
          await finishTransaction({ purchase, isConsumable: false });
          
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
      console.error('[SubscriptionService] Type d\'erreur:', (error as Error).constructor.name);
      console.error('[SubscriptionService] Message:', (error as Error).message);
      
      let errorMessage = 'Une erreur est survenue lors de l\'achat.';
      
      // Messages d'erreur spécifiques selon le type d'erreur
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