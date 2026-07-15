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
import { isDurableUser } from '../supabase/accountLink'
import type { ScanQuotaErrorCode, ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'

export class ScanQuotaError extends Error {
  code: ScanQuotaErrorCode
  quota: ScanQuotaSnapshot | null

  constructor (code: ScanQuotaErrorCode, message: string, quota: ScanQuotaSnapshot | null = null) {
    super(message)
    this.name = 'ScanQuotaError'
    this.code = code
    this.quota = quota
  }
}

export function isServerScanAvailable (): boolean {
  return isSupabaseConfigured()
}

function functionUrl (name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`
}

async function authedFetch (name: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  if (!token) {
    throw new ScanQuotaError('unauthenticated', 'No authenticated user for quota request')
  }
  return fetch(functionUrl(name), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
}

function parseQuota (raw: unknown): ScanQuotaSnapshot | null {
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
  }
}

// ── Quota snapshot ───────────────────────────────────────────

export async function fetchScanQuota (): Promise<ScanQuotaSnapshot | null> {
  if (!isServerScanAvailable()) return null
  try {
    const res = await authedFetch('scan-quota', { method: 'GET' })
    if (!res.ok) return null
    const body = await res.json()
    return parseQuota(body.quota ?? body)
  } catch (e) {
    if (e instanceof ScanQuotaError) throw e
    if (__DEV__) console.warn('[quota] fetchScanQuota failed:', (e as Error)?.message)
    return null
  }
}

// ── Server scan (reserve → vision → commit/release) ─────────

export interface ServerScanResponse {
  rawText: string
  quota: ScanQuotaSnapshot | null
}

export async function analyzeScanOnServer (
  imageBase64: string,
  mediaType: string,
  requestId: string,
  depthDataMm: number[] | null = null,
): Promise<ServerScanResponse> {
  // Durable-account gate: funded scans require a permanent identity
  // so the allowance can never be reset by reinstalling or clearing
  // storage. Checked BEFORE any request — no scan is reserved or
  // consumed until authentication succeeds.
  const durable = await isDurableUser()
  if (!durable) {
    throw new ScanQuotaError(
      'account_required',
      'A free account is required before your first scan',
    )
  }

  const res = await authedFetch('analyze-scan', {
    method: 'POST',
    body: JSON.stringify({
      requestId,
      mediaType,
      imageBase64,
      depthDataMm: depthDataMm && depthDataMm.length > 0 ? depthDataMm.slice(0, 100) : null,
    }),
  })

  const body = await res.json().catch(() => ({}))
  const quota = parseQuota(body.quota)

  if (res.status === 429) {
    const code: ScanQuotaErrorCode =
      body.code === 'daily_limit_reached' ? 'daily_limit_reached' : 'monthly_limit_reached'
    throw new ScanQuotaError(code, body.message ?? 'Scan limit reached', quota)
  }
  if (res.status === 401) {
    throw new ScanQuotaError('unauthenticated', 'Authentication failed')
  }
  if (!res.ok) {
    throw new ScanQuotaError('server_error', body.message ?? `Scan failed (${res.status})`, quota)
  }

  return {
    rawText: String(body.rawText ?? '[]'),
    quota,
  }
}
