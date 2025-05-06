import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './i18n/i18n.config';
import { useColorScheme, Platform, StatusBar as RNStatusBar, View, StyleSheet } from 'react-native';
import { Colors } from './constants/Colors';
import { AuthProvider } from './lib/auth';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { i18n } = useTranslation();

  // Pas de prévention du masquage du splash screen
  // SplashScreen.preventAutoHideAsync();

  // Ajuster la barre d'état pour tout Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent');
    }
  }, []);

  useEffect(() => {
    // Écouter l'événement de changement de langue
    const listener: any = EventRegister.addEventListener('changeLanguage', (language: any) => {
      if (language && typeof language === 'string') {
        console.log('Changement de langue détecté dans le layout principal:', language);
        i18n.changeLanguage(language);
      }
    });
    
    console.log('Écouteur de changement de langue ajouté dans le layout principal');
    
    return () => {
      // Supprimer l'écouteur lors du démontage du composant
      console.log('Nettoyage de l\'écouteur de changement de langue');
      if (listener) {
        EventRegister.removeEventListener(listener);
      }
    };
  }, []); // Retiré i18n des dépendances pour éviter des recrées multiples

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* Nous ajoutons d'abord un espace pour la barre d'état Android */}
          {Platform.OS === 'android' && <View style={styles.statusBarSpace} />}
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: Colors.background,
              },
              headerTintColor: Colors.text.primary,
              headerTitleStyle: {
                color: Colors.text.primary,
              },
              contentStyle: {
                backgroundColor: Colors.background,
              },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="(auth)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="(app)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="scan"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="direct-scan"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                headerShown: false,
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  statusBarSpace: {
    height: RNStatusBar.currentHeight,
    backgroundColor: Colors.background,
  }
});
