import { Map, Heart, Scale, User } from 'lucide-react';

interface BottomNavProps {
  active: 'map' | 'favorites' | 'compare' | 'profile';
  onChange: (tab: 'map' | 'favorites' | 'compare' | 'profile') => void;
  favoriteCount: number;
  compareCount: number;
}

export default function BottomNav({ active, onChange, favoriteCount, compareCount }: BottomNavProps) {
  const tabs = [
    { id: 'map' as const, icon: Map, label: 'Map' },
    { id: 'favorites' as const, icon: Heart, label: 'Favorites', badge: favoriteCount },
    { id: 'compare' as const, icon: Scale, label: 'Compare', badge: compareCount },
    { id: 'profile' as const, icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-lg dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
                isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <div className="relative">
                <Icon size={22} className={isActive ? 'fill-current' : ''} />
                {tab.badge ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
