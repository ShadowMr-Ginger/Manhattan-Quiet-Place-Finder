import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LoadingSkeleton from './components/LoadingSkeleton'
import { TopNav } from './components/TopNav'
import { GoogleMapsProvider } from './components/GoogleMapsProvider'
import { MapsLayout } from './components/MapsLayout'
import { CROWDEDNESS_LEVELS, MAX_RECENT_SEARCHES } from './data/constants'
import { haversineDistanceKm, roundDistanceKm } from './utils/geo'
import { useUserLocation } from './hooks/useUserLocation'
import { syncPlacesByIds } from './utils/places'
import { placeMatchesSearch } from './utils/localizePlaces'
import { geocodeSearchToOrigin } from './utils/geocodeSearch'
import { mergeUserRatingIntoPlace } from './utils/userRating'
import { isOpenThroughout } from './utils/openingHours'
import { isWheelchairAccessible } from './utils/accessibility'
import { useLanguage } from './language/useLanguage'
import { enrichPlacesFromQuietProfile, enrichPlacesFromGoogleRatings, fetchVenueDetail, hydratePlacesFromGoogleCache, loadVenues } from './services/venues'
import { addReview as addUserReview, deleteReview, fetchMyReviews, getReviewsForVenue } from './services/userReviews'
import {
  getSession,
  login,
  logout,
  signup,
  validateSession,
  verifyEmail,
} from './services/auth'
import {
  addSaved,
  fetchRecent,
  fetchSaved,
  recordRecentView,
  removeSaved,
} from './services/userLists'
import './App.css'

const THEME_STORAGE_KEY = 'hushhub_theme'

function getInitialDarkMode() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  const dark = saved === 'dark'
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  return dark
}

function getInitialAuth() {
  const session = getSession()
  if (!session) {
    return { user: null }
  }
  return { user: session }
}

const initialAuth = getInitialAuth()

export default function App() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [venues, setVenues] = useState([])
  const [fadeIn, setFadeIn] = useState(false)
  const [darkMode, setDarkMode] = useState(getInitialDarkMode)
  const [user, setUser] = useState(initialAuth.user)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [searchOrigin, setSearchOrigin] = useState(null)
  const [venueFilter, setVenueFilter] = useState('')
  const [recentSearches, setRecentSearches] = useState(['library', 'coffee'])
  const [searchInputRevision, setSearchInputRevision] = useState(0)
  const [placeFocusNonce, setPlaceFocusNonce] = useState(0)
  const [activeFilters, setActiveFilters] = useState([])
  const [crowdednessFilter, setCrowdednessFilter] = useState(null)
  const [quietInsideFilter, setQuietInsideFilter] = useState(null)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [openHorizonHours, setOpenHorizonHours] = useState(0)
  const [minRating, setMinRating] = useState(null)
  const [wheelchairOnly, setWheelchairOnly] = useState(false)
  const [placeFocusZoom, setPlaceFocusZoom] = useState(true)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [focusedPlaceId, setFocusedPlaceId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [myReviews, setMyReviews] = useState([])
  const [saved, setSaved] = useState([])
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [rightPanelMode, setRightPanelMode] = useState('empty')
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [reviewsVersion, setReviewsVersion] = useState(0)
  const [activePlaceUserReviews, setActivePlaceUserReviews] = useState([])
  const { userLocation, usingGps, requestLocation } = useUserLocation()
  const { language } = useLanguage()
  const venueLoadIdRef = useRef(0)
  const quietInsideEnrichStartedRef = useRef(false)
  const enrichPatchTimerRef = useRef(null)
  const enrichPatchQueueRef = useRef(new Map())

  const flushEnrichPatches = useCallback(() => {
    enrichPatchTimerRef.current = null
    const batch = enrichPatchQueueRef.current
    if (!batch.size) return
    enrichPatchQueueRef.current = new Map()
    setVenues((prev) =>
      prev.map((place) => {
        const updated = batch.get(place.id)
        if (!updated) return place
        return {
          ...place,
          crowdedness: updated.crowdedness ?? place.crowdedness,
          currentPct: updated.currentPct ?? place.currentPct,
          quietInside: updated.quietInside ?? place.quietInside,
          openingHours: updated.openingHours ?? place.openingHours,
          openingPeriods: updated.openingPeriods ?? place.openingPeriods,
          openingWeekdayText:
            updated.openingWeekdayText ?? place.openingWeekdayText,
          googleRating: updated.googleRating ?? place.googleRating,
          googleRatingCount: updated.googleRatingCount ?? place.googleRatingCount,
          userRating: updated.userRating ?? place.userRating,
          userReviewCount: updated.userReviewCount ?? place.userReviewCount,
          rating: updated.rating ?? place.rating,
        }
      }),
    )
  }, [])

  const queueEnrichPatch = useCallback(
    (updated) => {
      enrichPatchQueueRef.current.set(updated.id, {
        ...enrichPatchQueueRef.current.get(updated.id),
        ...updated,
      })
      if (enrichPatchTimerRef.current == null) {
        enrichPatchTimerRef.current = window.setTimeout(flushEnrichPatches, 120)
      }
    },
    [flushEnrichPatches],
  )

  const allPlaces = venues
  const venuesRef = useRef(venues)
  venuesRef.current = venues

  useEffect(() => {
    let cancelled = false

    validateSession()
      .then(async (sessionUser) => {
        if (cancelled) return
        setUser(sessionUser)
        if (!sessionUser) return

        const [reviewList, savedList, recentList] = await Promise.all([
          fetchMyReviews().catch(() => []),
          fetchSaved().catch(() => []),
          fetchRecent().catch(() => []),
        ])
        if (!cancelled) {
          setMyReviews(reviewList)
          setSaved(savedList)
          setRecentlyViewed(recentList)
        }
      })
      .catch(() => {})

    // Handle ?verify= and ?reset= URL params on first load
    const params = new URLSearchParams(window.location.search)
    const verifyToken = params.get('verify')
    const resetToken = params.get('reset')

    if (verifyToken) {
      window.history.replaceState({}, '', window.location.pathname)
      verifyEmail(verifyToken)
        .then(() => {
          setAuthMode('verify-success')
          setShowAuth(true)
        })
        .catch(() => {
          setAuthMode('verify-error')
          setShowAuth(true)
        })
    } else if (resetToken) {
      setAuthMode('reset')
      setShowAuth(true)
    }

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadId = ++venueLoadIdRef.current
    quietInsideEnrichStartedRef.current = false

    async function loadVenueData() {
      try {
        const loadedVenues = hydratePlacesFromGoogleCache(
          await loadVenues({ language }),
        )
        if (cancelled || loadId !== venueLoadIdRef.current) return

        setVenues(loadedVenues)
        setLoadError(null)
        setLoading(false)

        const patchVenue = (updated) => {
          if (cancelled || loadId !== venueLoadIdRef.current) return
          queueEnrichPatch(updated)
        }

        // Only fetch Google for places still missing after cache hydrate.
        // Priority: first screen of the list, then the rest in background.
        // Never block the UI on Places — stars fill in as responses arrive.
        const needsGoogle = loadedVenues.filter(
          (place) =>
            place.placeId &&
            (place.googleRating == null || place.openingPeriods == null),
        )
        const priorityIds = needsGoogle.slice(0, 40).map((place) => place.id)
        if (priorityIds.length) {
          void enrichPlacesFromGoogleRatings(loadedVenues, {
            concurrency: 8,
            placeIds: priorityIds,
            onPlaceUpdate: patchVenue,
          }).then(() => {
            if (cancelled || loadId !== venueLoadIdRef.current) return
            if (needsGoogle.length > priorityIds.length) {
              void enrichPlacesFromGoogleRatings(loadedVenues, {
                concurrency: 4,
                onPlaceUpdate: patchVenue,
              })
            }
          })
        }
      } catch (error) {
        if (cancelled || loadId !== venueLoadIdRef.current) return
        setLoadError(error instanceof Error ? error.message : 'Failed to load venues')
        setLoading(false)
      }
    }

    loadVenueData()

    return () => {
      cancelled = true
      if (enrichPatchTimerRef.current != null) {
        window.clearTimeout(enrichPatchTimerRef.current)
        enrichPatchTimerRef.current = null
      }
    }
  }, [language, queueEnrichPatch])

  // Indoor-quiet filter needs calm_bar from quiet-profile. Only fan out when
  // the user actually engages that filter, not on every cold load.
  useEffect(() => {
    if (loading) return
    if (!quietInsideFilter || quietInsideFilter === 'any') return
    if (quietInsideEnrichStartedRef.current) return
    const list = venuesRef.current
    if (!list.length) return
    quietInsideEnrichStartedRef.current = true

    const loadId = venueLoadIdRef.current
    enrichPlacesFromQuietProfile(list, {
      concurrency: 4,
      onPlaceUpdate: (updated) => {
        if (loadId !== venueLoadIdRef.current) return
        queueEnrichPatch(updated)
      },
    })
  }, [loading, quietInsideFilter, queueEnrichPatch])

  useEffect(() => {
    if (loading) return
    requestAnimationFrame(() => setFadeIn(true))
  }, [loading])

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [darkMode])

  const distanceOrigin = searchOrigin ?? userLocation

  const placesWithDistance = useMemo(() => {
    return allPlaces.map((place) => ({
      ...place,
      distance: roundDistanceKm(
        haversineDistanceKm(
          distanceOrigin.lat,
          distanceOrigin.lng,
          place.lat,
          place.lng,
        ),
      ),
    }))
  }, [allPlaces, distanceOrigin])

  const syncedSaved = useMemo(
    () => syncPlacesByIds(saved, placesWithDistance),
    [saved, placesWithDistance],
  )
  const syncedRecent = useMemo(
    () => syncPlacesByIds(recentlyViewed, placesWithDistance),
    [recentlyViewed, placesWithDistance],
  )
  const activePlace = useMemo(
    () =>
      selectedPlace
        ? placesWithDistance.find((p) => p.id === selectedPlace.id) ?? selectedPlace
        : null,
    [selectedPlace, placesWithDistance],
  )

  const filteredPlaces = useMemo(() => {
    const sortByDistance = Boolean(searchOrigin) || usingGps

    return placesWithDistance
      .filter((place) => {
      const matchesSearch = placeMatchesSearch(place, venueFilter)

      const matchesFilter =
        activeFilters.length === 0 || activeFilters.includes(place.type)

      // Max busy level: selecting Moderate keeps Not Crowded + Moderate.
      const matchesCrowdedness = (() => {
        if (!crowdednessFilter || crowdednessFilter === 'high') return true
        if (!place.crowdedness) return false
        return (
          CROWDEDNESS_LEVELS.indexOf(place.crowdedness) <=
          CROWDEDNESS_LEVELS.indexOf(crowdednessFilter)
        )
      })()

      // Indoor quiet. Independent of busyness (Spearman |rho| <= 0.16 against
      // every environmental signal), so the two filters AND together and each
      // one still narrows the result meaningfully.
      const matchesQuietInside = (() => {
        if (!quietInsideFilter || quietInsideFilter === 'any') return true
        // Unknown is not the same as "not quiet": 166 of 326 venues have no
        // indoor signal. Keep them until the user explicitly asks for
        // reviewer-confirmed quiet.
        if (quietInsideFilter === 'notLively') return place.quietInside !== 'lively'
        return place.quietInside === 'calm'
      })()

      // Open now. Recomputed here rather than read from place.openNow so it
      // stays correct as the clock moves past a closing time.
      // null (no published hours) is kept visible — only confirmed-closed and
      // permanently/temporarily closed venues are hidden.
      // Open now, optionally for a few hours ahead. `null` (hours unknown) is
      // kept visible; only a confirmed closure inside the window excludes.
      const matchesOpenNow =
        !openNowOnly || isOpenThroughout(place, openHorizonHours) !== false

      // Rating. A venue whose Google rating hasn't arrived yet stays visible so
      // the list doesn't shrink and regrow while enrichment runs.
      const matchesRating =
        minRating == null ||
        place.googleRating == null ||
        place.googleRating >= minRating

      // Wheelchair access is the one filter that EXCLUDES unknowns. Everywhere
      // else an unsurveyed venue stays visible; here a false positive means a
      // wheelchair user travels somewhere they cannot get into.
      const matchesWheelchair = !wheelchairOnly || isWheelchairAccessible(place)

      return (
        matchesSearch &&
        matchesFilter &&
        matchesCrowdedness &&
        matchesQuietInside &&
        matchesOpenNow &&
        matchesRating &&
        matchesWheelchair
      )
      })
      .sort((a, b) => {
        if (sortByDistance) {
          if (a.distance !== b.distance) return a.distance - b.distance
          return b.rankingScore - a.rankingScore
        }
        if (b.rankingScore !== a.rankingScore) {
          return b.rankingScore - a.rankingScore
        }
        return a.distance - b.distance
      })
  }, [
    venueFilter,
    activeFilters,
    crowdednessFilter,
    quietInsideFilter,
    openNowOnly,
    openHorizonHours,
    minRating,
    wheelchairOnly,
    placesWithDistance,
    searchOrigin,
    usingGps,
  ])

  useEffect(() => {
    if (!filteredPlaces.length) {
      // Keep focus while detail is open for a place currently filtered out
      // (e.g. jumped from AI before filters are cleared).
      if (selectedPlace?.id === focusedPlaceId) return
      setFocusedPlaceId(null)
      return
    }
    if (
      focusedPlaceId &&
      !filteredPlaces.some((place) => place.id === focusedPlaceId)
    ) {
      if (selectedPlace?.id === focusedPlaceId) return
      setFocusedPlaceId(filteredPlaces[0].id)
    }
  }, [filteredPlaces, focusedPlaceId, selectedPlace])

  const scrollListOnFocusRef = useRef(false)

  useEffect(() => {
    if (!focusedPlaceId || !scrollListOnFocusRef.current) return
    document
      .querySelector(`[data-place-id="${focusedPlaceId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    scrollListOnFocusRef.current = false
  }, [focusedPlaceId])

  const selectPlace = useCallback((place, options = {}) => {
    // Reveal on list/map: AI venues are often hidden by type/search/busy filters.
    if (place.type && activeFilters.length > 0 && !activeFilters.includes(place.type)) {
      setActiveFilters([])
    }
    if (venueFilter && !placeMatchesSearch(place, venueFilter)) {
      setVenueFilter('')
      setSearchInputRevision((n) => n + 1)
    }
    if (
      crowdednessFilter &&
      crowdednessFilter !== 'high' &&
      (!place.crowdedness ||
        CROWDEDNESS_LEVELS.indexOf(place.crowdedness) >
          CROWDEDNESS_LEVELS.indexOf(crowdednessFilter))
    ) {
      setCrowdednessFilter(null)
    }
    // Same reveal rule as busy level: never leave a selected venue invisible.
    if (
      quietInsideFilter &&
      quietInsideFilter !== 'any' &&
      ((quietInsideFilter === 'notLively' && place.quietInside === 'lively') ||
        (quietInsideFilter === 'calmOnly' && place.quietInside !== 'calm'))
    ) {
      setQuietInsideFilter(null)
    }
    if (openNowOnly && isOpenThroughout(place, openHorizonHours) === false) {
      setOpenNowOnly(false)
    }
    if (minRating != null && place.googleRating != null && place.googleRating < minRating) {
      setMinRating(null)
    }
    if (wheelchairOnly && !isWheelchairAccessible(place)) {
      setWheelchairOnly(false)
    }

    setSelectedPlace(place)
    setFocusedPlaceId(place.id)
    setHoveredId(place.id)
    setRightPanelMode('detail')
    setPlaceFocusNonce((n) => n + 1)
    // Map-marker clicks zoom in (the user asked to look closer there); list
    // clicks only pan, so browsing the list doesn't yank the map zoom level.
    setPlaceFocusZoom(options.scrollList !== false)
    scrollListOnFocusRef.current = options.scrollList !== false

    fetchVenueDetail(place.id, place, language)
      .then((enriched) => {
        const mergeRating = (current, next) => {
          if (!current) return next
          let merged = next

          const keepUser =
            (current.userReviewCount ?? 0) > 0 && current.userRating != null
          const nextHasUser =
            (next.userReviewCount ?? 0) > 0 && next.userRating != null
          if (keepUser && !nextHasUser) {
            merged = {
              ...merged,
              userRating: current.userRating,
              userReviewCount: current.userReviewCount,
              rating: current.rating,
            }
          }

          // Detail/chat payloads omit Google stars — keep list enrichment.
          if (current.googleRating != null && merged.googleRating == null) {
            merged = {
              ...merged,
              googleRating: current.googleRating,
              googleRatingCount: current.googleRatingCount ?? 0,
            }
          }

          return merged
        }

        setVenues((prev) => {
          const existing = prev.find((v) => v.id === enriched.id)
          const merged = mergeRating(existing ?? place, enriched)
          setSelectedPlace((sel) => (sel?.id === enriched.id ? merged : sel))
          if (existing) {
            return prev.map((v) => (v.id === merged.id ? merged : v))
          }
          // Chat payloads omit lat/lng — add full detail so map can mark it.
          return [...prev, merged]
        })
        setFocusedPlaceId(enriched.id)
        setPlaceFocusNonce((n) => n + 1)
      })
      .catch(() => {})

    if (user) {
      recordRecentView(place.id)
        .then(() => fetchRecent())
        .then(setRecentlyViewed)
        .catch(() => {})
    } else {
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((p) => p.id !== place.id)
        return [place, ...filtered].slice(0, 5)
      })
    }
  }, [
    activeFilters,
    crowdednessFilter,
    quietInsideFilter,
    openNowOnly,
    openHorizonHours,
    minRating,
    wheelchairOnly,
    language,
    user,
    venueFilter,
  ])

  const addRecentSearch = useCallback((term) => {
    if (!term.trim()) return
    setRecentSearches((prev) => {
      const filtered = prev.filter((t) => t !== term)
      return [term, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    })
  }, [])

  const handleSearch = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      if (searchOrigin?.label === trimmed) return
      setSearchOrigin(null)
      setVenueFilter(trimmed)
      addRecentSearch(trimmed)
    },
    [addRecentSearch, searchOrigin],
  )

  const handleOriginSelect = useCallback((origin) => {
    setSearchOrigin(origin)
    setVenueFilter('')
    if (origin?.label) addRecentSearch(origin.label)
  }, [addRecentSearch])

  /** Prefer in-app venue match; only geocode address when no venue hits. */
  const handleSearchSubmit = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!trimmed) return

      const term = trimmed.toLowerCase()
      const hasVenueMatch = venues.some((place) =>
        [place.name, place.canonicalName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      )
      if (hasVenueMatch) {
        handleSearch(trimmed)
        return
      }

      const origin = await geocodeSearchToOrigin(trimmed)
      if (origin) {
        handleOriginSelect(origin)
        return
      }

      handleSearch(trimmed)
    },
    [venues, handleSearch, handleOriginSelect],
  )

  const handleSearchClear = useCallback(() => {
    setSearchOrigin(null)
    setVenueFilter('')
    setSearchInputRevision((revision) => revision + 1)
  }, [])

  const handleLocateMe = useCallback(() => {
    // Use GPS as distance origin (not a leftover address search).
    setSearchOrigin(null)
    requestLocation()
  }, [requestLocation])

  const visibleRecentSearches = useMemo(
    () => recentSearches.slice(0, MAX_RECENT_SEARCHES),
    [recentSearches],
  )

  const handleRecentClick = useCallback(
    (term) => {
      void handleSearchSubmit(term)
      setSearchInputRevision((revision) => revision + 1)
    },
    [handleSearchSubmit],
  )

  const toggleFilter = (type) => {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  const requireAuth = useCallback((action) => {
    if (user) {
      action()
      return true
    }
    setAuthMode('login')
    setShowAuth(true)
    return false
  }, [user])

  const applyVenueUserRating = useCallback((venueId, stats) => {
    const patch = (place) =>
      place?.id === venueId ? mergeUserRatingIntoPlace(place, stats) : place

    setVenues((prev) => prev.map(patch))
    setSelectedPlace((prev) => patch(prev))
  }, [])

  useEffect(() => {
    if (!activePlace) {
      setActivePlaceUserReviews([])
      return
    }

    let cancelled = false
    getReviewsForVenue(activePlace.id)
      .then(({ items, averageRating, count }) => {
        if (cancelled) return
        setActivePlaceUserReviews(items)
        applyVenueUserRating(activePlace.id, { averageRating, count })
      })
      .catch(() => {
        if (!cancelled) setActivePlaceUserReviews([])
      })

    return () => {
      cancelled = true
    }
  }, [activePlace?.id, reviewsVersion, applyVenueUserRating])

  const handleAddReview = useCallback(async (placeId, review) => {
    if (!user) return
    await addUserReview(placeId, review)
    setReviewsVersion((version) => version + 1)
    fetchMyReviews().then(setMyReviews).catch(() => {})
  }, [user])

  const handleDeleteReview = useCallback(async (reviewId) => {
    if (!user) return
    await deleteReview(reviewId)
    setReviewsVersion((version) => version + 1)
    fetchMyReviews().then(setMyReviews).catch(() => {})
  }, [user])

  const handleLogin = useCallback(async (email, password) => {
    const loggedIn = await login(email, password)
    setUser(loggedIn)
    const [reviewList, savedList, recentList] = await Promise.all([
      fetchMyReviews().catch(() => []),
      fetchSaved().catch(() => []),
      fetchRecent().catch(() => []),
    ])
    setMyReviews(reviewList)
    setSaved(savedList)
    setRecentlyViewed(recentList)
    setShowAuth(false)
  }, [])

  const handleSignup = useCallback(async (name, email, password) => {
    await signup(name, email, password) // returns {message}, does NOT log in
    setAuthMode('signup-success')
    // Keep showAuth=true so the success screen shows
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setUser(null)
    setMyReviews([])
    setSaved([])
    setRecentlyViewed([])
    setShowProfile(false)
  }, [])

  const toggleSave = (place) => {
    requireAuth(async () => {
      const exists = saved.some((p) => p.id === place.id)
      try {
        if (exists) {
          await removeSaved(place.id)
          setSaved((prev) => prev.filter((p) => p.id !== place.id))
        } else {
          await addSaved(place.id)
          setSaved((prev) => [...prev, place])
        }
      } catch {
        // keep UI unchanged on failure
      }
    })
  }

  const isSaved = (place) => saved.some((p) => p.id === place.id)

  const selectReviewVenue = useCallback(
    (venueId) => {
      const place = placesWithDistance.find((p) => p.id === venueId)
      if (place) {
        selectPlace(place)
        return
      }
      fetchVenueDetail(venueId, { id: venueId, name: '', address: '' }, language)
        .then((enriched) => {
          setVenues((prev) => {
            const exists = prev.some((v) => v.id === enriched.id)
            return exists
              ? prev.map((v) => (v.id === enriched.id ? enriched : v))
              : [...prev, enriched]
          })
          selectPlace(enriched)
        })
        .catch(() => {})
    },
    [language, placesWithDistance, selectPlace],
  )

  const openChat = () => setRightPanelMode('chat')

  const closeRightPanel = useCallback(() => {
    setRightPanelMode('empty')
    setSelectedPlace(null)
    setFocusedPlaceId(null)
    setHoveredId(null)
    // Hand the list back to the live map view.
    setFrozenBounds(null)
  }, [])

  const panelVisible =
    rightPanelMode === 'chat' ||
    (rightPanelMode === 'detail' && !!activePlace)

  const resetAll = useCallback(() => {
    setSearchOrigin(null)
    setVenueFilter('')
    setActiveFilters([])
    setCrowdednessFilter(null)
    setQuietInsideFilter(null)
    setOpenNowOnly(false)
    setOpenHorizonHours(0)
    setMinRating(null)
    setWheelchairOnly(false)
    setFocusedPlaceId(null)
  }, [])

  const clearMapSelection = useCallback(() => {
    if (rightPanelMode === 'detail' && selectedPlace) return
    setSelectedPlace(null)
    setFocusedPlaceId(null)
    setHoveredId(null)
  }, [rightPanelMode, selectedPlace])

  const moveCardFocus = useCallback(
    (direction) => {
      if (!filteredPlaces.length) return
      const currentIndex = focusedPlaceId
        ? filteredPlaces.findIndex((place) => place.id === focusedPlaceId)
        : -1
      const nextIndex =
        direction === 'down'
          ? currentIndex < 0
            ? 0
            : Math.min(currentIndex + 1, filteredPlaces.length - 1)
          : currentIndex < 0
            ? 0
            : Math.max(currentIndex - 1, 0)
      const nextPlace = filteredPlaces[nextIndex]
      selectPlace(nextPlace, { scrollList: true })
    },
    [filteredPlaces, focusedPlaceId, selectPlace],
  )

  const isModalOpen = showAuth || showSettings || showProfile

  const handleKeyDown = useCallback(
    (e) => {
      const target = e.target
      const tag = target.tagName
      const isTypingField =
        tag === 'TEXTAREA' ||
        (tag === 'INPUT' &&
          ['text', 'search', 'email', 'password', 'url', 'number'].includes(
            target.type || 'text',
          ))
      const isUnifiedSearch =
        tag === 'INPUT' && target.classList.contains('unified-search-input')
      const isRangeInput = tag === 'INPUT' && target.type === 'range'

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (
          isModalOpen ||
          target.closest('.modal-overlay') ||
          isUnifiedSearch ||
          isTypingField
        ) {
          return
        }
        if (isRangeInput) {
          return
        }
        e.preventDefault()
        moveCardFocus(e.key === 'ArrowDown' ? 'down' : 'up')
        return
      }

      if (isTypingField) {
        if (e.key === 'Escape') target.blur()
        return
      }

      if (isRangeInput) return

      if (e.key === '/') {
        e.preventDefault()
        document.querySelector('.unified-search-input')?.focus()
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        moveCardFocus('down')
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        moveCardFocus('up')
      }
      if (e.key === 'Enter' && focusedPlaceId) {
        const place = filteredPlaces.find((p) => p.id === focusedPlaceId)
        if (place) selectPlace(place)
      }
      if (e.key === 'Escape') {
        setShowSettings(false)
        setShowProfile(false)
        setShowAuth(false)
        if (panelVisible) {
          closeRightPanel()
        }
      }
    },
    [
      panelVisible,
      closeRightPanel,
      handleSearch,
      moveCardFocus,
      focusedPlaceId,
      filteredPlaces,
      selectPlace,
      isModalOpen,
    ],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (language !== 'en') return

    setVenues((prev) => {
      let changed = false
      const next = prev.map((place) => {
        if (!place.canonicalName || place.name === place.canonicalName) {
          return place
        }
        changed = true
        return { ...place, name: place.canonicalName }
      })
      return changed ? next : prev
    })
  }, [language])

  const mapsLayoutProps = {
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
    onOriginSelect: handleOriginSelect,
    onSearch: handleSearch,
    onSearchSubmit: handleSearchSubmit,
    onSearchClear: handleSearchClear,
    visibleRecentSearches,
    onRecentClick: handleRecentClick,
    onRemoveRecent: (term) =>
      setRecentSearches((prev) => prev.filter((t) => t !== term)),
    activeFilters,
    crowdednessFilter,
    onCrowdednessFilterChange: setCrowdednessFilter,
    quietInsideFilter,
    onQuietInsideFilterChange: setQuietInsideFilter,
    openNowOnly,
    onOpenNowChange: setOpenNowOnly,
    openHorizonHours,
    onOpenHorizonChange: setOpenHorizonHours,
    minRating,
    onMinRatingChange: setMinRating,
    wheelchairOnly,
    onWheelchairChange: setWheelchairOnly,
    placeFocusZoom,
    onToggleFilter: toggleFilter,
    focusedPlaceId,
    onSelectPlace: selectPlace,
    placeFocusNonce,
    onResetAll: resetAll,
    onOpenChat: openChat,
    hoveredId,
    onHover: setHoveredId,
    onClearSelection: clearMapSelection,
    darkMode,
    userLocation,
    usingGps,
    onLocateMe: handleLocateMe,
    rightPanelMode,
    activePlaceUserReviews,
    isSaved,
    user,
    onBack: closeRightPanel,
    onClose: closeRightPanel,
    onToggleSave: toggleSave,
    onRequireAuth: requireAuth,
    onAddReview: handleAddReview,
    onDeleteReview: handleDeleteReview,
    onCloseChat: closeRightPanel,
  }

  const mapsSection = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
    <GoogleMapsProvider>
      <MapsLayout {...mapsLayoutProps} />
    </GoogleMapsProvider>
  ) : (
    <MapsLayout {...mapsLayoutProps} />
  )

  if (loading) return <LoadingSkeleton />

  if (loadError) {
    return (
      <div className="app">
        <div className="empty-state glass" style={{ margin: '2rem', padding: '2rem' }}>
          <h2>Failed to load venues</h2>
          <p>{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${fadeIn ? 'fade-in' : ''}`}>
      <TopNav
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((d) => !d)}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((s) => !s)}
        showProfile={showProfile}
        onToggleProfile={() => {
          if (!user) {
            setAuthMode('login')
            setShowAuth(true)
            return
          }
          fetchMyReviews().then(setMyReviews).catch(() => {})
          setShowProfile((s) => !s)
        }}
        onOpenChat={openChat}
        user={user}
        myReviews={myReviews}
        saved={syncedSaved}
        recentlyViewed={syncedRecent}
        onSelectReviewVenue={selectReviewVenue}
        onSelectPlace={selectPlace}
        onLogout={handleLogout}
        showAuth={showAuth}
        authMode={authMode}
        onOpenAuth={(mode) => {
          setAuthMode(mode)
          setShowAuth(true)
        }}
        onCloseAuth={() => setShowAuth(false)}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onSwitchAuthMode={setAuthMode}
      />

      {mapsSection}
    </div>
  )
}
