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
import { ThemeProvider, useTheme } from './lib/ThemeContext';
import { useThemeColors } from './lib/ThemeUtils';

// Composant pour le contenu de l'application
function AppContent() {
  const colorScheme = useColorScheme();
  const { i18n } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Nous ajoutons d'abord un espace pour la barre d'état Android */}
        {Platform.OS === 'android' && <View style={[styles.statusBarSpace, { backgroundColor: colors.background }]} />}
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text.primary,
            headerTitleStyle: {
              color: colors.text.primary,
            },
            contentStyle: {
              backgroundColor: colors.background,
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
  );
}

// Composant racine qui fournit tous les contextes
export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  statusBarSpace: {
    height: RNStatusBar.currentHeight,
  }
});
