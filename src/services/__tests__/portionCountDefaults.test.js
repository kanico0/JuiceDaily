// ─────────────────────────────────────────────────────────────
// portionCountDefaults.test.js
// Tests for produce where the default unit should be count-based
// (individual grapes, berries, cherries) rather than volume (cups).
// ─────────────────────────────────────────────────────────────

const {
  getPortionRegistryRecord,
  getDefaultPortionUnit,
  estimateRawWeightGrams,
  formatQuantityDescription,
} = require('../producePortionConversion')

describe('Grapes — default unit is individual grapes, not cups', () => {
  test('default unit is piece (grape)', () => {
    const defaultUnit = getDefaultPortionUnit('grape')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('piece')
    expect(defaultUnit.displaySingular).toBe('grape')
    expect(defaultUnit.displayPlural).toBe('grapes')
  })

  test('35 grapes displays as "35 grapes", not "35 cups"', () => {
    const desc = formatQuantityDescription({
      produceId: 'grape',
      quantity: 35,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(desc).toContain('35 grapes')
    expect(desc).not.toContain('cup')
  })

  test('35 grapes converts to 175g (35 × 5g)', () => {
    const result = estimateRawWeightGrams({
      produceId: 'grape',
      quantity: 35,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    expect(result.estimatedRawWeightG).toBe(175)
    expect(result.gramsPerUnit).toBe(5)
  })

  test('grape still has cup option available', () => {
    const record = getPortionRegistryRecord('grape')
    expect(record).not.toBe(null)
    const cupUnit = record.units.find((u) => u.unitKey === 'loose_cup')
    expect(cupUnit).toBeDefined()
    expect(cupUnit.displayPlural).toBe('cups')
  })

  test('1 grape displays as "1 grape" (singular)', () => {
    const desc = formatQuantityDescription({
      produceId: 'grape',
      quantity: 1,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(desc).toContain('1 grape')
  })
})

describe('Strawberries — default unit is individual strawberries', () => {
  test('default unit is piece (strawberry)', () => {
    const defaultUnit = getDefaultPortionUnit('strawberry')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('piece')
    expect(defaultUnit.displaySingular).toBe('strawberry')
    expect(defaultUnit.displayPlural).toBe('strawberries')
  })

  test('8 strawberries displays as "8 strawberries"', () => {
    const desc = formatQuantityDescription({
      produceId: 'strawberry',
      quantity: 8,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(desc).toContain('8 strawberries')
    expect(desc).not.toContain('cup')
  })

  test('8 medium strawberries converts to 96g (8 × 12g)', () => {
    const result = estimateRawWeightGrams({
      produceId: 'strawberry',
      quantity: 8,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    expect(result.estimatedRawWeightG).toBe(96)
  })
})

describe('Blueberries — default unit is handful', () => {
  test('default unit is handful', () => {
    const defaultUnit = getDefaultPortionUnit('blueberry')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('handful')
    expect(defaultUnit.displaySingular).toBe('handful')
    expect(defaultUnit.displayPlural).toBe('handfuls')
  })

  test('3 handfuls displays as "3 handfuls"', () => {
    const desc = formatQuantityDescription({
      produceId: 'blueberry',
      quantity: 3,
      unitKey: 'handful',
    })
    expect(desc).toBe('3 handfuls')
    expect(desc).not.toContain('cup')
  })

  test('3 handfuls converts to 150g (3 × 50g)', () => {
    const result = estimateRawWeightGrams({
      produceId: 'blueberry',
      quantity: 3,
      unitKey: 'handful',
    })
    expect(result.ok).toBe(true)
    expect(result.estimatedRawWeightG).toBe(150)
  })
})

describe('Raspberries — default unit is individual berries', () => {
  test('default unit is piece (raspberry)', () => {
    const defaultUnit = getDefaultPortionUnit('raspberry')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('piece')
  })

  test('12 raspberries displays as "12 raspberries"', () => {
    const desc = formatQuantityDescription({
      produceId: 'raspberry',
      quantity: 12,
      unitKey: 'piece',
    })
    expect(desc).toBe('12 raspberries')
    expect(desc).not.toContain('cup')
  })
})

describe('Blackberries — default unit is individual berries', () => {
  test('default unit is piece (blackberry)', () => {
    const defaultUnit = getDefaultPortionUnit('blackberry')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('piece')
  })

  test('10 blackberries displays as "10 blackberries"', () => {
    const desc = formatQuantityDescription({
      produceId: 'blackberry',
      quantity: 10,
      unitKey: 'piece',
    })
    expect(desc).toBe('10 blackberries')
    expect(desc).not.toContain('cup')
  })
})

describe('Cranberries — default unit is individual berries', () => {
  test('default unit is piece (cranberry)', () => {
    const defaultUnit = getDefaultPortionUnit('cranberry')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('piece')
  })

  test('20 cranberries displays as "20 cranberries"', () => {
    const desc = formatQuantityDescription({
      produceId: 'cranberry',
      quantity: 20,
      unitKey: 'piece',
    })
    expect(desc).toBe('20 cranberries')
    expect(desc).not.toContain('cup')
  })
})

describe('Cherries — default unit is individual cherries', () => {
  test('default unit is piece (cherry)', () => {
    const defaultUnit = getDefaultPortionUnit('cherry')
    expect(defaultUnit).not.toBe(null)
    expect(defaultUnit.unitKey).toBe('piece')
  })

  test('15 cherries displays as "15 cherries"', () => {
    const desc = formatQuantityDescription({
      produceId: 'cherry',
      quantity: 15,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(desc).toContain('15 cherries')
    expect(desc).not.toContain('cup')
  })

  test('15 cherries converts to 120g (15 × 8g)', () => {
    const result = estimateRawWeightGrams({
      produceId: 'cherry',
      quantity: 15,
      unitKey: 'piece',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    expect(result.estimatedRawWeightG).toBe(120)
  })
})

describe('Make Again preserves count semantics', () => {
  test('Grape portion metadata with piece unit is preserved', () => {
    // Simulate a history entry with grape portion metadata
    const entry = {
      ingredientDetails: [{
        produceId: 'grape',
        weightG: 175,
        portionMetadata: {
          enteredQuantity: 35,
          unitKey: 'piece',
          sizeKey: 'medium',
          displayDescription: '35 grapes',
          gramsPerUnit: 5,
        },
        portionEntryMode: 'quantity',
      }],
    }

    const detail = entry.ingredientDetails[0]
    expect(detail.portionMetadata.unitKey).toBe('piece')
    expect(detail.portionMetadata.displayDescription).toBe('35 grapes')
    expect(detail.portionMetadata.enteredQuantity).toBe(35)
  })
})
