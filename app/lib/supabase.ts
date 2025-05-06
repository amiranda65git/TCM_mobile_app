// Polyfills minimaux pour Supabase Auth dans React Native
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

// Configuration de Supabase
const supabaseUrl = 'https://dzbdoptsnbonimwunwva.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6YmRvcHRzbmJvbmltd3Vud3ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzM2MTMsImV4cCI6MjA2MDIwOTYxM30.QueqgFdiYEtHubCvQRUHd0mbFuvJJIaIhFa6CAqqI6U';

// Client Supabase optimisé pour l'authentification uniquement
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
});

// Gestion du cycle de vie de la session
AppState.addEventListener('change', (state: string) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Fonction pour récupérer les données du profil utilisateur avec des champs personnalisables
export const getUserProfile = async (userId: string, fields: string = 'username, avatar_url, email') => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(fields)
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Erreur lors de la récupération du profil utilisateur:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de la récupération du profil utilisateur:', error);
    return { data: null, error };
  }
};

// Fonction pour la rétrocompatibilité - redirige vers getUserProfile
export const getUserData = async (userId: string) => {
  return getUserProfile(userId, 'username, avatar_url');
};

// Fonction pour récupérer le nombre d'éditions de l'utilisateur
export const getUserEditionsCount = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_editions')
      .select('edition_id', { count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      // Vérifier si l'erreur est due à une table inexistante
      if (error.code === '42P01') {
        console.log("La table user_editions n'existe pas encore. C'est normal pendant le développement.");
        return { count: 0, error: null };
      }
      console.error("Erreur lors de la récupération des éditions:", error);
      return { count: 0, error };
    }

    // Calcul du nombre d'éditions uniques
    const uniqueEditions = new Set(data?.map(item => item.edition_id) || []);
    return { count: uniqueEditions.size, error: null };
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération des éditions:", error);
    return { count: 0, error };
  }
};

// Fonction pour récupérer le nombre total de cartes de l'utilisateur
export const getUserCardsCount = async (userId: string) => {
  try {
    const { count, error } = await supabase
      .from('user_cards')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (error) {
      // Vérifier si l'erreur est due à une table inexistante
      if (error.code === '42P01') {
        console.log("La table user_cards n'existe pas encore. C'est normal pendant le développement.");
        return { count: 0, error: null };
      }
      console.error("Erreur lors de la récupération du nombre de cartes:", error);
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération du nombre de cartes:", error);
    return { count: 0, error };
  }
};

// Fonction pour mettre à jour la colonne avatar_url dans la table users
export const updateUserAvatar = async (userId: string, avatarBase64: string) => {
  try {
    // Mettre à jour l'URL de l'avatar dans la table users
    // Utiliser une URL de données (data URL) pour stocker l'image directement
    const dataUrl = `data:image/png;base64,${avatarBase64}`;
    
    const { data, error } = await supabase
      .from('users')
      .update({ 
        avatar_url: dataUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      console.error('Erreur lors de la mise à jour de l\'avatar dans users:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Erreur inattendue lors de la mise à jour de l\'avatar:', error);
    return { success: false, error };
  }
};

// Fonction pour récupérer l'avatar d'un utilisateur
export const getUserAvatar = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Erreur lors de la récupération de l\'avatar:', error);
      return { avatarUrl: null, error };
    }
    
    return { avatarUrl: data?.avatar_url || null, error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de la récupération de l\'avatar:', error);
    return { avatarUrl: null, error };
  }
};

// Initialisation du bucket avatars (sera créé s'il n'existe pas)
export const initAvatarBucket = async () => {
  try {
    // Vérifier si la colonne avatar_url existe dans la table users
    const { data, error } = await supabase
      .from('users')
      .select('avatar_url')
      .limit(1);
    
    if (error) {
      console.error('Erreur lors de la vérification de la table users:', error);
      return { error };
    }
    
    console.log('La table users est correctement configurée pour stocker des avatars');
    return { error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de l\'initialisation du stockage d\'avatars:', error);
    return { error };
  }
};

// Fonction d'inscription
export const signUp = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
        data: {
          email_confirmed: true
        }
      }
    });

    if (error) {
      console.error('Erreur lors de l\'inscription:', error);
      
      if (error.message.includes('rate limit')) {
        return {
          data: null,
          error: new Error('Trop de tentatives. Veuillez réessayer dans quelques minutes.')
        };
      }

      if (error.message.includes('confirmation email')) {
        // Si l'erreur concerne l'email de confirmation, on continue quand même
        console.log('Erreur d\'envoi d\'email ignorée, continuation du processus...');
      } else {
        throw error;
      }
    }

    // Si l'utilisateur est créé avec succès
    if (data?.user) {
      console.log('Utilisateur créé avec succès:', data.user.id);
      
      // Initialiser le bucket avatar
      await initAvatarBucket();
      
      // Connexion automatique après inscription
      const { data: sessionData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        console.error('Erreur lors de la connexion automatique:', loginError);
        throw loginError;
      }

      console.log('Connexion automatique réussie');
      return { data: sessionData, error: null };
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Erreur inattendue lors de l\'inscription:', error);
    return { data: null, error };
  }
};

// Fonction de connexion
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('rate limit')) {
        return {
          data: null,
          error: new Error('Trop de tentatives. Veuillez réessayer dans quelques minutes.')
        };
      }
      throw error;
    }
    
    // Initialiser le bucket avatar lors de la connexion
    await initAvatarBucket();

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// Fonction pour créer un utilisateur admin (à utiliser une seule fois)
export const createAdminUser = async () => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'test@tcmarket.fr',
      password: 'TCMarket2024!',
      options: {
        emailRedirectTo: undefined,
        data: {
          is_admin: true,
          email_confirmed: true
        }
      }
    });

    if (error) throw error;
    
    // Initialiser le bucket avatar
    await initAvatarBucket();
    
    // Connexion immédiate
    if (data.user) {
      return await supabase.auth.signInWithPassword({
        email: 'test@tcmarket.fr',
        password: 'TCMarket2024!'
      });
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Fonction pour vérifier si un pseudo est unique
export const checkUsernameUnique = async (userId: string, usernameToCheck: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', usernameToCheck)
      .neq('id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Code d'erreur PGRST116 signifie qu'aucune ligne n'a été trouvée,
      // ce qui est bon dans notre cas
      return { isUnique: true, error: null };
    }
    
    if (data) {
      // Le pseudo est déjà utilisé
      return { isUnique: false, error: null };
    }
    
    return { isUnique: true, error: null };
  } catch (error) {
    console.error('Erreur lors de la vérification du pseudo:', error);
    return { isUnique: false, error };
  }
};

// Fonction pour mettre à jour le pseudo de l'utilisateur
export const updateUsername = async (userId: string, newUsername: string) => {
  try {
    // Vérifier si l'utilisateur a déjà un profil
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (userError && userError.code === 'PGRST116') {
      // Le profil n'existe pas, nous devons l'insérer
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ 
          id: userId, 
          username: newUsername,
          created_at: new Date().toISOString()
        }]);
      
      if (insertError) {
        console.error('Erreur lors de l\'insertion du profil:', insertError);
        return { success: false, error: insertError };
      }
    } else {
      // Le profil existe, nous pouvons le mettre à jour
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          username: newUsername, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId);
      
      if (updateError) {
        console.error('Erreur lors de la mise à jour du pseudo:', updateError);
        return { success: false, error: updateError };
      }
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du pseudo:', error);
    return { success: false, error };
  }
};

// Fonction pour créer un profil utilisateur
export const createUserProfile = async (userId: string, username: string, email: string = '') => {
  try {
    const { error } = await supabase
      .from('users')
      .insert([{ 
        id: userId, 
        username,
        email,
        created_at: new Date().toISOString()
      }]);
      
    if (error) {
      console.error('Erreur lors de la création du profil:', error);
      return { success: false, error };
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de la création du profil:', error);
    return { success: false, error };
  }
};

// Export par défaut pour Expo Router
const SupabaseService = {
  supabase,
  signUp,
  signIn,
  createAdminUser,
  initAvatarBucket,
  updateUserAvatar,
  getUserAvatar,
  getUserData,
  getUserEditionsCount, 
  getUserCardsCount,
  getUserProfile,
  checkUsernameUnique,
  updateUsername,
  createUserProfile
};

export default SupabaseService; 