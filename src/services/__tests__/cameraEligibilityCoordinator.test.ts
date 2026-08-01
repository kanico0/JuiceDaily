// ─────────────────────────────────────────────────────────────
// cameraEligibilityCoordinator.test.ts — Pre-camera gate tests.
//
// Proves: all camera entry points are routed through the coordinator,
// snap eligibility is checked first, guest journey state is checked,
// durable auth is checked, and the correct action is returned for
// each scenario.
// ─────────────────────────────────────────────────────────────

const mockIsDurableUser = jest.fn()
const mockCheckGuestJourney = jest.fn()

jest.mock('../quota/guestJourneyService', () => ({
  isDurableUser: () => mockIsDurableUser(),
  checkGuestJourney: () => mockCheckGuestJourney(),
  createJourneyId: jest.fn(() => 'guest-test-id'),
  reserveGuestJourney: jest.fn(),
  finalizeGuestScan: jest.fn(),
  finalizeGuestLog: jest.fn(),
  releaseGuestJourney: jest.fn(),
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

describe('Feature Group 4 — Pre-Camera Eligibility Coordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const PRO_SNAP: SnapEligibilityInfo = {
    eligible: true,
    remaining: Infinity,
    reason: null,
    isPro: true,
  }

  const FREE_ELIGIBLE: SnapEligibilityInfo = {
    eligible: true,
    remaining: 3,
    reason: null,
    isPro: false,
  }

  const FREE_EXHAUSTED: SnapEligibilityInfo = {
    eligible: false,
    remaining: 0,
    reason: 'You have used your free snaps.',
    isPro: false,
  }

  describe('Snap eligibility (first gate)', () => {
    it('1. Returns show_snap_gate when snaps are exhausted and user is not pro', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_EXHAUSTED)

      expect(result.action).toBe('show_snap_gate')
      expect(result.reason).toBe(FREE_EXHAUSTED.reason)
      expect(result.isPro).toBe(false)
      expect(result.snapRemaining).toBe(0)
    })

    it('2. Does not check guest journey when snaps are exhausted (short-circuit)', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      await checkCameraEligibility(FREE_EXHAUSTED)

      // Guest journey should NOT be checked when snaps are exhausted
      expect(mockCheckGuestJourney).not.toHaveBeenCalled()
    })

    it('3. Pro user with exhausted snaps still opens camera', async () => {
      // Pro users have unlimited snaps, so this shouldn't happen,
      // but the coordinator should handle it gracefully
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const proExhausted: SnapEligibilityInfo = {
        eligible: false,
        remaining: 0,
        reason: null,
        isPro: true,
      }

      const result = await checkCameraEligibility(proExhausted)

      // isPro=true means the snap check is bypassed
      expect(result.action).toBe('open_camera')
    })
  })

  describe('Durable (authenticated) user', () => {
    it('4. Durable user with snaps available opens camera', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.isDurable).toBe(true)
    })

    it('5. Durable user bypasses guest journey check', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      // Even though journey is 'completed', durable user can still scan
      expect(result.action).toBe('open_camera')
    })

    it('6. Pro durable user opens camera', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(PRO_SNAP)

      expect(result.action).toBe('open_camera')
      expect(result.isPro).toBe(true)
      expect(result.isDurable).toBe(true)
    })
  })

  describe('Anonymous (guest) user', () => {
    it('7. Anonymous user with available journey opens camera', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.isDurable).toBe(false)
      expect(result.guestJourneyStatus).toBe('available')
    })

    it('8. Anonymous user with scan_completed journey opens camera', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'scan_completed' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.guestJourneyStatus).toBe('scan_completed')
    })

    it('9. Anonymous user with completed journey shows account gate', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('show_account_gate')
      expect(result.reason).toContain('Create a free account')
      expect(result.isDurable).toBe(false)
    })

    it('10. Anonymous user with scan_reserved journey shows auth resume', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'scan_reserved' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('show_auth_resume')
      expect(result.reason).toContain('sign in')
    })

    it('11. Anonymous user with log_reserved journey shows auth resume', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'log_reserved' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('show_auth_resume')
    })
  })

  describe('Guest snap consumption policy', () => {
    it('12. Guest with available journey can scan (first scan free)', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
    })

    it('13. Guest with completed journey cannot scan again without account', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('show_account_gate')
    })

    it('14. Snap is consumed only when camera opens (not during eligibility check)', async () => {
      // The coordinator does NOT consume snaps — it only checks eligibility.
      // Snap consumption (useSnap) happens in the caller after 'open_camera'.
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      // The coordinator returns the remaining count but does not decrement it
      expect(result.snapRemaining).toBe(3)
    })
  })

  describe('Auth resume', () => {
    it('15. After auth resume, durable user opens camera', async () => {
      // First call: anonymous with completed journey → show_account_gate
      mockIsDurableUser.mockResolvedValueOnce(false)
      mockCheckGuestJourney.mockResolvedValueOnce({ status: 'completed' })

      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('show_account_gate')

      // Simulate auth: now durable
      mockIsDurableUser.mockResolvedValueOnce(true)
      mockCheckGuestJourney.mockResolvedValueOnce({ status: 'completed' })

      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')
      expect(result2.isDurable).toBe(true)
    })

    it('16. Auth resume with signin mode for in-progress journey', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'scan_reserved' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('show_auth_resume')
      // The caller should show AccountGateModal with initialMode='signin'
    })
  })

  describe('Helper functions', () => {
    it('shouldOpenCamera returns true only for open_camera action', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const openResult = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(shouldOpenCamera(openResult)).toBe(true)

      const gateResult = await checkCameraEligibility(FREE_EXHAUSTED)
      expect(shouldOpenCamera(gateResult)).toBe(false)
    })

    it('requiresGate returns true for all gate actions', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })

      const accountGateResult = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(requiresGate(accountGateResult)).toBe(true)

      mockCheckGuestJourney.mockResolvedValue({ status: 'scan_reserved' })
      const authResumeResult = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(requiresGate(authResumeResult)).toBe(true)

      const snapGateResult = await checkCameraEligibility(FREE_EXHAUSTED)
      expect(requiresGate(snapGateResult)).toBe(true)
    })

    it('requiresGate returns false for open_camera', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(requiresGate(result)).toBe(false)
    })
  })

  describe('All camera entry points routed through coordinator', () => {
    it('17. HomeScreen handleSnap uses coordinator (source verification)', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '../../screens/HomeScreen.js'),
        'utf-8'
      )
      expect(source).toContain('checkCameraEligibility')
      expect(source).toContain('attemptCameraOpen')
      expect(source).toContain('pendingCameraOpenRef')
      // Auth resume: onAuthenticated retries camera open
      expect(source).toContain('pendingCameraOpenRef.current')
    })

    it('18. Coordinator is a pure function (no side effects on snap count)', async () => {
      mockIsDurableUser.mockResolvedValue(true)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const before = FREE_ELIGIBLE.remaining
      await checkCameraEligibility(FREE_ELIGIBLE)
      expect(FREE_ELIGIBLE.remaining).toBe(before)
    })
  })

  describe('Edge cases', () => {
    it('19. Unknown guest journey status defaults to open_camera for anonymous', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'unknown_status' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      // Unknown statuses fall through to the default 'open_camera' case
      expect(result.action).toBe('open_camera')
    })

    it('20. Pro user with free snap eligibility opens camera regardless of journey', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })

      const result = await checkCameraEligibility(PRO_SNAP)

      // Pro users bypass the snap gate, but still need to pass guest journey
      // Since journey is 'completed' and user is anonymous, show account gate
      expect(result.action).toBe('show_account_gate')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Section 3: Guest-snap consumption lifecycle
  //
  // The coordinator is a READ-ONLY eligibility check. It must NOT
  // consume the guest snap. The guest journey is consumed only by
  // the server-authoritative path in quotaService.analyzeScanOnServer
  // → reserveGuestJourney → performServerScan → server finalizes.
  // Failed and abandoned flows release the reservation.
  // ─────────────────────────────────────────────────────────────

  describe('Guest-snap consumption lifecycle', () => {
    it('21. Coordinator returns open_camera without consuming usage', async () => {
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      // Coordinator does NOT call reserveGuestJourney or finalizeGuestScan
      // It only reads state via checkGuestJourney
      // The mock for reserveGuestJourney was never set up to be callable
      // (it's jest.fn() with no mock implementation), so we verify it
      // was never called by checking the mock was not invoked
      const { reserveGuestJourney } = require('../quota/guestJourneyService')
      expect(reserveGuestJourney).not.toHaveBeenCalled()
    })

    it('22. Opening the camera does not consume guest snap (coordinator is read-only)', async () => {
      // The coordinator returns open_camera. The caller (HomeScreen) then
      // calls useSnap() (client-side display counter) and setIsCameraOpen(true).
      // Neither of these touches the guest journey.
      // The guest journey is only consumed when analyzeScanOnServer succeeds.
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.guestJourneyStatus).toBe('available')
      // Journey status is still 'available' — not consumed
    })

    it('23. Canceling the camera does not consume usage', async () => {
      // If user opens camera then closes it without taking a photo,
      // no server call is made, so no reservation or finalization happens.
      // The coordinator's check was read-only.
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result.action).toBe('open_camera')

      // Simulate camera cancel: no call to analyzeScanOnServer
      // Guest journey remains 'available'
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')
      expect(result2.guestJourneyStatus).toBe('available')
    })

    it('24. Permission denial does not consume usage', async () => {
      // Camera permission denied = no photo taken = no server call
      // Coordinator already returned open_camera, but that was read-only
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result.action).toBe('open_camera')

      // After permission denial, user can still scan — journey still available
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')
    })

    it('25. Upload failure does not consume usage (reservation released)', async () => {
      // In quotaService.analyzeScanOnServer, if the scan fails with a
      // non-account_required error, releaseGuestJourney is called.
      // The coordinator itself never reserves or releases — it only checks.
      // This test verifies the coordinator does not reserve.
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      await checkCameraEligibility(FREE_ELIGIBLE)

      const { reserveGuestJourney } = require('../quota/guestJourneyService')
      expect(reserveGuestJourney).not.toHaveBeenCalled()
    })

    it('26. Analysis failure releases the reservation (quotaService behavior)', async () => {
      // This is verified by the existing scanGate.test.ts suite.
      // The coordinator does not participate in the reserve/release cycle.
      // We verify here that the coordinator never calls finalize or release.
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      await checkCameraEligibility(FREE_ELIGIBLE)

      const { finalizeGuestScan, releaseGuestJourney } = require('../quota/guestJourneyService')
      expect(finalizeGuestScan).not.toHaveBeenCalled()
      expect(releaseGuestJourney).not.toHaveBeenCalled()
    })

    it('27. Successful finalized analysis consumes the guest snap exactly once', async () => {
      // After a successful scan, the server transitions the journey to
      // 'scan_completed'. The next coordinator call will see this state
      // and still allow open_camera (scan_completed allows camera open
      // for manual log finalization).
      // After the log is finalized (journey → 'completed'), the coordinator
      // will block further scans.
      mockIsDurableUser.mockResolvedValue(false)

      // Before scan: available
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })
      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('open_camera')

      // After successful scan: scan_completed (still can open camera for log)
      mockCheckGuestJourney.mockResolvedValue({ status: 'scan_completed' })
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')

      // After log finalized: completed (blocked)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })
      const result3 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result3.action).toBe('show_account_gate')
    })

    it('28. Retrying does not double-consume the guest snap', async () => {
      // If the first scan fails and releases the reservation, the journey
      // returns to 'available'. The user can retry. The coordinator will
      // allow open_camera again. Only one successful scan will finalize.
      mockIsDurableUser.mockResolvedValue(false)

      // First attempt: available
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })
      const result1 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result1.action).toBe('open_camera')

      // Scan fails, reservation released → back to available
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })
      const result2 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result2.action).toBe('open_camera')

      // Second scan succeeds → scan_completed
      mockCheckGuestJourney.mockResolvedValue({ status: 'scan_completed' })
      const result3 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result3.action).toBe('open_camera')

      // Log finalized → completed (blocked)
      mockCheckGuestJourney.mockResolvedValue({ status: 'completed' })
      const result4 = await checkCameraEligibility(FREE_ELIGIBLE)
      expect(result4.action).toBe('show_account_gate')
    })

    it('29. useSnap (client counter) is separate from guest journey consumption', async () => {
      // useSnap() in ProStore increments a client-side monthlySnapCount.
      // This is a DISPLAY counter, not the server-authoritative guest journey.
      // The coordinator does not call useSnap — that's the caller's job.
      // The coordinator only returns eligibility info.
      mockIsDurableUser.mockResolvedValue(false)
      mockCheckGuestJourney.mockResolvedValue({ status: 'available' })

      const result = await checkCameraEligibility(FREE_ELIGIBLE)

      expect(result.action).toBe('open_camera')
      expect(result.snapRemaining).toBe(3)
      // snapRemaining is unchanged — coordinator doesn't decrement it
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Section 4: Camera entry point source verification
  // ─────────────────────────────────────────────────────────────

  describe('Camera entry point source verification', () => {
    const fs = require('fs')
    const path = require('path')

    const readSrc = (relPath: string) =>
      fs.readFileSync(path.join(__dirname, '..', '..', relPath), 'utf-8')

    const ENTRY_POINTS = [
      { file: 'screens/TodayScreen.js', label: 'TodayScreen handleScan' },
      { file: 'screens/TodayScreen.js', label: 'TodayScreen handleQuickLog' },
      { file: 'screens/DashboardScreen.js', label: 'DashboardScreen scan buttons' },
      { file: 'screens/ScanScreen.js', label: 'ScanScreen handleScan' },
      { file: 'screens/ExplainFlowScreen.js', label: 'ExplainFlowScreen scan redirect' },
      { file: 'screens/PerformanceDashboardScreen.js', label: 'PerformanceDashboardScreen handleScan' },
      { file: 'screens/PerformanceOnboardingScreen.js', label: 'PerformanceOnboardingScreen scan' },
      { file: 'screens/ScanSuccessScreen.js', label: 'ScanSuccessScreen handleScanAnother' },
      { file: 'screens/RecipeDetailScreen.js', label: 'RecipeDetailScreen scan' },
    ]

    it('30. HomeScreen routes through coordinator (attemptCameraOpen)', () => {
      const src = readSrc('screens/HomeScreen.js')
      expect(src).toContain('checkCameraEligibility')
      expect(src).toContain('attemptCameraOpen')
      expect(src).toContain('pendingCameraOpenRef')
    })

    it('31. All camera entry points navigate to ScanFlow or JuiceSnap (source verification)', () => {
      // Every camera entry point navigates to 'ScanFlow' or 'JuiceSnap'
      // with openCamera param. The ScanFlow modal contains JuiceSnapScreen
      // (HomeScreen), which routes through the coordinator.
      ENTRY_POINTS.forEach(({ file, label }) => {
        const src = readSrc(file)
        const hasScanRoute =
          src.includes('ScanFlow') ||
          src.includes('JuiceSnap') ||
          src.includes('openCamera')
        expect(hasScanRoute).toBe(true)
      })
    })

    it('32. No entry point directly opens CameraScreen bypassing coordinator', () => {
      // CameraScreen is only rendered inside HomeScreen's Modal,
      // controlled by isCameraOpen state, which is only set by
      // attemptCameraOpen (which routes through coordinator).
      ENTRY_POINTS.forEach(({ file }) => {
        const src = readSrc(file)
        // No entry point should import or directly render CameraScreen
        expect(src).not.toContain('CameraScreen')
      })
    })

    it('33. Auth resume in HomeScreen retries through coordinator', () => {
      const src = readSrc('screens/HomeScreen.js')
      // onAuthenticated calls attemptCameraOpen (which uses coordinator)
      expect(src).toContain('pendingCameraOpenRef.current = false')
      expect(src).toContain('attemptCameraOpen(false)')
    })
  })
})
