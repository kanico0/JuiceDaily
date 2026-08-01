import { areProduceFamilyEquivalent, PRODUCE_FAMILIES } from '../produceFamilies'
import { getRecipesForPrimaryProduce, resetIndex } from '../produceRecipeMatcher'
import { getRecipeById } from '../../constants/recipeData'

describe('Family Equivalence — Exact Rules and Mappings', () => {
  beforeAll(() => {
    resetIndex()
  })

  describe('PRODUCE_FAMILIES mapping', () => {
    it('contains exactly 3 family groups', () => {
      expect(Object.keys(PRODUCE_FAMILIES).length).toBe(3)
    })

    it('maps apple family: apple, apple_green, apple_red', () => {
      expect(PRODUCE_FAMILIES.apple).toEqual(['apple', 'apple_green', 'apple_red'])
    })

    it('maps bell_pepper family: red, yellow, green', () => {
      expect(PRODUCE_FAMILIES.bell_pepper).toEqual([
        'bell_pepper_red',
        'bell_pepper_yellow',
        'bell_pepper_green',
      ])
    })

    it('maps cabbage family: green, red', () => {
      expect(PRODUCE_FAMILIES.cabbage).toEqual(['cabbage_green', 'cabbage_red'])
    })
  })

  describe('areProduceFamilyEquivalent — acceptable equivalences', () => {
    it('apple is equivalent to apple_green', () => {
      expect(areProduceFamilyEquivalent('apple', 'apple_green')).toBe(true)
    })

    it('apple_green is equivalent to apple_red', () => {
      expect(areProduceFamilyEquivalent('apple_green', 'apple_red')).toBe(true)
    })

    it('bell_pepper_red is equivalent to bell_pepper_yellow', () => {
      expect(areProduceFamilyEquivalent('bell_pepper_red', 'bell_pepper_yellow')).toBe(true)
    })

    it('bell_pepper_green is equivalent to bell_pepper_red', () => {
      expect(areProduceFamilyEquivalent('bell_pepper_green', 'bell_pepper_red')).toBe(true)
    })

    it('cabbage_green is equivalent to cabbage_red', () => {
      expect(areProduceFamilyEquivalent('cabbage_green', 'cabbage_red')).toBe(true)
    })

    it('same produce ID is equivalent to itself', () => {
      expect(areProduceFamilyEquivalent('celery', 'celery')).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(areProduceFamilyEquivalent('Apple', 'APPLE_GREEN')).toBe(true)
    })
  })

  describe('areProduceFamilyEquivalent — unacceptable equivalences', () => {
    it('grape is NOT equivalent to grapefruit', () => {
      expect(areProduceFamilyEquivalent('grape', 'grapefruit')).toBe(false)
    })

    it('kale is NOT equivalent to collard_greens', () => {
      expect(areProduceFamilyEquivalent('kale', 'collard_greens')).toBe(false)
    })

    it('orange is NOT equivalent to grapefruit', () => {
      expect(areProduceFamilyEquivalent('orange', 'grapefruit')).toBe(false)
    })

    it('spinach is NOT equivalent to swiss_chard', () => {
      expect(areProduceFamilyEquivalent('spinach', 'swiss_chard')).toBe(false)
    })

    it('celery is NOT equivalent to kale', () => {
      expect(areProduceFamilyEquivalent('celery', 'kale')).toBe(false)
    })

    it('apple is NOT equivalent to pineapple', () => {
      expect(areProduceFamilyEquivalent('apple', 'pineapple')).toBe(false)
    })

    it('lemon is NOT equivalent to lime', () => {
      expect(areProduceFamilyEquivalent('lemon', 'lime')).toBe(false)
    })

    it('cucumber is NOT equivalent to celery', () => {
      expect(areProduceFamilyEquivalent('cucumber', 'celery')).toBe(false)
    })
  })

  describe('Primary-produce matching uses family equivalence correctly', () => {
    it('a recipe with apple_red matches when primary is apple', () => {
      const result = getRecipesForPrimaryProduce('apple', [])
      if (result.status !== 'results') return
      // Every matched recipe must contain apple, apple_green, or apple_red
      for (const m of result.matches) {
        const recipe = getRecipeById(m.recipeId)
        expect(recipe).toBeDefined()
        if (!recipe) continue
        const produceIds = recipe.ingredients.map((i) => i.produceId.toLowerCase())
        const hasAppleFamily = produceIds.some((pid) =>
          areProduceFamilyEquivalent(pid, 'apple')
        )
        expect(hasAppleFamily).toBe(true)
      }
    })

    it('a recipe with only grape does NOT match when primary is grapefruit', () => {
      const result = getRecipesForPrimaryProduce('grapefruit', [])
      if (result.status !== 'results') return
      for (const m of result.matches) {
        const recipe = getRecipeById(m.recipeId)
        expect(recipe).toBeDefined()
        if (!recipe) continue
        const produceIds = recipe.ingredients.map((i) => i.produceId.toLowerCase())
        const hasGrapefruit = produceIds.includes('grapefruit')
        expect(hasGrapefruit).toBe(true)
      }
    })

    it('a recipe with only spinach does NOT match when primary is swiss_chard', () => {
      const result = getRecipesForPrimaryProduce('swiss_chard', [])
      if (result.status !== 'results') return
      for (const m of result.matches) {
        const recipe = getRecipeById(m.recipeId)
        expect(recipe).toBeDefined()
        if (!recipe) continue
        const produceIds = recipe.ingredients.map((i) => i.produceId.toLowerCase())
        const hasChard = produceIds.includes('swiss_chard')
        expect(hasChard).toBe(true)
      }
    })

    it('a recipe with only kale does NOT match when primary is collard_greens', () => {
      const result = getRecipesForPrimaryProduce('collard_greens', [])
      // collard_greens has no family mapping and likely no recipes
      // If results exist, they must actually contain collard_greens
      if (result.status === 'results') {
        for (const m of result.matches) {
          const recipe = getRecipeById(m.recipeId)
          expect(recipe).toBeDefined()
          if (!recipe) continue
          const produceIds = recipe.ingredients.map((i) => i.produceId.toLowerCase())
          const hasCollard = produceIds.includes('collard_greens')
          expect(hasCollard).toBe(true)
        }
      }
    })
  })
})
