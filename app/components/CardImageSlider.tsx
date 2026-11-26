import React, { useRef, useState } from 'react';
import { View, Image, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, TouchableOpacity } from 'react-native';
import { GestureDetector, ScrollView, type NativeGesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { PhotoZoomModal } from './PhotoZoomModal';

type Props = {
  width: number;
  height: number;
  officialUri: string;
  userPhotoUri: string;
  nativeGesture?: NativeGesture;
  zoomable?: boolean;
};

export function CardImageSlider({ width, height, officialUri, userPhotoUri, nativeGesture, zoomable = false }: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(page);
  };

  const pager = (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      directionalLockEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onScrollEnd}
      style={{ width, height }}
    >
      <Image source={{ uri: officialUri }} style={{ width, height }} resizeMode="contain" />
      <Image source={{ uri: userPhotoUri }} style={{ width, height }} resizeMode="cover" />
    </ScrollView>
  );

  return (
    <View style={{ width, height }}>
      {nativeGesture ? <GestureDetector gesture={nativeGesture}>{pager}</GestureDetector> : pager}
      {zoomable ? (
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => setZoomOpen(true)}
          accessibilityLabel={t('market.zoomPhoto')}
        >
          <Ionicons name="expand-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
      {zoomable ? (
        <PhotoZoomModal uri={userPhotoUri} visible={zoomOpen} onClose={() => setZoomOpen(false)} />
      ) : null}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, currentPage === 0 ? styles.dotActive : null]} />
        <View style={[styles.dot, currentPage === 1 ? styles.dotActive : null]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: 'white',
  },
  zoomButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
