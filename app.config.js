export default {
  expo: {
    name: "TCMarket",
    slug: "tcmarket",
    version: "1.0.6",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "tcmarket",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      buildNumber: "6",
      bundleIdentifier: "com.tcmarket.app",
      infoPlist: {
        NSCameraUsageDescription: "Cette application a besoin d'accéder à votre caméra pour scanner les cartes Pokémon",
        NSPhotoLibraryUsageDescription: "Cette application a besoin d'accéder à votre galerie pour sauvegarder les photos de cartes",
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ["tcmarket"]
          }
        ]
      },
      config: {
        googleSignIn: {
          reservedClientId: process.env.GOOGLE_SIGN_IN_CLIENT_ID
        }
      }
    },
    android: {
      supportsTablet: false,
      versionCode: 6,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png", backgroundColor: "#FFFFFF"
      },
      package: "com.tcmarket.app",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "com.android.vending.BILLING"
      ],
      intentFilters: [{
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "tcmarket"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: ["expo-router",
      ["expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#121826"
        }],
      "expo-font",
      "expo-localization",
      "expo-image-picker",
      "react-native-vision-camera",
      "expo-iap"
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
      },
      SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      API_OPENAI: process.env.API_OPENAI_KEY,
      OPENAI_MODEL: process.env.EXPO_PUBLIC_OPENAI_MODEL
    },
     newArchEnabled: true
     
  }
};
