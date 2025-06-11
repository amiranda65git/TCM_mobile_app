// Configuration des produits d'abonnement in-app
export const SUBSCRIPTION_PRODUCTS = {
  // Produits iOS (App Store)
  ios: [
    {
      id: 'tcmarket-premium-monthly',
      name: 'TCMarket Premium - Mensuel',
      description: 'Accès complet à toutes les fonctionnalités',
      price: '2.99',
      currency: 'CHF',
      period: 'monthly'
    },
    {
      id: 'tcmarket-premium-yearly',
      name: 'TCMarket Premium - Annuel',
      description: 'Accès complet à toutes les fonctionnalités (économisez 20%)',
      price: '29.99',
      currency: 'CHF',
      period: 'yearly'
    }
  ],
  
  // Produits Android (Google Play)
  android: [
    {
      id: 'tcmarket-premium-monthly',
      name: 'TCMarket Premium - Mensuel',
      description: 'Accès complet à toutes les fonctionnalités',
      price: '2.99',
      currency: 'CHF',
      period: 'monthly'
    },
    {
      id: 'tcmarket-premium-yearly',
      name: 'TCMarket Premium - Annuel',
      description: 'Accès complet à toutes les fonctionnalités (économisez 20%)',
      price: '29.99',
      currency: 'CHF',
      period: 'yearly'
    },
    {
      id: 'tcmarket-premium-yearly2',
      name: 'TCMarket Premium - Annuel 2',
      description: 'Accès complet à toutes les fonctionnalités (plan alternatif)',
      price: '24.99',
      currency: 'CHF',
      period: 'yearly'
    }
  ]
};

// Fonctionnalités Premium
export const PREMIUM_FEATURES = {
  // Fonctionnalités gratuites (limitées)
  free: {
    maxCollectionCards: 10,
    maxScanCards: 10,
    accessMarket: false,
    accessTrading: false,
    priceAlerts: false,
    exportData: false
  },
  
  // Fonctionnalités Premium (illimitées)
  premium: {
    maxCollectionCards: Infinity,
    maxScanCards: Infinity,
    accessMarket: true,
    accessTrading: true,
    priceAlerts: true,
    exportData: true
  }
};

// Messages de restriction
export const RESTRICTION_MESSAGES = {
  collection: {
    title: 'Collection limitée',
    message: 'Vous ne pouvez voir que les 10 premières cartes de votre collection. Souscrivez à un abonnement pour voir toutes vos cartes.'
  },
  scan: {
    title: 'Limitation de scan',
    message: 'Vous avez atteint la limite de 10 cartes scannées. Souscrivez à un abonnement pour continuer à scanner.'
  },
  market: {
    title: 'Accès au marché',
    message: 'L\'accès au marché est réservé aux membres Premium. Souscrivez à un abonnement pour accéder aux prix du marché.'
  },
  trading: {
    title: 'Accès au trading',
    message: 'L\'accès au trading est réservé aux membres Premium. Souscrivez à un abonnement pour acheter et vendre des cartes.'
  }
}; 