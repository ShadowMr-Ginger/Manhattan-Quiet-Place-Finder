import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { mockQuietPlaces } from './data/mockQuietPlaces';
import { useFavorites } from './hooks/useFavorites';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import MapView from './pages/MapView';
import PlaceDetail from './pages/PlaceDetail';
import FavoritesView from './pages/FavoritesView';
import CompareView from './pages/CompareView';
import ProfileView from './pages/ProfileView';
import BottomNav from './components/BottomNav';
import type { PlaceType, QuietPlace } from './types/quietPlace';
import './index.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const { favorites, saved, toggleFavorite, toggleSaved } = useFavorites();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<PlaceType[]>([]);

  const handleSelectPlace = (place: QuietPlace) => {
    setSelectedId(place.id);
    navigate(`/place/${place.id}`);
  };

  const toggleType = (type: PlaceType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const activeTab = useMemo(() => {
    if (location.pathname === '/favorites') return 'favorites';
    if (location.pathname === '/compare') return 'compare';
    if (location.pathname === '/profile') return 'profile';
    return 'map';
  }, [location.pathname]);

  const hideNav = location.pathname.startsWith('/place/');

  return (
    <div className={`relative mx-auto flex h-svh w-full max-w-md flex-col overflow-hidden bg-slate-50 shadow-2xl dark:bg-slate-950 ${isDark ? 'dark' : ''}`}>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <MapView
                    places={mockQuietPlaces}
                    selectedId={selectedId}
                    onSelect={handleSelectPlace}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    search={search}
                    onSearchChange={setSearch}
                    selectedTypes={selectedTypes}
                    onToggleType={toggleType}
                  />
                </motion.div>
              }
            />
            <Route
              path="/place/:id"
              element={
                <PlaceDetail
                  favorites={favorites}
                  saved={saved}
                  onToggleFavorite={toggleFavorite}
                  onToggleSaved={toggleSaved}
                />
              }
            />
            <Route
              path="/favorites"
              element={
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
                  <FavoritesView favorites={favorites} saved={saved} onToggleFavorite={toggleFavorite} />
                </motion.div>
              }
            />
            <Route
              path="/compare"
              element={
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
                  <CompareView />
                </motion.div>
              }
            />
            <Route
              path="/profile"
              element={
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
                  <ProfileView favorites={favorites} saved={saved} />
                </motion.div>
              }
            />
          </Routes>
        </AnimatePresence>
      </div>

      {!hideNav && (
        <BottomNav
          active={activeTab}
          onChange={(tab) => {
            const path = tab === 'map' ? '/' : `/${tab}`;
            navigate(path);
          }}
          favoriteCount={favorites.length}
          compareCount={0}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
