import { supabase } from './supabase';
import { midFromRows, type CardFinish } from './priceSource';

export type ValuePoint = { date: string; value: number };

const HISTORY_DAYS = 90;
const CHUNK = 40;

type Copy = { cardId: string; finish: CardFinish | null };
type RawRow = { card_id: string; date: string; price_mid: unknown; source: string | null };

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isMissingFinishColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  return message.includes('finish') && (
    message.includes('column') ||
    message.includes('schema cache') ||
    error.code === '42703' ||
    error.code === 'PGRST204'
  );
}

function asFinish(value: unknown): CardFinish | null {
  const key = String(value ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  if (key === 'normal' || key === 'normale' || key === 'nonholo') return 'normale';
  if (key === 'holo' || key === 'holofoil' || key === 'holographique' || key === 'holographic') return 'holo';
  if (key === 'reverse' || key === 'inverse' || key === 'reverseholo') return 'inverse';
  return null;
}

async function fetchWindow(cardIds: string[], since: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let index = 0; index < cardIds.length; index += CHUNK) {
    const slice = cardIds.slice(index, index + CHUNK);
    let from = 0;
    for (let page = 0; page < 20; page += 1) {
      const { data, error } = await supabase
        .from('market_prices')
        .select('card_id, date, price_mid, source')
        .in('card_id', slice)
        .gte('date', since)
        .order('date', { ascending: true })
        .range(from, from + 999);

      if (error) throw error;
      if (!data?.length) break;
      rows.push(...(data as RawRow[]));
      if (data.length < 1000) break;
      from += 1000;
    }
  }
  return rows;
}

async function fetchBaseline(cardIds: string[], before: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  for (let index = 0; index < cardIds.length; index += CHUNK) {
    const slice = cardIds.slice(index, index + CHUNK);
    const latestDate = new Map<string, string>();
    let from = 0;

    for (let page = 0; page < 6 && latestDate.size < slice.length; page += 1) {
      const { data, error } = await supabase
        .from('market_prices')
        .select('card_id, date, price_mid, source')
        .in('card_id', slice)
        .lt('date', before)
        .order('date', { ascending: false })
        .range(from, from + 999);

      if (error) throw error;
      if (!data?.length) break;

      for (const row of data as RawRow[]) {
        const known = latestDate.get(row.card_id);
        if (!known) {
          latestDate.set(row.card_id, row.date);
          rows.push(row);
        } else if (known === row.date) {
          rows.push(row);
        }
      }

      if (data.length < 1000) break;
      from += 1000;
    }
  }
  return rows;
}

function groupByCard(rows: RawRow[]): Map<string, RawRow[]> {
  const grouped = new Map<string, RawRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.card_id);
    if (list) list.push(row);
    else grouped.set(row.card_id, [row]);
  }
  return grouped;
}

function timelineFor(rows: RawRow[], finish: CardFinish | null): { date: string; mid: number }[] {
  const byDate = new Map<string, RawRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }

  return [...byDate.entries()]
    .map(([date, dayRows]) => ({ date, mid: midFromRows(dayRows, finish) }))
    .filter((point): point is { date: string; mid: number } => point.mid != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function priceAt(
  timeline: { date: string; mid: number }[],
  baseline: number | null,
  day: string
): number | null {
  let value = baseline;
  for (const point of timeline) {
    if (point.date <= day) value = point.mid;
    else break;
  }
  if (value == null && timeline.length > 0 && day < timeline[0].date) {
    return timeline[0].mid;
  }
  return value;
}

export async function getCollectionValueSeries(userId: string): Promise<{
  points: ValuePoint[];
  error: unknown;
}> {
  try {
    const withFinish = await supabase
      .from('user_cards')
      .select('card_id, finish')
      .eq('user_id', userId)
      .eq('is_sold', false);

    const copiesQuery = isMissingFinishColumn(withFinish.error)
      ? await supabase
        .from('user_cards')
        .select('card_id')
        .eq('user_id', userId)
        .eq('is_sold', false)
      : withFinish;

    if (copiesQuery.error) throw copiesQuery.error;

    const copies: Copy[] = ((copiesQuery.data || []) as { card_id: string; finish?: string | null }[]).map((row) => ({
      cardId: row.card_id,
      finish: asFinish(row.finish),
    }));

    if (copies.length === 0) return { points: [], error: null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since = isoDate(addDays(today, -HISTORY_DAYS));
    const cardIds = [...new Set(copies.map((copy) => copy.cardId))];

    const [windowRows, baselineRows] = await Promise.all([
      fetchWindow(cardIds, since),
      fetchBaseline(cardIds, since),
    ]);

    const windowByCard = groupByCard(windowRows);
    const baselineByCard = groupByCard(baselineRows);
    const timelineCache = new Map<string, { date: string; mid: number }[]>();
    const baselineCache = new Map<string, number | null>();

    const cacheKey = (cardId: string, finish: CardFinish | null) => `${cardId}:${finish || ''}`;

    for (const copy of copies) {
      const key = cacheKey(copy.cardId, copy.finish);
      if (timelineCache.has(key)) continue;
      timelineCache.set(key, timelineFor(windowByCard.get(copy.cardId) || [], copy.finish));
      const baseRows = baselineByCard.get(copy.cardId) || [];
      baselineCache.set(key, baseRows.length ? midFromRows(baseRows, copy.finish) : null);
    }

    const points: ValuePoint[] = [];
    for (let offset = HISTORY_DAYS; offset >= 0; offset -= 1) {
      const day = isoDate(addDays(today, -offset));
      let total = 0;
      for (const copy of copies) {
        const key = cacheKey(copy.cardId, copy.finish);
        const value = priceAt(timelineCache.get(key) || [], baselineCache.get(key) ?? null, day);
        if (value != null) total += value;
      }
      points.push({ date: day, value: total });
    }

    return { points, error: null };
  } catch (error) {
    console.error('Erreur lors du calcul de la courbe de collection:', error);
    return { points: [], error };
  }
}
