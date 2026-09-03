import { LeftSidebar } from './LeftSidebar'
import { ManhattanMap } from './ManhattanMap'
import { RightPanel } from './RightPanel'
import { useLocalizedPlaces } from '../hooks/useLocalizedPlaces'

export function MapsLayout({
  language,
  venues,
  setVenues,
  filteredPlaces,
  activePlace,
  syncedSaved,
  syncedRecent,
  panelVisible,
  searchOrigin,
  venueFilter,
  searchInputRevision,
  onOriginSelect,
  onSearch,
  onSearchSubmit,
  onSearchClear,
  visibleRecentSearches,
  onRecentClick,
  onRemoveRecent,
  activeFilters,
  crowdednessFilter,
  onCrowdednessFilterChange,
  quietInsideFilter,
  onQuietInsideFilterChange,
  openNowOnly,
  onOpenNowChange,
  openHorizonHours,
  onOpenHorizonChange,
  minRating,
  onMinRatingChange,
  wheelchairOnly,
  onWheelchairChange,
  placeFocusZoom = true,
  onToggleFilter,
  focusedPlaceId,
  onSelectPlace,
  placeFocusNonce = 0,
  onResetAll,
  onOpenChat,
  hoveredId,
  onHover,
  onClearSelection,
  darkMode,
  userLocation,
  usingGps,
  onLocateMe,
  rightPanelMode,
  activePlaceUserReviews,
  isSaved,
  user,
  onBack,
  onClose,
  onToggleSave,
  onRequireAuth,
  onAddReview,
  onDeleteReview,
  onCloseChat,
}) {
  useLocalizedPlaces({
    venues,
    setVenues,
    language,
    filteredPlaces,
    selectedPlace: activePlace,
    savedPlaces: syncedSaved,
    recentPlaces: syncedRecent,
    enabled: true,
  })

  return (
    <main className={`main-layout ${panelVisible ? 'panel-open' : ''}`}>
      <LeftSidebar
        searchOrigin={searchOrigin}
        venueFilter={venueFilter}
        searchInputRevision={searchInputRevision}
        onOriginSelect={onOriginSelect}
        onSearch={onSearch}
        onSearchSubmit={onSearchSubmit}
        onSearchClear={onSearchClear}
        recentSearches={visibleRecentSearches}
        onRecentClick={onRecentClick}
        onRemoveRecent={onRemoveRecent}
        activeFilters={activeFilters}
        crowdednessFilter={crowdednessFilter}
        onCrowdednessFilterChange={onCrowdednessFilterChange}
        quietInsideFilter={quietInsideFilter}
        onQuietInsideFilterChange={onQuietInsideFilterChange}
        openNowOnly={openNowOnly}
        onOpenNowChange={onOpenNowChange}
        openHorizonHours={openHorizonHours}
        onOpenHorizonChange={onOpenHorizonChange}
        minRating={minRating}
        onMinRatingChange={onMinRatingChange}
        wheelchairOnly={wheelchairOnly}
        onWheelchairChange={onWheelchairChange}
        onToggleFilter={onToggleFilter}
        places={filteredPlaces}
        selectedPlace={activePlace}
        focusedPlaceId={focusedPlaceId}
        onSelectPlace={onSelectPlace}
        onResetAll={onResetAll}
        onOpenChat={onOpenChat}
      />

      <ManhattanMap
        places={filteredPlaces}
        selectedPlace={activePlace}
        placeFocusNonce={placeFocusNonce}
        hoveredId={hoveredId}
        onHover={onHover}
        onSelect={(place) => onSelectPlace(place, { scrollList: true })}
        onClearSelection={onClearSelection}
        darkMode={darkMode}
        userLocation={userLocation}
        usingGps={usingGps}
        onLocateMe={onLocateMe}
        searchOrigin={searchOrigin}
        placeFocusZoom={placeFocusZoom}
      />

      <RightPanel
        mode={rightPanelMode}
        selectedPlace={activePlace}
        userReviews={activePlaceUserReviews}
        isSaved={isSaved}
        user={user}
        onBack={onBack}
        onClose={onClose}
        onToggleSave={onToggleSave}
        onRequireAuth={onRequireAuth}
        onAddReview={onAddReview}
        onDeleteReview={onDeleteReview}
        currentUser={user}
        onCloseChat={onCloseChat}
        onSelectPlace={onSelectPlace}
      />
    </main>
  )
}
