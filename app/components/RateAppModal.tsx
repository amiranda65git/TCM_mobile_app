import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../lib/ThemeUtils';
import {
  markRatePromptCompleted,
  openStoreRatingFlow,
  snoozeRatePrompt,
} from '../lib/rateAppPrompt';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const STAR_COUNT = 5;
const STORE_MIN_STARS = 4;

export default function RateAppModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState(false);

  const resetAndClose = () => {
    setRating(0);
    setThanks(false);
    setSubmitting(false);
    onClose();
  };

  const handleLater = async () => {
    await snoozeRatePrompt();
    resetAndClose();
  };

  const handleSubmit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      await markRatePromptCompleted();
      if (rating >= STORE_MIN_STARS) {
        await openStoreRatingFlow();
        resetAndClose();
      } else {
        setThanks(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <Pressable style={styles.backdrop} onPress={handleLater}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {thanks ? (
            <>
              <Ionicons name="heart" size={36} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {t('rateApp.thanksTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                {t('rateApp.thanksMessage')}
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={resetAndClose}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>{t('general.ok')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {t('rateApp.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                {t('rateApp.message')}
              </Text>

              <View style={styles.starsRow}>
                {Array.from({ length: STAR_COUNT }, (_, i) => {
                  const value = i + 1;
                  const filled = value <= rating;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setRating(value)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${value} ${t('rateApp.stars')}`}
                    >
                      <Ionicons
                        name={filled ? 'star' : 'star-outline'}
                        size={36}
                        color={filled ? '#F5A623' : colors.text.secondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: rating < 1 || submitting ? 0.5 : 1,
                  },
                ]}
                onPress={handleSubmit}
                disabled={rating < 1 || submitting}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>
                  {t('rateApp.submit')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLater} hitSlop={10}>
                <Text style={[styles.later, { color: colors.text.secondary }]}>
                  {t('rateApp.later')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  primaryButton: {
    marginTop: 8,
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  later: {
    marginTop: 4,
    fontSize: 14,
  },
});
