// Place Detail Panel Component
// 地点详情面板组件

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Volume2,
  Users,
  Gauge,
  Coffee,
  BookOpen,
  Laptop,
  Heart,
  Bookmark,
  Clock,
  ExternalLink,
  Footprints,
  TrainFront,
  Car,
  Star,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';
import { QuietPlace } from '@/types/quietPlace';
import QuietScoreChart from './QuietScoreChart';

// Icon mapping for place types
// 地点类型的图标映射
const typeIcons = {
  Cafe: Coffee,
  Library: BookOpen,
  'Coworking Space': Laptop,
  'Public Study Area': MapPin,
};

// Type color mapping
// 类型颜色映射
const typeColors = {
  Cafe: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
  Library: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40',
  'Coworking Space': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/40',
  'Public Study Area': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40',
};

// Crowdedness text and color
// 拥挤程度文本和颜色
const crowdednessInfo = {
  low: { text: 'Not Crowded', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' },
  medium: { text: 'Moderately Busy', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  high: { text: 'Very Crowded', color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30' },
};

/**
 * Estimate transit times based on distance
 * 根据距离估算交通时间
 */
function getTransitTimes(distanceKm: number) {
  const walkMin = Math.max(1, Math.round(distanceKm * 12));
  const subwayMin = Math.max(2, Math.round(distanceKm * 4 + 3));
  const driveMin = Math.max(1, Math.round(distanceKm * 3 + 2));
  return { walkMin, subwayMin, driveMin };
}

// Tag color mapping
// 标签颜色映射
const tagColors = [
  'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30',
  'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/30',
  'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30',
  'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/30',
  'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30',
  'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/20 dark:text-lime-400 dark:border-lime-900/30',
];

interface PlaceDetailPanelProps {
  place: QuietPlace;
  onBack: () => void;
  isFavorite: boolean;
  isSaved: boolean;
  onToggleFavorite: () => void;
  onToggleSaved: () => void;
}

export default function PlaceDetailPanel({
  place,
  onBack,
  isFavorite,
  isSaved,
  onToggleFavorite,
  onToggleSaved,
}: PlaceDetailPanelProps) {
  const Icon = typeIcons[place.type];
  const crowdedness = crowdednessInfo[place.crowdedness];
  const occupancyPercent = Math.round((place.currentPeople / place.totalCapacity) * 100);
  const { walkMin, subwayMin, driveMin } = getTransitTimes(place.distance);

  // Photo carousel state
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = place.photos && place.photos.length > 0 ? place.photos : [];
  const [imgDirection, setImgDirection] = useState(1);
  // Heartbeat animation trigger
  const [heartBeat, setHeartBeat] = useState(false);

  const handleDirections = () => {
    const query = encodeURIComponent(`${place.name}, ${place.address}, New York, NY ${place.zipCode}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const nextPhoto = () => {
    setImgDirection(1);
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setImgDirection(-1);
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleFavoriteClick = () => {
    setHeartBeat(true);
    onToggleFavorite();
    setTimeout(() => setHeartBeat(false), 500);
  };

  // Review stars
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={10}
        className={i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-600'}
      />
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex h-full flex-col glass dark:bg-slate-900/70"
    >
      {/* Header with back button */}
      {/* 带返回按钮的头部 */}
      <div className="flex items-center gap-3 border-b border-slate-100/50 px-4 py-3 glass-subtle dark:border-slate-700/50">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <ArrowLeft size={14} />
        </motion.button>
        <div>
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">Place Details</h3>
          {/* 地点详情 */}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleFavoriteClick}
            className={`ripple-container flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
              isFavorite
                ? 'border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400'
                : 'border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-rose-950/20 dark:hover:text-rose-400'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              size={14}
              fill={isFavorite ? 'currentColor' : 'none'}
              className={heartBeat ? 'animate-heartbeat' : ''}
            />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onToggleSaved}
            className={`ripple-container flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
              isSaved
                ? 'border-amber-200 bg-amber-50 text-amber-500 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400'
                : 'border-slate-200 bg-white text-slate-400 hover:bg-amber-50 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-amber-950/20 dark:hover:text-amber-400'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save for later'}
          >
            <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
          </motion.button>
        </div>
      </div>

      {/* Scrollable content */}
      {/* 可滚动内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {/* Photo carousel */}
          {/* 照片轮播 */}
          {photos.length > 0 ? (
            <div className="relative overflow-hidden rounded-2xl shadow-inner">
              <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-800">
                <AnimatePresence initial={false} custom={imgDirection} mode="popLayout">
                  <motion.img
                    key={photoIndex}
                    src={photos[photoIndex]}
                    alt={`${place.name} photo ${photoIndex + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    custom={imgDirection}
                    initial={{ x: imgDirection * 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: imgDirection * -300, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </AnimatePresence>

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Navigation arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full glass-card text-slate-700 shadow-sm transition-colors hover:bg-white dark:text-slate-200"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={nextPhoto}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full glass-card text-slate-700 shadow-sm transition-colors hover:bg-white dark:text-slate-200"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Dots indicator */}
                {photos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setImgDirection(idx > photoIndex ? 1 : -1);
                          setPhotoIndex(idx);
                        }}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === photoIndex
                            ? 'w-4 bg-white'
                            : 'w-1.5 bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Type badge overlay */}
              <div className="absolute left-3 top-3">
                <span className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${typeColors[place.type]}`}>
                  <Icon size={10} />
                  {place.type}
                </span>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner dark:from-slate-800 dark:to-slate-700">
              <div className="flex aspect-[16/10] flex-col items-center justify-center">
                <MapPin size={32} className="text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">No photos available</p>
              </div>
              <div className="absolute left-3 top-3">
                <span className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${typeColors[place.type]}`}>
                  <Icon size={10} />
                  {place.type}
                </span>
              </div>
            </div>
          )}

          {/* Basic info */}
          {/* 基本信息 */}
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{place.name}</h2>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <MapPin size={12} className="shrink-0" />
              {place.address}, NY {place.zipCode}
            </div>
          </div>

          {/* Tags cloud */}
          {/* 标签云 */}
          {place.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {place.tags.map((tag, idx) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`rounded-lg border px-2 py-1 text-[10px] font-medium ${tagColors[idx % tagColors.length]}`}
                >
                  {tag}
                </motion.span>
              ))}
            </div>
          )}

          {/* Directions button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDirections}
            className="ripple-container flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-xs font-semibold text-sky-600 transition-colors hover:bg-sky-100 dark:border-sky-900/30 dark:bg-sky-950/20 dark:text-sky-400 dark:hover:bg-sky-900/30"
          >
            <ExternalLink size={12} />
            Get Directions on Google Maps
          </motion.button>

          {/* Transit time estimates */}
          {/* 交通时间估算 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100/70 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <Footprints size={14} className="text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{walkMin}m</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">Walking</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100/70 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <TrainFront size={14} className="text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{subwayMin}m</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">Subway</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-100/70 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <Car size={14} className="text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{driveMin}m</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">Driving</span>
            </div>
          </div>

          {/* Quiet score big display */}
          {/* 安静分数大显示 */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 shadow-sm dark:border-teal-900/30 dark:from-teal-950/30 dark:to-emerald-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                  Current Quiet Score
                  {/* 当前安静分数 */}
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-teal-700 dark:text-teal-300">
                    {place.quietScore}
                  </span>
                  <span className="text-xs text-teal-500 dark:text-teal-500">/ 100</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-slate-900/40">
                <Volume2 size={20} className="text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </div>

          {/* Hours info */}
          {/* 开放时间信息 */}
          <div className="rounded-2xl border border-slate-100/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock size={12} />
              <span className="text-[10px] font-semibold uppercase">Hours</span>
              {/* 营业时间 */}
            </div>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
              {place.hours}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
              {place.isOpen ? 'Open now' : 'Currently closed'}
              {/* 现在营业 / 目前已关闭 */}
            </p>
          </div>

          {/* Occupancy info */}
          {/*  occupancy 信息 */}
          <div className="grid grid-cols-2 gap-3">
            {/* People count */}
            {/* 人数 */}
            <div className="rounded-2xl border border-slate-100/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Users size={12} />
                <span className="text-[10px] font-semibold uppercase">Occupancy</span>
                {/*  occupancy */}
              </div>
              <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
                {place.currentPeople} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ {place.totalCapacity}</span>
              </p>
              {/* Progress bar */}
              {/* 进度条 */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${occupancyPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    occupancyPercent > 75 ? 'bg-rose-400' : occupancyPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
              </div>
            </div>

            {/* Crowdedness status */}
            {/* 拥挤状态 */}
            <div className="rounded-2xl border border-slate-100/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Gauge size={12} />
                <span className="text-[10px] font-semibold uppercase">Status</span>
                {/* 状态 */}
              </div>
              <p className={`mt-2 inline-block rounded-lg px-2 py-1 text-[10px] font-bold ${crowdedness.color}`}>
                {crowdedness.text}
              </p>
              <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                {place.isOpen ? 'Open now' : 'Closed'}
                {/* 现在营业 / 已关闭 */}
              </p>
            </div>
          </div>

          {/* Prediction chart */}
          {/* 预测图表 */}
          <QuietScoreChart predictions={place.predictions} />

          {/* Reviews section */}
          {/* 评论区域 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-slate-500 dark:text-slate-400" />
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Reviews ({place.reviews.length})
              </h4>
            </div>

            <div className="space-y-2.5">
              {place.reviews.map((review, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="rounded-2xl border border-slate-100/70 bg-white/80 p-3 shadow-sm backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-100 to-teal-100 text-[10px] font-bold text-sky-600 dark:from-sky-900/30 dark:to-teal-900/20 dark:text-sky-400">
                        {review.author.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {review.author}
                        </p>
                        <div className="flex items-center gap-0.5">
                          {renderStars(review.rating)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">{review.date}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {review.comment}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <ThumbsUp size={10} className="text-slate-300 dark:text-slate-600" />
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">Helpful</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
