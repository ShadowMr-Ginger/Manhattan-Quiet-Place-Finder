import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const MAX_RECENT = 20;

export function useRecentViews() {
  const [recentIds, setRecentIds] = useLocalStorage<string[]>('mqpf-mobile-recent-views', []);

  const recordView = useCallback((id: string) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((x) => x !== id);
      return [id, ...filtered].slice(0, MAX_RECENT);
    });
  }, [setRecentIds]);

  const removeView = useCallback((id: string) => {
    setRecentIds((prev) => prev.filter((x) => x !== id));
  }, [setRecentIds]);

  const clearViews = useCallback(() => {
    setRecentIds([]);
  }, [setRecentIds]);

  return { recentIds, recordView, removeView, clearViews };
}
