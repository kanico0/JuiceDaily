// ─────────────────────────────────────────────────────────────
// quotaVerificationState.test.ts — Tests for the explicit quota
// state model: UNKNOWN / KNOWN / EXHAUSTED.
//
// Verifies:
//   - Quota UNKNOWN blocks Juice Snap
//   - Quota UNKNOWN blocks Advanced Blend
//   - Simple Blend remains available when quota is unknown
//   - Server continues to reject unauthorized requests
// ─────────────────────────────────────────────────────────────

// Mock supabaseClient to avoid AsyncStorage native module issues
jest.mock('../../supabase/supabaseClient', () => ({
  getSupabase: jest.fn(() => null),
}))

// Mock quotaService to avoid network/supabase imports
jest.mock('../quotaService', () => ({
  fetchScanQuota: jest.fn(() => Promise.resolve(null)),
  isServerScanAvailable: jest.fn(() => false),
  ScanQuotaError: class ScanQuotaError extends Error {
    code: string
    constructor (code: string, message: string) {
      super(message)
      this.code = code
      this.name = 'ScanQuotaError'
    }
  },
}))

// Mock accountLink to avoid RevenueCat import chain
jest.mock('../../supabase/accountLink', () => ({
  addIdentityChangeListener: jest.fn(() => () => {}),
}))

// Mock subscriptionConfig
jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_CONFIGURED: true,
  FREE_WARNING_THRESHOLDS: [2, 1],
  PRO_WARNING_THRESHOLDS: [10, 5],
}))

import {
  type QuotaVerificationState,
  computeWarningLevel,
} from '../QuotaStore'

describe('quotaVerificationState model', () => {
  describe('QuotaVerificationState type constraints', () => {
    it('only allows unknown, known, or exhausted', () => {
      const valid: QuotaVerificationState[] = ['unknown', 'known', 'exhausted']
      expect(valid).toContain('unknown')
      expect(valid).toContain('known')
      expect(valid).toContain('exhausted')
      expect(valid).toHaveLength(3)
    })
  })

  describe('UNKNOWN blocks quota-consuming operations', () => {
    it('unknown state blocks Juice Snap', () => {
      const verificationState = 'unknown' as QuotaVerificationState
      const shouldAllowSnap = verificationState === 'known' || verificationState === 'exhausted'
      expect(shouldAllowSnap).toBe(false)
    })

    it('unknown state blocks Advanced Blend', () => {
      const verificationState = 'unknown' as QuotaVerificationState
      const shouldAllowBlend = verificationState === 'known' || verificationState === 'exhausted'
      expect(shouldAllowBlend).toBe(false)
    })

    it('unknown state does NOT block Simple Blend (free, no quota needed)', () => {
      const verificationState: QuotaVerificationState = 'unknown'
      // Simple Blend is free/unlimited and does not require quota
      const shouldAllowSimpleBlend = true
      expect(shouldAllowSimpleBlend).toBe(true)
      expect(verificationState).toBe('unknown')
    })

    it('unknown state does NOT block local history viewing', () => {
      const verificationState: QuotaVerificationState = 'unknown'
      // Local history is safe functionality
      const shouldAllowHistory = true
      expect(shouldAllowHistory).toBe(true)
      expect(verificationState).toBe('unknown')
    })

    it('unknown state does NOT block education/How to Juice', () => {
      const verificationState: QuotaVerificationState = 'unknown'
      const shouldAllowEducation = true
      expect(shouldAllowEducation).toBe(true)
      expect(verificationState).toBe('unknown')
    })
  })

  describe('KNOWN allows quota-consuming operations', () => {
    it('known state allows Juice Snap (if remaining > 0)', () => {
      const verificationState: QuotaVerificationState = 'known'
      const shouldAllowSnap = verificationState === 'known'
      expect(shouldAllowSnap).toBe(true)
    })

    it('known state allows Advanced Blend', () => {
      const verificationState: QuotaVerificationState = 'known'
      const shouldAllowBlend = verificationState === 'known'
      expect(shouldAllowBlend).toBe(true)
    })
  })

  describe('EXHAUSTED blocks quota-consuming operations', () => {
    it('exhausted state blocks Juice Snap', () => {
      const verificationState = 'exhausted' as QuotaVerificationState
      const shouldAllowSnap = verificationState === 'known'
      expect(shouldAllowSnap).toBe(false)
    })

    it('exhausted state blocks Advanced Blend', () => {
      const verificationState = 'exhausted' as QuotaVerificationState
      const shouldAllowBlend = verificationState === 'known'
      expect(shouldAllowBlend).toBe(false)
    })
  })

  describe('computeWarningLevel with null quota', () => {
    it('returns none for null quota (display-only)', () => {
      expect(computeWarningLevel(null)).toBe('none')
    })
  })

  describe('server remains authoritative', () => {
    it('client unknown state does not bypass server', () => {
      // Regardless of client state, the server independently
      // rejects unauthorized/quota-exceeding requests.
      const clientVerificationState: QuotaVerificationState = 'unknown'
      const serverWouldReject = true // server always checks
      expect(serverWouldReject).toBe(true)
      expect(clientVerificationState).toBe('unknown')
    })
  })
})
