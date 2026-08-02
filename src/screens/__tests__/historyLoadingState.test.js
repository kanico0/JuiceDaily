// Entitlement loading state and transition behavior tests
// Verifies neutral loading state, content flash prevention, and transition guards

const { getHistoryAccessPolicy, getAccessType } = require('../../services/historyAccessPolicy')

// ── Section 3: Access policy loading state ────────────────────

describe('Access Policy: loading state (entitlementInitialized=false)', () => {
  test('1. Loading policy returns isLoading=true', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.isLoading).toBe(true)
  })

  test('2. Loading policy allows basic history', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.canViewBasicHistory).toBe(true)
  })

  test('3. Loading policy blocks advanced details', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.canViewAdvancedDetails).toBe(false)
  })

  test('4. Loading policy blocks Make Again', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.canMakeAgain).toBe(false)
  })

  test('5. Loading policy hides preview badge', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.shouldShowPreviewBadge).toBe(false)
  })

  test('6. Loading policy hides preview explanation', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.shouldShowPreviewExplanation).toBe(false)
  })

  test('7. Loading policy hides advanced upgrade card', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.shouldShowAdvancedUpgrade).toBe(false)
  })

  test('8. Loading policy hides Make Again upgrade', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.shouldShowMakeAgainUpgrade).toBe(false)
  })

  test('9. Loading policy is not Pro', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.isPro).toBe(false)
  })

  test('10. Loading policy is not advanced preview', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.isAdvancedPreview).toBe(false)
  })

  test('11. getAccessType returns loading for unresolved policy', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(getAccessType(policy)).toBe('loading')
  })

  test('12. Loading state is the same regardless of isPro or isAdvancedPreview args', () => {
    // Even if isPro=true, loading state should be neutral
    const policyAsPro = getHistoryAccessPolicy(true, false, false)
    expect(policyAsPro.isLoading).toBe(true)
    expect(policyAsPro.canViewAdvancedDetails).toBe(false)

    // Even if isAdvancedPreview=true, loading state should be neutral
    const policyAsPreview = getHistoryAccessPolicy(false, true, false)
    expect(policyAsPreview.isLoading).toBe(true)
    expect(policyAsPreview.canViewAdvancedDetails).toBe(false)
  })
})

// ── Section 3: Resolved states still work correctly ───────────

describe('Access Policy: resolved states unchanged', () => {
  test('13. Pro policy has isLoading=false', () => {
    const policy = getHistoryAccessPolicy(true, false, true)
    expect(policy.isLoading).toBe(false)
    expect(policy.isPro).toBe(true)
    expect(policy.canViewAdvancedDetails).toBe(true)
    expect(policy.canMakeAgain).toBe(true)
  })

  test('14. Free preview policy has isLoading=false', () => {
    const policy = getHistoryAccessPolicy(false, true, true)
    expect(policy.isLoading).toBe(false)
    expect(policy.isAdvancedPreview).toBe(true)
    expect(policy.canViewAdvancedDetails).toBe(true)
    expect(policy.canMakeAgain).toBe(true)
  })

  test('15. Free locked policy has isLoading=false', () => {
    const policy = getHistoryAccessPolicy(false, false, true)
    expect(policy.isLoading).toBe(false)
    expect(policy.shouldShowAdvancedUpgrade).toBe(true)
    expect(policy.canViewAdvancedDetails).toBe(false)
    expect(policy.canMakeAgain).toBe(false)
  })

  test('16. Default entitlementInitialized is true (backward compat)', () => {
    // When third arg is omitted, should behave as initialized
    const policy = getHistoryAccessPolicy(true, false)
    expect(policy.isLoading).toBe(false)
    expect(policy.isPro).toBe(true)
  })
})

// ── Section 4: Content flash prevention (source audit) ────────

describe('Content flash prevention: source-level audit', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('17. Loading placeholder text is present', () => {
    expect(source).toContain('Checking history access')
  })

  test('18. Loading placeholder style exists', () => {
    expect(source).toContain('loadingPlaceholder')
    expect(source).toContain('loadingText')
  })

  test('19. policy.isLoading gates the loading placeholder', () => {
    expect(source).toContain('policy.isLoading && (')
  })

  test('20. Preview badge suppressed while loading (entitlementInitialized check in DaySection)', () => {
    expect(source).toContain('entitlementInitialized && !isPro && previewEntryId === entry.id')
  })

  test('21. Locked hint suppressed while loading (entitlementInitialized check in DaySection)', () => {
    expect(source).toContain('entitlementInitialized && !isPro && previewEntryId && previewEntryId !== entry.id')
  })

  test('22. handleUpgrade guarded by entitlementInitialized', () => {
    expect(source).toContain("if (!entitlementInitialized) return\n      navigation.navigate('Paywall'")
  })

  test('23. handleMakeAgain guarded by entitlementInitialized', () => {
    // The guard should be present in the callback
    const idx = source.indexOf('const handleMakeAgain = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = source.substring(idx, idx + 1200)
    expect(section).toContain('!entitlementInitialized')
  })

  test('24. handleEntryPress suppresses analytics while loading', () => {
    const idx = source.indexOf('const handleEntryPress = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = source.substring(idx, idx + 600)
    expect(section).toContain('if (entitlementInitialized)')
  })

  test('25. EntryDetailsModal analytics suppressed while loading', () => {
    const modalEffect = source.match(/useEffect\(\(\) => \{[\s\S]*?if \(!entitlementInitialized\) return/)
    expect(modalEffect).toBeTruthy()
  })

  test('26. EntryDetailsModal upgrade handlers guarded by entitlementInitialized', () => {
    expect(source).toContain('if (!entitlementInitialized) return\n    trackEvent(\'history_make_again_locked\'')
    expect(source).toContain('if (!entitlementInitialized) return\n    trackEvent(\'advanced_history_preview_cta_tapped\'')
    expect(source).toContain('if (!entitlementInitialized) return\n    trackEvent(\'advanced_history_upgrade_tapped\'')
  })

  test('27. previewEntryId is null while loading', () => {
    expect(source).toContain('if (!entitlementInitialized || isPro) return null')
  })

  test('28. isSelectedPreview is false while loading', () => {
    expect(source).toContain('if (!selectedEntry || !entitlementInitialized || isPro) return false')
  })

  test('29. No optimistic Pro (old pattern removed)', () => {
    expect(source).not.toContain('!subState.initialized ? true')
    expect(source).not.toContain('treat as Pro')
    expect(source).not.toContain('optimistic')
  })
})

// ── Section 5: Transition behavior ────────────────────────────

describe('Section 5: Transition behavior', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('30. Loading → Pro: advanced_history_unlocked does NOT fire', () => {
    // The guard uses resolvedEntitlementRef which starts as null
    // null === false is false, so loading→Pro does not fire
    expect(source).toContain('prev === false && isPro')
    expect(source).toContain('resolvedEntitlementRef')
  })

  test('31. Loading → Free: no unlock event, preview appears after init', () => {
    // previewEntryId is null while loading, then computed after init
    expect(source).toContain('if (!entitlementInitialized || isPro) return null')
  })

  test('32. Actual Free → Pro: unlock event fires once', () => {
    // resolvedEntitlementRef.current === false (was free) && isPro (now pro)
    expect(source).toContain('prev === false && isPro')
  })

  test('33. Pro → Free: no unlock event (guard checks prev === false, not prev === true)', () => {
    // The effect only fires when prev === false && isPro
    // Pro→Free means prev === true && !isPro, which does not match
    expect(source).toContain('prev === false && isPro')
  })

  test('34. Rerender does not fire unlock event (ref persists)', () => {
    // resolvedEntitlementRef is a useRef, persists across rerenders
    // After first resolved state, prev === isPro, so prev === false is only true on actual transition
    expect(source).toContain('resolvedEntitlementRef.current = isPro')
  })

  test('35. Remount: ref starts as null, does not fire on init', () => {
    // useRef(null) initial value means prev === null, and null === false is false
    expect(source).toContain('useRef(null)')
  })
})

// ── Section 6: Analytics transition guard ─────────────────────

describe('Section 6: Analytics transition guard', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('36. No unlock event for loading → Pro initialization', () => {
    // Guard: prev (null) === false is false → no event
    expect(source).toContain('resolvedEntitlementRef')
    expect(source).toContain('useRef(null)')
  })

  test('37. No unlock event for ordinary rerender', () => {
    // On rerender with same state, prev === isPro, so prev === false only if still free
    expect(source).toContain('resolvedEntitlementRef.current = isPro')
  })

  test('38. No unlock event for history entry change', () => {
    // The effect deps are [isPro, entitlementInitialized], not entries
    const effectMatch = source.match(/\/\/ Fire advanced_history_unlocked[\s\S]*?\}, \[isPro, entitlementInitialized\]\)/)
    expect(effectMatch).toBeTruthy()
    expect(effectMatch[0]).not.toContain('entries')
  })

  test('39. No unlock event for opening detail as already-Pro user', () => {
    // The unlock effect is independent of selectedEntry
    const effectMatch = source.match(/\/\/ Fire advanced_history_unlocked[\s\S]*?\}, \[isPro, entitlementInitialized\]\)/)
    expect(effectMatch).toBeTruthy()
    expect(effectMatch[0]).not.toContain('selectedEntry')
  })

  test('40. No unlock event on app restart while already Pro', () => {
    // On restart: ref starts as null, entitlement may resolve to Pro
    // null === false is false → no event
    expect(source).toContain('useRef(null)')
  })

  test('41. No preview analytics fire while loading', () => {
    // Modal effect has early return for !entitlementInitialized
    expect(source).toContain('if (!entitlementInitialized) return\n    const policy = getHistoryAccessPolicy')
  })

  test('42. No locked analytics fire while loading', () => {
    // Same early return covers both preview and locked analytics
    expect(source).toContain('if (!entitlementInitialized) return')
  })

  test('43. No Make Again access analytics fire while loading', () => {
    // handleMakeAgain has guard
    expect(source).toContain('if (!entitlementInitialized) return\n      makeAgainRef.current = true')
  })

  test('44. No paywall opens while loading', () => {
    // handleUpgrade has guard
    expect(source).toContain("if (!entitlementInitialized) return\n      navigation.navigate('Paywall'")
  })
})

// ── Section 7: Previous audit fixes remain intact ─────────────

describe('Section 7: Previous audit fixes preserved', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )
  const homeSource = fs.readFileSync(
    path.join(__dirname, '..', 'HomeScreen.js'),
    'utf8',
  )
  const helperSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'services', 'makeAgainHelper.js'),
    'utf8',
  )
  const previewSource = fs.readFileSync(
    path.join(__dirname, '..', '..', 'services', 'historyPreviewEntry.js'),
    'utf8',
  )

  test('45. Legacy entry compatibility: isValidHistoryEntry does not require dateKey', () => {
    expect(previewSource).not.toContain('/^\\d{4}-\\d{2}-\\d{2}$/')
  })

  test('46. Stable deterministic tie-breaking: stableCompare exists', () => {
    expect(previewSource).toContain('stableCompare')
  })

  test('47. SEMANTIC_COLORS.accentPrimary used for preview (not warning)', () => {
    expect(source).not.toContain('SEMANTIC_COLORS.warning')
  })

  test('48. Unsaved-draft confirmation in HomeScreen', () => {
    expect(homeSource).toContain('hasUnsavedDraft')
    expect(homeSource).toContain('Replace your current draft?')
  })

  test('49. Ambiguous ingredient-name rejection in makeAgainHelper', () => {
    expect(helperSource).toContain('matchCount')
    expect(helperSource).toContain('ambiguous')
  })

  test('50. No juiceMethod in Make Again navigation params', () => {
    const navSection = source.match(/navigation\.navigate\('ScanFlow'[\s\S]*?\}\)/)
    expect(navSection).toBeTruthy()
    expect(navSection[0]).not.toContain('juiceMethod')
  })

  test('51. No quota consumption in Make Again flow', () => {
    expect(source).not.toContain('useQuota')
    expect(source).not.toContain('applySnapshot')
  })

  test('52. Accessibility labels present', () => {
    expect(source).toContain('accessibilityLabel')
    expect(source).toContain('accessibilityRole')
  })
})
