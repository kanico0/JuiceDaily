// ─────────────────────────────────────────────────────────────
// smoke-scan-gate.mjs — Live smoke test for the deployed
// analyze-scan / scan-quota account gate (Test A + token attacks).
//
// Uses ONLY public values (Supabase URL + anon key). Never prints
// tokens or secrets. Safe test account: a throwaway anonymous user.
//
// Run: node scripts/smoke-scan-gate.mjs
// ─────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'

function loadEnv () {
  const env = {}
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  for (const line of raw.split('\n')) {
    if (line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL
const ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('FAIL: missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY in .env')
  process.exit(1)
}

const results = []
function record (name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function scanRequest (token) {
  return fetch(`${SUPABASE_URL}/functions/v1/analyze-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      requestId: `smoke-${Date.now()}`,
      mediaType: 'image/png',
      imageBase64: TINY_PNG_BASE64,
      // Note: no user_id field exists in the API at all — identity
      // comes only from the verified token.
    }),
  })
}

async function main () {
  // ── Create a throwaway anonymous user ──────────────────────
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!signupRes.ok) {
    console.error('FAIL: could not create anonymous test user:', signupRes.status)
    process.exit(1)
  }
  const session = await signupRes.json()
  const anonToken = session.access_token
  console.log('setup: anonymous test user created (token withheld from output)')

  // ── Test A: anonymous direct analyze-scan → 403 account_required
  const res = await scanRequest(anonToken)
  const body = await res.json().catch(() => ({}))
  record(
    'anonymous direct analyze-scan rejected',
    res.status === 403 && body.code === 'account_required',
    `status=${res.status} code=${body.code}`,
  )

  // ── No reservation was created (RLS: user can read own events)
  const eventsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scan_usage_events?select=request_id,status`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${anonToken}` } },
  )
  const events = await eventsRes.json().catch(() => null)
  record(
    'anonymous rejection created no reservation',
    eventsRes.ok && Array.isArray(events) && events.length === 0,
    `events=${Array.isArray(events) ? events.length : 'error'}`,
  )

  // ── scan-quota stays read-only for anonymous users ──────────
  const quotaRes = await fetch(`${SUPABASE_URL}/functions/v1/scan-quota`, {
    headers: { Authorization: `Bearer ${anonToken}` },
  })
  const quotaBody = await quotaRes.json().catch(() => ({}))
  const quotaRowRes = await fetch(
    `${SUPABASE_URL}/rest/v1/scan_quotas?select=user_id`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${anonToken}` } },
  )
  const quotaRows = await quotaRowRes.json().catch(() => null)
  record(
    'anonymous quota display works without allocating a row',
    quotaRes.status === 200 &&
      quotaBody.quota?.plan === 'free' &&
      Array.isArray(quotaRows) &&
      quotaRows.length === 0,
    `status=${quotaRes.status} rows=${Array.isArray(quotaRows) ? quotaRows.length : 'error'}`,
  )

  // ── Missing token → 401 ─────────────────────────────────────
  const noAuthRes = await scanRequest(null)
  record('missing Authorization → 401', noAuthRes.status === 401, `status=${noAuthRes.status}`)

  // ── Malformed token → 401 ───────────────────────────────────
  const badRes = await scanRequest('not-a-jwt')
  record('malformed token → 401', badRes.status === 401, `status=${badRes.status}`)

  // ── Forged payload claiming is_anonymous:false → 401 ────────
  const [h, p, s] = anonToken.split('.')
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
  payload.is_anonymous = false
  const forged = [h, Buffer.from(JSON.stringify(payload)).toString('base64url'), s].join('.')
  const forgedRes = await scanRequest(forged)
  record(
    'forged is_anonymous:false payload rejected → 401',
    forgedRes.status === 401,
    `status=${forgedRes.status}`,
  )

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} live checks passed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FAIL:', e?.message)
  process.exit(1)
})
