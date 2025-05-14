import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Linking, SafeAreaView, Platform, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../lib/auth';
import { 
  getUserProfile, 
  getUserEditionsCount, 
  getUserCardsCount, 
  getUserAvatar, 
  getUserCollectionTotalValue, 
  getUserWishlist, 
  getCollectionPriceVariation,
  supabase
} from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideValues, setHideValues] = useState(false);
  const [editionsCount, setEditionsCount] = useState(0);
  const [cardsCount, setCardsCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [valueVariation, setValueVariation] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [priceDetailsDebug, setPriceDetailsDebug] = useState<any>(null); // Pour le débogage
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener: any = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans HomeScreen:', language);
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
      console.log('Changement de thème détecté dans HomeScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener as string);
      }
    };
  }, []);

  // Charge les données utilisateur à chaque fois que l'écran est focalisé
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen is focused, refreshing user data...');
      
      async function loadUserData() {
        if (user) {
          try {
            // Vérifier si la langue a changé
            const languageChanged = await AsyncStorage.getItem('@language_changed');
            if (languageChanged === 'true') {
              // Réinitialiser le flag
              await AsyncStorage.removeItem('@language_changed');
              console.log('Language has been changed, refreshing data...');
              // Force un rafraîchissement en incrémentant la clé
              setRefreshKey(prev => prev + 1);
            }
            
            // Essayer de récupérer l'avatar depuis le stockage local
            const localAvatar = await AsyncStorage.getItem('@user_avatar');
            if (localAvatar) {
              setAvatar(localAvatar);
            }
            
            console.log("Récupération du profil utilisateur pour ID:", user.id);
            
            // Récupérer les données de l'utilisateur depuis la base de données en utilisant la fonction centralisée
            const { data, error } = await getUserProfile(user.id, 'username, avatar_url');
              
            console.log("Données du profil reçues:", data);
              
            if (data && typeof data === 'object') {
              const userData = data as Record<string, any>;
              
              if (userData.username) {
                console.log("Username trouvé dans la base de données:", userData.username);
                setUsername(userData.username);
              } else {
                // Utiliser l'email comme solution de secours uniquement si aucun username n'est trouvé
                console.log("Aucun username trouvé, utilisation de l'email comme fallback");
                const defaultUsername = user.email?.split('@')[0] || 'User';
                setUsername(defaultUsername);
              }
              
              if (userData.avatar_url) {
                setAvatar(userData.avatar_url);
                await AsyncStorage.setItem('@user_avatar', userData.avatar_url);
              }
            } else if (error) {
              console.error("Erreur lors de la récupération des données utilisateur:", error);
              
              // Vérifier directement le contenu de la table users
              console.log("Tentative de récupération directe depuis la table users");
              const { data: directUserData, error: directError } = await supabase
                .from('users')
                .select('username, avatar_url')
                .eq('id', user.id)
                .single();
                
              if (!directError && directUserData && directUserData.username) {
                console.log("Username récupéré directement:", directUserData.username);
                setUsername(directUserData.username);
                if (directUserData.avatar_url) {
                  setAvatar(directUserData.avatar_url);
                }
              } else {
                // Utiliser l'email comme solution de secours uniquement en cas d'erreur
                console.log("Échec de récupération directe, utilisation de l'email comme fallback:", user.email);
                const defaultUsername = user.email?.split('@')[0] || 'User';
                setUsername(defaultUsername);
              }
            }

            // Récupérer le nombre d'éditions en utilisant la fonction centralisée
            const { count: editionsCountData } = await getUserEditionsCount(user.id);
            setEditionsCount(editionsCountData);

            // Récupérer le nombre total de cartes en utilisant la fonction centralisée
            const { count: cardsCountData } = await getUserCardsCount(user.id);
            setCardsCount(cardsCountData);

            // Récupérer la valeur totale de la collection
            const { totalValue: collectionValue, error: valueError } = await getUserCollectionTotalValue(user.id);
            if (!valueError) {
              setTotalValue(collectionValue);
              
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
                console.log('Variation de prix:', priceVariationResult);
              } else {
                console.error("Erreur lors du calcul de la variation de prix:", priceVariationResult.error);
                setValueVariation(0);
              }
            }

            // Récupérer le nombre de notifications non lues
            const { count: notificationsCount, error: notificationsError } = 
              await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id)
                .eq('is_read', false);
            
            if (!notificationsError) {
              setUnreadNotificationsCount(notificationsCount || 0);
            }

          } catch (error) {
            console.error("Erreur lors du chargement des données utilisateur:", error);
          }
        }
      }
      
      loadUserData();
      
      // La fonction retournée sera exécutée lors du nettoyage de l'effet
      return () => {
        console.log('Home screen is unfocused');
      };
    }, [user, refreshKey])
  );

  useEffect(() => {
    const fetchWishlistCount = async () => {
      if (user) {
        const { data } = await getUserWishlist(user.id);
        setWishlistCount(data.length);
      }
    };
    fetchWishlistCount();
  }, [user]);

  // Load initial data on component mount
  useEffect(() => {
    // Le code existant reste ici comme sauvegarde, mais l'effet useFocusEffect ci-dessus
    // prendra le relais pour les rafraîchissements lors des navigations
  }, []);

  // Ajouter une vérification supplémentaire pour s'assurer que le bon username est toujours affiché
  useEffect(() => {
    if (user && username) {
      // Comparer le username actuellement affiché avec celui stocké dans la base de données
      // Cette vérification est nécessaire car il peut y avoir un décalage entre les données
      // d'authentification et les données du profil utilisateur
      const verifyUsername = async () => {
        try {
          // Vérifier directement dans la table des utilisateurs
          const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .single();
            
          // Si un username différent est trouvé dans la base, utiliser celui-ci
          if (!error && data && data.username && data.username !== username) {
            console.log(`Correction du username: "${username}" remplacé par "${data.username}"`);
            setUsername(data.username);
          }
        } catch (err) {
          console.error('Erreur lors de la vérification du username:', err);
        }
      };
      
      // Exécuter la vérification
      verifyUsername();
    }
  }, [user, username]);

  // Format pour afficher une valeur monétaire
  const formatCurrency = (value: number) => {
    return value.toFixed(2).replace('.', ',') + ' €';
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

  const CollectionCard = () => (
    <View style={[styles.collectionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.collectionHeader}>
        <Text style={[styles.currentValue, { color: colors.text.secondary }]}>{t('home.currentValue')}</Text>
        <TouchableOpacity onPress={() => setHideValues(!hideValues)}>
          <Ionicons name={hideValues ? "eye-off-outline" : "eye-outline"} size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: colors.text.primary }]}>
          {hideValues ? "******" : formatCurrency(totalValue)}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.badgeText, { color: colors.text.secondary }]}>AVG</Text>
        </View>
      </View>
      <Text style={[
        styles.percentage, 
        { color: getVariationColor(valueVariation) }
      ]}>
        {hideValues ? "***" : formatVariation(valueVariation)}
      </Text>
      <View style={styles.cardsCount}>
        <Text style={[styles.cardsText, { color: colors.text.secondary }]}>
          {cardsCount} {t('home.cards')}
        </Text>
      </View>
    </View>
  );

  const ActionCard = ({ title, icon, count, onPress }: any) => (
    <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={styles.actionIcon}>
        {icon}
      </View>
      <Text style={[styles.actionTitle, { color: colors.text.primary }]}>{title}</Text>
      <Text style={[styles.actionCount, { color: colors.text.secondary }]}>{count}</Text>
    </TouchableOpacity>
  );

  const ListItem = ({ icon, title, count, onPress, showBadge = false }: any) => (
    <TouchableOpacity style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={onPress}>
      <View style={styles.listItemLeft}>
        {icon}
        <Text style={[styles.listItemTitle, { color: colors.text.primary }]}>{title}</Text>
      </View>
      <View style={styles.listItemRight}>
        {showBadge && count > 0 ? (
          <View style={[styles.notificationBadge, { backgroundColor: colors.secondary }]}>
            <Text style={styles.notificationBadgeText}>{count}</Text>
          </View>
        ) : (
          <Text style={[styles.listItemCount, { color: colors.text.secondary }]}>{count}</Text>
        )}
        <Ionicons name="chevron-forward" size={24} color={colors.text.secondary} />
      </View>
    </TouchableOpacity>
  );

  const NewsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('home.news')}</Text>
      </View>
      <TouchableOpacity 
        style={styles.bannerContainer}
        onPress={() => Linking.openURL('https://www.gamezest.ch/fr/')}
      >
        <View style={[styles.bannerBackground, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name="cards" size={48} color={colors.text.primary} style={styles.bannerIcon} />
        </View>
        <View style={styles.bannerOverlay}>
          <Text style={[styles.bannerText, { color: colors.text.primary }]}>Découvrez les dernières cartes Pokémon</Text>
          <Text style={[styles.bannerSubText, { color: colors.text.secondary }]}>Visitez GameZest.ch</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <TouchableOpacity 
              onPress={() => router.push('../settings')}
              onLongPress={async () => {
                // Fonction cachée pour réinitialiser l'onboarding (utile pour le développement)
                try {
                  await AsyncStorage.removeItem('@onboarding_completed');
                  Alert.alert('Développement', 'État d\'onboarding réinitialisé. Redémarrez l\'application pour voir l\'écran de bienvenue.');
                } catch (error) {
                  console.error('Erreur lors de la réinitialisation de l\'onboarding:', error);
                }
              }}
            >
              {avatar ? (
                <Image
                  source={{ uri: avatar }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.avatarInitial, { color: colors.text.primary }]}>
                    {username ? username[0].toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View>
              <Text style={[styles.greeting, { color: colors.text.secondary }]}>{t('home.greeting')},</Text>
              <Text style={[styles.username, { color: colors.text.primary }]}>{username}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('../settings')}>
            <Ionicons name="settings-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('home.collection')}</Text>
          </View>
          <CollectionCard />
        </View>

        <View style={styles.actionCards}>
          <ActionCard
            title={t('home.editions')}
            icon={<MaterialCommunityIcons name="pokeball" size={24} color={colors.secondary} />}
            count={`${editionsCount} ${t('home.editions')}`}
            onPress={() => router.push('/collection')}
          />
          <ActionCard
            title={t('home.cardsCategory')}
            icon={<MaterialCommunityIcons name="cards" size={24} color={colors.secondary} />}
            count={`${cardsCount} ${t('home.cards')}`}
            onPress={() => router.push('/market')}
          />
        </View>

        <ListItem
          icon={<Ionicons name="heart" size={24} color={colors.secondary} />}
          title={t('home.wishlist')}
          count={`${wishlistCount} ${t(wishlistCount > 1 ? 'home.cards' : 'home.card')}`}
          onPress={() => router.push('../../screens/wishlist')}
        />
        <ListItem
          icon={<Ionicons name="notifications" size={24} color={colors.secondary} />}
          title={t('home.alerts')}
          count={`${unreadNotificationsCount} ${t('home.alerts')}`}
          showBadge={true}
          onPress={() => router.push('/screens/notifications')}
        />
        <ListItem
          icon={<Ionicons name="swap-horizontal" size={24} color={colors.secondary} />}
          title={t('home.tradelist')}
          count={`0 ${t('home.cards')}`}
          onPress={() => router.push('../tradelist')}
        />
        <ListItem
          icon={<Ionicons name="cash" size={24} color={colors.secondary} />}
          title={t('home.sold')}
          count={`0 ${t('home.cards')}`}
          onPress={() => router.push('../sold')}
        />

        <NewsSection />
        
        {/* Espace en bas pour éviter que le contenu soit caché par la navigation */}
        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 25 : 0, // Espace pour la barre d'état
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  greeting: {
    fontSize: 14,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  seeAll: {
    fontSize: 14,
    color: Colors.secondary,
  },
  collectionCard: {
    borderRadius: 12,
    padding: 16,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentValue: {
    fontSize: 14,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    marginRight: 8,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
  },
  percentage: {
    fontSize: 14,
    marginTop: 4,
  },
  cardsCount: {
    marginTop: 8,
  },
  cardsText: {
    fontSize: 14,
  },
  actionCards: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  actionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionCount: {
    fontSize: 14,
  },
  actionButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemTitle: {
    fontSize: 16,
    marginLeft: 12,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemCount: {
    fontSize: 14,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bannerContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  bannerBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerIcon: {
    marginBottom: 10,
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(30, 47, 77, 0.7)',
    padding: 16,
  },
  bannerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSubText: {
    fontSize: 14,
  },
  footer: {
    height: 40,  // Augmentation de l'espace en bas pour éviter que la barre de navigation ne cache le contenu
  },
  notificationBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 