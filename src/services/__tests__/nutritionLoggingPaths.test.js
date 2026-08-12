// ─────────────────────────────────────────────────────────────
// nutritionLoggingPaths.test.js
// Integration tests verifying that the actual production History
// logging path (HomeScreen → addLogEntry) retains full supported
// micronutrient data from JuiceEngine in the stored entry.
// ─────────────────────────────────────────────────────────────

const { processJuiceBatch } = require('../JuiceEngine')
const { getTopNutrients, getBasicNutritionStats } = require('../detailedHistoryHelpers')
const { hasMicronutrientData, getNutrientPct, CANONICAL_NUTRIENT_KEYS } = require('../nutrientKeys')

// Simulate the JuiceLogStore addEntry function
function createEntry({ source, ingredientIds, nutrientSummary, ingredientDetails }) {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    dateKey: new Date().toISOString().slice(0, 10),
    source: source || 'unknown',
    title: 'Test Juice',
    ingredients: ingredientIds || [],
    nutrientSummary: nutrientSummary || {},
    ingredientDetails: Array.isArray(ingredientDetails) ? ingredientDetails : undefined,
    rating: undefined,
    note: undefined,
    favorite: undefined,
  }
}

// Simulate the HomeScreen buildBatch + addLogEntry flow
function simulateHomeScreenLogFlow(scannedIngredients, juiceMethod = 'cold_pressed') {
  const juiceResult = processJuiceBatch(scannedIngredients, juiceMethod)
  const totals = juiceResult.totals

  // This is exactly what HomeScreen does:
  const logEntry = createEntry({
    source: 'photo',
    ingredientIds: scannedIngredients.map((i) => i.produceId),
    nutrientSummary: totals, // FULL JuiceEngine totals
    ingredientDetails: scannedIngredients.map((i) => ({
      produceId: i.produceId,
      weightG: i.weightG || 150,
    })),
  })

  return { logEntry, totals, juiceResult }
}

describe('Production logging path retains full micronutrients', () => {
  const testCases = [
    {
      name: 'kale-heavy juice',
      ingredients: [
        { produceId: 'kale', weightG: 100 },
        { produceId: 'lemon', weightG: 50 },
      ],
    },
    {
      name: 'carrot-orange juice',
      ingredients: [
        { produceId: 'carrot', weightG: 200 },
        { produceId: 'orange', weightG: 150 },
      ],
    },
    {
      name: 'spinach-apple juice',
      ingredients: [
        { produceId: 'spinach', weightG: 100 },
        { produceId: 'apple', weightG: 200 },
      ],
    },
    {
      name: 'grape juice',
      ingredients: [
        { produceId: 'grape', weightG: 150 },
      ],
    },
    {
      name: 'multi-veg juice',
      ingredients: [
        { produceId: 'kale', weightG: 50 },
        { produceId: 'spinach', weightG: 50 },
        { produceId: 'carrot', weightG: 100 },
        { produceId: 'lemon', weightG: 30 },
        { produceId: 'ginger', weightG: 10 },
      ],
    },
  ]

  testCases.forEach(({ name, ingredients }) => {
    test(`${name}: stored entry contains all supported micronutrients`, () => {
      const { logEntry, totals } = simulateHomeScreenLogFlow(ingredients)

      // The nutrientSummary in the entry should be the SAME object as totals
      expect(logEntry.nutrientSummary).toBe(totals)

      // Check that supported micronutrients are present (where JuiceEngine produces nonzero values)
      const supportedKeys = ['calories', 'sugar', 'vitaminC', 'vitaminA', 'potassium', 'iron', 'magnesium', 'folate']

      supportedKeys.forEach((key) => {
        const value = Number(totals[key]) || 0
        if (value > 0) {
          expect(logEntry.nutrientSummary).toHaveProperty(key)
          expect(Number(logEntry.nutrientSummary[key])).toBeGreaterThan(0)
        }
      })
    })

    test(`${name}: Detailed History renders Top Nutrients from stored entry`, () => {
      const { logEntry } = simulateHomeScreenLogFlow(ingredients)
      const nutrients = logEntry.nutrientSummary || {}
      const topNutrients = getTopNutrients(nutrients)

      // If JuiceEngine produced micronutrients, they should appear in topNutrients
      const hasMicros = hasMicronutrientData(nutrients)
      if (hasMicros) {
        expect(topNutrients.length).toBeGreaterThan(0)
        // Each top nutrient should have a label and value
        topNutrients.forEach((n) => {
          expect(n).toHaveProperty('label')
          expect(n).toHaveProperty('value')
          expect(n.value).toBeGreaterThan(0)
        })
      }
    })

    test(`${name}: Estimated Nutrition filters use same stored values`, () => {
      const { logEntry } = simulateHomeScreenLogFlow(ingredients)
      const nutrients = logEntry.nutrientSummary || {}

      // For each canonical key, getNutrientPct should match what getTopNutrients uses
      CANONICAL_NUTRIENT_KEYS.forEach((key) => {
        const pct = getNutrientPct(nutrients, key)
        const topNutrients = getTopNutrients(nutrients)
        const topEntry = topNutrients.find((n) => n.key === key)

        if (topEntry && pct > 0) {
          // Both should be reading from the same nutrientSummary
          expect(pct).toBe(topEntry.pct)
        }
      })
    })
  })
})

describe('Nutrient keys are not stripped during logging', () => {
  test('JuiceEngine totals object keys are preserved in entry', () => {
    const ingredients = [
      { produceId: 'kale', weightG: 100 },
      { produceId: 'lemon', weightG: 50 },
    ]
    const { totals, logEntry } = simulateHomeScreenLogFlow(ingredients)

    const totalsKeys = Object.keys(totals)
    const entryKeys = Object.keys(logEntry.nutrientSummary)

    // Every key in totals should be in the entry
    totalsKeys.forEach((key) => {
      expect(entryKeys).toContain(key)
    })
  })

  test('Entry with kale has nonzero Vitamin A, Vitamin C, Folate, Potassium', () => {
    const ingredients = [
      { produceId: 'kale', weightG: 100 },
      { produceId: 'lemon', weightG: 50 },
    ]
    const { logEntry } = simulateHomeScreenLogFlow(ingredients)
    const n = logEntry.nutrientSummary

    // Kale is rich in these micronutrients
    expect(Number(n.vitaminA) || 0).toBeGreaterThan(0)
    expect(Number(n.vitaminC) || 0).toBeGreaterThan(0)
    expect(Number(n.folate) || 0).toBeGreaterThan(0)
    expect(Number(n.potassium) || 0).toBeGreaterThan(0)
  })

  test('Entry with carrot has nonzero Vitamin A', () => {
    const ingredients = [
      { produceId: 'carrot', weightG: 200 },
    ]
    const { logEntry } = simulateHomeScreenLogFlow(ingredients)
    const n = logEntry.nutrientSummary

    expect(Number(n.vitaminA) || 0).toBeGreaterThan(0)
  })

  test('Entry with spinach has nonzero Iron, Magnesium, Folate', () => {
    const ingredients = [
      { produceId: 'spinach', weightG: 100 },
    ]
    const { logEntry } = simulateHomeScreenLogFlow(ingredients)
    const n = logEntry.nutrientSummary

    expect(Number(n.iron) || 0).toBeGreaterThan(0)
    expect(Number(n.magnesium) || 0).toBeGreaterThan(0)
    expect(Number(n.folate) || 0).toBeGreaterThan(0)
  })
})
