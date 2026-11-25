import AsyncStorage from '@react-native-async-storage/async-storage';

export type CardFolder = { id: string; name: string };

export type CardFolderStore = {
  folders: CardFolder[];
  assignments: Record<string, string>;
};

const emptyStore = (): CardFolderStore => ({ folders: [], assignments: {} });

function storageKey(userId: string) {
  return `@tcmarket_card_folders_${userId}`;
}

export async function loadCardFolders(userId: string): Promise<CardFolderStore> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as CardFolderStore;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      assignments: parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
    };
  } catch (error) {
    console.error('Erreur lors du chargement des dossiers:', error);
    return emptyStore();
  }
}

async function saveCardFolders(userId: string, store: CardFolderStore) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(store));
  return store;
}

export async function createCardFolder(userId: string, name: string): Promise<CardFolderStore> {
  const store = await loadCardFolders(userId);
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return store;
  store.folders.push({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
  });
  return saveCardFolders(userId, store);
}

export async function renameCardFolder(userId: string, folderId: string, name: string): Promise<CardFolderStore> {
  const store = await loadCardFolders(userId);
  const trimmed = name.trim().slice(0, 40);
  store.folders = store.folders.map((folder) => (
    folder.id === folderId && trimmed ? { ...folder, name: trimmed } : folder
  ));
  return saveCardFolders(userId, store);
}

export async function deleteCardFolder(userId: string, folderId: string): Promise<CardFolderStore> {
  const store = await loadCardFolders(userId);
  store.folders = store.folders.filter((folder) => folder.id !== folderId);
  const assignments: Record<string, string> = {};
  for (const [cardId, assigned] of Object.entries(store.assignments)) {
    if (assigned !== folderId) assignments[cardId] = assigned;
  }
  store.assignments = assignments;
  return saveCardFolders(userId, store);
}

export async function assignCardFolder(
  userId: string,
  userCardId: string,
  folderId: string | null
): Promise<CardFolderStore> {
  const store = await loadCardFolders(userId);
  if (!folderId) delete store.assignments[userCardId];
  else store.assignments[userCardId] = folderId;
  return saveCardFolders(userId, store);
}
