import { Redirect } from 'expo-router';
import { useAuth } from './lib/auth';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { Colors } from './constants/Colors';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from './lib/supabase';

export default function Index() {
  const { isAuthenticated, loading, user, session } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [redirectForced, setRedirectForced] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  useEffect(() => {
    // Afficher des logs pour le débogage
    console.log('[Index] État d\'authentification:', { 
      isAuthenticated, 
      loading, 
      hasUser: !!user, 
      hasSession: !!session,
      userId: user?.id
    });
    
    // Vérifier s'il y a un flag de redirection d'authentification récente
    // et également vérifier directement la session pour plus de fiabilité
    async function checkAuthStatus() {
      try {
        // Vérifier d'abord le flag de redirection forcée
        const needsRedirect = await AsyncStorage.getItem('@auth_redirect_needed');
        console.log('[Index] Flag de redirection d\'authentification:', needsRedirect);
        
        if (needsRedirect === 'true') {
          console.log('[Index] Flag de redirection trouvé, vérification de la session...');
          
          // Double vérification: récupérer directement la session depuis Supabase
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session) {
            console.log('[Index] Session active confirmée, navigation forcée vers la page d\'accueil');
            
            // Nettoyer le flag maintenant qu'il est traité
            await AsyncStorage.removeItem('@auth_redirect_needed');
            
            // Forcer la redirection
            setRedirectForced(true);
            router.replace('/(app)/home');
            
            // Indiquer que la vérification d'authentification est terminée
            setCheckingAuth(false);
            return true;
          } else {
            console.log('[Index] Flag de redirection trouvé mais pas de session active');
            await AsyncStorage.removeItem('@auth_redirect_needed');
          }
        }
        
        // Vérification directe de la session comme fallback
        if (!isAuthenticated && !loading) {
          const { data: sessionCheck } = await supabase.auth.getSession();
          
          if (sessionCheck.session) {
            console.log('[Index] Session active trouvée mais non reflétée dans le contexte, redirection forcée');
            setRedirectForced(true);
            router.replace('/(app)/home');
            setCheckingAuth(false);
            return true;
          }
        }
        
        setCheckingAuth(false);
        return false;
      } catch (error) {
        console.error('[Index] Erreur lors de la vérification du statut d\'authentification:', error);
        setCheckingAuth(false);
        return false;
      }
    }
    
    // Vérifier si l'utilisateur a déjà vu l'écran d'onboarding
    async function checkOnboardingStatus() {
      try {
        // D'abord vérifier le statut d'authentification
        const redirected = await checkAuthStatus();
        if (redirected) return;
        
        const status = await AsyncStorage.getItem('@onboarding_completed');
        console.log('[Index] Statut de l\'onboarding:', status);
        setOnboardingCompleted(status === 'true');
      } catch (error) {
        console.error('[Index] Erreur lors de la vérification du statut d\'onboarding:', error);
        // En cas d'erreur, on suppose que l'onboarding n'a pas été complété
        setOnboardingCompleted(false);
      } finally {
        setCheckingOnboarding(false);
      }
    }
    
    checkOnboardingStatus();
  }, [isAuthenticated, loading, user, session]);
  
  // Si une redirection a déjà été forcée, ne rien faire de plus
  if (redirectForced) {
    console.log('[Index] Redirection déjà forcée, attente...');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Redirection en cours...</Text>
      </View>
    );
  }
  
  // Afficher un indicateur de chargement pendant la vérification
  if (loading || checkingOnboarding || checkingAuth) {
    console.log('[Index] Chargement en cours...');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }
  
  // Si l'onboarding n'a pas été complété, rediriger vers l'écran de bienvenue
  if (!onboardingCompleted) {
    console.log('[Index] Redirection vers l\'écran de bienvenue (onboarding)');
    return <Redirect href="/(auth)/welcome" />;
  }
  
  // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  if (!isAuthenticated) {
    console.log('[Index] Redirection vers la page de connexion (utilisateur non authentifié)');
    return <Redirect href="/(auth)/login" />;
  }
  
  // Sinon, rediriger vers la page d'accueil
  console.log('[Index] Redirection vers la page d\'accueil (utilisateur authentifié)');
  return <Redirect href="/(app)/home" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.secondary,
    fontSize: 16
  }
}); 