import { Stack } from 'expo-router';
import { Colors } from '../constants/Colors';

export default function ScanScreensLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: Colors.background,
        },
        animation: 'slide_from_right',
      }}
    />
  );
} 