import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Alert, Image, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

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
      Alert.alert("Erreur", "Erreur lors de la capture de la photo");
      setIsProcessing(false);
    }
  }, [isProcessing]);

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
      Alert.alert("Erreur", "Erreur lors de la capture de la photo");
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
        Alert.alert("Aucun texte détecté", "Veuillez réessayer avec une meilleure luminosité");
      }
    } catch (e) {
      Alert.alert("Erreur", "Erreur lors de l'analyse de l'image");
    } finally {
      setIsProcessing(false);
      setRectangleDetected(false);
    }
  };

  if (!device || !hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.text}>Chargement caméra...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Scanner une carte</Text>
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
                <Text style={styles.processingText}>Analyse de la carte...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <Camera
              ref={camera}
              style={styles.camera}
              device={device}
              isActive={!isProcessing}
              photo={true}
            />
            {/* Overlay de cadrage */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.cardFrame} />
              {rectangleDetected && <View style={styles.detectedFrame} />}
            </View>
            
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {rectangleDetected ? "Carte détectée..." : "Alignez la carte dans le cadre"}
              </Text>
            </View>
          </View>
        )}

        {/* Zone d'affichage des résultats */}
        {!isProcessing && photoUri && scanResult.pokemonName && (
          <View style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Résultats de l'analyse</Text>
            </View>
            <View style={styles.resultContent}>
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>Nom:</Text>
                <Text style={styles.resultValue}>{scanResult.pokemonName}</Text>
              </View>
              
              {scanResult.healthPoints && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>PV:</Text>
                  <Text style={styles.resultValue}>{scanResult.healthPoints}</Text>
                </View>
              )}
              
              {scanResult.cardNumber && (
                <View style={styles.resultItem}>
                  <Text style={styles.resultLabel}>Numéro:</Text>
                  <Text style={styles.resultValue}>{scanResult.cardNumber}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {photoUri ? (
          <TouchableOpacity style={styles.button} onPress={handleStartScan}>
            <Text style={styles.buttonText}>Scanner une nouvelle carte</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.captureButton} 
            onPress={handleStartScan}
            disabled={isProcessing}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  text: {
    color: Colors.text.primary,
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardFrame: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderWidth: 3,
    borderColor: '#F8D030',
    borderRadius: 12,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  detectedFrame: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderWidth: 3,
    borderColor: Colors.success,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  placeholderCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  placeholderText: {
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
  },
  photo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultHeader: {
    backgroundColor: Colors.primary,
    padding: 12,
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultContent: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  resultLabel: {
    color: Colors.text.secondary,
    width: 80,
    fontSize: 16,
  },
  resultValue: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
}); 