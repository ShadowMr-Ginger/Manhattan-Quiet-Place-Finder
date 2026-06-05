// Hook for managing favorite and saved places with localStorage
// 使用 localStorage 管理收藏和保存地点的 Hook

import { useCallback } from 'react';
import { QuietPlace } from '@/types/quietPlace';
import { useLocalStorage } from './useLocalStorage';

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>('quiet-place-favorites', []);
  const [savedPlaces, setSavedPlaces] = useLocalStorage<string[]>('quiet-place-saved', []);

  const isFavorite = useCallback(
    (placeId: string) => favorites.includes(placeId),
    [favorites]
  );

  const isSaved = useCallback(
    (placeId: string) => savedPlaces.includes(placeId),
    [savedPlaces]
  );

  const toggleFavorite = useCallback(
    (placeId: string) => {
      setFavorites((prev) =>
        prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId]
      );
    },
    [setFavorites]
  );

  const toggleSaved = useCallback(
    (placeId: string) => {
      setSavedPlaces((prev) =>
        prev.includes(placeId) ? prev.filter((id) => id !== placeId) : [...prev, placeId]
      );
    },
    [setSavedPlaces]
  );

  const getFavoritePlaces = useCallback(
    (allPlaces: QuietPlace[]) => allPlaces.filter((p) => favorites.includes(p.id)),
    [favorites]
  );

  const getSavedPlaces = useCallback(
    (allPlaces: QuietPlace[]) => allPlaces.filter((p) => savedPlaces.includes(p.id)),
    [savedPlaces]
  );

  return {
    favorites,
    savedPlaces,
    isFavorite,
    isSaved,
    toggleFavorite,
    toggleSaved,
    getFavoritePlaces,
    getSavedPlaces,
  };
}
