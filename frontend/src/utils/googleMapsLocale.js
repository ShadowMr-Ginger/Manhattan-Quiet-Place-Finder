/** Map app language codes to Google Maps API locale params */
export const GOOGLE_MAP_LOCALES = {
  en: { language: 'en', region: 'US' },
  zh: { language: 'zh-CN', region: 'US' },
  es: { language: 'es', region: 'US' },
}

export function getGoogleMapLocale(appLanguage) {
  return GOOGLE_MAP_LOCALES[appLanguage] ?? GOOGLE_MAP_LOCALES.en
}
