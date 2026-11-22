/**
 * Play Console : android.hardware.screen.portrait requis.
 * Causes : uses-feature (défaut required=true) + screenOrientation="portrait"
 * injecté par play-services-code-scanner (via expo-camera).
 */
const {
  withAndroidManifest,
  AndroidConfig,
} = require("@expo/config-plugins");

const PORTRAIT = "android.hardware.screen.portrait";
const LANDSCAPE = "android.hardware.screen.landscape";
const MLKIT_SCANNER_ACTIVITY =
  "com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity";

function ensureOptionalFeature(manifest, name) {
  if (!manifest.manifest["uses-feature"]) {
    manifest.manifest["uses-feature"] = [];
  }
  const features = manifest.manifest["uses-feature"];
  const existing = features.find((f) => f.$?.["android:name"] === name);
  if (existing) {
    existing.$["android:required"] = "false";
    existing.$["tools:replace"] = "android:required";
  } else {
    features.push({
      $: {
        "android:name": name,
        "android:required": "false",
        "tools:replace": "android:required",
      },
    });
  }
}

function stripActivityOrientation(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  const activities = app.activity || [];
  for (const activity of activities) {
    if (activity.$?.["android:screenOrientation"]) {
      delete activity.$["android:screenOrientation"];
    }
  }

  let scanner = activities.find(
    (a) => a.$?.["android:name"] === MLKIT_SCANNER_ACTIVITY
  );
  if (!scanner) {
    scanner = {
      $: {
        "android:name": MLKIT_SCANNER_ACTIVITY,
        "tools:remove": "android:screenOrientation",
      },
    };
    if (!app.activity) {
      app.activity = [];
    }
    app.activity.push(scanner);
  } else {
    scanner.$["tools:remove"] = "android:screenOrientation";
    delete scanner.$["android:screenOrientation"];
  }
}

function withOptionalScreenOrientation(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    if (!manifest.manifest.$) {
      manifest.manifest.$ = {};
    }
    if (!manifest.manifest.$["xmlns:tools"]) {
      manifest.manifest.$["xmlns:tools"] =
        "http://schemas.android.com/tools";
    }
    ensureOptionalFeature(manifest, PORTRAIT);
    ensureOptionalFeature(manifest, LANDSCAPE);
    stripActivityOrientation(manifest);
    return config;
  });
}

module.exports = withOptionalScreenOrientation;
