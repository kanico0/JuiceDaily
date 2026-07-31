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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// ── Known produce IDs (must match JuiceEngine.ts PRODUCE_DATA) ──
// Used to validate that client-sent ingredient IDs are real.
// Aliases (apple/apple_green/apple_red) are all valid distinct IDs.
const PRODUCE_IDS = new Set([
  'kale', 'spinach', 'swiss_chard', 'collard_greens', 'dandelion_greens',
  'arugula', 'romaine', 'bok_choy', 'wheatgrass', 'parsley', 'cilantro',
  'mint', 'basil', 'aloe_vera',
  'broccoli', 'cabbage_green', 'cabbage_red', 'cauliflower', 'kohlrabi',
  'carrot', 'celery', 'beet', 'cucumber', 'fennel', 'sweet_potato',
  'turnip', 'celeriac', 'jicama', 'zucchini', 'asparagus', 'radish',
  'ginger', 'turmeric', 'garlic',
  'bell_pepper_red', 'bell_pepper_yellow', 'bell_pepper_green',
  'jalapeño', 'cayenne', 'tomato',
  'apple', 'apple_green', 'apple_red', 'lemon', 'lime', 'orange',
  'grapefruit', 'pineapple', 'watermelon', 'pomegranate', 'mango',
  'papaya', 'kiwi', 'pear', 'grape', 'strawberry', 'blueberry',
  'raspberry', 'blackberry', 'cranberry', 'cherry', 'cantaloupe',
  'honeydew', 'coconut_water', 'passion_fruit', 'peach', 'plum', 'nectarine',
])

function json (status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// ── Canonicalize ingredient IDs ──────────────────────────────
// Lowercase, validate against known produce registry, deduplicate.
// Returns { valid: string[], invalid: string[], distinctCount: number }
function canonicalizeIngredientIds (raw: unknown): {
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
  }

  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid JSON body' })
  }

  const action = String(body.action ?? 'reserve')
  const requestId = String(body.requestId ?? '')

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
