import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
  useCallback,
} from 'react';
import { Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesEntitlementInfo,
} from 'react-native-purchases';
import { useAuth } from './auth';
import Constants from 'expo-constants';
import { ExecutionEnvironment } from 'expo-constants';

// PREMIUM DÉSACTIVÉ : SDK conservé ; restrictions et upsell commentés (réactivation plus tard).

/** Expo Go n’embarque pas le natif RevenueCat → `RNPurchases` est null. */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function safePurchasesIsConfigured(): Promise<boolean> {
  try {
    return await Purchases.isConfigured();
  } catch {
    return false;
  }
}

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

const PREMIUM_ENTITLEMENT_ID = 'premium';

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

function readPremiumFromCustomerInfo(
  customerInfo: CustomerInfo
): Pick<RevenueCatStatus, 'isActive' | 'expiresAt' | 'productId'> {
  const premiumEntitlement: PurchasesEntitlementInfo | undefined =
    customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

  return {
    isActive: !!premiumEntitlement,
    expiresAt: premiumEntitlement?.expirationDate
      ? new Date(premiumEntitlement.expirationDate)
      : null,
    productId: premiumEntitlement?.productIdentifier ?? null,
  };
}

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;

  const [subscriptionStatus, setSubscriptionStatus] = useState<RevenueCatStatus>({
    isActive: false,
    expiresAt: null,
    productId: null,
    loading: true,
  });
  const [offerings, setOfferings] = useState<PurchasesOffering[]>([]);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);

  const customerInfoListenerRef = useRef<
    ((info: CustomerInfo) => void) | null
  >(null);

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    if (__DEV__) {
      setSubscriptionStatus({
        isActive: true,
        expiresAt: null,
        productId: 'dev-premium',
        loading: false,
      });
      return;
    }

    const { isActive, expiresAt, productId } =
      readPremiumFromCustomerInfo(customerInfo);

    setSubscriptionStatus({
      isActive,
      expiresAt,
      productId,
      loading: false,
    });
  }, []);

  const unregisterCustomerInfoListener = useCallback(() => {
    if (!customerInfoListenerRef.current) return;
    try {
      Purchases.removeCustomerInfoUpdateListener(
        customerInfoListenerRef.current
      );
    } catch {
      /* natif absent (Expo Go) */
    }
    customerInfoListenerRef.current = null;
  }, []);

  const registerCustomerInfoListener = useCallback(() => {
    unregisterCustomerInfoListener();
    if (isExpoGo) return;
    try {
      const listener = (info: CustomerInfo) => {
        console.log('[RevenueCat] CustomerInfo mise à jour (listener)');
        applyCustomerInfo(info);
      };
      customerInfoListenerRef.current = listener;
      Purchases.addCustomerInfoUpdateListener(listener);
    } catch {
      /* natif absent */
    }
  }, [applyCustomerInfo, unregisterCustomerInfoListener]);

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        const currentOffering = offerings.current;
        setOfferings([currentOffering]);
        setPackages(currentOffering.availablePackages);
      } else {
        setOfferings([]);
        setPackages([]);
      }
    } catch (error) {
      console.error('[RevenueCat] Erreur offerings:', error);
      setOfferings([]);
      setPackages([]);
    }
  };

  /** Synchronise avec Google Play / App Store puis recharge les droits (hors mode dev). */
  const refreshEntitlementsFromStore = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    if (__DEV__) {
      return;
    }

    try {
      await Purchases.syncPurchases();
    } catch (e) {
      console.warn('[RevenueCat] syncPurchases:', e);
    }
    try {
      await Purchases.invalidateCustomerInfoCache();
    } catch (e) {
      console.warn('[RevenueCat] invalidateCustomerInfoCache:', e);
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      applyCustomerInfo(customerInfo);
    } catch (e) {
      console.error('[RevenueCat] getCustomerInfo après sync:', e);
      setSubscriptionStatus({
        isActive: false,
        expiresAt: null,
        productId: null,
        loading: false,
      });
    }
  }, [applyCustomerInfo]);

  const checkSubscriptionStatus = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    try {
      setSubscriptionStatus((prev) => ({ ...prev, loading: true }));

      if (__DEV__) {
        setSubscriptionStatus({
          isActive: true,
          expiresAt: null,
          productId: 'dev-premium',
          loading: false,
        });
        return;
      }

      await refreshEntitlementsFromStore();
    } catch (error) {
      console.error('[RevenueCat] checkSubscriptionStatus:', error);
      setSubscriptionStatus({
        isActive: false,
        expiresAt: null,
        productId: null,
        loading: false,
      });
    }
  }, [refreshEntitlementsFromStore]);

  const purchasesSignOut = useCallback(async () => {
    unregisterCustomerInfoListener();
    try {
      if (await safePurchasesIsConfigured()) {
        await Purchases.logOut();
      }
    } catch (e) {
      console.warn('[RevenueCat] logOut:', e);
    }
    setSubscriptionStatus({
      isActive: false,
      expiresAt: null,
      productId: null,
      loading: false,
    });
    setOfferings([]);
    setPackages([]);
    setLoading(false);
  }, [unregisterCustomerInfoListener]);

  const initializeRevenueCat = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;

    setLoading(true);

    const apiKey = Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
      default: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    });

    if (!apiKey) {
      console.error('[RevenueCat] Clés API manquantes');
      Alert.alert(
        'Configuration',
        'Clés RevenueCat manquantes (EXPO_PUBLIC_REVENUECAT_*_API_KEY).'
      );
      setLoading(false);
      return;
    }

    if (isExpoGo) {
      console.warn(
        '[RevenueCat] Expo Go : pas de module natif achats. Lancez `npx expo run:android` (dev client) pour tester RevenueCat.'
      );
      setSubscriptionStatus({
        isActive: __DEV__,
        expiresAt: null,
        productId: __DEV__ ? 'dev-expo-go' : null,
        loading: false,
      });
      setOfferings([]);
      setPackages([]);
      setLoading(false);
      return;
    }

    try {
      const alreadyConfigured = await safePurchasesIsConfigured();
      if (!alreadyConfigured) {
        await Purchases.configure({ apiKey });
      }

      await Purchases.logIn(currentUser.id);
      registerCustomerInfoListener();
      await loadOfferings();
      await checkSubscriptionStatus();
    } catch (error) {
      console.error('[RevenueCat] Initialisation:', error);
      Alert.alert(
        'Erreur',
        'Impossible d’initialiser les achats in-app. Réessayez plus tard.'
      );
    } finally {
      setLoading(false);
    }
  }, [checkSubscriptionStatus, registerCustomerInfoListener]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      void purchasesSignOut();
      return;
    }

    let cancelled = false;
    void (async () => {
      await initializeRevenueCat();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, initializeRevenueCat, purchasesSignOut]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (!isAuthenticated || !userRef.current?.id) return;
      void checkSubscriptionStatus();
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [isAuthenticated, checkSubscriptionStatus]);

  const purchaseSubscription = async (
    packageToPurchase: PurchasesPackage
  ): Promise<boolean> => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté pour effectuer un achat');
      return false;
    }

    if (isExpoGo) {
      Alert.alert(
        'Expo Go',
        'Les achats in-app ne sont pas disponibles dans Expo Go. Utilisez un build de développement (expo run:android / run:ios).'
      );
      return false;
    }

    try {
      setLoading(true);
      const { customerInfo } = await Purchases.purchasePackage(
        packageToPurchase
      );
      const premiumEntitlement =
        customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

      if (premiumEntitlement) {
        applyCustomerInfo(customerInfo);
        return true;
      }
      Alert.alert(
        'Erreur',
        'L’achat semble OK mais l’abonnement n’est pas actif. Contactez le support.'
      );
      return false;
    } catch (error: any) {
      let errorMessage = 'Une erreur est survenue lors de l’achat.';
      if (error.code === 'PURCHASES_ERROR_PURCHASE_CANCELLED') {
        errorMessage = 'Achat annulé.';
      } else if (error.code === 'PURCHASES_ERROR_NETWORK_ERROR') {
        errorMessage = 'Erreur réseau.';
      } else if (
        error.code === 'PURCHASES_ERROR_PRODUCT_NOT_AVAILABLE_FOR_PURCHASE'
      ) {
        errorMessage = 'Produit non disponible.';
      }
      Alert.alert('Abonnement', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (!user) {
      Alert.alert('Erreur', 'Connectez-vous pour restaurer vos achats');
      return false;
    }

    if (isExpoGo) {
      Alert.alert(
        'Expo Go',
        'La restauration des achats nécessite un build avec le module natif (expo run:android / run:ios).'
      );
      return false;
    }

    try {
      setLoading(true);
      const customerInfo = await Purchases.restorePurchases();
      applyCustomerInfo(customerInfo);
      const active =
        !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] || __DEV__;
      if (active) {
        Alert.alert('Succès', 'Achats restaurés.');
        return true;
      }
      Alert.alert('Information', 'Aucun abonnement actif trouvé');
      return false;
    } catch (error) {
      console.error('[RevenueCat] restore:', error);
      Alert.alert('Erreur', 'Restauration impossible.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <RevenueCatContext.Provider
      value={{
        subscriptionStatus,
        offerings,
        packages,
        purchaseSubscription,
        restorePurchases,
        checkSubscriptionStatus,
        loading,
      }}
    >
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

/** Zones de l’app où l’on affiche une incitation Premium (sans bloquer l’accès). */
export type PremiumUpsellContext = 'market' | 'trading' | 'scan' | 'collection';

export type PremiumUpsellOptions = {
  /** Réservé aux anciens flux (scan) — ignoré, navigation vers /premium uniquement */
  onLater?: () => void;
};

/**
 * Restrictions payantes désactivées : tout le monde accède aux écrans.
 * Ancienne logique (blocage) conservée en commentaire pour réactivation éventuelle.
 */
export function useSubscriptionRestrictions() {
  const { subscriptionStatus } = useRevenueCat();
  const router = useRouter();
  const isPremium = subscriptionStatus.isActive;

  // --- Ancienne logique de blocage (ne plus utiliser tant que les comptes gratuits sont ouverts) ---
  // const canAccessMarket = subscriptionStatus.isActive;
  // const canAccessTrading = subscriptionStatus.isActive;
  // const canScanCard = async (count: number) =>
  //   subscriptionStatus.isActive || count < 10;
  // const getMaxCollectionCards = () =>
  //   subscriptionStatus.isActive ? Infinity : 10;
  // const canAccessFullCollection = subscriptionStatus.isActive;

  const canAccessMarket = true;
  const canAccessTrading = true;

  const canScanCard = async (_currentInventoryCount: number): Promise<boolean> =>
    true;

  const getMaxCollectionCards = (): number => Infinity;

  const canAccessFullCollection = true;

  const showPremiumUpsell = useCallback(
    (feature: PremiumUpsellContext, options?: PremiumUpsellOptions) => {
      // PREMIUM DÉSACTIVÉ — réactiver la navigation vers /premium
      // if (isPremium) {
      //   options?.onLater?.();
      //   return;
      // }
      // router.push(`/premium?from=${feature}`);
      options?.onLater?.();
    },
    [isPremium, router]
  );

  return {
    canAccessMarket,
    canAccessTrading,
    canScanCard,
    getMaxCollectionCards,
    canAccessFullCollection,
    isPremium,
    showPremiumUpsell,
  };
}
