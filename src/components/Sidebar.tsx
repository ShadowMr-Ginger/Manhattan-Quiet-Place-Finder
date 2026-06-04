// Sidebar Component - Left panel for search and filters
// 侧边栏组件 - 左侧搜索和过滤面板

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Search, Clock, History, X, Eye, Scale } from 'lucide-react';
import { QuietPlace, FilterOptions } from '@/types/quietPlace';
import SearchBar from './SearchBar';
import Filters from './Filters';
import QuietPlaceCard from './QuietPlaceCard';
import EmptyState from './EmptyState';

interface SidebarProps {
  // Search state / 搜索状态
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  // Filter state / 过滤状态
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  // Results / 结果
  places: QuietPlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (place: QuietPlace) => void;
  // Recent searches / 最近搜索
  recentSearches: string[];
  onRemoveSearch: (query: string) => void;
  onClearSearches: () => void;
  // Recently viewed / 最近浏览
  recentlyViewed: QuietPlace[];
  // Compare mode / 对比模式
  isCompareMode: boolean;
  compareIds: string[];
  onToggleCompare: (place: QuietPlace) => void;
  // Search ref / 搜索框引用
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

export default function Sidebar({
  searchQuery,
  onSearchChange,
  onSearch,
  filters,
  onFilterChange,
  places,
  selectedPlaceId,
  onSelectPlace,
  recentSearches,
  onRemoveSearch,
  onClearSearches,
  recentlyViewed,
  isCompareMode,
  compareIds,
  onToggleCompare,
  searchRef,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-slate-200 glass dark:border-slate-700/50">
      {/* Header */}
      {/* 头部 */}
      <div className="border-b border-slate-200/60 px-5 py-4 glass-subtle dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-400 shadow-sm">
              <Search size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">Quiet Places</h1>
              {/* 安静地点 */}
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Find your focus in Manhattan</p>
              {/* 在曼哈顿找到你的专注空间 */}
            </div>
          </div>
          {isCompareMode && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
            >
              <Scale size={10} className="inline mr-1" />
              {compareIds.length}/2
            </motion.span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      {/* 可滚动内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-5">
          {/* Search bar section */}
          {/* 搜索栏区域 */}
          <SearchBar
            ref={searchRef}
            value={searchQuery}
            onChange={onSearchChange}
            onSearch={onSearch}
          />

          {/* Recent searches / 最近搜索 */}
          <AnimatePresence>
            {recentSearches.length > 0 && !searchQuery && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <History size={11} />
                    Recent Searches
                  </div>
                  <button
                    onClick={onClearSearches}
                    className="text-[10px] text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map((query) => (
                    <motion.button
                      key={query}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="group flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition-colors hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-400"
                    >
                      <span
                        onClick={() => onSearchChange(query)}
                        className="cursor-pointer"
                      >
                        {query}
                      </span>
                      <X
                        size={10}
                        className="cursor-pointer text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSearch(query);
                        }}
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters section */}
          {/* 过滤器区域 */}
          <div className="rounded-2xl border border-slate-200/70 glass-card p-4 dark:border-slate-700/50">
            <Filters filters={filters} onChange={onFilterChange} />
          </div>

          {/* Results section */}
          {/* 结果区域 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Results ({places.length})
                {/* 结果 */}
              </h3>
              {places.length > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {places.length} places found
                  {/* 找到 {places.length} 个地点 */}
                </span>
              )}
            </div>

            {places.length === 0 ? (
              // Empty state / 空状态
              <EmptyState
                icon="search"
                title="No places match your filters"
                subtitle="Try adjusting your search or filters"
              />
            ) : (
              <div className="space-y-2.5">
                {places.map((place, index) => (
                  <motion.div
                    key={place.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <QuietPlaceCard
                      place={place}
                      isSelected={selectedPlaceId === place.id}
                      onClick={() => onSelectPlace(place)}
                      isCompareMode={isCompareMode}
                      isCompared={compareIds.includes(place.id)}
                      onToggleCompare={(e) => {
                        e.stopPropagation();
                        onToggleCompare(place);
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recently viewed / 最近浏览 */}
          <AnimatePresence>
            {recentlyViewed.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <Eye size={11} />
                  Recently Viewed
                </div>
                <div className="space-y-2">
                  {recentlyViewed.slice(0, 3).map((place) => (
                    <motion.button
                      key={place.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => onSelectPlace(place)}
                      className="flex w-full items-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-sky-900/20"
                    >
                      <Clock size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="truncate">{place.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-teal-600 dark:text-teal-400">
                        {place.quietScore}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer info */}
      {/* 底部信息 */}
      <div className="border-t border-slate-200/60 px-5 py-3 glass-subtle dark:border-slate-700/50">
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
          Manhattan Quiet Place Finder v1.0
          {/* 曼哈顿安静地点查找器 v1.0 */}
        </p>
      </div>
    </div>
  );
}
