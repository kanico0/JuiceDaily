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

// ── AsyncStorage cache (display-only) ─────────────────────────
// The cache stores the last known server response for UI display.
// It must NEVER be used to authorize a scan or log when the server
// is unreachable. All authorization decisions require a live server
// response. When the server is unreachable, operations fail with
// 'network_error' — no local fallback grants access.
const CACHE_KEY = '@guest_journey_cache'
let cachedState: GuestJourneyState | null = null

async function readCache (): Promise<GuestJourneyState | null> {
  if (cachedState) return cachedState
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (raw) {
      cachedState = JSON.parse(raw) as GuestJourneyState
      return cachedState
    }
  } catch {
    // Best-effort cache read.
  }
  return null
}

async function writeCache (state: GuestJourneyState): Promise<void> {
  cachedState = state
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state))
  } catch {
    // Best-effort cache write.
  }
}

export function createJourneyId (): string {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const UNAVAILABLE_STATE: GuestJourneyState = {
  status: 'available',
  journeyId: null,
  scanRequestId: null,
  logOperationId: null,
  scanCompletedAt: null,
  logCompletedAt: null,
}

export async function checkGuestJourney (): Promise<GuestJourneyState> {
  if (!SUPABASE_CONFIGURED) {
    return UNAVAILABLE_STATE
  }

  const token = await getAccessToken()
  if (!token) {
    return UNAVAILABLE_STATE
  }

  try {
    const res = await fetch(functionUrl('status'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      // Server error: return cached state for display, but do NOT
      // authorize any operation. Callers must check the 'code'
      // from reserve/finalize/release to determine authorization.
      const cached = await readCache()
      return cached ?? UNAVAILABLE_STATE
    }
    const body = await res.json()
    const state: GuestJourneyState = {
      status: body.status as GuestJourneyStatus,
      journeyId: body.journey_id ?? null,
      scanRequestId: body.scan_request_id ?? null,
      logOperationId: body.log_operation_id ?? null,
      scanCompletedAt: body.scan_completed_at ?? null,
      logCompletedAt: body.log_completed_at ?? null,
    }
    await writeCache(state)
    return state
  } catch {
    // Network error: return cached state for display only.
    // Authorization is never granted from cache — reserve/finalize/
    // release will return 'network_error' when the server is
    // unreachable.
    const cached = await readCache()
    return cached ?? UNAVAILABLE_STATE
  }
}

export async function reserveGuestJourney (
  journeyId: string,
  type: GuestJourneyType,
): Promise<GuestJourneyResult> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, code: 'server_not_configured' }
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
    return { ok: false, code: 'server_not_configured' }
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
    return { ok: false, code: 'server_not_configured' }
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
    return { ok: false, code: 'server_not_configured' }
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
