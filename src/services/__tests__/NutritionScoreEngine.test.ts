// ─────────────────────────────────────────────────────────────
// NutritionScoreEngine.test.ts — Unit tests for pure scoring
// logic, cycle management, validation, and reset logic.
// ─────────────────────────────────────────────────────────────

import {
  createNewCycle,
  computeCycleEndDate,
  generateCycleId,
  isCycleExpired,
  finalizeCycle,
  processMonthlyReset,
  countUniqueIngredients,
  countNutrientsCovered,
  computeStreakInCycle,
  computeWeeklyActivityCount,
  computeScoreBreakdown,
  createEmptyScoreState,
  createLogEntry,
  recordLog,
  deriveNutrientsFromTotals,
  daysRemainingInCycle,
  daysElapsedInCycle,
  currentMomentum,
  totalScore,
  isValidISODate,
  isValidCycle,
  isValidLogEntry,
  MAX_MOMENTUM,
  CYCLE_DAYS,
  ALL_NUTRIENTS,
  DIMENSION_WEIGHTS,
  NORMALIZATION_CAPS,
  NutritionLogEntry,
  MomentumCycle,
  NutritionScoreState,
} from '../NutritionScoreEngine'

// ── Helpers ──────────────────────────────────────────────────

function makeLog(
  ingredientIds: string[],
  nutrients: string[],
  timestamp: string,
): NutritionLogEntry {
  return {
    id: `test-${Math.random().toString(36).substring(2, 6)}`,
    timestamp,
    ingredientIds,
    nutrientsDiscovered: nutrients,
    totalNutrients: Object.fromEntries(nutrients.map((n) => [n, 10])),
  }
}

function makeCycleWithLogs(
  startDate: string,
  logs: NutritionLogEntry[],
): MomentumCycle {
  return {
    cycleId: generateCycleId(startDate),
    startDate,
    endDate: computeCycleEndDate(startDate),
    logs,
    finalScore: null,
  }
}

// ── Validation ───────────────────────────────────────────────

describe('Validation helpers', () => {
  test('isValidISODate accepts valid dates', () => {
    expect(isValidISODate('2026-01-15')).toBe(true)
    expect(isValidISODate('2026-12-31')).toBe(true)
  })

  test('isValidISODate rejects invalid dates', () => {
    expect(isValidISODate('')).toBe(false)
    expect(isValidISODate('not-a-date')).toBe(false)
    expect(isValidISODate('2026/01/15')).toBe(false)
    // @ts-expect-error testing null input
    expect(isValidISODate(null)).toBe(false)
    // @ts-expect-error testing undefined input
    expect(isValidISODate(undefined)).toBe(false)
  })

  test('isValidCycle validates cycle shape', () => {
    const valid = createNewCycle('2026-01-01')
    expect(isValidCycle(valid)).toBe(true)
    expect(isValidCycle(null)).toBe(false)
    expect(isValidCycle({})).toBe(false)
    expect(isValidCycle({ cycleId: '2026-01', startDate: '2026-01-01' })).toBe(false)
  })

  test('isValidLogEntry validates log shape', () => {
    const valid = makeLog(['kale'], ['vitaminC'], '2026-01-15T10:00:00Z')
    expect(isValidLogEntry(valid)).toBe(true)
    expect(isValidLogEntry(null)).toBe(false)
    expect(isValidLogEntry({ id: 'x' })).toBe(false)
  })
})

// ── Cycle Management ─────────────────────────────────────────

describe('Cycle management', () => {
  test('createNewCycle creates a valid 30-day cycle', () => {
    const cycle = createNewCycle('2026-02-01')
    expect(cycle.cycleId).toBe('2026-02')
    expect(cycle.startDate).toBe('2026-02-01')
    expect(cycle.endDate).toBe('2026-03-02')
    expect(cycle.logs).toEqual([])
    expect(cycle.finalScore).toBeNull()
  })

  test('createNewCycle handles invalid date gracefully', () => {
    const cycle = createNewCycle('not-a-date')
    expect(isValidCycle(cycle)).toBe(true)
    expect(cycle.logs).toEqual([])
  })

  test('computeCycleEndDate adds 29 days', () => {
    expect(computeCycleEndDate('2026-01-01')).toBe('2026-01-30')
    expect(computeCycleEndDate('2026-02-01')).toBe('2026-03-02')
  })

  test('generateCycleId extracts YYYY-MM', () => {
    expect(generateCycleId('2026-03-15')).toBe('2026-03')
  })

  test('isCycleExpired returns false for future endDate', () => {
    const future = new Date()
    future.setDate(future.getDate() + 10)
    const cycle = createNewCycle(new Date().toISOString().split('T')[0])
    expect(isCycleExpired(cycle)).toBe(false)
  })

  test('isCycleExpired returns true for past endDate', () => {
    const cycle = createNewCycle('2020-01-01')
    expect(isCycleExpired(cycle)).toBe(true)
  })

  test('isCycleExpired returns false for invalid cycle', () => {
    // @ts-expect-error testing invalid input
    expect(isCycleExpired(null)).toBe(false)
    // @ts-expect-error testing invalid input
    expect(isCycleExpired({})).toBe(false)
  })
})

// ── Scoring Calculations ─────────────────────────────────────

describe('Scoring calculations', () => {
  const baseLogs = [
    makeLog(['kale', 'spinach', 'carrot'], ['vitaminC', 'vitaminA', 'iron'], '2026-02-01T10:00:00Z'),
    makeLog(['ginger', 'lemon'], ['vitaminC', 'potassium'], '2026-02-02T10:00:00Z'),
    makeLog(['beet', 'cucumber'], ['folate', 'magnesium'], '2026-02-03T10:00:00Z'),
  ]
  const cycle = makeCycleWithLogs('2026-02-01', baseLogs)

  test('countUniqueIngredients counts distinct IDs', () => {
    expect(countUniqueIngredients(cycle)).toBe(7)
  })

  test('countUniqueIngredients handles empty cycle', () => {
    const empty = createNewCycle('2026-01-01')
    expect(countUniqueIngredients(empty)).toBe(0)
  })

  test('countUniqueIngredients handles null/undefined safely', () => {
    // @ts-expect-error testing null
    expect(countUniqueIngredients(null)).toBe(0)
    // @ts-expect-error testing undefined
    expect(countUniqueIngredients(undefined)).toBe(0)
  })

  test('countNutrientsCovered counts distinct nutrients', () => {
    expect(countNutrientsCovered(cycle)).toBe(6)
  })

  test('computeStreakInCycle finds consecutive days', () => {
    expect(computeStreakInCycle(cycle)).toBe(3)
  })

  test('computeStreakInCycle returns 0 for empty cycle', () => {
    expect(computeStreakInCycle(createNewCycle())).toBe(0)
  })

  test('computeStreakInCycle handles gap in days', () => {
    const gapLogs = [
      makeLog(['kale'], ['vitaminC'], '2026-02-01T10:00:00Z'),
      makeLog(['kale'], ['vitaminC'], '2026-02-02T10:00:00Z'),
      makeLog(['kale'], ['vitaminC'], '2026-02-05T10:00:00Z'),
      makeLog(['kale'], ['vitaminC'], '2026-02-06T10:00:00Z'),
      makeLog(['kale'], ['vitaminC'], '2026-02-07T10:00:00Z'),
    ]
    const gapCycle = makeCycleWithLogs('2026-02-01', gapLogs)
    expect(computeStreakInCycle(gapCycle)).toBe(3)
  })

  test('computeScoreBreakdown returns valid structure', () => {
    const breakdown = computeScoreBreakdown(cycle)
    expect(breakdown).toHaveProperty('ingredientDiversity')
    expect(breakdown).toHaveProperty('nutrientCoverage')
    expect(breakdown).toHaveProperty('consistency')
    expect(breakdown).toHaveProperty('weeklyActivity')
    expect(breakdown).toHaveProperty('totalMomentum')
    expect(breakdown.totalMomentum).toBeGreaterThanOrEqual(0)
    expect(breakdown.totalMomentum).toBeLessThanOrEqual(MAX_MOMENTUM)
  })

  test('computeScoreBreakdown returns 0 for empty cycle', () => {
    const breakdown = computeScoreBreakdown(createNewCycle())
    expect(breakdown.totalMomentum).toBe(0)
  })

  test('dimension weights sum to 1.0', () => {
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001)
  })

  test('each dimension has correct weight and label', () => {
    const breakdown = computeScoreBreakdown(cycle)
    expect(breakdown.ingredientDiversity.weight).toBe(0.30)
    expect(breakdown.nutrientCoverage.weight).toBe(0.30)
    expect(breakdown.consistency.weight).toBe(0.20)
    expect(breakdown.weeklyActivity.weight).toBe(0.20)
    expect(breakdown.ingredientDiversity.label).toBe('Ingredient Diversity')
  })

  test('normalized values are clamped 0–1', () => {
    const breakdown = computeScoreBreakdown(cycle)
    for (const dim of [
      breakdown.ingredientDiversity,
      breakdown.nutrientCoverage,
      breakdown.consistency,
      breakdown.weeklyActivity,
    ]) {
      expect(dim.normalized).toBeGreaterThanOrEqual(0)
      expect(dim.normalized).toBeLessThanOrEqual(1)
    }
  })
})

// ── Log Recording ────────────────────────────────────────────

describe('Log recording', () => {
  test('deriveNutrientsFromTotals extracts non-zero nutrients', () => {
    const totals = { vitaminC: 50, iron: 0, sugar: 12, calories: 0 }
    const discovered = deriveNutrientsFromTotals(totals)
    expect(discovered).toContain('vitaminC')
    expect(discovered).toContain('sugar')
    expect(discovered).not.toContain('iron')
    expect(discovered).not.toContain('calories')
  })

  test('deriveNutrientsFromTotals handles null/undefined', () => {
    expect(deriveNutrientsFromTotals(null)).toEqual([])
    expect(deriveNutrientsFromTotals(undefined)).toEqual([])
  })

  test('createLogEntry creates valid entry', () => {
    const entry = createLogEntry(['kale', 'spinach'], { vitaminC: 50, iron: 2 })
    expect(isValidLogEntry(entry)).toBe(true)
    expect(entry.ingredientIds).toEqual(['kale', 'spinach'])
    expect(entry.nutrientsDiscovered).toContain('vitaminC')
    expect(entry.nutrientsDiscovered).toContain('iron')
  })

  test('createLogEntry filters invalid ingredient IDs', () => {
    // @ts-expect-error testing mixed input
    const entry = createLogEntry(['kale', '', null, 123, 'spinach'], { vitaminC: 50 })
    expect(entry.ingredientIds).toEqual(['kale', 'spinach'])
  })

  test('createLogEntry handles null totals', () => {
    const entry = createLogEntry(['kale'], null)
    expect(entry.nutrientsDiscovered).toEqual([])
    expect(entry.totalNutrients).toEqual({})
  })

  test('recordLog adds entry to state', () => {
    const state = createEmptyScoreState()
    const entry = createLogEntry(['kale', 'spinach'], { vitaminC: 50, iron: 2 })
    const next = recordLog(state, entry)
    expect(next.activeCycle.logs).toHaveLength(1)
    expect(next.totalLifetimeScans).toBe(1)
    expect(next.allTimeUniqueIngredients).toContain('kale')
    expect(next.allTimeUniqueIngredients).toContain('spinach')
    expect(next.allTimeNutrientsDiscovered).toContain('vitaminC')
  })

  test('recordLog rejects invalid entry', () => {
    const state = createEmptyScoreState()
    // @ts-expect-error testing invalid entry
    const next = recordLog(state, null)
    expect(next).toBe(state)
  })

  test('recordLog accumulates across multiple logs', () => {
    let state = createEmptyScoreState()
    state = recordLog(state, createLogEntry(['kale'], { vitaminC: 50 }))
    state = recordLog(state, createLogEntry(['spinach', 'carrot'], { iron: 2, vitaminA: 100 }))
    expect(state.activeCycle.logs).toHaveLength(2)
    expect(state.totalLifetimeScans).toBe(2)
    expect(state.allTimeUniqueIngredients).toHaveLength(3)
  })
})

// ── Monthly Reset ────────────────────────────────────────────

describe('Monthly reset', () => {
  test('processMonthlyReset does nothing for active cycle', () => {
    const state = createEmptyScoreState()
    const result = processMonthlyReset(state)
    expect(result.activeCycle.cycleId).toBe(state.activeCycle.cycleId)
    expect(result.completedCycles).toHaveLength(0)
  })

  test('processMonthlyReset finalizes expired cycle', () => {
    const state: NutritionScoreState = {
      ...createEmptyScoreState(),
      activeCycle: makeCycleWithLogs('2020-01-01', [
        makeLog(['kale'], ['vitaminC'], '2020-01-05T10:00:00Z'),
      ]),
    }
    const result = processMonthlyReset(state)
    expect(result.completedCycles).toHaveLength(1)
    expect(result.completedCycles[0].finalScore).not.toBeNull()
    expect(result.activeCycle.startDate).not.toBe('2020-01-01')
    expect(result.lifetimeScore).toBeGreaterThan(0)
  })

  test('finalizeCycle sets finalScore', () => {
    const cycle = makeCycleWithLogs('2026-01-01', [
      makeLog(['kale', 'spinach'], ['vitaminC', 'iron'], '2026-01-05T10:00:00Z'),
    ])
    const finalized = finalizeCycle(cycle)
    expect(finalized.finalScore).toBeGreaterThan(0)
    expect(finalized.finalScore).toBeLessThanOrEqual(MAX_MOMENTUM)
  })
})

// ── Computed Helpers ─────────────────────────────────────────

describe('Computed helpers', () => {
  test('daysRemainingInCycle returns positive for active cycle', () => {
    const cycle = createNewCycle()
    const remaining = daysRemainingInCycle(cycle)
    expect(remaining).toBeGreaterThanOrEqual(0)
    expect(remaining).toBeLessThanOrEqual(CYCLE_DAYS)
  })

  test('daysRemainingInCycle returns 0 for expired cycle', () => {
    const cycle = createNewCycle('2020-01-01')
    expect(daysRemainingInCycle(cycle)).toBe(0)
  })

  test('daysRemainingInCycle handles null endDate', () => {
    // @ts-expect-error testing invalid cycle
    expect(daysRemainingInCycle({ endDate: null })).toBe(CYCLE_DAYS)
  })

  test('daysElapsedInCycle is complement of remaining', () => {
    const cycle = createNewCycle()
    const remaining = daysRemainingInCycle(cycle)
    const elapsed = daysElapsedInCycle(cycle)
    expect(remaining + elapsed).toBe(CYCLE_DAYS)
  })

  test('createEmptyScoreState returns valid initial state', () => {
    const state = createEmptyScoreState()
    expect(isValidCycle(state.activeCycle)).toBe(true)
    expect(state.completedCycles).toEqual([])
    expect(state.lifetimeScore).toBe(0)
    expect(state.totalLifetimeScans).toBe(0)
    expect(state.longestEverStreak).toBe(0)
  })

  test('currentMomentum returns 0 for empty state', () => {
    expect(currentMomentum(createEmptyScoreState())).toBe(0)
  })

  test('totalScore includes lifetime + current momentum', () => {
    const state: NutritionScoreState = {
      ...createEmptyScoreState(),
      lifetimeScore: 500,
    }
    const score = totalScore(state)
    expect(score).toBe(500)
  })
})

// ── Constants ────────────────────────────────────────────────

describe('Constants', () => {
  test('MAX_MOMENTUM is 1000', () => {
    expect(MAX_MOMENTUM).toBe(1000)
  })

  test('CYCLE_DAYS is 30', () => {
    expect(CYCLE_DAYS).toBe(30)
  })

  test('ALL_NUTRIENTS has 8 entries', () => {
    expect(ALL_NUTRIENTS).toHaveLength(8)
  })

  test('NORMALIZATION_CAPS has all dimension keys', () => {
    expect(NORMALIZATION_CAPS.ingredientDiversity).toBe(20)
    expect(NORMALIZATION_CAPS.nutrientCoverage).toBe(8)
    expect(NORMALIZATION_CAPS.consistency).toBe(25)
    expect(NORMALIZATION_CAPS.weeklyActivity).toBe(10)
  })
})
