// ─────────────────────────────────────────────────────────────
// detailedHistoryHelpers.test.js
// Focused regression tests for Pro Detailed History helpers.
// ─────────────────────────────────────────────────────────────

const {
  formatIngredientPortion,
  computeProduceBalance,
  getTopNutrients,
  getBasicNutritionStats,
} = require('../detailedHistoryHelpers')

// ── formatIngredientPortion ───────────────────────────────────

describe('formatIngredientPortion', () => {
  test('returns null for null/undefined input', () => {
    expect(formatIngredientPortion(null)).toBeNull()
    expect(formatIngredientPortion(undefined)).toBeNull()
  })

  test('returns null for empty object', () => {
    expect(formatIngredientPortion({})).toBeNull()
  })

  test('returns grams for weight-mode ingredient with weightG', () => {
    const result = formatIngredientPortion({
      produceId: 'carrot',
      weightG: 120,
      portionEntryMode: 'weight',
    })
    expect(result).toBe('120g')
  })

  test('returns null for weight-mode without weightG', () => {
    const result = formatIngredientPortion({
      produceId: 'carrot',
      portionEntryMode: 'weight',
    })
    expect(result).toBeNull()
  })

  test('returns null for quantity-mode without metadata', () => {
    const result = formatIngredientPortion({
      produceId: 'carrot',
      portionEntryMode: 'quantity',
    })
    expect(result).toBeNull()
  })

  test('returns null for quantity-mode with incomplete metadata', () => {
    const result = formatIngredientPortion({
      produceId: 'carrot',
      portionEntryMode: 'quantity',
      portionMetadata: { enteredQuantity: 2 }, // no unitKey
    })
    expect(result).toBeNull()
  })

  test('returns grams for weight-mode with 0 weightG', () => {
    const result = formatIngredientPortion({
      produceId: 'carrot',
      weightG: 0,
      portionEntryMode: 'weight',
    })
    expect(result).toBeNull()
  })
})

// ── computeProduceBalance ─────────────────────────────────────

describe('computeProduceBalance', () => {
  test('returns count mode when no ingredientDetails', () => {
    const result = computeProduceBalance(['kale', 'apple', 'spinach'])
    expect(result.mode).toBe('count')
    expect(result.vegCount).toBe(2)
    expect(result.fruitCount).toBe(1)
    expect(result.vegPercent).toBeNull()
    expect(result.fruitPercent).toBeNull()
  })

  test('returns weight mode when ingredientDetails have weights', () => {
    const result = computeProduceBalance(
      ['kale', 'apple'],
      [
        { produceId: 'kale', weightG: 200 },
        { produceId: 'apple', weightG: 100 },
      ],
    )
    expect(result.mode).toBe('weight')
    expect(result.vegWeightG).toBe(200)
    expect(result.fruitWeightG).toBe(100)
    expect(result.vegPercent).toBe(67)
    expect(result.fruitPercent).toBe(33)
  })

  test('falls back to count mode when weights are 0', () => {
    const result = computeProduceBalance(
      ['kale', 'apple'],
      [
        { produceId: 'kale', weightG: 0 },
        { produceId: 'apple', weightG: 0 },
      ],
    )
    expect(result.mode).toBe('count')
    expect(result.vegCount).toBe(1)
    expect(result.fruitCount).toBe(1)
  })

  test('handles empty ingredients array', () => {
    const result = computeProduceBalance([])
    expect(result.vegCount).toBe(0)
    expect(result.fruitCount).toBe(0)
    expect(result.mode).toBe('count')
  })

  test('handles unknown produce IDs gracefully', () => {
    const result = computeProduceBalance(['unknown_id', 'kale'])
    expect(result.vegCount).toBe(1)
    expect(result.fruitCount).toBe(0)
  })

  test('handles all-fruit ingredients', () => {
    const result = computeProduceBalance(['apple', 'lemon'])
    expect(result.vegCount).toBe(0)
    expect(result.fruitCount).toBe(2)
  })

  test('handles all-vegetable ingredients', () => {
    const result = computeProduceBalance(['kale', 'spinach', 'carrot'])
    expect(result.vegCount).toBe(3)
    expect(result.fruitCount).toBe(0)
  })

  test('weight mode with only vegetables', () => {
    const result = computeProduceBalance(
      ['kale', 'spinach'],
      [
        { produceId: 'kale', weightG: 150 },
        { produceId: 'spinach', weightG: 50 },
      ],
    )
    expect(result.mode).toBe('weight')
    expect(result.vegPercent).toBe(100)
    expect(result.fruitPercent).toBe(0)
  })

  test('handles null ingredientDetails', () => {
    const result = computeProduceBalance(['kale', 'apple'], null)
    expect(result.mode).toBe('count')
    expect(result.vegCount).toBe(1)
    expect(result.fruitCount).toBe(1)
  })
})

// ── getTopNutrients ───────────────────────────────────────────

describe('getTopNutrients', () => {
  test('returns empty array for empty nutrientSummary', () => {
    expect(getTopNutrients({})).toEqual([])
  })

  test('returns empty array for null nutrientSummary', () => {
    expect(getTopNutrients(null)).toEqual([])
  })

  test('returns nutrients sorted by % Daily Reference descending', () => {
    const result = getTopNutrients({
      vitaminC: 90,   // 100% Daily Reference
      potassium: 260, // 10% Daily Reference
      iron: 18,       // 100% Daily Reference
    })
    expect(result.length).toBe(3)
    // Both 100% values should come before 10%
    expect(result[0].pct).toBeGreaterThanOrEqual(result[1].pct)
    expect(result[2].pct).toBe(10)
  })

  test('filters out nutrients with 0% Daily Reference', () => {
    const result = getTopNutrients({
      vitaminC: 0,
      potassium: 2600, // 100%
    })
    expect(result.length).toBe(1)
    expect(result[0].key).toBe('potassium')
  })

  test('respects limit parameter', () => {
    const result = getTopNutrients(
      {
        vitaminC: 90,
        vitaminA: 900,
        potassium: 2600,
        iron: 18,
        magnesium: 400,
        folate: 400,
      },
      3,
    )
    expect(result.length).toBe(3)
  })

  test('returns correct labels', () => {
    const result = getTopNutrients({ vitaminC: 90 })
    expect(result[0].label).toBe('Vitamin C')
  })

  test('includes value in result', () => {
    const result = getTopNutrients({ vitaminC: 45 })
    expect(result[0].value).toBe(45)
  })
})

// ── getBasicNutritionStats ────────────────────────────────────

describe('getBasicNutritionStats', () => {
  test('returns zeros for empty input', () => {
    const result = getBasicNutritionStats({})
    expect(result.calories).toBe(0)
    expect(result.sugar).toBe(0)
  })

  test('returns zeros for null input', () => {
    const result = getBasicNutritionStats(null)
    expect(result.calories).toBe(0)
    expect(result.sugar).toBe(0)
  })

  test('rounds calories to integer', () => {
    const result = getBasicNutritionStats({ calories: 123.6 })
    expect(result.calories).toBe(124)
  })

  test('rounds sugar to 1 decimal place', () => {
    const result = getBasicNutritionStats({ sugar: 12.34 })
    expect(result.sugar).toBe(12.3)
  })

  test('handles non-number values gracefully', () => {
    const result = getBasicNutritionStats({ calories: 'abc', sugar: null })
    expect(result.calories).toBe(0)
    expect(result.sugar).toBe(0)
  })
})
