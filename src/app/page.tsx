// Main Page - Manhattan Quiet Place Finder
// 主页 - 曼哈顿安静地点查找器

'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import SkeletonLoader from '@/components/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { User, MapPin, MessageSquare, Scale, Command } from 'lucide-react';

// Types / 类型
import { QuietPlace, FilterOptions, ChatMessage } from '@/types/quietPlace';

// Data / 数据
import {
  mockQuietPlaces,
  mockUserProfile,
  generateMockChatHistory,
  mockAIResponses,
} from '@/data/mockQuietPlaces';

// Hooks / Hooks
import { useFavorites } from '@/hooks/useFavorites';
import { useRecentViews } from '@/hooks/useRecentViews';
import { useTheme } from '@/components/ThemeProvider';

// Components / 组件
import Sidebar from '@/components/Sidebar';
import Map from '@/components/Map';
import ChatPanel from '@/components/ChatPanel';
import PlaceDetailPanel from '@/components/PlaceDetailPanel';
import ComparePanel from '@/components/ComparePanel';
import ProfileModal from '@/components/ProfileModal';
import ThemeToggle from '@/components/ThemeToggle';
import WeatherWidget from '@/components/WeatherWidget';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';

/**
 * Generate a unique ID for chat messages
 * 为聊天消息生成唯一 ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Get mock AI response based on user input
 * 根据用户输入获取模拟 AI 回复
 */
function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('cafe') || lower.includes('coffee')) return mockAIResponses.cafe;
  if (lower.includes('library') || lower.includes('book')) return mockAIResponses.library;
  if (lower.includes('coworking') || lower.includes('work')) return mockAIResponses.coworking;
  if (lower.includes('quiet')) return mockAIResponses.quiet;
  return mockAIResponses.default;
}

export default function HomePage() {
  // --- Loading State / 加载状态 ---
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // --- State Management / 状态管理 ---

  // Search / 搜索
  const [searchQuery, setSearchQuery] = useState('');

  // Filters / 过滤器
  const [filters, setFilters] = useState<FilterOptions>({
    types: ['Cafe', 'Library', 'Coworking Space', 'Public Study Area'],
    minQuietScore: 60,
    sortBy: 'distance',
  });

  // Selected place / 选中的地点
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Right panel mode / 右侧面板模式
  const [showPlaceDetail, setShowPlaceDetail] = useState(false);

  // Chat messages / 聊天消息
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(generateMockChatHistory);

  // Profile modal / 用户资料弹窗
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Compare mode / 对比模式
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparePanel, setShowComparePanel] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);

  // Keyboard shortcuts help / 快捷键帮助
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Keyboard navigation index / 键盘导航索引
  const [keyboardNavIndex, setKeyboardNavIndex] = useState(-1);

  // Search input ref / 搜索框引用
  const searchRef = useRef<HTMLInputElement>(null);

  // Theme toggle / 主题切换
  const { toggleTheme } = useTheme();

  // Favorites & Saved / 收藏与保存
  const {
    isFavorite,
    isSaved,
    toggleFavorite,
    toggleSaved,
    getFavoritePlaces,
    getSavedPlaces,
  } = useFavorites();

  // Recent views / 最近浏览
  const { recentSearches, recentViewedIds, addSearch, removeSearch, clearSearches, addViewed } = useRecentViews();

  // --- Derived State / 派生状态 ---

  // Filter and sort places / 过滤和排序地点
  const filteredPlaces = useMemo(() => {
    let results = mockQuietPlaces.filter((place) => {
      // Type filter / 类型过滤
      if (!filters.types.includes(place.type)) return false;
      // Quiet score filter / 安静分数过滤
      if (place.quietScore < filters.minQuietScore) return false;
      // Search query filter / 搜索关键词过滤
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = place.name.toLowerCase().includes(q);
        const matchAddress = place.address.toLowerCase().includes(q);
        if (!matchName && !matchAddress) return false;
      }
      return true;
    });

    // Sort / 排序
    results = [...results].sort((a, b) => {
      if (filters.sortBy === 'distance') {
        return a.distance - b.distance;
      }
      return b.quietScore - a.quietScore;
    });

    return results;
  }, [filters, searchQuery]);

  // Currently selected place object / 当前选中的地点对象
  const selectedPlace = useMemo(
    () => mockQuietPlaces.find((p) => p.id === selectedPlaceId) || null,
    [selectedPlaceId]
  );

  // Compare places objects / 对比地点对象
  const comparePlaces = useMemo(() => {
    return compareIds
      .map((id) => mockQuietPlaces.find((p) => p.id === id))
      .filter((p): p is QuietPlace => p !== undefined);
  }, [compareIds]);

  // Build user profile with real favorites/saved / 构建带有真实收藏/保存的用户资料
  const userProfile = useMemo(() => {
    return {
      ...mockUserProfile,
      favorites: getFavoritePlaces(mockQuietPlaces),
      savedPlaces: getSavedPlaces(mockQuietPlaces),
    };
  }, [getFavoritePlaces, getSavedPlaces]);

  // Get recently viewed places / 获取最近浏览的地点
  const recentlyViewed = useMemo(() => {
    return recentViewedIds
      .map((id) => mockQuietPlaces.find((p) => p.id === id))
      .filter((p): p is QuietPlace => p !== undefined);
  }, [recentViewedIds]);

  // --- Handlers / 处理函数 ---

  // Handle place selection from sidebar or map / 处理从侧边栏或地图选择地点
  const handleSelectPlace = useCallback((place: QuietPlace) => {
    setSelectedPlaceId(place.id);
    setShowPlaceDetail(true);
    setShowComparePanel(false);
    addViewed(place.id);
  }, [addViewed]);

  // Handle back to chat / 处理返回聊天
  const handleBackToChat = useCallback(() => {
    setShowPlaceDetail(false);
    setShowComparePanel(false);
    setSelectedPlaceId(null);
  }, []);

  // Handle search submit / 处理搜索提交
  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) {
      addSearch(searchQuery.trim());
    }
  }, [searchQuery, addSearch]);

  // Handle search change / 处理搜索变化
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setKeyboardNavIndex(-1);
  }, []);

  // Toggle compare mode / 切换对比模式
  const toggleCompareMode = useCallback(() => {
    setIsCompareMode((prev) => {
      const next = !prev;
      if (!next) {
        // Exiting compare mode: clear selections but keep panel if already shown
        setCompareIds([]);
        setShowComparePanel(false);
      }
      return next;
    });
  }, []);

  // Toggle place in compare list / 切换地点的对比选中状态
  const handleToggleCompare = useCallback((place: QuietPlace) => {
    setCompareIds((prev) => {
      const exists = prev.includes(place.id);
      let next: string[];
      if (exists) {
        next = prev.filter((id) => id !== place.id);
      } else if (prev.length < 2) {
        next = [...prev, place.id];
      } else {
        // Replace the oldest one
        next = [prev[1], place.id];
      }
      // Auto-show compare panel when we have 2
      if (next.length === 2) {
        setShowComparePanel(true);
        setShowPlaceDetail(false);
        setSelectedPlaceId(null);
      }
      return next;
    });
  }, []);

  // Remove place from compare / 从对比中移除地点
  const handleRemoveCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      const next = prev.filter((pid) => pid !== id);
      if (next.length === 0) {
        setShowComparePanel(false);
      }
      return next;
    });
  }, []);

  // Handle sending chat message / 处理发送聊天消息
  const handleSendMessage = useCallback((message: string) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: getAIResponse(message),
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    }, 600);
  }, []);

  // --- Keyboard Shortcuts / 键盘快捷键 ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input / textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Allow Esc to blur input and shortcuts
        if (e.key !== 'Escape') return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          searchRef.current?.focus();
          break;

        case 'Escape':
          if (showShortcutsHelp) {
            setShowShortcutsHelp(false);
          } else if (isProfileOpen) {
            setIsProfileOpen(false);
          } else if (showPlaceDetail) {
            handleBackToChat();
          } else if (showComparePanel) {
            handleBackToChat();
          } else if (document.activeElement === searchRef.current) {
            searchRef.current?.blur();
          }
          break;

        case 'c':
        case 'C':
          toggleCompareMode();
          break;

        case 'd':
        case 'D':
          toggleTheme();
          break;

        case '?':
          setShowShortcutsHelp((prev) => !prev);
          break;

        case 'ArrowUp':
          if (document.activeElement !== searchRef.current) {
            e.preventDefault();
            setKeyboardNavIndex((prev) => {
              const next = prev <= 0 ? filteredPlaces.length - 1 : prev - 1;
              return next;
            });
          }
          break;

        case 'ArrowDown':
          if (document.activeElement !== searchRef.current) {
            e.preventDefault();
            setKeyboardNavIndex((prev) => {
              const next = prev >= filteredPlaces.length - 1 ? 0 : prev + 1;
              return next;
            });
          }
          break;

        case 'Enter':
          if (keyboardNavIndex >= 0 && keyboardNavIndex < filteredPlaces.length) {
            e.preventDefault();
            const place = filteredPlaces[keyboardNavIndex];
            if (isCompareMode) {
              handleToggleCompare(place);
            } else {
              handleSelectPlace(place);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showShortcutsHelp,
    isProfileOpen,
    showPlaceDetail,
    showComparePanel,
    filteredPlaces,
    keyboardNavIndex,
    isCompareMode,
    handleBackToChat,
    handleSelectPlace,
    handleToggleCompare,
    toggleCompareMode,
    toggleTheme,
  ]);

  // Sync keyboard nav index with filtered places / 同步键盘导航索引与过滤结果
  useEffect(() => {
    setKeyboardNavIndex(-1);
  }, [filters, searchQuery]);

  // Auto-select keyboard nav place / 自动选中键盘导航的地点
  useEffect(() => {
    if (keyboardNavIndex >= 0 && keyboardNavIndex < filteredPlaces.length) {
      setSelectedPlaceId(filteredPlaces[keyboardNavIndex].id);
    }
  }, [keyboardNavIndex, filteredPlaces]);

  if (isLoading) {
    return <SkeletonLoader />;
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Navigation Bar / 顶部导航栏 */}
      <header className="relative z-50 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/80">
        {/* Logo / 标志 */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-400 shadow-sm">
            <MapPin size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">Quiet Place Finder</h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Manhattan • NYC</p>
          </div>
        </div>

        {/* Center nav hint / 中间导航提示 */}
        <div className="hidden items-center gap-1 rounded-full bg-slate-100 px-3 py-1 md:flex dark:bg-slate-800">
          <MessageSquare size={11} className="text-slate-400 dark:text-slate-500" />
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Try clicking markers or cards</span>
        </div>

        {/* Right side controls / 右侧控制 */}
        <div className="flex items-center gap-2">
          {/* Compare mode toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleCompareMode}
            className={`relative flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-sm transition-colors ${
              isCompareMode
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
            title="Toggle compare mode (c)"
          >
            <Scale size={13} />
            <span className="hidden sm:inline">Compare</span>
            {compareIds.length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {compareIds.length}
              </span>
            )}
          </motion.button>

          <WeatherWidget />
          <ThemeToggle />

          {/* Keyboard shortcuts help button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowShortcutsHelp(true)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            title="Keyboard shortcuts (?)"
          >
            <Command size={14} />
          </motion.button>

          {/* User avatar / 用户头像 */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Image
              src={mockUserProfile.avatar}
              alt={mockUserProfile.username}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full"
            />
            <span className="hidden text-xs font-medium text-slate-600 dark:text-slate-300 sm:inline">
              {mockUserProfile.username}
            </span>
            <User size={12} className="text-slate-400 sm:hidden" />
          </motion.button>
        </div>
      </header>

      {/* Three-column Layout / 三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (~25%) / 左侧边栏 */}
        <div className="w-[28%] min-w-[280px] max-w-[380px] shrink-0">
          <Sidebar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onSearch={handleSearch}
            filters={filters}
            onFilterChange={setFilters}
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
            recentSearches={recentSearches}
            onRemoveSearch={removeSearch}
            onClearSearches={clearSearches}
            recentlyViewed={recentlyViewed}
            isCompareMode={isCompareMode}
            compareIds={compareIds}
            onToggleCompare={handleToggleCompare}
            searchRef={searchRef}
          />
        </div>

        {/* Center Map (~50%) / 中间地图 */}
        <div className="relative flex-1 border-x border-slate-200 dark:border-slate-700">
          <Map
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
          />
        </div>

        {/* Right Panel (~25%) / 右侧面板 */}
        <div className="w-[28%] min-w-[280px] max-w-[380px] shrink-0">
          <AnimatePresence mode="wait">
            {showComparePanel ? (
              <motion.div
                key="compare"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <ComparePanel
                  places={comparePlaces}
                  onBack={handleBackToChat}
                  onRemovePlace={handleRemoveCompare}
                />
              </motion.div>
            ) : showPlaceDetail && selectedPlace ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <PlaceDetailPanel
                  place={selectedPlace}
                  onBack={handleBackToChat}
                  isFavorite={isFavorite(selectedPlace.id)}
                  isSaved={isSaved(selectedPlace.id)}
                  onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
                  onToggleSaved={() => toggleSaved(selectedPlace.id)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <ChatPanel
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  isVisible={true}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Profile Modal / 用户资料弹窗 */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={userProfile}
        onSelectPlace={handleSelectPlace}
      />

      {/* Keyboard Shortcuts Help / 键盘快捷键帮助 */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </main>
  );
}
