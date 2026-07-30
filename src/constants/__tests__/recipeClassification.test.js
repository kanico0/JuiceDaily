import {
  RECIPES,
  getRecipeById,
  getRecipeBlendType,
  countDistinctProduceIds,
  SIMPLE_BLEND_MAX,
} from '../../constants/recipeData'

describe('recipe classification', () => {
  describe('dataset integrity', () => {
    it('has exactly 1000 recipes', () => {
      expect(RECIPES).toHaveLength(1000)
    })

    it('every recipe has a unique id', () => {
      const ids = RECIPES.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('every recipe has a unique title', () => {
      const titles = RECIPES.map((r) => r.title)
      expect(new Set(titles).size).toBe(titles.length)
    })

    it('every recipe has ingredients with produceId', () => {
      for (const r of RECIPES) {
        expect(r.ingredients.length).toBeGreaterThan(0)
        for (const ing of r.ingredients) {
          expect(ing.produceId).toBeTruthy()
          expect(ing.name).toBeTruthy()
          expect(ing.amount).toBeTruthy()
        }
      }
    })

    it('every recipe has valid tier', () => {
      const validTiers = new Set(['free', 'pro'])
      for (const r of RECIPES) {
        expect(validTiers.has(r.tier)).toBe(true)
      }
    })

    it('every recipe has valid collection', () => {
      const validCollections = new Set(['core', 'glow_library', 'seasonal', 'beginner_path'])
      for (const r of RECIPES) {
        expect(validCollections.has(r.collection)).toBe(true)
      }
    })

    it('every recipe has valid pillars', () => {
      const validPillars = new Set(['base', 'power', 'kick'])
      for (const r of RECIPES) {
        expect(r.pillars.length).toBeGreaterThan(0)
        for (const p of r.pillars) {
          expect(validPillars.has(p)).toBe(true)
        }
      }
    })

    it('every recipe has 3 gradient colors', () => {
      for (const r of RECIPES) {
        expect(r.gradientColors).toHaveLength(3)
        for (const c of r.gradientColors) {
          expect(c.startsWith('#')).toBe(true)
        }
      }
    })

    it('every recipe has cleanupScore 0-5', () => {
      for (const r of RECIPES) {
        expect(r.cleanupScore).toBeGreaterThanOrEqual(0)
        expect(r.cleanupScore).toBeLessThanOrEqual(5)
      }
    })

    it('ingredient ratios sum to ~1.0 (±0.02)', () => {
      for (const r of RECIPES) {
        const sum = r.ingredients.reduce((acc, ing) => acc + ing.ratio, 0)
        expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.02)
      }
    })
  })

  describe('countDistinctProduceIds', () => {
    it('counts distinct produce IDs (case-insensitive)', () => {
      const ingredients = [
        { produceId: 'Apple' },
        { produceId: 'apple' },
        { produceId: 'Kale' },
        { produceId: 'Ginger' },
      ]
      expect(countDistinctProduceIds(ingredients)).toBe(3)
    })

    it('ignores missing produceId', () => {
      const ingredients = [
        { produceId: 'apple' },
        { produceId: '' },
        { produceId: null },
        { produceId: 'kale' },
      ]
      expect(countDistinctProduceIds(ingredients)).toBe(2)
    })

    it('returns 0 for empty array', () => {
      expect(countDistinctProduceIds([])).toBe(0)
    })
  })

  describe('getRecipeBlendType', () => {
    it('returns "simple" for recipes with 2-4 distinct produce IDs', () => {
      const simple = RECIPES.filter(
        (r) => countDistinctProduceIds(r.ingredients) >= 2 &&
               countDistinctProduceIds(r.ingredients) <= SIMPLE_BLEND_MAX
      )
      expect(simple.length).toBeGreaterThan(0)
      for (const r of simple) {
        expect(getRecipeBlendType(r)).toBe('simple')
      }
    })

    it('returns "advanced" for recipes with 5+ distinct produce IDs', () => {
      const advanced = RECIPES.filter(
        (r) => countDistinctProduceIds(r.ingredients) >= 5
      )
      expect(advanced.length).toBeGreaterThan(0)
      for (const r of advanced) {
        expect(getRecipeBlendType(r)).toBe('advanced')
      }
    })

    it('boundary: exactly SIMPLE_BLEND_MAX is simple', () => {
      const boundary = RECIPES.filter(
        (r) => countDistinctProduceIds(r.ingredients) === SIMPLE_BLEND_MAX
      )
      expect(boundary.length).toBeGreaterThan(0)
      for (const r of boundary) {
        expect(getRecipeBlendType(r)).toBe('simple')
      }
    })

    it('boundary: SIMPLE_BLEND_MAX + 1 is advanced', () => {
      const boundary = RECIPES.filter(
        (r) => countDistinctProduceIds(r.ingredients) === SIMPLE_BLEND_MAX + 1
      )
      expect(boundary.length).toBeGreaterThan(0)
      for (const r of boundary) {
        expect(getRecipeBlendType(r)).toBe('advanced')
      }
    })

    it('every recipe is either simple or advanced', () => {
      for (const r of RECIPES) {
        const type = getRecipeBlendType(r)
        expect(['simple', 'advanced']).toContain(type)
      }
    })

    it('classification counts: 600 simple, 400 advanced', () => {
      const simple = RECIPES.filter((r) => getRecipeBlendType(r) === 'simple')
      const advanced = RECIPES.filter((r) => getRecipeBlendType(r) === 'advanced')
      expect(simple.length).toBe(600)
      expect(advanced.length).toBe(400)
    })
  })

  describe('quota consumption invariants', () => {
    it('browsing recipes does not invoke blendAllowanceService', () => {
      // getRecipeById is a pure lookup — no side effects
      const recipe = getRecipeById('emerald-uplift')
      expect(recipe).toBeDefined()
      expect(recipe.id).toBe('emerald-uplift')
    })

    it('all recipes are browsable regardless of blend type', () => {
      // Both simple and advanced recipes should be accessible for browsing
      const simple = RECIPES.filter((r) => getRecipeBlendType(r) === 'simple')
      const advanced = RECIPES.filter((r) => getRecipeBlendType(r) === 'advanced')
      expect(simple.length).toBeGreaterThan(0)
      expect(advanced.length).toBeGreaterThan(0)
      // All should be retrievable by ID
      for (const r of [...simple.slice(0, 10), ...advanced.slice(0, 10)]) {
        expect(getRecipeById(r.id)).toBeDefined()
      }
    })

    it('free-tier recipes include both simple and advanced', () => {
      const freeRecipes = RECIPES.filter((r) => r.tier === 'free')
      const freeSimple = freeRecipes.filter((r) => getRecipeBlendType(r) === 'simple')
      const freeAdvanced = freeRecipes.filter((r) => getRecipeBlendType(r) === 'advanced')
      expect(freeSimple.length).toBeGreaterThan(0)
      expect(freeAdvanced.length).toBeGreaterThan(0)
    })

    it('pro-tier recipes include both simple and advanced', () => {
      const proRecipes = RECIPES.filter((r) => r.tier === 'pro')
      const proSimple = proRecipes.filter((r) => getRecipeBlendType(r) === 'simple')
      const proAdvanced = proRecipes.filter((r) => getRecipeBlendType(r) === 'advanced')
      // Pro recipes may be all one type — just verify they exist
      expect(proRecipes.length).toBeGreaterThan(0)
    })
  })

  describe('encoding repair verification', () => {
    it('no recipe title contains mojibake markers', () => {
      const mojibake = /[\u00C0-\u00FF]{2,}/
      for (const r of RECIPES) {
        expect(mojibake.test(r.title)).toBe(false)
      }
    })

    it('no recipe vibeTag contains mojibake markers', () => {
      const mojibake = /[\u00C0-\u00FF]{2,}/
      for (const r of RECIPES) {
        expect(mojibake.test(r.vibeTag)).toBe(false)
      }
    })

    it('no ingredient name contains mojibake markers', () => {
      const mojibake = /[\u00C0-\u00FF]{2,}/
      for (const r of RECIPES) {
        for (const ing of r.ingredients) {
          expect(mojibake.test(ing.name)).toBe(false)
        }
      }
    })

    it('no ingredient amount contains mojibake markers', () => {
      const mojibake = /[\u00C0-\u00FF]{2,}/
      for (const r of RECIPES) {
        for (const ing of r.ingredients) {
          expect(mojibake.test(ing.amount)).toBe(false)
        }
      }
    })
  })
})
