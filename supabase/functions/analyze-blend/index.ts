// ─────────────────────────────────────────────────────────────
// analyze-blend — Edge Function for the freemium Advanced Blend
// analysis allowance with reservation-finalization pattern.
//
// Endpoints:
//   POST /reserve  — Reserve an allowance unit before nutrition calc
//   POST /finalize — Commit the reservation after successful calc
//   POST /release  — Release the reservation on failure/cancel
//   GET  /         — Fetch allowance snapshot (display only)
//
// Trust boundary:
//   The client sends ingredientIds. The server validates each ID
//   against a known produce registry (PRODUCE_IDS below), lowercases,
//   deduplicates, and counts distinct valid IDs. The server's count
//   is authoritative — a modified client cannot reduce the count by
//   omitting ingredients, sending aliases, or claiming a different
//   number. The same canonical ID array is stored in the usage event
//   and used for the allowance decision.
//
//   The client also sends a requestId (deterministic hash of the
//   canonical ingredient set). This enables idempotency: retrying
//   the same blend never consumes a second allowance.
//
// Pro authorization:
//   The server reads the `subscriptions` table (kept in sync by the
//   RevenueCat webhook Edge Function) to determine if the user is
//   Pro. Client RevenueCat state is advisory only and never bypasses
//   the server check.
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyPlayIntegrity } from '../_shared/playIntegrityVerifier.ts'
import {
  effectiveBlendRemaining,
  deviceBlendRemaining,
  decodeBlendDeviceUsed,
  encodeNextBlendWriteValues,
  FREE_DEVICE_BLEND_LIMIT,
} from '../_shared/deviceRecallBits.ts'
import { writeDeviceRecall } from '../_shared/deviceRecallWriter.ts'
import { serverIntegrityLog } from '../_shared/integrityServerLog.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// ── Known produce IDs (must match JuiceEngine.ts PRODUCE_DATA) ──
// Used to validate that client-sent ingredient IDs are real.
// Aliases (apple/apple_green/apple_red) are all valid distinct IDs.
const PRODUCE_IDS = new Set([
  'kale',
  'spinach',
  'swiss_chard',
  'collard_greens',
  'dandelion_greens',
  'arugula',
  'romaine',
  'bok_choy',
  'wheatgrass',
  'parsley',
  'cilantro',
  'mint',
  'basil',
  'aloe_vera',
  'broccoli',
  'cabbage_green',
  'cabbage_red',
  'cauliflower',
  'kohlrabi',
  'carrot',
  'celery',
  'beet',
  'cucumber',
  'fennel',
  'sweet_potato',
  'turnip',
  'celeriac',
  'jicama',
  'zucchini',
  'asparagus',
  'radish',
  'ginger',
  'turmeric',
  'garlic',
  'bell_pepper_red',
  'bell_pepper_yellow',
  'bell_pepper_green',
  'jalapeño',
  'cayenne',
  'tomato',
  'apple',
  'apple_green',
  'apple_red',
  'lemon',
  'lime',
  'orange',
  'grapefruit',
  'pineapple',
  'watermelon',
  'pomegranate',
  'mango',
  'papaya',
  'kiwi',
  'pear',
  'grape',
  'strawberry',
  'blueberry',
  'raspberry',
  'blackberry',
  'cranberry',
  'cherry',
  'cantaloupe',
  'honeydew',
  'coconut_water',
  'passion_fruit',
  'peach',
  'plum',
  'nectarine',
])

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// ── Canonicalize ingredient IDs ──────────────────────────────
// Lowercase, validate against known produce registry, deduplicate.
// Returns { valid: string[], invalid: string[], distinctCount: number }
function canonicalizeIngredientIds(raw: unknown): {
  valid: string[]
  invalid: string[]
  distinctCount: number
} {
  if (!Array.isArray(raw)) return { valid: [], invalid: [], distinctCount: 0 }

  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []

  for (const id of raw) {
    if (typeof id !== 'string' || id.length === 0) {
      invalid.push(String(id))
      continue
    }
    const lower = id.toLowerCase()
    if (!PRODUCE_IDS.has(lower)) {
      invalid.push(lower)
      continue
    }
    if (!seen.has(lower)) {
      seen.add(lower)
      valid.push(lower)
    }
  }

  return { valid, invalid, distinctCount: valid.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // ── Auth ────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return json(401, { message: 'Missing authorization' })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) return json(401, { message: 'Invalid token' })

  // ── Durable-account gate (server-authoritative) ────────────
  // Anonymous Supabase users carry the 'authenticated' role, so
  // the gate checks the server-trusted is_anonymous flag on the
  // VERIFIED user record. Runs BEFORE any allowance reservation
  // or consumption. This prevents the anonymous-reset bypass
  // where a user clears storage, gets a new anonymous identity,
  // and receives another 3 free Advanced Blend allowances.
  if (userData.user.is_anonymous === true) {
    return json(403, {
      code: 'account_required',
      message: 'A verified account is required before using Advanced Blend',
    })
  }

  const userId = userData.user.id

  // ── GET: fetch allowance snapshot ───────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await admin.rpc('get_advanced_blend_allowance', {
      p_user_id: userId,
    })
    if (error) return json(500, { message: 'Failed to fetch allowance' })
    return json(200, data as Record<string, unknown>)
  }

  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  // ── Parse body ──────────────────────────────────────────────
  let body: {
    action?: string
    requestId?: string
    ingredientIds?: unknown
    integrityToken?: string
    isMockToken?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid JSON body' })
  }

  const action = String(body.action ?? 'reserve')
  const requestId = String(body.requestId ?? '')
  const integrityToken = body.integrityToken ?? ''
  const isMockToken = body.isMockToken ?? false

  if (!requestId) return json(400, { message: 'Missing requestId' })

  // ── Finalize / Release: only need requestId ─────────────────
  if (action === 'finalize') {
    const { data, error } = await admin.rpc('finalize_advanced_blend', {
      p_user_id: userId,
      p_request_id: requestId,
    })
    if (error) {
      console.error('[analyze-blend] finalize failed:', error.message)
      return json(500, { message: 'Finalization failed' })
    }
    const result = data as Record<string, unknown>
    if (!result.ok) return json(400, result)

    // ── Device Recall write: increment blend count on device ──
    // Only for Free users with write enabled and a valid integrity token.
    // Pro users bypass Device Recall entirely.
    const deviceRecallWriteEnabled = Deno.env.get('DEVICE_RECALL_WRITE_ENABLED') === '1'
    const plan = String(result.plan ?? 'free')
    const isPro = plan === 'pro'

    if (deviceRecallWriteEnabled && !isPro && integrityToken && result.ok) {
      // Verify the integrity token to read current blend bits.
      // Uses the same request hash as the reserve step so the same
      // token can be reused (Google allows token reuse for writes
      // for up to 14 days after verification).
      const expectedRequestHash = [requestId, userId, 'analyze_blend', 'reserve'].join('|')
      const deviceVerification = await verifyPlayIntegrity({
        token: integrityToken,
        expectedPackageName: Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? 'com.rawlifeflow.juicingdaily',
        expectedRequestHash,
        cloudProjectNumber: Deno.env.get('PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER') ?? '',
        serviceAccountJson: Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT') ?? '',
        isMock: isMockToken,
        enforcementMode: Deno.env.get('DEVICE_FREE_POOL_MODE') ?? 'observe',
      })

      if (deviceVerification.deviceRecallAvailable && deviceVerification.deviceBits) {
        const currentUsed = decodeBlendDeviceUsed(
          deviceVerification.deviceBits.bitSecond,
          deviceVerification.deviceBits.bitThird,
        )
        const writeValues = encodeNextBlendWriteValues(currentUsed)

        if (Object.keys(writeValues).length > 0) {
          const writeResult = await writeDeviceRecall({
            integrityToken,
            packageName: Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? 'com.rawlifeflow.juicingdaily',
            serviceAccountJson: Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT') ?? '',
            newValues: writeValues,
            operation: 'blend',
          })
          serverIntegrityLog('device_recall_write_result', requestId, writeResult.ok, undefined, {
            operation: 'blend',
            attempts: writeResult.attempts,
            residualRisk: writeResult.residualRisk,
          })
        }
      } else if (!deviceVerification.deviceRecallAvailable) {
        serverIntegrityLog('device_recall_write_not_attempted', requestId, true, undefined, {
          reason: 'unavailable',
          operation: 'blend',
        })
      }
    }

    return json(200, result)
  }

  if (action === 'release') {
    const { data, error } = await admin.rpc('release_advanced_blend', {
      p_user_id: userId,
      p_request_id: requestId,
    })
    if (error) {
      console.error('[analyze-blend] release failed:', error.message)
      return json(500, { message: 'Release failed' })
    }
    const result = data as Record<string, unknown>
    if (!result.ok) return json(400, result)
    return json(200, result)
  }

  // ── Reserve: validate ingredients and reserve allowance ─────
  if (action !== 'reserve') {
    return json(400, { message: `Unknown action: ${action}` })
  }

  const { valid, invalid, distinctCount } = canonicalizeIngredientIds(body.ingredientIds)

  if (distinctCount === 0) {
    return json(400, {
      message: 'No valid ingredient IDs provided',
      invalid_ids: invalid,
    })
  }

  // If there are invalid IDs, reject — the client must send only canonical IDs.
  if (invalid.length > 0) {
    return json(400, {
      message: 'Invalid ingredient IDs detected',
      invalid_ids: invalid,
    })
  }

  const { data, error } = await admin.rpc('reserve_advanced_blend', {
    p_user_id: userId,
    p_request_id: requestId,
    p_canonical_ids: valid,
    p_ingredient_count: distinctCount,
  })

  if (error) {
    console.error('[analyze-blend] reserve failed:', error.message)
    return json(500, { message: 'Allowance reservation failed' })
  }

  const result = data as Record<string, unknown>

  if (!result.allowed) {
    return json(403, {
      code: result.code ?? 'advanced_blend_limit_reached',
      message: 'Advanced Blend allowance reached',
      allowed: false,
      remaining: result.remaining ?? 0,
      used: result.used ?? 0,
      reserved: result.reserved ?? 0,
      limit: result.limit ?? 3,
      plan: result.plan ?? 'free',
      blend_type: result.blend_type ?? 'advanced',
      request_id: result.request_id ?? requestId,
    })
  }

  // ── Device pool verification for Free Advanced Blend ────────
  // Pro users bypass Device Recall entirely.
  // Free users must pass Play Integrity verification and have
  // device blend remaining (bitSecond/bitThird < 11).
  // Simple Blend does not go through this function.
  const plan = String(result.plan ?? 'free')
  const isPro = plan === 'pro'
  const devicePoolMode = Deno.env.get('DEVICE_FREE_POOL_MODE') ?? 'off'

  if (devicePoolMode !== 'off' && !isPro && integrityToken) {
    const expectedRequestHash = [requestId, userId, 'analyze_blend', 'reserve'].join('|')

    serverIntegrityLog('blend_verify_called', requestId, true)
    const deviceVerification = await verifyPlayIntegrity({
      token: integrityToken,
      expectedPackageName: Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? 'com.rawlifeflow.juicingdaily',
      expectedRequestHash,
      cloudProjectNumber: Deno.env.get('PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER') ?? '',
      serviceAccountJson: Deno.env.get('PLAY_INTEGRITY_SERVICE_ACCOUNT') ?? '',
      isMock: isMockToken,
      enforcementMode: devicePoolMode,
    })

    serverIntegrityLog(
      'blend_verification_result',
      requestId,
      deviceVerification.ok,
      deviceVerification.reasonCode,
      { integrityStatus: deviceVerification.integrityStatus },
    )

    const accountRemaining = (result.remaining as number) ?? 0
    const devBlendRemaining = deviceVerification.deviceRecallAvailable
      ? deviceVerification.deviceBlendRemaining
      : FREE_DEVICE_BLEND_LIMIT // In observe mode, fall back if unavailable
    const effectiveRemaining = effectiveBlendRemaining(accountRemaining, devBlendRemaining)

    // In enforce mode, block if device pool is exhausted or unavailable
    if (devicePoolMode === 'enforce') {
      const integrityFailed = !deviceVerification.ok
      const recallUnavailable = !deviceVerification.deviceRecallAvailable
      const blendExhausted =
        deviceVerification.deviceRecallAvailable && deviceVerification.deviceBlendRemaining === 0

      if (integrityFailed || recallUnavailable || blendExhausted) {
        // Release the account reservation before returning
        await admin.rpc('release_advanced_blend', {
          p_user_id: userId,
          p_request_id: requestId,
        })
        const blockCode = recallUnavailable ? 'device_recall_unavailable' : 'device_blend_exhausted'
        return json(403, {
          code: blockCode,
          message: recallUnavailable
            ? 'Device verification unavailable. Install from Google Play or upgrade to Pro.'
            : 'Free Advanced Blend analyses used for this device',
          allowed: false,
          remaining: result.remaining ?? 0,
          used: result.used ?? 0,
          reserved: 0,
          limit: result.limit ?? 3,
          plan: result.plan ?? 'free',
          blend_type: result.blend_type ?? 'advanced',
          request_id: result.request_id ?? requestId,
          deviceBlendRemaining: deviceVerification.deviceBlendRemaining,
          effectiveRemaining: 0,
        })
      }
    }

    // Return effective remaining (min of account and device)
    return json(200, {
      allowed: true,
      code: result.code,
      remaining: result.remaining,
      used: result.used,
      reserved: result.reserved,
      limit: result.limit,
      plan: result.plan,
      blend_type: result.blend_type,
      request_id: result.request_id ?? requestId,
      canonical_ingredient_ids: valid,
      server_ingredient_count: distinctCount,
      deviceBlendRemaining: devBlendRemaining,
      effectiveRemaining,
    })
  }

  return json(200, {
    allowed: true,
    code: result.code,
    remaining: result.remaining,
    used: result.used,
    reserved: result.reserved,
    limit: result.limit,
    plan: result.plan,
    blend_type: result.blend_type,
    request_id: result.request_id ?? requestId,
    canonical_ingredient_ids: valid,
    server_ingredient_count: distinctCount,
  })
})
