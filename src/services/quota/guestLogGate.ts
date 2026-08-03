// ─────────────────────────────────────────────────────────────
// guestLogGate.ts — Authorization gate for juice logging.
//
// Every juice log entry point must call authorizeGuestLog() before
// creating a juice log.  The gate checks the server-authoritative
// guest journey state and decides whether to allow or block.
//
// For scan-based logs (after a guest scan):
//   - The journey is in 'scan_completed' state.
//   - authorizeGuestLog() finalizes the journey (→ 'completed').
//
// For manual logs (no prior scan):
//   - The journey is in 'available' state.
//   - authorizeGuestLog() reserves + finalizes the journey.
//
// If the journey is already 'completed', the gate returns 'blocked'
// and the caller must show the registration modal.
// ─────────────────────────────────────────────────────────────

import {
  checkGuestJourney,
  reserveGuestJourney,
  finalizeGuestLog,
  releaseGuestJourney,
  createJourneyId,
  isDurableUser,
} from './guestJourneyService'
import { SUPABASE_CONFIGURED } from '../subscriptions/subscriptionConfig'

export type GuestLogGateResult =
  | { allowed: true; journeyId: string; isDurable: true }
  | { allowed: true; journeyId: string; isDurable: false; wasScanBased: boolean }
  | { allowed: false; reason: 'journey_completed' | 'journey_in_progress' | 'error'; message: string }

export async function authorizeGuestLog (
  logOperationId?: string,
): Promise<GuestLogGateResult> {
  // Offline / dev mode: no server to enforce guest journey, always allow.
  if (!SUPABASE_CONFIGURED) {
    return {
      allowed: true,
      journeyId: createJourneyId(),
      isDurable: true,
    }
  }

  // Durable users: always allowed, no guest journey tracking.
  const durable = await isDurableUser()
  if (durable) {
    return {
      allowed: true,
      journeyId: createJourneyId(),
      isDurable: true,
    }
  }

  // Guest user: check journey state.
  const state = await checkGuestJourney()

  if (state.status === 'completed') {
    return {
      allowed: false,
      reason: 'journey_completed',
      message: 'You have completed your first juice. Create a free account to continue.',
    }
  }

  if (state.status === 'scan_completed') {
    // Scan-based log: finalize the journey.
    const journeyId = state.journeyId ?? createJourneyId()
    const result = await finalizeGuestLog(journeyId, logOperationId)
    if (result.ok) {
      return { allowed: true, journeyId, isDurable: false, wasScanBased: true }
    }
    if (result.code === 'network_error') {
      return {
        allowed: false,
        reason: 'error',
        message: 'Network error. Please check your connection and try again.',
      }
    }
    return {
      allowed: false,
      reason: 'error',
      message: 'Failed to finalize guest journey.',
    }
  }

  if (state.status === 'available') {
    // Manual log: reserve + finalize.
    const journeyId = createJourneyId()
    const reserveResult = await reserveGuestJourney(journeyId, 'manual')
    if (!reserveResult.ok) {
      if (reserveResult.code === 'network_error') {
        return {
          allowed: false,
          reason: 'error',
          message: 'Network error. Please check your connection and try again.',
        }
      }
      return {
        allowed: false,
        reason: 'journey_completed',
        message: 'Guest journey already used — registration required.',
      }
    }
    const finalizeResult = await finalizeGuestLog(journeyId, logOperationId)
    if (finalizeResult.ok) {
      return { allowed: true, journeyId, isDurable: false, wasScanBased: false }
    }
    // If finalize failed, release the reservation.
    await releaseGuestJourney(journeyId)
    if (finalizeResult.code === 'network_error') {
      return {
        allowed: false,
        reason: 'error',
        message: 'Network error. Please check your connection and try again.',
      }
    }
    return {
      allowed: false,
      reason: 'error',
      message: 'Failed to finalize guest journey.',
    }
  }

  // scan_reserved or log_reserved — a journey is in progress.
  return {
    allowed: false,
    reason: 'journey_in_progress',
    message: 'A guest journey is already in progress.',
  }
}

export async function isGuestLogAllowed (): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return true

  const durable = await isDurableUser()
  if (durable) return true

  const state = await checkGuestJourney()
  return state.status === 'available' || state.status === 'scan_completed'
}
