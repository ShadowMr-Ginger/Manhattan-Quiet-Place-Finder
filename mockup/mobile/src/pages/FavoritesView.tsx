import { Heart, Bookmark, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlaceCard from '../components/PlaceCard';
import { mockQuietPlaces } from '../data/mockQuietPlaces';

interface FavoritesViewProps {
  favorites: string[];
  saved: string[];
  onToggleFavorite: (id: string) => void;
}

export default function FavoritesView({ favorites, saved, onToggleFavorite }: FavoritesViewProps) {
  const navigate = useNavigate();
  const favoritePlaces = mockQuietPlaces.filter((p) => favorites.includes(p.id));
  const savedPlaces = mockQuietPlaces.filter((p) => saved.includes(p.id));

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 pb-28 pt-6 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Your Lists</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{favoritePlaces.length} favorites, {savedPlaces.length} saved</p>

      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Heart size={18} className="text-rose-500" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Favorites</h2>
        </div>
        {favoritePlaces.length > 0 ? (
          <div className="flex flex-col gap-3">
            {favoritePlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                isFavorite
                onFavorite={onToggleFavorite}
                onClick={() => navigate(`/place/${place.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
            <Heart size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No favorites yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Tap the heart icon on places you love</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Bookmark size={18} className="text-amber-500" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Saved for Later</h2>
        </div>
        {savedPlaces.length > 0 ? (
          <div className="flex flex-col gap-3">
            {savedPlaces.map((place) => (
              <button
                key={place.id}
                onClick={() => navigate(`/place/${place.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm dark:bg-slate-800"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
                  <MapPin size={18} className="text-slate-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{place.name}</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{place.address}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
            <Bookmark size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing saved yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
