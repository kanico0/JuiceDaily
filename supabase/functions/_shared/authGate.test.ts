// ─────────────────────────────────────────────────────────────
// authGate.test.ts — Deno tests for the server-side account gate.
// Replaces the former Jest test suite that was excluded by the
// testPathIgnorePatterns for /supabase/functions/.
// ─────────────────────────────────────────────────────────────

import { evaluateScanUser, extractBearerToken } from './authGate.ts'
import { assertEquals } from 'jsr:@std/assert'

const PERMANENT_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// ── extractBearerToken tests ─────────────────────────────────

Deno.test('extractBearerToken: missing header returns null', () => {
  assertEquals(extractBearerToken(null), null)
})

Deno.test('extractBearerToken: empty bearer value returns null', () => {
  assertEquals(extractBearerToken('Bearer '), null)
  assertEquals(extractBearerToken(''), null)
})

Deno.test('extractBearerToken: extracts token case-insensitively', () => {
  assertEquals(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
  assertEquals(extractBearerToken('bearer abc.def.ghi'), 'abc.def.ghi')
})

// ── evaluateScanUser: token verification outcomes ────────────

Deno.test('evaluateScanUser: malformed token returns 401', () => {
  const result = evaluateScanUser(null, { message: 'invalid JWT: unable to parse' })
  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.status, 401)
    assertEquals(result.code, 'invalid_token')
  }
})

Deno.test('evaluateScanUser: expired token returns 401', () => {
  const result = evaluateScanUser(null, { message: 'token is expired' })
  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.status, 401)
    assertEquals(result.code, 'invalid_token')
  }
})

Deno.test('evaluateScanUser: forged JWT payload is still rejected', () => {
  const forgedPayloadUser = { id: PERMANENT_UUID, is_anonymous: false }
  const result = evaluateScanUser(forgedPayloadUser, { message: 'invalid signature' })
  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.status, 401)
    assertEquals(result.code, 'invalid_token')
  }
})

Deno.test('evaluateScanUser: no user returns 401', () => {
  const result = evaluateScanUser(null, null)
  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.status, 401)
    assertEquals(result.code, 'invalid_token')
  }
})

// ── evaluateScanUser: anonymous-account gate ─────────────────

Deno.test('evaluateScanUser: anonymous user returns 403 account_required', () => {
  const result = evaluateScanUser({ id: PERMANENT_UUID, is_anonymous: true }, null)
  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.status, 403)
    assertEquals(result.code, 'account_required')
  }
})

Deno.test('evaluateScanUser: permanent user is allowed', () => {
  const result = evaluateScanUser({ id: PERMANENT_UUID, is_anonymous: false }, null)
  assertEquals(result, { ok: true, userId: PERMANENT_UUID })
})

Deno.test('evaluateScanUser: users without is_anonymous flag are permanent', () => {
  const result = evaluateScanUser({ id: PERMANENT_UUID }, null)
  assertEquals(result, { ok: true, userId: PERMANENT_UUID })
})

// ── evaluateScanUser: identity authority ──────────────────────

Deno.test('evaluateScanUser: userId comes exclusively from verified record', () => {
  const result = evaluateScanUser({ id: PERMANENT_UUID, is_anonymous: false }, null)
  assertEquals(result.ok, true)
  if (result.ok) {
    assertEquals(result.userId, PERMANENT_UUID)
  }
})
