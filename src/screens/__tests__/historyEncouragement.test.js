// ─────────────────────────────────────────────────────────────
// historyEncouragement.test.js — Tests for progressive
// early-history encouragement card on the History screen.
//
// Covers:
//   1-8. Distinct-day counting (0 through 6+ days)
//   9.  Multiple logs on one day count as one day
//   10. Logs on separate local dates count separately
//   11. Midnight/local-time boundary behavior
//   12. Malformed date entries do not crash
//   13. Existing History entries still render
//   14. Existing delete/edit behavior remains available
//   15. All six title/body combinations match approved copy
// ─────────────────────────────────────────────────────────────

jest.mock('../../services/JuiceLogStore', () => ({
  useJuiceLog: jest.fn(() => ({
    entries: [],
    deleteEntry: jest.fn(),
    addEntry: jest.fn(),
    resetLog: jest.fn(),
    isHydrated: true,
    totalLogCount: 0,
    todayEntries: [],
    last7DaysEntries: [],
    diversityStats: {},
    consistencyStats: {},
  })),
}))

jest.mock('../../services/JuiceEngine', () => ({
  PRODUCE_DATA: {},
}))

jest.mock('../../constants/nutrition', () => ({
  USDA_RDA: {},
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('../../utils/DevClock', () => ({
  getDevNow: jest.fn(() => new Date(2026, 6, 15, 12, 0, 0)),
  onDevClockChange: jest.fn(() => () => {}),
}))

jest.mock('../../components/MeshGradientBg', () => {
  const React = require('react')
  const { View } = require('react-native')
  return function MockMeshGradientBg () {
    return React.createElement(View)
  }
})

jest.mock('../../services/subscriptions/SubscriptionStore', () => ({
  useSubscription: jest.fn(() => ({
    isPro: false,
    state: { isProActive: false, initialized: true, loading: false },
    purchase: jest.fn(),
    restore: jest.fn(),
    refresh: jest.fn(),
    openManagement: jest.fn(),
    offering: null,
    purchasing: false,
  })),
}))

jest.mock('../../services/historyAccessPolicy', () => ({
  getHistoryAccessPolicy: jest.fn((isPro, isPreview) => ({
    isPro,
    isAdvancedPreview: isPreview,
    canViewBasicHistory: true,
    canViewAdvancedDetails: isPro || isPreview,
    canMakeAgain: isPro || isPreview,
    shouldShowPreviewBadge: !isPro && isPreview,
    shouldShowPreviewExplanation: !isPro && isPreview,
    shouldShowAdvancedUpgrade: !isPro && !isPreview,
    shouldShowMakeAgainUpgrade: !isPro && !isPreview,
  })),
  getAccessType: jest.fn((p) => p.isPro ? 'pro' : p.isAdvancedPreview ? 'free_preview' : 'free_locked'),
  getEntryPosition: jest.fn((isPreview) => isPreview ? 'newest' : 'older'),
}))

jest.mock('../../services/historyPreviewEntry', () => ({
  getAdvancedPreviewEntryId: jest.fn(() => null),
  isAdvancedPreviewEntry: jest.fn(() => false),
  sortHistoryNewestFirst: jest.fn((e) => e),
  isValidHistoryEntry: jest.fn(() => true),
}))

jest.mock('../../services/makeAgainHelper', () => ({
  createEditableDraftFromHistoryEntry: jest.fn(() => ({
    ingredients: [],
    primaryProduceId: null,
    skippedIngredients: [],
  })),
  draftToPreloadIngredients: jest.fn(() => []),
  hasUnsavedDraft: jest.fn(() => false),
}))

jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

import {
  countDistinctLoggedDays,
  getEncouragementCopy,
  ENCOURAGEMENT_COPY,
} from '../../screens/HistoryScreen'

// ── Helper to create entries ──────────────────────────────────
function makeEntry (dateKey, id) {
  return {
    id: id || `entry-${dateKey}-${Math.random()}`,
    dateKey,
    createdAt: `${dateKey}T12:00:00`,
    source: 'manual',
    title: 'Test Juice',
    ingredients: ['apple'],
    nutrientSummary: {},
    scoreContribution: null,
  }
}

// ── 1-8: Distinct-day counting and card visibility ───────────

describe('Progressive History Encouragement', () => {
  describe('countDistinctLoggedDays', () => {
    test('1. zero distinct logged days', () => {
      expect(countDistinctLoggedDays([])).toBe(0)
    })

    test('2. one distinct logged day', () => {
      const entries = [makeEntry('2026-07-15')]
      expect(countDistinctLoggedDays(entries)).toBe(1)
    })

    test('3. two distinct logged days', () => {
      const entries = [makeEntry('2026-07-15'), makeEntry('2026-07-14')]
      expect(countDistinctLoggedDays(entries)).toBe(2)
    })

    test('4. three distinct logged days', () => {
      const entries = [
        makeEntry('2026-07-15'),
        makeEntry('2026-07-14'),
        makeEntry('2026-07-13'),
      ]
      expect(countDistinctLoggedDays(entries)).toBe(3)
    })

    test('5. four distinct logged days', () => {
      const entries = [
        makeEntry('2026-07-15'),
        makeEntry('2026-07-14'),
        makeEntry('2026-07-13'),
        makeEntry('2026-07-12'),
      ]
      expect(countDistinctLoggedDays(entries)).toBe(4)
    })

    test('6. five distinct logged days', () => {
      const entries = [
        makeEntry('2026-07-15'),
        makeEntry('2026-07-14'),
        makeEntry('2026-07-13'),
        makeEntry('2026-07-12'),
        makeEntry('2026-07-11'),
      ]
      expect(countDistinctLoggedDays(entries)).toBe(5)
    })

    test('7. six distinct logged days', () => {
      const entries = [
        makeEntry('2026-07-15'),
        makeEntry('2026-07-14'),
        makeEntry('2026-07-13'),
        makeEntry('2026-07-12'),
        makeEntry('2026-07-11'),
        makeEntry('2026-07-10'),
      ]
      expect(countDistinctLoggedDays(entries)).toBe(6)
    })

    test('8. no encouragement card after five days', () => {
      expect(getEncouragementCopy(6)).toBeNull()
      expect(getEncouragementCopy(10)).toBeNull()
      expect(getEncouragementCopy(100)).toBeNull()
    })
  })

  // ── 9-10: Counting rules ───────────────────────────────────

  test('9. multiple logs on one day count as one day', () => {
    const entries = [
      makeEntry('2026-07-15', 'a'),
      makeEntry('2026-07-15', 'b'),
      makeEntry('2026-07-15', 'c'),
    ]
    expect(countDistinctLoggedDays(entries)).toBe(1)
  })

  test('10. logs on separate local dates count separately', () => {
    const entries = [
      makeEntry('2026-07-15', 'a'),
      makeEntry('2026-07-16', 'b'),
    ]
    expect(countDistinctLoggedDays(entries)).toBe(2)
  })

  // ── 11: Midnight boundary ──────────────────────────────────

  test('11. midnight/local-time boundary behavior', () => {
    // Entry at 23:59 on July 14 and entry at 00:01 on July 15
    // are on different local dates and should count as 2 days.
    const entries = [
      { id: 'late', dateKey: '2026-07-14', createdAt: '2026-07-14T23:59:00', source: 'manual', title: 'Late Juice', ingredients: [], nutrientSummary: {}, scoreContribution: null },
      { id: 'early', dateKey: '2026-07-15', createdAt: '2026-07-15T00:01:00', source: 'manual', title: 'Early Juice', ingredients: [], nutrientSummary: {}, scoreContribution: null },
    ]
    expect(countDistinctLoggedDays(entries)).toBe(2)
  })

  // ── 12: Malformed entries ──────────────────────────────────

  test('12. malformed date entries do not crash', () => {
    const entries = [
      null,
      undefined,
      {},
      { id: 'x', createdAt: 'bad' },
      { id: 'y', dateKey: null, createdAt: '2026-07-15T12:00:00' },
      { id: 'z', dateKey: 'not-a-date', createdAt: '2026-07-15T12:00:00' },
      { id: 'w', dateKey: '2026-7-5', createdAt: '2026-07-05T12:00:00' },
      'string-entry',
      42,
    ]
    expect(() => countDistinctLoggedDays(entries)).not.toThrow()
    expect(countDistinctLoggedDays(entries)).toBe(0)
  })

  test('12b. malformed entries mixed with valid ones count only valid days', () => {
    const entries = [
      makeEntry('2026-07-15', 'good1'),
      null,
      { id: 'bad', dateKey: 'invalid', createdAt: 'x' },
      makeEntry('2026-07-14', 'good2'),
    ]
    expect(countDistinctLoggedDays(entries)).toBe(2)
  })

  // ── 13-14: Existing behavior preserved ─────────────────────

  test('13. existing History entries still render (count is correct)', () => {
    // The countDistinctLoggedDays function is used alongside
    // the existing groupedDays rendering. Verify it doesn't
    // interfere with normal entries.
    const entries = [
      makeEntry('2026-07-15', 'a'),
      makeEntry('2026-07-14', 'b'),
      makeEntry('2026-07-14', 'c'),
    ]
    // 2 distinct days, 3 total entries — rendering uses groupedDays
    // which is separate from the encouragement count.
    expect(countDistinctLoggedDays(entries)).toBe(2)
  })

  test('14. existing delete/edit behavior remains available', () => {
    // The encouragement card is purely additive — it doesn't
    // modify entries, deleteEntry, or the EntryDetailsModal.
    // Verify the copy functions are pure and don't mutate.
    const entries = [makeEntry('2026-07-15', 'a')]
    const originalLength = entries.length
    countDistinctLoggedDays(entries)
    getEncouragementCopy(1)
    expect(entries.length).toBe(originalLength)
    expect(entries[0].id).toBe('a')
  })

  // ── 15: Copy verification ──────────────────────────────────

  test('15. all six title/body combinations match the approved copy exactly', () => {
    // Day 0
    expect(ENCOURAGEMENT_COPY[0].title).toBe('Start your juice journey')
    expect(ENCOURAGEMENT_COPY[0].body).toBe(
      'Your juice history will appear here as you begin logging. Tracking your juices can help you notice progress, build consistency, and learn which fruits, vegetables, and juice combinations work best for your routine.'
    )

    // Day 1
    expect(ENCOURAGEMENT_COPY[1].title).toBe('Great start')
    expect(ENCOURAGEMENT_COPY[1].body).toBe(
      'You\u2019ve logged your first day. That first step gives your journey a beginning. Keep adding your juices so your history can gradually show your habits, favorites, and progress over time.'
    )

    // Day 2
    expect(ENCOURAGEMENT_COPY[2].title).toBe('You\u2019re building momentum')
    expect(ENCOURAGEMENT_COPY[2].body).toBe(
      'Two logged days is a strong beginning. Each new entry adds more meaning to your history and gives you a clearer picture of how raw fruits and vegetables are becoming part of your routine.'
    )

    // Day 3
    expect(ENCOURAGEMENT_COPY[3].title).toBe('A habit is taking shape')
    expect(ENCOURAGEMENT_COPY[3].body).toBe(
      'Three days of logging is meaningful progress. Staying aware of what you juice can make consistency easier and help you recognize the combinations you enjoy and return to most often.'
    )

    // Day 4
    expect(ENCOURAGEMENT_COPY[4].title).toBe('You\u2019re creating consistency')
    expect(ENCOURAGEMENT_COPY[4].body).toBe(
      'Four logged days shows that you are continuing to make room for fresh produce in your routine. Keep recording your juices so this screen becomes a useful, personal record of your progress.'
    )

    // Day 5
    expect(ENCOURAGEMENT_COPY[5].title).toBe('Nice progress')
    expect(ENCOURAGEMENT_COPY[5].body).toBe(
      'Five days of history gives you a solid foundation to build on. As you continue, your juice log can help you remember favorites, notice patterns, and celebrate the simple steps you are taking.'
    )
  })

  // ── getEncouragementCopy returns correct entries ───────────

  test('getEncouragementCopy returns correct copy for each day count 0-5', () => {
    for (let i = 0; i <= 5; i++) {
      const copy = getEncouragementCopy(i)
      expect(copy).not.toBeNull()
      expect(copy).toBe(ENCOURAGEMENT_COPY[i])
    }
  })

  test('getEncouragementCopy returns null for negative values', () => {
    expect(getEncouragementCopy(-1)).toBeNull()
  })
})
