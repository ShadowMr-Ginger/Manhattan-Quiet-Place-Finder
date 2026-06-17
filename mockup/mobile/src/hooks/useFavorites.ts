import { useLocalStorage } from './useLocalStorage';

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>('mqpf-mobile-favorites', []);
  const [saved, setSaved] = useLocalStorage<string[]>('mqpf-mobile-saved', []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSaved = (id: string) => {
    setSaved((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isFavorite = (id: string) => favorites.includes(id);
  const isSaved = (id: string) => saved.includes(id);

  return { favorites, saved, toggleFavorite, toggleSaved, isFavorite, isSaved };
}
