import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, SafeAreaView, Linking, Modal, TextInput } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase, getOfficialCardDetails, getMarketPricesForCard, getCardsForSale, addOrRemoveFromWishlist, createOffer, createOfferNotification } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useThemeColors } from '../../lib/ThemeUtils';

interface OfficialCard {
  id: string;
  name: string;
  image_small: string;
  image_large: string;
  number: string;
  rarity: string;
  market_price_low?: number | null;
  market_price_mid?: number | null;
  market_price_high?: number | null;
}

interface CardForSale {
  id: string;
  user_id: string;
  card_id: string;
  condition: string;
  price: number;
  is_for_sale: boolean;
  created_at: string;
  image_url?: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Good', 'Played'];

// Définir les couleurs pour les différentes conditions des cartes
const CONDITION_COLORS: { [key: string]: string } = {
  'Mint': '#FFFFFF',        // Blanc pour Mint
  'Near Mint': '#4CAF50',   // Vert pour Near Mint
  'Excellent': '#2196F3',   // Bleu pour Excellent
  'Good': '#FFC107',        // Jaune pour Good
  'Played': '#FF5722'       // Orange pour Played
};

export default function CardMarketplace() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [officialCard, setOfficialCard] = useState<OfficialCard | null>(null);
  const [cardsForSale, setCardsForSale] = useState<CardForSale[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [inWishlist, setInWishlist] = useState<boolean>(false);
  const [showBidModal, setShowBidModal] = useState(false);
  const [selectedCardForSale, setSelectedCardForSale] = useState<CardForSale | null>(null);
  const [bidPrice, setBidPrice] = useState<string>('');
  const [userOffers, setUserOffers] = useState<{ [userCardId: string]: number }>({});
  
  useEffect(() => {
    if (!id) return;
    
    loadCardDetails();
    checkWishlist();
    loadUserOffers();
  }, [id]);
  
  const loadCardDetails = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // 1. Récupérer les détails de la carte officielle
      const { data: cardData, error: cardError } = await getOfficialCardDetails(id as string);
      
      if (cardError) throw cardError;
      
      // 2. Récupérer les prix du marché pour cette carte
      const { data: priceData, error: priceError } = await getMarketPricesForCard(id as string);
      
      if (priceError) throw priceError;
      
      // 3. Récupérer toutes les cartes en vente pour cette carte officielle
      const { data: salesData, error: salesError } = await getCardsForSale(id as string);
      
      if (salesError) throw salesError;
      
      console.log("CardMarketplace - cartes en vente reçues:", salesData?.length);
      // Afficher les données des vendeurs pour les 3 premières cartes si disponibles
      if (salesData && salesData.length > 0) {
        console.log("CardMarketplace - Première carte en vente:", 
                   `id=${salesData[0].id}, user_id=${salesData[0].user_id}, 
                    username=${salesData[0].user?.username || 'undefined'}, 
                    avatar=${salesData[0].user?.avatar_url ? 'présent' : 'absent'}`);
        
        if (salesData.length > 1) {
          console.log("CardMarketplace - Deuxième carte en vente:", 
                     `id=${salesData[1].id}, user_id=${salesData[1].user_id}, 
                      username=${salesData[1].user?.username || 'undefined'}, 
                      avatar=${salesData[1].user?.avatar_url ? 'présent' : 'absent'}`);
        }
      }
      
      if (cardData) {
        // Combiner les informations
        setOfficialCard({
          ...cardData,
          market_price_low: priceData?.price_low || null,
          market_price_mid: priceData?.price_mid || null,
          market_price_high: priceData?.price_high || null
        });
      }
      
      if (salesData) {
        setCardsForSale(salesData);
      } else {
        setCardsForSale([]);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données du marché:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const checkWishlist = async () => {
    if (!id || !user) {
      setInWishlist(false);
      return;
    }
    const { data, error } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .eq('card_id', id)
      .single();
    setInWishlist(typeof data === 'object' && !error ? true : false);
  };
  
  const handleWishlistToggle = async () => {
    if (!user || !id) return;
    const res = await addOrRemoveFromWishlist(user.id, id as string);
    if (!res.error) {
      setInWishlist(res.added === true);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadCardDetails();
  };
  
  const handleConditionFilter = (condition: string | null) => {
    setSelectedCondition(selectedCondition === condition ? null : condition);
  };
  
  const filteredCards = selectedCondition 
    ? cardsForSale.filter(card => card.condition === selectedCondition)
    : cardsForSale;
    
  // Rediriger vers gamezest.ch si aucune carte n'est en vente
  const handleBuyFromExternalShop = () => {
    const cardName = officialCard?.name || '';
    const url = `https://www.gamezest.ch/search?type=product&options%5Bprefix%5D=last&q=${encodeURIComponent(cardName)}`;
    Linking.openURL(url);
  };
    
  // Demander à acheter une carte
  const handleBuyRequest = (cardForSale: CardForSale) => {
    if (!user) return;
    
    // Rediriger vers l'écran de paiement/contact
    router.push(`/screens/market-prices/buy-request?cardId=${cardForSale.id}&sellerId=${cardForSale.user_id}&price=${cardForSale.price}`);
  };
  
  const handleBidPress = (cardForSale: CardForSale) => {
    setSelectedCardForSale(cardForSale);
    setBidPrice(cardForSale.price.toFixed(2));
    setShowBidModal(true);
  };
  
  // Charger les offres existantes de l'utilisateur pour cette carte
  const loadUserOffers = async () => {
    if (!user || !id) return;
    const { data, error } = await supabase
      .from('offers')
      .select('user_card_id, proposed_price')
      .eq('buyer_id', user.id)
      .in('user_card_id', cardsForSale.map(c => c.id));
    if (!error && data) {
      const offersMap: { [userCardId: string]: number } = {};
      data.forEach((offer: any) => {
        offersMap[offer.user_card_id] = offer.proposed_price;
      });
      setUserOffers(offersMap);
    }
  };
  
  // Charger les offres utilisateur à chaque chargement de cartes en vente
  useEffect(() => {
    if (cardsForSale.length > 0) {
      loadUserOffers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsForSale, user]);
  
  // Envoi de l'offre
  const handleSendBid = async () => {
    if (!user || !selectedCardForSale || !bidPrice) return;
    const price = parseFloat(bidPrice);
    if (isNaN(price) || price <= 0) return;
    // Enregistrer l'offre
    const { data, error } = await createOffer({
      buyer_id: user.id,
      seller_id: selectedCardForSale.user_id,
      user_card_id: selectedCardForSale.id,
      proposed_price: price,
    });
    if (!error && data) {
      // Créer la notification pour le vendeur
      await createOfferNotification({
        seller_id: selectedCardForSale.user_id,
        card_id: selectedCardForSale.card_id,
        user_card_id: selectedCardForSale.id,
        card_name: officialCard?.name || '',
        type: 'OfferAccepted',
      });
      // Mettre à jour l'état local pour afficher le bouton "Offre : XX.XX"
      setUserOffers(prev => ({ ...prev, [selectedCardForSale.id]: price }));
      setShowBidModal(false);
    }
  };
  
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{ 
            title: t('market.buyCard'),
            headerShown: true
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            {t('general.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  if (!officialCard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{ 
            title: t('market.buyCard'),
            headerShown: true
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text.primary }]}>
            {t('card.notFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: officialCard.name,
          headerShown: true
        }}
      />
      
      {/* Bouton wishlist si la carte n'est pas possédée */}
      {!cardsForSale.some(card => card.user_id === user?.id) && (
        <TouchableOpacity
          style={[styles.wishlistButton, { borderColor: inWishlist ? colors.primary : colors.text.secondary, backgroundColor: inWishlist ? colors.primary : 'transparent' }]}
          onPress={handleWishlistToggle}
        >
          <Ionicons name={inWishlist ? 'star' : 'star-outline'} size={22} color={inWishlist ? '#FFD700' : colors.text.secondary} />
          <Text style={[styles.wishlistButtonText, { color: inWishlist ? 'white' : colors.primary }]}> 
            {inWishlist ? t('wishlist.removeCard') : t('wishlist.addCard')}
          </Text>
        </TouchableOpacity>
      )}
      
      <FlatList
        data={filteredCards}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={() => (
          <View style={styles.headerContainer}>
            {/* Informations sur la carte */}
            <View style={[styles.cardInfoContainer, { backgroundColor: colors.surface }]}>
              <Image 
                source={{ uri: officialCard.image_small }} 
                style={styles.cardThumbnail} 
                resizeMode="contain"
              />
              
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.text.primary }]}>
                  {officialCard.name}
                </Text>
                <Text style={[styles.cardNumber, { color: colors.text.secondary }]}>
                  #{officialCard.number}
                </Text>
                <Text style={[styles.cardRarity, { color: colors.text.secondary }]}>
                  {officialCard.rarity}
                </Text>
              </View>
            </View>
            
            {/* Prix du marché */}
            <View style={[styles.marketPriceContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                {t('card.prices')}
              </Text>
              
              <View style={styles.priceRow}>
                <View style={styles.priceColumn}>
                  <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                    {t('card.lowPrice')}
                  </Text>
                  <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                    {officialCard.market_price_low?.toFixed(2) || '-'} €
                  </Text>
                </View>
                
                <View style={[styles.priceColumn, styles.midPriceColumn]}>
                  <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                    {t('card.midPrice')}
                  </Text>
                  <Text style={[styles.priceValue, styles.midPriceValue, { color: 'white' }]}>
                    {officialCard.market_price_mid?.toFixed(2) || '-'} €
                  </Text>
                </View>
                
                <View style={styles.priceColumn}>
                  <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                    {t('card.highPrice')}
                  </Text>
                  <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                    {officialCard.market_price_high?.toFixed(2) || '-'} €
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Filtres de condition */}
            <View style={[styles.conditionFiltersContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.filterTitle, { color: colors.text.primary }]}>
                {t('card.condition')} - {t('settings.filter')}:
              </Text>
              
              <View style={styles.conditionButtons}>
                <TouchableOpacity
                  style={[
                    styles.conditionButton,
                    selectedCondition === null && { 
                      backgroundColor: colors.primary + '30',
                      borderColor: colors.primary 
                    },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => handleConditionFilter(null)}
                >
                  <Text 
                    style={[
                      styles.conditionButtonText, 
                      { color: selectedCondition === null ? colors.primary : colors.text.secondary }
                    ]}
                  >
                    {t('general.all', 'Tous')}
                  </Text>
                </TouchableOpacity>
                {CONDITIONS.map(condition => (
                  <TouchableOpacity
                    key={condition}
                    style={[
                      styles.conditionButton,
                      selectedCondition === condition && { 
                        backgroundColor: CONDITION_COLORS[condition] + '30',
                        borderColor: CONDITION_COLORS[condition] 
                      },
                      { borderColor: selectedCondition === condition ? CONDITION_COLORS[condition] : colors.border }
                    ]}
                    onPress={() => handleConditionFilter(condition)}
                  >
                    <Text 
                      style={[
                        styles.conditionButtonText, 
                        { color: selectedCondition === condition ? CONDITION_COLORS[condition] : colors.text.secondary }
                      ]}
                    >
                      {condition}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Titre de la section cartes en vente */}
            <View style={styles.salesHeaderContainer}>
              <Text style={[styles.salesTitle, { color: colors.text.primary }]}>
                {t('market.cardsForSale')} ({filteredCards.length})
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color={colors.text.secondary} />
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              {t('market.noCardsForSale')}
            </Text>
            <TouchableOpacity 
              style={[styles.externalShopButton, { backgroundColor: colors.primary }]}
              onPress={handleBuyFromExternalShop}
            >
              <Text style={styles.externalShopButtonText}>
                {t('market.buyOnGamezest')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.cardForSaleItem, { backgroundColor: colors.surface }]}>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerProfile}>
                {item.user?.avatar_url ? (
                  <Image 
                    source={{ uri: item.user.avatar_url }} 
                    style={styles.sellerAvatar} 
                  />
                ) : (
                  <View style={[styles.sellerAvatarPlaceholder, { backgroundColor: colors.border }]}>
                    <Text style={[styles.sellerInitials, { color: colors.text.secondary }]}>
                      {item.user?.username ? item.user.username.slice(0, 1).toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
                
                <Text style={[styles.sellerName, { color: colors.text.secondary }]}>
                  {item.user?.username || t('market.unknownSeller')}
                </Text>
              </View>
              
              <View style={[
                styles.conditionBadge, 
                { 
                  backgroundColor: CONDITION_COLORS[item.condition] ? CONDITION_COLORS[item.condition] + '20' : colors.primary + '20',
                  borderColor: CONDITION_COLORS[item.condition] || colors.primary
                }
              ]}>
                <Text style={[
                  styles.conditionText, 
                  { color: CONDITION_COLORS[item.condition] || colors.primary }
                ]}>
                  {item.condition}
                </Text>
              </View>
            </View>
            
            <View style={styles.cardImageContainer}>
              {item.image_url ? (
                <>
                  <Image 
                    source={{ uri: item.image_url }} 
                    style={styles.cardImage} 
                    resizeMode="contain"
                  />
                  {/* Badge pour indiquer que c'est la vraie photo */}
                  <View style={[
                    styles.imageBadge, 
                    { backgroundColor: colors.success }
                  ]}>
                    <Ionicons 
                      name="camera" 
                      size={12} 
                      color="white" 
                    />
                    <Text style={styles.imageBadgeText}>
                      {t('card.realPhoto')}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.border }]}>
                  <Ionicons 
                    name="help-outline" 
                    size={60} 
                    color={colors.text.secondary} 
                  />
                  <Text style={[styles.placeholderText, { color: colors.text.secondary }]}>
                    {t('card.noUserPhoto')}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.buySection}>
              <Text style={[styles.priceTag, { color: colors.text.primary }]}>
                {item.price.toFixed(2)} €
              </Text>
              {userOffers[item.id] ? (
                <View style={[styles.buyButton, { backgroundColor: colors.primary, opacity: 0.7 }]}> 
                  <Text style={styles.buyButtonText}>
                    {t('card.bid', 'Offre')} : {userOffers[item.id].toFixed(2)} €
                  </Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.buyButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleBidPress(item)}
                >
                  <Text style={styles.buyButtonText}>
                    {t('card.bid', 'Offre')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
      {/* Modale pour faire une offre */}
      <Modal
        visible={showBidModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBidModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#00000099', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '85%' }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 18, color: colors.text.primary, textAlign: 'center' }}>
              {t('market.makeAnOffer', 'Faire une offre')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{t('card.lowPrice')}</Text>
                <Text style={{ color: colors.text.primary, fontWeight: 'bold', fontSize: 16 }}>
                  {officialCard?.market_price_low?.toFixed(2) || '-'} €
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{t('card.sellerPrice', 'Prix demandé')}</Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 22 }}>
                  {selectedCardForSale?.price.toFixed(2)} €
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: colors.text.secondary, fontSize: 13 }}>{t('card.highPrice')}</Text>
                <Text style={{ color: colors.text.primary, fontWeight: 'bold', fontSize: 16 }}>
                  {officialCard?.market_price_high?.toFixed(2) || '-'} €
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.text.primary, marginBottom: 6 }}>{t('market.yourOffer', 'Votre offre')}</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                fontSize: 18,
                color: colors.text.primary,
                marginBottom: 18,
              }}
              keyboardType="decimal-pad"
              value={bidPrice}
              onChangeText={setBidPrice}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{ marginRight: 16 }}
                onPress={() => setShowBidModal(false)}
              >
                <Text style={{ color: colors.text.secondary, fontSize: 16 }}>{t('general.cancel', 'Annuler')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 }}
                onPress={handleSendBid}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{t('market.sendOffer', 'Envoyer')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  listContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  headerContainer: {
    marginBottom: 16,
  },
  cardInfoContainer: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardThumbnail: {
    width: 60,
    height: 85,
    borderRadius: 6,
  },
  cardInfo: {
    marginLeft: 16,
    flex: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardNumber: {
    fontSize: 14,
    marginTop: 2,
  },
  cardRarity: {
    fontSize: 14,
    marginTop: 2,
  },
  marketPriceContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceColumn: {
    alignItems: 'center',
    flex: 0.8,
  },
  priceLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  midPriceColumn: {
    flex: 1.2,
    marginHorizontal: 8,
    paddingBottom: 4,
  },
  midPriceValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  conditionFiltersContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  conditionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  conditionButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  conditionButtonText: {
    fontSize: 14,
  },
  salesHeaderContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  salesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  cardForSaleItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sellerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sellerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  sellerAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitials: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sellerName: {
    marginLeft: 8,
    fontSize: 14,
  },
  conditionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  conditionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cardImage: {
    width: 220,
    height: 300,
    borderRadius: 8,
  },
  cardImagePlaceholder: {
    width: 220,
    height: 300,
    borderRadius: 8,
  },
  buySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceTag: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  buyButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  buyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  externalShopButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  externalShopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  wishlistButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  imageBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 4,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
}); 