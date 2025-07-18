export default {
  welcome: {
    step1: 'Scannez vos cartes pokemon',
    step2: 'Emportez votre collection partout avec vous',
    step3: 'Suivez la valeur de votre collection',
    step4: 'Vendez vos cartes et gagnez de l\'argent',
  },
  home: {
    greeting: 'Bonjour',
    collection: 'Ma collection',
    viewAll: 'Voir tout',
    currentValue: 'Valeur actuelle',
    cards: 'Cartes',
    card: 'Carte',
    inventory: 'Inventaire',
    createFolder: 'Créer un dossier',
    decks: 'Decks',
    createDeck: 'Créer un deck',
    wishlist: 'Liste de souhaits',
    alerts: 'Alertes',
    tradelist: 'Liste d\'échange',
    sold: 'Vendues',
    editions: 'Editions',
    cardsCategory: 'Cartes',
    news: 'Nouveautés',
    user: 'Utilisateur'
  },
  collection: {
    empty: 'Collection vide',
    emptyText: 'Ajoutez vos premières cartes en utilisant l\'onglet Scan ou le bouton Ajouter ci-dessus.'
  },
  edition: {
    details: 'Détails de l\'édition',
    notFound: 'Édition non trouvée',
    value: 'Valeur totale',
    cardsOwned: 'Cartes possédées',
    allCards: 'Toutes les cartes',
    onlyOwned: 'Uniquement possédées'
  },
  wishlist: {
    empty: 'Liste de souhaits vide',
    emptyText: 'Ajoutez des cartes à votre wishlist pour les retrouver facilement ici.',
    addCard: 'Ajouter à la wishlist',
    removeCard: 'Retirer de la wishlist',
    addCardShort: 'Ajouter',
    removeCardShort: 'Retirer',
    add: 'Favoris'
  },
  market: {
    empty: 'Marché en construction',
    emptyText: 'Cette fonctionnalité sera bientôt disponible. Revenez prochainement pour acheter et vendre des cartes.',
    buyCard: 'Acheter une carte',
    cardsForSale: 'Cartes en vente par la communauté',
    noCardsForSale: 'Aucune carte en vente actuellement',
    unknownSeller: 'Nom du vendeur indisponible',
    buyOnGamezest: 'Acheter sur GameZest.ch',
    tabs: {
      all: 'Toutes',
      gainers: 'Hausses',
      losers: 'Baisses',
      watched: 'Surveillées'
    },
    noWatched: 'Aucune carte surveillée pour le moment.',
    globalTrend: 'Tendance globale du marché',
    newCard: 'Nouvelle carte',
    searchPlaceholder: 'Rechercher une carte...',
    searching: 'Recherche en cours...',
    noResults: 'Aucun résultat trouvé',
    noPriceYet: 'Pas de prix',
    filteredBy: 'Filtré par',
    noFilterResults: 'Aucune carte ne correspond à ce filtre',
    typeToSearch: 'Tapez pour rechercher',
    refuseOfferAlertMessage: "Nous allons informer le membre que vous refusez son offre. Il pourra vous proposer une nouvelle offre.",
    acceptOfferAlertTitle: "Accepter l'offre",
    acceptOfferAlertMessage: "En acceptant l'offre vous acceptez de communiquer votre email au membre intéressé par votre carte.",
    acceptOfferSuccess: "Les emails ont été envoyés à l'acheteur et au vendeur.",
    acceptOfferError: "Erreur lors de l'envoi des emails.",
    notificationOfferAccepted: "Votre offre pour la carte {{card}} a été acceptée ! Vous pouvez contacter le vendeur à l'adresse indiquée.",
    notificationOfferRefused: "Votre offre pour la carte {{card}} a été refusée.",
    markAsSold: "Marquer comme vendue",
    markAsSoldConfirmTitle: "Marquer la carte comme vendue",
    markAsSoldConfirmMessage: "Êtes-vous sûr de vouloir marquer cette carte comme vendue ? Elle ne sera plus visible dans votre collection.",
    cardMarkedAsSold: "Carte marquée comme vendue avec succès",
    markAsSoldError: "Erreur lors du marquage de la carte comme vendue",
    sold: "Vendu",
    sellDetails: "Détails de la vente",
    receivedOffers: "Offres reçues",
    noOffers: "Aucune offre reçue",
    updateSale: "Mettre à jour la vente",
    cancelSale: "Annuler la vente",
    priceInvalid: "Prix invalide",
    saleUpdated: "Vente mise à jour avec succès",
    updateError: "Erreur lors de la mise à jour",
    saleUpdateError: "Erreur lors de la mise à jour de la vente",
    cancelSaleTitle: "Annuler la vente",
    cancelSaleMessage: "Êtes-vous sûr de vouloir retirer cette carte de la vente ?",
    saleCancelled: "Vente annulée avec succès",
    cancelError: "Erreur lors de l'annulation",
    sessionExpired: "Session expirée, veuillez vous reconnecter",
    editSale: "Modifier la vente",
    marketPrices: "Prix du marché",
    currentPrice: "Prix actuel",
    currentCondition: "Condition actuelle",
    notSpecified: "Non spécifiée",
    sellingPrice: "Prix de vente",
    accept: "Accepter",
    refuse: "Refuser",
    refuseOfferTitle: "Refuser l'offre",
    lowPrice: "Prix bas",
    highPrice: "Prix haut",
    midPrice: "Prix moyen",
    makeAnOffer: "Faire une offre",
    yourOffer: "Votre offre",
    sendOffer: "Envoyer l'offre"
  },
  alerts: {
    title: 'Notifications',
    noNotifications: 'Aucune notification pour le moment',
    markAsRead: 'Marquer comme lu',
    markAllAsRead: 'Tout marquer comme lu',
    wishlistItemSale: 'Carte wishlist en vente',
    wishlistItemSaleDesc: 'La carte {{cardName}} de votre wishlist est maintenant en vente',
    priceAlert: 'Alerte de prix',
    priceAlertDesc: 'Le prix de {{cardName}} a changé de {{percent}}%',
    deleteAll: 'Supprimer toutes les notifications',
    confirmDeleteAll: 'Êtes-vous sûr de vouloir supprimer toutes vos notifications ?',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    card: 'carte',
    cards: 'cartes',
    priceIncreased: 'Le prix a augmenté',
    priceDecreased: 'Le prix a diminué',
    unreadOnly: 'Non lues uniquement'
  },
  scan: {
    scanCard: 'Scanner une carte',
    error: 'Erreur',
    captureError: 'Erreur lors de la capture de la photo',
    imageAnalysisError: 'Erreur lors de l\'analyse de l\'image',
    noTextDetected: 'Aucun texte détecté',
    tryBetterLighting: 'Veuillez réessayer avec une meilleure luminosité',
    loadingCamera: 'Chargement caméra...',
    analyzingCard: 'Analyse de la carte...',
    detecting: 'Détection automatique...',
    placeCard: 'Placez une carte Pokémon dans le cadre',
    orScanManually: 'ou scannez manuellement',
    scanManually: 'Scanner manuellement',
    scanAgain: 'Scanner à nouveau',
    cardDetected: 'Carte détectée',
    nameLabel: 'Nom',
    hpLabel: 'Points de vie',
    numberLabel: 'Numéro',
    addToCollection: 'Ajouter à la collection',
    cancel: 'Annuler',
    goToCollection: 'Voir ma collection',
    scanResults: 'Résultats de l\'analyse',
    matchingCards: 'Cartes correspondantes',
    noMatchingCards: 'Aucune carte correspondante trouvée',
    cardDetails: 'Détails de la carte',
    edition: 'Édition',
    number: 'Numéro',
    hp: 'PV',
    rarity: 'Rareté',
    success: 'Succès',
    addedToCollection: 'Carte ajoutée à votre collection avec succès !',
    addToCollectionError: 'Erreur lors de l\'ajout à la collection',
    unexpectedError: 'Une erreur inattendue s\'est produite',
    adding: 'Ajout en cours...',
    scan: 'Scanner',
    scans: 'scans',
    selectCondition: 'Sélectionnez l\'état de la carte',
    searchManually: 'Rechercher manuellement',
    searchPlaceholder: 'Rechercher une carte...',
    searching: 'Recherche en cours...',
    noResults: 'Aucun résultat trouvé',
    restrictionTitle: 'Limitation atteinte',
    restrictionMessage: 'Vous avez atteint la limite de 10 cartes. Souscrivez à un abonnement pour continuer à scanner.'
  },
  settings: {
    title: 'Paramètres',
    modifyUsername: 'Modifier le pseudo',
    subscription: 'Abonnement',
    free: 'Gratuit',
    premium: 'Premium',
    manageSubscription: 'Gérer mon abonnement',
    upgradeToPremium: 'Passer Premium',
    customization: 'Personnalisation',
    darkTheme: 'Thème sombre',
    lightTheme: 'Thème clair',
    permissions: 'Permissions',
    manageAccess: 'Gérer les accès',
    password: 'Mot de passe',
    modify: 'Modifier',
    about: 'À propos',
    termsAndConditions: 'Conditions générales',
    privacyPolicy: 'Avis de confidentialité',
    language: 'Langue',
    chooseLanguage: 'Choisir la langue',
    french: 'Français',
    english: 'Anglais',
    account: 'Compte',
    logout: 'Se déconnecter',
    deleteAccount: 'Supprimer le compte',
    version: 'Version',
    add: 'Ajouter',
    sell: 'Vendre',
    filter: 'Filtrer',
    export: 'Exporter',
    moderation: 'Modération',
    reportUser: 'Signaler un utilisateur',
    reportUserDescription: 'Veuillez indiquer le pseudonyme de l\'utilisateur que vous souhaitez signaler.',
    usernamePlaceholder: 'Pseudonyme de l\'utilisateur',
    commentPlaceholder: 'Commentaire (optionnel)',
    reportButton: 'Signaler',
    subscription: {
      monthly: 'Mensuel',
      annual: 'Annuel',
      premium: 'Premium'
    },
    changeUsernameModal: {
      title: 'Modifier le pseudo',
      placeholder: 'Entrez votre nouveau pseudo',
      cancel: 'Annuler',
      save: 'Enregistrer'
    },
    alerts: {
      success: 'Succès',
      error: 'Erreur',
      usernameUpdated: 'Votre pseudo a été mis à jour avec succès',
      avatarUpdated: 'Votre avatar a été mis à jour avec succès',
      emptyUsername: 'Le pseudo ne peut pas être vide',
      usernameTooShort: 'Le pseudo doit contenir au moins 3 caractères',
      usernameInvalidChars: 'Le pseudo ne peut contenir que des lettres, chiffres et _',
      usernameAlreadyTaken: 'Ce pseudo est déjà utilisé',
      confirmDeleteAccount: 'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      comingSoon: 'Fonctionnalité à venir prochainement',
      readError: 'Impossible de lire le fichier image. Réessayez avec une autre image.',
      saveError: 'L\'image a été sauvegardée localement mais pas sur le serveur. Réessayez ultérieurement.',
      permissionDenied: 'Nous avons besoin de l\'accès à votre galerie pour changer votre avatar',
      lastWeek: 'Dernière semaine'
    }
  },
  login: {
    emailPlaceholder: 'Adresse email',
    passwordPlaceholder: 'Mot de passe',
    signIn: 'Se connecter',
    or: 'ou',
    continueWithGoogle: 'Continuer avec Google',
    continueWithApple: 'Continuer avec Apple',
    forgotPassword: 'Mot de passe oublié ?',
    createAccount: 'Créer un compte',
    required: 'Vous devez être connecté pour effectuer cette action'
  },
  signup: {
    title: 'Créer un compte',
    emailPlaceholder: 'Adresse email',
    passwordPlaceholder: 'Mot de passe',
    confirmPasswordPlaceholder: 'Confirmer le mot de passe',
    createAccount: 'Créer mon compte',
    error: 'Erreur',
    success: 'Succès',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
    verificationEmailSent: 'Un email de vérification vous a été envoyé. Veuillez vérifier votre boîte de réception.',
    fillAllFields: 'Veuillez remplir tous les champs',
    genericError: 'Une erreur inattendue s\'est produite',
    alreadyHaveAccount: 'Vous avez déjà un compte ?'
  },
  forgotPassword: {
    title: 'Mot de passe oublié',
    description: 'Entrez votre adresse email pour recevoir un lien de réinitialisation',
    emailPlaceholder: 'Votre adresse email',
    sendLink: 'Envoyer le lien',
    backToLogin: 'Retour à la connexion',
    success: 'Email envoyé',
    successMessage: 'Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.',
    error: 'Erreur',
    invalidEmail: 'Veuillez entrer une adresse email valide'
  },
  auth: {
    verifying: 'Vérification de votre email en cours...'
  },
  navigation: {
    home: 'Accueil',
    collection: 'Collection',
    scan: 'Scan',
    market: 'Marché',
    trading: 'Trading'
  },
  general: {
    loading: 'Chargement...',
    back: 'Retour',
    common: 'Commun',
    skip: 'Passer',
    next: 'Suivant',
    getStarted: 'Commencer',
    all: 'Tous',
    ok: 'OK',
    error: 'Erreur',
    cancel: 'Annuler',
    success: 'Succès',
    confirm: 'Confirmer'
  },
  card: {
    buy: 'Acheter',
    sell: 'Vendre',
    addToWishlist: 'Ajouter à la wishlist',
    priceAlert: 'Alerte de prix',
    view: 'Voir détails',
    removeFromCollection: 'Supprimer',
    addToCollection: 'Ajouter à la collection',
    owned: 'Possédée',
    forSale: 'En vente',
    removeFromSale: 'Retirer de la vente',
    notFound: 'Carte non trouvée',
    showOfficial: 'Voir l\'officielle',
    showMine: 'Voir ma carte',
    rarity: 'Rareté',
    edition: 'Édition',
    condition: 'État',
    selectCondition: 'Sélectionner l\'état',
    conditions: {
      nearmint: 'Quasi Neuf',
      excellent: 'Excellent',
      good: 'Bon',
      played: 'Joué'
    },
    prices: 'Prix du marché',
    lowPrice: 'Prix bas',
    midPrice: 'Prix moyen',
    highPrice: 'Prix haut',
    marketPrice: 'Prix du marché',
    myCardValue: 'Prix de vente',
    lastUpdated: 'Dernière mise à jour',
    viewPriceHistory: 'Voir l\'historique des prix',
    priceHistory: 'Historique des prix',
    date: 'Date',
    source: 'Source',
    noPriceHistory: 'Aucun historique de prix disponible pour cette carte',
    sellCard: 'Vendre la carte',
    sellingPrice: 'Prix de vente',
    updatePrice: 'Mettre à jour le prix',
    cancelSale: 'Annuler la vente',
    alreadyForSale: 'Cette carte est déjà en vente',
    currentPrice: 'Prix actuel',
    removePriceAlert: 'Supprimer l\'alerte',
    alert: 'Alerte',
    bid: 'Offre',
    realPhoto: 'Photo réelle',
    noUserPhoto: 'Pas de photo utilisateur',
    sellerPrice: 'Prix demandé'
  },
  notifications: {
    title: 'Notifications',
    empty: 'Vous n\'avez aucune notification pour le moment',
    clearAll: 'Tout effacer',
    new: 'Nouveau',
    priceChange: 'Variation de prix',
    wishlistInterest: 'Intérêt wishlist',
    yesterday: 'hier',
    today: 'aujourd\'hui',
  },
  trading: {
    title: 'Trading',
    buy: 'Achat',
    sell: 'Vente',
    no_cards_to_buy: 'Aucune carte à acheter actuellement.',
    filters: {
      title: 'Filtres et tri',
      cardName: 'Nom de la carte',
      cardNamePlaceholder: 'Rechercher une carte...',
      editionName: 'Nom de l\'édition',
      editionNamePlaceholder: 'Rechercher une édition...',
      sortBy: 'Trier par',
      sortName: 'Nom',
      sortPrice: 'Prix',
      reset: 'Réinitialiser',
      apply: 'Appliquer'
    }
  },
  sold: {
    noCards: "Aucune carte vendue pour le moment",
    soldOn: "Vendu le",
  },
  allCards: {
    title: 'Toutes mes cartes',
    loading: 'Chargement de vos cartes...',
    totalCards: 'Cartes totales',
    cardsWithPrice: 'Avec prix',
    totalValue: 'Valeur totale',
    estimatedValue: 'Valeur estimée',
    noCards: 'Aucune carte dans votre collection',
    startScanning: 'Commencer à scanner',
    searchPlaceholder: 'Rechercher une carte...',
    card: 'carte',
    cards: 'cartes',
    noSearchResults: 'Aucune carte trouvée',
    clearSearch: 'Effacer la recherche',
  },
  conditions: {
    nearmint: 'Comme neuf',
    excellent: 'Excellent',
    good: 'Bon',
    played: 'Usagé'
  },
  sell: {
    sell: 'Vendre',
    sellCard: 'Vendre la carte',
    condition: 'État',
    price: 'Prix',
    enterPrice: 'Entrez le prix',
    invalidPrice: 'Prix invalide',
    confirm: 'Confirmer',
    success: 'Succès',
    cardSold: 'Carte vendue avec succès',
    error: 'Erreur lors de la vente'
  },
  priceAlert: {
    alert: 'Alerte',
    success: 'Succès',
    created: 'Alerte de prix créée',
    error: 'Erreur lors de la création de l\'alerte'
  },
  cards: {
    loadError: 'Erreur lors du chargement des cartes'
  },
  premium: {
    title: 'Premium',
    whyPay: 'Pourquoi payer ?',
    explanation1: 'TCMarket fait appel à des services externes pour traiter vos images de cartes et récupérer les prix du marché en temps réel.',
    explanation2: 'Ces services ont un coût, et votre abonnement nous permet de couvrir ces frais tout en continuant à améliorer l\'application.',
    explanation3: 'En devenant membre Premium, vous soutenez le développement de TCMarket et bénéficiez d\'une expérience optimale !',
    subscribeButton: 'Je m\'abonne pour seulement 3.- par mois',
    alreadySubscribed: {
      title: 'Déjà abonné',
      message: 'Vous êtes déjà abonné à TCMarket Premium !'
    },
    loadingProducts: 'Chargement des abonnements...',
    noProducts: 'Aucun abonnement disponible',
    selectProduct: 'Sélectionner un abonnement',
    choosePlan: 'Choisissez votre plan',
    subscribeNow: 'S\'abonner maintenant',
    restorePurchases: 'Restaurer mes achats',
    monthly: 'Mensuel',
    yearly: 'Annuel',
    subscribe: 'S\'abonner',
    restore: 'Restaurer les achats',
    processing: 'Traitement en cours...',
    restrictions: {
      collection: 'Vous ne voyez que {{maxCount}} cartes. Abonnez-vous pour voir toute votre collection.',
      scan: 'Limite de {{maxCount}} cartes atteinte. Abonnez-vous pour scanner plus de cartes.',
      market: 'Accès au marché réservé aux membres Premium.',
      trading: 'Accès au trading réservé aux membres Premium.'
    },
    upgrade: 'Passer Premium'
  },
}; 