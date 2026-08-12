// ─────────────────────────────────────────────────────────────
// nutrientFilterFix.test.js
// Verifies that getTopNutrients returns all non-zero micronutrients
// (filtering by value > 0, not by pct > 0), so that micronutrients
// with less than 0.5% Daily Reference still appear in the UI.
// ─────────────────────────────────────────────────────────────

import { getTopNutrients, getBasicNutritionStats } from '../detailedHistoryHelpers'
import { hasMicronutrientData, CANONICAL_NUTRIENT_KEYS } from '../nutrientKeys'

describe('getTopNutrients — value-based filter (not pct-based)', () => {
  test('returns nutrients with nonzero value even if pct rounds to 0', () => {
    // Simulate a small juice where iron is 0.1mg
    // RDA for iron is 18mg, so 0.1/18 = 0.55% → rounds to 0%
    const nutrients = {
      calories: 50,
      sugar: 5,
      vitaminC: 0.1,   // 0.1/90 = 0.11% → 0%
      vitaminA: 0.1,   // 0.1/900 = 0.01% → 0%
      potassium: 1,    // 1/3400 = 0.03% → 0%
      iron: 0.1,       // 0.1/18 = 0.55% → 0%
      magnesium: 0.1,  // 0.1/400 = 0.025% → 0%
      folate: 0.1,     // 0.1/400 = 0.025% → 0%
    }

    const topNutrients = getTopNutrients(nutrients, 10)
    // All 6 micronutrients have nonzero values, so all should appear
    expect(topNutrients.length).toBe(6)
    topNutrients.forEach((n) => {
      expect(n.value).toBeGreaterThan(0)
    })
  })

  test('returns nutrients with significant values in descending pct order', () => {
    const nutrients = {
      calories: 200,
      sugar: 30,
      vitaminC: 90,     // 100% RDA
      vitaminA: 900,    // 100% RDA
      potassium: 3400,  // 100% RDA
      iron: 18,         // 100% RDA
      magnesium: 400,   // 100% RDA
      folate: 400,      // 100% RDA
    }

    const topNutrients = getTopNutrients(nutrients, 10)
    expect(topNutrients.length).toBe(6)
    topNutrients.forEach((n) => {
      expect(n.pct).toBeGreaterThan(0)
    })
  })

  test('excludes nutrients with zero value', () => {
    const nutrients = {
      calories: 100,
      sugar: 10,
      vitaminC: 50,
      vitaminA: 0,
      potassium: 0,
      iron: 0,
      magnesium: 0,
      folate: 0,
    }

    const topNutrients = getTopNutrients(nutrients)
    expect(topNutrients.length).toBe(1)
    expect(topNutrients[0].key).toBe('vitaminC')
  })

  test('excludes nutrients with negative or non-numeric values', () => {
    const nutrients = {
      calories: 100,
      sugar: 10,
      vitaminC: -5,
      vitaminA: 'invalid',
      potassium: NaN,
      iron: 0,
      magnesium: 10,
      folate: Infinity,
    }

    const topNutrients = getTopNutrients(nutrients, 10)
    // Only magnesium has a valid positive value
    expect(topNutrients.length).toBe(1)
    expect(topNutrients[0].key).toBe('magnesium')
  })

  test('empty nutrientSummary returns empty array', () => {
    expect(getTopNutrients({})).toEqual([])
    expect(getTopNutrients(null)).toEqual([])
    expect(getTopNutrients(undefined)).toEqual([])
  })

  test('basicStats still shows calories and sugar regardless of micronutrients', () => {
    const nutrients = {
      calories: 150,
      sugar: 20,
      vitaminC: 0,
      vitaminA: 0,
      potassium: 0,
      iron: 0,
      magnesium: 0,
      folate: 0,
    }

    const basicStats = getBasicNutritionStats(nutrients)
    expect(basicStats.calories).toBe(150)
    expect(basicStats.sugar).toBe(20)

    const topNutrients = getTopNutrients(nutrients)
    expect(topNutrients.length).toBe(0)
  })

  test('hasMicronutrientData detects presence of micronutrients', () => {
    expect(hasMicronutrientData({ vitaminC: 0.1 })).toBe(true)
    expect(hasMicronutrientData({ vitaminC: 0 })).toBe(false)
    expect(hasMicronutrientData({ calories: 100 })).toBe(false)
    expect(hasMicronutrientData({})).toBe(false)
  })

  test('CANONICAL_NUTRIENT_KEYS has exactly 6 keys', () => {
    expect(CANONICAL_NUTRIENT_KEYS).toHaveLength(6)
    expect(CANONICAL_NUTRIENT_KEYS).toContain('vitaminC')
    expect(CANONICAL_NUTRIENT_KEYS).toContain('vitaminA')
    expect(CANONICAL_NUTRIENT_KEYS).toContain('potassium')
    expect(CANONICAL_NUTRIENT_KEYS).toContain('iron')
    expect(CANONICAL_NUTRIENT_KEYS).toContain('magnesium')
    expect(CANONICAL_NUTRIENT_KEYS).toContain('folate')
  })
})
