import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { router } from 'expo-router';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResetPassword = () => {
    if (!email || !email.includes('@')) {
      Alert.alert("Erreur", "Veuillez saisir une adresse email valide");
      return;
    }

    setIsSubmitting(true);
    
    // Version simplifiée sans appel API
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        "Email envoyé",
        "Un email de réinitialisation de mot de passe a été envoyé à votre adresse email."
      );
      router.push('/(auth)/login');
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mot de passe oublié</Text>
        </View>
        
        <Text style={styles.description}>
          Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
        </Text>
        
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <TouchableOpacity 
            style={[styles.resetButton, isSubmitting && styles.disabledButton]} 
            onPress={handleResetPassword}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? "Envoi en cours..." : "Envoyer le lien"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.loginLink} 
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.linkText}>Retour à la connexion</Text>
          </TouchableOpacity>
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
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    color: '#4A90E2',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 16,
    color: '#B0B9C6',
    marginBottom: 30,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#2A3C5A',
    borderRadius: 8,
    height: 50,
    marginBottom: 15,
    paddingHorizontal: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374869',
  },
  resetButton: {
    backgroundColor: '#4A90E2',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 10,
  },
  linkText: {
    color: '#B0B9C6',
    fontSize: 14,
    textDecorationLine: 'underline',
  }
}); 