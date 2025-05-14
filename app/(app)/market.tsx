import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { supabase, getTopCards, getTopGainers, getTopLosers, getWatchedCards } from '../lib/supabase';
import { LineChart } from 'react-native-chart-kit';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';

// Correction des titres d'onglets : chaînes statiques si besoin
const TAB_TITLES = [
  'Toutes les cartes',
  'Meilleures hausses',
  'Moins performantes',
  'Mes cartes surveillées'
];

// Mise à jour du composant CardListItem pour accepter des enfants (pour la différence de prix)
const CardListItem = ({ card, colors, onPress, children }: { card: any, colors: any, onPress: () => void, children?: React.ReactNode }) => (
  <TouchableOpacity 
    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: colors.surface, marginBottom: 8 }}
    onPress={onPress}
  >
    {card.image_small ? (
      <Image source={{ uri: card.image_small }} style={{ width: 40, height: 56, borderRadius: 4, marginRight: 12 }} resizeMode="contain" />
    ) : (
      <View style={{ width: 40, height: 56, borderRadius: 4, marginRight: 12, backgroundColor: colors.background, opacity: 0.5 }} />
    )}
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text.primary, fontWeight: 'bold', fontSize: 16 }} numberOfLines={1}>{card.card_name}</Text>
        {card.edition_name && (
          <Text style={{ color: colors.text.secondary, fontSize: 12 }} numberOfLines={1}>{card.edition_name}</Text>
        )}
      </View>
      <View>
        {card.price_mid !== undefined && (
          <Text style={{ color: colors.text.secondary, fontSize: 14, marginLeft: 8, fontWeight: 'bold' }}>{card.price_mid?.toFixed(2)} €</Text>
        )}
        {children}
      </View>
    </View>
  </TouchableOpacity>
);

// Fonction pour nettoyer et sécuriser les données numériques
const sanitizeNumericData = (data: any[]) => {
  return data.map(item => {
    // Créer un nouvel objet pour éviter de modifier l'original
    const sanitizedItem = { ...item };
    
    // Vérifier et convertir les valeurs numériques
    if (sanitizedItem.diff !== undefined) {
      // Convertir en nombre si c'est une chaîne, ou utiliser 0 si null/undefined/NaN
      sanitizedItem.diff = Number(sanitizedItem.diff) || 0;
    }
    
    if (sanitizedItem.diff_percent !== undefined) {
      // Convertir en nombre si c'est une chaîne, ou utiliser 0 si null/undefined/NaN
      sanitizedItem.diff_percent = Number(sanitizedItem.diff_percent) || 0;
    }
    
    if (sanitizedItem.last_price !== undefined) {
      sanitizedItem.last_price = Number(sanitizedItem.last_price) || 0;
    }
    
    if (sanitizedItem.prev_price !== undefined) {
      sanitizedItem.prev_price = Number(sanitizedItem.prev_price) || 0;
    }
    
    return sanitizedItem;
  });
};

export default function MarketScreen() {
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const [refreshKey, setRefreshKey] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [marketTrend, setMarketTrend] = useState<{ date: string; avg_price_mid: number }[]>([]);
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'all', title: TAB_TITLES[0] },
    { key: 'gainers', title: TAB_TITLES[1] },
    { key: 'losers', title: TAB_TITLES[2] },
    { key: 'watched', title: TAB_TITLES[3] },
  ]);
  const [allCards, setAllCards] = useState<any[]>([]);
  const [allLoading, setAllLoading] = useState(true);
  const [gainers, setGainers] = useState<any[]>([]);
  const [gainersLoading, setGainersLoading] = useState(true);
  const [losers, setLosers] = useState<any[]>([]);
  const [losersLoading, setLosersLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();
  const [watched, setWatched] = useState<any[]>([]);
  const [watchedLoading, setWatchedLoading] = useState(true);

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans MarketScreen:', language);
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
      console.log('Changement de thème détecté dans MarketScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener as string);
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
          console.log('Language has been changed, refreshing market data...');
          // Force un rafraîchissement en incrémentant la clé
          setRefreshKey(prev => prev + 1);
        }
      }
      
      checkLanguageChange();
    }, [])
  );

  useEffect(() => {
    const fetchMarketTrend = async () => {
      setTrendLoading(true);
      const { data, error } = await supabase
        .from('global_market_trend')
        .select('date, avg_price_mid')
        .order('date', { ascending: true });
      if (!error && data) {
        setMarketTrend(data);
      }
      setTrendLoading(false);
    };
    fetchMarketTrend();
  }, [refreshKey]);

  useEffect(() => {
    if (index === 0) {
      setAllLoading(true);
      getTopCards().then(({ data }) => {
        setAllCards(data || []);
        setAllLoading(false);
      });
    }
  }, [index, refreshKey]);

  useEffect(() => {
    if (index === 1) {
      setGainersLoading(true);
      getTopGainers().then(({ data }) => {
        console.log('Données des meilleures hausses:', JSON.stringify(data?.[0], null, 2));
        // Utiliser la fonction de nettoyage avant de définir les données
        const cleanData = sanitizeNumericData(data || []);
        setGainers(cleanData);
        setGainersLoading(false);
      });
    }
  }, [index, refreshKey]);

  useEffect(() => {
    if (index === 2) {
      setLosersLoading(true);
      getTopLosers().then(({ data }) => {
        console.log('Données des plus fortes baisses:', JSON.stringify(data?.[0], null, 2));
        // Utiliser la fonction de nettoyage avant de définir les données
        const cleanData = sanitizeNumericData(data || []);
        setLosers(cleanData);
        setLosersLoading(false);
      });
    }
  }, [index, refreshKey]);

  useEffect(() => {
    if (index === 3 && user?.id) {
      setWatchedLoading(true);
      getWatchedCards(user.id).then(({ data }) => {
        setWatched(data || []);
        setWatchedLoading(false);
      });
    }
  }, [index, refreshKey, user?.id]);

  const screenWidth = Dimensions.get('window').width - 32;

  // Placeholders pour chaque onglet
  const AllCardsRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {allLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={allCards}
          keyExtractor={item => item.card_id}
          renderItem={({ item }) => (
            <CardListItem 
              card={item} 
              colors={colors} 
              onPress={() => router.push(`/screens/card/${item.card_id}`)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
  const GainersRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {gainersLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={gainers}
          keyExtractor={item => item.card_id}
          renderItem={({ item }) => (
            <CardListItem 
              card={{ ...item, price_mid: item.last_price }} 
              colors={colors} 
              onPress={() => router.push(`/screens/card/${item.card_id}`)}
            >
              <View style={{ alignItems: 'flex-end' }}>
                {(item.diff === 0 && item.prev_price === null) ? (
                  <Text style={{ color: colors.text.secondary, fontSize: 11, marginLeft: 8, fontStyle: 'italic' }}>
                    {t('market.newCard')}
                  </Text>
                ) : (
                  <>
                    <Text style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: 13, marginLeft: 8 }}>
                      {typeof item.diff === 'number' ? 
                        `${item.diff > 0 ? '+' : ''}${item.diff.toFixed(2)} €` : 
                        '+0.00 €'}
                    </Text>
                    {item.diff_percent !== 0 && (
                      <Text style={{ color: '#2ecc71', fontSize: 11, marginLeft: 8 }}>
                        {typeof item.diff_percent === 'number' ? 
                          `${item.diff_percent > 0 ? '+' : ''}${item.diff_percent.toFixed(2)}%` : 
                          '+0.00%'}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </CardListItem>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
  const LosersRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {losersLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={losers}
          keyExtractor={item => item.card_id}
          renderItem={({ item }) => (
            <CardListItem 
              card={{ ...item, price_mid: item.last_price }} 
              colors={colors} 
              onPress={() => router.push(`/screens/card/${item.card_id}`)}
            >
              <View style={{ alignItems: 'flex-end' }}>
                {(item.diff === 0 && item.prev_price === null) ? (
                  <Text style={{ color: colors.text.secondary, fontSize: 11, marginLeft: 8, fontStyle: 'italic' }}>
                    {t('market.newCard')}
                  </Text>
                ) : (
                  <>
                    <Text style={{ color: '#e74c3c', fontWeight: 'bold', fontSize: 13, marginLeft: 8 }}>
                      {typeof item.diff === 'number' ? 
                        `${item.diff.toFixed(2)} €` : 
                        '0.00 €'}
                    </Text>
                    {item.diff_percent !== 0 && (
                      <Text style={{ color: '#e74c3c', fontSize: 11, marginLeft: 8 }}>
                        {typeof item.diff_percent === 'number' ? 
                          `${item.diff_percent.toFixed(2)}%` : 
                          '0.00%'}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </CardListItem>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
  const WatchedRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {watchedLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : watched.length === 0 ? (
        <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 32 }}>{t('market.noWatched')}</Text>
      ) : (
        <FlatList
          data={watched}
          keyExtractor={item => item.card_id}
          renderItem={({ item }) => (
            <CardListItem 
              card={item} 
              colors={colors} 
              onPress={() => router.push(`/screens/card/${item.card_id}`)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );

  const renderScene = SceneMap({
    all: AllCardsRoute,
    gainers: GainersRoute,
    losers: LosersRoute,
    watched: WatchedRoute,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('navigation.market')}</Text>
        <TouchableOpacity>
          <Ionicons name="search-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      {/* Graphique de tendance globale du marché */}
      <View style={{ padding: 16 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.text.primary, marginBottom: 8 }}>{t('market.globalTrend')}</Text>
        {trendLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <LineChart
            data={{
              labels: marketTrend.map(item => new Date(item.date).toLocaleDateString().slice(0, 5)),
              datasets: [
                {
                  data: marketTrend.map(item => item.avg_price_mid ?? 0),
                  color: () => colors.primary,
                  strokeWidth: 2,
                },
              ],
            }}
            width={screenWidth}
            height={160}
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
              borderRadius: 12,
              alignSelf: 'center',
            }}
          />
        )}
      </View>
      
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: screenWidth }}
        renderTabBar={props => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: colors.primary }}
            style={{ backgroundColor: colors.background }}
            activeColor={colors.primary}
            inactiveColor={colors.text.secondary}
          />
        )}
        style={{ flex: 1 }}
      />
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
  content: {
    flex: 1,
  },
  emptyMarket: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
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
    height: 100,
  },
}); 