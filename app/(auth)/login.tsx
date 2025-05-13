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
  Linking
} from 'react-native';
import { router } from 'expo-router';
import { signIn, signInWithGoogle, supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Écouter les événements d'authentification
  useEffect(() => {
    // S'abonner aux changements d'état de l'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          console.log('Utilisateur connecté via OAuth');
          // Rediriger vers la page d'accueil
          router.replace('/(app)/home');
        }
      }
    );

    // Configurer le gestionnaire de deep links
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link reçu:', url);
      
      // Vérifier si le deep link est lié à l'authentification
      if (url && url.includes('auth/callback')) {
        setIsGoogleLoading(true);
        // Attendre un peu pour que Supabase traite le deep link
        setTimeout(() => {
          setIsGoogleLoading(false);
        }, 2000);
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
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        throw error;
      }
      
      if (data?.url) {
        // Ouvrir l'URL d'authentification Google dans le navigateur
        await Linking.openURL(data.url);
      } else {
        setIsGoogleLoading(false);
      }
    } catch (error: any) {
      setIsGoogleLoading(false);
      Alert.alert(
        "Erreur de connexion", 
        "Erreur lors de la connexion avec Google. Veuillez réessayer."
      );
      console.error("Erreur Google Login:", error);
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
          
          <TouchableOpacity style={styles.socialButton} onPress={handleAppleLogin}>
            <Ionicons name="logo-apple" size={20} color="#000" />
            <Text style={styles.socialButtonText}>Continuer avec Apple</Text>
          </TouchableOpacity>
          
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