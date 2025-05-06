import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import ScanScreen from '../screens/ScanScreen';

export default function ScanRoute() {
  return (
    <>
      <Stack.Screen options={{ 
        headerShown: false,
        // Utiliser la propriété animation none pour éviter les transitions qui
        // pourraient causer des problèmes avec la caméra
        animation: 'none'
      }} />
      <ScanScreen />
    </>
  );
} 