import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, FlatList, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../lib/auth';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { getUserCardsCount, getUserEditionsCount, getUserCardsGroupedByEdition, getUserCollectionTotalValue, getCollectionPriceVariation } from '../lib/supabase';

interface CardProps {
  id: string;
  card_id: string;
  card_name: string;
  card_image: string;
  rarity: string;
  quantity: number;
  condition: string;
  is_for_sale: boolean;
  price: number;
}

interface EditionProps {
  id: string;
  name: string;
  logo_url: string;
  symbol_url: string;
  release_date: string;
  printed_total: number;
  total: number;
  cards: CardProps[];
}

// Enum pour les options de tri
enum SortOption {
  NAME_DESC = 'name_desc',
  NAME_ASC = 'name_asc',
  DATE_DESC = 'date_desc',
  DATE_ASC = 'date_asc',
  VALUE_DESC = 'value_desc',
  VALUE_ASC = 'value_asc',
  CARDS_DESC = 'cards_desc',
  CARDS_ASC = 'cards_asc',
}

// Type pour les catégories de tri
type SortCategory = 'name' | 'date' | 'value' | 'cards';

export default function CollectionScreen() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editions, setEditions] = useState<EditionProps[]>([]);
  const [filteredEditions, setFilteredEditions] = useState<EditionProps[]>([]);
  const [cardsCount, setCardsCount] = useState(0);
  const [editionsCount, setEditionsCount] = useState(0);
  const [totalCollectionValue, setTotalCollectionValue] = useState(0);
  const [valueVariation, setValueVariation] = useState(0); // Variation en pourcentage
  const [hideValues, setHideValues] = useState(false); // État pour gérer l'affichage/masquage des valeurs
  const [priceDetailsDebug, setPriceDetailsDebug] = useState<any>(null); // Pour le débogage
  
  // États pour les filtres et tri
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [editionNameFilter, setEditionNameFilter] = useState('');
  const [pokemonNameFilter, setPokemonNameFilter] = useState('');
  const [currentSortOption, setCurrentSortOption] = useState<SortOption>(SortOption.NAME_DESC);
  const [currentSortCategory, setCurrentSortCategory] = useState<SortCategory>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // États temporaires pour les filtres et le tri dans le modal
  const [tempEditionNameFilter, setTempEditionNameFilter] = useState('');
  const [tempPokemonNameFilter, setTempPokemonNameFilter] = useState('');
  const [tempSortOption, setTempSortOption] = useState<SortOption>(SortOption.NAME_DESC);
  const [tempSortCategory, setTempSortCategory] = useState<SortCategory>('name');
  const [tempSortDirection, setTempSortDirection] = useState<'asc' | 'desc'>('desc');

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener: any = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans CollectionScreen:', language);
        // Forcer un rafraîchissement du composant
        setRefreshKey(prev => prev + 1);
      }
    });
    
    setLanguageListener(listener);
    
    return () => {
      // Supprimer l'écouteur lors du démontage du composant
      if (languageListener) {
        EventRegister.removeEventListener(languageListener as string);
      }
    };
  }, []);

  // Écouter les changements de thème
  useEffect(() => {
    const themeListener: any = EventRegister.addEventListener('themeChanged', () => {
      console.log('Changement de thème détecté dans CollectionScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener as string);
      }
    };
  }, []);

  // Initialiser les valeurs temporaires quand le modal s'ouvre
  useEffect(() => {
    if (filterModalVisible) {
      setTempEditionNameFilter(editionNameFilter);
      setTempPokemonNameFilter(pokemonNameFilter);
      setTempSortOption(currentSortOption);
      setTempSortCategory(currentSortCategory);
      setTempSortDirection(sortDirection);
    }
  }, [filterModalVisible]);

  // Appliquer les filtres et tris
  useEffect(() => {
    if (editions.length === 0) return;

    let result = [...editions];

    // Filtrer par nom d'édition
    if (editionNameFilter.trim() !== '') {
      result = result.filter(edition => 
        edition.name.toLowerCase().includes(editionNameFilter.toLowerCase())
      );
    }

    // Filtrer par nom de Pokémon dans les cartes
    if (pokemonNameFilter.trim() !== '') {
      result = result.filter(edition => 
        edition.cards.some(card => 
          card.card_name.toLowerCase().includes(pokemonNameFilter.toLowerCase())
        )
      );
    }

    // Appliquer le tri
    result = sortEditions(result, currentSortOption);

    setFilteredEditions(result);
  }, [editions, editionNameFilter, pokemonNameFilter, currentSortOption]);

  // Appliquer les filtres temporaires lors du clic sur "Appliquer"
  const applyFilters = () => {
    setEditionNameFilter(tempEditionNameFilter);
    setPokemonNameFilter(tempPokemonNameFilter);
    setCurrentSortOption(tempSortOption);
    setCurrentSortCategory(tempSortCategory);
    setSortDirection(tempSortDirection);
    setFilterModalVisible(false);
  };

  // Fonction de tri des éditions
  const sortEditions = (editionsToSort: EditionProps[], sortOption: SortOption) => {
    const sorted = [...editionsToSort];

    switch (sortOption) {
      case SortOption.NAME_ASC:
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case SortOption.NAME_DESC:
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case SortOption.DATE_ASC:
        return sorted.sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());
      case SortOption.DATE_DESC:
        return sorted.sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime());
      case SortOption.VALUE_ASC:
        return sorted.sort((a, b) => calculateEditionValue(a.cards) - calculateEditionValue(b.cards));
      case SortOption.VALUE_DESC:
        return sorted.sort((a, b) => calculateEditionValue(b.cards) - calculateEditionValue(a.cards));
      case SortOption.CARDS_ASC:
        return sorted.sort((a, b) => getOwnedCardsCount(a.cards) - getOwnedCardsCount(b.cards));
      case SortOption.CARDS_DESC:
        return sorted.sort((a, b) => getOwnedCardsCount(b.cards) - getOwnedCardsCount(a.cards));
      default:
        return sorted;
    }
  };

  // Charger les données de la collection
  const loadCollectionData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Charger le nombre de cartes
      const cardsResult = await getUserCardsCount(user.id);
      if (!cardsResult.error) {
        setCardsCount(cardsResult.count || 0);
      }
      
      // Charger le nombre d'éditions
      const editionsResult = await getUserEditionsCount(user.id);
      if (!editionsResult.error) {
        setEditionsCount(editionsResult.count || 0);
      }
      
      // Charger la valeur totale de la collection
      const { totalValue: collectionValue, error: valueError } = await getUserCollectionTotalValue(user.id);
      if (!valueError) {
        setTotalCollectionValue(collectionValue);
        
        // Récupérer la variation de prix réelle de la collection
        const priceVariationResult = await getCollectionPriceVariation(user.id);
        if (!priceVariationResult.error) {
          setValueVariation(priceVariationResult.variation);
          // Pour le débogage
          setPriceDetailsDebug({
            currentTotal: priceVariationResult.currentTotal,
            previousTotal: priceVariationResult.previousTotal,
            cardsWithPrices: priceVariationResult.cardsWithPrices
          });
          console.log('Variation de prix collection:', priceVariationResult);
        } else {
          console.error("Erreur lors du calcul de la variation de prix:", priceVariationResult.error);
          setValueVariation(0);
        }
      }
      
      // Charger les cartes groupées par édition
      const collectionResult = await getUserCardsGroupedByEdition(user.id);
      if (!collectionResult.error && collectionResult.data) {
        setEditions(collectionResult.data);
        setFilteredEditions(collectionResult.data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données de collection:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Vérifier les changements de langue lorsque l'écran est focalisé
  useFocusEffect(
    useCallback(() => {
      async function checkLanguageChange() {
        const languageChanged = await AsyncStorage.getItem('@language_changed');
        if (languageChanged === 'true') {
          // Réinitialiser le flag
          await AsyncStorage.removeItem('@language_changed');
          console.log('Language has been changed, refreshing collection data...');
          // Force un rafraîchissement en incrémentant la clé
          setRefreshKey(prev => prev + 1);
        }
      }
      
      checkLanguageChange();
      loadCollectionData();
    }, [loadCollectionData, refreshKey])
  );
  
  // Calculer la valeur totale d'une édition
  const calculateEditionValue = (cards: CardProps[]) => {
    return cards.reduce((total, card) => {
      // Si le prix est défini et n'est pas null, on l'ajoute
      if (card.price !== undefined && card.price !== null) {
        return total + card.price;
      }
      // Sinon on n'ajoute rien
      return total;
    }, 0);
  };
  
  // Fonction pour calculer le nombre de cartes possédées dans une édition
  const getOwnedCardsCount = (cards: CardProps[]) => {
    return cards.length; // Toutes les cartes sont possédées avec une quantité de 1
  };
  
  // Format pour afficher une valeur monétaire
  const formatCurrency = (value: number) => {
    return value.toFixed(2) + ' €';
  };

  // Déterminer la couleur de la variation
  const getVariationColor = (variation: number) => {
    if (variation === 0) return colors.text.secondary; // Gris pour aucune variation
    return variation > 0 ? colors.success : colors.error;
  };

  // Format pour afficher la variation
  const formatVariation = (variation: number) => {
    if (variation === 0) return "0%";
    return (variation > 0 ? '+' : '') + variation.toFixed(2) + '%';
  };

  // Fonction pour basculer le tri d'une catégorie (maintenant utilise les états temporaires)
  const toggleSort = (category: SortCategory) => {
    // Si on clique sur la même catégorie, on inverse la direction
    if (category === tempSortCategory) {
      const newDirection = tempSortDirection === 'desc' ? 'asc' : 'desc';
      setTempSortDirection(newDirection);
      
      // Mettre à jour l'option de tri en fonction de la catégorie et de la direction
      if (category === 'name') {
        setTempSortOption(newDirection === 'desc' ? SortOption.NAME_DESC : SortOption.NAME_ASC);
      } else if (category === 'date') {
        setTempSortOption(newDirection === 'desc' ? SortOption.DATE_DESC : SortOption.DATE_ASC);
      } else if (category === 'value') {
        setTempSortOption(newDirection === 'desc' ? SortOption.VALUE_DESC : SortOption.VALUE_ASC);
      } else if (category === 'cards') {
        setTempSortOption(newDirection === 'desc' ? SortOption.CARDS_DESC : SortOption.CARDS_ASC);
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
      } else if (category === 'date') {
        setTempSortOption(SortOption.DATE_DESC);
      } else if (category === 'value') {
        setTempSortOption(SortOption.VALUE_DESC);
      } else if (category === 'cards') {
        setTempSortOption(SortOption.CARDS_DESC);
      }
    }
  };

  // Fonction pour réinitialiser les filtres temporaires
  const resetTempFilters = () => {
    setTempEditionNameFilter('');
    setTempPokemonNameFilter('');
    setTempSortOption(SortOption.NAME_DESC);
    setTempSortCategory('name');
    setTempSortDirection('desc');
  };

  // Fonction pour réinitialiser les filtres appliqués
  const resetAppliedFilters = () => {
    setEditionNameFilter('');
    setPokemonNameFilter('');
    setCurrentSortOption(SortOption.NAME_DESC);
    setCurrentSortCategory('name');
    setSortDirection('desc');
  };

  // Composant pour une option de tri (utilise maintenant les états temporaires)
  const SortOptionItem = ({ title, category, icon }: { title: string, category: SortCategory, icon: string }) => {
    const isActive = tempSortCategory === category;
    const arrowIcon = tempSortDirection === 'desc' ? 'arrow-downward' : 'arrow-upward';
    
    return (
      <TouchableOpacity 
        style={[
          styles.sortOptionItem,
          isActive ? { backgroundColor: colors.primaryLight } : {}
        ]} 
        onPress={() => toggleSort(category)}
      >
        <View style={styles.sortOptionContent}>
          <MaterialIcons name={icon as any} size={20} color={isActive ? colors.primary : colors.text.secondary} />
          <Text style={[
            styles.sortOptionText, 
            { color: isActive ? colors.primary : colors.text.primary }
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

  // Modal de filtres (mise à jour pour utiliser les états temporaires)
  const FilterModal = () => (
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
                  <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Filtres et tri</Text>
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
                  <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Filtres</Text>
                  
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>Nom de l'édition</Text>
                    <TextInput
                      style={[styles.filterInput, { backgroundColor: colors.background, color: colors.text.primary, borderColor: colors.border }]}
                      value={tempEditionNameFilter}
                      onChangeText={setTempEditionNameFilter}
                      placeholder="Rechercher une édition..."
                      placeholderTextColor={colors.text.secondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                  
                  <View style={styles.filterSection}>
                    <Text style={[styles.filterLabel, { color: colors.text.secondary }]}>Nom du Pokémon</Text>
                    <TextInput
                      style={[styles.filterInput, { backgroundColor: colors.background, color: colors.text.primary, borderColor: colors.border }]}
                      value={tempPokemonNameFilter}
                      onChangeText={setTempPokemonNameFilter}
                      placeholder="Rechercher un Pokémon..."
                      placeholderTextColor={colors.text.secondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>

                  <Text style={[styles.sectionTitle, { color: colors.text.primary, marginTop: 20 }]}>Trier par</Text>
                  
                  <View style={styles.sortOptionsContainer}>
                    <SortOptionItem title="Nom" category="name" icon="sort-by-alpha" />
                    <SortOptionItem title="Date de sortie" category="date" icon="calendar-today" />
                    <SortOptionItem title="Valeur" category="value" icon="attach-money" />
                    <SortOptionItem title="Nombre de cartes" category="cards" icon="format-list-numbered" />
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity 
                    style={[styles.resetButton, { borderColor: colors.border }]} 
                    onPress={resetTempFilters}
                  >
                    <Text style={[styles.resetButtonText, { color: colors.text.primary }]}>Réinitialiser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.applyButton, { backgroundColor: colors.primary }]} 
                    onPress={applyFilters}
                  >
                    <Text style={styles.applyButtonText}>Appliquer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('home.collection')}</Text>
        <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      <FilterModal />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            {t('general.loading')}
          </Text>
        </View>
      ) : filteredEditions.length > 0 ? (
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.collectionSummary}>
            <View style={[styles.valueContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.valueHeader}>
                <Text style={[styles.valueLabel, { color: colors.text.secondary }]}>{t('home.currentValue')}</Text>
                <TouchableOpacity onPress={() => setHideValues(!hideValues)}>
                  <Ionicons name={hideValues ? "eye-off-outline" : "eye-outline"} size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.valueAmount, { color: colors.text.primary }]}>
                {hideValues ? "******" : formatCurrency(totalCollectionValue)}
              </Text>
              
              <View style={styles.valueChange}>
                <Text style={[
                  styles.valueChangeText, 
                  { color: getVariationColor(valueVariation) }
                ]}>
                  {hideValues ? "***" : formatVariation(valueVariation)}
                </Text>
                <Text style={[styles.valuePeriod, { color: colors.text.secondary }]}>
                  {t('settings.alerts.lastWeek')}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.text.primary }]}>{cardsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.cards')}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.text.primary }]}>{editionsCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.editions')}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.text.primary }]}>0</Text>
              <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{t('home.sold')}</Text>
            </View>
          </View>
          
          {/* Afficher un message si des filtres sont appliqués */}
          {(editionNameFilter || pokemonNameFilter) && (
            <View style={[styles.filterInfo, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.filterInfoText, { color: colors.primary }]}>
                {filteredEditions.length} résultat(s) pour vos filtres
              </Text>
              <TouchableOpacity 
                onPress={() => resetAppliedFilters()}
              >
                <Text style={[styles.clearFiltersText, { color: colors.primary }]}>Effacer</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {filteredEditions.map(item => {
            const editionValue = calculateEditionValue(item.cards);
            const ownedCards = getOwnedCardsCount(item.cards);
            const totalCards = item.printed_total || item.total || item.cards.length;
            
            return (
              <View key={item.id} style={[styles.editionContainer, { backgroundColor: colors.surface }]}>
                <TouchableOpacity 
                  style={styles.editionHeader}
                  onPress={() => {
                    // @ts-ignore - Contournement des erreurs de TypeScript pour la navigation
                    router.push("../screens/edition/" + item.id);
                  }}
                >
                  <View style={styles.editionTitleContainer}>
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={styles.editionLogo} resizeMode="contain" />
                    ) : (
                      <Text style={[styles.editionName, { color: colors.text.primary }]}>{item.name}</Text>
                    )}
                    {item.symbol_url && (
                      <Image source={{ uri: item.symbol_url }} style={styles.editionSymbol} resizeMode="contain" />
                    )}
                  </View>
                  
                  <View style={styles.editionStatsContainer}>
                    <Text style={[styles.editionValue, { color: colors.secondary }]}>
                      {hideValues ? "***" : editionValue.toFixed(2) + " €"}
                    </Text>
                    <Text style={[styles.editionCardCount, { color: colors.text.secondary }]}>
                      {ownedCards} / {totalCards} {t('home.cards')}
                    </Text>
                  </View>
                  
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={colors.text.secondary} 
                  />
                </TouchableOpacity>
              </View>
            );
          })}
          
          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : editions.length > 0 ? (
        <View style={styles.emptySearch}>
          <Ionicons name="search" size={64} color={colors.text.secondary} />
          <Text style={[styles.emptySearchTitle, { color: colors.text.primary }]}>Aucun résultat</Text>
          <Text style={[styles.emptySearchText, { color: colors.text.secondary }]}>
            Aucune édition ne correspond à vos critères de recherche.
          </Text>
          <TouchableOpacity 
            style={[styles.resetFiltersButton, { backgroundColor: colors.primary }]}
            onPress={() => resetAppliedFilters()}
          >
            <Text style={styles.resetFiltersButtonText}>Réinitialiser les filtres</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emptyCollection}>
          <Ionicons name="folder-open-outline" size={80} color={colors.text.secondary} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{t('collection.empty')}</Text>
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {t('collection.emptyText')}
          </Text>
        </View>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');

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
  collectionSummary: {
    paddingVertical: 16,
    width: '100%',
  },
  valueContainer: {
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  valueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 16,
  },
  valueAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  valueChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueChangeText: {
    fontSize: 16,
    marginRight: 8,
  },
  valuePeriod: {
    fontSize: 14,
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
  },
  statItem: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120, // Augmenter le padding en bas pour éviter les problèmes avec le menu
  },
  editionContainer: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    width: '100%',
  },
  editionHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editionTitleContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editionStatsContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  editionLogo: {
    height: 35,
    width: 120,
    marginRight: 8,
  },
  editionSymbol: {
    height: 20,
    width: 20,
  },
  editionName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editionCardCount: {
    fontSize: 12,
  },
  editionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyCollection: {
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
  },
  bottomPadding: {
    height: 50,
  },
  // Styles pour le modal et les filtres
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScrollContent: {
    paddingHorizontal: 20,
  },
  modalScrollContentContainer: {
    paddingBottom: 20,
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
  },
  sortOptionsContainer: {
    marginBottom: 20,
  },
  sortOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
  filterInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  filterInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  emptySearch: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptySearchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySearchText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  resetFiltersButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetFiltersButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 