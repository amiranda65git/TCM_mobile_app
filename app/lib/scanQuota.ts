import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_MONTHLY_SCANS } from '../constants/SubscriptionProducts';

function monthKey(userId: string) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `@tcmarket_scans:${userId}:${month}`;
}

export async function getMonthlyScanCount(userId: string): Promise<number> {
  const raw = await AsyncStorage.getItem(monthKey(userId));
  const count = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(count) ? count : 0;
}

export async function incrementMonthlyScanCount(userId: string): Promise<number> {
  const next = (await getMonthlyScanCount(userId)) + 1;
  await AsyncStorage.setItem(monthKey(userId), String(next));
  return next;
}

export { FREE_MONTHLY_SCANS };
