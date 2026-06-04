// Profile Modal Component
// 用户资料弹窗组件

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X, Heart, Bookmark, MapPin, Volume2 } from 'lucide-react';
import { UserProfile, QuietPlace } from '@/types/quietPlace';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSelectPlace?: (place: QuietPlace) => void;
}

export default function ProfileModal({ isOpen, onClose, profile, onSelectPlace }: ProfileModalProps) {
  const handlePlaceClick = (place: QuietPlace) => {
    if (onSelectPlace) {
      onSelectPlace(place);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />

          {/* Modal panel */}
          {/* 弹窗面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-4 top-16 z-50 w-80 overflow-hidden rounded-3xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95"
          >
            {/* Header with avatar */}
            {/* 头部和头像 */}
            <div className="relative bg-gradient-to-br from-sky-400 to-teal-400 px-6 pb-10 pt-6">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center">
                <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/50 shadow-lg">
                  <Image
                    src={profile.avatar}
                    alt={profile.username}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h2 className="mt-3 text-lg font-bold text-white">
                  {profile.username}
                </h2>
                <p className="text-xs text-white/80">Quiet Place Explorer</p>
                {/* 安静地点探索者 */}
              </div>
            </div>

            {/* Stats cards */}
            {/* 统计卡片 */}
            <div className="relative z-10 -mt-6 grid grid-cols-2 gap-3 px-4">
              <div className="rounded-2xl border border-rose-100 bg-white p-3 shadow-md dark:border-rose-900/30 dark:bg-slate-800">
                <div className="flex items-center gap-1.5 text-rose-500">
                  <Heart size={14} />
                  <span className="text-[10px] font-semibold uppercase">Favorites</span>
                  {/* 收藏 */}
                </div>
                <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">{profile.favorites.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-white p-3 shadow-md dark:border-amber-900/30 dark:bg-slate-800">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Bookmark size={14} />
                  <span className="text-[10px] font-semibold uppercase">Saved</span>
                  {/* 已保存 */}
                </div>
                <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">{profile.savedPlaces.length}</p>
              </div>
            </div>

            {/* Favorite places list */}
            {/* 收藏地点列表 */}
            <div className="max-h-64 overflow-y-auto p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Favorite Places
                {/* 收藏地点 */}
              </h3>
              {profile.favorites.length === 0 ? (
                <p className="rounded-xl bg-slate-50 py-4 text-center text-[11px] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  No favorites yet. Heart a place to add it here!
                </p>
              ) : (
                <div className="space-y-2">
                  {profile.favorites.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handlePlaceClick(place)}
                      className="flex w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400">
                        <Heart size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                          {place.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={9} />
                            {place.distance} km
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Volume2 size={9} />
                            {place.quietScore}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Saved places list */}
              {/* 已保存地点列表 */}
              <h3 className="mb-3 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Saved Places
                {/* 已保存地点 */}
              </h3>
              {profile.savedPlaces.length === 0 ? (
                <p className="rounded-xl bg-slate-50 py-4 text-center text-[11px] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  No saved places yet. Bookmark a place to save it for later!
                </p>
              ) : (
                <div className="space-y-2">
                  {profile.savedPlaces.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => handlePlaceClick(place)}
                      className="flex w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-500 dark:bg-amber-950/30 dark:text-amber-400">
                        <Bookmark size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                          {place.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                          <span className="flex items-center gap-0.5">
                            <MapPin size={9} />
                            {place.distance} km
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Volume2 size={9} />
                            {place.quietScore}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
