// ─────────────────────────────────────────────────────────────
// makeAgainHelper.test.js — Tests for the Make This Juice Again
// draft transformation helper.
//
// Covers:
//   1-10.  Basic draft creation from string-array ingredients
//   11-20. Draft creation from object-array ingredients
//   21-25. Primary produce preservation
//   26-30. Invalid/retired ingredient handling
//   31-35. Quantity normalization
//   36-40. Portion mode normalization
//   41-45. draftToPreloadIngredients conversion
//   46-50. hasUnsavedDraft helper
//   51-55. Immutability of original record
//   56-60. Edge cases (empty, null, corrupt)
// ─────────────────────────────────────────────────────────────

import {
  createEditableDraftFromHistoryEntry,
  draftToPreloadIngredients,
  hasUnsavedDraft,
} from '../makeAgainHelper'

// Minimal mock catalog matching PRODUCE_DATA shape
const MOCK_CATALOG = {
  kale: { name: 'Kale', category: 'vegetable' },
  spinach: { name: 'Spinach', category: 'vegetable' },
  carrot: { name: 'Carrot', category: 'vegetable' },
  celery: { name: 'Celery', category: 'vegetable' },
  apple: { name: 'Apple', category: 'fruit' },
  cucumber: { name: 'Cucumber', category: 'vegetable' },
}

// Mock the produceFamilies module
jest.mock('../produceFamilies', () => ({
  PRODUCE_FAMILIES: {},
  getProduceFamilyKey: jest.fn(() => null),
  getProduceFamilyMembers: jest.fn(() => []),
}))

describe('makeAgainHelper — basic draft creation (string array)', () => {
  const entry = {
    id: 'h1',
    createdAt: '2026-07-15T10:00:00',
    dateKey: '2026-07-15',
    source: 'photo',
    title: 'Green Juice',
    ingredients: ['kale', 'spinach', 'apple'],
  }

  test('1. Creates draft with correct number of ingredients', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(3)
  })

  test('2. Each ingredient has produceId', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    result.ingredients.forEach((ing) => {
      expect(ing.produceId).toBeTruthy()
      expect(typeof ing.produceId).toBe('string')
    })
  })

  test('3. Each ingredient has display name', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    result.ingredients.forEach((ing) => {
      expect(ing.name).toBeTruthy()
    })
  })

  test('4. Each ingredient has quantity', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    result.ingredients.forEach((ing) => {
      expect(ing.quantity).toBeGreaterThan(0)
    })
  })

  test('5. Default quantity is 1 for string-array entries', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('6. Each ingredient has portionEntryMode', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    result.ingredients.forEach((ing) => {
      expect(['quantity', 'volume', 'weight']).toContain(ing.portionEntryMode)
    })
  })

  test('7. Each ingredient has isOrganic property (boolean or undefined)', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    result.ingredients.forEach((ing) => {
      // isOrganic may be boolean (when explicitly set) or undefined
      // (for legacy entries without organic metadata)
      expect(ing.isOrganic === undefined || typeof ing.isOrganic === 'boolean').toBe(true)
    })
  })

  test('8. sourceHistoryEntryId is set', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.sourceHistoryEntryId).toBe('h1')
  })

  test('9. No skipped ingredients for valid entries', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.skippedIngredients).toHaveLength(0)
  })

  test('10. First ingredient is primary by default', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.primaryProduceId).toBe('kale')
    expect(result.ingredients[0].isPrimary).toBe(true)
  })
})

describe('makeAgainHelper — draft creation (object array)', () => {
  const entry = {
    id: 'h2',
    createdAt: '2026-07-15T10:00:00',
    dateKey: '2026-07-15',
    source: 'manual',
    title: 'Custom Juice',
    ingredients: [
      { produceId: 'kale', quantity: 2, portionEntryMode: 'quantity', isOrganic: true },
      { produceId: 'apple', quantity: 1, portionEntryMode: 'volume', portionUnit: 'cups', isOrganic: false },
    ],
  }

  test('11. Creates draft from object ingredients', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(2)
  })

  test('12. Preserves quantity from objects', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(2)
    expect(result.ingredients[1].quantity).toBe(1)
  })

  test('13. Preserves isOrganic from objects', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].isOrganic).toBe(true)
    expect(result.ingredients[1].isOrganic).toBe(false)
  })

  test('14. Preserves portionEntryMode from objects', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
    expect(result.ingredients[1].portionEntryMode).toBe('volume')
  })

  test('15. Preserves portionUnit from objects', () => {
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[1].portionUnit).toBe('cups')
  })

  test('16. Handles mixed string and object ingredients', () => {
    const entry2 = {
      id: 'h3',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', { produceId: 'apple', quantity: 3 }],
    }
    const result = createEditableDraftFromHistoryEntry(entry2, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(2)
    expect(result.ingredients[0].produceId).toBe('kale')
    expect(result.ingredients[1].produceId).toBe('apple')
    expect(result.ingredients[1].quantity).toBe(3)
  })

  test('17. Handles missing quantity in object (defaults to 1)', () => {
    const entry2 = {
      id: 'h4',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry2, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('18. Handles missing isOrganic in object (defaults to undefined for legacy)', () => {
    const entry2 = {
      id: 'h5',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry2, MOCK_CATALOG)
    // Legacy entries without isOrganic should have undefined, not false,
    // so seedPreloadIngredients uses the global organic default.
    expect(result.ingredients[0].isOrganic).toBeUndefined()
  })

  test('19. Handles missing portionEntryMode (defaults to quantity)', () => {
    const entry2 = {
      id: 'h6',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry2, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
  })

  test('20. Handles portionSize in objects', () => {
    const entry2 = {
      id: 'h7',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'apple', portionSize: 'large' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry2, MOCK_CATALOG)
    expect(result.ingredients[0].portionSize).toBe('large')
  })
})

describe('makeAgainHelper — primary produce', () => {
  test('21. Preserves stored primaryProduceId', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 'apple'],
      primaryProduceId: 'apple',
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.primaryProduceId).toBe('apple')
    expect(result.ingredients[1].isPrimary).toBe(true)
    expect(result.ingredients[0].isPrimary).toBe(false)
  })

  test('22. Falls back to first ingredient when stored primary is invalid', () => {
    const entry = {
      id: 'h2',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 'apple'],
      primaryProduceId: 'nonexistent',
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.primaryProduceId).toBe('kale')
  })

  test('23. Falls back to first ingredient when no stored primary', () => {
    const entry = {
      id: 'h3',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['spinach', 'kale'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.primaryProduceId).toBe('spinach')
  })

  test('24. Primary is null when no ingredients', () => {
    const entry = {
      id: 'h4',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.primaryProduceId).toBeNull()
  })

  test('25. Exactly one ingredient has isPrimary=true', () => {
    const entry = {
      id: 'h5',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 'spinach', 'apple'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    const primaryCount = result.ingredients.filter((i) => i.isPrimary).length
    expect(primaryCount).toBe(1)
  })
})

describe('makeAgainHelper — invalid/retired ingredients', () => {
  test('26. Skips retired ingredients', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 'old_retired_ingredient', 'apple'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(2)
    expect(result.skippedIngredients).toHaveLength(1)
    expect(result.skippedIngredients[0].reason).toBe('retired')
  })

  test('27. Skipped ingredient has originalId', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 'nonexistent'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.skippedIngredients[0].originalId).toBe('nonexistent')
  })

  test('28. Handles all-invalid ingredients (empty draft)', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['bad1', 'bad2'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(0)
    expect(result.skippedIngredients).toHaveLength(2)
  })

  test('29. Does not navigate for zero usable ingredients', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['bad1'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients.length).toBe(0)
  })

  test('30. Corrupt ingredient entries are skipped', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 42, null, 'apple'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(2)
    expect(result.skippedIngredients.length).toBeGreaterThanOrEqual(2)
  })
})

describe('makeAgainHelper — quantity normalization', () => {
  test('31. String quantity is parsed', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', quantity: '3' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(3)
  })

  test('32. Zero quantity defaults to 1', () => {
    const entry = {
      id: 'h2',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', quantity: 0 }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('33. Negative quantity defaults to 1', () => {
    const entry = {
      id: 'h3',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', quantity: -5 }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('34. NaN quantity defaults to 1', () => {
    const entry = {
      id: 'h4',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', quantity: NaN }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(1)
  })

  test('35. Missing quantity defaults to 1', () => {
    const entry = {
      id: 'h5',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].quantity).toBe(1)
  })
})

describe('makeAgainHelper — portion mode normalization', () => {
  test('36. Legacy "count" maps to "quantity"', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', portionEntryMode: 'count' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
  })

  test('37. Legacy "cups" maps to "volume"', () => {
    const entry = {
      id: 'h2',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', portionEntryMode: 'cups' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('volume')
  })

  test('38. Unknown mode defaults to "quantity"', () => {
    const entry = {
      id: 'h3',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', portionEntryMode: 'bogus' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
  })

  test('39. Valid "weight" mode is preserved', () => {
    const entry = {
      id: 'h4',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', portionEntryMode: 'weight' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('weight')
  })

  test('40. Missing mode defaults to "quantity"', () => {
    const entry = {
      id: 'h5',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale' }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0].portionEntryMode).toBe('quantity')
  })
})

describe('makeAgainHelper — draftToPreloadIngredients', () => {
  test('41. Converts draft to preload format', () => {
    const draft = [
      { produceId: 'kale', quantity: 2, isOrganic: true, portionEntryMode: 'quantity' },
    ]
    const preload = draftToPreloadIngredients(draft)
    expect(preload).toHaveLength(1)
    expect(preload[0].produceId).toBe('kale')
  })

  test('42. Includes weightG default', () => {
    const draft = [{ produceId: 'kale', isOrganic: false, portionEntryMode: 'weight' }]
    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].weightG).toBe(150)
  })

  test('43. Includes isOrganic', () => {
    const draft = [{ produceId: 'kale', isOrganic: true, portionEntryMode: 'weight' }]
    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].isOrganic).toBe(true)
  })

  test('44. Includes portionEntryMode', () => {
    const draft = [{ produceId: 'kale', isOrganic: false, portionEntryMode: 'volume' }]
    const preload = draftToPreloadIngredients(draft)
    expect(preload[0].portionEntryMode).toBe('volume')
  })

  test('45. Returns empty array for null input', () => {
    expect(draftToPreloadIngredients(null)).toEqual([])
  })
})

describe('makeAgainHelper — hasUnsavedDraft', () => {
  test('46. Returns false for null batch', () => {
    expect(hasUnsavedDraft(null)).toBe(false)
  })

  test('47. Returns false for empty batch', () => {
    expect(hasUnsavedDraft({ scannedIngredients: [] })).toBe(false)
  })

  test('48. Returns true for batch with ingredients', () => {
    expect(hasUnsavedDraft({ scannedIngredients: [{ produceId: 'kale' }] })).toBe(true)
  })

  test('49. Returns false for batch with no scannedIngredients key', () => {
    expect(hasUnsavedDraft({})).toBe(false)
  })

  test('50. Returns true for batch with multiple ingredients', () => {
    expect(hasUnsavedDraft({ scannedIngredients: [{ produceId: 'kale' }, { produceId: 'apple' }] })).toBe(true)
  })
})

describe('makeAgainHelper — immutability', () => {
  test('51. Does not mutate original entry', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale', 'apple'],
    }
    const before = JSON.stringify(entry)
    createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(JSON.stringify(entry)).toBe(before)
  })

  test('52. Does not mutate original ingredients array', () => {
    const ingredients = ['kale', 'apple']
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients,
    }
    const before = JSON.stringify(ingredients)
    createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(JSON.stringify(ingredients)).toBe(before)
  })

  test('53. Returns new ingredient objects (not references to entry)', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: [{ produceId: 'kale', quantity: 2 }],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0]).not.toBe(entry.ingredients[0])
  })

  test('54. Original nutrientSummary is not copied to draft', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale'],
      nutrientSummary: { vitaminC: 100 },
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0]).not.toHaveProperty('nutrientSummary')
  })

  test('55. Original scoreContribution is not copied to draft', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['kale'],
      scoreContribution: { score: 50 },
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients[0]).not.toHaveProperty('scoreContribution')
  })
})

describe('makeAgainHelper — edge cases', () => {
  test('56. Null entry returns empty result', () => {
    const result = createEditableDraftFromHistoryEntry(null, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(0)
    expect(result.primaryProduceId).toBeNull()
  })

  test('57. Undefined entry returns empty result', () => {
    const result = createEditableDraftFromHistoryEntry(undefined, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(0)
  })

  test('58. Entry with no ingredients array returns empty result', () => {
    const result = createEditableDraftFromHistoryEntry({ id: 'h1' }, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(0)
  })

  test('59. Entry with non-array ingredients returns empty result', () => {
    const result = createEditableDraftFromHistoryEntry({ id: 'h1', ingredients: 'kale' }, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(0)
  })

  test('60. Case-insensitive produceId matching', () => {
    const entry = {
      id: 'h1',
      createdAt: '2026-07-15T10:00:00',
      dateKey: '2026-07-15',
      ingredients: ['KALE', 'Apple'],
    }
    const result = createEditableDraftFromHistoryEntry(entry, MOCK_CATALOG)
    expect(result.ingredients).toHaveLength(2)
    expect(result.ingredients[0].produceId).toBe('kale')
  })
})
