import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import {
  findCardBrowseIndex,
  getCardBrowseList,
  type CardBrowseEntry,
} from './cardBrowse';

type Args = {
  routeCardId?: string;
  routeUserCardId?: string;
  browseOn: boolean;
  hasUserPhoto: boolean;
  blocked: boolean;
};

export function useCardBrowse({
  routeCardId,
  routeUserCardId,
  browseOn,
  hasUserPhoto,
  blocked,
}: Args) {
  const routeKey = `${routeCardId ?? ''}::${routeUserCardId ?? ''}`;
  const [browseOverride, setBrowseOverride] = useState<CardBrowseEntry | null>(null);
  const [trackedRouteKey, setTrackedRouteKey] = useState(routeKey);

  if (trackedRouteKey !== routeKey) {
    setTrackedRouteKey(routeKey);
    setBrowseOverride(null);
  }

  const activeOverride = trackedRouteKey === routeKey ? browseOverride : null;
  const cardId = activeOverride?.id ?? routeCardId;
  const userCardId = activeOverride ? activeOverride.userCardId : routeUserCardId;

  const currentEntryRef = useRef<{ id?: string; userCardId?: string }>({});
  currentEntryRef.current = { id: cardId, userCardId };

  const dragX = useSharedValue(0);
  const canPrev = useSharedValue(0);
  const canNext = useSharedValue(0);
  const blockSwipe = useSharedValue(0);

  const position = useMemo(() => {
    if (!browseOn) {
      return {
        prev: null as CardBrowseEntry | null,
        next: null as CardBrowseEntry | null,
        index: -1,
        total: 0,
      };
    }
    const list = getCardBrowseList();
    const index = findCardBrowseIndex(list, cardId, userCardId);
    return {
      prev: index > 0 ? list[index - 1] : null,
      next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
      index,
      total: list.length,
    };
  }, [browseOn, cardId, userCardId]);

  const canBrowse = browseOn && position.total > 1 && position.index >= 0;

  useEffect(() => {
    canPrev.value = position.prev ? 1 : 0;
    canNext.value = position.next ? 1 : 0;
  }, [position.prev, position.next, canPrev, canNext]);

  useEffect(() => {
    blockSwipe.value = blocked ? 1 : 0;
  }, [blocked, blockSwipe]);

  useEffect(() => {
    dragX.value = 0;
  }, [cardId, userCardId, dragX]);

  const goTo = useCallback((entry: CardBrowseEntry) => {
    const list = getCardBrowseList();
    const index = findCardBrowseIndex(list, entry.id, entry.userCardId);
    canPrev.value = index > 0 ? 1 : 0;
    canNext.value = index >= 0 && index < list.length - 1 ? 1 : 0;
    currentEntryRef.current = { id: entry.id, userCardId: entry.userCardId };
    setBrowseOverride({ id: entry.id, userCardId: entry.userCardId });
  }, [canPrev, canNext]);

  const commitFromGesture = useCallback((direction: number) => {
    const list = getCardBrowseList();
    const current = currentEntryRef.current;
    if (!current.id) return;
    const index = findCardBrowseIndex(list, current.id, current.userCardId);
    if (index < 0) return;
    const entry = list[index + direction];
    if (!entry) return;
    goTo(entry);
  }, [goTo]);

  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const imageGesture = useMemo(() => Gesture.Native(), []);

  const panGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(canBrowse)
      .maxPointers(1)
      .activeOffsetX([-18, 18])
      .failOffsetY([-14, 14])
      .simultaneousWithExternalGesture(scrollGesture)
      .onUpdate((event) => {
        if (blockSwipe.value === 1) return;
        let nextX = event.translationX;
        if (nextX > 0 && canPrev.value === 0) nextX *= 0.2;
        if (nextX < 0 && canNext.value === 0) nextX *= 0.2;
        dragX.value = nextX;
      })
      .onEnd((event) => {
        if (blockSwipe.value === 1) return;
        const goNext = canNext.value === 1 && (event.translationX < -64 || event.velocityX < -900);
        const goPrev = canPrev.value === 1 && (event.translationX > 64 || event.velocityX > 900);
        if (goNext) runOnJS(commitFromGesture)(1);
        else if (goPrev) runOnJS(commitFromGesture)(-1);
      })
      .onFinalize(() => {
        dragX.value = withSpring(0);
      });

    if (hasUserPhoto) {
      pan.requireExternalGestureToFail(imageGesture);
    }

    return pan;
  }, [
    canBrowse,
    hasUserPhoto,
    scrollGesture,
    imageGesture,
    commitFromGesture,
    blockSwipe,
    canPrev,
    canNext,
    dragX,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  return {
    cardId,
    userCardId,
    canBrowse,
    position,
    goTo,
    panGesture,
    scrollGesture,
    imageGesture,
    animatedStyle,
    activeCardRef: currentEntryRef,
  };
}
