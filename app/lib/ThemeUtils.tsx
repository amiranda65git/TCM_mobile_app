import { Colors } from '../constants/Colors';
import { useTheme } from './ThemeContext';

// Type pour les objets de couleur
type ColorScheme = {
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
  };
  border: string;
  primary: string;
  primaryLight: string;
  secondary: string;
  success: string;
  error: string;
};

// Définir les couleurs pour le thème clair
const lightTheme: ColorScheme = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: {
    primary: '#333333',
    secondary: '#757575'
  },
  border: '#E0E0E0',
  primary: '#4A90E2',
  primaryLight: '#EBF3FD',
  secondary: '#1E2F4D',
  success: '#4CAF50',
  error: '#FF4B4B',
};

// Définir les couleurs pour le thème sombre
const darkTheme: ColorScheme = {
  background: '#121826',
  surface: '#2A3C5A',
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B9C6'
  },
  border: '#374869',
  primary: '#1E2F4D',
  primaryLight: '#344973',
  secondary: '#4A90E2',
  success: '#4CAF50',
  error: '#FF4B4B',
};

// Hook pour obtenir les couleurs du thème actuel
export const useThemeColors = () => {
  const { isDarkMode } = useTheme();
  return isDarkMode ? darkTheme : lightTheme;
};

// Fonction utilitaire pour obtenir une couleur spécifique du thème
export const getThemeColor = (colorName: keyof ColorScheme, isDarkMode: boolean): any => {
  const theme = isDarkMode ? darkTheme : lightTheme;
  return theme[colorName];
};

// Fonction utilitaire pour générer des styles avec les bonnes couleurs en fonction du thème
export const createThemedStyles = (styleCreator: (colors: ColorScheme) => any, isDarkMode: boolean) => {
  const colors = isDarkMode ? darkTheme : lightTheme;
  return styleCreator(colors);
}; 