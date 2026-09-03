import { useState } from 'react'
import { AuthModal } from './AuthModal'
import { GetAppModal } from './GetAppModal'
import { ProfileModal } from './ProfileModal'
import { SettingsModal } from './SettingsModal'
import { WeatherWidget } from './WeatherWidget'
import { HushHubLogo } from './HushHubLogo'
import { useLanguage } from '../language/useLanguage'
import {
  LogIn,
  MessageCircle,
  Moon,
  Settings,
  Smartphone,
  Sun,
  UserPlus,
} from 'lucide-react'

export function TopNav({
  darkMode,
  onToggleTheme,
  showSettings,
  onToggleSettings,
  showProfile,
  onToggleProfile,
  onOpenChat,
  user,
  myReviews,
  saved,
  recentlyViewed,
  onSelectReviewVenue,
  onSelectPlace,
  onLogout,
  showAuth,
  authMode,
  onOpenAuth,
  onCloseAuth,
  onLogin,
  onSignup,
  onSwitchAuthMode,
}) {
  const { t } = useLanguage()
  const [showGetApp, setShowGetApp] = useState(false)

  return (
    <>
      <header className="top-nav glass">
        <div className="nav-brand">
          <div className="brand-icon">
            <HushHubLogo size={24} />
          </div>
          <div>
            <h1 className="brand-title">HushHub</h1>
            <p className="brand-subtitle">{t('appSubtitle')}</p>
          </div>
        </div>

        <div className="nav-controls">
          <WeatherWidget />

          <button
            type="button"
            className="nav-btn get-app-nav-btn"
            onClick={() => setShowGetApp(true)}
            title={t('getApp')}
          >
            <Smartphone size={18} />
            <span className="get-app-nav-label">{t('getApp')}</span>
          </button>

          <button
            type="button"
            className="nav-btn icon-only"
            onClick={onToggleTheme}
            title={t('toggleTheme')}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="nav-btn icon-only"
            onClick={onToggleSettings}
            title={t('settings')}
          >
            <Settings size={18} />
          </button>

          <button
            type="button"
            className="nav-btn icon-only"
            onClick={onOpenChat}
            title={t('openChat')}
          >
            <MessageCircle size={18} />
          </button>

          {user ? (
            <button
              type="button"
              className="avatar-btn"
              onClick={onToggleProfile}
              title={t('profile')}
            >
              {user.avatar}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="nav-btn"
                onClick={() => onOpenAuth('login')}
              >
                <LogIn size={18} />
                {t('logIn')}
              </button>
              <button
                type="button"
                className="nav-btn auth-signup-btn"
                onClick={() => onOpenAuth('signup')}
              >
                <UserPlus size={18} />
                {t('signUp')}
              </button>
            </>
          )}
        </div>
      </header>

      {showGetApp && <GetAppModal onClose={() => setShowGetApp(false)} />}

      {showSettings && (
        <SettingsModal
          darkMode={darkMode}
          onToggleTheme={onToggleTheme}
          onClose={onToggleSettings}
        />
      )}

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={onCloseAuth}
          onLogin={onLogin}
          onSignup={onSignup}
          onSwitchMode={onSwitchAuthMode}
        />
      )}

      {showProfile && user && (
        <ProfileModal
          user={user}
          myReviews={myReviews}
          saved={saved}
          recentlyViewed={recentlyViewed}
          onSelectReviewVenue={onSelectReviewVenue}
          onSelectPlace={onSelectPlace}
          onClose={onToggleProfile}
          onLogout={onLogout}
        />
      )}
    </>
  )
}
