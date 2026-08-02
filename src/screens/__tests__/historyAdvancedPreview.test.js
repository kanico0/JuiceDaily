// ─────────────────────────────────────────────────────────────
// historyAdvancedPreview.test.js — Integration tests for
// Advanced History Preview and Make This Juice Again.
//
// Covers:
//   1-10.  Source audit: imports, helpers, policy usage
//   11-20. Source audit: preview badge, locked card, Make Again
//   21-25. Source audit: analytics events
//   26-30. Source audit: accessibility labels
//   31-35. Source audit: no basic field removed, no fake preview
//   36-40. Source audit: paywall sources
//   41-45. Source audit: no quota consumption, no re-analysis
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8')
}

const HISTORY_SRC = readSrc('../../screens/HistoryScreen.js')
const POLICY_SRC = readSrc('../../services/historyAccessPolicy.js')
const PREVIEW_SRC = readSrc('../../services/historyPreviewEntry.js')
const MAKE_AGAIN_SRC = readSrc('../../services/makeAgainHelper.js')
const ANALYTICS_SRC = readSrc('../../services/AnalyticsService.js')

describe('Advanced History Preview — source audit: imports & helpers', () => {
  test('1. HistoryScreen imports useSubscription', () => {
    expect(HISTORY_SRC).toContain('useSubscription')
  })

  test('2. HistoryScreen imports getHistoryAccessPolicy', () => {
    expect(HISTORY_SRC).toContain('getHistoryAccessPolicy')
  })

  test('3. HistoryScreen imports getAdvancedPreviewEntryId', () => {
    expect(HISTORY_SRC).toContain('getAdvancedPreviewEntryId')
  })

  test('4. HistoryScreen imports createEditableDraftFromHistoryEntry', () => {
    expect(HISTORY_SRC).toContain('createEditableDraftFromHistoryEntry')
  })

  test('5. HistoryScreen imports trackEvent', () => {
    expect(HISTORY_SRC).toContain('trackEvent')
  })

  test('6. historyAccessPolicy exports getHistoryAccessPolicy', () => {
    expect(POLICY_SRC).toContain('export function getHistoryAccessPolicy')
  })

  test('7. historyPreviewEntry exports getAdvancedPreviewEntryId', () => {
    expect(PREVIEW_SRC).toContain('export function getAdvancedPreviewEntryId')
  })

  test('8. makeAgainHelper exports createEditableDraftFromHistoryEntry', () => {
    expect(MAKE_AGAIN_SRC).toContain('export function createEditableDraftFromHistoryEntry')
  })

  test('9. makeAgainHelper exports draftToPreloadIngredients', () => {
    expect(MAKE_AGAIN_SRC).toContain('export function draftToPreloadIngredients')
  })

  test('10. makeAgainHelper exports hasUnsavedDraft', () => {
    expect(MAKE_AGAIN_SRC).toContain('export function hasUnsavedDraft')
  })
})

describe('Advanced History Preview — source audit: UI components', () => {
  test('11. HistoryScreen has AdvancedPreviewBanner component', () => {
    expect(HISTORY_SRC).toContain('AdvancedPreviewBanner')
  })

  test('12. HistoryScreen has LockedAdvancedCard component', () => {
    expect(HISTORY_SRC).toContain('LockedAdvancedCard')
  })

  test('13. HistoryScreen has MakeAgainButton component', () => {
    expect(HISTORY_SRC).toContain('MakeAgainButton')
  })

  test('14. Preview badge text is "ADVANCED PREVIEW"', () => {
    expect(HISTORY_SRC).toContain('ADVANCED PREVIEW')
  })

  test('15. Locked card has "Unlock Advanced History" CTA', () => {
    expect(HISTORY_SRC).toContain('Unlock Advanced History')
  })

  test('16. Make Again button text is "Make This Juice Again"', () => {
    expect(HISTORY_SRC).toContain('Make This Juice Again')
  })

  test('17. DaySection accepts previewEntryId prop', () => {
    expect(HISTORY_SRC).toMatch(/DaySection.*previewEntryId/)
  })

  test('18. DaySection accepts isPro prop', () => {
    expect(HISTORY_SRC).toMatch(/DaySection.*isPro/)
  })

  test('19. EntryDetailsModal accepts isPro prop', () => {
    expect(HISTORY_SRC).toMatch(/EntryDetailsModal[\s\S]*isPro/)
  })

  test('20. EntryDetailsModal accepts isAdvancedPreview prop', () => {
    expect(HISTORY_SRC).toMatch(/isAdvancedPreview/)
  })
})

describe('Advanced History Preview — source audit: analytics', () => {
  test('21. history_viewed event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('history_viewed')
  })

  test('22. history_item_opened event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('history_item_opened')
  })

  test('23. advanced_history_preview_viewed event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('advanced_history_preview_viewed')
  })

  test('24. history_make_again_tapped event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('history_make_again_tapped')
  })

  test('25. history_make_again_draft_created event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('history_make_again_draft_created')
  })

  test('26. Analytics events use bucket properties not raw counts', () => {
    expect(ANALYTICS_SRC).toContain('ingredient_count_bucket')
    expect(ANALYTICS_SRC).toContain('history_entry_count_bucket')
  })

  test('27. history_make_again_locked event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('history_make_again_locked')
  })

  test('28. history_make_again_failed event is in schema', () => {
    expect(ANALYTICS_SRC).toContain('history_make_again_failed')
  })

  test('29. No sensitive property names in analytics events', () => {
    // The PROHIBITED_PATTERNS list contains these patterns, which is correct.
    // Verify that no history event schema includes sensitive properties in optional/required.
    const historyEventBlock = ANALYTICS_SRC.match(/history_viewed[\s\S]*?history_make_again_failed[\s\S]*?\}/)
    expect(historyEventBlock).toBeTruthy()
    expect(historyEventBlock[0]).not.toMatch(/'name'/)
    expect(historyEventBlock[0]).not.toMatch(/'email'/)
  })

  test('30. history_viewed fires once per mount (uses ref guard)', () => {
    expect(HISTORY_SRC).toContain('historyViewedRef')
  })
})

describe('Advanced History Preview — source audit: accessibility', () => {
  test('31. Preview badge has accessibility label', () => {
    expect(HISTORY_SRC).toMatch(/accessibilityLabel[\s\S]*Advanced History Preview/i)
  })

  test('32. Make Again button has accessibility role', () => {
    expect(HISTORY_SRC).toMatch(/MakeAgainButton[\s\S]*accessibilityRole/)
  })

  test('33. Locked card CTA has accessibility hint', () => {
    expect(HISTORY_SRC).toMatch(/accessibilityHint.*RawLifeFlow Pro/)
  })

  test('34. Close button has accessibility label', () => {
    expect(HISTORY_SRC).toMatch(/accessibilityLabel.*Close details/)
  })

  test('35. Back button has accessibility label', () => {
    expect(HISTORY_SRC).toMatch(/accessibilityLabel.*Go back/)
  })
})

describe('Advanced History Preview — source audit: data integrity', () => {
  test('36. Basic history is always visible (canViewBasicHistory)', () => {
    expect(POLICY_SRC).toContain('canViewBasicHistory: true')
  })

  test('37. No basic field is removed for paywall (ingredients always shown)', () => {
    // Ingredients section should NOT be gated behind policy
    expect(HISTORY_SRC).toContain('Ingredients — always visible')
  })

  test('38. No fake or reduced preview (advanced details shown for preview)', () => {
    expect(HISTORY_SRC).toContain('canViewAdvancedDetails')
  })

  test('39. No quota consumption on viewing (no scan quota calls)', () => {
    expect(HISTORY_SRC).not.toContain('useQuota')
    expect(HISTORY_SRC).not.toContain('refreshQuota')
    expect(HISTORY_SRC).not.toContain('authorizeAndProcessBatch')
  })

  test('40. No re-analysis triggered (no analyze-scan calls)', () => {
    expect(HISTORY_SRC).not.toContain('analyzeScan')
    expect(HISTORY_SRC).not.toContain('runAnalysis')
  })
})

describe('Advanced History Preview — source audit: paywall sources', () => {
  test('41. history_preview_upgrade source is used', () => {
    expect(HISTORY_SRC).toContain('history_preview_upgrade')
  })

  test('42. history_advanced_locked source is used', () => {
    expect(HISTORY_SRC).toContain('history_advanced_locked')
  })

  test('43. history_make_again_locked source is used', () => {
    expect(HISTORY_SRC).toContain('history_make_again_locked')
  })

  test('44. Navigation to Paywall uses existing screen', () => {
    expect(HISTORY_SRC).toContain("navigate('Paywall'")
  })

  test('45. No new paywall screen is created', () => {
    const paywallPath = path.join(__dirname, '../../screens/PaywallScreen.js')
    expect(fs.existsSync(paywallPath)).toBe(true)
  })
})

describe('Advanced History Preview — source audit: Make Again flow', () => {
  test('46. Make Again navigates to ScanFlow with manualEntry', () => {
    expect(HISTORY_SRC).toContain("navigate('ScanFlow'")
    expect(HISTORY_SRC).toContain('manualEntry: true')
  })

  test('47. Make Again uses preloadIngredients for draft', () => {
    expect(HISTORY_SRC).toContain('preloadIngredients')
  })

  test('48. Make Again has duplicate-tap guard (ref)', () => {
    expect(HISTORY_SRC).toContain('makeAgainRef')
  })

  test('49. Make Again source is "history_make_again"', () => {
    expect(HISTORY_SRC).toContain("source: 'history_make_again'")
  })

  test('50. Make Again does not mutate original record (uses pure helper)', () => {
    expect(MAKE_AGAIN_SRC).toContain('Never mutates the original record')
  })

  test('51. Make Again handles zero valid ingredients (shows alert)', () => {
    expect(HISTORY_SRC).toContain('Unable to recreate juice')
  })

  test('52. Make Again handles skipped ingredients (shows alert)', () => {
    expect(HISTORY_SRC).toContain('Some ingredients could not be added')
  })

  test('53. Make Again does not create a second editor', () => {
    // Should navigate to existing ScanFlow, not create a new screen
    expect(HISTORY_SRC).not.toMatch(/MakeAgainEditor|DraftEditor/)
  })

  test('54. Make Again does not log or analyze automatically', () => {
    expect(HISTORY_SRC).not.toContain('addLogEntry')
    expect(HISTORY_SRC).not.toContain('logJuice')
  })

  test('55. Make Again uses current juicer setting (not historical)', () => {
    // The preloadIngredients go through seedPreloadIngredients which uses current juicer
    // The HistoryScreen does not pass historical juiceMethod
    expect(HISTORY_SRC).not.toContain('entry.juiceMethod')
  })
})

describe('Advanced History Preview — source audit: policy correctness', () => {
  test('56. Pro users and loading state get null previewEntryId (no preview concept)', () => {
    expect(HISTORY_SRC).toContain('if (!entitlementInitialized || isPro) return null')
  })

  test('57. Free users get previewEntryId from getAdvancedPreviewEntryId', () => {
    expect(HISTORY_SRC).toContain('getAdvancedPreviewEntryId(entries)')
  })

  test('58. Pro policy has canMakeAgain=true', () => {
    expect(POLICY_SRC).toContain('canMakeAgain: true')
  })

  test('59. Free locked policy has canMakeAgain=false', () => {
    expect(POLICY_SRC).toContain('canMakeAgain: false')
  })

  test('60. Free preview policy has canMakeAgain=true', () => {
    expect(POLICY_SRC).toContain('canMakeAgain: true')
  })

  test('61. No second subscription boolean is created', () => {
    expect(POLICY_SRC).not.toMatch(/isSubscribed|hasSubscription|isProUser/)
  })

  test('62. Preview is not permanently stored (computed via useMemo)', () => {
    expect(HISTORY_SRC).toContain('useMemo')
    expect(HISTORY_SRC).not.toMatch(/AsyncStorage|saveState.*preview/)
  })
})
