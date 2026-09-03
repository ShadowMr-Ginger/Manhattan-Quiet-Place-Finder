import { WEATHER } from '../data/constants'
import { apiRequest } from './api'

export function getFallbackWeather() {
  return {
    temp: WEATHER.temp,
    feelsLike: WEATHER.feelsLike,
    humidity: WEATHER.humidity,
    wind: WEATHER.wind,
    condition: WEATHER.condition,
    description: WEATHER.condition,
    main: 'Clear',
    updatedAt: null,
  }
}

function celsiusToFahrenheit(celsius) {
  return Math.round(celsius * (9 / 5) + 32)
}

function metersPerSecondToMph(speed) {
  return Math.round(speed * 2.237)
}

function iconToMain(icon = '') {
  if (icon.startsWith('01')) return 'Clear'
  if (icon.startsWith('02') || icon.startsWith('03') || icon.startsWith('04')) return 'Clouds'
  if (icon.startsWith('09') || icon.startsWith('10') || icon.startsWith('11')) return 'Rain'
  if (icon.startsWith('13')) return 'Snow'
  if (icon.startsWith('50')) return 'Mist'
  return 'Clear'
}

function capitalize(text) {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** @returns {Promise<import('./weather').ManhattanWeather>} */
export async function fetchManhattanWeather(language = 'en') {
  const params = new URLSearchParams({ lang: language })
  const data = await apiRequest(`/weather?${params.toString()}`)
  const current = data.current

  const main = iconToMain(current.icon)

  return {
    temp: celsiusToFahrenheit(current.temp),
    feelsLike: celsiusToFahrenheit(current.feels_like),
    humidity: current.humidity,
    wind: metersPerSecondToMph(current.wind_speed ?? 0),
    condition: main,
    description: capitalize(current.description ?? main),
    main,
    updatedAt: data.fetched_at ? new Date(data.fetched_at).getTime() : Date.now(),
  }
}
