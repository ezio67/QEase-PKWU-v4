import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeedState, nearbyBusinesses } from '../data'
import {
  buildLiveQueueSnapshot,
  deriveBrandCssVariables,
  remainingMinutesForCurrentService,
  relocateBusinessesNearCoords,
} from './queueAssistant'

test('remainingMinutesForCurrentService calculates accurate minutes left for active ticket', () => {
  const state = createSeedState('barber-kawan')
  // In seed state, A23 (Arif) started 12 minutes ago on a 30-minute Haircut
  const result = remainingMinutesForCurrentService(state, Date.now())
  assert.equal(result.servingTicket?.id, 'A23')
  assert.equal(result.serviceName, 'Haircut')
  assert.equal(result.totalDurationMinutes, 30)
  assert.ok(result.remainingMinutes >= 15 && result.remainingMinutes <= 20)
})

test('buildLiveQueueSnapshot returns live queue summary for both businesses', () => {
  const barber = createSeedState('barber-kawan')
  const wash = createSeedState('kilap-car-wash')
  const snapshot = buildLiveQueueSnapshot({
    'barber-kawan': barber,
    'kilap-car-wash': wash,
  })
  assert.equal(snapshot.length, 2)
  assert.equal(snapshot[0].slug, 'barber-kawan')
  assert.ok(snapshot[0].nowServing !== null)
  assert.equal(snapshot[0].nowServing?.ticketId, 'A23')
  assert.ok((snapshot[0].nowServing?.minutesLeftToFinish ?? 0) > 0)
})

test('deriveBrandCssVariables produces valid CSS variable map for custom brand color', () => {
  const vars = deriveBrandCssVariables('#4f46e5')
  assert.equal(vars['--business-accent'], '#4f46e5')
  assert.equal(vars['--brand-primary'], '#4f46e5')
  assert.ok(vars['--brand-soft'].startsWith('rgba(79, 70, 229,'))
})

test('relocateBusinessesNearCoords shifts businesses near user when far from Kemang', () => {
  const userCoords: [number, number] = [-6.1754, 106.8272] // Central Jakarta (Monas)
  const relocated = relocateBusinessesNearCoords(nearbyBusinesses, userCoords)
  assert.equal(relocated.length, nearbyBusinesses.length)
  // First business should now be within 2 km of userCoords
  const dLat = Math.abs(relocated[0].latitude - userCoords[0])
  const dLng = Math.abs(relocated[0].longitude - userCoords[1])
  assert.ok(dLat < 0.02 && dLng < 0.02)
})
