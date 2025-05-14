import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Image, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { supabase, getTopCards, getTopGainers, getTopLosers, getWatchedCards, searchCards } from '../lib/supabase';
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
  
  // État pour la recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [filteredCards, setFilteredCards] = useState<any[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

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
        const cards = data || [];
        setAllCards(cards);
        
        // Si un filtre est actif, appliquer le filtre aux cartes
        if (isFiltering && filterName) {
          const filtered = cards.filter(card => 
            card.card_name.toLowerCase().includes(filterName.toLowerCase())
          );
          setFilteredCards(filtered);
        }
        
        setAllLoading(false);
      });
    }
  }, [index, refreshKey, isFiltering, filterName]);

  useEffect(() => {
    if (index === 1) {
      setGainersLoading(true);
      getTopGainers().then(({ data }) => {
        console.log('Données des meilleures hausses:', JSON.stringify(data?.[0], null, 2));
        // Utiliser la fonction de nettoyage avant de définir les données
        const cleanData = sanitizeNumericData(data || []);
        setGainers(cleanData);
        
        // Si un filtre est actif, appliquer le filtre aux cartes
        if (isFiltering && filterName) {
          const filtered = cleanData.filter(card => 
            card.card_name.toLowerCase().includes(filterName.toLowerCase())
          );
          setFilteredCards(filtered);
        }
        
        setGainersLoading(false);
      });
    }
  }, [index, refreshKey, isFiltering, filterName]);

  useEffect(() => {
    if (index === 2) {
      setLosersLoading(true);
      getTopLosers().then(({ data }) => {
        console.log('Données des plus fortes baisses:', JSON.stringify(data?.[0], null, 2));
        // Utiliser la fonction de nettoyage avant de définir les données
        const cleanData = sanitizeNumericData(data || []);
        setLosers(cleanData);
        
        // Si un filtre est actif, appliquer le filtre aux cartes
        if (isFiltering && filterName) {
          const filtered = cleanData.filter(card => 
            card.card_name.toLowerCase().includes(filterName.toLowerCase())
          );
          setFilteredCards(filtered);
        }
        
        setLosersLoading(false);
      });
    }
  }, [index, refreshKey, isFiltering, filterName]);

  useEffect(() => {
    if (index === 3 && user?.id) {
      setWatchedLoading(true);
      getWatchedCards(user.id).then(({ data }) => {
        const watchedData = data || [];
        setWatched(watchedData);
        
        // Si un filtre est actif, appliquer le filtre aux cartes
        if (isFiltering && filterName) {
          const filtered = watchedData.filter(card => 
            card.card_name.toLowerCase().includes(filterName.toLowerCase())
          );
          setFilteredCards(filtered);
        }
        
        setWatchedLoading(false);
      });
    }
  }, [index, refreshKey, user?.id, isFiltering, filterName]);

  // Nouvel effet pour la recherche
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const { data, error } = await searchCards(searchQuery);
        if (!error && data) {
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
        setIsSearching(false);
        setShowSuggestions(true);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Fonction qui filtre les cartes par nom au lieu d'ouvrir la page de détail
  const handleCardSelect = (cardName: string) => {
    setFilterName(cardName);
    setIsFiltering(true);
    setSearchQuery('');
    setShowSuggestions(false);
    Keyboard.dismiss();
    
    // Filtrer les cartes en fonction de l'onglet actif
    let cardsToFilter;
    switch (index) {
      case 0:
        cardsToFilter = allCards;
        break;
      case 1:
        cardsToFilter = gainers;
        break;
      case 2:
        cardsToFilter = losers;
        break;
      case 3:
        cardsToFilter = watched;
        break;
      default:
        cardsToFilter = allCards;
    }
    
    const filtered = cardsToFilter.filter(card => 
      card.card_name.toLowerCase().includes(cardName.toLowerCase())
    );
    setFilteredCards(filtered);
  };

  // Fonction pour effacer le filtre
  const clearFilter = () => {
    setIsFiltering(false);
    setFilterName('');
    setFilteredCards([]);
  };

  const screenWidth = Dimensions.get('window').width - 32;

  // Placeholders pour chaque onglet avec prise en compte du filtrage
  const AllCardsRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {allLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={isFiltering ? filteredCards : allCards}
            keyExtractor={item => item.card_id}
            renderItem={({ item }) => (
              <CardListItem 
                card={item} 
                colors={colors} 
                onPress={() => router.push(`/screens/card/${item.card_id}`)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              isFiltering ? (
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                  {t('market.noFilterResults')}
                </Text>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
  
  const GainersRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {gainersLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={isFiltering ? filteredCards : gainers}
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
            ListEmptyComponent={
              isFiltering ? (
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                  {t('market.noFilterResults')}
                </Text>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
  
  const LosersRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {losersLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={isFiltering ? filteredCards : losers}
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
            ListEmptyComponent={
              isFiltering ? (
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                  {t('market.noFilterResults')}
                </Text>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
  
  const WatchedRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {watchedLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : watched.length === 0 && !isFiltering ? (
        <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 32 }}>{t('market.noWatched')}</Text>
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={isFiltering ? filteredCards : watched}
            keyExtractor={item => item.card_id}
            renderItem={({ item }) => (
              <CardListItem 
                card={item} 
                colors={colors} 
                onPress={() => router.push(`/screens/card/${item.card_id}`)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              isFiltering ? (
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                  {t('market.noFilterResults')}
                </Text>
              ) : null
            }
          />
        </>
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
      </View>
      
      {/* Champ de recherche */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search-outline" size={20} color={colors.text.secondary} style={{ marginRight: 8 }} />
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { color: colors.text.primary }]}
          placeholder={t('market.searchPlaceholder') || "Rechercher une carte..."}
          placeholderTextColor={colors.text.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {!searchQuery && !searchFocused && (
          <Text style={{ color: colors.text.secondary, fontSize: 12, fontStyle: 'italic', marginLeft: 4 }}>
            {t('market.typeToSearch')}
          </Text>
        )}
      </View>
      
      {/* Suggestions de recherche */}
      {showSuggestions && searchResults.length > 0 ? (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface }]}>
          <FlatList
            data={searchResults}
            keyExtractor={item => item.card_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleCardSelect(item.card_name)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.image_small ? (
                    <Image source={{ uri: item.image_small }} style={styles.suggestionImage} resizeMode="contain" />
                  ) : (
                    <View style={[styles.suggestionImagePlaceholder, { backgroundColor: colors.background }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text.primary, fontWeight: 'bold' }}>{item.card_name}</Text>
                    {item.edition_name && (
                      <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{item.edition_name}</Text>
                    )}
                  </View>
                  {item.price_mid !== null && item.price_mid !== undefined ? (
                    <Text style={{ color: colors.text.secondary, fontWeight: 'bold' }}>
                      {parseFloat(item.price_mid).toFixed(2)} €
                    </Text>
                  ) : (
                    <Text style={{ color: colors.text.secondary, fontStyle: 'italic', fontSize: 12 }}>
                      {t('market.noPriceYet') || "Pas de prix"}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      ) : showSuggestions && searchQuery.trim().length >= 2 ? (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text.secondary, padding: 16, textAlign: 'center' }}>
            {isSearching ? t('market.searching') || 'Recherche en cours...' : t('market.noResults') || 'Aucun résultat trouvé'}
          </Text>
        </View>
      ) : null}
      
      {/* Graphique de tendance globale du marché */}
      {!showSuggestions && (
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
      )}
      
      {/* Contenu des onglets - masqué pendant la recherche */}
      {!showSuggestions && (
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={(newIndex) => {
            setIndex(newIndex);
            // Ne pas réinitialiser le filtre lors du changement d'onglet
            // pour permettre à l'utilisateur de comparer les données entre onglets
          }}
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
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 0,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 110, // Position en dessous du champ de recherche
    left: 16,
    right: 16,
    maxHeight: 300,
    borderRadius: 8,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  suggestionImage: {
    width: 30,
    height: 42,
    marginRight: 10,
    borderRadius: 4,
  },
  suggestionImagePlaceholder: {
    width: 30,
    height: 42,
    marginRight: 10,
    borderRadius: 4,
    opacity: 0.5,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  clearFilterButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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