// ─────────────────────────────────────────────────────────────
// storage.test.ts — Unit tests for the persistence module.
//
// Covers:
//   - Hydration from empty, valid, and corrupt storage
//   - Schema versioning and migration
//   - Debounced writes
//   - Cycle reset correctness after restore
//   - Nuclear reset
// ─────────────────────────────────────────────────────────────

import {
  loadState,
  saveStateImmediate,
  CURRENT_SCHEMA_VERSION,
  flushPendingWrite,
  clearState,
  resetAllStorageKeys,
} from '../storage'
import type { PersistedEnvelope, StorageAdapterOptions } from '../storage'
import {
  createEmptyScoreState,
  createNewCycle,
  processMonthlyReset,
  recordLog,
  createLogEntry,
  computeScoreBreakdown,
  currentMomentum,
  isCycleExpired,
  isValidCycle,
  getTodayISO,
  CYCLE_DAYS,
} from '../NutritionScoreEngine'
import type { NutritionScoreState } from '../NutritionScoreEngine'

// ── Mock AsyncStorage ────────────────────────────────────────

const mockStore: Record<string, string> = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore[key] = value
    return Promise.resolve()
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStore[key]
    return Promise.resolve()
  }),
  multiRemove: jest.fn((keys: string[]) => {
    for (const k of keys) delete mockStore[k]
    return Promise.resolve()
  }),
}))

// ── Test Helpers ─────────────────────────────────────────────

const TEST_KEY = '@test_storage_key'

function sanitizeTestPayload(raw: unknown): { value: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return {
    value: typeof r.value === 'number' ? r.value : 0,
  }
}

const testOptions: StorageAdapterOptions<{ value: number }> = {
  key: TEST_KEY,
  version: CURRENT_SCHEMA_VERSION,
  sanitize: sanitizeTestPayload as (raw: unknown) => { value: number },
}

function sanitizeScoreState(raw: unknown): NutritionScoreState {
  const empty = createEmptyScoreState()
  if (!raw || typeof raw !== 'object') return empty
  const r = raw as Record<string, unknown>
  return {
    activeCycle: isValidCycle(r.activeCycle) ? r.activeCycle : empty.activeCycle,
    completedCycles: Array.isArray(r.completedCycles)
      ? r.completedCycles.filter(isValidCycle)
      : [],
    lifetimeScore: typeof r.lifetimeScore === 'number' ? r.lifetimeScore : 0,
    allTimeUniqueIngredients: Array.isArray(r.allTimeUniqueIngredients)
      ? r.allTimeUniqueIngredients.filter((s: unknown) => typeof s === 'string')
      : [],
    allTimeNutrientsDiscovered: Array.isArray(r.allTimeNutrientsDiscovered)
      ? r.allTimeNutrientsDiscovered.filter((s: unknown) => typeof s === 'string')
      : [],
    longestEverStreak: typeof r.longestEverStreak === 'number' ? r.longestEverStreak : 0,
    totalLifetimeScans: typeof r.totalLifetimeScans === 'number' ? r.totalLifetimeScans : 0,
  }
}

const scoreOptions: StorageAdapterOptions<NutritionScoreState> = {
  key: '@juicing_nutrition_score_v1',
  version: CURRENT_SCHEMA_VERSION,
  sanitize: sanitizeScoreState,
}

beforeEach(() => {
  // Clear mock store
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key]
  }
  jest.clearAllMocks()
})

// ── Hydration Tests ──────────────────────────────────────────

describe('Hydration', () => {
  test('returns null when storage is empty', async () => {
    const result = await loadState(testOptions)
    expect(result).toBeNull()
  })

  test('hydrates v2 enveloped data correctly', async () => {
    const envelope: PersistedEnvelope<{ value: number }> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      persistedAt: '2026-02-18T12:00:00',
      payload: { value: 42 },
    }
    mockStore[TEST_KEY] = JSON.stringify(envelope)

    const result = await loadState(testOptions)
    expect(result).toEqual({ value: 42 })
  })

  test('hydrates v1 bare payload (no envelope) with migration', async () => {
    // v1 stored bare JSON without envelope
    mockStore[TEST_KEY] = JSON.stringify({ value: 99 })

    const result = await loadState(testOptions)
    expect(result).toEqual({ value: 99 })
  })

  test('returns sanitized defaults for corrupt JSON', async () => {
    mockStore[TEST_KEY] = 'not-valid-json{{'

    const result = await loadState(testOptions)
    expect(result).toBeNull() // sanitize returns null for invalid
  })

  test('returns sanitized defaults for corrupt payload shape', async () => {
    const envelope: PersistedEnvelope<unknown> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      persistedAt: '2026-02-18T12:00:00',
      payload: 'not-an-object',
    }
    mockStore[TEST_KEY] = JSON.stringify(envelope)

    const result = await loadState(testOptions)
    expect(result).toBeNull()
  })

  test('hydrates NutritionScoreState with all fields validated', async () => {
    const state = createEmptyScoreState()
    const entry = createLogEntry(['kale', 'spinach'], { vitaminC: 10, iron: 2 })
    const updated = recordLog(state, entry)

    const envelope: PersistedEnvelope<NutritionScoreState> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      persistedAt: '2026-02-18T12:00:00',
      payload: updated,
    }
    mockStore[scoreOptions.key] = JSON.stringify(envelope)

    const result = await loadState(scoreOptions)
    expect(result).not.toBeNull()
    expect(result!.activeCycle.logs).toHaveLength(1)
    expect(result!.allTimeUniqueIngredients).toContain('kale')
    expect(result!.allTimeUniqueIngredients).toContain('spinach')
    expect(result!.totalLifetimeScans).toBe(1)
  })

  test('hydrates NutritionScoreState with missing fields falls back to defaults', async () => {
    // Simulate partially corrupt state
    const envelope: PersistedEnvelope<Record<string, unknown>> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      persistedAt: '2026-02-18T12:00:00',
      payload: {
        activeCycle: null,
        lifetimeScore: 'not-a-number',
        completedCycles: 'not-an-array',
      },
    }
    mockStore[scoreOptions.key] = JSON.stringify(envelope)

    const result = await loadState(scoreOptions)
    expect(result).not.toBeNull()
    expect(isValidCycle(result!.activeCycle)).toBe(true)
    expect(result!.lifetimeScore).toBe(0)
    expect(result!.completedCycles).toEqual([])
  })
})

// ── Schema Migration Tests ───────────────────────────────────

describe('Schema migration', () => {
  test('migrates v1 bare payload to v2 envelope and re-persists', async () => {
    // v1: bare JSON, no envelope
    mockStore[TEST_KEY] = JSON.stringify({ value: 77 })

    const result = await loadState(testOptions)
    expect(result).toEqual({ value: 77 })

    // Should have re-persisted as v2 envelope
    const rePersisted = JSON.parse(mockStore[TEST_KEY])
    expect(rePersisted.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(rePersisted.payload).toEqual({ value: 77 })
    expect(rePersisted.persistedAt).toBeDefined()
  })

  test('custom migrate function is called for version bumps', async () => {
    const migrateFn = jest.fn((raw: unknown, _fromVersion: number) => {
      const r = raw as Record<string, unknown>
      return { ...r, migrated: true }
    })

    // Store as v1 bare payload
    mockStore[TEST_KEY] = JSON.stringify({ value: 50 })

    const customOptions: StorageAdapterOptions<{ value: number; migrated?: boolean }> = {
      key: TEST_KEY,
      version: CURRENT_SCHEMA_VERSION,
      sanitize: (raw: unknown) => {
        if (!raw || typeof raw !== 'object') return { value: 0 }
        const r = raw as Record<string, unknown>
        return {
          value: typeof r.value === 'number' ? r.value : 0,
          migrated: r.migrated === true,
        }
      },
      migrate: migrateFn,
    }

    const result = await loadState(customOptions)
    expect(migrateFn).toHaveBeenCalled()
    expect(result).toEqual({ value: 50, migrated: true })
  })

  test('no migration needed when versions match', async () => {
    const envelope: PersistedEnvelope<{ value: number }> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      persistedAt: '2026-02-18T12:00:00',
      payload: { value: 100 },
    }
    mockStore[TEST_KEY] = JSON.stringify(envelope)

    const migrateFn = jest.fn()
    const opts = { ...testOptions, migrate: migrateFn }
    await loadState(opts)

    expect(migrateFn).not.toHaveBeenCalled()
  })

  test('v1 NutritionScoreState (bare) migrates to v2 envelope', async () => {
    // Simulate v1 data: bare NutritionScoreState without envelope
    const v1State = createEmptyScoreState()
    const entry = createLogEntry(['carrot'], { vitaminA: 5 })
    const v1Updated = recordLog(v1State, entry)

    mockStore[scoreOptions.key] = JSON.stringify(v1Updated)

    const result = await loadState(scoreOptions)
    expect(result).not.toBeNull()
    expect(result!.activeCycle.logs).toHaveLength(1)
    expect(result!.totalLifetimeScans).toBe(1)

    // Verify re-persisted as envelope
    const rePersisted = JSON.parse(mockStore[scoreOptions.key])
    expect(rePersisted.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})

// ── Cycle Reset After Restore Tests ──────────────────────────

describe('Cycle reset correctness after restore', () => {
  test('active cycle is NOT reset when restored within 30 days', () => {
    const state = createEmptyScoreState()
    const entry = createLogEntry(['kale'], { vitaminC: 10 })
    const withLog = recordLog(state, entry)

    // Cycle should still be active (started today)
    expect(isCycleExpired(withLog.activeCycle)).toBe(false)

    const afterReset = processMonthlyReset(withLog)
    // Should be unchanged — no reset needed
    expect(afterReset.activeCycle.logs).toHaveLength(1)
    expect(afterReset.completedCycles).toHaveLength(0)
    expect(afterReset.lifetimeScore).toBe(0)
  })

  test('expired cycle is finalized and new cycle created on restore', () => {
    // Create a cycle that started 31 days ago
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 31)
    const y = pastDate.getFullYear()
    const m = String(pastDate.getMonth() + 1).padStart(2, '0')
    const d = String(pastDate.getDate()).padStart(2, '0')
    const startDate = `${y}-${m}-${d}`

    const state = createEmptyScoreState()
    const oldCycle = createNewCycle(startDate)
    // Add a log to the old cycle
    const entry = createLogEntry(['spinach', 'kale', 'beet'], {
      vitaminC: 10,
      iron: 3,
      potassium: 200,
    })
    oldCycle.logs = [entry]

    const stateWithOldCycle: NutritionScoreState = {
      ...state,
      activeCycle: oldCycle,
    }

    expect(isCycleExpired(stateWithOldCycle.activeCycle)).toBe(true)

    const afterReset = processMonthlyReset(stateWithOldCycle)

    // Old cycle should be finalized and moved to completedCycles
    expect(afterReset.completedCycles).toHaveLength(1)
    expect(afterReset.completedCycles[0].finalScore).toBeGreaterThan(0)

    // New active cycle should be fresh (started today)
    expect(afterReset.activeCycle.startDate).toBe(getTodayISO())
    expect(afterReset.activeCycle.logs).toHaveLength(0)

    // Lifetime score should include the finalized cycle score
    expect(afterReset.lifetimeScore).toBe(afterReset.completedCycles[0].finalScore)
  })

  test('score breakdown is consistent after restore + reset', () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 31)
    const y = pastDate.getFullYear()
    const m = String(pastDate.getMonth() + 1).padStart(2, '0')
    const d = String(pastDate.getDate()).padStart(2, '0')
    const startDate = `${y}-${m}-${d}`

    const state = createEmptyScoreState()
    const oldCycle = createNewCycle(startDate)
    const entry = createLogEntry(['spinach', 'kale'], { vitaminC: 10, iron: 3 })
    oldCycle.logs = [entry]

    const stateWithOldCycle: NutritionScoreState = {
      ...state,
      activeCycle: oldCycle,
    }

    // Compute breakdown BEFORE reset
    const breakdownBefore = computeScoreBreakdown(oldCycle)
    const momentumBefore = breakdownBefore.totalMomentum

    // Process reset
    const afterReset = processMonthlyReset(stateWithOldCycle)

    // Finalized score should match the pre-reset breakdown
    expect(afterReset.completedCycles[0].finalScore).toBe(momentumBefore)

    // New cycle should have 0 momentum
    const newBreakdown = computeScoreBreakdown(afterReset.activeCycle)
    expect(newBreakdown.totalMomentum).toBe(0)

    // Total score = lifetime (finalized) + current momentum (0)
    expect(afterReset.lifetimeScore + currentMomentum(afterReset)).toBe(momentumBefore)
  })

  test('multiple expired cycles accumulate lifetime score correctly', () => {
    const state = createEmptyScoreState()

    // Simulate two expired cycles
    const date1 = new Date()
    date1.setDate(date1.getDate() - 62)
    const s1 = `${date1.getFullYear()}-${String(date1.getMonth() + 1).padStart(2, '0')}-${String(date1.getDate()).padStart(2, '0')}`

    const cycle1 = createNewCycle(s1)
    cycle1.logs = [createLogEntry(['kale'], { vitaminC: 10 })]
    const finalized1 = { ...cycle1, finalScore: computeScoreBreakdown(cycle1).totalMomentum }

    const date2 = new Date()
    date2.setDate(date2.getDate() - 31)
    const s2 = `${date2.getFullYear()}-${String(date2.getMonth() + 1).padStart(2, '0')}-${String(date2.getDate()).padStart(2, '0')}`

    const cycle2 = createNewCycle(s2)
    cycle2.logs = [createLogEntry(['spinach', 'beet'], { iron: 5, potassium: 100 })]

    const stateWithHistory: NutritionScoreState = {
      ...state,
      activeCycle: cycle2,
      completedCycles: [finalized1],
      lifetimeScore: finalized1.finalScore || 0,
    }

    const afterReset = processMonthlyReset(stateWithHistory)

    // Should have 2 completed cycles now
    expect(afterReset.completedCycles).toHaveLength(2)

    // Lifetime should be sum of both finalized scores
    const score1 = finalized1.finalScore || 0
    const score2 = afterReset.completedCycles[1].finalScore || 0
    expect(afterReset.lifetimeScore).toBe(score1 + score2)
  })
})

// ── Persistence Mechanics Tests ──────────────────────────────

describe('Persistence mechanics', () => {
  test('saveStateImmediate writes envelope with correct schema version', async () => {
    await saveStateImmediate(TEST_KEY, CURRENT_SCHEMA_VERSION, { value: 123 })

    const stored = JSON.parse(mockStore[TEST_KEY])
    expect(stored.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(stored.payload).toEqual({ value: 123 })
    expect(stored.persistedAt).toBeDefined()
    // persistedAt should be a local-time ISO string
    expect(stored.persistedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })

  test('clearState removes key from storage', async () => {
    mockStore[TEST_KEY] = JSON.stringify({ value: 1 })
    await clearState(TEST_KEY)
    expect(mockStore[TEST_KEY]).toBeUndefined()
  })

  test('resetAllStorageKeys clears all known keys', async () => {
    mockStore['@juicing_nutrition_score_v1'] = 'data1'
    mockStore['@juicing_challenge_v1'] = 'data2'
    mockStore['@juicing_user_profile_v1'] = 'data3'

    await resetAllStorageKeys()

    expect(mockStore['@juicing_nutrition_score_v1']).toBeUndefined()
    expect(mockStore['@juicing_challenge_v1']).toBeUndefined()
    expect(mockStore['@juicing_user_profile_v1']).toBeUndefined()
  })

  test('flushPendingWrite does not crash for unknown keys', () => {
    expect(() => flushPendingWrite('nonexistent_key')).not.toThrow()
  })
})

// ── Timezone Edge Cases ──────────────────────────────────────

describe('Timezone edge cases', () => {
  test('getTodayISO returns local date format', () => {
    const today = getTodayISO()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Should match local date components
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(today).toBe(expected)
  })

  test('cycle end date is exactly CYCLE_DAYS-1 after start', () => {
    const state = createEmptyScoreState()
    const start = state.activeCycle.startDate
    const end = state.activeCycle.endDate

    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    const startMs = new Date(sy, sm - 1, sd).getTime()
    const endMs = new Date(ey, em - 1, ed).getTime()
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))

    expect(diffDays).toBe(CYCLE_DAYS - 1)
  })

  test('log entry timestamp uses local date prefix', () => {
    const entry = createLogEntry(['kale'], { vitaminC: 10 })
    const datePart = entry.timestamp.split('T')[0]
    expect(datePart).toBe(getTodayISO())
  })
})
