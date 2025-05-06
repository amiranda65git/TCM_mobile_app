import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fr from './fr';
import en from './en';
import { EventRegister } from 'react-native-event-listeners';

// Fonction pour obtenir la langue enregistrée ou utiliser la langue du système
const getStoredLanguage = async () => {
  try {
    const storedLanguage = await AsyncStorage.getItem('@app_language');
    return storedLanguage || getLocales()[0].languageCode || 'fr';
  } catch (error) {
    console.error('Erreur lors de la récupération de la langue:', error);
    return 'fr';
  }
};

// Initialisation avec une langue par défaut, puis mise à jour
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: 'fr', // Langue par défaut en attendant de récupérer la langue stockée
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

// Chargement asynchrone de la langue stockée
getStoredLanguage().then(language => {
  i18n.changeLanguage(language);
  console.log('Langue initiale chargée:', language);
});

// Fonction pour changer la langue - version améliorée avec journalisation
export const changeLanguage = async (language) => {
  try {
    console.log('Demande de changement de langue vers:', language);
    
    // Enregistrer la langue dans le stockage local
    await AsyncStorage.setItem('@app_language', language);
    console.log('Langue enregistrée dans AsyncStorage');
    
    // Changer la langue dans i18next
    i18n.changeLanguage(language);
    console.log('Langue changée dans i18n');
    
    // Émission d'un événement global pour informer les autres écrans
    EventRegister.emit('changeLanguage', language);
    console.log('Événement de changement de langue émis:', language);
    
    // Forcer un rafraîchissement global de l'application en définissant une valeur
    // qui peut être surveillée par tous les composants qui ont besoin de se mettre à jour
    await AsyncStorage.setItem('@language_changed', 'true');
    console.log('Flag de changement de langue défini');
    
    return true;
  } catch (error) {
    console.error('Erreur lors du changement de langue:', error);
    return false;
  }
};

export default i18n; 