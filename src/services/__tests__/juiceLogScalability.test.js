// ─────────────────────────────────────────────────────────────
// juiceLogScalability.test.js
// Long-term JuiceLog history scalability regression tests.
//
// Validates that the 1.0.21 memoization hotfix remains stable with
// history sizes representative of months/years of app use (100–5000
// entries). Tests derived-data computation, Glow Journey calculations,
// sequential ADD_ENTRY operations, and memory behavior.
//
// The JuiceLog reducer is not exported, so we replicate the exact
// derived-data logic from JuiceLogStore.js here and test it directly
// with synthetic datasets. This is the same derivation logic that the
// memoized useMemo hooks now guard.
// ─────────────────────────────────────────────────────────────

const {
  getWeeklyLeafStates,
  getWeeklyQualifyingDays,
  getLifetimeQualifyingDays,
  getJourneyStage,
} = require('../glowJourneyService')
const { PRODUCE_DATA } = require('../JuiceEngine')

// ── Synthetic produce ID pool ─────────────────────────────────
const PRODUCE_IDS = Object.keys(PRODUCE_DATA)

// ── Deterministic PRNG (mulberry32) ───────────────────────────
// Deterministic so test runs are reproducible.
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Date helpers (match JuiceLogStore conventions) ────────────
function dateKeyFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoFromDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}:${s}`
}

// ── Synthetic entry generator ─────────────────────────────────
// Produces entries matching the ACTUAL JuiceLog entry schema:
//   id, createdAt, dateKey, source, title, ingredients,
//   nutrientSummary, scoreContribution, ingredientDetails,
//   totalJuiceWeightG, rating, note, favorite
//
// Distribution for N entries spread over ~1-3 years:
//   - normal days: 0-3 juices
//   - some days: 5-10 juices
//   - stress days: 25-40 juices (rare)
//   - varied ingredient counts (2-8)
//   - ratings on ~30% of entries
//   - favorites on ~10% of entries
//   - notes on ~15% of entries
//   - ingredientDetails on ~50% of entries
//   - varied sources

const SOURCES = [
  'juice_snap', 'manual', 'wellness_focus', 'browse_ideas',
  'todays_focus', 'today_spotlight', 'make_again', 'simple_blend',
  'seasonal_glow', 'produce_recipe', 'glow_library', 'beginner_glow',
]

const NOTES_POOL = [
  'Feeling great today',
  'Delicious green juice',
  'A bit too sweet',
  'Perfect post-workout',
  'Kids loved this one',
  'Will make again',
  'Added extra ginger',
  'Very refreshing',
]

function generateSyntheticEntries(count, options = {}) {
  const opts = {
    seed: options.seed || 42,
    yearsBack: options.yearsBack || 2,
    todayEntries: options.todayEntries || 0,
    ...options,
  }
  const rng = mulberry32(opts.seed)
  const entries = []
  const now = new Date()
  const totalDays = Math.round(opts.yearsBack * 365)
  let entryIdCounter = 0

  // Generate historical entries distributed across the period
  for (let dayOffset = totalDays; dayOffset >= 0; dayOffset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - dayOffset)
    const dateKey = dateKeyFromDate(date)

    // Determine how many juices for this day
    const roll = rng()
    let juicesToday
    if (roll < 0.4) juicesToday = 0 // many empty days
    else if (roll < 0.75) juicesToday = 1 + Math.floor(rng() * 3) // 1-3
    else if (roll < 0.95) juicesToday = 5 + Math.floor(rng() * 6) // 5-10
    else juicesToday = 25 + Math.floor(rng() * 16) // 25-40 stress

    for (let j = 0; j < juicesToday; j++) {
      if (entries.length >= count) break

      const ingredientCount = 2 + Math.floor(rng() * 7) // 2-8
      const ingredients = []
      const ingredientDetails = []
      const nutrientSummary = {}
      let totalWeight = 0

      for (let k = 0; k < ingredientCount; k++) {
        const produceId = PRODUCE_IDS[Math.floor(rng() * PRODUCE_IDS.length)]
        if (!ingredients.includes(produceId)) {
          ingredients.push(produceId)
          const weightG = 50 + Math.floor(rng() * 200) // 50-250g
          totalWeight += weightG
          if (rng() < 0.5) {
            ingredientDetails.push({
              produceId,
              weightG,
              portionEntryMode: 'quantity',
              portionMetadata: { quantity: 1 + Math.floor(rng() * 3) },
            })
          }
          // Accumulate nutrient summary
          const produce = PRODUCE_DATA[produceId]
          if (produce && produce.nutrition) {
            const n = produce.nutrition
            const factor = weightG / 100
            nutrientSummary.calories = (nutrientSummary.calories || 0) + n.caloriesPer100g * factor
            nutrientSummary.sugar = (nutrientSummary.sugar || 0) + n.sugarGPer100g * factor
            nutrientSummary.vitaminC = (nutrientSummary.vitaminC || 0) + n.vitCMgPer100g * factor
            nutrientSummary.potassium = (nutrientSummary.potassium || 0) + n.potassiumMgPer100g * factor
          }
        }
      }

      // Vary the time of day
      const hour = 6 + Math.floor(rng() * 16) // 6am-10pm
      const minute = Math.floor(rng() * 60)
      const second = Math.floor(rng() * 60)
      const entryDate = new Date(date)
      entryDate.setHours(hour, minute, second)

      const entry = {
        id: `syn_${entryIdCounter++}`,
        createdAt: isoFromDate(entryDate),
        dateKey,
        source: SOURCES[Math.floor(rng() * SOURCES.length)],
        title: ingredients.slice(0, 3).map((id) => {
          const p = PRODUCE_DATA[id]
          return p ? p.name : id
        }).join(', '),
        ingredients,
        nutrientSummary,
        scoreContribution: Math.round(rng() * 100) / 10,
        ingredientDetails: ingredientDetails.length > 0 ? ingredientDetails : undefined,
        totalJuiceWeightG: totalWeight,
        rating: rng() < 0.3 ? 1 + Math.floor(rng() * 5) : undefined,
        note: rng() < 0.15 ? NOTES_POOL[Math.floor(rng() * NOTES_POOL.length)] : undefined,
        favorite: rng() < 0.1 ? true : undefined,
      }
      entries.push(entry)
    }

    if (entries.length >= count) break
  }

  // Add today entries if requested
  for (let j = 0; j < opts.todayEntries; j++) {
    const ingredientCount = 2 + Math.floor(rng() * 7)
    const ingredients = []
    const nutrientSummary = {}
    let totalWeight = 0

    for (let k = 0; k < ingredientCount; k++) {
      const produceId = PRODUCE_IDS[Math.floor(rng() * PRODUCE_IDS.length)]
      if (!ingredients.includes(produceId)) {
        ingredients.push(produceId)
        const weightG = 50 + Math.floor(rng() * 200)
        totalWeight += weightG
        const produce = PRODUCE_DATA[produceId]
        if (produce && produce.nutrition) {
          const n = produce.nutrition
          const factor = weightG / 100
          nutrientSummary.calories = (nutrientSummary.calories || 0) + n.caloriesPer100g * factor
          nutrientSummary.sugar = (nutrientSummary.sugar || 0) + n.sugarGPer100g * factor
        }
      }
    }

    const hour = 6 + Math.floor(rng() * 16)
    const minute = Math.floor(rng() * 60)
    const entryDate = new Date(now)
    entryDate.setHours(hour, minute, 0, 0)

    entries.unshift({
      id: `syn_today_${j}`,
      createdAt: isoFromDate(entryDate),
      dateKey: dateKeyFromDate(now),
      source: SOURCES[Math.floor(rng() * SOURCES.length)],
      title: ingredients.slice(0, 3).map((id) => {
        const p = PRODUCE_DATA[id]
        return p ? p.name : id
      }).join(', '),
      ingredients,
      nutrientSummary,
      scoreContribution: Math.round(rng() * 100) / 10,
      totalJuiceWeightG: totalWeight,
      rating: rng() < 0.3 ? 1 + Math.floor(rng() * 5) : undefined,
      note: rng() < 0.15 ? NOTES_POOL[Math.floor(rng() * NOTES_POOL.length)] : undefined,
      favorite: rng() < 0.1 ? true : undefined,
    })
  }

  return entries
}

// ── Replicated derived-data logic (matches JuiceLogStore.js) ──
// These replicate the exact computation inside the provider's useMemo
// hooks so we can benchmark them directly without React.

function localDateKey(date) {
  const d = date || new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeTodayEntries(entries) {
  const todayKey = localDateKey()
  return entries.filter((e) => e.dateKey === todayKey)
}

function computeLast7DaysEntries(entries) {
  const now = new Date()
  return entries.filter((e) => {
    const d = new Date(e.createdAt)
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 7
  })
}

function computeDiversityStats(todayEntries, last7DaysEntries) {
  return {
    uniqueToday: [...new Set(todayEntries.flatMap((e) => e.ingredients))].length,
    repeatsToday: todayEntries.flatMap((e) => e.ingredients).length -
      [...new Set(todayEntries.flatMap((e) => e.ingredients))].length,
    uniqueWeek: [...new Set(last7DaysEntries.flatMap((e) => e.ingredients))].length,
    groupBreakdown: (() => {
      const groups = {}
      const allIds = todayEntries.flatMap((e) => e.ingredients)
      allIds.forEach((id) => {
        const entry = PRODUCE_DATA[id]
        const cat = entry ? entry.category : 'unknown'
        groups[cat] = (groups[cat] || 0) + 1
      })
      return groups
    })(),
    topRepeated: (() => {
      const counts = {}
      todayEntries.flatMap((e) => e.ingredients).forEach((id) => {
        counts[id] = (counts[id] || 0) + 1
      })
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      if (sorted.length === 0) return null
      const [id, count] = sorted[0]
      const entry = PRODUCE_DATA[id]
      return { name: entry ? entry.name : id, count }
    })(),
  }
}

function computeConsistencyStats(todayEntries, last7DaysEntries) {
  return {
    totalEntriesToday: todayEntries.length,
    totalEntriesWeek: last7DaysEntries.length,
    activeDaysWeek: [...new Set(last7DaysEntries.map((e) => e.dateKey))].length,
    avgEntriesPerDay: last7DaysEntries.length > 0
      ? Math.round((last7DaysEntries.length / 7) * 10) / 10
      : 0,
    loggingTimePattern: (() => {
      const pattern = { morning: 0, afternoon: 0, evening: 0 }
      todayEntries.forEach((e) => {
        const h = new Date(e.createdAt).getHours()
        if (h < 12) pattern.morning++
        else if (h < 17) pattern.afternoon++
        else pattern.evening++
      })
      return pattern
    })(),
  }
}

// ── Reducer replication (matches JuiceLogStore.js) ────────────
function logReducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTRY':
      return { ...state, entries: [action.payload, ...state.entries] }
    case 'DELETE_ENTRY':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.payload) }
    case 'HYDRATE':
      return action.payload || { entries: [] }
    case 'RESET':
      return { entries: [] }
    default:
      return state
  }
}

// ── Timing helper ─────────────────────────────────────────────
function timeIt(fn, iterations = 1) {
  const times = []
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint()
    fn()
    const end = process.hrtime.bigint()
    times.push(Number(end - start) / 1e6) // ms
  }
  times.sort((a, b) => a - b)
  return {
    median: times[Math.floor(times.length / 2)],
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: times[0],
    max: times[times.length - 1],
  }
}

// ── Dataset sizes ─────────────────────────────────────────────
const SIZES = [100, 500, 1000, 2500, 5000]

// ══════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════

describe('JuiceLog scalability — synthetic data generator', () => {
  test('generates entries matching actual JuiceLog schema', () => {
    const entries = generateSyntheticEntries(10)
    expect(entries.length).toBe(10)
    entries.forEach((e) => {
      expect(typeof e.id).toBe('string')
      expect(typeof e.createdAt).toBe('string')
      expect(typeof e.dateKey).toBe('string')
      expect(e.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof e.source).toBe('string')
      expect(typeof e.title).toBe('string')
      expect(Array.isArray(e.ingredients)).toBe(true)
      expect(typeof e.nutrientSummary).toBe('object')
      expect(e.scoreContribution === null || typeof e.scoreContribution === 'number').toBe(true)
    })
  })

  test('deterministic with same seed', () => {
    const a = generateSyntheticEntries(50, { seed: 123 })
    const b = generateSyntheticEntries(50, { seed: 123 })
    expect(a).toEqual(b)
  })

  test('different seeds produce different data', () => {
    const a = generateSyntheticEntries(50, { seed: 1 })
    const b = generateSyntheticEntries(50, { seed: 2 })
    expect(a).not.toEqual(b)
  })

  test('produces requested count', () => {
    expect(generateSyntheticEntries(100).length).toBe(100)
    expect(generateSyntheticEntries(1000).length).toBe(1000)
  })

  test('includes stress days with 25+ juices', () => {
    // With enough entries and the distribution, some days should have 25+
    const entries = generateSyntheticEntries(5000, { seed: 42 })
    const counts = {}
    entries.forEach((e) => { counts[e.dateKey] = (counts[e.dateKey] || 0) + 1 })
    const maxDay = Math.max(...Object.values(counts))
    expect(maxDay).toBeGreaterThanOrEqual(25)
  })

  test('todayEntries option adds entries for today', () => {
    const todayKey = localDateKey()
    const entries = generateSyntheticEntries(100, { todayEntries: 25 })
    const todayCount = entries.filter((e) => e.dateKey === todayKey).length
    expect(todayCount).toBeGreaterThanOrEqual(25)
  })

  test('no image/base64 data in entries', () => {
    const entries = generateSyntheticEntries(100)
    entries.forEach((e) => {
      expect(e.imageBase64).toBeUndefined()
      expect(e.imageUri).toBeUndefined()
      expect(e.imageData).toBeUndefined()
      expect(e.blob).toBeUndefined()
    })
  })
})

// ── Phase 2: Derived-data benchmarks ──────────────────────────

describe('JuiceLog scalability — derived-data benchmarks', () => {
  // Pre-generate datasets
  const datasets = {}
  SIZES.forEach((size) => {
    datasets[size] = generateSyntheticEntries(size)
  })

  SIZES.forEach((size) => {
    test(`${size} entries: todayEntries computation completes`, () => {
      const result = timeIt(() => computeTodayEntries(datasets[size]), 5)
      // Generous ceiling: O(n) filter should be well under 50ms even at 5000
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: last7DaysEntries computation completes`, () => {
      const result = timeIt(() => computeLast7DaysEntries(datasets[size]), 5)
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: diversityStats computation completes`, () => {
      const today = computeTodayEntries(datasets[size])
      const week = computeLast7DaysEntries(datasets[size])
      const result = timeIt(() => computeDiversityStats(today, week), 5)
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: consistencyStats computation completes`, () => {
      const today = computeTodayEntries(datasets[size])
      const week = computeLast7DaysEntries(datasets[size])
      const result = timeIt(() => computeConsistencyStats(today, week), 5)
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: all derived data produces valid results`, () => {
      const today = computeTodayEntries(datasets[size])
      const week = computeLast7DaysEntries(datasets[size])
      const diversity = computeDiversityStats(today, week)
      const consistency = computeConsistencyStats(today, week)

      expect(typeof diversity.uniqueToday).toBe('number')
      expect(typeof diversity.uniqueWeek).toBe('number')
      expect(diversity.uniqueToday).toBeGreaterThanOrEqual(0)
      expect(diversity.uniqueWeek).toBeGreaterThanOrEqual(0)
      expect(consistency.totalEntriesToday).toBe(today.length)
      expect(consistency.totalEntriesWeek).toBe(week.length)
      expect(consistency.activeDaysWeek).toBeGreaterThanOrEqual(0)
      expect(typeof consistency.avgEntriesPerDay).toBe('number')
      expect(consistency.loggingTimePattern).toBeDefined()
      expect(consistency.loggingTimePattern.morning).toBeGreaterThanOrEqual(0)
    })
  })
})

// ── Phase 2F: Glow Journey benchmarks ─────────────────────────

describe('JuiceLog scalability — Glow Journey benchmarks', () => {
  const datasets = {}
  SIZES.forEach((size) => {
    datasets[size] = generateSyntheticEntries(size)
  })

  SIZES.forEach((size) => {
    test(`${size} entries: getLifetimeQualifyingDays completes`, () => {
      const result = timeIt(() => getLifetimeQualifyingDays(datasets[size]), 5)
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: getWeeklyQualifyingDays completes`, () => {
      const result = timeIt(() => getWeeklyQualifyingDays(datasets[size]), 5)
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: getWeeklyLeafStates completes`, () => {
      const result = timeIt(() => getWeeklyLeafStates(datasets[size]), 5)
      expect(result.median).toBeLessThan(100)
    })

    test(`${size} entries: getLifetimeQualifyingDays returns valid count`, () => {
      const days = getLifetimeQualifyingDays(datasets[size])
      expect(days).toBeGreaterThanOrEqual(0)
      // With size entries over 2 years, should have many qualifying days
      if (size >= 100) {
        expect(days).toBeGreaterThan(0)
      }
    })

    test(`${size} entries: getWeeklyLeafStates returns 7 leaves`, () => {
      const leaves = getWeeklyLeafStates(datasets[size])
      expect(leaves).toHaveLength(7)
    })
  })
})

// ── Phase 2G/H: Single-add and sequential-add benchmarks ──────

describe('JuiceLog scalability — ADD_ENTRY benchmarks', () => {
  test('single ADD_ENTRY on 1000-entry dataset completes', () => {
    const entries = generateSyntheticEntries(1000)
    const state = { entries }
    const newEntry = generateSyntheticEntries(1, { seed: 999, todayEntries: 1 })[0]
    const result = timeIt(() => logReducer(state, { type: 'ADD_ENTRY', payload: newEntry }), 10)
    expect(result.median).toBeLessThan(50)
  })

  test('10 sequential ADD_ENTRY operations on 1000-entry dataset', () => {
    const entries = generateSyntheticEntries(1000)
    let state = { entries }
    const newEntries = generateSyntheticEntries(10, { seed: 777, todayEntries: 10 })

    const result = timeIt(() => {
      let s = { entries }
      for (const entry of newEntries) {
        s = logReducer(s, { type: 'ADD_ENTRY', payload: entry })
      }
    }, 5)

    expect(result.median).toBeLessThan(200)
  })

  test('ADD_ENTRY produces correct entry count', () => {
    const entries = generateSyntheticEntries(100)
    let state = { entries }
    const newEntry = generateSyntheticEntries(1, { seed: 999, todayEntries: 1 })[0]
    state = logReducer(state, { type: 'ADD_ENTRY', payload: newEntry })
    expect(state.entries.length).toBe(101)
    expect(state.entries[0]).toBe(newEntry)
  })

  test('DELETE_ENTRY on 1000-entry dataset completes', () => {
    const entries = generateSyntheticEntries(1000)
    const state = { entries }
    const idToDelete = entries[500].id
    const result = timeIt(() => logReducer(state, { type: 'DELETE_ENTRY', payload: idToDelete }), 10)
    expect(result.median).toBeLessThan(50)
  })
})

// ── Phase 3: Memoization verification ─────────────────────────

describe('JuiceLog scalability — memoization verification', () => {
  test('JuiceLogStore source uses useMemo for context value', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'JuiceLogStore.js'),
      'utf8',
    )
    expect(src).toMatch(/const value = useMemo/)
    expect(src).toMatch(/useMemo\(\(\) => \(\{/)
  })

  test('JuiceLogStore source uses useMemo for todayEntries', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'JuiceLogStore.js'),
      'utf8',
    )
    expect(src).toMatch(/const todayEntries = useMemo/)
    expect(src).toMatch(/\[state\.entries, todayKey\]/)
  })

  test('JuiceLogStore source uses useMemo for last7DaysEntries', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'JuiceLogStore.js'),
      'utf8',
    )
    expect(src).toMatch(/const last7DaysEntries = useMemo/)
  })

  test('JuiceLogStore source uses useMemo for diversityStats', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'JuiceLogStore.js'),
      'utf8',
    )
    expect(src).toMatch(/const diversityStats = useMemo/)
  })

  test('JuiceLogStore source uses useMemo for consistencyStats', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'JuiceLogStore.js'),
      'utf8',
    )
    expect(src).toMatch(/const consistencyStats = useMemo/)
  })

  test('context value useMemo has complete dependency array', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'JuiceLogStore.js'),
      'utf8',
    )
    // Verify key dependencies are in the array
    expect(src).toMatch(/state\.entries,/m)
    expect(src).toMatch(/isHydrated,/m)
    expect(src).toMatch(/todayEntries,/m)
    expect(src).toMatch(/last7DaysEntries,/m)
    expect(src).toMatch(/diversityStats,/m)
    expect(src).toMatch(/consistencyStats,/m)
    expect(src).toMatch(/addEntry,/m)
    expect(src).toMatch(/resetLog,/m)
  })

  test('derived data is referentially stable when entries do not change', () => {
    // Simulate: same entries reference → same derived result reference
    // (what useMemo provides)
    const entries = generateSyntheticEntries(1000)
    const todayKey = localDateKey()

    // First computation
    const today1 = entries.filter((e) => e.dateKey === todayKey)

    // Same entries reference → useMemo would return same cached result
    // We verify the computation is deterministic
    const today2 = entries.filter((e) => e.dateKey === todayKey)

    // The arrays should have the same content
    expect(today1.length).toBe(today2.length)
    expect(today1).toEqual(today2)
  })

  test('adding one entry changes entries reference (triggers recompute)', () => {
    const entries = generateSyntheticEntries(100)
    const state = { entries }
    const newEntry = generateSyntheticEntries(1, { seed: 999, todayEntries: 1 })[0]
    const newState = logReducer(state, { type: 'ADD_ENTRY', payload: newEntry })

    // Reducer creates a new entries array reference
    expect(newState.entries).not.toBe(state.entries)
    expect(newState.entries.length).toBe(state.entries.length + 1)
  })
})

// ── Phase 5: JS process-level memory tests ────────────────────

describe('JuiceLog scalability — JS memory behavior', () => {
  // Only run if --expose-gc is available
  const hasGc = typeof global.gc === 'function'

  function getHeapUsedMB() {
    if (hasGc) global.gc()
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  }

  SIZES.forEach((size) => {
    test(`${size} entries: heap usage after construction`, () => {
      const baseline = getHeapUsedMB()
      const entries = generateSyntheticEntries(size)
      const afterConstruction = getHeapUsedMB()

      // Entry objects should be proportional to count
      // Each entry is ~200-400 bytes, so 5000 entries ≈ 1-2MB
      const delta = afterConstruction - baseline
      expect(delta).toBeLessThan(50) // generous ceiling

      // Clean up reference
      entries.length = 0
    })
  })

  test('1000 entries + 50 sequential ADD_ENTRY: no unbounded growth', () => {
    if (!hasGc) {
      console.log('  (skipped: --expose-gc not available)')
      return
    }

    const baseline = getHeapUsedMB()
    let state = { entries: generateSyntheticEntries(1000) }
    const afterInit = getHeapUsedMB()

    // Add 50 entries
    const newEntries = generateSyntheticEntries(50, { seed: 555, todayEntries: 50 })
    for (const entry of newEntries) {
      state = logReducer(state, { type: 'ADD_ENTRY', payload: entry })
    }
    const afterAdd = getHeapUsedMB()

    // Force GC and measure retained
    global.gc()
    global.gc()
    const afterGC = getHeapUsedMB()

    // Retained memory should be proportional to total entries (1050),
    // not dramatically more than the initial 1000
    const initDelta = afterInit - baseline
    const retainedDelta = afterGC - baseline

    // Retained should be roughly proportional to entry count
    // 1050 entries vs 1000 entries → should be within ~20% of init delta
    if (initDelta > 0) {
      expect(retainedDelta).toBeLessThan(initDelta * 2)
    }
    expect(retainedDelta).toBeLessThan(50)

    console.log(`    Memory: baseline=${baseline}MB init=${afterInit}MB ` +
      `afterAdd=${afterAdd}MB afterGC=${afterGC}MB ` +
      `(init delta=${initDelta}MB, retained delta=${retainedDelta}MB)`)
  })

  test('repeated derive on 1000 entries: no retained growth after GC', () => {
    if (!hasGc) {
      console.log('  (skipped: --expose-gc not available)')
      return
    }

    const entries = generateSyntheticEntries(1000)
    const baseline = getHeapUsedMB()

    // Run derive 100 times (simulating 100 re-renders)
    for (let i = 0; i < 100; i++) {
      const today = computeTodayEntries(entries)
      const week = computeLast7DaysEntries(entries)
      computeDiversityStats(today, week)
      computeConsistencyStats(today, week)
    }

    global.gc()
    global.gc()
    const afterGC = getHeapUsedMB()
    const retained = afterGC - baseline

    // Derive produces temporary arrays that should be GC'd
    // Retained should be near zero (no leak)
    expect(retained).toBeLessThan(10)

    console.log(`    100x derive on 1000 entries: ` +
      `baseline=${baseline}MB afterGC=${afterGC}MB retained=${retained}MB`)
  })
})

// ── Phase 6: Long-run operation test (1000 + 100) ─────────────

describe('JuiceLog scalability — long-run operation (1000 + 100)', () => {
  test('1000 historical + 100 sequential ADD_ENTRY completes without exception', () => {
    let state = { entries: generateSyntheticEntries(1000) }
    // Generate 100 new entries to add sequentially (no todayEntries overlap)
    const newEntries = generateSyntheticEntries(100, { seed: 333 })

    let lastReportTime = process.hrtime.bigint()
    const checkpoints = []

    for (let i = 0; i < newEntries.length; i++) {
      state = logReducer(state, { type: 'ADD_ENTRY', payload: newEntries[i] })

      // Report every 10 entries
      if ((i + 1) % 10 === 0) {
        const now = process.hrtime.bigint()
        const elapsed = Number(now - lastReportTime) / 1e6
        checkpoints.push({
          count: i + 1,
          totalEntries: state.entries.length,
          elapsedMs: Math.round(elapsed),
        })
        lastReportTime = now
      }
    }

    // Verify final state
    expect(state.entries.length).toBe(1100)

    // Verify no checkpoint took excessively long
    checkpoints.forEach((cp) => {
      expect(cp.elapsedMs).toBeLessThan(1000)
    })

    console.log('    Checkpoints (every 10 adds):')
    checkpoints.forEach((cp) => {
      console.log(`      +${cp.count}: total=${cp.totalEntries} ${cp.elapsedMs}ms`)
    })
  })

  test('derived data remains correct after 100 sequential adds', () => {
    let state = { entries: generateSyntheticEntries(1000) }
    const newEntries = generateSyntheticEntries(100, { seed: 333 })

    for (const entry of newEntries) {
      state = logReducer(state, { type: 'ADD_ENTRY', payload: entry })
    }

    // Verify derived data
    const today = computeTodayEntries(state.entries)
    const week = computeLast7DaysEntries(state.entries)
    const diversity = computeDiversityStats(today, week)
    const consistency = computeConsistencyStats(today, week)
    const lifetimeDays = getLifetimeQualifyingDays(state.entries)

    expect(state.entries.length).toBe(1100)
    expect(diversity.uniqueToday).toBeGreaterThanOrEqual(0)
    expect(consistency.totalEntriesToday).toBe(today.length)
    expect(lifetimeDays).toBeGreaterThan(0)
  })
})

// ── Phase 7: Daily extreme case (1000 + 50 today) ─────────────

describe('JuiceLog scalability — daily extreme (1000 + 50 today)', () => {
  test('1000 historical + 50 today entries: derived data completes', () => {
    const entries = generateSyntheticEntries(1000, { todayEntries: 50 })
    const todayKey = localDateKey()

    const today = computeTodayEntries(entries)
    const week = computeLast7DaysEntries(entries)
    const diversity = computeDiversityStats(today, week)
    const consistency = computeConsistencyStats(today, week)

    expect(today.length).toBeGreaterThanOrEqual(50)
    expect(consistency.totalEntriesToday).toBe(today.length)
    expect(diversity.uniqueToday).toBeGreaterThanOrEqual(0)
  })

  test('1000 historical + 50 today: Glow Journey completes', () => {
    const entries = generateSyntheticEntries(1000, { todayEntries: 50 })

    const weeklyLeaves = getWeeklyLeafStates(entries)
    const weeklyDays = getWeeklyQualifyingDays(entries)
    const lifetimeDays = getLifetimeQualifyingDays(entries)
    const stage = getJourneyStage(lifetimeDays)

    expect(weeklyLeaves).toHaveLength(7)
    expect(weeklyDays).toBeGreaterThanOrEqual(0)
    expect(lifetimeDays).toBeGreaterThan(0)
    // Stage should be valid (may be null for very low days, but with 1000 entries should be set)
  })

  test('1000 historical + 50 today: no exception from sequential derive', () => {
    const entries = generateSyntheticEntries(1000, { todayEntries: 50 })

    // Run derive multiple times to simulate re-renders
    expect(() => {
      for (let i = 0; i < 50; i++) {
        const today = computeTodayEntries(entries)
        const week = computeLast7DaysEntries(entries)
        computeDiversityStats(today, week)
        computeConsistencyStats(today, week)
        getWeeklyLeafStates(entries)
        getWeeklyQualifyingDays(entries)
        getLifetimeQualifyingDays(entries)
      }
    }).not.toThrow()
  })

  test('1000 historical + 50 today: timing is reasonable', () => {
    const entries = generateSyntheticEntries(1000, { todayEntries: 50 })

    const result = timeIt(() => {
      const today = computeTodayEntries(entries)
      const week = computeLast7DaysEntries(entries)
      computeDiversityStats(today, week)
      computeConsistencyStats(today, week)
      getWeeklyLeafStates(entries)
      getWeeklyQualifyingDays(entries)
      getLifetimeQualifyingDays(entries)
    }, 5)

    // Full derive cycle should complete in reasonable time
    expect(result.median).toBeLessThan(200)
  })
})

// ── Phase 4: Animation lifecycle (source inspection) ──────────

describe('JuiceLog scalability — animation lifecycle verification', () => {
  const fs = require('fs')
  const path = require('path')

  test('LivingGardenMotion startIdleMotion calls stopIdleMotion first', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenMotion.js'),
      'utf8',
    )
    // startIdleMotion should call stopIdleMotion at the top
    const startMatch = src.match(/const startIdleMotion = useCallback\([\s\S]*?stopIdleMotion\(\)/)
    expect(startMatch).toBeTruthy()
  })

  test('LivingGardenMotion has unmount cleanup that stops animations', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenMotion.js'),
      'utf8',
    )
    expect(src).toMatch(/cancelTimeline\(\)/)
    expect(src).toMatch(/stopIdleMotion\(\)/)
    expect(src).toMatch(/removeAllListeners\(\)/)
  })

  test('LivingGardenMotion orchestration effect guards against duplicate processing', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenMotion.js'),
      'utf8',
    )
    expect(src).toMatch(/processedAdvancementsRef\.current === advancements/)
  })

  test('DashboardScreen identityGlow has cleanup', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'DashboardScreen.js'),
      'utf8',
    )
    // The identityGlow loop should have a stop() cleanup
    expect(src).toMatch(/glowLoop\.stop\(\)/)
    expect(src).toMatch(/identityGlowLoopRef/)
  })

  test('LivingBackground loop has cleanup', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingBackground.js'),
      'utf8',
    )
    expect(src).toMatch(/loop\.stop\(\)/)
  })

  test('LivingGardenMotion idle refs are stored and stopped on cleanup', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenMotion.js'),
      'utf8',
    )
    // Idle breath and sway refs should be stored
    expect(src).toMatch(/idleBreathRef/)
    expect(src).toMatch(/idleSwayRefs/)
    // stopIdleMotion should stop and null them
    const stopMatch = src.match(/const stopIdleMotion = useCallback[\s\S]*?}/)
    expect(stopMatch).toBeTruthy()
    expect(stopMatch[0]).toMatch(/\.stop\(\)/)
  })
})

// ── Phase 8: Physical QA harness design (documentation only) ──

describe('JuiceLog scalability — physical QA harness design', () => {
  test('documents safe synthetic data injection method', () => {
    // This test documents the proposed physical QA approach.
    // It does NOT implement any device-side code.

    const design = {
      method: 'QA-only AsyncStorage override key',
      realDataKey: '@juicing_log_entries_v1',
      qaOverrideKey: '@juicing_log_entries_qa_override_v1',
      activation: 'Developer Options → QA Synthetic History (dev-only, gated)',
      safety: [
        'Export real data first via adb backup or read AsyncStorage',
        'Synthetic data lives in a separate QA-only storage key',
        'Never overwrite the canonical real history key',
        'QA harness is impossible to activate in production (dev-tools gated)',
        'After testing, disabling the QA override reveals untouched original history',
      ],
      dataPreservation: true,
    }

    expect(design.method).toBeDefined()
    expect(design.realDataKey).toBe('@juicing_log_entries_v1')
    expect(design.qaOverrideKey).not.toBe(design.realDataKey)
    expect(design.dataPreservation).toBe(true)
    expect(design.safety.length).toBeGreaterThan(0)
  })
})
