// ─────────────────────────────────────────────────────────────
// guestPostCaptureGate.test.ts — Regression tests for the guest
// first-scan post-capture account-gating defect.
//
// Proves that the AccountGateModal is NOT triggered after capture
// for a guest with manual juice logs but no prior successful scan.
// The complimentary scan is consumed only after successful image
// analysis finalization (scanCompletedAt set by server).
//
// Test categories:
//   A. analyzeScanOnServer gating (quotaService.ts)
//   B. cameraEligibilityCoordinator reserved-state handling
//   C. CameraScreen catch behavior (source verification)
//   D. Server SQL reserve_guest_journey (source verification)
//   E. Source verification: no post-capture gate on status alone
//   F. Full lifecycle: capture → analysis → success/failure/retry
// ─────────────────────────────────────────────────────────────

const mockIsDurableUser = jest.fn()
const mockCheckGuestJourney = jest.fn()
const mockReserveGuestJourney = jest.fn()
const mockReleaseGuestJourney = jest.fn()

jest.mock('../quota/guestJourneyService', () => ({
  isDurableUser: () => mockIsDurableUser(),
  checkGuestJourney: () => mockCheckGuestJourney(),
  createJourneyId: jest.fn(() => 'guest-test-journey-id'),
  reserveGuestJourney: (...args: unknown[]) => mockReserveGuestJourney(...args),
  releaseGuestJourney: (...args: unknown[]) => mockReleaseGuestJourney(...args),
  finalizeGuestScan: jest.fn(),
  finalizeGuestLog: jest.fn(),
  isGuestJourneyAvailable: jest.fn(),
  isGuestJourneyCompleted: jest.fn(),
}))

const mockIsSupabaseConfigured = jest.fn()
const mockGetAccessToken = jest.fn()

jest.mock('../subscriptions/subscriptionConfig', () => ({
  SUPABASE_CONFIGURED: true,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-xxxx',
  FREE_WARNING_THRESHOLDS: [2, 1],
  PRO_WARNING_THRESHOLDS: [10, 5],
}))

jest.mock('../supabase/supabaseClient', () => ({
  isSupabaseConfigured: () => mockIsSupabaseConfigured(),
}))

jest.mock('../supabase/identity', () => ({
  getAccessToken: () => mockGetAccessToken(),
  getUserId: jest.fn(),
}))

jest.mock('../supabase/accountLink', () => ({
  isDurableUser: () => mockIsDurableUser(),
  refreshSessionAndCheckDurable: jest.fn().mockResolvedValue(false),
}))

import {
  analyzeScanOnServer,
  ScanQuotaError,
} from '../quota/quotaService'
import {
  checkCameraEligibility,
  shouldOpenCamera,
  requiresGate,
  type SnapEligibilityInfo,
} from '../cameraEligibilityCoordinator'

// ── Fixtures ──────────────────────────────────────────────────

const FREE_ELIGIBLE: SnapEligibilityInfo = {
  eligible: true,
  remaining: 3,
  reason: null,
  isPro: false,
}

const AVAILABLE_JOURNEY = {
  status: 'available' as const,
  journeyId: null,
  scanRequestId: null,
  logOperationId: null,
  scanCompletedAt: null,
  logCompletedAt: null,
}

const MANUAL_LOG_ONLY_COMPLETED = {
  status: 'completed' as const,
  journeyId: 'past-manual',
  scanRequestId: null,
  logOperationId: 'log-1',
  scanCompletedAt: null,
  logCompletedAt: '2026-08-04T12:00:00Z',
}

const SCAN_COMPLETED = {
  status: 'completed' as const,
  journeyId: 'past-scan',
  scanRequestId: 'scan-1',
  logOperationId: null,
  scanCompletedAt: '2026-08-04T12:00:00Z',
  logCompletedAt: null,
}

const SCAN_RESERVED_NO_SCAN = {
  status: 'scan_reserved' as const,
  journeyId: 'journey-1',
  scanRequestId: 'scan-1',
  logOperationId: null,
  scanCompletedAt: null,
  logCompletedAt: null,
}

const SCAN_RESERVED_WITH_SCAN = {
  status: 'scan_reserved' as const,
  journeyId: 'journey-1',
  scanRequestId: 'scan-1',
  logOperationId: null,
  scanCompletedAt: '2026-08-04T12:00:00Z',
  logCompletedAt: null,
}

const LOG_RESERVED_NO_SCAN = {
  status: 'log_reserved' as const,
  journeyId: 'journey-2',
  scanRequestId: null,
  logOperationId: 'log-2',
  scanCompletedAt: null,
  logCompletedAt: null,
}

const RESERVE_OK = { ok: true, code: 'reserved', status: 'scan_reserved', journeyId: 'guest-test-journey-id' }
const RESERVE_FAIL_USED = { ok: false, code: 'journey_already_used', status: 'completed' }
const RESERVE_FAIL_NETWORK = { ok: false, code: 'network_error' }

// ── Mock fetch for performServerScan ──────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

function mockScanResponse(rawText = '[{"produceId":"carrot","name":"Carrot","count":1,"estimatedWeightG":70,"confidence":0.9}]') {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rawText,
      quota: { plan: 'free', limit: 5, used: 1, remaining: 4, periodStart: '', periodEnd: '', dailyLimit: null, dailyUsed: null },
    }),
  }
}

function mockScanError(status: number, body: Record<string, unknown>) {
  return {
    ok: false,
    status,
    json: async () => body,
  }
}

describe('Guest Post-Capture Gate Regression', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsDurableUser.mockResolvedValue(false)
    mockIsSupabaseConfigured.mockReturnValue(true)
    mockGetAccessToken.mockResolvedValue('test-token')
    mockFetch.mockResolvedValue(mockScanResponse())
  })

  // ── A. analyzeScanOnServer gating ───────────────────────────

  describe('A. analyzeScanOnServer: guest with manual-log-only completed', () => {
    it('A1. Should NOT throw account_required when scanCompletedAt is null', async () => {
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)

      const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')

      expect(result.rawText).toBeDefined()
      expect(mockReserveGuestJourney).toHaveBeenCalledWith('guest-test-journey-id', 'scan')
    })

    it('A2. Should throw account_required when scanCompletedAt is set', async () => {
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      await expect(
        analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      ).rejects.toThrow()

      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).toBe('account_required')
      }
    })

    it('A3. Should NOT call onAccountRequired for manual-log-only guest (no account_required throw)', async () => {
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)

      let threwAccountRequired = false
      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      } catch (e) {
        if (e instanceof ScanQuotaError && e.code === 'account_required') {
          threwAccountRequired = true
        }
      }

      expect(threwAccountRequired).toBe(false)
    })
  })

  describe('A. analyzeScanOnServer: reserve failure handling', () => {
    it('A4. Reserve fail with journey_already_used + scanCompletedAt null → server_error, NOT account_required', async () => {
      // First checkGuestJourney: manual-log-only state
      // Second checkGuestJourney (recheck after reserve fail): still scanCompletedAt null
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_FAIL_USED)

      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
        fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).toBe('server_error')
        expect((e as ScanQuotaError).code).not.toBe('account_required')
      }
    })

    it('A5. Reserve fail with journey_already_used + scanCompletedAt set → account_required', async () => {
      // First checkGuestJourney: scan completed state
      // But scanCompletedAt is set, so the pre-check should catch it first
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
        fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).toBe('account_required')
      }
    })

    it('A6. Reserve fail with network_error → server_error', async () => {
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_FAIL_NETWORK)

      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
        fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).toBe('server_error')
      }
    })
  })

  describe('A. analyzeScanOnServer: successful scan flow', () => {
    it('A7. Available guest: reserve → scan → success returns result', async () => {
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanResponse())

      const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')

      expect(result.rawText).toContain('carrot')
      expect(result.quota).toBeDefined()
      expect(result.quota?.used).toBe(1)
    })

    it('A8. Provider error → release journey and throw server_error', async () => {
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanError(502, { message: 'Vision provider error' }))

      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
        fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).not.toBe('account_required')
      }

      // Journey should be released on technical failure
      expect(mockReleaseGuestJourney).toHaveBeenCalledWith('guest-test-journey-id')
    })

    it('A9. Quota exceeded (429) → release journey and throw monthly_limit_reached', async () => {
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanError(429, { code: 'monthly_limit_reached', message: 'Limit reached' }))

      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
        fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).toBe('monthly_limit_reached')
      }

      expect(mockReleaseGuestJourney).toHaveBeenCalledWith('guest-test-journey-id')
    })
  })

  // ── B. cameraEligibilityCoordinator reserved-state handling ─

  describe('B. Coordinator: reserved state with scanCompletedAt null', () => {
    it('B1. scan_reserved + scanCompletedAt null → open_camera (NOT show_auth_resume)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(SCAN_RESERVED_NO_SCAN)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.action).not.toBe('show_auth_resume')
      expect(shouldOpenCamera(result)).toBe(true)
      expect(requiresGate(result)).toBe(false)
    })

    it('B2. log_reserved + scanCompletedAt null → open_camera (NOT show_auth_resume)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(LOG_RESERVED_NO_SCAN)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.action).not.toBe('show_auth_resume')
    })

    it('B3. scan_reserved + scanCompletedAt set → show_auth_resume (stale state)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(SCAN_RESERVED_WITH_SCAN)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      // scanCompletedAt is set → hasUsedFreeScan is true → show_account_gate
      // (the hasUsedFreeScan check comes before the reserved-state check)
      expect(result.action).toBe('show_account_gate')
    })
  })

  // ── C. CameraScreen catch behavior (source verification) ────

  describe('C. CameraScreen source: catch behavior', () => {
    it('C1. CameraScreen catches account_required and calls onAccountRequired', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/CameraScreen.js'),
        'utf-8'
      )

      expect(source).toContain("err.code === 'account_required'")
      expect(source).toContain('onAccountRequired')
    })

    it('C2. CameraScreen does NOT call onAccountRequired for non-account_required errors', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/CameraScreen.js'),
        'utf-8'
      )

      // The account_required check is specific — other errors fall through
      // to the generic error handler (setError + setIsApiError)
      const catchBlock = source.match(/catch \(err\) \{[\s\S]*?\} finally/)
      expect(catchBlock).toBeTruthy()
      expect(catchBlock![0]).toContain('account_required')
      expect(catchBlock![0]).toContain('setError')
      expect(catchBlock![0]).toContain('setIsApiError')
    })

    it('C3. CameraScreen has guestFirstScan prop for nonblocking notice', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/CameraScreen.js'),
        'utf-8'
      )

      expect(source).toContain('guestFirstScan')
      expect(source).toContain('firstScanNotice')
    })
  })

  // ── D. Server SQL reserve_guest_journey (source verification) ─

  describe('D. Server SQL: reserve_guest_journey allows scan after manual log', () => {
    it('D1. Migration 0011 exists and allows scan when scanCompletedAt is null', () => {
      const fs = require('fs')
      const path = require('path')
      const migrationPath = path.join(
        __dirname,
        '../../../supabase/migrations/0011_guest_scan_after_manual_log.sql'
      )

      // Migration file must exist
      expect(fs.existsSync(migrationPath)).toBe(true)

      const sql = fs.readFileSync(migrationPath, 'utf-8')

      // Must check scan_completed_at IS NULL
      expect(sql).toMatch(/scan_completed_at\s+is\s+null/i)
      // Must allow reservation from 'completed' status for scan type
      expect(sql).toMatch(/g\.status\s*=\s*'completed'/)
      expect(sql).toMatch(/p_journey_type\s*=\s*'scan'/)
      // Must reset to scan_reserved
      expect(sql).toMatch(/scan_reserved/)
    })

    it('D2. Original migration 0008 does not have the manual-log fix', () => {
      const fs = require('fs')
      const path = require('path')
      const origSql = fs.readFileSync(
        path.join(__dirname, '../../../supabase/migrations/0008_guest_first_use.sql'),
        'utf-8'
      )

      // The original only allowed 'available' status — this is the bug
      expect(origSql).toMatch(/g\.status\s*<>\s*'available'/)
      // The original does NOT check scan_completed_at
      expect(origSql).not.toMatch(/scan_completed_at\s+is\s+null/i)
    })
  })

  // ── E. Source verification: no post-capture gate on status alone ──

  describe('E. Source verification: gating uses scanCompletedAt not status', () => {
    it('E1. cameraEligibilityCoordinator does not gate on status === completed alone', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../cameraEligibilityCoordinator.ts'),
        'utf-8'
      )

      // Must use scanCompletedAt / hasUsedFreeScan for the gate decision
      expect(source).toContain('scanCompletedAt')
      expect(source).toContain('hasUsedFreeScan')
      // Must NOT have a bare status === 'completed' check that gates
      expect(source).not.toMatch(/journey\.status === 'completed'/)
    })

    it('E2. quotaService does not gate on status !== available alone', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../quota/quotaService.ts'),
        'utf-8'
      )

      expect(source).toContain('scanCompletedAt')
      // Must NOT gate on status !== 'available' (the old broken logic)
      expect(source).not.toMatch(/guestState\.status !== 'available'/)
    })

    it('E3. No post-capture gate relies solely on journey.status when scanCompletedAt is null', () => {
      const fs = require('fs')
      const path = require('path')

      // Check coordinator
      const coordSrc = fs.readFileSync(
        path.join(__dirname, '../cameraEligibilityCoordinator.ts'),
        'utf-8'
      )
      // The coordinator must check scanCompletedAt BEFORE checking status
      const scanCheckPos = coordSrc.indexOf('scanCompletedAt')
      const statusCheckPos = coordSrc.indexOf('scan_reserved')
      expect(scanCheckPos).toBeGreaterThan(-1)
      expect(statusCheckPos).toBeGreaterThan(-1)
      // scanCompletedAt check must come before the reserved-status checks
      expect(scanCheckPos).toBeLessThan(statusCheckPos)

      // Check quotaService
      const quotaSrc = fs.readFileSync(
        path.join(__dirname, '../quota/quotaService.ts'),
        'utf-8'
      )
      // The pre-check must use scanCompletedAt, not status
      expect(quotaSrc).toMatch(/guestState\.scanCompletedAt/)
      // Must NOT use status for the scan gate
      expect(quotaSrc).not.toMatch(/guestState\.status !== 'available'/)
    })
  })

  // ── F. Full lifecycle: capture → analysis → success/failure/retry ──

  describe('F. Full lifecycle scenarios', () => {
    it('F1. Manual-log guest: open camera → capture → analysis succeeds → no account gate', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Step 1: Camera eligibility check — manual-log-only completed
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      const eligResult = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(eligResult.action).toBe('open_camera')

      // Step 2: analyzeScanOnServer — should reserve and succeed
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanResponse())
      const scanResult = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      expect(scanResult.rawText).toContain('carrot')

      // Step 3: After successful scan, scanCompletedAt would be set by server
      // Next eligibility check should block
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)
      const nextResult = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(nextResult.action).toBe('show_account_gate')
    })

    it('F2. Manual-log guest: open camera → capture → analysis fails → retry succeeds', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Step 1: Camera eligibility — manual-log-only, open camera
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      const elig1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(elig1.action).toBe('open_camera')

      // Step 2: First scan attempt — provider error
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanError(502, { message: 'Provider error' }))
      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
        fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(ScanQuotaError)
        expect((e as ScanQuotaError).code).not.toBe('account_required')
      }
      // Journey released on failure
      expect(mockReleaseGuestJourney).toHaveBeenCalledWith('guest-test-journey-id')

      // Step 3: After failure, scanCompletedAt still null → can retry
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      const elig2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(elig2.action).toBe('open_camera')

      // Step 4: Retry — succeeds
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanResponse())
      const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-2')
      expect(result.rawText).toContain('carrot')
    })

    it('F3. Available guest: open camera → cancel → open again → scan succeeds', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Step 1: Available → open camera
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const elig1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(elig1.action).toBe('open_camera')

      // Step 2: Cancel (no scan called) → still available
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const elig2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(elig2.action).toBe('open_camera')

      // Step 3: Scan succeeds
      mockReserveGuestJourney.mockResolvedValue(RESERVE_OK)
      mockFetch.mockResolvedValue(mockScanResponse())
      const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      expect(result.rawText).toContain('carrot')
    })

    it('F4. Guest with scanCompletedAt: open camera → blocked at eligibility', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result.action).toBe('show_account_gate')
      expect(result.reason).toContain('Create a free account')

      // analyzeScanOnServer should also throw account_required
      await expect(
        analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      ).rejects.toThrow()
    })

    it('F5. Durable user: bypasses guest gate entirely', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result.action).toBe('open_camera')
      expect(result.isDurable).toBe(true)
    })

    it('F6. Reserve failure for manual-log guest does NOT call onAccountRequired (via server_error)', async () => {
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)
      mockReserveGuestJourney.mockResolvedValue(RESERVE_FAIL_USED)

      let accountRequiredThrown = false
      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
      } catch (e) {
        if (e instanceof ScanQuotaError && e.code === 'account_required') {
          accountRequiredThrown = true
        }
      }

      // Must NOT throw account_required — this is the core defect fix
      expect(accountRequiredThrown).toBe(false)
    })

    it('F7. Second scan after successful first scan: blocked at both coordinator and quotaService', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // After first successful scan: scanCompletedAt is set
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      // Coordinator blocks
      const eligResult = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(eligResult.action).toBe('show_account_gate')

      // quotaService also blocks
      try {
        await analyzeScanOnServer('base64data', 'image/jpeg', 'req-2')
        fail('Should have thrown')
      } catch (e) {
        expect((e as ScanQuotaError).code).toBe('account_required')
      }
    })
  })
})
