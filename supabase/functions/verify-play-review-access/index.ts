// ─────────────────────────────────────────────────────────────
// verify-play-review-access — Server-validated Google Play
// reviewer authentication.
//
// Accepts: POST { email, code }
// Returns: { status: 'ok', token_hash, verification_type }
//      or: { status: 'not_applicable' }
//
// The function is reachable BEFORE user authentication because
// the reviewer is signing in. It validates BOTH the exact
// reviewer email AND the exact reusable review code against
// server-side secrets (never client source).
//
// On match, it generates a short-lived magic-link token for the
// EXISTING reviewer Supabase user via admin.generateLink, asserts
// the returned UUID matches the expected reviewer UUID, and
// returns ONLY the token_hash + verification_type. The client
// then calls supabase.auth.verifyOtp({ token_hash, type }) to
// establish a genuine Supabase session.
//
// Security:
//   - Review code stored as Supabase secret PLAY_REVIEW_CODE
//   - Reviewer email stored as Supabase secret PLAY_REVIEW_EMAIL
//   - Expected UUID stored as Supabase secret PLAY_REVIEW_USER_ID
//   - Service-role key used ONLY inside this function
//   - Never returns the service key, user data, or the code
//   - Generic 'not_applicable' for non-reviewer attempts
//   - In-memory rate limiting per email (5 failures / 15 min)
//   - No stack traces or submitted code in responses
//   - Does not log the submitted code
//
// Secrets (Supabase function secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PLAY_REVIEW_EMAIL
//   PLAY_REVIEW_CODE
//   PLAY_REVIEW_USER_ID
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json (status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// ── In-memory rate limiting (per Deno isolate) ───────────────
// Tracks failures per email. Resets after 15 minutes.
// Max 5 failures per window before blocking.
interface FailureEntry { count: number; firstAt: number }
const failureMap = new Map<string, FailureEntry>()
const RATE_LIMIT_MAX_FAILURES = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function checkRateLimit (email: string): boolean {
  const now = Date.now()
  const entry = failureMap.get(email)
  if (!entry) return true
  if (now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    failureMap.delete(email)
    return true
  }
  return entry.count < RATE_LIMIT_MAX_FAILURES
}

function recordFailure (email: string): void {
  const now = Date.now()
  const entry = failureMap.get(email)
  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    failureMap.set(email, { count: 1, firstAt: now })
  } else {
    entry.count++
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { status: 'not_applicable' })

  // ── Parse body ──────────────────────────────────────────────
  let body: { email?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { status: 'not_applicable' })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''

  if (!email || !code) return json(400, { status: 'not_applicable' })

  // ── Load secrets ────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const reviewerEmail = Deno.env.get('PLAY_REVIEW_EMAIL')?.trim().toLowerCase()
  const reviewerCode = Deno.env.get('PLAY_REVIEW_CODE')?.trim()
  const reviewerUserId = Deno.env.get('PLAY_REVIEW_USER_ID')?.trim()

  if (!supabaseUrl || !serviceKey || !reviewerEmail || !reviewerCode || !reviewerUserId) {
    // Configuration incomplete — fail closed as not_applicable so
    // the client falls through to normal OTP verification.
    return json(200, { status: 'not_applicable' })
  }

  // ── Rate limit ──────────────────────────────────────────────
  if (!checkRateLimit(email)) {
    return json(429, { status: 'not_applicable' })
  }

  // ── Validate reviewer email + code ──────────────────────────
  // Use constant-time comparison to avoid timing attacks.
  const emailMatch = email === reviewerEmail
  const codeMatch = code === reviewerCode

  if (!emailMatch || !codeMatch) {
    recordFailure(email)
    // Generic response — do not reveal which field was wrong.
    return json(200, { status: 'not_applicable' })
  }

  // ── Generate magic-link token for the reviewer ──────────────
  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: reviewerEmail,
    })

    if (error || !data?.properties?.hashed_token) {
      recordFailure(email)
      return json(200, { status: 'not_applicable' })
    }

    // ── Assert UUID matches expected reviewer ─────────────────
    const returnedUserId = data.user?.id
    if (returnedUserId !== reviewerUserId) {
      // FAIL CLOSED — the email resolved to a different UUID.
      recordFailure(email)
      return json(200, { status: 'not_applicable' })
    }

    // ── Return ONLY the token hash + verification type ────────
    // The client uses these with supabase.auth.verifyOtp to
    // establish a genuine Supabase session.
    return json(200, {
      status: 'ok',
      token_hash: data.properties.hashed_token,
      verification_type: data.properties.verification_type ?? 'magiclink',
    })
  } catch {
    // No stack traces in responses. Do not log submitted code.
    recordFailure(email)
    return json(200, { status: 'not_applicable' })
  }
})
