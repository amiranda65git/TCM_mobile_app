import { Redirect } from 'expo-router';
import { useAuth } from './lib/auth';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Colors } from './constants/Colors';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  
  useEffect(() => {
    // Vérifier si l'utilisateur a déjà vu l'écran d'onboarding
    async function checkOnboardingStatus() {
      try {
        const status = await AsyncStorage.getItem('@onboarding_completed');
        setOnboardingCompleted(status === 'true');
      } catch (error) {
        console.error('Erreur lors de la vérification du statut d\'onboarding:', error);
        // En cas d'erreur, on suppose que l'onboarding n'a pas été complété
        setOnboardingCompleted(false);
      } finally {
        setCheckingOnboarding(false);
      }

      //todo : A supprimer après test
      setOnboardingCompleted(true);
    }
    
    checkOnboardingStatus();
  }, []);
  
  // Afficher un indicateur de chargement pendant la vérification
  if (loading || checkingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }
  
  // Si l'onboarding n'a pas été complété, rediriger vers l'écran de bienvenue
  if (!onboardingCompleted) {
    return <Redirect href="/(auth)/welcome" />;
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