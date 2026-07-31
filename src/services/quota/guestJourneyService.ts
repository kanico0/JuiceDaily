// ─────────────────────────────────────────────────────────────
// guestJourneyService.ts — Client for the server-authoritative
// guest first-use journey.
//
// Allows exactly one independent juice experience before
// registration.  The server tracks state in
// guest_first_use_state keyed to the Supabase user UUID.
//
// Flow:
//   1. checkGuestJourney() → { status, journeyId, ... }
//   2. reserveGuestJourney(journeyId, type) → { ok, ... }
//   3. finalizeGuestScan(journeyId) or finalizeGuestLog(journeyId)
//   4. releaseGuestJourney(journeyId) on failure/cancel
//
// The UUID is preserved across anonymous-to-email upgrade, so
// the guest state survives registration.
// ─────────────────────────────────────────────────────────────

import { SUPABASE_URL, SUPABASE_CONFIGURED } from '../subscriptions/subscriptionConfig'
import { getAccessToken, getUserId } from '../supabase/identity'

export type GuestJourneyStatus =
  | 'available'
  | 'scan_reserved'
  | 'scan_completed'
  | 'log_reserved'
  | 'completed'

export type GuestJourneyType = 'scan' | 'manual'

export interface GuestJourneyState {
  status: GuestJourneyStatus
  journeyId: string | null
  scanRequestId: string | null
  logOperationId: string | null
  scanCompletedAt: string | null
  logCompletedAt: string | null
}

export interface GuestJourneyResult {
  ok: boolean
  code: string
  status?: GuestJourneyStatus
  journeyId?: string | null
}

function functionUrl (action: string): string {
  return `${SUPABASE_URL}/functions/v1/guest-journey?action=${action}`
}

// Fallback: if the Edge Function doesn't exist yet, use a local
// AsyncStorage-based flag so the app doesn't hard-block.
// The server remains authoritative when available.
let localGuestState: GuestJourneyStatus | null = null
const LOCAL_KEY = '@guest_journey_status'

async function readLocalState (): Promise<GuestJourneyStatus> {
  if (localGuestState) return localGuestState
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    const raw = await AsyncStorage.getItem(LOCAL_KEY)
    localGuestState = (raw as GuestJourneyStatus) || 'available'
    return localGuestState
  } catch {
    return 'available'
  }
}

async function writeLocalState (status: GuestJourneyStatus): Promise<void> {
  localGuestState = status
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    await AsyncStorage.setItem(LOCAL_KEY, status)
  } catch {
    // Best-effort.
  }
}

export function createJourneyId (): string {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function checkGuestJourney (): Promise<GuestJourneyState> {
  if (!SUPABASE_CONFIGURED) {
    const status = await readLocalState()
    return {
      status,
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    }
  }

  const token = await getAccessToken()
  if (!token) {
    return {
      status: 'available',
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    }
  }

  try {
    const res = await fetch(functionUrl('status'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const status = await readLocalState()
      return {
        status,
        journeyId: null,
        scanRequestId: null,
        logOperationId: null,
        scanCompletedAt: null,
        logCompletedAt: null,
      }
    }
    const body = await res.json()
    return {
      status: body.status as GuestJourneyStatus,
      journeyId: body.journey_id ?? null,
      scanRequestId: body.scan_request_id ?? null,
      logOperationId: body.log_operation_id ?? null,
      scanCompletedAt: body.scan_completed_at ?? null,
      logCompletedAt: body.log_completed_at ?? null,
    }
  } catch {
    const status = await readLocalState()
    return {
      status,
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    }
  }
}

export async function reserveGuestJourney (
  journeyId: string,
  type: GuestJourneyType,
): Promise<GuestJourneyResult> {
  if (!SUPABASE_CONFIGURED) {
    const status = await readLocalState()
    if (status !== 'available') {
      return { ok: false, code: 'journey_already_used', status }
    }
    const newStatus: GuestJourneyStatus = type === 'scan' ? 'scan_reserved' : 'log_reserved'
    await writeLocalState(newStatus)
    return { ok: true, code: 'reserved', status: newStatus, journeyId }
  }

  const token = await getAccessToken()
  if (!token) return { ok: false, code: 'unauthenticated' }

  try {
    const res = await fetch(functionUrl('reserve'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ journeyId, journeyType: type }),
    })
    const body = await res.json().catch(() => ({}))
    return {
      ok: Boolean(body.ok),
      code: String(body.code ?? 'unknown'),
      status: body.status as GuestJourneyStatus | undefined,
      journeyId: body.journey_id ?? journeyId,
    }
  } catch {
    return { ok: false, code: 'network_error' }
  }
}

export async function finalizeGuestScan (journeyId: string): Promise<GuestJourneyResult> {
  if (!SUPABASE_CONFIGURED) {
    const status = await readLocalState()
    if (status === 'scan_reserved') {
      await writeLocalState('scan_completed')
      return { ok: true, code: 'scan_completed', status: 'scan_completed', journeyId }
    }
    return { ok: false, code: 'invalid_state', status }
  }

  const token = await getAccessToken()
  if (!token) return { ok: false, code: 'unauthenticated' }

  try {
    const res = await fetch(functionUrl('finalize-scan'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ journeyId }),
    })
    const body = await res.json().catch(() => ({}))
    return {
      ok: Boolean(body.ok),
      code: String(body.code ?? 'unknown'),
      status: body.status as GuestJourneyStatus | undefined,
      journeyId,
    }
  } catch {
    return { ok: false, code: 'network_error' }
  }
}

export async function finalizeGuestLog (
  journeyId: string,
  logOperationId?: string,
): Promise<GuestJourneyResult> {
  if (!SUPABASE_CONFIGURED) {
    await writeLocalState('completed')
    return { ok: true, code: 'completed', status: 'completed', journeyId }
  }

  const token = await getAccessToken()
  if (!token) return { ok: false, code: 'unauthenticated' }

  try {
    const res = await fetch(functionUrl('finalize-log'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ journeyId, logOperationId }),
    })
    const body = await res.json().catch(() => ({}))
    return {
      ok: Boolean(body.ok),
      code: String(body.code ?? 'unknown'),
      status: body.status as GuestJourneyStatus | undefined,
      journeyId,
    }
  } catch {
    return { ok: false, code: 'network_error' }
  }
}

export async function releaseGuestJourney (journeyId: string): Promise<GuestJourneyResult> {
  if (!SUPABASE_CONFIGURED) {
    const status = await readLocalState()
    if (status === 'scan_reserved' || status === 'log_reserved') {
      await writeLocalState('available')
      return { ok: true, code: 'released', status: 'available', journeyId }
    }
    return { ok: true, code: 'no_op', status, journeyId }
  }

  const token = await getAccessToken()
  if (!token) return { ok: false, code: 'unauthenticated' }

  try {
    const res = await fetch(functionUrl('release'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ journeyId }),
    })
    const body = await res.json().catch(() => ({}))
    return {
      ok: Boolean(body.ok),
      code: String(body.code ?? 'unknown'),
      status: body.status as GuestJourneyStatus | undefined,
      journeyId,
    }
  } catch {
    return { ok: false, code: 'network_error' }
  }
}

export async function isGuestJourneyAvailable (): Promise<boolean> {
  const state = await checkGuestJourney()
  return state.status === 'available'
}

export async function isGuestJourneyCompleted (): Promise<boolean> {
  const state = await checkGuestJourney()
  return state.status === 'completed'
}

export async function isDurableUser (): Promise<boolean> {
  const userId = await getUserId()
  if (!userId) return false

  if (!SUPABASE_CONFIGURED) return false

  try {
    const { getSupabase } = await import('../supabase/supabaseClient')
    const supabase = getSupabase()
    if (!supabase) return false

    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (!session?.user) return false

    return (session.user as unknown as Record<string, unknown>).is_anonymous !== true
  } catch {
    return false
  }
}
