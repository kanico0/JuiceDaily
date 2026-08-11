// ─────────────────────────────────────────────────────────────
// comboToProduceIds.js — Parse Today's Focus combo strings into
// canonical produce IDs for builder prepopulation.
//
// A combo is only launchable if EVERY displayed ingredient resolves
// to a canonical produce ID in PRODUCE_DATA. Partial mapping is NOT
// used — the user must see the same ingredients they tapped.
// ─────────────────────────────────────────────────────────────

import { PRODUCE_DATA } from '../services/JuiceEngine'
import { resolveQueryToCanonicalProduce } from '../services/produceFamilies'

// ── Combo-specific name aliases ───────────────────────────────
// These cover produce that IS in PRODUCE_DATA but whose display
// name in combo strings doesn't match the canonical ID format.
// Only added for produce that genuinely exists in the catalog.
// Produce NOT in PRODUCE_DATA (banana, avocado, cacao, chia, etc.)
// is intentionally left unmapped — those combos stay unavailable.
const COMBO_NAME_ALIASES = {
  'coconut water': 'coconut_water',
  'sweet potato': 'sweet_potato',
  'swiss chard': 'swiss_chard',
  'red pepper': 'bell_pepper_red',
  'red grapefruit': 'grapefruit',
  'green grapefruit': 'grapefruit',
  'bok choy': 'bok_choy',
  'red cabbage': 'cabbage_red',
  'green cabbage': 'cabbage_green',
  'red bell pepper': 'bell_pepper_red',
  'yellow bell pepper': 'bell_pepper_yellow',
  'green bell pepper': 'bell_pepper_green',
}

/**
 * Resolve a single ingredient display name to a canonical produce ID.
 * Returns the produceId string if found, or null if unmapped.
 *
 * Resolution chain:
 *   1. resolveQueryToCanonicalProduce (handles family aliases)
 *   2. COMBO_NAME_ALIASES (handles space-vs-underscore mismatches)
 *   3. Space-to-underscore normalization + direct PRODUCE_DATA lookup
 */
function resolveIngredientName(name) {
  const q = (name || '').trim().toLowerCase()
  if (!q) return null

  // 1. Standard resolver (family aliases, search aliases)
  const canonical = resolveQueryToCanonicalProduce(q)
  if (canonical) return canonical

  // 2. Combo-specific aliases
  const aliased = COMBO_NAME_ALIASES[q]
  if (aliased && PRODUCE_DATA[aliased]) return aliased

  // 3. Space-to-underscore normalization for direct ID matches
  //    e.g. "coconut water" → "coconut_water"
  const underscored = q.replace(/\s+/g, '_')
  if (PRODUCE_DATA[underscored]) return underscored

  return null
}

/**
 * Parse a combo display string (e.g. "Orange + Red Pepper + Pineapple")
 * into a list of canonical produce IDs.
 *
 * Returns { produceIds, unmapped } where:
 *   - produceIds: string[] of resolved canonical produce IDs
 *   - unmapped: string[] of display names that could not be resolved
 *
 * A combo is launchable only if unmapped.length === 0.
 */
export function comboToProduceIds(comboString) {
  if (!comboString || typeof comboString !== 'string') {
    return { produceIds: [], unmapped: [] }
  }

  const parts = comboString.split('+').map((s) => s.trim()).filter(Boolean)
  const produceIds = []
  const unmapped = []

  for (const part of parts) {
    const resolved = resolveIngredientName(part)
    if (resolved) {
      produceIds.push(resolved)
    } else {
      unmapped.push(part)
    }
  }

  return { produceIds, unmapped }
}

/**
 * Returns true if every ingredient in the combo string resolves to
 * a canonical produce ID AND there is at least one ingredient.
 * The combo is safe to launch as-is.
 */
export function isComboLaunchable(comboString) {
  const { produceIds, unmapped } = comboToProduceIds(comboString)
  return produceIds.length > 0 && unmapped.length === 0
}
