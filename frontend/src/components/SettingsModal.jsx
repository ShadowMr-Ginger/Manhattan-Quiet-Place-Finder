import { Check, Moon, Sun, X } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'

export function SettingsModal({ darkMode, onToggleTheme, onClose }) {
  const { language, setLanguage, languages, t } = useLanguage()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('settingsTitle')}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <section className="settings-section">
          <h3>{t('settingsLanguage')}</h3>
          <p className="settings-hint">{t('settingsLanguageHint')}</p>
          <div className="language-options">
            {languages.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                className={`language-option ${language === code ? 'active' : ''}`}
                onClick={() => setLanguage(code)}
              >
                <span>{label}</span>
                {language === code && <Check size={16} />}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>{t('settingsAppearance')}</h3>
          <div className="theme-options">
            <button
              type="button"
              className={`theme-option ${!darkMode ? 'active' : ''}`}
              onClick={() => darkMode && onToggleTheme()}
            >
              <Sun size={18} />
              <span>{t('settingsThemeLight')}</span>
            </button>
            <button
              type="button"
              className={`theme-option ${darkMode ? 'active' : ''}`}
              onClick={() => !darkMode && onToggleTheme()}
            >
              <Moon size={18} />
              <span>{t('settingsThemeDark')}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
