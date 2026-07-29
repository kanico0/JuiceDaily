// Regression tests: verify Wellness Focus feature does not consume
// Advanced Blend allowance, scan quota, or expose locked nutrition.
// Also verifies privacy: no analytics, no Supabase writes, no unauthorized
// AsyncStorage keys.

jest.mock('../../services/quota/blendAllowanceService', () => ({
  classifyBlend: jest.fn((n) => (n >= 5 ? 'advanced' : 'simple')),
  countDistinctProduceIds: jest.fn((ings: any[]) => new Set(ings.map((i: any) => i.produceId?.toLowerCase()).filter(Boolean)).size),
  reserveBlendAllowance: jest.fn(async () => ({ allowed: true, code: 'mock', remaining: 3, used: 0, reserved: 0, limit: 3, plan: 'free', blendType: 'simple', requestId: 'mock' })),
  finalizeBlendAllowance: jest.fn(async () => {}),
  releaseBlendAllowance: jest.fn(async () => {}),
  BlendAllowanceError: class BlendAllowanceError extends Error {},
  SIMPLE_BLEND_MAX_INGREDIENTS: 4,
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
}), { virtual: true })

jest.mock('../../services/AnalyticsService', () => ({
  trackEvent: jest.fn(),
}))

jest.mock('../../services/quota/QuotaStore', () => ({
  useQuota: () => ({ remaining: 10, limit: 10, plan: 'free' }),
}), { virtual: true })

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key) => {
    if (key === '@wellness_disclaimer_accepted') return 'true'
    return null
  }),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}))

import {
  rankRecipesForFocusArea,
  getCachedRanking,
  clearWellnessCache,
  PROD_MIN_RATIO,
  PROD_MAX_RESULTS,
} from '../wellnessFocusMatcher'
import { WELLNESS_FOCUS_AREAS } from '../../constants/wellnessFocusDirectory'
import { RECIPES } from '../../constants/recipeData'
import { trackEvent } from '../../services/AnalyticsService'
// @ts-ignore - module is virtually mocked; does not exist on this branch
import { reserveBlendAllowance } from '../../services/quota/blendAllowanceService'

describe('Wellness Focus — Advanced Blend non-consumption', () => {
  beforeEach(() => {
    clearWellnessCache()
    jest.clearAllMocks()
  })

  it('rankRecipesForFocusArea does not call reserveBlendAllowance', () => {
    rankRecipesForFocusArea('immune_support', 1, PROD_MIN_RATIO)
    expect(reserveBlendAllowance).not.toHaveBeenCalled()
  })

  it('getCachedRanking does not call reserveBlendAllowance', () => {
    getCachedRanking('immune_support')
    expect(reserveBlendAllowance).not.toHaveBeenCalled()
  })

  it('viewing a recipe with 5+ ingredients does not consume blend allowance', () => {
    const results = rankRecipesForFocusArea('immune_support', 1, 0)
    const advancedRecipes = results.filter((r) => r.ingredientCount >= 5)
    expect(advancedRecipes.length).toBeGreaterThan(0)
    expect(reserveBlendAllowance).not.toHaveBeenCalled()
  })

  it('wellness screens do not import or call authorizeAndProcessBatch', () => {
    const matcherSource = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'wellnessFocusMatcher.ts'),
      'utf-8'
    )
    expect(matcherSource).not.toContain('authorizeAndProcessBatch')
    expect(matcherSource).not.toContain('reserveBlendAllowance')
    expect(matcherSource).not.toContain('processJuiceBatch')
  })
})

describe('Wellness Focus — Privacy verification', () => {
  beforeEach(() => {
    clearWellnessCache()
    jest.clearAllMocks()
  })

  it('rankRecipesForFocusArea does not call trackEvent', () => {
    rankRecipesForFocusArea('immune_support')
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('getCachedRanking does not call trackEvent', () => {
    getCachedRanking('immune_support')
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('wellnessFocusMatcher source has no analytics imports', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'wellnessFocusMatcher.ts'),
      'utf-8'
    )
    expect(source).not.toContain('trackEvent')
    expect(source).not.toContain('AnalyticsService')
    expect(source).not.toContain('supabase')
  })

  it('wellnessFocusDirectory source has no analytics or supabase imports', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'constants', 'wellnessFocusDirectory.ts'),
      'utf-8'
    )
    expect(source).not.toContain('trackEvent')
    expect(source).not.toContain('AnalyticsService')
    expect(source).not.toContain('supabase')
  })

  it('WellnessFocusScreen source has no analytics calls', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'screens', 'WellnessFocusScreen.js'),
      'utf-8'
    )
    expect(source).not.toContain('trackEvent')
    expect(source).not.toContain('AnalyticsService')
  })

  it('WellnessResultsScreen source has no analytics calls', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'screens', 'WellnessResultsScreen.js'),
      'utf-8'
    )
    expect(source).not.toContain('trackEvent')
    expect(source).not.toContain('AnalyticsService')
  })

  it('WellnessDisclaimer source has no analytics calls', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'components', 'WellnessDisclaimer.js'),
      'utf-8'
    )
    expect(source).not.toContain('trackEvent')
    expect(source).not.toContain('AnalyticsService')
  })

  it('the only AsyncStorage key is @wellness_disclaimer_accepted', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'components', 'WellnessDisclaimer.js'),
      'utf-8'
    )
    const matches = source.match(/@[\w_]+/g) || []
    const storageKeys = matches.filter((k: string) => k.startsWith('@') && !k.startsWith('@react'))
    expect(storageKeys).toEqual(['@wellness_disclaimer_accepted'])
  })
})

describe('Wellness Focus — No locked nutrition exposure', () => {
  it('RecipeMatch does not include nutrition totals or percentages', () => {
    const results = rankRecipesForFocusArea('immune_support', 1, 0)
    for (const r of results) {
      expect(r).not.toHaveProperty('totals')
      expect(r).not.toHaveProperty('nutrition')
      expect(r).not.toHaveProperty('nutritionLocked')
      expect(r).not.toHaveProperty('nutrientTotals')
      expect(r).not.toHaveProperty('vitaminC')
      expect(r).not.toHaveProperty('calories')
    }
  })

  it('matchedNutrients is a list of nutrient IDs, not values or percentages', () => {
    const results = rankRecipesForFocusArea('immune_support', 1, 0)
    for (const r of results) {
      for (const nid of r.matchedNutrients) {
        expect(typeof nid).toBe('string')
        expect(nid).not.toContain('%')
        expect(nid).not.toContain('mg')
        expect(nid).not.toContain('g')
      }
    }
  })
})
