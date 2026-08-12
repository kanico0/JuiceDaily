// ─────────────────────────────────────────────────────────────
// nutrientEndToEnd.test.js
// End-to-end nutrient flow test:
// processJuiceBatch → addLogEntry → reducer → getTopNutrients
// Verifies that micronutrients survive the entire pipeline
// and that getTopNutrients returns them for rendering.
// ─────────────────────────────────────────────────────────────

const { processJuiceBatch } = require('../JuiceEngine')
const { getTopNutrients, getBasicNutritionStats } = require('../detailedHistoryHelpers')
const { hasMicronutrientData, CANONICAL_NUTRIENT_KEYS } = require('../nutrientKeys')

// Simulate JuiceLogStore reducer ADD_ENTRY
function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [...state.entries, action.payload],
      }
    default:
      return state
  }
}

// Simulate addLogEntry from JuiceLogStore
function addLogEntry({ source, ingredientIds, nutrientSummary, ingredientDetails }) {
  return {
    id: 'test-entry-' + Math.random().toString(36).slice(2),
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

// Simulate AsyncStorage serialization/deserialization
function simulateAsyncStorageRoundTrip(entries) {
  const serialized = JSON.stringify(entries)
  const deserialized = JSON.parse(serialized)
  return deserialized
}

describe('Nutrient end-to-end flow — kale + spinach + carrot juice', () => {
  const ingredients = [
    { produceId: 'kale', weightG: 100 },
    { produceId: 'spinach', weightG: 100 },
    { produceId: 'carrot', weightG: 150 },
    { produceId: 'lemon', weightG: 30 },
  ]

  let juiceResult
  let totals
  let entry
  let stateAfterReducer
  let stateAfterHydration
  let selectedEntry
  let topNutrients
  let basicStats

  beforeAll(() => {
    // A — Before History persistence: batch.totals
    juiceResult = processJuiceBatch(ingredients, 'cold_pressed')
    totals = juiceResult.totals

    // B — At addLogEntry(): nutrientSummary passed
    entry = addLogEntry({
      source: 'photo',
      ingredientIds: ingredients.map((i) => i.produceId),
      nutrientSummary: totals,
      ingredientDetails: ingredients.map((i) => ({
        produceId: i.produceId,
        weightG: i.weightG,
      })),
    })

    // C — JuiceLogStore state after reducer
    const initialState = { entries: [] }
    stateAfterReducer = reducer(initialState, { type: 'ADD_ENTRY', payload: entry })

    // D — AsyncStorage serialization (JSON round-trip)
    stateAfterHydration = simulateAsyncStorageRoundTrip(stateAfterReducer.entries)

    // E — HistoryScreen selected live entry
    selectedEntry = stateAfterHydration.find((e) => e.id === entry.id)

    // F — getTopNutrients()
    const nutrients = selectedEntry.nutrientSummary || {}
    topNutrients = getTopNutrients(nutrients)
    basicStats = getBasicNutritionStats(nutrients)
  })

  test('A — batch.totals contains supported micronutrient keys', () => {
    expect(Number(totals.vitaminC) || 0).toBeGreaterThan(0)
    expect(Number(totals.vitaminA) || 0).toBeGreaterThan(0)
    expect(Number(totals.potassium) || 0).toBeGreaterThan(0)
    expect(Number(totals.iron) || 0).toBeGreaterThan(0)
    expect(Number(totals.magnesium) || 0).toBeGreaterThan(0)
    expect(Number(totals.folate) || 0).toBeGreaterThan(0)
  })

  test('B — nutrientSummary passed to addLogEntry is the same object', () => {
    expect(entry.nutrientSummary).toBe(totals)
  })

  test('C — JuiceLogStore state after reducer contains micronutrients', () => {
    const stored = stateAfterReducer.entries[0].nutrientSummary
    expect(Number(stored.vitaminC) || 0).toBeGreaterThan(0)
    expect(Number(stored.vitaminA) || 0).toBeGreaterThan(0)
    expect(Number(stored.potassium) || 0).toBeGreaterThan(0)
    expect(Number(stored.iron) || 0).toBeGreaterThan(0)
    expect(Number(stored.magnesium) || 0).toBeGreaterThan(0)
    expect(Number(stored.folate) || 0).toBeGreaterThan(0)
  })

  test('D — AsyncStorage round-trip preserves micronutrient keys', () => {
    const hydrated = stateAfterHydration[0].nutrientSummary
    expect(Number(hydrated.vitaminC) || 0).toBeGreaterThan(0)
    expect(Number(hydrated.vitaminA) || 0).toBeGreaterThan(0)
    expect(Number(hydrated.potassium) || 0).toBeGreaterThan(0)
    expect(Number(hydrated.iron) || 0).toBeGreaterThan(0)
    expect(Number(hydrated.magnesium) || 0).toBeGreaterThan(0)
    expect(Number(hydrated.folate) || 0).toBeGreaterThan(0)
  })

  test('E — HistoryScreen selected entry contains micronutrients', () => {
    const n = selectedEntry.nutrientSummary
    expect(Number(n.vitaminC) || 0).toBeGreaterThan(0)
    expect(Number(n.vitaminA) || 0).toBeGreaterThan(0)
    expect(Number(n.potassium) || 0).toBeGreaterThan(0)
  })

  test('F — getTopNutrients returns nonzero micronutrients', () => {
    expect(topNutrients.length).toBeGreaterThan(0)

    // Should contain at least some of the canonical nutrients
    const keys = topNutrients.map((n) => n.key)
    const canonicalPresent = CANONICAL_NUTRIENT_KEYS.filter((k) => keys.includes(k))
    expect(canonicalPresent.length).toBeGreaterThanOrEqual(3)
  })

  test('F — getTopNutrients entries have label, value, and pct', () => {
    topNutrients.forEach((n) => {
      expect(n).toHaveProperty('label')
      expect(n).toHaveProperty('value')
      expect(n).toHaveProperty('pct')
      expect(n.value).toBeGreaterThan(0)
      expect(n.pct).toBeGreaterThan(0)
    })
  })

  test('G — UI render condition: hasMicronutrientData is true', () => {
    const n = selectedEntry.nutrientSummary
    expect(hasMicronutrientData(n)).toBe(true)
  })

  test('G — basicStats contains calories and sugar', () => {
    expect(Number(basicStats.calories) || 0).toBeGreaterThan(0)
    expect(Number(basicStats.sugar) || 0).toBeGreaterThan(0)
  })

  test('Full pipeline: totals → entry → reducer → hydration → getTopNutrients', () => {
    // Verify values are consistent across the pipeline
    const originalVitC = Number(totals.vitaminC) || 0
    const entryVitC = Number(entry.nutrientSummary.vitaminC) || 0
    const storedVitC = Number(stateAfterReducer.entries[0].nutrientSummary.vitaminC) || 0
    const hydratedVitC = Number(stateAfterHydration[0].nutrientSummary.vitaminC) || 0
    const selectedVitC = Number(selectedEntry.nutrientSummary.vitaminC) || 0

    expect(entryVitC).toBe(originalVitC)
    expect(storedVitC).toBe(originalVitC)
    expect(hydratedVitC).toBe(originalVitC)
    expect(selectedVitC).toBe(originalVitC)
  })
})

describe('Nutrient end-to-end — grape juice', () => {
  const ingredients = [
    { produceId: 'grape', weightG: 175 }, // 35 grapes × 5g
  ]

  test('Grape juice contains potassium and other micronutrients', () => {
    const juiceResult = processJuiceBatch(ingredients, 'cold_pressed')
    const totals = juiceResult.totals

    // Grapes have potassium (191mg/100g)
    expect(Number(totals.potassium) || 0).toBeGreaterThan(0)

    // Create entry and verify pipeline
    const entry = addLogEntry({
      source: 'photo',
      ingredientIds: ['grape'],
      nutrientSummary: totals,
    })

    const state = reducer({ entries: [] }, { type: 'ADD_ENTRY', payload: entry })
    const hydrated = simulateAsyncStorageRoundTrip(state.entries)
    const selected = hydrated[0]
    const nutrients = selected.nutrientSummary

    const topNutrients = getTopNutrients(nutrients)
    expect(topNutrients.length).toBeGreaterThan(0)
  })
})
