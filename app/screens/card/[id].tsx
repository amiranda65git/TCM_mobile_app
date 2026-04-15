import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions, Alert, Modal, TextInput, Animated, PanResponder } from 'react-native';
import { CardImageSlider } from '../../components/CardImageSlider';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/ThemeContext';
import { useThemeColors } from '../../lib/ThemeUtils';
import { supabase, getUserWishlist, addOrRemoveFromWishlist } from '../../lib/supabase';

interface CardPrice {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  lastUpdated: string | null;
}

type UserCardRow = {
  id: string;
  condition: string | null;
  price: number | null;
  is_for_sale: boolean;
  image_url: string | null;
  created_at: string;
};

interface CardDetails {
  id: string;
  name: string;
  number: string;
  rarity: string;
  image_small: string;
  image_large: string;
  edition_id: string;
  edition_name: string;
  prices: CardPrice;
  owned: boolean;
  user_card_id?: string;
  condition?: string;
  price?: number | null;
  is_for_sale: boolean;
  has_price_alert?: boolean;
  /** Photo utilisateur (R2) si enregistrée sur user_cards */
  user_photo_url?: string | null;
}

export default function CardDetailScreen() {
  const { id: rawCardId, userCardId: rawUserCardId } = useLocalSearchParams<{
    id?: string | string[];
    userCardId?: string | string[];
  }>();
  const cardId = rawCardId ? (Array.isArray(rawCardId) ? rawCardId[0] : rawCardId) : undefined;
  const userCardIdParam =
    rawUserCardId !== undefined
      ? Array.isArray(rawUserCardId)
        ? rawUserCardId[0]
        : rawUserCardId
      : undefined;
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const windowWidth = Dimensions.get('window').width;
  
  const [loading, setLoading] = useState(true);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [inWishlist, setInWishlist] = useState<boolean>(false);
  
  // États pour le modal de vente
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellingPrice, setSellingPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const sliderKnobSize = 44;
  const sliderX = useRef(new Animated.Value(0)).current;
  const sliderCurrentXRef = useRef(0);

  // Les conditions disponibles pour les cartes avec leurs couleurs
  const CONDITION_COLORS = {
    'Near Mint': '#4CAF50',
    'Excellent': '#2196F3',
    'Good': '#FF9800',
    'Played': '#F44336'
  };
  
  const CONDITIONS = Object.keys(CONDITION_COLORS);
  
  useEffect(() => {
    if (cardId && user) {
      loadCardDetails();
      checkWishlist();
    }
  }, [cardId, user, userCardIdParam]);
  
  const loadCardDetails = async () => {
    if (!cardId || !user) return;
    
    setLoading(true);
    try {
      // 1. Récupérer les détails de la carte officielle
      const { data: cardData, error: cardError } = await supabase
        .from('official_cards')
        .select(`
          id, 
          name, 
          number, 
          rarity, 
          image_small, 
          image_large,
          edition_id,
          editions(name)
        `)
        .eq('id', cardId)
        .single();
      
      if (cardError) throw cardError;
      
      // 2. Vérifier si l'utilisateur possède cette carte (plusieurs lignes possibles : ex. une en vente sans photo, une autre avec photo R2)
      const { data: userCardData, error: userCardError } = await supabase
        .from('user_cards')
        .select('id, condition, price, is_for_sale, image_url, created_at')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .eq('is_sold', false);

      if (userCardError) throw userCardError;

      const userRows = (userCardData ?? []) as UserCardRow[];
      const sortedByDate = [...userRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      let primaryUserCard: UserCardRow | null = null;

      if (userCardIdParam) {
        primaryUserCard = userRows.find((r) => r.id === userCardIdParam) ?? null;
        if (!primaryUserCard) {
          const { data: single } = await supabase
            .from('user_cards')
            .select('id, condition, price, is_for_sale, image_url, created_at, card_id')
            .eq('id', userCardIdParam)
            .eq('user_id', user.id)
            .eq('is_sold', false)
            .maybeSingle();
          if (single && (single as { card_id: string }).card_id === cardId) {
            primaryUserCard = single as UserCardRow;
          }
        }
      }
      if (!primaryUserCard && userRows.length > 0) {
        primaryUserCard = sortedByDate[0];
      }

      const userPhotoUrl = primaryUserCard?.image_url ?? null;

      // 3. Récupérer les prix du marché actuels
      const { data: marketPriceData, error: marketPriceError } = await supabase
        .from('market_prices')
        .select('price_low, price_mid, price_high, price_market, updated_at')
        .eq('card_id', cardId)
        .order('date', { ascending: false })
        .limit(1);
      
      // 4. Vérifier si l'utilisateur a mis une alerte de prix sur cette carte
      const { data: priceAlertData, error: priceAlertError } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId);
      
      if (priceAlertError) throw priceAlertError;
      
      // Utiliser les prix du marché réels si disponibles, sinon générer des valeurs fictives
      let priceData: CardPrice;
      
      if (!marketPriceError && marketPriceData && marketPriceData.length > 0) {
        const latestPrice = marketPriceData[0];
        priceData = {
          low: parseFloat(latestPrice.price_low) || null,
          mid: parseFloat(latestPrice.price_mid) || null,
          high: parseFloat(latestPrice.price_high) || null,
          market: parseFloat(latestPrice.price_market) || null,
          lastUpdated: latestPrice.updated_at
        };
      } else {
        // Valeurs fictives si aucun prix n'est disponible
        priceData = {
          low: Math.random() * 50,
          mid: Math.random() * 100 + 50,
          high: Math.random() * 150 + 100,
          market: Math.random() * 100 + 75,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Assembler les données
      const cardDetails: CardDetails = {
        id: cardData.id,
        name: cardData.name,
        number: cardData.number,
        rarity: cardData.rarity,
        image_small: cardData.image_small,
        image_large: cardData.image_large,
        edition_id: cardData.edition_id,
        edition_name: Array.isArray(cardData.editions) ? cardData.editions[0]?.name || 'Unknown' : (cardData.editions as any).name || 'Unknown',
        prices: priceData,
        owned: userRows.length > 0,
        user_card_id: primaryUserCard?.id,
        condition: primaryUserCard?.condition ?? undefined,
        price: primaryUserCard?.price ?? null,
        is_for_sale: primaryUserCard?.is_for_sale ?? false,
        has_price_alert: priceAlertData && priceAlertData.length > 0,
        user_photo_url: userPhotoUrl,
      };
      
      setCardDetails(cardDetails);
    } catch (error) {
      console.error("Erreur lors du chargement des détails de la carte:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const checkWishlist = async () => {
    if (!user || !cardId) return;
    const { data: wishlist } = await getUserWishlist(user.id);
    setInWishlist((wishlist as string[]).includes(cardId));
  };
  
  // Formatter les prix
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `${price.toFixed(2)} €`;
  };

  // Action lorsqu'on clique sur Acheter
  const handleBuy = () => {
    if (!cardDetails) return;
    
    // Rediriger vers la page de marketplace pour cette carte
    router.push(`/screens/market-prices/card-marketplace?id=${cardDetails.id}`);
  };
  
  // Action lorsqu'on clique sur Ajouter à la wishlist
  const handleWishlist = async () => {
    if (!user || !cardDetails) return;
    await addOrRemoveFromWishlist(user.id, cardDetails.id);
    checkWishlist();
  };
  
  // Action lorsqu'on clique sur Vendre
  const handleSell = async () => {
    if (!cardDetails?.user_card_id) return;
    
    if (cardDetails.is_for_sale) {
      // Si la carte est déjà en vente, la retirer de la vente
      try {
        setLoading(true);
        
        const { error } = await supabase
          .from('user_cards')
          .update({ is_for_sale: false })
          .eq('id', cardDetails.user_card_id);
        
        if (error) throw error;
        
        // Mettre à jour l'état local
        setCardDetails({
          ...cardDetails,
          is_for_sale: false,
        });

        console.log('Carte retirée de la vente', cardDetails?.id);
      } catch (error) {
        console.error("Erreur lors du retrait de la vente:", error);
      } finally {
        setLoading(false);
      }
    } else {
      // Ouvrir le modal pour mettre en vente
      setSelectedCondition(cardDetails.condition || 'Near Mint');
      
      // Pré-remplir avec le prix du marché ou le prix actuel
      let initialPrice = '';
      if (cardDetails.prices.mid) {
        initialPrice = cardDetails.prices.mid.toString();
      } else if (cardDetails.price) {
        initialPrice = cardDetails.price.toString();
      }
      
      setSellingPrice(initialPrice);
      setShowSellModal(true);
    }
  };
  
  // Confirmer la vente
  const handleConfirmSell = async () => {
    if (!cardDetails?.user_card_id) return;
    
    try {
      setLoading(true);
      
      const price = parseFloat(sellingPrice);
      
      if (isNaN(price) || price <= 0) {
        Alert.alert(t('general.error'), t('sell.invalidPrice'));
        return;
      }
      
      const { error } = await supabase
        .from('user_cards')
        .update({ 
          is_for_sale: true,
          price: price,
          condition: selectedCondition
        })
        .eq('id', cardDetails.user_card_id);
      
      if (error) throw error;
      
      // Mettre à jour l'état local
      setCardDetails({
        ...cardDetails,
        is_for_sale: true,
        price: price,
        condition: selectedCondition,
      });

      setShowSellModal(false);
      console.log('Carte mise en vente', cardDetails?.id);
    } catch (error) {
      console.error("Erreur lors de la mise en vente de la carte:", error);
      Alert.alert(t('general.error'), t('sell.error'));
    } finally {
      setLoading(false);
    }
  };

  // Vérifier si le prix est valide
  const isPriceValid = () => {
    const price = parseFloat(sellingPrice);
    return !isNaN(price) && price > 0;
  };

  const resetDeleteSlider = () => {
    sliderCurrentXRef.current = 0;
    sliderX.setValue(0);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    resetDeleteSlider();
  };

  const handleOpenDeleteModal = () => {
    if (!cardDetails?.owned || !cardDetails.user_card_id) return;
    resetDeleteSlider();
    setShowDeleteModal(true);
  };

  const handleDeleteCard = async () => {
    if (!cardDetails?.user_card_id || !user?.id || isDeletingCard) return;

    try {
      setIsDeletingCard(true);
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('id', cardDetails.user_card_id)
        .eq('user_id', user.id);

      if (error) throw error;

      closeDeleteModal();
      router.back();
    } catch (error) {
      console.error('Erreur lors de la suppression de la carte:', error);
      Alert.alert(t('general.error'), t('card.deleteError', 'Erreur lors de la suppression de la carte'));
    } finally {
      setIsDeletingCard(false);
    }
  };

  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isDeletingCard,
      onMoveShouldSetPanResponder: () => !isDeletingCard,
      onPanResponderGrant: () => {
        sliderX.stopAnimation((value) => {
          sliderCurrentXRef.current = value;
        });
      },
      onPanResponderMove: (_evt, gestureState) => {
        const maxX = Math.max(0, sliderTrackWidth - sliderKnobSize);
        const nextX = Math.min(maxX, Math.max(0, sliderCurrentXRef.current + gestureState.dx));
        sliderX.setValue(nextX);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const maxX = Math.max(0, sliderTrackWidth - sliderKnobSize);
        const releaseX = Math.min(maxX, Math.max(0, sliderCurrentXRef.current + gestureState.dx));
        const reachedEnd = maxX > 0 && releaseX >= maxX * 0.9;

        if (reachedEnd) {
          Animated.timing(sliderX, {
            toValue: maxX,
            duration: 100,
            useNativeDriver: false,
          }).start(() => {
            sliderCurrentXRef.current = maxX;
            handleDeleteCard();
          });
          return;
        }

        Animated.spring(sliderX, {
          toValue: 0,
          useNativeDriver: false,
        }).start(() => {
          sliderCurrentXRef.current = 0;
        });
      },
    })
  ).current;
  
  // Action lorsqu'on clique sur Définir une alerte de prix
  const handlePriceAlert = async () => {
    if (!cardDetails || !user) return;
    
    try {
      setLoading(true);
      
      // Vérifier si une alerte existe déjà pour cette carte
      const { data: existingAlert, error: checkError } = await supabase
        .from('price_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardDetails.id)
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
          .eq('card_id', cardDetails.id);
        
        if (deleteError) throw deleteError;
        
        console.log('Alerte de prix supprimée');
      } else {
        // Sinon, ajouter une nouvelle alerte
        const { error: insertError } = await supabase
          .from('price_alerts')
          .insert([
            { user_id: user.id, card_id: cardDetails.id }
          ]);
        
        if (insertError) throw insertError;
        
        console.log('Alerte de prix ajoutée');
      }
      
      // Rafraîchir les données
      loadCardDetails();
      
    } catch (error) {
      console.error('Erreur lors de la gestion de l\'alerte de prix:', error);
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
  
  if (!cardDetails) {
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
            {t('card.notFound')}
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
      
      {/* En-tête personnalisé */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          {cardDetails.name}
        </Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte : pastilles sur l’illustration ; photo R2 = fondu (pas rotateY 3D) */}
        <View style={styles.cardSection}>
          <View
            style={[
              styles.cardStack,
              { width: windowWidth * 0.8, height: windowWidth * 1.1 },
            ]}
          >
            <View style={styles.cardImageContainer}>
              {cardDetails.user_photo_url ? (
                <CardImageSlider
                  width={windowWidth * 0.8}
                  height={windowWidth * 1.1}
                  officialUri={cardDetails.image_large || cardDetails.image_small}
                  userPhotoUri={cardDetails.user_photo_url}
                />
              ) : (
                <Image
                  source={{
                    uri: cardDetails.image_large || cardDetails.image_small,
                  }}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              )}
            </View>
            {cardDetails.owned && (
              <View style={[styles.ownedBadge, { backgroundColor: colors.success }]}>
                <MaterialIcons name="catching-pokemon" size={16} color="white" />
                <Text style={styles.ownedBadgeText}>{t('card.owned')}</Text>
              </View>
            )}
            {cardDetails.owned && cardDetails.is_for_sale && (
              <View style={[styles.forSaleBadge, { backgroundColor: '#e74c3c' }]}>
                <Ionicons name="cash-outline" size={16} color="white" />
                <Text style={styles.ownedBadgeText}>{t('card.forSale')}</Text>
              </View>
            )}
          </View>
          {cardDetails.user_photo_url ? (
            <Text style={[styles.flipPhotoHint, { color: colors.text.secondary }]}>
              {t('card.flipPhotoHint')}
            </Text>
          ) : null}
          
          {/* Détails de la carte */}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text.primary }]}>
              {cardDetails.name}
            </Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                {t('scan.numberLabel')}:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {cardDetails.number}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                {t('card.rarity')}:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {cardDetails.rarity || t('general.common')}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                {t('card.edition')}:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                {cardDetails.edition_name}
              </Text>
            </View>
            
            {cardDetails.owned && cardDetails.condition && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.text.secondary }]}>
                  {t('card.condition')}:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text.primary }]}>
                  {cardDetails.condition}
                </Text>
              </View>
            )}
            
            {/* Badges */}
            <View style={styles.badgesContainer}>
              {cardDetails.is_for_sale && (
                <Text style={[styles.badge, { color: colors.secondary, borderColor: colors.secondary }]}>
                  <Ionicons name="pricetag" size={12} color={colors.secondary} /> {t('card.forSale')}
                </Text>
              )}
              {cardDetails.has_price_alert && (
                <Text style={[styles.badge, { color: '#3498db', borderColor: '#3498db', marginLeft: cardDetails.is_for_sale ? 8 : 0 }]}>
                  <Ionicons name="notifications" size={12} color="#3498db" /> {t('card.alert')}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        {/* Section des prix */}
        <View style={[styles.priceSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {t('card.prices')}
          </Text>
          
          <View style={styles.pricesGrid}>
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                {t('card.lowPrice')}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                {formatPrice(cardDetails.prices.low)}
              </Text>
            </View>
            
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                {t('card.midPrice')}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                {formatPrice(cardDetails.prices.mid)}
              </Text>
            </View>
            
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                {t('card.highPrice')}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                {formatPrice(cardDetails.prices.high)}
              </Text>
            </View>
            
            <View style={styles.priceItem}>
              <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                {t('card.marketPrice')}
              </Text>
              <Text style={[styles.priceValue, { color: colors.secondary, fontWeight: 'bold' }]}>
                {formatPrice(cardDetails.prices.market)}
              </Text>
            </View>
          </View>
          
          {/* Date de mise à jour des prix */}
          {cardDetails.prices.lastUpdated && (
            <Text style={[styles.priceUpdateInfo, { color: colors.text.secondary }]}>
              {t('card.lastUpdated')}: {new Date(cardDetails.prices.lastUpdated).toLocaleDateString()}
            </Text>
          )}
          
          {/* Bouton pour voir l'historique des prix */}
          <TouchableOpacity 
            style={[styles.viewHistoryButton, { borderColor: colors.border }]}
            onPress={() => router.push(`/screens/market-prices/${cardDetails.id}`)}
          >
            <Ionicons name="trending-up-outline" size={18} color={colors.secondary} />
            <Text style={[styles.viewHistoryButtonText, { color: colors.secondary }]}>
              {t('card.viewPriceHistory')}
            </Text>
          </TouchableOpacity>
          
          {/* Valeur de ma carte si possédée */}
          {cardDetails.owned && (
            <View style={styles.myCardValue}>
              <Text style={[styles.myCardValueLabel, { color: colors.text.secondary }]}>
                {t('card.myCardValue')}:
              </Text>
              <Text style={[styles.myCardValueAmount, { color: colors.secondary }]}>
                {formatPrice(cardDetails.price || cardDetails.prices.market)}
              </Text>
            </View>
          )}
        </View>
        
        {/* Boutons d'action */}
        <View style={styles.actionButtons}>
          {cardDetails.owned ? (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: cardDetails.is_for_sale ? '#27ae60' : '#e74c3c' }]}
                onPress={handleSell}
              >
                <Ionicons name={cardDetails.is_for_sale ? "close-circle-outline" : "cash-outline"} size={24} color="white" />
                <Text style={styles.actionButtonText}>
                  {cardDetails.is_for_sale ? t('card.removeFromSale') : t('card.sell')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: cardDetails.has_price_alert ? '#2980b9' : '#3498db' }]}
                onPress={handlePriceAlert}
              >
                <Ionicons name={cardDetails.has_price_alert ? "notifications" : "notifications-outline"} size={24} color="white" />
                <Text style={styles.actionButtonText}>
                  {cardDetails.has_price_alert ? t('card.removePriceAlert') : t('card.priceAlert')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#2ecc71' }]}
                onPress={handleBuy}
              >
                <Ionicons name="cart-outline" size={24} color="white" />
                <Text style={styles.actionButtonText}>{t('card.buy')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#f1c40f' }]}
                onPress={handleWishlist}
              >
                <Ionicons name={inWishlist ? "star" : "star-outline"} size={24} color="white" />
                <Text style={styles.actionButtonText}>
                  {inWishlist ? t('wishlist.removeCard') : t('card.addToWishlist')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {cardDetails.owned && cardDetails.user_card_id ? (
          <TouchableOpacity
            style={[styles.deleteCardButton, { borderColor: colors.error }]}
            onPress={handleOpenDeleteModal}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.deleteCardButtonText, { color: colors.error }]}>
              {t('card.removeFromCollection', 'Supprimer')}
            </Text>
          </TouchableOpacity>
        ) : null}
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {t('card.sellCard')}
              </Text>
              <TouchableOpacity onPress={() => setShowSellModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            {cardDetails && (
              <View style={styles.sellContent}>
                <Text style={[styles.cardSellName, { color: colors.text.primary }]}>
                  {cardDetails.name}
                </Text>
                
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceColumn}>
                    <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                      {t('card.lowPrice')}
                    </Text>
                    <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                      {formatPrice(cardDetails.prices.low)}
                    </Text>
                  </View>
                  
                  <View style={styles.priceColumn}>
                    <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                      {t('card.highPrice')}
                    </Text>
                    <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                      {formatPrice(cardDetails.prices.high)}
                    </Text>
                  </View>
                </View>
                
                {/* Sélecteur de condition */}
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
                            backgroundColor: (CONDITION_COLORS as any)[condition] + '30',
                            borderColor: (CONDITION_COLORS as any)[condition] 
                          },
                          { borderColor: colors.border }
                        ]}
                        onPress={() => setSelectedCondition(condition)}
                      >
                        <Text 
                          style={[
                            styles.conditionButtonText, 
                            { color: selectedCondition === condition ? (CONDITION_COLORS as any)[condition] : colors.text.secondary }
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
                  onPress={handleConfirmSell}
                  disabled={!isPriceValid()}
                >
                  <Text style={styles.sellButtonText}>{t('card.sell')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {t('card.removeFromCollection', 'Supprimer')}
              </Text>
              <TouchableOpacity onPress={closeDeleteModal} disabled={isDeletingCard}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.deleteModalText, { color: colors.text.secondary }]}>
              {t(
                'card.deleteConfirm',
                'Faites glisser le bouton pour confirmer la suppression de cette carte.'
              )}
            </Text>

            <View
              style={[styles.deleteSliderTrack, { backgroundColor: colors.background, borderColor: colors.border }]}
              onLayout={(event) => {
                setSliderTrackWidth(event.nativeEvent.layout.width);
                resetDeleteSlider();
              }}
            >
              <Text style={[styles.deleteSliderHint, { color: colors.text.secondary }]}>
                {t('card.slideToDelete', 'Glisser pour supprimer')}
              </Text>

              <Animated.View
                style={[
                  styles.deleteSliderKnob,
                  {
                    backgroundColor: colors.error,
                    transform: [{ translateX: sliderX }],
                    opacity: isDeletingCard ? 0.8 : 1,
                  },
                ]}
                {...sliderPanResponder.panHandlers}
              >
                {isDeletingCard ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                )}
              </Animated.View>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    alignItems: 'center',
  },
  cardSection: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  /* overflow visible : un flip 3D dépasse légèrement le cadre ; hidden couperait l’animation */
  cardStack: {
    position: 'relative',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'visible',
  },
  ownedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  forSaleBadge: {
    position: 'absolute',
    top: 46,
    right: 10,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  ownedBadgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  flipPhotoHint: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardInfo: {
    width: '100%',
    marginTop: 16,
  },
  cardName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 16,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  badge: {
    fontSize: 12,
    padding: 4,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  priceSection: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  pricesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  priceItem: {
    width: '48%',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  myCardValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
  },
  myCardValueLabel: {
    fontSize: 16,
  },
  myCardValueAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  priceUpdateInfo: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  viewHistoryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sellContent: {
    alignItems: 'center',
  },
  cardSellName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceColumn: {
    width: '48%',
  },
  conditionContainer: {
    marginBottom: 16,
  },
  conditionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  conditionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  conditionButton: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  conditionButtonText: {
    fontSize: 14,
  },
  sellingPriceContainer: {
    marginBottom: 16,
  },
  sellingPriceLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
  },
  priceInput: {
    flex: 1,
    padding: 8,
  },
  currencyText: {
    fontSize: 14,
  },
  sellButton: {
    padding: 12,
    borderRadius: 8,
  },
  sellButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteCardButton: {
    marginTop: 14,
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  deleteCardButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteModalText: {
    fontSize: 14,
    marginBottom: 14,
    lineHeight: 20,
  },
  deleteSliderTrack: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  deleteSliderHint: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '500',
  },
  deleteSliderKnob: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 