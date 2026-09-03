import { useMemo, useRef, useEffect, useState } from 'react'
import { Bot, Send, X, ArrowRight, MapPin, Star, Lock } from 'lucide-react'
import { useLanguage } from '../language/useLanguage'
import { apiRequest } from '../services/api'
import { mapBackendType } from '../services/venues'

/** Keep numbered recommendations readable when the model runs them into one paragraph. */
function formatChatText(text) {
  if (!text) return text
  return text
    .replace(/\r\n/g, '\n')
    .replace(/([^\n])[ \t]+(\d{1,2}\.\s+)/g, '$1\n$2')
    .replace(/[ \t]+(这些地方|希望对您|Hope this|If you need)/g, '\n\n$1')
    .trim()
}

function VenueCard({ venue, onSelectPlace }) {
  const { t } = useLanguage()
  const displayType = mapBackendType(venue.type, venue.name)

  return (
    <div className="chat-venue-card">
      <div className="chat-venue-card-header">
        <span className="cvc-type">{t(`venueTypes.${displayType}`)}</span>
        <span className="cvc-score">Quiet {venue.quietScore}/100</span>
      </div>
      <div className="cvc-name">{venue.name}</div>
      {venue.address && (
        <div className="cvc-address">
          <MapPin size={11} />
          {venue.address}
        </div>
      )}
      {venue.displayRating && (
        <div className="cvc-rating">
          <Star size={11} />
          {venue.displayRating}
        </div>
      )}
      <button
        className="cvc-goto"
        type="button"
        onClick={() =>
          onSelectPlace?.({
            ...venue,
            type: displayType,
          })
        }
      >
        View details
        <ArrowRight size={13} />
      </button>
    </div>
  )
}

export function ChatPanel({ user, onClose, onSelectPlace, onRequireAuth }) {
  const { t, language } = useLanguage()
  const bottomRef = useRef(null)

  const welcomeMessages = useMemo(
    () => [{ role: 'assistant', text: t('chatWelcome1') }],
    [t],
  )

  const [messages, setMessages] = useState(welcomeMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [expandedVenue, setExpandedVenue] = useState(null)

  useEffect(() => {
    if (!user) {
      setMessages(welcomeMessages)
      setHistoryLoaded(false)
      return
    }
    if (historyLoaded) return

    apiRequest('/chat/history')
      .then((data) => {
        if (data?.messages?.length > 0) {
          setMessages(data.messages)
        } else {
          setMessages(welcomeMessages)
        }
        setHistoryLoaded(true)
      })
      .catch(() => {
        setMessages(welcomeMessages)
        setHistoryLoaded(true)
      })
  }, [user, historyLoaded, welcomeMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userText = input.trim()

    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.text !== t('chatWelcome1')))
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }))

    setMessages((prev) => [...prev, { role: 'user', text: userText }])
    setInput('')
    setLoading(true)
    setExpandedVenue(null)

    try {
      const data = await apiRequest('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: userText, history }),
      })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.reply, venues: data.venues || [] },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: t('chatReplyDefault'), venues: [] },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleChipClick = (msgIdx, venue) => {
    const key = `${msgIdx}-${venue.id}`
    setExpandedVenue((prev) => (prev === key ? null : key))
  }

  return (
    <div className="chat-panel">
      <div className="panel-header">
        <h2>
          <Bot size={20} />
          {t('chatTitle')}
        </h2>
        <button type="button" className="icon-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {!user ? (
        <div className="chat-login-wall">
          <Lock size={32} className="chat-lock-icon" />
          <p>{t('chatLoginRequired')}</p>
          <button
            type="button"
            className="chat-login-btn"
            onClick={() => onRequireAuth?.('login')}
          >
            {t('chatLoginBtn')}
          </button>
        </div>
      ) : (
        <>
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`chat-bubble ${msg.role}`}>
                  {msg.role === 'assistant' && <Bot size={16} className="bot-icon" />}
                  <p>{formatChatText(msg.text)}</p>
                </div>
                {msg.venues && msg.venues.length > 0 && (
                  <div className="chat-venue-list">
                    {msg.venues.map((v) => {
                      const key = `${i}-${v.id}`
                      const isExpanded = expandedVenue === key
                      return (
                        <div key={v.id}>
                          <button
                            className={`chat-venue-chip ${isExpanded ? 'active' : ''}`}
                            type="button"
                            onClick={() => handleChipClick(i, v)}
                          >
                            <span className="chip-name">{v.name}</span>
                            <span className="chip-score">{v.quietScore}/100</span>
                          </button>
                          {isExpanded && (
                            <VenueCard venue={v} onSelectPlace={onSelectPlace} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-bubble assistant">
                <Bot size={16} className="bot-icon" />
                <p className="chat-loading">···</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-wrap">
            <input
              type="text"
              placeholder={t('chatPlaceholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button type="button" onClick={sendMessage} disabled={loading}>
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
