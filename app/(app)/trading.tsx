import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../lib/ThemeUtils';
import { useTranslation } from 'react-i18next';

export default function TradingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('trading.title', 'Trading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
}); 