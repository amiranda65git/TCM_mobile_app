import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

type RecoveryParams = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  code?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
};

const parseRecoveryParams = (url: string | null): RecoveryParams => {
  if (!url) return {};
  const normalizedUrl = url.includes('#') ? url.replace('#', '?') : url;
  const parsed = Linking.parse(normalizedUrl);
  const params = parsed.queryParams || {};

  return {
    access_token: typeof params.access_token === 'string' ? params.access_token : undefined,
    refresh_token: typeof params.refresh_token === 'string' ? params.refresh_token : undefined,
    type: typeof params.type === 'string' ? params.type : undefined,
    code: typeof params.code === 'string' ? params.code : undefined,
    error: typeof params.error === 'string' ? params.error : undefined,
    error_code: typeof params.error_code === 'string' ? params.error_code : undefined,
    error_description: typeof params.error_description === 'string' ? params.error_description : undefined,
  };
};

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password && !confirmPassword) return null;
    if (password.length > 0 && password.length < 6) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (confirmPassword.length > 0 && password !== confirmPassword) {
      return 'Les mots de passe ne correspondent pas.';
    }
    return null;
  }, [password, confirmPassword]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        setIsSessionReady(true);
      }
    });

    const bootstrapRecoverySession = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        const { access_token, refresh_token, type, code, error_code, error_description } = parseRecoveryParams(initialUrl);

        if (error_code || error_description) {
          const message =
            error_code === 'otp_expired'
              ? 'Le lien de réinitialisation a expiré. Veuillez en demander un nouveau.'
              : decodeURIComponent(error_description || 'Lien de réinitialisation invalide.');
          setSessionError(message);
          return;
        }

        if (type === 'recovery' && access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setSessionError('Session de réinitialisation introuvable. Veuillez redemander un lien.');
            return;
          }
        }

        setIsSessionReady(true);
      } catch (error: any) {
        console.error('[ResetPassword] Erreur setSession:', error);
        setSessionError(error?.message || 'Lien de réinitialisation invalide ou expiré.');
      }
    };

    bootstrapRecoverySession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (isLoading) return;

    if (!password.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un nouveau mot de passe.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setIsLoading(true);
      if (!isSessionReady) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          Alert.alert('Erreur', 'Session de réinitialisation introuvable. Veuillez redemander un lien.');
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      Alert.alert('Succès', 'Votre mot de passe a été mis à jour.');
      router.replace('/(auth)/login');
    } catch (error: any) {
      console.error('[ResetPassword] Erreur updateUser:', error);
      if (error?.name === 'AuthSessionMissingError') {
        setSessionError('Session expirée. Veuillez redemander un lien de réinitialisation.');
      }
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionError) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>Lien invalide</Text>
        <Text style={styles.description}>{sessionError}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/forgot-password')}>
          <Text style={styles.buttonText}>Renvoyer un lien</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.description}>
          Saisissez votre nouveau mot de passe pour finaliser la réinitialisation.
        </Text>

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Nouveau mot de passe"
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Confirmer le mot de passe"
          placeholderTextColor="#777"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
        />

        {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

        <TouchableOpacity
          style={[styles.button, (isLoading || !!passwordError) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading || !!passwordError}
        >
          <Text style={styles.buttonText}>{isLoading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121826',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#121826',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    color: '#B0B9C6',
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 21,
  },
  input: {
    backgroundColor: '#2A3C5A',
    borderRadius: 8,
    height: 50,
    marginBottom: 12,
    paddingHorizontal: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374869',
  },
  button: {
    backgroundColor: '#4A90E2',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: '#FF9CA8',
    marginBottom: 4,
  },
});
