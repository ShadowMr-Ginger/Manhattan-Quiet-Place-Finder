import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
