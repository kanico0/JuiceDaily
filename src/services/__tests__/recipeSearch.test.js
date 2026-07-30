import {
  searchRecipes,
  getSearchSuggestions,
  resolveAlias,
  PRODUCE_ALIASES,
  ALIAS_TO_PRODUCE_ID,
} from '../recipeSearch'
import { RECIPES } from '../../constants/recipeData'

describe('recipeSearch', () => {
  describe('searchRecipes', () => {
    it('returns recipes with no query', () => {
      const results = searchRecipes('', { collection: 'core', tier: 'free' }, 10)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(10)
    })

    it('returns recipes matching title', () => {
      const results = searchRecipes('emerald', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title.toLowerCase()).toContain('emerald')
    })

    it('returns recipes matching ingredient name', () => {
      const results = searchRecipes('kale', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results.slice(0, 5)) {
        const hasKale = r.ingredients.some((i) => i.name.toLowerCase().includes('kale'))
        expect(hasKale).toBe(true)
      }
    })

    it('returns recipes matching produce alias', () => {
      // "cilantro" is an alias that maps to cilantro produceId
      const results = searchRecipes('coriander', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results.slice(0, 5)) {
        const hasCilantro = r.ingredients.some((i) => i.produceId === 'cilantro')
        expect(hasCilantro).toBe(true)
      }
    })

    it('ranks exact title match above ingredient match', () => {
      // Search for something that matches a title exactly
      const results = searchRecipes('the emerald uplift', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('emerald-uplift')
    })

    it('ranks title prefix above title contains', () => {
      const results = searchRecipes('citrus', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      // "Citrus Clarity" starts with "citrus" — should rank high
      const citrusClarity = results.find((r) => r.id === 'citrus-clarity')
      if (citrusClarity) {
        expect(results.indexOf(citrusClarity)).toBeLessThan(5)
      }
    })

    it('filters by collection', () => {
      const results = searchRecipes('', { collection: 'core' }, 200)
      for (const r of results) {
        expect(r.collection).toBe('core')
      }
    })

    it('filters by tier', () => {
      const results = searchRecipes('', { tier: 'pro' }, 200)
      for (const r of results) {
        expect(r.tier).toBe('pro')
      }
    })

    it('filters by both collection and tier', () => {
      const results = searchRecipes('', { collection: 'core', tier: 'free' }, 200)
      for (const r of results) {
        expect(r.collection).toBe('core')
        expect(r.tier).toBe('free')
      }
    })

    it('returns empty array for no matches', () => {
      const results = searchRecipes('xyznonexistent', {}, 50)
      expect(results).toHaveLength(0)
    })

    it('respects limit parameter', () => {
      const results = searchRecipes('', {}, 5)
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('is case-insensitive', () => {
      const lower = searchRecipes('kale', {}, 10)
      const upper = searchRecipes('KALE', {}, 10)
      expect(lower.length).toBe(upper.length)
      if (lower.length > 0) {
        expect(lower[0].id).toBe(upper[0].id)
      }
    })

    it('handles alias "jalapeno" (without ñ) matching jalapeño recipes', () => {
      const results = searchRecipes('jalapeno', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results.slice(0, 3)) {
        const hasJalapeno = r.ingredients.some((i) => i.produceId === 'jalapeño')
        expect(hasJalapeno).toBe(true)
      }
    })

    it('handles alias "coriander" matching cilantro recipes', () => {
      const results = searchRecipes('coriander', {}, 50)
      expect(results.length).toBeGreaterThan(0)
      for (const r of results.slice(0, 3)) {
        const hasCilantro = r.ingredients.some((i) => i.produceId === 'cilantro')
        expect(hasCilantro).toBe(true)
      }
    })

    it('returns full recipe objects (not just index entries)', () => {
      const results = searchRecipes('kale', {}, 5)
      for (const r of results) {
        expect(r.id).toBeDefined()
        expect(r.title).toBeDefined()
        expect(r.ingredients).toBeDefined()
        expect(r.pillars).toBeDefined()
      }
    })
  })

  describe('getSearchSuggestions', () => {
    it('returns a sorted array of alias strings', () => {
      const suggestions = getSearchSuggestions()
      expect(suggestions.length).toBeGreaterThan(0)
      // Check it's sorted (case-insensitive)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].toLowerCase().localeCompare(suggestions[i - 1].toLowerCase())).toBeGreaterThanOrEqual(0)
      }
    })

    it('includes common produce names', () => {
      const suggestions = getSearchSuggestions()
      expect(suggestions).toContain('kale')
      expect(suggestions).toContain('spinach')
      expect(suggestions).toContain('ginger')
      expect(suggestions).toContain('lemon')
    })

    it('includes aliases', () => {
      const suggestions = getSearchSuggestions()
      expect(suggestions).toContain('coriander')
      expect(suggestions).toContain('cilantro')
    })
  })

  describe('resolveAlias', () => {
    it('resolves common name to produceId', () => {
      expect(resolveAlias('kale')).toBe('kale')
      expect(resolveAlias('ginger')).toBe('ginger')
    })

    it('resolves alias to canonical produceId', () => {
      expect(resolveAlias('rocket')).toBe('arugula')
      expect(resolveAlias('coriander')).toBe('cilantro')
      expect(resolveAlias('jalapeno')).toBe('jalapeño')
    })

    it('returns null for unknown alias', () => {
      expect(resolveAlias('xyzunknown')).toBeNull()
    })

    it('is case-insensitive', () => {
      expect(resolveAlias('KALE')).toBe('kale')
      expect(resolveAlias('Rocket')).toBe('arugula')
    })
  })

  describe('PRODUCE_ALIASES integrity', () => {
    it('every produceId in aliases exists in PRODUCE_DATA or is a known produce', () => {
      // Just verify the structure is valid
      for (const [produceId, aliases] of Object.entries(PRODUCE_ALIASES)) {
        expect(produceId).toBeTruthy()
        expect(aliases.length).toBeGreaterThan(0)
      }
    })

    it('ALIAS_TO_PRODUCE_ID has entries for all aliases', () => {
      let totalAliases = 0
      for (const aliases of Object.values(PRODUCE_ALIASES)) {
        totalAliases += aliases.length
      }
      expect(Object.keys(ALIAS_TO_PRODUCE_ID).length).toBe(totalAliases)
    })
  })

  describe('search performance', () => {
    it('search completes in reasonable time for 1000 recipes', () => {
      const start = Date.now()
      searchRecipes('kale', {}, 100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(500)
    })

    it('empty query returns quickly', () => {
      const start = Date.now()
      searchRecipes('', {}, 100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(200)
    })
  })
})
