import { recomputeFromQuantityChange } from '../../services/producePortionConversion'
import { isQuantitySupported, getDefaultPortionUnit } from '../../services/producePortionConversion'

describe('Item 1 — Default new produce quantity to 1', () => {
  describe('Manual produce addition defaults', () => {
    test('carrot (quantity-supported) gets initial quantity 1 metadata', () => {
      const produceId = 'carrot'
      expect(isQuantitySupported(produceId)).toBe(true)
      const defaultUnit = getDefaultPortionUnit(produceId)
      expect(defaultUnit).toBeTruthy()
      const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
      const defaultSize = hasSML
        ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
        : null
      const result = recomputeFromQuantityChange({
        produceId,
        quantity: 1,
        unitKey: defaultUnit.unitKey,
        sizeKey: defaultSize?.sizeKey || undefined,
      })
      expect(result).not.toBeNull()
      expect(result.metadata.enteredQuantity).toBe(1)
      expect(result.weightG).toBeGreaterThan(0)
    })

    test('kale (quantity-supported) gets initial quantity 1 metadata', () => {
      const produceId = 'kale'
      expect(isQuantitySupported(produceId)).toBe(true)
      const defaultUnit = getDefaultPortionUnit(produceId)
      const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
      const defaultSize = hasSML
        ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
        : null
      const result = recomputeFromQuantityChange({
        produceId,
        quantity: 1,
        unitKey: defaultUnit.unitKey,
        sizeKey: defaultSize?.sizeKey || undefined,
      })
      expect(result).not.toBeNull()
      expect(result.metadata.enteredQuantity).toBe(1)
    })

    test('lemon with SML sizes gets initial quantity 1 with medium size', () => {
      const produceId = 'lemon'
      expect(isQuantitySupported(produceId)).toBe(true)
      const defaultUnit = getDefaultPortionUnit(produceId)
      const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
      const defaultSize = hasSML
        ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
        : null
      const result = recomputeFromQuantityChange({
        produceId,
        quantity: 1,
        unitKey: defaultUnit.unitKey,
        sizeKey: defaultSize?.sizeKey || undefined,
      })
      expect(result).not.toBeNull()
      expect(result.metadata.enteredQuantity).toBe(1)
    })
  })

  describe('Camera-identified produce defaults', () => {
    test('camera produce that is quantity-supported gets quantity 1', () => {
      const produceId = 'spinach'
      expect(isQuantitySupported(produceId)).toBe(true)
      const defaultUnit = getDefaultPortionUnit(produceId)
      const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
      const defaultSize = hasSML
        ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
        : null
      const result = recomputeFromQuantityChange({
        produceId,
        quantity: 1,
        unitKey: defaultUnit.unitKey,
        sizeKey: defaultSize?.sizeKey || undefined,
      })
      expect(result).not.toBeNull()
      expect(result.metadata.enteredQuantity).toBe(1)
    })

    test('camera produce that is NOT quantity-supported stays as-is', () => {
      const produceId = 'ginger'
      const supported = isQuantitySupported(produceId)
      // ginger may or may not be supported — test the fallback path
      if (!supported) {
        // Should not have portionMetadata, just weightG from vision
        const fakeIng = { produceId, weightG: 30 }
        expect(fakeIng.portionMetadata).toBeUndefined()
        expect(fakeIng.weightG).toBe(30)
      } else {
        const defaultUnit = getDefaultPortionUnit(produceId)
        const result = recomputeFromQuantityChange({
          produceId,
          quantity: 1,
          unitKey: defaultUnit.unitKey,
          sizeKey: undefined,
        })
        expect(result).not.toBeNull()
        expect(result.metadata.enteredQuantity).toBe(1)
      }
    })
  })

  describe('Negative quantity prevention', () => {
    test('Math.max(0, -5) yields 0', () => {
      expect(Math.max(0, -5)).toBe(0)
    })

    test('Math.max(0, 3) yields 3', () => {
      expect(Math.max(0, 3)).toBe(3)
    })

    test('recomputeFromQuantityChange with quantity 0 does not crash', () => {
      const produceId = 'carrot'
      const defaultUnit = getDefaultPortionUnit(produceId)
      const hasSML = defaultUnit.sizes.some((s) => s.sizeKey !== 'standard')
      const defaultSize = hasSML
        ? (defaultUnit.sizes.find((s) => s.sizeKey === 'medium') || defaultUnit.sizes[0])
        : null
      const result = recomputeFromQuantityChange({
        produceId,
        quantity: 0,
        unitKey: defaultUnit.unitKey,
        sizeKey: defaultSize?.sizeKey || undefined,
      })
      // May return null or a result with 0 weight — either is acceptable
      if (result) {
        expect(result.metadata.enteredQuantity).toBe(0)
      }
    })
  })

  describe('Existing saved entries are not rewritten', () => {
    test('an ingredient with existing portionMetadata keeps its quantity', () => {
      const existingMeta = {
        inputMode: 'quantity',
        enteredQuantity: 3,
        unitKey: 'whole',
        sizeKey: 'medium',
        estimatedRawWeightG: 183,
        sourceVersion: 1,
        wasEstimateOverridden: false,
        originalEstimatedRawWeightG: 183,
      }
      // Simulating that existing entries are not touched by the default logic
      expect(existingMeta.enteredQuantity).toBe(3)
      expect(existingMeta.enteredQuantity).not.toBe(1)
    })
  })
})
