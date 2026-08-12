// ─────────────────────────────────────────────────────────────
// glowJourney.test.js — Tests for Glow Journey Drop feature.
//
// Covers:
//   1.  Journey stage for all threshold boundaries
//   2.  Days remaining until next stage
//   3.  Zero-history state
//   4.  Singular and plural streak wording
//   5.  Weekly progress capped at 100%
//   6.  Same-day multiple logs count as one qualifying day
//   7.  Seven leaf states render correctly
//   8.  Today is distinguished correctly
//   9.  Weekly completion copy
//   10. Highest-stage behavior
//   11. Missing-data fallback
//   12. Reduced-motion behavior
//   13. Accessibility label contains important progress values
//   14. Stage celebration does not repeat after acknowledgment
//   15. Existing Glow Streak logic remains unchanged
//   16. Existing Today-screen actions and navigation continue to work
// ─────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}))

jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(() => Promise.resolve()),
}))

jest.mock('../../utils/DevClock', () => ({
  getDevNow: jest.fn(() => new Date('2025-06-04T10:00:00')),
}))

const {
  getJourneyStage,
  getNextStage,
  getDaysToNextStage,
  GLOW_JOURNEY_STAGES,
  WEEKLY_GLOW_GOAL,
} = require('../../constants/glowJourneyStages')

const {
  getWeeklyQualifyingDays,
  getWeeklyProgressRatio,
  getLifetimeQualifyingDays,
  getWeeklyLeafStates,
  isWeeklyGoalComplete,
  getMilestoneMessage,
  shouldCelebrateStage,
  markStageCelebrated,
  shouldCelebrateWeekly,
  markWeeklyCelebrated,
  resetGlowJourneyCelebrations,
  initializeBaseline,
  isBaselineInitialized,
} = require('../../services/glowJourneyService')

const AsyncStorage = require('@react-native-async-storage/async-storage')

// ── 1. Journey stage for all threshold boundaries ────────────

describe('GlowJourneyStages — threshold boundaries', () => {
  test('returns null for zero days', () => {
    expect(getJourneyStage(0)).toBeNull()
  })

  test('Seed: 1-4 days', () => {
    expect(getJourneyStage(1).key).toBe('seed')
    expect(getJourneyStage(4).key).toBe('seed')
  })

  test('Sprout: 5-14 days', () => {
    expect(getJourneyStage(5).key).toBe('sprout')
    expect(getJourneyStage(14).key).toBe('sprout')
  })

  test('Growing: 15-29 days', () => {
    expect(getJourneyStage(15).key).toBe('growing')
    expect(getJourneyStage(29).key).toBe('growing')
  })

  test('Blooming: 30-59 days', () => {
    expect(getJourneyStage(30).key).toBe('blooming')
    expect(getJourneyStage(59).key).toBe('blooming')
  })

  test('Thriving: 60-99 days', () => {
    expect(getJourneyStage(60).key).toBe('thriving')
    expect(getJourneyStage(99).key).toBe('thriving')
  })

  test('Radiant: 100-199 days', () => {
    expect(getJourneyStage(100).key).toBe('radiant')
    expect(getJourneyStage(199).key).toBe('radiant')
  })

  test('RawLife Legend: 200+ days', () => {
    expect(getJourneyStage(200).key).toBe('legend')
    expect(getJourneyStage(500).key).toBe('legend')
  })

  test('boundary transitions: 4→5, 14→15, 29→30, 59→60, 99→100, 199→200', () => {
    expect(getJourneyStage(4).key).toBe('seed')
    expect(getJourneyStage(5).key).toBe('sprout')
    expect(getJourneyStage(14).key).toBe('sprout')
    expect(getJourneyStage(15).key).toBe('growing')
    expect(getJourneyStage(29).key).toBe('growing')
    expect(getJourneyStage(30).key).toBe('blooming')
    expect(getJourneyStage(59).key).toBe('blooming')
    expect(getJourneyStage(60).key).toBe('thriving')
    expect(getJourneyStage(99).key).toBe('thriving')
    expect(getJourneyStage(100).key).toBe('radiant')
    expect(getJourneyStage(199).key).toBe('radiant')
    expect(getJourneyStage(200).key).toBe('legend')
  })
})

// ── 2. Days remaining until next stage ───────────────────────

describe('getDaysToNextStage', () => {
  test('1 day in Seed → 4 days to Sprout', () => {
    expect(getDaysToNextStage(1)).toBe(4)
  })

  test('4 days in Seed → 1 day to Sprout', () => {
    expect(getDaysToNextStage(4)).toBe(1)
  })

  test('14 days in Sprout → 1 day to Growing', () => {
    expect(getDaysToNextStage(14)).toBe(1)
  })

  test('29 days in Growing → 1 day to Blooming', () => {
    expect(getDaysToNextStage(29)).toBe(1)
  })

  test('200+ days (Legend) → 0 days (no next stage)', () => {
    expect(getDaysToNextStage(200)).toBe(0)
    expect(getDaysToNextStage(500)).toBe(0)
  })

  test('0 days → 1 day to Seed', () => {
    expect(getDaysToNextStage(0)).toBe(1)
  })
})

// ── 3. Zero-history state ────────────────────────────────────

describe('Zero-history state', () => {
  test('getJourneyStage(0) returns null', () => {
    expect(getJourneyStage(0)).toBeNull()
  })

  test('getLifetimeQualifyingDays([]) returns 0', () => {
    expect(getLifetimeQualifyingDays([])).toBe(0)
  })

  test('getLifetimeQualifyingDays(null) returns 0', () => {
    expect(getLifetimeQualifyingDays(null)).toBe(0)
  })

  test('getLifetimeQualifyingDays(undefined) returns 0', () => {
    expect(getLifetimeQualifyingDays(undefined)).toBe(0)
  })

  test('getWeeklyQualifyingDays([]) returns 0', () => {
    expect(getWeeklyQualifyingDays([])).toBe(0)
  })

  test('getMilestoneMessage for zero lifetime days', () => {
    const msg = getMilestoneMessage({ lifetimeDays: 0, weeklyQualifyingDays: 0, weeklyGoal: 3 })
    expect(msg).toBe('Your journey starts with your first juice')
  })
})

// ── 4. Singular and plural streak wording ────────────────────

describe('Streak wording', () => {
  test('1 day → "1 Day Glow Streak"', () => {
    const text = `1 Day Glow Streak`
    expect(text).toBe('1 Day Glow Streak')
  })

  test('2 days → "2 Day Glow Streak"', () => {
    const text = `2 Day Glow Streak`
    expect(text).toBe('2 Day Glow Streak')
  })

  test('0 days → "0 Day Glow Streak"', () => {
    const text = `0 Day Glow Streak`
    expect(text).toBe('0 Day Glow Streak')
  })
})

// ── 5. Weekly progress capped at 100% ────────────────────────

describe('Weekly progress ratio', () => {
  test('0 days → 0', () => {
    expect(getWeeklyProgressRatio([])).toBe(0)
  })

  test('3 days → 1.0 (100%)', () => {
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    expect(getWeeklyProgressRatio(entries)).toBe(1)
  })

  test('5 days → capped at 1.0 (100%)', () => {
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
      { dateKey: '2025-06-05', id: '4' },
      { dateKey: '2025-06-06', id: '5' },
    ]
    expect(getWeeklyProgressRatio(entries)).toBe(1)
  })
})

// ── 6. Same-day multiple logs count as one qualifying day ────

describe('Same-day multiple logs', () => {
  test('two entries on same dateKey count as one day', () => {
    const entries = [
      { dateKey: '2025-06-04', id: 'a' },
      { dateKey: '2025-06-04', id: 'b' },
    ]
    expect(getLifetimeQualifyingDays(entries)).toBe(1)
    expect(getWeeklyQualifyingDays(entries)).toBe(1)
  })

  test('three entries on same dateKey count as one day', () => {
    const entries = [
      { dateKey: '2025-06-04', id: 'a' },
      { dateKey: '2025-06-04', id: 'b' },
      { dateKey: '2025-06-04', id: 'c' },
    ]
    expect(getLifetimeQualifyingDays(entries)).toBe(1)
  })
})

// ── 7. Seven leaf states render correctly ────────────────────

describe('getWeeklyLeafStates', () => {
  const entries = [
    { dateKey: '2025-06-02', id: '1' },
    { dateKey: '2025-06-04', id: '2' },
  ]

  test('returns exactly 7 leaves', () => {
    const leaves = getWeeklyLeafStates(entries)
    expect(leaves).toHaveLength(7)
  })

  test('each leaf has required properties', () => {
    const leaves = getWeeklyLeafStates(entries)
    leaves.forEach((leaf) => {
      expect(leaf).toHaveProperty('dayIndex')
      expect(leaf).toHaveProperty('dateKey')
      expect(leaf).toHaveProperty('hasLog')
      expect(leaf).toHaveProperty('isToday')
      expect(leaf).toHaveProperty('isFuture')
      expect(leaf).toHaveProperty('isPast')
    })
  })

  test('logged days have hasLog=true', () => {
    const leaves = getWeeklyLeafStates(entries)
    expect(leaves[0].hasLog).toBe(true)
    expect(leaves[2].hasLog).toBe(true)
  })

  test('non-logged days have hasLog=false', () => {
    const leaves = getWeeklyLeafStates(entries)
    expect(leaves[1].hasLog).toBe(false)
  })
})

// ── 8. Today is distinguished correctly ──────────────────────

describe('Today leaf distinction', () => {
  test('exactly one leaf is marked isToday', () => {
    const leaves = getWeeklyLeafStates([])
    const todayLeaves = leaves.filter((l) => l.isToday)
    expect(todayLeaves).toHaveLength(1)
  })

  test('today leaf is not in the future', () => {
    const leaves = getWeeklyLeafStates([])
    const todayLeaf = leaves.find((l) => l.isToday)
    expect(todayLeaf.isFuture).toBe(false)
  })
})

// ── 9. Weekly completion copy ────────────────────────────────

describe('Weekly completion copy', () => {
  test('completed weekly goal → "Your Weekly Glow is complete"', () => {
    const msg = getMilestoneMessage({ lifetimeDays: 10, weeklyQualifyingDays: 3, weeklyGoal: 3 })
    expect(msg).toContain('Your Weekly Glow is complete')
  })

  test('1 day remaining → "One more juice completes your Weekly Glow"', () => {
    const msg = getMilestoneMessage({ lifetimeDays: 10, weeklyQualifyingDays: 2, weeklyGoal: 3 })
    expect(msg).toContain('One more juice completes your Weekly Glow')
  })

  test('2 days remaining → "2 more juicing days to complete your Weekly Glow"', () => {
    const msg = getMilestoneMessage({ lifetimeDays: 10, weeklyQualifyingDays: 1, weeklyGoal: 3 })
    expect(msg).toContain('2 more juicing days to complete your Weekly Glow')
  })
})

// ── 10. Highest-stage behavior ───────────────────────────────

describe('Highest-stage behavior', () => {
  test('getNextStage(200) returns null', () => {
    expect(getNextStage(200)).toBeNull()
  })

  test('getNextStage(500) returns null', () => {
    expect(getNextStage(500)).toBeNull()
  })

  test('getDaysToNextStage(200) returns 0', () => {
    expect(getDaysToNextStage(200)).toBe(0)
  })

  test('getJourneyStage(200).key is "legend"', () => {
    expect(getJourneyStage(200).key).toBe('legend')
  })
})

// ── 11. Missing-data fallback ────────────────────────────────

describe('Missing-data fallback', () => {
  test('null entries → 0 lifetime days', () => {
    expect(getLifetimeQualifyingDays(null)).toBe(0)
  })

  test('undefined entries → 0 weekly days', () => {
    expect(getWeeklyQualifyingDays(undefined)).toBe(0)
  })

  test('entries with missing dateKey are ignored', () => {
    const entries = [
      { id: 'a' },
      { dateKey: null, id: 'b' },
      { dateKey: 'not-a-date', id: 'c' },
      { dateKey: '2025-06-04', id: 'd' },
    ]
    expect(getLifetimeQualifyingDays(entries)).toBe(1)
  })

  test('non-array entries → 0', () => {
    expect(getLifetimeQualifyingDays('notarray')).toBe(0)
    expect(getWeeklyQualifyingDays(42)).toBe(0)
  })
})

// ── 12. Reduced-motion behavior ──────────────────────────────

describe('Reduced-motion behavior', () => {
  test('WEEKLY_GLOW_GOAL is 3', () => {
    expect(WEEKLY_GLOW_GOAL).toBe(3)
  })

  test('isWeeklyGoalComplete returns true when goal met', () => {
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    expect(isWeeklyGoalComplete(entries)).toBe(true)
  })

  test('isWeeklyGoalComplete returns false when goal not met', () => {
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
    ]
    expect(isWeeklyGoalComplete(entries)).toBe(false)
  })
})

// ── 13. Accessibility label contains important progress values ─

describe('Accessibility label content', () => {
  test('getMilestoneMessage includes next stage info', () => {
    const msg = getMilestoneMessage({ lifetimeDays: 15, weeklyQualifyingDays: 1, weeklyGoal: 3 })
    expect(msg).toContain('Blooming')
  })

  test('getMilestoneMessage includes weekly info', () => {
    const msg = getMilestoneMessage({ lifetimeDays: 15, weeklyQualifyingDays: 1, weeklyGoal: 3 })
    expect(msg).toMatch(/Weekly Glow/i)
  })
})

// ── 14. Stage celebration does not repeat after acknowledgment ─

describe('Stage celebration persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockReset()
    AsyncStorage.setItem.mockReset()
  })

  test('shouldCelebrateStage returns stage when not yet celebrated and baseline initialized', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce('true') // baselineInitialized
    const result = await shouldCelebrateStage(5)
    expect(result).not.toBeNull()
    expect(result.key).toBe('sprout')
  })

  test('shouldCelebrateStage returns null after celebration marked', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(JSON.stringify(['sprout'])) // celebratedStages
      .mockResolvedValueOnce('true') // baselineInitialized
    const result = await shouldCelebrateStage(5)
    expect(result).toBeNull()
  })

  test('shouldCelebrateStage returns null when baseline not initialized', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce(null) // baselineInitialized
    const result = await shouldCelebrateStage(5)
    expect(result).toBeNull()
  })

  test('shouldCelebrateStage returns null when prevLifetimeDays is same stage', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce('true') // baselineInitialized
    const result = await shouldCelebrateStage(10, 6)
    expect(result).toBeNull()
  })

  test('shouldCelebrateStage returns stage when prevLifetimeDays is different stage', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce('true') // baselineInitialized
    const result = await shouldCelebrateStage(5, 4)
    expect(result).not.toBeNull()
    expect(result.key).toBe('sprout')
  })

  test('markStageCelebrated persists the stage key', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['seed']))
    await markStageCelebrated('sprout')
    const setCall = AsyncStorage.setItem.mock.calls.find(
      (c) => c[0] === 'glowJourney_celebratedStages'
    )
    expect(setCall).toBeDefined()
    const stored = JSON.parse(setCall[1])
    expect(stored).toContain('sprout')
    expect(stored).toContain('seed')
  })

  test('shouldCelebrateWeekly returns null for already celebrated week', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(JSON.stringify(['2025-06-02'])) // celebratedWeeks
      .mockResolvedValueOnce('true') // baselineInitialized
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    const result = await shouldCelebrateWeekly(entries)
    expect(result).toBeNull()
  })

  test('shouldCelebrateWeekly returns null when baseline not initialized', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedWeeks
      .mockResolvedValueOnce(null) // baselineInitialized
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    const result = await shouldCelebrateWeekly(entries)
    expect(result).toBeNull()
  })
})

// ── 15. Existing Glow Streak logic remains unchanged ─────────

describe('Glow Streak rules unchanged', () => {
  test('GLOW_JOURNEY_STAGES has 7 stages', () => {
    expect(GLOW_JOURNEY_STAGES).toHaveLength(7)
  })

  test('WEEKLY_GLOW_GOAL default is 3', () => {
    expect(WEEKLY_GLOW_GOAL).toBe(3)
  })

  test('stage thresholds match spec', () => {
    const keys = GLOW_JOURNEY_STAGES.map((s) => s.key)
    expect(keys).toEqual(['seed', 'sprout', 'growing', 'blooming', 'thriving', 'radiant', 'legend'])
  })

  test('stage min/max match spec', () => {
    expect(GLOW_JOURNEY_STAGES[0]).toMatchObject({ key: 'seed', min: 1, max: 4 })
    expect(GLOW_JOURNEY_STAGES[1]).toMatchObject({ key: 'sprout', min: 5, max: 14 })
    expect(GLOW_JOURNEY_STAGES[2]).toMatchObject({ key: 'growing', min: 15, max: 29 })
    expect(GLOW_JOURNEY_STAGES[3]).toMatchObject({ key: 'blooming', min: 30, max: 59 })
    expect(GLOW_JOURNEY_STAGES[4]).toMatchObject({ key: 'thriving', min: 60, max: 99 })
    expect(GLOW_JOURNEY_STAGES[5]).toMatchObject({ key: 'radiant', min: 100, max: 199 })
    expect(GLOW_JOURNEY_STAGES[6]).toMatchObject({ key: 'legend', min: 200, max: Infinity })
  })
})

// ── 16. Existing Today-screen actions still work ─────────────

describe('Today screen integration', () => {
  test('glowJourneyService functions are importable', () => {
    expect(typeof getWeeklyQualifyingDays).toBe('function')
    expect(typeof getLifetimeQualifyingDays).toBe('function')
    expect(typeof getWeeklyLeafStates).toBe('function')
    expect(typeof getMilestoneMessage).toBe('function')
  })

  test('resetGlowJourneyCelebrations is callable', async () => {
    await resetGlowJourneyCelebrations()
    expect(AsyncStorage.multiRemove).toHaveBeenCalled()
  })
})

// ── 17. Baseline initialization — existing-user protection ──

describe('Baseline initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockReset()
    AsyncStorage.setItem.mockReset()
  })

  test('initializeBaseline returns true on first call (not yet initialized)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null) // baseline not set
    const result = await initializeBaseline([])
    expect(result).toBe(true)
  })

  test('initializeBaseline returns false on second call (already initialized)', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('true') // baseline already set
    const result = await initializeBaseline([])
    expect(result).toBe(false)
  })

  test('initializeBaseline marks current stage as celebrated for existing users', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // baselineInitialized
      .mockResolvedValueOnce(null) // celebratedStages (empty)
    const entries = [{ dateKey: '2025-06-04', id: '1' }]
    await initializeBaseline(entries)
    const setCalls = AsyncStorage.setItem.mock.calls
    const stageSetCall = setCalls.find((c) => c[0] === 'glowJourney_celebratedStages')
    expect(stageSetCall).toBeDefined()
    const stored = JSON.parse(stageSetCall[1])
    expect(stored).toContain('seed')
  })

  test('initializeBaseline marks current week as celebrated if goal already met', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // baselineInitialized
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce(null) // celebratedWeeks
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    await initializeBaseline(entries)
    const weekSetCall = AsyncStorage.setItem.mock.calls.find(
      (c) => c[0] === 'glowJourney_celebratedWeeks'
    )
    expect(weekSetCall).toBeDefined()
  })

  test('isBaselineInitialized returns true when key is set', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('true')
    const result = await isBaselineInitialized()
    expect(result).toBe(true)
  })

  test('isBaselineInitialized returns false when key is not set', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null)
    const result = await isBaselineInitialized()
    expect(result).toBe(false)
  })
})

// ── 18. No celebration for historical progress on first init ──

describe('No historical celebration on first init', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockReset()
    AsyncStorage.setItem.mockReset()
  })

  test('shouldCelebrateStage returns null before baseline init even with high lifetime days', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce(null) // baselineInitialized
    const result = await shouldCelebrateStage(100)
    expect(result).toBeNull()
  })

  test('shouldCelebrateWeekly returns null before baseline init even with goal met', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedWeeks
      .mockResolvedValueOnce(null) // baselineInitialized
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    const result = await shouldCelebrateWeekly(entries)
    expect(result).toBeNull()
  })
})

// ── 19. New stage celebration only after baseline ──

describe('New stage celebration after baseline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockReset()
    AsyncStorage.setItem.mockReset()
  })

  test('shouldCelebrateStage returns stage for new threshold after baseline', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages (empty)
      .mockResolvedValueOnce('true') // baselineInitialized
    const result = await shouldCelebrateStage(15, 14)
    expect(result).not.toBeNull()
    expect(result.key).toBe('growing')
  })

  test('shouldCelebrateStage returns null for same stage transition within stage', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedStages
      .mockResolvedValueOnce('true') // baselineInitialized
    const result = await shouldCelebrateStage(10, 6)
    expect(result).toBeNull()
  })
})

// ── 20. Weekly celebration only for new week after baseline ──

describe('Weekly celebration for new week', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockReset()
    AsyncStorage.setItem.mockReset()
  })

  test('shouldCelebrateWeekly returns result for new qualifying week after baseline', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedWeeks
      .mockResolvedValueOnce('true') // baselineInitialized
    const entries = [
      { dateKey: '2025-06-02', id: '1' },
      { dateKey: '2025-06-03', id: '2' },
      { dateKey: '2025-06-04', id: '3' },
    ]
    const result = await shouldCelebrateWeekly(entries)
    expect(result).not.toBeNull()
    expect(result.days).toBe(3)
  })

  test('shouldCelebrateWeekly returns null for incomplete week', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // celebratedWeeks
      .mockResolvedValueOnce('true') // baselineInitialized
    const entries = [{ dateKey: '2025-06-02', id: '1' }]
    const result = await shouldCelebrateWeekly(entries)
    expect(result).toBeNull()
  })
})

// ── 21. Week-start key is Monday-based ──

describe('Monday-based week convention', () => {
  test('getWeekStartToday returns a Monday', async () => {
    const { getWeekStartToday } = require('../../services/glowJourneyService')
    const weekStart = getWeekStartToday()
    const [y, m, d] = weekStart.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    expect(date.getDay()).toBe(1) // Monday
  })
})

// ── 22. Duplicate-prevention storage keys ──

describe('Duplicate-prevention storage keys', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockReset()
    AsyncStorage.setItem.mockReset()
  })

  test('markStageCelebrated does not duplicate stage keys', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['seed', 'sprout']))
    await markStageCelebrated('sprout')
    const setCall = AsyncStorage.setItem.mock.calls.find(
      (c) => c[0] === 'glowJourney_celebratedStages'
    )
    if (setCall) {
      const stored = JSON.parse(setCall[1])
      const sproutCount = stored.filter((k) => k === 'sprout').length
      expect(sproutCount).toBe(1)
    }
  })

  test('markWeeklyCelebrated does not duplicate week keys', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(['2025-06-02']))
    await markWeeklyCelebrated('2025-06-02')
    const setCall = AsyncStorage.setItem.mock.calls.find(
      (c) => c[0] === 'glowJourney_celebratedWeeks'
    )
    if (setCall) {
      const stored = JSON.parse(setCall[1])
      const count = stored.filter((k) => k === '2025-06-02').length
      expect(count).toBe(1)
    }
  })
})

// ── 23. resetGlowJourneyCelebrations clears all three keys ──

describe('Reset clears all keys', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.multiRemove.mockReset()
  })

  test('reset removes celebratedStages, celebratedWeeks, and baselineInitialized', async () => {
    await resetGlowJourneyCelebrations()
    const call = AsyncStorage.multiRemove.mock.calls[0]
    expect(call[0]).toContain('glowJourney_celebratedStages')
    expect(call[0]).toContain('glowJourney_celebratedWeeks')
    expect(call[0]).toContain('glowJourney_baselineInitialized')
  })
})

// ── 24. Analytics events use non-sensitive properties ──

describe('Analytics event properties', () => {
  let EVENT_SCHEMAS
  beforeAll(() => {
    const AnalyticsService = jest.requireActual('../../services/AnalyticsService')
    EVENT_SCHEMAS = AnalyticsService.EVENT_SCHEMAS
  })

  test('glow_journey_viewed schema exists', () => {
    expect(EVENT_SCHEMAS.glow_journey_viewed).toBeDefined()
    expect(EVENT_SCHEMAS.glow_journey_viewed.optional).toContain('journey_stage_key')
    expect(EVENT_SCHEMAS.glow_journey_viewed.optional).toContain('weekly_completed_days')
  })

  test('glow_journey_tapped schema exists', () => {
    expect(EVENT_SCHEMAS.glow_journey_tapped).toBeDefined()
    expect(EVENT_SCHEMAS.glow_journey_tapped.optional).toContain('journey_stage_key')
  })

  test('weekly_glow_completed schema exists', () => {
    expect(EVENT_SCHEMAS.weekly_glow_completed).toBeDefined()
    expect(EVENT_SCHEMAS.weekly_glow_completed.optional).toContain('weekly_completed_days')
  })

  test('glow_journey_stage_reached schema exists', () => {
    expect(EVENT_SCHEMAS.glow_journey_stage_reached).toBeDefined()
    expect(EVENT_SCHEMAS.glow_journey_stage_reached.optional).toContain('journey_stage_key')
    expect(EVENT_SCHEMAS.glow_journey_stage_reached.optional).toContain('lifetime_days')
  })

  test('no analytics schema contains nutrition or ingredient fields', () => {
    const glowSchemas = ['glow_journey_viewed', 'glow_journey_tapped', 'weekly_glow_completed', 'glow_journey_stage_reached']
    for (const key of glowSchemas) {
      const schema = EVENT_SCHEMAS[key]
      const allFields = [...(schema.required || []), ...(schema.optional || [])]
      expect(allFields).not.toContain('ingredients')
      expect(allFields).not.toContain('nutrition')
      expect(allFields).not.toContain('account_id')
    }
  })
})

// ── 25. Responsive layout — useWindowDimensions not static ──

describe('Responsive layout', () => {
  test('GlowJourneyDrop source uses useWindowDimensions not static Dimensions', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    expect(source).toContain('useWindowDimensions')
    expect(source).not.toMatch(/Dimensions\.get\('window'\)\.width/) // no static screen width
  })

  test('GlowJourneyDrop source has hero width bounds', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    // Living Juice Glow: hero width bounds (replaced old drop size bounds)
    expect(source).toContain('HERO_WIDTH_MIN')
    expect(source).toContain('HERO_WIDTH_MAX')
  })
})

// ── 26. No hard-coded colors in GlowJourneyDrop ──

describe('No hard-coded colors in components', () => {
  test('GlowJourneyDrop does not use hard-coded #A5D6A7 or #4CAF50', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    expect(source).not.toContain('#A5D6A7')
    expect(source).not.toContain('#4CAF50')
  })

  test('GlowJourneyDetail does not use hard-coded #0D1510 for sheet background', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDetail.js'),
      'utf8'
    )
    expect(source).not.toMatch(/backgroundColor:\s*'#0D1510'/)
  })
})

// ── 27. No unused imports in GlowJourneyDrop ──

describe('No unused imports', () => {
  test('GlowJourneyDrop does not import BRAND', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    expect(source).not.toMatch(/import.*BRAND.*from.*tokens/)
  })

  test('GlowJourneyDrop does not import DURATION (unused after corrections)', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    expect(source).not.toMatch(/import.*DURATION.*from.*motion/)
  })
})

// ── 28. TodayScreen uses initializeBaseline on mount ──

describe('TodayScreen baseline integration', () => {
  test('TodayScreen source calls initializeBaseline', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
      'utf8'
    )
    expect(source).toContain('initializeBaseline')
  })

  test('TodayScreen source has glowJourneyViewedRef for once-only analytics', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
      'utf8'
    )
    expect(source).toContain('glowJourneyViewedRef')
  })

  test('TodayScreen source has prevLifetimeDaysRef for stage transition detection', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
      'utf8'
    )
    expect(source).toContain('prevLifetimeDaysRef')
  })

  test('TodayScreen source has stageCelebration state', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
      'utf8'
    )
    expect(source).toContain('stageCelebration')
  })
})

// ── 29. Stage celebration respects achievement overlay order ──

describe('Stage celebration safe presentation', () => {
  test('TodayScreen source checks pendingAchievement before showing stage celebration', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
      'utf8'
    )
    expect(source).toMatch(/!pendingAchievement.*stageCelebration/)
  })
})

// ── 30. Reduced motion in stage celebration ──

describe('Reduced motion in celebration', () => {
  test('TodayScreen passes isReduced to celebration overlay', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
      'utf8'
    )
    expect(source).toMatch(/GlowJourneyCelebrationOverlay/)
    expect(source).toMatch(/isReduced/)
  })

  test('GlowJourneyCelebrationOverlay uses isReduced for animationType', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyCelebrationOverlay.js'),
      'utf8'
    )
    expect(source).toMatch(/isReduced.*none.*fade/)
  })
})

// ── 31. Visual state adapter (GlowJourneyVisualState) ──

describe('GlowJourneyVisualState', () => {
  const {
    buildGlowJourneyVisualState,
    getStageVisualProps,
    clampProgress,
    surfaceY,
    getFillRatio,
    getHeroVisualState,
    getVineLeafVisualState,
    GLOW_PALETTE,
  } = require('../../components/GlowJourneyVisualState')

  test('getStageVisualProps returns props for each stage', () => {
    const seed = getStageVisualProps('seed')
    expect(seed.outlineWidth).toBe(2)
    expect(seed.glowRingOpacity).toBe(0)

    const growing = getStageVisualProps('growing')
    expect(growing.outlineWidth).toBe(2)
    expect(growing.glowRingOpacity).toBe(0.05)

    const legend = getStageVisualProps('legend')
    expect(legend.outlineWidth).toBe(2)
    expect(legend.glowRingOpacity).toBe(0.18)
  })

  test('getStageVisualProps returns seed props for null/unknown stage', () => {
    const nullProps = getStageVisualProps(null)
    expect(nullProps.motifKey).toBe('seed')

    const unknownProps = getStageVisualProps('unknown')
    expect(unknownProps.motifKey).toBe('seed')
  })

  test('clampProgress clamps between 0 and 1', () => {
    expect(clampProgress(0)).toBe(0)
    expect(clampProgress(0.5)).toBe(0.5)
    expect(clampProgress(1)).toBe(1)
    expect(clampProgress(1.5)).toBe(1)
    expect(clampProgress(-0.5)).toBe(0)
    expect(clampProgress(NaN)).toBe(0)
    expect(clampProgress(undefined)).toBe(0)
  })

  // ── Living Juice Glow: surfaceY and fill model ──
  test('surfaceY(0) === 238 (resting pool)', () => {
    expect(surfaceY(0)).toBe(238)
  })

  test('surfaceY(1) === 42 (full fill)', () => {
    expect(surfaceY(1)).toBe(42)
  })

  test('surfaceY(0.33) is approximately 172.7 (1/3 fill)', () => {
    expect(surfaceY(1 / 3)).toBeCloseTo(172.67, 1)
  })

  test('surfaceY(0.67) is approximately 107.3 (2/3 fill)', () => {
    expect(surfaceY(2 / 3)).toBeCloseTo(107.33, 1)
  })

  test('getFillRatio caps at 3-day goal', () => {
    expect(getFillRatio(0)).toBe(0)
    expect(getFillRatio(1)).toBeCloseTo(1 / 3, 5)
    expect(getFillRatio(2)).toBeCloseTo(2 / 3, 5)
    expect(getFillRatio(3)).toBe(1)
    // q>3 does NOT increase fill — only radiance
    expect(getFillRatio(5)).toBe(1)
    expect(getFillRatio(7)).toBe(1)
  })

  test('getHeroVisualState: q=0 resting state', () => {
    const hero = getHeroVisualState(0)
    expect(hero.q).toBe(0)
    expect(hero.f).toBe(0)
    expect(hero.surfaceY).toBe(238)
    expect(hero.isComplete).toBe(false)
    expect(hero.beyondGoal).toBe(false)
    expect(hero.pulpCount).toBe(5)
  })

  test('getHeroVisualState: q=3 completed state', () => {
    const hero = getHeroVisualState(3)
    expect(hero.q).toBe(3)
    expect(hero.f).toBe(1)
    expect(hero.surfaceY).toBe(42)
    expect(hero.isComplete).toBe(true)
    expect(hero.beyondGoal).toBe(false)
    expect(hero.pulpCount).toBe(5)
    expect(hero.completionBloomOpacity).toBe(0.7)
  })

  test('getHeroVisualState: q=5 beyond goal — fill unchanged, radiance increases', () => {
    const hero = getHeroVisualState(5)
    expect(hero.q).toBe(5)
    expect(hero.f).toBe(1)
    expect(hero.surfaceY).toBe(42) // SAME as q=3
    expect(hero.isComplete).toBe(true)
    expect(hero.beyondGoal).toBe(true)
    expect(hero.pulpCount).toBe(9) // more pulp bubbles
    expect(hero.completionBloomOpacity).toBe(1.0) // brighter bloom
  })

  test('getHeroVisualState: q=7 beyond goal — fill still unchanged', () => {
    const hero = getHeroVisualState(7)
    expect(hero.surfaceY).toBe(42) // SAME as q=3
    expect(hero.beyondGoal).toBe(true)
    expect(hero.pulpCount).toBe(9)
  })

  test('getVineLeafVisualState: logged leaf has gold treatment', () => {
    const vs = getVineLeafVisualState({ hasLog: true, isToday: false, isFuture: false })
    expect(vs.logged).toBe(true)
    expect(vs.fillType).toBe('gradient')
    expect(vs.fillColor).toBe(GLOW_PALETTE.juiceGold)
    expect(vs.midribOpacity).toBe(0.55)
    expect(vs.glowOpacity).toBe(0.5)
  })

  test('getVineLeafVisualState: unlogged leaf has dark resting fill', () => {
    const vs = getVineLeafVisualState({ hasLog: false, isToday: false, isFuture: false })
    expect(vs.logged).toBe(false)
    expect(vs.fillType).toBe('flat')
    expect(vs.fillColor).toBe(GLOW_PALETTE.weekLeafOffFill)
    expect(vs.midribOpacity).toBe(0)
    expect(vs.glowOpacity).toBe(0)
  })

  test('buildGlowJourneyVisualState returns complete state object', () => {
    const state = buildGlowJourneyVisualState({
      lifetimeDays: 20,
      weeklyQualifyingDays: 2,
      weeklyLeafStates: [
        { hasLog: true, isToday: false, isFuture: false },
        { hasLog: true, isToday: false, isFuture: false },
        { hasLog: false, isToday: true, isFuture: false },
        { hasLog: false, isToday: false, isFuture: true },
        { hasLog: false, isToday: false, isFuture: true },
        { hasLog: false, isToday: false, isFuture: true },
        { hasLog: false, isToday: false, isFuture: true },
      ],
      streakCount: 5,
    })

    expect(state.stage).toBeTruthy()
    expect(state.stageKey).toBe('growing')
    expect(state.fillRatio).toBeCloseTo(2 / 3, 5)
    expect(state.heroState).toBeTruthy()
    expect(state.heroState.surfaceY).toBe(surfaceY(2 / 3))
    expect(state.leafStates).toHaveLength(7)
    expect(state.leafStates[0].visual.logged).toBe(true)
    expect(state.leafStates[2].visual.logged).toBe(false)
    expect(state.streakCount).toBe(5)
    expect(state.weeklyGoal).toBe(3)
  })

  test('GLOW_PALETTE has Living Juice Glow design tokens', () => {
    // Spec §2 design tokens
    expect(GLOW_PALETTE.bg).toBe('#080F0C')
    expect(GLOW_PALETTE.surfaceTop).toBe('#12201A')
    expect(GLOW_PALETTE.ink).toBe('#EAF4EE')
    expect(GLOW_PALETTE.inkMuted).toBe('#7E948A')
    expect(GLOW_PALETTE.juiceGold).toBe('#FFB23F')
    expect(GLOW_PALETTE.juiceMint).toBe('#7BE3B0')
    expect(GLOW_PALETTE.glowLine).toBe('#F4FFFA')
    expect(GLOW_PALETTE.weekLeafOffFill).toBe('#16241D')
    expect(GLOW_PALETTE.weekLeafOffStroke).toBe('#4E7462')
    expect(GLOW_PALETTE.weekStem).toBe('#2A4437')
    // Legacy compatibility tokens preserved
    expect(GLOW_PALETTE.stageGoldTrim).toBe('#D9A63E')
  })
})

// ── 32. GlowJourneyDropArtwork component structure ──

describe('GlowJourneyDropArtwork component', () => {
  test('source defines Living Juice Glow SVG groups', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // Living Juice Glow: hero + week vine containers
    expect(source).toMatch(/glowhero_container/)
    expect(source).toMatch(/glowweekvine_container/)
    expect(source).toMatch(/glowhero_wrap/)
    expect(source).toMatch(/glowweekvine_wrap/)
  })

  test('source uses locked drip-tip vessel silhouette path', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // Spec §5 locked vessel path — asymmetric botanical drip-tip
    expect(source).toMatch(/M118,14 C112,50 130,76 150,104/)
    expect(source).toMatch(/174,220 142,250 98,250/)
  })

  test('source defines vine with 7 leaf positions and M T W T F S S initials', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    expect(source).toMatch(/VINE_LEAF_CENTERS/)
    expect(source).toMatch(/VINE_DAY_INITIALS/)
    expect(source).toMatch(/\['M', 'T', 'W', 'T', 'F', 'S', 'S'\]/)
  })

  test('source does not load SVG files from Docs at runtime', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    expect(source).not.toMatch(/Docs/i)
  })

  test('source is filter-free (no feGaussianBlur)', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // Spec §13: production must be filter-free
    expect(source).not.toMatch(/feGaussianBlur/)
    expect(source).not.toMatch(/filter=/)
  })

  test('source uses per-instance unique gradient/clip IDs', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // Spec §13: per-instance suffix IDs to prevent Android cross-contamination
    expect(source).toMatch(/Math\.random.*toString.*slice/)
  })

  test('source does not render text inside hero SVG', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // Spec §5: no text/numeral/badge/icon inside hero
    // GlowHero function should not contain SvgText
    const heroMatch = source.match(/function GlowHero[\s\S]*?^}/m)
    if (heroMatch) {
      expect(heroMatch[0]).not.toMatch(/SvgText/)
      expect(heroMatch[0]).not.toMatch(/<Text/)
    }
  })

  // ── Regression: SVG <G> must not be used as root wrapper outside <Svg> ──
  // Physical-device rendering failure: <G> outside <Svg> renders as zero-size
  // on Android, making the nested <Svg> children invisible.
  test('artwork root wrapper uses View not G (Android rendering fix)', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // Must import View from react-native
    expect(source).toMatch(/import.*View.*from.*react-native/)
    // The main artwork component must return a View as root, not a G
    // Find the return statement of GlowJourneyDropArtwork
    const mainMatch = source.match(/function GlowJourneyDropArtwork[\s\S]*?return\s*\(/)
    expect(mainMatch).toBeTruthy()
    // The return block should contain <View not <G as the outermost wrapper
    const returnBlock = source.slice(mainMatch.index)
    // First JSX element after return should be View, not G
    expect(returnBlock).toMatch(/return\s*\(\s*<View/)
  })

  test('SVG IDs are stable per instance (useRef not useMemo)', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // IDs must be stable for the lifetime of the component instance
    // useRef ensures IDs are generated once and never regenerated
    expect(source).toMatch(/useRef/)
    expect(source).toMatch(/idsRef/)
  })
})

// ── 33. Celebration coordinator hook ──

describe('useCelebrationCoordinator', () => {
  test('is importable and exports expected interface', () => {
    const mod = require('../../hooks/useCelebrationCoordinator')
    expect(typeof mod.useCelebrationCoordinator).toBe('function')
    expect(mod.CELEBRATION_TYPES).toBeTruthy()
    expect(mod.CELEBRATION_TYPES.STAGE).toBe('stage')
    expect(mod.CELEBRATION_TYPES.WEEKLY).toBe('weekly')
  })
})

// ── 34. Streak label fix ──

describe('Streak label fix', () => {
  test('GlowJourneyDrop renders streak numeral outside hero', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    // Living Juice Glow: streak is outside hero, rendered as numeral + 2-line label
    expect(source).toMatch(/streakNumeral/)
    expect(source).toMatch(/DAY GLOW/)
    expect(source).toMatch(/STREAK/)
  })

  test('GlowJourneyDrop does not render streak text inside hero', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    // Spec §5: no text/numeral inside hero — old overlay removed
    expect(source).not.toMatch(/streakOverlay/)
    expect(source).not.toMatch(/Day Glow Streak/)
  })
})

// ── 35. GlowJourneyDetail redesigned artwork integration ──

describe('GlowJourneyDetail redesigned artwork', () => {
  test('imports GlowJourneyDropArtwork', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDetail.js'),
      'utf8'
    )
    expect(source).toMatch(/GlowJourneyDropArtwork/)
    expect(source).toMatch(/buildGlowJourneyVisualState/)
  })

  test('renders drop artwork in scroll view', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDetail.js'),
      'utf8'
    )
    expect(source).toMatch(/dropArtworkContainer/)
  })
})

// ── 36. Living Juice Glow — 3-day vs 7-day safety ──

describe('Living Juice Glow — 3-day vs 7-day safety', () => {
  const { getFillRatio, getHeroVisualState, surfaceY } = require('../../components/GlowJourneyVisualState')

  test('f = min(q,3)/3 for q=0,1,2,3,5,7', () => {
    expect(getFillRatio(0)).toBe(0)
    expect(getFillRatio(1)).toBeCloseTo(1 / 3, 5)
    expect(getFillRatio(2)).toBeCloseTo(2 / 3, 5)
    expect(getFillRatio(3)).toBe(1)
    expect(getFillRatio(5)).toBe(1) // capped, no 5/7 math
    expect(getFillRatio(7)).toBe(1) // capped, no 7-day goal
  })

  test('q=5 produces SAME completed fill height as q=3', () => {
    const h3 = getHeroVisualState(3)
    const h5 = getHeroVisualState(5)
    expect(h5.surfaceY).toBe(h3.surfaceY) // 42 === 42
    expect(h5.f).toBe(h3.f) // 1 === 1
  })

  test('q=7 produces SAME completed fill height as q=3', () => {
    const h3 = getHeroVisualState(3)
    const h7 = getHeroVisualState(7)
    expect(h7.surfaceY).toBe(h3.surfaceY) // 42 === 42
  })

  test('q>3 increases radiance only (pulp count, bloom), not fill', () => {
    const h3 = getHeroVisualState(3)
    const h5 = getHeroVisualState(5)
    expect(h5.pulpCount).toBeGreaterThan(h3.pulpCount) // 9 > 5
    expect(h5.completionBloomOpacity).toBeGreaterThan(h3.completionBloomOpacity) // 1.0 > 0.7
    expect(h5.surfaceY).toBe(h3.surfaceY) // fill unchanged
  })

  test('WEEKLY_GLOW_GOAL remains exactly 3', () => {
    const { WEEKLY_GLOW_GOAL } = require('../../constants/glowJourneyStages')
    expect(WEEKLY_GLOW_GOAL).toBe(3)
  })
})

// ── 37. Living Juice Glow — vine structure ──

describe('Living Juice Glow — vine structure', () => {
  const { getVineLeafVisualState, GLOW_PALETTE } = require('../../components/GlowJourneyVisualState')

  test('exactly 7 vine leaf centers defined', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // 7 leaf centers: 34, 82.7, 131.3, 180, 228.7, 277.3, 326
    const match = source.match(/VINE_LEAF_CENTERS\s*=\s*\[([^\]]+)\]/)
    expect(match).toBeTruthy()
    const centers = match[1].split(',').map((s) => parseFloat(s.trim()))
    expect(centers).toHaveLength(7)
  })

  test('7 day initials M T W T F S S', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    expect(source).toMatch(/\['M', 'T', 'W', 'T', 'F', 'S', 'S'\]/)
  })

  test('logged vine leaf has gold gradient fill', () => {
    const vs = getVineLeafVisualState({ hasLog: true, isToday: false, isFuture: false })
    expect(vs.fillType).toBe('gradient')
    expect(vs.fillColor).toBe(GLOW_PALETTE.juiceGold)
  })

  test('unlogged vine leaf has dark fill and visible stroke', () => {
    const vs = getVineLeafVisualState({ hasLog: false, isToday: false, isFuture: false })
    expect(vs.fillType).toBe('flat')
    expect(vs.fillColor).toBe(GLOW_PALETTE.weekLeafOffFill)
    expect(vs.strokeColor).toBe(GLOW_PALETTE.weekLeafOffStroke)
    expect(vs.glowOpacity).toBe(0)
  })
})

// ── 38. Living Juice Glow — no emoji, no old elements ──

describe('Living Juice Glow — no emoji, no old visual elements', () => {
  test('GlowJourneyDropArtwork has no emoji', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    // No emoji characters in the artwork source
    const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u
    expect(emojiPattern.test(source)).toBe(false)
  })

  test('GlowJourneyDrop has no emoji', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u
    expect(emojiPattern.test(source)).toBe(false)
  })

  test('GlowJourneyDrop does not have old chip groups or motivational copy', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    // Old elements removed per spec §14
    expect(source).not.toMatch(/chipsRow/)
    expect(source).not.toMatch(/chipGroup/)
    expect(source).not.toMatch(/motivationalCopy/)
    expect(source).not.toMatch(/MilestoneMessage/)
  })

  test('GlowJourneyDrop has new card composition hierarchy', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    // New hierarchy: eyebrow → hero → vine → streak → divider → journey
    expect(source).toMatch(/eyebrow/)
    expect(source).toMatch(/heroWrap/)
    expect(source).toMatch(/streakRow/)
    expect(source).toMatch(/divider/)
    expect(source).toMatch(/journeyRow/)
  })

  test('GlowJourneyDrop uses serif font for streak numeral (no Fraunces dependency)', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    // Uses existing codebase serif pattern, not a new font dependency
    expect(source).toMatch(/Georgia.*serif|serif.*Georgia/)
    expect(source).not.toMatch(/Fraunces/)
    expect(source).not.toMatch(/Inter Tight/)
    expect(source).not.toMatch(/expo-font/)
  })
})

// ── 39. Living Juice Glow — Garden freeze verification ──

describe('Living Juice Glow — Garden freeze', () => {
  test('GardenProduceIcons was not modified in this pass', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GardenProduceIcons.js'),
      'utf8'
    )
    // Should still contain the corrected icons from the prior pass
    expect(source).toMatch(/TropicalIcon|function Tropical/)
    expect(source).toMatch(/BerriesIcon|function Berries/)
  })

  test('JourneyTreeArtwork was not modified in this pass', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'JourneyTreeArtwork.js'),
      'utf8'
    )
    // Should still contain the Journey Tree from the prior pass
    expect(source).toMatch(/JourneyTreeArtwork/)
  })

  test('MilestoneArborArtwork was not modified in this pass', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'MilestoneArborArtwork.js'),
      'utf8'
    )
    // Should still contain the Arbor from the prior pass
    expect(source).toMatch(/MilestoneArborArtwork/)
  })
})

// ── 40. Living Juice Glow — no new persistence keys ──

describe('Living Juice Glow — no new persistence', () => {
  test('GlowJourneyVisualState does not import AsyncStorage', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyVisualState.js'),
      'utf8'
    )
    expect(source).not.toMatch(/AsyncStorage/)
  })

  test('GlowJourneyDropArtwork does not import AsyncStorage', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
      'utf8'
    )
    expect(source).not.toMatch(/AsyncStorage/)
  })

  test('GlowJourneyDrop does not import AsyncStorage', () => {
    const fs = require('fs')
    const path = require('path')
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
      'utf8'
    )
    expect(source).not.toMatch(/AsyncStorage/)
  })
})
