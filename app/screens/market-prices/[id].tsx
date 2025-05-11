import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../lib/ThemeUtils';
import { supabase } from '../../lib/supabase';
import { LineChart } from 'react-native-chart-kit';

interface PriceRecord {
  id: string;
  date: string;
  source: string;
  price_low: number | null;
  price_mid: number | null;
  price_high: number | null;
  price_market: number | null;
}

export default function MarketPricesScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  
  const [loading, setLoading] = useState(true);
  const [cardName, setCardName] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceRecord[]>([]);
  
  useEffect(() => {
    if (id && user) {
      loadPriceHistory();
    }
  }, [id, user]);
  
  const loadPriceHistory = async () => {
    if (!id || !user) return;
    
    setLoading(true);
    try {
      // 1. Récupérer le nom de la carte
      const { data: cardData, error: cardError } = await supabase
        .from('official_cards')
        .select('name')
        .eq('id', id)
        .single();
      
      if (cardError) throw cardError;
      
      if (cardData) {
        setCardName(cardData.name);
      }
      
      // 2. Récupérer l'historique des prix
      const { data: priceData, error: priceError } = await supabase
        .from('market_prices')
        .select('id, date, source, price_low, price_mid, price_high, price_market')
        .eq('card_id', id)
        .order('date', { ascending: false })
        .limit(50);
      
      if (priceError) throw priceError;
      
      if (priceData) {
        setPriceHistory(priceData);
      }
    } catch (error) {
      console.error("Erreur lors du chargement de l'historique des prix:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Formater les prix
  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `${parseFloat(price.toString()).toFixed(2)} €`;
  };
  
  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
  
  // 1. Récupérer les 10 dernières dates (triées du plus ancien au plus récent)
  const uniqueDates = Array.from(new Set(
    priceHistory.map(item => item.date)
  )).sort(); // du plus ancien au plus récent

  const last10Dates = uniqueDates.slice(-10);

  // 2. Identifier toutes les sources présentes
  const sources = Array.from(new Set(priceHistory.map(item => item.source)));

  // 3. Palette de couleurs pour les courbes
  const colorsPalette = [
    colors.primary,
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40'
  ];

  // 4. Préparer les datasets pour chaque source
  const datasets = sources.map((source, idx) => {
    const data = last10Dates.map(date => {
      const record = priceHistory.find(item => item.source === source && item.date === date);
      return record?.price_mid ?? null;
    });
    return {
      data: data.map(v => v ?? 0),
      color: () => colorsPalette[idx % colorsPalette.length],
      strokeWidth: 2,
      source
    };
  });

  // 5. Préparer les labels (dates formatées)
  const chartLabels = last10Dates.map(dateStr => {
    const d = new Date(dateStr);
    return d.toLocaleDateString().slice(0, 5);
  });

  const screenWidth = Dimensions.get('window').width - 32;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
          {t('card.priceHistory')}
        </Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Nom de la carte */}
      <Text style={[styles.cardName, { color: colors.text.primary }]}>
        {cardName}
      </Text>
      
      {/* Graphique d'évolution du price_mid */}
      {datasets.length > 0 && (
        <LineChart
          data={{
            labels: chartLabels,
            datasets: datasets.map(ds => ({
              data: ds.data,
              color: ds.color,
              strokeWidth: ds.strokeWidth,
            })),
            legend: datasets.map(ds => ds.source.replace('tcgplayer_', '')),
          }}
          width={screenWidth}
          height={180}
          yAxisSuffix=" €"
          chartConfig={{
            backgroundColor: colors.background,
            backgroundGradientFrom: colors.background,
            backgroundGradientTo: colors.background,
            decimalPlaces: 2,
            color: (opacity = 1) => colors.primary,
            labelColor: (opacity = 1) => colors.text.secondary,
            propsForDots: {
              r: '3',
              strokeWidth: '2',
              stroke: colors.primary,
            },
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 12,
            alignSelf: 'center',
          }}
        />
      )}
      
      {/* En-tête du tableau */}
      <View style={[styles.tableHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerCell, styles.dateCell, { color: colors.text.secondary }]}>
          {t('card.date')}
        </Text>
        <Text style={[styles.headerCell, styles.sourceCell, { color: colors.text.secondary }]}>
          {t('card.source')}
        </Text>
        <Text style={[styles.headerCell, styles.priceCell, { color: colors.text.secondary }]}>
          {t('card.lowPrice')}
        </Text>
        <Text style={[styles.headerCell, styles.priceCell, { color: colors.text.secondary }]}>
          {t('card.midPrice')}
        </Text>
        <Text style={[styles.headerCell, styles.priceCell, { color: colors.text.secondary }]}>
          {t('card.marketPrice')}
        </Text>
      </View>
      
      {/* Liste des prix */}
      {priceHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="analytics-outline" size={64} color={colors.text.secondary} />
          <Text style={[styles.emptyText, { color: colors.text.primary }]}>
            {t('card.noPriceHistory')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={priceHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.tableRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <Text style={[styles.cell, styles.dateCell, { color: colors.text.primary }]}>
                {formatDate(item.date)}
              </Text>
              <Text style={[styles.cell, styles.sourceCell, { color: colors.text.primary }]}>
                {item.source.replace('tcgplayer_', '')}
              </Text>
              <Text style={[styles.cell, styles.priceCell, { color: colors.text.primary }]}>
                {formatPrice(item.price_low)}
              </Text>
              <Text style={[styles.cell, styles.priceCell, { color: colors.text.primary }]}>
                {formatPrice(item.price_mid)}
              </Text>
              <Text style={[styles.cell, styles.priceCell, { color: colors.secondary, fontWeight: 'bold' }]}>
                {formatPrice(item.price_market)}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
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
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerCell: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  cell: {
    fontSize: 14,
  },
  dateCell: {
    width: '20%',
  },
  sourceCell: {
    width: '20%',
  },
  priceCell: {
    width: '20%',
    textAlign: 'right',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
}); 