// ─────────────────────────────────────────────────────────────
// effectivePlanAccess.test.js — Tests for the canonical
// useEffectivePlanAccess hook logic.
// ─────────────────────────────────────────────────────────────

// Simulate the useEffectivePlanAccess logic
function computeEffectivePlanAccess(realIsProActive, realInitialized, devProActive, devToolsEnabled) {
  const realIsPro = realInitialized ? realIsProActive : false
  const devOverrideActive = devToolsEnabled && devProActive
  const isPro = realIsPro || devOverrideActive
  const entitlementInitialized = realInitialized || devOverrideActive
  const isQaProSimulation = devOverrideActive && !realIsPro

  const FREE_MONTHLY_SCAN_LIMIT = 1
  const PRO_MONTHLY_SCAN_LIMIT = 12

  return {
    effectiveTier: isPro ? 'pro' : 'free',
    isPro,
    isQaProSimulation,
    snapMonthlyLimit: isPro ? PRO_MONTHLY_SCAN_LIMIT : FREE_MONTHLY_SCAN_LIMIT,
    expandedIngredientUnlimited: isPro,
    entitlementInitialized,
    realIsPro,
    realTier: realIsPro ? 'pro' : 'free',
    devProActive: devOverrideActive,
    isDevOverridePossible: devToolsEnabled,
  }
}

describe('useEffectivePlanAccess', () => {
  test('Real Free + QA OFF → Free client policy', () => {
    const result = computeEffectivePlanAccess(false, true, false, false)
    expect(result.effectiveTier).toBe('free')
    expect(result.isPro).toBe(false)
    expect(result.isQaProSimulation).toBe(false)
    expect(result.snapMonthlyLimit).toBe(1)
    expect(result.expandedIngredientUnlimited).toBe(false)
  })

  test('Real Free + QA ON → Pro client policy', () => {
    const result = computeEffectivePlanAccess(false, true, true, true)
    expect(result.effectiveTier).toBe('pro')
    expect(result.isPro).toBe(true)
    expect(result.isQaProSimulation).toBe(true)
    expect(result.snapMonthlyLimit).toBe(12)
    expect(result.expandedIngredientUnlimited).toBe(true)
  })

  test('Real Pro + QA OFF → Pro', () => {
    const result = computeEffectivePlanAccess(true, true, false, false)
    expect(result.effectiveTier).toBe('pro')
    expect(result.isPro).toBe(true)
    expect(result.isQaProSimulation).toBe(false)
    expect(result.snapMonthlyLimit).toBe(12)
    expect(result.expandedIngredientUnlimited).toBe(true)
  })

  test('Real Pro + QA ON → Pro (not QA simulation)', () => {
    const result = computeEffectivePlanAccess(true, true, true, true)
    expect(result.effectiveTier).toBe('pro')
    expect(result.isPro).toBe(true)
    expect(result.isQaProSimulation).toBe(false)
    expect(result.snapMonthlyLimit).toBe(12)
  })

  test('realTier is always the real RevenueCat state', () => {
    const result = computeEffectivePlanAccess(false, true, true, true)
    expect(result.realIsPro).toBe(false)
    expect(result.realTier).toBe('free')
  })

  test('Developer tools disabled → QA override impossible', () => {
    const result = computeEffectivePlanAccess(false, true, true, false)
    expect(result.isPro).toBe(false)
    expect(result.isQaProSimulation).toBe(false)
    expect(result.effectiveTier).toBe('free')
    expect(result.snapMonthlyLimit).toBe(1)
  })

  test('Entitlement not initialized + QA ON → Pro (forced init)', () => {
    const result = computeEffectivePlanAccess(false, false, true, true)
    expect(result.isPro).toBe(true)
    expect(result.entitlementInitialized).toBe(true)
    expect(result.effectiveTier).toBe('pro')
  })
})
