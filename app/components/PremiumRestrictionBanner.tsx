import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../lib/ThemeUtils';

interface PremiumRestrictionBannerProps {
  type: 'collection' | 'scan' | 'market' | 'trading';
  currentCount?: number;
  maxCount?: number;
  visible?: boolean;
}

export default function PremiumRestrictionBanner({ 
  type, 
  currentCount, 
  maxCount, 
  visible = true 
}: PremiumRestrictionBannerProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();

  if (!visible) return null;

  const getRestrictionMessage = () => {
    switch (type) {
      case 'collection':
        return t('premium.restrictions.collection', 
          `Vous ne voyez que ${maxCount} cartes. Abonnez-vous pour voir toute votre collection.`);
      case 'scan':
        return t('premium.restrictions.scan', 
          `Limite de ${maxCount} cartes atteinte. Abonnez-vous pour scanner plus de cartes.`);
      case 'market':
        return t('premium.restrictions.market', 
          'Accès au marché réservé aux membres Premium.');
      case 'trading':
        return t('premium.restrictions.trading', 
          'Accès au trading réservé aux membres Premium.');
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'collection':
        return 'albums-outline';
      case 'scan':
        return 'scan-outline';
      case 'market':
        return 'trending-up-outline';
      case 'trading':
        return 'swap-horizontal-outline';
      default:
        return 'star-outline';
    }
  };

  const handleUpgrade = () => {
    router.push('/premium');
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: colors.warning + '20', // Couleur d'avertissement avec transparence
      borderColor: colors.warning,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      margin: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.warning + '30',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
      marginRight: 12,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    message: {
      fontSize: 12,
      color: colors.text.secondary,
      lineHeight: 16,
    },
    upgradeButton: {
      backgroundColor: colors.secondary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
    },
    upgradeText: {
      color: colors.background,
      fontSize: 12,
      fontWeight: '600',
    },
    countText: {
      fontSize: 11,
      color: colors.warning,
      fontWeight: '500',
      marginTop: 2,
    }
  });

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.iconContainer}>
        <Ionicons 
          name={getIcon() as any} 
          size={20} 
          color={colors.warning} 
        />
      </View>
      
      <View style={dynamicStyles.textContainer}>
        <Text style={dynamicStyles.title}>
          {t('premium.title', 'Premium')}
        </Text>
        <Text style={dynamicStyles.message}>
          {getRestrictionMessage()}
        </Text>
        {currentCount !== undefined && maxCount !== undefined && (
          <Text style={dynamicStyles.countText}>
            {currentCount}/{maxCount} {type === 'collection' ? t('home.cards', 'cartes') : t('scan.scans', 'scans')}
          </Text>
        )}
      </View>
      
      <TouchableOpacity 
        style={dynamicStyles.upgradeButton}
        onPress={handleUpgrade}
      >
        <Text style={dynamicStyles.upgradeText}>
          {t('premium.whyPay', 'Pourquoi payer ?')}
        </Text>
      </TouchableOpacity>
    </View>
  );
} 