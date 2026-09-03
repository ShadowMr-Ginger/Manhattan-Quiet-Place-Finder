import { createContext, useContext } from 'react'

export const LanguageContext = createContext(null)

export function formatMessage(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return { ...ctx, formatMessage }
}
