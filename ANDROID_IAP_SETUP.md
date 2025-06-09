# Configuration des achats in-app Android pour TCMarket

## 🔧 Variables d'environnement Supabase

Dans **Supabase Project Settings > Environment Variables**, ajoutez :

```bash
# Mode développement (mettre 'production' en production)
ENVIRONMENT=development

# Package name de l'app Android
GOOGLE_PLAY_PACKAGE_NAME=com.tcmarket.app

# Credentials du service account Google Play (JSON complet)
GOOGLE_PLAY_CREDENTIALS={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"}
```

## 📱 Configuration Google Play Console

### 1. Créer les produits d'abonnement

Dans Google Play Console > Votre app > Monétisation > Produits > Abonnements :

1. **Produit mensuel** :
   - ID produit : `tcmarket_premium_monthly`
   - Nom : `TCMarket Premium Mensuel`
   - Prix : `4,99 €`
   - Période de facturation : 1 mois

2. **Produit annuel** :
   - ID produit : `tcmarket_premium_yearly`
   - Nom : `TCMarket Premium Annuel`
   - Prix : `49,99 €`
   - Période de facturation : 1 an

### 2. Créer un service account

1. Dans Google Cloud Console > IAM & Admin > Service Accounts
2. Créer un nouveau service account
3. Télécharger le fichier JSON des credentials
4. Dans Google Play Console > Setup > API access :
   - Lier le service account
   - Donner les permissions "View financial data" et "Manage orders and subscriptions"

## 🧪 Tests

### Mode développement
- L'app simule automatiquement les achats en mode `__DEV__`
- Les Edge Functions fonctionnent en mode développement
- Vérifiez les logs dans la console React Native

### Comptes de test
1. Dans Google Play Console > Setup > License testing
2. Ajouter des comptes Gmail de test
3. Publier l'app en "Internal testing"
4. Tester avec les comptes configurés

## 🔍 Debugging

### Logs à vérifier
```javascript
[SubscriptionService] Initialisation des IAP...
[SubscriptionService] Connexion aux services IAP réussie
[SubscriptionService] Récupération des produits: ["tcmarket_premium_monthly", "tcmarket_premium_yearly"]
[SubscriptionService] Produits récupérés: [{id: "tcmarket_premium_monthly", price: "4,99 €"}]
```

### Erreurs courantes
- **Aucun produit trouvé** : Vérifiez que les produits sont créés et activés dans Google Play Console
- **Erreur de validation** : Vérifiez les variables d'environnement Supabase
- **Erreur de connexion** : Vérifiez que le service account a les bonnes permissions

## 📋 Checklist

- [ ] Variables d'environnement ajoutées dans Supabase
- [ ] Produits créés dans Google Play Console
- [ ] Service account configuré avec les bonnes permissions
- [ ] App publiée en internal testing
- [ ] Comptes de test configurés
- [ ] Permissions Android ajoutées (`com.android.vending.BILLING`)
- [ ] Plugin `expo-iap` ajouté dans app.config.js 