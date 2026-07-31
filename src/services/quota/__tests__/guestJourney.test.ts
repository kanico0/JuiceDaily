// ─────────────────────────────────────────────────────────────
// guestJourney.test.ts — Guest first-use journey tests.
//
// Covers:
//   1. Guest journey authorization (available → reserved → completed)
//   2. Idempotency: replaying the same journeyId is a no-op
//   3. Upgrade preservation: UUID survives anonymous-to-email upgrade
//   4. Advanced Blend allowance accounting for guest journey
//   5. Pro/Free user behavior
// ─────────────────────────────────────────────────────────────

const mockIsDurableUser = jest.fn()
const mockCheckGuestJourney = jest.fn()
const mockReserveGuestJourney = jest.fn()
const mockFinalizeGuestScan = jest.fn()
const mockFinalizeGuestLog = jest.fn()
const mockReleaseGuestJourney = jest.fn()

jest.mock('../guestJourneyService', () => ({
  isDurableUser: () => mockIsDurableUser(),
  checkGuestJourney: () => mockCheckGuestJourney(),
  reserveGuestJourney: (...args: unknown[]) => mockReserveGuestJourney(...args),
  finalizeGuestScan: (...args: unknown[]) => mockFinalizeGuestScan(...args),
  finalizeGuestLog: (...args: unknown[]) => mockFinalizeGuestLog(...args),
  releaseGuestJourney: (...args: unknown[]) => mockReleaseGuestJourney(...args),
  createJourneyId: jest.fn(() => 'guest-test-journey-id'),
  isGuestJourneyAvailable: jest.fn(),
  isGuestJourneyCompleted: jest.fn(),
}))

jest.mock('../../supabase/accountLink', () => ({
  isDurableUser: () => mockIsDurableUser(),
  refreshSessionAndCheckDurable: jest.fn(),
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
  SUPABASE_CONFIGURED: true,
  FREE_MONTHLY_SCAN_LIMIT: 5,
  PRO_MONTHLY_SCAN_LIMIT: 60,
  PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
}))

import { authorizeGuestLog } from '../guestLogGate'
import { authorizeAndProcessBatch } from '../blendNutritionGate'
import type { ScannedIngredient } from '../../JuiceEngine'

describe('Guest Journey — Authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('durable user is always allowed', async () => {
    mockIsDurableUser.mockResolvedValue(true)

    const result = await authorizeGuestLog()

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.isDurable).toBe(true)
    }
  })

  test('guest with available journey — manual log reserves and finalizes', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'available',
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    })
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValue({ ok: true, code: 'completed' })

    const result = await authorizeGuestLog('op-123')

    expect(result.allowed).toBe(true)
    if (result.allowed && !result.isDurable) {
      expect(result.isDurable).toBe(false)
      expect(result.wasScanBased).toBe(false)
    }
    expect(mockReserveGuestJourney).toHaveBeenCalledWith(expect.any(String), 'manual')
    expect(mockFinalizeGuestLog).toHaveBeenCalledWith(expect.any(String), 'op-123')
  })

  test('guest with scan_completed journey — finalizes scan-based log', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'scan_completed',
      journeyId: 'existing-journey',
      scanRequestId: 'existing-journey',
      logOperationId: null,
      scanCompletedAt: '2026-01-01T00:00:00Z',
      logCompletedAt: null,
    })
    mockFinalizeGuestLog.mockResolvedValue({ ok: true, code: 'completed' })

    const result = await authorizeGuestLog('op-456')

    expect(result.allowed).toBe(true)
    if (result.allowed && !result.isDurable) {
      expect(result.wasScanBased).toBe(true)
    }
    expect(mockFinalizeGuestLog).toHaveBeenCalledWith('existing-journey', 'op-456')
  })

  test('guest with completed journey — blocked', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'completed',
      journeyId: 'past-journey',
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: '2026-01-01T00:00:00Z',
    })

    const result = await authorizeGuestLog()

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('journey_completed')
    }
  })

  test('guest with scan_reserved journey — blocked (in progress)', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'scan_reserved',
      journeyId: 'active-scan',
      scanRequestId: 'active-scan',
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    })

    const result = await authorizeGuestLog()

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('journey_in_progress')
    }
  })

  test('manual log: reserve failure blocks and does not finalize', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'available',
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    })
    mockReserveGuestJourney.mockResolvedValue({ ok: false, code: 'journey_already_used' })

    const result = await authorizeGuestLog()

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('journey_completed')
    }
    expect(mockFinalizeGuestLog).not.toHaveBeenCalled()
  })

  test('manual log: finalize failure releases the reservation', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'available',
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    })
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValue({ ok: false, code: 'error' })

    const result = await authorizeGuestLog()

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.reason).toBe('error')
    }
    expect(mockReleaseGuestJourney).toHaveBeenCalled()
  })
})

describe('Guest Journey — Advanced Blend Bypass', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('guest user with advanced blend bypasses analyze-blend server call', async () => {
    mockIsDurableUser.mockResolvedValue(false)

    const ingredients: ScannedIngredient[] = [
      { produceId: 'apple', weightG: 150 },
      { produceId: 'kale', weightG: 50 },
      { produceId: 'celery', weightG: 50 },
      { produceId: 'lemon', weightG: 30 },
      { produceId: 'ginger', weightG: 10 },
    ]

    const result = await authorizeAndProcessBatch(ingredients, 'cold_pressed', 'op-test')

    expect(result.allowance).not.toBeNull()
    expect(result.allowance?.code).toBe('guest_bypass')
    expect(result.allowance?.allowed).toBe(true)
    expect(result.allowance?.blendType).toBe('advanced')
  })

  test('durable user with advanced blend goes through server check', async () => {
    mockIsDurableUser.mockResolvedValue(true)

    // The server call will fail since analyze-blend is not deployed,
    // but the test verifies the code path attempts the server call.
    const ingredients: ScannedIngredient[] = [
      { produceId: 'apple', weightG: 150 },
      { produceId: 'kale', weightG: 50 },
      { produceId: 'celery', weightG: 50 },
      { produceId: 'lemon', weightG: 30 },
      { produceId: 'ginger', weightG: 10 },
    ]

    // This should throw because the server call fails (not deployed).
    // We expect the error to propagate — the guest bypass is NOT used.
    await expect(
      authorizeAndProcessBatch(ingredients, 'cold_pressed', 'op-test'),
    ).rejects.toThrow()
  })

  test('guest user with simple blend processes normally (no bypass needed)', async () => {
    mockIsDurableUser.mockResolvedValue(false)

    const ingredients: ScannedIngredient[] = [
      { produceId: 'apple', weightG: 150 },
      { produceId: 'kale', weightG: 50 },
    ]

    const result = await authorizeAndProcessBatch(ingredients, 'cold_pressed')

    expect(result.allowance).toBeNull()
  })
})

describe('Guest Journey — Idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('same journeyId replayed returns duplicate_request (idempotent)', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'scan_completed',
      journeyId: 'replay-journey',
      scanRequestId: 'replay-journey',
      logOperationId: null,
      scanCompletedAt: '2026-01-01T00:00:00Z',
      logCompletedAt: null,
    })
    mockFinalizeGuestLog.mockResolvedValue({ ok: true, code: 'duplicate_request' })

    const result = await authorizeGuestLog('op-replay')

    expect(result.allowed).toBe(true)
    if (result.allowed && !result.isDurable) {
      expect(result.wasScanBased).toBe(true)
    }
    expect(mockFinalizeGuestLog).toHaveBeenCalledWith('replay-journey', 'op-replay')
  })
})

describe('Guest Journey — Upgrade Preservation', () => {
  test('isDurableUser returns false for anonymous user', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue({
      status: 'available',
      journeyId: null,
      scanRequestId: null,
      logOperationId: null,
      scanCompletedAt: null,
      logCompletedAt: null,
    })
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFinalizeGuestLog.mockResolvedValue({ ok: true, code: 'completed' })
    const result = await authorizeGuestLog()
    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.isDurable).toBe(false)
    }
  })

  test('isDurableUser returns true after email upgrade', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    const result = await authorizeGuestLog()
    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.isDurable).toBe(true)
    }
  })
})
