import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Linking, SafeAreaView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../lib/auth';
import { getUserProfile, getUserEditionsCount, getUserCardsCount, getUserAvatar } from '../lib/supabase';
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
  const [username, setUsername] = useState(user?.email?.split('@')[0] || 'User');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hideValues, setHideValues] = useState(false);
  const [editionsCount, setEditionsCount] = useState(0);
  const [cardsCount, setCardsCount] = useState(0);
  const [languageListener, setLanguageListener] = useState<any>(null);

  // Écouter les changements de langue
  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener = EventRegister.addEventListener('changeLanguage', (language: any) => {
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
        EventRegister.removeEventListener(languageListener);
      }
    };
  }, []);
  
  // Écouter les changements de thème
  useEffect(() => {
    const themeListener = EventRegister.addEventListener('themeChanged', () => {
      console.log('Changement de thème détecté dans HomeScreen');
      setRefreshKey(prev => prev + 1);
    });
    
    return () => {
      if (themeListener) {
        EventRegister.removeEventListener(themeListener);
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
            // Vérifier si le username a été mis à jour
            const usernameUpdated = await AsyncStorage.getItem('@username_updated');
            if (usernameUpdated === 'true') {
              // Réinitialiser le flag
              await AsyncStorage.removeItem('@username_updated');
              console.log('Username has been updated, refreshing data...');
              // Force un rafraîchissement en incrémentant la clé
              setRefreshKey(prev => prev + 1);
            }
            
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
            
            // Récupérer les données de l'utilisateur depuis la base de données en utilisant la fonction centralisée
            const { data, error } = await getUserProfile(user.id, 'username, avatar_url');
              
            if (data && typeof data === 'object') {
              const userData = data as Record<string, any>;
              
              if (userData.username && userData.username !== username) {
                console.log('Username updated:', userData.username);
                setUsername(userData.username);
              }
              
              if (userData.avatar_url) {
                setAvatar(userData.avatar_url);
                await AsyncStorage.setItem('@user_avatar', userData.avatar_url);
              }
            } else if (error) {
              console.error("Erreur lors de la récupération des données utilisateur:", error);
            }

            // Récupérer le nombre d'éditions en utilisant la fonction centralisée
            const { count: editionsCountData } = await getUserEditionsCount(user.id);
            setEditionsCount(editionsCountData);

            // Récupérer le nombre total de cartes en utilisant la fonction centralisée
            const { count: cardsCountData } = await getUserCardsCount(user.id);
            setCardsCount(cardsCountData);

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
    }, [user, refreshKey, username])
  );

  // Load initial data on component mount
  useEffect(() => {
    // Le code existant reste ici comme sauvegarde, mais l'effet useFocusEffect ci-dessus
    // prendra le relais pour les rafraîchissements lors des navigations
  }, []);

  const CollectionCard = () => (
    <View style={[styles.collectionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.collectionHeader}>
        <Text style={[styles.currentValue, { color: colors.text.secondary }]}>{t('home.currentValue')}</Text>
        <TouchableOpacity onPress={() => setHideValues(!hideValues)}>
          <Ionicons name={hideValues ? "eye-off-outline" : "eye-outline"} size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: colors.text.primary }]}>{hideValues ? "******" : "0,00 €"}</Text>
        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.badgeText, { color: colors.text.secondary }]}>AVG</Text>
        </View>
      </View>
      <Text style={[styles.percentage, { color: colors.text.secondary }]}>{hideValues ? "***" : "0.00 %"}</Text>
      <View style={styles.cardsCount}>
        <Text style={[styles.cardsText, { color: colors.text.secondary }]}>0 {t('home.cards')}</Text>
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

  const ListItem = ({ icon, title, count, onPress }: any) => (
    <TouchableOpacity style={[styles.listItem, { borderBottomColor: colors.border }]} onPress={onPress}>
      <View style={styles.listItemLeft}>
        {icon}
        <Text style={[styles.listItemTitle, { color: colors.text.primary }]}>{title}</Text>
      </View>
      <View style={styles.listItemRight}>
        <Text style={[styles.listItemCount, { color: colors.text.secondary }]}>{count}</Text>
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
            <TouchableOpacity onPress={() => router.push('../settings')}>
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
          count={`0 ${t('home.cards')}`}
          onPress={() => router.push('../wishlist')}
        />
        <ListItem
          icon={<Ionicons name="notifications" size={24} color={colors.secondary} />}
          title={t('home.alerts')}
          count={`0 ${t('home.alerts')}`}
          onPress={() => router.push('../alerts')}
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
}); 