// AI Chat Panel Component with typing animation
// 带打字动画的 AI 聊天面板组件

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/types/quietPlace';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isVisible: boolean;
}

/**
 * Typewriter text component using incremental rendering with key-based reset
 * 使用基于 key 重置的增量渲染打字机文本组件
 */
function TypewriterText({ text, speed = 25 }: { text: string; speed?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index >= text.length) return;
    const timer = setTimeout(() => {
      setIndex((prev) => prev + 1);
    }, speed);
    return () => clearTimeout(timer);
  }, [index, text.length, speed]);

  return (
    <>
      {text.slice(0, index)}
      {index < text.length && (
        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-sky-400 align-middle" />
      )}
    </>
  );
}

/**
 * Single animated message component
 * 单个动画消息组件
 */
function AnimatedMessage({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      {/* 头像 */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isAssistant
            ? 'bg-gradient-to-br from-sky-400 to-teal-400 shadow-sm'
            : 'bg-slate-200'
        }`}
      >
        {isAssistant ? (
          <Sparkles size={13} className="text-white" />
        ) : (
          <User size={13} className="text-slate-600" />
        )}
      </div>

      {/* Message bubble */}
      {/* 消息气泡 */}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
          isAssistant
            ? 'rounded-tl-sm bg-white shadow-sm'
            : 'rounded-tr-sm bg-sky-500 text-white shadow-sm'
        }`}
      >
        {isAssistant ? (
          // Use key to reset typewriter when message changes
          // 使用 key 在消息变化时重置打字机效果
          <TypewriterText key={message.id} text={message.content} speed={25} />
        ) : (
          message.content
        )}
      </div>
    </motion.div>
  );
}

export default function ChatPanel({ messages, onSendMessage, isVisible }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  // 新消息到达时自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  if (!isVisible) return null;

  return (
    <div className="flex h-full flex-col bg-white/80 backdrop-blur-md">
      {/* Chat header */}
      {/* 聊天头部 */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white/60 px-4 py-3 backdrop-blur-sm">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-400 shadow-sm">
          <Bot size={14} className="text-white" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-slate-700">AI Assistant</h3>
          {/* AI 助手 */}
          <p className="text-[10px] text-slate-400">Always here to help</p>
          {/* 随时为您提供帮助 */}
        </div>
      </div>

      {/* Messages area */}
      {/* 消息区域 */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {/* Welcome hint when no messages */}
        {/* 没有消息时的欢迎提示 */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-10 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-teal-100">
              <Sparkles size={20} className="text-sky-500" />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">
              Ask me anything about quiet places
              {/* 向我询问关于安静地点的任何问题 */}
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              Try: &quot;cafe near me&quot; or &quot;quietest library&quot;
              {/* 尝试：&quot;我附近的咖啡馆&quot; 或 &quot;最安静的图书馆&quot; */}
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <AnimatedMessage key={msg.id} message={msg} />
          ))}
        </AnimatePresence>
      </div>

      {/* Input area */}
      {/* 输入区域 */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-100 bg-white/60 p-3 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about quiet places..."
            // 询问关于安静地点...
            className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!inputValue.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm transition-colors hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500"
          >
            <Send size={12} />
          </motion.button>
        </div>
      </form>
    </div>
  );
}
