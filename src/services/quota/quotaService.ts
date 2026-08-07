// ─────────────────────────────────────────────────────────────
// quotaService.ts — Client for the server-authoritative scan quota.
//
// All scan authorization happens on the server (Supabase Edge
// Functions). The client only displays cached balances and routes
// scans through the analyze-scan function, which reserves → runs
// vision → commits (or releases on technical failure).
// ─────────────────────────────────────────────────────────────

import { SUPABASE_URL } from '../subscriptions/subscriptionConfig'
import { isSupabaseConfigured } from '../supabase/supabaseClient'
import { getAccessToken } from '../supabase/identity'
import { isDurableUser, refreshSessionAndCheckDurable } from '../supabase/accountLink'
import {
  checkGuestJourney,
  reserveGuestJourney,
  releaseGuestJourney,
  createJourneyId,
} from './guestJourneyService'
import { buildAuthedHeaders, SupabaseConfigError } from './supabaseHeaders'
import type { ScanQuotaErrorCode, ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'
import { getDevicePromotionProvider } from '../devicePool/devicePromotionProviderFactory'
import { isDevicePoolEnabled } from '../devicePool/devicePoolConfig'
import type { AttestationRequestContext } from '../devicePool/devicePromotionProvider'
import { integrityLog } from '../devicePool/integrityLog'
import type { IntegrityReasonCode } from '../devicePool/integrityLog'

export class ScanQuotaError extends Error {
  code: ScanQuotaErrorCode
  quota: ScanQuotaSnapshot | null

  constructor(code: ScanQuotaErrorCode, message: string, quota: ScanQuotaSnapshot | null = null) {
    super(message)
    this.name = 'ScanQuotaError'
    this.code = code
    this.quota = quota
  }
}

// ── Device pool attestation ──────────────────────────────────
// Obtains a Play Integrity token (or mock) bound to the scan
// request. Only called when the device pool is enabled and the
// provider is supported. The token is sent to the server for
// verification — the client never interprets Device Recall.

async function getDeviceAttestation(
  requestId: string,
  userId: string,
  imageHash: string,
): Promise<{ token: string; isMock: boolean } | null> {
  if (!isDevicePoolEnabled()) {
    integrityLog('pool_mode_resolved', requestId, true, undefined, { mode: 'off' })
    return null
  }

  integrityLog('pool_mode_resolved', requestId, true, undefined, { mode: 'observe' })

  const provider = getDevicePromotionProvider()
  integrityLog('provider_selected', requestId, true, undefined, {
    provider: provider.getProviderName(),
  })

  integrityLog('provider_support', requestId, true, undefined, { checking: true })
  if (!provider.isSupported()) {
    integrityLog('provider_support', requestId, false, 'provider_unsupported')
    return null
  }
  integrityLog('provider_support', requestId, true, 'success')

  const ctx: AttestationRequestContext = {
    challenge: requestId,
    userId,
    action: 'analyze_scan',
    requestPayloadDigest: imageHash,
  }

  integrityLog('attestation_start', requestId, true)
  integrityLog('native_call_start', requestId, true)

  try {
    const result = await provider.getAttestationForScan(ctx)
    if (!result.token) {
      integrityLog('native_token_blank', requestId, false, 'blank_token')
      return null
    }
    integrityLog('native_token_received', requestId, true, 'success', { tokenPresent: true })
    return { token: result.token, isMock: result.isMock }
  } catch (e) {
    const msg = (e as Error)?.message ?? ''
    let reason: IntegrityReasonCode = 'unexpected_error'
    if (msg.includes('not available') || msg.includes('native')) {
      reason = 'native_module_unavailable'
    } else if (msg.includes('cloud project number') || msg.includes('cloud_project')) {
      reason = 'cloud_project_number_missing'
    } else if (msg.includes('prepare') || msg.includes('PI_') || msg.includes('PREPARATION')) {
      reason = 'prepare_failed'
    } else if (msg.includes('token') || msg.includes('request')) {
      reason = 'token_request_failed'
    }
    integrityLog('native_error', requestId, false, reason)
    return null
  }
}

export function isServerScanAvailable(): boolean {
  return isSupabaseConfigured()
}

function functionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`
}

async function authedFetch(name: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  if (!token) {
    throw new ScanQuotaError('unauthenticated', 'No authenticated user for quota request')
  }
  try {
    const headers = buildAuthedHeaders(token, init?.headers as Record<string, string> | undefined)
    // Defensive: ensure apikey is present and non-empty before sending.
    // If buildAuthedHeaders returned without apikey (should not happen
    // due to assertValidAnonKey, but guards against any future regression),
    // throw a clear local error rather than letting Supabase reject it.
    if (!headers.apikey || headers.apikey.trim() === '') {
      throw new SupabaseConfigError('Supabase anon key is missing from request headers')
    }
    return await fetch(functionUrl(name), {
      ...init,
      headers,
    })
  } catch (e) {
    if (e instanceof SupabaseConfigError) {
      throw new ScanQuotaError('server_error', e.message)
    }
    throw e
  }
}

export function parseQuota(raw: unknown): ScanQuotaSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  if (typeof q.limit !== 'number' || typeof q.used !== 'number') return null
  return {
    plan: q.plan === 'pro' ? 'pro' : 'free',
    limit: q.limit,
    used: q.used,
    remaining: typeof q.remaining === 'number' ? q.remaining : Math.max(0, q.limit - q.used),
    periodStart: String(q.periodStart ?? q.period_start ?? ''),
    periodEnd: String(q.periodEnd ?? q.period_end ?? ''),
    dailyLimit: typeof q.dailyLimit === 'number' ? q.dailyLimit : null,
    dailyUsed: typeof q.dailyUsed === 'number' ? q.dailyUsed : null,
    effectiveRemaining: typeof q.effectiveRemaining === 'number' ? q.effectiveRemaining : null,
    deviceRemaining: typeof q.deviceRemaining === 'number' ? q.deviceRemaining : null,
  }
}

// ── Quota snapshot ───────────────────────────────────────────

export async function fetchScanQuota(): Promise<ScanQuotaSnapshot | null> {
  if (!isServerScanAvailable()) return null
  try {
    const res = await authedFetch('scan-quota', { method: 'GET' })
    if (!res.ok) {
      console.debug(`[quota] fetchScanQuota status=${res.status}`)
      return null
    }
    const body = await res.json()
    return parseQuota(body.quota ?? body)
  } catch (e) {
    if (e instanceof ScanQuotaError) throw e
    console.debug(`[quota] fetchScanQuota error=${(e as Error)?.name ?? 'unknown'}`)
    return null
  }
}

// ── Server scan (reserve → vision → commit/release) ─────────

export interface ServerScanResponse {
  rawText: string
  quota: ScanQuotaSnapshot | null
}

async function performServerScan(
  imageBase64: string,
  mediaType: string,
  requestId: string,
  depthDataMm: number[] | null,
  guestJourneyId?: string | null,
  integrityToken?: string,
  integrityTokenIsMock?: boolean,
): Promise<ServerScanResponse> {
  const res = await authedFetch('analyze-scan', {
    method: 'POST',
    body: JSON.stringify({
      requestId,
      mediaType,
      imageBase64,
      depthDataMm: depthDataMm && depthDataMm.length > 0 ? depthDataMm.slice(0, 100) : null,
      guestJourneyId: guestJourneyId ?? undefined,
      integrityToken: integrityToken ?? '',
      integrityTokenIsMock: integrityTokenIsMock ?? false,
    }),
  })

  const body = await res.json().catch(() => ({}))
  const quota = parseQuota(body.quota)

  if (res.status === 429) {
    const rawCode = String(body.code ?? 'monthly_limit_reached')
    const code: ScanQuotaErrorCode =
      rawCode === 'daily_limit_reached'
        ? 'daily_limit_reached'
        : rawCode === 'device_pool_exhausted'
          ? 'monthly_limit_reached'
          : 'monthly_limit_reached'
    throw new ScanQuotaError(code, body.message ?? 'Scan limit reached', quota)
  }
  if (res.status === 401) {
    throw new ScanQuotaError('unauthenticated', 'Authentication failed')
  }
  if (res.status === 403 && body.code === 'account_required') {
    throw new ScanQuotaError('account_required', body.message ?? 'Account required')
  }
  if (res.status === 403 && body.code === 'journey_already_used') {
    throw new ScanQuotaError(
      'account_required',
      'Guest journey already used — registration required',
    )
  }
  if (!res.ok) {
    throw new ScanQuotaError('server_error', body.message ?? `Scan failed (${res.status})`, quota)
  }

  return {
    rawText: String(body.rawText ?? '[]'),
    quota,
  }
}

export async function analyzeScanOnServer(
  imageBase64: string,
  mediaType: string,
  requestId: string,
  depthDataMm: number[] | null = null,
): Promise<ServerScanResponse> {
  // Durable-account gate: funded scans require a permanent identity
  // so the allowance can never be reset by reinstalling or clearing
  // storage. Checked BEFORE any request — no scan is reserved or
  // consumed until authentication succeeds.
  //
  // Guest exception: anonymous users with an available guest journey
  // may perform exactly one scan. The guest journey is reserved on
  // the server via the guest-journey Edge Function before the scan.
  const durable = await isDurableUser()
  integrityLog('durable_check', requestId, true, undefined, { durable })

  if (!durable) {
    // Check if the guest has already used their complimentary scan.
    // Manual juice logging transitions journey to 'completed' but does
    // NOT set scanCompletedAt — only successful produce image analysis
    // sets scanCompletedAt. A guest who only logged manually must still
    // be allowed to scan for the first time.
    const guestState = await checkGuestJourney()
    if (guestState.scanCompletedAt) {
      throw new ScanQuotaError(
        'account_required',
        'You\u2019ve used your free produce scan. Create a free account to continue scanning.',
      )
    }

    // Reserve the guest journey for this scan.
    const journeyId = createJourneyId()
    const reserveResult = await reserveGuestJourney(journeyId, 'scan')
    if (!reserveResult.ok) {
      // Distinguish between a genuine "scan already used" (scanCompletedAt
      // is set) and a reserve failure from a manual-log-only journey
      // (scanCompletedAt is null). Only the former warrants account_required.
      if (reserveResult.code === 'journey_already_used') {
        const rechecked = await checkGuestJourney()
        if (rechecked.scanCompletedAt) {
          throw new ScanQuotaError(
            'account_required',
            'You\u2019ve used your free produce scan. Create a free account to continue scanning.',
          )
        }
        // scanCompletedAt is null but reserve still failed — this is a
        // server-side state issue (e.g. stale 'completed' from manual log
        // on an older server that hasn't been migrated). Surface as a
        // retryable server error, NOT an account gate.
        throw new ScanQuotaError(
          'server_error',
          'Unable to reserve your free scan. Please try again.',
        )
      }
      // Network or other failure — fail-closed with a retryable error.
      if (reserveResult.code === 'network_error') {
        throw new ScanQuotaError(
          'server_error',
          'Unable to connect to the scan service. Please check your connection and try again.',
        )
      }
      throw new ScanQuotaError(
        'server_error',
        'Unable to reserve your free scan. Please try again.',
      )
    }

    try {
      return await performServerScan(
        imageBase64,
        mediaType,
        requestId,
        depthDataMm,
        journeyId,
        undefined,
        undefined,
      )
    } catch (e) {
      // If the scan failed, release the guest journey so the user
      // can try again.
      if (e instanceof ScanQuotaError && e.code !== 'account_required') {
        await releaseGuestJourney(journeyId)
      }
      throw e
    }
  }

  // ── Device pool attestation ────────────────────────────────
  // Request a Play Integrity token bound to this scan request.
  // Only requested for the high-value action of starting an AI
  // scan — never for typing, browsing, or manual entry.
  let integrityToken: string | undefined
  let integrityTokenIsMock: boolean | undefined

  if (isDevicePoolEnabled()) {
    const token = await getAccessToken()
    if (token) {
      // Quick hash of the image for request binding (client-side;
      // the server recomputes and validates)
      const imageHash = await sha256Hex(imageBase64)
      // Extract user ID from the JWT payload (not trusted — the
      // server uses the verified JWT, not this client-supplied ID)
      const userId = extractUserIdFromToken(token)
      if (userId) {
        const attestation = await getDeviceAttestation(requestId, userId, imageHash)
        if (attestation) {
          integrityToken = attestation.token
          integrityTokenIsMock = attestation.isMock
          integrityLog('attestation_attached', requestId, true, 'success', { tokenPresent: true })
        } else {
          integrityLog('attestation_attached', requestId, false, 'unexpected_error', {
            tokenPresent: false,
          })
        }
      } else {
        integrityLog('attestation_attached', requestId, false, 'no_user_id', {
          tokenPresent: false,
        })
      }
    } else {
      integrityLog('attestation_attached', requestId, false, 'no_access_token', {
        tokenPresent: false,
      })
    }
  }

  integrityLog('scan_request_sent', requestId, true, undefined, {
    integrityTokenPresent: Boolean(integrityToken),
  })

  try {
    return await performServerScan(
      imageBase64,
      mediaType,
      requestId,
      depthDataMm,
      undefined,
      integrityToken,
      integrityTokenIsMock,
    )
  } catch (e) {
    // Stale-token recovery: right after an email upgrade the client
    // may still hold the pre-upgrade anonymous access token. Refresh
    // the session ONCE and retry ONLY if the refreshed user is
    // confirmed permanent. The same requestId makes the retry
    // idempotent server-side — no duplicate charge is possible.
    if (e instanceof ScanQuotaError && e.code === 'account_required') {
      const nowDurable = await refreshSessionAndCheckDurable()
      if (nowDurable) {
        return await performServerScan(
          imageBase64,
          mediaType,
          requestId,
          depthDataMm,
          undefined,
          integrityToken,
          integrityTokenIsMock,
        )
      }
    }
    throw e
  }
}

// ── Helpers for device pool attestation ──────────────────────

async function sha256Hex(text: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(text.slice(0, 4096))
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // Fallback: simple hash for environments without crypto.subtle
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i)
      hash |= 0
    }
    return `fallback_${Math.abs(hash).toString(16)}`
  }
}

function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload))
    return decoded?.sub ?? null
  } catch {
    return null
  }
}
