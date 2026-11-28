import type { SeriesId } from './types';

const FAVORITES_STORAGE_KEY = 'favoriteSeries-v1';

export function loadFavoriteSeries(): Set<SeriesId> {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as SeriesId[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveFavoriteSeries(favorites: Set<SeriesId>): void {
  localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]));
}
