import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform,
  RefreshControl,
  Animated
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { useAuth } from '../lib/auth';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, archiveNotification } from '../lib/supabase';
import { Swipeable } from 'react-native-gesture-handler';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Charger les notifications
  const loadNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await getUserNotifications(user.id);
      if (error) throw error;
      
      setNotifications((data || []).filter((n: any) => !n.archived));
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Charger les notifications au démarrage
  useEffect(() => {
    loadNotifications();
  }, [user]);
  
  // Marquer une notification comme lue
  const handleNotificationPress = async (notification: any) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
        
        // Mettre à jour l'état local
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
      }
      
      // Navigation selon le type de notification
      if (notification.type === 'wishlist_item_sale') {
        router.push({ pathname: '/market', params: { cardId: notification.card_id } });
      } else if (notification.type === 'price_alert') {
        router.push({ pathname: '/market', params: { cardId: notification.card_id } });
      } else if (notification.type === 'New_Offer_notification') {
        // Aller vers la page card-sell-details pour la carte concernée uniquement si user_card_id est présent
        if (notification.user_card_id) {
          router.push(`/screens/market-prices/card-sell-details?id=${notification.user_card_id}`);
        } else {
          // Optionnel : afficher une alerte ou ne rien faire
          // alert('Impossible d'ouvrir le détail de la vente : identifiant manquant.');
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement de la notification:', error);
    }
  };
  
  // Marquer toutes les notifications comme lues
  const handleMarkAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      await markAllNotificationsAsRead(user.id);
      
      // Mettre à jour l'état local
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Erreur lors du marquage de toutes les notifications:', error);
    }
  };
  
  const renderRightActions = (progress: any, dragX: any, onArchive: () => void) => {
    return (
      <TouchableOpacity
        style={{
          backgroundColor: 'red',
          justifyContent: 'center',
          alignItems: 'flex-end',
          flex: 1,
          paddingRight: 24,
        }}
        onPress={onArchive}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Archive</Text>
      </TouchableOpacity>
    );
  };
  
  const renderNotificationItem = ({ item }: { item: any }) => {
    const fontWeight = item.is_read ? 'normal' : 'bold';
    // Générer dynamiquement le message selon le type
    let message = item.message;
    if (item.type === 'OfferAccepted') {
      message = t('market.notificationOfferAccepted', { card: item.data?.card || '' });
    } else if (item.type === 'OfferRefused') {
      message = t('market.notificationOfferRefused', { card: item.data?.card || '' });
    }
    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, async () => {
          await archiveNotification(item.id);
          setNotifications(prev => prev.filter(n => n.id !== item.id));
        })}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem,
            { backgroundColor: item.is_read ? colors.background : colors.surface },
            { borderBottomColor: colors.border }
          ]}
          onPress={() => handleNotificationPress(item)}
        >
          <View style={styles.contentContainer}>
            <Text style={[styles.date, { color: colors.text.secondary }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            <Text style={[styles.description, { color: colors.text.primary, fontWeight, marginTop: 2 }]}>
              {message}
            </Text>
          </View>
          {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.secondary }]} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };
  
  // Vérifier s'il y a des notifications non lues
  const hasUnreadNotifications = notifications.some(n => !n.is_read);
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: t('alerts.title'),
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text.primary,
          headerShadowVisible: false,
        }}
      />
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.text.secondary} />
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {t('alerts.noNotifications')}
          </Text>
        </View>
      ) : (
        <>
          {hasUnreadNotifications && (
            <TouchableOpacity 
              style={[styles.markAllButton, { backgroundColor: colors.surface }]}
              onPress={handleMarkAllAsRead}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={colors.text.primary} />
              <Text style={[styles.markAllText, { color: colors.text.primary }]}>
                {t('alerts.markAllAsRead')}
              </Text>
            </TouchableOpacity>
          )}
          
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderNotificationItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={loadNotifications}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  listContainer: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
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
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    margin: 10,
    borderRadius: 8,
  },
  markAllText: {
    marginLeft: 8,
    fontWeight: '500',
  },
}); 