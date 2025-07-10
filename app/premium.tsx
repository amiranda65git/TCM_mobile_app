import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from './lib/ThemeContext';
import { useThemeColors } from './lib/ThemeUtils';
import { useRevenueCat } from './lib/RevenueCatService';
import { PurchasesPackage } from 'react-native-purchases';

export default function Premium() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const { subscriptionStatus, packages, purchaseSubscription, restorePurchases, loading } = useRevenueCat();
  
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Debug de l'état RevenueCat
  useEffect(() => {
    console.log('[Premium] État RevenueCat:', {
      subscriptionStatus,
      loading,
      packages: packages.length,
      selectedPackage: selectedPackage?.identifier
    });
  }, [subscriptionStatus, loading, packages, selectedPackage]);

  // Sélectionner automatiquement le premier package
  useEffect(() => {
    console.log('[Premium] Effet de sélection automatique:', {
      packages: packages,
      packagesLength: packages.length,
      selectedPackage: selectedPackage?.identifier,
      isArray: Array.isArray(packages)
    });
    
    if (Array.isArray(packages) && packages.length > 0 && !selectedPackage) {
      try {
        // Sélectionner le premier package disponible
        const firstPackage = packages[0];
        setSelectedPackage(firstPackage);
        console.log('[Premium] Package sélectionné automatiquement:', firstPackage.identifier);
      } catch (error) {
        console.error('Erreur lors de la sélection du package par défaut:', error);
      }
    }
  }, [packages, selectedPackage]);

  const handleSubscribe = async () => {
    console.log('[Premium] handleSubscribe appelé', {
      selectedPackage: selectedPackage?.identifier,
      isProcessing,
      loading,
      packages: packages.length
    });

    // Sélectionner automatiquement le premier package si aucun n'est sélectionné
    let packageToUse = selectedPackage;
    if (!packageToUse && packages.length > 0) {
      packageToUse = packages[0];
      setSelectedPackage(packageToUse);
      console.log('[Premium] Sélection automatique du package:', packageToUse.identifier);
    }

    if (!packageToUse) {
      console.log('[Premium] Aucun package disponible');
      Alert.alert(t('general.error'), 'Aucun produit d\'abonnement disponible');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('[Premium] Début de l\'achat pour:', packageToUse.identifier);
      const success = await purchaseSubscription(packageToUse);
      console.log('[Premium] Résultat de l\'achat:', success);
      
      if (success) {
        Alert.alert(
          'Succès',
          'Achat réussi ! Redirection vers l\'accueil...',
          [{ 
            text: 'OK', 
            onPress: () => {
              setTimeout(() => {
                try {
                  router.replace('/(app)/home');
                } catch (error) {
                  console.error('Erreur navigation après achat:', error);
                }
              }, 100);
            }
          }]
        );
      }
    } catch (error) {
      console.error('[Premium] Erreur dans handleSubscribe:', error);
      Alert.alert(
        'Erreur d\'achat',
        `Une erreur est survenue :\n${(error as Error).message}\n\nVeuillez réessayer.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsProcessing(true);
    try {
      await restorePurchases();
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      Alert.alert('Erreur', 'Impossible de restaurer les achats');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (pack: PurchasesPackage): string => {
    try {
      return pack.product.priceString || '2.99 CHF';
    } catch (error) {
      console.error('Erreur formatage prix:', error);
      return '2.99 CHF';
    }
  };

  const getPackageTitle = (pack: PurchasesPackage): string => {
    try {
      // Utiliser le titre du produit ou un titre basé sur l'identifiant
      if (pack.product.title) {
        return pack.product.title;
      }
      
      // Générer un titre basé sur l'identifier
      if (pack.identifier.includes('monthly') || pack.identifier.includes('month')) {
        return 'TCMarket Premium - Mensuel';
      } else if (pack.identifier.includes('yearly') || pack.identifier.includes('year')) {
        return 'TCMarket Premium - Annuel';
      } else {
        return 'TCMarket Premium';
      }
    } catch (error) {
      console.error('Erreur titre package:', error);
      return 'TCMarket Premium';
    }
  };

  const getPackageDescription = (pack: PurchasesPackage): string => {
    try {
      if (pack.product.description) {
        return pack.product.description;
      }
      return 'Accès complet à toutes les fonctionnalités';
    } catch (error) {
      console.error('Erreur description package:', error);
      return 'Accès complet à toutes les fonctionnalités';
    }
  };

  // Définir les styles dynamiques en fonction du thème
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 30,
      paddingBottom: 140, // Augmenté pour laisser plus d'espace aux boutons
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
    packagesContainer: {
      marginTop: 20,
      paddingHorizontal: 10,
      width: '100%',
    },
    packagesTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 20,
    },
    packageItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedPackage: {
      borderColor: '#FFD700',
      backgroundColor: colors.surface,
    },
    packageInfo: {
      flex: 1,
      marginRight: 12,
    },
    packageTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
    },
    packageDescription: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    packagePrice: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#FFD700',
      marginRight: 8,
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
    restoreButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    restoreButtonText: {
      fontSize: 14,
      textAlign: 'center',
    },
    subscribeButtonDisabled: {
      opacity: 0.6,
    },
    debugButton: {
      backgroundColor: '#FF6B6B',
      marginBottom: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
    },
    debugButtonText: {
      color: 'white',
      textAlign: 'center',
      fontSize: 14,
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

          {/* Sélection des packages RevenueCat */}
          {!loading && Array.isArray(packages) && packages.length > 0 && (
            <View style={dynamicStyles.packagesContainer}>
              <Text style={dynamicStyles.packagesTitle}>
                {t('premium.choosePlan', 'Choisissez votre plan')}
              </Text>
              {packages.map((pack) => (
                <TouchableOpacity
                  key={pack.identifier}
                  style={[
                    dynamicStyles.packageItem,
                    selectedPackage?.identifier === pack.identifier && dynamicStyles.selectedPackage
                  ]}
                  onPress={() => setSelectedPackage(pack)}
                >
                  <View style={dynamicStyles.packageInfo}>
                    <Text style={dynamicStyles.packageTitle}>
                      {getPackageTitle(pack)}
                    </Text>
                    <Text style={dynamicStyles.packageDescription}>
                      {getPackageDescription(pack)}
                    </Text>
                  </View>
                  <Text style={dynamicStyles.packagePrice}>
                    {formatPrice(pack)}
                  </Text>
                  {selectedPackage?.identifier === pack.identifier && (
                    <Ionicons name="checkmark-circle" size={24} color="#FFD700" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Boutons flottants */}
      <View style={dynamicStyles.floatingButtonContainer}>
        
        {/* Bouton DEBUG temporaire RevenueCat */}
        <TouchableOpacity 
          style={dynamicStyles.debugButton}
          onPress={() => {
            const debugInfo = `
Platform: ${Platform.OS}
Packages chargés: ${packages.length}
État loading: ${loading}
Package sélectionné: ${selectedPackage?.identifier || 'aucun'}
Statut abonnement: ${subscriptionStatus.isActive ? 'actif' : 'inactif'}
Mode DEV: ${__DEV__}

Packages détaillés:
${packages.length > 0 ? 
  packages.map(p => `- ID: ${p.identifier}\n  Prix: ${p.product.priceString}\n  Titre: ${getPackageTitle(p)}`).join('\n\n') : 
  'Aucun package trouvé'
}`;

            Alert.alert('🚀 DEBUG RevenueCat', debugInfo, [{ text: 'OK' }]);
          }}
        >
          <Text style={dynamicStyles.debugButtonText}>
            🚀 DEBUG RevenueCat
          </Text>
        </TouchableOpacity>
        
        {/* Bouton Restaurer les achats */}
        <TouchableOpacity 
          style={[dynamicStyles.restoreButton, { backgroundColor: colors.surface }]}
          onPress={handleRestorePurchases}
          disabled={isProcessing || loading}
        >
          <Text style={[dynamicStyles.restoreButtonText, { color: colors.text.secondary }]}>
            {t('premium.restorePurchases', 'Restaurer mes achats')}
          </Text>
        </TouchableOpacity>

        {/* Bouton d'abonnement principal */}
        <TouchableOpacity 
          style={[
            dynamicStyles.subscribeButton,
            (isProcessing || loading || (packages.length === 0)) && dynamicStyles.subscribeButtonDisabled
          ]}
          onPress={() => {
            console.log('[Premium] Bouton cliqué, données:', {
              selectedPackage: selectedPackage?.identifier,
              packages: packages.length,
              firstPackage: packages[0]?.identifier
            });
            
            handleSubscribe();
          }}
          disabled={isProcessing || loading || (packages.length === 0)}
        >
          {isProcessing ? (
            <ActivityIndicator color="#1E2F4D" size="small" />
          ) : (
            <Text style={dynamicStyles.subscribeButtonText}>
              {packages.length > 0 
                ? t('premium.subscribeNow', 'S\'abonner maintenant')
                : t('premium.selectProduct', 'Sélectionnez un plan')
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 