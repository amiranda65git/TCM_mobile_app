import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { signIn, signInWithGoogle, supabase, getUserProfile, createUserProfile } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Récupérer le logo de marque depuis les variables d'environnement
  const brandLogo = process.env.EXPO_PUBLIC_BRAND_LOGO || 'pokemon';
  
  // Debug: afficher les valeurs
  console.log('Brand logo from env:', brandLogo);
  console.log('EXPO_PUBLIC_BRAND_LOGO:', process.env.EXPO_PUBLIC_BRAND_LOGO);
  
  // Créer le chemin vers l'image du logo
  const getLogoSource = (): any => {
    // L'utilisateur a ajouté son fichier pokemon_logo.png
    console.log('Getting logo source for brand:', brandLogo);
    try {
      if (brandLogo === 'pokemon') {
        // Réactivé - le fichier existe maintenant
        console.log('Loading pokemon logo...');
        return require('../../assets/brands/pokemon_logo.png');
      }
      console.log('Brand not pokemon, returning null');
      return null;
    } catch (error) {
      console.warn(`Logo not found for brand: ${brandLogo}`, error);
      return null;
    }
  };

  // Écouter les événements d'authentification
  useEffect(() => {
    console.log('Configuration des écouteurs d\'authentification et de deep linking');
    
    // Vérifier d'abord s'il y a une authentification en attente
    const checkPendingAuth = async () => {
      const pendingOAuth = await AsyncStorage.getItem('@auth_oauth_pending');
      if (pendingOAuth === 'true') {
        console.log('Authentification OAuth en attente détectée');
        setIsGoogleLoading(true);
      }
    };
    
    checkPendingAuth();
    
    // S'abonner aux changements d'état de l'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Événement d'authentification détecté: ${event}`);
        
        // Nettoyer le flag d'authentification en attente
        await AsyncStorage.removeItem('@auth_oauth_pending');
        
        // Traiter à la fois SIGNED_IN et INITIAL_SESSION
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          console.log('Utilisateur connecté avec succès, ID:', session.user?.id);
          
          try {
            // Désactiver le loader immédiatement pour éviter qu'il reste bloqué
            setIsGoogleLoading(false);
            
            if (session.user) {
              const userId = session.user.id;
              const userEmail = session.user.email || '';
              
              console.log(`Vérification du profil pour l'utilisateur ${userId} avec email ${userEmail}`);
              
              // Vérifier si l'utilisateur a un profil
              const { data: userProfile } = await getUserProfile(userId);
              
              // Si aucun profil n'existe, en créer un
              if (!userProfile) {
                console.log('Aucun profil utilisateur trouvé, création d\'un nouveau profil');
                const defaultUsername = userEmail.split('@')[0] || 'User';
                await createUserProfile(userId, defaultUsername, userEmail);
                console.log('Profil utilisateur créé avec succès');
              } else {
                console.log('Profil utilisateur existant trouvé');
              }
              
              // Définir le flag de redirection
              await AsyncStorage.setItem('@auth_redirect_needed', 'true');
              
              // Rediriger vers la page d'accueil
              console.log('Redirection vers la page d\'accueil depuis onAuthStateChange');
              router.replace('/(app)/home');
            }
          } catch (err) {
            console.error('Erreur lors du traitement de l\'authentification:', err);
            setIsGoogleLoading(false);
            Alert.alert(
              "Erreur lors de la connexion", 
              "Une erreur est survenue lors de la création de votre profil."
            );
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('Utilisateur déconnecté');
          setIsGoogleLoading(false);
        } else if (event === 'USER_UPDATED') {
          console.log('Données utilisateur mises à jour');
        }
      }
    );

    // Configurer le gestionnaire de deep links
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link reçu:', url);
      
      // Vérifier si le deep link contient un code d'authentification
      if (url && (url.includes('auth/callback') || url.includes('?code='))) {
        setIsGoogleLoading(true);
        
        // Configurer un timeout de sécurité
        const securityTimeout = setTimeout(() => {
          console.log('Timeout de sécurité déclenché, désactivation du loader');
          setIsGoogleLoading(false);
          AsyncStorage.removeItem('@auth_oauth_pending');
        }, 15000); // 15 secondes maximum
        
        try {
          console.log('Deep link d\'authentification détecté, traitement en cours...');
          
          // Extraire le code de l'URL
          const code = url.split('code=')[1]?.split('&')[0];
          if (!code) {
            throw new Error('Code d\'authentification non trouvé dans le deep link');
          }
          
          console.log('Code d\'authentification extrait, échange contre une session...');
          
          // IMPORTANT: Utiliser l'échange de code directement
          const { data: sessionData, error: sessionError } = 
            await supabase.auth.exchangeCodeForSession(code);
          
          // Nettoyer le timeout
          clearTimeout(securityTimeout);
          
          if (sessionError) {
            console.error('Erreur lors de l\'échange de code:', sessionError);
            setIsGoogleLoading(false);
            AsyncStorage.removeItem('@auth_oauth_pending');
            Alert.alert(
              "Erreur d'authentification", 
              "Impossible de valider votre connexion. Veuillez réessayer."
            );
            return;
          }
          
          if (sessionData.session) {
            console.log('Session active obtenue, ID utilisateur:', sessionData.session.user.id);
            
            // La session sera traitée par l'écouteur onAuthStateChange
            // Mais nous ajoutons un flag de redirection par sécurité
            await AsyncStorage.setItem('@auth_redirect_needed', 'true');
            
            // L'écouteur onAuthStateChange va gérer la redirection
            // Il n'est pas nécessaire de désactiver le loader ici car onAuthStateChange le fera
          } else {
            console.log('Pas de session active après échange du code, désactivation du loader');
            setIsGoogleLoading(false);
            AsyncStorage.removeItem('@auth_oauth_pending');
            Alert.alert(
              "Erreur d'authentification", 
              "La connexion a échoué. Veuillez réessayer."
            );
          }
        } catch (error) {
          // Nettoyer le timeout en cas d'erreur
          clearTimeout(securityTimeout);
          console.error('Erreur lors du traitement du deeplink:', error);
          setIsGoogleLoading(false);
          AsyncStorage.removeItem('@auth_oauth_pending');
          Alert.alert(
            "Erreur d'authentification", 
            "Une erreur est survenue lors de la connexion. Veuillez réessayer."
          );
        }
      }
    };

    // Ajouter l'écouteur de deep link
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Vérifier si l'application a été ouverte via un deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Nettoyage lors du démontage du composant
    return () => {
      authListener.subscription.unsubscribe();
      subscription.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await signIn(email, password);
      
      if (error) throw error;
      
      router.replace('/(app)/home');
    } catch (error: any) {
      Alert.alert("Erreur de connexion", error.message || "Une erreur est survenue lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      console.log('Démarrage de l\'authentification Google');
      
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        console.error('Erreur lors de l\'initialisation de l\'authentification Google:', error);
        setIsGoogleLoading(false);
        Alert.alert(
          "Erreur de connexion", 
          "Impossible d'initialiser la connexion avec Google. Veuillez réessayer."
        );
        return;
      }
      
      if (data?.url) {
        console.log('URL d\'authentification Google reçue, redirection vers:', data.url);
        try {
          await Linking.openURL(data.url);
          // Ne pas désactiver le loader, car il sera géré par les écouteurs d'événements
        } catch (linkingError) {
          console.error('Erreur lors de l\'ouverture du lien d\'authentification:', linkingError);
          setIsGoogleLoading(false);
          AsyncStorage.removeItem('@auth_oauth_pending');
          Alert.alert(
            "Erreur de connexion", 
            "Impossible d'ouvrir la page de connexion Google. Veuillez vérifier vos paramètres et réessayer."
          );
        }
      } else {
        console.warn('Aucune URL d\'authentification reçue de Supabase');
        setIsGoogleLoading(false);
        AsyncStorage.removeItem('@auth_oauth_pending');
        Alert.alert(
          "Erreur de connexion", 
          "La plateforme d'authentification n'a pas fourni de lien de connexion. Veuillez réessayer ou contacter le support."
        );
      }
    } catch (error: any) {
      console.error("Erreur globale pendant l'authentification Google:", error);
      setIsGoogleLoading(false);
      AsyncStorage.removeItem('@auth_oauth_pending');
      Alert.alert(
        "Erreur de connexion", 
        `Erreur lors de la connexion avec Google: ${error.message || 'Erreur inconnue'}. Veuillez réessayer.`
      );
    }
  };

  const handleAppleLogin = () => {
    Alert.alert("Apple", "Connexion via Apple à implémenter");
    // Fonctionnalité à implémenter
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Logo de marque (affiché seulement si disponible) */}
        {(() => {
          const logoSource = getLogoSource();
          console.log('Logo source:', logoSource);
          console.log('Logo error state:', logoError);
          console.log('Should show logo:', !logoError && logoSource);
          
          return !logoError && logoSource ? (
            <Image
              source={logoSource}
              style={styles.logo}
              onError={(e) => {
                console.log('Image error:', e.nativeEvent.error);
                setLogoError(true);
              }}
              onLoad={() => console.log('Image loaded successfully')}
              resizeMode="contain"
            />
          ) : null;
        })()}
        <Text style={styles.title}>TCMarket</Text>
        
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#B0B9C6" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#777"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#B0B9C6" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons 
                name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={20} 
                color="#B0B9C6" 
              />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.buttonDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Se connecter</Text>
            )}
          </TouchableOpacity>
          
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Ou</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity 
            style={[styles.socialButton, isGoogleLoading && styles.buttonDisabled]} 
            onPress={handleGoogleLogin}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#DB4437" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialButtonText}>Continuer avec Google</Text>
              </>
            )}
          </TouchableOpacity>
          
          {/* <TouchableOpacity style={styles.socialButton} onPress={handleAppleLogin}>
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={styles.socialButtonText}>Continuer avec Apple</Text>
          </TouchableOpacity> */}
          
          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.linkText}>Mot de passe oublié?</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.linkText}>Créer un compte</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121826',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A3C5A',
    borderRadius: 8,
    height: 50,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#374869',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  adminButton: {
    backgroundColor: '#50C878',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#374869',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#B0B9C6',
  },
  socialButton: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  socialButtonText: {
    color: '#121826',
    marginLeft: 10,
    fontWeight: '500',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  linkText: {
    color: '#B0B9C6',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
}); 