// ─────────────────────────────────────────────────────────────
// authGate.test.ts — Server-side account-gate unit tests.
//
// Tests the exact module deployed inside analyze-scan
// (supabase/functions/_shared/authGate.ts). Proves the gate
// rejects missing/invalid/forged tokens (401), rejects verified
// anonymous users (403 account_required), and derives identity
// exclusively from the verified user record.
// ─────────────────────────────────────────────────────────────

import { evaluateScanUser, extractBearerToken } from '../_shared/authGate'

const PERMANENT_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('extractBearerToken', () => {
  it('missing Authorization header → no token (function returns 401)', () => {
    expect(extractBearerToken(null)).toBeNull()
  })

  it('empty bearer value → no token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
    expect(extractBearerToken('')).toBeNull()
  })

  it('extracts the token case-insensitively', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi')
  })
})

describe('evaluateScanUser — token verification outcomes', () => {
  it('malformed token (verification error) → 401', () => {
    const result = evaluateScanUser(null, { message: 'invalid JWT: unable to parse' })
    expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_token' })
  })

  it('expired token (verification error) → 401', () => {
    const result = evaluateScanUser(null, { message: 'token is expired' })
    expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_token' })
  })

  it('forged JWT payload claiming is_anonymous:false is still rejected', () => {
    // A forged token fails Auth-server signature verification, so
    // getUser returns an error — whatever the payload claims is
    // irrelevant because only the VERIFIED record is consulted.
    const forgedPayloadUser = { id: PERMANENT_UUID, is_anonymous: false }
    const result = evaluateScanUser(forgedPayloadUser, { message: 'invalid signature' })
    expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_token' })
  })

  it('verification returning no user → 401', () => {
    const result = evaluateScanUser(null, null)
    expect(result).toMatchObject({ ok: false, status: 401, code: 'invalid_token' })
  })
})

describe('evaluateScanUser — anonymous-account gate', () => {
  it('valid ANONYMOUS Supabase user → 403 with account_required', () => {
    const result = evaluateScanUser({ id: PERMANENT_UUID, is_anonymous: true }, null)
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: 'account_required',
    })
  })

  it('valid PERMANENT user → allowed', () => {
    const result = evaluateScanUser({ id: PERMANENT_UUID, is_anonymous: false }, null)
    expect(result).toEqual({ ok: true, userId: PERMANENT_UUID })
  })

  it('users without the is_anonymous flag (pre-anon-auth accounts) are permanent', () => {
    const result = evaluateScanUser({ id: PERMANENT_UUID }, null)
    expect(result).toEqual({ ok: true, userId: PERMANENT_UUID })
  })
})

describe('evaluateScanUser — identity authority', () => {
  it('the userId comes exclusively from the verified record', () => {
    // The gate API has no parameter for request-body identity at
    // all — user-ID substitution is impossible by construction.
    // analyze-scan then uses gate.userId for reserve/commit/release,
    // so quota, scan record, and analysis all share the verified
    // UUID and one user can never charge another user's quota.
    const result = evaluateScanUser({ id: PERMANENT_UUID, is_anonymous: false }, null)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.userId).toBe(PERMANENT_UUID)
  })
})
