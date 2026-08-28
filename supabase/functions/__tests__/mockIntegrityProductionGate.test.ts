// ─────────────────────────────────────────────────────────────
// mockIntegrityProductionGate.test.ts — Regression tests proving
// the Play Integrity mock-verification path cannot be triggered
// by client-supplied input alone (P1 security fix).
//
// Prior defect: `if (opts.isMock || opts.token.startsWith('mock_integrity:'))`
// let ANY caller (client-controlled `isMock`/`isMockToken` request body
// field, or a `mock_integrity:`-prefixed token string) bypass real
// Google Play Integrity verification and receive a "fresh device"
// verdict (ok: true, deviceRecallAvailable: true, full remaining
// allowances) with no server-side environment gate.
//
// Fix: `verifyPlayIntegrity` now requires `opts.allowMock === true`
// (a value ONLY ever derived server-side from a Supabase function
// secret, e.g. `Deno.env.get('ALLOW_MOCK_INTEGRITY') === '1'`, never
// from client input) in addition to the client's mock claim before
// the mock path is taken.
//
// Tests:
//   1. isMockToken=true is IGNORED when allowMock=false (falls through
//      to real verification, which fails closed for a non-Google token)
//   2. mock_integrity: token prefix is IGNORED when allowMock=false
//   3. Mock path IS taken when allowMock=true AND isMock=true (QA-only)
//   4. Mock path IS taken when allowMock=true AND token has mock_integrity: prefix
//   5. Default/production caller construction never sets allowMock=true
//      from any client-derived value (source-pattern check on both
//      Edge Functions)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

// Mock fetch globally so any fall-through to real Google verification
// resolves deterministically (as a failure, since the token is bogus).
const mockFetch = jest.fn()
global.fetch = mockFetch as any

jest.mock('../_shared/integrityServerLog', () => ({
  serverIntegrityLog: jest.fn(),
}))

import { verifyPlayIntegrity } from '../_shared/playIntegrityVerifier'

const PACKAGE_NAME = 'com.rawlifeflow.juicingdaily'
const REQUEST_HASH = 'challenge456|extra'

function baseOpts(overrides: Record<string, unknown> = {}) {
  return {
    token: 'mock_integrity:install123:challenge456:analyze_scan',
    expectedPackageName: PACKAGE_NAME,
    expectedRequestHash: REQUEST_HASH,
    cloudProjectNumber: '',
    serviceAccountJson: '',
    isMock: false,
    allowMock: false,
    enforcementMode: 'observe',
    ...overrides,
  }
}

describe('Play Integrity mock verification — production gate', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  test('1. isMockToken=true is IGNORED when allowMock=false (falls through, does not fabricate a fresh device)', async () => {
    const result = await verifyPlayIntegrity(
      baseOpts({ isMock: true, allowMock: false, token: 'mock_integrity:install123:challenge456:analyze_scan' }),
    )
    // Falls through to the "missing credentials" branch (empty
    // cloudProjectNumber/serviceAccountJson in this test) rather than
    // the mock branch. It must NOT report a verified/fresh mock device.
    expect(result.integrityStatus).not.toBe('mock')
    expect(result.reasonCode).not.toBe('mock_verified')
  })

  test('2. mock_integrity: token prefix is IGNORED when allowMock=false, even with isMock unset', async () => {
    const result = await verifyPlayIntegrity(
      baseOpts({ isMock: false, allowMock: false, token: 'mock_integrity:install123:challenge456:analyze_scan' }),
    )
    expect(result.integrityStatus).not.toBe('mock')
    expect(result.reasonCode).not.toBe('mock_verified')
  })

  test('3. Mock path IS taken when allowMock=true AND isMock=true (server-approved QA path)', async () => {
    const result = await verifyPlayIntegrity(
      baseOpts({ isMock: true, allowMock: true, token: 'mock_integrity:install123:challenge456:analyze_scan' }),
    )
    expect(result.integrityStatus).toBe('mock')
    expect(result.reasonCode).toBe('mock_verified')
    expect(result.ok).toBe(true)
  })

  test('4. Mock path IS taken when allowMock=true AND token has mock_integrity: prefix (isMock unset)', async () => {
    const result = await verifyPlayIntegrity(
      baseOpts({ isMock: false, allowMock: true, token: 'mock_integrity:install123:challenge456:analyze_scan' }),
    )
    expect(result.integrityStatus).toBe('mock')
    expect(result.ok).toBe(true)
  })

  test('5. allowMock defaults to false when the request body only claims mock (no server env influence)', async () => {
    // Simulates a fully client-controlled attempt: the client sets
    // every field it can (isMock, token prefix) but the server never
    // derives allowMock from anything the client sent.
    const result = await verifyPlayIntegrity(
      baseOpts({
        isMock: true,
        token: 'mock_integrity:attacker:forged:analyze_blend',
        allowMock: false, // this can only ever come from Deno.env.get('ALLOW_MOCK_INTEGRITY')
      }),
    )
    expect(result.integrityStatus).not.toBe('mock')
    expect(result.deviceRecallAvailable).not.toBe(true)
  })
})

describe('Edge Function source — allowMock is never derived from client input', () => {
  const scanSrc = fs.readFileSync(
    path.join(__dirname, '..', 'analyze-scan', 'index.ts'),
    'utf-8',
  )
  const blendSrc = fs.readFileSync(
    path.join(__dirname, '..', 'analyze-blend', 'index.ts'),
    'utf-8',
  )

  test('6. analyze-scan derives allowMock only from Deno.env.get, never from body', () => {
    expect(scanSrc).toMatch(/allowMockIntegrity\s*=\s*Deno\.env\.get\('ALLOW_MOCK_INTEGRITY'\)\s*===\s*'1'/)
    expect(scanSrc).toMatch(/allowMock:\s*allowMockIntegrity/)
    // Must not read an allowMock-equivalent flag from the request body
    expect(scanSrc).not.toMatch(/body\.allowMock/)
  })

  test('7. analyze-blend derives allowMock only from Deno.env.get, never from body', () => {
    expect(blendSrc).toMatch(/allowMock:\s*Deno\.env\.get\('ALLOW_MOCK_INTEGRITY'\)\s*===\s*'1'/)
    expect(blendSrc).not.toMatch(/body\.allowMock/)
  })

  test('8. Both Edge Functions still read isMock/isMockToken only from client body (expected — it is the CLAIM, not the gate)', () => {
    expect(scanSrc).toMatch(/isMockToken\s*=\s*Boolean\(body\.integrityTokenIsMock/)
    expect(blendSrc).toMatch(/isMockToken\s*=\s*body\.isMockToken/)
  })
})
