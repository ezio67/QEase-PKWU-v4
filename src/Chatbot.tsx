import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Bot,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  MessageSquareText,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useQueue } from './store'
import { buildLiveQueueSnapshot } from './utils/queueAssistant'

interface GroundingLink {
  title: string
  uri: string
  reviewSnippet?: string
}

interface ChatTurn {
  id: string
  role: 'user' | 'model'
  text: string
  timestamp: string
  groundingLinks?: GroundingLink[]
}

const QUICK_PROMPTS = [
  'How many mins left for the next person to finish?',
  'Who is currently being served at Barber Kawan?',
  'Compare wait times at Barber Kawan vs Kilap Car Wash',
  'What coffee shops or places are nearby while I wait?',
]

export function QEaseChatbot({
  userLocation,
  onRequestLocation,
}: {
  userLocation?: [number, number] | null
  onRequestLocation?: () => void
}) {
  const { appState, clock } = useQueue('barber-kawan')
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mapsGroundingEnabled, setMapsGroundingEnabled] = useState(true)
  const threadRef = useRef<HTMLDivElement>(null)

  const liveSnapshot = useMemo(
    () => buildLiveQueueSnapshot(appState.businesses, clock),
    [appState.businesses, clock],
  )

  const barberSummary = liveSnapshot.find((b) => b.slug === 'barber-kawan') ?? liveSnapshot[0]
  const washSummary = liveSnapshot.find((b) => b.slug === 'kilap-car-wash') ?? liveSnapshot[1]

  const [messages, setMessages] = useState<ChatTurn[]>(() => [
    {
      id: 'welcome-msg',
      role: 'model',
      text: `Hi! I’m the QEase Queue & Neighborhood Assistant. Ask me how many minutes are left for the current customer to finish, check live wait times, or discover nearby spots on Google Maps while you wait.`,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  useEffect(() => {
    if (open && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, open, loading])

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim()
    if (!trimmed || loading) return

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedHistory = [...messages, userTurn]
    setMessages(updatedHistory)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          queueContext: liveSnapshot,
          userLocation: userLocation
            ? { latitude: userLocation[0], longitude: userLocation[1] }
            : { latitude: -6.2603, longitude: 106.8192 },
          useMaps: mapsGroundingEnabled,
        }),
      })
      const data = (await response.json()) as {
        reply?: string
        groundingLinks?: GroundingLink[]
      }

      const modelTurn: ChatTurn = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || 'I checked the live queue — let me know if you need more details!',
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        groundingLinks: data.groundingLinks,
      }
      setMessages((current) => [...current, modelTurn])
    } catch {
      const barberNow = barberSummary?.nowServing
      const fallbackText = barberNow
        ? `Right now at ${barberSummary.name}, ${barberNow.ticketId} (${barberNow.customerName}) has about ${barberNow.minutesLeftToFinish} minutes left to finish (${barberNow.elapsedMinutes}/${barberNow.totalDurationMinutes} min elapsed). There are ${barberSummary.waitingCount} people waiting.`
        : `Right now ${barberSummary?.name ?? 'Barber Kawan'} has ${barberSummary?.waitingCount ?? 0} waiting in line.`
      setMessages((current) => [
        ...current,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void sendMessage(input)
  }

  return (
    <div className="qease-chatbot-root">
      {open && (
        <section className="qease-chatbot-panel" role="dialog" aria-label="QEase Live Queue Assistant">
          <header className="qease-chatbot-header">
            <div className="qease-chatbot-brand">
              <span className="qease-chatbot-avatar" aria-hidden="true">
                <Bot size={19} />
              </span>
              <div>
                <strong>QEase Live Assistant</strong>
                <span>
                  <span className="qease-live-dot" /> Live queue &amp; Maps grounding
                </span>
              </div>
            </div>
            <button
              type="button"
              className="icon-button qease-chatbot-close"
              onClick={() => setOpen(false)}
              aria-label="Close QEase Assistant"
            >
              <X size={18} />
            </button>
          </header>

          <div className="qease-chatbot-live-strip" aria-label="Live service countdown summary">
            <div className="qease-live-chip">
              <Clock3 size={13} />
              <span>
                <b>Barber Kawan:</b>{' '}
                {barberSummary?.nowServing
                  ? `${barberSummary.nowServing.ticketId} (~${barberSummary.nowServing.minutesLeftToFinish}m left)`
                  : 'Chair open now'}
              </span>
            </div>
            <div className="qease-live-chip">
              <Users size={13} />
              <span>
                <b>Kilap Wash:</b>{' '}
                {washSummary?.nowServing
                  ? `${washSummary.nowServing.ticketId} (~${washSummary.nowServing.minutesLeftToFinish}m left)`
                  : 'Bay open now'}
              </span>
            </div>
          </div>

          <div className="qease-chatbot-toolbar">
            <label className="qease-maps-grounding-toggle">
              <input
                type="checkbox"
                checked={mapsGroundingEnabled}
                onChange={(e) => setMapsGroundingEnabled(e.target.checked)}
              />
              <MapPin size={13} />
              <span>Google Maps grounding</span>
            </label>
            {onRequestLocation && (
              <button
                type="button"
                className="qease-locate-mini"
                onClick={onRequestLocation}
              >
                <LocateFixed size={12} />
                {userLocation ? 'Near me active' : 'Use my location'}
              </button>
            )}
          </div>

          <div ref={threadRef} className="qease-chatbot-thread" role="log" aria-live="polite">
            {messages.map((turn) => (
              <article
                key={turn.id}
                className={`qease-chat-bubble qease-chat-${turn.role}`}
              >
                <div className="qease-chat-text">
                  {turn.text.split('\n').map((line, i) => (
                    <p key={i}>
                      {line.split(/(\*\*[^*]+\*\*)/g).map((part, idx) =>
                        part.startsWith('**') && part.endsWith('**') ? (
                          <strong key={idx}>{part.slice(2, -2)}</strong>
                        ) : (
                          part.replace(/\*([^*]+)\*/g, '$1')
                        ),
                      )}
                    </p>
                  ))}
                </div>
                {turn.groundingLinks && turn.groundingLinks.length > 0 && (
                  <div className="qease-grounding-links">
                    <span className="qease-grounding-label">
                      <MapPin size={12} /> Google Maps Grounding Sources
                    </span>
                    {turn.groundingLinks.map((link, idx) => (
                      <a
                        key={`${link.uri}-${idx}`}
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="qease-grounding-card"
                      >
                        <div>
                          <b>{link.title}</b>
                          {link.reviewSnippet && <small>“{link.reviewSnippet}”</small>}
                        </div>
                        <ExternalLink size={13} />
                      </a>
                    ))}
                  </div>
                )}
                <time className="qease-chat-time">{turn.timestamp}</time>
              </article>
            ))}
            {loading && (
              <div className="qease-chat-bubble qease-chat-model qease-chat-typing" role="status">
                <Sparkles size={14} />
                <span>Checking live queue &amp; Maps data…</span>
              </div>
            )}
          </div>

          <div className="qease-chatbot-chips" aria-label="Suggested questions">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="qease-prompt-chip"
                disabled={loading}
                onClick={() => void sendMessage(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <form className="qease-chatbot-form" onSubmit={handleSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask wait times, mins left, or nearby places…"
              aria-label="Ask QEase Assistant"
            />
            <button
              type="submit"
              className="button button-primary qease-chatbot-send"
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`qease-chatbot-launcher ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close QEase Queue Assistant' : 'Open QEase Queue Assistant'}
      >
        <MessageSquareText size={20} />
        <span>
          <b>Ask QEase AI</b>
          <small>
            {barberSummary?.nowServing
              ? `${barberSummary.nowServing.ticketId}: ~${barberSummary.nowServing.minutesLeftToFinish}m left`
              : 'Live queue & Maps'}
          </small>
        </span>
      </button>
    </div>
  )
}
