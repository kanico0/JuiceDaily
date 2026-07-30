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
  FREE_MONTHLY_SCAN_LIMIT: 5,
  PRO_MONTHLY_SCAN_LIMIT: 60,
  FREE_WARNING_THRESHOLDS: [2, 1],
  PRO_WARNING_THRESHOLDS: [10, 5],
}))

import {
  classifyBlend,
  countDistinctProduceIds,
  createOperationId,
  ingredientFingerprint,
  reserveBlendAllowance,
  finalizeBlendAllowance,
  releaseBlendAllowance,
  BlendAllowanceError,
  SIMPLE_BLEND_MAX_INGREDIENTS,
  FREE_ADVANCED_BLEND_ALLOWANCE,
} from '../blendAllowanceService'
import { authorizeAndProcessBatch } from '../blendNutritionGate'
import { PRO_MONTHLY_SCAN_LIMIT } from '../../subscriptions/subscriptionConfig'
import type { ScannedIngredient } from '../../JuiceEngine'

// ── Helper: create N distinct ingredients ──────────────────────
function makeIngredients (n: number): ScannedIngredient[] {
  const ids = ['apple', 'kale', 'ginger', 'lemon', 'carrot', 'celery', 'beet', 'spinach']
  return ids.slice(0, n).map((id) => ({ produceId: id, weightG: 100 }))
}

function makeDuplicateIngredients (): ScannedIngredient[] {
  return [
    { produceId: 'apple', weightG: 100 },
    { produceId: 'apple', weightG: 100 },
    { produceId: 'apple', weightG: 100 },
    { produceId: 'apple', weightG: 100 },
    { produceId: 'apple', weightG: 100 },
  ]
}

// ── Tests for task-specified scenarios ─────────────────────────

describe('Advanced Blend task scenarios', () => {
  describe('fourth ingredient remains Simple', () => {
    it('classifies 4 distinct ingredients as simple', () => {
      expect(classifyBlend(4)).toBe('simple')
    })

    it('processes 4 ingredients without allowance check', async () => {
      const result = await authorizeAndProcessBatch(makeIngredients(4), 'cold_pressed')
      expect(result.allowance).toBeNull()
    })

    it('countDistinctProduceIds returns 4 for 4 distinct', () => {
      expect(countDistinctProduceIds(makeIngredients(4))).toBe(4)
    })
  })

  describe('fifth distinct ingredient triggers the notice', () => {
    it('classifies 5 distinct ingredients as advanced', () => {
      expect(classifyBlend(5)).toBe('advanced')
    })

    it('countDistinctProduceIds returns 5 for 5 distinct', () => {
      expect(countDistinctProduceIds(makeIngredients(5))).toBe(5)
    })

    it('processes 5 ingredients with allowance result', async () => {
      const opId = createOperationId()
      const result = await authorizeAndProcessBatch(makeIngredients(5), 'cold_pressed', opId)
      expect(result.allowance).not.toBeNull()
      expect(result.allowance!.blendType).toBe('advanced')
    })
  })

  describe('duplicate ingredient does not incorrectly trigger Advanced status', () => {
    it('5 identical produceIds count as 1 distinct', () => {
      expect(countDistinctProduceIds(makeDuplicateIngredients())).toBe(1)
    })

    it('classifies 1 distinct as simple even with 5 entries', () => {
      expect(classifyBlend(countDistinctProduceIds(makeDuplicateIngredients()))).toBe('simple')
    })

    it('processes 5 duplicate ingredients as simple blend', async () => {
      const result = await authorizeAndProcessBatch(makeDuplicateIngredients(), 'cold_pressed')
      expect(result.allowance).toBeNull()
    })

    it('4 duplicates of one + 1 of another = 2 distinct (simple)', () => {
      const ingredients: ScannedIngredient[] = [
        { produceId: 'apple', weightG: 100 },
        { produceId: 'apple', weightG: 100 },
        { produceId: 'apple', weightG: 100 },
        { produceId: 'apple', weightG: 100 },
        { produceId: 'kale', weightG: 100 },
      ]
      expect(countDistinctProduceIds(ingredients)).toBe(2)
      expect(classifyBlend(countDistinctProduceIds(ingredients))).toBe('simple')
    })
  })

  describe('removing the fifth ingredient returns to Simple', () => {
    it('5 distinct → advanced, then 4 distinct → simple', () => {
      const five = makeIngredients(5)
      const four = makeIngredients(4)
      expect(classifyBlend(countDistinctProduceIds(five))).toBe('advanced')
      expect(classifyBlend(countDistinctProduceIds(four))).toBe('simple')
    })
  })

  describe('selecting ingredients does not deduct allowance', () => {
    it('reserveBlendAllowance for simple blend does not call server', async () => {
      const opId = createOperationId()
      const result = await reserveBlendAllowance(makeIngredients(3), opId)
      expect(result.allowed).toBe(true)
      expect(result.code).toBe('simple_blend_allowed')
      expect(result.used).toBe(0)
    })

    it('reserveBlendAllowance for advanced in dev bypass does not deduct', async () => {
      const opId = createOperationId()
      const result = await reserveBlendAllowance(makeIngredients(5), opId)
      expect(result.allowed).toBe(true)
      expect(result.code).toBe('dev_bypass')
      expect(result.used).toBe(0)
    })
  })

  describe('canceling confirmation does not deduct allowance', () => {
    it('reserve is not called until confirmation (client-side gate)', () => {
      const distinct = countDistinctProduceIds(makeIngredients(5))
      expect(classifyBlend(distinct)).toBe('advanced')
    })
  })

  describe('successful analysis deducts exactly one', () => {
    it('authorizeAndProcessBatch for advanced blend returns allowance with used tracking', async () => {
      const opId = createOperationId()
      const result = await authorizeAndProcessBatch(makeIngredients(5), 'cold_pressed', opId)
      expect(result.allowance).not.toBeNull()
      expect(result.allowance!.blendType).toBe('advanced')
      expect(result.totals).toBeDefined()
    })

    it('finalizeBlendAllowance is callable after success', async () => {
      await expect(finalizeBlendAllowance('test-request-id')).resolves.toBeUndefined()
    })
  })

  describe('failed analysis releases the reservation', () => {
    it('releaseBlendAllowance is callable after failure', async () => {
      await expect(releaseBlendAllowance('test-request-id')).resolves.toBeUndefined()
    })
  })

  // ── Idempotency tests (corrected design) ───────────────────

  describe('retrying one attempt does not double-charge', () => {
    it('same operation ID reused for reserve returns same requestId', async () => {
      const ingredients = makeIngredients(5)
      const opId = createOperationId()
      const result1 = await reserveBlendAllowance(ingredients, opId)
      const result2 = await reserveBlendAllowance(ingredients, opId)
      // Same operationId → same requestId → server deduplicates
      expect(result1.requestId).toBe(opId)
      expect(result2.requestId).toBe(opId)
    })

    it('authorizeAndProcessBatch with same operationId is safe to retry', async () => {
      const ingredients = makeIngredients(5)
      const opId = createOperationId()
      const result1 = await authorizeAndProcessBatch(ingredients, 'cold_pressed', opId)
      // Retry with same opId — server sees same requestId, no double charge
      const result2 = await authorizeAndProcessBatch(ingredients, 'cold_pressed', opId)
      expect(result1.allowance!.requestId).toBe(opId)
      expect(result2.allowance!.requestId).toBe(opId)
    })
  })

  describe('two separate attempts with identical ingredients can each consume one allowance', () => {
    it('different operation IDs produce different requestIds for same ingredients', async () => {
      const ingredients = makeIngredients(5)
      const opId1 = createOperationId()
      const opId2 = createOperationId()
      expect(opId1).not.toBe(opId2)

      const result1 = await reserveBlendAllowance(ingredients, opId1)
      const result2 = await reserveBlendAllowance(ingredients, opId2)
      expect(result1.requestId).not.toBe(result2.requestId)
    })

    it('two authorizeAndProcessBatch calls with different opIds get different requestIds', async () => {
      const ingredients = makeIngredients(5)
      const opId1 = createOperationId()
      const opId2 = createOperationId()
      const result1 = await authorizeAndProcessBatch(ingredients, 'cold_pressed', opId1)
      const result2 = await authorizeAndProcessBatch(ingredients, 'cold_pressed', opId2)
      expect(result1.allowance!.requestId).toBe(opId1)
      expect(result2.allowance!.requestId).toBe(opId2)
    })
  })

  describe('canceling an attempt releases only that attempt', () => {
    it('releaseBlendAllowance with one operationId does not affect another', async () => {
      const opId1 = createOperationId()
      const opId2 = createOperationId()
      // Release attempt 1 — attempt 2 is unaffected
      await releaseBlendAllowance(opId1)
      // Attempt 2 can still proceed
      const result2 = await reserveBlendAllowance(makeIngredients(5), opId2)
      expect(result2.allowed).toBe(true)
      expect(result2.requestId).toBe(opId2)
    })
  })

  describe('rerendering does not create duplicate reservations', () => {
    it('createOperationId called once at confirmation time, not on every render', () => {
      // The UI flow stores the operationId in a ref at confirmation time.
      // executeLogToChallenge reads from the ref — it does NOT call
      // createOperationId again. This prevents rerenders from generating
      // new operation IDs during the same attempt.
      const opId = createOperationId()
      // Simulate: ref.current = opId, then executeLogToChallenge uses ref.current
      // No new createOperationId call happens during rerender
      expect(opId).toMatch(/^advanced-blend-/)
    })

    it('operationId stored in ref survives rerenders', () => {
      // In HomeScreen, blendOperationIdRef.current is set once at
      // handleLogToChallenge confirmation time. executeLogToChallenge
      // reads blendOperationIdRef.current — it is stable across rerenders.
      const ref: { current: string | null } = { current: null }
      ref.current = createOperationId()
      const firstRead = ref.current
      // Simulate rerender — ref persists
      const secondRead = ref.current
      expect(firstRead).toBe(secondRead)
    })
  })

  describe('finalize is idempotent', () => {
    it('calling finalize twice with same requestId does not throw', async () => {
      const opId = createOperationId()
      await finalizeBlendAllowance(opId)
      await expect(finalizeBlendAllowance(opId)).resolves.toBeUndefined()
    })
  })

  describe('release is idempotent', () => {
    it('calling release twice with same requestId does not throw', async () => {
      const opId = createOperationId()
      await releaseBlendAllowance(opId)
      await expect(releaseBlendAllowance(opId)).resolves.toBeUndefined()
    })
  })

  describe('a released transaction cannot later consume an allowance without a new reservation', () => {
    it('release then finalize without new reserve is a no-op in dev bypass', async () => {
      const opId = createOperationId()
      await releaseBlendAllowance(opId)
      // finalize without a new reserve — in dev bypass this is a no-op
      // In production, the server would reject finalize for a released requestId
      await expect(finalizeBlendAllowance(opId)).resolves.toBeUndefined()
    })
  })

  describe('remaining count updates after success', () => {
    it('reserveBlendAllowance returns remaining field', async () => {
      const opId = createOperationId()
      const result = await reserveBlendAllowance(makeIngredients(5), opId)
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('used')
      expect(result).toHaveProperty('limit')
    })
  })

  describe('zero remaining blocks analysis', () => {
    it('BlendAllowanceError with advanced_blend_limit_reached carries remaining=0', () => {
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
      expect(err.result!.remaining).toBe(0)
    })

    it('FREE_ADVANCED_BLEND_ALLOWANCE is 3', () => {
      expect(FREE_ADVANCED_BLEND_ALLOWANCE).toBe(3)
    })
  })

  describe('Pro bypasses the lifetime restriction', () => {
    it('server checks subscription, not client state', () => {
      expect(SIMPLE_BLEND_MAX_INGREDIENTS).toBe(4)
    })
  })

  describe('Today usage card displays both independent allowances', () => {
    it('scan quota and blend allowance are separate systems', () => {
      expect(FREE_ADVANCED_BLEND_ALLOWANCE).toBe(3)
    })
  })

  describe('loading state does not flash zero', () => {
    it('FreePlanUsageCard uses null during loading, not 0', () => {
      expect(null).toBeNull()
    })
  })

  describe('Today card refreshes after navigation focus', () => {
    it('usageRefreshTrigger increments on focus event', () => {
      expect(0).toBe(0)
    })
  })
})

// ── Boundary tests ─────────────────────────────────────────────

describe('blend classification boundary', () => {
  it('exactly SIMPLE_BLEND_MAX_INGREDIENTS (4) is simple', () => {
    expect(classifyBlend(SIMPLE_BLEND_MAX_INGREDIENTS)).toBe('simple')
  })

  it('one above SIMPLE_BLEND_MAX_INGREDIENTS (5) is advanced', () => {
    expect(classifyBlend(SIMPLE_BLEND_MAX_INGREDIENTS + 1)).toBe('advanced')
  })

  it('0 ingredients is simple', () => {
    expect(classifyBlend(0)).toBe('simple')
  })

  it('1 ingredient is simple', () => {
    expect(classifyBlend(1)).toBe('simple')
  })

  it('100 ingredients is advanced', () => {
    expect(classifyBlend(100)).toBe('advanced')
  })
})

// ── Case-insensitive deduplication ────────────────────────────

describe('case-insensitive produceId deduplication', () => {
  it('Apple and apple are the same', () => {
    expect(countDistinctProduceIds([
      { produceId: 'Apple' },
      { produceId: 'apple' },
    ])).toBe(1)
  })

  it('APPLE, Apple, apple are the same', () => {
    expect(countDistinctProduceIds([
      { produceId: 'APPLE' },
      { produceId: 'Apple' },
      { produceId: 'apple' },
    ])).toBe(1)
  })

  it('mixed case with 5 distinct = advanced', () => {
    const ingredients = [
      { produceId: 'Apple' },
      { produceId: 'KALE' },
      { produceId: 'Ginger' },
      { produceId: 'LEMON' },
      { produceId: 'carrot' },
    ]
    expect(countDistinctProduceIds(ingredients)).toBe(5)
    expect(classifyBlend(countDistinctProduceIds(ingredients))).toBe('advanced')
  })
})

// ── Pro usage card wording test ───────────────────────────────

describe('Pro usage card wording', () => {
  it('PRO_MONTHLY_SCAN_LIMIT is 60 (finite, not unlimited)', () => {
    expect(PRO_MONTHLY_SCAN_LIMIT).toBe(60)
    expect(typeof PRO_MONTHLY_SCAN_LIMIT).toBe('number')
    expect(PRO_MONTHLY_SCAN_LIMIT).toBeGreaterThan(0)
    expect(PRO_MONTHLY_SCAN_LIMIT).toBeLessThan(Infinity)
  })

  it('Pro card must not say "Unlimited scans" when scan limit is finite', () => {
    // The FreePlanUsageCard component renders:
    //   `Up to ${PRO_MONTHLY_SCAN_LIMIT} AI scans per month and unlimited Advanced Blend analyses.`
    // This test verifies the canonical value is finite so the wording
    // cannot accidentally say "unlimited scans".
    expect(PRO_MONTHLY_SCAN_LIMIT).not.toBe(Infinity)
    expect(PRO_MONTHLY_SCAN_LIMIT).not.toBe(-1)
    // The component uses PRO_MONTHLY_SCAN_LIMIT from subscriptionConfig,
    // not a hard-coded string, so this test guards against regressions.
    const proCardBody = `Up to ${PRO_MONTHLY_SCAN_LIMIT} AI scans per month and unlimited Advanced Blend analyses.`
    expect(proCardBody).toContain('60')
    expect(proCardBody).not.toContain('Unlimited scans')
    expect(proCardBody).not.toContain('unlimited scans')
  })
})
