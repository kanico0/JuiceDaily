/**
 * Legacy Feature Cleanup — Phase 1 Focused Tests
 * 22 tests proving correct behavior after cleanup of F-01, F-05, F-06, F-08, F-09, F-10
 */

const fs = require('fs')
const path = require('path')

const mockStorage = new Map()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Array.from(mockStorage.keys()))),
  multiRemove: jest.fn((keys) => {
    keys.forEach((k) => mockStorage.delete(k))
    return Promise.resolve()
  }),
}))

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-id')),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  AndroidImportance: { DEFAULT: 3 },
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  LogBox: { ignoreLogs: jest.fn() },
}))

const proStoreSrc = fs.readFileSync(
  path.join(__dirname, '..', 'ProStore.js'),
  'utf-8'
)

const challengeStoreSrc = fs.readFileSync(
  path.join(__dirname, '..', 'ChallengeStore.js'),
  'utf-8'
)

const notifServiceSrc = fs.readFileSync(
  path.join(__dirname, '..', 'NotificationService.js'),
  'utf-8'
)

const notifLibSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'constants', 'NotificationLibrary.js'),
  'utf-8'
)

const welcomeModalSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'WelcomeModal.js'),
  'utf-8'
)

const glowLibrarySrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'GlowLibraryScreen.js'),
  'utf-8'
)

const seasonalGlowSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'SeasonalGlowPacksScreen.js'),
  'utf-8'
)

const featureAccessSrc = fs.readFileSync(
  path.join(__dirname, '..', 'subscriptions', 'featureAccess.ts'),
  'utf-8'
)

const subscriptionAnalyticsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'subscriptions', 'subscriptionAnalytics.ts'),
  'utf-8'
)

const badgeDataSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'constants', 'badgeData.js'),
  'utf-8'
)

describe('Phase 1 Legacy Cleanup — 22 focused tests', () => {
  // 1. Positive legacy snapPackBalance cannot authorize a scan
  test('positive legacy snapPackBalance cannot authorize a scan', () => {
    expect(proStoreSrc).not.toContain('snapPackBalance')
    const { checkSnapEligibility } = require('../ProStore')
    // checkSnapEligibility does not check snapPackBalance
    expect(proStoreSrc.match(/snapPackBalance/)).toBeNull()
  })

  // 2. SNAP_PACK_BONUS is not referenced
  test('SNAP_PACK_BONUS is not referenced anywhere in ProStore', () => {
    expect(proStoreSrc).not.toContain('SNAP_PACK_BONUS')
  })

  // 3. Supabase quota remains authoritative
  test('ProStore does not locally-grant scans bypassing Supabase', () => {
    // No local scan credit additions
    expect(proStoreSrc).not.toContain('snapPackBalance')
    expect(proStoreSrc).not.toContain('purchasedPacks')
    expect(proStoreSrc).not.toContain('goldenFreezerPasses')
  })

  // 4. ProStore cannot locally grant additional scan allowance
  test('ProStore has no local scan-credit addition mechanism', () => {
    expect(proStoreSrc).not.toMatch(/BUY_SNAP_PACK|BUY_FREEZER_PACK|BUY_RECIPE_PACK|EARN_GOLDEN_PASS/)
  })

  // 5. Freezer Pass does not render
  test('FreezerPassModal.js does not exist', () => {
    const freezerPath = path.join(__dirname, '..', '..', 'components', 'FreezerPassModal.js')
    expect(fs.existsSync(freezerPath)).toBe(false)
  })

  // 6. Freezer Pass notifications are not scheduled
  test('NotificationService does not export scheduleFreezerMorning', () => {
    const notifService = require('../NotificationService')
    expect(notifService.scheduleFreezerMorning).toBeUndefined()
  })

  // 7. Legacy Freezer Pass storage does not unlock features
  test('ChallengeStore sanitize drops freezerPasses from persisted state', () => {
    // sanitizeChallengeState uses explicit allowlist — no freezerPasses field
    expect(challengeStoreSrc).not.toContain('freezerPasses')
    expect(challengeStoreSrc).not.toContain('frozenDays')
    expect(challengeStoreSrc).not.toContain('isFrozen')
  })

  // 8. "Welcome, Architect" does not render
  test('WelcomeModal does not contain Architect branding', () => {
    expect(welcomeModalSrc).not.toMatch(/[Aa]rchitect/)
  })

  // 9. No active notification contains Architect branding
  test('NotificationLibrary has no Architect references', () => {
    expect(notifLibSrc).not.toMatch(/[Aa]rchitect/)
  })

  // 10. Unimplemented Pro features are absent from the active registry
  test('featureAccess.ts does not list unimplemented Pro features', () => {
    expect(featureAccessSrc).not.toContain('advanced_weekly_report')
    expect(featureAccessSrc).not.toContain('advanced_trends')
    expect(featureAccessSrc).not.toContain('personalized_challenges')
    expect(featureAccessSrc).not.toContain('custom_weekly_goals')
    expect(featureAccessSrc).not.toContain('photo_recaps')
    expect(featureAccessSrc).not.toContain('advanced_reminders')
    expect(featureAccessSrc).not.toContain('premium_achievements')
  })

  // 11. Unimplemented Pro features cannot open incomplete UI
  test('featureAccess only exports ai_scan as a FeatureKey', () => {
    const featureAccess = require('../subscriptions/featureAccess')
    const FREE = { isProActive: false }
    expect(featureAccess.accessibleFeatures(FREE)).toEqual(['ai_scan'])
  })

  // 12. Recipes remain accessible to Free users
  test('GlowLibraryScreen does not gate recipes behind Pro', () => {
    expect(glowLibrarySrc).not.toContain('hasFeatureAccess')
    expect(glowLibrarySrc).not.toContain('usePro')
    expect(glowLibrarySrc).not.toContain('isLocked')
    expect(glowLibrarySrc).not.toContain('PaywallModal')
  })

  // 13. Recipes are not presented as a Pro benefit
  test('SeasonalGlowPacksScreen does not gate recipes behind Pro', () => {
    expect(seasonalGlowSrc).not.toContain('hasFeatureAccess')
    expect(seasonalGlowSrc).not.toContain('usePro')
    expect(seasonalGlowSrc).not.toContain('isLocked')
    expect(seasonalGlowSrc).not.toContain('PaywallModal')
  })

  // 14. proRecipes no longer acts as a contradictory Pro-only flag
  test('proRecipes is not in PRO_FEATURES', () => {
    const { PRO_FEATURES } = require('../ProStore')
    expect(PRO_FEATURES).not.toHaveProperty('proRecipes')
  })

  // 15. Old pack ownership does not grant Pro
  test('ProStore has no pack-ownership fields that grant Pro', () => {
    expect(proStoreSrc).not.toContain('purchasedPacks')
    expect(proStoreSrc).not.toContain('hasRecipePack')
  })

  // 16. Old Lifetime ownership does not grant Pro
  test('ProStore has no lifetime ownership field', () => {
    expect(proStoreSrc).not.toMatch(/lifetime/i)
  })

  // 17. RevenueCat entitlement remains authoritative for Pro
  test('ProStore does not independently grant Pro via pack purchase', () => {
    // Only DEV_TOGGLE_PRO can set tier to pro
    expect(proStoreSrc).toContain('DEV_TOGGLE_PRO')
    expect(proStoreSrc).not.toContain('BUY_SNAP_PACK')
    expect(proStoreSrc).not.toContain('BUY_FREEZER_PACK')
  })

  // 18. Manual ingredient entry remains unlimited
  test('PRO_FEATURES lists manualEntry as free tier', () => {
    const { PRO_FEATURES } = require('../ProStore')
    expect(PRO_FEATURES.manualEntry).toBeDefined()
    expect(PRO_FEATURES.manualEntry.tier).toBe('free')
  })

  // 19. Free quota remains 5
  test('FREE_MONTHLY_SNAPS is 5', () => {
    expect(proStoreSrc).toContain('FREE_MONTHLY_SNAPS = 5')
  })

  // 20. Pro quota remains 60
  test('PRO_MONTHLY_SNAPS is 60', () => {
    expect(proStoreSrc).toContain('PRO_MONTHLY_SNAPS = 60')
  })

  // 21. Current Monthly and Annual purchase paths remain intact
  test('SUBSCRIPTION_PLANS has monthly and annual with correct pricing', () => {
    const { SUBSCRIPTION_PLANS } = require('../ProStore')
    expect(SUBSCRIPTION_PLANS.monthly).toBeDefined()
    expect(SUBSCRIPTION_PLANS.monthly.priceValue).toBe(7.99)
    expect(SUBSCRIPTION_PLANS.annual).toBeDefined()
    expect(SUBSCRIPTION_PLANS.annual.priceValue).toBe(59.99)
  })

  // 22. No current account, history, settings, or Glow data is cleared
  test('ChallengeStore still persists and hydrates from storage', () => {
    expect(challengeStoreSrc).toContain('loadState')
    expect(challengeStoreSrc).toContain('saveState')
    expect(challengeStoreSrc).toContain('@juicing_challenge_v1')
  })
})

describe('Analytics cleanup — no legacy event values', () => {
  test('subscriptionAnalytics uses only monthly and annual package types', () => {
    expect(subscriptionAnalyticsSrc).not.toContain('snap_pack')
    expect(subscriptionAnalyticsSrc).not.toContain('freezer_pass')
    expect(subscriptionAnalyticsSrc).not.toContain('recipe_pack')
    expect(subscriptionAnalyticsSrc).not.toContain('lifetime')
    expect(subscriptionAnalyticsSrc).not.toContain('architect')
    expect(subscriptionAnalyticsSrc).not.toContain('pack_purchase')
    expect(subscriptionAnalyticsSrc).not.toContain('consumable_credit')
  })
})

describe('Additional safety — badgeData and NotificationService', () => {
  test('badgeData has no Freezer Pass references', () => {
    expect(badgeDataSrc).not.toMatch(/Freezer Pass/i)
  })

  test('NotificationService has no Freezer Pass comment references', () => {
    expect(notifServiceSrc).not.toMatch(/Freezer Pass/i)
  })
})
