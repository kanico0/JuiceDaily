// ─────────────────────────────────────────────────────────────
// cameraEligibilityCoordinator.ts — Centralized pre-camera gate.
//
// Every camera entry point must call checkCameraEligibility() before
// opening the camera.  The coordinator checks:
//   1. Snap eligibility (ProStore free monthly / snap pack balance)
//   2. Guest journey state (server-authoritative, one free scan+log)
//   3. Durable auth status (anonymous vs authenticated)
//
// Returns a result that tells the caller what action to take:
//   - 'open_camera'      → proceed to open the camera
//   - 'show_snap_gate'   → show the SnapGateModal (out of free snaps)
//   - 'show_account_gate' → show AccountGateModal (guest journey completed)
//   - 'show_auth_resume'  → show AccountGateModal in 'signin' mode
//   - 'error'             → network or server error
//
// After a successful account gate authentication, the caller should
// call checkCameraEligibility() again to retry (auth resume).
// ─────────────────────────────────────────────────────────────

import { isDurableUser, checkGuestJourney } from './quota/guestJourneyService'
import { SUPABASE_CONFIGURED } from './subscriptions/subscriptionConfig'

export type CameraEligibilityAction =
  | 'open_camera'
  | 'show_snap_gate'
  | 'show_account_gate'
  | 'show_auth_resume'
  | 'error'

export interface CameraEligibilityResult {
  action: CameraEligibilityAction
  reason: string | null
  isDurable: boolean
  isPro: boolean
  snapRemaining: number
  guestJourneyStatus: string | null
}

export interface SnapEligibilityInfo {
  eligible: boolean
  remaining: number
  reason: string | null
  isPro: boolean
}

/**
 * Check whether the user is allowed to open the camera.
 *
 * @param snapEligibility  The result from ProStore.checkSnapEligibility()
 * @returns A CameraEligibilityResult indicating what action to take.
 */
export async function checkCameraEligibility(
  snapEligibility: SnapEligibilityInfo,
): Promise<CameraEligibilityResult> {
  // 1. Snap eligibility check (free monthly / snap pack / pro)
  if (!snapEligibility.eligible && !snapEligibility.isPro) {
    return {
      action: 'show_snap_gate',
      reason: snapEligibility.reason,
      isDurable: false,
      isPro: false,
      snapRemaining: 0,
      guestJourneyStatus: null,
    }
  }

  // 2. If Supabase is not configured, skip guest/auth checks
  //    (offline / dev mode — snap eligibility alone is sufficient)
  if (!SUPABASE_CONFIGURED) {
    return {
      action: 'open_camera',
      reason: null,
      isDurable: true,
      isPro: snapEligibility.isPro,
      snapRemaining: snapEligibility.remaining,
      guestJourneyStatus: null,
    }
  }

  // 3. Check durable auth status
  const durable = await isDurableUser()

  // 4. Check guest journey state
  const journey = await checkGuestJourney()

  // Durable (authenticated) user: always allow if snaps are available
  if (durable) {
    return {
      action: 'open_camera',
      reason: null,
      isDurable: true,
      isPro: snapEligibility.isPro,
      snapRemaining: snapEligibility.remaining,
      guestJourneyStatus: journey.status,
    }
  }

  // Anonymous user: check guest journey
  if (journey.status === 'completed') {
    // Guest has already completed their one free scan+log
    return {
      action: 'show_account_gate',
      reason: 'You have completed your first juice. Create a free account to continue scanning.',
      isDurable: false,
      isPro: false,
      snapRemaining: snapEligibility.remaining,
      guestJourneyStatus: journey.status,
    }
  }

  if (journey.status === 'scan_reserved' || journey.status === 'log_reserved') {
    // A journey is already in progress — show account gate to resolve
    return {
      action: 'show_auth_resume',
      reason: 'A guest session is in progress. Please sign in to continue.',
      isDurable: false,
      isPro: false,
      snapRemaining: snapEligibility.remaining,
      guestJourneyStatus: journey.status,
    }
  }

  // available or scan_completed — allow camera open
  return {
    action: 'open_camera',
    reason: null,
    isDurable: false,
    isPro: snapEligibility.isPro,
    snapRemaining: snapEligibility.remaining,
    guestJourneyStatus: journey.status,
  }
}

/**
 * Convenience helper: should the caller open the camera?
 */
export function shouldOpenCamera(result: CameraEligibilityResult): boolean {
  return result.action === 'open_camera'
}

/**
 * Convenience helper: should the caller show a gate modal?
 */
export function requiresGate(result: CameraEligibilityResult): boolean {
  return (
    result.action === 'show_snap_gate' ||
    result.action === 'show_account_gate' ||
    result.action === 'show_auth_resume'
  )
}
