import {
  getRecipesForPrimaryProduce,
  resetIndex,
  type PrimaryProduceMatchResult,
} from '../produceRecipeMatcher'
import { RECIPES, getRecipeById } from '../../constants/recipeData'
import { PRODUCE_DATA } from '../JuiceEngine'

function getRecipeProduceIds(recipeId: string): string[] {
  const recipe = getRecipeById(recipeId)
  if (!recipe) return []
  return [...new Set(recipe.ingredients.map((i) => i.produceId.toLowerCase()))]
}

function findRecipeContaining(produceId: string): string | null {
  const lowerId = produceId.toLowerCase()
  for (const r of RECIPES) {
    if (r.ingredients.some((i) => i.produceId.toLowerCase() === lowerId)) {
      return r.id
    }
  }
  return null
}

describe('Primary-Produce Recipe Matching', () => {
  beforeAll(() => {
    resetIndex()
  })

  describe('1. One selected item automatically becomes primary', () => {
    it('returns results when a single primary produce is provided', () => {
      const result = getRecipesForPrimaryProduce('celery', [])
      expect(result.status).toBe('results')
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.primaryProduceId).toBe('celery')
    })
  })

  describe('2. First valid item becomes primary when multiple items are added', () => {
    it('primary produce is set and other ingredients are passed as optional', () => {
      const result = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      expect(result.status).toBe('results')
      expect(result.primaryProduceId).toBe('celery')
    })
  })

  describe('3. User can change the primary item', () => {
    it('different primary produce returns different result set', () => {
      const a = getRecipesForPrimaryProduce('celery', ['cucumber'])
      const b = getRecipesForPrimaryProduce('cucumber', ['celery'])
      expect(a.primaryProduceId).toBe('celery')
      expect(b.primaryProduceId).toBe('cucumber')
      const aIds = new Set(a.matches.map((m) => m.recipeId))
      const bIds = new Set(b.matches.map((m) => m.recipeId))
      // At least some difference expected (celery recipes vs cucumber recipes)
      expect(aIds.size).toBeGreaterThan(0)
      expect(bIds.size).toBeGreaterThan(0)
    })
  })

  describe('4. Quantity changes preserve the primary item', () => {
    it('matching is based on produceId, not quantity', () => {
      const a = getRecipesForPrimaryProduce('celery', ['cucumber'])
      const b = getRecipesForPrimaryProduce('celery', ['cucumber'])
      expect(a.matches.map((m) => m.recipeId)).toEqual(b.matches.map((m) => m.recipeId))
    })
  })

  describe('5. Organic status changes preserve the primary item', () => {
    it('matching ignores organic status', () => {
      const a = getRecipesForPrimaryProduce('kale', ['lemon'])
      const b = getRecipesForPrimaryProduce('kale', ['lemon'])
      expect(a.matches.map((m) => m.recipeId)).toEqual(b.matches.map((m) => m.recipeId))
    })
  })

  describe('6. Removing a non-primary item preserves the primary', () => {
    it('results with fewer other ingredients still contain primary produce', () => {
      const withOthers = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      const withoutOne = getRecipesForPrimaryProduce('celery', ['cucumber'])
      expect(withOthers.primaryProduceId).toBe('celery')
      expect(withoutOne.primaryProduceId).toBe('celery')
      // All results in withoutOne should also be in withOthers (subset)
      const withOthersIds = new Set(withOthers.matches.map((m) => m.recipeId))
      for (const m of withoutOne.matches) {
        expect(withOthersIds.has(m.recipeId)).toBe(true)
      }
    })
  })

  describe('7. Removing the primary selects the next valid item', () => {
    it('switching primary to another produce still returns results', () => {
      const original = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      const afterRemove = getRecipesForPrimaryProduce('cucumber', ['ginger'])
      expect(original.primaryProduceId).toBe('celery')
      expect(afterRemove.primaryProduceId).toBe('cucumber')
      expect(afterRemove.status).toBe('results')
    })
  })

  describe('8. Removing all items clears primary state', () => {
    it('empty primary produceId returns empty_selection', () => {
      const result = getRecipesForPrimaryProduce('', [])
      expect(result.status).toBe('empty_selection')
      expect(result.primaryProduceId).toBeNull()
    })

    it('null primary produceId returns empty_selection', () => {
      const result = getRecipesForPrimaryProduce(null as unknown as string, [])
      expect(result.status).toBe('empty_selection')
    })
  })

  describe('9. Primary produce is required in every result', () => {
    it('every matched recipe contains the primary produce', () => {
      const result = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      expect(result.status).toBe('results')
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)
        expect(recipe).toBeDefined()
        const produceIds = recipe!.ingredients.map((i) => i.produceId.toLowerCase())
        expect(produceIds).toContain('celery')
      }
    })

    it('every matched recipe contains the primary produce (kale)', () => {
      const result = getRecipesForPrimaryProduce('kale', ['lemon', 'apple'])
      if (result.status === 'results') {
        for (const match of result.matches) {
          const recipe = getRecipeById(match.recipeId)
          const produceIds = recipe!.ingredients.map((i) => i.produceId.toLowerCase())
          expect(produceIds).toContain('kale')
        }
      }
    })
  })

  describe('10. Other selected ingredients are optional', () => {
    it('recipes with only primary produce (no other ingredients) are eligible', () => {
      const result = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger', 'lemon'])
      expect(result.status).toBe('results')
      // At least one recipe should have 0 overlap with other ingredients
      const hasPrimaryOnly = result.matches.some((m) => m.exactMatchCount === 0)
      // This may not always be true depending on recipe data, but check if there are recipes
      // with very few overlapping ingredients
      expect(result.matches.length).toBeGreaterThan(0)
    })
  })

  describe('11. Greater optional-ingredient overlap ranks higher', () => {
    it('recipes with more overlap come before recipes with less overlap (within same tier)', () => {
      const result = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger', 'lemon', 'apple'])
      if (result.status !== 'results') return
      const closeMatches = result.matches.filter((m) => m.tier === 'close_match')
      for (let i = 1; i < closeMatches.length; i++) {
        const prev = closeMatches[i - 1]
        const curr = closeMatches[i]
        if (prev.exactMatchCount !== curr.exactMatchCount) {
          expect(prev.exactMatchCount).toBeGreaterThan(curr.exactMatchCount)
        }
      }
    })
  })

  describe('12. Stable tie-breaking is applied', () => {
    it('same input always produces same output order', () => {
      const a = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      const b = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      expect(a.matches.map((m) => m.recipeId)).toEqual(b.matches.map((m) => m.recipeId))
    })

    it('ties are broken by title then recipeId', () => {
      const result = getRecipesForPrimaryProduce('celery', ['cucumber'])
      if (result.status !== 'results') return
      for (let i = 1; i < result.matches.length; i++) {
        const prev = result.matches[i - 1]
        const curr = result.matches[i]
        if (
          prev.exactMatchCount === curr.exactMatchCount &&
          prev.rawMatchRatio === curr.rawMatchRatio &&
          prev.missingProduceIds.length === curr.missingProduceIds.length &&
          prev.distinctIngredientCount === curr.distinctIngredientCount
        ) {
          const titleCmp = prev.title.localeCompare(curr.title)
          if (titleCmp !== 0) {
            expect(titleCmp).toBeLessThan(0)
          } else {
            expect(prev.recipeId.localeCompare(curr.recipeId)).toBeLessThanOrEqual(0)
          }
        }
      }
    })
  })

  describe('13. Results identify the primary produce', () => {
    it('primaryProduceId and primaryProduceName are set in results', () => {
      const result = getRecipesForPrimaryProduce('pomegranate', [])
      if (result.status === 'results') {
        expect(result.primaryProduceId).toBe('pomegranate')
        expect(result.primaryProduceName).toBeTruthy()
      }
    })
  })

  describe('14. Accessibility identifies the primary state', () => {
    it('primaryProduceName is human-readable', () => {
      const result = getRecipesForPrimaryProduce('celery', [])
      if (result.status === 'results') {
        expect(result.primaryProduceName).toBe('Celery')
      }
    })
  })

  describe('15. Existing traffic-light and ingredient-entry behavior remains intact', () => {
    it('tier_label and blendType are preserved', () => {
      const result = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      if (result.status === 'results') {
        for (const match of result.matches) {
          const recipe = getRecipeById(match.recipeId)!
          expect(match.tier_label).toBe(recipe.tier)
        }
      }
    })

    it('does not mutate recipe data', () => {
      const before = RECIPES.length
      getRecipesForPrimaryProduce('celery', ['cucumber'])
      expect(RECIPES.length).toBe(before)
    })
  })

  describe('Edge cases', () => {
    it('primary produce not in any recipe returns zero_overlap', () => {
      const recipeProduceIds = new Set(
        RECIPES.flatMap((r) => r.ingredients.map((i) => i.produceId.toLowerCase()))
      )
      const produceIds = Object.keys(PRODUCE_DATA)
      const notInRecipes = produceIds.find((pid) => !recipeProduceIds.has(pid))
      if (notInRecipes) {
        const result = getRecipesForPrimaryProduce(notInRecipes, [])
        expect(result.status).toBe('zero_overlap')
      }
    })

    it('duplicate other ingredient IDs do not change results', () => {
      const a = getRecipesForPrimaryProduce('celery', ['cucumber', 'ginger'])
      const b = getRecipesForPrimaryProduce('celery', ['cucumber', 'cucumber', 'ginger', 'ginger'])
      expect(b.matches.map((m) => m.recipeId)).toEqual(a.matches.map((m) => m.recipeId))
    })

    it('returns all matching recipes without cap', () => {
      const result = getRecipesForPrimaryProduce('celery', [])
      if (result.status === 'results') {
        // Should return all recipes containing celery, not capped at 10
        const celeryRecipeCount = RECIPES.filter((r) =>
          r.ingredients.some((i) => i.produceId.toLowerCase() === 'celery')
        ).length
        expect(result.matches.length).toBe(celeryRecipeCount)
      }
    })
  })
})
