import { useState } from 'react'
import {
  Accessibility,
  ChevronDown,
  Clock,
  MessageCircle,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import {
  FILTER_TYPES,
  OPEN_HORIZON_OPTIONS,
  RATING_STOPS,
  VENUE_TYPES,
} from '../data/constants'
import { useLanguage } from '../language/useLanguage'
import { PlaceCard } from './PlaceCard'
import { EmptyState } from './EmptyState'
import { CrowdednessFilterSlider } from './CrowdednessFilterSlider'
import { QuietInsideFilterSlider } from './QuietInsideFilterSlider'
import { UnifiedSearchBar } from './UnifiedSearchBar'

export function LeftSidebar({
  searchOrigin,
  venueFilter,
  searchInputRevision,
  onOriginSelect,
  onSearch,
  onSearchSubmit,
  onSearchClear,
  recentSearches,
  onRecentClick,
  onRemoveRecent,
  activeFilters,
  crowdednessFilter,
  onCrowdednessFilterChange,
  quietInsideFilter,
  onQuietInsideFilterChange,
  openNowOnly,
  onOpenNowChange,
  openHorizonHours = 0,
  onOpenHorizonChange,
  minRating,
  onMinRatingChange,
  wheelchairOnly,
  onWheelchairChange,
  onToggleFilter,
  places,
  selectedPlace,
  focusedPlaceId,
  onSelectPlace,
  onResetAll,
  onOpenChat,
}) {
  const { t } = useLanguage()
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  const hasCrowdednessFilter =
    crowdednessFilter != null && crowdednessFilter !== 'high'
  const hasQuietInsideFilter =
    quietInsideFilter != null && quietInsideFilter !== 'any'
  const moreFilterCount = [
    hasCrowdednessFilter,
    hasQuietInsideFilter,
    openNowOnly,
    wheelchairOnly,
    minRating != null,
  ].filter(Boolean).length

  const hasActiveFilters =
    Boolean(searchOrigin) ||
    venueFilter.trim() !== '' ||
    activeFilters.length > 0 ||
    moreFilterCount > 0

  return (
    <aside className="left-sidebar glass">
      <UnifiedSearchBar
        searchOrigin={searchOrigin}
        venueFilter={venueFilter}
        searchInputRevision={searchInputRevision}
        onOriginSelect={onOriginSelect}
        onSearch={onSearch}
        onSearchSubmit={onSearchSubmit}
        onClear={onSearchClear}
      />

      {recentSearches.length > 0 && (
        <div className="recent-searches">
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              className="recent-chip"
              title={term}
              onClick={() => onRecentClick(term)}
            >
              {term}
              <span
                className="chip-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveRecent(term)
                }}
              >
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="filter-group filter-group--compact">
        <div className="filters">
          {FILTER_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`filter-chip ${activeFilters.includes(type) ? 'active' : ''}`}
              style={
                activeFilters.includes(type)
                  ? { borderColor: VENUE_TYPES[type].color, color: VENUE_TYPES[type].color }
                  : {}
              }
              onClick={() => onToggleFilter(type)}
            >
              {t(`venueTypes.${type}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={`filters-drawer ${moreFiltersOpen ? 'open' : ''}`}>
        <div className="filters-toolbar">
          <button
            type="button"
            className={`more-filters-toggle ${moreFiltersOpen ? 'open' : ''} ${moreFilterCount > 0 ? 'has-active' : ''}`}
            aria-expanded={moreFiltersOpen}
            onClick={() => setMoreFiltersOpen((open) => !open)}
          >
            <SlidersHorizontal size={14} />
            <span>{moreFiltersOpen ? t('hideFilters') : t('moreFilters')}</span>
            {moreFilterCount > 0 && (
              <span className="more-filters-count">{moreFilterCount}</span>
            )}
            <ChevronDown size={14} className="more-filters-chevron" />
          </button>
          {hasActiveFilters && (
            <button type="button" className="reset-filters-btn reset-filters-btn--inline" onClick={onResetAll}>
              <RotateCcw size={14} />
              {t('resetFilters')}
            </button>
          )}
        </div>

        {moreFiltersOpen && (
          <div className="more-filters-panel">
            <div className="filter-group">
              <CrowdednessFilterSlider
                label={t('filterByCrowdedness')}
                value={crowdednessFilter}
                onChange={onCrowdednessFilterChange}
              />
            </div>

            <div className="filter-group">
              <QuietInsideFilterSlider
                label={t('filterByQuietInside')}
                value={quietInsideFilter}
                onChange={onQuietInsideFilterChange}
              />
            </div>

            <div className="filter-group more-filters-toggles">
              <label className="open-now-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(openNowOnly)}
                  onChange={(e) => onOpenNowChange(e.target.checked)}
                />
                <Clock size={14} />
                <span className="open-now-toggle-label">{t('filterOpenNow')}</span>
              </label>
              {openNowOnly && (
                <div className="open-horizon-row" role="group" aria-label={t('filterOpenHorizon')}>
                  {OPEN_HORIZON_OPTIONS.map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      className={`open-horizon-chip ${openHorizonHours === hours ? 'active' : ''}`}
                      onClick={() => onOpenHorizonChange?.(hours)}
                    >
                      {hours === 0 ? t('timeNow') : `+${hours}h`}
                    </button>
                  ))}
                </div>
              )}

              <label className="open-now-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(wheelchairOnly)}
                  onChange={(e) => onWheelchairChange?.(e.target.checked)}
                />
                <Accessibility size={14} />
                <span className="open-now-toggle-label">{t('filterWheelchair')}</span>
              </label>
            </div>

            <div className="filter-group">
              <span className="filter-label">{t('filterByRating')}</span>
              <div className="rating-filter-row">
                {RATING_STOPS.map((stop) => (
                  <button
                    key={String(stop)}
                    type="button"
                    className={`open-horizon-chip ${minRating === stop ? 'active' : ''}`}
                    onClick={() => onMinRatingChange?.(stop)}
                  >
                    {stop == null ? t('ratingAny') : `${stop}+`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="place-list">
        {places.length === 0 ? (
          <EmptyState />
        ) : (
          places.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              selected={selectedPlace?.id === place.id}
              focused={focusedPlaceId === place.id}
              onSelect={() => onSelectPlace(place, { scrollList: false })}
            />
          ))
        )}
      </div>

      <button type="button" className="chat-fab" onClick={onOpenChat}>
        <MessageCircle size={20} />
        {t('askAi')}
      </button>
    </aside>
  )
}
