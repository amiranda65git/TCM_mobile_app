import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Image, TextInput, Keyboard, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { supabase, getTopCards, getTopGainers, getTopLosers, getWatchedCards, searchMarketCards, getMyMarketCards } from '../lib/supabase';
import { TabView, TabBar } from 'react-native-tab-view';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const PRICE_RANGES = [
  { id: 'all', min: null as number | null, max: null as number | null },
  { id: 'lt5', min: null, max: 5 },
  { id: 'm5_20', min: 5, max: 20 },
  { id: 'm20_50', min: 20, max: 50 },
  { id: 'gt50', min: 50, max: null },
];

function parsePriceInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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
  const insets = useSafeAreaInsets();
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
  const [showFilters, setShowFilters] = useState(false);
  const [pricePreset, setPricePreset] = useState('all');
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const [editionId, setEditionId] = useState<string | null>(null);
  const [editionName, setEditionName] = useState('');
  const [cardLang, setCardLang] = useState<'' | 'FR' | 'EN'>('');
  const [editionModal, setEditionModal] = useState(false);
  const [editionQuery, setEditionQuery] = useState('');
  const [editions, setEditions] = useState<{ id: string; name: string }[]>([]);
  const [editionsLoading, setEditionsLoading] = useState(false);
  const [catalogResults, setCatalogResults] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const priceBounds = useMemo(() => {
    if (pricePreset === 'custom') {
      let min = parsePriceInput(priceMinInput);
      let max = parsePriceInput(priceMaxInput);
      if (min != null && max != null && min > max) {
        const swap = min;
        min = max;
        max = swap;
      }
      return { min, max };
    }
    const range = PRICE_RANGES.find((item) => item.id === pricePreset);
    return { min: range?.min ?? null, max: range?.max ?? null };
  }, [pricePreset, priceMinInput, priceMaxInput]);

  const hasPriceFilter = priceBounds.min != null || priceBounds.max != null;
  const hasCatalogFilters = hasPriceFilter || !!editionId || !!cardLang;
  const activeFilterCount = (hasPriceFilter ? 1 : 0) + (editionId ? 1 : 0) + (cardLang ? 1 : 0);

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

  const marketFilters = useMemo(() => ({
    editionId,
    lang: cardLang || null,
    minPrice: priceBounds.min,
    maxPrice: priceBounds.max,
    cardIds: onlyMyCards ? Array.from(ownedCardIds) : null,
  }), [editionId, cardLang, priceBounds.min, priceBounds.max, onlyMyCards, ownedCardIds]);

  // Recherche par nom, en tenant compte des filtres
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const { data, error } = await searchMarketCards({
          query: searchQuery,
          ...marketFilters,
          limit: 20,
        });
        setSearchResults(!error && data ? data : []);
        setIsSearching(false);
        setShowSuggestions(true);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(delaySearch);
  }, [searchQuery, marketFilters]);

  // Nom choisi : toutes les éditions de cette carte, dans la tranche et la collection
  useEffect(() => {
    if (!isFiltering || !filterName) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoadingFilteredCards(true);
      const { data, error } = await searchMarketCards({
        query: filterName,
        ...marketFilters,
        limit: 400,
      });
      if (cancelled) return;
      if (!error && data) {
        const exact = data.filter((card) => String(card.card_name).toLowerCase() === filterName.toLowerCase());
        setFilteredCards(exact.length > 0 ? exact : data);
      } else {
        setFilteredCards([]);
      }
      setIsLoadingFilteredCards(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isFiltering, filterName, marketFilters]);

  // Filtres sans nom : interroger les cotations, pas le top tronqué
  useEffect(() => {
    if (!hasCatalogFilters || isFiltering || searchQuery.trim().length >= 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCatalogLoading(true);
      const { data, error } = await searchMarketCards({
        ...marketFilters,
        limit: editionId ? 400 : 100,
      });
      if (cancelled) return;
      setCatalogResults(!error && data ? data : []);
      setCatalogLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasCatalogFilters, isFiltering, searchQuery, editionId, marketFilters]);

  const handleCardSelect = (cardName: string) => {
    setFilterName(cardName);
    setIsFiltering(true);
    setSearchQuery('');
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const clearFilter = () => {
    setIsFiltering(false);
    setFilterName('');
    setFilteredCards([]);
  };

  const clearCatalogFilters = () => {
    setPricePreset('all');
    setPriceMinInput('');
    setPriceMaxInput('');
    setEditionId(null);
    setEditionName('');
    setCardLang('');
  };

  const openEditionPicker = async () => {
    setEditionModal(true);
    if (editions.length > 0 || editionsLoading) return;
    setEditionsLoading(true);
    const { data, error } = await supabase
      .from('editions')
      .select('id, name')
      .order('name')
      .limit(1000);
    setEditions(!error && data ? data.filter((edition) => edition.name) : []);
    setEditionsLoading(false);
  };

  const priceChipLabel = (range: (typeof PRICE_RANGES)[number]) => {
    if (range.id === 'all') return t('market.priceAll');
    if (range.min == null && range.max != null) return t('market.priceUnder', { max: range.max });
    if (range.min != null && range.max == null) return t('market.priceOver', { min: range.min });
    return t('market.priceBetween', { min: range.min, max: range.max });
  };

  const visibleEditions = editions.filter((edition) =>
    edition.name.toLowerCase().includes(editionQuery.trim().toLowerCase())
  );

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

  const suggestionItems = applyOwnedFilter(searchResults);

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

      <View style={styles.filterRow}>
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

        <TouchableOpacity
          style={[
            styles.onlyMyCardsChip,
            {
              backgroundColor: hasCatalogFilters ? colors.primary : colors.surface,
              borderColor: hasCatalogFilters ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setShowFilters((open) => !open)}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={hasCatalogFilters ? '#FFFFFF' : colors.text.secondary}
            style={{ marginRight: 8 }}
          />
          <Text
            style={{
              color: hasCatalogFilters ? '#FFFFFF' : colors.text.primary,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {t('market.filters')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>{t('market.priceRange')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.priceChipRow}>
            {PRICE_RANGES.map((range) => {
              const selected = pricePreset === range.id;
              return (
                <TouchableOpacity
                  key={range.id}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setPricePreset(range.id);
                    setPriceMinInput('');
                    setPriceMaxInput('');
                  }}
                >
                  <Text style={{ color: selected ? '#FFFFFF' : colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {priceChipLabel(range)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.priceInputs}>
            <TextInput
              style={[styles.priceInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={t('market.priceMin')}
              placeholderTextColor={colors.text.secondary}
              keyboardType="decimal-pad"
              value={priceMinInput}
              onChangeText={(value) => {
                setPriceMinInput(value);
                setPricePreset('custom');
              }}
            />
            <TextInput
              style={[styles.priceInput, { color: colors.text.primary, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={t('market.priceMax')}
              placeholderTextColor={colors.text.secondary}
              keyboardType="decimal-pad"
              value={priceMaxInput}
              onChangeText={(value) => {
                setPriceMaxInput(value);
                setPricePreset('custom');
              }}
            />
          </View>

          <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>{t('market.collection')}</Text>
          <TouchableOpacity
            style={[styles.editionButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={openEditionPicker}
          >
            <Text style={{ color: editionName ? colors.text.primary : colors.text.secondary, flex: 1 }} numberOfLines={1}>
              {editionName || t('market.allCollections')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.text.secondary} />
          </TouchableOpacity>

          <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>{t('market.language')}</Text>
          <View style={styles.chipRow}>
            {([
              { id: '', label: t('market.langAll') },
              { id: 'FR', label: t('market.langFr') },
              { id: 'EN', label: t('market.langEn') },
            ] as const).map((option) => {
              const selected = cardLang === option.id;
              return (
                <TouchableOpacity
                  key={option.id || 'all'}
                  style={[
                    styles.choiceChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCardLang(option.id)}
                >
                  <Text style={{ color: selected ? '#FFFFFF' : colors.text.primary, fontSize: 13, fontWeight: '600' }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {hasCatalogFilters && (
            <TouchableOpacity onPress={clearCatalogFilters} style={styles.clearFiltersButton}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('market.clearFilters')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Suggestions de recherche */}
      {showSuggestions && suggestionItems.length > 0 ? (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface }]}>
          <FlatList
            data={suggestionItems}
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
                    {(item.edition_name || item.lang) && (
                      <Text style={{ color: colors.text.secondary, fontSize: 12 }} numberOfLines={1}>
                        {[item.edition_name, item.lang].filter(Boolean).join(' · ')}
                      </Text>
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
      
      {!showSuggestions && hasCatalogFilters && !isFiltering ? (
        <View style={{ flex: 1, padding: 8 }}>
          {catalogLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={applyOwnedFilter(catalogResults)}
              keyExtractor={(item) => item.card_id}
              renderItem={({ item }) => (
                <CardListItem
                  card={item}
                  colors={colors}
                  onPress={() => router.push(`/screens/card/${item.card_id}`)}
                />
              )}
              contentContainerStyle={{ paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 20 }}>
                  {onlyMyCards ? t('market.noOwnedInMarket') : t('market.noFilterResults')}
                </Text>
              }
            />
          )}
        </View>
      ) : !showSuggestions ? (
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
      ) : null}

      <Modal visible={editionModal} animationType="slide" onRequestClose={() => setEditionModal(false)}>
        <View style={[styles.modalPage, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{t('market.collection')}</Text>
            <TouchableOpacity onPress={() => setEditionModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.editionSearch, { color: colors.text.primary, backgroundColor: colors.surface }]}
            placeholder={t('market.searchCollection')}
            placeholderTextColor={colors.text.secondary}
            value={editionQuery}
            onChangeText={setEditionQuery}
            autoCorrect={false}
          />
          {editionsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={visibleEditions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              ListHeaderComponent={
                <TouchableOpacity
                  style={[styles.editionRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setEditionId(null);
                    setEditionName('');
                    setEditionModal(false);
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('market.allCollections')}</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.editionRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setEditionId(item.id);
                    setEditionName(item.name);
                    setEditionModal(false);
                  }}
                >
                  <Text style={{ color: item.id === editionId ? colors.primary : colors.text.primary, fontWeight: item.id === editionId ? '700' : '400' }}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  onlyMyCardsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  priceChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  priceInputs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  editionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  modalPage: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  editionSearch: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  editionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  suggestionsContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
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