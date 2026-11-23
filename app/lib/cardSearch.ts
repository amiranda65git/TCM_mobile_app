const ACCENT_CLASSES: Record<string, string> = {
  a: 'aAàÀáÁâÂãÃäÄåÅ',
  c: 'cCçÇ',
  e: 'eEèÈéÉêÊëË',
  i: 'iIìÌíÍîÎïÏ',
  n: 'nNñÑ',
  o: 'oOòÒóÓôÔõÕöÖ',
  u: 'uUùÙúÚûÛüÜ',
  y: 'yYýÝÿŸ',
};

const LIGATURES: Record<string, [string, string]> = {
  ae: [`[${ACCENT_CLASSES.a}][${ACCENT_CLASSES.e}]`, '[æÆ]'],
  oe: [`[${ACCENT_CLASSES.o}][${ACCENT_CLASSES.e}]`, '[œŒ]'],
  ss: ['ss', 'ß'],
};

/** Minuscules, sans accents ni ligatures. Les séparateurs restent en place. */
export function foldCardSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss');
}

/**
 * Mots de la requête. L'ordre n'est pas significatif.
 * Une lettre seule (ex. « V ») est gardée seulement à côté d'un mot plus long.
 */
export function cardNameSearchTokens(searchTerm: string): string[] {
  const folded = foldCardSearchText(searchTerm);
  const parts = folded.split(/[^a-z0-9]+/).filter((token) => token.length >= 1);
  const words = parts.filter((token) => token.length >= 2);

  if (words.length === 0) {
    const compact = folded.replace(/[^a-z0-9]+/g, '');
    return compact.length >= 2 ? [compact] : [];
  }

  return [...new Set(parts)];
}

function charPattern(char: string): string {
  const accentClass = ACCENT_CLASSES[char];
  return accentClass ? `[${accentClass}]` : char;
}

/** Variantes `~*` d'un mot : accents, et ligatures œ / æ / ß sans parenthèses. */
function tokenPatterns(token: string): string[] {
  const pieces: Array<{ start: number; end: number; options: [string, string] }> = [];

  for (let index = 0; index < token.length - 1; index++) {
    const options = LIGATURES[token.slice(index, index + 2)];
    if (!options) continue;
    pieces.push({ start: index, end: index + 2, options });
    index += 1;
  }

  if (pieces.length === 0 || pieces.length > 3) {
    return [Array.from(token, charPattern).join('')];
  }

  const patterns: string[] = [];
  const variantCount = 2 ** pieces.length;

  for (let variant = 0; variant < variantCount; variant++) {
    let pattern = '';
    let cursor = 0;

    pieces.forEach((piece, pieceIndex) => {
      pattern += Array.from(token.slice(cursor, piece.start), charPattern).join('');
      pattern += piece.options[(variant >> pieceIndex) & 1];
      cursor = piece.end;
    });

    pattern += Array.from(token.slice(cursor), charPattern).join('');
    patterns.push(pattern);
  }

  return patterns;
}

/** Un tableau par mot. Plusieurs motifs d'un même mot sont des alternatives. */
export function cardNameSearchClauses(searchTerm: string): string[][] {
  return cardNameSearchTokens(searchTerm).map(tokenPatterns);
}

export function cardNameMatchesSearch(name: string, searchTerm: string): boolean {
  const tokens = cardNameSearchTokens(searchTerm);
  if (!name || tokens.length === 0) return false;

  const haystack = foldCardSearchText(name);
  return tokens.every((token) => haystack.includes(token));
}
