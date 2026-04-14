import React from 'react';
import { View, StyleSheet, Pressable, Platform, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const FLIP_MS = 520;

type Props = {
  width: number;
  height: number;
  officialUri: string;
  userPhotoUri: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * Flip 3D sans module natif additionnel (compatible émulateur/dev client actuel).
 */
export function FlippableCardArt({
  width,
  height,
  officialUri,
  userPhotoUri,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const spin = useSharedValue(0);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1600 }, { rotateY: `${spin.value}deg` }],
  }));

  const onPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    spin.value = withTiming(spin.value === 0 ? 180 : 0, {
      duration: FLIP_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={{ width, height }}
    >
      <View style={{ width, height }} collapsable={false}>
        <Animated.View
          style={[
            {
              width,
              height,
              position: 'relative',
              transformStyle: 'preserve-3d',
            },
            innerStyle,
          ]}
        >
          <View style={[styles.face, styles.faceFront]}>
            <Image
              key={`official-${officialUri}`}
              source={{ uri: officialUri }}
              style={styles.fill}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.face, styles.faceBack]}>
            <Image
              key={`user-${userPhotoUri}`}
              source={{ uri: userPhotoUri }}
              style={styles.fill}
              resizeMode="cover"
            />
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    backgroundColor: '#0d0d0d',
  },
  faceFront: {},
  faceBack: {
    transform: [{ rotateY: '180deg' }],
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});
