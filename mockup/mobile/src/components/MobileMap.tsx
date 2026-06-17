import { motion, AnimatePresence } from 'framer-motion';
import type { QuietPlace } from '../types/quietPlace';
import { latLngToPosition, getTypeColor } from '../lib/utils';

interface MobileMapProps {
  places: QuietPlace[];
  selectedId: string | null;
  onSelect: (place: QuietPlace) => void;
}

export default function MobileMap({ places, selectedId, onSelect }: MobileMapProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#e8e6e1] dark:bg-[#1a1917]">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="mobile-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1cfc9" strokeWidth="0.5" className="dark:stroke-[#333330]" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mobile-grid)" />
        </svg>
      </div>

      {/* Water */}
      <div className="absolute -left-4 top-0 h-full w-[15%] -skew-x-6 bg-[#b8d4e3] opacity-40 dark:bg-[#1e3a4d]" />
      <div className="absolute -right-2 bottom-0 h-[30%] w-[20%] skew-x-3 bg-[#b8d4e3] opacity-40 dark:bg-[#1e3a4d]" />

      {/* Central Park */}
      <div
        className="absolute rounded-xl bg-[#a8c9a0] opacity-60 dark:bg-[#2d4a2d]"
        style={{ left: '48%', top: '25%', width: '14%', height: '45%', transform: 'translate(-50%, 0)' }}
      />

      {/* Streets */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {['10%', '22%', '35%', '48%', '60%', '72%', '85%'].map((y, i) => (
          <line key={`h-${i}`} x1="0" y1={y} x2="100%" y2={y} stroke="#c4c2bc" strokeWidth="1.5" opacity="0.6" className="dark:stroke-[#3a3a37]" />
        ))}
        {['8%', '20%', '32%', '44%', '56%', '68%', '80%', '92%'].map((x, i) => (
          <line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100%" stroke="#c4c2bc" strokeWidth="1" opacity="0.4" className="dark:stroke-[#3a3a37]" />
        ))}
      </svg>

      {/* Heatmap blobs */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          {places.map((place, i) => {
            const opacity = 0.15 + (place.quietScore / 100) * 0.25;
            const color = place.quietScore >= 80 ? '14, 184, 166' : place.quietScore >= 60 ? '245, 158, 11' : '244, 63, 94';
            return (
              <radialGradient key={`grad-${i}`} id={`heat-mobile-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={`rgb(${color})`} stopOpacity={opacity} />
                <stop offset="60%" stopColor={`rgb(${color})`} stopOpacity={opacity * 0.5} />
                <stop offset="100%" stopColor={`rgb(${color})`} stopOpacity="0" />
              </radialGradient>
            );
          })}
        </defs>
        {places.map((place, i) => {
          const pos = latLngToPosition(place.lat, place.lng);
          const radius = 6 + (place.quietScore / 100) * 10;
          return (
            <circle
              key={`heat-blob-${i}`}
              cx={`${pos.x}%`}
              cy={`${pos.y}%`}
              r={`${radius}%`}
              fill={`url(#heat-mobile-${i})`}
            />
          );
        })}
      </svg>

      {/* Location label */}
      <div className="absolute left-3 top-3 rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur-sm dark:bg-slate-800/80 dark:text-slate-300">
        Manhattan, New York
      </div>

      {/* Markers */}
      {places.map((place) => {
        const pos = latLngToPosition(place.lat, place.lng);
        const isSelected = selectedId === place.id;
        const colorClass = getTypeColor(place.type);
        return (
          <motion.button
            key={place.id}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(place)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className={`absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full ${colorClass}`}
                />
              )}
            </AnimatePresence>
            <div
              className={`relative flex h-9 w-9 items-center justify-center rounded-full shadow-lg ${colorClass} ${
                isSelected ? 'ring-[3px] ring-white/70 dark:ring-slate-300/50' : ''
              }`}
            >
              <span className="text-xs font-bold text-white">{place.quietScore}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
