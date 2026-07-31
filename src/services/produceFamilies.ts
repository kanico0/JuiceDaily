// src/services/produceFamilies.ts
// Centralized, explicit produce-family/alias mapping.
// Maps genuine produce variants (e.g. apple colors, bell-pepper colors, cabbage colors)
// to a shared family key so that Produce-First recipe matching can treat them as
// equivalent without unrestricted substring matching.

// ── Family groups ─────────────────────────────────────────────
// Each group lists produce IDs that are genuine variants of the same produce.
// Only add a group when the existing data clearly demonstrates variant relationship.

export const PRODUCE_FAMILIES: Record<string, string[]> = {
  apple: ['apple', 'apple_green', 'apple_red'],
  bell_pepper: ['bell_pepper_red', 'bell_pepper_yellow', 'bell_pepper_green'],
  cabbage: ['cabbage_green', 'cabbage_red'],
}

// ── Reverse lookup: produceId -> familyKey ───────────────────
const PRODUCE_TO_FAMILY: Record<string, string> = {}
for (const [familyKey, members] of Object.entries(PRODUCE_FAMILIES)) {
  for (const pid of members) {
    PRODUCE_TO_FAMILY[pid.toLowerCase()] = familyKey
  }
}

// ── API ──────────────────────────────────────────────────────

export function getProduceFamilyKey(produceId: string): string | null {
  return PRODUCE_TO_FAMILY[produceId.toLowerCase()] ?? null
}

export function getProduceFamilyMembers(produceId: string): string[] {
  const familyKey = getProduceFamilyKey(produceId)
  if (!familyKey) return []
  return PRODUCE_FAMILIES[familyKey].map((id) => id.toLowerCase())
}

export function areProduceFamilyEquivalent(
  leftProduceId: string,
  rightProduceId: string
): boolean {
  const leftLower = leftProduceId.toLowerCase()
  const rightLower = rightProduceId.toLowerCase()
  if (leftLower === rightLower) return true
  const leftFamily = PRODUCE_TO_FAMILY[leftLower]
  const rightFamily = PRODUCE_TO_FAMILY[rightLower]
  if (!leftFamily || !rightFamily) return false
  return leftFamily === rightFamily
}

// ── Search aliases for variant produce ────────────────────────
// Allows searching for variants using both common word orders.
// e.g. "red apple" and "apple red" both find apple_red.
// Also includes the generic family name so variants are discoverable
// by the generic term (e.g. "apple" finds apple_red).

export const PRODUCE_SEARCH_ALIASES: Record<string, string[]> = {
  apple_red: ['red apple', 'apple red', 'apple'],
  apple_green: ['green apple', 'apple green', 'apple'],
  apple: ['apple', 'apples'],
  bell_pepper_red: ['red bell pepper', 'bell pepper red', 'bell pepper'],
  bell_pepper_yellow: ['yellow bell pepper', 'bell pepper yellow', 'bell pepper'],
  bell_pepper_green: ['green bell pepper', 'bell pepper green', 'bell pepper'],
  cabbage_red: ['red cabbage', 'cabbage red', 'cabbage'],
  cabbage_green: ['green cabbage', 'cabbage green', 'cabbage'],
}

// ── Variant display labels ───────────────────────────────────
// Family-first display for known variants where natural.
// e.g. "Apple, Red" instead of "Red Apple".
// Generic family labels remain unchanged (e.g. "Apple").

export const PRODUCE_VARIANT_DISPLAY_NAMES: Record<string, string> = {
  apple_red: 'Apple, Red',
  apple_green: 'Apple, Green',
  bell_pepper_red: 'Bell Pepper, Red',
  bell_pepper_yellow: 'Bell Pepper, Yellow',
  bell_pepper_green: 'Bell Pepper, Green',
  cabbage_red: 'Cabbage, Red',
  cabbage_green: 'Cabbage, Green',
}

export function getProduceVariantDisplayName(produceId: string): string | null {
  return PRODUCE_VARIANT_DISPLAY_NAMES[produceId.toLowerCase()] ?? null
}

// ── Shared canonical recipe-family matching ──────────────────
// Both Browse Juice Ideas and Produce-First use these functions
// to ensure identical recipe-ID sets for produce-family queries.

import { RECIPES, getRecipeBlendType } from '../constants/recipeData'
import { PRODUCE_DATA } from './JuiceEngine'

export interface RecipeLike {
  id: string
  ingredients: Array<{ produceId: string }>
}

/**
 * Returns the set of produce-family keys that a recipe contains.
 * Recipes with no family-grouped produce return an empty set.
 */
export function getRecipeProduceFamilyKeys(recipe: RecipeLike): Set<string> {
  const families = new Set<string>()
  for (const ing of recipe.ingredients) {
    if (!ing.produceId) continue
    const familyKey = getProduceFamilyKey(ing.produceId)
    if (familyKey) {
      families.add(familyKey)
    }
  }
  return families
}

/**
 * Returns true if the recipe contains any ingredient belonging to
 * the specified produce family (e.g. 'apple' covers apple, apple_red,
 * apple_green but NOT pineapple).
 */
export function recipeContainsProduceFamily(recipe: RecipeLike, familyKey: string): boolean {
  const families = getRecipeProduceFamilyKeys(recipe)
  return families.has(familyKey.toLowerCase())
}

/**
 * Resolves a search query string to a produce family key if the query
 * matches a known produce or produce variant alias.
 * Returns null for unrecognized queries.
 */
export function resolveQueryToProduceFamily(query: string): string | null {
  const q = (query || '').trim().toLowerCase()
  if (!q) return null

  // Direct produce ID match
  const directFamily = getProduceFamilyKey(q)
  if (directFamily) return directFamily

  // Check PRODUCE_SEARCH_ALIASES for variant queries like "red apple"
  for (const [produceId, aliases] of Object.entries(PRODUCE_SEARCH_ALIASES)) {
    for (const alias of aliases) {
      if (alias.toLowerCase() === q) {
        const family = getProduceFamilyKey(produceId)
        if (family) return family
      }
    }
  }

  // Check the recipeSearch PRODUCE_ALIASES via dynamic import is not
  // possible here (circular dep), so we check common alias patterns.
  // The PRODUCE_SEARCH_ALIASES already cover the variant word-order cases.
  return null
}

/**
 * Returns all recipe IDs that contain the specified produce family.
 * Uses structured ingredient IDs, not substring matching.
 */
export function getRecipeIdsForProduceFamily(familyKey: string): string[] {
  const key = familyKey.toLowerCase()
  const result: string[] = []
  for (const recipe of RECIPES) {
    if (recipeContainsProduceFamily(recipe, key)) {
      result.push(recipe.id)
    }
  }
  return result.sort()
}

// ── Shared visibility policy ─────────────────────────────────
// The app's established policy (Policy A) is to show all recipes,
// including Pro/locked ones, with correct lock/badge treatment.
// GlowLibraryScreen and ProduceRecipeResultsScreen both follow this.
// This function ensures both Browse and Produce-First apply the same
// visibility logic for recognized-produce queries.

export interface UserAccessContext {
  isProActive: boolean
}

export interface VisibleRecipe {
  id: string
  title: string
  tier: string
  collection: string
  blendType: string
  isLocked: boolean
}

/**
 * Applies the shared recipe visibility policy to a list of recipe IDs.
 * Returns all recipes with isLocked flag — does NOT filter out Pro recipes.
 * Both Browse and Produce-First must use this to ensure identical visible sets.
 */
export function applyRecipeVisibilityPolicy(
  recipeIds: string[],
  userAccess: UserAccessContext,
): VisibleRecipe[] {
  const result: VisibleRecipe[] = []
  for (const id of recipeIds) {
    const recipe = RECIPES.find((r) => r.id === id)
    if (!recipe) continue
    const isLocked = recipe.tier === 'pro' && !userAccess.isProActive
    result.push({
      id: recipe.id,
      title: recipe.title,
      tier: recipe.tier,
      collection: recipe.collection,
      blendType: getRecipeBlendType(recipe),
      isLocked,
    })
  }
  return result
}

/**
 * Returns the set of unique family keys for a list of selected produce IDs.
 * Used to determine if a selection is a single-family search.
 */
export function getUniqueSelectedFamilyKeys(produceIds: string[]): string[] {
  const familyKeys = new Set<string>()
  for (const pid of produceIds) {
    const fk = getProduceFamilyKey(pid.toLowerCase())
    if (fk) familyKeys.add(fk)
  }
  return [...familyKeys]
}

// ── Canonical produce key ────────────────────────────────────
// Every known produce ID resolves to a canonical key:
//   - Family members collapse to their family key
//     (apple_red → apple, bell_pepper_green → bell_pepper)
//   - Ordinary produce IDs are their own canonical key
//     (carrot → carrot, celery → celery)
//   - Unknown produce IDs return null
// This allows single-produce inclusion behavior to work for ALL
// produce, not just the three explicit variant families.

/**
 * Returns the canonical produce key for a produce ID.
 * Family members collapse to their family key; ordinary produce
 * IDs are their own canonical key; unknown IDs return null.
 */
export function getCanonicalProduceKey(produceId: string): string | null {
  const pid = produceId.toLowerCase()
  const familyKey = getProduceFamilyKey(pid)
  if (familyKey) return familyKey
  if (PRODUCE_DATA[pid]) return pid
  return null
}

/**
 * Returns the set of unique canonical produce keys for a list of produce IDs.
 * Examples:
 *   ["apple_red"] → ["apple"]
 *   ["apple", "apple_red", "apple_green"] → ["apple"]
 *   ["carrot"] → ["carrot"]
 *   ["apple_red", "carrot"] → ["apple", "carrot"]
 */
export function getUniqueSelectedCanonicalProduceKeys(produceIds: string[]): string[] {
  const keys = new Set<string>()
  for (const pid of produceIds) {
    const ck = getCanonicalProduceKey(pid)
    if (ck) keys.add(ck)
  }
  return [...keys]
}

/**
 * Returns true if the recipe contains any ingredient whose canonical
 * produce key matches the given canonicalKey. This works for both
 * family-grouped produce (apple covers apple, apple_red, apple_green)
 * and ordinary produce (carrot covers carrot).
 */
export function recipeContainsCanonicalProduce(recipe: RecipeLike, canonicalKey: string): boolean {
  const key = canonicalKey.toLowerCase()
  for (const ing of recipe.ingredients) {
    if (!ing.produceId) continue
    const ck = getCanonicalProduceKey(ing.produceId)
    if (ck === key) return true
  }
  return false
}

/**
 * Returns all recipe IDs that contain the specified canonical produce.
 * Uses structured ingredient IDs, not substring matching.
 */
export function getRecipeIdsForCanonicalProduce(canonicalKey: string): string[] {
  const key = canonicalKey.toLowerCase()
  const result: string[] = []
  for (const recipe of RECIPES) {
    if (recipeContainsCanonicalProduce(recipe, key)) {
      result.push(recipe.id)
    }
  }
  return result.sort()
}

/**
 * Resolves a search query string to a canonical produce key if the query
 * matches a known produce, produce variant alias, or ordinary produce ID.
 * Returns null for unrecognized queries.
 *
 * Examples:
 *   "apple" → "apple"
 *   "red apple" → "apple"
 *   "carrot" → "carrot"
 *   "celery" → "celery"
 *   "pineapple" → "pineapple"
 *   "red bell pepper" → "bell_pepper"
 */
export function resolveQueryToCanonicalProduce(query: string): string | null {
  const q = (query || '').trim().toLowerCase()
  if (!q) return null

  // 1. Direct family member match (apple, apple_red, bell_pepper_red, etc.)
  const familyKey = getProduceFamilyKey(q)
  if (familyKey) return familyKey

  // 2. Check PRODUCE_SEARCH_ALIASES for variant queries like "red apple"
  for (const [produceId, aliases] of Object.entries(PRODUCE_SEARCH_ALIASES)) {
    for (const alias of aliases) {
      if (alias.toLowerCase() === q) {
        const ck = getCanonicalProduceKey(produceId)
        if (ck) return ck
      }
    }
  }

  // 3. Direct produce ID match for ordinary produce (carrot, celery, etc.)
  if (PRODUCE_DATA[q]) {
    return getCanonicalProduceKey(q)
  }

  return null
}
