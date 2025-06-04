import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LanguageFlagProps {
  language?: string;
  size?: 'small' | 'medium' | 'large';
}

const LanguageFlag: React.FC<LanguageFlagProps> = ({ 
  language = 'EN', 
  size = 'medium' 
}) => {
  // Si pas de langue spécifiée, ne pas afficher
  if (!language) {
    return null;
  }

  const isFrench = language === 'FR';
  const isEnglish = language === 'EN';
  
  // Si ce n'est ni FR ni EN, ne pas afficher
  if (!isFrench && !isEnglish) {
    return null;
  }
  
  // Tailles des emojis selon la prop size
  const sizeStyles = {
    small: {
      fontSize: 12,
    },
    medium: {
      fontSize: 16,
    },
    large: {
      fontSize: 20,
    }
  };

  const currentStyle = sizeStyles[size];

  // Emoji du drapeau selon la langue
  const getFlagEmoji = () => {
    if (isFrench) {
      return '🇫🇷'; // Drapeau français
    } else {
      return '🇬🇧'; // Drapeau britannique
    }
  };

  return (
    <Text style={[
      styles.flagEmoji,
      { fontSize: currentStyle.fontSize }
    ]}>
      {getFlagEmoji()}
    </Text>
  );
};

const styles = StyleSheet.create({
  flagEmoji: {
    textAlign: 'center',
    lineHeight: undefined, // Laisser React Native gérer la hauteur de ligne
  },
});

export default LanguageFlag; 