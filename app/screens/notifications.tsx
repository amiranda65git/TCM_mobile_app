import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useThemeColors } from '../lib/ThemeUtils';

interface Notification {
  id: string;
  type: string;
  message: string;
  card_id: string | null;
  created_at: string;
  is_read: boolean;
  card?: {
    name: string;
    image_small: string;
  };
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);
  
  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Récupérer les notifications pour l'utilisateur
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          card:card_id (
            name,
            image_small
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setNotifications(data || []);
      
      // Marquer les notifications comme lues
      const unreadIds = data
        ?.filter(notification => !notification.is_read)
        .map(notification => notification.id);
      
      if (unreadIds && unreadIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };
  
  const handleDeleteNotification = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      // Mettre à jour l'état local
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    } catch (error) {
      console.error('Erreur lors de la suppression de la notification:', error);
    }
  };
  
  const handleClearAll = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      
      setNotifications([]);
    } catch (error) {
      console.error('Erreur lors de la suppression de toutes les notifications:', error);
    }
  };
  
  const handleCardPress = (cardId: string | null) => {
    if (cardId) {
      router.push(`/screens/card/${cardId}`);
    }
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'price_alert':
        return <Ionicons name="trending-up" size={24} color="#3498db" />;
      case 'wishlist_notification':
        return <Ionicons name="heart" size={24} color="#e74c3c" />;
      default:
        return <Ionicons name="notifications" size={24} color="#f39c12" />;
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // Si c'est aujourd'hui, afficher "il y a X heures/minutes"
      if (date.toDateString() === now.toDateString()) {
        const diffMs = now.getTime() - date.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHrs > 0) {
          return `il y a ${diffHrs} heure${diffHrs > 1 ? 's' : ''}`;
        } else if (diffMins > 0) {
          return `il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
        } else {
          return 'à l\'instant';
        }
      }
      
      // Si c'est hier, afficher "Hier à HH:MM"
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Hier à ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // Sinon, afficher la date formatée
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} à ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (error) {
      return dateString;
    }
  };
  
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View style={[styles.notificationItem, { backgroundColor: colors.surface }]}>
      <View style={styles.notificationIconContainer}>
        {getNotificationIcon(item.type)}
      </View>
      
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationMessage, { color: colors.text.primary }]}>
          {item.message}
        </Text>
        
        <Text style={[styles.notificationDate, { color: colors.text.secondary }]}>
          {formatDate(item.created_at)}
        </Text>
        
        {item.card_id && item.card && (
          <TouchableOpacity 
            style={[styles.cardPreview, { backgroundColor: colors.background }]}
            onPress={() => handleCardPress(item.card_id)}
          >
            {item.card.image_small ? (
              <Image 
                source={{ uri: item.card.image_small }} 
                style={styles.cardImage} 
                resizeMode="contain" 
              />
            ) : (
              <View style={styles.cardImagePlaceholder} />
            )}
            
            <Text style={[styles.cardName, { color: colors.text.primary }]}>
              {item.card.name}
            </Text>
            
            <Ionicons name="chevron-forward" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteNotification(item.id)}
      >
        <Ionicons name="close" size={20} color={colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );
  
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{ 
            title: t('notifications.title'),
            headerShown: true
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            {t('general.loading')}
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: t('notifications.title'),
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            notifications.length > 0 ? (
              <TouchableOpacity onPress={handleClearAll} style={styles.clearAllButton}>
                <Text style={{ color: colors.primary }}>{t('notifications.clearAll')}</Text>
              </TouchableOpacity>
            ) : null
          )
        }}
      />
      
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.text.secondary} />
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              {t('notifications.empty')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  notificationIconContainer: {
    marginRight: 12,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 16,
    lineHeight: 22,
  },
  notificationDate: {
    fontSize: 12,
    marginTop: 4,
  },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  cardImage: {
    width: 30,
    height: 42,
    borderRadius: 4,
  },
  cardImagePlaceholder: {
    width: 30,
    height: 42,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  cardName: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
}); 