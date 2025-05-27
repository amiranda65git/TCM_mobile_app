import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import '../i18n/i18n.config';
import { useRouter } from 'expo-router';
import { EventRegister } from 'react-native-event-listeners';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);

  // Écouter les changements de langue
  useEffect(() => {
    // Vérifier si la langue a changé au démarrage
    const checkLanguageChanged = async () => {
      const languageChanged = await AsyncStorage.getItem('@language_changed');
      if (languageChanged === 'true') {
        // Réinitialiser le flag
        await AsyncStorage.removeItem('@language_changed');
        console.log('Language has been changed, refreshing TabNavigator');
        // Force un rafraîchissement
        setRefreshKey(prev => prev + 1);
      }
    };
    
    checkLanguageChanged();
    
    // Écouter l'événement de changement de langue
    const listener: any = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans TabNavigator:', language);
        // Force un rafraîchissement
        setRefreshKey(prev => prev + 1);
      }
    });
    
    return () => {
      // Supprimer l'écouteur lors du démontage du composant
      if (listener) {
        EventRegister.removeEventListener(listener);
      }
    };
  }, []);

  // Utilisation d'une clé pour forcer le rafraîchissement du composant
  return (
    <Tabs
      key={refreshKey}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.text.secondary,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 10,
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: -5,
        },
      }}
      tabBar={(props) => <CustomTabBar key={refreshKey} {...props} />}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('navigation.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: t('navigation.collection'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons 
              name={focused ? "pokeball" : "pokeball"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('navigation.scan'),
          tabBarIcon: ({ color }) => (
            <View style={styles.scanButtonContainer}>
              <Ionicons name="camera" size={28} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: t('navigation.market'),
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons 
              name={focused ? "auto-graph" : "auto-graph"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trading"
        options={{
          title: t('navigation.trading'),
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome6 
              name={focused ? "comments-dollar" : "comments-dollar"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}

// Composant TabBar personnalisé pour avoir un bouton central spécial
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const router = useRouter();
  
  // Pour gérer l'état du scan
  const handleScanPress = () => {
    // Naviguer vers la route scan (ScanScreen)
    router.push('/scan');
  };
  
  return (
    <View style={[
      styles.tabBarContainer, 
      { paddingBottom: insets.bottom, height: 70 + insets.bottom }
    ]}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        
        // Ne pas afficher les routes masquées
        if (options.tabBarButton === (() => null)) {
          return null;
        }
        
        const label = options.title || route.name;
        const isFocused = state.index === index;
        
        // Style spécial pour le bouton de scan central
        if (route.name === 'scan') {
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.8}
              onPress={handleScanPress}
              style={styles.scanButton}
            >
              <View style={styles.scanButtonContainer}>
                <Ionicons name="camera" size={28} color="#FFFFFF" />
              </View>
              <Text style={styles.scanButtonLabel}>{t(`navigation.${route.name}`)}</Text>
            </TouchableOpacity>
          );
        }
        
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        
        return (
          <TouchableOpacity
            key={index}
            activeOpacity={0.7}
            onPress={onPress}
            style={styles.tabButton}
          >
            {options.tabBarIcon && options.tabBarIcon({
              focused: isFocused,
              color: isFocused ? Colors.secondary : Colors.text.secondary,
              size: 24,
            })}
            <Text style={[
              styles.tabLabel,
              { color: isFocused ? Colors.secondary : Colors.text.secondary }
            ]}>
              {t(`navigation.${route.name}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  scanButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  scanButtonContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: -35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  scanButtonLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: -5,
  },
}); 