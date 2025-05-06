import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../lib/auth';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';

export default function CollectionScreen() {
  const { user } = useAuth();
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
        console.log('Changement de langue détecté dans CollectionScreen:', language);
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
      console.log('Changement de thème détecté dans CollectionScreen');
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
          console.log('Language has been changed, refreshing collection data...');
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
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('home.collection')}</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.collectionSummary}>
        <View style={[styles.valueContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.valueHeader}>
            <Text style={[styles.valueLabel, { color: colors.text.secondary }]}>{t('home.currentValue')}</Text>
            <TouchableOpacity>
              <Ionicons name="eye-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.valueAmount, { color: colors.text.primary }]}>0,00 €</Text>
          
          <View style={styles.valueChange}>
            <Text style={[styles.valueChangeText, { color: colors.text.secondary }]}>0,00%</Text>
            <Text style={[styles.valuePeriod, { color: colors.text.secondary }]}>{t('settings.alerts.lastWeek')}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.text.primary }]}>0</Text>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.cards')}</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.text.primary }]}>0</Text>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.editions')}</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statNumber, { color: colors.text.primary }]}>0</Text>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.sold')}</Text>
        </View>
      </View>
      
      <View style={styles.actionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="add-circle-outline" size={24} color={colors.secondary} />
            <Text style={[styles.actionLabel, { color: colors.text.secondary }]}>{t('settings.add')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="folder-outline" size={24} color={colors.secondary} />
            <Text style={[styles.actionLabel, { color: colors.text.secondary }]}>{t('home.createFolder')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="pricetag-outline" size={24} color={colors.secondary} />
            <Text style={[styles.actionLabel, { color: colors.text.secondary }]}>{t('settings.sell')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="filter-outline" size={24} color={colors.secondary} />
            <Text style={[styles.actionLabel, { color: colors.text.secondary }]}>{t('settings.filter')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={24} color={colors.secondary} />
            <Text style={[styles.actionLabel, { color: colors.text.secondary }]}>{t('settings.export')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      <View style={styles.emptyCollection}>
        <Ionicons name="folder-open-outline" size={80} color={colors.text.secondary} />
        <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{t('collection.empty')}</Text>
        <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
          {t('collection.emptyText')}
        </Text>
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
  collectionSummary: {
    padding: 16,
  },
  valueContainer: {
    borderRadius: 12,
    padding: 16,
  },
  valueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 16,
  },
  valueAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  valueChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueChangeText: {
    fontSize: 16,
    marginRight: 8,
  },
  valuePeriod: {
    fontSize: 14,
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  actionsScroll: {
    paddingHorizontal: 12,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  actionLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyCollection: {
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
  },
}); 