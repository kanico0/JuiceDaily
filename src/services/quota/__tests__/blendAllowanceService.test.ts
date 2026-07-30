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

import {
  classifyBlend,
  countDistinctProduceIds,
  buildRequestId,
  reserveBlendAllowance,
  finalizeBlendAllowance,
  releaseBlendAllowance,
  BlendAllowanceError,
  SIMPLE_BLEND_MAX_INGREDIENTS,
  FREE_ADVANCED_BLEND_ALLOWANCE,
} from '../blendAllowanceService'

describe('classifyBlend', () => {
  it('classifies 1 ingredient as simple', () => {
    expect(classifyBlend(1)).toBe('simple')
  })

  it('classifies 4 ingredients as simple', () => {
    expect(classifyBlend(4)).toBe('simple')
  })

  it('classifies 5 ingredients as advanced', () => {
    expect(classifyBlend(5)).toBe('advanced')
  })

  it('classifies 10 ingredients as advanced', () => {
    expect(classifyBlend(10)).toBe('advanced')
  })

  it('classifies 0 ingredients as simple', () => {
    expect(classifyBlend(0)).toBe('simple')
  })
})

describe('countDistinctProduceIds', () => {
  it('counts distinct produce IDs', () => {
    const ingredients = [
      { produceId: 'apple' },
      { produceId: 'kale' },
      { produceId: 'ginger' },
    ]
    expect(countDistinctProduceIds(ingredients)).toBe(3)
  })

  it('deduplicates case-insensitive', () => {
    const ingredients = [
      { produceId: 'Apple' },
      { produceId: 'apple' },
      { produceId: 'APPLE' },
    ]
    expect(countDistinctProduceIds(ingredients)).toBe(1)
  })

  it('handles empty array', () => {
    expect(countDistinctProduceIds([])).toBe(0)
  })

  it('filters empty and non-string produceIds', () => {
    const ingredients = [
      { produceId: 'apple' },
      { produceId: '' },
      { produceId: null as unknown as string },
      { produceId: 'kale' },
    ]
    expect(countDistinctProduceIds(ingredients)).toBe(2)
  })

  it('handles mixed valid and invalid entries', () => {
    const ingredients = [
      { produceId: 'carrot' },
      { produceId: 'spinach' },
      { produceId: undefined as unknown as string },
      { produceId: 'Carrot' },
    ]
    expect(countDistinctProduceIds(ingredients)).toBe(2)
  })
})

describe('constants', () => {
  it('SIMPLE_BLEND_MAX_INGREDIENTS is 4', () => {
    expect(SIMPLE_BLEND_MAX_INGREDIENTS).toBe(4)
  })

  it('FREE_ADVANCED_BLEND_ALLOWANCE is 3', () => {
    expect(FREE_ADVANCED_BLEND_ALLOWANCE).toBe(3)
  })
})

describe('blend classification boundary', () => {
  it('boundary: exactly at SIMPLE_BLEND_MAX_INGREDIENTS is simple', () => {
    expect(classifyBlend(SIMPLE_BLEND_MAX_INGREDIENTS)).toBe('simple')
  })

  it('boundary: one above SIMPLE_BLEND_MAX_INGREDIENTS is advanced', () => {
    expect(classifyBlend(SIMPLE_BLEND_MAX_INGREDIENTS + 1)).toBe('advanced')
  })
})

describe('buildRequestId', () => {
  it('produces deterministic ID from same ingredients', () => {
    const ingredients = [
      { produceId: 'apple' },
      { produceId: 'kale' },
      { produceId: 'ginger' },
    ]
    const id1 = buildRequestId(ingredients)
    const id2 = buildRequestId(ingredients)
    expect(id1).toBe(id2)
  })

  it('produces same ID regardless of order', () => {
    const set1 = [
      { produceId: 'apple' },
      { produceId: 'kale' },
    ]
    const set2 = [
      { produceId: 'kale' },
      { produceId: 'apple' },
    ]
    expect(buildRequestId(set1)).toBe(buildRequestId(set2))
  })

  it('produces different IDs for different ingredients', () => {
    const set1 = [{ produceId: 'apple' }]
    const set2 = [{ produceId: 'kale' }]
    expect(buildRequestId(set1)).not.toBe(buildRequestId(set2))
  })

  it('deduplicates and lowercases', () => {
    const set1 = [{ produceId: 'Apple' }, { produceId: 'apple' }]
    const set2 = [{ produceId: 'apple' }]
    expect(buildRequestId(set1)).toBe(buildRequestId(set2))
  })

  it('filters out invalid produceIds', () => {
    const set1 = [
      { produceId: 'apple' },
      { produceId: '' },
      { produceId: null as unknown as string },
    ]
    const set2 = [{ produceId: 'apple' }]
    expect(buildRequestId(set1)).toBe(buildRequestId(set2))
  })
})

describe('reserveBlendAllowance', () => {
  describe('simple blend (1-4 ingredients)', () => {
    it('allows without server call', async () => {
      const ingredients = [
        { produceId: 'apple' },
        { produceId: 'kale' },
      ]
      const result = await reserveBlendAllowance(ingredients)
      expect(result.allowed).toBe(true)
      expect(result.code).toBe('simple_blend_allowed')
      expect(result.blendType).toBe('simple')
    })
  })

  describe('advanced blend in dev bypass (SUPABASE_CONFIGURED=false, __DEV__=true)', () => {
    it('allows with dev_bypass code', async () => {
      const ingredients = [
        { produceId: 'apple' },
        { produceId: 'kale' },
        { produceId: 'ginger' },
        { produceId: 'lemon' },
        { produceId: 'carrot' },
      ]
      const result = await reserveBlendAllowance(ingredients)
      expect(result.allowed).toBe(true)
      expect(result.code).toBe('dev_bypass')
      expect(result.blendType).toBe('advanced')
    })
  })
})

describe('finalizeBlendAllowance', () => {
  it('is a no-op in dev bypass', async () => {
    await expect(finalizeBlendAllowance('test-req-id')).resolves.toBeUndefined()
  })
})

describe('releaseBlendAllowance', () => {
  it('is a no-op in dev bypass', async () => {
    await expect(releaseBlendAllowance('test-req-id')).resolves.toBeUndefined()
  })
})

describe('BlendAllowanceError', () => {
  it('stores code and result', () => {
    const result = {
      allowed: false,
      code: 'advanced_blend_limit_reached',
      remaining: 0,
      used: 3,
      reserved: 0,
      limit: 3,
      plan: 'free' as const,
      blendType: 'advanced' as const,
      requestId: 'test',
    }
    const err = new BlendAllowanceError('advanced_blend_limit_reached', 'Limit reached', result)
    expect(err.code).toBe('advanced_blend_limit_reached')
    expect(err.message).toBe('Limit reached')
    expect(err.result).toBe(result)
    expect(err.name).toBe('BlendAllowanceError')
  })

  it('works without result', () => {
    const err = new BlendAllowanceError('server_error', 'Server down')
    expect(err.code).toBe('server_error')
    expect(err.result).toBeNull()
  })
})
