import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../lib/auth';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const username = user?.email?.split('@')[0] || 'User';

  const CollectionCard = () => (
    <View style={styles.collectionCard}>
      <View style={styles.collectionHeader}>
        <Text style={styles.currentValue}>Current value</Text>
        <TouchableOpacity>
          <Ionicons name="eye-outline" size={24} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <View style={styles.valueContainer}>
        <Text style={styles.value}>0,00 €</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AVG</Text>
        </View>
      </View>
      <Text style={styles.percentage}>0.00 %</Text>
      <View style={styles.cardsCount}>
        <Text style={styles.cardsText}>0 Cards</Text>
      </View>
    </View>
  );

  const ActionCard = ({ title, icon, buttonText, onPress }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionIcon}>
        {icon}
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <TouchableOpacity style={styles.actionButton}>
        <Text style={styles.actionButtonText}>{buttonText}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const ListItem = ({ icon, title, count, onPress }: any) => (
    <TouchableOpacity style={styles.listItem} onPress={onPress}>
      <View style={styles.listItemLeft}>
        {icon}
        <Text style={styles.listItemTitle}>{title}</Text>
      </View>
      <View style={styles.listItemRight}>
        <Text style={styles.listItemCount}>{count}</Text>
        <Ionicons name="chevron-forward" size={24} color={Colors.text.secondary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={require('../../assets/images/default-avatar.png')}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.username}>{username}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Ionicons name="pencil" size={24} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My collection</Text>
          <TouchableOpacity onPress={() => router.push('/collection')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <CollectionCard />
      </View>

      <View style={styles.actionCards}>
        <ActionCard
          title="Inventory"
          icon={<FontAwesome5 name="folder-open" size={24} color={Colors.secondary} />}
          buttonText="Create folder"
          onPress={() => router.push('/inventory')}
        />
        <ActionCard
          title="Decks"
          icon={<MaterialCommunityIcons name="cards" size={24} color={Colors.secondary} />}
          buttonText="Create deck"
          onPress={() => router.push('/decks')}
        />
      </View>

      <ListItem
        icon={<Ionicons name="heart" size={24} color={Colors.secondary} />}
        title="Wishlist"
        count="0 Cards"
        onPress={() => router.push('/wishlist')}
      />
      <ListItem
        icon={<Ionicons name="notifications" size={24} color={Colors.secondary} />}
        title="Alerts"
        count="0 Alerts"
        onPress={() => router.push('/alerts')}
      />
      <ListItem
        icon={<Ionicons name="swap-horizontal" size={24} color={Colors.secondary} />}
        title="Tradelist"
        count="0 Cards"
        onPress={() => router.push('/tradelist')}
      />
      <ListItem
        icon={<Ionicons name="cash" size={24} color={Colors.secondary} />}
        title="Sold"
        count="0 Cards"
        onPress={() => router.push('/sold')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  greeting: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  seeAll: {
    fontSize: 14,
    color: Colors.secondary,
  },
  collectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentValue: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginRight: 8,
  },
  badge: {
    backgroundColor: Colors.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  percentage: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  cardsCount: {
    marginTop: 8,
  },
  cardsText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  actionCards: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemTitle: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 12,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemCount: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginRight: 8,
  },
}); 