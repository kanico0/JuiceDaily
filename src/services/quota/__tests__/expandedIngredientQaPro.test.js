// ─────────────────────────────────────────────────────────────
// expandedIngredientQaPro.test.js — Tests that QA Pro Simulation
// bypasses the client-side Free 3-lifetime install guard for
// Expanded Ingredient Analysis.
// ─────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

import { authorizeAndProcessBatch, BlendAllowanceError } from '../blendNutritionGate'
import { isDevBypass, reserveBlendAllowance, finalizeBlendAllowance, releaseBlendAllowance, fetchBlendAllowance } from '../blendAllowanceService'
import { checkInstallExpandedIngredientEligibility } from '../installExpandedIngredientGuard'

// Mock the blend allowance service
jest.mock('../blendAllowanceService', () => ({
  ...jest.requireActual('../blendAllowanceService'),
  isDevBypass: jest.fn(() => false),
  reserveBlendAllowance: jest.fn(),
  finalizeBlendAllowance: jest.fn(),
  releaseBlendAllowance: jest.fn(),
  fetchBlendAllowance: jest.fn(),
  classifyBlend: jest.fn((count) => count >= 5 ? 'advanced' : 'simple'),
  countDistinctProduceIds: jest.fn((items) => items.length),
  BlendAllowanceError: class BlendAllowanceError extends Error {
    constructor(code, message, result) {
      super(message)
      this.code = code
      this.result = result
    }
  },
  createOperationId: jest.fn(() => 'test-op-id'),
  getAdvancedBlendRemaining: jest.fn(() => null),
  fetchEffectiveBlendAllowance: jest.fn(),
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
  SIMPLE_BLEND_MAX_INGREDIENTS: 4,
}))

// Mock the install guard
jest.mock('../installExpandedIngredientGuard', () => ({
  ...jest.requireActual('../installExpandedIngredientGuard'),
  checkInstallExpandedIngredientEligibility: jest.fn(),
  selfHealInstallExpandedIngredient: jest.fn(),
  markInstallExpandedIngredientConsumed: jest.fn(),
}))

// Mock JuiceEngine
jest.mock('../../JuiceEngine', () => ({
  processJuiceBatch: jest.fn(() => ({
    totals: { calories: 100, sugar: 10, vitaminC: 50 },
    ingredients: [],
    totalJuiceWeightG: 200,
  })),
}))

// Mock device pool
jest.mock('../../devicePool/devicePoolConfig', () => ({
  isDevicePoolEnabled: jest.fn(() => false),
}))

jest.mock('../../devicePool/devicePromotionProviderFactory', () => ({
  getDevicePromotionProvider: jest.fn(),
}))

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn(),
}))

describe('Expanded Ingredient QA Pro bypass', () => {
  const mockIngredients = [
    { produceId: 'carrot', weightG: 100 },
    { produceId: 'spinach', weightG: 100 },
    { produceId: 'kale', weightG: 100 },
    { produceId: 'lemon', weightG: 30 },
    { produceId: 'ginger', weightG: 10 },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    isDevBypass.mockReturnValue(false)
    fetchBlendAllowance.mockResolvedValue({ plan: 'free', remaining: 0, used: 3 })
    reserveBlendAllowance.mockResolvedValue({
      allowed: true,
      requestId: 'test-req',
      plan: 'free',
      remaining: 0,
    })
    finalizeBlendAllowance.mockResolvedValue()
    releaseBlendAllowance.mockResolvedValue()
  })

  test('QA Pro ON (effectiveIsPro=true) skips install guard', async () => {
    checkInstallExpandedIngredientEligibility.mockResolvedValue({
      allowed: false,
      code: 'install_exhausted',
      effectiveRemaining: 0,
    })

    // With effectiveIsPro=true, the install guard should NOT be called
    const result = await authorizeAndProcessBatch(
      mockIngredients,
      'cold_pressed',
      'test-op-id',
      true, // effectiveIsPro = true (QA Pro Simulation)
    )

    expect(checkInstallExpandedIngredientEligibility).not.toHaveBeenCalled()
    expect(reserveBlendAllowance).toHaveBeenCalled()
    expect(result.totals).toBeDefined()
  })

  test('QA Pro OFF (effectiveIsPro=false) applies install guard', async () => {
    checkInstallExpandedIngredientEligibility.mockResolvedValue({
      allowed: false,
      code: 'install_exhausted',
      effectiveRemaining: 0,
    })

    // With effectiveIsPro=false, the install guard IS called and blocks
    await expect(
      authorizeAndProcessBatch(
        mockIngredients,
        'cold_pressed',
        'test-op-id',
        false, // effectiveIsPro = false
      ),
    ).rejects.toThrow()

    expect(checkInstallExpandedIngredientEligibility).toHaveBeenCalled()
    expect(reserveBlendAllowance).not.toHaveBeenCalled()
  })

  test('QA Pro OFF (undefined) applies install guard', async () => {
    checkInstallExpandedIngredientEligibility.mockResolvedValue({
      allowed: false,
      code: 'install_exhausted',
      effectiveRemaining: 0,
    })

    // Without effectiveIsPro parameter, the install guard IS called
    await expect(
      authorizeAndProcessBatch(
        mockIngredients,
        'cold_pressed',
        'test-op-id',
      ),
    ).rejects.toThrow()

    expect(checkInstallExpandedIngredientEligibility).toHaveBeenCalled()
  })

  test('QA Pro ON but server still rejects (reserve fails)', async () => {
    checkInstallExpandedIngredientEligibility.mockResolvedValue({
      allowed: true,
      code: 'ok',
      effectiveRemaining: 1,
    })

    reserveBlendAllowance.mockRejectedValue(
      new (require('../blendAllowanceService').BlendAllowanceError)(
        'advanced_blend_limit_reached',
        'Server quota reached',
        null,
      ),
    )

    // Even with QA Pro, the server can reject the request
    await expect(
      authorizeAndProcessBatch(
        mockIngredients,
        'cold_pressed',
        'test-op-id',
        true,
      ),
    ).rejects.toThrow()

    // The install guard was skipped (QA Pro bypass)
    expect(checkInstallExpandedIngredientEligibility).not.toHaveBeenCalled()
    // But the server reserve was called
    expect(reserveBlendAllowance).toHaveBeenCalled()
  })
})
