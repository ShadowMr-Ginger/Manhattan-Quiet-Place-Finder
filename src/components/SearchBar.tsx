// Search Bar Component
// 搜索栏组件

'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export default function SearchBar({ value, onChange, onSearch }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <motion.div
        // Animated focus ring effect
        // 聚焦时的动画光环效果
        animate={{
          boxShadow: isFocused
            ? '0 0 0 3px rgba(14, 165, 233, 0.15), 0 4px 20px rgba(0, 0, 0, 0.08)'
            : '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors focus-within:border-sky-300"
      >
        <Search size={18} className="shrink-0 text-slate-400" />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search Manhattan address..."
          // 搜索曼哈顿地址...
          className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />

        <AnimatePresence>
          {value && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => onChange('')}
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </form>
  );
}
