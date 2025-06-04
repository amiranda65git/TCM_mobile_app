import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ActivityIndicator, SafeAreaView, Alert, Animated, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase, getOfficialCardDetails, getMarketPricesForCard, refuseOffer, createRefuseOfferNotification, markCardAsSold } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useThemeColors } from '../../lib/ThemeUtils';
import { Swipeable } from 'react-native-gesture-handler';
import { Alert as RNAlert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventRegister } from 'react-native-event-listeners';

export default function CardSellDetails() {
  const { id } = useLocalSearchParams(); // id = user_card_id
  const { user } = useAuth();
  const { t } = useTranslation();
  const colors = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [userCard, setUserCard] = useState<any>(null);
  const [officialCard, setOfficialCard] = useState<any>(null);
  const [marketPrices, setMarketPrices] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [isCardSold, setIsCardSold] = useState(false);

  // États pour la modale de modification
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updatedPrice, setUpdatedPrice] = useState('');
  const [updatedCondition, setUpdatedCondition] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Les conditions disponibles pour les cartes avec leurs couleurs
  const CONDITION_COLORS: Record<string, string> = {
    'Near Mint': '#4CAF50',
    'Excellent': '#2196F3',
    'Good': '#FF9800',
    'Played': '#F44336'
  };
  
  const CONDITIONS = Object.keys(CONDITION_COLORS);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Récupérer la carte de l'utilisateur (user_cards)
      const { data: userCardData, error: userCardError } = await supabase
        .from('user_cards')
        .select('id, card_id, price, condition, is_sold, official_cards(id, name, number, rarity, image_small, image_large)')
        .eq('id', id)
        .single();
      if (userCardError) throw userCardError;
      setUserCard(userCardData);
      setIsCardSold(userCardData.is_sold || false);
      
      // 2. Récupérer les infos officielles de la carte
      const cardId = userCardData.card_id;
      const { data: cardData, error: cardError } = await getOfficialCardDetails(cardId);
      if (cardError) throw cardError;
      setOfficialCard(cardData);
      
      // 3. Prix du marché
      const { data: priceData, error: priceError } = await getMarketPricesForCard(cardId);
      if (priceError) throw priceError;
      setMarketPrices(priceData);
      
      // 4. Récupérer les offres pour cette carte (seulement si pas vendue)
      if (!userCardData.is_sold) {
        const { data: offersData, error: offersError } = await supabase
          .from('offers')
          .select(`
            id, buyer_id, proposed_price, message, created_at, status,
            users:buyer_id(username, email)
          `)
          .eq('user_card_id', id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        if (offersError) throw offersError;
        setOffers(offersData || []);
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSold = () => {
    Alert.alert(
      t('market.markAsSoldConfirmTitle'),
      t('market.markAsSoldConfirmMessage'),
      [
        { text: t('alerts.cancel'), style: 'cancel' },
        { 
          text: 'OK', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { error } = await markCardAsSold(Array.isArray(id) ? id[0] : id);
              if (error) {
                Alert.alert(t('general.error'), t('market.markAsSoldError'));
              } else {
                setIsCardSold(true);
                setOffers([]); // Vider les offres
                // Recharger les données pour mettre à jour l'état
                await loadData();
                
                // Notifier les autres écrans que les données ont changé
                EventRegister.emit('trading_data_changed');
              }
            } catch (error) {
              Alert.alert(t('general.error'), t('market.markAsSoldError'));
            }
          }
        },
      ]
    );
  };

  // Ouvrir la modale de modification
  const handleUpdatePress = () => {
    if (userCard) {
      setUpdatedPrice(userCard.price?.toString() || '');
      setUpdatedCondition(userCard.condition || 'Near Mint');
      setUpdateModalVisible(true);
    }
  };

  // Mettre à jour le prix et la condition
  const handleUpdateSale = async () => {
    if (!userCard || !user) return;
    
    const price = parseFloat(updatedPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert(t('general.error'), 'Prix invalide');
      return;
    }
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('user_cards')
        .update({
          price: price,
          condition: updatedCondition
        })
        .eq('id', id);
      
      if (error) throw error;
      
      Alert.alert(t('general.success'), 'Vente mise à jour avec succès');
      setUpdateModalVisible(false);
      await loadData(); // Recharger les données
      
      // Notifier les autres écrans que les données ont changé
      EventRegister.emit('trading_data_changed');
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert(t('general.error'), 'Erreur lors de la mise à jour');
    } finally {
      setIsUpdating(false);
    }
  };

  // Annuler la vente
  const handleCancelSale = async () => {
    Alert.alert(
      'Annuler la vente',
      'Êtes-vous sûr de vouloir retirer cette carte de la vente ?',
      [
        { text: t('alerts.cancel'), style: 'cancel' },
        { 
          text: 'Confirmer', 
          style: 'destructive', 
          onPress: async () => {
            setIsUpdating(true);
            try {
              const { error } = await supabase
                .from('user_cards')
                .update({
                  is_for_sale: false,
                  price: null
                })
                .eq('id', id);
              
              if (error) throw error;
              
              Alert.alert(t('general.success'), 'Vente annulée avec succès');
              setUpdateModalVisible(false);
              await loadData();
              
              // Notifier les autres écrans que les données ont changé
              EventRegister.emit('trading_data_changed');
              
            } catch (error) {
              console.error('Erreur lors de l\'annulation:', error);
              Alert.alert(t('general.error'), 'Erreur lors de l\'annulation');
            } finally {
              setIsUpdating(false);
            }
          }
        },
      ]
    );
  };

  // Vérifier si le prix est valide
  const isPriceValid = () => {
    const price = parseFloat(updatedPrice);
    return !isNaN(price) && price > 0;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
        <Stack.Screen options={{ title: t('market.sellDetails', 'Détail vente'), headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userCard || !officialCard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
        <Stack.Screen options={{ title: t('market.sellDetails', 'Détail vente'), headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={{ color: colors.error }}>{t('card.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const priceAsked = userCard.price || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <Stack.Screen options={{ title: officialCard.name, headerShown: true }} />
      {/* Infos carte */}
      <View style={[styles.cardInfoContainer, { backgroundColor: colors.surface }]}> 
        <Image source={{ uri: officialCard.image_small }} style={styles.cardThumbnail} resizeMode="contain" />
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.text.primary }]}>{officialCard.name}</Text>
          <Text style={[styles.cardNumber, { color: colors.text.secondary }]}>#{officialCard.number}</Text>
          <Text style={[styles.cardRarity, { color: colors.text.secondary }]}>{officialCard.rarity}</Text>
          {/* Afficher le prix et la condition actuels */}
          {userCard && !isCardSold && (
            <>
              <Text style={[styles.currentPrice, { color: colors.primary }]}>
                Prix: {userCard.price?.toFixed(2)}€
              </Text>
              <Text style={[styles.currentCondition, { color: colors.text.secondary }]}>
                Condition: {userCard.condition || 'Non spécifiée'}
              </Text>
            </>
          )}
        </View>
      </View>
      {/* Prix du marché */}
      {marketPrices && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Prix du marché
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.text.primary }]}>
              Prix bas: {marketPrices.price_low ? `${marketPrices.price_low}€` : 'N/A'}
            </Text>
            <Text style={[styles.priceLabel, { color: '#3498db' }]}>
              Prix moyen: {marketPrices.price_mid ? `${marketPrices.price_mid}€` : 'N/A'}
            </Text>
            <Text style={[styles.priceLabel, { color: colors.text.primary }]}>
              Prix haut: {marketPrices.price_high ? `${marketPrices.price_high}€` : 'N/A'}
            </Text>
          </View>
        </View>
      )}

      {/* Boutons d'actions */}
      <View style={styles.actionButtonsContainer}>
        {/* Bouton Mettre à jour (seulement si pas vendue) */}
        {!isCardSold && (
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: colors.primary }]}
            onPress={handleUpdatePress}
          >
            <Ionicons name="create-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.updateButtonText}>Mettre à jour</Text>
          </TouchableOpacity>
        )}
        
        {/* Bouton Marquer comme vendue */}
        <TouchableOpacity
          style={[
            styles.soldButton, 
            { 
              backgroundColor: isCardSold ? '#6c757d' : '#dc3545',
              flex: !isCardSold ? 1 : undefined
            }
          ]}
          onPress={isCardSold ? undefined : handleMarkAsSold}
          disabled={isCardSold}
        >
          <Text style={styles.soldButtonText}>
            {isCardSold ? t('market.sold', 'Vendu') : t('market.markAsSold')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste des offres reçues */}
      <View style={{ marginHorizontal: 16, marginTop: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text.primary, marginBottom: 10, letterSpacing: 0.5 }}>{t('market.receivedOffers', 'Offres reçues')}</Text>
      </View>
      <View style={{ marginHorizontal: 8 }}>
        {offers.length === 0 ? (
          <Text style={{ color: colors.text.secondary, textAlign: 'center', marginVertical: 16 }}>{t('market.noOffers', 'Aucune offre reçue')}</Text>
        ) : (
          <FlatList
            data={offers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const percent = priceAsked ? ((item.proposed_price - priceAsked) / priceAsked) * 100 : 0;
              const renderLeftActions = (progress: any, dragX: any) => (
                <View style={{
                  flex: 1,
                  height: '100%',
                  backgroundColor: 'green',
                  borderRadius: 16,
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  paddingLeft: 24,
                }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Accept</Text>
                </View>
              );
              const renderRightActions = (progress: any, dragX: any) => (
                <View style={{
                  flex: 1,
                  height: '100%',
                  backgroundColor: 'red',
                  borderRadius: 16,
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  paddingRight: 24,
                }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Refuse</Text>
                </View>
              );
              const handleRefuse = () => {
                Alert.alert(
                  'Refuser l\'offre',
                  t('market.refuseOfferAlertMessage'),
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'OK', style: 'destructive', onPress: async () => {
                        await refuseOffer(item.id);
                        setOffers(prev => prev.filter(o => o.id !== item.id));
                        await createRefuseOfferNotification({
                          buyer_id: item.buyer_id,
                          user_card_id: Array.isArray(id) ? id[0] : id,
                          card_name: officialCard?.name || '',
                        });
                      }
                    },
                  ]
                );
              };
              const handleAccept = async () => {
                RNAlert.alert(
                  t('market.acceptOfferAlertTitle'),
                  t('market.acceptOfferAlertMessage'),
                  [
                    { text: t('alerts.cancel'), style: 'cancel' },
                    { text: 'OK', style: 'default', onPress: async () => {
                        // Récupérer les emails et infos nécessaires
                        const seller_email = user?.email;
                        const seller_username = user?.user_metadata?.username || '';
                        const buyer_email = item.users?.email || '';
                        const buyer_username = item.users?.username || '';
                        // Si l'email de l'acheteur n'est pas dans item, il faut le récupérer via Supabase
                        let final_buyer_email = buyer_email;
                        if (!final_buyer_email && item.buyer_id) {
                          const { data } = await supabase
                            .from('users')
                            .select('email')
                            .eq('id', item.buyer_id)
                            .single();
                          final_buyer_email = data?.email || '';
                        }
                        // Appel Edge Function
                        const payload = {
                          seller_email,
                          buyer_email: final_buyer_email,
                          card_name: officialCard?.name || '',
                          price: item.proposed_price.toFixed(2),
                          seller_username,
                          buyer_username,
                        };
                        try {
                          const res = await fetch('https://dzbdoptsnbonimwunwva.functions.supabase.co/send-transaction-emails', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          });
                          if (res.ok) {
                            RNAlert.alert(t('settings.alerts.success'), t('market.acceptOfferSuccess'));
                          } else {
                            RNAlert.alert(t('settings.alerts.error'), t('market.acceptOfferError'));
                          }
                        } catch (e) {
                          RNAlert.alert(t('settings.alerts.error'), t('market.acceptOfferError'));
                        }
                      }
                    },
                  ]
                );
              };
              return (
                <Swipeable
                  renderLeftActions={renderLeftActions}
                  renderRightActions={renderRightActions}
                  onSwipeableRightOpen={handleRefuse}
                  onSwipeableLeftOpen={handleAccept}
                >
                  <View style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    marginVertical: 0,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                    overflow: 'hidden',
                  }}>
                    {item.users?.avatar_url ? (
                      <Image source={{ uri: item.users.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}> 
                        <Text style={{ color: colors.text.secondary, fontWeight: 'bold' }}>{item.users?.username?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: colors.text.primary, fontWeight: 'bold' }}>{item.users?.username || t('market.unknownBuyer')}</Text>
                      <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#00BFFF', fontWeight: 'bold', fontSize: 16 }}>{item.proposed_price.toFixed(2)} €</Text>
                      <Text style={{ color: percent === 0 ? colors.text.secondary : percent > 0 ? colors.success : colors.error, fontSize: 13, fontWeight: 'bold' }}>{percent > 0 ? '+' : ''}{percent.toFixed(1)}%</Text>
                    </View>
                  </View>
                </Swipeable>
              );
            }}
            style={{ marginTop: 0, marginBottom: 20 }}
          />
        )}
      </View>
      
      {/* Modale de modification */}
      <Modal
        visible={updateModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setUpdateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {/* Header de la modale */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                Modifier la vente
              </Text>
              <TouchableOpacity onPress={() => setUpdateModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollContent}>
              {/* Nom de la carte */}
              <Text style={[styles.cardSellName, { color: colors.text.primary }]}>
                {officialCard?.name}
              </Text>
              
              {/* Prix du marché de référence */}
              <View style={styles.priceRangeContainer}>
                <View style={styles.priceColumn}>
                  <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                    Prix bas
                  </Text>
                  <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                    {marketPrices?.price_low?.toFixed(2) || '?'} €
                  </Text>
                </View>
                
                <View style={styles.priceColumn}>
                  <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>
                    Prix haut
                  </Text>
                  <Text style={[styles.priceValue, { color: colors.text.primary }]}>
                    {marketPrices?.price_high?.toFixed(2) || '?'} €
                  </Text>
                </View>
              </View>
              
              {/* Sélection de condition */}
              <View style={styles.conditionContainer}>
                <Text style={[styles.conditionLabel, { color: colors.text.primary }]}>
                  Condition:
                </Text>
                <View style={styles.conditionSelector}>
                  {CONDITIONS.map((condition) => (
                    <TouchableOpacity
                      key={condition}
                      style={[
                        styles.conditionButton,
                        updatedCondition === condition && { 
                          backgroundColor: CONDITION_COLORS[condition] + '30',
                          borderColor: CONDITION_COLORS[condition] 
                        },
                        { borderColor: colors.border }
                      ]}
                      onPress={() => setUpdatedCondition(condition)}
                    >
                      <Text 
                        style={[
                          styles.conditionButtonText, 
                          { color: updatedCondition === condition ? CONDITION_COLORS[condition] : colors.text.secondary }
                        ]}
                      >
                        {t(`card.conditions.${condition.toLowerCase().replace(' ', '')}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Modification du prix */}
              <View style={styles.sellingPriceContainer}>
                <Text style={[styles.sellingPriceLabel, { color: colors.text.primary }]}>
                  Prix de vente
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.priceInput, { color: colors.text.primary }]}
                    value={updatedPrice}
                    onChangeText={setUpdatedPrice}
                    placeholder="0.00"
                    placeholderTextColor={colors.text.secondary}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                  <Text style={[styles.currencyText, { color: colors.text.primary }]}>€</Text>
                </View>
              </View>
              
              {/* Boutons d'actions */}
              <View style={styles.sellButtonsRow}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: colors.error }]}
                  onPress={handleCancelSale}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Text style={[styles.cancelButtonText, { color: colors.error }]}>
                      Annuler la vente
                    </Text>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.updateSaleButton, 
                    { 
                      backgroundColor: isPriceValid() ? colors.secondary : colors.text.secondary,
                      opacity: isPriceValid() ? 1 : 0.7 
                    }
                  ]}
                  onPress={handleUpdateSale}
                  disabled={!isPriceValid() || isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sellButtonText}>
                      Mettre à jour
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  cardInfoContainer: { flexDirection: 'row', padding: 16, borderRadius: 12, margin: 16, alignItems: 'center' },
  cardThumbnail: { width: 60, height: 85, borderRadius: 6 },
  cardInfo: { marginLeft: 16, flex: 1 },
  cardName: { fontSize: 18, fontWeight: 'bold' },
  cardNumber: { fontSize: 14, marginTop: 2 },
  cardRarity: { fontSize: 14, marginTop: 2 },
  currentPrice: { fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  currentCondition: { fontSize: 14, marginTop: 2 },
  marketPriceContainer: { padding: 16, borderRadius: 12, marginHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  priceColumn: { alignItems: 'center', flex: 0.8 },
  priceLabel: { fontSize: 12, marginBottom: 4 },
  priceValue: { fontSize: 16, fontWeight: 'bold' },
  midPriceColumn: { flex: 1.2, marginHorizontal: 8, paddingBottom: 4 },
  midPriceValue: { fontSize: 20, fontWeight: 'bold' },
  offersContainer: { padding: 16, borderRadius: 12, margin: 16, marginTop: 0 },
  offerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ccc' },
  section: { 
    padding: 16, 
    borderRadius: 12, 
    margin: 16, 
    marginTop: 0 
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  updateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  soldButton: { 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  soldButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  // Styles pour la modale
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScrollContent: {
    paddingHorizontal: 20,
  },
  cardSellName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  conditionContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  conditionLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  conditionSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    flexWrap: 'wrap',
  },
  conditionButton: {
    padding: 10,
    borderWidth: 2,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  conditionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sellingPriceContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  sellingPriceLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    width: '50%',
  },
  priceInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 20,
    textAlign: 'center',
  },
  currencyText: {
    fontSize: 20,
    fontWeight: '500',
  },
  sellButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  cancelButton: {
    padding: 10,
    borderWidth: 2,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: 'bold',
  },
  updateSaleButton: {
    padding: 10,
    borderRadius: 10,
    width: '48%',
    alignItems: 'center',
  },
  sellButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 