import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { BellRing, CarFront, Check, ChevronRight, Clock3, Droplets, MapPin, Scissors, Sparkles, SprayCan, UsersRound, Wind, X } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { availabilityMeta, statusMeta } from './data'
import { formatReturnWindow, minutesLabel, useQueue } from './store'
import type { Availability, BusinessKind, Estimate, ServiceIconName, Ticket, TicketStatus } from './types'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-mark" aria-label="QEase">
      <img className="brand-symbol" src="/qease-mark.svg" alt="" />
      {!compact && <span className="brand-word">Q<span>Ease</span></span>}
    </div>
  )
}

/** The approved Moving Q, simplified for a lightweight CSS-driven loading state. */
export function MovingQLoader({ label = 'Preparing your queue.', compact = false }: { label?: string; compact?: boolean }) {
  return <div className={`moving-q-loader ${compact ? 'moving-q-loader-compact' : ''}`} role="status" aria-live="polite">
    <svg className="moving-q-loader-mark" viewBox="0 0 360 360" aria-hidden="true">
      <defs><linearGradient id="qease-loader-badge" x1="48" y1="40" x2="312" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor="#168B7B" /><stop offset="1" stopColor="#0B5E58" /></linearGradient></defs>
      <rect x="28" y="28" width="304" height="304" rx="94" fill="url(#qease-loader-badge)" />
      <path className="moving-q-loader-loop" d="M180 91C130.29 91 90 131.29 90 181C90 230.71 130.29 271 180 271C204.2 271 226.17 261.45 242.34 245.91" fill="none" stroke="#FFFFFF" strokeWidth="30" strokeLinecap="round" />
      <path className="moving-q-loader-tail" d="M190 190L252 252" fill="none" stroke="#FFFFFF" strokeWidth="30" strokeLinecap="round" />
      <path className="moving-q-loader-arrow" d="M219 252H252V219" fill="none" stroke="#B8EFE0" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="moving-q-loader-dot" cx="100" cy="96" r="12" fill="#B8EFE0" />
    </svg>
    {!compact && <span>{label}</span>}
  </div>
}

export function BarberMark({ size = 'normal' }: { size?: 'small' | 'normal' | 'large' }) {
  return <div className={`barber-mark barber-mark-${size}`} aria-hidden="true"><Scissors strokeWidth={2.2} /></div>
}

export function BusinessMark({ kind, size = 'normal' }: { kind: BusinessKind; size?: 'small' | 'normal' | 'large' }) {
  return <div className={`barber-mark business-mark business-mark-${kind} barber-mark-${size}`} aria-hidden="true">{kind === 'car-wash' ? <CarFront strokeWidth={2.2} /> : <Scissors strokeWidth={2.2} />}</div>
}

export function ServiceIcon({ icon, size = 18 }: { icon: ServiceIconName; size?: number }) {
  if (icon === 'sparkles') return <Sparkles size={size} strokeWidth={2} />
  if (icon === 'droplets') return <Droplets size={size} strokeWidth={2} />
  if (icon === 'car') return <CarFront size={size} strokeWidth={2} />
  if (icon === 'wind') return <Wind size={size} strokeWidth={2} />
  if (icon === 'spray') return <SprayCan size={size} strokeWidth={2} />
  return <Scissors size={size} strokeWidth={2} />
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = statusMeta[status]
  return <span className={`status-badge status-${meta.tone}`}><span className="status-dot" />{meta.label}</span>
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  if (!availability) return null
  const meta = availabilityMeta[availability]
  return <span className={`status-badge status-${meta.tone}`}><MapPin size={12} />{meta.label}</span>
}

export function QueueStatusBadge({ status }: { status: 'open' | 'paused' | 'closed' }) {
  const copy = status === 'open' ? 'Open now' : status === 'paused' ? 'Queue paused' : 'Closed to new customers'
  return <span className={`status-badge queue-${status}`}><span className="status-dot" />{copy}</span>
}

export function CrowdBadge({ count }: { count: number }) {
  const level = count <= 2 ? 'low' : count <= 6 ? 'moderate' : 'busy'
  const label = level === 'low' ? 'Low wait' : level === 'moderate' ? 'Moderate' : 'Busy'
  return <span className={`crowd-badge crowd-${level}`}><UsersRound size={14} />{label}</span>
}

export function Button({ children, className = '', variant = 'primary', feedback, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber'; feedback?: 'loading' | 'success' | 'error' }) {
  const loading = feedback === 'loading'
  return <button className={`button button-${variant} ${feedback ? `button-${feedback}` : ''} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</button>
}

export function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <span className="icon-label">{icon}{children}</span>
}

export function Modal({ open, title, children, onClose, wide = false }: { open: boolean; title?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          {title && <h2>{title}</h2>}
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function ConfirmDialog({ open, title, body, confirmLabel, confirmVariant = 'danger', onConfirm, onClose, children }: {
  open: boolean
  title: string
  body: ReactNode
  confirmLabel: string
  confirmVariant?: 'primary' | 'danger' | 'amber'
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="confirm-body">{body}</div>
      {children}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function Toggle({ checked, onChange, label, helper, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label?: string; helper?: string; disabled?: boolean }) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="toggle-copy">{label && <strong>{label}</strong>}{helper && <small>{helper}</small>}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-control" aria-hidden="true"><span /></span>
    </label>
  )
}

export function EstimateBlock({ estimate, compact = false }: { estimate: Estimate; compact?: boolean }) {
  if (estimate.paused) return <div className={`estimate-block ${compact ? 'estimate-compact' : ''}`}><span>Estimated wait</span><strong>Temporarily uncertain</strong></div>
  return <div className={`estimate-block ${compact ? 'estimate-compact' : ''}`}><span>Estimated wait</span><strong>{minutesLabel(estimate.min, estimate.max)}</strong></div>
}

export function ReturnWindowCard({ estimate, note }: { estimate: Estimate; note?: string }) {
  if (estimate.paused) {
    return <div className="return-window-card paused-window"><div><Clock3 size={19} /><span>RETURN WINDOW</span></div><strong>We’ll update this when the queue resumes.</strong><p>Your place is saved.</p></div>
  }
  return (
    <div className="return-window-card">
      <div><Clock3 size={19} /><span>SUGGESTED RETURN WINDOW</span></div>
      <strong>{formatReturnWindow(estimate.returnStart, estimate.returnEnd)}</strong>
      <p>{note ?? 'Come back in this window so we can keep your visit moving.'}</p>
    </div>
  )
}

export function TicketCard({ ticket, showActions, children }: { ticket: Ticket; showActions?: boolean; children?: ReactNode }) {
  const { businessSlug } = useParams()
  const { getService, estimateFor, clock } = useQueue(businessSlug)
  const service = getService(ticket.serviceId)
  const estimate = estimateFor(ticket)
  const joinedTime = new Date(ticket.joinedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const serviceMinutes = ticket.serviceStartedAt ? Math.max(1, Math.floor((clock - new Date(ticket.serviceStartedAt).getTime()) / 60_000)) : 0
  return (
    <article className={`ticket-card ticket-${ticket.status}`}>
      <div className="ticket-card-top">
        <div><span className="ticket-number-small">{ticket.id}</span><h3>{ticket.customerName}</h3></div>
        <StatusBadge status={ticket.status} />
      </div>
      <p className="ticket-service"><ServiceIcon icon={service?.icon ?? 'scissors'} size={15} /> {service?.name ?? 'Service'} <span>·</span> {service?.duration ?? 30} min</p>
      <div className="ticket-card-meta">
        <span>Joined {joinedTime}</span>
        {['waiting', 'return-soon', 'called'].includes(ticket.status) && <span>Expected {estimate.paused ? 'when resumed' : minutesLabel(estimate.min, estimate.max)}</span>}
        {ticket.status === 'in-service' && <span data-live-tick={clock}>Serving {serviceMinutes} min</span>}
      </div>
      <div className="ticket-card-badges"><AvailabilityBadge availability={ticket.availability} />{ticket.manual && <span className="status-badge status-slate">Walk-in</span>}</div>
      {ticket.note && <p className="ticket-note">“{ticket.note}”</p>}
      {showActions && children && <div className="ticket-actions">{children}</div>}
    </article>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <Check size={24} />}</div><h3>{title}</h3><p>{children}</p>{action && <div>{action}</div>}</div>
}

export function HelperTip({ children }: { children: ReactNode }) {
  return <span className="helper-tip" title="QEase estimates this from people ahead of you, selected services, and staff currently available."><BellRing size={14} />{children}</span>
}

export function ProgressSteps({ current, steps }: { current: number; steps: string[] }) {
  return <ol className="progress-steps">{steps.map((step, index) => <li key={step} className={index <= current ? 'active' : ''}><span>{index < current ? <Check size={13} /> : index + 1}</span><em>{step}</em></li>)}</ol>
}

export function DashboardHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="dashboard-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>{children}</div>
}

export function LinkArrow({ children }: { children: ReactNode }) {
  return <span className="link-arrow">{children}<ChevronRight size={16} /></span>
}
