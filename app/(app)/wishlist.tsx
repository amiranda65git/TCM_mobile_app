import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Image, Animated } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { useAuth } from '../lib/auth';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { getUserWishlist, getOfficialCardDetails, getMarketPricesForCard, addOrRemoveFromWishlist } from '../lib/supabase';

interface CardInfo {
  id: string;
  name: string;
  number: string;
  rarity: string;
  image_small: string;
  image_large: string;
  price: number | null;
  market_price_mid?: number | null;
}

const WishlistCard = ({ card, colors, t, router, onBuyPress, onRemovePress }: any) => {
  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 1, 1], extrapolate: 'clamp' });
    const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1, 1], extrapolate: 'clamp' });
    const trans = dragX.interpolate({ inputRange: [0, 20, 50, 100], outputRange: [-10, 0, 0, 1], extrapolate: 'clamp' });
    return (
      <Animated.View style={[styles.swipeActionContainer, { backgroundColor: '#2ecc71', transform: [{ translateX: trans }, { scale }], opacity }]}> 
        <View style={styles.swipeAction}>
          <Ionicons name="cart-outline" size={28} color="white" />
          <Text style={styles.actionText}>{t('card.buy')}</Text>
        </View>
      </Animated.View>
    );
  };
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 1, 1], extrapolate: 'clamp' });
    const opacity = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1, 1], extrapolate: 'clamp' });
    const trans = dragX.interpolate({ inputRange: [-100, -50, -20, 0], outputRange: [1, 0, 0, -10], extrapolate: 'clamp' });
    return (
      <Animated.View style={[styles.swipeActionContainer, { backgroundColor: '#e74c3c', transform: [{ translateX: trans }, { scale }], opacity }]}> 
        <View style={styles.swipeAction}>
          <Ionicons name="star" size={28} color="white" />
          <Text style={styles.actionText}>{t('wishlist.removeCard')}</Text>
        </View>
      </Animated.View>
    );
  };
  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      onBuyPress(card);
    } else if (direction === 'right') {
      onRemovePress(card);
    }
  };
  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeableOpen}
      friction={1.5}
      leftThreshold={30}
      rightThreshold={30}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity style={[styles.cardItem, { backgroundColor: colors.surface }]} onPress={() => router.push(`/screens/card/${card.id}`)}>
        {card.image_small ? (
          <Image source={{ uri: card.image_small }} style={styles.cardImage} resizeMode="contain" />
        ) : (
          <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.surface }]} />
        )}
        <View style={styles.cardDetails}>
          <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={1}>{card.name}</Text>
          <Text style={[styles.cardNumber, { color: colors.text.secondary }]}>#{card.number}</Text>
          <Text style={[styles.cardRarity, { color: colors.text.secondary }]}>{card.rarity || t('general.common')}</Text>
          {card.market_price_mid && (
            <Text style={[styles.cardPrice, { color: colors.secondary }]}> {card.market_price_mid.toFixed(2)} € </Text>
          )}
        </View>
        <Ionicons name="star" size={18} color="#FFD700" style={{ marginLeft: 8, marginTop: 2 }} />
      </TouchableOpacity>
    </Swipeable>
  );
};

export default function WishlistScreen() {
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const [refreshKey, setRefreshKey] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [search, setSearch] = useState('');

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
        EventRegister.removeEventListener(themeListener  as string);
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

  useEffect(() => {
    loadWishlist();
  }, [user?.id]);

  const loadWishlist = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: wishlistIds } = await getUserWishlist(user.id);
      if (!wishlistIds || wishlistIds.length === 0) {
        setCards([]);
        setLoading(false);
        return;
      }
      // Récupérer les infos détaillées pour chaque carte
      const cardPromises = wishlistIds.map(async (cardId: string) => {
        const { data: cardData } = await getOfficialCardDetails(cardId);
        const { data: priceData } = await getMarketPricesForCard(cardId);
        return cardData ? {
          ...cardData,
          price: priceData?.price_mid || null,
          market_price_mid: priceData?.price_mid || null,
        } : null;
      });
      let cardsData = (await Promise.all(cardPromises)).filter(Boolean) as CardInfo[];
      // Tri décroissant par prix
      cardsData = cardsData.sort((a, b) => (b.market_price_mid || 0) - (a.market_price_mid || 0));
      setCards(cardsData);
    } catch (e) {
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = (card: CardInfo) => {
    router.push(`/screens/market-prices/card-marketplace?id=${card.id}`);
  };
  const handleRemove = async (card: CardInfo) => {
    if (!user) return;
    await addOrRemoveFromWishlist(user.id, card.id);
    loadWishlist();
  };

  const filteredCards = cards.filter(card =>
    card.name.toLowerCase().includes(search.toLowerCase()) ||
    card.number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('home.wishlist')}</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.text.secondary} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text.primary }]}
          placeholder={t('wishlist.search') || 'Rechercher une carte'}
          placeholderTextColor={colors.text.secondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredCards.length === 0 ? (
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
      ) : (
        <ScrollView style={styles.cardsGrid} contentContainerStyle={{ paddingBottom: 40 }}>
          {filteredCards.map(card => (
            <WishlistCard
              key={card.id}
              card={card}
              colors={colors}
              t={t}
              router={router}
              onBuyPress={handleBuy}
              onRemovePress={handleRemove}
            />
          ))}
        </ScrollView>
      )}
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
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 8, marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 12, height: 40 },
  searchInput: { flex: 1, fontSize: 16 },
  cardsGrid: { flex: 1, paddingHorizontal: 16 },
  cardItem: { flexDirection: 'row', borderRadius: 8, padding: 12, marginBottom: 8, alignItems: 'center', height: 80 },
  cardImage: { width: 40, height: 56, borderRadius: 4 },
  cardImagePlaceholder: { width: 40, height: 56, borderRadius: 4, opacity: 0.5 },
  cardDetails: { flex: 1, marginLeft: 12 },
  cardName: { fontWeight: 'bold', fontSize: 16 },
  cardNumber: { fontSize: 12 },
  cardRarity: { fontSize: 12, marginTop: 2 },
  cardPrice: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  swipeActionContainer: { height: 80, width: 120, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 8, overflow: 'hidden' },
  swipeAction: { flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', paddingHorizontal: 16 },
  actionText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 18 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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