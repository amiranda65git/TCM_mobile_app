import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { supabase, getTopCards, getTopGainers, getTopLosers, getWatchedCards, searchCards, getMyMarketCards } from '../lib/supabase';
import { TabView, TabBar } from 'react-native-tab-view';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';

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
  const [index, setIndex] = useState(0);
  const routes = useMemo(() => [
    { key: 'all', title: t('market.tabs.all') },
    { key: 'gainers', title: t('market.tabs.gainers') },
    { key: 'losers', title: t('market.tabs.losers') },
    { key: 'watched', title: t('market.tabs.watched') },
  ], [t]);
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
  const [isLoadingFilteredCards, setIsLoadingFilteredCards] = useState(false);
  const [onlyMyCards, setOnlyMyCards] = useState(false);
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set());
  const [ownedMarketCards, setOwnedMarketCards] = useState<any[]>([]);
  const [ownedMarketLoading, setOwnedMarketLoading] = useState(false);

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans MarketScreen:', language);
        setRefreshKey(prev => prev + 1);
      }
    });

    return () => {
      if (typeof listener === 'string') {
        EventRegister.removeEventListener(listener);
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

  // IDs des cartes de la collection (pour le filtre « Seulement mes cartes »)
  useEffect(() => {
    if (!user?.id) {
      setOwnedCardIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_cards')
        .select('card_id')
        .eq('user_id', user.id)
        .eq('is_sold', false);
      if (cancelled) return;
      if (error || !data) {
        setOwnedCardIds(new Set());
        return;
      }
      setOwnedCardIds(new Set(data.map((row: { card_id: string }) => row.card_id).filter(Boolean)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshKey]);

  const applyOwnedFilter = useCallback(
    (list: any[]) => {
      if (!onlyMyCards) return list;
      return list.filter((item) => ownedCardIds.has(item.card_id));
    },
    [onlyMyCards, ownedCardIds]
  );

  // « Mes cartes » : requête dédiée (le top marché est tronqué)
  useEffect(() => {
    if (!onlyMyCards || !user?.id || index > 2) {
      return;
    }
    let cancelled = false;
    const mode = index === 1 ? 'gainers' : index === 2 ? 'losers' : 'all';
    setOwnedMarketLoading(true);
    getMyMarketCards(user.id, mode).then(({ data }) => {
      if (cancelled) return;
      setOwnedMarketCards(data || []);
      setOwnedMarketLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [onlyMyCards, user?.id, index, refreshKey]);

  const listForTab = (fallback: any[]) =>
    onlyMyCards && !isFiltering ? ownedMarketCards : applyOwnedFilter(isFiltering ? filteredCards : fallback);

  const loadingForTab = (fallbackLoading: boolean) =>
    onlyMyCards && !isFiltering ? ownedMarketLoading : fallbackLoading;

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

  // Fonction qui recherche toutes les cartes par nom dans la base de données
  const handleCardSelect = async (cardName: string) => {
    setFilterName(cardName);
    setIsFiltering(true);
    setSearchQuery('');
    setShowSuggestions(false);
    setIsLoadingFilteredCards(true);
    Keyboard.dismiss();
    
    // Rechercher toutes les cartes avec ce nom dans la base de données
    try {
      const { data, error } = await searchCards(cardName, 1000); // Limite élevée pour récupérer toutes les cartes
      if (!error && data) {
        setFilteredCards(data);
      } else {
        console.error('Erreur lors de la recherche:', error);
        setFilteredCards([]);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      setFilteredCards([]);
    } finally {
      setIsLoadingFilteredCards(false);
    }
  };

  // Fonction pour effacer le filtre
  const clearFilter = () => {
    setIsFiltering(false);
    setFilterName('');
    setFilteredCards([]);
  };

  // Placeholders pour chaque onglet avec prise en compte du filtrage
  const AllCardsRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {loadingForTab(allLoading) ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {isLoadingFilteredCards ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={listForTab(allCards)}
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
                isFiltering || onlyMyCards ? (
                  <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                    {onlyMyCards && !isFiltering
                      ? t('market.noOwnedInMarket')
                      : t('market.noFilterResults')}
                  </Text>
                ) : null
              }
            />
          )}
        </>
      )}
    </View>
  );
  
  const GainersRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {loadingForTab(gainersLoading) ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {isLoadingFilteredCards ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={listForTab(gainers)}
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
                isFiltering || onlyMyCards ? (
                  <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                    {onlyMyCards && !isFiltering
                      ? t('market.noOwnedInMarket')
                      : t('market.noFilterResults')}
                  </Text>
                ) : null
              }
            />
          )}
        </>
      )}
    </View>
  );
  
  const LosersRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {loadingForTab(losersLoading) ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {isLoadingFilteredCards ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={listForTab(losers)}
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
                isFiltering || onlyMyCards ? (
                  <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                    {onlyMyCards && !isFiltering
                      ? t('market.noOwnedInMarket')
                      : t('market.noFilterResults')}
                  </Text>
                ) : null
              }
            />
          )}
        </>
      )}
    </View>
  );
  
  const WatchedRoute = () => (
    <View style={{ flex: 1, padding: 8 }}>
      {watchedLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : watched.length === 0 && !isFiltering && !onlyMyCards ? (
        <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 32 }}>{t('market.noWatched')}</Text>
      ) : (
        <>
          {isFiltering && (
            <View style={[styles.filterBar, { backgroundColor: colors.primary, marginHorizontal: 16, marginBottom: 10 }]}>
              <Ionicons name="funnel" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', flex: 1, fontWeight: 'bold' }}>
                {t('market.filteredBy')}: {filterName}
              </Text>
              <TouchableOpacity onPress={clearFilter} style={styles.clearFilterButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          {isLoadingFilteredCards ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={applyOwnedFilter(isFiltering ? filteredCards : watched)}
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
                isFiltering || onlyMyCards ? (
                  <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                    {onlyMyCards && !isFiltering
                      ? t('market.noOwnedInMarket')
                      : t('market.noFilterResults')}
                  </Text>
                ) : null
              }
            />
          )}
        </>
      )}
    </View>
  );

  const renderScene = ({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'gainers':
        return <GainersRoute />;
      case 'losers':
        return <LosersRoute />;
      case 'watched':
        return <WatchedRoute />;
      default:
        return <AllCardsRoute />;
    }
  };

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

      </View>

      <TouchableOpacity
        style={[
          styles.onlyMyCardsChip,
          {
            backgroundColor: onlyMyCards ? colors.primary : colors.surface,
            borderColor: onlyMyCards ? colors.primary : colors.border,
          },
        ]}
        onPress={() => setOnlyMyCards((v) => !v)}
        activeOpacity={0.8}
        disabled={!user?.id}
      >
        <Ionicons
          name={onlyMyCards ? 'checkbox' : 'square-outline'}
          size={18}
          color={onlyMyCards ? '#FFFFFF' : colors.text.secondary}
          style={{ marginRight: 8 }}
        />
        <Text
          style={{
            color: onlyMyCards ? '#FFFFFF' : colors.text.primary,
            fontWeight: '600',
            fontSize: 13,
          }}
        >
          {t('market.onlyMyCards')}
        </Text>
      </TouchableOpacity>
      
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
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  onlyMyCardsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
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