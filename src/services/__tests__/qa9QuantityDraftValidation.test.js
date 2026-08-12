// ─────────────────────────────────────────────────────────────
// qa9QuantityDraftValidation.test.js
//
// Tests that invalid draft quantities (0, blank, NaN) are
// immediately authoritative for canonical validation, disabling
// Log to Today and showing red X — even before recomputation
// succeeds.
// ─────────────────────────────────────────────────────────────

import {
  validateIngredientForLog,
  validateBatchForLog,
} from '../validateIngredientForLog'
import { recomputeFromQuantityChange } from '../producePortionConversion'

function makeKaleLeafValid(qty = 2, sizeKey = 'medium') {
  const result = recomputeFromQuantityChange({
    produceId: 'kale',
    quantity: qty,
    unitKey: 'leaf',
    sizeKey,
  })
  if (!result) throw new Error('Failed to compute kale leaf item')
  return {
    produceId: 'kale',
    weightG: result.weightG,
    isOrganic: false,
    portionEntryMode: 'quantity',
    portionMetadata: result.metadata,
    pendingUnitKey: 'leaf',
    pendingSizeKey: sizeKey,
  }
}

// Simulate what handleQuantityChange does when qty=0 and
// recomputeFromQuantityChange returns null — the draft
// enteredQuantity is stored but weightG is preserved.
function makeKaleLeafDraftInvalid(prevItem, draftQty) {
  return {
    ...prevItem,
    portionEntryMode: 'quantity',
    portionMetadata: {
      ...(prevItem.portionMetadata || {}),
      inputMode: 'quantity',
      enteredQuantity: draftQty,
      unitKey: prevItem.portionMetadata?.unitKey || prevItem.pendingUnitKey,
      sizeKey: prevItem.portionMetadata?.sizeKey || prevItem.pendingSizeKey,
      estimatedRawWeightG: prevItem.portionMetadata?.estimatedRawWeightG ?? 0,
      sourceVersion: prevItem.portionMetadata?.sourceVersion || 'draft',
      wasEstimateOverridden: prevItem.portionMetadata?.wasEstimateOverridden || false,
      originalEstimatedRawWeightG: prevItem.portionMetadata?.originalEstimatedRawWeightG ?? 0,
    },
  }
}

describe('QA9 P0-1: Draft quantity is authoritative for validation', () => {
  test('quantity=2 is valid → Log enabled', () => {
    const item = makeKaleLeafValid(2)
    const result = validateIngredientForLog(item)
    expect(result.valid).toBe(true)
  })

  test('change to 0 → draft quantity=0 → red X → Log disabled', () => {
    const valid = makeKaleLeafValid(2)
    const draft = makeKaleLeafDraftInvalid(valid, 0)
    const result = validateIngredientForLog(draft)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('invalid_quantity')
  })

  test('change 0 to blank (null) → invalid → Log disabled', () => {
    const valid = makeKaleLeafValid(2)
    const draft = makeKaleLeafDraftInvalid(valid, null)
    const result = validateIngredientForLog(draft)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('invalid_quantity')
  })

  test('change blank to 3 → valid → red X gone → Log enabled', () => {
    const valid = makeKaleLeafValid(2)
    const draftInvalid = makeKaleLeafDraftInvalid(valid, null)
    expect(validateIngredientForLog(draftInvalid).valid).toBe(false)

    // Now change to 3 — recomputation succeeds
    const restored = makeKaleLeafValid(3)
    const result = validateIngredientForLog(restored)
    expect(result.valid).toBe(true)
  })

  test('two valid ingredients + one draft invalid → Log disabled', () => {
    const valid1 = makeKaleLeafValid(2)
    const valid2 = makeKaleLeafValid(1)
    const invalid = makeKaleLeafDraftInvalid(valid2, 0)
    const batchResult = validateBatchForLog([valid1, invalid])
    expect(batchResult.valid).toBe(false)
    expect(batchResult.invalidIndices).toEqual([1])
  })

  test('submission handler called directly while draft invalid → refused', () => {
    const valid = makeKaleLeafValid(2)
    const draft = makeKaleLeafDraftInvalid(valid, 0)
    const batchResult = validateBatchForLog([draft])
    expect(batchResult.valid).toBe(false)
    // The submission handler would `return` here
  })

  test('fixing the invalid ingredient immediately enables Log', () => {
    const valid1 = makeKaleLeafValid(2)
    const invalid = makeKaleLeafDraftInvalid(valid1, 0)
    expect(validateBatchForLog([valid1, invalid]).valid).toBe(false)

    // Fix: change 0 to 3
    const fixed = makeKaleLeafValid(3)
    expect(validateBatchForLog([valid1, fixed]).valid).toBe(true)
  })
})
