// Compare Panel - Side-by-side place comparison
// 对比面板 - 并排地点对比

'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Coffee,
  BookOpen,
  Laptop,
  X,
  Star,
  Check,
} from 'lucide-react';
import { QuietPlace } from '@/types/quietPlace';

const typeIcons = {
  Cafe: Coffee,
  Library: BookOpen,
  'Coworking Space': Laptop,
  'Public Study Area': MapPin,
};

const crowdednessInfo = {
  low: { text: 'Not Crowded', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' },
  medium: { text: 'Moderately Busy', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  high: { text: 'Very Crowded', color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30' },
};

function getTransitTimes(distanceKm: number) {
  const walkMin = Math.max(1, Math.round(distanceKm * 12));
  const subwayMin = Math.max(2, Math.round(distanceKm * 4 + 3));
  const driveMin = Math.max(1, Math.round(distanceKm * 3 + 2));
  return { walkMin, subwayMin, driveMin };
}

const tagColors = [
  'bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400',
  'bg-violet-50 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400',
  'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400',
  'bg-pink-50 text-pink-700 dark:bg-pink-950/20 dark:text-pink-400',
  'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400',
];

interface ComparePanelProps {
  places: QuietPlace[];
  onBack: () => void;
  onRemovePlace: (id: string) => void;
}

export default function ComparePanel({ places, onBack, onRemovePlace }: ComparePanelProps) {
  if (places.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex h-full flex-col items-center justify-center bg-white/90 px-6 backdrop-blur-md dark:bg-slate-900/90"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Check size={20} className="text-slate-400 dark:text-slate-500" />
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">
          Select 2 places to compare
        </p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          Click the compare icon on any place card
        </p>
      </motion.div>
    );
  }

  if (places.length === 1) {
    const place = places[0];
    const Icon = typeIcons[place.type] || MapPin;
    const crowdedness = crowdednessInfo[place.crowdedness];
    const { walkMin, subwayMin, driveMin } = getTransitTimes(place.distance);
    const occupancyPercent = Math.round((place.currentPeople / place.totalCapacity) * 100);

    return (
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex h-full flex-col bg-white/90 backdrop-blur-md dark:bg-slate-900/90"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <ArrowLeft size={14} />
          </motion.button>
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Compare Places</h3>
          <span className="ml-auto rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
            1 / 2
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {/* Place A full card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                    <span className="text-xs font-bold">A</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{place.name}</h4>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <Icon size={10} />
                      {place.type}
                    </div>
                  </div>
                </div>
                <button onClick={() => onRemovePlace(place.id)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X size={12} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-teal-50 p-2 text-center dark:bg-teal-950/20">
                  <p className="text-lg font-extrabold text-teal-700 dark:text-teal-300">{place.quietScore}</p>
                  <p className="text-[9px] text-teal-600 dark:text-teal-400">Quiet Score</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800">
                  <p className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{place.distance} km</p>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">Distance</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {place.tags.slice(0, 3).map((tag, i) => (
                  <span key={tag} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${tagColors[i % tagColors.length]}`}>{tag}</span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                <div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{walkMin}m</p><p className="text-[8px] text-slate-400">Walk</p></div>
                <div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{subwayMin}m</p><p className="text-[8px] text-slate-400">Subway</p></div>
                <div><p className="text-xs font-bold text-slate-700 dark:text-slate-200">{driveMin}m</p><p className="text-[8px] text-slate-400">Drive</p></div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className={`rounded-lg px-2 py-0.5 font-bold ${crowdedness.color}`}>{crowdedness.text}</span>
                <span className="text-slate-400 dark:text-slate-500">{place.currentPeople}/{place.totalCapacity} people</span>
              </div>
            </div>

            {/* Waiting for B */}
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-8 dark:border-slate-700">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500">B</span>
              </div>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Select another place</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600">to start comparing</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Two places comparison
  const [placeA, placeB] = places;
  const IconA = typeIcons[placeA.type] || MapPin;
  const IconB = typeIcons[placeB.type] || MapPin;
  const crowdA = crowdednessInfo[placeA.crowdedness];
  const crowdB = crowdednessInfo[placeB.crowdedness];
  const transitA = getTransitTimes(placeA.distance);
  const transitB = getTransitTimes(placeB.distance);
  const occA = Math.round((placeA.currentPeople / placeA.totalCapacity) * 100);
  const occB = Math.round((placeB.currentPeople / placeB.totalCapacity) * 100);

  const renderRow = (label: string, valueA: React.ReactNode, valueB: React.ReactNode, highlight?: 'left' | 'right' | 'none') => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
      <div className={`text-right text-[11px] ${highlight === 'left' ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>{valueA}</div>
      <div className="w-16 text-center text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className={`text-left text-[11px] ${highlight === 'right' ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>{valueB}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex h-full flex-col bg-white/90 backdrop-blur-md dark:bg-slate-900/90"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <ArrowLeft size={14} />
        </motion.button>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Compare Places</h3>
        <button onClick={() => { onRemovePlace(placeA.id); onRemovePlace(placeB.id); }} className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {/* Place headers */}
          <div className="grid grid-cols-2 gap-3">
            {/* Place A */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                  <span className="text-xs font-bold">A</span>
                </div>
                <button onClick={() => onRemovePlace(placeA.id)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X size={12} />
                </button>
              </div>
              <h4 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-100">{placeA.name}</h4>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <IconA size={10} />
                {placeA.type}
              </div>
            </div>

            {/* Place B */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  <span className="text-xs font-bold">B</span>
                </div>
                <button onClick={() => onRemovePlace(placeB.id)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X size={12} />
                </button>
              </div>
              <h4 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-100">{placeB.name}</h4>
              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                <IconB size={10} />
                {placeB.type}
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {/* Quiet Score */}
            {renderRow('Quiet Score',
              <span className="text-sm font-extrabold">{placeA.quietScore}</span>,
              <span className="text-sm font-extrabold">{placeB.quietScore}</span>,
              placeA.quietScore > placeB.quietScore ? 'left' : placeB.quietScore > placeA.quietScore ? 'right' : 'none'
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Distance */}
            {renderRow('Distance',
              `${placeA.distance} km`,
              `${placeB.distance} km`,
              placeA.distance < placeB.distance ? 'left' : placeB.distance < placeA.distance ? 'right' : 'none'
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Walk time */}
            {renderRow('Walk',
              `${transitA.walkMin} min`,
              `${transitB.walkMin} min`,
              transitA.walkMin < transitB.walkMin ? 'left' : transitB.walkMin < transitA.walkMin ? 'right' : 'none'
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Subway time */}
            {renderRow('Subway',
              `${transitA.subwayMin} min`,
              `${transitB.subwayMin} min`,
              transitA.subwayMin < transitB.subwayMin ? 'left' : transitB.subwayMin < transitA.subwayMin ? 'right' : 'none'
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Occupancy */}
            {renderRow('Occupancy',
              `${occA}%`,
              `${occB}%`,
              occA < occB ? 'left' : occB < occA ? 'right' : 'none'
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Crowdedness */}
            {renderRow('Status',
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${crowdA.color}`}>{crowdA.text}</span>,
              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${crowdB.color}`}>{crowdB.text}</span>,
              placeA.crowdedness === 'low' && placeB.crowdedness !== 'low' ? 'left' :
              placeB.crowdedness === 'low' && placeA.crowdedness !== 'low' ? 'right' : 'none'
            )}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Hours */}
            {renderRow('Hours', placeA.hours, placeB.hours, 'none')}
            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Rating */}
            {renderRow('Avg Rating',
              <span className="flex items-center gap-0.5">{(placeA.reviews.reduce((s, r) => s + r.rating, 0) / placeA.reviews.length).toFixed(1)} <Star size={9} className="fill-amber-400 text-amber-400" /></span>,
              <span className="flex items-center gap-0.5">{(placeB.reviews.reduce((s, r) => s + r.rating, 0) / placeB.reviews.length).toFixed(1)} <Star size={9} className="fill-amber-400 text-amber-400" /></span>,
              'none'
            )}
          </div>

          {/* Tags comparison */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tags</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-wrap gap-1">
                {placeA.tags.map((tag, i) => (
                  <span key={tag} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${tagColors[i % tagColors.length]}`}>{tag}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {placeB.tags.map((tag, i) => (
                  <span key={tag} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${tagColors[i % tagColors.length]}`}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Winner badge */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-3 text-center dark:border-teal-900/30 dark:from-teal-950/20 dark:to-emerald-950/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">Recommendation</p>
            <p className="mt-1 text-xs font-bold text-teal-700 dark:text-teal-300">
              {(() => {
                const aWinsBoth = placeA.quietScore > placeB.quietScore && placeA.distance <= placeB.distance;
                const bWinsBoth = placeB.quietScore > placeA.quietScore && placeB.distance <= placeA.distance;
                if (aWinsBoth) return `${placeA.name} wins on both quietness & proximity!`;
                if (bWinsBoth) return `${placeB.name} wins on both quietness & proximity!`;
                if (placeA.quietScore >= placeB.quietScore) return `${placeA.name} is quieter, but ${placeB.name} is closer.`;
                return `${placeB.name} is quieter, but ${placeA.name} is closer.`;
              })()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
