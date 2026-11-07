// Identifiants à créer dans Google Play et RevenueCat.
// Le prix réellement facturé est celui de la Play Console, pas ces montants.
export const FREE_MONTHLY_SCANS = 20;

export const SUBSCRIPTION_PRODUCTS = {
  android: [
    {
      id: 'tcmarket-premium-monthly',
      name: 'TCMarket Premium - Mensuel',
      description: 'Scans illimités et alertes de prix',
      price: '3.99',
      currency: 'CHF',
      period: 'monthly',
    },
    {
      id: 'tcmarket-premium-yearly',
      name: 'TCMarket Premium - Annuel',
      description: 'Scans illimités et alertes de prix (environ 37 % de moins que le mensuel)',
      price: '29.99',
      currency: 'CHF',
      period: 'yearly',
    },
  ],
};

export const PREMIUM_FEATURES = {
  free: {
    maxCollectionCards: Infinity,
    maxMonthlyScans: FREE_MONTHLY_SCANS,
    accessMarket: true,
    accessTrading: true,
    priceAlerts: false,
    exportData: false,
  },
  premium: {
    maxCollectionCards: Infinity,
    maxMonthlyScans: Infinity,
    accessMarket: true,
    accessTrading: true,
    priceAlerts: true,
    exportData: true,
  },
};
