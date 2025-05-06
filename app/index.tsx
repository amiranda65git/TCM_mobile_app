import { Redirect } from 'expo-router';
import { useAuth } from './lib/auth';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Colors } from './constants/Colors';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();
  
  // Afficher un indicateur de chargement pendant la vérification de l'authentification
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }
  
  // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  
  // Sinon, rediriger vers la page d'accueil
  return <Redirect href="/(app)/home" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
}); 