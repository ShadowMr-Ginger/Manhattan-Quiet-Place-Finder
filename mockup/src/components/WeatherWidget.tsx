// Weather Widget Component - Displays mock weather for Manhattan with smart tips
// 天气小部件组件 - 显示曼哈顿的模拟天气并给出智能提示

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudRain, Sun, Snowflake, Wind, Droplets, Thermometer, X, Lightbulb } from 'lucide-react';

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy';

interface WeatherData {
  condition: WeatherCondition;
  temp: number; // Fahrenheit
  humidity: number; // %
  windSpeed: number; // mph
  feelsLike: number;
}

// Generate deterministic mock weather based on date
// 基于日期生成确定性的模拟天气
function generateMockWeather(): WeatherData {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const conditions: WeatherCondition[] = ['sunny', 'cloudy', 'rainy', 'snowy', 'windy'];
  const condition = conditions[dayOfYear % conditions.length];

  const baseTemp = condition === 'sunny' ? 72 : condition === 'cloudy' ? 65 : condition === 'rainy' ? 58 : condition === 'snowy' ? 32 : 60;
  const temp = baseTemp + (now.getHours() > 12 ? 3 : -2);

  return {
    condition,
    temp,
    humidity: condition === 'rainy' ? 85 : condition === 'sunny' ? 45 : 60,
    windSpeed: condition === 'windy' ? 18 : condition === 'snowy' ? 12 : 6,
    feelsLike: temp + (condition === 'windy' ? -4 : condition === 'sunny' ? 2 : -2),
  };
}

const weatherConfig: Record<WeatherCondition, { icon: React.ElementType; label: string; color: string; bg: string; tip: string }> = {
  sunny: {
    icon: Sun,
    label: 'Sunny',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    tip: 'Great weather! Public study areas and parks are perfect today.',
  },
  cloudy: {
    icon: Cloud,
    label: 'Cloudy',
    color: 'text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    tip: 'Mild day. Cafes with window seats are ideal for natural light.',
  },
  rainy: {
    icon: CloudRain,
    label: 'Rainy',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    tip: 'It\'s raining — libraries and indoor coworking spaces are your best bet!',
  },
  snowy: {
    icon: Snowflake,
    label: 'Snowy',
    color: 'text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    tip: 'Snow outside! Find a warm cafe or library close to the subway.',
  },
  windy: {
    icon: Wind,
    label: 'Windy',
    color: 'text-teal-500',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    tip: 'Windy day — avoid outdoor spots. Underground or shielded areas work best.',
  },
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showTip, setShowTip] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setWeather(generateMockWeather());
  }, []);

  if (!weather) return null;

  const config = weatherConfig[weather.condition];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative z-[9999]"
    >
      {/* Compact weather pill */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${config.bg} border-slate-200 dark:border-slate-700`}
      >
        <Icon size={14} className={config.color} />
        <span className="text-slate-700 dark:text-slate-200">{weather.temp}°F</span>
        <span className="hidden text-slate-400 dark:text-slate-500 sm:inline">{config.label}</span>
      </motion.button>

      {/* Expanded tooltip / tip */}
      <AnimatePresence>
        {expanded && showTip && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full z-[9999] mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 ${config.bg}`}>
              <div className="flex items-center gap-2">
                <Icon size={18} className={config.color} />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {config.label} in Manhattan
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTip(false);
                  setExpanded(false);
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-white/50 hover:text-slate-600 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
              >
                <X size={12} />
              </button>
            </div>

            {/* Weather details */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 py-2 dark:bg-slate-700/50">
                <Thermometer size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{weather.feelsLike}°F</span>
                <span className="text-[9px] text-slate-400">Feels like</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 py-2 dark:bg-slate-700/50">
                <Droplets size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{weather.humidity}%</span>
                <span className="text-[9px] text-slate-400">Humidity</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 py-2 dark:bg-slate-700/50">
                <Wind size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{weather.windSpeed}</span>
                <span className="text-[9px] text-slate-400">mph</span>
              </div>
            </div>

            {/* Smart tip */}
            <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 dark:border-amber-900/30 dark:bg-amber-950/20">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                {config.tip}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
