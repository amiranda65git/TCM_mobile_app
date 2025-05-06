import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';

export default function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const [refreshKey, setRefreshKey] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans WishlistScreen:', language);
        // Forcer un rafraîchissement du composant
        setRefreshKey(prev => prev + 1);
      }
    });
    
    setLanguageListener(listener);
    
    return () => {
      // Supprimer l'écouteur lors du démontage du composant
      if (languageListener) {
        EventRegister.removeEventListener(languageListener);
      }
    };
  }, []);

  // Écouter les changements de thème
  useEffect(() => {
    const themeListener = EventRegister.addEventListener('themeChanged', () => {
      console.log('Changement de thème détecté dans WishlistScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener);
      }
    };
  }, []);

  // Vérifier les changements de langue lorsque l'écran est focalisé
  useFocusEffect(
    useCallback(() => {
      async function checkLanguageChange() {
        const languageChanged = await AsyncStorage.getItem('@language_changed');
        if (languageChanged === 'true') {
          // Réinitialiser le flag
          await AsyncStorage.removeItem('@language_changed');
          console.log('Language has been changed, refreshing wishlist data...');
          // Force un rafraîchissement en incrémentant la clé
          setRefreshKey(prev => prev + 1);
        }
      }
      
      checkLanguageChange();
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('home.wishlist')}</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.emptyWishlist}>
          <Ionicons name="star-outline" size={80} color={colors.text.secondary} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{t('wishlist.empty')}</Text>
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {t('wishlist.emptyText')}
          </Text>
          
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.secondary }]}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
            <Text style={styles.addButtonText}>{t('wishlist.addCard')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyWishlist: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  addButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 