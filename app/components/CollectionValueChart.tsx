import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import { EventRegister } from 'react-native-event-listeners';
import { getCollectionValueSeries, type ValuePoint } from '../lib/collectionValue';
import { useTheme } from '../lib/ThemeContext';
import { useThemeColors } from '../lib/ThemeUtils';

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

function samplePoints(points: ValuePoint[], max: number): ValuePoint[] {
  if (points.length <= max) return points;
  const sampled: ValuePoint[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let index = 0; index < max; index += 1) {
    sampled.push(points[Math.round(index * step)]);
  }
  return sampled;
}

function formatVariation(variation: number) {
  if (!Number.isFinite(variation) || variation === 0) return '0%';
  return `${variation > 0 ? '+' : ''}${variation.toFixed(2)}%`;
}

export function CollectionValueChart({
  userId,
  hideValues = false,
}: {
  userId: string;
  hideValues?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isDarkMode } = useTheme();
  const [period, setPeriod] = useState<Period>(30);
  const [points, setPoints] = useState<ValuePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      if (initial) setLoading(true);
      const result = await getCollectionValueSeries(userId);
      if (cancelled) return;
      if (result.error) {
        if (initial) setFailed(true);
      } else {
        setPoints(result.points);
        setFailed(false);
      }
      setLoading(false);
    };

    void load(true);
    const listener: any = EventRegister.addEventListener('collection_data_changed', () => {
      void load(false);
    });

    return () => {
      cancelled = true;
      if (listener) EventRegister.removeEventListener(listener);
    };
  }, [userId]);

  const slice = useMemo(() => {
    if (!points?.length) return [];
    const end = points[points.length - 1].date;
    const startDate = new Date(`${end}T00:00:00`);
    startDate.setDate(startDate.getDate() - period);
    const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const filtered = points.filter((point) => point.date >= start);
    return filtered.length ? filtered : points.slice(-1);
  }, [points, period]);

  const first = slice[0]?.value ?? 0;
  const last = slice[slice.length - 1]?.value ?? 0;
  const variation = first > 0 ? ((last - first) / first) * 100 : 0;
  const variationColor = variation > 0 ? colors.success : variation < 0 ? colors.error : colors.text.secondary;
  const hasHistory = slice.some((point) => point.value > 0);
  const chartPoints = samplePoints(slice, 6);
  const chartData = chartPoints.length === 1 ? [chartPoints[0], chartPoints[0]] : chartPoints;
  const chartWidth = Math.max(220, Dimensions.get('window').width - 64);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.variation, { color: variationColor }]}>
          {hideValues ? '***' : formatVariation(variation)}
        </Text>
        <View style={styles.periods}>
          {PERIODS.map((value) => {
            const selected = period === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setPeriod(value)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? '#FFFFFF' : colors.text.secondary }]}>
                  {t('collection.periodDays', { count: value })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading && !points ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : failed || !hasHistory ? (
        <Text style={[styles.empty, { color: colors.text.secondary }]}>
          {t('collection.noValueHistory')}
        </Text>
      ) : hideValues ? null : (
        <LineChart
          data={{
            labels: chartData.map((point) => `${point.date.slice(8, 10)}/${point.date.slice(5, 7)}`),
            datasets: [{ data: chartData.map((point) => point.value) }],
          }}
          width={chartWidth}
          height={150}
          withInnerLines
          withOuterLines={false}
          chartConfig={{
            backgroundColor: colors.surface,
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: last >= 100 ? 0 : 2,
            color: () => (isDarkMode ? '#FFFFFF' : colors.primary),
            labelColor: () => colors.text.secondary,
            propsForDots: {
              r: '3',
              strokeWidth: '1',
              stroke: isDarkMode ? '#FFFFFF' : colors.primary,
            },
            propsForBackgroundLines: {
              stroke: colors.border,
            },
          }}
          bezier={false}
          style={styles.chart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variation: {
    fontSize: 16,
    fontWeight: '600',
  },
  periods: {
    flexDirection: 'row',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 16,
  },
  empty: {
    marginTop: 8,
    fontSize: 13,
  },
  chart: {
    marginTop: 8,
    marginLeft: -8,
    borderRadius: 12,
  },
});
