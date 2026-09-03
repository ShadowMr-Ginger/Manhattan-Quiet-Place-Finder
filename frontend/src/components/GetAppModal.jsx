import { Download, Smartphone, X } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'

const DEFAULT_ANDROID_APK_URL =
  'https://github.com/eelj457/Hush-Hub/releases/download/v1.0.0/HushHub_Mobile_Android.apk'

const DEFAULT_IOS_IPA_URL =
  'https://github.com/eelj457/Hush-Hub/releases/download/v1.0.0/HushHub_Mobile_iOS.ipa'

export function GetAppModal({ onClose }) {
  const { t } = useLanguage()
  const apkUrl = import.meta.env.VITE_ANDROID_APK_URL || DEFAULT_ANDROID_APK_URL
  const ipaUrl = import.meta.env.VITE_IOS_IPA_URL || DEFAULT_IOS_IPA_URL

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal get-app-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('getAppTitle')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="get-app-hero">
          <div className="get-app-hero-icon" aria-hidden="true">
            <Smartphone size={22} />
          </div>
          <p className="get-app-hero-text">{t('getAppSubtitle')}</p>
        </div>

        <div className="get-app-downloads">
          <a className="get-app-download" href={apkUrl} download>
            <div className="get-app-download-copy">
              <span className="get-app-download-label">{t('getAppAndroidTitle')}</span>
              <span className="get-app-download-desc">{t('getAppAndroidBody')}</span>
            </div>
            <span className="get-app-download-cta">
              <Download size={16} />
              {t('getAppAndroidDownload')}
            </span>
          </a>
          <p className="get-app-install-hint">{t('getAppAndroidNote')}</p>

          <a className="get-app-download" href={ipaUrl} download>
            <div className="get-app-download-copy">
              <span className="get-app-download-label">{t('getAppIosTitle')}</span>
              <span className="get-app-download-desc">{t('getAppIosBody')}</span>
            </div>
            <span className="get-app-download-cta">
              <Download size={16} />
              {t('getAppIosDownload')}
            </span>
          </a>
          <p className="get-app-install-hint">{t('getAppIosNote')}</p>
        </div>
      </div>
    </div>
  )
}
