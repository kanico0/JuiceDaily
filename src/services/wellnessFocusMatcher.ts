import { RECIPES, DATASET_FINGERPRINT } from '../constants/recipeData'
import {
  WELLNESS_DIRECTORY,
  WELLNESS_FOCUS_AREAS,
  WELLNESS_NUTRIENTS,
  WELLNESS_SCHEMA_VERSION,
  type WellnessFocusArea,
} from '../constants/wellnessFocusDirectory'

// ── Types ──────────────────────────────────────────────────────

export interface RecipeMatch {
  recipeId: string
  recipeTitle: string
  overlapCount: number
  ratio: number
  matchedNutrients: string[]
  ingredientCount: number
}

export interface FocusAreaResult {
  focusArea: WellnessFocusArea
  recipes: RecipeMatch[]
  cacheKey: string
}

// ── Normalization (ported from recipe_coverage_validator.py) ───

const ALIAS_MAP: Record<string, string> = {
  'strawberries': 'strawberry',
  'blueberries': 'blueberry',
  'raspberries': 'raspberry',
  'blackberries': 'blackberry',
  'red cabbage': 'purple cabbage',
  'cilantro': 'coriander',
  'jalape\u00f1o': 'jalapeno',
  'jalape\u00f1os': 'jalapeno',
}

export function normalize(s: string): string {
  let result = s.toLowerCase().trim()
  result = result.replace(/\(.*?\)/g, '')
  result = result.replace(/\b(root|greens|leaf|leaves)\b/g, '')
  result = result.replace(/\s+/g, ' ').trim()
  if (ALIAS_MAP[result]) result = ALIAS_MAP[result]
  return result
}

// ── Ingredient matching (ported from Python) ───────────────────

export function ingredientMatches(recipeIngredient: string, directoryIngredient: string): boolean {
  const a = normalize(recipeIngredient)
  const b = normalize(directoryIngredient)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

// ── Build ingredient → nutrients map ───────────────────────────

export function buildIngredientToNutrients(
  directory: typeof WELLNESS_DIRECTORY
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const nutrients = directory.nutrients
  for (const [nutrientId, nutrientData] of Object.entries(nutrients)) {
    for (const ing of nutrientData.juice_ingredients) {
      const existing = map.get(ing)
      if (existing) {
        existing.push(nutrientId)
      } else {
        map.set(ing, [nutrientId])
      }
    }
  }
  return map
}

// ── Match recipe ingredients to nutrients ──────────────────────

export function matchRecipeToNutrients(
  recipeIngredients: string[],
  ingToNutrients: Map<string, string[]>
): Set<string> {
  const matchedNutrients = new Set<string>()
  for (const rIng of recipeIngredients) {
    for (const [dIng, nids] of ingToNutrients) {
      if (ingredientMatches(rIng, dIng)) {
        for (const nid of nids) {
          matchedNutrients.add(nid)
        }
      }
    }
  }
  return matchedNutrients
}

// ── Match recipe to focus areas (forward direction) ────────────

export function matchRecipeToFocusAreas(
  recipeIngredients: string[],
  directory: typeof WELLNESS_DIRECTORY = WELLNESS_DIRECTORY,
  minOverlap = 1,
  minRatio = 0.0
): { matchedFocusAreaIds: string[]; matchedNutrients: string[] } {
  const ingToNutrients = buildIngredientToNutrients(directory)
  const matchedNutrients = matchRecipeToNutrients(recipeIngredients, ingToNutrients)

  const matchedFocusAreaIds: string[] = []
  for (const area of directory.focus_areas) {
    const areaNutrients = new Set(area.associated_nutrients)
    const overlap = new Set([...areaNutrients].filter((n) => matchedNutrients.has(n)))
    const needed = Math.max(minOverlap, Math.round(minRatio * areaNutrients.size))
    if (overlap.size >= needed) {
      matchedFocusAreaIds.push(area.id)
    }
  }

  return {
    matchedFocusAreaIds,
    matchedNutrients: [...matchedNutrients],
  }
}

// ── Reverse lookup: rank recipes for a focus area ──────────────

export const PROD_MIN_RATIO = 0.5
export const PROD_MAX_RESULTS = 8

export function rankRecipesForFocusArea(
  focusAreaId: string,
  minOverlap = 1,
  minRatio = 0.0
): RecipeMatch[] {
  const focusArea = WELLNESS_FOCUS_AREAS.find((a) => a.id === focusAreaId)
  if (!focusArea) return []

  const ingToNutrients = buildIngredientToNutrients(WELLNESS_DIRECTORY)
  const areaNutrients = new Set(focusArea.associated_nutrients)

  const matches: RecipeMatch[] = []

  for (const recipe of RECIPES) {
    const recipeIngredients = recipe.ingredients.map((ing) => ing.name)
    const matchedNutrients = matchRecipeToNutrients(recipeIngredients, ingToNutrients)

    const overlapSet = new Set([...areaNutrients].filter((n) => matchedNutrients.has(n)))
    const overlapCount = overlapSet.size
    const needed = Math.max(minOverlap, Math.round(minRatio * areaNutrients.size))

    if (overlapCount < needed) continue

    const ratio = areaNutrients.size > 0 ? overlapCount / areaNutrients.size : 0

    const distinctIngredientCount = new Set(
      recipe.ingredients.map((ing) => ing.produceId).filter(Boolean).map((id) => id.toLowerCase())
    ).size

    matches.push({
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      overlapCount,
      ratio: Math.round(ratio * 1000) / 1000,
      matchedNutrients: [...overlapSet],
      ingredientCount: distinctIngredientCount,
    })
  }

  matches.sort((a, b) => {
    if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount
    if (b.ratio !== a.ratio) return b.ratio - a.ratio
    if (a.ingredientCount !== b.ingredientCount) return a.ingredientCount - b.ingredientCount
    return a.recipeId.localeCompare(b.recipeId)
  })

  return matches
}

// ── In-memory cache with versioned keys ────────────────────────

interface CacheEntry {
  results: RecipeMatch[]
  dataVersionHash: string
}

const cache = new Map<string, CacheEntry>()

function computeDataVersionHash(): string {
  return `${WELLNESS_SCHEMA_VERSION}:${DATASET_FINGERPRINT}`
}

function getCacheKey(focusAreaId: string, minOverlap: number, minRatio: number): string {
  return `${focusAreaId}:${minOverlap}:${minRatio}:${computeDataVersionHash()}`
}

export function getCachedRanking(
  focusAreaId: string,
  minOverlap = 1,
  minRatio = PROD_MIN_RATIO
): RecipeMatch[] {
  const key = getCacheKey(focusAreaId, minOverlap, minRatio)
  const entry = cache.get(key)
  if (entry) return entry.results

  const allResults = rankRecipesForFocusArea(focusAreaId, minOverlap, minRatio)
  const results = allResults.slice(0, PROD_MAX_RESULTS)
  cache.set(key, { results, dataVersionHash: computeDataVersionHash() })
  return results
}

export function clearWellnessCache(): void {
  cache.clear()
}

export function getCacheSize(): number {
  return cache.size
}

// ── Coverage validation (ported from recipe_coverage_validator.py) ──

export interface CoverageReport {
  total_recipes: number
  total_focus_areas: number
  recipes_with_zero_matches: Array<{ id: string; name: string; ingredients: string[] }>
  focus_areas_with_zero_recipes: Array<{
    id: string
    label: string
    needs_ingredients: string[]
  }>
  recipe_to_focus_areas: Record<string, string[]>
  coverage_pct_recipes_mapped: number
  coverage_pct_focus_areas_filled: number
}

export function runCoverageValidation(
  minOverlap = 1,
  minRatio = 0.0
): CoverageReport {
  const recipeToAreas: Record<string, string[]> = {}
  const areaToRecipes: Map<string, string[]> = new Map()

  for (const recipe of RECIPES) {
    const recipeIngredients = recipe.ingredients.map((ing) => ing.name)
    const { matchedFocusAreaIds } = matchRecipeToFocusAreas(
      recipeIngredients,
      WELLNESS_DIRECTORY,
      minOverlap,
      minRatio
    )
    recipeToAreas[recipe.id] = matchedFocusAreaIds
    for (const areaId of matchedFocusAreaIds) {
      const existing = areaToRecipes.get(areaId)
      if (existing) {
        existing.push(recipe.id)
      } else {
        areaToRecipes.set(areaId, [recipe.id])
      }
    }
  }

  const unmappedRecipes = RECIPES.filter((r) => !recipeToAreas[r.id] || recipeToAreas[r.id].length === 0)
  const uncoveredAreas = WELLNESS_FOCUS_AREAS.filter((a) => !areaToRecipes.has(a.id))

  return {
    total_recipes: RECIPES.length,
    total_focus_areas: WELLNESS_FOCUS_AREAS.length,
    recipes_with_zero_matches: unmappedRecipes.map((r) => ({
      id: r.id,
      name: r.title,
      ingredients: r.ingredients.map((ing) => ing.name),
    })),
    focus_areas_with_zero_recipes: uncoveredAreas.map((a) => ({
      id: a.id,
      label: a.label,
      needs_ingredients: a.associated_nutrients
        .flatMap((nid) => WELLNESS_NUTRIENTS[nid]?.juice_ingredients || [])
        .slice(0, 5),
    })),
    recipe_to_focus_areas: recipeToAreas,
    coverage_pct_recipes_mapped: Math.round(
      (100 * (RECIPES.length - unmappedRecipes.length)) / Math.max(RECIPES.length, 1) * 10
    ) / 10,
    coverage_pct_focus_areas_filled: Math.round(
      (100 * (WELLNESS_FOCUS_AREAS.length - uncoveredAreas.length)) / WELLNESS_FOCUS_AREAS.length * 10
    ) / 10,
  }
}
