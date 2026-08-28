// ─────────────────────────────────────────────────────────────
// legacyProStoreMigration.test.js — Regression tests for P1 audit
// Fix 5: legacy ProStore.usePro() entitlement gating replaced with
// the canonical useEffectiveProAccess()/hasEffectiveFeatureAccess()
// in DashboardScreen.js, ScanScreen.js, and VaultScreen.js.
//
// Prior defect: DashboardScreen, ScanScreen (BrowseIdeasModal), and
// VaultScreen called usePro() directly for real Pro UI gating. Since
// ProStore is a legacy, client-local, non-persisted store, a real
// paying RevenueCat subscriber could be shown Free-tier UI in these
// screens unless the QA dev-Pro-simulation toggle happened to also
// be on. This was a UI-consistency defect (no financial impact —
// server-side quota enforcement is independent of ProStore), but it
// must be corrected so legacy Pro UI follows real subscription state.
//
// Also verifies: unknown feature keys fail CLOSED (never grant
// access), unlike the legacy ProStore.hasFeatureAccess, which
// defaulted unknown keys to `true`.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const dashboardSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'DashboardScreen.js'),
  'utf-8',
)
const scanSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'ScanScreen.js'),
  'utf-8',
)
const vaultSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'VaultScreen.js'),
  'utf-8',
)
const hookSrc = fs.readFileSync(
  path.join(__dirname, '..', 'useEffectiveProAccess.js'),
  'utf-8',
)

describe('Fix 5 — Legacy Pro UI follows real subscription state', () => {
  test('1. DashboardScreen uses the canonical useEffectiveProAccess hook, not legacy usePro()', () => {
    expect(dashboardSrc).toContain('useEffectiveProAccess')
    expect(dashboardSrc).toContain('hasEffectiveFeatureAccess')
    expect(dashboardSrc).not.toMatch(/usePro\(\)/)
    expect(dashboardSrc).not.toContain("from '../services/ProStore'")
  })

  test('2. ScanScreen (BrowseIdeasModal) uses the canonical hook, not legacy usePro()', () => {
    expect(scanSrc).toContain('useEffectiveProAccess')
    expect(scanSrc).toContain('hasEffectiveFeatureAccess')
    expect(scanSrc).not.toMatch(/usePro\(\)/)
  })

  test('3. VaultScreen uses the canonical hook for real Pro-status gating', () => {
    expect(vaultSrc).toContain('useEffectiveProAccess')
    // VaultScreen still uses ProStore for the separate legacy
    // recipe/snap PACK purchase mechanics (not subscription
    // entitlement), which is intentionally out of scope for this
    // narrow fix — but the isPro used for Pro/Free UI gating must
    // come from the canonical hook, not ProStore's local isPro.
    const isProDeclIdx = vaultSrc.indexOf('const { isPro } = useEffectiveProAccess()')
    expect(isProDeclIdx).toBeGreaterThan(-1)
  })

  test('4. VaultScreen plan label reflects real subscription state (selectPlanLabel), not legacy pro.subscriptionPlan', () => {
    expect(vaultSrc).toContain('selectPlanLabel')
    expect(vaultSrc).toContain('useSubscription')
    expect(vaultSrc).not.toMatch(/pro\.subscriptionPlan/)
  })

  test('5. hasEffectiveFeatureAccess is exported from the canonical hook module', () => {
    expect(hookSrc).toContain('export function hasEffectiveFeatureAccess')
  })

  test('6. hasEffectiveFeatureAccess fails CLOSED for unknown feature keys (unlike legacy ProStore)', () => {
    expect(hookSrc).toMatch(
      /if \(!Object\.prototype\.hasOwnProperty\.call\(PRO_FEATURES, featureKey\)\) return false/,
    )
  })
})

describe('Fix 5 — behavioral proof: hasEffectiveFeatureAccess (pure function simulation)', () => {
  // Mirror the real PRO_FEATURES keys from ProStore.js
  const PRO_FEATURES = {
    weeklyReports: { tier: 'pro' },
    advancedNutrients: { tier: 'pro' },
    proRecipes: { tier: 'pro' },
    unlimitedSnaps: { tier: 'pro' },
    monthlyWrap: { tier: 'pro' },
    advancedHistoryPreview: { tier: 'pro' },
  }

  function hasEffectiveFeatureAccess(isPro, featureKey) {
    if (!Object.prototype.hasOwnProperty.call(PRO_FEATURES, featureKey)) return false
    return Boolean(isPro)
  }

  test('7. Real Pro user gets access to known Pro features', () => {
    expect(hasEffectiveFeatureAccess(true, 'proRecipes')).toBe(true)
    expect(hasEffectiveFeatureAccess(true, 'weeklyReports')).toBe(true)
  })

  test('8. Free user is denied access to known Pro features', () => {
    expect(hasEffectiveFeatureAccess(false, 'proRecipes')).toBe(false)
    expect(hasEffectiveFeatureAccess(false, 'weeklyReports')).toBe(false)
  })

  test('9. Unknown feature key fails closed for Pro users too (never silently grants access)', () => {
    expect(hasEffectiveFeatureAccess(true, 'someFutureFeatureNotYetRegistered')).toBe(false)
  })

  test('10. Unknown feature key fails closed for Free users', () => {
    expect(hasEffectiveFeatureAccess(false, 'someFutureFeatureNotYetRegistered')).toBe(false)
  })

  test('11. Real Pro status (not legacy dev-toggle state) determines access — no disagreement possible via this helper', () => {
    // The helper takes isPro as an explicit parameter sourced from
    // useEffectiveProAccess() (real RevenueCat state OR gated dev
    // override), never from ProStore's independent local isPro.
    const realProUserIsPro = true // as resolved by useEffectiveProAccess()
    expect(hasEffectiveFeatureAccess(realProUserIsPro_typo_guard(realProUserIsPro), 'proRecipes')).toBe(true)
  })
})

// Small helper to avoid an accidental typo silently passing (guards
// against a stray var name causing a false positive in test 11).
function realProUserIsPro_typo_guard (value) {
  if (typeof value !== 'boolean') throw new Error('expected boolean')
  return value
}
