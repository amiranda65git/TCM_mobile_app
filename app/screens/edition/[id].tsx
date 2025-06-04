import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Animated, Dimensions, Modal, TextInput } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/ThemeContext';
import { useThemeColors } from '../../lib/ThemeUtils';
import { supabase, getEditionDetails, addOrRemoveFromWishlist } from '../../lib/supabase';
import SwipeableCard from '../../components/SwipeableCard';
import NotificationIcon from '../../components/NotificationIcon';
import LanguageFlag from '../../components/LanguageFlag';

interface CardInfo {
  id: string;
  name: string;
  number: string;
  rarity: string;
  image_small: string;
  image_large: string;
  owned: boolean;
  price: number | null;
  is_for_sale: boolean;
  has_price_alert: boolean;
  market_price_low?: number | null;
  market_price_mid?: number | null;
  market_price_high?: number | null;
  has_wishlist: boolean;
  condition?: string;
  lang?: string;
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
  ownedCards?: number;
  totalValue?: number;
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
  
  // États pour la modale de vente
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardInfo | null>(null);
  const [sellingPrice, setSellingPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  
  // État pour le filtre des cartes possédées
  const [showOnlyOwned, setShowOnlyOwned] = useState(false);

  // Les conditions disponibles pour les cartes avec leurs couleurs
  const CONDITION_COLORS: Record<string, string> = {
    'Near Mint': '#4CAF50',
    'Excellent': '#2196F3',
    'Good': '#FF9800',
    'Played': '#F44336'
  };
  
  const CONDITIONS = Object.keys(CONDITION_COLORS);

  useEffect(() => {
    loadEditionDetails();
  }, [id, user?.id]);

  const loadEditionDetails = async () => {
    if (!id || !user) return;
    
    setLoading(true);
    try {
      const { data: editionData, error } = await getEditionDetails(id.toString(), user.id);
      
      if (error) throw error;
      
      if (editionData) {
        // Récupérer les alertes de prix de l'utilisateur pour cette édition
        const { data: priceAlerts, error: alertsError } = await supabase
          .from('price_alerts')
          .select('card_id')
          .eq('user_id', user.id);
        
        if (alertsError) throw alertsError;
        
        // Créer un ensemble pour une recherche plus rapide
        const alertedCardIds = new Set(priceAlerts?.map(alert => alert.card_id) || []);
        
        // Récupérer la wishlist de l'utilisateur
        const { data: wishlistData, error: wishlistError } = await supabase
          .from('wishlists')
          .select('card_id')
          .eq('user_id', user.id);
        if (wishlistError) throw wishlistError;
        const wishlistCardIds = new Set(wishlistData?.map(w => w.card_id) || []);
        
        // Ajouter l'information des alertes de prix et wishlist aux cartes
        const cardsWithAlerts = editionData.cards.map(card => ({
          ...card,
          has_price_alert: alertedCardIds.has(card.id),
          has_wishlist: wishlistCardIds.has(card.id)
        }));
        
        setEditionDetail({
          ...editionData,
          cards: cardsWithAlerts
        } as EditionDetail);
        setTotalValue(editionData.totalValue || 0);
        setOwnedCards(editionData.ownedCards || 0);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des détails de l'édition:", error);
    } finally {
      setLoading(false);
    }
  };

  // Gérer l'ouverture du modal de vente
  const handleSellPress = (card: CardInfo) => {
    setSelectedCard(card);
    
    // Pré-remplir avec le prix moyen du marché s'il existe ou le prix actuel
    let initialPrice = '';
    
    if (card.is_for_sale && card.price) {
      // Si la carte est déjà en vente, utiliser son prix actuel
      initialPrice = card.price.toString();
    } else if (card.market_price_mid) {
      // Sinon, utiliser le prix moyen du marché s'il existe
      initialPrice = card.market_price_mid.toString();
    } else if (card.price) {
      // En dernier recours, utiliser le prix actuel de la carte
      initialPrice = card.price.toString();
    }
    
    setSellingPrice(initialPrice);
    
    // Définir la condition actuelle ou "Near Mint" par défaut
    setSelectedCondition(card.condition || 'Near Mint');
    
    setSellModalVisible(true);
  };

  // Ajouter une alerte de prix
  const handlePriceAlert = async (card: CardInfo) => {
    if (!user) return;
    
    try {
      // Vérifier si une alerte existe déjà pour cette carte
      const { data: existingAlert, error: checkError } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', card.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        // Une erreur s'est produite (autre que "pas de résultat")
        throw checkError;
      }
      
      if (existingAlert) {
        // Si une alerte existe déjà, la supprimer (toggle)
        const { error: deleteError } = await supabase
          .from('price_alerts')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', card.id);
        
        if (deleteError) throw deleteError;
        
        // Afficher un message de confirmation
        console.log('Alerte de prix supprimée');
      } else {
        // Sinon, ajouter une nouvelle alerte
        const { error: insertError } = await supabase
          .from('price_alerts')
          .insert([
            { user_id: user.id, card_id: card.id }
          ]);
        
        if (insertError) throw insertError;
        
        // Afficher un message de confirmation
        console.log('Alerte de prix ajoutée');
      }
      
      // Rafraîchir les données
      loadEditionDetails();
      
    } catch (error) {
      console.error('Erreur lors de la gestion de l\'alerte de prix:', error);
    }
  };

  // Soumettre l'ordre de vente
  const handleSubmitSellOrder = async () => {
    if (!selectedCard || !user) return;
    
    try {
      // Convertir le prix de vente en nombre
      const price = parseFloat(sellingPrice);
      
      if (isNaN(price) || price <= 0) {
        // Gérer l'erreur de prix invalide
        console.error('Prix de vente invalide');
        return;
      }
      
      // Mettre à jour la carte dans la base de données
      const { data, error } = await supabase
        .from('user_cards')
        .update({
          price: price,
          is_for_sale: true,
          condition: selectedCondition
        })
        .eq('user_id', user.id)
        .eq('card_id', selectedCard.id);
      
      if (error) throw error;
      
      console.log('Carte mise en vente avec succès');
      
      // Fermer le modal et rafraîchir les données
      setSellModalVisible(false);
      loadEditionDetails();
      
    } catch (error) {
      console.error('Erreur lors de la mise en vente de la carte:', error);
    }
  };

  // Annuler une vente
  const handleCancelSellOrder = async () => {
    if (!selectedCard || !user) return;
    
    try {
      // Mettre à jour la carte dans la base de données
      const { data, error } = await supabase
        .from('user_cards')
        .update({
          is_for_sale: false
        })
        .eq('user_id', user.id)
        .eq('card_id', selectedCard.id);
      
      if (error) throw error;
      
      console.log('Annulation de la vente réussie');
      
      // Fermer le modal et rafraîchir les données
      setSellModalVisible(false);
      loadEditionDetails();
      
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la vente:', error);
    }
  };

  // Vérifier si le prix est valide
  const isPriceValid = () => {
    const price = parseFloat(sellingPrice);
    return !isNaN(price) && price > 0;
  };

  // Ajouter/retirer une carte à la wishlist
  const handleWishlist = async (card: CardInfo) => {
    if (!user) return;
    const res = await addOrRemoveFromWishlist(user.id, card.id);
    if (res.error) {
      console.error('Erreur wishlist:', res.error);
    } else {
      console.log(res.added ? 'Carte ajoutée à la wishlist' : 'Carte retirée de la wishlist');
      loadEditionDetails();
    }
  };

  // Filtrer les cartes selon l'état de showOnlyOwned
  const filteredCards = editionDetail?.cards.filter(card => !showOnlyOwned || card.owned) || [];

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
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowOnlyOwned(!showOnlyOwned)}
        >
          <MaterialIcons 
            name={showOnlyOwned ? "catching-pokemon" : "catching-pokemon"} 
            size={24} 
            color={showOnlyOwned ? colors.secondary : colors.text.primary} 
          />
        </TouchableOpacity>
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
              <Text style={[styles.statValue, { color: colors.text.secondary }]}>
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
        
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {t('edition.allCards')}
          </Text>
          {showOnlyOwned && (
            <View style={[styles.filterBadge, { backgroundColor: colors.secondary }]}>
              <Text style={styles.filterBadgeText}>
                {t('edition.onlyOwned')}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardsGrid}>
          {filteredCards.map(card => (
            <SwipeableCard 
              key={card.id} 
              card={card} 
              colors={colors} 
              t={t} 
              router={router}
              onSellPress={handleSellPress}
              onPriceAlertPress={handlePriceAlert}
              onWishlistPress={handleWishlist}
            />
          ))}
        </View>
      </ScrollView>
      
      {/* Modal de vente */}
      <Modal
        visible={sellModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSellModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {t('card.sellCard')}
              </Text>
              <TouchableOpacity onPress={() => setSellModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            {selectedCard && (
              <View style={styles.sellContent}>
                <Text style={[styles.cardSellName, { color: colors.text.primary }]}>
                  {selectedCard.name}
                </Text>
                
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceColumn}>
                    <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                      {t('card.lowPrice')}
                    </Text>
                    <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                      {selectedCard.market_price_low?.toFixed(2) || '?'} €
                    </Text>
                  </View>
                  
                  <View style={styles.priceColumn}>
                    <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                      {t('card.highPrice')}
                    </Text>
                    <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                      {selectedCard.market_price_high?.toFixed(2) || '?'} €
                    </Text>
                  </View>
                </View>
                
                {selectedCard.is_for_sale ? (
                  <View style={styles.alreadyForSaleContainer}>
                    <Text style={[styles.alreadyForSaleText, { color: colors.text.primary }]}>
                      {t('card.alreadyForSale')}
                    </Text>
                    <Text style={[styles.currentPriceText, { color: colors.secondary }]}>
                      {t('card.currentPrice')}: {selectedCard.price?.toFixed(2)} €
                    </Text>
                    
                    {/* Sélecteur de condition pour les cartes déjà en vente */}
                    <View style={styles.conditionContainer}>
                      <Text style={[styles.conditionLabel, { color: colors.text.primary }]}>
                        {t('card.condition')}:
                      </Text>
                      <View style={styles.conditionSelector}>
                        {CONDITIONS.map((condition) => (
                          <TouchableOpacity
                            key={condition}
                            style={[
                              styles.conditionButton,
                              selectedCondition === condition && { 
                                backgroundColor: CONDITION_COLORS[condition] + '30',
                                borderColor: CONDITION_COLORS[condition] 
                              },
                              { borderColor: colors.border }
                            ]}
                            onPress={() => setSelectedCondition(condition)}
                          >
                            <Text 
                              style={[
                                styles.conditionButtonText, 
                                { color: selectedCondition === condition ? CONDITION_COLORS[condition] : colors.text.secondary }
                              ]}
                            >
                              {t(`card.conditions.${condition.toLowerCase().replace(' ', '')}`)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.sellButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.cancelButton, { borderColor: colors.error }]}
                        onPress={handleCancelSellOrder}
                      >
                        <Text style={[styles.cancelButtonText, { color: colors.error }]}>
                          {t('card.cancelSale')}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.updateButton, { backgroundColor: colors.secondary }]}
                        onPress={() => {
                          // Permettre de mettre à jour le prix
                          handleSubmitSellOrder();
                        }}
                        disabled={!isPriceValid()}
                      >
                        <Text style={styles.sellButtonText}>
                          {t('card.updatePrice')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View>
                    {/* Sélecteur de condition pour les nouvelles ventes */}
                    <View style={styles.conditionContainer}>
                      <Text style={[styles.conditionLabel, { color: colors.text.primary }]}>
                        {t('card.selectCondition')}:
                      </Text>
                      <View style={styles.conditionSelector}>
                        {CONDITIONS.map((condition) => (
                          <TouchableOpacity
                            key={condition}
                            style={[
                              styles.conditionButton,
                              selectedCondition === condition && { 
                                backgroundColor: CONDITION_COLORS[condition] + '30',
                                borderColor: CONDITION_COLORS[condition] 
                              },
                              { borderColor: colors.border }
                            ]}
                            onPress={() => setSelectedCondition(condition)}
                          >
                            <Text 
                              style={[
                                styles.conditionButtonText, 
                                { color: selectedCondition === condition ? CONDITION_COLORS[condition] : colors.text.secondary }
                              ]}
                            >
                              {t(`card.conditions.${condition.toLowerCase().replace(' ', '')}`)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.sellingPriceContainer}>
                      <Text style={[styles.sellingPriceLabel, { color: colors.text.primary }]}>
                        {t('card.sellingPrice')}
                      </Text>
                      <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.priceInput, { color: colors.text.primary }]}
                          value={sellingPrice}
                          onChangeText={setSellingPrice}
                          placeholder="0.00"
                          placeholderTextColor={colors.text.secondary}
                          keyboardType="decimal-pad"
                          autoFocus={true}
                          returnKeyType="done"
                          clearTextOnFocus={true}
                        />
                        <Text style={[styles.currencyText, { color: colors.text.primary }]}>€</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={[
                        styles.sellButton, 
                        { 
                          backgroundColor: isPriceValid() ? colors.secondary : colors.text.secondary,
                          opacity: isPriceValid() ? 1 : 0.7 
                        }
                      ]}
                      onPress={handleSubmitSellOrder}
                      disabled={!isPriceValid()}
                    >
                      <Text style={styles.sellButtonText}>{t('card.sell')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardsGrid: {
    width: '100%',
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
  filterButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sellContent: {
    paddingHorizontal: 20,
  },
  cardSellName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  priceColumn: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sellingPriceContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  sellingPriceLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    width: '50%',
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 20,
    textAlign: 'center',
  },
  currencyText: {
    fontSize: 20,
    fontWeight: '500',
  },
  sellButton: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  sellButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  alreadyForSaleContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  alreadyForSaleText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  currentPriceText: {
    fontSize: 14,
    marginBottom: 10,
  },
  sellButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  cancelButton: {
    padding: 10,
    borderWidth: 2,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: 'bold',
  },
  updateButton: {
    padding: 10,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  conditionContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  conditionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  conditionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
  },
  conditionButton: {
    padding: 10,
    borderWidth: 2,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    alignItems: 'center',
  },
}); 