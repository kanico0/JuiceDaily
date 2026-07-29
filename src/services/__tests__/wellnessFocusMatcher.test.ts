import {
  normalize,
  ingredientMatches,
  buildIngredientToNutrients,
  matchRecipeToNutrients,
  matchRecipeToFocusAreas,
  rankRecipesForFocusArea,
  getCachedRanking,
  clearWellnessCache,
  getCacheSize,
  runCoverageValidation,
  PROD_MIN_RATIO,
  PROD_MAX_RESULTS,
} from '../wellnessFocusMatcher'
import { WELLNESS_FOCUS_AREAS, WELLNESS_NUTRIENTS, WELLNESS_DIRECTORY } from '../../constants/wellnessFocusDirectory'
import { RECIPES } from '../../constants/recipeData'

describe('wellnessFocusMatcher', () => {
  describe('normalize', () => {
    it('lowercases and trims', () => {
      expect(normalize('  Kale  ')).toBe('kale')
    })

    it('removes parenthetical content', () => {
      expect(normalize('Apple (green)')).toBe('apple')
    })

    it('removes root/greens/leaf/leaves keywords', () => {
      expect(normalize('celery root')).toBe('celery')
      expect(normalize('collard greens')).toBe('collard')
      expect(normalize('bay leaf')).toBe('bay')
      expect(normalize('mint leaves')).toBe('mint')
    })

    it('collapses multiple spaces', () => {
      expect(normalize('  green   apple  ')).toBe('green apple')
    })
  })

  describe('ingredientMatches', () => {
    it('matches exact normalized strings', () => {
      expect(ingredientMatches('Kale', 'kale')).toBe(true)
    })

    it('matches substring in either direction', () => {
      expect(ingredientMatches('Green Apple', 'apple')).toBe(true)
      expect(ingredientMatches('apple', 'Green Apple')).toBe(true)
    })

    it('does not match unrelated ingredients', () => {
      expect(ingredientMatches('kale', 'carrot')).toBe(false)
    })

    it('handles empty strings', () => {
      expect(ingredientMatches('', 'kale')).toBe(false)
      expect(ingredientMatches('kale', '')).toBe(false)
    })
  })

  describe('buildIngredientToNutrients', () => {
    it('returns a Map with entries', () => {
      const map = buildIngredientToNutrients(WELLNESS_DIRECTORY)
      expect(map.size).toBeGreaterThan(0)
    })

    it('maps each ingredient to at least one nutrient', () => {
      const map = buildIngredientToNutrients(WELLNESS_DIRECTORY)
      for (const [ing, nids] of map) {
        expect(nids.length).toBeGreaterThan(0)
      }
    })
  })

  describe('matchRecipeToNutrients', () => {
    it('returns a Set of matched nutrient IDs', () => {
      const ingToNut = buildIngredientToNutrients(WELLNESS_DIRECTORY)
      const result = matchRecipeToNutrients(['kale', 'lemon', 'ginger'], ingToNut)
      expect(result.size).toBeGreaterThan(0)
    })

    it('returns empty set for no matches', () => {
      const ingToNut = buildIngredientToNutrients(WELLNESS_DIRECTORY)
      const result = matchRecipeToNutrients(['unknown_ingredient_xyz'], ingToNut)
      expect(result.size).toBe(0)
    })
  })

  describe('matchRecipeToFocusAreas', () => {
    it('returns matched focus area IDs for a recipe with kale and ginger', () => {
      const { matchedFocusAreaIds } = matchRecipeToFocusAreas(
        ['kale', 'lemon', 'ginger', 'cucumber'],
        WELLNESS_DIRECTORY
      )
      expect(matchedFocusAreaIds.length).toBeGreaterThan(0)
    })

    it('returns empty array for unknown ingredients', () => {
      const { matchedFocusAreaIds } = matchRecipeToFocusAreas(
        ['unknown_ingredient_xyz'],
        WELLNESS_DIRECTORY
      )
      expect(matchedFocusAreaIds).toEqual([])
    })
  })

  describe('rankRecipesForFocusArea', () => {
    it('returns sorted recipes by overlap count descending', () => {
      const results = rankRecipesForFocusArea('immune_support')
      expect(results.length).toBeGreaterThan(0)

      for (let i = 1; i < results.length; i++) {
        expect(results[i].overlapCount).toBeLessThanOrEqual(results[i - 1].overlapCount)
      }
    })

    it('includes recipeId, recipeTitle, overlapCount, ratio, matchedNutrients', () => {
      const results = rankRecipesForFocusArea('immune_support')
      if (results.length > 0) {
        const first = results[0]
        expect(first.recipeId).toBeDefined()
        expect(first.recipeTitle).toBeDefined()
        expect(first.overlapCount).toBeGreaterThan(0)
        expect(first.ratio).toBeGreaterThan(0)
        expect(first.matchedNutrients.length).toBeGreaterThan(0)
        expect(first.ingredientCount).toBeGreaterThan(0)
      }
    })

    it('returns empty for unknown focus area', () => {
      expect(rankRecipesForFocusArea('nonexistent_area')).toEqual([])
    })

    it('respects minOverlap filter', () => {
      const results = rankRecipesForFocusArea('immune_support', 99)
      expect(results.length).toBe(0)
    })

    it('uses distinct produceId count for ingredientCount (not raw array length)', () => {
      const results = rankRecipesForFocusArea('immune_support', 1, 0)
      for (const r of results) {
        const recipe = RECIPES.find((rp) => rp.id === r.recipeId)
        if (recipe) {
          const distinctIds = new Set(
            recipe.ingredients.map((ing) => ing.produceId).filter(Boolean).map((id) => id.toLowerCase())
          )
          expect(r.ingredientCount).toBe(distinctIds.size)
        }
      }
    })

    it('sorts by overlapCount desc, ratio desc, ingredientCount asc, recipeId asc', () => {
      const results = rankRecipesForFocusArea('immune_support', 1, 0)
      for (let i = 1; i < results.length; i++) {
        const a = results[i - 1]
        const b = results[i]
        if (a.overlapCount !== b.overlapCount) {
          expect(a.overlapCount).toBeGreaterThan(b.overlapCount)
        } else if (a.ratio !== b.ratio) {
          expect(a.ratio).toBeGreaterThan(b.ratio)
        } else if (a.ingredientCount !== b.ingredientCount) {
          expect(a.ingredientCount).toBeLessThan(b.ingredientCount)
        } else {
          expect(a.recipeId.localeCompare(b.recipeId)).toBeLessThanOrEqual(0)
        }
      }
    })
  })

  describe('getCachedRanking', () => {
    beforeEach(() => {
      clearWellnessCache()
    })

    it('returns same results as direct call with matching params', () => {
      const direct = rankRecipesForFocusArea('immune_support', 1, PROD_MIN_RATIO).slice(0, PROD_MAX_RESULTS)
      const cached = getCachedRanking('immune_support')
      expect(cached.length).toBe(direct.length)
      if (cached.length > 0) {
        expect(cached[0].recipeId).toBe(direct[0].recipeId)
      }
    })

    it('caches results (second call does not recompute)', () => {
      const first = getCachedRanking('immune_support')
      const second = getCachedRanking('immune_support')
      expect(first).toBe(second)
      expect(getCacheSize()).toBe(1)
    })

    it('uses different cache keys for different params', () => {
      getCachedRanking('immune_support', 1, 0)
      getCachedRanking('immune_support', 2, 0)
      expect(getCacheSize()).toBe(2)
    })

    it('caps results at PROD_MAX_RESULTS (8)', () => {
      const results = getCachedRanking('immune_support')
      expect(results.length).toBeLessThanOrEqual(PROD_MAX_RESULTS)
    })

    it('uses PROD_MIN_RATIO (0.5) as default minRatio', () => {
      expect(PROD_MIN_RATIO).toBe(0.5)
    })

    it('PROD_MAX_RESULTS is 8', () => {
      expect(PROD_MAX_RESULTS).toBe(8)
    })

    it('clearWellnessCache empties the cache', () => {
      getCachedRanking('immune_support')
      expect(getCacheSize()).toBe(1)
      clearWellnessCache()
      expect(getCacheSize()).toBe(0)
    })
  })

  describe('runCoverageValidation', () => {
    it('returns a valid CoverageReport', () => {
      const report = runCoverageValidation()
      expect(report.total_recipes).toBe(RECIPES.length)
      expect(report.total_focus_areas).toBe(WELLNESS_FOCUS_AREAS.length)
      expect(report.coverage_pct_recipes_mapped).toBeGreaterThanOrEqual(0)
      expect(report.coverage_pct_recipes_mapped).toBeLessThanOrEqual(100)
      expect(report.coverage_pct_focus_areas_filled).toBeGreaterThanOrEqual(0)
      expect(report.coverage_pct_focus_areas_filled).toBeLessThanOrEqual(100)
    })

    it('recipe_to_focus_areas has entry for every recipe', () => {
      const report = runCoverageValidation()
      for (const recipe of RECIPES) {
        expect(report.recipe_to_focus_areas[recipe.id]).toBeDefined()
      }
    })

    it('every focus area produces at least one qualifying result at PROD_MIN_RATIO', () => {
      for (const area of WELLNESS_FOCUS_AREAS) {
        const results = rankRecipesForFocusArea(area.id, 1, PROD_MIN_RATIO)
        expect(results.length).toBeGreaterThan(0)
      }
    })
  })

  describe('WELLNESS_DIRECTORY integrity', () => {
    it('has focus areas with associated_nutrients', () => {
      for (const area of WELLNESS_FOCUS_AREAS) {
        expect(area.associated_nutrients.length).toBeGreaterThan(0)
      }
    })

    it('has nutrients with juice_ingredients', () => {
      const nutrientEntries = Object.entries(WELLNESS_NUTRIENTS)
      expect(nutrientEntries.length).toBeGreaterThan(0)
      for (const [, nutrient] of nutrientEntries) {
        expect(nutrient.juice_ingredients.length).toBeGreaterThan(0)
      }
    })

    it('every focus area nutrient exists in nutrients map', () => {
      for (const area of WELLNESS_FOCUS_AREAS) {
        for (const nid of area.associated_nutrients) {
          expect(WELLNESS_NUTRIENTS[nid]).toBeDefined()
        }
      }
    })
  })

  describe('Empty-state verification', () => {
    it('rankRecipesForFocusArea returns empty array when minOverlap exceeds all overlaps', () => {
      const results = rankRecipesForFocusArea('immune_support', 999, 0)
      expect(results).toEqual([])
    })

    it('getCachedRanking returns empty array when no recipes qualify', () => {
      clearWellnessCache()
      const results = getCachedRanking('immune_support', 999, 0)
      expect(results).toEqual([])
      expect(results.length).toBe(0)
    })

    it('WellnessResultsScreen source contains "No matching juices yet" empty-state text', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'WellnessResultsScreen.js'),
        'utf-8'
      )
      expect(source).toContain('No matching juices yet')
    })

    it('WellnessResultsScreen source contains noResultsCard for empty state body', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'WellnessResultsScreen.js'),
        'utf-8'
      )
      expect(source).toContain('noResultsCard')
      expect(source).toContain('Try a different focus area')
    })
  })
})
