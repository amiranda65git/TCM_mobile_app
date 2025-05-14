import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Constante pour la session initiale
const INITIAL_STATE = {
  session: null,
  user: null,
  loading: true,
  isAuthenticated: false
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>(INITIAL_STATE);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthContextType>(INITIAL_STATE);

  useEffect(() => {
    console.log('Initialisation du contexte d\'authentification...');

    // Vérifier s'il y a une redirection en attente
    const checkRedirect = async () => {
      const needsRedirect = await AsyncStorage.getItem('@auth_redirect_needed');
      if (needsRedirect === 'true') {
        console.log('[AuthContext] Flag de redirection trouvé, préparation de la redirection');
        
        // Nous ne supprimons pas le flag ici, il sera supprimé après la redirection
        
        // Vérifier si nous avons déjà une session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log('[AuthContext] Session active trouvée, redirection imminente');
          
          // Attendre un peu pour s'assurer que le contexte est prêt
          setTimeout(() => {
            console.log('[AuthContext] Exécution de la redirection forcée');
            router.replace('/(app)/home');
            
            // Nettoyer le flag après une redirection réussie
            setTimeout(() => {
              AsyncStorage.removeItem('@auth_redirect_needed');
            }, 1000);
          }, 500);
        }
      }
    };
    
    checkRedirect();

    // Vérifier la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AuthContext] Session initiale récupérée:', session ? 'Session active' : 'Pas de session');
      setState({
        session: session,
        user: session?.user || null,
        loading: false,
        isAuthenticated: !!session && !!session.user
      });
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Changement d\'état d\'authentification:', event);
      
      // Mise à jour de l'état avec la nouvelle session
      setState({
        session: session,
        user: session?.user || null,
        loading: false,
        isAuthenticated: !!session && !!session.user
      });
      
      // Si l'utilisateur vient de se connecter, vérifier s'il faut rediriger
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
        const needsRedirect = await AsyncStorage.getItem('@auth_redirect_needed');
        
        if (needsRedirect === 'true') {
          console.log('[AuthContext] Redirection nécessaire détectée après', event);
          
          // La redirection sera gérée dans l'index ou le composant de login
          // Nous ne supprimons pas le flag ici, il sera supprimé après la redirection
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 

// Export par défaut pour Expo Router
const AuthService = {
  AuthProvider,
  useAuth
};

export default AuthService; 