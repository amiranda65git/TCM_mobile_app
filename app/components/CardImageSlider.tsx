import React, { useRef, useState } from 'react';
import { View, Image, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

type Props = {
  width: number;
  height: number;
  officialUri: string;
  userPhotoUri: string;
};

export function CardImageSlider({ width, height, officialUri, userPhotoUri }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(page);
  };

  return (
    <View style={{ width, height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ width, height }}
      >
        <Image source={{ uri: officialUri }} style={{ width, height }} resizeMode="contain" />
        <Image source={{ uri: userPhotoUri }} style={{ width, height }} resizeMode="cover" />
      </ScrollView>
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
});
