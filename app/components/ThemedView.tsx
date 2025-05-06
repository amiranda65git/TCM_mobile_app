import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StatusBar } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';

interface ThemedViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

interface ThemedTextProps {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  secondary?: boolean;
}

/**
 * Composant View avec application automatique des couleurs du thème
 */
export const ThemedView: React.FC<ThemedViewProps> = ({ children, style }) => {
  const colors = useThemeColors();
  
  return (
    <View style={[{ backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
};

/**
 * Composant container avec les styles courants de l'application
 */
export const ThemedContainer: React.FC<ThemedViewProps> = ({ children, style }) => {
  const colors = useThemeColors();
  
  return (
    <View style={[
      styles.container, 
      { backgroundColor: colors.background },
      style
    ]}>
      <StatusBar barStyle={useTheme().isDarkMode ? 'light-content' : 'dark-content'} />
      {children}
    </View>
  );
};

/**
 * Composant pour les éléments de surface (cartes, inputs, etc.)
 */
export const ThemedSurface: React.FC<ThemedViewProps> = ({ children, style }) => {
  const colors = useThemeColors();
  
  return (
    <View style={[
      styles.surface,
      { backgroundColor: colors.surface, borderColor: colors.border },
      style
    ]}>
      {children}
    </View>
  );
};

/**
 * Composant Text avec application automatique des couleurs du thème
 */
export const ThemedText: React.FC<ThemedTextProps> = ({ children, style, secondary = false }) => {
  const colors = useThemeColors();
  
  return (
    <Text style={[
      { color: secondary ? colors.text.secondary : colors.text.primary },
      style
    ]}>
      {children}
    </Text>
  );
};

/**
 * Hook personnalisé pour obtenir des styles dynamiques basés sur le thème
 */
export const useThemedStyles = (styleCreator: (colors: any) => any) => {
  const colors = useThemeColors();
  return styleCreator(colors);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  surface: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    marginVertical: 8,
  }
}); 