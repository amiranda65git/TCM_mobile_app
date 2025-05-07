import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../lib/auth';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { getUserCardsCount, getUserEditionsCount, getUserCardsGroupedByEdition } from '../lib/supabase';

interface CardProps {
  id: string;
  card_id: string;
  card_name: string;
  card_image: string;
  rarity: string;
  quantity: number;
  condition: string;
  is_for_sale: boolean;
  price: number;
}

interface EditionProps {
  id: string;
  name: string;
  logo_url: string;
  symbol_url: string;
  release_date: string;
  printed_total: number;
  total: number;
  cards: CardProps[];
}

export default function CollectionScreen() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editions, setEditions] = useState<EditionProps[]>([]);
  const [cardsCount, setCardsCount] = useState(0);
  const [editionsCount, setEditionsCount] = useState(0);

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener: any = EventRegister.addEventListener('changeLanguage', (language: any) => {
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
    const themeListener: any = EventRegister.addEventListener('themeChanged', () => {
      console.log('Changement de thème détecté dans CollectionScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener);
      }
    };
  }, []);

  // Charger les données de la collection
  const loadCollectionData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Charger le nombre de cartes
      const cardsResult = await getUserCardsCount(user.id);
      if (!cardsResult.error) {
        setCardsCount(cardsResult.count || 0);
      }
      
      // Charger le nombre d'éditions
      const editionsResult = await getUserEditionsCount(user.id);
      if (!editionsResult.error) {
        setEditionsCount(editionsResult.count || 0);
      }
      
      // Charger les cartes groupées par édition
      const collectionResult = await getUserCardsGroupedByEdition(user.id);
      if (!collectionResult.error && collectionResult.data) {
        setEditions(collectionResult.data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données de collection:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

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
      loadCollectionData();
    }, [loadCollectionData, refreshKey])
  );
  
  // Calculer la valeur totale d'une édition
  const calculateEditionValue = (cards: CardProps[]) => {
    return cards.reduce((total, card) => total + (card.price || 0), 0);
  };
  
  // Fonction pour calculer le nombre de cartes possédées dans une édition
  const getOwnedCardsCount = (cards: CardProps[]) => {
    return cards.length; // Toutes les cartes sont possédées avec une quantité de 1
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('home.collection')}</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            {t('general.loading')}
          </Text>
        </View>
      ) : editions.length > 0 ? (
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
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
              <Text style={[styles.statNumber, { color: colors.text.primary }]}>{cardsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.cards')}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.text.primary }]}>{editionsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.editions')}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.text.primary }]}>0</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.sold')}</Text>
            </View>
          </View>
          
          {editions.map(item => {
            const editionValue = calculateEditionValue(item.cards);
            const ownedCards = getOwnedCardsCount(item.cards);
            const totalCards = item.printed_total || item.total || item.cards.length;
            
            return (
              <View key={item.id} style={[styles.editionContainer, { backgroundColor: colors.surface }]}>
                <TouchableOpacity 
                  style={styles.editionHeader}
                  onPress={() => {
                    // @ts-ignore - Contournement des erreurs de TypeScript pour la navigation
                    router.push("../screens/edition/" + item.id);
                  }}
                >
                  <View style={styles.editionTitleContainer}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={styles.editionLogo} resizeMode="contain" />
                    ) : (
                      <Text style={[styles.editionName, { color: colors.text.primary }]}>{item.name}</Text>
                    )}
                    {item.symbol_url && (
                      <Image source={{ uri: item.symbol_url }} style={styles.editionSymbol} resizeMode="contain" />
                    )}
                  </View>
                  
                  <View style={styles.editionStatsContainer}>
                    <Text style={[styles.editionValue, { color: colors.secondary }]}>
                      {editionValue.toFixed(2)} €
                    </Text>
                    <Text style={[styles.editionCardCount, { color: colors.text.secondary }]}>
                      {ownedCards} / {totalCards} {t('home.cards')}
                    </Text>
                  </View>
                  
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={colors.text.secondary} 
                  />
                </TouchableOpacity>
              </View>
            );
          })}
          
          {/* Ajouter un padding supplémentaire au bas pour éviter que le contenu soit masqué par le menu */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : (
        <View style={styles.emptyCollection}>
          <Ionicons name="folder-open-outline" size={80} color={colors.text.secondary} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{t('collection.empty')}</Text>
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {t('collection.emptyText')}
          </Text>
        </View>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');

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
    paddingVertical: 16,
    width: '100%',
  },
  valueContainer: {
    borderRadius: 12,
    padding: 16,
    width: '100%',
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
    marginBottom: 16,
    width: '100%',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120, // Augmenter le padding en bas pour éviter les problèmes avec le menu
  },
  editionContainer: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  editionHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editionTitleContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editionStatsContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  editionLogo: {
    height: 35,
    width: 120,
    marginRight: 8,
  },
  editionSymbol: {
    height: 20,
    width: 20,
  },
  editionName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editionCardCount: {
    fontSize: 12,
  },
  editionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
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
  bottomPadding: {
    height: 50,
  },
}); 