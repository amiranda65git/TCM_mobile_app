import React, { useState, useEffect, createContext } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, FlatList, Image, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { TabView, SceneMap, TabBar, Route } from 'react-native-tab-view';
import { useThemeColors } from '../lib/ThemeUtils';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons, Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { getUserCardsForSale, getCardsForSaleFromOthers } from '../lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { EventRegister } from 'react-native-event-listeners';

// Enum pour les options de tri
enum SortOption {
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

// Type pour les catégories de tri
type SortCategory = 'name' | 'price';

// Interface pour le contexte de filtrage
interface TradingFilterContextType {
  cardNameFilter: string;
  editionNameFilter: string;
  currentSortOption: SortOption;
}

// Créer le contexte de filtrage avec des valeurs par défaut
const TradingFilterContext = createContext<TradingFilterContextType>({
  cardNameFilter: '',
  editionNameFilter: '',
  currentSortOption: SortOption.NAME_DESC,
});

const BuyTab = () => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [allCards, setAllCards] = React.useState<any[]>([]);
  const [filteredCards, setFilteredCards] = React.useState<any[]>([]);

  // Accéder aux états de filtres et tri du parent
  const { 
    cardNameFilter, 
    editionNameFilter, 
    currentSortOption 
  } = React.useContext(TradingFilterContext);

  // Fonction pour charger les données
  const loadData = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await getCardsForSaleFromOthers(user.id);
    setAllCards(data || []);
    setFilteredCards(data || []);
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Écouter les changements de données
  React.useEffect(() => {
    const listener = EventRegister.addEventListener('trading_data_changed', () => {
      console.log('BuyTab: Données de trading changées, rechargement...');
      loadData();
    });

    return () => {
      if (typeof listener === 'string') {
        EventRegister.removeEventListener(listener);
      }
    };
  }, [loadData]);

  // Appliquer les filtres quand ils changent
  React.useEffect(() => {
    if (allCards.length === 0) return;
    
    let result = [...allCards];
    
    // Filtrer par nom de carte
    if (cardNameFilter.trim()) {
      result = result.filter(card => 
        card.card_name.toLowerCase().includes(cardNameFilter.toLowerCase())
      );
    }
    
    // Filtrer par nom d'édition
    if (editionNameFilter.trim()) {
      result = result.filter(card => 
        card.edition_name && card.edition_name.toLowerCase().includes(editionNameFilter.toLowerCase())
      );
    }
    
    // Appliquer le tri
    result = sortCards(result, currentSortOption);
    
    setFilteredCards(result);
  }, [allCards, cardNameFilter, editionNameFilter, currentSortOption]);

  // Fonction de tri des cartes
  const sortCards = (cardsToSort: any[], sortOption: SortOption) => {
    const sorted = [...cardsToSort];
    
    switch (sortOption) {
      case SortOption.NAME_ASC:
        return sorted.sort((a, b) => a.card_name.localeCompare(b.card_name));
      case SortOption.NAME_DESC:
        return sorted.sort((a, b) => b.card_name.localeCompare(a.card_name));
      case SortOption.PRICE_ASC:
        return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      case SortOption.PRICE_DESC:
        return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      default:
        return sorted;
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={colors.secondary} style={{ marginTop: 40 }} />;
  }

  if (!filteredCards.length) {
    return (
      <View style={[styles.tabContent, { backgroundColor: colors.background }]}> 
        <Feather name="shopping-cart" size={40} color={colors.text.secondary} style={{ marginBottom: 12 }} />
        <Text style={[styles.contentText, { color: colors.text.secondary, textAlign: 'center' }]}>{t('trading.no_cards_to_buy', 'Aucune carte à acheter actuellement.')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredCards}
      keyExtractor={item => item.user_card_id}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: colors.surface, marginBottom: 8 }}
          onPress={() => router.push(`/screens/market-prices/card-marketplace?id=${item.card_id}`)}
        >
          {item.image_small ? (
            <Image source={{ uri: item.image_small }} style={{ width: 40, height: 56, borderRadius: 4, marginRight: 12 }} resizeMode="contain" />
          ) : (
            <View style={{ width: 40, height: 56, borderRadius: 4, marginRight: 12, backgroundColor: colors.background, opacity: 0.5 }} />
          )}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontWeight: 'bold', fontSize: 16 }} numberOfLines={1}>{item.card_name}</Text>
              {item.edition_name && (
                <Text style={{ color: colors.text.secondary, fontSize: 12 }} numberOfLines={1}>{item.edition_name}</Text>
              )}
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                {t('card.condition')}: {item.condition || '-'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.secondary, fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>
                {item.price?.toFixed(2)} €
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 11, marginLeft: 8 }}>
                Market price: {item.market_price_mid !== null && item.market_price_mid !== undefined ? `${item.market_price_mid.toFixed(2)} €` : '-'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
};

const SellTab = () => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [allCards, setAllCards] = React.useState<any[]>([]);
  const [filteredCards, setFilteredCards] = React.useState<any[]>([]);
  const [offersCount, setOffersCount] = React.useState<{ [userCardId: string]: number }>({});

  // Accéder aux états de filtres et tri du parent
  const { 
    cardNameFilter, 
    editionNameFilter, 
    currentSortOption 
  } = React.useContext(TradingFilterContext);

  // Fonction pour charger les données
  const loadData = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await getUserCardsForSale(user.id);
    setAllCards(data || []);
    setFilteredCards(data || []);
    setLoading(false);
    // Récupérer le nombre d'offres pour chaque carte
    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.user_card_id);
      const { data: offersData, error } = await supabase
        .from('offers')
        .select('user_card_id')
        .in('user_card_id', ids);
      if (!error && offersData) {
        const map: { [userCardId: string]: number } = {};
        offersData.forEach((o: any) => {
          map[o.user_card_id] = (map[o.user_card_id] || 0) + 1;
        });
        setOffersCount(map);
      }
    }
  }, [user?.id]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Écouter les changements de données
  React.useEffect(() => {
    const listener = EventRegister.addEventListener('trading_data_changed', () => {
      console.log('SellTab: Données de trading changées, rechargement...');
      loadData();
    });

    return () => {
      if (typeof listener === 'string') {
        EventRegister.removeEventListener(listener);
      }
    };
  }, [loadData]);

  // Appliquer les filtres quand ils changent
  React.useEffect(() => {
    if (allCards.length === 0) return;
    
    let result = [...allCards];
    
    // Filtrer par nom de carte
    if (cardNameFilter.trim()) {
      result = result.filter(card => 
        card.card_name.toLowerCase().includes(cardNameFilter.toLowerCase())
      );
    }
    
    // Filtrer par nom d'édition
    if (editionNameFilter.trim()) {
      result = result.filter(card => 
        card.edition_name && card.edition_name.toLowerCase().includes(editionNameFilter.toLowerCase())
      );
    }
    
    // Appliquer le tri
    result = sortCards(result, currentSortOption);
    
    setFilteredCards(result);
  }, [allCards, cardNameFilter, editionNameFilter, currentSortOption]);

  // Fonction de tri des cartes
  const sortCards = (cardsToSort: any[], sortOption: SortOption) => {
    const sorted = [...cardsToSort];
    
    switch (sortOption) {
      case SortOption.NAME_ASC:
        return sorted.sort((a, b) => a.card_name.localeCompare(b.card_name));
      case SortOption.NAME_DESC:
        return sorted.sort((a, b) => b.card_name.localeCompare(a.card_name));
      case SortOption.PRICE_ASC:
        return sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      case SortOption.PRICE_DESC:
        return sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      default:
        return sorted;
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={colors.secondary} style={{ marginTop: 40 }} />;
  }

  if (!filteredCards.length) {
    return (
      <View style={[styles.tabContent, { backgroundColor: colors.background }]}> 
        <Ionicons name="pricetag" size={40} color={colors.text.secondary} style={{ marginBottom: 12 }} />
        <Text style={[styles.contentText, { color: colors.text.secondary, textAlign: 'center' }]}>Aucune carte en vente actuellement.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredCards}
      keyExtractor={item => item.user_card_id}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: colors.surface, marginBottom: 8 }}
          onPress={() => router.push(`/screens/market-prices/card-sell-details?id=${item.user_card_id}`)}
        >
          {item.image_small ? (
            <Image source={{ uri: item.image_small }} style={{ width: 40, height: 56, borderRadius: 4, marginRight: 12 }} resizeMode="contain" />
          ) : (
            <View style={{ width: 40, height: 56, borderRadius: 4, marginRight: 12, backgroundColor: colors.background, opacity: 0.5 }} />
          )}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text.primary, fontWeight: 'bold', fontSize: 16 }} numberOfLines={1}>{item.card_name}</Text>
              {item.edition_name && (
                <Text style={{ color: colors.text.secondary, fontSize: 12 }} numberOfLines={1}>{item.edition_name}</Text>
              )}
              <Text style={{ color: colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                {t('card.condition')}: {item.condition || '-'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.secondary, fontWeight: 'bold', fontSize: 15, marginLeft: 8 }}>
                {item.price?.toFixed(2)} €
              </Text>
              <Text style={{ color: colors.text.secondary, fontSize: 11, marginLeft: 8 }}>
                Market price: {item.market_price_mid !== null && item.market_price_mid !== undefined ? `${item.market_price_mid.toFixed(2)} €` : '-'}
              </Text>
            </View>
            {offersCount[item.user_card_id] > 0 && (
              <View style={{ backgroundColor: colors.success, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8, paddingHorizontal: 6 }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{offersCount[item.user_card_id]}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
};

interface TradingRoute extends Route {
  key: string;
  title: string;
}

export default function TradingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { tab } = useLocalSearchParams();
  
  // Déterminer l'index initial basé sur le paramètre tab
  const getInitialIndex = () => {
    if (tab === 'sell') return 1;
    return 0; // 'buy' par défaut
  };
  
  const [index, setIndex] = useState(getInitialIndex());
  const [routes] = useState<TradingRoute[]>([
    { key: 'buy', title: t('trading.buy') },
    { key: 'sell', title: t('trading.sell') },
  ]);

  // États pour les filtres et tri
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cardNameFilter, setCardNameFilter] = useState('');
  const [editionNameFilter, setEditionNameFilter] = useState('');
  const [currentSortOption, setCurrentSortOption] = useState<SortOption>(SortOption.NAME_DESC);
  const [currentSortCategory, setCurrentSortCategory] = useState<SortCategory>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // États temporaires pour les filtres et le tri dans le modal
  const [tempCardNameFilter, setTempCardNameFilter] = useState('');
  const [tempEditionNameFilter, setTempEditionNameFilter] = useState('');
  const [tempSortOption, setTempSortOption] = useState<SortOption>(SortOption.NAME_DESC);
  const [tempSortCategory, setTempSortCategory] = useState<SortCategory>('name');
  const [tempSortDirection, setTempSortDirection] = useState<'asc' | 'desc'>('desc');

  // Créer l'objet de contexte de filtrage à partager avec les onglets
  const filterContext = {
    cardNameFilter,
    editionNameFilter,
    currentSortOption,
  };

  // Créer un mapping des scènes personnalisé pour pouvoir redéfinir les composants avec le contexte
  const renderScene = ({ route }: { route: Route }) => {
    switch (route.key) {
      case 'buy':
        return <BuyTab />;
      case 'sell':
        return <SellTab />;
      default:
        return null;
    }
  };

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={{ backgroundColor: colors.secondary }}
      style={{ backgroundColor: colors.surface }}
      activeColor={colors.secondary}
      inactiveColor={colors.text.secondary}
      renderLabel={({ route, focused, color }: { route: TradingRoute; focused: boolean; color: string }) => (
        <View style={styles.tabLabelContainer}>
          {route.key === 'buy' ? (
            <Feather name="shopping-cart" size={16} color={color} style={styles.tabIcon} />
          ) : (
            <MaterialCommunityIcons name="tag-outline" size={16} color={color} style={styles.tabIcon} />
          )}
          <Text style={[styles.tabLabel, { color }]}> 
            {route.title}
          </Text>
        </View>
      )}
    />
  );

  // Fonction pour basculer le tri d'une catégorie
  const toggleSort = (category: SortCategory) => {
    // Si on clique sur la même catégorie, on inverse la direction
    if (category === tempSortCategory) {
      const newDirection = tempSortDirection === 'desc' ? 'asc' : 'desc';
      setTempSortDirection(newDirection);
      
      // Mettre à jour l'option de tri en fonction de la catégorie et de la direction
      if (category === 'name') {
        setTempSortOption(newDirection === 'desc' ? SortOption.NAME_DESC : SortOption.NAME_ASC);
      } else if (category === 'price') {
        setTempSortOption(newDirection === 'desc' ? SortOption.PRICE_DESC : SortOption.PRICE_ASC);
      }
    } 
    // Si on clique sur une nouvelle catégorie, on la définit comme catégorie actuelle
    // et on commence par un tri descendant
    else {
      setTempSortCategory(category);
      setTempSortDirection('desc');
      
      // Définir l'option de tri correspondante
      if (category === 'name') {
        setTempSortOption(SortOption.NAME_DESC);
      } else if (category === 'price') {
        setTempSortOption(SortOption.PRICE_DESC);
      }
    }
  };

  // Initialiser les valeurs temporaires quand le modal s'ouvre
  useEffect(() => {
    if (filterModalVisible) {
      setTempCardNameFilter(cardNameFilter);
      setTempEditionNameFilter(editionNameFilter);
      setTempSortOption(currentSortOption);
      setTempSortCategory(currentSortCategory);
      setTempSortDirection(sortDirection);
    }
  }, [filterModalVisible, cardNameFilter, editionNameFilter, currentSortOption, currentSortCategory, sortDirection]);

  // Appliquer les filtres
  const applyFilters = () => {
    setCardNameFilter(tempCardNameFilter);
    setEditionNameFilter(tempEditionNameFilter);
    setCurrentSortOption(tempSortOption);
    setCurrentSortCategory(tempSortCategory);
    setSortDirection(tempSortDirection);
    setFilterModalVisible(false);
  };

  // Réinitialiser les filtres temporaires
  const resetTempFilters = () => {
    setTempCardNameFilter('');
    setTempEditionNameFilter('');
    setTempSortOption(SortOption.NAME_DESC);
    setTempSortCategory('name');
    setTempSortDirection('desc');
  };

  // Réinitialiser les filtres appliqués
  const resetAppliedFilters = () => {
    setCardNameFilter('');
    setEditionNameFilter('');
    setCurrentSortOption(SortOption.NAME_DESC);
    setCurrentSortCategory('name');
    setSortDirection('desc');
    
    // Réinitialiser aussi les filtres temporaires
    resetTempFilters();
  };

  // Composant pour une option de tri
  const SortOptionItem = ({ title, category, icon }: { title: string, category: SortCategory, icon: string }) => {
    const isActive = tempSortCategory === category;
    const arrowIcon = tempSortDirection === 'desc' ? 'arrow-downward' : 'arrow-upward';
    
    return (
      <TouchableOpacity 
        style={[
          styles.sortOptionItem,
          { 
            backgroundColor: isActive ? colors.background : 'transparent',
            borderColor: isActive ? colors.primary : colors.border,
            borderRadius: 8,
            marginBottom: 8
          }
        ]} 
        onPress={() => toggleSort(category)}
      >
        <View style={styles.sortOptionContent}>
          <MaterialIcons name={icon as any} size={20} color={isActive ? colors.primary : colors.text.secondary} />
          <Text style={[
            styles.sortOptionText, 
            { color: isActive ? colors.primary : colors.text.primary, marginLeft: 8 }
          ]}>
            {title}
          </Text>
        </View>
        {isActive && (
          <MaterialIcons name={arrowIcon} size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // Remplacement du FilterModal pour reprendre le look & feel de collection.tsx
  const FilterModal = () => {
    // Initialiser les valeurs locales seulement une fois quand la modale s'ouvre
    const [localCardFilter, setLocalCardFilter] = useState('');
    const [localEditionFilter, setLocalEditionFilter] = useState('');
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Initialiser les valeurs seulement quand la modale s'ouvre pour la première fois
    useEffect(() => {
      if (filterModalVisible && !isInitialized) {
        setLocalCardFilter(tempCardNameFilter);
        setLocalEditionFilter(tempEditionNameFilter);
        setIsInitialized(true);
      } else if (!filterModalVisible) {
        setIsInitialized(false);
      }
    }, [filterModalVisible, tempCardNameFilter, tempEditionNameFilter, isInitialized]);
    
    const handleApply = () => {
      setCardNameFilter(localCardFilter);
      setEditionNameFilter(localEditionFilter);
      setCurrentSortOption(tempSortOption);
      setCurrentSortCategory(tempSortCategory);
      setSortDirection(tempSortDirection);
      setFilterModalVisible(false);
    };
    
    const handleReset = () => {
      setLocalCardFilter('');
      setLocalEditionFilter('');
      setTempSortOption(SortOption.NAME_DESC);
      setTempSortCategory('name');
      setTempSortDirection('desc');
    };
    
    return (
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
        statusBarTranslucent={true}
        hardwareAccelerated={true}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}> 
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{t('trading.filters.title')}</Text>
                    <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                      <Ionicons name="close" size={24} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView 
                    style={styles.modalScrollContent} 
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                  >
                    <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('trading.filters.filters', 'Filters')}</Text>
                    <View style={styles.filterSection}>
                      <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>{t('trading.filters.cardName')}</Text>
                      <TextInput
                        style={[styles.filterInput, { backgroundColor: colors.background, color: colors.text.primary, borderColor: colors.border }]}
                        value={localCardFilter}
                        onChangeText={setLocalCardFilter}
                        placeholder={t('trading.filters.cardNamePlaceholder')}
                        placeholderTextColor={colors.text.secondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                    </View>
                    <View style={styles.filterSection}>
                      <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>{t('trading.filters.editionName')}</Text>
                      <TextInput
                        style={[styles.filterInput, { backgroundColor: colors.background, color: colors.text.primary, borderColor: colors.border }]}
                        value={localEditionFilter}
                        onChangeText={setLocalEditionFilter}
                        placeholder={t('trading.filters.editionNamePlaceholder')}
                        placeholderTextColor={colors.text.secondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text.primary, marginTop: 20 }]}>{t('trading.filters.sortBy')}</Text>
                    <View style={styles.sortOptionsContainer}>
                      <SortOptionItem title={t('trading.filters.sortName')} category="name" icon="sort-by-alpha" />
                      <SortOptionItem title={t('trading.filters.sortPrice')} category="price" icon="attach-money" />
                    </View>
                  </ScrollView>
                  <View style={styles.modalFooter}>
                    <TouchableOpacity 
                      style={[styles.resetButton, { borderColor: colors.border }]} 
                      onPress={handleReset}
                    >
                      <Text style={[styles.resetButtonText, { color: colors.text.primary }]}>{t('trading.filters.reset')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.applyButton, { backgroundColor: colors.primary }]} 
                      onPress={handleApply}
                    >
                      <Text style={styles.applyButtonText}>{t('trading.filters.apply')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <TradingFilterContext.Provider value={filterContext}>
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{t('trading.title', 'Trading')}</Text>
          <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.filterIconButton}>
            <Ionicons name="options-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <FilterModal />
        
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: Dimensions.get('window').width }}
          renderTabBar={renderTabBar}
          style={styles.tabView}
        />
      </View>
    </TradingFilterContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  filterIconButton: {
    padding: 8,
  },
  tabView: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentText: {
    fontSize: 16,
  },
  tabLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabIcon: {
    marginRight: 6,
  },
  tabLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortOptionText: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '85%',
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScrollContent: {
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 0,
  },
  sortOptionsContainer: {
    marginBottom: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 20,
  },
  resetButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 