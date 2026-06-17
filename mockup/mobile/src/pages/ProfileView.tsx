import { Heart, Bookmark, Clock, MapPin, Star, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockUserProfile } from '../data/mockQuietPlaces';

interface ProfileViewProps {
  favorites: string[];
  saved: string[];
}

export default function ProfileView({ favorites, saved }: ProfileViewProps) {
  const navigate = useNavigate();

  const menuItems = [
    { icon: Heart, label: 'Favorites', count: favorites.length, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/20' },
    { icon: Bookmark, label: 'Saved Places', count: saved.length, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20' },
    { icon: Clock, label: 'Recently Viewed', count: 5, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20' },
    { icon: Star, label: 'My Reviews', count: 2, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 pb-28 pt-6 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Profile</h1>

      {/* User card */}
      <div className="mt-6 rounded-3xl bg-gradient-to-br from-sky-400 to-teal-400 p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <img
            src={mockUserProfile.avatar}
            alt={mockUserProfile.username}
            className="h-16 w-16 rounded-full border-2 border-white/50 bg-white"
          />
          <div>
            <h2 className="text-lg font-bold">{mockUserProfile.username}</h2>
            <p className="text-xs text-white/80">Quiet explorer in Manhattan</p>
          </div>
        </div>
        <div className="mt-5 flex justify-between text-center">
          <div>
            <p className="text-xl font-extrabold">{favorites.length}</p>
            <p className="text-[10px] text-white/80">Favorites</p>
          </div>
          <div>
            <p className="text-xl font-extrabold">{saved.length}</p>
            <p className="text-[10px] text-white/80">Saved</p>
          </div>
          <div>
            <p className="text-xl font-extrabold">12</p>
            <p className="text-[10px] text-white/80">Visited</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="mt-6 flex flex-col gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => item.label === 'Favorites' ? navigate('/favorites') : undefined}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-slate-800"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
                <Icon size={20} className={item.color} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.count} items</p>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          );
        })}
      </div>

      {/* Location */}
      <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
        <MapPin size={18} className="text-slate-400" />
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Current Location</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Manhattan, New York</p>
        </div>
      </div>
    </div>
  );
}
