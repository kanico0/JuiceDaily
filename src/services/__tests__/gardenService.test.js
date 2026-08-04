// ─────────────────────────────────────────────────────────────
// gardenService.test.js — Tests for Garden taxonomy, derived
// progress model, normalization, baseline protection, and
// celebration persistence.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  GARDEN_BEDS,
  GARDEN_COLORS,
  getBedForProduce,
  getColorForProduce,
  BED_METADATA,
  COLOR_METADATA,
} from '../../constants/gardenTaxonomy'
import {
  normalizeProduceId,
  normalizeProduceIds,
  getDiscoveredProduce,
  getDiscoveredProduceSet,
  getProduceByBed,
  getBedCounts,
  getBedStage,
  getBedStages,
  getBedStageKey,
  getDiscoveredColors,
  getColorCoverage,
  getColorCounts,
  isRainbowHarvestComplete,
  getGardenSummary,
  getNextDiscoveryHint,
  detectNewDiscoveries,
  detectBedMilestones,
  detectRainbowHarvest,
  GARDEN_STAGES,
  STAGE_EMPTY,
  STAGE_SEED,
  STAGE_SPROUT,
  STAGE_GROWING,
  STAGE_HARVESTING,
  STAGE_FLOURISHING,
  initializeGardenBaseline,
  isBaselineInitialized,
  resetGardenCelebrations,
  shouldCelebrateBed,
  shouldCelebrateColor,
  shouldCelebrateRainbow,
  markBedCelebrated,
  markColorCelebrated,
  markRainbowCelebrated,
  getCelebratedBeds,
  getCelebratedColors,
  isRainbowCelebrated,
} from '../gardenService'

// ── Mock AsyncStorage ────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}))

beforeEach(() => {
  AsyncStorage.getItem.mockResolvedValue(null)
  AsyncStorage.setItem.mockResolvedValue(undefined)
  AsyncStorage.multiRemove.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.clearAllMocks()
})

// ── Helper: create entries with ingredient arrays ────────────
function makeEntries(ingredientGroups) {
  return ingredientGroups.map((ingredients, i) => ({
    id: `entry-${i}`,
    dateKey: `2026-01-${String(i + 1).padStart(2, '0')}`,
    ingredients,
  }))
}

// ── Taxonomy tests ───────────────────────────────────────────

describe('Garden taxonomy', () => {
  test('GARDEN_BEDS has exactly 7 beds', () => {
    expect(GARDEN_BEDS).toHaveLength(7)
  })

  test('GARDEN_COLORS has exactly 6 colors', () => {
    expect(GARDEN_COLORS).toHaveLength(6)
  })

  test('BED_METADATA has all 7 beds', () => {
    for (const bed of GARDEN_BEDS) {
      expect(BED_METADATA[bed]).toBeDefined()
      expect(BED_METADATA[bed].label).toBeTruthy()
    }
  })

  test('COLOR_METADATA has all 6 colors', () => {
    for (const color of GARDEN_COLORS) {
      expect(COLOR_METADATA[color]).toBeDefined()
      expect(COLOR_METADATA[color].label).toBeTruthy()
    }
  })

  test('getBedForProduce returns correct bed for known produce', () => {
    expect(getBedForProduce('kale')).toBe('greens')
    expect(getBedForProduce('carrot')).toBe('roots')
    expect(getBedForProduce('lemon')).toBe('citrus')
    expect(getBedForProduce('apple')).toBe('orchard')
    expect(getBedForProduce('strawberry')).toBe('berries')
    expect(getBedForProduce('mango')).toBe('tropical')
    expect(getBedForProduce('ginger')).toBe('herbs')
  })

  test('getBedForProduce returns null for unknown produce', () => {
    expect(getBedForProduce('unknown_fruit')).toBeNull()
    expect(getBedForProduce('')).toBeNull()
    expect(getBedForProduce(null)).toBeNull()
  })

  test('getBedForProduce is case-insensitive', () => {
    expect(getBedForProduce('KALE')).toBe('greens')
    expect(getBedForProduce('Carrot')).toBe('roots')
  })

  test('getColorForProduce returns correct color for known produce', () => {
    expect(getColorForProduce('kale')).toBe('green')
    expect(getColorForProduce('carrot')).toBe('orange')
    expect(getColorForProduce('lemon')).toBe('yellow')
    expect(getColorForProduce('strawberry')).toBe('red')
    expect(getColorForProduce('blueberry')).toBe('purple')
    expect(getColorForProduce('ginger')).toBe('tan')
  })

  test('getColorForProduce returns null for unknown produce', () => {
    expect(getColorForProduce('unknown_fruit')).toBeNull()
  })

  test('every PRODUCE_DATA key has a bed and color mapping', () => {
    const { PRODUCE_DATA } = require('../JuiceEngine')
    const allProduceIds = Object.keys(PRODUCE_DATA)
    for (const pid of allProduceIds) {
      expect(getBedForProduce(pid)).not.toBeNull()
      expect(getColorForProduce(pid)).not.toBeNull()
    }
  })
})

// ── Normalization tests ──────────────────────────────────────

describe('normalizeProduceId', () => {
  test('returns canonical key for family member', () => {
    expect(normalizeProduceId('apple_red')).toBe('apple')
    expect(normalizeProduceId('apple_green')).toBe('apple')
    expect(normalizeProduceId('bell_pepper_red')).toBe('bell_pepper')
  })

  test('returns self for ordinary produce', () => {
    expect(normalizeProduceId('carrot')).toBe('carrot')
    expect(normalizeProduceId('kale')).toBe('kale')
  })

  test('returns null for unknown produce', () => {
    expect(normalizeProduceId('unknown')).toBeNull()
    expect(normalizeProduceId('')).toBeNull()
    expect(normalizeProduceId(null)).toBeNull()
  })

  test('is case-insensitive', () => {
    expect(normalizeProduceId('KALE')).toBe('kale')
    expect(normalizeProduceId('Apple_Red')).toBe('apple')
  })
})

describe('normalizeProduceIds', () => {
  test('deduplicates and normalizes a list', () => {
    const result = normalizeProduceIds(['apple_red', 'apple', 'carrot', 'CARROT'])
    expect(result).toEqual(['apple', 'carrot'])
  })

  test('returns empty for non-array input', () => {
    expect(normalizeProduceIds(null)).toEqual([])
    expect(normalizeProduceIds('not-array')).toEqual([])
  })
})

// ── Discovery set tests ──────────────────────────────────────

describe('getDiscoveredProduce', () => {
  test('returns empty for empty entries', () => {
    expect(getDiscoveredProduce([])).toEqual([])
    expect(getDiscoveredProduce(null)).toEqual([])
  })

  test('returns unique normalized produce IDs', () => {
    const entries = makeEntries([
      ['apple_red', 'carrot'],
      ['apple', 'kale'],
    ])
    const result = getDiscoveredProduce(entries)
    expect(result).toContain('apple')
    expect(result).toContain('carrot')
    expect(result).toContain('kale')
    expect(result).toHaveLength(3)
  })

  test('ignores unknown produce IDs', () => {
    const entries = makeEntries([['unknown_fruit', 'kale']])
    const result = getDiscoveredProduce(entries)
    expect(result).toEqual(['kale'])
  })

  test('handles entries with missing ingredients', () => {
    const entries = [{ id: 'e1', dateKey: '2026-01-01' }]
    expect(getDiscoveredProduce(entries)).toEqual([])
  })
})

// ── Per-bed tests ────────────────────────────────────────────

describe('getProduceByBed and getBedCounts', () => {
  test('groups produce by bed', () => {
    const entries = makeEntries([['kale', 'carrot', 'lemon']])
    const byBed = getProduceByBed(entries)
    expect(byBed.greens).toContain('kale')
    expect(byBed.roots).toContain('carrot')
    expect(byBed.citrus).toContain('lemon')
    expect(byBed.orchard).toEqual([])
  })

  test('getBedCounts returns correct counts', () => {
    const entries = makeEntries([['kale', 'spinach', 'carrot']])
    const counts = getBedCounts(entries)
    expect(counts.greens).toBe(2)
    expect(counts.roots).toBe(1)
    expect(counts.citrus).toBe(0)
  })
})

// ── Growth stage tests ───────────────────────────────────────

describe('getBedStage', () => {
  test('0 produce → empty', () => {
    expect(getBedStage(0).key).toBe(STAGE_EMPTY)
  })

  test('1 produce → seed', () => {
    expect(getBedStage(1).key).toBe(STAGE_SEED)
  })

  test('2 produce → sprout', () => {
    expect(getBedStage(2).key).toBe(STAGE_SPROUT)
  })

  test('3 produce → growing', () => {
    expect(getBedStage(3).key).toBe(STAGE_GROWING)
  })

  test('5 produce → harvesting', () => {
    expect(getBedStage(5).key).toBe(STAGE_HARVESTING)
  })

  test('8 produce → flourishing', () => {
    expect(getBedStage(8).key).toBe(STAGE_FLOURISHING)
  })

  test('10 produce → flourishing (capped)', () => {
    expect(getBedStage(10).key).toBe(STAGE_FLOURISHING)
  })
})

describe('getBedStages', () => {
  test('returns stage for all 7 beds', () => {
    const entries = makeEntries([['kale', 'carrot']])
    const stages = getBedStages(entries)
    expect(Object.keys(stages)).toHaveLength(7)
    expect(stages.greens.key).toBe(STAGE_SEED)
    expect(stages.roots.key).toBe(STAGE_SEED)
    expect(stages.citrus.key).toBe(STAGE_EMPTY)
  })
})

// ── Color coverage tests ─────────────────────────────────────

describe('getDiscoveredColors and getColorCoverage', () => {
  test('returns discovered color keys', () => {
    const entries = makeEntries([['kale', 'carrot', 'lemon']])
    const colors = getDiscoveredColors(entries)
    expect(colors).toContain('green')
    expect(colors).toContain('orange')
    expect(colors).toContain('yellow')
    expect(colors).toHaveLength(3)
  })

  test('getColorCoverage groups produce by color', () => {
    const entries = makeEntries([['kale', 'spinach', 'carrot']])
    const coverage = getColorCoverage(entries)
    expect(coverage.green).toContain('kale')
    expect(coverage.green).toContain('spinach')
    expect(coverage.orange).toContain('carrot')
  })

  test('getColorCounts returns correct counts', () => {
    const entries = makeEntries([['kale', 'spinach', 'carrot']])
    const counts = getColorCounts(entries)
    expect(counts.green).toBe(2)
    expect(counts.orange).toBe(1)
    expect(counts.red).toBe(0)
  })
})

// ── Rainbow Harvest tests ────────────────────────────────────

describe('isRainbowHarvestComplete', () => {
  test('returns false when not all colors discovered', () => {
    const entries = makeEntries([['kale', 'carrot', 'lemon']])
    expect(isRainbowHarvestComplete(entries)).toBe(false)
  })

  test('returns true when all 6 colors discovered', () => {
    // green: kale, red: strawberry, orange: carrot, yellow: lemon, purple: blueberry, tan: ginger
    const entries = makeEntries([['kale', 'strawberry', 'carrot', 'lemon', 'blueberry', 'ginger']])
    expect(isRainbowHarvestComplete(entries)).toBe(true)
  })
})

// ── Summary tests ────────────────────────────────────────────

describe('getGardenSummary', () => {
  test('returns complete summary object', () => {
    const entries = makeEntries([['kale', 'carrot', 'lemon']])
    const summary = getGardenSummary(entries)
    expect(summary).toHaveProperty('discoveredProduce')
    expect(summary).toHaveProperty('discoveredCount')
    expect(summary).toHaveProperty('bedStages')
    expect(summary).toHaveProperty('bedCounts')
    expect(summary).toHaveProperty('discoveredColors')
    expect(summary).toHaveProperty('discoveredColorCount')
    expect(summary).toHaveProperty('colorCounts')
    expect(summary).toHaveProperty('rainbowComplete')
    expect(summary).toHaveProperty('bedsStarted')
    expect(summary).toHaveProperty('totalBeds')
    expect(summary).toHaveProperty('totalColors')
    expect(summary.discoveredCount).toBe(3)
    expect(summary.bedsStarted).toBe(3)
    expect(summary.discoveredColorCount).toBe(3)
    expect(summary.rainbowComplete).toBe(false)
    expect(summary.totalBeds).toBe(7)
    expect(summary.totalColors).toBe(6)
  })
})

// ── Next-discovery hint tests ────────────────────────────────

describe('getNextDiscoveryHint', () => {
  test('returns hint for empty garden', () => {
    const hint = getNextDiscoveryHint([])
    expect(hint).not.toBeNull()
    expect(hint.count).toBe(0)
  })

  test('returns hint with remaining count for partial bed', () => {
    // Fill all beds with at least 1 produce so the candidate has count > 0
    const entries = makeEntries([
      ['kale', 'carrot', 'lemon', 'apple', 'strawberry', 'mango', 'ginger'],
    ])
    const hint = getNextDiscoveryHint(entries)
    expect(hint).not.toBeNull()
    expect(hint.count).toBeGreaterThan(0)
  })
})

// ── Detection tests ──────────────────────────────────────────

describe('detectNewDiscoveries', () => {
  test('detects new produce', () => {
    const prev = makeEntries([['kale']])
    const current = makeEntries([['kale', 'carrot']])
    const { newProduce } = detectNewDiscoveries(prev, current)
    expect(newProduce).toContain('carrot')
    expect(newProduce).not.toContain('kale')
  })

  test('detects new colors', () => {
    const prev = makeEntries([['kale']])
    const current = makeEntries([['kale', 'carrot']])
    const { newColors } = detectNewDiscoveries(prev, current)
    expect(newColors).toContain('orange')
  })

  test('returns empty when no new discoveries', () => {
    const prev = makeEntries([['kale', 'carrot']])
    const current = makeEntries([['kale', 'carrot']])
    const { newProduce, newColors } = detectNewDiscoveries(prev, current)
    expect(newProduce).toEqual([])
    expect(newColors).toEqual([])
  })
})

describe('detectBedMilestones', () => {
  test('detects bed stage transitions', () => {
    const prev = makeEntries([['kale']])
    const current = makeEntries([['kale', 'spinach']])
    const milestones = detectBedMilestones(prev, current)
    const greensMilestone = milestones.find((m) => m.bedKey === 'greens')
    expect(greensMilestone).toBeDefined()
    expect(greensMilestone.fromStage).toBe(STAGE_SEED)
    expect(greensMilestone.toStage).toBe(STAGE_SPROUT)
  })

  test('returns empty when no transitions', () => {
    const prev = makeEntries([['kale']])
    const current = makeEntries([['kale']])
    expect(detectBedMilestones(prev, current)).toEqual([])
  })
})

describe('detectRainbowHarvest', () => {
  test('detects rainbow harvest completion', () => {
    const prev = makeEntries([['kale', 'strawberry', 'carrot', 'lemon', 'blueberry']])
    const current = makeEntries([['kale', 'strawberry', 'carrot', 'lemon', 'blueberry', 'ginger']])
    expect(detectRainbowHarvest(prev, current)).toBe(true)
  })

  test('returns false when not newly completed', () => {
    const prev = makeEntries([['kale']])
    const current = makeEntries([['kale', 'carrot']])
    expect(detectRainbowHarvest(prev, current)).toBe(false)
  })
})

// ── Baseline initialization tests ────────────────────────────

describe('initializeGardenBaseline', () => {
  test('returns true on first call', async () => {
    const result = await initializeGardenBaseline([])
    expect(result).toBe(true)
  })

  test('returns false on second call', async () => {
    await initializeGardenBaseline([])
    AsyncStorage.getItem.mockResolvedValueOnce('true')
    const result = await initializeGardenBaseline([])
    expect(result).toBe(false)
  })

  test('marks current bed stages as celebrated', async () => {
    const entries = makeEntries([['kale', 'carrot']])
    await initializeGardenBaseline(entries)
    const setItemCalls = AsyncStorage.setItem.mock.calls
    const bedsCall = setItemCalls.find((c) => c[0] === 'garden_celebratedBeds')
    expect(bedsCall).toBeDefined()
    const celebrated = JSON.parse(bedsCall[1])
    expect(celebrated).toContain('greens:seed')
    expect(celebrated).toContain('roots:seed')
  })

  test('marks current colors as celebrated', async () => {
    const entries = makeEntries([['kale', 'carrot']])
    await initializeGardenBaseline(entries)
    const setItemCalls = AsyncStorage.setItem.mock.calls
    const colorsCall = setItemCalls.find((c) => c[0] === 'garden_celebratedColors')
    expect(colorsCall).toBeDefined()
    const celebrated = JSON.parse(colorsCall[1])
    expect(celebrated).toContain('green')
    expect(celebrated).toContain('orange')
  })

  test('marks rainbow as celebrated if already complete', async () => {
    const entries = makeEntries([['kale', 'strawberry', 'carrot', 'lemon', 'blueberry', 'ginger']])
    await initializeGardenBaseline(entries)
    const setItemCalls = AsyncStorage.setItem.mock.calls
    const rainbowCall = setItemCalls.find((c) => c[0] === 'garden_celebratedRainbow')
    expect(rainbowCall).toBeDefined()
    expect(rainbowCall[1]).toBe('true')
  })
})

// ── Celebration persistence tests ────────────────────────────

describe('shouldCelebrateBed', () => {
  test('returns false before baseline init', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const result = await shouldCelebrateBed('greens', 'seed')
    expect(result).toBe(false)
  })

  test('returns true after baseline init for uncelebrated bed', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce('[]') // celebrated beds (checked first)
      .mockResolvedValueOnce('true') // baseline
    const result = await shouldCelebrateBed('greens', 'seed')
    expect(result).toBe(true)
  })

  test('returns false for already celebrated bed', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce('true') // baseline
      .mockResolvedValueOnce(JSON.stringify(['greens:seed'])) // celebrated beds
    const result = await shouldCelebrateBed('greens', 'seed')
    expect(result).toBe(false)
  })
})

describe('shouldCelebrateColor', () => {
  test('returns false before baseline init', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const result = await shouldCelebrateColor('green')
    expect(result).toBe(false)
  })

  test('returns true after baseline init for uncelebrated color', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce('[]') // celebrated colors (checked first)
      .mockResolvedValueOnce('true') // baseline
    const result = await shouldCelebrateColor('green')
    expect(result).toBe(true)
  })
})

describe('shouldCelebrateRainbow', () => {
  test('returns false before baseline init', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const result = await shouldCelebrateRainbow()
    expect(result).toBe(false)
  })

  test('returns true after baseline init if not yet celebrated', async () => {
    AsyncStorage.getItem
      .mockResolvedValueOnce(null) // rainbow not celebrated (checked first)
      .mockResolvedValueOnce('true') // baseline
    const result = await shouldCelebrateRainbow()
    expect(result).toBe(true)
  })
})

// ── Reset tests ──────────────────────────────────────────────

describe('resetGardenCelebrations', () => {
  test('removes all garden keys', async () => {
    await resetGardenCelebrations()
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      'garden_discoveredProduce',
      'garden_celebratedBeds',
      'garden_celebratedColors',
      'garden_celebratedRainbow',
      'garden_baselineInitialized',
    ])
  })
})

// ── GARDEN_STAGES tests ──────────────────────────────────────

describe('GARDEN_STAGES', () => {
  test('has 6 stages in order', () => {
    expect(GARDEN_STAGES).toHaveLength(6)
    expect(GARDEN_STAGES[0].key).toBe(STAGE_EMPTY)
    expect(GARDEN_STAGES[5].key).toBe(STAGE_FLOURISHING)
  })

  test('thresholds are monotonically increasing', () => {
    for (let i = 1; i < GARDEN_STAGES.length; i++) {
      expect(GARDEN_STAGES[i].threshold).toBeGreaterThan(GARDEN_STAGES[i - 1].threshold)
    }
  })
})
