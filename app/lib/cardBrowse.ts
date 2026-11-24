export type CardBrowseEntry = {
  id: string;
  userCardId?: string;
};

let entries: CardBrowseEntry[] = [];

export function setCardBrowseList(next: CardBrowseEntry[]) {
  entries = next
    .filter((entry) => entry.id)
    .map((entry) => ({
      id: String(entry.id),
      userCardId: entry.userCardId ? String(entry.userCardId) : undefined,
    }));
}

export function getCardBrowseList() {
  return entries;
}

export function readRouteParam(value?: string | string[]) {
  if (value == null) return undefined;
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}

export function findCardBrowseIndex(
  list: CardBrowseEntry[],
  cardId?: string,
  userCardId?: string
) {
  if (!cardId || list.length === 0) return -1;

  if (userCardId) {
    const byCopy = list.findIndex((entry) => entry.userCardId === userCardId);
    if (byCopy >= 0) return byCopy;
  }

  const matches: number[] = [];
  list.forEach((entry, index) => {
    if (entry.id === cardId) matches.push(index);
  });

  if (matches.length === 1) return matches[0];
  if (!userCardId && matches.length > 0) {
    const withoutCopy = matches.find((index) => !list[index].userCardId);
    return withoutCopy ?? matches[0];
  }

  return -1;
}
