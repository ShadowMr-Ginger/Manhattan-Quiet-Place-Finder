// Quiet Score Prediction Chart Component
// 安静分数预测图表组件

'use client';

import { motion } from 'framer-motion';
import { ScorePrediction } from '@/types/quietPlace';

interface QuietScoreChartProps {
  predictions: ScorePrediction[];
}

export default function QuietScoreChart({ predictions }: QuietScoreChartProps) {
  const maxScore = 100;

  // Determine color based on score value
  // 根据分数值确定颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-teal-400';
    if (score >= 60) return 'bg-amber-400';
    return 'bg-rose-400';
  };

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-teal-700';
    if (score >= 60) return 'text-amber-700';
    return 'text-rose-700';
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-slate-500">
        Quiet Score Forecast
        {/* 安静分数预测 */}
      </h4>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
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
                className={`w-full rounded-t-lg ${getScoreColor(pred.quietScore)}`}
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
          {predictions.map((pred) => (
            <span key={pred.time} className="flex-1 text-center text-[10px] text-slate-400">
              {pred.time}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          Quiet (80+)
          {/* 安静 */}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Moderate (60-79)
          {/* 适中 */}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          Noisy (&lt;60)
          {/* 嘈杂 */}
        </span>
      </div>
    </div>
  );
}
