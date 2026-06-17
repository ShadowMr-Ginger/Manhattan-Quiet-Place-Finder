import { Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlaceCard from '../components/PlaceCard';
import { mockQuietPlaces } from '../data/mockQuietPlaces';

interface RecentlyViewedProps {
  recentIds: string[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onClear: () => void;
}

export default function RecentlyViewed({ recentIds, favorites, onToggleFavorite, onClear }: RecentlyViewedProps) {
  const navigate = useNavigate();
  const places = recentIds
    .map((id) => mockQuietPlaces.find((p) => p.id === id))
    .filter(Boolean) as typeof mockQuietPlaces;

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 pb-28 pt-6 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Recently Viewed</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{places.length} place{places.length !== 1 ? 's' : ''} in history</p>
        </div>
        {places.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 dark:bg-rose-950/20 dark:text-rose-400"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {places.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          {places.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              isFavorite={favorites.includes(place.id)}
              onFavorite={onToggleFavorite}
              onClick={() => navigate(`/place/${place.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <Clock size={40} className="text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">No recent views</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Places you view will appear here</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 rounded-full bg-slate-800 px-5 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-800"
          >
            Explore Map
          </button>
        </div>
      )}
    </div>
  );
}
