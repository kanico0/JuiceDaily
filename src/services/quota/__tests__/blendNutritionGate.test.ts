// Mock supabase modules that pull in AsyncStorage (native module)
jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => false),
  getSupabase: jest.fn(() => null),
}))
jest.mock('../../supabase/identity', () => ({
  ensureUser: jest.fn(),
  getAccessToken: jest.fn(),
  getUserId: jest.fn(),
}))
jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: null,
  SUPABASE_ANON_KEY: null,
  SUPABASE_CONFIGURED: false,
  MONETIZATION_ENABLED: false,
}))
import { authorizeAndProcessBatch } from '../blendNutritionGate'
import { createOperationId } from '../blendAllowanceService'
import { processJuiceBatch, type ScannedIngredient } from '../../JuiceEngine'

describe('authorizeAndProcessBatch', () => {
  describe('simple blends (1-4 ingredients)', () => {
    it('processes directly without server call', async () => {
      const ingredients: ScannedIngredient[] = [
        { produceId: 'apple', weightG: 150 },
        { produceId: 'kale', weightG: 50 },
      ]
      const result = await authorizeAndProcessBatch(ingredients, 'cold_pressed')
      expect(result.allowance).toBeNull()
      expect(result.totals).toBeDefined()
      expect(result.ingredients).toHaveLength(2)
    })

    it('returns nutrition totals for simple blend', async () => {
      const ingredients: ScannedIngredient[] = [
        { produceId: 'apple', weightG: 150 },
        { produceId: 'kale', weightG: 50 },
        { produceId: 'ginger', weightG: 10 },
      ]
      const result = await authorizeAndProcessBatch(ingredients, 'cold_pressed')
      expect(result.totals.calories).toBeGreaterThan(0)
    })
  })

  describe('advanced blends (5+ ingredients) in dev bypass', () => {
    const advancedIngredients: ScannedIngredient[] = [
      { produceId: 'apple', weightG: 150 },
      { produceId: 'kale', weightG: 50 },
      { produceId: 'ginger', weightG: 10 },
      { produceId: 'lemon', weightG: 30 },
      { produceId: 'carrot', weightG: 100 },
    ]

    it('processes with allowance result in dev bypass', async () => {
      const opId = createOperationId()
      const result = await authorizeAndProcessBatch(advancedIngredients, 'cold_pressed', opId)
      expect(result.allowance).not.toBeNull()
      expect(result.allowance!.allowed).toBe(true)
      expect(result.allowance!.code).toBe('dev_bypass')
      expect(result.totals).toBeDefined()
      expect(result.ingredients).toHaveLength(5)
    })

    it('returns nutrition totals for advanced blend', async () => {
      const opId = createOperationId()
      const result = await authorizeAndProcessBatch(advancedIngredients, 'cold_pressed', opId)
      expect(result.totals.calories).toBeGreaterThan(0)
    })
  })

  describe('empty ingredients', () => {
    it('returns empty result with no allowance', async () => {
      const result = await authorizeAndProcessBatch([], 'cold_pressed')
      expect(result.allowance).toBeNull()
      expect(result.ingredients).toHaveLength(0)
      expect(result.totals.calories).toBe(0)
    })
  })
})
