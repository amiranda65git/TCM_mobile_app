import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  Platform,
  RefreshControl
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';
import { useAuth } from '../lib/auth';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../lib/supabase';

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
      
      setNotifications(data || []);
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
      
      // Naviguer en fonction du type de notification
      if (notification.type === 'wishlist_item_sale') {
        // Naviguer vers la carte en vente
        router.push({
          pathname: '/market',
          params: { cardId: notification.card_id }
        });
      } else if (notification.type === 'price_alert') {
        // Naviguer vers la carte avec l'alerte de prix
        router.push({
          pathname: '/market',
          params: { cardId: notification.card_id }
        });
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
  
  // Rendre un élément de notification
  const renderNotificationItem = ({ item }: { item: any }) => {
    // Déterminer l'icône et le texte en fonction du type de notification
    let icon = 'notifications-outline';
    let title = '';
    let description = '';
    
    if (item.type === 'wishlist_item_sale') {
      icon = 'cart-outline';
      title = t('alerts.wishlistItemSale');
      description = t('alerts.wishlistItemSaleDesc', { cardName: item.data?.card_name || 'Card' });
    } else if (item.type === 'price_alert') {
      const priceChange = item.data?.price_change || 0;
      const isIncrease = priceChange > 0;
      
      icon = isIncrease ? 'trending-up-outline' : 'trending-down-outline';
      title = t('alerts.priceAlert');
      description = t('alerts.priceAlertDesc', { 
        cardName: item.data?.card_name || 'Card',
        percent: Math.abs(priceChange).toFixed(2)
      });
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { backgroundColor: item.is_read ? colors.background : colors.surface },
          { borderBottomColor: colors.border }
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name={icon as any} size={24} color={colors.text.primary} />
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>{description}</Text>
          <Text style={[styles.date, { color: colors.text.secondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.secondary }]} />}
      </TouchableOpacity>
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