// ─────────────────────────────────────────────────────────────
// makeAgainDetailedHistory.test.js
// Regression tests for Make Again with ingredientDetails support.
// ─────────────────────────────────────────────────────────────

const {
  createEditableDraftFromHistoryEntry,
  draftToPreloadIngredients,
} = require('../makeAgainHelper')

describe('Make Again — ingredientDetails support', () => {
  test('uses ingredientDetails weightG when available', () => {
    const entry = {
      id: 'test1',
      ingredients: ['kale', 'apple'],
      ingredientDetails: [
        { produceId: 'kale', weightG: 200, portionEntryMode: 'weight' },
        { produceId: 'apple', weightG: 120, portionEntryMode: 'weight' },
      ],
    }

    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients).toHaveLength(2)
    expect(result.ingredients[0].weightG).toBe(200)
    expect(result.ingredients[1].weightG).toBe(120)
  })

  test('uses ingredientDetails portionMetadata for quantity mode', () => {
    const entry = {
      id: 'test2',
      ingredients: ['apple'],
      ingredientDetails: [
        {
          produceId: 'apple',
          weightG: 180,
          portionEntryMode: 'quantity',
          portionMetadata: {
            unitKey: 'whole',
            sizeKey: 'medium',
            enteredQuantity: 1,
          },
        },
      ],
    }

    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients).toHaveLength(1)
    expect(result.ingredients[0].weightG).toBe(180)
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
  })

  test('falls back to default 150g when ingredientDetails missing', () => {
    const entry = {
      id: 'test3',
      ingredients: ['kale', 'apple'],
      // No ingredientDetails — legacy entry
    }

    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients).toHaveLength(2)
    expect(result.ingredients[0].weightG).toBe(150)
    expect(result.ingredients[1].weightG).toBe(150)
  })

  test('falls back to default 150g when weightG is missing in details', () => {
    const entry = {
      id: 'test4',
      ingredients: ['kale'],
      ingredientDetails: [
        { produceId: 'kale', portionEntryMode: 'weight' }, // no weightG
      ],
    }

    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients).toHaveLength(1)
    expect(result.ingredients[0].weightG).toBe(150)
  })

  test('draftToPreloadIngredients uses weightG from draft', () => {
    const draft = [
      { produceId: 'kale', weightG: 200, isOrganic: false, portionEntryMode: 'weight' },
      { produceId: 'apple', weightG: 120, isOrganic: true, portionEntryMode: 'weight' },
    ]

    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].weightG).toBe(200)
    expect(preload[1].weightG).toBe(120)
  })

  test('draftToPreloadIngredients falls back to 150 when weightG missing', () => {
    const draft = [
      { produceId: 'kale', isOrganic: false, portionEntryMode: 'weight' },
    ]

    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].weightG).toBe(150)
  })

  test('legacy string-array ingredients still work without ingredientDetails', () => {
    const entry = {
      id: 'test5',
      ingredients: ['kale', 'spinach', 'apple'],
    }

    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients).toHaveLength(3)
    expect(result.skippedIngredients).toHaveLength(0)
    expect(result.primaryProduceId).toBeTruthy()
  })

  test('Make Again does not regress with new fields present', () => {
    const entry = {
      id: 'test6',
      ingredients: ['kale', 'apple'],
      ingredientDetails: [
        { produceId: 'kale', weightG: 200, portionEntryMode: 'weight' },
        { produceId: 'apple', weightG: 100, portionEntryMode: 'weight' },
      ],
      rating: 5,
      note: 'Great juice',
      favorite: true,
    }

    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients).toHaveLength(2)
    expect(result.skippedIngredients).toHaveLength(0)
    // New fields should not interfere with Make Again
    expect(result.sourceHistoryEntryId).toBe('test6')
  })
})

// ── Measurement unit preservation tests ──────────────────────
describe('Make Again — original measurement unit preservation', () => {
  test('preserves enteredWeightValue and enteredWeightUnit for weight-mode grams', () => {
    const entry = {
      id: 'unit-1',
      ingredients: ['lemon'],
      ingredientDetails: [
        {
          produceId: 'lemon',
          weightG: 150,
          portionEntryMode: 'weight',
          enteredWeightValue: 150,
          enteredWeightUnit: 'g',
        },
      ],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients[0].enteredWeightValue).toBe(150)
    expect(result.ingredients[0].enteredWeightUnit).toBe('g')
    expect(result.ingredients[0].weightG).toBe(150)
  })

  test('preserves enteredWeightValue and enteredWeightUnit for weight-mode ounces', () => {
    const entry = {
      id: 'unit-2',
      ingredients: ['lemon'],
      ingredientDetails: [
        {
          produceId: 'lemon',
          weightG: 150,
          portionEntryMode: 'weight',
          enteredWeightValue: 5.3,
          enteredWeightUnit: 'oz',
        },
      ],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients[0].enteredWeightValue).toBe(5.3)
    expect(result.ingredients[0].enteredWeightUnit).toBe('oz')
    expect(result.ingredients[0].weightG).toBe(150)
  })

  test('does not set entered weight fields for quantity mode', () => {
    const entry = {
      id: 'unit-3',
      ingredients: ['carrot'],
      ingredientDetails: [
        {
          produceId: 'carrot',
          weightG: 120,
          portionEntryMode: 'quantity',
          portionMetadata: {
            unitKey: 'whole',
            sizeKey: 'medium',
            enteredQuantity: 2,
          },
          enteredWeightValue: 120,
          enteredWeightUnit: 'g',
        },
      ],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    // Quantity mode should NOT carry entered weight fields
    expect(result.ingredients[0].enteredWeightValue).toBeUndefined()
    expect(result.ingredients[0].enteredWeightUnit).toBeUndefined()
    // But weightG should still be preserved
    expect(result.ingredients[0].weightG).toBe(120)
  })

  test('legacy entries without enteredWeight fields fall back gracefully', () => {
    const entry = {
      id: 'unit-4',
      ingredients: ['kale'],
      ingredientDetails: [
        { produceId: 'kale', weightG: 200, portionEntryMode: 'weight' },
      ],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    expect(result.ingredients[0].enteredWeightValue).toBeUndefined()
    expect(result.ingredients[0].enteredWeightUnit).toBeUndefined()
    expect(result.ingredients[0].weightG).toBe(200)
  })

  test('draftToPreloadIngredients passes through enteredWeight fields', () => {
    const draft = [
      {
        produceId: 'lemon',
        weightG: 150,
        isOrganic: false,
        portionEntryMode: 'weight',
        enteredWeightValue: 5.3,
        enteredWeightUnit: 'oz',
      },
    ]
    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].enteredWeightValue).toBe(5.3)
    expect(preload[0].enteredWeightUnit).toBe('oz')
    expect(preload[0].weightG).toBe(150)
  })

  test('draftToPreloadIngredients handles missing enteredWeight fields', () => {
    const draft = [
      { produceId: 'kale', weightG: 200, isOrganic: false, portionEntryMode: 'weight' },
    ]
    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].enteredWeightValue).toBeUndefined()
    expect(preload[0].enteredWeightUnit).toBeUndefined()
  })

  test('canonical weightG remains correct regardless of display unit', () => {
    const entry = {
      id: 'unit-5',
      ingredients: ['lemon'],
      ingredientDetails: [
        {
          produceId: 'lemon',
          weightG: 150,
          portionEntryMode: 'weight',
          enteredWeightValue: 5.3,
          enteredWeightUnit: 'oz',
        },
      ],
    }
    const result = createEditableDraftFromHistoryEntry(entry)
    const preload = draftToPreloadIngredients(result.ingredients)
    // Canonical weightG is always in grams
    expect(preload[0].weightG).toBe(150)
  })

  test('still only one Make Again pathway (createEditableDraftFromHistoryEntry → draftToPreloadIngredients)', () => {
    // Verify the pipeline is still a single function chain
    const entry = {
      id: 'unit-6',
      ingredients: ['kale', 'lemon'],
      ingredientDetails: [
        { produceId: 'kale', weightG: 100, portionEntryMode: 'weight', enteredWeightValue: 100, enteredWeightUnit: 'g' },
        { produceId: 'lemon', weightG: 60, portionEntryMode: 'weight', enteredWeightValue: 2.1, enteredWeightUnit: 'oz' },
      ],
    }
    const draft = createEditableDraftFromHistoryEntry(entry)
    const preload = draftToPreloadIngredients(draft.ingredients)
    expect(preload).toHaveLength(2)
    expect(preload[0].produceId).toBe('kale')
    expect(preload[0].enteredWeightUnit).toBe('g')
    expect(preload[1].produceId).toBe('lemon')
    expect(preload[1].enteredWeightUnit).toBe('oz')
  })
})
