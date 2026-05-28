// Place Detail Panel Component
// 地点详情面板组件

'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Volume2,
  Users,
  Gauge,
  Coffee,
  BookOpen,
  Laptop,
  Image as ImageIcon,
  Heart,
  Clock,
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
  Cafe: 'bg-amber-50 text-amber-700 border-amber-200',
  Library: 'bg-blue-50 text-blue-700 border-blue-200',
  'Coworking Space': 'bg-purple-50 text-purple-700 border-purple-200',
  'Public Study Area': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Crowdedness text and color
// 拥挤程度文本和颜色
const crowdednessInfo = {
  low: { text: 'Not Crowded', color: 'text-emerald-600 bg-emerald-50' },
  medium: { text: 'Moderately Busy', color: 'text-amber-600 bg-amber-50' },
  high: { text: 'Very Crowded', color: 'text-rose-600 bg-rose-50' },
};

interface PlaceDetailPanelProps {
  place: QuietPlace;
  onBack: () => void;
}

export default function PlaceDetailPanel({ place, onBack }: PlaceDetailPanelProps) {
  const Icon = typeIcons[place.type];
  const crowdedness = crowdednessInfo[place.crowdedness];
  const occupancyPercent = Math.round((place.currentPeople / place.totalCapacity) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex h-full flex-col bg-white/90 backdrop-blur-md"
    >
      {/* Header with back button */}
      {/* 带返回按钮的头部 */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white/60 px-4 py-3 backdrop-blur-sm">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <ArrowLeft size={14} />
        </motion.button>
        <div>
          <h3 className="text-xs font-semibold text-slate-700">Place Details</h3>
          {/* 地点详情 */}
        </div>
        <button className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100">
          <Heart size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      {/* 可滚动内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {/* Photo placeholder */}
          {/* 照片占位区 */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner">
            <div className="flex aspect-[16/10] flex-col items-center justify-center">
              <ImageIcon size={32} className="text-slate-300" />
              <p className="mt-2 text-[10px] text-slate-400">Photo coming soon</p>
              {/* 照片即将上线 */}
            </div>
            {/* Type badge overlay */}
            {/* 类型徽章叠加 */}
            <div className="absolute left-3 top-3">
              <span className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${typeColors[place.type]}`}>
                <Icon size={10} />
                {place.type}
              </span>
            </div>
          </div>

          {/* Basic info */}
          {/* 基本信息 */}
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800">{place.name}</h2>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} className="shrink-0" />
              {place.address}, NY {place.zipCode}
            </div>
          </div>

          {/* Quiet score big display */}
          {/* 安静分数大显示 */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600">
                  Current Quiet Score
                  {/* 当前安静分数 */}
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-teal-700">
                    {place.quietScore}
                  </span>
                  <span className="text-xs text-teal-500">/ 100</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                <Volume2 size={20} className="text-teal-600" />
              </div>
            </div>
          </div>

          {/* Hours info */}
          {/* 开放时间信息 */}
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={12} />
              <span className="text-[10px] font-semibold uppercase">Hours</span>
              {/* 营业时间 */}
            </div>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {place.hours}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {place.isOpen ? 'Open now' : 'Currently closed'}
              {/* 现在营业 / 目前已关闭 */}
            </p>
          </div>

          {/* Occupancy info */}
          {/*  occupancy 信息 */}
          <div className="grid grid-cols-2 gap-3">
            {/* People count */}
            {/* 人数 */}
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Users size={12} />
                <span className="text-[10px] font-semibold uppercase">Occupancy</span>
                {/*  occupancy */}
              </div>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {place.currentPeople} <span className="text-xs font-normal text-slate-400">/ {place.totalCapacity}</span>
              </p>
              {/* Progress bar */}
              {/* 进度条 */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
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
            <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Gauge size={12} />
                <span className="text-[10px] font-semibold uppercase">Status</span>
                {/* 状态 */}
              </div>
              <p className={`mt-2 inline-block rounded-lg px-2 py-1 text-[10px] font-bold ${crowdedness.color}`}>
                {crowdedness.text}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {place.isOpen ? 'Open now' : 'Closed'}
                {/* 现在营业 / 已关闭 */}
              </p>
            </div>
          </div>

          {/* Prediction chart */}
          {/* 预测图表 */}
          <QuietScoreChart predictions={place.predictions} />
        </div>
      </div>
    </motion.div>
  );
}
