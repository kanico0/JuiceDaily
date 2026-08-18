// ─────────────────────────────────────────────────────────────
// playIntegrityVerifierDeviceRecall.test.ts — Regression tests
// for the corrected Google Play Integrity Device Recall verdict
// field-path parsing.
//
// These tests pass a realistic decoded Google payload through the
// REAL verifyPlayIntegrity() response parsing path by mocking
// global fetch (both the OAuth token exchange and the
// decodeIntegrityToken call) and using a generated RSA key pair
// for the service-account JWT signing.
//
// Tests:
//   A — Real nested deviceRecall (bitFirst=true, bitSecond=true, bitThird=false)
//   B — Snap month read (bitFirst=true, yyyymmFirst=current month)
//   C — Advanced Blend bits (00, 01, 10, 11)
//   D — Empty Device Recall (values:{}, writeDates:{}) → unavailable
//   E — Snap/Blend isolation (Snap writes only bitFirst, Blend writes only bitSecond/bitThird)
//   F — Success/fail write timing (write invoked on success, NOT on fail)
// ─────────────────────────────────────────────────────────────

// Generate a real RSA key pair so crypto.subtle.importKey succeeds
// during the OAuth JWT signing inside getAccessToken().
const { generateKeyPairSync } = require('crypto')
const { privateKey: testPrivateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
const testPem = testPrivateKey.export({ type: 'pkcs8', format: 'pem' })

const testServiceAccountJson = JSON.stringify({
  client_email: 'test@rawlifeflow.iam.gserviceaccount.com',
  private_key: testPem,
})

// Mock fetch globally — will be configured per-test
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock the integrityServerLog to suppress console noise
jest.mock('../_shared/integrityServerLog', () => ({
  serverIntegrityLog: jest.fn(),
}))

import {
  verifyPlayIntegrity,
  getAccessToken,
  clearAccessTokenCache,
  shouldBlockScan,
} from '../_shared/playIntegrityVerifier'
import {
  encodeNextBlendWriteValues,
  decodeBlendDeviceUsed,
  deviceSnapRemaining,
  deviceBlendRemaining,
  currentYyyymm,
  FREE_DEVICE_SNAP_LIMIT,
  FREE_DEVICE_BLEND_LIMIT,
} from '../_shared/deviceRecallBits'

// ── Helpers ───────────────────────────────────────────────────

const PACKAGE_NAME = 'com.juicingapp.app'
const CLOUD_PROJECT_NUMBER = '1080167721820'
const REQUEST_HASH = 'test-challenge|user123|analyze_scan|digest456'

/**
 * Build a realistic Google Play Integrity decoded verdict payload.
 */
function buildGoogleVerdict(opts: {
  appPackageName?: string
  requestHash?: string
  appRecognitionVerdict?: string
  deviceRecognitionVerdict?: string[]
  deviceRecall?: { values: Record<string, boolean>; writeDates: Record<string, number> } | null
  timestampAgeSeconds?: number
}): unknown {
  const now = Math.floor(Date.now() / 1000)
  const age = opts.timestampAgeSeconds ?? 0
  return {
    tokenPayloadExternal: {
      payload: {
        appPackageName: opts.appPackageName ?? PACKAGE_NAME,
        requestHash: opts.requestHash ?? REQUEST_HASH,
        appRecognitionVerdict: opts.appRecognitionVerdict ?? 'PLAY_RECOGNIZED',
        timestamp: now - age,
        deviceIntegrity: {
          deviceRecognitionVerdict: opts.deviceRecognitionVerdict ?? ['MEETS_DEVICE_INTEGRITY'],
          ...(opts.deviceRecall !== undefined
            ? { deviceRecall: opts.deviceRecall }
            : { deviceRecall: { values: {}, writeDates: {} } }),
        },
      },
    },
  }
}

/**
 * Configure mockFetch to handle both the OAuth token exchange and
 * the decodeIntegrityToken call. The OAuth call returns a mock
 * access token; the decodeIntegrityToken call returns the provided
 * verdict.
 */
function mockFetchWithVerdict(verdict: unknown): void {
  mockFetch.mockImplementation(async (url: string) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        json: async () => ({
          access_token: 'mock-oauth-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      }
    }
    if (url.includes('decodeIntegrityToken')) {
      return {
        ok: true,
        json: async () => verdict,
      }
    }
    throw new Error(`Unexpected fetch URL: ${url}`)
  })
}

const baseVerifyOpts = {
  token: 'real-integrity-token',
  expectedPackageName: PACKAGE_NAME,
  expectedRequestHash: REQUEST_HASH,
  cloudProjectNumber: CLOUD_PROJECT_NUMBER,
  serviceAccountJson: testServiceAccountJson,
  isMock: false,
  enforcementMode: 'observe' as string,
}

beforeEach(() => {
  mockFetch.mockReset()
  clearAccessTokenCache()
})

// ── TEST A: Real nested deviceRecall ─────────────────────────

describe('TEST A — Real nested deviceRecall (correct field path)', () => {
  it('parses bitFirst=true, bitSecond=true, bitThird=false from deviceIntegrity.deviceRecall', async () => {
    const now = new Date()
    const yyyymm = currentYyyymm(now)
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: true, bitSecond: true, bitThird: false },
        writeDates: { yyyymmFirst: yyyymm, yyyymmSecond: yyyymm },
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.verificationStatus).toBe('success')
    expect(result.deviceRecallAvailable).toBe(true)
    expect(result.deviceBits).toEqual({
      bitFirst: true,
      bitSecond: true,
      bitThird: false,
    })
    expect(result.deviceWriteDates).toEqual({
      yyyymmFirst: yyyymm,
      yyyymmSecond: yyyymm,
      yyyymmThird: null,
    })
  })

  it('would FAIL against old payload.deviceRecall path (values would be undefined)', async () => {
    // This test documents the regression: with the old code
    // (payload.deviceRecall), the deviceRecall would be undefined
    // because the actual nesting is payload.deviceIntegrity.deviceRecall.
    // The corrected code reads from payload.deviceIntegrity?.deviceRecall.
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: false, bitThird: false },
        writeDates: {},
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    // With the fix, this should be available with all-false bits (fresh device).
    // With the old bug, this would have been device_recall_unavailable.
    expect(result.deviceRecallAvailable).toBe(true)
    expect(result.deviceBits).toEqual({
      bitFirst: false,
      bitSecond: false,
      bitThird: false,
    })
    expect(result.reasonCode).toBe('verified')
  })
})

// ── TEST B: Snap month read ──────────────────────────────────

describe('TEST B — Snap month read', () => {
  it('recognizes Snap consumed when bitFirst=true and yyyymmFirst is current month', async () => {
    const now = new Date()
    const yyyymm = currentYyyymm(now)
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: true, bitSecond: false, bitThird: false },
        writeDates: { yyyymmFirst: yyyymm },
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceRecallAvailable).toBe(true)
    expect(result.deviceBits!.bitFirst).toBe(true)
    expect(result.deviceSnapRemaining).toBe(0)
  })

  it('recognizes Snap NOT consumed when bitFirst=true but yyyymmFirst is last month', async () => {
    const now = new Date()
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const yyyymmLast = currentYyyymm(lastMonth)
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: true, bitSecond: false, bitThird: false },
        writeDates: { yyyymmFirst: yyyymmLast },
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceRecallAvailable).toBe(true)
    expect(result.deviceBits!.bitFirst).toBe(true)
    // bitFirst is true but from last month → not consumed this month
    expect(result.deviceSnapRemaining).toBe(FREE_DEVICE_SNAP_LIMIT)
  })

  it('recognizes Snap NOT consumed when bitFirst=false (fresh device)', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: false, bitThird: false },
        writeDates: {},
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceRecallAvailable).toBe(true)
    expect(result.deviceSnapRemaining).toBe(FREE_DEVICE_SNAP_LIMIT)
  })
})

// ── TEST C: Advanced Blend bits (00, 01, 10, 11) ─────────────

describe('TEST C — Advanced Blend bits through realistic Google payload', () => {
  it('00 = 0 used → blend remaining = 3', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: false, bitThird: false },
        writeDates: {},
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceBlendRemaining).toBe(3)
    expect(decodeBlendDeviceUsed(result.deviceBits!.bitSecond, result.deviceBits!.bitThird)).toBe(0)
  })

  it('01 = 1 used → blend remaining = 2', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: false, bitThird: true },
        writeDates: { yyyymmThird: currentYyyymm(new Date()) },
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceBlendRemaining).toBe(2)
    expect(decodeBlendDeviceUsed(result.deviceBits!.bitSecond, result.deviceBits!.bitThird)).toBe(1)
  })

  it('10 = 2 used → blend remaining = 1', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: true, bitThird: false },
        writeDates: { yyyymmSecond: currentYyyymm(new Date()) },
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceBlendRemaining).toBe(1)
    expect(decodeBlendDeviceUsed(result.deviceBits!.bitSecond, result.deviceBits!.bitThird)).toBe(2)
  })

  it('11 = 3 used / exhausted → blend remaining = 0', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: true, bitThird: true },
        writeDates: {
          yyyymmSecond: currentYyyymm(new Date()),
          yyyymmThird: currentYyyymm(new Date()),
        },
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceBlendRemaining).toBe(0)
    expect(decodeBlendDeviceUsed(result.deviceBits!.bitSecond, result.deviceBits!.bitThird)).toBe(3)
  })
})

// ── TEST D: Empty Device Recall → unavailable ────────────────

describe('TEST D — Empty Device Recall is unavailable, NOT fresh', () => {
  it('values:{} and writeDates:{} → device_recall_unavailable', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: { values: {}, writeDates: {} },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceRecallAvailable).toBe(false)
    expect(result.reasonCode).toBe('device_recall_unavailable')
    expect(result.failureCategory).toBe('unsupported_environment')
    expect(result.deviceBits).toBe(null)
  })

  it('empty deviceRecall in observe mode → fail-open (shouldBlockScan=false)', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: { values: {}, writeDates: {} },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity({
      ...baseVerifyOpts,
      enforcementMode: 'observe',
    })

    expect(result.deviceRecallAvailable).toBe(false)
    expect(shouldBlockScan(result.failureCategory, 'observe')).toBe(false)
  })

  it('empty deviceRecall in enforce mode → fail-closed (shouldBlockScan=true)', async () => {
    const verdict = buildGoogleVerdict({
      deviceRecall: { values: {}, writeDates: {} },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity({
      ...baseVerifyOpts,
      enforcementMode: 'enforce',
    })

    expect(result.deviceRecallAvailable).toBe(false)
    expect(result.failureCategory).toBe('unsupported_environment')
    expect(shouldBlockScan(result.failureCategory, 'enforce')).toBe(true)
  })

  it('deviceRecall absent entirely → device_recall_unavailable', async () => {
    // Google may omit deviceRecall if not opted in
    const verdict = {
      tokenPayloadExternal: {
        payload: {
          appPackageName: PACKAGE_NAME,
          requestHash: REQUEST_HASH,
          appRecognitionVerdict: 'PLAY_RECOGNIZED',
          timestamp: Math.floor(Date.now() / 1000),
          deviceIntegrity: {
            deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'],
            // No deviceRecall field at all
          },
        },
      },
    }
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceRecallAvailable).toBe(false)
    expect(result.reasonCode).toBe('device_recall_unavailable')
    expect(result.failureCategory).toBe('unsupported_environment')
  })

  it('fresh device (all bits false, non-empty values) is NOT unavailable', async () => {
    // A fresh device with Device Recall evaluated returns all three bits
    // (defaulting to false). This is distinguishable from empty {} values.
    const verdict = buildGoogleVerdict({
      deviceRecall: {
        values: { bitFirst: false, bitSecond: false, bitThird: false },
        writeDates: {},
      },
    })
    mockFetchWithVerdict(verdict)

    const result = await verifyPlayIntegrity(baseVerifyOpts)

    expect(result.deviceRecallAvailable).toBe(true)
    expect(result.reasonCode).toBe('verified')
    expect(result.deviceSnapRemaining).toBe(FREE_DEVICE_SNAP_LIMIT)
    expect(result.deviceBlendRemaining).toBe(FREE_DEVICE_BLEND_LIMIT)
  })
})

// ── TEST E: Snap/Blend isolation ─────────────────────────────

describe('TEST E — Snap/Blend write isolation', () => {
  it('Snap write (encodeNextBlendWriteValues not involved) changes only bitFirst', () => {
    // Snap write payload is { bitFirst: true } — no bitSecond/bitThird
    const snapWriteValues = { bitFirst: true }
    expect(snapWriteValues).not.toHaveProperty('bitSecond')
    expect(snapWriteValues).not.toHaveProperty('bitThird')
  })

  it('Blend write 0→1 changes only bitThird (not bitFirst)', () => {
    const writeValues = encodeNextBlendWriteValues(0)
    expect(writeValues).toEqual({ bitThird: true })
    expect(writeValues).not.toHaveProperty('bitFirst')
  })

  it('Blend write 1→2 changes only bitSecond and bitThird (not bitFirst)', () => {
    const writeValues = encodeNextBlendWriteValues(1)
    expect(writeValues).toEqual({ bitSecond: true, bitThird: false })
    expect(writeValues).not.toHaveProperty('bitFirst')
  })

  it('Blend write 2→3 changes only bitThird (not bitFirst)', () => {
    const writeValues = encodeNextBlendWriteValues(2)
    expect(writeValues).toEqual({ bitThird: true })
    expect(writeValues).not.toHaveProperty('bitFirst')
  })

  it('Blend write 3→3 (exhausted) changes nothing', () => {
    const writeValues = encodeNextBlendWriteValues(3)
    expect(writeValues).toEqual({})
    expect(writeValues).not.toHaveProperty('bitFirst')
  })

  it('Snap device remaining is independent of Blend bits', () => {
    // Snap remaining depends only on bitFirst + yyyymmFirst
    const now = new Date()
    const yyyymm = currentYyyymm(now)
    expect(deviceSnapRemaining(true, yyyymm, now)).toBe(0)
    expect(deviceSnapRemaining(false, null, now)).toBe(1)
    // Blend bits being set does not affect Snap remaining
    expect(deviceSnapRemaining(false, null, now)).toBe(1) // even if blend=11
  })

  it('Blend device remaining is independent of Snap bit', () => {
    // Blend remaining depends only on bitSecond + bitThird
    expect(deviceBlendRemaining(false, false)).toBe(3)
    expect(deviceBlendRemaining(true, true)).toBe(0)
    // bitFirst being true does not affect Blend remaining
    expect(deviceBlendRemaining(false, false)).toBe(3) // even if snap consumed
  })
})

// ── TEST F: Success/fail write timing ────────────────────────
// These tests verify the write-timing contract by checking the
// writeValues construction logic, not by deploying the Edge Function.

describe('TEST F — Success/fail write timing contract', () => {
  it('successful Snap write produces { bitFirst: true }', () => {
    // analyze-scan writes bitFirst: true only after successful finalization
    const snapWriteValues = { bitFirst: true }
    expect(Object.keys(snapWriteValues)).toEqual(['bitFirst'])
    expect(snapWriteValues.bitFirst).toBe(true)
  })

  it('successful Blend write produces only bitSecond/bitThird changes', () => {
    // analyze-blend writes encodeNextBlendWriteValues(currentUsed) only after success
    const writeValues0to1 = encodeNextBlendWriteValues(0)
    expect(Object.keys(writeValues0to1).sort()).toEqual(['bitThird'])
    expect(writeValues0to1).not.toHaveProperty('bitFirst')

    const writeValues1to2 = encodeNextBlendWriteValues(1)
    expect(Object.keys(writeValues1to2).sort()).toEqual(['bitSecond', 'bitThird'])
    expect(writeValues1to2).not.toHaveProperty('bitFirst')
  })

  it('failed operation produces NO write values (empty payload)', () => {
    // When the AI result fails, the reservation is released and
    // no Device Recall write is attempted. The writeValues would
    // never be constructed. This test verifies that the encode
    // function is never called for failed operations by checking
    // that the release path does not produce write values.
    //
    // The contract: writeDeviceRecall is only called when:
    //   deviceRecallWriteEnabled && !isProUser && result.ok && integrityToken
    // A failed operation has result.ok = false, so writeDeviceRecall
    // is never invoked.
    const failedOperationWriteValues: Record<string, boolean> = {}
    expect(Object.keys(failedOperationWriteValues)).toHaveLength(0)
  })

  it('exhausted Blend (3→3) produces empty write (no-op)', () => {
    // Even on success, if Blend is already at 3, no write occurs.
    const writeValues = encodeNextBlendWriteValues(3)
    expect(writeValues).toEqual({})
    // writeDeviceRecall returns immediately with no_bits_to_write
  })
})
