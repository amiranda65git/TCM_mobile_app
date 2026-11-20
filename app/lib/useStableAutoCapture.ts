import { useEffect, useRef, useState, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';

const MOTION_THRESHOLD = 0.12;
const STABLE_MS = 700;
const COOLDOWN_MS = 2500;
const UPDATE_INTERVAL_MS = 100;

type Options = {
  enabled: boolean;
  onCapture: () => void;
};

/**
 * Déclenche onCapture quand le téléphone reste stable ~STABLE_MS.
 * Appeler markCooldown() après une capture (auto ou manuelle).
 */
export function useStableAutoCapture({ enabled, onCapture }: Options) {
  const [isStable, setIsStable] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const lastSample = useRef<{ x: number; y: number; z: number } | null>(null);
  const stableSince = useRef<number | null>(null);
  const cooldownUntil = useRef(0);
  const firedRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  const markCooldown = useCallback(() => {
    cooldownUntil.current = Date.now() + COOLDOWN_MS;
    firedRef.current = false;
    stableSince.current = null;
    lastSample.current = null;
    setIsStable(false);
    setIsReady(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsStable(false);
      setIsReady(false);
      stableSince.current = null;
      lastSample.current = null;
      firedRef.current = false;
      return;
    }

    let subscription: { remove: () => void } | null = null;

    (async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (!available) {
        console.warn('[Scan] Accéléromètre indisponible — auto-capture désactivée');
        return;
      }

      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        if (Date.now() < cooldownUntil.current) return;
        if (firedRef.current) return;

        const prev = lastSample.current;
        lastSample.current = { x, y, z };
        if (!prev) return;

        const delta =
          Math.abs(x - prev.x) + Math.abs(y - prev.y) + Math.abs(z - prev.z);

        if (delta < MOTION_THRESHOLD) {
          if (!stableSince.current) {
            stableSince.current = Date.now();
          }
          setIsStable(true);
          if (Date.now() - stableSince.current >= STABLE_MS) {
            setIsReady(true);
            firedRef.current = true;
            onCaptureRef.current();
          }
        } else {
          stableSince.current = null;
          setIsStable(false);
          setIsReady(false);
        }
      });
    })();

    return () => {
      subscription?.remove();
    };
  }, [enabled]);

  return { isStable, isReady, markCooldown };
}
