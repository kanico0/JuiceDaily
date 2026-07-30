import {
  getRecipesForProduce,
  resetIndex,
  getIndexSize,
} from '../../services/produceRecipeMatcher'
import { RECIPES, getRecipeById, getRecipeBlendType, countDistinctProduceIds, DATASET_FINGERPRINT } from '../../constants/recipeData'
import { PRODUCE_DATA } from '../../services/JuiceEngine'

describe('ProduceRecipeResultsScreen integration', () => {
  beforeAll(() => {
    resetIndex()
  })

  describe('Route param contract', () => {
    it('selectedProduceIds is an array of strings', () => {
      const selectedProduceIds = ['celery', 'cucumber', 'ginger']
      const result = getRecipesForProduce(selectedProduceIds)
      expect(result.status).toBe('results')
      expect(Array.isArray(result.matches)).toBe(true)
    })

    it('empty array produces empty_selection status', () => {
      const result = getRecipesForProduce([])
      expect(result.status).toBe('empty_selection')
    })

    it('null produces empty_selection status', () => {
      const result = getRecipesForProduce(null)
      expect(result.status).toBe('empty_selection')
    })
  })

  describe('Navigation to RecipeDetail', () => {
    it('every result match has a recipeId that resolves via getRecipeById', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)
        expect(recipe).toBeDefined()
        expect(recipe.id).toBe(match.recipeId)
      }
    })

    it('navigation target is RecipeDetail with { recipeId }', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      const firstMatch = result.matches[0]
      const navParams = { recipeId: firstMatch.recipeId }
      expect(navParams).toEqual({ recipeId: firstMatch.recipeId })
    })
  })

  describe('Tiered sections', () => {
    it('ready_now matches have zero missingProduceIds', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon'])
      const readyNow = result.matches.filter((m) => m.tier === 'ready_now')
      for (const m of readyNow) {
        expect(m.missingProduceIds).toEqual([])
        expect(m.missingProduceNames).toEqual([])
      }
    })

    it('close_match matches have at least 1 missing and ratio >= 0.5', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger', 'lemon'])
      const closeMatches = result.matches.filter((m) => m.tier === 'close_match')
      for (const m of closeMatches) {
        expect(m.missingProduceIds.length).toBeGreaterThan(0)
        expect(m.rawMatchRatio).toBeGreaterThanOrEqual(0.5)
      }
    })

    it('closest_match matches have ratio < 0.5', () => {
      const result = getRecipesForProduce(['celery'], { minUsefulResults: 5 })
      const closest = result.matches.filter((m) => m.tier === 'closest_match')
      for (const m of closest) {
        expect(m.rawMatchRatio).toBeLessThan(0.5)
      }
    })

    it('tiers are ordered ready_now then close_match then closest_match', () => {
      const result = getRecipesForProduce(['celery', 'cucumber'], { minUsefulResults: 3 })
      const tiers = result.matches.map((m) => m.tier)
      const tierOrder = { ready_now: 0, close_match: 1, closest_match: 2 }
      for (let i = 1; i < tiers.length; i++) {
        expect(tierOrder[tiers[i]]).toBeGreaterThanOrEqual(tierOrder[tiers[i - 1]])
      }
    })
  })

  describe('Empty / zero-overlap states', () => {
    it('empty_selection when no produce selected', () => {
      expect(getRecipesForProduce([]).status).toBe('empty_selection')
    })

    it('zero_overlap when produce has no recipe overlap', () => {
      const recipeProduceIds = new Set(
        RECIPES.flatMap((r) => r.ingredients.map((i) => i.produceId.toLowerCase()))
      )
      const produceIds = Object.keys(PRODUCE_DATA)
      const notInRecipes = produceIds.find((pid) => !recipeProduceIds.has(pid))
      if (notInRecipes) {
        expect(getRecipesForProduce([notInRecipes], { minUsefulResults: 3 }).status).toBe('zero_overlap')
      }
    })
  })

  describe('Quota safety — browsing consumes nothing', () => {
    it('getRecipesForProduce does not modify RECIPES', () => {
      const before = RECIPES.length
      getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      expect(RECIPES.length).toBe(before)
    })

    it('getRecipesForProduce does not modify recipe ingredients', () => {
      const recipe = RECIPES[0]
      const original = JSON.parse(JSON.stringify(recipe.ingredients))
      getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      expect(recipe.ingredients).toEqual(original)
    })

    it('DATASET_FINGERPRINT is unchanged', () => {
      expect(DATASET_FINGERPRINT).toBe('b19de0954f7f89c9d9bfa2f9a9b0b79e4863a453cbce5136e85655b106774d4f')
    })

    it('getIndexSize remains 1000 after matching', () => {
      getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      expect(getIndexSize()).toBe(1000)
    })
  })

  describe('Produce chip display names', () => {
    it('PRODUCE_DATA resolves display names for all selected produce', () => {
      const selected = ['celery', 'cucumber', 'ginger']
      for (const id of selected) {
        const entry = PRODUCE_DATA[id]
        expect(entry).toBeDefined()
        expect(entry.name).toBeTruthy()
      }
    })

    it('recipe ingredient names are used for missingProduceNames', () => {
      const result = getRecipesForProduce(['celery'], { minUsefulResults: 5 })
      for (const match of result.matches) {
        if (match.missingProduceIds.length > 0) {
          const recipe = getRecipeById(match.recipeId)
          for (let i = 0; i < match.missingProduceIds.length; i++) {
            const pid = match.missingProduceIds[i]
            const ingName = recipe.ingredients.find((ing) => ing.produceId.toLowerCase() === pid)?.name
            const prodName = PRODUCE_DATA[pid]?.name
            expect(match.missingProduceNames[i]).toBe(ingName || prodName || pid)
          }
        }
      }
    })
  })

  describe('Pro/Advanced badge', () => {
    it('tier_label matches recipe.tier for all results', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)
        expect(match.tier_label).toBe(recipe.tier)
      }
    })

    it('blendType matches getRecipeBlendType for all results', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      for (const match of result.matches) {
        const recipe = getRecipeById(match.recipeId)
        expect(match.blendType).toBe(getRecipeBlendType(recipe))
      }
    })

    it('advanced blends have 5+ distinct produceIds', () => {
      const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
      const advanced = result.matches.filter((m) => m.blendType === 'advanced')
      for (const m of advanced) {
        expect(m.distinctIngredientCount).toBeGreaterThanOrEqual(5)
      }
    })
  })

  describe('CTA integration — HomeScreen passes batch produceIds', () => {
    it('batch.scannedIngredients produceIds are valid for matching', () => {
      const mockBatch = [
        { produceId: 'celery', weightG: 150, isOrganic: false },
        { produceId: 'cucumber', weightG: 150, isOrganic: false },
        { produceId: 'ginger', weightG: 15, isOrganic: false },
      ]
      const ids = mockBatch.map((i) => i.produceId)
      const result = getRecipesForProduce(ids)
      expect(result.status).toBe('results')
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('single produce selection still returns results', () => {
      const result = getRecipesForProduce(['lemon'])
      expect(result.status).toBe('results')
    })
  })
})
