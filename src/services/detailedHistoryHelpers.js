// ─────────────────────────────────────────────────────────────
// detailedHistoryHelpers.js — Pure helpers for Pro Detailed History.
//
// Functions:
//   - formatIngredientPortion: display portion string for an ingredient
//   - computeProduceBalance: fruit/veg count or weight-based balance
//   - getTopNutrients: top nutrients from a stored nutrientSummary
//
// No side effects, no React, no storage.
// ─────────────────────────────────────────────────────────────

import { PRODUCE_DATA } from './JuiceEngine'
import { USDA_RDA } from '../constants/nutrition'
import { formatQuantityDescription } from './producePortionConversion'

/**
 * Format the portion display string for a single ingredient.
 *
 * Uses the existing portionMetadata + producePortionConversion system
 * for quantity-mode ingredients. Falls back to weight in grams for
 * weight-mode ingredients. Returns null if no portion data is available.
 *
 * @param {Object} detail - ingredientDetails entry
 *   { produceId, weightG, portionEntryMode, portionMetadata }
 * @returns {string|null} e.g. "4" or "1/2 inch" or "150g" or null
 */
export function formatIngredientPortion(detail) {
  if (!detail || typeof detail !== 'object') return null

  const mode = detail.portionEntryMode || 'weight'
  const meta = detail.portionMetadata

  // Quantity mode — use the existing conversion system
  if (mode === 'quantity' && meta) {
    const unitKey = meta.unitKey
    const sizeKey = meta.sizeKey
    const qty = meta.enteredQuantity
    if (unitKey && qty != null && detail.produceId) {
      const desc = formatQuantityDescription({
        produceId: detail.produceId,
        quantity: qty,
        unitKey,
        sizeKey: sizeKey || undefined,
      })
      if (desc) return desc
    }
  }

  // Weight mode — show grams if available
  if (typeof detail.weightG === 'number' && detail.weightG > 0) {
    return `${Math.round(detail.weightG)}g`
  }

  return null
}

/**
 * Compute the produce balance (fruit vs vegetable) for a history entry.
 *
 * Prefers weight-based percentages when ingredientDetails with weightG
 * are available. Falls back to count-based representation when only
 * ingredient ID strings are available.
 *
 * @param {Array} ingredients - array of produceId strings
 * @param {Array} [ingredientDetails] - optional array of detail objects
 * @returns {Object} { mode: 'weight'|'count', vegPercent, fruitPercent,
 *                      vegCount, fruitCount, vegWeightG, fruitWeightG }
 */
export function computeProduceBalance(ingredients, ingredientDetails) {
  const ids = Array.isArray(ingredients) ? ingredients : []
  const details = Array.isArray(ingredientDetails) ? ingredientDetails : null

  // Build a lookup from details
  const detailMap = {}
  if (details) {
    for (const d of details) {
      if (d && typeof d.produceId === 'string') {
        detailMap[d.produceId] = d
      }
    }
  }

  let vegWeightG = 0
  let fruitWeightG = 0
  let vegCount = 0
  let fruitCount = 0
  let hasWeights = false

  for (const id of ids) {
    const prod = PRODUCE_DATA[id]
    if (!prod) continue

    const isFruit = prod.category === 'fruit'
    const detail = detailMap[id]
    const weightG = detail && typeof detail.weightG === 'number' ? detail.weightG : null

    if (isFruit) {
      fruitCount++
      if (weightG != null && weightG > 0) {
        fruitWeightG += weightG
        hasWeights = true
      }
    } else {
      vegCount++
      if (weightG != null && weightG > 0) {
        vegWeightG += weightG
        hasWeights = true
      }
    }
  }

  if (hasWeights && (vegWeightG + fruitWeightG) > 0) {
    const total = vegWeightG + fruitWeightG
    return {
      mode: 'weight',
      vegPercent: Math.round((vegWeightG / total) * 100),
      fruitPercent: Math.round((fruitWeightG / total) * 100),
      vegCount,
      fruitCount,
      vegWeightG,
      fruitWeightG,
    }
  }

  // Count-based fallback
  return {
    mode: 'count',
    vegPercent: null,
    fruitPercent: null,
    vegCount,
    fruitCount,
    vegWeightG: 0,
    fruitWeightG: 0,
  }
}

/**
 * Get top nutrients from a stored nutrientSummary using existing USDA RDA.
 *
 * @param {Object} nutrientSummary - stored totals from JuiceLogEntry
 * @param {number} [limit=5] - max nutrients to return
 * @returns {Array} [{ key, label, pct, value }] sorted by % Daily Reference descending
 */
export function getTopNutrients(nutrientSummary, limit = 5) {
  const nutrients = nutrientSummary || {}
  const NUTRIENT_LABELS = {
    vitaminC: 'Vitamin C',
    vitaminA: 'Vitamin A',
    potassium: 'Potassium',
    iron: 'Iron',
    magnesium: 'Magnesium',
    folate: 'Folate',
  }

  return Object.entries(USDA_RDA)
    .map(([key, rda]) => {
      const val = nutrients[key] || 0
      const pct = rda > 0 ? Math.round((val / rda) * 100) : 0
      const label = NUTRIENT_LABELS[key] || key
      return { key, label, pct, value: val }
    })
    .filter((n) => n.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit)
}

/**
 * Get additional nutrition stats (calories, sugar) from nutrientSummary.
 * These are not % Daily Reference based but are useful for display.
 *
 * @param {Object} nutrientSummary
 * @returns {Object} { calories, sugar }
 */
export function getBasicNutritionStats(nutrientSummary) {
  const n = nutrientSummary || {}
  return {
    calories: typeof n.calories === 'number' ? Math.round(n.calories) : 0,
    sugar: typeof n.sugar === 'number' ? Math.round(n.sugar * 10) / 10 : 0,
  }
}
