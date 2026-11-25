import { useCallback, useRef } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';

const RESTORE_DELAYS_MS = [0, 50, 150, 400];

/**
 * Mémorise le décalage d'une FlatList et le réapplique au retour sur l'écran.
 * Le stack natif détache les écrans inactifs : la vue de scroll est recréée en haut.
 */
export function usePreservedListScroll<T>() {
  const listRef = useRef<FlatList<T>>(null);
  const offsetRef = useRef(0);
  const focusedRef = useRef(false);
  const pendingRestoreRef = useRef(false);
  const blockTrackingRef = useRef(false);
  const trackingRef = useRef(false);
  const momentumRef = useRef(false);

  const restore = useCallback(() => {
    if (!pendingRestoreRef.current) return;
    const offset = offsetRef.current;
    if (offset <= 0) {
      pendingRestoreRef.current = false;
      blockTrackingRef.current = false;
      return;
    }
    blockTrackingRef.current = true;
    listRef.current?.scrollToOffset({ offset, animated: false });
  }, []);

  const remember = useCallback((y: number) => {
    if (!focusedRef.current || pendingRestoreRef.current || blockTrackingRef.current) return;
    const next = Math.max(0, y);
    // Le détachement de l'écran envoie un saut direct vers 0, sans geste.
    if (next <= 0 && offsetRef.current - next > 250) return;
    offsetRef.current = next;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!focusedRef.current) return;

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = Math.max(0, contentOffset.y);

    if (pendingRestoreRef.current) {
      const maxY = Math.max(0, contentSize.height - layoutMeasurement.height);
      const layoutReady = layoutMeasurement.height > 0 && contentSize.height > 0;
      const target = Math.min(offsetRef.current, maxY);
      if (layoutReady && Math.abs(y - target) < 24) {
        pendingRestoreRef.current = false;
        blockTrackingRef.current = false;
        offsetRef.current = y;
      }
      return;
    }

    if (!trackingRef.current) return;
    remember(y);
  }, [remember]);

  const onContentSizeChange = useCallback(() => {
    restore();
  }, [restore]);

  const onScrollBeginDrag = useCallback(() => {
    trackingRef.current = true;
    pendingRestoreRef.current = false;
    blockTrackingRef.current = false;
  }, []);

  const onMomentumScrollBegin = useCallback(() => {
    if (pendingRestoreRef.current || blockTrackingRef.current) return;
    momentumRef.current = true;
    trackingRef.current = true;
  }, []);

  const onScrollEndDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const fromGesture = trackingRef.current;
    if (momentumRef.current) return;
    trackingRef.current = false;
    if (fromGesture) remember(event.nativeEvent.contentOffset.y);
  }, [remember]);

  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const fromGesture = trackingRef.current || momentumRef.current;
    momentumRef.current = false;
    trackingRef.current = false;
    if (fromGesture) remember(event.nativeEvent.contentOffset.y);
  }, [remember]);

  const reset = useCallback(() => {
    offsetRef.current = 0;
    pendingRestoreRef.current = false;
    blockTrackingRef.current = false;
    trackingRef.current = false;
    momentumRef.current = false;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      const timers: ReturnType<typeof setTimeout>[] = [];

      if (offsetRef.current > 0) {
        pendingRestoreRef.current = true;
        blockTrackingRef.current = true;
        RESTORE_DELAYS_MS.forEach((delay) => {
          timers.push(setTimeout(restore, delay));
        });
      }

      return () => {
        focusedRef.current = false;
        pendingRestoreRef.current = false;
        blockTrackingRef.current = false;
        trackingRef.current = false;
        momentumRef.current = false;
        timers.forEach(clearTimeout);
      };
    }, [restore])
  );

  return {
    listRef,
    scrollProps: {
      onScroll,
      onContentSizeChange,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      scrollEventThrottle: 16 as const,
    },
    restore,
    reset,
  };
}
