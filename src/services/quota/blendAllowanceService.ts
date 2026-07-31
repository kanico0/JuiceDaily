// ─────────────────────────────────────────────────────────────
// blendAllowanceService.ts — Client for the server-authoritative
// Advanced Blend analysis allowance with reservation-finalization.
//
// Flow:
//   1. createOperationId() → operationId (UUID-based, one per attempt)
//   2. reserveBlendAllowance(ingredients, operationId) → { allowed, ... }
//   3. If allowed: run processJuiceBatch (nutrition calculation)
//   4. On success: finalizeBlendAllowance(operationId)
//   5. On failure: releaseBlendAllowance(operationId)
//
// The operationId is a UUID-based identifier created once per user
// confirmation. Retries reuse the same operationId so the server
// can deduplicate. A new analysis attempt gets a new operationId
// even with identical ingredients, so separate legitimate analyses
// each consume their own allowance.
//
// Simple Blends (1–4) always pass — no server call needed.
// Pro users: server checks subscriptions table, not client state.
//
// Fail-closed in production: if the server is unreachable, Advanced
// Blend nutrition is NOT provided. In development (__DEV__), a bypass
// is available for testing without a Supabase backend.
// ─────────────────────────────────────────────────────────────

import { SUPABASE_URL, SUPABASE_CONFIGURED } from '../subscriptions/subscriptionConfig'
import { getAccessToken } from '../supabase/identity'

// ── Types ────────────────────────────────────────────────────

export type BlendType = 'simple' | 'advanced'

export interface BlendAllowanceResult {
  allowed: boolean
  code: string
  remaining: number | null
  used: number
  reserved: number
  limit: number
  plan: 'free' | 'pro'
  blendType: BlendType
  requestId: string
}

export class BlendAllowanceError extends Error {
  code: string
  result: BlendAllowanceResult | null

  constructor (code: string, message: string, result: BlendAllowanceResult | null = null) {
    super(message)
    this.name = 'BlendAllowanceError'
    this.code = code
    this.result = result
  }
}

// ── Constants ───────────────────────────────────────────────

export const SIMPLE_BLEND_MAX_INGREDIENTS = 4
export const FREE_ADVANCED_BLEND_ALLOWANCE = 3

// ── Helpers ────────────────────────────────────────────────

export function classifyBlend (distinctIngredientCount: number): BlendType {
  return distinctIngredientCount >= 5 ? 'advanced' : 'simple'
}

export function countDistinctProduceIds (ingredients: { produceId: string }[]): number {
  const ids = new Set<string>()
  for (const ing of ingredients) {
    if (typeof ing.produceId === 'string' && ing.produceId.length > 0) {
      ids.add(ing.produceId.toLowerCase())
    }
  }
  return ids.size
}

// ── Operation ID (UUID-based, one per analysis attempt) ──────
//
// A unique operation ID is created when the user confirms a new
// Advanced Blend analysis. The same operation ID is reused for
// reserve, retries, finalize, and release for that one attempt.
// A later analysis attempt receives a new operation ID even when
// the ingredient combination is identical.

let _counter = 0

export function createOperationId (): string {
  _counter += 1
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  const counter = _counter.toString(36)
  return `advanced-blend-${ts}-${rand}-${counter}`
}

// Ingredient fingerprint for transaction metadata only.
// NOT used as the idempotency key — the operationId is.
export function ingredientFingerprint (ingredients: { produceId: string }[]): string {
  const ids = ingredients
    .map((i) => i.produceId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => id.toLowerCase())
    .sort()
  const distinct = [...new Set(ids)]
  return distinct.join('-')
}

// ── Server URL ──────────────────────────────────────────────

function functionUrl (): string {
  return `${SUPABASE_URL}/functions/v1/analyze-blend`
}

// ── Dev bypass: only in __DEV__ when Supabase is not configured ──

export function isDevBypass (): boolean {
  return __DEV__ && !SUPABASE_CONFIGURED
}

// ── Reserve an allowance unit ───────────────────────────────

export async function reserveBlendAllowance (
  ingredients: { produceId: string }[],
  operationId: string,
): Promise<BlendAllowanceResult> {
  const distinctCount = countDistinctProduceIds(ingredients)
  const blendType = classifyBlend(distinctCount)

  // Simple Blends: no server call needed.
  if (blendType === 'simple') {
    return {
      allowed: true,
      code: 'simple_blend_allowed',
      remaining: FREE_ADVANCED_BLEND_ALLOWANCE,
      used: 0,
      reserved: 0,
      limit: FREE_ADVANCED_BLEND_ALLOWANCE,
      plan: 'free',
      blendType: 'simple',
      requestId: operationId,
    }
  }

  // Dev bypass: only in development when Supabase is not configured.
  if (isDevBypass()) {
    return {
      allowed: true,
      code: 'dev_bypass',
      remaining: FREE_ADVANCED_BLEND_ALLOWANCE,
      used: 0,
      reserved: 0,
      limit: FREE_ADVANCED_BLEND_ALLOWANCE,
      plan: 'free',
      blendType: 'advanced',
      requestId: operationId,
    }
  }

  // Production: fail-closed if Supabase is not configured.
  if (!SUPABASE_CONFIGURED) {
    throw new BlendAllowanceError(
      'server_not_configured',
      'Advanced Blend analysis requires a server connection that is not available.',
    )
  }

  const token = await getAccessToken()
  if (!token) {
    throw new BlendAllowanceError('unauthenticated', 'No authenticated user for blend allowance check')
  }

  const ingredientIds = ingredients
    .map((i) => i.produceId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (ingredientIds.length === 0) {
    throw new BlendAllowanceError('no_ingredients', 'No valid ingredients to check')
  }

  const res = await fetch(functionUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'reserve',
      requestId: operationId,
      ingredientIds,
      ingredientFingerprint: ingredientFingerprint(ingredients),
    }),
  })

  const body = await res.json().catch(() => ({}))

  if (res.status === 403) {
    const result: BlendAllowanceResult = {
      allowed: false,
      code: String(body.code ?? 'advanced_blend_limit_reached'),
      remaining: typeof body.remaining === 'number' ? body.remaining : 0,
      used: typeof body.used === 'number' ? body.used : 0,
      reserved: typeof body.reserved === 'number' ? body.reserved : 0,
      limit: typeof body.limit === 'number' ? body.limit : FREE_ADVANCED_BLEND_ALLOWANCE,
      plan: body.plan === 'pro' ? 'pro' : 'free',
      blendType: (body.blend_type === 'advanced' ? 'advanced' : 'simple') as BlendType,
      requestId: String(body.request_id ?? operationId),
    }
    throw new BlendAllowanceError(result.code, body.message ?? 'Advanced Blend allowance reached', result)
  }

  if (res.status === 401) {
    throw new BlendAllowanceError('unauthenticated', 'Authentication failed')
  }

  if (!res.ok) {
    throw new BlendAllowanceError('server_error', body.message ?? `Allowance check failed (${res.status})`)
  }

  return {
    allowed: true,
    code: String(body.code ?? 'ok'),
    remaining: typeof body.remaining === 'number' ? body.remaining : null,
    used: typeof body.used === 'number' ? body.used : 0,
    reserved: typeof body.reserved === 'number' ? body.reserved : 0,
    limit: typeof body.limit === 'number' ? body.limit : FREE_ADVANCED_BLEND_ALLOWANCE,
    plan: body.plan === 'pro' ? 'pro' : 'free',
    blendType: (body.blend_type === 'advanced' ? 'advanced' : 'simple') as BlendType,
    requestId: String(body.request_id ?? operationId),
  }
}

// ── Finalize a reservation (commit after successful nutrition) ──

export async function finalizeBlendAllowance (requestId: string): Promise<void> {
  if (isDevBypass()) return
  if (!SUPABASE_CONFIGURED) return

  const token = await getAccessToken()
  if (!token) return

  try {
    await fetch(functionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'finalize', requestId }),
    })
  } catch (e) {
    if (__DEV__) console.warn('[blend] finalize failed (non-fatal):', (e as Error)?.message)
  }
}

// ── Release a reservation (cancel on failure) ───────────────

export async function releaseBlendAllowance (requestId: string): Promise<void> {
  if (isDevBypass()) return
  if (!SUPABASE_CONFIGURED) return

  const token = await getAccessToken()
  if (!token) return

  try {
    await fetch(functionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'release', requestId }),
    })
  } catch (e) {
    if (__DEV__) console.warn('[blend] release failed (non-fatal):', (e as Error)?.message)
  }
}

// ── Fetch allowance snapshot (display only) ─────────────────

export async function fetchBlendAllowance (): Promise<BlendAllowanceResult | null> {
  if (!SUPABASE_CONFIGURED) return null

  const token = await getAccessToken()
  if (!token) return null

  try {
    const res = await fetch(functionUrl(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) return null
    const body = await res.json()
    return {
      allowed: true,
      code: 'snapshot',
      remaining: typeof body.remaining === 'number' ? body.remaining : null,
      used: typeof body.used === 'number' ? body.used : 0,
      reserved: typeof body.reserved === 'number' ? body.reserved : 0,
      limit: typeof body.limit === 'number' ? body.limit : FREE_ADVANCED_BLEND_ALLOWANCE,
      plan: body.plan === 'pro' ? 'pro' : 'free',
      blendType: 'simple',
      requestId: '',
    }
  } catch {
    return null
  }
}
