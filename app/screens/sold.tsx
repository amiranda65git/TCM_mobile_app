import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, SafeAreaView, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { getUserSoldCards } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../lib/ThemeUtils';

export default function SoldScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [soldCards, setSoldCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSoldCards();
    }
  }, [user]);

  const loadSoldCards = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await getUserSoldCards(user.id);
      if (!error && data) {
        setSoldCards(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des cartes vendues:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  };

  const formatPrice = (price: number) => {
    return `${price.toFixed(2)} €`;
  };

  const handleCardPress = (card: any) => {
    router.push(`/screens/market-prices/card-sell-details?id=${card.user_card_id}`);
  };

  const renderSoldCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleCardPress(item)}
    >
      <Image 
        source={{ uri: item.image_small }} 
        style={styles.cardImage}
        resizeMode="contain"
      />
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.text.primary }]} numberOfLines={2}>
          {item.card_name}
        </Text>
        <Text style={[styles.editionName, { color: colors.text.secondary }]} numberOfLines={1}>
          {item.edition_name}
        </Text>
        <Text style={[styles.condition, { color: colors.text.secondary }]}>
          {t(`market.condition.${item.condition}`)}
        </Text>
        <Text style={[styles.soldDate, { color: colors.text.secondary }]}>
          {t('sold.soldOn')} {formatDate(item.sold_date)}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={[styles.price, { color: colors.success }]}>
            {formatPrice(item.price)}
          </Text>
          <View style={[styles.soldBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.soldBadgeText}>{t('sold.sold')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cash-outline" size={64} color={colors.text.secondary} />
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        {t('sold.noCards')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
        Les cartes que vous marquerez comme vendues apparaîtront ici
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      {/* Header avec thème de l'application */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          {t('home.sold')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Contenu */}
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <FlatList
          data={soldCards}
          renderItem={renderSoldCard}
          keyExtractor={(item) => item.user_card_id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={!loading ? renderEmptyState : null}
          refreshing={loading}
          onRefresh={loadSoldCards}
        />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  cardContainer: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardImage: {
    width: 80,
    height: 112,
    borderRadius: 8,
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  editionName: {
    fontSize: 14,
    marginBottom: 4,
  },
  condition: {
    fontSize: 12,
    marginBottom: 4,
  },
  soldDate: {
    fontSize: 12,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  soldBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  soldBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
}); 