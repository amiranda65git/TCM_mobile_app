import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { Colors } from './constants/Colors';
import { supabase } from './lib/supabase';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert(t('forgotPassword.error'), t('forgotPassword.invalidEmail'));
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'tcmarket://reset-password',
      });

      if (error) throw error;

      Alert.alert(
        t('forgotPassword.success'),
        t('forgotPassword.successMessage')
      );
      router.push('/login');
    } catch (error) {
      Alert.alert(t('forgotPassword.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <AntDesign name="arrowleft" size={24} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>{t('forgotPassword.title')}</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.description}>
          {t('forgotPassword.description')}
        </Text>

        <View style={styles.inputContainer}>
          <AntDesign name="mail" size={20} color={Colors.text.secondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={t('forgotPassword.emailPlaceholder')}
            placeholderTextColor={Colors.text.secondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text.primary} />
          ) : (
            <Text style={styles.buttonText}>{t('forgotPassword.sendLink')}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.backToLoginButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.backToLoginText}>
            {t('forgotPassword.backToLogin')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    fontFamily: 'ComicNeue',
  },
  formContainer: {
    padding: 20,
    gap: 15,
  },
  description: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 20,
    fontFamily: 'ComicNeue',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    backgroundColor: Colors.surface,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'ComicNeue',
    color: Colors.text.primary,
  },
  button: {
    backgroundColor: Colors.secondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'ComicNeue',
  },
  backToLoginButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  backToLoginText: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontFamily: 'ComicNeue',
    textDecorationLine: 'underline',
  },
}); 