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
import { useAuth } from './lib/auth';

export default function Premium() {
  const { t } = useTranslation();
  const { isDarkMode } = useTheme();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { subscriptionStatus, products, purchaseSubscription, restorePurchases, loading, testConfiguration } = useSubscription();
  
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Debug de l'état de subscription
  useEffect(() => {
    console.log('[Premium] État subscription:', {
      subscriptionStatus,
      loading,
      products: products.length,
      selectedProductId
    });
  }, [subscriptionStatus, loading, products, selectedProductId]);

  // Sélectionner automatiquement le produit par défaut (avec protection)
  useEffect(() => {
    console.log('[Premium] Effet de sélection automatique:', {
      products: products,
      productsLength: products.length,
      selectedProductId,
      isArray: Array.isArray(products)
    });
    
    if (Array.isArray(products) && products.length > 0 && !selectedProductId) {
      try {
        // Forcer la sélection du premier produit disponible
        const firstProduct = products[0];
        
        if (firstProduct?.productId) {
          setSelectedProductId(firstProduct.productId);
          console.log('[Premium] Produit sélectionné automatiquement:', firstProduct.productId);
        } else {
          console.error('[Premium] Produit invalide:', firstProduct);
        }
      } catch (error) {
        console.error('Erreur lors de la sélection du produit par défaut:', error);
      }
    }
  }, [products, selectedProductId]);

  const handleSubscribe = async () => {
    console.log('[Premium] handleSubscribe appelé', {
      selectedProductId,
      isProcessing,
      loading,
      products: products.length
    });

    // Sélectionner automatiquement le premier produit si aucun n'est sélectionné
    let productToUse: string | null = selectedProductId;
    if (!productToUse && products.length > 0) {
      productToUse = products[0].productId;
      setSelectedProductId(productToUse);
      console.log('[Premium] Sélection automatique du produit:', productToUse);
    }

    if (!productToUse) {
      console.log('[Premium] Aucun produit disponible');
      Alert.alert(t('general.error'), 'Aucun produit d\'abonnement disponible');
      return;
    }

    // À ce point, productToUse est forcément non-null
    const finalProductId: string = productToUse;

    setIsProcessing(true);
    try {
      console.log('[Premium] Début de l\'achat pour:', finalProductId);
      const success = await purchaseSubscription(finalProductId);
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

        {/* Bouton DEBUG temporaire */}
        <TouchableOpacity 
          style={[dynamicStyles.restoreButton, { backgroundColor: '#FF6B6B', marginBottom: 10 }]}
          onPress={async () => {
            // Debug info dans des alertes
            const debugInfo = `
Platform: ${Platform.OS}
Products chargés: ${products.length}
État loading: ${loading}
Produit sélectionné: ${selectedProductId || 'aucun'}
Utilisateur connecté: ${!!user}
Mode DEV: ${__DEV__}

Produits détaillés:
${products.length > 0 ? 
  products.map(p => `- ${p.productId}: ${p.price}`).join('\n') : 
  'Aucun produit trouvé'
}`;

            Alert.alert('🐞 DEBUG IAP', debugInfo, [
              { text: 'Test Config', onPress: async () => {
                if (testConfiguration) {
                  await testConfiguration();
                  Alert.alert('Test Config', 'Vérifiez la console pour les détails');
                }
              }},
              { text: 'OK' }
            ]);
          }}
        >
          <Text style={[dynamicStyles.restoreButtonText, { color: 'white' }]}>
            🐞 DEBUG IAP
          </Text>
        </TouchableOpacity>

        {/* Bouton d'abonnement principal */}
        <TouchableOpacity 
          style={[
            dynamicStyles.subscribeButton,
            (isProcessing || loading || (products.length === 0)) && dynamicStyles.subscribeButtonDisabled
          ]}
          onPress={() => {
            console.log('[Premium] Bouton cliqué, données:', {
              selectedProductId,
              products: products.length,
              firstProduct: products[0]?.productId
            });
            
            // Si aucun produit n'est sélectionné mais qu'il y en a des disponibles, sélectionner le premier
            if (!selectedProductId && products.length > 0) {
              setSelectedProductId(products[0].productId);
            }
            
            handleSubscribe();
          }}
          disabled={isProcessing || loading || (products.length === 0)}
        >
          {isProcessing ? (
            <ActivityIndicator color="#1E2F4D" size="small" />
          ) : (
            <Text style={dynamicStyles.subscribeButtonText}>
              {products.length > 0 
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