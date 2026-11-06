import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from './lib/supabase';
import { Colors } from './constants/Colors';
import { useTranslation } from 'react-i18next';

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function ConfirmEmail() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const tokenHash = firstParam(params.token_hash ?? params.token);
  const otpType = firstParam(params.type);

  useEffect(() => {
    if (!tokenHash) {
      router.replace('/(auth)/login');
      return;
    }

    const handleEmailConfirmation = async () => {
      try {
        if (otpType === 'signup' || otpType === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) throw error;
        }

        router.replace('/(auth)/login');
      } catch (error) {
        console.error('Erreur lors de la confirmation:', error);
        router.replace('/(auth)/login');
      }
    };

    handleEmailConfirmation();
  }, [tokenHash, otpType]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.secondary} />
      <Text style={styles.text}>{t('auth.verifying')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 20,
  },
  text: {
    color: Colors.text.primary,
    fontSize: 16,
    fontFamily: 'ComicNeue',
  },
}); 