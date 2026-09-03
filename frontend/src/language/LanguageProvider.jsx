import { useCallback, useEffect, useMemo, useState } from 'react'
import { FALLBACK_LANGUAGES, FALLBACK_TRANSLATIONS } from './fallbackTranslations'
import { getGoogleMapLocale } from '../utils/googleMapsLocale'
import { LanguageContext } from './useLanguage'

const STORAGE_KEY = 'hushhub_language'
const HAS_GOOGLE_MAPS = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)

function resolveInitialLanguage(languages) {
  const codes = new Set(languages.map(({ code }) => code))
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && codes.has(saved)) return saved

  const browser = navigator.language?.slice(0, 2)
  if (browser && codes.has(browser)) return browser

  return languages[0]?.code ?? 'en'
}

function stringsFor(language) {
  return FALLBACK_TRANSLATIONS[language] ?? FALLBACK_TRANSLATIONS.en
}

function lookupString(dict, key) {
  const parts = key.split('.')
  let value = dict
  for (const part of parts) {
    value = value?.[part]
  }
  return typeof value === 'string' ? value : undefined
}

function translate(language, strings, key) {
  const fromActive = lookupString(strings, key)
  if (fromActive && fromActive !== key) return fromActive

  const fallback = stringsFor(language)
  const fromFallback = lookupString(fallback, key)
  if (fromFallback && fromFallback !== key) return fromFallback

  if (language !== 'en') {
    const fromEnglish = lookupString(FALLBACK_TRANSLATIONS.en, key)
    if (fromEnglish && fromEnglish !== key) return fromEnglish
  }

  return key
}

export function LanguageProvider({ children }) {
  const [languages] = useState(FALLBACK_LANGUAGES)
  const [language, setLanguageState] = useState(() =>
    resolveInitialLanguage(FALLBACK_LANGUAGES),
  )
  const [strings, setStrings] = useState(() =>
    stringsFor(resolveInitialLanguage(FALLBACK_LANGUAGES)),
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const resolved = resolveInitialLanguage(FALLBACK_LANGUAGES)
    localStorage.setItem(STORAGE_KEY, resolved)
    document.documentElement.lang = resolved
    setLanguageState(resolved)
    setStrings(stringsFor(resolved))
    setReady(true)
  }, [])

  const setLanguage = useCallback(
    (code) => {
      if (!languages.some(({ code: langCode }) => langCode === code) || language === code) {
        return
      }

      localStorage.setItem(STORAGE_KEY, code)
      document.documentElement.lang = code

      const currentMapLanguage = getGoogleMapLocale(language).language
      const nextMapLanguage = getGoogleMapLocale(code).language

      // Google Maps loads as a global singleton — language is fixed at first load.
      // Reload so the script boots with the new mapLanguage (official workaround).
      if (HAS_GOOGLE_MAPS && currentMapLanguage !== nextMapLanguage) {
        window.location.reload()
        return
      }

      setLanguageState(code)
      setStrings(stringsFor(code))
    },
    [language, languages],
  )

  const t = useCallback((key) => translate(language, strings, key), [language, strings])

  const value = useMemo(
    () => ({ language, setLanguage, t, languages, ready }),
    [language, setLanguage, t, languages, ready],
  )

  if (!ready) {
    return null
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
