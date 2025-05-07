import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Dimensions } from 'react-native';
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

type ScanResult = {
  pokemonName: string | null;
  healthPoints: string | null;
  cardNumber: string | null;
  imageUri: string | null;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_RATIO = 1.4;
const CARD_WIDTH = SCREEN_WIDTH * 0.8;
const CARD_HEIGHT = CARD_WIDTH * CARD_RATIO;

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
  const [scanResult, setScanResult] = useState<ScanResult>({
    pokemonName: null,
    healthPoints: null,
    cardNumber: null,
    imageUri: null
  });
  
  // Pour la simulation périodique de la détection
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Simulation périodique d'une détection de carte toutes les 3 secondes
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

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isProcessing]);

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

  // Capture manuelle
  const handleStartScan = async () => {
    if (isProcessing || !camera.current) return;
    
    // Réinitialiser l'état si on a déjà une photo
    if (photoUri) {
      setPhotoUri(null);
      setScanResult({
        pokemonName: null,
        healthPoints: null,
        cardNumber: null,
        imageUri: null
      });
      setIsProcessing(false);
      return;
    }
    
    setIsProcessing(true);
    try {
      const photo = await camera.current.takePhoto({ flash: 'off' });
      setPhotoUri(photo.path);
      await processImage(photo.path);
    } catch (err) {
      Alert.alert(t('scan.error'), t('scan.captureError'));
      setIsProcessing(false);
    }
  };

  // Analyse OCR de l'image capturée
  const processImage = async (imagePath: string) => {
    try {
      const result = await TextRecognition.recognize(imagePath);
      if (result && result.text) {
        // Extraction des infos via regex
        const pokemonNameRegex = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*(?:PV|HP)\s*(\d+)/i;
        const cardNumberRegex = /(\d+)\/(\d+)/;
        const nameMatch = result.text.match(pokemonNameRegex);
        const numberMatch = result.text.match(cardNumberRegex);
        
        if (nameMatch) {
          setScanResult({
            pokemonName: nameMatch[1],
            healthPoints: nameMatch[2],
            cardNumber: numberMatch ? numberMatch[0] : null,
            imageUri: imagePath,
          });
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
          
          setScanResult({
            pokemonName: selectedPokemon.name,
            healthPoints: selectedPokemon.hp,
            cardNumber: selectedPokemon.number,
            imageUri: imagePath,
          });
        }
      } else {
        Alert.alert(t('scan.noTextDetected'), t('scan.tryBetterLighting'));
      }
    } catch (e) {
      Alert.alert(t('scan.error'), t('scan.imageAnalysisError'));
    } finally {
      setIsProcessing(false);
      setRectangleDetected(false);
    }
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

      <View style={styles.cameraContainer}>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: photoUri }}
              style={styles.photo}
              resizeMode="contain"
            />
            
            {/* Overlay de traitement */}
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.processingText}>{t('scan.analyzingCard')}</Text>
              </View>
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

      {/* Résultats de scan */}
      {photoUri && scanResult.pokemonName && (
        <View style={[styles.resultContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: colors.text.primary }]}>{t('scan.scanResults')}</Text>
          </View>
          
          <View style={styles.resultContent}>
            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>{t('scan.pokemonName')}:</Text>
              <Text style={[styles.resultValue, { color: colors.text.primary }]}>{scanResult.pokemonName}</Text>
            </View>
            
            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>{t('scan.hp')}:</Text>
              <Text style={[styles.resultValue, { color: colors.text.primary }]}>{scanResult.healthPoints}</Text>
            </View>
            
            {scanResult.cardNumber && (
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: colors.text.secondary }]}>{t('scan.cardNumber')}:</Text>
                <Text style={[styles.resultValue, { color: colors.text.primary }]}>{scanResult.cardNumber}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton, { borderColor: colors.border }]}
              onPress={() => handleStartScan()}
            >
              <Text style={[styles.actionButtonText, { color: colors.text.primary }]}>{t('scan.scanAgain')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => Alert.alert(t('scan.success'), t('scan.cardWillBeAdded'))}
            >
              <Text style={styles.primaryButtonText}>{t('scan.addToCollection')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bouton de scan/retour */}
      {!photoUri && (
        <TouchableOpacity 
          style={[styles.scanButton, { backgroundColor: colors.primary }]} 
          onPress={handleStartScan}
          disabled={isProcessing}
        >
          <Ionicons name="scan" size={24} color="#FFFFFF" />
          <Text style={styles.scanButtonText}>{t('scan.scan')}</Text>
        </TouchableOpacity>
      )}
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
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 30,
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
}); 