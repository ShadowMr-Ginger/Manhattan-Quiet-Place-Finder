import { useMemo, useState } from 'react';
import MobileMap from '../components/MobileMap';
import BottomSheet from '../components/BottomSheet';
import SearchHeader from '../components/SearchHeader';
import PlaceCard from '../components/PlaceCard';
import type { QuietPlace, PlaceType } from '../types/quietPlace';

interface MapViewProps {
  places: QuietPlace[];
  selectedId: string | null;
  onSelect: (place: QuietPlace) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedTypes: PlaceType[];
  onToggleType: (type: PlaceType) => void;
}

export default function MapView({
  places,
  selectedId,
  onSelect,
  favorites,
  onToggleFavorite,
  search,
  onSearchChange,
  selectedTypes,
  onToggleType,
}: MapViewProps) {
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const filtered = useMemo(() => {
    return places
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.address.toLowerCase().includes(search.toLowerCase()) ||
          p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(p.type);
        return matchesSearch && matchesType;
      })
      .sort((a, b) => a.distance - b.distance);
  }, [places, search, selectedTypes]);

  return (
    <div className="relative h-full w-full">
      <SearchHeader
        value={search}
        onChange={onSearchChange}
        selectedTypes={selectedTypes}
        onToggleType={onToggleType}
      />
      <MobileMap places={filtered} selectedId={selectedId} onSelect={onSelect} />
      <BottomSheet
        title={`${filtered.length} quiet place${filtered.length !== 1 ? 's' : ''} nearby`}
        expanded={sheetExpanded}
        onExpandChange={setSheetExpanded}
      >
        <div className="flex flex-col gap-3 pb-8">
          {filtered.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              isFavorite={favorites.includes(place.id)}
              onFavorite={onToggleFavorite}
              onClick={() => onSelect(place)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No places found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
