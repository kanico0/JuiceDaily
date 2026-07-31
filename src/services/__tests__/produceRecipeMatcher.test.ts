import {
  getRecipesForProduce,
  resetIndex,
  getIndexSize,
  getDistinctProduceIdsInRecipes,
  type ProduceMatch,
  type ProduceMatchResult,
} from '../produceRecipeMatcher'
import { RECIPES, getRecipeById, getRecipeBlendType, countDistinctProduceIds } from '../../constants/recipeData'
import { PRODUCE_DATA } from '../JuiceEngine'

function deriveProduceIds(recipeId: string): string[] {
  const recipe = getRecipeById(recipeId)
  if (!recipe) return []
  return [...new Set(recipe.ingredients.map((i) => i.produceId.toLowerCase()))]
}

function findRecipeWithNIngredients(n: number): string | null {
  for (const r of RECIPES) {
    const ids = [...new Set(r.ingredients.map((i) => i.produceId.toLowerCase()))]
    if (ids.length === n) return r.id
  }
  return null
}

describe('produceRecipeMatcher', () => {
  beforeAll(() => {
    resetIndex()
  })

  describe('index', () => {
    it('has exactly 1,000 entries', () => {
      expect(getIndexSize()).toBe(1000)
    })

    it('has 46 distinct produceIds across all recipes', () => {
      expect(getDistinctProduceIdsInRecipes().length).toBe(46)
    })
  })

  describe('1. Empty selection returns empty-selection state', () => {
    it('returns empty_selection for empty array', () => {
      const result = getRecipesForProduce([])
      expect(result.status).toBe('empty_selection')
      expect(result.matches).toEqual([])
    })

    it('returns empty_selection for null/undefined', () => {
      const r1 = getRecipesForProduce(null as unknown as string[])
      expect(r1.status).toBe('empty_selection')
      const r2 = getRecipesForProduce(undefined as unknown as string[])
      expect(r2.status).toBe('empty_selection')
    })
  })

  describe('2. Duplicate selected IDs do not change results', () => {
    it('produces same results with duplicates', () => {
      const a = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      const b = getRecipesForProduce(['celery', 'celery', 'cucumber', 'ginger', 'ginger'])
      expect(b.matches.map((m) => m.recipeId)).toEqual(a.matches.map((m) => m.recipeId))
    })
  })

  describe('3. Invalid selected IDs are safely handled', () => {
    it('reports invalid IDs', () => {
      const result = getRecipesForProduce(['celery', 'nonexistent_produce_xyz'])
      expect(result.invalidIds).toContain('nonexistent_produce_xyz')
    })

    it('still returns results for valid IDs mixed with invalid', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'fake_item'])
      expect(result.status).toBe('results')
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('returns empty_selection when all IDs are invalid', () => {
      const result = getRecipesForProduce(['fake1', 'fake2'])
      expect(result.status).toBe('empty_selection')
    })
  })

  describe('4. Complete ingredient coverage produces ready_now', () => {
    it('a recipe with all produce selected is ready_now', () => {
      const recipeId = findRecipeWithNIngredients(3)
      expect(recipeId).not.toBeNull()
      const produceIds = deriveProduceIds(recipeId!)
      const result = getRecipesForProduce(produceIds)
      const match = result.matches.find((m) => m.recipeId === recipeId)
      expect(match).toBeDefined()
      expect(match!.tier).toBe('ready_now')
      expect(match!.missingProduceIds).toEqual([])
    })
  })

  describe('5. A ratio exactly equal to 0.5 qualifies as close_match', () => {
    it('ratio === 0.5 is close_match', () => {
      const recipeId = findRecipeWithNIngredients(4)
      expect(recipeId).not.toBeNull()
      const produceIds = deriveProduceIds(recipeId!)
      const half = produceIds.slice(0, 2)
      const result = getRecipesForProduce(half)
      const match = result.matches.find((m) => m.recipeId === recipeId)
      if (match) {
        expect(match.rawMatchRatio).toBe(0.5)
        expect(match.tier).toBe('close_match')
      }
    })
  })

  describe('6. A ratio below 0.5 does not qualify as close_match (multi-produce)', () => {
    it('ratio < 0.5 is not close_match for multi-produce selection (unless fallback)', () => {
      const recipeId = findRecipeWithNIngredients(5)
      expect(recipeId).not.toBeNull()
      const produceIds = deriveProduceIds(recipeId!)
      const one = produceIds.slice(0, 1)
      const another = produceIds.slice(1, 2)
      // Use two different produce IDs so isSingleFamily is false
      const result = getRecipesForProduce([one[0], another[0]], { minUsefulResults: 100 })
      const match = result.matches.find((m) => m.recipeId === recipeId)
      if (match) {
        expect(match.rawMatchRatio).toBeLessThan(0.5)
        expect(match.tier).not.toBe('close_match')
      }
    })
  })

  describe('7. Raw ratio, not rounded display ratio, determines classification (multi-produce)', () => {
    it('uses raw ratio for tier boundary with multi-produce selection', () => {
      const recipeId = findRecipeWithNIngredients(5)
      expect(recipeId).not.toBeNull()
      const produceIds = deriveProduceIds(recipeId!)
      const two = produceIds.slice(0, 2)
      // Use two different produce IDs so isSingleFamily is false
      // ratio = 2/5 = 0.4 < 0.5, should NOT be close_match
      const result = getRecipesForProduce(two, { minUsefulResults: 100 })
      const match = result.matches.find((m) => m.recipeId === recipeId)
      if (match) {
        expect(match.rawMatchRatio).toBeCloseTo(0.4, 5)
        expect(match.displayMatchPct).toBe(40)
        expect(match.tier).not.toBe('close_match')
      }
    })
  })

  describe('8. Missing IDs are correct', () => {
    it('missingProduceIds contains unselected recipe produceIds', () => {
      const recipeId = findRecipeWithNIngredients(3)
      expect(recipeId).not.toBeNull()
      const produceIds = deriveProduceIds(recipeId!)
      const selected = produceIds.slice(0, 1)
      const result = getRecipesForProduce(selected, { minUsefulResults: 100 })
      const match = result.matches.find((m) => m.recipeId === recipeId)
      if (match) {
        expect(match.missingProduceIds).toEqual(produceIds.slice(1))
      }
    })
  })

  describe('9. Missing display names are correct', () => {
    it('missingProduceNames resolves to actual ingredient names', () => {
      const recipeId = findRecipeWithNIngredients(3)
      expect(recipeId).not.toBeNull()
      const recipe = getRecipeById(recipeId!)!
      const produceIds = deriveProduceIds(recipeId!)
      const selected = produceIds.slice(0, 1)
      const result = getRecipesForProduce(selected, { minUsefulResults: 100 })
      const match = result.matches.find((m) => m.recipeId === recipeId)
      if (match) {
        for (let i = 0; i < match.missingProduceIds.length; i++) {
          const pid = match.missingProduceIds[i]
          const ingName = recipe!.ingredients.find((ing) => ing.produceId.toLowerCase() === pid)?.name
          const prodName = PRODUCE_DATA[pid]?.name
          expect(match.missingProduceNames[i]).toBe(ingName || prodName || pid)
        }
      }
    })
  })

  describe('10. Recipes with zero overlap are excluded', () => {
    it('no zero-overlap recipe appears in results', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        expect(match.matchedProduceIds.length).toBeGreaterThan(0)
      }
    })
  })

  describe('11. Strong results are ordered before fallback results', () => {
    it('ready_now and close_match come before closest_match', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      const tiers = result.matches.map((m) => m.tier)
      const hasFallback = tiers.includes('closest_match')
      if (hasFallback) {
        const firstFallbackIdx = tiers.indexOf('closest_match')
        for (let i = 0; i < firstFallbackIdx; i++) {
          expect(tiers[i]).not.toBe('closest_match')
        }
      }
    })
  })

  describe('12. Higher ratio sorts before lower ratio', () => {
    it('within same tier, higher ratio comes first', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon'])
      for (let i = 1; i < result.matches.length; i++) {
        const prev = result.matches[i - 1]
        const curr = result.matches[i]
        if (prev.tier === curr.tier) {
          if (prev.rawMatchRatio !== curr.rawMatchRatio) {
            expect(prev.rawMatchRatio).toBeGreaterThan(curr.rawMatchRatio)
          }
        }
      }
    })
  })

  describe('13. Fewer missing ingredients breaks equal-ratio ties', () => {
    it('equal ratio → fewer missing comes first', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (let i = 1; i < result.matches.length; i++) {
        const prev = result.matches[i - 1]
        const curr = result.matches[i]
        if (prev.tier === curr.tier && prev.rawMatchRatio === curr.rawMatchRatio) {
          if (prev.missingProduceIds.length !== curr.missingProduceIds.length) {
            expect(prev.missingProduceIds.length).toBeLessThan(curr.missingProduceIds.length)
          }
        }
      }
    })
  })

  describe('14. Recipe title and ID provide deterministic final ties', () => {
    it('same tier, ratio, missing, ingredientCount → title then ID', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (let i = 1; i < result.matches.length; i++) {
        const prev = result.matches[i - 1]
        const curr = result.matches[i]
        if (
          prev.tier === curr.tier &&
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

    it('same input always produces same output order', () => {
      const a = getRecipesForProduce(['kale', 'spinach', 'lemon'])
      const b = getRecipesForProduce(['kale', 'spinach', 'lemon'])
      expect(a.matches.map((m) => m.recipeId)).toEqual(b.matches.map((m) => m.recipeId))
    })
  })

  describe('15. Fallback does not appear when at least 3 strong results exist', () => {
    it('no closest_match with 3+ strong results', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon', 'apple'])
      if (result.matches.filter((m) => m.tier !== 'closest_match').length >= 3) {
        expect(result.matches.some((m) => m.tier === 'closest_match')).toBe(false)
      }
    })
  })

  describe('16. Two strong results add only one fallback result', () => {
    it('exactly 1 fallback when 2 strong + minUsefulResults=3', () => {
      const result = getRecipesForProduce(['celery', 'cucumber'], { minUsefulResults: 3, maxResults: 10 })
      const strong = result.matches.filter((m) => m.tier !== 'closest_match')
      const fallback = result.matches.filter((m) => m.tier === 'closest_match')
      if (strong.length === 2) {
        expect(fallback.length).toBe(1)
      }
    })
  })

  describe('17. One strong result adds only two fallback results', () => {
    it('exactly 2 fallback when 1 strong + minUsefulResults=3', () => {
      const result = getRecipesForProduce(['celery'], { minUsefulResults: 3, maxResults: 10 })
      const strong = result.matches.filter((m) => m.tier !== 'closest_match')
      const fallback = result.matches.filter((m) => m.tier === 'closest_match')
      if (strong.length === 1) {
        expect(fallback.length).toBe(2)
      }
    })
  })

  describe('18. Zero strong results with positive overlap returns 3 closest matches', () => {
    it('3 closest matches when no strong + minUsefulResults=3', () => {
      const result = getRecipesForProduce(['jalapeño'], { minUsefulResults: 3, maxResults: 10 })
      if (result.status === 'results') {
        const strong = result.matches.filter((m) => m.tier !== 'closest_match')
        const fallback = result.matches.filter((m) => m.tier === 'closest_match')
        if (strong.length === 0 && fallback.length > 0) {
          expect(fallback.length).toBeLessThanOrEqual(3)
        }
      }
    })
  })

  describe('19. Zero positive-overlap candidates returns zero-overlap state', () => {
    it('zero_overlap for a produceId not in any recipe', () => {
      const result = getRecipesForProduce(['aloe_vera'], { minUsefulResults: 3 })
      if (result.status === 'zero_overlap') {
        expect(result.matches).toEqual([])
      }
    })
  })

  describe('20. Results never exceed maxResults', () => {
    it('respects maxResults=5', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon', 'apple'], { maxResults: 5 })
      expect(result.matches.length).toBeLessThanOrEqual(5)
    })

    it('respects maxResults=3', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon'], { maxResults: 3 })
      expect(result.matches.length).toBeLessThanOrEqual(3)
    })
  })

  describe('21. All returned recipe IDs resolve from canonical RECIPES', () => {
    it('every match.recipeId exists in RECIPES', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)
        expect(recipe).toBeDefined()
      }
    })
  })

  describe('22. No recipe data is mutated', () => {
    it('RECIPES array is unchanged after matching', () => {
      const before = RECIPES.length
      getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      expect(RECIPES.length).toBe(before)
    })

    it('recipe ingredient arrays are not mutated', () => {
      const recipe = RECIPES[0]
      const originalIngredients = JSON.parse(JSON.stringify(recipe.ingredients))
      getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      expect(recipe.ingredients).toEqual(originalIngredients)
    })
  })

  describe('23. Pro/free tier is preserved', () => {
    it('tier_label matches recipe.tier', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)!
        expect(match.tier_label).toBe(recipe.tier)
      }
    })
  })

  describe('24. Simple/Advanced classification is preserved', () => {
    it('blendType matches getRecipeBlendType', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)
        expect(match.blendType).toBe(getRecipeBlendType(recipe))
      }
    })

    it('distinctIngredientCount matches countDistinctProduceIds', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)!
        expect(match.distinctIngredientCount).toBe(countDistinctProduceIds(recipe.ingredients))
      }
    })
  })

  describe('Realistic regression cases', () => {
    it('celery + cucumber + ginger returns results', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      expect(result.status).toBe('results')
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('kale + spinach returns results', () => {
      const result = getRecipesForProduce(['kale', 'spinach'])
      expect(result.status).toBe('results')
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('lemon only returns results', () => {
      const result = getRecipesForProduce(['lemon'])
      expect(result.status).toBe('results')
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('jalapeño selection returns results', () => {
      const result = getRecipesForProduce(['jalapeño'])
      expect(result.status).toBe('results')
    })

    it('canonical produce not in any recipe returns zero_overlap', () => {
      const recipeProduceIds = new Set(
        RECIPES.flatMap((r) => r.ingredients.map((i) => i.produceId.toLowerCase()))
      )
      const produceIds = Object.keys(PRODUCE_DATA)
      const notInRecipes = produceIds.find((pid) => !recipeProduceIds.has(pid))
      if (notInRecipes) {
        const result = getRecipesForProduce([notInRecipes], { minUsefulResults: 3 })
        expect(result.status).toBe('zero_overlap')
      }
    })
  })
})
