import { useState, useMemo } from 'react';
import { Scale, X, MapPin, Clock, Users, Volume2, Star, Footprints, TrainFront } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockQuietPlaces } from '../data/mockQuietPlaces';
import { getTransitTimes, getTypeColor, getTypeLabel, formatRating } from '../lib/utils';
import type { QuietPlace } from '../types/quietPlace';

export default function CompareView() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const places = mockQuietPlaces.slice(0, 6);
  const selected = useMemo(() =>
    selectedIds.map((id) => mockQuietPlaces.find((p) => p.id === id)).filter(Boolean) as QuietPlace[],
    [selectedIds]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 pb-28 pt-6 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Compare</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">Select 2 places to compare</p>

      <div className="mt-4 flex flex-col gap-2">
        {places.map((place) => {
          const isSelected = selectedIds.includes(place.id);
          const disabled = !isSelected && selectedIds.length >= 2;
          return (
            <button
              key={place.id}
              disabled={disabled}
              onClick={() => toggle(place.id)}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                isSelected
                  ? 'border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/20'
                  : 'border-transparent bg-white shadow-sm dark:bg-slate-800'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getTypeColor(place.type)}`}>
                <span className="text-xs font-bold text-white">{place.quietScore}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{place.name}</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{getTypeLabel(place.type)} • {place.distance} km</p>
              </div>
              {isSelected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-white">
                  <span className="text-xs font-bold">{selectedIds.indexOf(place.id) === 0 ? 'A' : 'B'}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected.length === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 rounded-3xl bg-white p-4 shadow-lg dark:bg-slate-800"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                <Scale size={20} />
                <span className="text-sm font-bold">Comparison</span>
              </div>
              <button onClick={() => setSelectedIds([])} className="text-xs text-slate-400">
                <X size={18} />
              </button>
            </div>
            <CompareTable a={selected[0]} b={selected[1]} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompareTable({ a, b }: { a: QuietPlace; b: QuietPlace }) {
  const aTransit = getTransitTimes(a.distance);
  const bTransit = getTransitTimes(b.distance);
  const aOcc = Math.round((a.currentPeople / a.totalCapacity) * 100);
  const bOcc = Math.round((b.currentPeople / b.totalCapacity) * 100);

  const row = (label: string, icon: React.ReactNode, aValue: React.ReactNode, bValue: React.ReactNode, winner?: 'a' | 'b' | 'tie') => (
    <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 border-b border-slate-100 py-3 last:border-0 dark:border-slate-700">
      <div className="flex w-20 items-center gap-1.5 text-[10px] font-medium text-slate-400">
        {icon}
        {label}
      </div>
      <div className={`text-right text-xs font-bold ${winner === 'a' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-700 dark:text-slate-200'}`}>{aValue}</div>
      <div className={`text-right text-xs font-bold ${winner === 'b' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-700 dark:text-slate-200'}`}>{bValue}</div>
    </div>
  );

  const winnerText = (() => {
    const aWinsBoth = a.quietScore > b.quietScore && a.distance <= b.distance;
    const bWinsBoth = b.quietScore > a.quietScore && b.distance <= a.distance;
    if (aWinsBoth) return `${a.name} wins on both quietness and proximity!`;
    if (bWinsBoth) return `${b.name} wins on both quietness and proximity!`;
    if (a.quietScore >= b.quietScore) return `${a.name} is quieter, but ${b.name} is closer.`;
    return `${b.name} is quieter, but ${a.name} is closer.`;
  })();

  return (
    <div>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div />
        <div className="text-center text-xs font-bold text-slate-800 dark:text-slate-100">{a.name}</div>
        <div className="text-center text-xs font-bold text-slate-800 dark:text-slate-100">{b.name}</div>
      </div>

      {row('Quiet', <Volume2 size={12} />, a.quietScore, b.quietScore, a.quietScore > b.quietScore ? 'a' : b.quietScore > a.quietScore ? 'b' : 'tie')}
      {row('Distance', <MapPin size={12} />, `${a.distance} km`, `${b.distance} km`, a.distance < b.distance ? 'a' : b.distance < a.distance ? 'b' : 'tie')}
      {row('Walk', <Footprints size={12} />, `${aTransit.walkMin}m`, `${bTransit.walkMin}m`, aTransit.walkMin < bTransit.walkMin ? 'a' : bTransit.walkMin < aTransit.walkMin ? 'b' : 'tie')}
      {row('Subway', <TrainFront size={12} />, `${aTransit.subwayMin}m`, `${bTransit.subwayMin}m`, aTransit.subwayMin < bTransit.subwayMin ? 'a' : bTransit.subwayMin < aTransit.subwayMin ? 'b' : 'tie')}
      {row('Occupancy', <Users size={12} />, `${aOcc}%`, `${bOcc}%`, aOcc < bOcc ? 'a' : bOcc < aOcc ? 'b' : 'tie')}
      {row('Rating', <Star size={12} />, formatRating(a), formatRating(b), parseFloat(formatRating(a)) > parseFloat(formatRating(b)) ? 'a' : parseFloat(formatRating(b)) > parseFloat(formatRating(a)) ? 'b' : 'tie')}
      {row('Hours', <Clock size={12} />, a.hours, b.hours, 'tie')}

      <div className="mt-3 rounded-2xl bg-teal-50 p-3 text-center dark:bg-teal-950/20">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Recommendation</p>
        <p className="mt-1 text-xs font-bold text-teal-700 dark:text-teal-300">{winnerText}</p>
      </div>
    </div>
  );
}
