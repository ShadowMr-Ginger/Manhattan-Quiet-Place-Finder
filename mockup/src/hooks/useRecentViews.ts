// Hook for managing recent search history and viewed places
// 管理最近搜索历史和浏览地点的 Hook

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const MAX_RECENT_SEARCHES = 6;
const MAX_RECENT_VIEWS = 8;

export function useRecentViews() {
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('quiet-place-searches', []);
  const [recentViewedIds, setRecentViewedIds] = useLocalStorage<string[]>('quiet-place-views', []);

  const addSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setRecentSearches((prev) => {
        const filtered = prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
        return [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      });
    },
    [setRecentSearches]
  );

  const removeSearch = useCallback(
    (query: string) => {
      setRecentSearches((prev) => prev.filter((q) => q !== query));
    },
    [setRecentSearches]
  );

  const clearSearches = useCallback(() => {
    setRecentSearches([]);
  }, [setRecentSearches]);

  const addViewed = useCallback(
    (placeId: string) => {
      setRecentViewedIds((prev) => {
        const filtered = prev.filter((id) => id !== placeId);
        return [placeId, ...filtered].slice(0, MAX_RECENT_VIEWS);
      });
    },
    [setRecentViewedIds]
  );

  const clearViews = useCallback(() => {
    setRecentViewedIds([]);
  }, [setRecentViewedIds]);

  return {
    recentSearches,
    recentViewedIds,
    addSearch,
    removeSearch,
    clearSearches,
    addViewed,
    clearViews,
  };
}
