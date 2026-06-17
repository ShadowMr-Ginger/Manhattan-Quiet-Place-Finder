import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  children: ReactNode;
  title?: string;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  showHandle?: boolean;
}

type SheetState = 'peek' | 'half' | 'full';

const HEIGHTS: Record<SheetState, string> = {
  peek: '140px',
  half: '45vh',
  full: '92vh',
};

export default function BottomSheet({ children, title, expanded = false, onExpandChange, showHandle = true }: BottomSheetProps) {
  const [state, setState] = useState<SheetState>(expanded ? 'full' : 'half');

  const cycleState = () => {
    const next: SheetState = state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek';
    setState(next);
    onExpandChange?.(next === 'full');
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 overflow-hidden">
      <motion.div
        initial={false}
        animate={{ height: HEIGHTS[state] }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="pointer-events-auto absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:bg-slate-900/95"
      >
        <button onClick={cycleState} className="w-full">
          {showHandle && (
            <div className="flex h-7 w-full items-center justify-center pt-2">
              <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          )}
          {title && (
            <div className="px-5 pb-2 pt-1 text-left">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
            </div>
          )}
        </button>
        <div className="h-[calc(100%-44px)] overflow-y-auto px-4 pb-24 pt-1">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

export { AnimatePresence };
