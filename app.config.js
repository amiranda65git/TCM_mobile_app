export default {
  expo: {
    name: 'TCMarket',
    slug: 'tcmarket',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'tcmarket',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.tcmarket.app',
      infoPlist: {
        NSCameraUsageDescription: "Cette application a besoin d'accéder à votre caméra pour scanner les cartes Pokémon",
        NSPhotoLibraryUsageDescription: "Cette application a besoin d'accéder à votre galerie pour sauvegarder les photos de cartes"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#FFFFFF'
      },
      package: 'com.tcmarket.app',
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE'
      ]
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          'image': './assets/images/splash-icon.png',
          'imageWidth': 200,
          'resizeMode': 'contain',
          'backgroundColor': '#121826'
        }
      ],
      'expo-font',
      'expo-localization',
      'expo-image-picker',
      'react-native-vision-camera'
    ],
    experiments: {
      tsconfigPaths: true,
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "7d5f34e5-d848-4bad-9017-ad267d254f70"
      }
    },
    newArchEnabled: true
  }
}; 