// ─────────────────────────────────────────────────────────────
// smoke-email-otp.mjs — Diagnoses the email-OTP account upgrade
// flow against production auth endpoints, mirroring the app:
//   1. anonymous sign-in
//   2. PUT /auth/v1/user { email }        (protect-account path)
//   3. POST /auth/v1/otp (shouldCreateUser:false)  (sign-in path)
//
// Prints statuses + error bodies only. Never prints tokens.
// Run: node scripts/smoke-email-otp.mjs [test-email]
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
const TEST_EMAIL = process.argv[2] ?? `otp-smoke-${Date.now()}@example.com`

async function show (label, res) {
  const body = await res.json().catch(() => ({}))
  console.log(`\n${label}`)
  console.log(`  status: ${res.status}`)
  console.log(`  body:   ${JSON.stringify(body).slice(0, 400)}`)
  return body
}

async function main () {
  console.log(`test email: ${TEST_EMAIL}`)

  // 1. anonymous sign-in (same as app startup)
  const anonRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const anon = await anonRes.json().catch(() => ({}))
  if (!anonRes.ok || !anon.access_token) {
    console.log(`anonymous sign-in FAILED: ${anonRes.status} ${JSON.stringify(anon).slice(0, 300)}`)
    process.exit(1)
  }
  console.log('anonymous sign-in: OK')

  // 2. protect-account path: updateUser({ email }) → sends OTP
  const updRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${anon.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: TEST_EMAIL }),
  })
  await show('PUT /auth/v1/user (protect account / email_change OTP)', updRes)

  // 3. sign-in path: signInWithOtp, shouldCreateUser:false
  const otpRes = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, create_user: false }),
  })
  await show('POST /auth/v1/otp (returning-user sign-in, create_user:false)', otpRes)
}

main().catch((e) => {
  console.error('FAIL:', e?.message)
  process.exit(1)
})
