// Quiet Place Card Component
// 安静地点卡片组件

'use client';

import { motion } from 'framer-motion';
import { Coffee, BookOpen, Laptop, MapPin, Volume2, Footprints, TrainFront, Scale } from 'lucide-react';
import { QuietPlace } from '@/types/quietPlace';

// Icon mapping for different place types
// 不同地点类型的图标映射
const typeIcons = {
  Cafe: Coffee,
  Library: BookOpen,
  'Coworking Space': Laptop,
  'Public Study Area': MapPin,
};

// Color mapping for different place types
// 不同地点类型的颜色映射
const typeColors = {
  Cafe: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
  Library: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40',
  'Coworking Space': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/40',
  'Public Study Area': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40',
};

// Crowdedness color indicator
// 拥挤程度颜色指示器
const crowdednessColors = {
  low: 'bg-emerald-400',
  medium: 'bg-amber-400',
  high: 'bg-red-400',
};

/**
 * Estimate transit times based on distance
 * 根据距离估算交通时间
 */
function getTransitTimes(distanceKm: number) {
  const walkMin = Math.max(1, Math.round(distanceKm * 12));
  const subwayMin = Math.max(2, Math.round(distanceKm * 4 + 3));
  return { walkMin, subwayMin };
}

interface QuietPlaceCardProps {
  place: QuietPlace;
  isSelected: boolean;
  onClick: () => void;
  // Compare mode props
  isCompareMode?: boolean;
  isCompared?: boolean;
  onToggleCompare?: (e: React.MouseEvent) => void;
}

export default function QuietPlaceCard({
  place,
  isSelected,
  onClick,
  isCompareMode = false,
  isCompared = false,
  onToggleCompare,
}: QuietPlaceCardProps) {
  const Icon = typeIcons[place.type];
  const { walkMin, subwayMin } = getTransitTimes(place.distance);

  return (
    <motion.div
      // Animation on hover and selection
      // 悬停和选中时的动画
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-2xl border p-4 transition-shadow duration-300
        ${isSelected 
          ? 'border-sky-400 bg-sky-50/80 shadow-lg shadow-sky-100 ring-2 ring-sky-200 dark:border-sky-600 dark:bg-sky-950/20 dark:shadow-sky-900/20 dark:ring-sky-800' 
          : 'border-slate-200 bg-white/90 shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-800/90 dark:hover:shadow-slate-900/30'
        }
        ${isCompared ? 'ring-2 ring-amber-300 dark:ring-amber-700' : ''}
        backdrop-blur-sm
      `}
    >
      {/* Compare toggle button */}
      {isCompareMode && onToggleCompare && (
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onToggleCompare}
          className={`absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
            isCompared
              ? 'border-amber-300 bg-amber-500 text-white dark:border-amber-700 dark:bg-amber-600'
              : 'border-slate-200 bg-white text-slate-400 hover:border-amber-300 hover:text-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-amber-700 dark:hover:text-amber-400'
          }`}
          title={isCompared ? 'Remove from compare' : 'Add to compare'}
        >
          <Scale size={12} />
        </motion.button>
      )}

      {/* Status indicator dot */}
      {/* 状态指示点 */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${crowdednessColors[place.crowdedness]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {place.isOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="flex items-start gap-3">
        {/* Type icon badge */}
        {/* 类型图标徽章 */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${typeColors[place.type]}`}>
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Place name */}
          {/* 地点名称 */}
          <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {place.name}
          </h3>

          {/* Address */}
          {/* 地址 */}
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {place.address}
          </p>

          {/* Transit time estimates */}
          {/* 交通时间估算 */}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              <Footprints size={10} />
              ~{walkMin}m walk
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
              <TrainFront size={10} />
              ~{subwayMin}m subway
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            {/* Distance badge */}
            {/* 距离徽章 */}
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              <MapPin size={10} />
              {place.distance} km
            </span>

            {/* Quiet score badge */}
            {/* 安静分数徽章 */}
            <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
              <Volume2 size={10} />
              {place.quietScore}
            </span>

            {/* Type badge */}
            {/* 类型徽章 */}
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {place.type}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
