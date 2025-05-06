import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from './lib/supabase';
import { Colors } from './constants/Colors';
import { useTranslation } from 'react-i18next';

export default function ConfirmEmail() {
  const { t } = useTranslation();
  const { token, type } = useLocalSearchParams();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }

    const handleEmailConfirmation = async () => {
      try {
        if (type === 'signup') {
          const { error } = await supabase.auth.verifyOtp({
            token: token as string,
            type: 'signup',
          });
          if (error) throw error;
        } else if (type === 'recovery') {
          const { error } = await supabase.auth.verifyOtp({
            token: token as string,
            type: 'recovery',
          });
          if (error) throw error;
        }
        
        // Redirection après confirmation
        router.replace('/login');
      } catch (error) {
        console.error('Erreur lors de la confirmation:', error);
        router.replace('/login');
      }
    };

    handleEmailConfirmation();
  }, [token, type]);

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