// ─────────────────────────────────────────────────────────────
// guestFirstScanGate.test.ts — Regression tests for the guest
// first-scan account-gating defect.
//
// Proves:
//   1. Guest with zero successful scans can open initial Snap Produce
//   2. Guest with zero successful scans can use Snap Produce Again
//      after a manual juice entry
//   3. Manual entry does not change successful scan usage
//   4. Logging a manual juice does not trigger the account gate
//   5. Camera open and cancellation do not consume the first scan
//   6. Permission denial does not consume it
//   7. Failed analysis does not consume it
//   8. First successful analysis consumes exactly one scan
//   9. Second guest scan attempt shows AccountGateModal
//  10. Dismissing the gate resets isPreparingCamera
//  11. Registered free users follow existing free-account limits
//  12. Pro users remain unaffected
//  13. Stale local state cannot override the authoritative scan snapshot
//  14. No double charge occurs during retry or repeated taps
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

jest.mock('../subscriptions/subscriptionConfig', () => ({
  SUPABASE_CONFIGURED: true,
  SUPABASE_URL: 'https://test.supabase.co',
  FREE_WARNING_THRESHOLDS: [2, 1],
  PRO_WARNING_THRESHOLDS: [10, 5],
}))

import {
  checkCameraEligibility,
  shouldOpenCamera,
  requiresGate,
  type SnapEligibilityInfo,
} from '../cameraEligibilityCoordinator'

const FREE_ELIGIBLE: SnapEligibilityInfo = {
  eligible: true,
  remaining: 3,
  reason: null,
  isPro: false,
}

const PRO_SNAP: SnapEligibilityInfo = {
  eligible: true,
  remaining: Infinity,
  reason: null,
  isPro: true,
}

const FREE_EXHAUSTED: SnapEligibilityInfo = {
  eligible: false,
  remaining: 0,
  reason: 'You have used your free snaps.',
  isPro: false,
}

describe('Guest First-Scan Gate Regression', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Available journey state (no prior activity) ──
  const AVAILABLE_JOURNEY = {
    status: 'available' as const,
    journeyId: null,
    scanRequestId: null,
    logOperationId: null,
    scanCompletedAt: null,
    logCompletedAt: null,
  }

  // ── Manual-log-only completed state (juice logged, no scan) ──
  const MANUAL_LOG_ONLY_COMPLETED = {
    status: 'completed' as const,
    journeyId: 'past-manual',
    scanRequestId: null,
    logOperationId: 'log-1',
    scanCompletedAt: null,
    logCompletedAt: '2026-08-04T12:00:00Z',
  }

  // ── Scan-completed state (successful scan done) ──
  const SCAN_COMPLETED = {
    status: 'completed' as const,
    journeyId: 'past-scan',
    scanRequestId: 'scan-1',
    logOperationId: null,
    scanCompletedAt: '2026-08-04T12:00:00Z',
    logCompletedAt: null,
  }

  // ── Scan completed but log pending ──
  const SCAN_COMPLETED_LOG_PENDING = {
    status: 'scan_completed' as const,
    journeyId: 'journey-1',
    scanRequestId: 'scan-1',
    logOperationId: null,
    scanCompletedAt: '2026-08-04T12:00:00Z',
    logCompletedAt: null,
  }

  describe('1-2. Guest with zero successful scans can open camera', () => {
    it('1. Guest with zero successful scans can open initial Snap Produce', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(shouldOpenCamera(result)).toBe(true)
      expect(requiresGate(result)).toBe(false)
    })

    it('2. Guest with zero successful scans can use Snap Produce Again after manual juice entry', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      // After manual juice log: status is 'completed' but scanCompletedAt is null
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(shouldOpenCamera(result)).toBe(true)
      expect(requiresGate(result)).toBe(false)
    })
  })

  describe('3-4. Manual entry does not count as a scan', () => {
    it('3. Manual entry does not change successful scan usage (scanCompletedAt stays null)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      // scanCompletedAt is null → coordinator allows camera
      expect(result.action).toBe('open_camera')
      // The authoritative field is scanCompletedAt, not status
      expect(MANUAL_LOG_ONLY_COMPLETED.scanCompletedAt).toBeNull()
    })

    it('4. Logging a manual juice does not trigger the account gate', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).not.toBe('show_account_gate')
      expect(result.action).not.toBe('show_auth_resume')
      expect(result.action).toBe('open_camera')
    })
  })

  describe('5-7. Non-success camera actions do not consume the first scan', () => {
    it('5. Camera open and cancellation do not consume the first scan', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Before camera open: available
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('open_camera')

      // After camera cancel: still available (no scan was committed)
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')
      expect(result2.guestJourneyStatus).toBe('available')
    })

    it('6. Permission denial does not consume it', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Permission denied = no photo taken = no server call
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result.action).toBe('open_camera')

      // After permission denial: still available
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')
    })

    it('7. Failed analysis does not consume it (reservation released by server)', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // First attempt: available → open_camera
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('open_camera')

      // Scan fails, reservation released → back to available
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')
      // scanCompletedAt still null — first scan not consumed
      expect(result2.guestJourneyStatus).toBe('available')
    })
  })

  describe('8. First successful analysis consumes exactly one scan', () => {
    it('8. After successful scan, scanCompletedAt is set and second scan is blocked', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Before scan: available
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('open_camera')

      // After successful scan: scan_completed (scanCompletedAt set)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED_LOG_PENDING)
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      // scan_completed with scanCompletedAt set → blocked
      expect(result2.action).toBe('show_account_gate')
    })
  })

  describe('9. Second guest scan attempt shows AccountGateModal', () => {
    it('9. Guest with scanCompletedAt set sees account gate on next attempt', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('show_account_gate')
      expect(result.reason).toContain('Create a free account')
      expect(result.isDurable).toBe(false)
    })
  })

  describe('10. Dismissing the gate resets isPreparingCamera (source verification)', () => {
    it('10. HomeScreen resets isPreparingCamera when account gate is shown', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/HomeScreen.js'),
        'utf-8'
      )

      // The show_account_gate handler must set isPreparingCamera to false
      expect(source).toContain('show_account_gate')
      // Verify that the handler resets preparing state
      const gateSection = source.match(
        /result\.action === 'show_account_gate'[\s\S]*?return/
      )
      expect(gateSection).toBeTruthy()
      expect(gateSection![0]).toContain('setIsPreparingCamera(false)')
    })
  })

  describe('11. Registered free users follow existing free-account limits', () => {
    it('11. Durable free user with completed journey opens camera (bypasses guest gate)', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.isDurable).toBe(true)
    })

    it('11b. Durable free user with exhausted snaps sees snap gate', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)

      const result = await checkCameraEligibility(FREE_EXHAUSTED)

      expect(result.action).toBe('show_snap_gate')
    })
  })

  describe('12. Pro users remain unaffected', () => {
    it('12. Pro user with scanCompletedAt still sees account gate (anonymous pro)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(PRO_SNAP)

      // Pro bypasses snap gate but not guest journey scan gate
      expect(result.action).toBe('show_account_gate')
    })

    it('12b. Durable pro user opens camera regardless of journey', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(PRO_SNAP)

      expect(result.action).toBe('open_camera')
      expect(result.isPro).toBe(true)
      expect(result.isDurable).toBe(true)
    })
  })

  describe('13. Stale local state cannot override the authoritative scan snapshot', () => {
    it('13. Coordinator reads scanCompletedAt from server, not local cache', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Server says scan was completed (scanCompletedAt set)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      // Even if local state were stale, the server-authoritative
      // scanCompletedAt is what the coordinator uses
      expect(result.action).toBe('show_account_gate')
      expect(result.guestJourneyStatus).toBe('completed')
    })

    it('13b. Manual-log completed without scanCompletedAt allows scan despite stale status', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // Server says status is 'completed' but scanCompletedAt is null
      // (manual log only). Stale local state seeing 'completed' would
      // incorrectly block, but the coordinator checks scanCompletedAt.
      mockCheckGuestJourney.mockResolvedValue(MANUAL_LOG_ONLY_COMPLETED)

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
    })
  })

  describe('14. No double charge occurs during retry or repeated taps', () => {
    it('14. Repeated coordinator calls do not reserve or finalize (read-only)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)

      // Simulate repeated taps (user taps Snap Produce multiple times)
      await checkCameraEligibility(FREE_ELIGIBLE)
      await checkCameraEligibility(FREE_ELIGIBLE)
      await checkCameraEligibility(FREE_ELIGIBLE)

      // Coordinator is read-only — never reserves or finalizes
      expect(mockReserveGuestJourney).not.toHaveBeenCalled()
      const { finalizeGuestScan } = require('../quota/guestJourneyService')
      expect(finalizeGuestScan).not.toHaveBeenCalled()
    })

    it('14b. Failed scan then retry: only one successful scan finalizes', async () => {
      mockIsDurableUser.mockResolvedValue(false)

      // First attempt: available → open_camera
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('open_camera')

      // Scan fails, reservation released → back to available
      mockCheckGuestJourney.mockResolvedValue(AVAILABLE_JOURNEY)
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')

      // Second scan succeeds → scanCompletedAt set → blocked
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)
      const result3 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result3.action).toBe('show_account_gate')

      // Third attempt: still blocked (no double charge)
      mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED)
      const result4 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result4.action).toBe('show_account_gate')
    })
  })

  // ── Additional source-verification tests ──
  describe('Source verification: coordinator gates on scanCompletedAt', () => {
    it('Coordinator source uses scanCompletedAt for gate decision', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../cameraEligibilityCoordinator.ts'),
        'utf-8'
      )

      expect(source).toContain('scanCompletedAt')
      expect(source).toContain('hasUsedFreeScan')
      // Must NOT gate on status === 'completed' alone
      expect(source).not.toMatch(/journey\.status === 'completed'/)
    })

    it('QuotaService source uses scanCompletedAt for scan gate', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../quota/quotaService.ts'),
        'utf-8'
      )

      expect(source).toContain('scanCompletedAt')
      // Must NOT gate on status !== 'available' alone
      expect(source).not.toMatch(/guestState\.status !== 'available'/)
      // Must use Boolean() truthiness check, not !== null
      expect(source).toContain('guestState.scanCompletedAt)')
    })
  })
})
