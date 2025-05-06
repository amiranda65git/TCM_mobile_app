import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Dimensions, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Colors } from '../constants/Colors';

const { width, height } = Dimensions.get('window');
const CARD_RATIO = 1.4;
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = CARD_WIDTH * CARD_RATIO;

// Types pour le résultat du scan
interface ScanResult {
  pokemonName: string | null;
  healthPoints: string | null;
  cardNumber: string | null;
  imageUri: string | null;
}

// Convertir un chemin de fichier en URI utilisable par TextRecognition
const filePathToUri = (path: string): string => {
  // Sur Android, on doit utiliser le format file:// 
  if (Platform.OS === 'android') {
    if (path.startsWith('file://')) {
      return path;
    }
    return `file://${path}`;
  }
  // Sur iOS, on garde le chemin tel quel
  return path;
};

export default function DirectScanScreen() {
  const router = useRouter();
  const camera = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState<'idle'|'aligning'|'processing'|'success'|'error'>('idle');
  const [capturedImage, setCapturedImage] = useState<string|null>(null);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [rectangleDetected, setRectangleDetected] = useState(false);
  
  // Pour la simulation périodique de la détection
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Récupérer la caméra arrière
  const device = useCameraDevice('back');

  // Capture automatique quand rectangle détecté
  const triggerAutoCapture = async () => {
    if (isProcessing || !camera.current) return;
    
    // On ne désactive pas la caméra tout de suite
    setIsProcessing(true);
    setStatus('processing');
    
    try {
      // Configuration de la photo avec plus d'options
      const photoOptions = {
        flash: 'off' as const,
        enableShutterSound: false,
        skipMetadata: true
      };
      
      // Capturer la photo avant de faire quoi que ce soit d'autre
      const photo = await camera.current.takePhoto(photoOptions);
      console.log("Photo capturée:", photo);
      
      // Calculer les dimensions à cropper (centre de l'image avec les proportions du cadre)
      const imageWidth = photo.width;
      const imageHeight = photo.height;
      
      // Calculer une zone de crop au centre de l'image qui correspond aux proportions du cadre affiché
      // On utilise un raccourci en créant manuellement une image croppée
      // Dans une implémentation complète, on utiliserait CropView de react-native-image-crop-tools
      
      // On transforme directement l'image sans cropping pour l'instant
      // Une implémentation complète du cropping nécessiterait plus de code pour l'UI
      const imageUri = filePathToUri(photo.path);
      setCapturedImage(imageUri);
      
      await processImage(imageUri);
    } catch (err) {
      console.error("Erreur de capture:", err);
      setErrorMsg(`Erreur lors de la capture: ${err instanceof Error ? err.message : 'Inconnu'}`);
      setStatus('error');
      setIsProcessing(false);
    }
  };

  // Démarre une simulation périodique pour la détection de cartes
  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    // Simulation périodique d'une détection de carte toutes les 4 secondes
    intervalRef.current = setInterval(() => {
      if (!isProcessing) {
        setRectangleDetected(true);
        setTimeout(() => {
          if (!isProcessing) {
            // Au lieu de déclencher directement la capture, on utilise un délai plus long
            // pour permettre à l'utilisateur de bien positionner la carte
            setTimeout(() => {
              if (!isProcessing) {
                triggerAutoCapture();
              }
            }, 1000);
          }
        }, 1000);
      }
    }, 4000); // On augmente légèrement l'intervalle pour plus de stabilité

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isProcessing]);

  // Demander la permission caméra au montage
  useEffect(() => {
    (async () => {
      try {
        const status = await Camera.requestCameraPermission();
        setHasPermission(status === 'granted');
        if (status !== 'granted') {
          setErrorMsg("L'accès à la caméra n'a pas été autorisé");
          setStatus('error');
        }
      } catch (error) {
        console.error("Erreur de permission caméra:", error);
        setErrorMsg("Impossible d'accéder à la caméra");
        setStatus('error');
      }
    })();
  }, []);

  // Capture manuelle
  const handleManualCapture = async () => {
    if (isProcessing || !camera.current) return;
    
    // On ne désactive pas la caméra tout de suite
    setIsProcessing(true);
    setStatus('processing');
    
    try {
      // Configuration de la photo avec plus d'options
      const photoOptions = {
        flash: 'off' as const,
        enableShutterSound: false,
        skipMetadata: true
      };
      
      // Capturer la photo avant de faire quoi que ce soit d'autre
      const photo = await camera.current.takePhoto(photoOptions);
      console.log("Photo capturée manuellement:", photo);
      
      // On transforme directement l'image sans cropping pour l'instant
      const imageUri = filePathToUri(photo.path);
      setCapturedImage(imageUri);
      
      await processImage(imageUri);
    } catch (err) {
      console.error("Erreur de capture manuelle:", err);
      setErrorMsg(`Erreur lors de la capture: ${err instanceof Error ? err.message : 'Inconnu'}`);
      setStatus('error');
      setIsProcessing(false);
    }
  };

  // Analyse OCR de l'image capturée
  const processImage = async (imageUri: string) => {
    try {
      setStatus('processing');
      console.log("Début de l'analyse OCR de l'image:", imageUri);
      
      // Vérifier si le chemin d'image est valide
      if (!imageUri) {
        console.error("Chemin d'image invalide");
        setErrorMsg("Chemin d'image invalide");
        setStatus('error');
        return;
      }
      
      // Analyse OCR avec gestion d'erreur améliorée
      const result = await TextRecognition.recognize(imageUri);
      console.log("Résultat OCR brut:", result);
      
      if (result && result.text) {
        console.log("Texte détecté:", result.text);
        
        // Amélioration des regex pour mieux détecter les cartes Pokémon
        
        // 1. Recherche du motif "X HP" ou "X PV" qui est commun sur les cartes Pokémon
        const hpPattern = /(\d+)\s*(HP|PV)/i;
        const hpMatch = result.text.match(hpPattern);
        
        // 2. Rechercher des noms de Pokémon connus dans le texte
        // Certains mots clés indiquent souvent des noms de Pokémon
        const pokemonNamePatterns = [
          // Nom suivi par "HP" ou "PV" à proximité
          /([A-Z][a-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)?)(?:(?:.|\n){0,20})(HP|PV)/i,
          // Nom après "Evolves from" ou après "STAGE"
          /Evolves from ([A-Za-zÀ-ÿ]+)(?:.|\n){1,50}([A-Za-zÀ-ÿ]+)/i,
          // Nom tout seul sur une ligne
          /^([A-Z][a-z]+)$/m,
          // Nom avant "Pokémon"
          /([A-Za-zÀ-ÿ]+)(?:\s+)(?:Pok[ée]mon)/i
        ];
        
        let nameMatch = null;
        let name = null;
        
        // Essayer chaque pattern jusqu'à ce qu'on trouve un nom
        for (const pattern of pokemonNamePatterns) {
          nameMatch = result.text.match(pattern);
          if (nameMatch) {
            if (pattern === pokemonNamePatterns[0]) {
              name = nameMatch[1]; // Pour le premier pattern, le nom est dans le groupe 1
            } else if (pattern === pokemonNamePatterns[1]) {
              name = nameMatch[2]; // Pour le deuxième pattern, on prend le 2ème pokemon (après Evolves from)
            } else {
              name = nameMatch[1];
            }
            
            // Vérifier que ce n'est pas un mot comme "Basic", "Stage", "Weakness", etc.
            const invalidNames = ['basic', 'stage', 'weakness', 'resistance', 'retreat', 'attack', 'damage', 'coin', 'flip'];
            if (invalidNames.includes(name.toLowerCase())) {
              name = null;
              continue;
            }
            
            break;
          }
        }
        
        // 3. Rechercher le numéro de carte (format X/Y)
        const cardNumberRegex = /(\d+)\/(\d+)/;
        const numberMatch = result.text.match(cardNumberRegex);
        
        console.log("HP match:", hpMatch);
        console.log("Nom détecté:", name);
        console.log("Match numéro:", numberMatch);
        
        // Si on a au moins trouvé un HP ou un nom
        if (name || hpMatch) {
          // Formatage du nom pour capitaliser correctement
          const formattedName = name ? 
            name.trim().split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ') : 
            "Non détecté";
            
          setScanResult({
            pokemonName: formattedName,
            healthPoints: hpMatch ? hpMatch[1] : "Non détecté",
            cardNumber: numberMatch ? numberMatch[0] : "Non détecté",
            imageUri: imageUri,
          });
          setStatus('success');
        } else {
          // Si on n'a pas trouvé de pattern spécifique, on essaie d'extraire quelque chose
          // qui ressemble à un nom de Pokémon
          const possibleNameMatch = result.text.match(/([A-Za-z][a-zÀ-ÿ]{3,}(?:\s[A-Za-z][a-zÀ-ÿ]+)*)/);
          if (possibleNameMatch && possibleNameMatch[0].length > 3) {
            // Si on trouve au moins un mot qui pourrait être un nom
            const formattedName = possibleNameMatch[0].trim()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
              
            setScanResult({
              pokemonName: formattedName,
              healthPoints: "Non détecté",
              cardNumber: numberMatch ? numberMatch[0] : "Non détecté",
              imageUri: imageUri,
            });
            setStatus('success');
          } else {
            setErrorMsg("Aucune carte Pokémon détectée. Veuillez réessayer avec un meilleur éclairage.");
            setStatus('error');
          }
        }
      } else {
        console.error("Aucun texte détecté dans l'image");
        setErrorMsg("Aucun texte détecté. Vérifiez l'éclairage et réessayez.");
        setStatus('error');
      }
    } catch (e) {
      console.error("Erreur lors de l'analyse de l'image:", e);
      setErrorMsg(`Erreur lors de l'analyse: ${e instanceof Error ? e.message : 'Inconnu'}`);
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Réinitialiser l'état pour un nouveau scan
  const resetScanner = () => {
    setScanResult(null);
    setCapturedImage(null);
    setStatus('idle');
    setErrorMsg(null);
    setIsProcessing(false);
    setRectangleDetected(false);
  };

  // Affichage de l'état du scan
  const renderStatus = () => {
    switch (status) {
      case 'idle':
        return <Text style={styles.statusText}>Alignez la carte dans le cadre</Text>;
      case 'aligning':
        return <Text style={styles.statusText}>Alignez la carte…</Text>;
      case 'processing':
        return (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" style={{marginRight: 8}} />
            <Text style={styles.statusText}>Analyse en cours…</Text>
          </View>
        );
      case 'success':
        return <Text style={[styles.statusText, { color: Colors.success }]}>Carte détectée !</Text>;
      case 'error':
        return <Text style={[styles.statusText, { color: Colors.error }]}>{errorMsg}</Text>;
      default:
        return null;
    }
  };

  if (!device || !hasPermission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.statusText}>Chargement caméra…</Text>
      </View>
    );
  }

  // Affichage principal
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Scan carte Pokémon</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Caméra ou résultat */}
      {!scanResult ? (
        <View style={styles.cameraContainer}>
          <Camera
            ref={camera}
            style={styles.camera}
            device={device}
            isActive={true}
            photo={true}
            enableZoomGesture={false}
          />
          {/* Overlay de cadrage */}
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.cardFrame} />
            {rectangleDetected && <View style={styles.detectedFrame} />}
          </View>
          {/* Statut du scan */}
          <View style={styles.statusContainer}>{renderStatus()}</View>
          
          {/* Bouton de capture manuelle */}
          <TouchableOpacity 
            style={styles.captureButton} 
            onPress={handleManualCapture}
            disabled={isProcessing}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Résultat du scan</Text>
          <View style={styles.resultImageContainer}>
            <Image source={{ uri: scanResult.imageUri! }} style={styles.resultImage} resizeMode="contain" />
          </View>
          
          {/* Affichage amélioré des résultats */}
          <View style={styles.resultInfoContainer}>
            <Text style={styles.resultText}>
              <Text style={styles.resultLabel}>Nom : </Text>
              <Text style={styles.resultData}>{scanResult.pokemonName}</Text>
            </Text>
            
            <Text style={styles.resultText}>
              <Text style={styles.resultLabel}>PV : </Text>
              <Text style={styles.resultData}>
                {scanResult.healthPoints === "Non détecté" ? 
                  <Text style={styles.notDetected}>{scanResult.healthPoints}</Text> : 
                  scanResult.healthPoints
                }
              </Text>
            </Text>
            
            <Text style={styles.resultText}>
              <Text style={styles.resultLabel}>Numéro : </Text>
              <Text style={styles.resultData}>
                {scanResult.cardNumber === "Non détecté" ? 
                  <Text style={styles.notDetected}>{scanResult.cardNumber}</Text> : 
                  scanResult.cardNumber
                }
              </Text>
            </Text>
          </View>
          
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={resetScanner}>
              <Text style={styles.actionButtonText}>Scanner une autre carte</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
    bottom: 120,
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
  captureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
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
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  resultImageContainer: {
    width: '100%',
    aspectRatio: 1.4,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  resultInfoContainer: {
    width: '100%',
    marginBottom: 20,
  },
  resultText: {
    fontSize: 18,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  resultLabel: {
    fontWeight: 'bold',
  },
  resultData: {
    fontWeight: 'normal',
  },
  notDetected: {
    color: Colors.error,
  },
  actionButtonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 24,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
}); 