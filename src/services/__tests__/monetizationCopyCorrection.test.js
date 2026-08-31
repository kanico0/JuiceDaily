// monetizationCopyCorrection.test.js — Tests for corrected Pro history
// copy, snap quota copy, and lifetime plan removal.
//
// Verifies:
// 1. Pro-selling surfaces say "Full Advanced History" (not "Advanced History Preview")
// 2. SnapGateModal says "1 Free Snap" (not "3 Free Snaps")
// 3. SnapGateModal says "4 AI Snaps each month" (not "unlimited AI scanning")
// 4. scan-quota anonymous display shows limit: 1 (not limit: 5)
// 5. No active lifetime plan in SUBSCRIPTION_PLANS
// 6. No lifetime in VaultScreen PLAN_KEYS
// 7. No lifetime in PaywallModal PLAN_KEYS
// 8. No stale "5 Free" or "60 Pro" in active source
// 9. Advanced Blend Free = 3 lifetime is preserved (NOT removed)

const fs = require('fs')
const path = require('path')

const paywallScreenPath = path.resolve(__dirname, '../../screens/PaywallScreen.js')
const paywallScreenSource = fs.readFileSync(paywallScreenPath, 'utf8')

const paywallModalPath = path.resolve(__dirname, '../../components/PaywallModal.js')
const paywallModalSource = fs.readFileSync(paywallModalPath, 'utf8')

const vaultScreenPath = path.resolve(__dirname, '../../screens/VaultScreen.js')
const vaultScreenSource = fs.readFileSync(vaultScreenPath, 'utf8')

const proStorePath = path.resolve(__dirname, '../../services/ProStore.js')
const proStoreSource = fs.readFileSync(proStorePath, 'utf8')

const snapGateModalPath = path.resolve(__dirname, '../../components/SnapGateModal.js')
const snapGateModalSource = fs.readFileSync(snapGateModalPath, 'utf8')

const scanQuotaPath = path.resolve(__dirname, '../../../supabase/functions/scan-quota/index.ts')
const scanQuotaSource = fs.readFileSync(scanQuotaPath, 'utf8')

const blendAllowancePath = path.resolve(__dirname, '../../services/quota/blendAllowanceService.ts')
const blendAllowanceSource = fs.readFileSync(blendAllowancePath, 'utf8')

describe('Pro history copy correction', () => {
  it('1. PaywallScreen says "Full Detailed History" not "Advanced History Preview"', () => {
    expect(paywallScreenSource).toMatch(/Full Detailed History/)
    expect(paywallScreenSource).not.toMatch(/'Advanced History Preview'/)
  })

  it('2. PaywallModal says "Full Detailed History" not "Advanced History Preview"', () => {
    expect(paywallModalSource).toMatch(/Full Detailed History/)
    expect(paywallModalSource).not.toMatch(/text: 'Advanced History Preview'/)
  })

  it('3. VaultScreen says "Full Detailed History" not "Advanced History Preview"', () => {
    expect(vaultScreenSource).toMatch(/Full Detailed History/)
    expect(vaultScreenSource).not.toMatch(/text: 'Advanced History Preview'/)
  })

  it('4. ProStore PRO_FEATURES says "Full Detailed History"', () => {
    expect(proStoreSource).toMatch(/Full Detailed History/)
    expect(proStoreSource).not.toMatch(/label: 'Advanced History Preview'/)
  })
})

describe('Snap quota copy correction', () => {
  it('5. SnapGateModal says "introductory Free AI Snap" not "3 Free Snaps"', () => {
    expect(snapGateModalSource).toMatch(/introductory Free AI Snap/)
    expect(snapGateModalSource).not.toMatch(/3 Free Snaps/)
  })

  it('6. SnapGateModal says "4 AI Snaps each month" not "unlimited AI scanning"', () => {
    expect(snapGateModalSource).toMatch(/4 AI Snaps each month/)
    expect(snapGateModalSource).not.toMatch(/unlimited AI scanning/)
  })

  it('7. scan-quota anonymous display shows limit: 1 not limit: 5', () => {
    // Find the anonymous block by slicing from is_anonymous to the
    // end of the anonymous if block (next non-anonymous resolve_quota)
    const anonStart = scanQuotaSource.indexOf('is_anonymous === true')
    expect(anonStart).toBeGreaterThan(-1)
    // The anonymous block now queries resolve_quota internally.
    // Find the end by looking for the non-anonymous resolve_quota call
    // (the one after the anonymous if block closes).
    const afterAnon = scanQuotaSource.indexOf('const { data, error } = await admin.rpc', anonStart)
    const anonEnd = afterAnon > -1 ? afterAnon : scanQuotaSource.length
    const anonBlock = scanQuotaSource.slice(anonStart, anonEnd)
    // The anonymous block must not show limit: 5
    expect(anonBlock).not.toMatch(/limit:\s*5/)
    expect(anonBlock).not.toMatch(/remaining:\s*5/)
    // The primary success path uses aLimit || 1 (dynamic from database)
    expect(anonBlock).toMatch(/aLimit \|\| 1/)
    // The error fallback returns quota:null (unknown), NOT used:0/remaining:1
    expect(anonBlock).toMatch(/quota: null/)
    // Must NOT have hardcoded used:0 in fallback paths
    expect(anonBlock).not.toMatch(/used:\s*0/)
  })
})

describe('Lifetime plan removal', () => {
  it('8. SUBSCRIPTION_PLANS does NOT contain lifetime', () => {
    expect(proStoreSource).not.toMatch(/pro_lifetime/)
    expect(proStoreSource).not.toMatch(/lifetime:\s*\{/)
  })

  it('9. VaultScreen PLAN_KEYS does NOT contain lifetime', () => {
    const planKeysMatch = vaultScreenSource.match(/PLAN_KEYS\s*=\s*\[([^\]]+)\]/)
    expect(planKeysMatch).toBeTruthy()
    expect(planKeysMatch[1]).not.toMatch(/lifetime/)
  })

  it('10. PaywallModal PLAN_KEYS does NOT contain lifetime', () => {
    const planKeysMatch = paywallModalSource.match(/PLAN_KEYS\s*=\s*\[([^\]]+)\]/)
    expect(planKeysMatch).toBeTruthy()
    expect(planKeysMatch[1]).not.toMatch(/lifetime/)
  })

  it('11. VaultScreen does not show "Lifetime access" text', () => {
    expect(vaultScreenSource).not.toMatch(/Lifetime access/)
  })

  it('12. ProStore reducer does not handle lifetime expiry', () => {
    expect(proStoreSource).not.toMatch(/plan === 'lifetime'/)
  })
})

describe('Advanced Blend lifetime preserved (NOT removed)', () => {
  it('13. Advanced Blend Free allowance = 3 lifetime is preserved', () => {
    expect(blendAllowanceSource).toMatch(/FREE_ADVANCED_BLEND_ALLOWANCE\s*=\s*3/)
  })

  it('14. classifyBlend uses 5+ ingredient threshold', () => {
    expect(blendAllowanceSource).toMatch(/SIMPLE_BLEND_MAX_INGREDIENTS\s*=\s*4/)
    expect(blendAllowanceSource).toMatch(/distinctIngredientCount >= 5/)
  })
})

describe('No stale quota values in active source', () => {
  it('15. ProStore does not say "Unlimited AI Snaps" as a feature', () => {
    expect(proStoreSource).not.toMatch(/Unlimited AI Snaps/)
  })

  it('16. PaywallScreen does not say "Unlimited AI Snaps"', () => {
    expect(paywallScreenSource).not.toMatch(/Unlimited AI Snaps/)
  })

  it('17. PaywallModal does not say "Unlimited AI Snaps"', () => {
    expect(paywallModalSource).not.toMatch(/Unlimited AI Snaps/)
  })

  it('18. VaultScreen does not say "Unlimited AI Snaps"', () => {
    expect(vaultScreenSource).not.toMatch(/Unlimited AI Snaps/)
  })
})

describe('No stale "60 scans" in Settings or Home', () => {
  const settingsScreenPath = path.resolve(__dirname, '../../screens/SettingsScreen.js')
  const settingsScreenSource = fs.readFileSync(settingsScreenPath, 'utf8')

  const homeScreenPath = path.resolve(__dirname, '../../screens/HomeScreen.js')
  const homeScreenSource = fs.readFileSync(homeScreenPath, 'utf8')

  it('19. SettingsScreen does not say "60 AI scans"', () => {
    expect(settingsScreenSource).not.toMatch(/60 AI scans/)
  })

  it('20. SettingsScreen says "4 AI Snaps per month" for Pro upgrade', () => {
    expect(settingsScreenSource).toMatch(/4 AI Snaps per month/)
  })

  it('21. HomeScreen does not say "60 scans"', () => {
    expect(homeScreenSource).not.toMatch(/60 scans/)
  })

  it('22. HomeScreen says "4 AI Snaps" for Pro upgrade', () => {
    expect(homeScreenSource).toMatch(/4 AI Snaps/)
  })
})
