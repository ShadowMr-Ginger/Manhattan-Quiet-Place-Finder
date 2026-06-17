import { Heart, MapPin, Footprints, TrainFront, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import type { QuietPlace } from '../types/quietPlace';
import { getTransitTimes, getCrowdednessText, getCrowdednessColor, getTypeColor, getTypeLabel, formatRating } from '../lib/utils';

interface PlaceCardProps {
  place: QuietPlace;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  onClick: () => void;
  compact?: boolean;
}

export default function PlaceCard({ place, isFavorite, onFavorite, onClick, compact = false }: PlaceCardProps) {
  const { walkMin, subwayMin } = getTransitTimes(place.distance);
  const occupancy = Math.round((place.currentPeople / place.totalCapacity) * 100);
  const typeColor = getTypeColor(place.type);
  const crowdedClass = getCrowdednessColor(place.crowdedness);

  if (compact) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm dark:bg-slate-800"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeColor}`}>
          <span className="text-xs font-bold text-white">{place.quietScore}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{place.name}</h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{getTypeLabel(place.type)} • {place.distance} km</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(place.id); }}
          className="rounded-full p-2 text-slate-400 transition-colors active:bg-slate-100 dark:active:bg-slate-700"
        >
          <Heart size={18} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
        </button>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white ${typeColor}`}>
              {getTypeLabel(place.type)}
            </span>
            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${crowdedClass}`}>
              {getCrowdednessText(place.crowdedness)}
            </span>
          </div>
          <h3 className="mt-1.5 text-base font-bold text-slate-800 dark:text-slate-100">{place.name}</h3>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <MapPin size={11} />
            <span className="truncate">{place.address}</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(place.id); }}
          className="rounded-full p-2 text-slate-400 transition-colors active:bg-slate-100 dark:active:bg-slate-700"
        >
          <Heart size={20} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/20">
          <span className="text-base font-extrabold text-teal-700 dark:text-teal-300">{place.quietScore}</span>
          <span className="text-[8px] text-teal-600 dark:text-teal-400">Quiet</span>
        </div>
        <div className="flex flex-1 justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex flex-col items-center gap-0.5">
            <Footprints size={14} className="text-slate-400" />
            <span>{walkMin}m</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <TrainFront size={14} className="text-slate-400" />
            <span>{subwayMin}m</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-medium">{occupancy}%</span>
            <span>Full</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-0.5">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="font-medium">{formatRating(place)}</span>
            </div>
            <span>Rating</span>
          </div>
        </div>
      </div>

      {place.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {place.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  );
}
