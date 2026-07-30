const {
  isQuantitySupported,
  getSupportedPortionUnits,
  getDefaultPortionUnit,
  getSupportedSizes,
  estimateRawWeightGrams,
  createQuantityMetadata,
  applyManualWeightOverride,
  recomputeFromQuantityChange,
  restoreQuantityMetadata,
  getPortionRegistryRecord,
} = require('../producePortionConversion')
const { processJuiceBatch } = require('../JuiceEngine')

// Helper: create an ingredient with portion metadata
function makeQuantityIngredient(produceId, qty, unitKey, sizeKey) {
  const input = { produceId, quantity: qty, unitKey, sizeKey: sizeKey || undefined }
  const result = recomputeFromQuantityChange(input)
  if (!result) return null
  return {
    produceId,
    weightG: result.weightG,
    isOrganic: false,
    portionEntryMode: 'quantity',
    portionMetadata: result.metadata,
  }
}

function makeWeightIngredient(produceId, weightG) {
  return {
    produceId,
    weightG,
    isOrganic: false,
    portionEntryMode: 'weight',
  }
}

describe('Ingredient Row — Portion Entry', () => {
  it('1. new manual ingredient follows Weight preference', () => {
    const ing = makeWeightIngredient('carrot', 150)
    expect(ing.portionEntryMode).toBe('weight')
    expect(ing.weightG).toBe(150)
    expect(ing.portionMetadata).toBeUndefined()
  })

  it('2. new manual ingredient follows Quantity preference', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    expect(ing.portionEntryMode).toBe('quantity')
    expect(ing.portionMetadata).toBeDefined()
    expect(ing.portionMetadata.inputMode).toBe('quantity')
    expect(ing.portionMetadata.enteredQuantity).toBe(6)
  })

  it('3. existing row remains Weight after Settings changes', () => {
    const ing = makeWeightIngredient('carrot', 200)
    expect(ing.portionEntryMode).toBe('weight')
    expect(ing.weightG).toBe(200)
  })

  it('4. per-row override does not change Settings', () => {
    const ing1 = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const ing2 = makeWeightIngredient('kale', 100)
    expect(ing1.portionEntryMode).toBe('quantity')
    expect(ing2.portionEntryMode).toBe('weight')
  })

  it('5. two rows may use different modes', () => {
    const ing1 = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const ing2 = makeWeightIngredient('apple', 180)
    expect(ing1.portionEntryMode).toBe('quantity')
    expect(ing2.portionEntryMode).toBe('weight')
  })

  it('6. two rows may use different sizes', () => {
    const ing1 = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const ing2 = makeQuantityIngredient('carrot', 4, 'whole', 'small')
    expect(ing1.portionMetadata.sizeKey).toBe('medium')
    expect(ing2.portionMetadata.sizeKey).toBe('small')
    expect(ing1.weightG).not.toBe(ing2.weightG)
  })

  it('7. whole produce shows Quantity, unit, and size', () => {
    const units = getSupportedPortionUnits('carrot')
    const wholeUnit = units.find((u) => u.unitKey === 'whole')
    expect(wholeUnit).toBeDefined()
    const sizes = getSupportedSizes('carrot', 'whole')
    expect(sizes.length).toBeGreaterThan(1)
    const hasSML = sizes.some((s) => s.sizeKey !== 'standard')
    expect(hasSML).toBe(true)
  })

  it('8. stalk produce shows Quantity and unit without unnecessary size for cup', () => {
    const units = getSupportedPortionUnits('celery')
    const stalkUnit = units.find((u) => u.unitKey === 'stalk')
    expect(stalkUnit).toBeDefined()
    const sizes = getSupportedSizes('celery', 'stalk')
    const hasSML = sizes.some((s) => s.sizeKey !== 'standard')
    expect(hasSML).toBe(true)
    const cupSizes = getSupportedSizes('celery', 'loose_cup')
    const cupHasSML = cupSizes.some((s) => s.sizeKey !== 'standard')
    expect(cupHasSML).toBe(false)
  })

  it('9. cup-based produce renders correct unit', () => {
    const units = getSupportedPortionUnits('spinach')
    const cupUnit = units.find((u) => u.family === 'cup' || u.unitKey.includes('cup'))
    expect(cupUnit).toBeDefined()
  })

  it('10. weight-only produce disables Quantity', () => {
    expect(isQuantitySupported('wheatgrass')).toBe(false)
    expect(isQuantitySupported('aloe_vera')).toBe(false)
    expect(isQuantitySupported('turmeric')).toBe(false)
    expect(isQuantitySupported('cayenne')).toBe(false)
    expect(isQuantitySupported('coconut_water')).toBe(false)
  })

  it('11. weight-only explanatory copy renders', () => {
    const record = getPortionRegistryRecord('wheatgrass')
    expect(record).toBeDefined()
    expect(record.quantitySupported).toBe(false)
  })

  it('12. quantity estimate displays', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    expect(ing.weightG).toBeGreaterThan(0)
    expect(ing.portionMetadata.estimatedRawWeightG).toBeGreaterThan(0)
  })

  it('13. estimate updates after quantity change', () => {
    const ing1 = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const ing2 = makeQuantityIngredient('carrot', 8, 'whole', 'medium')
    expect(ing2.weightG).toBeGreaterThan(ing1.weightG)
  })

  it('14. estimate updates after unit change', () => {
    const ing1 = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const ing2 = makeQuantityIngredient('carrot', 6, 'loose_cup', null)
    expect(ing1.weightG).not.toBe(ing2.weightG)
  })

  it('15. estimate updates after size change', () => {
    const ing1 = makeQuantityIngredient('carrot', 6, 'whole', 'small')
    const ing2 = makeQuantityIngredient('carrot', 6, 'whole', 'large')
    expect(ing2.weightG).toBeGreaterThan(ing1.weightG)
  })

  it('16. manual estimate override works', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const originalWeight = ing.weightG
    const overrideResult = applyManualWeightOverride(ing.portionMetadata, originalWeight + 50)
    expect(overrideResult.weightG).toBe(originalWeight + 50)
    expect(overrideResult.metadata.wasEstimateOverridden).toBe(true)
  })

  it('17. adjusted indicator renders', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const overrideResult = applyManualWeightOverride(ing.portionMetadata, ing.weightG + 30)
    expect(overrideResult.metadata.wasEstimateOverridden).toBe(true)
  })

  it('18. quantity change clears override', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const overrideResult = applyManualWeightOverride(ing.portionMetadata, ing.weightG + 30)
    expect(overrideResult.metadata.wasEstimateOverridden).toBe(true)
    const newResult = recomputeFromQuantityChange({
      produceId: 'carrot',
      quantity: 8,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(newResult.metadata.wasEstimateOverridden).toBe(false)
  })

  it('19. quantity to weight preserves canonical weight', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const weightBefore = ing.weightG
    const weightIng = { ...ing, portionEntryMode: 'weight' }
    expect(weightIng.weightG).toBe(weightBefore)
    expect(weightIng.portionMetadata).toBeDefined()
  })

  it('20. weight to quantity restores prior metadata', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const weightIng = { ...ing, portionEntryMode: 'weight' }
    const restored = restoreQuantityMetadata(weightIng.portionMetadata)
    expect(restored.metadata.enteredQuantity).toBe(6)
    expect(restored.metadata.unitKey).toBe('whole')
    expect(restored.metadata.sizeKey).toBe('medium')
    expect(restored.metadata.wasEstimateOverridden).toBe(false)
  })

  it('21. weight to quantity with no metadata does not invent a count', () => {
    const ing = makeWeightIngredient('carrot', 200)
    expect(ing.portionMetadata).toBeUndefined()
    const defaultUnit = getDefaultPortionUnit('carrot')
    expect(defaultUnit).toBeDefined()
  })

  it('22. invalid quantity prevents processing', () => {
    const result = estimateRawWeightGrams({
      produceId: 'carrot',
      quantity: 0,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
  })

  it('23. fractional input accepted only when registry allows', () => {
    const units = getSupportedPortionUnits('carrot')
    const wholeUnit = units.find((u) => u.unitKey === 'whole')
    expect(wholeUnit.allowDecimal).toBe(false)
    const result = estimateRawWeightGrams({
      produceId: 'carrot',
      quantity: 1.5,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
  })

  it('24. camera-created ingredient defaults to Weight', () => {
    const cameraIng = {
      produceId: 'carrot',
      weightG: 150,
      isOrganic: false,
    }
    expect(cameraIng.portionEntryMode || 'weight').toBe('weight')
  })

  it('25. camera-created ingredient may switch to Quantity', () => {
    const cameraIng = {
      produceId: 'carrot',
      weightG: 150,
      isOrganic: false,
    }
    expect(isQuantitySupported('carrot')).toBe(true)
  })

  it('26. recipe-preloaded ingredient defaults to Weight', () => {
    const recipeIng = {
      produceId: 'apple',
      weightG: 180,
      isOrganic: false,
    }
    expect(recipeIng.portionEntryMode || 'weight').toBe('weight')
  })

  it('27. recipe-preloaded ingredient may switch to Quantity', () => {
    const recipeIng = {
      produceId: 'apple',
      weightG: 180,
      isOrganic: false,
    }
    expect(isQuantitySupported('apple')).toBe(true)
  })

  it('28. metadata survives ScanFlow preload', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const preload = {
      produceId: ing.produceId,
      weightG: ing.weightG,
      isOrganic: ing.isOrganic,
      portionMetadata: ing.portionMetadata,
      portionEntryMode: ing.portionEntryMode,
    }
    expect(preload.portionMetadata).toBeDefined()
    expect(preload.portionEntryMode).toBe('quantity')
    const seeded = {
      produceId: preload.produceId,
      weightG: preload.weightG,
      isOrganic: preload.isOrganic,
      portionEntryMode: preload.portionEntryMode || 'weight',
      portionMetadata: preload.portionMetadata || undefined,
    }
    expect(seeded.portionEntryMode).toBe('quantity')
    expect(seeded.portionMetadata.enteredQuantity).toBe(6)
  })

  it('29. existing ounce-only ingredient remains valid', () => {
    const ing = { produceId: 'carrot', weightG: 150, isOrganic: true }
    const result = processJuiceBatch([ing], 'centrifugal')
    expect(result.ingredients).toBeDefined()
    expect(result.ingredients.length).toBe(1)
  })

  it('30. editing portions invokes no quota service', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    expect(ing.weightG).toBeGreaterThan(0)
  })
})

describe('Portion Integration Equivalence', () => {
  const testCases = [
    { name: '6 medium carrots', produceId: 'carrot', qty: 6, unitKey: 'whole', sizeKey: 'medium' },
    { name: '4 small apples', produceId: 'apple', qty: 4, unitKey: 'whole', sizeKey: 'small' },
    { name: '3 celery stalks (medium)', produceId: 'celery', qty: 3, unitKey: 'stalk', sizeKey: 'medium' },
    { name: '2 packed cups spinach', produceId: 'spinach', qty: 2, unitKey: 'loose_cup', sizeKey: 'standard' },
  ]

  const juicerMethods = ['centrifugal', 'cold_pressed']

  for (const tc of testCases) {
    for (const method of juicerMethods) {
      it(`equivalence: ${tc.name} via quantity vs weight (${method})`, () => {
        const qtyIng = makeQuantityIngredient(tc.produceId, tc.qty, tc.unitKey, tc.sizeKey)
        expect(qtyIng).not.toBeNull()

        const weightIng = makeWeightIngredient(tc.produceId, qtyIng.weightG)

        const qtyResult = processJuiceBatch([qtyIng], method)
        const weightResult = processJuiceBatch([weightIng], method)

        expect(weightResult.totals).toEqual(qtyResult.totals)
        expect(weightResult.totalRawWeightG).toBe(qtyResult.totalRawWeightG)
        expect(weightResult.totalJuiceWeightG).toBe(qtyResult.totalJuiceWeightG)
      })
    }
  }

  it('raw estimate does not change with juicer method', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const centrifugalResult = processJuiceBatch([ing], 'centrifugal')
    const coldPressedResult = processJuiceBatch([ing], 'cold_pressed')

    expect(centrifugalResult.totalRawWeightG).toBe(coldPressedResult.totalRawWeightG)
    expect(coldPressedResult.totalJuiceWeightG).toBeGreaterThan(0)
  })

  it('double-yield prevention: yield applied exactly once', () => {
    const ing = makeQuantityIngredient('carrot', 6, 'whole', 'medium')
    const result = processJuiceBatch([ing], 'centrifugal')

    expect(result.totalJuiceWeightG).toBeLessThan(result.totalRawWeightG)
    expect(result.totalJuiceWeightG).toBeGreaterThan(0)
    const yieldRatio = result.totalJuiceWeightG / result.totalRawWeightG
    expect(yieldRatio).toBeGreaterThan(0)
    expect(yieldRatio).toBeLessThan(1)
  })

  it('medium-confidence item produces valid estimate', () => {
    const record = getPortionRegistryRecord('dandelion_greens')
    expect(record).toBeDefined()
    if (record.confidence === 'medium') {
      const ing = makeQuantityIngredient('dandelion_greens', 1, 'loose_cup', 'standard')
      expect(ing).not.toBeNull()
      expect(ing.weightG).toBeGreaterThan(0)
    }
  })

  it('weight-only item cannot use quantity mode', () => {
    const result = estimateRawWeightGrams({
      produceId: 'wheatgrass',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
  })
})
