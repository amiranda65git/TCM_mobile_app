import { Redirect } from 'expo-router';

export function HomeRoute() {
  return <Redirect href="/(app)/home" />;
}
 
export function SettingsRoute() {
  // Cette route sera accessible via router.push('/settings')
  return <Redirect href="/(app)/settings" />;
}

// Exporter la fonction HomeRoute par défaut
export default HomeRoute; 