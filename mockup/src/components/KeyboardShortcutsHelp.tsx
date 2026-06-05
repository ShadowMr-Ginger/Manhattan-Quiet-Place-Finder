// Keyboard Shortcuts Help Modal
// 键盘快捷键帮助弹窗

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: ['/'], description: 'Focus search box' },
  { keys: ['Esc'], description: 'Close panel / Clear selection' },
  { keys: ['c'], description: 'Toggle compare mode' },
  { keys: ['↑', '↓'], description: 'Navigate results' },
  { keys: ['Enter'], description: 'Open selected place' },
  { keys: ['?'], description: 'Show this help' },
  { keys: ['d'], description: 'Toggle dark mode' },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-slate-500 dark:text-slate-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X size={14} />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="p-4">
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800"
                  >
                    <span className="text-xs text-slate-600 dark:text-slate-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, idx) => (
                        <span key={key} className="flex items-center gap-1">
                          <kbd className="flex h-6 min-w-[24px] items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            {key}
                          </kbd>
                          {idx < shortcut.keys.length - 1 && (
                            <span className="text-[10px] text-slate-400">or</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-700">
              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
                Press <kbd className="rounded border border-slate-200 bg-white px-1 text-[9px] font-bold dark:border-slate-600 dark:bg-slate-700">?</kbd> anytime to show this help
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
