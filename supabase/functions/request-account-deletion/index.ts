// ─────────────────────────────────────────────────────────────
// request-account-deletion — Unauthenticated web-form endpoint
// for account deletion requests from rawlifeflow.com.
//
// Security:
//   * Does NOT immediately delete an account.
//   * Validates email format.
//   * Rate-limits by IP (max 3 requests per hour).
//   * Stores a deletion request for manual review.
//   * Returns the same neutral response for existing and
//     nonexistent accounts.
//   * Never reveals whether an account exists.
//   * Never sends account details back to the requester.
//   * Uses CORS restrictions for rawlifeflow.com only.
//   * Does not collect passwords or payment info.
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://rawlifeflow.com'

// Simple in-memory rate limiting (per Deno isolate).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 3

function json(status: number, body: Record<string, unknown>, origin?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(email.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') ?? ''
    if (origin !== ALLOWED_ORIGIN) {
      return new Response(null, { status: 403 })
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
      },
    })
  }

  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  // CORS check
  const origin = req.headers.get('Origin') ?? ''
  if (origin !== ALLOWED_ORIGIN) {
    return json(403, { message: 'Forbidden' })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { message: 'Server not configured' }, origin)
  }

  // Rate limit by IP
  const clientIp = req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(clientIp)) {
    return json(429, { message: 'Too many requests. Please try again later.' }, origin)
  }

  // Parse body
  let body: { email?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid request body' }, origin)
  }

  const email = body.email?.trim() ?? ''
  const note = body.note?.trim() ?? ''

  // Validate email
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailPattern.test(email)) {
    return json(400, { message: 'A valid email address is required.' }, origin)
  }

  // Hash the email — we never store the raw email for web requests.
  const emailHash = await hashEmail(email)

  // Store the deletion request
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.rpc('create_deletion_request', {
    p_email_hash: emailHash,
    p_note: note || null,
    p_request_ip: clientIp,
  })

  if (error) {
    console.error('[request-account-deletion] insert failed:', error.message)
    // Still return a neutral response to avoid revealing system state.
    return json(200, {
      message:
        'If an account matches the information submitted, we will process or contact you about the deletion request.',
    }, origin)
  }

  // Neutral response — never reveals whether the account exists.
  return json(200, {
    message:
      'If an account matches the information submitted, we will process or contact you about the deletion request.',
  }, origin)
})
