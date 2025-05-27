// ⚠️ Les variables SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans le fichier .env à la racine du projet mobile.
// Exemple :
// SUPABASE_URL=https://xxxx.supabase.co
// SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Polyfills minimaux pour Supabase Auth dans React Native
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Types pour les relations Supabase
interface UserInfo {
  username: string;
  avatar_url: string;
}

interface Edition {
  name: string;
}

interface OfficialCard {
  image_small: string;
  edition_id: string;
  editions: Edition;
}

// Type pour les notifications
interface Notification {
  id: string;
  user_id: string;
  type: 'wishlist_item_sale' | 'price_alert';
  card_id: string;
  is_read: boolean;
  created_at: string;
  data: any;
}

// Configuration de Supabase
const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || '';

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
    console.log(`[getUserProfile] Récupération du profil pour l'utilisateur ${userId} avec champs: ${fields}`);
    
    if (!userId) {
      console.error('[getUserProfile] Erreur: userId est undefined ou null');
      return { data: null, error: new Error('userId est requis') };
    }
    
    const { data, error } = await supabase
      .from('users')
      .select(fields)
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('[getUserProfile] Erreur lors de la récupération du profil utilisateur:', error);
      
      // Vérifier si le profil n'existe pas encore
      if (error.code === 'PGRST116') {
        console.log('[getUserProfile] Profil non trouvé, il devra être créé');
      }
      
      return { data: null, error };
    }
    
    console.log('[getUserProfile] Données récupérées avec succès:', data);
    return { data, error: null };
  } catch (error) {
    console.error('[getUserProfile] Erreur inattendue lors de la récupération du profil utilisateur:', error);
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
    // Récupérer les cartes de l'utilisateur avec leurs éditions
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        card_id,
        official_cards(
          edition_id
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error("Erreur lors de la récupération des éditions:", error);
      return { count: 0, error };
    }

    // Calculer le nombre d'éditions uniques
    const uniqueSetIds = new Set();
    
    data?.forEach((card: any) => {
      if (card.official_cards && card.official_cards.edition_id) {
        uniqueSetIds.add(card.official_cards.edition_id);
      }
    });
    
    return { count: uniqueSetIds.size, error: null };
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
    
    // Vérifier si l'utilisateur a déjà un profil
    if (data?.user) {
      try {
        // Vérifier directement si un profil existe dans la table users
        const { data: existingProfile, error: profileError } = await getUserProfile(data.user.id);
        
        // Créer un profil seulement si aucun n'existe
        if (!existingProfile) {
          console.log('[signIn] Aucun profil utilisateur trouvé, création d\'un nouveau profil');
          const defaultUsername = email.split('@')[0] || 'User';
          await createUserProfile(data.user.id, defaultUsername, email);
        } else {
          console.log('[signIn] Profil utilisateur existant trouvé');
        }
      } catch (err) {
        console.error('[signIn] Erreur lors de la vérification du profil:', err);
      }
    }

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
    
    // Mettre à jour le display name dans l'authentification Supabase également
    try {
      // Utiliser l'API Supabase Auth pour mettre à jour les données utilisateur
      const { error: updateAuthError } = await supabase.auth.updateUser({
        data: { 
          username: newUsername  // Stocké dans les métadonnées utilisateur
        }
      });
      
      if (updateAuthError) {
        console.error('Erreur lors de la mise à jour des métadonnées utilisateur:', updateAuthError);
        // On continue même en cas d'erreur ici, car la mise à jour de la table users est plus importante
      } else {
        console.log('Métadonnées utilisateur mises à jour avec succès');
      }
    } catch (authError) {
      console.error('Exception lors de la mise à jour des métadonnées utilisateur:', authError);
      // On continue même en cas d'erreur
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
    console.log(`[createUserProfile] Création du profil pour l'utilisateur ${userId} avec username ${username}`);
    
    if (!userId) {
      console.error('[createUserProfile] Erreur: userId est undefined ou null');
      return { success: false, error: new Error('userId est requis') };
    }
    
    // Vérifier d'abord si un profil existe déjà
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .single();
      
    if (!checkError && existingUser) {
      console.log(`[createUserProfile] Un profil existe déjà pour l'utilisateur ${userId} avec username ${existingUser.username}`);
      
      // Si le profil existe mais n'a pas de username, on le met à jour
      if (!existingUser.username && username) {
        console.log(`[createUserProfile] Mise à jour du username existant pour ${userId}`);
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            username,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
          
        if (updateError) {
          console.error('[createUserProfile] Erreur lors de la mise à jour du profil:', updateError);
          return { success: false, error: updateError };
        }
        
        console.log(`[createUserProfile] Profil mis à jour avec succès pour ${userId}`);
        return { success: true, data: { ...existingUser, username } };
      }
      
      return { success: true, data: existingUser };
    }
    
    // Si le profil n'existe pas, on le crée
    console.log(`[createUserProfile] Création d'un nouveau profil pour ${userId}`);
    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        id: userId, 
        username,
        email,
        created_at: new Date().toISOString()
      }])
      .select();
      
    if (error) {
      console.error('[createUserProfile] Erreur lors de la création du profil:', error);
      return { success: false, error };
    }
    
    console.log(`[createUserProfile] Profil créé avec succès pour ${userId}`);
    return { success: true, data: data?.[0] || { id: userId, username, email } };
  } catch (error) {
    console.error('[createUserProfile] Erreur inattendue lors de la création du profil:', error);
    return { success: false, error };
  }
};

// Fonction pour récupérer les cartes d'un utilisateur regroupées par édition
export const getUserCardsGroupedByEdition = async (userId: string) => {
  try {
    // 1. Récupérer les cartes de l'utilisateur avec les informations de base
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        id,
        user_id,
        card_id,
        condition,
        is_for_sale,
        price,
        official_cards(
          id,
          name,
          edition_id,
          rarity,
          image_small,
          image_large
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error("Erreur lors de la récupération des cartes de l'utilisateur:", error);
      return { data: null, error };
    }

    // Récupérer la liste de tous les edition_id des cartes
    const editionIds = new Set<string>();
    data?.forEach((card: any) => {
      if (card.official_cards && card.official_cards.edition_id) {
        editionIds.add(card.official_cards.edition_id);
      }
    });

    // 2. Récupérer les informations des éditions
    const { data: editionsData, error: editionsError } = await supabase
      .from('editions')
      .select('id, name, logo_image, symbol_image, release_date, printed_total, total')
      .in('id', Array.from(editionIds));

    if (editionsError) {
      console.error("Erreur lors de la récupération des éditions:", editionsError);
      return { data: null, error: editionsError };
    }

    // Créer un dictionnaire pour un accès facile aux données des éditions
    const editionsMap: Record<string, any> = {};
    editionsData?.forEach((edition: any) => {
      editionsMap[edition.id] = edition;
    });

    // 3. Regrouper les cartes par édition
    const groupedCards: Record<string, any> = {};
    
    data?.forEach((card: any) => {
      if (!card.official_cards || !card.official_cards.edition_id) return;
      
      const editionId = card.official_cards.edition_id;
      const editionData = editionsMap[editionId];
      
      if (!editionData) return; // Si l'édition n'existe pas dans la table editions
      
      if (!groupedCards[editionId]) {
        groupedCards[editionId] = {
          id: editionId,
          name: editionData.name,
          logo_url: editionData.logo_image,
          symbol_url: editionData.symbol_image,
          release_date: editionData.release_date,
          printed_total: editionData.printed_total || 0,
          total: editionData.total || 0,
          cards: []
        };
      }
      
      groupedCards[editionId].cards.push({
        id: card.id,
        card_id: card.card_id,
        card_name: card.official_cards.name,
        card_image: card.official_cards.image_large || card.official_cards.image_small,
        rarity: card.official_cards.rarity,
        quantity: 1, // Par défaut, nous supposons que l'utilisateur possède 1 exemplaire
        condition: card.condition,
        is_for_sale: card.is_for_sale || false,
        price: card.price || 0
      });
    });
    
    // 4. Convertir l'objet en tableau pour faciliter l'affichage
    const editions = Object.values(groupedCards);
    
    // 5. Trier les éditions par date de sortie (du plus récent au plus ancien)
    editions.sort((a: any, b: any) => {
      return new Date(b.release_date || 0).getTime() - new Date(a.release_date || 0).getTime();
    });
    
    return { data: editions, error: null };
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération des cartes de l'utilisateur:", error);
    return { data: null, error };
  }
};

// Fonction pour récupérer les détails d'une édition et ses cartes
export const getEditionDetails = async (editionId: string, userId: string) => {
  try {
    // 1. Obtenir les détails de l'édition
    const { data: editionData, error: editionError } = await supabase
      .from('editions')
      .select('id, name, logo_image, symbol_image, release_date, printed_total, total')
      .eq('id', editionId)
      .single();
    
    if (editionError) {
      console.error("Erreur lors de la récupération des détails de l'édition:", editionError);
      return { data: null, error: editionError };
    }
    
    // 2. Récupérer toutes les cartes de cette édition
    const { data: cardsData, error: cardsError } = await supabase
      .from('official_cards')
      .select('id, name, number, rarity, image_small, image_large')
      .eq('edition_id', editionId)
      .order('number');
    
    if (cardsError) {
      console.error("Erreur lors de la récupération des cartes de l'édition:", cardsError);
      return { data: null, error: cardsError };
    }
    
    // 3. Récupérer les cartes possédées par l'utilisateur
    const { data: userCardsData, error: userCardsError } = await supabase
      .from('user_cards')
      .select('card_id, price, is_for_sale')
      .eq('user_id', userId);
    
    if (userCardsError) {
      console.error("Erreur lors de la récupération des cartes de l'utilisateur:", userCardsError);
      return { data: null, error: userCardsError };
    }
    
    // 4. Récupérer les prix du marché les plus récents pour les cartes de cette édition
    // On crée une liste des IDs de cartes pour la requête
    const cardIds = cardsData.map((card: any) => card.id);
    
    const { data: marketPricesData, error: marketPricesError } = await supabase
      .from('market_prices')
      .select('card_id, price_low, price_mid, price_high, date')
      .in('card_id', cardIds)
      .order('date', { ascending: false });
    
    if (marketPricesError) {
      console.error("Erreur lors de la récupération des prix du marché:", marketPricesError);
      // On continue même en cas d'erreur, on utilisera des prix par défaut
    }
    
    // Maps pour stocker les différents prix du marché pour chaque carte
    const marketPriceLowMap = new Map<string, number>();
    const marketPriceMidMap = new Map<string, number>();
    const marketPriceHighMap = new Map<string, number>();
    const marketPriceMap = new Map<string, number>(); // Prix moyen par défaut
    
    // Pour chaque carte, on ne garde que le prix le plus récent
    if (marketPricesData) {
      // On trie d'abord par ID de carte et date (plus récent en premier)
      marketPricesData.sort((a, b) => {
        if (a.card_id !== b.card_id) {
          return a.card_id.localeCompare(b.card_id);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      // On garde le premier prix (le plus récent) pour chaque carte
      const processedCardIds = new Set<string>();
      marketPricesData.forEach((priceData: any) => {
        if (!processedCardIds.has(priceData.card_id)) {
          if (priceData.price_low) {
            marketPriceLowMap.set(priceData.card_id, parseFloat(priceData.price_low));
          }
          if (priceData.price_mid) {
            marketPriceMidMap.set(priceData.card_id, parseFloat(priceData.price_mid));
            // On utilise le prix moyen comme prix par défaut
            marketPriceMap.set(priceData.card_id, parseFloat(priceData.price_mid));
          }
          if (priceData.price_high) {
            marketPriceHighMap.set(priceData.card_id, parseFloat(priceData.price_high));
          }
          
          processedCardIds.add(priceData.card_id);
        }
      });
    }
    
    // Créer un Set des cartes possédées pour une recherche rapide
    const ownedCardsSet = new Set<string>();
    const cardPriceMap = new Map<string, number>();
    const cardForSaleMap = new Map<string, boolean>();
    
    userCardsData?.forEach((card: any) => {
      ownedCardsSet.add(card.card_id);
      if (card.price !== null) {
        cardPriceMap.set(card.card_id, card.price);
      }
      cardForSaleMap.set(card.card_id, card.is_for_sale || false);
    });
    
    // Combiner les données
    const cardsWithOwnership = cardsData.map((card: any) => {
      const owned = ownedCardsSet.has(card.id);
      // Priorité au prix défini par l'utilisateur, sinon on prend le prix du marché
      const userPrice = cardPriceMap.get(card.id);
      const marketPrice = marketPriceMap.get(card.id);
      const price = userPrice !== undefined ? userPrice : marketPrice;
      const isForSale = cardForSaleMap.get(card.id) || false;
      
      return {
        ...card,
        owned,
        price,
        is_for_sale: isForSale,
        market_price_low: marketPriceLowMap.get(card.id),
        market_price_mid: marketPriceMidMap.get(card.id),
        market_price_high: marketPriceHighMap.get(card.id)
      };
    });
    
    // Calculer les statistiques
    const ownedCardsCount = cardsWithOwnership.filter((card: any) => card.owned).length;
    
    // Calculer la valeur totale des cartes possédées
    const totalValue = cardsWithOwnership.reduce((total: number, card: any) => {
      if (card.owned) {
        if (card.price !== null && card.price !== undefined) {
          return total + card.price;
        } else {
          // Si pas de prix défini, on utilise une valeur par défaut de 0
          return total;
        }
      }
      return total;
    }, 0);
    
    // Formatter les données à retourner
    const editionDetail = {
      ...editionData,
      cards: cardsWithOwnership,
      ownedCards: ownedCardsCount,
      totalValue: totalValue
    };
    
    return { data: editionDetail, error: null };
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération des détails de l'édition:", error);
    return { data: null, error };
  }
};

// Fonction pour récupérer toutes les cartes que l'utilisateur vend avec le prix de vente et le prix du marché
export const getUserCardsForSale = async (userId: string) => {
  try {
    // 1. Récupérer toutes les cartes en vente de l'utilisateur
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        id,
        card_id,
        price,
        condition,
        official_cards:card_id (
          id,
          name,
          image_small,
          edition_id,
          editions:edition_id (name)
        )
      `)
      .eq('user_id', userId)
      .eq('is_for_sale', true);

    if (error) {
      console.error('Erreur lors de la récupération des cartes en vente de l\'utilisateur:', error);
      return { data: [], error };
    }

    // 2. Récupérer les prix du marché pour ces cartes
    const cardIds = data.map(card => card.card_id);
    let marketPrices: Array<{ card_id: string; price_mid: number; date: string }> = [];
    
    if (cardIds.length > 0) {
      const { data: pricesData, error: pricesError } = await supabase
        .from('market_prices')
        .select('card_id, price_mid, date')
        .in('card_id', cardIds)
        .order('date', { ascending: false });
        
      if (pricesError) {
        console.error('Erreur lors de la récupération des prix du marché:', pricesError);
      } else {
        marketPrices = pricesData || [];
      }
    }

    // 3. Transformer les données en associant les prix du marché
    const formatted = data?.map((item: any) => {
      // Trouver le prix mid le plus récent pour cette carte
      let marketPriceMid = null;
      const cardPrices = marketPrices.filter(price => price.card_id === item.card_id);
      
      if (cardPrices.length > 0) {
        // Trier par date décroissante et prendre le premier
        const sorted = [...cardPrices].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        marketPriceMid = sorted[0]?.price_mid ?? null;
      }
      
      return {
        user_card_id: item.id,
        card_id: item.official_cards?.id,
        card_name: item.official_cards?.name,
        image_small: item.official_cards?.image_small,
        edition_name: item.official_cards?.editions?.name,
        price: item.price,
        condition: item.condition,
        market_price_mid: marketPriceMid,
      };
    }) || [];

    return { data: formatted, error: null };
  } catch (error) {
    console.error('Erreur inattendue dans getUserCardsForSale:', error);
    return { data: [], error };
  }
};

// Fonction pour récupérer toutes les cartes en vente par d'autres utilisateurs
export const getCardsForSaleFromOthers = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        id,
        card_id,
        price,
        condition,
        user_id,
        official_cards:card_id (
          id,
          name,
          image_small,
          edition_id,
          editions:edition_id (name)
        )
      `)
      .eq('is_for_sale', true)
      .neq('user_id', userId);

    if (error) {
      console.error('Erreur lors de la récupération des cartes en vente par d\'autres utilisateurs:', error);
      return { data: [], error };
    }

    // 2. Récupérer les prix du marché pour ces cartes
    const cardIds = data.map(card => card.card_id);
    let marketPrices: Array<{ card_id: string; price_mid: number; date: string }> = [];
    
    if (cardIds.length > 0) {
      const { data: pricesData, error: pricesError } = await supabase
        .from('market_prices')
        .select('card_id, price_mid, date')
        .in('card_id', cardIds)
        .order('date', { ascending: false });
        
      if (pricesError) {
        console.error('Erreur lors de la récupération des prix du marché:', pricesError);
      } else {
        marketPrices = pricesData || [];
      }
    }

    // 3. Transformer les données en associant les prix du marché
    const formatted = data?.map((item: any) => {
      // Trouver le prix mid le plus récent pour cette carte
      let marketPriceMid = null;
      const cardPrices = marketPrices.filter(price => price.card_id === item.card_id);
      
      if (cardPrices.length > 0) {
        // Trier par date décroissante et prendre le premier
        const sorted = [...cardPrices].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        marketPriceMid = sorted[0]?.price_mid ?? null;
      }
      
      return {
        user_card_id: item.id,
        card_id: item.official_cards?.id,
        card_name: item.official_cards?.name,
        image_small: item.official_cards?.image_small,
        edition_name: item.official_cards?.editions?.name,
        price: item.price,
        condition: item.condition,
        market_price_mid: marketPriceMid,
        seller_id: item.user_id,
      };
    }) || [];

    return { data: formatted, error: null };
  } catch (error) {
    console.error('Erreur inattendue dans getCardsForSaleFromOthers:', error);
    return { data: [], error };
  }
};

// Fonction pour calculer la valeur totale de la collection d'un utilisateur
export const getUserCollectionTotalValue = async (userId: string) => {
  try {
    // 1. Récupérer les cartes de l'utilisateur avec leurs IDs
    const { data: userCards, error: userCardsError } = await supabase
      .from('user_cards')
      .select(`
        id,
        card_id,
        price
      `)
      .eq('user_id', userId);
    
    if (userCardsError) {
      console.error("Erreur lors du calcul de la valeur totale de la collection:", userCardsError);
      return { totalValue: 0, error: userCardsError };
    }
    
    if (!userCards || userCards.length === 0) {
      return { totalValue: 0, error: null };
    }
    
    // Extraire les IDs des cartes
    const cardIds = userCards.map(card => card.card_id);
    
    // 2. Récupérer les prix du marché pour les cartes sans prix manuel
    const { data: marketPrices, error: marketPricesError } = await supabase
      .from('market_prices')
      .select('card_id, price_mid')
      .in('card_id', cardIds)
      .order('date', { ascending: false });
      
    if (marketPricesError) {
      console.error("Erreur lors de la récupération des prix du marché:", marketPricesError);
      // Continuer avec les prix définis manuellement uniquement
    }
    
    // Créer une map des prix du marché les plus récents
    const marketPriceMap = new Map();
    if (marketPrices) {
      // Pour chaque carte, ne garder que le prix le plus récent
      const seenCardIds = new Set();
      marketPrices.forEach(price => {
        if (!seenCardIds.has(price.card_id) && price.price_mid !== null) {
          marketPriceMap.set(price.card_id, price.price_mid);
          seenCardIds.add(price.card_id);
        }
      });
    }
    
    // 3. Calculer la valeur totale en utilisant le prix manuel s'il existe, sinon le prix du marché
    let totalValue = 0;
    
    userCards.forEach(card => {
      if (card.price !== null && card.price !== undefined) {
        // Utiliser le prix manuel s'il est défini
        totalValue += card.price;
      } else {
        // Sinon, utiliser le prix du marché s'il est disponible
        const marketPrice = marketPriceMap.get(card.card_id);
        if (marketPrice !== undefined) {
          totalValue += marketPrice;
        }
        // Si aucun prix n'est disponible, la valeur est 0
      }
    });
    
    console.log(`Valeur totale calculée: ${totalValue} € pour ${userCards.length} cartes`);
    
    return { totalValue, error: null };
  } catch (error) {
    console.error("Exception lors du calcul de la valeur totale:", error);
    return { totalValue: 0, error };
  }
};

// Fonction pour calculer la variation de prix de la collection entre deux dates
export const getCollectionPriceVariation = async (userId: string) => {
  try {
    // 1. Récupérer les cartes de l'utilisateur avec leurs IDs officiels
    const { data: userCards, error: userCardsError } = await supabase
      .from('user_cards')
      .select(`
        card_id
      `)
      .eq('user_id', userId);
    
    if (userCardsError) {
      console.error("Erreur lors de la récupération des cartes de l'utilisateur:", userCardsError);
      return { variation: 0, error: userCardsError };
    }
    
    if (!userCards || userCards.length === 0) {
      return { variation: 0, error: null };
    }
    
    // Récupérer les IDs des cartes pour la requête
    const cardIds = userCards.map(card => card.card_id);
    
    // 2. Récupérer la date actuelle et d'il y a une semaine
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 8); // 8 jours en arrière pour avoir une semaine complète
    
    const todayStr = today.toISOString().split('T')[0];
    const lastWeekStr = lastWeek.toISOString().split('T')[0];
    
    // 3. Récupérer les prix les plus récents jusqu'à aujourd'hui
    const { data: currentPrices, error: currentError } = await supabase
      .from('market_prices')
      .select('card_id, price_mid, date')
      .in('card_id', cardIds)
      .lte('date', todayStr)
      .order('date', { ascending: false });
    
    if (currentError) {
      console.error("Erreur lors de la récupération des prix actuels:", currentError);
      return { variation: 0, error: currentError };
    }
    
    // 4. Récupérer les prix jusqu'à la semaine dernière
    const { data: previousPrices, error: previousError } = await supabase
      .from('market_prices')
      .select('card_id, price_mid, date')
      .in('card_id', cardIds)
      .lte('date', lastWeekStr)
      .order('date', { ascending: false });
    
    if (previousError) {
      console.error("Erreur lors de la récupération des prix précédents:", previousError);
      return { variation: 0, error: previousError };
    }
    
    // 5. Calculer la moyenne des prix pour chaque période
    
    // Obtenir le prix le plus récent pour chaque carte (période actuelle)
    const latestPriceByCard = new Map();
    if (currentPrices) {
      // Trier par card_id, puis par date (décroissante)
      currentPrices.sort((a, b) => {
        if (a.card_id !== b.card_id) return a.card_id.localeCompare(b.card_id);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      // Prendre le premier prix pour chaque carte (le plus récent)
      for (const price of currentPrices) {
        if (!latestPriceByCard.has(price.card_id) && price.price_mid !== null) {
          latestPriceByCard.set(price.card_id, price.price_mid);
        }
      }
    }
    
    // Obtenir le prix le plus récent pour chaque carte (période précédente)
    const previousPriceByCard = new Map();
    if (previousPrices) {
      // Trier par card_id, puis par date (décroissante)
      previousPrices.sort((a, b) => {
        if (a.card_id !== b.card_id) return a.card_id.localeCompare(b.card_id);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      // Prendre le premier prix pour chaque carte (le plus récent)
      for (const price of previousPrices) {
        if (!previousPriceByCard.has(price.card_id) && price.price_mid !== null) {
          previousPriceByCard.set(price.card_id, price.price_mid);
        }
      }
    }
    
    // Calculer la somme des prix actuels et précédents
    let currentTotal = 0;
    let previousTotal = 0;
    let cardsWithBothPrices = 0;
    
    for (const cardId of cardIds) {
      const currentPrice = latestPriceByCard.get(cardId);
      const previousPrice = previousPriceByCard.get(cardId);
      
      if (currentPrice !== undefined) {
        currentTotal += currentPrice;
      }
      
      if (previousPrice !== undefined) {
        previousTotal += previousPrice;
      }
      
      if (currentPrice !== undefined && previousPrice !== undefined) {
        cardsWithBothPrices++;
      }
    }
    
    // 6. Calculer la variation en pourcentage
    if (previousTotal === 0 || cardsWithBothPrices === 0) {
      // Pas assez de données pour calculer une variation
      return { variation: 0, error: null };
    }
    
    const variation = ((currentTotal - previousTotal) / previousTotal) * 100;
    
    return { 
      variation, 
      currentTotal,
      previousTotal,
      cardsWithPrices: cardsWithBothPrices,
      error: null 
    };
  } catch (error) {
    console.error("Exception lors du calcul de la variation de prix:", error);
    return { variation: 0, error };
  }
};

// Fonction pour récupérer les détails d'une carte officielle
export const getOfficialCardDetails = async (cardId: string) => {
  try {
    const { data, error } = await supabase
      .from('official_cards')
      .select('id, name, number, rarity, image_small, image_large')
      .eq('id', cardId)
      .single();
    
    if (error) {
      console.error("Erreur lors de la récupération des détails de la carte:", error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération des détails de la carte:", error);
    return { data: null, error };
  }
};

// Fonction pour récupérer les prix du marché pour une carte
export const getMarketPricesForCard = async (cardId: string) => {
  try {
    const { data, error } = await supabase
      .from('market_prices')
      .select('price_low, price_mid, price_high')
      .eq('card_id', cardId)
      .order('date', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error("Erreur lors de la récupération des prix du marché:", error);
      return { data: null, error };
    }
    
    return { data: data || null, error: null };
  } catch (error) {
    console.error("Erreur inattendue lors de la récupération des prix du marché:", error);
    return { data: null, error };
  }
};

// Fonction pour récupérer les cartes en vente pour une carte officielle
export const getCardsForSale = async (cardId: string) => {
  try {
    console.log(`[getCardsForSale] Début de récupération des cartes pour cardId: ${cardId}`);
    
    // Récupérer les cartes en vente avec jointure publique sur users
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        id, 
        user_id, 
        card_id, 
        condition, 
        price, 
        is_for_sale, 
        created_at,
        users!user_cards_user_id_fkey (
          username, 
          avatar_url
        )
      `)
      .eq('card_id', cardId)
      .eq('is_for_sale', true)
      .order('price', { ascending: true });
    
    if (error) {
      console.error("[getCardsForSale] Erreur lors de la récupération des cartes en vente:", error);
      return { data: null, error };
    }
    
    console.log(`[getCardsForSale] Nombre de cartes récupérées: ${data?.length || 0}`);
    // Afficher les données brutes pour les 2 premières cartes (si disponibles)
    if (data && data.length > 0) {
      console.log("[getCardsForSale] Première carte, données brutes:", JSON.stringify(data[0], null, 2));
      console.log("[getCardsForSale] Première carte, users:", JSON.stringify(data[0].users, null, 2));
      
      if (data.length > 1) {
        console.log("[getCardsForSale] Deuxième carte, users:", JSON.stringify(data[1].users, null, 2));
      }
    }
    
    // Transformer la structure des données
    const formattedData = data?.map(card => {
      // Vérifier si users est un objet ou un tableau et extraire les données en conséquence
      console.log(`[getCardsForSale] Traitement de carte id: ${card.id}, user_id: ${card.user_id}, 
                   type de users: ${typeof card.users}, 
                   users est null?: ${card.users === null}, 
                   users est Array?: ${Array.isArray(card.users)}`);
      
      let userInfo: UserInfo;
      if (Array.isArray(card.users)) {
        userInfo = card.users[0] || {}; // Prendre le premier élément si c'est un tableau
        console.log("[getCardsForSale] userInfo depuis tableau:", JSON.stringify(userInfo, null, 2));
      } else if (card.users && typeof card.users === 'object') {
        userInfo = card.users as unknown as UserInfo || {}; // Casting si c'est un objet
        console.log("[getCardsForSale] userInfo depuis objet:", JSON.stringify(userInfo, null, 2));
      } else {
        userInfo = { username: '', avatar_url: '' };
        console.log("[getCardsForSale] userInfo par défaut car users est null ou undefined");
      }
      
      const result = {
        id: card.id,
        user_id: card.user_id,
        card_id: card.card_id,
        condition: card.condition,
        price: card.price,
        is_for_sale: card.is_for_sale,
        created_at: card.created_at,
        user: {
          username: userInfo.username || '',
          avatar_url: userInfo.avatar_url || ''
        }
      };
      
      console.log(`[getCardsForSale] Carte formatée: id=${result.id}, username=${result.user.username}`);
      
      return result;
    }) || [];
    
    // Si aucune carte n'est trouvée
    if (!data || data.length === 0) {
      console.log("[getCardsForSale] Aucune carte trouvée");
      return { data: [], error: null };
    }
    
    return { data: formattedData, error: null };
  } catch (error) {
    console.error("[getCardsForSale] Erreur inattendue lors de la récupération des cartes en vente:", error);
    return { data: null, error };
  }
};

// Fonction pour ajouter ou retirer une carte de la wishlist
export const addOrRemoveFromWishlist = async (userId: string, cardId: string) => {
  try {
    // Vérifier si la carte est déjà dans la wishlist
    const { data: existing, error: checkError } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('card_id', cardId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      // Si déjà dans la wishlist, on retire
      const { error: deleteError } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId);
      if (deleteError) throw deleteError;
      return { added: false };
    } else {
      // Sinon, on ajoute
      const { error: insertError } = await supabase
        .from('wishlists')
        .insert([{ user_id: userId, card_id: cardId }]);
      if (insertError) throw insertError;
      return { added: true };
    }
  } catch (error) {
    console.error('Erreur wishlist:', error);
    return { error };
  }
};

// Fonction pour récupérer la wishlist d'un utilisateur
export const getUserWishlist = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', userId);
    if (error) throw error;
    return { data: data?.map(w => w.card_id) || [], error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération de la wishlist:', error);
    return { data: [], error };
  }
};

// Fonction pour récupérer les alertes de prix d'un utilisateur
export const getUserPriceAlerts = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('price_alerts')
      .select('card_id')
      .eq('user_id', userId);
    if (error) throw error;
    return { data: data?.map(a => a.card_id) || [], error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes de prix:', error);
    return { data: [], error };
  }
};

// Fonction pour récupérer les 100 cartes les plus chères (prix_mid le plus récent)
export const getTopCards = async () => {
  try {
    // Récupération des cartes depuis la vue avec un JOIN pour obtenir l'image
    const { data, error } = await supabase
      .from('market_card_last')
      .select(`
        card_id, 
        card_name, 
        price_mid,
        official_cards:card_id (
          image_small,
          edition_id,
          editions:edition_id (
            name
          )
        )
      `)
      .order('price_mid', { ascending: false })
      .limit(100);
  
    
    // Transformation des données pour ajouter l'image_small
    const transformedData = data?.map(card => {
      // Extraire les données de official_cards de manière sûre
      const officialCard = card.official_cards as unknown as OfficialCard;
      
      return {
        card_id: card.card_id,
        card_name: card.card_name,
        price_mid: card.price_mid,
        image_small: officialCard?.image_small,
        edition_name: officialCard?.editions?.name
      };
    });
    
    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des top cartes:', error);
    return { data: [], error };
  }
};

// Fonction pour récupérer les cartes avec la plus forte hausse sur les 2 dernières dates
export const getTopGainers = async () => {
  try {
    const { data, error } = await supabase
      .from('market_card_last2_diff')
      .select(`
        card_id, 
        card_name, 
        last_price, 
        prev_price, 
        diff, 
        diff_percent,
        official_cards:card_id (
          image_small,
          edition_id,
          editions:edition_id (
            name
          )
        )
      `)
      .order('diff', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Erreur dans getTopGainers:', error);
      throw error;
    }
    
    // Log des données reçues
    console.log('Données brutes de getTopGainers:', JSON.stringify(data?.[0], null, 2));
    
    // Transformation des données pour ajouter l'image_small
    const transformedData = data?.map(card => {
      // Extraire les données de official_cards de manière sûre
      const officialCard = card.official_cards as unknown as OfficialCard;
      
      // Calculer diff et diff_percent si nécessaire
      let diff = card.diff;
      let diffPercent = card.diff_percent;
      
      // Si diff est null mais que nous avons last_price et prev_price, calculer manuellement
      if ((diff === null || diff === undefined) && 
          card.last_price !== null && card.last_price !== undefined &&
          card.prev_price !== null && card.prev_price !== undefined) {
        diff = card.last_price - card.prev_price;
      }
      
      // Si diff_percent est null mais que nous avons prev_price, calculer manuellement
      if ((diffPercent === null || diffPercent === undefined) &&
          card.prev_price !== null && card.prev_price !== undefined && 
          card.prev_price !== 0 &&
          diff !== null && diff !== undefined) {
        diffPercent = (diff / card.prev_price) * 100;
      }
      
      // Si pas de prix précédent, ne pas calculer de différence
      if (card.prev_price === null || card.prev_price === undefined) {
        diff = 0;
        diffPercent = 0;
      }
      
      return {
        card_id: card.card_id,
        card_name: card.card_name,
        last_price: card.last_price,
        prev_price: card.prev_price,
        diff: diff,
        diff_percent: diffPercent,
        image_small: officialCard?.image_small,
        edition_name: officialCard?.editions?.name
      };
    });
    
    // Trier à nouveau par différence (descendant) après avoir recalculé les valeurs
    const sortedData = transformedData?.sort((a, b) => {
      // Si différence est la même, trier par pourcentage
      if (b.diff === a.diff) {
        return (b.diff_percent || 0) - (a.diff_percent || 0);
      }
      return (b.diff || 0) - (a.diff || 0);
    }) || [];
    
    // Log des données transformées
    console.log('Données transformées de getTopGainers:', JSON.stringify(sortedData?.[0], null, 2));
    
    return { data: sortedData, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des meilleures hausses:', error);
    return { data: [], error };
  }
};
// Fonction pour récupérer les cartes ayant la plus forte baisse sur les 2 dernières dates
export const getTopLosers = async () => {
  try {
    const { data, error } = await supabase
      .from('market_card_last2_diff')
      .select(`
        card_id, 
        card_name, 
        last_price, 
        prev_price, 
        diff, 
        diff_percent,
        official_cards:card_id (
          image_small,
          edition_id,
          editions:edition_id (
            name
          )
        )
      `)
      .order('diff', { ascending: true })
      .limit(50);
    
    if (error) {
      console.error('Erreur dans getTopLosers:', error);
      throw error;
    }
    
    // Log des données reçues
    console.log('Données brutes de getTopLosers:', JSON.stringify(data?.[0], null, 2));
    
    // Transformation des données pour ajouter l'image_small
    const transformedData = data?.map(card => {
      // Extraire les données de official_cards de manière sûre
      const officialCard = card.official_cards as unknown as OfficialCard;
      
      // Calculer diff et diff_percent si nécessaire
      let diff = card.diff;
      let diffPercent = card.diff_percent;
      
      // Si diff est null mais que nous avons last_price et prev_price, calculer manuellement
      if ((diff === null || diff === undefined) && 
          card.last_price !== null && card.last_price !== undefined &&
          card.prev_price !== null && card.prev_price !== undefined) {
        diff = card.last_price - card.prev_price;
      }
      
      // Si diff_percent est null mais que nous avons prev_price, calculer manuellement
      if ((diffPercent === null || diffPercent === undefined) &&
          card.prev_price !== null && card.prev_price !== undefined && 
          card.prev_price !== 0 &&
          diff !== null && diff !== undefined) {
        diffPercent = (diff / card.prev_price) * 100;
      }
      
      // Si pas de prix précédent, ne pas calculer de différence
      if (card.prev_price === null || card.prev_price === undefined) {
        diff = 0;
        diffPercent = 0;
      }
      
      return {
        card_id: card.card_id,
        card_name: card.card_name,
        last_price: card.last_price,
        prev_price: card.prev_price,
        diff: diff,
        diff_percent: diffPercent,
        image_small: officialCard?.image_small,
        edition_name: officialCard?.editions?.name
      };
    });
    
    // Trier à nouveau par différence (ascendant) après avoir recalculé les valeurs
    const sortedData = transformedData?.sort((a, b) => {
      // Si différence est la même, trier par pourcentage
      if (a.diff === b.diff) {
        return (a.diff_percent || 0) - (b.diff_percent || 0);
      }
      return (a.diff || 0) - (b.diff || 0);
    }) || [];
    
    // Log des données transformées
    console.log('Données transformées de getTopLosers:', JSON.stringify(sortedData?.[0], null, 2));
    
    return { data: sortedData, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des plus fortes baisses:', error);
    return { data: [], error };
  }
};

// Fonction pour récupérer les cartes surveillées (wishlist + alertes) d'un utilisateur
export const getWatchedCards = async (userId: string) => {
  try {
    // Récupérer les card_id de la wishlist
    const { data: wishlist, error: wishlistError } = await supabase
      .from('wishlists')
      .select('card_id')
      .eq('user_id', userId);
    
    if (wishlistError) {
      console.error('Erreur lors de la récupération de la wishlist:', wishlistError);
      return { data: [], error: wishlistError };
    }
    
    // Récupérer les card_id des alertes de prix
    const { data: alerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select('card_id')
      .eq('user_id', userId);
    
    if (alertsError) {
      console.error('Erreur lors de la récupération des alertes de prix:', alertsError);
      return { data: [], error: alertsError };
    }
    
    // Combiner les ID de cartes uniques de la wishlist et des alertes
    const watchedCardIds = new Set<string>();
    wishlist?.forEach((item: any) => watchedCardIds.add(item.card_id));
    alerts?.forEach((item: any) => watchedCardIds.add(item.card_id));
    
    // Si aucune carte n'est surveillée, retourner un tableau vide
    if (watchedCardIds.size === 0) {
      return { data: [], error: null };
    }
    
    // Récupérer les détails des cartes surveillées
    const { data: cards, error: cardsError } = await supabase
      .from('official_cards')
      .select(`
        id,
        name,
        number,
        rarity,
        image_small,
        image_large,
        edition_id,
        editions:edition_id (
          name
        ),
        market_prices!market_prices_card_id_fkey(
          price_low,
          price_mid,
          price_high,
          date
        )
      `)
      .in('id', Array.from(watchedCardIds))
      .order('name');
    
    if (cardsError) {
      console.error('Erreur lors de la récupération des cartes surveillées:', cardsError);
      return { data: [], error: cardsError };
    }
    
    // Transformer les données pour supprimer les niveaux imbriqués
    const transformedCards = cards?.map((card: any) => {
      // Trouver le prix le plus récent
      let latestPrice = null;
      let latestDate = null;
      
      if (card.market_prices && card.market_prices.length > 0) {
        // Trier les prix par date (plus récent en premier)
        const sortedPrices = [...card.market_prices].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        latestPrice = sortedPrices[0];
        latestDate = latestPrice ? new Date(latestPrice.date).toISOString().split('T')[0] : null;
      }
      
      return {
        card_id: card.id,
        card_name: card.name,
        number: card.number,
        rarity: card.rarity,
        image_small: card.image_small,
        price_low: latestPrice?.price_low,
        price_mid: latestPrice?.price_mid,
        price_high: latestPrice?.price_high,
        last_updated: latestDate,
        edition_name: card.editions?.name
      };
    });
    
    return { data: transformedCards, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des cartes surveillées:', error);
    return { data: [], error };
  }
};

// Fonction pour se connecter avec Google
export const signInWithGoogle = async () => {
  try {
    // Nettoyage des flags de session précédents
    await AsyncStorage.removeItem('@auth_redirect_needed');
    
    // Démarrage de l'authentification OAuth avec Google
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
        skipBrowserRedirect: true,
        queryParams: {
          // Force le rafraîchissement de l'écran de consentement
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      console.error('[signInWithGoogle] Erreur lors de la connexion avec Google:', error);
      return { data: null, error };
    }
    
    // Stocker un indicateur que nous sommes en attente d'une redirection OAuth
    await AsyncStorage.setItem('@auth_oauth_pending', 'true');

    return { data, error: null };
  } catch (error: any) {
    console.error('[signInWithGoogle] Erreur inattendue lors de la connexion avec Google:', error);
    return { data: null, error };
  }
};

// Fonction pour rechercher des cartes par nom
export const searchCards = async (searchTerm: string, limit: number = 10) => {
  try {
    if (!searchTerm || searchTerm.trim() === '') {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('official_cards')
      .select(`
        id,
        name,
        number,
        rarity,
        image_small,
        edition_id,
        editions:edition_id (
          name
        ),
        market_prices!market_prices_card_id_fkey(
          price_mid
        )
      `)
      .ilike('name', `%${searchTerm}%`)
      .order('name')
      .limit(limit);

    if (error) {
      console.error('Erreur lors de la recherche de cartes:', error);
      return { data: [], error };
    }

    // Transformer les données pour être plus facilement utilisables
    const transformedData = data?.map(card => {
      // Trouver le prix le plus récent
      let priceMid = null;
      
      if (card.market_prices && Array.isArray(card.market_prices) && card.market_prices.length > 0) {
        priceMid = card.market_prices[0].price_mid;
      }
      
      // Extraire le nom de l'édition de manière sécurisée
      let editionName = '';
      if (card.editions) {
        // Si editions est un tableau, prendre le premier élément
        if (Array.isArray(card.editions) && card.editions.length > 0 && card.editions[0].name) {
          editionName = card.editions[0].name;
        } 
        // Si editions est un objet, prendre sa propriété name
        else if (typeof card.editions === 'object' && card.editions !== null && 'name' in card.editions) {
          editionName = (card.editions as any).name;
        }
      }
      
      return {
        card_id: card.id,
        card_name: card.name,
        number: card.number,
        rarity: card.rarity,
        image_small: card.image_small,
        price_mid: priceMid,
        edition_name: editionName
      };
    });

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de la recherche de cartes:', error);
    return { data: [], error };
  }
};

// Fonction pour enregistrer une offre d'achat
export const createOffer = async ({ buyer_id, seller_id, user_card_id, proposed_price, message = '' }: {
  buyer_id: string,
  seller_id: string,
  user_card_id: string,
  proposed_price: number,
  message?: string
}) => {
  try {
    const { data, error } = await supabase
      .from('offers')
      .insert([
        {
          buyer_id,
          seller_id,
          user_card_id,
          proposed_price,
          message,
          status: 'pending',
        }
      ])
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erreur lors de la création de l\'offre:', error);
    return { data: null, error };
  }
};

// Fonction pour créer une notification pour le vendeur
export const createOfferNotification = async ({ seller_id, card_id, user_card_id, card_name, type = 'offer' }: {
  seller_id: string,
  card_id: string,
  user_card_id?: string,
  card_name: string,
  type?: string
}) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: seller_id,
          type,
          card_id,
          user_card_id,
          is_read: false,
          data: { card: card_name },
        }
      ]);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erreur lors de la création de la notification d\'offre:', error);
    return { data: null, error };
  }
};

// Fonction pour récupérer toutes les notifications d'un utilisateur
export const getUserNotifications = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erreur lors de la récupération des notifications:', error);
    return { data: [], error };
  }
};

// Fonction pour archiver une notification
export const archiveNotification = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ archived: true })
      .eq('id', notificationId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'archivage de la notification:', error);
    return { success: false, error };
  }
};

// Fonction pour marquer toutes les notifications comme lues
export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('archived', false);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erreur lors du marquage de toutes les notifications comme lues:', error);
    return { success: false, error };
  }
};

// Fonction pour marquer une notification comme lue
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erreur lors du marquage de la notification comme lue:', error);
    return { success: false, error };
  }
};

// Fonction pour refuser une offre
export const refuseOffer = async (offerId: string) => {
  try {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'cancel' })
      .eq('id', offerId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erreur lors du refus de l\'offre:', error);
    return { success: false, error };
  }
};

// Fonction pour notifier l'acheteur du refus de son offre
export const createRefuseOfferNotification = async ({ buyer_id, user_card_id, card_name }: {
  buyer_id: string,
  user_card_id: string,
  card_name: string,
}) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: buyer_id,
          type: 'OfferRefused',
          user_card_id,
          is_read: false,
          data: { card: card_name },
        }
      ]);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erreur lors de la notification de refus d\'offre:', error);
    return { data: null, error };
  }
};

// Fonction pour rechercher des cartes par détails (nom, HP, numéro)
export const searchOfficialCardsByDetails = async (details: { pokemonName?: string | null, healthPoints?: string | null, cardNumber?: string | null }) => {
  try {
    console.log('Recherche de cartes avec détails:', JSON.stringify(details));
    
    // Si aucun critère de recherche, retourner un tableau vide
    if (!details.pokemonName && !details.healthPoints && !details.cardNumber) {
      return { data: [], error: null };
    }
    
    let query = supabase
      .from('official_cards')
      .select(`
        id,
        name,
        hp,
        number,
        supertype,
        types,
        rarity,
        image_small,
        image_large,
        edition_id,
        editions:edition_id (
          name,
          symbol_image
        )
      `);
    
    // Ajouter les filtres si disponibles
    if (details.pokemonName) {
      query = query.ilike('name', `%${details.pokemonName}%`);
    }
    
    if (details.healthPoints) {
      query = query.eq('hp', details.healthPoints);
    }
    
    if (details.cardNumber) {
      // Extraire juste le numéro de la carte sans le dénominateur
      const numberParts = details.cardNumber.split('/');
      if (numberParts.length > 0) {
        let cardNumber = numberParts[0].trim();
        
        // Traitement pour retirer les zéros en début si c'est un nombre pur
        // Mais garder les préfixes comme "SM", "XY", etc.
        if (/^\d+$/.test(cardNumber)) {
          // Si c'est uniquement des chiffres, retirer les zéros en début
          cardNumber = parseInt(cardNumber, 10).toString();
        } else if (/^([A-Z]+)(\d+)$/.test(cardNumber)) {
          // Si c'est un format comme "SM098", garder le préfixe et retirer les zéros du nombre
          const match = cardNumber.match(/^([A-Z]+)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const number = parseInt(match[2], 10).toString();
            cardNumber = prefix + number;
          }
        }
        
        // Log pour debug
        console.log(`Numéro original: "${details.cardNumber}" -> Numéro traité: "${cardNumber}"`);
        
        // Essayer de trouver avec le numéro traité
        query = query.eq('number', cardNumber);
      }
    }
    
    // Exécuter la requête
    const { data, error } = await query.order('name');
    
    if (error) {
      console.error('Erreur lors de la recherche de cartes par détails:', error);
      return { data: [], error };
    }
    
    console.log(`Résultats trouvés: ${data?.length || 0}`);
    
    // Transformer les données pour être plus facilement utilisables
    const transformedData = data?.map(card => {
      // Extraire le nom de l'édition de manière sécurisée
      let editionName = '';
      let editionSymbol = '';
      
      if (card.editions) {
        // Si editions est un tableau, prendre le premier élément
        if (Array.isArray(card.editions) && card.editions.length > 0) {
          editionName = card.editions[0].name || '';
          editionSymbol = card.editions[0].symbol_image || '';
        } 
        // Si editions est un objet, prendre ses propriétés
        else if (typeof card.editions === 'object' && card.editions !== null) {
          editionName = (card.editions as any).name || '';
          editionSymbol = (card.editions as any).symbol_image || '';
        }
      }
      
      return {
        id: card.id,
        name: card.name,
        hp: card.hp,
        number: card.number,
        supertype: card.supertype,
        types: card.types,
        rarity: card.rarity,
        image_small: card.image_small,
        image_large: card.image_large,
        edition: {
          name: editionName,
          symbol: editionSymbol
        }
      };
    }) || [];
    
    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de la recherche de cartes par détails:', error);
    return { data: [], error };
  }
};

// Initialisation du bucket userimages (sera créé s'il n'existe pas)
export const initUserImagesBucket = async () => {
  try {
    // Vérifier si le bucket existe
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketsError) {
      console.error('Erreur lors de la vérification des buckets:', bucketsError);
      return { error: bucketsError };
    }
    
    const userimagesBucketExists = buckets?.some(bucket => bucket.name === 'userimages');
    
    // Si le bucket n'existe pas, le créer
    if (!userimagesBucketExists) {
      console.log('Création du bucket userimages...');
      const { error: createError } = await supabase
        .storage
        .createBucket('userimages', {
          public: true, // Rendre le bucket accessible publiquement
        });
      
      if (createError) {
        console.error('Erreur lors de la création du bucket userimages:', createError);
        return { error: createError };
      }
      console.log('Bucket userimages créé avec succès');
    } else {
      console.log('Le bucket userimages existe déjà');
      
      // Mettre à jour les permissions pour être sûr
      const { error: updateError } = await supabase
        .storage
        .updateBucket('userimages', {
          public: true,
        });
      
      if (updateError) {
        console.error('Erreur lors de la mise à jour des permissions du bucket:', updateError);
        return { error: updateError };
      }
    }
    
    return { error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de l\'initialisation du bucket userimages:', error);
    return { error };
  }
};

// Fonction pour ajouter une carte à la collection de l'utilisateur
export const addCardToCollection = async ({ 
  userId, 
  cardId, 
  condition = 'excellent', 
  imageBase64 = null 
}: {
  userId: string,
  cardId: string,
  condition?: string,
  imageBase64?: string | null
}) => {
  try {
    console.log(`[addCardToCollection] Ajout de la carte ${cardId} à la collection de l'utilisateur ${userId}`);
    
    // Initialiser le bucket userimages si besoin
    await initUserImagesBucket();
    
    let imageUrl = null;
    
    // Si une image est fournie, l'enregistrer dans le bucket
    if (imageBase64) {
      console.log('[addCardToCollection] Image fournie, enregistrement dans le bucket userimages');
      
      // Générer un nom de fichier unique
      const fileName = `${userId}_${cardId}_${Date.now()}.jpg`;
      
      // Supprimer le préfixe data:image/jpeg;base64, s'il existe
      const base64Data = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1]
        : imageBase64;
      
      // Enregistrer l'image dans le bucket
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('userimages')
        .upload(fileName, decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true,
        });
      
      if (uploadError) {
        console.error('[addCardToCollection] Erreur lors de l\'upload de l\'image:', uploadError);
      } else {
        // Récupérer l'URL publique de l'image
        const { data: publicUrlData } = supabase
          .storage
          .from('userimages')
          .getPublicUrl(fileName);
        
        imageUrl = publicUrlData?.publicUrl || null;
        console.log(`[addCardToCollection] Image enregistrée avec succès: ${imageUrl}`);
      }
    }
    
    // Ajouter la carte à la collection de l'utilisateur
    const { data, error } = await supabase
      .from('user_cards')
      .insert([{
        user_id: userId,
        card_id: cardId,
        condition: condition,
        is_for_sale: false,
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error('[addCardToCollection] Erreur lors de l\'ajout de la carte à la collection:', error);
      return { data: null, error };
    }
    
    console.log(`[addCardToCollection] Carte ajoutée avec succès à la collection`);
    return { data: data?.[0] || null, error: null };
  } catch (error) {
    console.error('[addCardToCollection] Erreur inattendue lors de l\'ajout de la carte à la collection:', error);
    return { data: null, error };
  }
};

// Helper function to decode base64
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Fonction pour récupérer le nombre de cartes de l'utilisateur qui ont au moins une offre
export const getUserCardsWithOffersCount = async (userId: string) => {
  try {
    // Récupérer les cartes en vente de l'utilisateur qui ont des offres
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        id,
        offers!offers_user_card_id_fkey(id)
      `)
      .eq('user_id', userId)
      .eq('is_for_sale', true);

    if (error) {
      console.error('Erreur lors de la récupération des cartes avec offres:', error);
      return { count: 0, error };
    }

    // Compter les cartes qui ont au moins une offre
    const cardsWithOffers = data?.filter(card => 
      card.offers && Array.isArray(card.offers) && card.offers.length > 0
    ) || [];

    return { count: cardsWithOffers.length, error: null };
  } catch (error) {
    console.error('Erreur inattendue lors de la récupération des cartes avec offres:', error);
    return { count: 0, error };
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
  createUserProfile,
  getUserCardsGroupedByEdition,
  getEditionDetails,
  getUserCollectionTotalValue,
  getCollectionPriceVariation,
  getOfficialCardDetails,
  getMarketPricesForCard,
  getCardsForSale,
  addOrRemoveFromWishlist,
  getUserWishlist,
  getUserPriceAlerts,
  getTopCards,
  getTopGainers,
  getTopLosers,
  getWatchedCards,
  signInWithGoogle,
  searchCards,
  createOffer,
  createOfferNotification,
  getUserNotifications,
  archiveNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  refuseOffer,
  createRefuseOfferNotification,
  searchOfficialCardsByDetails,
  initUserImagesBucket,
  addCardToCollection,
  getUserCardsWithOffersCount
};

export default SupabaseService; 