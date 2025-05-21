import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ActivityIndicator, SafeAreaView, Alert, Animated } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase, getOfficialCardDetails, getMarketPricesForCard, refuseOffer, createRefuseOfferNotification } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useThemeColors } from '../../lib/ThemeUtils';
import { Swipeable } from 'react-native-gesture-handler';
import { Alert as RNAlert } from 'react-native';

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
        .select('id, card_id, price, condition, official_cards(id, name, number, rarity, image_small, image_large)')
        .eq('id', id)
        .single();
      if (userCardError) throw userCardError;
      setUserCard(userCardData);
      // 2. Récupérer les infos officielles de la carte
      const cardId = userCardData.card_id;
      const { data: cardData, error: cardError } = await getOfficialCardDetails(cardId);
      if (cardError) throw cardError;
      setOfficialCard(cardData);
      // 3. Prix du marché
      const { data: priceData, error: priceError } = await getMarketPricesForCard(cardId);
      if (priceError) throw priceError;
      setMarketPrices(priceData);
      // 4. Offres reçues
      const { data: offersData, error: offersError } = await supabase
        .from('offers')
        .select('id, buyer_id, proposed_price, created_at, users:buyer_id(username, avatar_url)')
        .eq('user_card_id', id)
        .order('created_at', { ascending: false });
      if (offersError) throw offersError;
      setOffers(offersData || []);
    } catch (e) {
      console.error('Erreur chargement détails vente:', e);
    } finally {
      setLoading(false);
    }
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
        </View>
      </View>
      {/* Prix du marché */}
      <View style={[styles.marketPriceContainer, { backgroundColor: colors.surface }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{t('card.prices')}</Text>
        <View style={styles.priceRow}>
          <View style={styles.priceColumn}>
            <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>{t('card.lowPrice')}</Text>
            <Text style={[styles.priceValue, { color: colors.text.primary }]}>{marketPrices?.price_low?.toFixed(2) || '-'} €</Text>
          </View>
          <View style={[styles.priceColumn, styles.midPriceColumn]}>
            <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>{t('card.midPrice')}</Text>
            <Text style={[styles.priceValue, styles.midPriceValue, { color: 'white' }]}>{marketPrices?.price_mid?.toFixed(2) || '-'} €</Text>
          </View>
          <View style={styles.priceColumn}>
            <Text style={[styles.priceLabel, { color: colors.text.secondary }]}>{t('card.highPrice')}</Text>
            <Text style={[styles.priceValue, { color: colors.text.primary }]}>{marketPrices?.price_high?.toFixed(2) || '-'} €</Text>
          </View>
        </View>
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
}); 