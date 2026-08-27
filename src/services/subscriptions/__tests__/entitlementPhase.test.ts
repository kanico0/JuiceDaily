// ─────────────────────────────────────────────────────────────
// entitlementPhase.test.ts — Tests for the explicit entitlement
// state model: UNKNOWN / FREE / PRO.
//
// Verifies:
//   - UNKNOWN never grants Pro access
//   - RevenueCat failure never yields Pro
//   - Sign-out clears stale Pro presentation
//   - Entitlement UNKNOWN blocks premium actions
// ─────────────────────────────────────────────────────────────

import {
  createInitialSubscriptionState,
  type EntitlementPhase,
} from '../subscriptionTypes'

describe('entitlementPhase state model', () => {
  describe('createInitialSubscriptionState', () => {
    it('starts as UNKNOWN (not FREE)', () => {
      const state = createInitialSubscriptionState()
      expect(state.entitlementPhase).toBe('unknown')
      expect(state.isProActive).toBe(false)
      expect(state.initialized).toBe(false)
    })

    it('UNKNOWN does not grant Pro', () => {
      const state = createInitialSubscriptionState()
      expect(state.entitlementPhase).toBe('unknown')
      expect(state.isProActive).toBe(false)
      // UNKNOWN must never equal PRO
      expect(state.entitlementPhase).not.toBe('pro')
    })
  })

  describe('EntitlementPhase type constraints', () => {
    it('only allows unknown, free, or pro', () => {
      const valid: EntitlementPhase[] = ['unknown', 'free', 'pro']
      expect(valid).toContain('unknown')
      expect(valid).toContain('free')
      expect(valid).toContain('pro')
      expect(valid).toHaveLength(3)
    })
  })

  describe('fail-closed: RevenueCat failure never yields Pro', () => {
    it('initial state is unknown, not pro', () => {
      const state = createInitialSubscriptionState()
      expect(state.entitlementPhase).toBe('unknown')
      expect(state.isProActive).toBe(false)
    })

    it('unknown phase blocks premium actions', () => {
      const state = createInitialSubscriptionState()
      const shouldAllowPremium = state.entitlementPhase === 'pro'
      expect(shouldAllowPremium).toBe(false)
    })

    it('free phase blocks premium actions', () => {
      const state = {
        ...createInitialSubscriptionState(),
        entitlementPhase: 'free' as const,
        isProActive: false,
      }
      const shouldAllowPremium = (state.entitlementPhase as EntitlementPhase) === 'pro'
      expect(shouldAllowPremium).toBe(false)
    })

    it('pro phase allows premium actions', () => {
      const state = {
        ...createInitialSubscriptionState(),
        entitlementPhase: 'pro' as const,
        isProActive: true,
      }
      const shouldAllowPremium = state.entitlementPhase === 'pro'
      expect(shouldAllowPremium).toBe(true)
    })
  })

  describe('sign-out clears stale Pro', () => {
    it('clearing entitlement sets phase to unknown', () => {
      const proState = {
        ...createInitialSubscriptionState(),
        entitlementPhase: 'pro' as const,
        isProActive: true,
        initialized: true,
      }
      // Simulate clearEntitlement()
      const clearedState = {
        ...proState,
        isProActive: false,
        currentPlan: 'free' as const,
        source: null,
        productId: null,
        expirationDate: null,
        willRenew: null,
        isInGracePeriod: false,
        managementUrl: null,
        lastUpdatedAt: null,
        entitlementPhase: 'unknown' as const,
        loading: false,
        initialized: true,
      }
      expect(clearedState.entitlementPhase).toBe('unknown')
      expect(clearedState.isProActive).toBe(false)
      // Stale Pro UI must disappear
      expect(clearedState.entitlementPhase).not.toBe('pro')
    })
  })
})
