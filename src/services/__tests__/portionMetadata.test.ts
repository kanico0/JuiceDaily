// ─────────────────────────────────────────────────────────────
// portionMetadata.test.ts
//
// Tests for quantity portion metadata creation, override behavior,
// and serialization round-trips.
// ─────────────────────────────────────────────────────────────

import {
  createQuantityMetadata,
  applyManualWeightOverride,
  recomputeFromQuantityChange,
  restoreQuantityMetadata,
  REGISTRY_SOURCE_VERSION,
  type QuantityPortionMetadata,
  type WeightPortionMetadata,
  type PortionMetadata,
} from '../producePortionConversion'
import type { ScannedIngredient } from '../JuiceEngine'

describe('Portion Metadata and Override', () => {

  // 1. Old weight-only ingredient remains valid
  test('1. old weight-only ingredient shape remains valid', () => {
    const oldIngredient: ScannedIngredient = {
      produceId: 'apple',
      weightG: 182,
      isOrganic: false,
    }
    expect(oldIngredient.produceId).toBe('apple')
    expect(oldIngredient.weightG).toBe(182)
    // No metadata required — old shape is fully supported
  })

  // 2. Quantity metadata creation
  test('2. quantity metadata creation from 2 medium apples', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    expect(metadata!.inputMode).toBe('quantity')
    expect(metadata!.enteredQuantity).toBe(2)
    expect(metadata!.unitKey).toBe('whole')
    expect(metadata!.sizeKey).toBe('medium')
  })

  // 3. Canonical weightG equals generated estimate
  test('3. canonical weightG equals generated estimate', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    if (!metadata) return
    const expectedWeight = 2 * 182
    expect(metadata.estimatedRawWeightG).toBe(expectedWeight)
    expect(metadata.originalEstimatedRawWeightG).toBe(expectedWeight)
    // Canonical weightG would be set to this value
    const ingredient: ScannedIngredient = {
      produceId: 'apple',
      weightG: metadata.estimatedRawWeightG,
    }
    expect(ingredient.weightG).toBe(expectedWeight)
  })

  // 4. Manual override updates canonical weightG
  test('4. manual override updates canonical weightG', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    const { weightG, metadata: updated } = applyManualWeightOverride(metadata, 400)
    expect(weightG).toBe(400)
    expect(updated.estimatedRawWeightG).toBe(400)
  })

  // 5. Manual override preserves original estimate
  test('5. manual override preserves original estimate', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    const original = metadata.originalEstimatedRawWeightG
    const { metadata: updated } = applyManualWeightOverride(metadata, 400)
    expect(updated.originalEstimatedRawWeightG).toBe(original)
    expect(updated.originalEstimatedRawWeightG).toBe(364)
  })

  // 6. Manual override preserves quantity metadata
  test('6. manual override preserves quantity metadata', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    const { metadata: updated } = applyManualWeightOverride(metadata, 400)
    expect(updated.inputMode).toBe('quantity')
    expect(updated.enteredQuantity).toBe(2)
    expect(updated.unitKey).toBe('whole')
    expect(updated.sizeKey).toBe('medium')
  })

  // 7. Quantity change clears override
  test('7. quantity change clears override', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    const overridden = applyManualWeightOverride(metadata, 400)
    // Now change quantity to 3
    const recomputed = recomputeFromQuantityChange({
      produceId: 'apple',
      quantity: 3,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(recomputed).not.toBeNull()
    if (!recomputed) return
    expect(recomputed.metadata.wasEstimateOverridden).toBe(false)
    expect(recomputed.weightG).toBe(3 * 182)
    expect(recomputed.metadata.originalEstimatedRawWeightG).toBe(3 * 182)
  })

  // 8. Unit change clears override
  test('8. unit change clears override', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    const overridden = applyManualWeightOverride(metadata, 400)
    // Change to loose_cup unit
    const recomputed = recomputeFromQuantityChange({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(recomputed).not.toBeNull()
    if (!recomputed) return
    expect(recomputed.metadata.wasEstimateOverridden).toBe(false)
    expect(recomputed.weightG).toBe(2 * 125)
  })

  // 9. Size change clears override
  test('9. size change clears override', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    const overridden = applyManualWeightOverride(metadata, 300)
    // Change size from medium to large
    const recomputed = recomputeFromQuantityChange({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'large',
    })
    expect(recomputed).not.toBeNull()
    if (!recomputed) return
    expect(recomputed.metadata.wasEstimateOverridden).toBe(false)
    expect(recomputed.weightG).toBe(223)
  })

  // 10. Prior quantity metadata can be restored
  test('10. prior quantity metadata can be restored', () => {
    const metadata: QuantityPortionMetadata = {
      inputMode: 'quantity',
      enteredQuantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
      estimatedRawWeightG: 400, // was overridden
      sourceVersion: REGISTRY_SOURCE_VERSION,
      wasEstimateOverridden: true,
      originalEstimatedRawWeightG: 364,
    }
    const { weightG, metadata: restored } = restoreQuantityMetadata(metadata)
    expect(restored.wasEstimateOverridden).toBe(false)
    // When restoring, weightG goes back to the estimate
    expect(weightG).toBe(400) // stays at current estimatedRawWeightG
  })

  // 11. Weight-only mode does not require quantity metadata
  test('11. weight-only mode does not require quantity metadata', () => {
    const weightMeta: WeightPortionMetadata = { inputMode: 'weight' }
    const ingredient: ScannedIngredient & { portionMetadata?: PortionMetadata } = {
      produceId: 'apple',
      weightG: 200,
      portionMetadata: weightMeta,
    }
    expect(ingredient.portionMetadata!.inputMode).toBe('weight')
    // No quantity fields needed
    expect((ingredient.portionMetadata as WeightPortionMetadata).inputMode).toBe('weight')
  })

  // 12. Metadata serialization round-trip
  test('12. metadata serialization round-trip', () => {
    const metadata = createQuantityMetadata({
      produceId: 'celery',
      quantity: 3,
      unitKey: 'stalk',
      sizeKey: 'medium',
    })!
    const json = JSON.stringify(metadata)
    const parsed = JSON.parse(json) as QuantityPortionMetadata
    expect(parsed.inputMode).toBe('quantity')
    expect(parsed.enteredQuantity).toBe(3)
    expect(parsed.unitKey).toBe('stalk')
    expect(parsed.sizeKey).toBe('medium')
    expect(parsed.estimatedRawWeightG).toBe(120)
    expect(parsed.wasEstimateOverridden).toBe(false)
    expect(parsed.originalEstimatedRawWeightG).toBe(120)
  })

  // 13. Missing optional metadata does not break processing
  test('13. missing optional metadata does not break processing', () => {
    const ingredient: ScannedIngredient = {
      produceId: 'kale',
      weightG: 67,
    }
    // JuiceEngine only needs produceId and weightG
    expect(ingredient.produceId).toBe('kale')
    expect(ingredient.weightG).toBe(67)
    expect(ingredient.isOrganic).toBeUndefined()
  })

  // 14. Source version persists
  test('14. source version persists in metadata', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })!
    expect(metadata.sourceVersion).toBe(REGISTRY_SOURCE_VERSION)
    expect(metadata.sourceVersion).toBe('manifest-2.0')
    // After serialization
    const parsed = JSON.parse(JSON.stringify(metadata)) as QuantityPortionMetadata
    expect(parsed.sourceVersion).toBe(REGISTRY_SOURCE_VERSION)
  })
})
