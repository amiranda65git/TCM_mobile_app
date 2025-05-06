import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useAuth } from '../lib/auth';

export default function CollectionScreen() {
  const { user } = useAuth();
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ma Collection</Text>
        <TouchableOpacity>
          <Ionicons name="options-outline" size={24} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.collectionSummary}>
        <View style={styles.valueContainer}>
          <View style={styles.valueHeader}>
            <Text style={styles.valueLabel}>Valeur totale</Text>
            <TouchableOpacity>
              <Ionicons name="eye-outline" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.valueAmount}>0,00 €</Text>
          
          <View style={styles.valueChange}>
            <Text style={styles.valueChangeText}>0,00%</Text>
            <Text style={styles.valuePeriod}>Dernière semaine</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Cartes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>En vente</Text>
        </View>
      </View>
      
      <View style={styles.actionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="add-circle-outline" size={24} color={Colors.secondary} />
            <Text style={styles.actionLabel}>Ajouter</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="folder-outline" size={24} color={Colors.secondary} />
            <Text style={styles.actionLabel}>Dossier</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="pricetag-outline" size={24} color={Colors.secondary} />
            <Text style={styles.actionLabel}>Vendre</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="filter-outline" size={24} color={Colors.secondary} />
            <Text style={styles.actionLabel}>Filtrer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={24} color={Colors.secondary} />
            <Text style={styles.actionLabel}>Exporter</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      <View style={styles.emptyCollection}>
        <Ionicons name="folder-open-outline" size={80} color={Colors.text.secondary} />
        <Text style={styles.emptyTitle}>Collection vide</Text>
        <Text style={styles.emptyText}>
          Ajoutez vos premières cartes en utilisant l'onglet Scan ou le bouton Ajouter ci-dessus.
        </Text>
      </View>
    </View>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  collectionSummary: {
    padding: 16,
  },
  valueContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  valueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  valueAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginVertical: 8,
  },
  valueChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueChangeText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginRight: 8,
  },
  valuePeriod: {
    fontSize: 14,
    color: Colors.text.secondary,
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  actionsScroll: {
    paddingHorizontal: 12,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  actionLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyCollection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
}); 