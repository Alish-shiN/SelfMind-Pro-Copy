import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'selfmind:archive-favorite-entry-ids';

export async function getArchiveFavoriteIds(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

export async function setArchiveFavoriteIds(ids: number[]) {
  const unique = Array.from(new Set(ids));
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(unique));
  return unique;
}

export async function toggleArchiveFavoriteId(id: number) {
  const current = await getArchiveFavoriteIds();
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  return setArchiveFavoriteIds(next);
}
