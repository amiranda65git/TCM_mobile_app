export default {
  expo: {
    name: "TCMarket",
    slug: "tcmarket",
    version: "1.2.4",
    // default = pas de lock orientation (exigence Play / grands écrans Android 16+)
    orientation: "default",
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
      buildNumber: "124",
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
      versionCode: 124,
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png", backgroundColor: "#FFFFFF"
      },
      package: "com.tcmarket.app",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.tcmarket.app",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "com.android.vending.BILLING"
      ],
      // expo-sensors (Pedometer) injecte ACTIVITY_RECOGNITION → Play Console "applis de santé".
      // On n'utilise que l'accéléromètre pour l'auto-scan : bloquer cette permission.
      blockedPermissions: [
        "android.permission.ACTIVITY_RECOGNITION"
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
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true
          }
        }
      ],
      "react-native-edge-to-edge",
      "./plugins/withOptionalScreenOrientation.js",
      "./plugins/withDisablePredictiveBack.js"
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
      OPENAI_MODEL: process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-6-luna',
      PREMIUM_TESTER_EMAILS: process.env.EXPO_PUBLIC_PREMIUM_TESTER_EMAILS || ''
    },
     newArchEnabled: true
     
  }
};
