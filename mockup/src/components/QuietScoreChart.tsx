// Quiet Score Prediction Chart Component with Arrival Time Selector
// 带到达时间选择器的安静分数预测图表组件

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { ScorePrediction } from '@/types/quietPlace';

interface QuietScoreChartProps {
  predictions: ScorePrediction[];
}

export default function QuietScoreChart({ predictions }: QuietScoreChartProps) {
  const maxScore = 100;
  const [arrivalOffset, setArrivalOffset] = useState(0); // 0 = now, 1 = +1h, etc.

  // Determine color based on score value
  // 根据分数值确定颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-teal-400 dark:bg-teal-500';
    if (score >= 60) return 'bg-amber-400 dark:bg-amber-500';
    return 'bg-rose-400 dark:bg-rose-500';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-teal-700 dark:text-teal-400';
    if (score >= 60) return 'text-amber-700 dark:text-amber-400';
    return 'text-rose-700 dark:text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-teal-50 dark:bg-teal-950/20';
    if (score >= 60) return 'bg-amber-50 dark:bg-amber-950/20';
    return 'bg-rose-50 dark:bg-rose-950/20';
  };

  const getScoreBorder = (score: number) => {
    if (score >= 80) return 'border-teal-200 dark:border-teal-900/30';
    if (score >= 60) return 'border-amber-200 dark:border-amber-900/30';
    return 'border-rose-200 dark:border-rose-900/30';
  };

  const activePrediction = predictions[arrivalOffset] || predictions[0];
  const activeScore = activePrediction.quietScore;

  return (
    <div className="space-y-3">
      {/* Header with arrival selector */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Quiet Score Forecast
          {/* 安静分数预测 */}
        </h4>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {predictions.map((pred, idx) => (
            <button
              key={pred.time}
              onClick={() => setArrivalOffset(idx)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                arrivalOffset === idx
                  ? 'bg-sky-100 text-sky-700 shadow-sm dark:bg-sky-900/30 dark:text-sky-400'
                  : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {idx === 0 ? 'Now' : `+${idx}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Active prediction highlight */}
      {/* 当前选中预测高亮 */}
      <div className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm ${getScoreBg(activeScore)} ${getScoreBorder(activeScore)}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 dark:bg-slate-900/40`}>
          {activeScore >= 80 ? (
            <Sparkles size={18} className="text-teal-500 dark:text-teal-400" />
          ) : activeScore >= 60 ? (
            <Clock size={18} className="text-amber-500 dark:text-amber-400" />
          ) : (
            <AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            If you arrive at {activePrediction.time}
          </p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-extrabold ${getScoreTextColor(activeScore)}`}>
              {activeScore}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">/ 100 expected</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {/* Bar chart */}
        {/* 柱状图 */}
        <div className="flex items-end gap-2" style={{ height: '80px' }}>
          {predictions.map((pred, index) => (
            <motion.div
              key={pred.time}
              className="relative flex flex-1 flex-col items-center justify-end"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ delay: index * 0.1, duration: 0.5, ease: 'easeOut' }}
              style={{ originY: 1 }}
            >
              {/* Score label on top of bar */}
              {/* 柱子顶部的分数标签 */}
              <span className={`mb-1 text-[10px] font-bold ${getScoreTextColor(pred.quietScore)}`}>
                {pred.quietScore}
              </span>

              {/* Animated bar */}
              {/* 动画柱子 */}
              <motion.div
                className={`w-full rounded-t-lg transition-all duration-300 ${getScoreColor(pred.quietScore)} ${
                  index === arrivalOffset ? 'ring-2 ring-sky-300 ring-offset-1 dark:ring-sky-600 dark:ring-offset-slate-800' : 'opacity-80'
                }`}
                initial={{ height: 0 }}
                animate={{ height: `${(pred.quietScore / maxScore) * 100}%` }}
                transition={{ delay: index * 0.1 + 0.2, duration: 0.6, ease: 'easeOut' }}
              />
            </motion.div>
          ))}
        </div>

        {/* Time labels */}
        {/* 时间标签 */}
        <div className="mt-2 flex justify-between">
          {predictions.map((pred, idx) => (
            <button
              key={pred.time}
              onClick={() => setArrivalOffset(idx)}
              className={`flex-1 text-center text-[10px] transition-colors ${
                idx === arrivalOffset
                  ? 'font-bold text-sky-600 dark:text-sky-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {pred.time}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-teal-400 dark:bg-teal-500" />
          Quiet (80+)
          {/* 安静 */}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 dark:bg-amber-500" />
          Moderate (60-79)
          {/* 适中 */}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400 dark:bg-rose-500" />
          Noisy (&lt;60)
          {/* 嘈杂 */}
        </span>
      </div>
    </div>
  );
}
