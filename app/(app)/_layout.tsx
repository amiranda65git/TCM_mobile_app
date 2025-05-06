import React from 'react';
import { View, StyleSheet } from 'react-native';
import TabNavigator from '../navigation/TabNavigator';
import { Colors } from '../constants/Colors';

export default function AppLayout() {
  return (
    <View style={styles.container}>
      <TabNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
}); 