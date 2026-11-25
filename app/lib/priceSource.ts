export type CardFinish = 'normale' | 'holo' | 'inverse';
export type Marketplace = 'cardmarket' | 'tcgplayer' | 'ebay' | 'other';

export type PriceQuote = {
  source: string;
  marketplace: Marketplace;
  finish: CardFinish | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  date: string | null;
};

const MARKET_LABEL: Record<Marketplace, string> = {
  cardmarket: 'Cardmarket',
  tcgplayer: 'TCGplayer',
  ebay: 'eBay',
  other: 'Autre',
};

const MARKET_RANK: Record<Marketplace, number> = {
  cardmarket: 0,
  tcgplayer: 1,
  ebay: 2,
  other: 3,
};

export function toPrice(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePriceSource(source: string | null | undefined): {
  marketplace: Marketplace;
  finish: CardFinish | null;
  fallback: string;
} {
  const raw = String(source || '').trim();
  const key = raw.toLowerCase();

  let marketplace: Marketplace = 'other';
  if (key.includes('cardmarket') || key.includes('card_market')) marketplace = 'cardmarket';
  else if (key.includes('tcgplayer') || key.includes('tcg')) marketplace = 'tcgplayer';
  else if (key.includes('ebay')) marketplace = 'ebay';

  let finish: CardFinish | null = null;
  if (key.includes('reverse') || key.includes('inverse')) finish = 'inverse';
  else if (key.includes('holo')) finish = 'holo';
  else if (key.includes('normal') || key.includes('nonholo') || key.includes('unlimited')) finish = 'normale';

  const fallback = raw.replace(/^tcgplayer_/i, '') || raw || '—';
  return { marketplace, finish, fallback };
}

export function sourceLabel(
  source: string,
  finishNames: Record<CardFinish, string>
): string {
  const parsed = parsePriceSource(source);
  const market = parsed.marketplace === 'other' ? parsed.fallback : MARKET_LABEL[parsed.marketplace];
  if (!parsed.finish) return market;
  return `${market} · ${finishNames[parsed.finish]}`;
}

type RawPriceRow = {
  source?: string | null;
  price_low?: unknown;
  price_mid?: unknown;
  price_high?: unknown;
  price_market?: unknown;
  date?: string | null;
  updated_at?: string | null;
};

/** Une cote par source, en gardant la ligne la plus récente. */
export function latestQuotes(rows: RawPriceRow[]): PriceQuote[] {
  const ordered = [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const bySource = new Map<string, PriceQuote>();

  for (const row of ordered) {
    const source = String(row.source || 'unknown');
    if (bySource.has(source)) continue;
    const parsed = parsePriceSource(source);
    bySource.set(source, {
      source,
      marketplace: parsed.marketplace,
      finish: parsed.finish,
      low: toPrice(row.price_low),
      mid: toPrice(row.price_mid),
      high: toPrice(row.price_high),
      market: toPrice(row.price_market),
      date: row.date ?? row.updated_at ?? null,
    });
  }

  return [...bySource.values()];
}

export function quotesForFinish(
  quotes: PriceQuote[],
  finish: CardFinish | null
): { quotes: PriceQuote[]; exact: boolean } {
  const withPrice = quotes.filter((quote) => quote.mid != null);
  if (!finish) return { quotes: withPrice, exact: false };

  const exactQuotes = withPrice.filter((quote) => quote.finish === finish);
  if (exactQuotes.length) return { quotes: exactQuotes, exact: true };

  const generic = withPrice.filter((quote) => quote.finish == null);
  if (generic.length) return { quotes: generic, exact: false };

  return { quotes: withPrice, exact: false };
}

export function preferredQuote(quotes: PriceQuote[], finish: CardFinish | null): PriceQuote | null {
  const { quotes: scoped } = quotesForFinish(quotes, finish);
  if (!scoped.length) return null;

  return [...scoped].sort((a, b) => {
    const finishBoost = (quote: PriceQuote) => (finish && quote.finish === finish ? 0 : 1);
    const byFinish = finishBoost(a) - finishBoost(b);
    if (byFinish !== 0) return byFinish;
    const byMarket = MARKET_RANK[a.marketplace] - MARKET_RANK[b.marketplace];
    if (byMarket !== 0) return byMarket;
    return String(b.date || '').localeCompare(String(a.date || ''));
  })[0];
}

export function exactFinishMid(quotes: PriceQuote[], finish: CardFinish): number | null {
  const exact = quotes.filter((quote) => quote.finish === finish && quote.mid != null);
  return preferredQuote(exact, finish)?.mid ?? null;
}

export function midFromRows(
  rows: Array<{ source?: string | null; price_mid?: unknown; date?: string | null }>,
  finish: CardFinish | null
): number | null {
  const quotes: PriceQuote[] = rows.map((row) => {
    const parsed = parsePriceSource(row.source);
    return {
      source: String(row.source || 'unknown'),
      marketplace: parsed.marketplace,
      finish: parsed.finish,
      low: null,
      high: null,
      market: null,
      mid: toPrice(row.price_mid),
      date: row.date ?? null,
    };
  });
  return preferredQuote(quotes, finish)?.mid ?? null;
}
