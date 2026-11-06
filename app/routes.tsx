import { Redirect } from 'expo-router';

export function HomeRoute() {
  return <Redirect href="/(app)/home" />;
}
 
export function SettingsRoute() {
  // Cette route sera accessible via router.push('/settings')
  return <Redirect href="/settings" />;
}

export function NotificationsRoute() {
  // Cette route sera accessible via router.push('/notifications')
  return <Redirect href="/screens/notifications" />;
}

// Exporter la fonction HomeRoute par défaut
export default HomeRoute; 