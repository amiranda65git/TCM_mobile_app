import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  SafeAreaView,
  Platform,
  StatusBar
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from './lib/ThemeContext';
import { useThemeColors } from './lib/ThemeUtils';

export default function Premium() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();

  const handleSubscribe = () => {
    // TODO: Implémenter la fonction d'abonnement
    console.log('Abonnement demandé');
  };

  // Définir les styles dynamiques en fonction du thème
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.OS === 'ios' ? 10 : 10,
      paddingBottom: 10,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      flex: 1,
      textAlign: 'center',
    },
    backButton: {
      padding: 10,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 30,
      paddingBottom: 100,
      alignItems: 'center',
    },
    mainTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 40,
    },
    imageContainer: {
      marginBottom: 40,
      alignItems: 'center',
    },
    noMoneyImage: {
      width: 200,
      height: 200,
      resizeMode: 'contain',
    },
    explanationContainer: {
      marginBottom: 30,
      paddingHorizontal: 10,
    },
    explanationText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 20,
    },
    subscribeButton: {
      backgroundColor: '#FFD700', // Couleur dorée pour le premium
      paddingVertical: 15,
      paddingHorizontal: 30,
      borderRadius: 25,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      width: '100%',
    },
    subscribeButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1E2F4D',
      textAlign: 'center',
    },
    premiumIcon: {
      marginBottom: 5,
    },
    floatingButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen 
        options={{ 
          title: t('premium.title'),
          headerShown: true 
        }} 
      />
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <ScrollView style={dynamicStyles.container} showsVerticalScrollIndicator={false}>
        <View style={dynamicStyles.content}>
          {/* Titre principal */}
          <Text style={dynamicStyles.mainTitle}>
            {t('premium.whyPay')}
          </Text>
          
          {/* Icône premium */}
          <View style={dynamicStyles.premiumIcon}>
            <Ionicons name="diamond" size={40} color="#FFD700" />
          </View>
          
          {/* Image nomoney */}
          <View style={dynamicStyles.imageContainer}>
            <Image 
              source={require('../assets/images/nomoney.png')} 
              style={dynamicStyles.noMoneyImage}
            />
          </View>
          
          {/* Texte explicatif */}
          <View style={dynamicStyles.explanationContainer}>
            <Text style={dynamicStyles.explanationText}>
              {t('premium.explanation1')}
            </Text>
            
            <Text style={dynamicStyles.explanationText}>
              {t('premium.explanation2')}
            </Text>
            
            <Text style={dynamicStyles.explanationText}>
              {t('premium.explanation3')}
            </Text>
          </View>
        </View>
      </ScrollView>
      
      {/* Bouton d'abonnement flottant */}
      <View style={dynamicStyles.floatingButtonContainer}>
        <TouchableOpacity 
          style={dynamicStyles.subscribeButton}
          onPress={handleSubscribe}
        >
          <Text style={dynamicStyles.subscribeButtonText}>
            {t('premium.subscribeButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 