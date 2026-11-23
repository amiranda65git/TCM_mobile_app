import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Dimensions, FlatList, Modal, Pressable, ScrollView, TextInput, LayoutChangeEvent, Keyboard, Platform } from 'react-native';
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
import { useSubscriptionRestrictions } from '../lib/RevenueCatService';
import { FREE_MONTHLY_SCANS, incrementMonthlyScanCount } from '../lib/scanQuota';
import { recordScanAndShouldPromptRate } from '../lib/rateAppPrompt';
import { useStableAutoCapture } from '../lib/useStableAutoCapture';
import { cropPhotoToCardGuide } from '../lib/cropToCardGuide';
import RateAppModal from '../components/RateAppModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import OpenAI from 'openai';
import SupabaseService from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';

type ScanCardKind = 'pokemon' | 'trainer' | null;

type ScanResult = {
  pokemonName: string | null;
  healthPoints: string | null;
  cardNumber: string | null;
  cardKind: ScanCardKind;
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
  
  // Ne générer que des variantes du suffixe réellement détecté (ex ne doit pas matcher GX/VMAX)
  if (baseName !== normalizedName) {
    const matched = suffixPatterns.find(({ pattern }) => pattern.test(normalizedName));
    if (matched) {
      matched.variants.forEach((suffix) => {
        variants.push(`${baseName}${suffix}`);
      });
    }
    variants.push(baseName);
  }
  
  // Retirer les doublons et retourner
  return [...new Set(variants)];
};

let openAIClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = Constants.expoConfig?.extra?.API_OPENAI || '';
  if (!apiKey) return null;
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
      timeout: 12000,
    });
  }
  return openAIClient;
}

const SCAN_VISION_PROMPT = `Tu analyses une photo de carte Pokémon (FR, EN ou DE), déjà recadrée sur la carte.
Deux types de cartes possibles :

A) CARTE POKÉMON (avec PV/HP) :
1) HAUT-GAUCHE : nom du Pokémon. Inclus le suffixe s'il est collé au nom ou juste à côté : ex, EX, GX, V, VMAX, VSTAR, Radiant, etc. Ex: "Pikachu ex", "Mewtwo-GX", "Charizard VMAX".
   Pokémon d'un dresseur : le logo ex est ENTRE le nom et « de … ». Garde cet ordre, ex : "Mélofée ex de Lilie" (pas "Mélofée de Lilie ex"). Le code de série en bas (JTG, TEF…) n'est pas le nom.
2) HAUT-DROITE : points de vie = le nombre après HP ou PV (2 ou 3 chiffres). Ignore les autres chiffres.
3) BAS DE CARTE : numéro de collection N/M (ex: "056/159", "25/102"). Ignore le code série juste avant (JTG FR, TEF FR…).

B) CARTE TRAINER / DRESSEUR / ITEM / STADE :
- Repère le mot "TRAINER" ou "Dresseur" / "DRESSEUR" en haut à gauche OU en haut à droite (souvent avec un sous-type : Supporter, Item, Stadium, Objet, Outil, Stade, Unterstützer).
- Le NOM de la carte est écrit juste SOUS cette ligne (ex: "Doctor", "Mistys Vitalität", "Ordre de N", "Potion").
- Pas de PV/HP → healthPoints = null.
- BAS DE CARTE : numéro N/M si visible.

Réponds en JSON strict, sans markdown ni texte autour :
{"cardKind":"pokemon","pokemonName":"Pikachu ex","healthPoints":"200","cardNumber":"25/102","confidence":0.85}
ou
{"cardKind":"trainer","pokemonName":"Doctor","healthPoints":null,"cardNumber":"214/198","confidence":0.85}
Règles :
- cardKind = "pokemon" ou "trainer" (trainer = Trainer/Dresseur/Item/Stadium/Objet)
- pokemonName = nom de la carte (Pokémon OU Trainer), jamais le mot TRAINER/Dresseur lui-même
- healthPoints = chiffres seulement, null pour les trainers
- cardNumber = exactement N/M comme imprimé (garde les zéros)
- null si illisible
- confidence entre 0 et 1`;

// Qualité un peu plus haute : le n° en bas de carte est petit
async function optimizeImageForAPI(imagePath: string): Promise<string> {
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    imagePath,
    [{ resize: { width: 1024 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  return `data:image/jpeg;base64,${manipulatedImage.base64}`;
}

function normalizeCardNumber(value: unknown): string | null {
  if (value == null) return null;
  const match = String(value).replace(/\s+/g, '').match(/(\d{1,3})\/(\d{2,3})/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function normalizePokemonNameField(value: unknown): string | null {
  if (value == null) return null;
  const name = String(value).replace(/\s+/g, ' ').trim();
  return name.length >= 2 ? name : null;
}

function normalizeCardKind(value: unknown, name: string | null, healthPoints: string | null): ScanCardKind {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'trainer' || raw === 'item' || raw === 'stadium' || raw === 'dresseur') {
    return 'trainer';
  }
  if (raw === 'pokemon' || raw === 'pokémon') {
    return 'pokemon';
  }
  // Heuristique : pas de PV + nom présent → souvent trainer si le modèle a oublié cardKind
  if (!healthPoints && name) return null;
  if (healthPoints) return 'pokemon';
  return null;
}

function parseScanJson(text: string, imagePath: string): ScanResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[0]);
    const healthPoints = json.healthPoints != null
      ? String(json.healthPoints).match(/\d{2,3}/)?.[0] || null
      : null;
    const pokemonName = normalizePokemonNameField(json.pokemonName);
    return {
      pokemonName,
      healthPoints,
      cardNumber: normalizeCardNumber(json.cardNumber),
      cardKind: normalizeCardKind(json.cardKind, pokemonName, healthPoints),
      imageUri: imagePath,
    };
  } catch {
    return null;
  }
}

function mergeScanResults(
  primary: ScanResult | null,
  secondary: ScanResult | null,
  imagePath: string
): ScanResult | null {
  if (!primary && !secondary) return null;
  const cardKind = primary?.cardKind || secondary?.cardKind || null;
  const merged: ScanResult = {
    pokemonName: primary?.pokemonName || secondary?.pokemonName || null,
    // Les trainers n'ont pas de PV : ne pas reprendre un faux HP de l'OCR
    healthPoints:
      cardKind === 'trainer'
        ? null
        : primary?.healthPoints || secondary?.healthPoints || null,
    // Le n° bas de carte rate souvent en vision : on complète avec l'OCR
    cardNumber: primary?.cardNumber || secondary?.cardNumber || null,
    cardKind,
    imageUri: imagePath,
  };
  if (!merged.pokemonName && !merged.cardNumber && !merged.healthPoints) return null;
  return merged;
}

async function analyzeCardWithOpenAI(imagePath: string): Promise<ScanResult | null> {
  const startTime = Date.now();
  try {
    const openai = getOpenAIClient();
    const openaiModel = Constants.expoConfig?.extra?.OPENAI_MODEL || 'gpt-4.1-mini';
    if (!openai) {
      console.error('[Scan] Clé OpenAI manquante');
      return null;
    }

    const base64Image = await optimizeImageForAPI(imagePath);
    console.log(`[Scan] OpenAI start model=${openaiModel} b64=${base64Image.length}`);

    const completion = await openai.responses.create({
      model: openaiModel,
      max_output_tokens: 200,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: SCAN_VISION_PROMPT,
            },
            {
              type: 'input_image',
              image_url: base64Image,
              detail: 'high',
            } as any,
          ],
        },
      ] as any,
    });

    const text = completion.output_text || '';
    console.log(`[Scan] OpenAI done in ${Date.now() - startTime}ms:`, text.substring(0, 180));
    return parseScanJson(text, imagePath);
  } catch (e) {
    console.error(`[Scan] OpenAI failed after ${Date.now() - startTime}ms:`, e);
    return null;
  }
}

const TRAINER_LABEL_RE = /\b(?:TRAINER|DRESSEUR|Dresseur|Trainer)\b/i;
const TRAINER_SUBTYPE_RE =
  /Supporter|Item|Stadium|Tool|Objet|Outil|Stade|Unterst(?:ü|u)tzer|Itemkarte|Stadion|Sous-?supporter/i;

function extractTrainerNameFromOcr(normalized: string): string | null {
  if (!TRAINER_LABEL_RE.test(normalized) && !/\bUnterst(?:ü|u)tzer\b/i.test(normalized)) {
    return null;
  }

  // Ex: "TRAINER Supporter Doctor …" ou "Dresseur Objet Potion …"
  const afterLabel = normalized.match(
    /\b(?:TRAINER|DRESSEUR|Dresseur|Trainer)\b(?:\s+(?:Supporter|Item|Stadium|Tool|Objet|Outil|Stade|Unterst(?:ü|u)tzer|Itemkarte|Stadion))?\s+([A-ZÀ-Ü][A-Za-zÀ-ü''\-.]+(?:\s+[A-Za-zÀ-ü''\-.]+){0,4})/i
  );
  if (afterLabel?.[1]) {
    const cleaned = afterLabel[1]
      .replace(/\s+(?:Draw|Search|Look|Choose|Discard|Shuffle|Play|Through|Cherche|Pioche|Choisis|Défausse|Defausse|Durchsuche|Dein|Tu)\b.*$/i, '')
      .trim();
    if (cleaned.length >= 2 && !TRAINER_LABEL_RE.test(cleaned) && !TRAINER_SUBTYPE_RE.test(cleaned)) {
      return cleaned;
    }
  }

  // Ex DE: "Unterstützer TRAINER Mistys Vitalität …"
  const deOrder = normalized.match(
    /\bUnterst(?:ü|u)tzer\b\s+\bTRAINER\b\s+([A-ZÀ-Ü][A-Za-zÀ-ü''\-.]+(?:\s+[A-Za-zÀ-ü''\-.]+){0,4})/i
  );
  if (deOrder?.[1]) {
    return deOrder[1].trim();
  }

  return null;
}

function extractScanFromOcrText(text: string, imagePath: string): ScanResult | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  // Numéro bas de carte : on prend le DERNIER XX/YYY (souvent en bas dans l'ordre OCR)
  const numberMatches = [...normalized.matchAll(/\b(\d{1,3})\s*\/\s*(\d{2,3})\b/g)];
  const lastNumber = numberMatches.length
    ? `${numberMatches[numberMatches.length - 1][1]}/${numberMatches[numberMatches.length - 1][2]}`
    : null;

  // « Mélofée ex de Lilie PV 190 » — le « de » casse le motif nom+PV générique (il ne gardait que « Lilie »)
  const ownedEx = normalized.match(
    /([A-ZÀ-Ü][A-Za-zÀ-ü''\-]+)\s+(ex|EX|Ex)\s+de\s+([A-ZÀ-Ü][A-Za-zÀ-ü''\-]+(?:\s+[A-ZÀ-Ü][A-Za-zÀ-ü''\-]+)?)\s*(?:PV|HP)\s*[.:]?\s*(\d{2,3})\b/
  );
  if (ownedEx) {
    return {
      pokemonName: normalizePokemonNameField(`${ownedEx[1]} ex de ${ownedEx[3]}`),
      healthPoints: ownedEx[4],
      cardNumber: normalizeCardNumber(lastNumber),
      cardKind: 'pokemon',
      imageUri: imagePath,
    };
  }

  const ownedExAtEnd = normalized.match(
    /([A-ZÀ-Ü][A-Za-zÀ-ü''\-]+)\s+de\s+([A-ZÀ-Ü][A-Za-zÀ-ü''\-]+(?:\s+[A-ZÀ-Ü][A-Za-zÀ-ü''\-]+)?)\s+(ex|EX|Ex)\s*(?:PV|HP)\s*[.:]?\s*(\d{2,3})\b/
  );
  if (ownedExAtEnd) {
    return {
      pokemonName: normalizePokemonNameField(`${ownedExAtEnd[1]} ex de ${ownedExAtEnd[2]}`),
      healthPoints: ownedExAtEnd[4],
      cardNumber: normalizeCardNumber(lastNumber),
      cardKind: 'pokemon',
      imageUri: imagePath,
    };
  }

  // Cartes Trainer / Dresseur / Item (pas de PV)
  const trainerName = extractTrainerNameFromOcr(normalized);
  if (trainerName) {
    return {
      pokemonName: normalizePokemonNameField(trainerName),
      healthPoints: null,
      cardNumber: normalizeCardNumber(lastNumber),
      cardKind: 'trainer',
      imageUri: imagePath,
    };
  }

  // Nom (+ suffixe) suivi de PV/HP — typique ligne du haut (Pokémon)
  const nameHpMatch = normalized.match(
    /([A-ZÀ-Ü][A-Za-zÀ-ü''\-]+(?:\s+[A-ZÀ-Ü][A-Za-zÀ-ü''\-]+)?)\s*(?:[-–]?\s*)?(ex|EX|gx|GX|VMAX|Vmax|VSTAR|Vstar|V)?\s*(?:PV|HP)\s*[.:]?\s*(\d{2,3})\b/
  );

  const hpOnly =
    normalized.match(/\b(?:HP|PV)\s*[.:]?\s*(\d{2,3})\b/i) ||
    normalized.match(/\b(\d{2,3})\s*(?:HP|PV)\b/i);

  let pokemonName: string | null = null;
  if (nameHpMatch) {
    const base = nameHpMatch[1].trim();
    const suffix = nameHpMatch[2]?.trim();
    pokemonName = suffix ? `${base} ${suffix}` : base;
  }

  const healthPoints = nameHpMatch?.[3] || hpOnly?.[1] || null;

  if (!pokemonName && !healthPoints && !lastNumber) return null;

  return {
    pokemonName: normalizePokemonNameField(pokemonName),
    healthPoints,
    cardNumber: normalizeCardNumber(lastNumber),
    cardKind: healthPoints ? 'pokemon' : null,
    imageUri: imagePath,
  };
}

export default function ScanScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const { canScanCard, isPremium } = useSubscriptionRestrictions();
  const insets = useSafeAreaInsets();
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult>({
    pokemonName: null,
    healthPoints: null,
    cardNumber: null,
    cardKind: null,
    imageUri: null
  });
  const [matchingCards, setMatchingCards] = useState<OfficialCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<OfficialCard | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAddingToCollection, setIsAddingToCollection] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  
  // État pour l'alerte de succès
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // États pour la recherche avec autocomplétion
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Auto-capture
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [cameraViewSize, setCameraViewSize] = useState({ width: 0, height: 0 });
  const captureInFlightRef = useRef(false);
  const isProcessingRef = useRef(false);
  const pendingRatePromptRef = useRef(false);
  const [showRateModal, setShowRateModal] = useState(false);

  // Récupérer la caméra arrière
  const device = useCameraDevice('back');

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans ScanScreen:', language);
        setRefreshKey(prev => prev + 1);
      }
    });

    return () => {
      if (typeof listener === 'string') {
        EventRegister.removeEventListener(listener);
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

  const processImageRef = useRef<(imagePath: string) => Promise<void>>(async () => {});
  const markCooldownRef = useRef<() => void>(() => {});
  const runCaptureRef = useRef<() => Promise<void>>(async () => {});

  // Fonction pour réinitialiser complètement l'état du scan
  const resetScanState = useCallback(() => {
    setPhotoUri(null);
    setScanResult({
      pokemonName: null,
      healthPoints: null,
      cardNumber: null,
      cardKind: null,
      imageUri: null
    });
    setMatchingCards([]);
    setSearchQuery('');
    setSearchResults([]);
    setShowSuggestions(false);
    setSearchFocused(false);
    isProcessingRef.current = false;
    setIsProcessing(false);
    setScanError(null);
    captureInFlightRef.current = false;
    markCooldownRef.current();
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setSearchFocused(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const runCapture = useCallback(async () => {
    if (captureInFlightRef.current || isProcessingRef.current || !camera.current) {
      return;
    }

    markCooldownRef.current();
    captureInFlightRef.current = true;
    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      const allowed = await canScanCard();
      if (!allowed) {
        Alert.alert(
          t('scan.restrictionTitle'),
          t('scan.restrictionMessage', { maxCount: FREE_MONTHLY_SCANS }),
          [
            { text: t('premium.upsell.later'), style: 'cancel' },
            { text: t('premium.upgrade'), onPress: () => router.push('/premium?from=scan') },
          ]
        );
        isProcessingRef.current = false;
        setIsProcessing(false);
        captureInFlightRef.current = false;
        return;
      }

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics optionnel
      }

      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableAutoRedEyeReduction: false,
      });

      let imagePath = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      try {
        if (cameraViewSize.width > 0 && cameraViewSize.height > 0) {
          imagePath = await cropPhotoToCardGuide({
            photoPath: photo.path,
            photoWidth: photo.width,
            photoHeight: photo.height,
            viewWidth: cameraViewSize.width,
            viewHeight: cameraViewSize.height,
            guideWidth: CARD_WIDTH,
            guideHeight: CARD_HEIGHT,
          });
        }
      } catch (cropError) {
        console.warn('[Scan] Crop guide échoué, image plein cadre:', cropError);
      }

      // Quota après capture/crop accepté, avant analyse
      if (!isPremium) {
        const { data } = await SupabaseService.supabase.auth.getUser();
        const userId = data.user?.id;
        if (userId) {
          await incrementMonthlyScanCount(userId);
        }
      }

      try {
        pendingRatePromptRef.current = await recordScanAndShouldPromptRate();
      } catch {
        pendingRatePromptRef.current = false;
      }

      setPhotoUri(imagePath);
      await processImageRef.current(imagePath);
    } catch (err) {
      console.error('[Scan] Capture failed:', err);
      Alert.alert(t('scan.error'), t('scan.captureError'));
      setScanError(t('scan.captureError'));
      isProcessingRef.current = false;
      setIsProcessing(false);
    } finally {
      captureInFlightRef.current = false;
    }
  }, [canScanCard, cameraViewSize, isPremium, router, t]);

  runCaptureRef.current = runCapture;

  const { isStable, isReady, markCooldown } = useStableAutoCapture({
    enabled:
      autoCaptureEnabled &&
      !photoUri &&
      !scanError &&
      !isProcessing &&
      hasPermission &&
      !!device,
    onCapture: () => {
      void runCaptureRef.current();
    },
  });
  markCooldownRef.current = markCooldown;

  // Capture manuelle (ou reset si déjà une photo/erreur)
  const handleStartScan = async () => {
    if (scanError || photoUri) {
      resetScanState();
      return;
    }
    await runCapture();
  };

  const handleCameraLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCameraViewSize({ width, height });
  };

  // Fonction pour rechercher les cartes correspondantes (Pokémon : Nom+HP ; Trainer : Nom sans HP)
  const searchMatchingCards = async (scanResult: ScanResult) => {
    const searchStartTime = Date.now();
    console.log(`🕐 [${new Date().toISOString()}] Database search STARTED for:`, JSON.stringify(scanResult));
    
    setIsLoadingCards(true);
    try {
      console.log('Recherche de cartes correspondantes avec:', scanResult);
      
      let allCards: OfficialCard[] = [];
      const isTrainer = scanResult.cardKind === 'trainer';
      // Les trainers n'ont pas de PV : ne pas filtrer sur HP
      const healthPoints = isTrainer ? null : scanResult.healthPoints;

      // Une seule passe : searchOfficialCardsByDetails gère déjà les variantes de nom
      const { data, error } = await SupabaseService.searchOfficialCardsByDetails({
        pokemonName: scanResult.pokemonName,
        healthPoints,
        cardNumber: scanResult.cardNumber,
      });
      if (!error && data) {
        allCards = data;
      }

      // Fallbacks uniquement si vide (évite 10–15 requêtes séquentielles)
      if (allCards.length === 0 && scanResult.pokemonName && scanResult.cardNumber) {
        const { data: withoutNumber } = await SupabaseService.searchOfficialCardsByDetails({
          pokemonName: scanResult.pokemonName,
          healthPoints,
          cardNumber: null,
        });
        if (withoutNumber?.length) allCards = withoutNumber;
      }

      if (allCards.length === 0 && scanResult.pokemonName && (healthPoints || isTrainer)) {
        const { data: nameOnly } = await SupabaseService.searchOfficialCardsByDetails({
          pokemonName: scanResult.pokemonName,
          healthPoints: null,
          cardNumber: null,
        });
        if (nameOnly?.length) allCards = nameOnly;
      }
      
      console.log(`Total de ${allCards.length} cartes trouvées après toutes les recherches`);
      
      // Trier les résultats par pertinence si on a un nom original
      const sortStartTime = Date.now();
      if (scanResult.pokemonName && allCards.length > 1) {
        const originalName = scanResult.pokemonName.toLowerCase();
        const isTrainerSupertype = (s?: string) =>
          /trainer|dresseur|item|stadium|energy|énergie/i.test(String(s || ''));
        allCards.sort((a, b) => {
          if (isTrainer) {
            const aTrainer = isTrainerSupertype(a.supertype);
            const bTrainer = isTrainerSupertype(b.supertype);
            if (aTrainer && !bTrainer) return -1;
            if (!aTrainer && bTrainer) return 1;
          }

          const aExact = a.name.toLowerCase() === originalName;
          const bExact = b.name.toLowerCase() === originalName;
          
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          if (scanResult.cardNumber) {
            const wanted = scanResult.cardNumber.split('/')[0].replace(/^0+/, '');
            const aNum = String(a.number || '').replace(/^0+/, '') === wanted;
            const bNum = String(b.number || '').replace(/^0+/, '') === wanted;
            if (aNum && !bNum) return -1;
            if (!aNum && bNum) return 1;
          }
          
          // Prioriser les cartes qui contiennent le nom original
          const aContains = a.name.toLowerCase().includes(originalName.replace(/\s+(ex|EX|gx|GX|v|V|vmax|VMAX|vstar|VSTAR)$/i, ''));
          const bContains = b.name.toLowerCase().includes(originalName.replace(/\s+(ex|EX|gx|GX|v|V|vmax|VMAX|vstar|VSTAR)$/i, ''));
          
          if (aContains && !bContains) return -1;
          if (!aContains && bContains) return 1;
          
          return a.name.localeCompare(b.name);
        });
      }
      const sortEndTime = Date.now();
      if (sortEndTime - sortStartTime > 1) {
        console.log(`⏱️ [${new Date().toISOString()}] Results sorting completed in ${sortEndTime - sortStartTime}ms`);
      }
      
      setMatchingCards(allCards);
      
      const searchEndTime = Date.now();
      const totalSearchTime = searchEndTime - searchStartTime;
      console.log(`🏁 [${new Date().toISOString()}] Database search COMPLETED in ${totalSearchTime}ms total, found ${allCards.length} cards`);
      
    } catch (error) {
      const errorTime = Date.now();
      console.error(`🔴 [${new Date().toISOString()}] Database search failed after ${errorTime - searchStartTime}ms:`, error);
      setMatchingCards([]);
    } finally {
      setIsLoadingCards(false);
    }
  };

  // Analyse : OpenAI + OCR en parallèle (OCR local souvent prêt avant la vision)
  const processImage = async (imagePath: string) => {
    try {
      const ocrPromise = TextRecognition.recognize(imagePath)
        .then((result) => (result?.text ? extractScanFromOcrText(result.text, imagePath) : null))
        .catch((e) => {
          console.warn('[Scan] OCR failed:', e);
          return null;
        });

      const aiPromise = analyzeCardWithOpenAI(imagePath);

      const [ocrResult, aiResult] = await Promise.all([ocrPromise, aiPromise]);

      // Vision en priorité pour le nom/PV, OCR en complément (surtout n° bas de carte)
      const chosen = mergeScanResults(aiResult, ocrResult, imagePath);

      console.log('[Scan] Résultat fusionné:', {
        ai: aiResult,
        ocr: ocrResult,
        chosen,
      });

      if (chosen && (chosen.pokemonName || chosen.cardNumber || chosen.healthPoints)) {
        setScanResult(chosen);
        await searchMatchingCards(chosen);
        return;
      }

      Alert.alert(t('scan.noTextDetected'), t('scan.tryBetterLighting'));
      setScanResult({
        pokemonName: null,
        healthPoints: null,
        cardNumber: null,
        cardKind: null,
        imageUri: null,
      });
      setMatchingCards([]);
    } catch (e) {
      console.error('[Scan] processImage failed:', e);
      Alert.alert(t('scan.error'), t('scan.imageAnalysisError'));
      setScanError(t('scan.imageAnalysisError'));
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      if (pendingRatePromptRef.current) {
        pendingRatePromptRef.current = false;
        setTimeout(() => setShowRateModal(true), 700);
      }
    }
  };
  processImageRef.current = processImage;

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
          <View style={styles.cardInfoRow}>
            {item.hp && (
              <Text style={[styles.cardInfoText, { color: colors.text.secondary }]}>
                HP: {item.hp}
              </Text>
            )}
            {item.number && (
              <Text style={[styles.cardNumberText, { color: colors.primary, fontWeight: '600' }]}>
                n° {item.number.padStart(3, '0')}
              </Text>
            )}
          </View>
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
    Keyboard.dismiss();
    
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

  const renderManualSearchInput = () => (
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
      {searchQuery.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            setSearchQuery('');
            setSearchResults([]);
            setShowSuggestions(false);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderManualSearchResults = () => {
    if (!showSuggestions) return null;

    return (
      <View
        style={[
          styles.suggestionsContainer,
          { backgroundColor: colors.background },
          isKeyboardVisible ? styles.suggestionsContainerCompact : styles.suggestionsContainerExpanded,
        ]}
      >
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
            contentContainerStyle={styles.suggestionsListContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
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
    );
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
        <View style={styles.headerRight}>
          {!photoUri && !scanError && (
            <TouchableOpacity
              style={[
                styles.autoToggle,
                {
                  backgroundColor: autoCaptureEnabled
                    ? colors.primary + '22'
                    : colors.surface,
                  borderColor: autoCaptureEnabled ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setAutoCaptureEnabled((v) => !v)}
              disabled={isProcessing}
            >
              <Text
                style={[
                  styles.autoToggleText,
                  { color: autoCaptureEnabled ? colors.primary : colors.text.secondary },
                ]}
              >
                {autoCaptureEnabled ? t('scan.autoMode') : t('scan.manualMode')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerCameraButton}
            onPress={handleStartScan}
            disabled={isProcessing}
          >
            <Ionicons
              name="camera"
              size={24}
              color={isProcessing ? colors.text.secondary : colors.primary}
            />
          </TouchableOpacity>
        </View>
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
                  // Cartes correspondantes + recherche manuelle si absente de la liste
                  <View style={[
                    styles.resultsContainer,
                    (searchFocused || isKeyboardVisible || showSuggestions) && styles.resultsContainerExpanded,
                  ]}>
                    <View style={styles.matchingCardsSection}>
                      <View style={[styles.matchingCardsHeader, { backgroundColor: colors.surface + 'F0' }]}>
                        <Text style={[styles.matchingCardsTitle, { color: colors.text.primary }]}>{t('scan.matchingCards')}</Text>
                        {isLoadingCards && <ActivityIndicator size="small" color={colors.primary} />}
                      </View>

                      <View style={styles.matchingSearchBlock}>
                        <Text style={[styles.matchingSearchHint, { color: colors.text.secondary }]}>
                          {t('scan.notInListSearch')}
                        </Text>
                        {renderManualSearchInput()}
                      </View>

                      {showSuggestions ? (
                        renderManualSearchResults()
                      ) : (
                        <FlatList
                          data={matchingCards}
                          renderItem={renderCardItem}
                          keyExtractor={(item) => item.id}
                          style={styles.cardsList}
                          contentContainerStyle={styles.cardsListContent}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                        />
                      )}
                    </View>
                  </View>
                ) : (
                  // Aucune correspondance - Recherche manuelle pleine page
                  <View style={[styles.fullPageSearchSection, { backgroundColor: colors.surface }]}>
                    <View style={[styles.searchSectionHeader, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.searchSectionTitle, { color: colors.text.primary }]}>
                        {t('scan.searchManually')}
                      </Text>
                    </View>
                    
                    <View style={styles.searchSectionContent}>
                      {renderManualSearchInput()}
                      {renderManualSearchResults()}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrapper} onLayout={handleCameraLayout}>
            <Camera
              ref={camera}
              style={styles.camera}
              device={device}
              isActive={!photoUri}
              photo={true}
              outputOrientation="preview"
              enableZoomGesture
            />
            
            {/* Guide de placement de carte */}
            <View style={styles.cardGuideOverlay} pointerEvents="none">
              <View
                style={[
                  styles.cardGuide,
                  autoCaptureEnabled && isReady && styles.cardGuideReady,
                  autoCaptureEnabled && isStable && !isReady && styles.cardGuideStable,
                  !autoCaptureEnabled && styles.cardGuideManual,
                ]}
              />
              {autoCaptureEnabled && (
                <Text style={styles.guideHint}>
                  {isReady
                    ? t('scan.readyToCapture')
                    : isStable
                      ? t('scan.holdSteady')
                      : t('scan.placeCard')}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Bouton de scan circulaire centré */}
      {!photoUri && !scanError && (
        <View style={[styles.circularButtonContainer, { bottom: 16 + insets.bottom }]}>
          <TouchableOpacity 
            style={[styles.circularButton, { backgroundColor: colors.primary }]} 
            onPress={handleStartScan}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <Ionicons name="camera" size={32} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      )}
      
      {/* Bouton pour réessayer en cas d'erreur */}
      {(photoUri && scanError) && (
        <View style={[styles.circularButtonContainer, { bottom: 16 + insets.bottom }]}>
          <TouchableOpacity 
            style={[styles.circularButton, { backgroundColor: colors.error || '#e53935' }]} 
            onPress={resetScanState}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Bouton pour scanner à nouveau */}
      {(photoUri && !scanError && !isLoadingCards) && (
        <View style={[styles.circularButtonContainer, { bottom: 16 + insets.bottom }]}>
          <TouchableOpacity 
            style={[styles.circularButton, { backgroundColor: colors.secondary }]} 
            onPress={resetScanState}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={32} color="#FFFFFF" />
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

      <RateAppModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
      />
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
  headerCameraButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  autoToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  autoToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
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
    borderWidth: 3,
    borderColor: '#FFFFFFAA',
    borderRadius: 8,
  },
  cardGuideStable: {
    borderColor: '#FFC107',
    shadowColor: '#FFC107',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
  },
  cardGuideReady: {
    borderColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 6,
  },
  cardGuideManual: {
    borderColor: '#4CAF50',
  },
  guideHint: {
    position: 'absolute',
    bottom: '12%',
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
    paddingHorizontal: 20,
    borderRadius: 10,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  resultsContainerExpanded: {
    top: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  matchingCardsSection: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  matchingSearchBlock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  matchingSearchHint: {
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 2,
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
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNumberText: {
    fontSize: 14,
    fontWeight: '600',
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
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  suggestionsContainerCompact: {
    flexGrow: 0,
    maxHeight: 220,
  },
  suggestionsContainerExpanded: {
    flex: 1,
    minHeight: 280,
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionsListContent: {
    flexGrow: 1,
    paddingBottom: 16,
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
  circularButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 50,
  },
  circularButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
}); 