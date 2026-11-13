import type { BusinessSlug, NearbyBusiness, QueueState, Ticket } from '../types'

export interface BrandColorPreset {
  id: string
  name: string
  color: string
  secondary: string
  surfaceTint: string
  badgeLabel: string
}

export const BRAND_COLOR_PRESETS: BrandColorPreset[] = [
  { id: 'indigo', name: 'Electric Indigo', color: '#4f46e5', secondary: '#7c3aed', surfaceTint: '#f5f3ff', badgeLabel: 'Modern SaaS' },
  { id: 'teal', name: 'QEase Emerald Teal', color: '#0f766e', secondary: '#0d9488', surfaceTint: '#f0fdfa', badgeLabel: 'Classic' },
  { id: 'ocean', name: 'Oceanic Cyan', color: '#0284c7', secondary: '#06b6d4', surfaceTint: '#f0f9ff', badgeLabel: 'Fresh Bay' },
  { id: 'coral', name: 'Sunset Coral', color: '#ea580c', secondary: '#f43f5e', surfaceTint: '#fff7ed', badgeLabel: 'Warm Energy' },
  { id: 'rose', name: 'Studio Crimson Rose', color: '#e11d48', secondary: '#9333ea', surfaceTint: '#fff1f2', badgeLabel: 'Bold Studio' },
  { id: 'emerald', name: 'Botanical Forest', color: '#15803d', secondary: '#10b981', surfaceTint: '#f0fdf4', badgeLabel: 'Natural' },
]

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '').trim()
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned.padEnd(6, '0').slice(0, 6)
  const num = Number.parseInt(normalized, 16)
  if (Number.isNaN(num)) return { r: 15, g: 118, b: 110 }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

export function deriveBrandCssVariables(primaryHex: string): Record<string, string> {
  const hex = primaryHex && primaryHex.startsWith('#') ? primaryHex : '#0f766e'
  const { r, g, b } = hexToRgb(hex)
  const darken = (channel: number, factor: number) => Math.max(0, Math.min(255, Math.round(channel * factor)))
  const darkHex = `#${[darken(r, 0.82), darken(g, 0.82), darken(b, 0.82)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
  const deepHex = `#${[darken(r, 0.38), darken(g, 0.42), darken(b, 0.45)].map((v) => v.toString(16).padStart(2, '0')).join('')}`

  return {
    '--business-accent': hex,
    '--brand-primary': hex,
    '--brand-primary-hover': darkHex,
    '--brand-deep': deepHex,
    '--brand-soft': `rgba(${r}, ${g}, ${b}, 0.12)`,
    '--brand-border': `rgba(${r}, ${g}, ${b}, 0.28)`,
    '--brand-glow': `rgba(${r}, ${g}, ${b}, 0.22)`,
  }
}

export function remainingMinutesForCurrentService(
  state: QueueState,
  nowMs: number = Date.now(),
): {
  servingTicket: Ticket | null
  serviceName: string | null
  staffName: string | null
  elapsedMinutes: number
  totalDurationMinutes: number
  remainingMinutes: number
} {
  const serving = state.tickets.find((ticket) => ticket.status === 'in-service') ?? null
  if (!serving) {
    return {
      servingTicket: null,
      serviceName: null,
      staffName: null,
      elapsedMinutes: 0,
      totalDurationMinutes: 0,
      remainingMinutes: 0,
    }
  }
  const service = state.services.find((item) => item.id === serving.serviceId)
  const staff = state.staff.find((member) => member.id === serving.assignedStaffId)
  const totalDurationMinutes = service?.duration ?? 30
  const startedMs = serving.serviceStartedAt ? new Date(serving.serviceStartedAt).getTime() : nowMs
  const elapsedMinutes = Math.max(0, Math.round((nowMs - startedMs) / 60_000))
  const remainingMinutes = Math.max(1, totalDurationMinutes - elapsedMinutes)

  return {
    servingTicket: serving,
    serviceName: service?.name ?? serving.serviceNameSnapshot ?? 'Service',
    staffName: staff?.name ?? null,
    elapsedMinutes,
    totalDurationMinutes,
    remainingMinutes,
  }
}

export function buildLiveQueueSnapshot(
  businesses: Record<BusinessSlug, QueueState>,
  nowMs: number = Date.now(),
) {
  const summaries = (Object.keys(businesses) as BusinessSlug[]).map((slug) => {
    const state = businesses[slug]
    const current = remainingMinutesForCurrentService(state, nowMs)
    const waitingList = state.tickets.filter((t) => ['waiting', 'return-soon', 'called'].includes(t.status))
    const calledTicket = state.tickets.find((t) => t.status === 'called') ?? null
    const nextWaiting = state.tickets.find((t) => t.status === 'return-soon' || t.status === 'waiting') ?? null
    const activeStaff = state.staff.filter((s) => s.activeToday && (s.status === 'available' || s.status === 'serving'))
    const freeStaff = state.staff.filter((s) => s.activeToday && s.status === 'available' && !s.assignedTicketId)

    return {
      slug,
      name: state.business.name,
      category: state.business.category,
      location: state.business.location,
      hours: `${state.business.openingTime}–${state.business.closingTime} (${state.business.openDays})`,
      queueStatus: state.business.closedToday ? 'closed' : state.business.queueStatus,
      accentColor: state.business.accentColor,
      activeStaffCount: activeStaff.length,
      freeStaffCount: freeStaff.length,
      nowServing: current.servingTicket
        ? {
            ticketId: current.servingTicket.id,
            customerName: current.servingTicket.customerName,
            serviceName: current.serviceName,
            staffName: current.staffName,
            elapsedMinutes: current.elapsedMinutes,
            totalDurationMinutes: current.totalDurationMinutes,
            minutesLeftToFinish: current.remainingMinutes,
          }
        : null,
      calledNow: calledTicket
        ? {
            ticketId: calledTicket.id,
            customerName: calledTicket.customerName,
          }
        : null,
      nextInLine: nextWaiting
        ? {
            ticketId: nextWaiting.id,
            customerName: nextWaiting.customerName,
            status: nextWaiting.status,
          }
        : null,
      waitingCount: waitingList.length,
      waitingTickets: waitingList.map((t, idx) => ({
        position: idx + 1,
        ticketId: t.id,
        customerName: t.customerName,
        status: t.status,
        service: state.services.find((s) => s.id === t.serviceId)?.name ?? t.serviceNameSnapshot ?? 'Service',
      })),
      services: state.services
        .filter((s) => s.active)
        .map((s) => ({ name: s.name, durationMinutes: s.duration, priceRupiah: s.price })),
    }
  })

  return summaries
}

const DEFAULT_ANCHOR: [number, number] = [-6.2603, 106.8192]

export function calculateDistanceKm(from: [number, number], to: [number, number]): number {
  const rad = (n: number) => (n * Math.PI) / 180
  const [lat1, lon1] = from
  const [lat2, lon2] = to
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceLabel(km: number, kind: string): string {
  const meters = Math.round(km * 1000)
  const distText = km < 1 ? `${meters} m` : `${km.toFixed(1)} km`
  if (kind === 'car-wash' || km >= 1.2) {
    const driveMins = Math.max(2, Math.round(km * 3.5))
    return `${distText} · ${driveMins} min drive`
  }
  const walkMins = Math.max(2, Math.round(km * 12))
  return `${distText} · ${walkMins} min walk`
}

/**
 * Repositions the nearby businesses around the user's actual coordinates
 * if the user is more than 2.5 km away from the default Kemang anchor,
 * preserving each business's relative offset so "Near Me" always shows accurate local distances.
 */
export function relocateBusinessesNearCoords(
  businesses: NearbyBusiness[],
  userLocation: [number, number] | null,
): NearbyBusiness[] {
  if (!userLocation) return businesses
  const distanceFromDefault = calculateDistanceKm(userLocation, DEFAULT_ANCHOR)
  const shouldShift = distanceFromDefault > 2.5

  return businesses.map((business) => {
    const dLat = business.latitude - DEFAULT_ANCHOR[0]
    const dLng = business.longitude - DEFAULT_ANCHOR[1]
    const latitude = shouldShift ? Number((userLocation[0] + dLat).toFixed(6)) : business.latitude
    const longitude = shouldShift ? Number((userLocation[1] + dLng).toFixed(6)) : business.longitude
    const km = calculateDistanceKm(userLocation, [latitude, longitude])

    return {
      ...business,
      latitude,
      longitude,
      distance: formatDistanceLabel(km, business.kind),
    }
  })
}
