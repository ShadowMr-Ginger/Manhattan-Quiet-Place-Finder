/* global google */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { useLanguage } from '../language/useLanguage'
import { geocodeSearchToOrigin } from '../utils/geocodeSearch'
import { MANHATTAN_BOUNDS } from '../utils/mapBounds'

function readAutocompleteValue(element) {
  if (!element) return ''
  if (typeof element.value === 'string') return element.value
  return element.querySelector('input')?.value ?? ''
}

function applyGmpElementStyles(element) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  Object.assign(element.style, {
    width: '100%',
    height: '40px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    boxShadow: 'none',
    fontFamily: 'inherit',
    fontSize: '14px',
    color: 'inherit',
  })
  element.style.colorScheme = dark ? 'dark' : 'light'
}

function writeAutocompleteValue(element, value) {
  if (!element) return
  if ('value' in element) {
    element.value = value
    return
  }
  const input = element.querySelector('input')
  if (input) input.value = value
}

export function UnifiedSearchBar({
  searchOrigin,
  venueFilter,
  searchInputRevision,
  onOriginSelect,
  onSearch,
  onSearchSubmit,
  onClear,
}) {
  const { t } = useLanguage()
  const inputRef = useRef(null)
  const acContainerRef = useRef(null)
  const acElementRef = useRef(null)
  const placesLib = useMapsLibrary('places')
  const onOriginSelectRef = useRef(onOriginSelect)
  const onSearchRef = useRef(onSearch)
  const onSearchSubmitRef = useRef(onSearchSubmit)
  const onClearRef = useRef(onClear)
  const [autocompleteMode, setAutocompleteMode] = useState('loading')

  useEffect(() => {
    onOriginSelectRef.current = onOriginSelect
  }, [onOriginSelect])

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    onSearchSubmitRef.current = onSearchSubmit
  }, [onSearchSubmit])

  useEffect(() => {
    onClearRef.current = onClear
  }, [onClear])

  useEffect(() => {
    if (!placesLib) return undefined

    if (placesLib.PlaceAutocompleteElement) {
      setAutocompleteMode('new')
      return undefined
    }

    setAutocompleteMode('legacy')
    return undefined
  }, [placesLib])

  const resolveAndSubmit = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Prefer in-app venues, then address geocode (see App handleSearchSubmit).
    if (onSearchSubmitRef.current) {
      await onSearchSubmitRef.current(trimmed)
      return
    }

    const origin = await geocodeSearchToOrigin(trimmed)
    if (origin) {
      onOriginSelectRef.current?.(origin)
      return
    }
    onSearchRef.current?.(trimmed)
  }, [])

  useEffect(() => {
    if (autocompleteMode !== 'new' || !placesLib || !acContainerRef.current) return undefined

    if (acElementRef.current) {
      try { acContainerRef.current.removeChild(acElementRef.current) } catch {}
      acElementRef.current = null
    }

    const element = new placesLib.PlaceAutocompleteElement({
      componentRestrictions: { country: 'us' },
      locationBias: {
        west: MANHATTAN_BOUNDS.west,
        south: MANHATTAN_BOUNDS.south,
        east: MANHATTAN_BOUNDS.east,
        north: MANHATTAN_BOUNDS.north,
      },
    })

    // Hide Google's built-in clear — we render one app clear button instead.
    element.noClearButton = true
    element.setAttribute('no-clear-button', '')
    element.placeholder = t('unifiedSearchPlaceholder')
    applyGmpElementStyles(element)
    acElementRef.current = element
    acContainerRef.current.appendChild(element)

    const handleSelect = async (event) => {
      try {
        const place = event.placePrediction.toPlace()
        await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] })
        const location = place.location
        if (!location) return
        onOriginSelectRef.current?.({
          lat: location.lat(),
          lng: location.lng(),
          label: place.formattedAddress || place.displayName?.text || '',
        })
      } catch (error) {
        console.warn('PlaceAutocompleteElement select failed', error)
      }
    }

    const handleEnter = (event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      const text = readAutocompleteValue(element).trim()
      if (text) void resolveAndSubmit(text)
    }

    const handleInput = () => {
      if (!readAutocompleteValue(element).trim()) onClearRef.current?.()
    }

    element.addEventListener('gmp-placeselect', handleSelect)
    element.addEventListener('keydown', handleEnter)
    element.addEventListener('input', handleInput)
    element.addEventListener('gmp-clear', handleInput)

    return () => {
      element.removeEventListener('gmp-placeselect', handleSelect)
      element.removeEventListener('keydown', handleEnter)
      element.removeEventListener('input', handleInput)
      element.removeEventListener('gmp-clear', handleInput)
      try { acContainerRef.current?.removeChild(element) } catch {}
      acElementRef.current = null
    }
  }, [autocompleteMode, placesLib, t, resolveAndSubmit])

  useEffect(() => {
    if (autocompleteMode !== 'legacy' || !placesLib || !inputRef.current) return undefined

    const bounds = new google.maps.LatLngBounds(
      { lat: MANHATTAN_BOUNDS.south, lng: MANHATTAN_BOUNDS.west },
      { lat: MANHATTAN_BOUNDS.north, lng: MANHATTAN_BOUNDS.east },
    )
    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: ['geometry', 'formatted_address', 'name'],
      componentRestrictions: { country: 'us' },
      bounds,
      strictBounds: false,
    })
    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const location = place.geometry?.location
      if (!location) return
      onOriginSelectRef.current?.({
        lat: location.lat(),
        lng: location.lng(),
        label: place.formatted_address || place.name || '',
      })
    })
    return () => { listener.remove() }
  }, [autocompleteMode, placesLib])

  useEffect(() => {
    const value = searchOrigin?.label ?? venueFilter ?? ''
    if (autocompleteMode === 'new') {
      writeAutocompleteValue(acElementRef.current, value)
      return
    }
    if (inputRef.current) inputRef.current.value = value
  }, [searchOrigin, venueFilter, searchInputRevision, autocompleteMode])

  const submitSearch = useCallback(() => {
    const text =
      autocompleteMode === 'new'
        ? readAutocompleteValue(acElementRef.current).trim()
        : (inputRef.current?.value.trim() ?? '')
    if (!text) return
    void resolveAndSubmit(text)
  }, [autocompleteMode, resolveAndSubmit])

  const handleClear = (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    if (autocompleteMode === 'new') {
      writeAutocompleteValue(acElementRef.current, '')
      // Drop focus so an open prediction list cannot "confirm" on clear click.
      acElementRef.current?.blur?.()
      acElementRef.current?.querySelector?.('input')?.blur?.()
    } else if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.blur()
    }
    onClear?.()
  }

  const hasActiveSearch = Boolean(searchOrigin || venueFilter.trim())
  const showLegacyInput = autocompleteMode !== 'new'
  // Single clear control: Google clear is disabled via no-clear-button.
  const showAppClear = hasActiveSearch

  return (
    <div className={`unified-search ${hasActiveSearch ? 'has-active' : ''}`}>
      <div className="unified-search-row">
        <div className="unified-search-field">
          {showLegacyInput && <Search size={18} className="search-icon" aria-hidden />}

          <div
            ref={acContainerRef}
            className={`unified-search-ac-container ${showLegacyInput ? 'hidden' : ''}`}
          />

          {showLegacyInput && (
            <input
              ref={inputRef}
              type="text"
              className="search-input unified-search-input"
              placeholder={t('unifiedSearchPlaceholder')}
              spellCheck={false}
              autoComplete="off"
              defaultValue={searchOrigin?.label ?? venueFilter ?? ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitSearch()
                }
              }}
            />
          )}

          {showAppClear && (
            <button
              type="button"
              className="unified-search-clear"
              aria-label={t('resetFilters')}
              // Prevent autocomplete from treating this as a prediction select.
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={handleClear}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="unified-search-btn"
          onClick={submitSearch}
          aria-label={t('search')}
          title={t('search')}
        >
          <Search size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
