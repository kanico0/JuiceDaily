// ─────────────────────────────────────────────────────────────
// historyFilters.js — Pure helpers for History search + filter.
//
// Functions:
//   - searchEntries: case-insensitive text search over entries
//   - filterEntries: apply combinable filters (favorites, rating,
//     portions, ingredient, estimated nutrition thresholds)
//   - applySearchAndFilters: combine search + filters
//
// Uses the EXISTING stored nutrientSummary and USDA_RDA constants.
// Does NOT recalculate nutrition.
// No side effects, no React, no storage.
// ─────────────────────────────────────────────────────────────

import { PRODUCE_DATA } from './JuiceEngine'
import {
  FILTERABLE_NUTRIENTS as FILTERABLE_NUTRIENTS_CANONICAL,
  getNutrientPct as getNutrientPctCanonical,
} from './nutrientKeys'

// Re-export from the shared canonical nutrient key mapping
export const FILTERABLE_NUTRIENTS = FILTERABLE_NUTRIENTS_CANONICAL

/**
 * Search entries by ingredient/produce names, personal notes, and titles.
 * Case-insensitive. Returns a new array (does not mutate input).
 *
 * @param {Array} entries - JuiceLogEntry array
 * @param {string} query - search text
 * @returns {Array} filtered entries
 */
export function searchEntries(entries, query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return entries
  }
  const q = query.trim().toLowerCase()
  return entries.filter((e) => {
    // Search ingredient/produce names
    const ingredients = Array.isArray(e.ingredients) ? e.ingredients : []
    for (const id of ingredients) {
      const prod = PRODUCE_DATA[id]
      const name = prod?.name || id
      if (typeof name === 'string' && name.toLowerCase().includes(q)) return true
    }
    // Search personal note
    if (typeof e.note === 'string' && e.note.toLowerCase().includes(q)) return true
    // Search title
    if (typeof e.title === 'string' && e.title.toLowerCase().includes(q)) return true
    return false
  })
}

/**
 * Compute the % Daily Reference for a nutrient from a stored nutrientSummary.
 * Delegates to the shared canonical nutrient key mapping.
 */
export function getNutrientPct(nutrientSummary, nutrientKey) {
  return getNutrientPctCanonical(nutrientSummary, nutrientKey)
}

/**
 * Check if an entry contains a specific produce ingredient.
 *
 * @param {Object} entry - JuiceLogEntry
 * @param {string} produceIdOrName - produce ID or display name
 * @returns {boolean}
 */
function entryContainsIngredient(entry, produceIdOrName) {
  if (!produceIdOrName || typeof produceIdOrName !== 'string') return true
  const q = produceIdOrName.toLowerCase().trim()
  const ingredients = Array.isArray(entry.ingredients) ? entry.ingredients : []
  for (const id of ingredients) {
    if (id === q) return true
    const prod = PRODUCE_DATA[id]
    const name = prod?.name || id
    if (typeof name === 'string' && name.toLowerCase().includes(q)) return true
  }
  return false
}

/**
 * Check if an entry has recorded portion data.
 *
 * @param {Object} entry - JuiceLogEntry
 * @returns {boolean}
 */
function entryHasPortions(entry) {
  const details = Array.isArray(entry.ingredientDetails) ? entry.ingredientDetails : null
  return !!(details && details.length > 0)
}

/**
 * Apply filters to entries. All active filters are combined with logical AND.
 *
 * @param {Array} entries - JuiceLogEntry array
 * @param {Object} filters - filter configuration
 *   @param {boolean} [filters.favoritesOnly]
 *   @param {number} [filters.minRating] - 1-5, entries with rating >= this
 *   @param {string} [filters.portionFilter] - 'has_portions' | 'no_portions' | 'any'
 *   @param {string} [filters.ingredient] - produce name/ID to match
 *   @param {Object} [filters.nutrientFilter] - { nutrientKey, condition: '>= | <=', threshold: number }
 * @returns {Array} filtered entries
 */
export function filterEntries(entries, filters) {
  if (!filters || typeof filters !== 'object') return entries
  const {
    favoritesOnly = false,
    minRating = 0,
    portionFilter = 'any',
    ingredient = null,
    nutrientFilter = null,
  } = filters

  // Quick exit if no filters active
  if (!favoritesOnly && minRating <= 0 && portionFilter === 'any' && !ingredient && !nutrientFilter) {
    return entries
  }

  return entries.filter((e) => {
    // Favorites filter
    if (favoritesOnly && e.favorite !== true) return false

    // Rating filter (minimum rating threshold)
    if (minRating > 0) {
      const rating = typeof e.rating === 'number' ? e.rating : 0
      if (rating < minRating) return false
    }

    // Portion filter
    if (portionFilter === 'has_portions' && !entryHasPortions(e)) return false
    if (portionFilter === 'no_portions' && entryHasPortions(e)) return false

    // Ingredient filter
    if (ingredient && !entryContainsIngredient(e, ingredient)) return false

    // Estimated Nutrition filter
    if (nutrientFilter && nutrientFilter.nutrientKey && nutrientFilter.threshold != null) {
      const pct = getNutrientPct(e.nutrientSummary, nutrientFilter.nutrientKey)
      if (nutrientFilter.condition === '>=' && pct < nutrientFilter.threshold) return false
      if (nutrientFilter.condition === '<=' && pct > nutrientFilter.threshold) return false
    }

    return true
  })
}

/**
 * Combine search and filters into a single pass.
 *
 * @param {Array} entries
 * @param {string} query - search text (empty/null for no search)
 * @param {Object} filters - filter configuration
 * @returns {Array} filtered entries
 */
export function applySearchAndFilters(entries, query, filters) {
  const searched = searchEntries(entries, query)
  return filterEntries(searched, filters)
}

/**
 * Check if any filters are currently active.
 *
 * @param {Object} filters
 * @returns {boolean}
 */
export function hasActiveFilters(filters) {
  if (!filters || typeof filters !== 'object') return false
  return !!(
    filters.favoritesOnly ||
    (filters.minRating && filters.minRating > 0) ||
    (filters.portionFilter && filters.portionFilter !== 'any') ||
    (filters.ingredient && filters.ingredient.trim().length > 0) ||
    (filters.nutrientFilter && filters.nutrientFilter.nutrientKey && filters.nutrientFilter.threshold != null)
  )
}

/**
 * Create a default/empty filter object.
 *
 * @returns {Object}
 */
export function createDefaultFilters() {
  return {
    favoritesOnly: false,
    minRating: 0,
    portionFilter: 'any',
    ingredient: null,
    nutrientFilter: null,
  }
}
