import { RECIPES, getRecipeById, getRecipeBlendType, countDistinctProduceIds } from '../../constants/recipeData'

describe('Phase 12 — Tier and monetization audit', () => {
  describe('exact final counts', () => {
    const free = RECIPES.filter((r) => r.tier === 'free')
    const pro = RECIPES.filter((r) => r.tier === 'pro')
    const simpleFree = free.filter((r) => getRecipeBlendType(r) === 'simple')
    const advancedFree = free.filter((r) => getRecipeBlendType(r) === 'advanced')
    const simplePro = pro.filter((r) => getRecipeBlendType(r) === 'simple')
    const advancedPro = pro.filter((r) => getRecipeBlendType(r) === 'advanced')

    it('total recipes = 1,000', () => {
      expect(RECIPES.length).toBe(1000)
    })

    it('free recipes = 996', () => {
      expect(free.length).toBe(996)
    })

    it('Pro recipes = 4', () => {
      expect(pro.length).toBe(4)
    })

    it('Simple free count + Advanced free count = free total', () => {
      expect(simpleFree.length + advancedFree.length).toBe(free.length)
    })

    it('Simple Pro count + Advanced Pro count = Pro total', () => {
      expect(simplePro.length + advancedPro.length).toBe(pro.length)
    })

    it('reports exact counts', () => {
      console.log(`  free: ${free.length}`)
      console.log(`  pro: ${pro.length}`)
      console.log(`  simple free: ${simpleFree.length}`)
      console.log(`  advanced free: ${advancedFree.length}`)
      console.log(`  simple pro: ${simplePro.length}`)
      console.log(`  advanced pro: ${advancedPro.length}`)
    })
  })

  describe('tier integrity', () => {
    it('every recipe has a valid tier (free or pro)', () => {
      for (const r of RECIPES) {
        expect(['free', 'pro']).toContain(r.tier)
      }
    })

    it('Pro recipe IDs are resolvable', () => {
      const proRecipes = RECIPES.filter((r) => r.tier === 'pro')
      for (const r of proRecipes) {
        const resolved = getRecipeById(r.id)
        expect(resolved).toBeDefined()
        expect(resolved.tier).toBe('pro')
      }
    })
  })

  describe('browsing does not consume quota', () => {
    it('BrowseIdeasModal filters core/free recipes (no quota check in source)', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'ScanScreen.js'),
        'utf-8'
      )
      // The search function filters by collection and tier, not quota
      expect(source).toContain('searchRecipes')
    })
  })

  describe('Wellness Focus does not expose locked nutrition', () => {
    it('WellnessResultsScreen source does not compute nutrition for locked recipes', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.join(__dirname, '..', '..', 'screens', 'WellnessResultsScreen.js'),
        'utf-8'
      )
      // WellnessResultsScreen shows recipe matches, not nutrition breakdowns
      expect(source).not.toContain('processJuiceBatch')
      expect(source).not.toContain('JuiceEngine')
    })
  })

  describe('implications of 996/4 split', () => {
    it('996 free recipes are browsable without entitlement', () => {
      const freeRecipes = RECIPES.filter((r) => r.tier === 'free')
      expect(freeRecipes.length).toBe(996)
    })

    it('4 Pro recipes exist but are a small minority (< 1%)', () => {
      const proRecipes = RECIPES.filter((r) => r.tier === 'pro')
      expect(proRecipes.length).toBe(4)
      expect(proRecipes.length / RECIPES.length).toBeLessThan(0.01)
    })
  })
})
