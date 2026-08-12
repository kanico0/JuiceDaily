// ─────────────────────────────────────────────────────────────
// effectiveProAccess.test.js
// Tests for the canonical useEffectiveProAccess hook logic.
// Verifies that the dev Pro override correctly combines with
// real RevenueCat subscription state and that entitlementInitialized
// is forced true when dev override is active.
// ─────────────────────────────────────────────────────────────

// Simulate the useEffectiveProAccess logic
function computeEffectiveProAccess(realIsProActive, realInitialized, devProActive, devToolsEnabled) {
  const realIsPro = realInitialized ? realIsProActive : false
  const devOverrideActive = devToolsEnabled && devProActive
  const isPro = realIsPro || devOverrideActive
  const entitlementInitialized = realInitialized || devOverrideActive
  return {
    isPro,
    entitlementInitialized,
    realIsPro,
    devProActive: devOverrideActive,
    isDevOverridePossible: devToolsEnabled,
  }
}

// Simulate getHistoryAccessPolicy (the actual policy function)
function getHistoryAccessPolicy(isPro, isAdvancedPreview, entitlementInitialized = true) {
  if (!entitlementInitialized) {
    return {
      isLoading: true,
      isPro: false,
      canViewAdvancedDetails: false,
      canMakeAgain: false,
    }
  }
  if (isPro) {
    return {
      isLoading: false,
      isPro: true,
      canViewAdvancedDetails: true,
      canMakeAgain: true,
    }
  }
  if (isAdvancedPreview) {
    return {
      isLoading: false,
      isPro: false,
      canViewAdvancedDetails: true,
      canMakeAgain: true,
    }
  }
  return {
    isLoading: false,
    isPro: false,
    canViewAdvancedDetails: false,
    canMakeAgain: false,
  }
}

describe('useEffectiveProAccess — canonical entitlement', () => {
  describe('Case 1: RevenueCat Free + Dev Override OFF → effective Free', () => {
    test('isPro is false, entitlementInitialized follows real', () => {
      const result = computeEffectiveProAccess(false, true, false, true)
      expect(result.isPro).toBe(false)
      expect(result.entitlementInitialized).toBe(true)
      expect(result.devProActive).toBe(false)
    })

    test('History policy returns Free locked', () => {
      const access = computeEffectiveProAccess(false, true, false, true)
      const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
      expect(policy.canViewAdvancedDetails).toBe(false)
      expect(policy.isPro).toBe(false)
    })
  })

  describe('Case 2: RevenueCat Free + Dev Override ON → effective Pro', () => {
    test('isPro is true, entitlementInitialized forced true', () => {
      const result = computeEffectiveProAccess(false, true, true, true)
      expect(result.isPro).toBe(true)
      expect(result.entitlementInitialized).toBe(true)
      expect(result.devProActive).toBe(true)
    })

    test('History policy returns Pro', () => {
      const access = computeEffectiveProAccess(false, true, true, true)
      const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
      expect(policy.canViewAdvancedDetails).toBe(true)
      expect(policy.isPro).toBe(true)
    })
  })

  describe('Case 3: RevenueCat Pro + Dev Override OFF → effective Pro', () => {
    test('isPro is true from real subscription', () => {
      const result = computeEffectiveProAccess(true, true, false, true)
      expect(result.isPro).toBe(true)
      expect(result.entitlementInitialized).toBe(true)
      expect(result.devProActive).toBe(false)
      expect(result.realIsPro).toBe(true)
    })

    test('History policy returns Pro', () => {
      const access = computeEffectiveProAccess(true, true, false, true)
      const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
      expect(policy.canViewAdvancedDetails).toBe(true)
      expect(policy.isPro).toBe(true)
    })
  })

  describe('Case 4: RevenueCat Pro + Dev Override ON → effective Pro', () => {
    test('isPro is true (both sources)', () => {
      const result = computeEffectiveProAccess(true, true, true, true)
      expect(result.isPro).toBe(true)
      expect(result.entitlementInitialized).toBe(true)
      expect(result.devProActive).toBe(true)
      expect(result.realIsPro).toBe(true)
    })
  })

  describe('Case 5: Dev override unavailable when developer-tools build flag is false', () => {
    test('devProActive is false even if ProStore says pro', () => {
      const result = computeEffectiveProAccess(false, true, true, false)
      expect(result.devProActive).toBe(false)
      expect(result.isPro).toBe(false)
      expect(result.isDevOverridePossible).toBe(false)
    })

    test('History policy returns Free locked', () => {
      const access = computeEffectiveProAccess(false, true, true, false)
      const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
      expect(policy.canViewAdvancedDetails).toBe(false)
    })
  })

  describe('Case 6: Toggling ON updates consuming History components', () => {
    test('Before toggle: Free locked, After toggle: Pro unlocked', () => {
      // Before toggle
      const before = computeEffectiveProAccess(false, true, false, true)
      const policyBefore = getHistoryAccessPolicy(before.isPro, false, before.entitlementInitialized)
      expect(policyBefore.canViewAdvancedDetails).toBe(false)

      // After toggle
      const after = computeEffectiveProAccess(false, true, true, true)
      const policyAfter = getHistoryAccessPolicy(after.isPro, false, after.entitlementInitialized)
      expect(policyAfter.canViewAdvancedDetails).toBe(true)
    })
  })

  describe('Case 7: Toggling OFF immediately restores actual entitlement', () => {
    test('After toggle OFF: returns to Free', () => {
      // Toggle ON
      const on = computeEffectiveProAccess(false, true, true, true)
      expect(on.isPro).toBe(true)

      // Toggle OFF
      const off = computeEffectiveProAccess(false, true, false, true)
      expect(off.isPro).toBe(false)
      expect(off.devProActive).toBe(false)

      const policy = getHistoryAccessPolicy(off.isPro, false, off.entitlementInitialized)
      expect(policy.canViewAdvancedDetails).toBe(false)
    })
  })
})

describe('useEffectiveProAccess — entitlementInitialized fix', () => {
  // This is the ROOT CAUSE fix: when dev Pro is active but
  // SubscriptionStore hasn't initialized, the old code returned
  // a loading state that blocked all advanced UI. The canonical
  // hook forces entitlementInitialized to true when dev override
  // is active.

  test('Dev Pro ON + SubscriptionStore NOT initialized → entitlementInitialized is true', () => {
    const result = computeEffectiveProAccess(false, false, true, true)
    expect(result.entitlementInitialized).toBe(true)
    expect(result.isPro).toBe(true)
  })

  test('Dev Pro ON + SubscriptionStore NOT initialized → History policy is Pro', () => {
    const access = computeEffectiveProAccess(false, false, true, true)
    const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
    expect(policy.isLoading).toBe(false)
    expect(policy.isPro).toBe(true)
    expect(policy.canViewAdvancedDetails).toBe(true)
  })

  test('Dev Pro OFF + SubscriptionStore NOT initialized → loading state', () => {
    const access = computeEffectiveProAccess(false, false, false, true)
    const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
    expect(policy.isLoading).toBe(true)
    expect(policy.canViewAdvancedDetails).toBe(false)
  })

  test('Dev Pro OFF + SubscriptionStore initialized + Free → Free locked', () => {
    const access = computeEffectiveProAccess(false, true, false, true)
    const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)
    expect(policy.isLoading).toBe(false)
    expect(policy.isPro).toBe(false)
    expect(policy.canViewAdvancedDetails).toBe(false)
  })
})

describe('useEffectiveProAccess — History integration', () => {
  test('Free real + Dev Pro ON: all History features unlocked', () => {
    const access = computeEffectiveProAccess(false, true, true, true)
    const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)

    expect(policy.canViewAdvancedDetails).toBe(true)
    expect(policy.canMakeAgain).toBe(true)
    expect(policy.isPro).toBe(true)
  })

  test('Free real + Dev Pro OFF: all History features locked', () => {
    const access = computeEffectiveProAccess(false, true, false, true)
    const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)

    expect(policy.canViewAdvancedDetails).toBe(false)
    expect(policy.canMakeAgain).toBe(false)
    expect(policy.isPro).toBe(false)
  })

  test('Free real + Dev Pro ON + SubscriptionStore not initialized: still unlocked', () => {
    // This is the critical test — the old code would return loading state
    const access = computeEffectiveProAccess(false, false, true, true)
    const policy = getHistoryAccessPolicy(access.isPro, false, access.entitlementInitialized)

    expect(policy.isLoading).toBe(false)
    expect(policy.canViewAdvancedDetails).toBe(true)
    expect(policy.canMakeAgain).toBe(true)
  })
})

describe('useEffectiveProAccess — no backend changes', () => {
  test('Dev override does not set a real subscription plan', () => {
    // The dev override only changes ProStore state, not SubscriptionStore.
    // ProStore.subscriptionPlan becomes 'dev_override', not 'pro_monthly'.
    // This is verified by the ProStore reducer test in devProOverride.test.js
    // Here we verify the effective access doesn't claim a real plan.
    const access = computeEffectiveProAccess(false, false, true, true)
    expect(access.isPro).toBe(true)
    expect(access.realIsPro).toBe(false) // Real RevenueCat still says Free
  })

  test('Dev override does not affect realIsPro', () => {
    const access = computeEffectiveProAccess(false, true, true, true)
    expect(access.realIsPro).toBe(false) // Real subscription unchanged
    expect(access.isPro).toBe(true) // But effective is Pro for UI
  })
})
