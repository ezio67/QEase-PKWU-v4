import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertCircle, BellRing, CheckCircle2, Info, Sparkles, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  durationMs: number
}

export interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  durationMs?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (input: ToastInput | string, variant?: ToastVariant) => string
   success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    (input: ToastInput | string, fallbackVariant: ToastVariant = 'success') => {
      const normalized: ToastInput =
        typeof input === 'string' ? { title: input, variant: fallbackVariant } : input
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const durationMs = normalized.durationMs ?? 4200
      const item: ToastItem = {
        id,
        title: normalized.title,
        description: normalized.description,
        variant: normalized.variant ?? fallbackVariant,
        durationMs,
      }
      setToasts((current) => [item, ...current].slice(0, 5))
      if (durationMs > 0 && typeof window !== 'undefined') {
        window.setTimeout(() => {
          setToasts((current) => current.filter((entry) => entry.id !== id))
        }, durationMs)
      }
      return id
    },
    [],
  )

  const success = useCallback(
    (title: string, description?: string) => showToast({ title, description, variant: 'success' }),
    [showToast],
  )
  const error = useCallback(
    (title: string, description?: string) => showToast({ title, description, variant: 'error' }),
    [showToast],
  )
  const info = useCallback(
    (title: string, description?: string) => showToast({ title, description, variant: 'info' }),
    [showToast],
  )
  const warning = useCallback(
    (title: string, description?: string) => showToast({ title, description, variant: 'warning' }),
    [showToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, info, warning, dismissToast }}>
      {children}
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastNotification({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}) {
  if (!toasts.length) return null

  return (
    <aside
      className="qease-toast-viewport"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.variant === 'error'
            ? AlertCircle
            : toast.variant === 'warning'
              ? BellRing
              : toast.variant === 'info'
                ? Sparkles
                : CheckCircle2

        return (
          <div
            key={toast.id}
            className={`qease-toast-card qease-toast-${toast.variant}`}
            role={toast.variant === 'error' ? 'alert' : 'status'}
          >
            <div className="qease-toast-icon" aria-hidden="true">
              <Icon size={19} />
            </div>
            <div className="qease-toast-content">
              <strong>{toast.title}</strong>
              {toast.description && <p>{toast.description}</p>}
            </div>
            <button
              type="button"
              className="qease-toast-close"
              onClick={() => onDismiss(toast.id)}
              aria-label={`Dismiss ${toast.title} notification`}
            >
              <X size={15} />
            </button>
            <span
              className="qease-toast-progress"
              style={{ animationDuration: `${toast.durationMs}ms` }}
              aria-hidden="true"
            />
          </div>
        )
      })}
    </aside>
  )
}

export { Info }
