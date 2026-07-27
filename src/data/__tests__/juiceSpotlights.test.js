const {
  JUICE_SPOTLIGHTS,
  getSpotlightForDay,
  getSpotlightState,
  resolveSpotlightDestination,
} = require('../juiceSpotlights')

describe('juiceSpotlights', () => {
  test('selects a stable focus-mapped spotlight for the same local day', () => {
    const first = getSpotlightForDay({ focusId: 'vitamin_k', dayKey: '2026-07-21' })
    const second = getSpotlightForDay({ focusId: 'vitamin_k', dayKey: '2026-07-21' })

    expect(first).toBe(second)
    expect(['green-glow', 'berry-green']).toContain(first.id)
  })

  test('maps vitamin A to a carrot-focused blend', () => {
    const spotlight = getSpotlightForDay({ focusId: 'vitamin_a', dayKey: '2026-07-21' })

    expect(['carrot-sunrise', 'golden-fresh']).toContain(spotlight.id)
  })

  test('uses a safe beginner-friendly fallback when focus data is missing', () => {
    const spotlight = getSpotlightForDay({ focusId: null, dayKey: '2026-07-21' })

    expect(spotlight.beginnerFriendly).toBe(true)
  })

  test('uses the provided local day key instead of UTC date formatting', () => {
    const localDaySpotlight = getSpotlightForDay({ focusId: 'vitamin_c', dayKey: '2026-07-21' })
    const utcDaySpotlight = getSpotlightForDay({ focusId: 'vitamin_c', dayKey: '2026-07-20' })

    expect(localDaySpotlight).toBe(getSpotlightForDay({ focusId: 'vitamin_c', dayKey: '2026-07-21' }))
    expect(utcDaySpotlight).toBeDefined()
  })

  test('uses a useful suggestion state for new users', () => {
    expect(getSpotlightState({ totalLogs: 0, todayEntries: [] })).toMatchObject({
      kind: 'new',
      latestEntry: null,
    })
  })

  test('uses a suggestion state before a returning user logs today', () => {
    expect(getSpotlightState({ totalLogs: 4, todayEntries: [] })).toMatchObject({
      kind: 'suggestion',
      latestEntry: null,
    })
  })

  test('uses a completion state when a canonical today entry exists', () => {
    const entry = { id: 'today-1', title: 'Kale, Apple', ingredients: ['kale', 'apple'] }

    expect(getSpotlightState({ totalLogs: 4, todayEntries: [entry] })).toMatchObject({
      kind: 'completed',
      latestEntry: entry,
    })
  })

  test('resolves scan and logging actions to the existing ScanFlow route', () => {
    expect(resolveSpotlightDestination({ hasHistory: false, target: 'scan' })).toEqual({
      route: 'ScanFlow',
      params: { screen: 'ScanHome', params: { openCamera: true, source: 'spotlight' } },
    })
    expect(resolveSpotlightDestination({ hasHistory: false, target: 'add' })).toEqual({
      route: 'ScanFlow',
      params: { screen: 'ScanHome', params: { manualEntry: true, source: 'spotlight' } },
    })
  })

  test('uses history for completed juice viewing and ScanFlow as the safe fallback', () => {
    expect(resolveSpotlightDestination({ hasHistory: true, target: 'today' })).toEqual({ route: 'HistoryScreen' })
    expect(resolveSpotlightDestination({ hasHistory: false, target: 'today' })).toEqual({
      route: 'ScanFlow',
      params: { screen: 'ScanHome', params: { manualEntry: true, source: 'spotlight' } },
    })
  })

  test('uses only local curated data and no remote image sources', () => {
    expect(JUICE_SPOTLIGHTS).toHaveLength(8)
    expect(JUICE_SPOTLIGHTS.every((spotlight) => spotlight.imageSource === null)).toBe(true)
    expect(JUICE_SPOTLIGHTS.every((spotlight) => spotlight.ingredients.length >= 3)).toBe(true)
  })
})
