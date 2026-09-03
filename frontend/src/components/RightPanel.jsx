import { PlaceDetailPanel } from './PlaceDetailPanel'
import { ChatPanel } from './ChatPanel'
import { useLanguage } from '../language/useLanguage'

export function RightPanel({
  mode,
  selectedPlace,
  userReviews,
  isSaved,
  user,
  onBack,
  onClose,
  onToggleSave,
  onRequireAuth,
  onAddReview,
  onDeleteReview,
  currentUser,
  onCloseChat,
  onSelectPlace,
}) {
  const { language } = useLanguage()

  if (mode === 'chat') {
    return (
      <aside className="right-panel glass">
        <ChatPanel
          key={language}
          user={user}
          onClose={onCloseChat}
          onSelectPlace={onSelectPlace}
          onRequireAuth={onRequireAuth}
        />
      </aside>
    )
  }

  if (mode === 'detail' && selectedPlace) {
    return (
      <aside className="right-panel glass">
        <PlaceDetailPanel
          place={selectedPlace}
          userReviews={userReviews}
          isSaved={isSaved(selectedPlace)}
          onBack={onBack}
          onClose={onClose}
          onToggleSave={onToggleSave}
          onRequireAuth={onRequireAuth}
          onAddReview={onAddReview}
          onDeleteReview={onDeleteReview}
          currentUser={currentUser}
        />
      </aside>
    )
  }

  return null
}
