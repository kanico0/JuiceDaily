// ─────────────────────────────────────────────────────────────
// validateIngredientForLog.js
//
// Canonical, pure validation for ingredient log eligibility.
//
// This is the SINGLE source of truth used by:
//   1. The visible red-X / error display on each ingredient row
//   2. The "Log to Today" button disabled state
//   3. The final submission guard in handleLogToChallenge
//
// No parallel validation formulas are permitted — all three
// consumers must import and call these functions.
// ─────────────────────────────────────────────────────────────

import {
  isQuantitySupported,
  getSupportedPortionUnits,
  getSupportedSizes,
  estimateRawWeightGrams,
} from './producePortionConversion'

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string|null} errorCode
 * @property {string|null} message
 */

/**
 * Validates a single scanned ingredient for log eligibility.
 *
 * @param {Object} item - A scanned ingredient object.
 * @returns {ValidationResult}
 */
export function validateIngredientForLog(item) {
  if (!item || !item.produceId) {
    return { valid: false, errorCode: 'missing_produce', message: 'Missing produce.' }
  }

  const quantitySupported = isQuantitySupported(item.produceId)

  // ── Weight-mode or non-quantity produce ──
  if (!quantitySupported || item.portionEntryMode !== 'quantity') {
    if (!item.weightG || item.weightG <= 0 || isNaN(item.weightG)) {
      return {
        valid: false,
        errorCode: 'invalid_weight',
        message: 'Enter a raw produce weight greater than zero.',
      }
    }
    return { valid: true, errorCode: null, message: null }
  }

  // ── Quantity-mode ingredient ──
  const meta = item.portionMetadata
  const qty = meta?.enteredQuantity

  if (!qty || qty <= 0 || isNaN(qty)) {
    return {
      valid: false,
      errorCode: 'invalid_quantity',
      message: 'Enter a quantity greater than zero.',
    }
  }

  // Resolve unitKey from metadata or pending state.
  // Do NOT fall back to a default unit here — the auto-selection
  // in QuantityPortionEditor / handleModeChange should have already
  // set one. If it's missing, that's a bug to flag, not hide.
  const rawUnitKey = meta?.unitKey || item.pendingUnitKey || null
  const supportedUnits = getSupportedPortionUnits(item.produceId)

  if (!rawUnitKey) {
    return {
      valid: false,
      errorCode: 'missing_unit',
      message: 'Select a unit for this ingredient.',
    }
  }

  // Validate unitKey against ALL supported units (count + volume)
  const unitIsValid = supportedUnits.some((u) => u.unitKey === rawUnitKey)
  if (!unitIsValid) {
    return {
      valid: false,
      errorCode: 'unknown_unit',
      message: `Unknown unit "${rawUnitKey}" for this ingredient.`,
    }
  }

  const unitKey = rawUnitKey
  const sizes = getSupportedSizes(item.produceId, unitKey)
  const hasSML = sizes.some((s) => s.sizeKey !== 'standard')

  // Resolve sizeKey from metadata or pending state.
  // Do NOT fall back to a default size here — the auto-selection
  // in QuantityPortionEditor should have already set one. If it's
  // missing, that's a bug to flag, not hide.
  const sizeKey = meta?.sizeKey || item.pendingSizeKey || null

  if (hasSML && !sizeKey) {
    return {
      valid: false,
      errorCode: 'size_required',
      message: 'Select a size (small, medium, or large).',
    }
  }

  if (sizeKey && !sizes.some((s) => s.sizeKey === sizeKey)) {
    return {
      valid: false,
      errorCode: 'unknown_size',
      message: `Unknown size "${sizeKey}" for unit "${unitKey}".`,
    }
  }

  // Final canonical check: estimateRawWeightGrams must succeed
  const result = estimateRawWeightGrams({
    produceId: item.produceId,
    quantity: qty,
    unitKey,
    sizeKey: hasSML ? sizeKey : undefined,
  })

  if (!result.ok) {
    return {
      valid: false,
      errorCode: result.errorCode,
      message: result.message,
    }
  }

  return { valid: true, errorCode: null, message: null }
}

/**
 * Validates a batch of scanned ingredients for log eligibility.
 *
 * @param {Array} ingredients - Array of scanned ingredient objects.
 * @returns {{ valid: boolean, invalidIndices: number[], errors: Array<{ index: number, errorCode: string, message: string }> }}
 */
export function validateBatchForLog(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return { valid: false, invalidIndices: [], errors: [] }
  }

  const errors = []
  const invalidIndices = []

  for (let i = 0; i < ingredients.length; i++) {
    const result = validateIngredientForLog(ingredients[i])
    if (!result.valid) {
      errors.push({ index: i, errorCode: result.errorCode, message: result.message })
      invalidIndices.push(i)
    }
  }

  return {
    valid: invalidIndices.length === 0,
    invalidIndices,
    errors,
  }
}
