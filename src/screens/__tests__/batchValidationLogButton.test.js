// ─────────────────────────────────────────────────────────────
// batchValidationLogButton.test.js — Tests that Log to Today
// is disabled when any ingredient has a validation error,
// and that the submission handler also guards against invalid batches.
//
// Updated for QA8: hasInvalidIngredients now delegates to the
// canonical validateBatchForLog validator. Source-level checks
// verify the canonical import and delegation pattern.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

describe('hasInvalidIngredients — source-level checks', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'HomeScreen.js'),
    'utf8',
  )

  test('hasInvalidIngredients is a useMemo', () => {
    expect(src).toMatch(/hasInvalidIngredients.*=.*useMemo/)
  })

  test('hasInvalidIngredients delegates to validateBatchForLog', () => {
    const idx = src.indexOf('hasInvalidIngredients')
    const section = src.slice(idx, idx + 500)
    expect(section).toMatch(/validateBatchForLog/)
    expect(section).toMatch(/\.valid/)
  })

  test('HomeScreen imports validateBatchForLog', () => {
    expect(src).toMatch(/validateBatchForLog/)
    expect(src).toMatch(/from.*validateIngredientForLog/)
  })

  test('HomeScreen imports validateIngredientForLog', () => {
    expect(src).toMatch(/validateIngredientForLog/)
  })

  test('Log button disabled prop uses hasInvalidIngredients', () => {
    expect(src).toMatch(/disabled=\{isLogging \|\| hasInvalidIngredients\}/)
  })

  test('handleLogToChallenge guards with validateBatchForLog', () => {
    const idx = src.indexOf('handleLogToChallenge')
    const section = src.slice(idx, idx + 400)
    expect(section).toMatch(/validateBatchForLog/)
    expect(section).toMatch(/\.valid\).*return/)
  })

  test('executeLogToChallenge guards with validateBatchForLog', () => {
    // Find the actual function definition (not the comment or call)
    const defIdx = src.indexOf('const executeLogToChallenge')
    expect(defIdx).toBeGreaterThan(-1)
    const section = src.slice(defIdx, defIdx + 400)
    expect(section).toMatch(/validateBatchForLog/)
    expect(section).toMatch(/\.valid\).*return/)
  })

  test('ProduceEditRow uses validateIngredientForLog for row error', () => {
    expect(src).toMatch(/validateIngredientForLog\(item\)/)
    expect(src).toMatch(/rowErrorMessage/)
  })

  test('Supporting copy shown when ingredients invalid', () => {
    expect(src).toMatch(/Resolve ingredient errors before logging/)
  })
})

describe('Batch validation — runtime behavior simulation', () => {
  // Simulate the hasInvalidIngredients logic
  function hasInvalidIngredients(ingredients) {
    for (const item of ingredients) {
      if (item.produceId && item.portionEntryMode === 'quantity') {
        const unitKey = item.portionMetadata?.unitKey || item.pendingUnitKey
        if (!unitKey) return true
        // Validate unitKey against supported units
        if (item.unitSupported === false) return true
        const hasSML = item.hasSML || false
        const sizeKey = item.portionMetadata?.sizeKey || item.pendingSizeKey || null
        if (hasSML && !sizeKey) return true
        const qty = item.portionMetadata?.enteredQuantity
        if (!qty || qty <= 0 || isNaN(qty)) return true
        if (item.conversionFails) return true
      } else {
        // Weight-mode or non-quantity
        if (!item.weightG || item.weightG <= 0 || isNaN(item.weightG)) return true
      }
    }
    return false
  }

  test('Empty batch → not invalid (no ingredients to check)', () => {
    expect(hasInvalidIngredients([])).toBe(false)
  })

  test('Single valid ingredient → not invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'carrot', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'whole', sizeKey: 'medium', enteredQuantity: 2 }, hasSML: true, conversionFails: false },
    ])).toBe(false)
  })

  test('Ingredient with missing sizeKey → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'kale', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', enteredQuantity: 3 }, hasSML: true, pendingSizeKey: null, conversionFails: false },
    ])).toBe(true)
  })

  test('Ingredient with zero quantity → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'spinach', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'handful', enteredQuantity: 0 }, hasSML: false, conversionFails: false },
    ])).toBe(true)
  })

  test('Ingredient with conversion failure → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'carrot', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'whole', sizeKey: 'medium', enteredQuantity: 2 }, hasSML: true, conversionFails: true },
    ])).toBe(true)
  })

  test('One valid + one invalid (missing sizeKey) → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'carrot', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'whole', sizeKey: 'medium', enteredQuantity: 2 }, hasSML: true, conversionFails: false },
      { produceId: 'kale', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', enteredQuantity: 3 }, hasSML: true, pendingSizeKey: null, conversionFails: false },
    ])).toBe(true)
  })

  test('Two valid ingredients → not invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'carrot', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'whole', sizeKey: 'medium', enteredQuantity: 2 }, hasSML: true, conversionFails: false },
      { produceId: 'spinach', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'handful', enteredQuantity: 1 }, hasSML: false, conversionFails: false },
    ])).toBe(false)
  })

  test('Three ingredients with one invalid → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'carrot', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'whole', sizeKey: 'medium', enteredQuantity: 2 }, hasSML: true, conversionFails: false },
      { produceId: 'spinach', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'handful', enteredQuantity: 1 }, hasSML: false, conversionFails: false },
      { produceId: 'kale', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', enteredQuantity: 0 }, hasSML: true, conversionFails: false },
    ])).toBe(true)
  })

  test('Resolving invalid ingredient makes batch valid', () => {
    const invalidBatch = [
      { produceId: 'kale', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', enteredQuantity: 3 }, hasSML: true, pendingSizeKey: null, conversionFails: false },
    ]
    expect(hasInvalidIngredients(invalidBatch)).toBe(true)

    // Resolve: set sizeKey to medium
    const resolvedBatch = [
      { produceId: 'kale', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', sizeKey: 'medium', enteredQuantity: 3 }, hasSML: true, conversionFails: false },
    ]
    expect(hasInvalidIngredients(resolvedBatch)).toBe(false)
  })

  test('Weight-mode ingredient with valid weight → not invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'apple', portionEntryMode: 'weight', weightG: 150 },
    ])).toBe(false)
  })

  test('Weight-mode ingredient with zero weight → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'apple', portionEntryMode: 'weight', weightG: 0 },
    ])).toBe(true)
  })

  test('Mixed valid weight + invalid quantity → invalid', () => {
    expect(hasInvalidIngredients([
      { produceId: 'apple', portionEntryMode: 'weight', weightG: 150 },
      { produceId: 'kale', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', enteredQuantity: 3 }, hasSML: true, pendingSizeKey: null, conversionFails: false },
    ])).toBe(true)
  })

  test('Stale unitKey from different produce (leaf on spinach) → invalid', () => {
    // Simulate: kale's 'leaf' unit key persisted on spinach after produce swap
    expect(hasInvalidIngredients([
      { produceId: 'spinach', portionEntryMode: 'quantity', portionMetadata: { unitKey: 'leaf', sizeKey: 'medium', enteredQuantity: 3 }, hasSML: true, conversionFails: false, unitSupported: false },
    ])).toBe(true)
  })
})
