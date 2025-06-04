import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import LanguageFlag from './LanguageFlag';

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
  edition_name?: string;
  edition_symbol_image?: string;
  lang?: string;
}

interface SwipeableCardProps {
  card: CardInfo;
  colors: any;
  t: any;
  router: any;
  onSellPress: (card: CardInfo) => void;
  onPriceAlertPress: (card: CardInfo) => void;
  onWishlistPress: (card: CardInfo) => void;
  onCardPress?: (card: CardInfo) => void;
  showOwnershipIcon?: boolean;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({ 
  card, 
  colors, 
  t, 
  router, 
  onSellPress, 
  onPriceAlertPress, 
  onWishlistPress,
  onCardPress,
  showOwnershipIcon = true
}) => {
  
  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    // Faire apparaître l'action dès le début du swipe
    const scale = progress.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.8, 1, 1],
      extrapolate: 'clamp',
    });
    
    const opacity = progress.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.5, 1, 1],
      extrapolate: 'clamp',
    });
    
    const trans = dragX.interpolate({
      inputRange: [0, 20, 50, 100],
      outputRange: [-10, 0, 0, 1],
      extrapolate: 'clamp',
    });
    
    // Action différente selon si la carte est possédée ou non
    const backgroundColor = card.owned ? '#e74c3c' : '#2ecc71'; // Rouge pour vendre, Vert pour acheter
    const actionText = card.owned ? t('card.sell') : t('card.buy');
    const iconName = card.owned ? 'cash-outline' : 'cart-outline';
    
    return (
      <Animated.View 
        style={[
          styles.swipeActionContainer,
          {
            backgroundColor,
            transform: [{ translateX: trans }, { scale }],
            opacity,
          }
        ]}
      >
        <View style={styles.swipeAction}>
          <Ionicons name={iconName} size={28} color="white" />
          <Text style={styles.actionText}>{actionText}</Text>
        </View>
      </Animated.View>
    );
  };
  
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    // Faire apparaître l'action dès le début du swipe
    const scale = progress.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.8, 1, 1],
      extrapolate: 'clamp',
    });
    
    const opacity = progress.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.5, 1, 1],
      extrapolate: 'clamp',
    });
    
    const trans = dragX.interpolate({
      inputRange: [-100, -50, -20, 0],
      outputRange: [1, 0, 0, -10],
      extrapolate: 'clamp',
    });
    
    // Action différente selon si la carte est possédée ou non
    const backgroundColor = card.owned ? '#3498db' : '#f1c40f'; // Bleu pour alerte, Jaune pour wishlist
    const actionText = card.owned ? 
      (card.has_price_alert ? t('card.removePriceAlert') : t('card.priceAlert')) : 
      t('card.addToWishlist');
    const iconName = card.owned ? 
      (card.has_price_alert ? 'notifications' : 'notifications-outline') : 
      'star-outline';
    
    return (
      <Animated.View 
        style={[
          styles.swipeActionContainer,
          {
            backgroundColor,
            transform: [{ translateX: trans }, { scale }],
            opacity,
          }
        ]}
      >
        <View style={styles.swipeAction}>
          <Ionicons name={iconName} size={28} color="white" />
          <Text style={styles.actionText}>{actionText}</Text>
        </View>
      </Animated.View>
    );
  };
  
  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      // Bouton Sell/Buy (à gauche)
      if (card.owned) {
        // Ouvrir le modal de vente
        onSellPress(card);
      } else {
        // Rediriger vers la page de d'achat de la carte
        router.push(`/screens/market-prices/card-marketplace?id=${card.id}`);
      }
    } else if (direction === 'right') {
      // Bouton Alert/Wishlist (à droite)
      if (card.owned) {
        // Implémenter la fonctionnalité d'alerte de prix
        onPriceAlertPress(card);
      } else {
        // Ajout à la wishlist
        onWishlistPress(card);
      }
    }
  };

  const handleCardPress = () => {
    if (onCardPress) {
      onCardPress(card);
    } else {
      router.push(`/screens/card/${card.id}`);
    }
  };
  
  // Couleurs pour les raretés
  const getRarityColor = (rarity: string) => {
    const rarityColors: Record<string, string> = {
      'Common': '#6B7280',
      'Uncommon': '#10B981',
      'Rare': '#3B82F6',
      'Rare Holo': '#8B5CF6',
      'Ultra Rare': '#F59E0B',
      'Secret Rare': '#EF4444',
      'Promo': '#EC4899',
    };
    return rarityColors[rarity] || '#6B7280';
  };

  // Couleurs pour les conditions
  const getConditionColor = (condition: string) => {
    const conditionColors: Record<string, string> = {
      'Near Mint': '#10B981',
      'Excellent': '#3B82F6', 
      'Good': '#F59E0B',
      'Played': '#EF4444'
    };
    return conditionColors[condition] || '#6B7280';
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
      <TouchableOpacity 
        style={[styles.cardItem, { backgroundColor: colors.surface }]}
        onPress={handleCardPress}
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
          <View style={styles.cardHeader}>
            <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={1}>
              {card.name}
            </Text>
            
            {/* Prix aligné à droite */}
            <View style={styles.priceContainer}>
              {card.market_price_mid && (
                <Text style={[styles.marketPrice, { color: colors.primary }]}>
                  {card.market_price_mid.toFixed(2)} €
                </Text>
              )}
              
              {card.price && card.is_for_sale && (
                <Text style={[styles.cardPrice, { color: colors.secondary }]}>
                  {card.price.toFixed(2)} € <Ionicons name="pricetag" size={12} color={colors.secondary} />
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.cardMetadata}>
            <Text style={[styles.cardNumber, { color: colors.text.secondary }]}>
              #{card.number}
            </Text>
            
            {/* Logo de l'édition et nom */}
            <View style={styles.editionInfo}>
              {card.edition_symbol_image && (
                <Image 
                  source={{ uri: card.edition_symbol_image }} 
                  style={styles.editionSymbol}
                  resizeMode="contain"
                />
              )}
              {card.edition_name && (
                <Text style={[styles.editionName, { color: colors.text.secondary }]} numberOfLines={1}>
                  {card.edition_name}
                </Text>
              )}
            </View>
          </View>
          
          {/* Labels de couleur pour rareté et condition */}
          <View style={styles.labelsContainer}>
            {/* Drapeau de langue pour les cartes possédées */}
            {card.owned && (
              <LanguageFlag language={card.lang} size="small" />
            )}
            
            <View style={[styles.rarityLabel, { backgroundColor: getRarityColor(card.rarity) }]}>
              <Text style={styles.labelText}>
                {card.rarity || t('general.common')}
              </Text>
            </View>
            
            {card.condition && (
              <View style={[styles.conditionLabel, { backgroundColor: getConditionColor(card.condition) }]}>
                <Text style={styles.labelText}>
                  {t(`conditions.${card.condition.toLowerCase().replace(' ', '')}`)}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {showOwnershipIcon && (
          <View style={styles.cardOwnership}>
            <MaterialIcons 
              name={card.owned ? "catching-pokemon" : "radio-button-unchecked"} 
              size={24} 
              color={card.owned ? colors.secondary : colors.text.secondary} 
            />
            {card.has_wishlist && !card.owned && (
              <Ionicons name="star" size={18} color="#FFD700" style={{ marginTop: 2 }} />
            )}
            {card.owned && card.is_for_sale && (
              <Text style={[styles.forSaleBadge, { color: colors.secondary, borderColor: colors.secondary }]}>
                {t('card.forSale')}
              </Text>
            )}
            {card.owned && card.has_price_alert && (
              <Text style={[styles.alertBadge, { color: '#3498db', borderColor: '#3498db' }]}>
                <Ionicons name="notifications" size={10} color="#3498db" /> {t('card.alert')}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  cardItem: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    height: 80,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardName: {
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  marketPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  cardMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardNumber: {
    fontSize: 12,
  },
  editionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 12,
  },
  editionSymbol: {
    width: 16,
    height: 16,
    marginRight: 8,
  },
  editionName: {
    fontSize: 11,
    flex: 1,
  },
  labelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  rarityLabel: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  conditionLabel: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  labelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  cardOwnership: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  forSaleBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    padding: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginTop: 4,
    textAlign: 'center',
  },
  alertBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    borderWidth: 1,
    padding: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginTop: 4,
    textAlign: 'center',
  },
  swipeActionContainer: {
    height: 80,
    width: 120,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 8,
    overflow: 'hidden',
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  actionText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 18,
  },
});

export default SwipeableCard; 