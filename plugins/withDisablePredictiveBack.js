/**
 * Désactive le predictive back Android (targetSdk 36+) qui ferme l'app
 * au lieu de naviguer vers l'écran précédent (react-native-screens v4).
 */
const { withAndroidManifest } = require("@expo/config-plugins");

function withDisablePredictiveBack(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app?.activity) return config;

    for (const activity of app.activity) {
      const name = activity.$?.["android:name"];
      if (name === ".MainActivity" || name?.endsWith(".MainActivity")) {
        activity.$["android:enableOnBackInvokedCallback"] = "false";
      }
    }
    return config;
  });
}

module.exports = withDisablePredictiveBack;
