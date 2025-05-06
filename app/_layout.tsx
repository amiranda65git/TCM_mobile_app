import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './i18n/i18n.config';
import { useColorScheme } from 'react-native';
import { Colors } from './constants/Colors';
import { AuthProvider } from './lib/auth';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Pas de prévention du masquage du splash screen
  // SplashScreen.preventAutoHideAsync();

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
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
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
