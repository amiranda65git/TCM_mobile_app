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
import { FREE_MONTHLY_SCANS } from '../constants/SubscriptionProducts';
import { getMonthlyScanCount } from './scanQuota';

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
        isActive: false,
        expiresAt: null,
        productId: null,
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
        !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
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

/** Écrans qui mènent vers l’abonnement. Marché, collection et trading restent ouverts. */
export type PremiumUpsellContext = 'market' | 'trading' | 'scan' | 'collection' | 'alerts';

export type PremiumUpsellOptions = {
  onLater?: () => void;
};

/**
 * Le marché, la collection et les échanges restent ouverts.
 * Le gratuit a FREE_MONTHLY_SCANS scans par mois. Les alertes de prix sont Premium.
 */
export function useSubscriptionRestrictions() {
  const { subscriptionStatus } = useRevenueCat();
  const { user } = useAuth();
  const router = useRouter();
  const isPremium = subscriptionStatus.isActive;

  const canAccessMarket = true;
  const canAccessTrading = true;
  const canAccessFullCollection = true;
  const canUsePriceAlerts = isPremium || subscriptionStatus.loading;

  const getMaxCollectionCards = (): number => Infinity;

  const canScanCard = useCallback(async (): Promise<boolean> => {
    if (subscriptionStatus.loading || subscriptionStatus.isActive) return true;
    if (!user?.id) return true;
    const count = await getMonthlyScanCount(user.id);
    return count < FREE_MONTHLY_SCANS;
  }, [subscriptionStatus.loading, subscriptionStatus.isActive, user?.id]);

  const showPremiumUpsell = useCallback(
    (feature: PremiumUpsellContext, options?: PremiumUpsellOptions) => {
      if (isPremium) {
        options?.onLater?.();
        return;
      }
      router.push(`/premium?from=${feature}`);
    },
    [isPremium, router]
  );

  return {
    canAccessMarket,
    canAccessTrading,
    canScanCard,
    canUsePriceAlerts,
    getMaxCollectionCards,
    canAccessFullCollection,
    isPremium,
    showPremiumUpsell,
  };
}
