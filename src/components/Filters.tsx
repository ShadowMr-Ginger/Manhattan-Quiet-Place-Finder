// Filters Component
// 过滤器组件

'use client';

import { motion } from 'framer-motion';
import { Coffee, BookOpen, Laptop, MapPin, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { PlaceType, FilterOptions } from '@/types/quietPlace';

// All available place types with their icons
// 所有可用的地点类型及其图标
const placeTypeOptions: { type: PlaceType; icon: React.ElementType; label: string }[] = [
  { type: 'Cafe', icon: Coffee, label: 'Cafe' },
  { type: 'Library', icon: BookOpen, label: 'Library' },
  { type: 'Coworking Space', icon: Laptop, label: 'Coworking' },
  { type: 'Public Study Area', icon: MapPin, label: 'Public' },
];

interface FiltersProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
}

export default function Filters({ filters, onChange }: FiltersProps) {
  // Toggle place type selection
  // 切换地点类型选择
  const toggleType = (type: PlaceType) => {
    const newTypes = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type];
    onChange({ ...filters, types: newTypes });
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      {/* 区域标题 */}
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <SlidersHorizontal size={16} />
        <h3 className="text-sm font-semibold">Filters</h3>
        {/* 筛选条件 */}
      </div>

      {/* Place Type Filter - Modern chip UI */}
      {/* 地点类型过滤器 - 现代芯片式 UI */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Place Type</p>
        {/* 地点类型 */}
        <div className="flex flex-wrap gap-2">
          {placeTypeOptions.map(({ type, icon: Icon, label }) => {
            const isSelected = filters.types.includes(type);
            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleType(type)}
                className={`
                  flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200
                  ${isSelected
                    ? 'border-sky-300 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                  }
                `}
              >
                <Icon size={12} />
                {label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Quiet Score Filter - Slider */}
      {/* 安静分数过滤器 - 滑块 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Min Quiet Score</p>
          {/* 最低安静分数 */}
          <span className="rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
            {filters.minQuietScore}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={filters.minQuietScore}
          onChange={(e) =>
            onChange({ ...filters, minQuietScore: Number(e.target.value) })
          }
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-teal-500 outline-none dark:bg-slate-700"
        />
        <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Sort Options */}
      {/* 排序选项 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sort By</p>
        {/* 排序方式 */}
        <div className="flex gap-2">
          {(['distance', 'quietScore'] as const).map((sort) => (
            <motion.button
              key={sort}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange({ ...filters, sortBy: sort })}
              className={`
                flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-200
                ${filters.sortBy === sort
                  ? 'border-sky-300 bg-sky-50 text-sky-700 shadow-sm dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-400'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                }
              `}
            >
              <ArrowUpDown size={12} />
              {sort === 'distance' ? 'Distance' : 'Quiet Score'}
              {/* 距离 / 安静分数 */}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
