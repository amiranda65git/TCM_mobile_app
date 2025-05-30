import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Dimensions, FlatList, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import Constants from 'expo-constants';
import OpenAI from 'openai';
import SupabaseService from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';

type ScanResult = {
  pokemonName: string | null;
  healthPoints: string | null;
  cardNumber: string | null;
  imageUri: string | null;
};

type OfficialCard = {
  id: string;
  name: string;
  hp: string;
  number: string;
  image_small: string;
  image_large: string;
  edition: {
    name: string;
    symbol: string;
  };
  rarity: string;
  types: string[];
  supertype: string;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_RATIO = 1.4;
const CARD_WIDTH = SCREEN_WIDTH * 0.8;
const CARD_HEIGHT = CARD_WIDTH * CARD_RATIO;

// Fonction pour normaliser les noms de Pokémon pour améliorer la correspondance
const normalizePokemonName = (name: string): string[] => {
  if (!name) return [];
  
  const normalizedName = name.trim();
  const variants: string[] = [normalizedName];
  
  // Variations courantes des suffixes spéciaux
  const suffixPatterns = [
    // Variations de ex/EX
    { pattern: /\s+ex$/i, variants: [' ex', '-EX', ' EX'] },
    { pattern: /\s+EX$/i, variants: [' ex', '-EX', ' EX'] },
    { pattern: /\s+Ex$/i, variants: [' ex', '-EX', ' EX'] },
    
    // Variations de GX
    { pattern: /\s+gx$/i, variants: ['-GX', ' GX', ' gx'] },
    { pattern: /\s+GX$/i, variants: ['-GX', ' GX', ' gx'] },
    { pattern: /\s+Gx$/i, variants: ['-GX', ' GX', ' gx'] },
    
    // Variations de V/VMAX/VSTAR
    { pattern: /\s+v$/i, variants: [' V', '-V', ' v'] },
    { pattern: /\s+V$/i, variants: [' V', '-V', ' v'] },
    { pattern: /\s+vmax$/i, variants: [' VMAX', ' VMax', ' vmax'] },
    { pattern: /\s+VMAX$/i, variants: [' VMAX', ' VMax', ' vmax'] },
    { pattern: /\s+vstar$/i, variants: [' VSTAR', ' VStar', ' vstar'] },
    { pattern: /\s+VSTAR$/i, variants: [' VSTAR', ' VStar', ' vstar'] },
  ];
  
  // Extraire le nom de base (sans suffixe)
  const baseName = normalizedName.replace(/\s+(ex|EX|Ex|gx|GX|Gx|v|V|vmax|VMAX|VMax|vstar|VSTAR|VStar)$/i, '');
  
  // Si on a détecté un suffixe, créer toutes les variantes possibles
  if (baseName !== normalizedName) {
    // Ajouter les variations les plus courantes
    variants.push(`${baseName} ex`);
    variants.push(`${baseName}-EX`);
    variants.push(`${baseName} EX`);
    variants.push(`${baseName}-GX`);
    variants.push(`${baseName} GX`);
    variants.push(`${baseName} V`);
    variants.push(`${baseName} VMAX`);
    variants.push(`${baseName} VSTAR`);
    
    // Ajouter le nom de base seul aussi
    variants.push(baseName);
  }
  
  // Retirer les doublons et retourner
  return [...new Set(variants)];
};

// Ajout dans la fonction d'appel à l'API OpenAI images-vision
async function analyzeCardWithOpenAI(imagePath: string): Promise<ScanResult | null> {
  try {
    console.log('🔍 analyzeCardWithOpenAI - Début avec image:', imagePath);
    
    // Lire l'image en base64
    let response;
    try {
      console.log('🔍 Tentative de fetch de l\'image locale...');
      // Ajouter le préfixe file:// pour les chemins Android et iOS
      const imageUri = imagePath.startsWith('file://') 
        ? imagePath 
        : `file://${imagePath}`;
      console.log('🔍 URI de l\'image formaté:', imageUri);
      response = await fetch(imageUri);
      console.log('🔍 fetch image réussi, taille réponse:', response.headers.get('content-length'));
    } catch (fetchError) {
      console.error('🔴 Erreur lors du fetch de l\'image:', fetchError);
      console.error('🔴 Détails erreur fetch:', JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError)));
      throw new Error('Échec du chargement de l\'image');
    }
    
    try {
      const blob = await response.blob();
      console.log('🔍 conversion blob réussie, taille:', blob.size);
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = (fileError) => {
          console.error('🔴 Erreur FileReader:', fileError);
          reject(fileError);
        }
      });
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;
      console.log('🔍 conversion base64 réussie, longueur:', base64.length, 'début:', base64.substring(0, 50) + '...');

      // Initialiser le client OpenAI avec la clé API
      const apiKey = Constants.expoConfig?.extra?.API_OPENAI || '';
      const openaiModel = Constants.expoConfig?.extra?.OPENAI_MODEL || 'gpt-4.1-nano';
      console.log('🔍 Clé API présente:', !!apiKey, 'longueur:', apiKey.length, 'modèle:', openaiModel);
      
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Nécessaire pour React Native
      });
      console.log('🔍 Client OpenAI initialisé');

      console.log('🔍 Préparation requête à l\'API...');
      // Paramètres à envoyer (pour le debug)
      const requestParams = {
        model: openaiModel,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "..." }, // Texte abrégé pour le log
              { type: "input_image", image_url: base64.substring(0, 30) + "..." } // URL abrégée pour le log
            ]
          }
        ]
      };
      console.log('🔍 Paramètres:', JSON.stringify(requestParams, null, 2));

      // Appel à l'API en utilisant le SDK officiel
      console.log('🔍 Envoi de la requête à OpenAI...');
      const completion = await openai.responses.create({
        model: openaiModel,
        input: [
          {
            role: "user",
            content: [
              { 
                type: "input_text", 
                text: "Voici une photo d'une carte Pokémon. Peux-tu extraire le nom du Pokémon, ses points de vie (PV ou HP) et le numéro de la carte (format X/Y) ? Réponds uniquement sous la forme d'un objet JSON avec les clés: pokemonName, healthPoints, cardNumber."
              },
              { 
                type: "input_image",
                // L'URL doit être une chaîne pour l'API
                image_url: base64
              }
            ]
          }
        ] as any
      });
      console.log('🔍 Réponse OpenAI reçue:', completion ? 'Oui' : 'Non');

      // Extraction du JSON depuis la réponse
      const text = completion.output_text || '';
      console.log('🔍 Texte de sortie:', text.substring(0, 100));
      
      const match = text.match(/\{[\s\S]*\}/);
      console.log('🔍 Match JSON trouvé:', !!match);
      
      if (!match) return null;
      const json = JSON.parse(match[0]);
      console.log('🔍 JSON parsé:', json);
      
      return {
        pokemonName: json.pokemonName || null,
        healthPoints: json.healthPoints || null,
        cardNumber: json.cardNumber || null,
        imageUri: imagePath,
      };
    } catch (processingError) {
      console.error('🔴 Erreur traitement image/API:', processingError);
      console.error('🔴 Détails erreur processing:', JSON.stringify(processingError, Object.getOwnPropertyNames(processingError)));
      throw processingError;
    }
  } catch (e) {
    console.error('🔴 Erreur OpenAI Vision:', e);
    console.error('🔴 Détails erreur:', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    return null;
  }
}

export default function ScanScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const [refreshKey, setRefreshKey] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [rectangleDetected, setRectangleDetected] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult>({
    pokemonName: null,
    healthPoints: null,
    cardNumber: null,
    imageUri: null
  });
  const [matchingCards, setMatchingCards] = useState<OfficialCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<OfficialCard | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAddingToCollection, setIsAddingToCollection] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  
  // Pour la simulation périodique de la détection
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // État pour l'alerte de succès
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // États pour la recherche avec autocomplétion
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Récupérer la caméra arrière
  const device = useCameraDevice('back');

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans ScanScreen:', language);
        // Forcer un rafraîchissement du composant
        setRefreshKey(prev => prev + 1);
      }
    });
    
    setLanguageListener(listener);
    
    return () => {
      // Supprimer l'écouteur lors du démontage du composant
      if (languageListener) {
        EventRegister.removeEventListener(languageListener);
      }
    };
  }, []);

  // Écouter les changements de thème
  useEffect(() => {
    const themeListener = EventRegister.addEventListener('themeChanged', () => {
      console.log('Changement de thème détecté dans ScanScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener as string);
      }
    };
  }, []);

  // Vérifier les changements de langue au focus
  useEffect(() => {
    async function checkLanguageChange() {
      const languageChanged = await AsyncStorage.getItem('@language_changed');
      if (languageChanged === 'true') {
        // Réinitialiser le flag
        await AsyncStorage.removeItem('@language_changed');
        console.log('Language has been changed, refreshing scan screen...');
        // Force un rafraîchissement en incrémentant la clé
        setRefreshKey(prev => prev + 1);
      }
    }
    
    checkLanguageChange();
  }, [refreshKey]);

  // Demander la permission caméra au montage
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Démarre une simulation périodique pour la détection de cartes
  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    // Ne démarre la simulation que si on n'est pas en erreur et qu'aucun scan n'est en cours
    if (!scanError && !photoUri) {
      intervalRef.current = setInterval(() => {
        if (!isProcessing) {
          setRectangleDetected(true);
          setTimeout(() => {
            if (!isProcessing) {
              triggerAutoCapture();
            }
          }, 1000);
        }
      }, 3000);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isProcessing, scanError, photoUri]);

  // Capture automatique quand rectangle détecté
  const triggerAutoCapture = useCallback(async () => {
    if (isProcessing || !camera.current) return;
    setIsProcessing(true);
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      setPhotoUri(photo.path);
      await processImage(photo.path);
    } catch (err) {
      Alert.alert(t('scan.error'), t('scan.captureError'));
      setIsProcessing(false);
    }
  }, [isProcessing, t]);

  // Fonction pour réinitialiser complètement l'état du scan
  const resetScanState = () => {
    setPhotoUri(null);
    setScanResult({
      pokemonName: null,
      healthPoints: null,
      cardNumber: null,
      imageUri: null
    });
    setIsProcessing(false);
    setScanError(null);
    setRectangleDetected(false);
  };

  // Capture manuelle
  const handleStartScan = async () => {
    // Si on a une erreur ou une photo, on réinitialise pour un nouveau scan
    if (scanError || photoUri) {
      resetScanState();
      return;
    }
    
    if (isProcessing || !camera.current) return;
    
    setIsProcessing(true);
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      setPhotoUri(photo.path);
      await processImage(photo.path);
    } catch (err) {
      Alert.alert(t('scan.error'), t('scan.captureError'));
      setScanError(t('scan.captureError'));
      setIsProcessing(false);
    }
  };

  // Fonction pour rechercher les cartes correspondantes
  const searchMatchingCards = async (scanResult: ScanResult) => {
    setIsLoadingCards(true);
    try {
      console.log('Recherche de cartes correspondantes avec:', scanResult);
      
      let allCards: OfficialCard[] = [];
      
      // Si on a un nom de Pokémon, essayer différentes variantes
      if (scanResult.pokemonName) {
        const nameVariants = normalizePokemonName(scanResult.pokemonName);
        console.log(`Tentative de recherche avec ${nameVariants.length} variantes:`, nameVariants);
        
        // Essayer chaque variante jusqu'à trouver des résultats
        for (const nameVariant of nameVariants) {
          console.log(`Recherche avec la variante: "${nameVariant}"`);
          
          const { data, error } = await SupabaseService.searchOfficialCardsByDetails({
            pokemonName: nameVariant,
            healthPoints: scanResult.healthPoints,
            cardNumber: scanResult.cardNumber
          });
          
          if (!error && data && data.length > 0) {
            console.log(`Trouvé ${data.length} cartes avec la variante "${nameVariant}"`);
            
            // Ajouter les nouvelles cartes en évitant les doublons
            const newCards = data.filter(newCard => 
              !allCards.some(existingCard => existingCard.id === newCard.id)
            );
            allCards.push(...newCards);
            
            // Si on a trouvé suffisamment de cartes avec une variante exacte, on peut s'arrêter
            if (data.length >= 3) {
              break;
            }
          }
        }
        
        // Si aucune variante n'a donné de résultat, essayer une recherche plus large (nom de base seulement)
        if (allCards.length === 0) {
          const baseName = scanResult.pokemonName.replace(/\s+(ex|EX|Ex|gx|GX|Gx|v|V|vmax|VMAX|VMax|vstar|VSTAR|VStar)$/i, '');
          
          if (baseName !== scanResult.pokemonName) {
            console.log(`Recherche de secours avec le nom de base: "${baseName}"`);
            
            const { data, error } = await SupabaseService.searchOfficialCardsByDetails({
              pokemonName: baseName,
              healthPoints: scanResult.healthPoints,
              cardNumber: scanResult.cardNumber
            });
            
            if (!error && data) {
              allCards = data;
            }
          }
        }
      } else {
        // Pas de nom, recherche classique
        const { data, error } = await SupabaseService.searchOfficialCardsByDetails({
          pokemonName: scanResult.pokemonName,
          healthPoints: scanResult.healthPoints,
          cardNumber: scanResult.cardNumber
        });
        
        if (!error && data) {
          allCards = data;
        }
      }
      
      console.log(`Total de ${allCards.length} cartes trouvées après toutes les recherches`);
      
      // Trier les résultats par pertinence si on a un nom original
      if (scanResult.pokemonName && allCards.length > 1) {
        const originalName = scanResult.pokemonName.toLowerCase();
        allCards.sort((a, b) => {
          const aExact = a.name.toLowerCase() === originalName;
          const bExact = b.name.toLowerCase() === originalName;
          
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          // Prioriser les cartes qui contiennent le nom original
          const aContains = a.name.toLowerCase().includes(originalName.replace(/\s+(ex|EX|gx|GX|v|V|vmax|VMAX|vstar|VSTAR)$/i, ''));
          const bContains = b.name.toLowerCase().includes(originalName.replace(/\s+(ex|EX|gx|GX|v|V|vmax|VMAX|vstar|VSTAR)$/i, ''));
          
          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;
          
          return a.name.localeCompare(b.name);
        });
      }
      
      setMatchingCards(allCards);
    } catch (error) {
      console.error('Erreur lors de la recherche de cartes:', error);
      setMatchingCards([]);
    } finally {
      setIsLoadingCards(false);
    }
  };

  // Analyse OCR de l'image capturée
  const processImage = async (imagePath: string) => {
    try {
      // 1. Essayer avec OpenAI Vision
      const aiResult = await analyzeCardWithOpenAI(imagePath);
      if (aiResult && (aiResult.pokemonName || aiResult.cardNumber)) {
        console.log('🔍 Nom détecté par OpenAI:', aiResult.pokemonName);
        if (aiResult.pokemonName) {
          const variants = normalizePokemonName(aiResult.pokemonName);
          console.log('🔍 Variantes générées pour OpenAI:', variants);
        }
        
        setScanResult(aiResult);
        // Rechercher les cartes correspondantes
        await searchMatchingCards(aiResult);
        return;
      }
      // 2. Fallback local (OCR ML Kit)
      const result = await TextRecognition.recognize(imagePath);
      if (result && result.text) {
        // Extraction des infos via regex
        const pokemonNameRegex = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*(?:PV|HP)\s*(\d+)/i;
        const cardNumberRegex = /(\d+)\/(\d+)/;
        const nameMatch = result.text.match(pokemonNameRegex);
        const numberMatch = result.text.match(cardNumberRegex);
        if (nameMatch) {
          const extractedResult = {
            pokemonName: nameMatch[1],
            healthPoints: nameMatch[2],
            cardNumber: numberMatch ? numberMatch[0] : null,
            imageUri: imagePath,
          };
          
          // Test de la normalisation
          console.log('🔍 Nom détecté par OCR:', nameMatch[1]);
          const variants = normalizePokemonName(nameMatch[1]);
          console.log('🔍 Variantes générées:', variants);
          
          setScanResult(extractedResult);
          // Rechercher les cartes correspondantes
          await searchMatchingCards(extractedResult);
        } else {
          // Pour la démo, on utilise des données fictives si rien n'est détecté
          const pokemons = [
            { name: "Pikachu", hp: "70", number: "25/102" },
            { name: "Dracaufeu", hp: "120", number: "4/102" },
            { name: "Bulbizarre", hp: "60", number: "1/102" },
            { name: "Salamèche", hp: "50", number: "3/102" },
            { name: "Mew", hp: "50", number: "8/102" },
            { name: "Mewtwo", hp: "150", number: "10/102" }
          ];
          const selectedPokemon = pokemons[Math.floor(Math.random() * pokemons.length)];
          const demoResult = {
            pokemonName: selectedPokemon.name,
            healthPoints: selectedPokemon.hp,
            cardNumber: selectedPokemon.number,
            imageUri: imagePath,
          };
          setScanResult(demoResult);
          // Rechercher les cartes correspondantes
          await searchMatchingCards(demoResult);
        }
      } else {
        Alert.alert(t('scan.noTextDetected'), t('scan.tryBetterLighting'));
      }
    } catch (e) {
      Alert.alert(t('scan.error'), t('scan.imageAnalysisError'));
      setScanError(t('scan.imageAnalysisError'));
    } finally {
      setIsProcessing(false);
      setRectangleDetected(false);
    }
  };

  // Sélectionner une carte et ouvrir le modal
  const handleCardPress = (card: OfficialCard) => {
    setSelectedCard(card);
    setModalVisible(true);
  };

  // Fonction pour fermer le modal
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedCondition(null);
  };

  // Vérifier la session utilisateur
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await SupabaseService.supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('Erreur lors de la récupération de la session:', error);
      }
    };
    
    checkSession();
    
    // Écouter les changements de session
    const { data: authListener } = SupabaseService.supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );
    
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Ajouter la carte à la collection et rediriger vers card-marketplace
  const handleAddToCollection = async (condition: string) => {
    if (!selectedCard || !session?.user?.id) {
      Alert.alert(
        t('general.error'),
        t('login.required'),
        [
          { text: t('general.ok'), style: 'cancel' }
        ]
      );
      return;
    }
    
    setIsAddingToCollection(true);
    
    try {
      // Convertir l'image en base64 si elle existe
      let base64Image = null;
      if (photoUri) {
        try {
          // Ajouter le préfixe file:// si nécessaire
          const fileUri = photoUri.startsWith('file://') ? photoUri : `file://${photoUri}`;
          // Lire le contenu du fichier en base64
          base64Image = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64
          });
          console.log('Image convertie en base64 avec succès, longueur:', base64Image.length);
        } catch (fileError) {
          console.error('Erreur lors de la conversion de l\'image en base64:', fileError);
          // Continuer sans l'image
        }
      }
      
      // Ajouter la carte à la collection de l'utilisateur
      const { data, error } = await SupabaseService.addCardToCollection({
        userId: session.user.id,
        cardId: selectedCard.id,
        condition: condition,
        imageBase64: base64Image
      });
      
      if (error) {
        console.error('Erreur lors de l\'ajout à la collection:', error);
        Alert.alert(
          t('general.error'),
          t('scan.addToCollectionError'),
          [
            { text: t('general.ok'), style: 'cancel' }
          ]
        );
        setIsAddingToCollection(false);
        return;
      }
      
      // Fermer le modal
      setModalVisible(false);
      
      // Afficher l'alerte de succès
      setSuccessMessage(t('scan.addedToCollection'));
      setShowSuccessAlert(true);
      
      // Faire disparaître l'alerte après 3 secondes
      setTimeout(() => {
        setShowSuccessAlert(false);
      }, 3000);
      
      // Rediriger automatiquement vers la page card-marketplace
      setTimeout(() => {
        router.push(`/screens/market-prices/card-marketplace?id=${selectedCard.id}`);
      }, 1000);
      
    } catch (error) {
      console.error('Erreur inattendue lors de l\'ajout à la collection:', error);
      Alert.alert(t('general.error'), t('scan.unexpectedError'));
    } finally {
      setIsAddingToCollection(false);
    }
  };

  // Rendu d'une carte dans la liste
  const renderCardItem = ({ item }: { item: OfficialCard }) => (
    <TouchableOpacity 
      style={[styles.cardItem, { backgroundColor: colors.surface }]}
      onPress={() => handleCardPress(item)}
    >
      <Image 
        source={{ uri: item.image_small }} 
        style={styles.cardThumbnail}
        resizeMode="contain"
      />
      <View style={styles.cardDetails}>
        <Text style={[styles.cardName, { color: colors.text.primary }]}>{item.name}</Text>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardInfoText, { color: colors.text.secondary }]}>
            {item.edition.name}
          </Text>
          {item.hp && (
            <Text style={[styles.cardInfoText, { color: colors.text.secondary }]}>
              HP: {item.hp}
            </Text>
          )}
          {item.number && (
            <Text style={[styles.cardInfoText, { color: colors.text.secondary }]}>
              #{item.number}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Logique de recherche avec autocomplétion
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const { data, error } = await SupabaseService.searchCards(searchQuery);
        if (!error && data) {
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
        setIsSearching(false);
        setShowSuggestions(true);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Fonction pour sélectionner une carte depuis la recherche
  const handleCardSelectFromSearch = async (card: any) => {
    setShowSuggestions(false);
    setSearchQuery('');
    
    // Créer un objet carte compatible avec le modal de sélection
    const selectedCardData: OfficialCard = {
      id: card.card_id,
      name: card.card_name,
      hp: '', // Pas d'HP dans les résultats de recherche
      number: card.number || '',
      image_small: card.image_small,
      image_large: card.image_small, // Utiliser la même image
      edition: {
        name: card.edition_name || '',
        symbol: ''
      },
      rarity: card.rarity || '',
      types: [],
      supertype: ''
    };
    
    // Définir la carte sélectionnée et ouvrir le modal
    setSelectedCard(selectedCardData);
    setModalVisible(true);
  };

  if (!device || !hasPermission) {
    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.text, { color: colors.text.primary }]}>{t('scan.loadingCamera')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('scan.scanCard')}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Alerte de succès */}
      {showSuccessAlert && (
        <View style={[styles.successAlert, { backgroundColor: colors.success || '#4CAF50' }]}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.successAlertText}>{successMessage}</Text>
        </View>
      )}

      <View style={styles.cameraContainer}>
        {photoUri ? (
          <View style={styles.photoContainer}>
            {/* Background - Première carte correspondante ou placeholder */}
            {matchingCards.length > 0 ? (
              <Image
                source={{ uri: matchingCards[0].image_large || matchingCards[0].image_small }}
                style={styles.backgroundCardImage}
                resizeMode="cover"
              />
            ) : (
              // Fond neutre quand pas de résultats (pas de message ici)
              <View style={[styles.noResultsBackground, { backgroundColor: colors.background }]} />
            )}
            
            {/* Overlay semi-transparent pour la lisibilité */}
            <View style={styles.backgroundOverlay} />
            
            {/* Overlay de traitement */}
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.processingText}>{t('scan.analyzingCard')}</Text>
              </View>
            )}
            
            {/* Overlay d'erreur */}
            {scanError && (
              <View style={styles.errorOverlay}>
                <Ionicons name="alert-circle" size={50} color="#FFFFFF" />
                <Text style={styles.errorText}>{scanError}</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={resetScanState}
                >
                  <Text style={styles.retryButtonText}>{t('scan.scanAgain')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Contenu principal - remontée aux 2/3 */}
            {!isProcessing && !scanError && (
              <>
                {matchingCards.length > 0 ? (
                  // Cartes correspondantes trouvées
                  <View style={styles.resultsContainer}>
                    <View style={styles.matchingCardsSection}>
                      <View style={[styles.matchingCardsHeader, { backgroundColor: colors.surface + 'F0' }]}>
                        <Text style={[styles.matchingCardsTitle, { color: colors.text.primary }]}>{t('scan.matchingCards')}</Text>
                        {isLoadingCards && <ActivityIndicator size="small" color={colors.primary} />}
                      </View>
                      
                      <FlatList
                        data={matchingCards}
                        renderItem={renderCardItem}
                        keyExtractor={(item) => item.id}
                        style={styles.cardsList}
                        contentContainerStyle={styles.cardsListContent}
                        showsVerticalScrollIndicator={false}
                      />
                    </View>
                  </View>
                ) : (
                  // Aucune correspondance - Recherche manuelle pleine page
                  <View style={[styles.fullPageSearchSection, { backgroundColor: colors.surface }]}>
                    <View style={[styles.searchSectionHeader, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.searchSectionTitle, { color: colors.text.primary }]}>
                        Pas de résultat, recherche manuelle :
                      </Text>
                    </View>
                    
                    <View style={styles.searchSectionContent}>
                      {/* Champ de recherche */}
                      <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
                        <Ionicons name="search-outline" size={20} color={colors.text.secondary} style={{ marginRight: 8 }} />
                        <TextInput
                          ref={searchInputRef}
                          style={[styles.searchInput, { color: colors.text.primary }]}
                          placeholder={t('scan.searchPlaceholder') || "Rechercher une carte..."}
                          placeholderTextColor={colors.text.secondary}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          returnKeyType="search"
                          clearButtonMode="while-editing"
                          autoCapitalize="none"
                          autoCorrect={false}
                          onFocus={() => setSearchFocused(true)}
                          onBlur={() => setSearchFocused(false)}
                        />
                      </View>
                      
                      {/* Suggestions de recherche */}
                      {showSuggestions && (
                        <View style={[styles.suggestionsContainer, { backgroundColor: colors.background }]}>
                          {searchResults.length > 0 ? (
                            <FlatList
                              data={searchResults}
                              keyExtractor={item => item.card_id}
                              renderItem={({ item }) => (
                                <TouchableOpacity
                                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                                  onPress={() => handleCardSelectFromSearch(item)}
                                >
                                  <View style={styles.suggestionContent}>
                                    {item.image_small ? (
                                      <Image source={{ uri: item.image_small }} style={styles.suggestionImage} resizeMode="contain" />
                                    ) : (
                                      <View style={[styles.suggestionImagePlaceholder, { backgroundColor: colors.surface }]} />
                                    )}
                                    <View style={styles.suggestionTextContainer}>
                                      <Text style={[styles.suggestionTitle, { color: colors.text.primary }]}>{item.card_name}</Text>
                                      {item.edition_name && (
                                        <Text style={[styles.suggestionSubtitle, { color: colors.text.secondary }]}>{item.edition_name}</Text>
                                      )}
                                    </View>
                                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                                  </View>
                                </TouchableOpacity>
                              )}
                              style={styles.suggestionsList}
                              keyboardShouldPersistTaps="handled"
                              showsVerticalScrollIndicator={false}
                            />
                          ) : searchQuery.trim().length >= 2 ? (
                            <View style={styles.noResultsContainer}>
                              <Text style={[styles.noResultsText, { color: colors.text.secondary }]}>
                                {isSearching ? (t('scan.searching') || 'Recherche en cours...') : (t('scan.noResults') || 'Aucun résultat trouvé')}
                              </Text>
                              {isSearching && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />}
                            </View>
                          ) : null}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <Camera
              ref={camera}
              style={styles.camera}
              device={device}
              isActive={!photoUri}
              photo={true}
              enableZoomGesture
            />
            
            {/* Guide de placement de carte */}
            <View style={styles.cardGuideOverlay}>
              <View style={[styles.cardGuide, rectangleDetected && styles.cardGuideActive]} />
            </View>
          </View>
        )}
      </View>

      {/* Bouton de scan/retour */}
      {!photoUri && !scanError && (
        <TouchableOpacity 
          style={[styles.scanButton, { backgroundColor: colors.primary }]} 
          onPress={handleStartScan}
          disabled={isProcessing}
        >
          <Ionicons name="scan" size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>{t('scan.scan')}</Text>
        </TouchableOpacity>
      )}
      
      {/* Bouton pour réessayer en cas d'erreur */}
      {(photoUri && scanError) && (
        <TouchableOpacity 
          style={[styles.scanButton, { backgroundColor: colors.error || '#e53935' }]} 
          onPress={resetScanState}
        >
          <Ionicons name="refresh" size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>{t('scan.scanAgain')}</Text>
        </TouchableOpacity>
      )}

      {/* Bouton pour scanner à nouveau - positionné plus bas */}
      {(photoUri && !scanError && !isLoadingCards) && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity 
            style={[styles.scanButton, { backgroundColor: colors.secondary }]} 
            onPress={resetScanState}
          >
            <Ionicons name="camera" size={24} color="#FFFFFF" />
            <Text style={styles.scanButtonText}>{t('scan.scanAgain')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal pour voir l'image en grand */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {/* Header de la modale */}
            <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalHeaderTitle, { color: colors.text.primary }]}>
                {t('scan.cardDetails')}
              </Text>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.background }]} onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            {selectedCard && (
              <ScrollView 
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Image de la carte */}
                <View style={[styles.modalImageContainer, { backgroundColor: colors.surface }]}>
                  <Image 
                    source={{ uri: selectedCard.image_large || selectedCard.image_small }} 
                    style={styles.modalCardImage}
                    resizeMode="contain"
                  />
                </View>
                
                {/* Détails de la carte */}
                <View style={[styles.modalCardDetails, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.modalCardName, { color: colors.text.primary }]}>
                    {selectedCard.name}
                  </Text>
                  
                  {/* Divider */}
                  <View style={[styles.modalDivider, { backgroundColor: colors.text.secondary + '20' }]} />
                  
                  <View style={styles.modalCardInfo}>
                    {/* Informations en ligne compacte */}
                    <View style={styles.compactInfoContainer}>
                      <View style={styles.compactInfoItem}>
                        <Text style={[styles.compactInfoLabel, { color: colors.text.secondary }]}>
                          {t('scan.edition')}:
                        </Text>
                        <Text style={[styles.compactInfoValue, { color: colors.text.primary }]} numberOfLines={1}>
                          {selectedCard.edition.name}
                        </Text>
                      </View>
                      
                      <View style={styles.compactInfoItem}>
                        <Text style={[styles.compactInfoLabel, { color: colors.text.secondary }]}>
                          {t('scan.number')}:
                        </Text>
                        <Text style={[styles.compactInfoValue, { color: colors.text.primary }]}>
                          {selectedCard.number}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.compactInfoContainer}>
                      <View style={styles.compactInfoItem}>
                        <Text style={[styles.compactInfoLabel, { color: colors.text.secondary }]}>
                          {t('scan.hp')}:
                        </Text>
                        <Text style={[styles.compactInfoValue, { color: colors.text.primary }]}>
                          {selectedCard.hp}
                        </Text>
                      </View>
                      
                      <View style={styles.compactInfoItem}>
                        <Text style={[styles.compactInfoLabel, { color: colors.text.secondary }]}>
                          {t('scan.rarity')}:
                        </Text>
                        <Text style={[styles.compactInfoValue, { color: colors.text.primary }]} numberOfLines={1}>
                          {selectedCard.rarity || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Sélection de condition */}
                <View style={styles.conditionSelectionContainer}>
                  <Text style={[styles.conditionTitle, { color: colors.text.primary }]}>
                    {t('scan.selectCondition')}
                  </Text>
                  
                  <View style={styles.conditionGrid}>
                    {['excellent', 'nearmint', 'good', 'played'].map((condition) => (
                      <TouchableOpacity
                        key={condition}
                        style={[
                          styles.conditionButton,
                          { 
                            backgroundColor: selectedCondition === condition 
                              ? colors.primary 
                              : colors.surface,
                            borderColor: selectedCondition === condition 
                              ? colors.primary 
                              : colors.border
                          }
                        ]}
                        onPress={() => {
                          setSelectedCondition(condition);
                          // Ajouter automatiquement à la collection après sélection
                          handleAddToCollection(condition);
                        }}
                        disabled={isAddingToCollection}
                        activeOpacity={0.7}
                      >
                        {isAddingToCollection && selectedCondition === condition ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={[
                            styles.conditionButtonText,
                            { 
                              color: selectedCondition === condition 
                                ? '#FFFFFF' 
                                : colors.text.primary 
                            }
                          ]}>
                            {t(`card.conditions.${condition}`)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cardGuideOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardGuide: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
  },
  cardGuideActive: {
    borderColor: '#4CAF50',
    borderWidth: 3,
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
  },
  photo: {
    flex: 1,
  },
  backgroundCardImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  noResultsBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 100, // Remonté pour éviter la barre de navigation
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 10,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultContent: {
    padding: 16,
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  resultLabel: {
    width: 100,
    fontSize: 16,
  },
  resultValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(220, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#e53935',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '33%', // Remontée aux 2/3 (33% du haut)
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  matchingCardsSection: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  fullPageSearchSection: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: 0,
  },
  searchSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  searchSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchSectionContent: {
    flex: 1,
    padding: 16,
  },
  modalContentContainer: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  matchingCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  matchingCardsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardsList: {
    flex: 1,
  },
  cardsListContent: {
    padding: 12,
  },
  cardItem: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cardThumbnail: {
    width: 80,
    height: 112,
    backgroundColor: '#f0f0f0',
  },
  cardDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cardInfo: {
    gap: 4,
  },
  cardInfoText: {
    fontSize: 14,
  },
  noCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noCardsText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalScrollContent: {
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
  },
  modalImageContainer: {
    width: '100%',
    height: 240,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalCardImage: {
    width: '100%',
    height: '100%',
  },
  modalCardDetails: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalCardName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDivider: {
    width: '100%',
    height: 1,
    marginBottom: 16,
  },
  modalCardInfo: {
    width: '100%',
  },
  modalCardInfoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  modalInfoItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  modalCardInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  modalCardInfoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonContainer: {
    width: '100%',
    padding: 16,
  },
  addToCollectionButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  addToCollectionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Nouveaux styles pour les informations compactes
  compactInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compactInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  compactInfoLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  compactInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  // Styles pour la sélection de condition
  conditionSelectionContainer: {
    width: '100%',
    padding: 16,
  },
  conditionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  conditionButton: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successAlert: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  successAlertText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  manualSearchContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  manualSearchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  suggestionsContainer: {
    maxHeight: 300,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  suggestionsList: {
    maxHeight: 280,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionImage: {
    width: 40,
    height: 56,
    borderRadius: 4,
    marginRight: 12,
  },
  suggestionImagePlaceholder: {
    width: 40,
    height: 56,
    borderRadius: 4,
    marginRight: 12,
    opacity: 0.5,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  suggestionSubtitle: {
    fontSize: 12,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 100, // Remonté pour éviter la barre de navigation
    left: 0,
    right: 0,
    zIndex: 10,
  },
}); 