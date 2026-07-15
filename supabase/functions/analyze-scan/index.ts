// ─────────────────────────────────────────────────────────────
// analyze-scan — Server-authoritative AI scan.
//
// Flow: authenticate (verified JWT, permanent accounts only) →
// reserve quota (idempotent) → call Anthropic → commit on success /
// release on technical failure → return the raw model text +
// updated quota snapshot.
//
// Account gate: Supabase anonymous users carry the 'authenticated'
// role, so role/uid checks are insufficient. The user record is
// fetched from the Auth server via the verified token and the
// server-trusted is_anonymous flag must be false BEFORE any funded
// work (reservation, scan record, Anthropic call).
//
// Secrets (Supabase function secrets, never in the app):
//   ANTHROPIC_API_KEY
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'
import { evaluateScanUser, extractBearerToken } from '../_shared/authGate.ts'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'
const PROVIDER_TIMEOUT_MS = 30_000
const MAX_IMAGE_BASE64_CHARS = 1_500_000 // ~1.1MB binary

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json (status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function quotaFromRpc (raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const limit = Number(q.scan_limit ?? 0)
  const used = Number(q.used ?? 0)
  const reserved = Number(q.reserved ?? 0)
  return {
    plan: q.plan === 'pro' ? 'pro' : 'free',
    limit,
    used,
    remaining: Math.max(0, limit - used - reserved),
    periodStart: q.period_start ?? '',
    periodEnd: q.period_end ?? '',
    dailyLimit: q.plan === 'pro' ? 10 : null,
    dailyUsed: q.plan === 'pro' ? Number(q.daily_used ?? 0) : null,
  }
}

async function sha256Hex (text: string): Promise<string> {
  const data = new TextEncoder().encode(text.slice(0, 4096))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!anthropicKey) return json(500, { message: 'Server not configured' })

  // ── Authenticate the caller (user JWT) ─────────────────────
  // admin.auth.getUser(jwt) validates the token against the Auth
  // server (signature + expiry) and returns the canonical user
  // record. Identity is never taken from the request body, and a
  // merely Base64-decoded JWT payload is never trusted.
  const jwt = extractBearerToken(req.headers.get('Authorization'))
  if (!jwt) return json(401, { code: 'missing_authorization', message: 'Missing authorization' })

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)

  // ── Durable-account gate (server-authoritative) ────────────
  // Anonymous Supabase users carry the 'authenticated' role, so
  // the gate checks the server-trusted is_anonymous flag on the
  // VERIFIED user record. Runs BEFORE body parsing, quota
  // reservation, scan-record insertion, and the Anthropic call:
  // an anonymous rejection consumes zero quota and creates no
  // billable activity.
  const gate = evaluateScanUser(userData?.user ?? null, userError)
  if (!gate.ok) return json(gate.status, { code: gate.code, message: gate.message })

  // Canonical user id comes exclusively from the verified token.
  const userId = gate.userId

  // ── Validate request ───────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid JSON body' })
  }

  const requestId = String(body.requestId ?? '')
  const imageBase64 = String(body.imageBase64 ?? '')
  const mediaType = String(body.mediaType ?? 'image/jpeg')
  const depthDataMm = Array.isArray(body.depthDataMm) ? (body.depthDataMm as number[]) : null

  if (!requestId || requestId.length > 100) return json(400, { message: 'Invalid requestId' })
  if (!imageBase64) return json(400, { message: 'Missing image' })
  if (imageBase64.length > MAX_IMAGE_BASE64_CHARS) {
    return json(413, { message: 'Image too large' })
  }
  if (!/^image\/(jpeg|png|webp)$/.test(mediaType)) {
    return json(400, { message: 'Unsupported media type' })
  }

  // ── Reserve quota (atomic + idempotent) ────────────────────
  const imageHash = await sha256Hex(imageBase64)
  const { data: reserveData, error: reserveError } = await admin.rpc('reserve_scan', {
    p_user_id: userId,
    p_request_id: requestId,
    p_image_hash: imageHash,
  })
  if (reserveError) {
    console.error('[analyze-scan] reserve failed:', reserveError.message)
    return json(500, { message: 'Quota check failed' })
  }
  const reserve = reserveData as Record<string, unknown>
  const quota = quotaFromRpc(reserve.quota)
  if (!reserve.ok) {
    const code = String(reserve.code ?? 'monthly_limit_reached')
    return json(429, { code, message: 'Scan limit reached', quota })
  }

  // ── Call Anthropic ─────────────────────────────────────────
  const systemPrompt = depthDataMm && depthDataMm.length > 0
    ? 'You are a produce identification expert for a cold-pressed juicing app. Use the LiDAR depth data (mm) for volumetric weight estimation. Return ONLY a valid JSON array of {"produceId","name","count","estimatedWeightG","confidence"}.'
    : 'You are a produce identification expert. Return ONLY a valid JSON array, no markdown. For each produce item: {"produceId":"<id>","name":"<name>","count":<n>,"estimatedWeightG":<g>,"confidence":<0-1>}'

  const userText = depthDataMm && depthDataMm.length > 0
    ? `Identify all produce in this image. LiDAR depth data (mm): [${depthDataMm.join(',')}]`
    : 'Identify all produce items in this image. Estimate count and weight for each.'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        }],
      }),
    })
    clearTimeout(timer)

    if (!anthropicRes.ok) {
      // Technical/provider failure → release, no credit spent.
      const { data: releaseData } = await admin.rpc('release_scan', {
        p_user_id: userId,
        p_request_id: requestId,
        p_failure_category: `provider_${anthropicRes.status}`,
      })
      const releasedQuota = quotaFromRpc((releaseData as Record<string, unknown>)?.quota)
      return json(502, { message: 'Vision provider error', quota: releasedQuota })
    }

    const data = await anthropicRes.json()
    const rawText: string = data.content?.[0]?.text ?? '[]'

    // Usable result → commit the reservation.
    const { data: commitData, error: commitError } = await admin.rpc('commit_scan', {
      p_user_id: userId,
      p_request_id: requestId,
      p_estimated_cost: null,
    })
    if (commitError) console.error('[analyze-scan] commit failed:', commitError.message)
    const committedQuota = quotaFromRpc((commitData as Record<string, unknown>)?.quota) ?? quota

    return json(200, { rawText, quota: committedQuota })
  } catch (e) {
    // Timeout / network failure → release, no credit spent.
    const { data: releaseData } = await admin.rpc('release_scan', {
      p_user_id: userId,
      p_request_id: requestId,
      p_failure_category: 'provider_timeout',
    })
    const releasedQuota = quotaFromRpc((releaseData as Record<string, unknown>)?.quota)
    console.error('[analyze-scan] provider call failed:', (e as Error)?.message)
    return json(504, { message: 'Vision provider timeout', quota: releasedQuota })
  }
})
