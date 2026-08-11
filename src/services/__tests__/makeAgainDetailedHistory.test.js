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
