// Skeleton Loading Components
// 骨架屏加载组件

'use client';

import { motion } from 'framer-motion';

// Single shimmer animation block
function ShimmerBlock({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`}>
      <motion.div
        className="absolute inset-0 -translate-x-full"
        animate={{ translateX: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/10" />
      </motion.div>
    </div>
  );
}

// Skeleton place card
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
      <div className="flex items-start gap-3">
        <ShimmerBlock className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBlock className="h-4 w-3/4" />
          <ShimmerBlock className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <ShimmerBlock className="h-5 w-16" />
            <ShimmerBlock className="h-5 w-14" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton map
export function SkeletonMap() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="skeleton-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#skeleton-grid)" />
        </svg>
      </div>
      {/* Shimmer overlay */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="h-full w-full bg-gradient-to-br from-slate-300/50 via-transparent to-slate-300/50 dark:from-slate-600/30 dark:to-slate-600/30" />
      </motion.div>
      {/* Fake map elements */}
      <div className="absolute left-1/4 top-1/3 h-20 w-16 rounded-lg bg-slate-300/50 dark:bg-slate-700/50" />
      <div className="absolute right-1/3 top-1/2 h-14 w-20 rounded-lg bg-slate-300/50 dark:bg-slate-700/50" />
      <div className="absolute bottom-1/4 left-1/3 h-16 w-12 rounded-lg bg-slate-300/50 dark:bg-slate-700/50" />
      {/* Loading text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-300/50 bg-white/80 px-5 py-3 shadow-lg backdrop-blur-sm dark:border-slate-600/50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <motion.div
              className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-sky-500 dark:border-slate-600 dark:border-t-sky-400"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading map...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton chat panel
export function SkeletonChat() {
  return (
    <div className="flex h-full flex-col bg-white/80 backdrop-blur-md dark:bg-slate-900/80">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <ShimmerBlock className="h-7 w-7 rounded-full" />
        <div className="space-y-1">
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="h-2 w-28" />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-hidden px-4 py-4">
        <div className="flex gap-2">
          <ShimmerBlock className="h-7 w-7 rounded-full" />
          <ShimmerBlock className="h-16 w-48 rounded-2xl rounded-tl-sm" />
        </div>
        <div className="flex flex-row-reverse gap-2">
          <ShimmerBlock className="h-7 w-7 rounded-full" />
          <ShimmerBlock className="h-10 w-32 rounded-2xl rounded-tr-sm" />
        </div>
      </div>
      <div className="border-t border-slate-100 p-3 dark:border-slate-700">
        <ShimmerBlock className="h-10 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// Full page skeleton layout
export default function SkeletonLoader() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Header skeleton */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-8 w-8 rounded-xl" />
          <div className="space-y-1">
            <ShimmerBlock className="h-3.5 w-28" />
            <ShimmerBlock className="h-2.5 w-16" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-8 w-20 rounded-full" />
          <ShimmerBlock className="h-8 w-8 rounded-xl" />
          <ShimmerBlock className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Three columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-[28%] min-w-[280px] max-w-[380px] shrink-0 space-y-4 border-r border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/80">
          <ShimmerBlock className="h-12 w-full rounded-2xl" />
          <ShimmerBlock className="h-48 w-full rounded-2xl" />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Center map */}
        <div className="relative flex-1 border-x border-slate-200 dark:border-slate-700">
          <SkeletonMap />
        </div>

        {/* Right panel */}
        <div className="w-[28%] min-w-[280px] max-w-[380px] shrink-0">
          <SkeletonChat />
        </div>
      </div>
    </div>
  );
}
