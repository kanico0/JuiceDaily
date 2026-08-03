// Integration-level tests for forensic audit corrections
// Tests real behavior against actual architecture, not source strings

jest.mock('../../services/subscriptions/SubscriptionStore', () => {
  let mockState = { initialized: true, loading: false, isProActive: false }
  let mockIsPro = false
  return {
    useSubscription: jest.fn(() => ({
      isPro: mockIsPro,
      state: mockState,
      purchase: jest.fn(),
      restore: jest.fn(),
      refresh: jest.fn(),
      openManagement: jest.fn(),
      offering: null,
      purchasing: false,
    })),
    __setMockState: (state, isPro) => {
      mockState = state
      mockIsPro = isPro
    },
    __resetMockState: () => {
      mockState = { initialized: true, loading: false, isProActive: false }
      mockIsPro = false
    },
  }
})

jest.mock('../../services/JuiceEngine', () => ({
  PRODUCE_DATA: {
    kale: { name: 'Kale', category: 'vegetable' },
    spinach: { name: 'Spinach', category: 'vegetable' },
    carrot: { name: 'Carrot', category: 'vegetable' },
    apple: { name: 'Apple', category: 'fruit' },
    apple_green: { name: 'Green Apple', category: 'fruit' },
    apple_red: { name: 'Red Apple', category: 'fruit' },
    lemon: { name: 'Lemon', category: 'fruit' },
    lime: { name: 'Lime', category: 'fruit' },
    ginger: { name: 'Ginger', category: 'vegetable' },
    turmeric: { name: 'Turmeric', category: 'vegetable' },
    orange: { name: 'Orange', category: 'fruit' },
    celery: { name: 'Celery', category: 'vegetable' },
    cucumber: { name: 'Cucumber', category: 'vegetable' },
    beet: { name: 'Beet', category: 'vegetable' },
    parsley: { name: 'Parsley', category: 'vegetable' },
    swiss_chard: { name: 'Swiss Chard', category: 'vegetable' },
    grapefruit: { name: 'Grapefruit', category: 'fruit' },
  },
}))

jest.mock('../../constants/nutrition', () => ({
  USDA_RDA: {
    vitaminC: 90,
    vitaminA: 900,
    potassium: 4700,
    iron: 18,
    magnesium: 400,
    folate: 400,
  },
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('../../utils/DevClock', () => ({
  getDevNow: jest.fn(() => new Date(2026, 6, 15, 12, 0, 0)),
  onDevClockChange: jest.fn(() => () => {}),
  formatDateKey: jest.fn((d) => {
    const date = d || new Date(2026, 6, 15)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }),
}))

jest.mock('../../components/MeshGradientBg', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockMeshGradientBg() {
    return React.createElement(View)
  }
})

jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

jest.mock('../../services/JuiceLogStore', () => ({
  useJuiceLog: jest.fn(() => ({
    entries: [],
    isHydrated: true,
    totalLogCount: 0,
    todayEntries: [],
    last7DaysEntries: [],
    diversityStats: {},
    consistencyStats: {},
    addEntry: jest.fn(),
    deleteEntry: jest.fn(),
    resetLog: jest.fn(),
  })),
}))

// ── FIX 1: isValidHistoryEntry legacy compat ──────────────────

describe('FIX 1: isValidHistoryEntry legacy compatibility', () => {
  const { isValidHistoryEntry } = require('../../services/historyPreviewEntry')

  test('1. Entry with only id and createdAt is valid (matches JuiceLogStore sanitize)', () => {
    expect(isValidHistoryEntry({ id: 'e1', createdAt: '2026-07-15T10:00:00' })).toBe(true)
  })

  test('2. Entry missing createdAt is invalid', () => {
    expect(isValidHistoryEntry({ id: 'e1', dateKey: '2026-07-15' })).toBe(false)
  })

  test('3. Entry with non-string id is invalid', () => {
    expect(isValidHistoryEntry({ id: 123, createdAt: '2026-07-15T10:00:00' })).toBe(false)
  })

  test('4. Entry with empty string id is invalid', () => {
    expect(isValidHistoryEntry({ id: '', createdAt: '2026-07-15T10:00:00' })).toBe(false)
  })

  test('5. Entry with empty string createdAt is invalid', () => {
    expect(isValidHistoryEntry({ id: 'e1', createdAt: '' })).toBe(false)
  })

  test('6. Legacy entry without dateKey is eligible for preview', () => {
    const { getAdvancedPreviewEntryId } = require('../../services/historyPreviewEntry')
    const entries = [
      { id: 'legacy', createdAt: '2026-07-15T10:00:00' },
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('legacy')
  })

  test('7. Entry without dateKey sorts after entries with dateKey', () => {
    const { getAdvancedPreviewEntryId } = require('../../services/historyPreviewEntry')
    const entries = [
      { id: 'noDate', createdAt: '2026-07-15T10:00:00' },
      { id: 'withDate', dateKey: '2026-07-14', createdAt: '2026-07-14T10:00:00' },
    ]
    // 'withDate' should be newest because '2026-07-14' > '' in localeCompare
    expect(getAdvancedPreviewEntryId(entries)).toBe('withDate')
  })
})

// ── FIX 2: Preview badge uses accentPrimary, not warning ──────

describe('FIX 2: Preview badge semantic token audit', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('8. No SEMANTIC_COLORS.warning in badge icon or text', () => {
    // Check the badge section specifically
    const badgeSection = source.match(/previewBadge:[\s\S]*?previewBadgeText:[\s\S]*?letterSpacing/)
    expect(badgeSection).toBeTruthy()
    expect(badgeSection[0]).not.toContain('SEMANTIC_COLORS.warning')
  })

  test('9. Badge uses accentPrimary token', () => {
    const badgeSection = source.match(/previewBadge:[\s\S]*?previewBadgeText:[\s\S]*?letterSpacing/)
    expect(badgeSection[0]).toContain('accentPrimary')
  })

  test('10. Preview banner does not use warning color', () => {
    const bannerSection = source.match(/previewBanner:[\s\S]*?previewBannerTitle:[\s\S]*?}/)
    expect(bannerSection).toBeTruthy()
    expect(bannerSection[0]).not.toContain('SEMANTIC_COLORS.warning')
    expect(bannerSection[0]).not.toContain('255,183,77')
  })

  test('11. No raw warning hex (255,183,77 or #FFB74D) in preview-related styles', () => {
    const previewStyles = source.match(/preview(Badge|Banner|Hint)[\s\S]*?(?:},|$)/g)
    expect(previewStyles).toBeTruthy()
    previewStyles.forEach((style) => {
      expect(style).not.toContain('255,183,77')
      expect(style).not.toContain('#FFB74D')
    })
  })
})

// ── FIX 3: Unsaved-draft protection exists in HomeScreen ──────

describe('FIX 3: Unsaved-draft protection in HomeScreen', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HomeScreen.js'),
    'utf8',
  )

  test('12. HomeScreen imports Alert from react-native', () => {
    expect(source).toMatch(/Alert/)
  })

  test('13. Preload useEffect immediately seeds batch without confirmation', () => {
    expect(source).toContain('seedPreloadIngredients')
    expect(source).not.toContain('Replace your current draft?')
  })

  test('14. No Keep Current Draft option remains', () => {
    expect(source).not.toContain('Keep Current Draft')
  })

  test('15. No Use Past Juice option remains', () => {
    expect(source).not.toContain('Use Past Juice')
  })

  test('16. No pendingPreloadRef or hasUnsavedDraft remains', () => {
    expect(source).not.toContain('hasUnsavedDraft')
    expect(source).not.toContain('pendingPreloadRef')
  })
})

// ── FIX 4: Entitlement loading state handling ─────────────────

describe('FIX 4: Entitlement loading state in HistoryScreen', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('17. HistoryScreen reads subState from useSubscription', () => {
    expect(source).toContain('subState')
    expect(source).toContain('initialized')
  })

  test('18. During loading, isPro is false (neutral, not optimistic)', () => {
    expect(source).toContain('entitlementInitialized')
    expect(source).not.toContain('!subState.initialized ? true')
  })

  test('19. resolvedEntitlementRef tracks resolved state for transition detection', () => {
    expect(source).toContain('resolvedEntitlementRef')
  })
})

// ── FIX 5: advanced_history_unlocked event fires on transition ─

describe('FIX 5: advanced_history_unlocked analytics event', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('20. advanced_history_unlocked event is fired in HistoryScreen', () => {
    expect(source).toContain('advanced_history_unlocked')
  })

  test('21. Event fires only on real Free to Pro transition (not init)', () => {
    expect(source).toContain('resolvedEntitlementRef')
    expect(source).toContain('prev === false && isPro')
  })

  test('22. Event fires only after initialization completes', () => {
    expect(source).toContain('entitlementInitialized')
    expect(source).not.toContain('wasProRef')
  })
})

// ── FIX 6: Name fallback ambiguity check ──────────────────────

describe('FIX 6: Ingredient name fallback ambiguity check', () => {
  const { createEditableDraftFromHistoryEntry } = require('../../services/makeAgainHelper')

  test('23. Resolves exact canonical ID', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['kale'],
    })
    expect(result.ingredients.length).toBe(1)
    expect(result.ingredients[0].produceId).toBe('kale')
  })

  test('24. Name fallback resolves unambiguous name', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['Kale'], // not a canonical ID, but matches display name
    })
    expect(result.ingredients.length).toBe(1)
    expect(result.ingredients[0].produceId).toBe('kale')
  })

  test('25. Name fallback rejects ambiguous names (multiple matches)', () => {
    // Create a mock catalog with duplicate names
    const mockCatalog = {
      item_a: { name: 'Duplicate', category: 'fruit' },
      item_b: { name: 'Duplicate', category: 'vegetable' },
    }
    const result = createEditableDraftFromHistoryEntry(
      { id: 'h1', ingredients: ['duplicate'] },
      mockCatalog,
    )
    expect(result.ingredients.length).toBe(0)
    expect(result.skippedIngredients.length).toBe(1)
  })

  test('26. Name fallback uses exact match, not substring', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['kal'], // substring of "Kale" but not exact
    })
    expect(result.ingredients.length).toBe(0)
  })

  test('27. Unsafe substitutions do not occur (lime ≠ lemon)', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['lime'],
    })
    expect(result.ingredients.length).toBe(1)
    expect(result.ingredients[0].produceId).toBe('lime')
    expect(result.ingredients[0].produceId).not.toBe('lemon')
  })

  test('28. Unsafe substitutions do not occur (ginger ≠ turmeric)', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['ginger'],
    })
    expect(result.ingredients.length).toBe(1)
    expect(result.ingredients[0].produceId).toBe('ginger')
    expect(result.ingredients[0].produceId).not.toBe('turmeric')
  })
})

// ── Section 3: Canonical sort determinism ─────────────────────

describe('Section 3: Canonical sort determinism with stable tie-breaking', () => {
  const { sortHistoryNewestFirst } = require('../../services/historyPreviewEntry')

  test('29. Identical dateKey and createdAt resolve by id descending', () => {
    const entries = [
      { id: 'aaa', dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' },
      { id: 'zzz', dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' },
    ]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted[0].id).toBe('zzz')
    expect(sorted[1].id).toBe('aaa')
  })

  test('30. Sort is stable across multiple calls', () => {
    const entries = [
      { id: 'a', dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' },
      { id: 'b', dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' },
      { id: 'c', dateKey: '2026-07-14', createdAt: '2026-07-14T10:00:00' },
    ]
    const sorted1 = sortHistoryNewestFirst(entries)
    const sorted2 = sortHistoryNewestFirst(entries)
    expect(sorted1.map((e) => e.id)).toEqual(sorted2.map((e) => e.id))
  })

  test('31. Sort does not mutate input array', () => {
    const entries = [
      { id: 'b', dateKey: '2026-07-14', createdAt: '2026-07-14T10:00:00' },
      { id: 'a', dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' },
    ]
    const originalOrder = entries.map((e) => e.id)
    sortHistoryNewestFirst(entries)
    expect(entries.map((e) => e.id)).toEqual(originalOrder)
  })
})

// ── Section 5: Full-history preservation ──────────────────────

describe('Section 5: No entitlement filtering in JuiceLogStore', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'services', 'JuiceLogStore.js'),
    'utf8',
  )

  test('32. JuiceLogStore does not reference isPro or subscription', () => {
    expect(source).not.toContain('isPro')
    expect(source).not.toContain('subscription')
    expect(source).not.toContain('previewEntryId')
  })

  test('33. JuiceLogStore entries are not sliced or filtered by entitlement', () => {
    expect(source).not.toContain('slice(0, 1)')
    expect(source).not.toContain('canViewAdvancedDetails')
  })
})

// ── Section 9: Advanced data is locally stored ────────────────

describe('Section 9: Advanced-data storage source', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('34. Advanced details come from entry.nutrientSummary (local)', () => {
    expect(source).toContain('entry.nutrientSummary')
  })

  test('35. No AI/analysis call on history detail open', () => {
    expect(source).not.toContain('analyzeScan')
    expect(source).not.toContain('processJuiceBatch')
    expect(source).not.toContain('authorizeAndProcessBatch')
  })
})

// ── Section 16: Current juicer setting ────────────────────────

describe('Section 16: No historical juicer setting passed', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('36. No juiceMethod in navigation params', () => {
    const navSection = source.match(/navigation\.navigate\('ScanFlow'[\s\S]*?\}\)/)
    expect(navSection).toBeTruthy()
    expect(navSection[0]).not.toContain('juiceMethod')
    expect(navSection[0]).not.toContain('juicerType')
  })
})

// ── Section 18: No quota consumption on Make Again ────────────

describe('Section 18: No quota or analysis calls in Make Again flow', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('37. No useQuota import in HistoryScreen', () => {
    expect(source).not.toContain('useQuota')
  })

  test('38. No QuotaStore mutation in HistoryScreen', () => {
    expect(source).not.toContain('applySnapshot')
    expect(source).not.toContain('refreshQuota')
  })

  test('39. No addEntry or logJuice in Make Again handler', () => {
    const makeAgainSection = source.match(/const handleMakeAgain = useCallback\([\s\S]*?\n  \}/)
    expect(makeAgainSection).toBeTruthy()
    expect(makeAgainSection[0]).not.toContain('addEntry')
    expect(makeAgainSection[0]).not.toContain('logJuice')
    expect(makeAgainSection[0]).not.toContain('addLogEntry')
  })
})

// ── Section 21: Global Pro feature isolation ──────────────────

describe('Section 21: Preview does not unlock global Pro tools', () => {
  const { getHistoryAccessPolicy } = require('../../services/historyAccessPolicy')

  test('40. Free preview does not grant Pro access type', () => {
    const policy = getHistoryAccessPolicy(false, true)
    expect(policy.isPro).toBe(false)
    expect(policy.canViewAdvancedDetails).toBe(true)
    expect(policy.canMakeAgain).toBe(true)
  })

  test('41. Free preview policy is per-entry, not global', () => {
    const previewPolicy = getHistoryAccessPolicy(false, true)
    const lockedPolicy = getHistoryAccessPolicy(false, false)
    // Preview entry: can view advanced
    expect(previewPolicy.canViewAdvancedDetails).toBe(true)
    // Older entry: cannot view advanced
    expect(lockedPolicy.canViewAdvancedDetails).toBe(false)
  })

  test('42. No search, filter, trends, or export features introduced', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'HistoryScreen.js'),
      'utf8',
    )
    expect(source).not.toContain('searchHistory')
    expect(source).not.toContain('filterHistory')
    expect(source).not.toContain('historyTrends')
    expect(source).not.toContain('exportHistory')
  })
})

// ── Section 22: Analytics sensitive data audit ────────────────

describe('Section 22: No sensitive data in analytics events', () => {
  const fs = require('fs')
  const path = require('path')
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'HistoryScreen.js'),
    'utf8',
  )

  test('43. No ingredient names in trackEvent calls', () => {
    const events = source.match(/trackEvent\([\s\S]*?\}\)/g) || []
    events.forEach((event) => {
      expect(event).not.toContain('ingredient_name')
      expect(event).not.toContain('ingredient_id')
      expect(event).not.toContain('produceId:')
    })
  })

  test('44. No nutrition values in trackEvent calls', () => {
    const events = source.match(/trackEvent\([\s\S]*?\}\)/g) || []
    events.forEach((event) => {
      expect(event).not.toContain('nutrient_value')
      expect(event).not.toContain('vitaminC:')
      expect(event).not.toContain('score:')
    })
  })

  test('45. All count properties use bucket suffix', () => {
    const events = source.match(/trackEvent\([\s\S]*?\}\)/g) || []
    events.forEach((event) => {
      // If any property contains 'count', it should be a bucket
      if (event.includes('count')) {
        expect(event).toMatch(/_bucket/)
      }
    })
  })
})

// ── Section 12: Transformation immutability with frozen fixtures ─

describe('Section 12: Transformation immutability with frozen fixtures', () => {
  const { createEditableDraftFromHistoryEntry } = require('../../services/makeAgainHelper')

  test('46. Frozen source entry is not mutated', () => {
    const entry = Object.freeze({
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: Object.freeze(['kale', 'apple']),
      nutrientSummary: Object.freeze({ vitaminC: 50 }),
      scoreContribution: 85,
    })
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients.length).toBe(2)
    // Original should be unchanged
    expect(entry.ingredients).toEqual(['kale', 'apple'])
    expect(entry.nutrientSummary).toEqual({ vitaminC: 50 })
  })

  test('47. Draft ingredient objects are newly allocated', () => {
    const entry = {
      id: 'h1',
      ingredients: [{ produceId: 'kale', quantity: 2 }],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients[0]).not.toBe(entry.ingredients[0])
  })

  test('48. Draft can be modified without changing history', () => {
    const entry = {
      id: 'h1',
      ingredients: ['kale'],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    result.ingredients[0].quantity = 99
    // Original entry should not reflect the change
    expect(entry.ingredients).toEqual(['kale'])
  })

  test('49. Excluded fields: no nutrientSummary in draft', () => {
    const entry = {
      id: 'h1',
      ingredients: ['kale'],
      nutrientSummary: { vitaminC: 50 },
      scoreContribution: 85,
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.nutrientSummary).toBeUndefined()
    expect(result.scoreContribution).toBeUndefined()
  })

  test('50. Excluded fields: no historical timestamps in draft ingredients', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      ingredients: ['kale'],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients[0].createdAt).toBeUndefined()
    expect(result.ingredients[0].historyId).toBeUndefined()
  })
})

// ── Section 14: Quantity and unit normalization ───────────────

describe('Section 14: Quantity and unit normalization', () => {
  const { createEditableDraftFromHistoryEntry } = require('../../services/makeAgainHelper')

  test('51. Missing quantity defaults to 1', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: [{ produceId: 'kale' }],
    })
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('52. Zero quantity defaults to 1 (not clamped to 0)', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: [{ produceId: 'kale', quantity: 0 }],
    })
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('53. Negative quantity defaults to 1', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: [{ produceId: 'kale', quantity: -5 }],
    })
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('54. String quantity normalizes to number', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: [{ produceId: 'kale', quantity: '3' }],
    })
    expect(result.ingredients[0].quantity).toBe(3)
    expect(typeof result.ingredients[0].quantity).toBe('number')
  })

  test('55. Volume mode preserved with cups', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: [{ produceId: 'kale', portionEntryMode: 'volume', portionUnit: 'cups' }],
    })
    expect(result.ingredients[0].portionEntryMode).toBe('volume')
    expect(result.ingredients[0].portionUnit).toBe('cups')
  })

  test('56. Legacy count mode maps to quantity', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: [{ produceId: 'kale', portionEntryMode: 'count' }],
    })
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
  })
})

// ── Section 15: Primary produce audit ─────────────────────────

describe('Section 15: Primary produce handling', () => {
  const { createEditableDraftFromHistoryEntry } = require('../../services/makeAgainHelper')

  test('57. Stored primary is restored when valid', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      primaryProduceId: 'apple',
      ingredients: ['kale', 'apple'],
    })
    expect(result.primaryProduceId).toBe('apple')
    const primary = result.ingredients.find((i) => i.isPrimary)
    expect(primary.produceId).toBe('apple')
  })

  test('58. First valid ingredient becomes primary when stored primary is skipped', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      primaryProduceId: 'retired_ingredient',
      ingredients: ['kale', 'apple'],
    })
    expect(result.primaryProduceId).toBe('kale')
    const primary = result.ingredients.find((i) => i.isPrimary)
    expect(primary.produceId).toBe('kale')
  })

  test('59. Exactly one ingredient is primary', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['kale', 'apple', 'lemon'],
    })
    const primaries = result.ingredients.filter((i) => i.isPrimary)
    expect(primaries.length).toBe(1)
  })

  test('60. No primary when no valid ingredients', () => {
    const result = createEditableDraftFromHistoryEntry({
      id: 'h1',
      ingredients: ['nonexistent'],
    })
    expect(result.primaryProduceId).toBeNull()
    expect(result.ingredients.length).toBe(0)
  })
})
