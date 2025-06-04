# Instructions pour le logo Pokemon

## Problème actuel
Le fichier `pokemon_logo.png` actuel est un placeholder de 1x1 pixel transparent qui s'affiche comme un carré bleu dans l'application.

## Solution

### Option 1: Ajouter une vraie image Pokemon
1. **Supprimez** le fichier actuel `pokemon_logo.png`
2. **Ajoutez** votre vraie image de logo Pokemon avec le nom exact `pokemon_logo.png`
3. **Spécifications recommandées** :
   - Format : PNG avec transparence
   - Taille : 200x200px ou plus
   - Fond transparent de préférence
   - Couleurs : rouge, bleu, jaune (couleurs Pokemon typiques)

### Option 2: Activer le logo temporairement
Dans le fichier `app/(auth)/login.tsx`, ligne ~35, décommentez cette ligne :
```javascript
// return require('../../assets/brands/pokemon_logo.png');
```

### Option 3: Désactiver complètement le logo
Le logo est actuellement désactivé dans le code pour éviter le carré bleu. 
Aucune action requise si vous voulez garder uniquement le texte "TCMarket".

## Test
Après avoir ajouté une vraie image, relancez l'application avec :
```bash
npx expo start --clear
``` 