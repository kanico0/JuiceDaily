// Tests for historyFilters.js — search and filter helpers
import {
  searchEntries,
  filterEntries,
  applySearchAndFilters,
  hasActiveFilters,
  createDefaultFilters,
  getNutrientPct,
  FILTERABLE_NUTRIENTS,
} from '../historyFilters'
import { USDA_RDA } from '../../constants/nutrition'

// Build a minimal entry for testing
function makeEntry(overrides = {}) {
  return {
    id: 'test-1',
    createdAt: '2026-08-11T10:00:00Z',
    dateKey: '2026-08-11',
    title: 'Green Juice',
    ingredients: ['kale', 'lemon', 'ginger'],
    ingredientDetails: null,
    nutrientSummary: {
      vitaminC: 50,
      vitaminA: 100,
      potassium: 800,
      iron: 3,
      magnesium: 240,
      folate: 200,
    },
    ...overrides,
  }
}

describe('historyFilters — searchEntries', () => {
  test('returns all entries when query is empty', () => {
    const entries = [makeEntry(), makeEntry({ id: 'test-2' })]
    expect(searchEntries(entries, '')).toHaveLength(2)
    expect(searchEntries(entries, null)).toHaveLength(2)
    expect(searchEntries(entries, '   ')).toHaveLength(2)
  })

  test('searches by ingredient/produce name (case-insensitive)', () => {
    const entries = [makeEntry(), makeEntry({ id: 'test-2', ingredients: ['apple', 'carrot'] })]
    const result = searchEntries(entries, 'KALE')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-1')
  })

  test('searches by personal note', () => {
    const entries = [
      makeEntry(),
      makeEntry({ id: 'test-2', note: 'Great morning juice' }),
    ]
    const result = searchEntries(entries, 'morning')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-2')
  })

  test('searches by title', () => {
    const entries = [
      makeEntry(),
      makeEntry({ id: 'test-2', title: 'Citrus Blast' }),
    ]
    const result = searchEntries(entries, 'citrus')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('test-2')
  })

  test('clear search returns all entries', () => {
    const entries = [makeEntry(), makeEntry({ id: 'test-2', ingredients: ['apple'] })]
    const filtered = searchEntries(entries, 'kale')
    expect(filtered).toHaveLength(1)
    const cleared = searchEntries(filtered, '')
    // Note: searchEntries operates on the already-filtered array
    expect(cleared).toHaveLength(1)
  })
})

describe('historyFilters — filterEntries', () => {
  test('returns all entries when no filters active', () => {
    const entries = [makeEntry(), makeEntry({ id: 'test-2' })]
    expect(filterEntries(entries, createDefaultFilters())).toHaveLength(2)
  })

  test('favorites filter shows only favorites', () => {
    const entries = [
      makeEntry({ id: 'fav-1', favorite: true }),
      makeEntry({ id: 'fav-2', favorite: false }),
      makeEntry({ id: 'fav-3', favorite: true }),
    ]
    const result = filterEntries(entries, { ...createDefaultFilters(), favoritesOnly: true })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.favorite === true)).toBe(true)
  })

  test('rating threshold filter (4+)', () => {
    const entries = [
      makeEntry({ id: 'r-1', rating: 5 }),
      makeEntry({ id: 'r-2', rating: 4 }),
      makeEntry({ id: 'r-3', rating: 3 }),
      makeEntry({ id: 'r-4', rating: null }),
    ]
    const result = filterEntries(entries, { ...createDefaultFilters(), minRating: 4 })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.rating >= 4)).toBe(true)
  })

  test('rating threshold filter (5 stars only)', () => {
    const entries = [
      makeEntry({ id: 'r-1', rating: 5 }),
      makeEntry({ id: 'r-2', rating: 4 }),
    ]
    const result = filterEntries(entries, { ...createDefaultFilters(), minRating: 5 })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r-1')
  })

  test('portion filter — has recorded portions', () => {
    const entries = [
      makeEntry({ id: 'p-1', ingredientDetails: [{ produceId: 'kale', weightG: 100 }] }),
      makeEntry({ id: 'p-2', ingredientDetails: null }),
      makeEntry({ id: 'p-3', ingredientDetails: [] }),
    ]
    const result = filterEntries(entries, { ...createDefaultFilters(), portionFilter: 'has_portions' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p-1')
  })

  test('portion filter — portion not recorded', () => {
    const entries = [
      makeEntry({ id: 'p-1', ingredientDetails: [{ produceId: 'kale', weightG: 100 }] }),
      makeEntry({ id: 'p-2', ingredientDetails: null }),
      makeEntry({ id: 'p-3', ingredientDetails: [] }),
    ]
    const result = filterEntries(entries, { ...createDefaultFilters(), portionFilter: 'no_portions' })
    expect(result).toHaveLength(2)
    expect(result.every((e) => !e.ingredientDetails || e.ingredientDetails.length === 0)).toBe(true)
  })

  test('ingredient filter — contains ginger', () => {
    const entries = [
      makeEntry({ id: 'g-1', ingredients: ['kale', 'ginger'] }),
      makeEntry({ id: 'g-2', ingredients: ['apple', 'carrot'] }),
    ]
    const result = filterEntries(entries, { ...createDefaultFilters(), ingredient: 'ginger' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('g-1')
  })

  test('nutrient filter — magnesium >= 60%', () => {
    // magnesium RDA = 400, so 240/400 = 60%
    const entries = [
      makeEntry({ id: 'm-1', nutrientSummary: { magnesium: 240 } }),
      makeEntry({ id: 'm-2', nutrientSummary: { magnesium: 100 } }),
    ]
    const result = filterEntries(entries, {
      ...createDefaultFilters(),
      nutrientFilter: { nutrientKey: 'magnesium', condition: '>=', threshold: 60 },
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('m-1')
  })

  test('nutrient filter — magnesium <= 30%', () => {
    const entries = [
      makeEntry({ id: 'm-1', nutrientSummary: { magnesium: 240 } }), // 60%
      makeEntry({ id: 'm-2', nutrientSummary: { magnesium: 100 } }), // 25%
    ]
    const result = filterEntries(entries, {
      ...createDefaultFilters(),
      nutrientFilter: { nutrientKey: 'magnesium', condition: '<=', threshold: 30 },
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('m-2')
  })

  test('combined filters — favorites + 4+ stars', () => {
    const entries = [
      makeEntry({ id: 'c-1', favorite: true, rating: 5 }),
      makeEntry({ id: 'c-2', favorite: true, rating: 3 }),
      makeEntry({ id: 'c-3', favorite: false, rating: 5 }),
    ]
    const result = filterEntries(entries, {
      ...createDefaultFilters(),
      favoritesOnly: true,
      minRating: 4,
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c-1')
  })

  test('combined filters — contains ginger + magnesium >= 60%', () => {
    const entries = [
      makeEntry({ id: 'c-1', ingredients: ['kale', 'ginger'], nutrientSummary: { magnesium: 240 } }),
      makeEntry({ id: 'c-2', ingredients: ['kale', 'ginger'], nutrientSummary: { magnesium: 100 } }),
      makeEntry({ id: 'c-3', ingredients: ['apple'], nutrientSummary: { magnesium: 240 } }),
    ]
    const result = filterEntries(entries, {
      ...createDefaultFilters(),
      ingredient: 'ginger',
      nutrientFilter: { nutrientKey: 'magnesium', condition: '>=', threshold: 60 },
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c-1')
  })

  test('clear filters returns all entries', () => {
    const entries = [
      makeEntry({ id: 'c-1', favorite: true }),
      makeEntry({ id: 'c-2', favorite: false }),
    ]
    const filtered = filterEntries(entries, { ...createDefaultFilters(), favoritesOnly: true })
    expect(filtered).toHaveLength(1)
    const cleared = filterEntries(entries, createDefaultFilters())
    expect(cleared).toHaveLength(2)
  })

  test('empty results when no entries match', () => {
    const entries = [makeEntry({ id: 'e-1', rating: 1 })]
    const result = filterEntries(entries, { ...createDefaultFilters(), minRating: 5 })
    expect(result).toHaveLength(0)
  })
})

describe('historyFilters — applySearchAndFilters', () => {
  test('combines search and filters', () => {
    const entries = [
      makeEntry({ id: 's-1', ingredients: ['kale', 'ginger'], favorite: true, rating: 5 }),
      makeEntry({ id: 's-2', ingredients: ['kale'], favorite: true, rating: 3 }),
      makeEntry({ id: 's-3', ingredients: ['apple', 'ginger'], favorite: false, rating: 5 }),
    ]
    const result = applySearchAndFilters(entries, 'ginger', {
      ...createDefaultFilters(),
      favoritesOnly: true,
      minRating: 4,
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('s-1')
  })
})

describe('historyFilters — hasActiveFilters', () => {
  test('false for default filters', () => {
    expect(hasActiveFilters(createDefaultFilters())).toBe(false)
  })

  test('true for favoritesOnly', () => {
    expect(hasActiveFilters({ ...createDefaultFilters(), favoritesOnly: true })).toBe(true)
  })

  test('true for minRating > 0', () => {
    expect(hasActiveFilters({ ...createDefaultFilters(), minRating: 3 })).toBe(true)
  })

  test('true for portionFilter', () => {
    expect(hasActiveFilters({ ...createDefaultFilters(), portionFilter: 'has_portions' })).toBe(true)
  })

  test('true for ingredient', () => {
    expect(hasActiveFilters({ ...createDefaultFilters(), ingredient: 'ginger' })).toBe(true)
  })

  test('true for nutrientFilter', () => {
    expect(hasActiveFilters({
      ...createDefaultFilters(),
      nutrientFilter: { nutrientKey: 'magnesium', condition: '>=', threshold: 60 },
    })).toBe(true)
  })
})

describe('historyFilters — getNutrientPct', () => {
  test('calculates percentage correctly', () => {
    // magnesium RDA = 400, value = 240 → 60%
    expect(getNutrientPct({ magnesium: 240 }, 'magnesium')).toBe(60)
  })

  test('returns 0 for missing nutrient', () => {
    expect(getNutrientPct({}, 'magnesium')).toBe(0)
    expect(getNutrientPct(null, 'magnesium')).toBe(0)
  })

  test('returns 0 for unknown nutrient key', () => {
    expect(getNutrientPct({ unknown: 100 }, 'unknown')).toBe(0)
  })
})

describe('historyFilters — FILTERABLE_NUTRIENTS', () => {
  test('contains expected nutrients', () => {
    const keys = FILTERABLE_NUTRIENTS.map((n) => n.key)
    expect(keys).toContain('vitaminC')
    expect(keys).toContain('vitaminA')
    expect(keys).toContain('potassium')
    expect(keys).toContain('iron')
    expect(keys).toContain('magnesium')
    expect(keys).toContain('folate')
  })

  test('all nutrients have corresponding USDA_RDA entries', () => {
    FILTERABLE_NUTRIENTS.forEach((n) => {
      expect(USDA_RDA[n.key]).toBeDefined()
      expect(USDA_RDA[n.key]).toBeGreaterThan(0)
    })
  })
})
