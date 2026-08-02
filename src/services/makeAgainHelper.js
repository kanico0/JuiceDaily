// ─────────────────────────────────────────────────────────────
// makeAgainHelper.js — Pure helper to transform a history entry
// into editable draft ingredients for "Make This Juice Again".
//
// Never mutates the original record.
// Validates canonical IDs against the current catalog.
// Resolves aliases and family-equivalence mappings.
// Normalizes quantity and units to current 1.0.12 controls.
// ─────────────────────────────────────────────────────────────

import { PRODUCE_DATA } from './JuiceEngine'
import { getProduceFamilyKey, getProduceFamilyMembers } from './produceFamilies'

/**
 * @typedef {Object} EditableIngredient
 * @property {string} produceId
 * @property {string} name
 * @property {number} quantity - numeric, default 1
 * @property {string} portionEntryMode - 'quantity' | 'volume' | 'weight'
 * @property {string} [portionUnit] - 'cups' | 'oz' | count unit
 * @property {string} [portionSize] - 'small' | 'medium' | 'large'
 * @property {boolean} isOrganic
 * @property {boolean} isPrimary
 */

/**
 * @typedef {Object} HistoryIngredientIssue
 * @property {string} originalId
 * @property {string} [originalName]
 * @property {string} reason - 'retired' | 'invalid' | 'corrupt'
 */

/**
 * @typedef {Object} MakeAgainDraftResult
 * @property {EditableIngredient[]} ingredients
 * @property {string|null} primaryProduceId
 * @property {HistoryIngredientIssue[]} skippedIngredients
 * @property {string} [sourceHistoryEntryId]
 */

/**
 * Resolve a produce ID through the catalog validation chain:
 *   1. Exact canonical ID in PRODUCE_DATA
 *   2. Family-equivalence mapping (find a valid family member)
 *   3. Display-name fallback (only if exact match exists)
 *
 * Returns the resolved produceId or null if not found.
 */
function resolveProduceId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null
  const normalized = rawId.toLowerCase().trim()

  // 1. Exact match
  if (PRODUCE_DATA[normalized]) return normalized

  // 2. Family-equivalence: find a valid family member
  const familyKey = getProduceFamilyKey(normalized)
  if (familyKey) {
    const members = getProduceFamilyMembers(normalized)
    for (const member of members) {
      if (PRODUCE_DATA[member]) return member
    }
  }

  // 3. Check if any PRODUCE_DATA key matches by name
  for (const [key, entry] of Object.entries(PRODUCE_DATA)) {
    if (entry.name && entry.name.toLowerCase() === normalized) return key
  }

  return null
}

/**
 * Normalize a historical quantity value to a valid number.
 * Missing/invalid defaults to 1.
 */
function normalizeQuantity(raw) {
  if (typeof raw === 'number' && raw > 0 && isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) return parsed
  }
  return 1
}

/**
 * Normalize portion entry mode from historical values.
 * Maps legacy values to current controls.
 */
function normalizePortionMode(raw) {
  if (raw === 'quantity' || raw === 'volume' || raw === 'weight') return raw
  if (raw === 'count') return 'quantity'
  if (raw === 'cups' || raw === 'oz') return 'volume'
  return 'quantity'
}

/**
 * Normalize portion unit from historical values.
 */
function normalizePortionUnit(raw) {
  if (typeof raw === 'string' && raw) return raw
  return null
}

/**
 * Create editable draft ingredients from a history entry.
 *
 * @param {Object} entry - History entry from JuiceLogStore
 * @param {Object} [catalog] - Optional override for PRODUCE_DATA (testing)
 * @returns {MakeAgainDraftResult}
 */
export function createEditableDraftFromHistoryEntry(entry, catalog) {
  const produceData = catalog || PRODUCE_DATA
  const skippedIngredients = []
  const ingredients = []

  if (!entry || typeof entry !== 'object') {
    return { ingredients, primaryProduceId: null, skippedIngredients }
  }

  const rawIngredients = entry.ingredients || []
  const storedPrimary = entry.primaryProduceId || null

  // Handle both string-array and object-array formats
  const rawList = Array.isArray(rawIngredients) ? rawIngredients : []

  for (const raw of rawList) {
    let rawId, rawQuantity, rawMode, rawUnit, rawSize, rawOrganic

    if (typeof raw === 'string') {
      rawId = raw
      rawOrganic = entry.isOrganic
    } else if (raw && typeof raw === 'object') {
      rawId = raw.produceId || raw.id
      rawQuantity = raw.quantity
      rawMode = raw.portionEntryMode
      rawUnit = raw.portionUnit
      rawSize = raw.portionSize
      rawOrganic = typeof raw.isOrganic === 'boolean' ? raw.isOrganic : entry.isOrganic
    } else {
      skippedIngredients.push({
        originalId: String(raw),
        reason: 'corrupt',
      })
      continue
    }

    // Resolve through catalog validation chain
    let resolvedId = null
    if (rawId && typeof rawId === 'string') {
      const normalized = rawId.toLowerCase().trim()
      if (produceData[normalized]) {
        resolvedId = normalized
      } else {
        // Try family equivalence
        const familyKey = getProduceFamilyKey(normalized)
        if (familyKey) {
          const members = getProduceFamilyMembers(normalized)
          for (const member of members) {
            if (produceData[member]) {
              resolvedId = member
              break
            }
          }
        }
        // Try name match
        if (!resolvedId) {
          for (const [key, val] of Object.entries(produceData)) {
            if (val && val.name && val.name.toLowerCase() === normalized) {
              resolvedId = key
              break
            }
          }
        }
      }
    }

    if (!resolvedId) {
      const entry_data = produceData[rawId]
      skippedIngredients.push({
        originalId: rawId || 'unknown',
        originalName: entry_data ? entry_data.name : undefined,
        reason: rawId ? 'retired' : 'invalid',
      })
      continue
    }

    const catalogEntry = produceData[resolvedId]
    const quantity = normalizeQuantity(rawQuantity)
    const portionEntryMode = normalizePortionMode(rawMode)
    const portionUnit = normalizePortionUnit(rawUnit)
    const portionSize =
      rawSize === 'small' || rawSize === 'medium' || rawSize === 'large' ? rawSize : undefined

    ingredients.push({
      produceId: resolvedId,
      name: catalogEntry.name,
      quantity,
      portionEntryMode,
      portionUnit: portionUnit || (portionEntryMode === 'volume' ? 'cups' : undefined),
      portionSize,
      isOrganic: typeof rawOrganic === 'boolean' ? rawOrganic : false,
      isPrimary: false,
    })
  }

  // Determine primary produce
  let primaryProduceId = null

  if (storedPrimary) {
    const resolved = resolveProduceId(storedPrimary)
    if (resolved && ingredients.some((i) => i.produceId === resolved)) {
      primaryProduceId = resolved
    }
  }

  if (!primaryProduceId && ingredients.length > 0) {
    primaryProduceId = ingredients[0].produceId
  }

  // Set isPrimary flag on exactly one ingredient
  if (primaryProduceId) {
    const primaryIdx = ingredients.findIndex((i) => i.produceId === primaryProduceId)
    if (primaryIdx >= 0) {
      ingredients[primaryIdx] = { ...ingredients[primaryIdx], isPrimary: true }
    }
  }

  return {
    ingredients,
    primaryProduceId,
    skippedIngredients,
    sourceHistoryEntryId: entry.id,
  }
}

/**
 * Check if a draft has meaningful unsaved content.
 * Used to determine if the replace-draft warning should show.
 *
 * @param {Object} batch - Current batch state from HomeScreen
 * @returns {boolean}
 */
export function hasUnsavedDraft(batch) {
  if (!batch) return false
  const items = batch.scannedIngredients || []
  if (items.length === 0) return false
  // If all items are default weight with no modifications, it's untouched
  // But we consider any non-empty batch as "unsaved" since the user
  // may have made selections
  return true
}

/**
 * Convert draft ingredients to preload format for navigation.
 *
 * @param {EditableIngredient[]} ingredients
 * @returns {Array} preloadIngredients array for navigation params
 */
export function draftToPreloadIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return []
  return ingredients.map((ing) => ({
    produceId: ing.produceId,
    weightG: 150, // default; user can adjust in editor
    isOrganic: ing.isOrganic,
    portionEntryMode: ing.portionEntryMode || 'weight',
    portionMetadata: ing.portionUnit
      ? {
          unit: ing.portionUnit,
          size: ing.portionSize,
          quantity: ing.quantity,
        }
      : undefined,
  }))
}
