import { useState } from 'react'
import {
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  Sun,
  X,
} from 'lucide-react'
import { useLanguage, formatMessage } from '../language/useLanguage'
import { useManhattanWeather } from '../hooks/useManhattanWeather'

function WeatherIcon({ main, size = 16 }) {
  switch (main) {
    case 'Clear':
      return <Sun size={size} />
    case 'Rain':
    case 'Drizzle':
    case 'Thunderstorm':
      return <CloudRain size={size} />
    case 'Snow':
      return <CloudSnow size={size} />
    case 'Mist':
    case 'Fog':
    case 'Haze':
      return <CloudFog size={size} />
    case 'Clouds':
      return <Cloud size={size} />
    default:
      return <CloudSun size={size} />
  }
}

export function WeatherWidget() {
  const { t, language } = useLanguage()
  const { weather, loading } = useManhattanWeather(language)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="weather-widget">
      <button
        type="button"
        className="weather-pill"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {loading ? (
          <Loader2 size={16} className="weather-spinner" />
        ) : (
          <WeatherIcon main={weather.main} size={16} />
        )}
        <span>{weather.temp}°F</span>
        <span className="weather-label">{weather.description}</span>
      </button>

      {expanded && (
        <div className="weather-dropdown">
          <div className="weather-dropdown-header">
            <h3>{weather.description}</h3>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setExpanded(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p className="weather-location">
            {t('weatherLocation')}
            {weather.updatedAt && (
              <>
                {' · '}
                {formatMessage(t('weatherUpdated'), {
                  time: new Date(weather.updatedAt).toLocaleTimeString(
                    language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-US' : 'en-US',
                    {
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/New_York',
                    },
                  ),
                })}
              </>
            )}
          </p>
          <div className="weather-details">
            <div>
              <span className="weather-temp">{weather.temp}°F</span>
              <span>
                {t('feelsLike')} {weather.feelsLike}°F
              </span>
            </div>
            <div className="weather-meta">
              <span>
                {t('humidity')} {weather.humidity}%
              </span>
              <span>
                {t('wind')} {weather.wind} mph
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
