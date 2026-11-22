import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

const LIFETIME_SCANS_KEY = '@tcmarket_rate_lifetime_scans';
const COMPLETED_KEY = '@tcmarket_rate_prompt_completed';
const SNOOZE_UNTIL_KEY = '@tcmarket_rate_snooze_until';

export const RATE_APP_SCAN_THRESHOLD = 10;
/** Seconde proposition si l’utilisateur a refusé / reporté la première. */
export const RATE_APP_RETRY_THRESHOLD = 100;

const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.tcmarket.app&showAllReviews=true';
const ANDROID_MARKET_URL =
  'market://details?id=com.tcmarket.app&showAllReviews=true';

export async function recordScanAndShouldPromptRate(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(LIFETIME_SCANS_KEY);
  const next = (Number.parseInt(raw || '0', 10) || 0) + 1;
  await AsyncStorage.setItem(LIFETIME_SCANS_KEY, String(next));

  const completed = await AsyncStorage.getItem(COMPLETED_KEY);
  if (completed === '1') return false;

  const snoozeRaw = await AsyncStorage.getItem(SNOOZE_UNTIL_KEY);
  const snoozeUntil = Number.parseInt(snoozeRaw || '0', 10) || 0;
  if (snoozeUntil > 0) {
    return next >= snoozeUntil;
  }

  return next >= RATE_APP_SCAN_THRESHOLD;
}

export async function markRatePromptCompleted(): Promise<void> {
  await AsyncStorage.setItem(COMPLETED_KEY, '1');
  await AsyncStorage.removeItem(SNOOZE_UNTIL_KEY);
}

export async function snoozeRatePrompt(): Promise<void> {
  const raw = await AsyncStorage.getItem(LIFETIME_SCANS_KEY);
  const current = Number.parseInt(raw || '0', 10) || 0;
  // Déjà eu la 2ᵉ chance à 100 → ne plus relancer
  if (current >= RATE_APP_RETRY_THRESHOLD) {
    await markRatePromptCompleted();
    return;
  }
  await AsyncStorage.setItem(SNOOZE_UNTIL_KEY, String(RATE_APP_RETRY_THRESHOLD));
}

/** 4–5 ★ → demande d’avis store ; sinon simple remerciement. */
export async function openStoreRatingFlow(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) {
      const hasAction = await StoreReview.hasAction();
      if (hasAction) {
        await StoreReview.requestReview();
        return;
      }
    }
  } catch {
    // fallback store URL
  }

  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(ANDROID_MARKET_URL);
    } catch {
      await Linking.openURL(ANDROID_STORE_URL);
    }
  }
}
