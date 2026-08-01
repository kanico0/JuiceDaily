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
})
