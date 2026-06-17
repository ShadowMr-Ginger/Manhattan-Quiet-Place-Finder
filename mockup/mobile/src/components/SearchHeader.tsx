import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import WeatherWidget from './WeatherWidget';
import ThemeToggle from './ThemeToggle';
import type { PlaceType } from '../types/quietPlace';

interface SearchHeaderProps {
  value: string;
  onChange: (value: string) => void;
  selectedTypes: PlaceType[];
  onToggleType: (type: PlaceType) => void;
}

const allTypes: PlaceType[] = ['Cafe', 'Library', 'Coworking Space', 'Public Study Area'];

export default function SearchHeader({ value, onChange, selectedTypes, onToggleType }: SearchHeaderProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="absolute left-3 right-3 top-3 z-40 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/90">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search quiet places..."
            className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          {value && (
            <button onClick={() => onChange('')}>
              <X size={16} className="text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm backdrop-blur-md transition-colors ${
            showFilters || selectedTypes.length > 0
              ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400'
              : 'border-slate-200 bg-white/90 text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300'
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
        <WeatherWidget />
        <ThemeToggle />
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95">
          <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Place Type</p>
          <div className="flex flex-wrap gap-2">
            {allTypes.map((type) => (
              <button
                key={type}
                onClick={() => onToggleType(type)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedTypes.includes(type)
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
