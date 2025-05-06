import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { DocumentScanner } from 'react-native-document-scanner-plugin';

type CardScannerProps = {
  onCardDetected: (cardInfo: { name: string; number?: string }) => void;
  onCancel: () => void;
};

export const CardScanner: React.FC<CardScannerProps> = ({ onCardDetected, onCancel }) => {
  const [processing, setProcessing] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);

  useEffect(() => {
    scanDocument();
  }, []);

  const scanDocument = async () => {
    try {
      // Lancement du scanner de document
      const { scannedImages } = await DocumentScanner.scanDocument({
        letUserAdjustCrop: true,
        maxNumDocuments: 1,
        responseType: 'base64',
      });
      
      if (scannedImages && scannedImages.length > 0) {
        setScannedImage(scannedImages[0]);
        processScannedImage(scannedImages[0]);
      } else {
        onCancel();
      }
    } catch (error) {
      console.error('Erreur lors du scan:', error);
      onCancel();
    }
  };

  const processScannedImage = (imageBase64: string) => {
    setProcessing(true);
    
    // Simuler le traitement de l'image
    setTimeout(() => {
      // Dans une version réelle, ici on analyserait l'image pour extraire les informations
      // Cela pourrait utiliser une API d'OCR ou de vision par ordinateur
      
      // Pour l'instant, on simule une détection
      onCardDetected({
        name: 'Pikachu',
        number: '25/102'
      });
      
      setProcessing(false);
    }, 1500);
  };

  if (processing) {
    return (
      <View style={styles.container}>
        {scannedImage && (
          <Image 
            source={{ uri: `data:image/jpeg;base64,${scannedImage}` }} 
            style={styles.previewImage} 
            resizeMode="contain"
          />
        )}
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Analyse de la carte en cours...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {scannedImage ? (
        <>
          <Image 
            source={{ uri: `data:image/jpeg;base64,${scannedImage}` }} 
            style={styles.previewImage} 
            resizeMode="contain"
          />
          <View style={styles.controls}>
            <TouchableOpacity style={styles.button} onPress={scanDocument}>
              <Text style={styles.buttonText}>Rescanner</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onCancel}>
              <Text style={styles.buttonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.text}>Initialisation du scanner...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 12,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginHorizontal: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    margin: 30,
  },
}); 