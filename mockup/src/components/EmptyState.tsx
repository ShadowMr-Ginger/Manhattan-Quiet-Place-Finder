// Empty State Component with fun animation
// 空状态组件 - 带有趣动画

'use client';

import { motion } from 'framer-motion';
import { Search, MapPin, Compass } from 'lucide-react';

interface EmptyStateProps {
  icon?: 'search' | 'map' | 'compass';
  title?: string;
  subtitle?: string;
}

const iconMap = {
  search: Search,
  map: MapPin,
  compass: Compass,
};

export default function EmptyState({
  icon = 'search',
  title = 'No places match your filters',
  subtitle = 'Try adjusting your search',
}: EmptyStateProps) {
  const Icon = iconMap[icon];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 20 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 py-12 dark:border-slate-700 dark:bg-slate-800/50"
    >
      {/* Animated icon container */}
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Floating rings */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-slate-200 dark:border-slate-700"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />
        {/* Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">
          <Icon size={20} className="text-slate-400 dark:text-slate-500" />
        </div>
      </motion.div>

      {/* Text */}
      <motion.p
        className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {title}
      </motion.p>
      <motion.p
        className="mt-1 text-[10px] text-slate-400 dark:text-slate-500"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {subtitle}
      </motion.p>

      {/* Suggestion chips */}
      <motion.div
        className="mt-3 flex gap-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {['Cafe', 'Library', 'Clear filters'].map((tag, i) => (
          <motion.span
            key={tag}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            {tag}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}
