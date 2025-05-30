import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { supabase, addOrRemoveFromWishlist, getAllUserCards, markCardAsSold } from '../lib/supabase';
import SwipeableCard from '../components/SwipeableCard';

interface Card {
  user_card_id: any;
  condition: any;
  created_at: any;
  is_sold: any;
  card: {
    id: any;
    name: any;
    image_small: any;
    image_large: any;
    rarity: any;
    supertype: any;
    hp: any;
    card_number: any;
    edition_name: string;
    edition_id: string;
    edition_symbol_image: string;
    market_price_mid: any;
  };
}

const CONDITIONS = ['Near Mint', 'Excellent', 'Good', 'Played'];

const CONDITION_COLORS: Record<string, string> = {
  'Near Mint': '#4CAF50',
  'Excellent': '#2196F3',
  'Good': '#FF9800',
  'Played': '#F44336'
};

export default function AllCardsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');

  // Charger toutes les cartes de l'utilisateur
  const loadUserCards = async () => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await getAllUserCards(session.user.id);
      
      if (error) {
        console.error('Erreur lors du chargement des cartes:', error);
        Alert.alert(t('general.error'), t('cards.loadError'));
        return;
      }
      
      // Filtrer les valeurs null et trier les cartes par prix descendant
      const validCards = (data || []).filter((card): card is Card => card !== null);
      const sortedCards = validCards.sort((a, b) => {
        const priceA = a.card.market_price_mid || 0;
        const priceB = b.card.market_price_mid || 0;
        
        // Si les prix sont différents, trier par prix descendant
        if (priceA !== priceB) {
          return priceB - priceA;
        }
        
        // Si les prix sont identiques, trier par nom alphabétique
        return a.card.name.localeCompare(b.card.name);
      });
      
      setAllCards(sortedCards);
      setFilteredCards(sortedCards);
    } catch (error) {
      console.error('Erreur lors du chargement des cartes:', error);
      Alert.alert(t('general.error'), t('cards.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les cartes selon la recherche
  const filterCards = (query: string) => {
    if (!query.trim()) {
      setFilteredCards(allCards);
      return;
    }
    
    const filtered = allCards.filter(card =>
      card.card.name.toLowerCase().includes(query.toLowerCase())
    );
    
    setFilteredCards(filtered);
  };

  // Gérer le changement de texte de recherche
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    filterCards(text);
  };

  useEffect(() => {
    loadUserCards();
  }, [session?.user?.id]);

  // Convertir Card vers CardInfo pour SwipeableCard
  const convertToCardInfo = (card: Card) => ({
    id: card.card.id,
    name: card.card.name,
    number: card.card.card_number,
    rarity: card.card.rarity,
    image_small: card.card.image_small,
    image_large: card.card.image_large,
    owned: true, // Toutes les cartes dans cette page sont possédées
    price: null, // Pas de prix de vente par défaut
    is_for_sale: false, // Pas en vente par défaut
    has_price_alert: false, // On pourrait récupérer cette info plus tard
    market_price_low: null,
    market_price_mid: card.card.market_price_mid,
    market_price_high: null,
    has_wishlist: false, // Pas applicable pour les cartes possédées
    condition: card.condition,
    edition_name: card.card.edition_name,
    edition_symbol_image: card.card.edition_symbol_image,
  });

  // Fonction pour ouvrir le modal de vente
  const handleSellCard = (cardInfo: any) => {
    // Retrouver la carte complète depuis allCards
    const fullCard = allCards.find(c => c.card.id === cardInfo.id);
    if (fullCard) {
      setSelectedCard(fullCard);
      setSelectedCondition(fullCard.condition);
      setSalePrice('');
      setShowSellModal(true);
    }
  };

  // Fonction pour créer une alerte de prix
  const handleCreatePriceAlert = async (cardInfo: any) => {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .insert({
          user_id: session?.user?.id,
          card_id: cardInfo.id,
          target_price: 0, // L'utilisateur pourra modifier plus tard
          condition: cardInfo.condition,
          is_active: true
        });

      if (error) throw error;

      Alert.alert(t('priceAlert.success'), t('priceAlert.created'));
    } catch (error) {
      console.error('Erreur lors de la création de l\'alerte:', error);
      Alert.alert(t('general.error'), t('priceAlert.error'));
    }
  };

  // Fonction pour ajouter/retirer de la wishlist (pas applicable ici mais requis par SwipeableCard)
  const handleToggleWishlist = async (cardInfo: any) => {
    // Pas applicable pour les cartes possédées
  };

  // Fonction pour confirmer la vente
  const confirmSale = async () => {
    if (!selectedCard || !salePrice) {
      Alert.alert(t('general.error'), t('sell.enterPrice'));
      return;
    }

    const price = parseFloat(salePrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('general.error'), t('sell.invalidPrice'));
      return;
    }

    try {
      const { error } = await markCardAsSold(selectedCard.user_card_id, price);
      
      if (error) {
        Alert.alert(t('general.error'), t('sell.error'));
        return;
      }

      // Retirer la carte de la liste
      const updatedCards = allCards.filter(card => card.user_card_id !== selectedCard.user_card_id);
      setAllCards(updatedCards);
      filterCards(searchQuery); // Réappliquer le filtre
      
      Alert.alert(t('sell.success'), t('sell.cardSold'));
      setShowSellModal(false);
      setSelectedCard(null);
      setSalePrice('');
    } catch (error) {
      console.error('Erreur lors de la vente:', error);
      Alert.alert(t('general.error'), t('sell.error'));
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Stack.Screen 
          options={{
            title: t('allCards.title'),
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text.primary,
            headerTitleStyle: { color: colors.text.primary },
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          {t('allCards.loading')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{
          title: t('allCards.title'),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text.primary,
          headerTitleStyle: { color: colors.text.primary },
        }}
      />
      
      {/* Search Section */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder={t('allCards.searchPlaceholder')}
            placeholderTextColor={colors.text.secondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.secondary} style={styles.clearIcon} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Cards List */}
      <ScrollView style={styles.cardsList} showsVerticalScrollIndicator={false}>
        {filteredCards.length > 0 ? (
          filteredCards.map(card => (
            <SwipeableCard
              key={card.user_card_id}
              card={convertToCardInfo(card)}
              colors={colors}
              t={t}
              router={router}
              onSellPress={handleSellCard}
              onPriceAlertPress={handleCreatePriceAlert}
              onWishlistPress={handleToggleWishlist}
              showOwnershipIcon={false} // On sait déjà que toutes les cartes sont possédées
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            {searchQuery.length > 0 ? (
              <>
                <Ionicons name="search" size={60} color={colors.text.secondary} />
                <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
                  {t('allCards.noSearchResults')}
                </Text>
                <TouchableOpacity
                  style={[styles.clearSearchButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleSearchChange('')}
                >
                  <Text style={styles.clearSearchButtonText}>{t('allCards.clearSearch')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="library-outline" size={60} color={colors.text.secondary} />
                <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
                  {t('allCards.noCards')}
                </Text>
                <TouchableOpacity
                  style={[styles.scanButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/scan')}
                >
                  <Text style={styles.scanButtonText}>{t('allCards.startScanning')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de vente */}
      <Modal
        visible={showSellModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSellModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
              {t('sell.sellCard')}
            </Text>
            
            {selectedCard && (
              <View style={styles.selectedCardInfo}>
                <Image source={{ uri: selectedCard.card.image_small }} style={styles.modalCardImage} />
                <Text style={[styles.modalCardName, { color: colors.text.primary }]}>
                  {selectedCard.card.name}
                </Text>
              </View>
            )}

            <Text style={[styles.modalLabel, { color: colors.text.secondary }]}>
              {t('sell.condition')}
            </Text>
            <View style={styles.conditionsContainer}>
              {CONDITIONS.map(condition => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.conditionOption,
                    {
                      backgroundColor: selectedCondition === condition ? CONDITION_COLORS[condition] + '30' : 'transparent',
                      borderColor: CONDITION_COLORS[condition]
                    }
                  ]}
                  onPress={() => setSelectedCondition(condition)}
                >
                  <Text style={[
                    styles.conditionOptionText,
                    { color: selectedCondition === condition ? CONDITION_COLORS[condition] : colors.text.secondary }
                  ]}>
                    {t(`conditions.${condition.toLowerCase().replace(' ', '')}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.text.secondary }]}>
              {t('sell.price')}
            </Text>
            <TextInput
              style={[styles.priceInput, { 
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text.primary
              }]}
              value={salePrice}
              onChangeText={setSalePrice}
              placeholder={t('sell.enterPrice')}
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setShowSellModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text.secondary }]}>
                  {t('general.cancel')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={confirmSale}
              >
                <Text style={styles.modalButtonText}>{t('sell.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  searchContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingRight: 12,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    padding: 12,
  },
  clearIcon: {
    marginLeft: 8,
  },
  cardsList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  scanButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  selectedCardInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCardImage: {
    width: 80,
    height: 112,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalCardName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  conditionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  conditionOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  conditionOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  clearSearchButton: {
    padding: 8,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 