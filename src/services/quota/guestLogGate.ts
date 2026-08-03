// ─────────────────────────────────────────────────────────────
// guestLogGate.ts — Authorization gate for juice logging.
//
// Every juice log entry point must call authorizeGuestLog() before
// creating a juice log.  The gate checks the server-authoritative
// guest journey state and decides whether to allow or block.
//
// The guest journey tracks the first-use experience for conversion
// prompts but does NOT hard-block subsequent logs.  A guest who has
// already logged may continue logging — the registration nudge is
// handled by the UI layer, not by this gate.
//
// Only network errors cause a hard block (fail-closed for data
// integrity).  If the server is unreachable, the gate returns an
// error so the caller can show retry feedback.
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
  | {
      allowed: true
      journeyId: string
      isDurable: false
      wasScanBased: boolean
      hasPriorLog?: boolean
    }
  | { allowed: false; reason: 'journey_in_progress' | 'error'; message: string }

export async function authorizeGuestLog(logOperationId?: string): Promise<GuestLogGateResult> {
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

  // Journey already completed: allow logging (don't hard-block).
  // The UI layer can show a soft registration nudge, but logging
  // must not be prevented — users need to track their juices.
  if (state.status === 'completed') {
    return {
      allowed: true,
      journeyId: state.journeyId ?? createJourneyId(),
      isDurable: false,
      wasScanBased: false,
      hasPriorLog: true,
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
    // Server rejected finalize (e.g. already finalized): allow the log
    // anyway — the juice data is valid regardless of journey state.
    return {
      allowed: true,
      journeyId,
      isDurable: false,
      wasScanBased: true,
      hasPriorLog: true,
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
      // Reserve failed for non-network reason (e.g. already reserved):
      // allow the log — don't block the user from tracking their juice.
      return {
        allowed: true,
        journeyId,
        isDurable: false,
        wasScanBased: false,
        hasPriorLog: true,
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
    // Non-network finalize error: allow the log anyway.
    return {
      allowed: true,
      journeyId,
      isDurable: false,
      wasScanBased: false,
      hasPriorLog: true,
    }
  }

  // scan_reserved or log_reserved — a journey is in progress.
  // Allow the log rather than blocking — stale reservations should
  // not prevent the user from tracking their juice.
  return {
    allowed: true,
    journeyId: state.journeyId ?? createJourneyId(),
    isDurable: false,
    wasScanBased: false,
    hasPriorLog: true,
  }
}

export async function isGuestLogAllowed(): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return true

  const durable = await isDurableUser()
  if (durable) return true

  // Guest users: always allow logging. The guest journey tracks
  // first-use for conversion prompts but does not block juice logs.
  // Network errors are handled by authorizeGuestLog (fail-closed).
  return true
}
