// Main Page - Manhattan Quiet Place Finder
// 主页 - 曼哈顿安静地点查找器

'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { User, MapPin, MessageSquare } from 'lucide-react';

// Types / 类型
import { QuietPlace, FilterOptions, ChatMessage } from '@/types/quietPlace';

// Data / 数据
import {
  mockQuietPlaces,
  mockUserProfile,
  generateMockChatHistory,
  mockAIResponses,
} from '@/data/mockQuietPlaces';

// Components / 组件
import Sidebar from '@/components/Sidebar';
import Map from '@/components/Map';
import ChatPanel from '@/components/ChatPanel';
import PlaceDetailPanel from '@/components/PlaceDetailPanel';
import ProfileModal from '@/components/ProfileModal';

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

  // --- Handlers / 处理函数 ---

  // Handle place selection from sidebar or map / 处理从侧边栏或地图选择地点
  const handleSelectPlace = useCallback((place: QuietPlace) => {
    setSelectedPlaceId(place.id);
    setShowPlaceDetail(true);
  }, []);

  // Handle back to chat / 处理返回聊天
  const handleBackToChat = useCallback(() => {
    setShowPlaceDetail(false);
    setSelectedPlaceId(null);
  }, []);

  // Handle search submit / 处理搜索提交
  const handleSearch = useCallback(() => {
    // Mock search behavior - already handled by filteredPlaces / 模拟搜索行为 - 已由 filteredPlaces 处理
  }, []);

  // Handle sending chat message / 处理发送聊天消息
  const handleSendMessage = useCallback((message: string) => {
    // Add user message / 添加用户消息
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMsg]);

    // Simulate AI response delay / 模拟 AI 回复延迟
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

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      {/* Top Navigation Bar / 顶部导航栏 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-5 backdrop-blur-md">
        {/* Logo / 标志 */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-teal-400 shadow-sm">
            <MapPin size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Quiet Place Finder</h1>
            {/* 安静地点查找器 */}
            <p className="text-[10px] text-slate-400">Manhattan • NYC</p>
            {/* 曼哈顿 • 纽约 */}
          </div>
        </div>

        {/* Center nav hint / 中间导航提示 */}
        <div className="hidden items-center gap-1 rounded-full bg-slate-100 px-3 py-1 md:flex">
          <MessageSquare size={11} className="text-slate-400" />
          <span className="text-[10px] text-slate-400">Try clicking markers or cards</span>
          {/* 尝试点击标记或卡片 */}
        </div>

        {/* User avatar / 用户头像 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsProfileOpen(true)}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Image
            src={mockUserProfile.avatar}
            alt={mockUserProfile.username}
            width={28}
            height={28}
            className="h-7 w-7 rounded-full"
          />
          <span className="hidden text-xs font-medium text-slate-600 sm:inline">
            {mockUserProfile.username}
          </span>
          <User size={12} className="text-slate-400 sm:hidden" />
        </motion.button>
      </header>

      {/* Three-column Layout / 三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (~25%) / 左侧边栏 */}
        <div className="w-[28%] min-w-[280px] max-w-[380px] shrink-0">
          <Sidebar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={handleSearch}
            filters={filters}
            onFilterChange={setFilters}
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
          />
        </div>

        {/* Center Map (~50%) / 中间地图 */}
        <div className="relative flex-1 border-x border-slate-200">
          <Map
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
          />
        </div>

        {/* Right Panel (~25%) / 右侧面板 */}
        <div className="w-[28%] min-w-[280px] max-w-[380px] shrink-0">
          <AnimatePresence mode="wait">
            {showPlaceDetail && selectedPlace ? (
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
        profile={mockUserProfile}
      />
    </main>
  );
}
