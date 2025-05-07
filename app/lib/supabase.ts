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
      // On trie d'abord par ID de carte et date (plus récente en premier)
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

// Fonction pour calculer la valeur totale de la collection d'un utilisateur
export const getUserCollectionTotalValue = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_cards')
      .select(`
        id,
        price
      `)
      .eq('user_id', userId);
    
    if (error) {
      console.error("Erreur lors du calcul de la valeur totale de la collection:", error);
      return { totalValue: 0, error };
    }
    
    // Calculer la valeur totale
    const totalValue = data?.reduce((total, card) => total + (card.price || 0), 0) || 0;
    
    return { totalValue, error: null };
  } catch (error) {
    console.error("Exception lors du calcul de la valeur totale:", error);
    return { totalValue: 0, error };
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
  getUserCollectionTotalValue
};

export default SupabaseService; 