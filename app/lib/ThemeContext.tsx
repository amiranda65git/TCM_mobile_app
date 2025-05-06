import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { EventRegister } from 'react-native-event-listeners';

// Définir le type pour le contexte de thème
type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  setThemeManually: (isDark: boolean) => void;
};

// Créer le contexte avec les valeurs par défaut
export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
  setThemeManually: () => {},
});

// Hook personnalisé pour utiliser le contexte de thème
export const useTheme = () => useContext(ThemeContext);

// Définir le fournisseur de contexte pour le thème
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Récupérer le schéma de couleur du système
  const systemColorScheme = useColorScheme();
  // État pour le mode sombre/clair
  const [isDarkMode, setIsDarkMode] = useState<boolean>(systemColorScheme === 'dark');
  // État pour suivre si le thème a été défini manuellement
  const [isThemeManuallySet, setIsThemeManuallySet] = useState<boolean>(false);

  // Charger les préférences de thème au montage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const themePreference = await AsyncStorage.getItem('@theme_preference');
        const manuallySet = await AsyncStorage.getItem('@theme_manually_set');
        
        if (manuallySet === 'true') {
          setIsThemeManuallySet(true);
          setIsDarkMode(themePreference === 'dark');
        } else {
          // Si aucune préférence manuelle, utiliser le thème du système
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des préférences de thème:', error);
        // Par défaut, utiliser le thème du système
        setIsDarkMode(systemColorScheme === 'dark');
      }
    };
    
    loadThemePreference();
  }, []);
  
  // Mettre à jour quand le thème du système change, seulement si le thème n'est pas défini manuellement
  useEffect(() => {
    if (!isThemeManuallySet) {
      setIsDarkMode(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, isThemeManuallySet]);

  // Fonction pour basculer entre les thèmes
  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      setIsThemeManuallySet(true);
      await AsyncStorage.setItem('@theme_preference', newTheme ? 'dark' : 'light');
      await AsyncStorage.setItem('@theme_manually_set', 'true');
      
      // Émettre un événement pour informer les autres composants du changement de thème
      EventRegister.emit('themeChanged', newTheme);
      
      console.log('Thème changé pour', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences de thème:', error);
    }
  };
  
  // Fonction pour définir le thème manuellement
  const setThemeManually = async (isDark: boolean) => {
    try {
      setIsDarkMode(isDark);
      setIsThemeManuallySet(true);
      await AsyncStorage.setItem('@theme_preference', isDark ? 'dark' : 'light');
      await AsyncStorage.setItem('@theme_manually_set', 'true');
      
      // Émettre un événement pour informer les autres composants du changement de thème
      EventRegister.emit('themeChanged', isDark);
      
      console.log('Thème défini manuellement à', isDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des préférences de thème:', error);
    }
  };

  // Fournir le contexte aux composants enfants
  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, setThemeManually }}>
      {children}
    </ThemeContext.Provider>
  );
}; 