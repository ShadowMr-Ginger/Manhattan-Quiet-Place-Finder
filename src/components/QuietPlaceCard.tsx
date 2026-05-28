// Quiet Place Card Component
// 安静地点卡片组件

'use client';

import { motion } from 'framer-motion';
import { Coffee, BookOpen, Laptop, MapPin, Volume2 } from 'lucide-react';
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
  Cafe: 'bg-amber-100 text-amber-700 border-amber-200',
  Library: 'bg-blue-100 text-blue-700 border-blue-200',
  'Coworking Space': 'bg-purple-100 text-purple-700 border-purple-200',
  'Public Study Area': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// Crowdedness color indicator
// 拥挤程度颜色指示器
const crowdednessColors = {
  low: 'bg-emerald-400',
  medium: 'bg-amber-400',
  high: 'bg-red-400',
};

interface QuietPlaceCardProps {
  place: QuietPlace;
  isSelected: boolean;
  onClick: () => void;
}

export default function QuietPlaceCard({ place, isSelected, onClick }: QuietPlaceCardProps) {
  const Icon = typeIcons[place.type];

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
          ? 'border-sky-400 bg-sky-50/80 shadow-lg shadow-sky-100 ring-2 ring-sky-200' 
          : 'border-slate-200 bg-white/90 shadow-sm hover:shadow-md'
        }
        backdrop-blur-sm
      `}
    >
      {/* Status indicator dot */}
      {/* 状态指示点 */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${crowdednessColors[place.crowdedness]}`} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
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
          <h3 className="truncate text-sm font-semibold text-slate-800">
            {place.name}
          </h3>

          {/* Address */}
          {/* 地址 */}
          <p className="mt-0.5 text-xs text-slate-500">
            {place.address}
          </p>

          <div className="mt-2 flex items-center gap-3">
            {/* Distance badge */}
            {/* 距离徽章 */}
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <MapPin size={10} />
              {place.distance} km
            </span>

            {/* Quiet score badge */}
            {/* 安静分数徽章 */}
            <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
              <Volume2 size={10} />
              {place.quietScore}
            </span>

            {/* Type badge */}
            {/* 类型徽章 */}
            <span className="text-[11px] font-medium text-slate-400">
              {place.type}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
