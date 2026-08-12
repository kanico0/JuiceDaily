// ─────────────────────────────────────────────────────────────
// nutrientKeys.js — Canonical nutrient key mapping shared by
// Detailed History (getTopNutrients) and History filters
// (historyFilters.js).
//
// This ensures that Detailed History and History nutrient filters
// use the SAME nutrient-value lookup, preventing inconsistencies
// such as "Magnesium = X" in Detailed History but "Magnesium not
// found" in filters.
//
// No side effects, no React, no storage.
// ─────────────────────────────────────────────────────────────

import { USDA_RDA } from '../constants/nutrition'

// Canonical nutrient keys — the exact keys used by JuiceEngine
// processJuiceBatch() in batch.totals and stored in nutrientSummary.
export const CANONICAL_NUTRIENT_KEYS = [
  'vitaminC',
  'vitaminA',
  'potassium',
  'iron',
  'magnesium',
  'folate',
]

// Human-readable labels for each canonical nutrient
export const NUTRIENT_LABELS = {
  vitaminC: 'Vitamin C',
  vitaminA: 'Vitamin A',
  potassium: 'Potassium',
  iron: 'Iron',
  magnesium: 'Magnesium',
  folate: 'Folate',
}

// Filterable nutrients (for History filter UI)
export const FILTERABLE_NUTRIENTS = CANONICAL_NUTRIENT_KEYS.map((key) => ({
  key,
  label: NUTRIENT_LABELS[key] || key,
}))

/**
 * Get a stored nutrient value from a nutrientSummary by canonical key.
 * Used by BOTH getTopNutrients (Detailed History) and historyFilters
 * to ensure consistent nutrient-value lookup.
 *
 * @param {Object} nutrientSummary - stored totals from JuiceLogEntry
 * @param {string} canonicalKey - e.g. 'magnesium'
 * @returns {number} the nutrient value, or 0 if not present
 */
export function getStoredNutrientValue(nutrientSummary, canonicalKey) {
  const n = nutrientSummary || {}
  const val = n[canonicalKey]
  return typeof val === 'number' && isFinite(val) ? val : 0
}

/**
 * Get the % Daily Reference for a nutrient from a stored nutrientSummary.
 * Uses the same USDA_RDA constants as Detailed History.
 *
 * @param {Object} nutrientSummary - stored totals
 * @param {string} canonicalKey - e.g. 'magnesium'
 * @returns {number} percentage (0-100+), or 0 if not available
 */
export function getNutrientPct(nutrientSummary, canonicalKey) {
  const rda = USDA_RDA[canonicalKey]
  if (!rda || rda <= 0) return 0
  const val = getStoredNutrientValue(nutrientSummary, canonicalKey)
  return Math.round((val / rda) * 100)
}

/**
 * Check if a nutrientSummary contains ANY of the canonical micronutrient
 * keys with non-zero values. Used to distinguish between:
 *   - New entries with full micronutrient data
 *   - Legacy entries that only stored calories/sugar
 *
 * @param {Object} nutrientSummary
 * @returns {boolean}
 */
export function hasMicronutrientData(nutrientSummary) {
  const n = nutrientSummary || {}
  return CANONICAL_NUTRIENT_KEYS.some((key) => {
    const val = n[key]
    return typeof val === 'number' && val > 0
  })
}
