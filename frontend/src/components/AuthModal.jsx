import { useEffect, useState } from 'react'
import { LogIn, UserPlus, X, Mail, KeyRound, CheckCircle } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'
import { forgotPassword, resetPassword, resendVerification } from '../services/auth'

export function AuthModal({ mode = 'login', onClose, onLogin, onSignup, onSwitchMode }) {
  const { t } = useLanguage()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  // mode: 'login' | 'signup' | 'forgot' | 'reset' | 'verify-success' | 'verify-error' | 'signup-success'
  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const isSignupSuccess = mode === 'signup-success'
  const isVerifySuccess = mode === 'verify-success'
  const isVerifyError = mode === 'verify-error'

  useEffect(() => {
    setName('')
    setEmail('')
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('')
  }, [mode])

  // ── Login / Signup ──────────────────────────────────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignup) {
        await onSignup(name, email, password)
      } else {
        await onLogin(email, password)
        onClose()
      }
    } catch (err) {
      setError(err.message || t('authError'))
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ─────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSuccess(t('authForgotSent'))
    } catch (err) {
      setError(err.message || t('authError'))
    } finally {
      setLoading(false)
    }
  }

  // ── Reset password ──────────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError(t('authPasswordMismatch'))
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('reset')
      await resetPassword(token, newPassword)
      setSuccess(t('authResetSuccess'))
      window.history.replaceState({}, '', window.location.pathname)
    } catch (err) {
      setError(err.message || t('authError'))
    } finally {
      setLoading(false)
    }
  }

  // ── Resend verification ─────────────────────────────────────────────────
  const handleResend = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!email.trim() || resendLoading) return
    setResendLoading(true)
    setError('')
    setSuccess('')
    try {
      await resendVerification(email.trim())
      setSuccess(t('authVerificationResent'))
    } catch (err) {
      setError(err.message || t('authError'))
    } finally {
      setResendLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (isSignupSuccess) {
    return (
      <ModalShell onClose={onClose} status>
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--ok" aria-hidden>
            <Mail size={28} strokeWidth={1.75} />
          </div>
          <h2 className="auth-status-title">{t('authSignupSuccessTitle')}</h2>
          <p className="auth-status-hint">{t('authSignupSuccessHint')}</p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => onSwitchMode('login')}
          >
            <LogIn size={18} /> {t('authSubmitLogin')}
          </button>
        </div>
      </ModalShell>
    )
  }

  if (isVerifySuccess) {
    return (
      <ModalShell onClose={onClose} status>
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--ok" aria-hidden>
            <CheckCircle size={28} strokeWidth={1.75} />
          </div>
          <h2 className="auth-status-title">{t('authVerifySuccessTitle')}</h2>
          <p className="auth-status-hint">{t('authVerifySuccessHint')}</p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => onSwitchMode('login')}
          >
            <LogIn size={18} /> {t('authSubmitLogin')}
          </button>
        </div>
      </ModalShell>
    )
  }

  if (isVerifyError) {
    return (
      <ModalShell onClose={onClose} status>
        <div className="auth-status">
          <div className="auth-status-icon auth-status-icon--err" aria-hidden>
            <Mail size={28} strokeWidth={1.75} />
          </div>
          <h2 className="auth-status-title">{t('authVerifyErrorTitle')}</h2>
          <p className="auth-status-hint">{t('authVerifyErrorHint')}</p>
          <button
            type="button"
            className="auth-submit"
            onClick={() => onSwitchMode('login')}
          >
            {t('authBackToLogin')}
          </button>
        </div>
      </ModalShell>
    )
  }

  if (isForgot) {
    if (success) {
      return (
        <ModalShell onClose={onClose} status>
          <div className="auth-status">
            <div className="auth-status-icon auth-status-icon--ok" aria-hidden>
              <CheckCircle size={28} strokeWidth={1.75} />
            </div>
            <h2 className="auth-status-title">{t('authForgotTitle')}</h2>
            <p className="auth-status-hint">{success}</p>
            <button
              type="button"
              className="auth-submit"
              onClick={() => onSwitchMode('login')}
            >
              {t('authBackToLogin')}
            </button>
          </div>
        </ModalShell>
      )
    }
    return (
      <ModalShell onClose={onClose} title={t('authForgotTitle')} subtitle={t('authForgotHint')}>
        <form className="auth-form" onSubmit={handleForgot}>
          <label className="auth-field">
            <span>{t('authEmail')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            <Mail size={18} />
            {loading ? t('authWaiting') : t('authForgotSubmit')}
          </button>
          <p className="auth-switch">
            <button type="button" onClick={() => onSwitchMode('login')}>
              {t('authBackToLogin')}
            </button>
          </p>
        </form>
      </ModalShell>
    )
  }

  if (isReset) {
    if (success) {
      return (
        <ModalShell onClose={onClose} status>
          <div className="auth-status">
            <div className="auth-status-icon auth-status-icon--ok" aria-hidden>
              <CheckCircle size={28} strokeWidth={1.75} />
            </div>
            <h2 className="auth-status-title">{t('authResetTitle')}</h2>
            <p className="auth-status-hint">{success}</p>
            <button
              type="button"
              className="auth-submit"
              onClick={() => onSwitchMode('login')}
            >
              <LogIn size={18} /> {t('authSubmitLogin')}
            </button>
          </div>
        </ModalShell>
      )
    }
    return (
      <ModalShell onClose={onClose} title={t('authResetTitle')} subtitle={t('authResetHint')}>
        <form className="auth-form" onSubmit={handleReset}>
          <label className="auth-field">
            <span>{t('authNewPassword')}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="auth-field">
            <span>{t('authConfirmPassword')}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-submit" disabled={loading}>
            <KeyRound size={18} />
            {loading ? t('authWaiting') : t('authResetSubmit')}
          </button>
        </form>
      </ModalShell>
    )
  }

  return (
    <ModalShell
      onClose={onClose}
      title={isSignup ? t('authCreate') : t('authWelcome')}
      subtitle={isSignup ? t('authSignupHint') : t('authLoginHint')}
    >
      <form className="auth-form" onSubmit={handleAuthSubmit}>
        {isSignup && (
          <label className="auth-field">
            <span>{t('authName')}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
        )}
        <label className="auth-field">
          <span>{t('authEmail')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-field">
          <span>{t('authPassword')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-info">{success}</p>}

        {!isSignup &&
          email &&
          (error.toLowerCase().includes('verif') || success) && (
            <button
              type="button"
              className="auth-resend-btn"
              onClick={handleResend}
              disabled={resendLoading || !email.trim()}
            >
              {resendLoading ? t('authWaiting') : t('authResendVerification')}
            </button>
          )}

        <button type="submit" className="auth-submit" disabled={loading}>
          {isSignup ? <UserPlus size={18} /> : <LogIn size={18} />}
          {loading
            ? t('authWaiting')
            : isSignup
              ? t('authSubmitSignup')
              : t('authSubmitLogin')}
        </button>

        {!isSignup && (
          <p className="auth-switch">
            <button type="button" onClick={() => onSwitchMode('forgot')}>
              {t('authForgotLink')}
            </button>
          </p>
        )}
      </form>

      <p className="auth-switch">
        {isSignup ? t('authHaveAccount') : t('authNoAccount')}{' '}
        <button type="button" onClick={() => onSwitchMode(isSignup ? 'login' : 'signup')}>
          {isSignup ? t('authSubmitLogin') : t('authSubmitSignup')}
        </button>
      </p>
    </ModalShell>
  )
}

function ModalShell({ onClose, title, subtitle, status = false, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal auth-modal${status ? ' auth-modal--status' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-header${status ? ' modal-header--status' : ''}`}>
          {title && <h2>{title}</h2>}
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
