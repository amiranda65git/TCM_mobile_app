import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import fr from './fr';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: {
    fr: {
      translation: fr,
    },
  },
  lng: getLocales()[0].languageCode || 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n; 