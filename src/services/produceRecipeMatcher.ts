import { RECIPES, getRecipeById, getRecipeBlendType, countDistinctProduceIds } from '../constants/recipeData'
import { PRODUCE_DATA } from './JuiceEngine'

export type MatchTier = 'ready_now' | 'close_match' | 'closest_match'

export interface ProduceMatch {
  recipeId: string
  title: string
  tier: MatchTier
  rawMatchRatio: number
  displayMatchPct: number
  matchedProduceIds: string[]
  missingProduceIds: string[]
  missingProduceNames: string[]
  distinctIngredientCount: number
  tier_label: 'free' | 'pro'
  blendType: 'simple' | 'advanced'
}

export interface ProduceMatchResult {
  status: 'empty_selection' | 'zero_overlap' | 'results'
  matches: ProduceMatch[]
  invalidIds: string[]
}

export interface ProduceMatchOptions {
  minRatio?: number
  maxResults?: number
  minUsefulResults?: number
}

const DEFAULT_MIN_RATIO = 0.5
const DEFAULT_MAX_RESULTS = 10
const DEFAULT_MIN_USEFUL_RESULTS = 3

interface RecipeIndexEntry {
  recipeId: string
  title: string
  distinctProduceIds: string[]
  distinctCount: number
  tier: 'free' | 'pro'
  blendType: 'simple' | 'advanced'
  produceIdSet: Set<string>
  produceNameMap: Map<string, string>
}

let _index: RecipeIndexEntry[] | null = null

function getProduceDisplayName(produceId: string, recipeIngredients?: Array<{ produceId: string, name: string }>): string {
  const lowerId = produceId.toLowerCase()
  if (PRODUCE_DATA[lowerId]) {
    return PRODUCE_DATA[lowerId].name
  }
  if (recipeIngredients) {
    const found = recipeIngredients.find((i) => i.produceId.toLowerCase() === lowerId)
    if (found) return found.name
  }
  return produceId
}

function buildIndex(): RecipeIndexEntry[] {
  if (_index) return _index

  _index = RECIPES.map((recipe) => {
    const seen = new Set<string>()
    const produceIds: string[] = []
    const produceNameMap = new Map<string, string>()

    for (const ing of recipe.ingredients) {
      if (!ing.produceId) continue
      const lowerId = ing.produceId.toLowerCase()
      if (!seen.has(lowerId)) {
        seen.add(lowerId)
        produceIds.push(lowerId)
        produceNameMap.set(lowerId, ing.name || getProduceDisplayName(lowerId))
      }
    }

    return {
      recipeId: recipe.id,
      title: recipe.title,
      distinctProduceIds: produceIds,
      distinctCount: produceIds.length,
      tier: recipe.tier as 'free' | 'pro',
      blendType: getRecipeBlendType(recipe),
      produceIdSet: seen,
      produceNameMap,
    }
  })

  return _index
}

export function resetIndex(): void {
  _index = null
}

function normalizeSelectedIds(selectedProduceIds: string[]): { valid: Set<string>, invalid: string[] } {
  const valid = new Set<string>()
  const invalid: string[] = []
  const seen = new Set<string>()

  for (const rawId of selectedProduceIds) {
    if (typeof rawId !== 'string' || rawId.length === 0) continue
    const lowerId = rawId.toLowerCase()
    if (seen.has(lowerId)) continue
    seen.add(lowerId)

    if (PRODUCE_DATA[lowerId]) {
      valid.add(lowerId)
    } else {
      const inRecipes = RECIPES.some((r) =>
        r.ingredients.some((ing) => ing.produceId.toLowerCase() === lowerId)
      )
      if (inRecipes) {
        valid.add(lowerId)
      } else {
        invalid.push(rawId)
      }
    }
  }

  return { valid, invalid }
}

function computeMatch(
  entry: RecipeIndexEntry,
  selectedSet: Set<string>
): { matched: string[], missing: string[], rawRatio: number } {
  const matched: string[] = []
  const missing: string[] = []

  for (const pid of entry.distinctProduceIds) {
    if (selectedSet.has(pid)) {
      matched.push(pid)
    } else {
      missing.push(pid)
    }
  }

  const rawRatio = entry.distinctCount > 0 ? matched.length / entry.distinctCount : 0
  return { matched, missing, rawRatio }
}

function sortMatches(a: ProduceMatch, b: ProduceMatch): number {
  if (a.tier !== b.tier) {
    const tierOrder: Record<MatchTier, number> = { ready_now: 0, close_match: 1, closest_match: 2 }
    return tierOrder[a.tier] - tierOrder[b.tier]
  }
  if (b.rawMatchRatio !== a.rawMatchRatio) {
    return b.rawMatchRatio - a.rawMatchRatio
  }
  if (a.missingProduceIds.length !== b.missingProduceIds.length) {
    return a.missingProduceIds.length - b.missingProduceIds.length
  }
  if (a.distinctIngredientCount !== b.distinctIngredientCount) {
    return a.distinctIngredientCount - b.distinctIngredientCount
  }
  const titleCmp = a.title.localeCompare(b.title)
  if (titleCmp !== 0) return titleCmp
  return a.recipeId.localeCompare(b.recipeId)
}

export function getRecipesForProduce(
  selectedProduceIds: string[],
  options?: ProduceMatchOptions
): ProduceMatchResult {
  const minRatio = options?.minRatio ?? DEFAULT_MIN_RATIO
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS
  const minUsefulResults = options?.minUsefulResults ?? DEFAULT_MIN_USEFUL_RESULTS

  if (!selectedProduceIds || selectedProduceIds.length === 0) {
    return { status: 'empty_selection', matches: [], invalidIds: [] }
  }

  const { valid: selectedSet, invalid } = normalizeSelectedIds(selectedProduceIds)

  if (selectedSet.size === 0) {
    return { status: 'empty_selection', matches: [], invalidIds: invalid }
  }

  const index = buildIndex()

  const readyNow: ProduceMatch[] = []
  const closeMatch: ProduceMatch[] = []
  const positiveOverlap: ProduceMatch[] = []

  for (const entry of index) {
    const { matched, missing, rawRatio } = computeMatch(entry, selectedSet)

    if (matched.length === 0) continue

    const recipe = getRecipeById(entry.recipeId)
    if (!recipe) continue

    const missingNames = missing.map((pid) => {
      const name = entry.produceNameMap.get(pid)
      if (name) return name
      return getProduceDisplayName(pid, recipe.ingredients)
    })

    const baseMatch: ProduceMatch = {
      recipeId: entry.recipeId,
      title: entry.title,
      tier: 'closest_match',
      rawMatchRatio: rawRatio,
      displayMatchPct: Math.round(rawRatio * 100),
      matchedProduceIds: matched,
      missingProduceIds: missing,
      missingProduceNames: missingNames,
      distinctIngredientCount: entry.distinctCount,
      tier_label: entry.tier,
      blendType: entry.blendType,
    }

    if (missing.length === 0) {
      baseMatch.tier = 'ready_now'
      readyNow.push(baseMatch)
    } else if (rawRatio >= minRatio) {
      baseMatch.tier = 'close_match'
      closeMatch.push(baseMatch)
    } else {
      positiveOverlap.push(baseMatch)
    }
  }

  const strongResults = [...readyNow, ...closeMatch]
  strongResults.sort(sortMatches)

  const closestMatch: ProduceMatch[] = []
  const strongCount = strongResults.length

  if (strongCount < minUsefulResults) {
    const needed = minUsefulResults - strongCount
    positiveOverlap.sort(sortMatches)
    for (let i = 0; i < Math.min(needed, positiveOverlap.length); i++) {
      closestMatch.push(positiveOverlap[i])
    }
  }

  const allResults = [...strongResults, ...closestMatch]
  const trimmed = allResults.slice(0, maxResults)

  if (trimmed.length === 0) {
    return { status: 'zero_overlap', matches: [], invalidIds: invalid }
  }

  return { status: 'results', matches: trimmed, invalidIds: invalid }
}

export function getIndexSize(): number {
  return buildIndex().length
}

export function getDistinctProduceIdsInRecipes(): string[] {
  const index = buildIndex()
  const all = new Set<string>()
  for (const entry of index) {
    for (const pid of entry.distinctProduceIds) {
      all.add(pid)
    }
  }
  return [...all].sort()
}
