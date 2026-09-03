import { Search } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'

export function EmptyState() {
  const { t } = useLanguage()

  return (
    <div className="empty-state">
      <div className="empty-icon-wrap">
        <div className="pulse-ring ring-1" />
        <div className="pulse-ring ring-2" />
        <Search size={32} className="empty-icon" />
      </div>
      <h3>{t('noPlacesTitle')}</h3>
      <p>{t('noPlacesHint')}</p>
    </div>
  )
}
