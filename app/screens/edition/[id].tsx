import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/ThemeContext';
import { useThemeColors } from '../../lib/ThemeUtils';
import { supabase } from '../../lib/supabase';

interface CardInfo {
  id: string;
  name: string;
  number: string;
  rarity: string;
  image_small: string;
  image_large: string;
  owned: boolean;
  price: number | null;
}

interface EditionDetail {
  id: string;
  name: string;
  logo_image: string;
  symbol_image: string;
  printed_total: number;
  total: number;
  release_date: string;
  cards: CardInfo[];
}

interface UserCard {
  card_id: string;
  price: number | null;
}

export default function EditionDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  
  const [loading, setLoading] = useState(true);
  const [editionDetail, setEditionDetail] = useState<EditionDetail | null>(null);
  const [totalValue, setTotalValue] = useState(0);
  const [ownedCards, setOwnedCards] = useState(0);

  useEffect(() => {
    loadEditionDetails();
  }, [id, user?.id]);

  const loadEditionDetails = async () => {
    if (!id || !user) return;
    
    setLoading(true);
    try {
      // 1. Obtenir les détails de l'édition
      const { data: editionData, error: editionError } = await supabase
        .from('editions')
        .select('id, name, logo_image, symbol_image, release_date, printed_total, total')
        .eq('id', id)
        .single();
      
      if (editionError) throw editionError;
      
      // 2. Récupérer toutes les cartes de cette édition
      const { data: cardsData, error: cardsError } = await supabase
        .from('official_cards')
        .select('id, name, number, rarity, image_small, image_large')
        .eq('edition_id', id)
        .order('number');
      
      if (cardsError) throw cardsError;
      
      // 3. Récupérer les cartes possédées par l'utilisateur
      const { data: userCardsData, error: userCardsError } = await supabase
        .from('user_cards')
        .select('card_id, price')
        .eq('user_id', user.id);
      
      if (userCardsError) throw userCardsError;
      
      // Créer un Set des cartes possédées pour une recherche rapide
      const ownedCardsSet = new Set<string>();
      const cardPriceMap = new Map<string, number>();
      
      userCardsData?.forEach((card: UserCard) => {
        ownedCardsSet.add(card.card_id);
        if (card.price) {
          cardPriceMap.set(card.card_id, card.price);
        }
      });
      
      // Combiner les données
      const cardsWithOwnership = cardsData.map((card: any) => ({
        ...card,
        owned: ownedCardsSet.has(card.id),
        price: cardPriceMap.get(card.id) || null
      }));
      
      const owned = cardsWithOwnership.filter((card: CardInfo) => card.owned).length;
      setOwnedCards(owned);
      
      // Calculer la valeur totale des cartes possédées
      const value = cardsWithOwnership.reduce((total: number, card: CardInfo) => {
        return total + (card.owned && card.price ? card.price : 0);
      }, 0);
      setTotalValue(value);
      
      // Mettre à jour l'état
      setEditionDetail({
        ...editionData,
        cards: cardsWithOwnership
      });
    } catch (error) {
      console.error("Erreur lors du chargement des détails de l'édition:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{ 
            headerShown: false
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            {t('general.loading')}
          </Text>
        </View>
      </View>
    );
  }

  if (!editionDetail) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{ 
            headerShown: false
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text.primary }]}>
            {t('edition.notFound')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          headerShown: false
        }}
      />
      
      <View style={styles.customHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          {editionDetail.name}
        </Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.headerContainer, { backgroundColor: colors.surface }]}>
          {editionDetail.logo_image ? (
            <Image 
              source={{ uri: editionDetail.logo_image }} 
              style={styles.editionLogo} 
              resizeMode="contain"
            />
          ) : (
            <Text style={[styles.editionTitle, { color: colors.text.primary }]}>
              {editionDetail.name}
            </Text>
          )}
          
          {editionDetail.symbol_image && (
            <Image 
              source={{ uri: editionDetail.symbol_image }} 
              style={styles.editionSymbol} 
              resizeMode="contain"
            />
          )}
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                {t('edition.value')}
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {totalValue.toFixed(2)} €
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>
                {t('edition.cardsOwned')}
              </Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>
                {ownedCards} / {editionDetail.printed_total || editionDetail.total || editionDetail.cards.length}
              </Text>
            </View>
          </View>
        </View>
        
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {t('edition.allCards')}
        </Text>
        
        <View style={styles.cardsGrid}>
          {editionDetail.cards.map(card => (
            <TouchableOpacity 
              key={card.id}
              style={[styles.cardItem, { backgroundColor: colors.surface }]}
              onPress={() => {
                // Navigation vers la carte à implemémenter
                // router.push(`/card/${card.id}`);
              }}
            >
              {card.image_small ? (
                <Image 
                  source={{ uri: card.image_small }} 
                  style={styles.cardImage} 
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.surface }]} />
              )}
              
              <View style={styles.cardDetails}>
                <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={1}>
                  {card.name}
                </Text>
                <Text style={[styles.cardNumber, { color: colors.text.secondary }]}>
                  #{card.number}
                </Text>
                <Text style={[styles.cardRarity, { color: colors.text.secondary }]}>
                  {card.rarity || t('general.common')}
                </Text>
                {card.price && (
                  <Text style={[styles.cardPrice, { color: colors.secondary }]}>
                    {card.price.toFixed(2)} €
                  </Text>
                )}
              </View>
              
              <View style={styles.cardOwnership}>
                <MaterialIcons 
                  name={card.owned ? "catching-pokemon" : "radio-button-unchecked"} 
                  size={24} 
                  color={card.owned ? colors.secondary : colors.text.secondary} 
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerContainer: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  editionLogo: {
    height: 60,
    width: 200,
    marginBottom: 12,
  },
  editionSymbol: {
    height: 30,
    width: 30,
    marginBottom: 12,
  },
  editionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  cardsGrid: {
    width: '100%',
  },
  cardItem: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  cardImage: {
    width: 40,
    height: 56,
    borderRadius: 4,
  },
  cardImagePlaceholder: {
    width: 40,
    height: 56,
    borderRadius: 4,
    opacity: 0.5,
  },
  cardDetails: {
    flex: 1,
    marginLeft: 12,
  },
  cardName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  cardNumber: {
    fontSize: 12,
  },
  cardRarity: {
    fontSize: 12,
    marginTop: 2,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  cardOwnership: {
    marginLeft: 8,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 15,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
}); 