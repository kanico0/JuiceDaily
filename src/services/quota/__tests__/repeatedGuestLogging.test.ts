// Behavioral tests for repeated guest juice logging under both
// production-configured and offline-development configurations.

import { authorizeGuestLog, isGuestLogAllowed } from '../guestLogGate'

const mockIsDurableUser = jest.fn()
const mockCheckGuestJourney = jest.fn()
const mockReserveGuestJourney = jest.fn()
const mockFinalizeGuestLog = jest.fn()
const mockReleaseGuestJourney = jest.fn()

let mockSupabaseConfigured = true

jest.mock('../guestJourneyService', () => ({
  isDurableUser: () => mockIsDurableUser(),
  checkGuestJourney: () => mockCheckGuestJourney(),
  reserveGuestJourney: (...args: unknown[]) => mockReserveGuestJourney(...args),
  finalizeGuestScan: jest.fn(),
  finalizeGuestLog: (...args: unknown[]) => mockFinalizeGuestLog(...args),
  releaseGuestJourney: (...args: unknown[]) => mockReleaseGuestJourney(...args),
  createJourneyId: jest.fn(() => `guest-test-${Date.now()}`),
  isGuestJourneyAvailable: jest.fn(),
  isGuestJourneyCompleted: jest.fn(),
}))

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-token'),
  getUserId: jest.fn().mockResolvedValue('test-user-id'),
}))

jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabase: jest.fn(() => null),
}))

jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  get SUPABASE_CONFIGURED() {
    return mockSupabaseConfigured
  },
  FREE_MONTHLY_SCAN_LIMIT: 5,
  PRO_MONTHLY_SCAN_LIMIT: 60,
  PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
}))

const AVAILABLE_STATE = {
  status: 'available' as const,
  journeyId: null,
  scanRequestId: null,
  logOperationId: null,
  scanCompletedAt: null,
  logCompletedAt: null,
}

const COMPLETED_STATE = {
  status: 'completed' as const,
  journeyId: 'journey-1',
  scanRequestId: null,
  logOperationId: 'op-1',
  scanCompletedAt: null,
  logCompletedAt: '2026-01-01T10:00:00Z',
}

describe('Repeated Guest Logging — Production Configured (SUPABASE_CONFIGURED=true)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseConfigured = true
    mockIsDurableUser.mockResolvedValue(false)
  })

  test('1. first guest juice logs successfully', async () => {
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValue({ ok: true, code: 'completed' })

    const result = await authorizeGuestLog('op-1')
    expect(result.allowed).toBe(true)
  })

  test('2. second guest juice logs successfully (journey now completed)', async () => {
    mockCheckGuestJourney.mockResolvedValue(COMPLETED_STATE)

    const result = await authorizeGuestLog('op-2')
    expect(result.allowed).toBe(true)
    if (result.allowed && !result.isDurable) {
      expect(result.hasPriorLog).toBe(true)
    }
  })

  test('3. third guest juice logs successfully', async () => {
    mockCheckGuestJourney.mockResolvedValue(COMPLETED_STATE)

    const result = await authorizeGuestLog('op-3')
    expect(result.allowed).toBe(true)
    if (result.allowed && !result.isDurable) {
      expect(result.hasPriorLog).toBe(true)
    }
  })

  test('4. isGuestLogAllowed returns true even after journey completed', async () => {
    mockCheckGuestJourney.mockResolvedValue(COMPLETED_STATE)
    const allowed = await isGuestLogAllowed()
    expect(allowed).toBe(true)
  })

  test('5. isGuestLogAllowed returns true for available journey', async () => {
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    const allowed = await isGuestLogAllowed()
    expect(allowed).toBe(true)
  })

  test('6. network error on reserve blocks logging (fail-closed)', async () => {
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValue({ ok: false, code: 'network_error' })

    const result = await authorizeGuestLog('op-net')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('error')
      expect(result.message).toContain('Network error')
    }
  })

  test('7. network error on finalize blocks logging (fail-closed)', async () => {
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValue({ ok: false, code: 'network_error' })

    const result = await authorizeGuestLog('op-net-finalize')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('error')
      expect(result.message).toContain('Network error')
    }
    expect(mockReleaseGuestJourney).toHaveBeenCalled()
  })

  test('8. no server_not_configured silently treated as journey completion', async () => {
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValue({ ok: false, code: 'server_not_configured' })

    const result = await authorizeGuestLog('op-snc')
    expect(result.allowed).toBe(true)
    if (result.allowed && !result.isDurable) {
      expect(result.hasPriorLog).toBe(true)
    }
  })

  test('9. durable user always allowed regardless of journey state', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockCheckGuestJourney.mockResolvedValue(COMPLETED_STATE)

    const result = await authorizeGuestLog('op-durable')
    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.isDurable).toBe(true)
    }
  })

  test('10. reserve receives expected calls for first log', async () => {
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValue({ ok: true, code: 'completed' })

    await authorizeGuestLog('op-first')
    expect(mockReserveGuestJourney).toHaveBeenCalledWith(expect.any(String), 'manual')
    expect(mockFinalizeGuestLog).toHaveBeenCalledWith(expect.any(String), 'op-first')
  })

  test('11. completed journey does not call reserve or finalize', async () => {
    mockCheckGuestJourney.mockResolvedValue(COMPLETED_STATE)

    await authorizeGuestLog('op-repeat')
    expect(mockReserveGuestJourney).not.toHaveBeenCalled()
    expect(mockFinalizeGuestLog).not.toHaveBeenCalled()
  })
})

describe('Repeated Guest Logging — Offline Development (SUPABASE_CONFIGURED=false)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseConfigured = false
    mockIsDurableUser.mockResolvedValue(false)
  })

  afterEach(() => {
    mockSupabaseConfigured = true
  })

  test('1. first log succeeds locally', async () => {
    const result = await authorizeGuestLog('op-1')
    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.isDurable).toBe(true)
    }
  })

  test('2. second log succeeds locally', async () => {
    const result = await authorizeGuestLog('op-2')
    expect(result.allowed).toBe(true)
  })

  test('3. third log succeeds locally', async () => {
    const result = await authorizeGuestLog('op-3')
    expect(result.allowed).toBe(true)
  })

  test('4. no server reservation is attempted', async () => {
    await authorizeGuestLog('op-no-server')
    expect(mockReserveGuestJourney).not.toHaveBeenCalled()
    expect(mockFinalizeGuestLog).not.toHaveBeenCalled()
    expect(mockCheckGuestJourney).not.toHaveBeenCalled()
  })

  test('5. isGuestLogAllowed returns true without server check', async () => {
    const allowed = await isGuestLogAllowed()
    expect(allowed).toBe(true)
    expect(mockCheckGuestJourney).not.toHaveBeenCalled()
  })

  test('6. production behavior is not weakened (re-enable and verify fail-closed)', async () => {
    mockSupabaseConfigured = true
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValue({ ok: false, code: 'network_error' })

    const result = await authorizeGuestLog('op-prod-fail')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('error')
    }
  })
})

describe('Repeated Guest Logging — Advance Day +1', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseConfigured = true
    mockIsDurableUser.mockResolvedValue(false)
  })

  test('Day 1: first log succeeds, Day 2: another log succeeds', async () => {
    // Day 1: first log
    mockCheckGuestJourney.mockResolvedValueOnce(AVAILABLE_STATE)
    mockReserveGuestJourney.mockResolvedValueOnce({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValueOnce({ ok: true, code: 'completed' })

    const day1Result = await authorizeGuestLog('day1-op')
    expect(day1Result.allowed).toBe(true)

    // Day 2: journey is completed, but logging is still allowed
    mockCheckGuestJourney.mockResolvedValueOnce(COMPLETED_STATE)
    const day2Result = await authorizeGuestLog('day2-op')
    expect(day2Result.allowed).toBe(true)
    if (day2Result.allowed && !day2Result.isDurable) {
      expect(day2Result.hasPriorLog).toBe(true)
    }
  })

  test('Multiple logs on same day all succeed', async () => {
    mockCheckGuestJourney.mockResolvedValue(COMPLETED_STATE)

    for (let i = 0; i < 3; i++) {
      const result = await authorizeGuestLog(`same-day-${i}`)
      expect(result.allowed).toBe(true)
    }
  })
})
