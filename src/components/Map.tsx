// Map Component - Interactive map with Google Maps integration and stylized fallback
// 地图组件 - 集成 Google Maps 并带有风格化降级方案

'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee,
  BookOpen,
  Laptop,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
} from '@vis.gl/react-google-maps';
import { QuietPlace } from '@/types/quietPlace';

// --- Stylized Fallback Map (no API key required) ---
// --- 风格化降级地图（无需 API key）---

const typeIcons = {
  Cafe: Coffee,
  Library: BookOpen,
  'Coworking Space': Laptop,
  'Public Study Area': MapPin,
};

const markerColors = {
  Cafe: 'bg-amber-500 shadow-amber-200',
  Library: 'bg-blue-500 shadow-blue-200',
  'Coworking Space': 'bg-purple-500 shadow-purple-200',
  'Public Study Area': 'bg-emerald-500 shadow-emerald-200',
};

interface MapProps {
  places: QuietPlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (place: QuietPlace) => void;
}

function latLngToPosition(lat: number, lng: number) {
  const latMin = 40.70;
  const latMax = 40.82;
  const lngMin = -74.02;
  const lngMax = -73.93;
  const y = ((latMax - lat) / (latMax - latMin)) * 100;
  const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function StylizedMap({ places, selectedPlaceId, onSelectPlace }: MapProps) {
  const parkDots = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${(i * 37 + 13) % 100}%`,
        top: `${(i * 53 + 7) % 100}%`,
      })),
    []
  );

  const buildings = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        x: 5 + (i % 5) * 19 + ((i * 17) % 5),
        y: 5 + Math.floor(i / 5) * 19 + ((i * 23) % 5),
        width: 4 + ((i * 31) % 6),
        height: 3 + ((i * 41) % 5),
      })),
    []
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-none bg-[#e8e6e1]">
      {/* Background grid / 背景网格 */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1cfc9" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Water / 水域 */}
      <div className="absolute -left-4 top-0 h-full w-[15%] -skew-x-6 bg-[#b8d4e3] opacity-40" />
      <div className="absolute -right-2 bottom-0 h-[30%] w-[20%] skew-x-3 bg-[#b8d4e3] opacity-40" />

      {/* Central Park / 中央公园 */}
      <div
        className="absolute rounded-xl bg-[#a8c9a0] opacity-60"
        style={{ left: '48%', top: '25%', width: '14%', height: '45%', transform: 'translate(-50%, 0)' }}
      >
        <div className="absolute inset-2 opacity-20">
          {parkDots.map((dot) => (
            <div
              key={dot.id}
              className="absolute h-1 w-1 rounded-full bg-emerald-800"
              style={{ left: dot.left, top: dot.top }}
            />
          ))}
        </div>
      </div>

      {/* Street grid / 街道网格 */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {['10%', '22%', '35%', '48%', '60%', '72%', '85%'].map((y, i) => (
          <line key={`h-${i}`} x1="0" y1={y} x2="100%" y2={y} stroke="#c4c2bc" strokeWidth="1.5" opacity="0.6" />
        ))}
        {['8%', '20%', '32%', '44%', '56%', '68%', '80%', '92%'].map((x, i) => (
          <line key={`v-${i}`} x1={x} y1="0" x2={x} y2="100%" stroke="#c4c2bc" strokeWidth="1" opacity="0.4" />
        ))}
      </svg>

      {/* Buildings / 建筑 */}
      {buildings.map((b) => {
        if (b.x > 40 && b.x < 65 && b.y > 20 && b.y < 75) return null;
        return (
          <div
            key={`b-${b.id}`}
            className="absolute rounded-sm bg-white/50 shadow-sm"
            style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.width}%`, height: `${b.height}%` }}
          />
        );
      })}

      {/* Markers / 标记 */}
      {places.map((place) => {
        const pos = latLngToPosition(place.lat, place.lng);
        const Icon = typeIcons[place.type];
        const isSelected = selectedPlaceId === place.id;
        return (
          <motion.div
            key={place.id}
            className="absolute cursor-pointer"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            onClick={() => onSelectPlace(place)}
          >
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className={`absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full ${markerColors[place.type].split(' ')[0]}`}
                />
              )}
            </AnimatePresence>
            <motion.div
              whileHover={{ scale: 1.15, y: -4 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg ${markerColors[place.type]} ${isSelected ? 'ring-4 ring-white/60' : ''}`}
            >
              <Icon size={16} className="text-white" strokeWidth={2.5} />
              <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-bold text-slate-700 shadow-sm">
                {place.quietScore}
              </div>
            </motion.div>
            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-lg"
                >
                  {place.name}
                  <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Controls / 控制 */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-600 shadow-md">
          <Navigation size={14} />
        </div>
      </div>
      <div className="absolute left-4 top-4 rounded-xl bg-white/80 px-3 py-1.5 text-[10px] font-medium text-slate-500 shadow-sm backdrop-blur-sm">
        Manhattan, New York
      </div>
    </div>
  );
}

// --- Real Google Maps Integration ---
// --- 真实 Google Maps 集成 ---

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_ID = 'quiet-place-finder-map'; // Optional custom map ID / 可选的自定义地图 ID

// Pin colors for each place type on Google Maps
// Google Maps 上每种地点类型的标记颜色
const pinColors: Record<string, string> = {
  Cafe: '#f59e0b',
  Library: '#3b82f6',
  'Coworking Space': '#a855f7',
  'Public Study Area': '#10b981',
};

function RealGoogleMap({ places, selectedPlaceId, onSelectPlace }: MapProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY!}>
      <GoogleMap
        defaultCenter={{ lat: 40.758, lng: -73.9855 }}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapId={MAP_ID}
        className="h-full w-full"
      >
        {places.map((place) => {
          const isSelected = selectedPlaceId === place.id;
          return (
            <AdvancedMarker
              key={place.id}
              position={{ lat: place.lat, lng: place.lng }}
              onClick={() => onSelectPlace(place)}
            >
              <Pin
                background={pinColors[place.type] || '#0ea5e9'}
                borderColor="#ffffff"
                glyphColor="#ffffff"
                scale={isSelected ? 1.5 : 1.2}
              />
            </AdvancedMarker>
          );
        })}
      </GoogleMap>
    </APIProvider>
  );
}

// --- Main Map Component ---
// --- 主地图组件 ---

export default function Map(props: MapProps) {
  // If API key is provided, use real Google Maps
  // 如果提供了 API key，使用真实 Google Maps
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 10) {
    return <RealGoogleMap {...props} />;
  }

  // Otherwise fallback to stylized map
  // 否则降级到风格化地图
  return <StylizedMap {...props} />;
}
