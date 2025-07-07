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
import { useSubscription } from './lib/SubscriptionService';

export default function Premium() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const { subscriptionStatus, products, purchaseSubscription, restorePurchases, loading } = useSubscription();
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Si l'utilisateur est déjà abonné, rediriger vers l'accueil (avec protection)
  useEffect(() => {
    if (subscriptionStatus?.isActive === true) {
      const showAlertAndRedirect = () => {
        Alert.alert(
          t('premium.alreadySubscribed.title', 'Déjà abonné'),
          t('premium.alreadySubscribed.message', 'Vous avez déjà un abonnement actif !'),
          [
            {
              text: t('general.ok', 'OK'),
              onPress: () => {
                // Délai pour éviter les conflits de navigation
                setTimeout(() => {
                  try {
                    router.back();
                  } catch (error) {
                    console.error('Erreur navigation:', error);
                    router.replace('/(app)/home');
                  }
                }, 100);
              }
            }
          ]
        );
      };
      
      // Délai pour s'assurer que le composant est monté
      setTimeout(showAlertAndRedirect, 500);
    }
  }, [subscriptionStatus?.isActive, t]);

  // Sélectionner automatiquement le produit mensuel par défaut (avec protection)
  useEffect(() => {
    if (Array.isArray(products) && products.length > 0 && !selectedProductId) {
      try {
        const monthlyProduct = products.find(p => 
          p?.productId && p.productId.includes('monthly')
        );
        const defaultProduct = monthlyProduct || products[0];
        
        if (defaultProduct?.productId) {
          setSelectedProductId(defaultProduct.productId);
        }
      } catch (error) {
        console.error('Erreur lors de la sélection du produit par défaut:', error);
      }
    }
  }, [products.length, selectedProductId]);

  const handleSubscribe = async () => {
    if (!selectedProductId) {
      Alert.alert(t('general.error'), t('premium.selectProduct', 'Veuillez sélectionner un abonnement'));
      return;
    }

    setIsProcessing(true);
    try {
      const success = await purchaseSubscription(selectedProductId);
      
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

  const formatPrice = (price: string | undefined) => {
    if (!price || typeof price !== 'string') {
      return 'Prix indisponible';
    }
    // Supprimer les symboles de devise pour nettoyer l'affichage
    return price.replace(/[€$£¥]/g, '') + ' €';
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
    productsContainer: {
      marginTop: 20,
      paddingHorizontal: 10,
      width: '100%',
    },
    productsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 20,
    },
    productItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedProduct: {
      borderColor: '#FFD700',
      backgroundColor: colors.surface,
    },
    productInfo: {
      flex: 1,
      marginRight: 12,
    },
    productTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
    },
    productDescription: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    productPrice: {
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

          {/* Sélection des produits d'abonnement */}
          {!loading && Array.isArray(products) && products.length > 0 && (
            <View style={dynamicStyles.productsContainer}>
              <Text style={dynamicStyles.productsTitle}>
                {t('premium.choosePlan', 'Choisissez votre plan')}
              </Text>
              {products
                .filter(product => product && product.productId) // Filtrer les produits valides
                .map((product) => (
                <TouchableOpacity
                  key={product.productId}
                  style={[
                    dynamicStyles.productItem,
                    selectedProductId === product.productId && dynamicStyles.selectedProduct
                  ]}
                  onPress={() => {
                    if (product.productId) {
                      setSelectedProductId(product.productId);
                    }
                  }}
                >
                  <View style={dynamicStyles.productInfo}>
                    <Text style={dynamicStyles.productTitle}>
                      {product.title || product.productId || 'Produit sans nom'}
                    </Text>
                    <Text style={dynamicStyles.productDescription}>
                      {product.description || 'Description non disponible'}
                    </Text>
                  </View>
                  <Text style={dynamicStyles.productPrice}>
                    {formatPrice(product.price)}
                  </Text>
                  {selectedProductId === product.productId && (
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
            (isProcessing || loading || !selectedProductId) && dynamicStyles.subscribeButtonDisabled
          ]}
          onPress={handleSubscribe}
          disabled={isProcessing || loading || !selectedProductId}
        >
          {isProcessing ? (
            <ActivityIndicator color="#1E2F4D" size="small" />
          ) : (
            <Text style={dynamicStyles.subscribeButtonText}>
              {selectedProductId 
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