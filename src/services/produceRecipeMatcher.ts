import { RECIPES, getRecipeById, getRecipeBlendType, countDistinctProduceIds } from '../constants/recipeData'
import { PRODUCE_DATA } from './JuiceEngine'
import { getProduceFamilyKey, getProduceFamilyMembers, areProduceFamilyEquivalent, getUniqueSelectedCanonicalProduceKeys } from './produceFamilies'

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
  exactMatchCount: number
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
): { matched: string[], missing: string[], rawRatio: number, exactMatchCount: number } {
  const matched: string[] = []
  const missing: string[] = []
  let exactMatchCount = 0

  for (const pid of entry.distinctProduceIds) {
    if (selectedSet.has(pid)) {
      matched.push(pid)
      exactMatchCount++
    } else {
      // Check family-equivalent match
      let familyMatched = false
      for (const selectedId of selectedSet) {
        if (areProduceFamilyEquivalent(selectedId, pid)) {
          familyMatched = true
          break
        }
      }
      if (familyMatched) {
        matched.push(pid)
      } else {
        missing.push(pid)
      }
    }
  }

  const rawRatio = entry.distinctCount > 0 ? matched.length / entry.distinctCount : 0
  return { matched, missing, rawRatio, exactMatchCount }
}

function sortMatches(a: ProduceMatch, b: ProduceMatch): number {
  if (a.tier !== b.tier) {
    const tierOrder: Record<MatchTier, number> = { ready_now: 0, close_match: 1, closest_match: 2 }
    return tierOrder[a.tier] - tierOrder[b.tier]
  }
  if (b.rawMatchRatio !== a.rawMatchRatio) {
    return b.rawMatchRatio - a.rawMatchRatio
  }
  if (b.exactMatchCount !== a.exactMatchCount) {
    return b.exactMatchCount - a.exactMatchCount
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
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS
  const minUsefulResults = options?.minUsefulResults ?? DEFAULT_MIN_USEFUL_RESULTS

  if (!selectedProduceIds || selectedProduceIds.length === 0) {
    return { status: 'empty_selection', matches: [], invalidIds: [] }
  }

  const { valid: selectedSet, invalid } = normalizeSelectedIds(selectedProduceIds)

  if (selectedSet.size === 0) {
    return { status: 'empty_selection', matches: [], invalidIds: invalid }
  }

  // Check if selection resolves to a single canonical produce key.
  // This works for ALL produce, not just explicit variant families.
  // e.g. ["carrot"] → ["carrot"] → single canonical
  //      ["apple", "apple_red"] → ["apple"] → single canonical
  //      ["apple", "carrot"] → ["apple", "carrot"] → multi canonical
  const selectedCanonicalKeys = getUniqueSelectedCanonicalProduceKeys([...selectedSet])
  const isSingleFamily = selectedCanonicalKeys.length === 1

  const minRatio = isSingleFamily ? 0 : (options?.minRatio ?? DEFAULT_MIN_RATIO)

  const index = buildIndex()

  const readyNow: ProduceMatch[] = []
  const closeMatch: ProduceMatch[] = []
  const positiveOverlap: ProduceMatch[] = []

  for (const entry of index) {
    const { matched, missing, rawRatio, exactMatchCount } = computeMatch(entry, selectedSet)

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
      exactMatchCount,
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

  // For single-family selection, return all family-matched recipes without cap
  const trimmed = isSingleFamily ? allResults : allResults.slice(0, maxResults)

  if (trimmed.length === 0) {
    return { status: 'zero_overlap', matches: [], invalidIds: invalid }
  }

  return { status: 'results', matches: trimmed, invalidIds: invalid }
}

export interface PrimaryProduceMatchResult {
  status: 'empty_selection' | 'zero_overlap' | 'results'
  matches: ProduceMatch[]
  invalidIds: string[]
  primaryProduceId: string | null
  primaryProduceName: string | null
}

function recipeContainsProduce(
  entry: RecipeIndexEntry,
  produceId: string
): boolean {
  const lowerId = produceId.toLowerCase()
  if (entry.produceIdSet.has(lowerId)) return true
  for (const recipePid of entry.distinctProduceIds) {
    if (areProduceFamilyEquivalent(recipePid, lowerId)) return true
  }
  return false
}

function countOtherIngredientOverlap(
  entry: RecipeIndexEntry,
  otherSet: Set<string>
): number {
  let count = 0
  for (const pid of entry.distinctProduceIds) {
    if (otherSet.has(pid)) {
      count++
    } else {
      for (const otherId of otherSet) {
        if (areProduceFamilyEquivalent(otherId, pid)) {
          count++
          break
        }
      }
    }
  }
  return count
}

function sortPrimaryMatches(a: ProduceMatch, b: ProduceMatch): number {
  if (b.exactMatchCount !== a.exactMatchCount) {
    return b.exactMatchCount - a.exactMatchCount
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

export function getRecipesForPrimaryProduce(
  primaryProduceId: string,
  otherSelectedProduceIds: string[],
  options?: ProduceMatchOptions
): PrimaryProduceMatchResult {
  if (!primaryProduceId || primaryProduceId.length === 0) {
    return { status: 'empty_selection', matches: [], invalidIds: [], primaryProduceId: null, primaryProduceName: null }
  }

  const primaryLower = primaryProduceId.toLowerCase()
  const primaryName = getProduceDisplayName(primaryLower)

  const { valid: otherSet, invalid } = normalizeSelectedIds(otherSelectedProduceIds)

  const allSelected = new Set<string>([...otherSet, primaryLower])

  const index = buildIndex()

  const readyNow: ProduceMatch[] = []
  const closeMatch: ProduceMatch[] = []
  const primaryOnly: ProduceMatch[] = []

  for (const entry of index) {
    if (!recipeContainsProduce(entry, primaryLower)) continue

    const recipe = getRecipeById(entry.recipeId)
    if (!recipe) continue

    const { matched, missing, rawRatio, exactMatchCount } = computeMatch(entry, allSelected)

    const missingNames = missing.map((pid) => {
      const name = entry.produceNameMap.get(pid)
      if (name) return name
      return getProduceDisplayName(pid, recipe.ingredients)
    })

    const otherOverlap = countOtherIngredientOverlap(entry, otherSet)

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
      exactMatchCount: otherOverlap,
    }

    if (missing.length === 0) {
      baseMatch.tier = 'ready_now'
      readyNow.push(baseMatch)
    } else if (otherOverlap > 0) {
      baseMatch.tier = 'close_match'
      closeMatch.push(baseMatch)
    } else {
      primaryOnly.push(baseMatch)
    }
  }

  const strongResults = [...readyNow, ...closeMatch]
  strongResults.sort(sortPrimaryMatches)
  primaryOnly.sort(sortPrimaryMatches)

  const allResults = [...strongResults, ...primaryOnly]

  if (allResults.length === 0) {
    return { status: 'zero_overlap', matches: [], invalidIds: invalid, primaryProduceId: primaryLower, primaryProduceName: primaryName }
  }

  return { status: 'results', matches: allResults, invalidIds: invalid, primaryProduceId: primaryLower, primaryProduceName: primaryName }
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
