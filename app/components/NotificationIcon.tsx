import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface NotificationIconProps {
  color?: string;
  size?: number;
}

export default function NotificationIcon({ color = 'black', size = 24 }: NotificationIconProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  
  useEffect(() => {
    if (!user) return;
    
    // Charger le nombre de notifications non lues
    loadUnreadCount();
    
    // Mettre en place un listener pour les changements dans les notifications
    const channel = supabase
      .channel('notification_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        // Incrémenter le compteur de notifications
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    
    return () => {
      // Nettoyer le listener lors du démontage
      supabase.removeChannel(channel);
    };
  }, [user]);
  
  const loadUnreadCount = async () => {
    if (!user) return;
    
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  };
  
  const handlePress = () => {
    router.push('/notifications');
  };
  
  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <Ionicons name="notifications-outline" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 