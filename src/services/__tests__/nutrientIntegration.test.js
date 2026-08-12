// ─────────────────────────────────────────────────────────────
// nutrientIntegration.test.js
// Integration test that uses REAL JuiceEngine output to verify
// that micronutrients flow through getTopNutrients correctly.
// ─────────────────────────────────────────────────────────────

import { processJuiceBatch } from '../JuiceEngine'
import { getTopNutrients, getBasicNutritionStats, hasMicronutrientData } from '../detailedHistoryHelpers'
import { getNutrientPct, getStoredNutrientValue, CANONICAL_NUTRIENT_KEYS } from '../nutrientKeys'
import { USDA_RDA } from '../../constants/nutrition'

describe('Nutrient integration — real JuiceEngine output', () => {
  // Use a realistic juice: kale + lemon + apple
  const realBatch = processJuiceBatch(
    [
      { produceId: 'kale', weightG: 100 },
      { produceId: 'lemon', weightG: 60 },
      { produceId: 'apple', weightG: 120 },
    ],
    'cold_pressed'
  )

  test('JuiceEngine produces micronutrient keys matching CANONICAL_NUTRIENT_KEYS', () => {
    const totals = realBatch.totals
    // Every canonical key should be present in the real output
    for (const key of CANONICAL_NUTRIENT_KEYS) {
      expect(totals).toHaveProperty(key)
      expect(typeof totals[key]).toBe('number')
    }
  })

  test('JuiceEngine produces calories and sugar', () => {
    const totals = realBatch.totals
    expect(totals).toHaveProperty('calories')
    expect(totals).toHaveProperty('sugar')
    expect(typeof totals.calories).toBe('number')
    expect(typeof totals.sugar).toBe('number')
  })

  test('getTopNutrients returns micronutrients from real JuiceEngine output', () => {
    // Store the real totals as nutrientSummary (exactly as HomeScreen does)
    const nutrientSummary = realBatch.totals
    const topNutrients = getTopNutrients(nutrientSummary)

    // Should have at least some nutrients with non-zero % Daily Reference
    expect(topNutrients.length).toBeGreaterThan(0)

    // Each returned nutrient should have the expected shape
    topNutrients.forEach((n) => {
      expect(n).toHaveProperty('key')
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('pct')
      expect(n).toHaveProperty('value')
      expect(n.pct).toBeGreaterThan(0)
      expect(CANONICAL_NUTRIENT_KEYS).toContain(n.key)
    })
  })

  test('getBasicNutritionStats returns calories and sugar from real output', () => {
    const nutrientSummary = realBatch.totals
    const basicStats = getBasicNutritionStats(nutrientSummary)

    expect(basicStats.calories).toBeGreaterThan(0)
    expect(basicStats.sugar).toBeGreaterThan(0)
  })

  test('hasMicronutrientData is true for real JuiceEngine output', () => {
    const nutrientSummary = realBatch.totals
    expect(hasMicronutrientData(nutrientSummary)).toBe(true)
  })

  test('hasMicronutrientData is false for legacy entries with only calories/sugar', () => {
    const legacySummary = { calories: 150, sugar: 20 }
    expect(hasMicronutrientData(legacySummary)).toBe(false)
  })

  test('getNutrientPct (filter helper) matches getTopNutrients (Detailed History)', () => {
    const nutrientSummary = realBatch.totals
    const topNutrients = getTopNutrients(nutrientSummary)

    // For each nutrient in topNutrients, the filter helper should
    // return the SAME percentage
    topNutrients.forEach((n) => {
      const filterPct = getNutrientPct(nutrientSummary, n.key)
      expect(filterPct).toBe(n.pct)
    })
  })

  test('getStoredNutrientValue returns same value as getTopNutrients', () => {
    const nutrientSummary = realBatch.totals
    const topNutrients = getTopNutrients(nutrientSummary)

    topNutrients.forEach((n) => {
      const storedVal = getStoredNutrientValue(nutrientSummary, n.key)
      expect(storedVal).toBe(n.value)
    })
  })

  test('Kale-heavy juice has high Vitamin A and Vitamin C', () => {
    const kaleBatch = processJuiceBatch(
      [{ produceId: 'kale', weightG: 200 }],
      'cold_pressed'
    )
    const topNutrients = getTopNutrients(kaleBatch.totals)
    const vitC = topNutrients.find((n) => n.key === 'vitaminC')
    const vitA = topNutrients.find((n) => n.key === 'vitaminA')

    // Kale is rich in Vitamin C and Vitamin A
    expect(vitC).toBeDefined()
    expect(vitC.pct).toBeGreaterThan(0)
    expect(vitA).toBeDefined()
    expect(vitA.pct).toBeGreaterThan(0)
  })

  test('Legacy entry with only calories/sugar shows no top nutrients but has basic stats', () => {
    const legacySummary = { calories: 150, sugar: 20 }
    const topNutrients = getTopNutrients(legacySummary)
    const basicStats = getBasicNutritionStats(legacySummary)

    expect(topNutrients.length).toBe(0)
    expect(basicStats.calories).toBe(150)
    expect(basicStats.sugar).toBe(20)
    expect(hasMicronutrientData(legacySummary)).toBe(false)
  })
})
