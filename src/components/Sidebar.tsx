// Sidebar Component - Left panel for search and filters
// 侧边栏组件 - 左侧搜索和过滤面板

'use client';

import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { QuietPlace, FilterOptions } from '@/types/quietPlace';
import SearchBar from './SearchBar';
import Filters from './Filters';
import QuietPlaceCard from './QuietPlaceCard';

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
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-slate-50/80 backdrop-blur-md">
      {/* Header */}
      {/* 头部 */}
      <div className="border-b border-slate-200 bg-white/60 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-400 shadow-sm">
            <Search size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Quiet Places</h1>
            {/* 安静地点 */}
            <p className="text-[10px] text-slate-500">Find your focus in Manhattan</p>
            {/* 在曼哈顿找到你的专注空间 */}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      {/* 可滚动内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-5">
          {/* Search bar section */}
          {/* 搜索栏区域 */}
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            onSearch={onSearch}
          />

          {/* Filters section */}
          {/* 过滤器区域 */}
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            <Filters filters={filters} onChange={onFilterChange} />
          </div>

          {/* Results section */}
          {/* 结果区域 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-500">
                Results ({places.length})
                {/* 结果 */}
              </h3>
              {places.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {places.length} places found
                  {/* 找到 {places.length} 个地点 */}
                </span>
              )}
            </div>

            {places.length === 0 ? (
              // Empty state / 空状态
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 py-10"
              >
                <SlidersHorizontal size={24} className="text-slate-300" />
                <p className="mt-2 text-xs text-slate-400">No places match your filters</p>
                {/* 没有符合筛选条件的地点 */}
                <p className="text-[10px] text-slate-300">Try adjusting your search</p>
                {/* 尝试调整搜索条件 */}
              </motion.div>
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
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer info */}
      {/* 底部信息 */}
      <div className="border-t border-slate-200 bg-white/60 px-5 py-3">
        <p className="text-center text-[10px] text-slate-400">
          Manhattan Quiet Place Finder v1.0
          {/* 曼哈顿安静地点查找器 v1.0 */}
        </p>
      </div>
    </div>
  );
}
