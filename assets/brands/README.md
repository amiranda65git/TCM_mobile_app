# Logos de marque

Ce dossier contient les logos des différentes marques supportées par l'application.

## Structure des fichiers

Les logos doivent être nommés selon le format : `[nom_marque]_logo.png`

Exemples :
- `pokemon_logo.png` - Logo Pokemon
- `yugioh_logo.png` - Logo Yu-Gi-Oh!
- `magic_logo.png` - Logo Magic: The Gathering

## Configuration

La marque active est définie dans le fichier `.env` avec la variable :
```
EXPO_PUBLIC_BRAND_LOGO=pokemon
```

## Spécifications des images

- Format : PNG recommandé (avec transparence)
- Taille recommandée : 200x200px minimum
- Ratio : carré ou rectangulaire horizontal
- Fond : transparent de préférence

## Note importante

Pour que l'image pokemon_logo.png soit affichée, ajoutez votre logo Pokemon dans ce dossier avec le nom exact `pokemon_logo.png`. 