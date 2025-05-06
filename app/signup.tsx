import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Link, router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';
import { Colors } from './constants/Colors';
import { signUp } from './lib/supabase';

export default function SignUp() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t('signup.error'), t('signup.fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('signup.error'), t('signup.passwordMismatch'));
      return;
    }

    try {
      const { data, error } = await signUp(email, password);
      if (error) throw error;
      
      // Si l'inscription réussit, l'utilisateur est automatiquement connecté
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert(t('signup.error'), error.message || t('signup.genericError'));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>TCMarket</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <AntDesign name="mail" size={20} color={Colors.text.secondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={t('signup.emailPlaceholder')}
            placeholderTextColor={Colors.text.secondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View style={styles.inputContainer}>
          <AntDesign name="lock" size={20} color={Colors.text.secondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={t('signup.passwordPlaceholder')}
            placeholderTextColor={Colors.text.secondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.showPasswordButton}>
            <AntDesign name={showPassword ? "eye" : "eyeo"} size={20} color={Colors.text.secondary} />
          </Pressable>
        </View>

        <View style={styles.inputContainer}>
          <AntDesign name="lock" size={20} color={Colors.text.secondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={t('signup.confirmPasswordPlaceholder')}
            placeholderTextColor={Colors.text.secondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
          />
        </View>

        <Pressable
          style={[styles.button, styles.signUpButton]}
          onPress={handleSignUp}
        >
          <Text style={[styles.buttonText, styles.signUpButtonText]}>
            {t('signup.createAccount')}
          </Text>
        </Pressable>

        <View style={styles.bottomLinks}>
          <Pressable onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>
              {t('signup.alreadyHaveAccount')}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  logoContainer: {
    flex: 0.3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: Colors.text.primary,
    fontFamily: 'ComicNeue',
  },
  formContainer: {
    paddingHorizontal: 20,
    gap: 15,
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
  showPasswordButton: {
    padding: 5,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  signUpButton: {
    backgroundColor: Colors.secondary,
    marginTop: 10,
  },
  signUpButtonText: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomLinks: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: Colors.text.secondary,
    fontSize: 16,
    fontFamily: 'ComicNeue',
  },
}); 