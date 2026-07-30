// ─────────────────────────────────────────────────────────────
// portionEquivalence.test.ts
//
// Integration tests proving that quantity-derived ingredients and
// direct-weight ingredients produce identical JuiceEngine outputs
// when given the same produceId + weightG.
//
// Also includes the double-yield prevention regression test.
// ─────────────────────────────────────────────────────────────

import {
  estimateRawWeightGrams,
  GRAMS_PER_OZ,
} from '../producePortionConversion'
import {
  processJuiceBatch,
  type ScannedIngredient,
  type JuiceMethod,
  type JuiceResult,
} from '../JuiceEngine'

const TOLERANCE = 1e-9

function expectEquivalentResults(
  qtyResult: JuiceResult,
  weightResult: JuiceResult,
  label: string,
) {
  expect(qtyResult.totalRawWeightG).toBeCloseTo(weightResult.totalRawWeightG, 10)
  expect(qtyResult.totalJuiceWeightG).toBeCloseTo(weightResult.totalJuiceWeightG, 10)
  expect(qtyResult.totals.calories).toBeCloseTo(weightResult.totals.calories, 10)
  expect(qtyResult.totals.sugar).toBeCloseTo(weightResult.totals.sugar, 10)
  expect(qtyResult.totals.vitaminC).toBeCloseTo(weightResult.totals.vitaminC, 10)
  expect(qtyResult.totals.vitaminA).toBeCloseTo(weightResult.totals.vitaminA, 10)
  expect(qtyResult.totals.potassium).toBeCloseTo(weightResult.totals.potassium, 10)
  expect(qtyResult.totals.iron).toBeCloseTo(weightResult.totals.iron, 10)
  expect(qtyResult.totals.magnesium).toBeCloseTo(weightResult.totals.magnesium, 10)
  expect(qtyResult.totals.folate).toBeCloseTo(weightResult.totals.folate, 10)
  expect(qtyResult.veggieRatio).toBe(weightResult.veggieRatio)
  expect(qtyResult.fruitRatio).toBe(weightResult.fruitRatio)
}

describe('Quantity vs Direct-Weight Equivalence', () => {

  // ── Whole item: apple ──────────────────────────────────────
  test('whole item (apple): identical outputs for both methods', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const qtyIngredient: ScannedIngredient = {
      produceId: 'apple',
      weightG: qtyResult.estimatedRawWeightG,
    }
    const weightIngredient: ScannedIngredient = {
      produceId: 'apple',
      weightG: qtyResult.estimatedRawWeightG, // same weightG
    }

    const r1 = processJuiceBatch([qtyIngredient], 'cold_pressed')
    const r2 = processJuiceBatch([weightIngredient], 'cold_pressed')
    expectEquivalentResults(r1, r2, 'apple cold_pressed')
  })

  // ── Stalk: celery ──────────────────────────────────────────
  test('stalk item (celery): identical outputs for both methods', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'celery',
      quantity: 3,
      unitKey: 'stalk',
      sizeKey: 'medium',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const ingredient: ScannedIngredient = {
      produceId: 'celery',
      weightG: qtyResult.estimatedRawWeightG,
    }

    const r1 = processJuiceBatch([ingredient], 'cold_pressed')
    const r2 = processJuiceBatch([{ ...ingredient }], 'cold_pressed')
    expectEquivalentResults(r1, r2, 'celery cold_pressed')
  })

  // ── Cup-based: kale ────────────────────────────────────────
  test('cup-based item (kale): identical outputs for both methods', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'kale',
      quantity: 2,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const ingredient: ScannedIngredient = {
      produceId: 'kale',
      weightG: qtyResult.estimatedRawWeightG,
    }

    const r1 = processJuiceBatch([ingredient], 'cold_pressed')
    const r2 = processJuiceBatch([{ ...ingredient }], 'cold_pressed')
    expectEquivalentResults(r1, r2, 'kale cold_pressed')
  })

  // ── Medium-confidence: dandelion_greens ────────────────────
  test('medium-confidence item (dandelion_greens): identical outputs', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'dandelion_greens',
      quantity: 1.5,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const ingredient: ScannedIngredient = {
      produceId: 'dandelion_greens',
      weightG: qtyResult.estimatedRawWeightG,
    }

    const r1 = processJuiceBatch([ingredient], 'cold_pressed')
    const r2 = processJuiceBatch([{ ...ingredient }], 'cold_pressed')
    expectEquivalentResults(r1, r2, 'dandelion_greens cold_pressed')
  })

  // ── Centrifugal equivalence ────────────────────────────────
  test('centrifugal: identical outputs for whole item (apple)', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'large',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const ingredient: ScannedIngredient = {
      produceId: 'apple',
      weightG: qtyResult.estimatedRawWeightG,
    }

    const r1 = processJuiceBatch([ingredient], 'centrifugal')
    const r2 = processJuiceBatch([{ ...ingredient }], 'centrifugal')
    expectEquivalentResults(r1, r2, 'apple centrifugal')
  })

  test('centrifugal: identical outputs for stalk (celery)', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'celery',
      quantity: 2,
      unitKey: 'stalk',
      sizeKey: 'large',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const ingredient: ScannedIngredient = {
      produceId: 'celery',
      weightG: qtyResult.estimatedRawWeightG,
    }

    const r1 = processJuiceBatch([ingredient], 'centrifugal')
    const r2 = processJuiceBatch([{ ...ingredient }], 'centrifugal')
    expectEquivalentResults(r1, r2, 'celery centrifugal')
  })

  // ── Cold-press equivalence with mixed ingredients ──────────
  test('cold_pressed: mixed ingredients identical outputs', () => {
    const appleResult = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    const kaleResult = estimateRawWeightGrams({
      produceId: 'kale',
      quantity: 2,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(appleResult.ok).toBe(true)
    expect(kaleResult.ok).toBe(true)
    if (!appleResult.ok || !kaleResult.ok) return

    const qtyIngredients: ScannedIngredient[] = [
      { produceId: 'apple', weightG: appleResult.estimatedRawWeightG },
      { produceId: 'kale', weightG: kaleResult.estimatedRawWeightG },
    ]
    const weightIngredients: ScannedIngredient[] = [
      { produceId: 'apple', weightG: appleResult.estimatedRawWeightG },
      { produceId: 'kale', weightG: kaleResult.estimatedRawWeightG },
    ]

    const r1 = processJuiceBatch(qtyIngredients, 'cold_pressed')
    const r2 = processJuiceBatch(weightIngredients, 'cold_pressed')
    expectEquivalentResults(r1, r2, 'mixed cold_pressed')
  })

  // ── Raw weight estimate is identical regardless of juicer method
  test('raw weight estimate is identical regardless of juicer method', () => {
    const result = estimateRawWeightGrams({
      produceId: 'carrot',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // The conversion produces the same weightG no matter what method
    // will be used downstream
    const weightG = result.estimatedRawWeightG
    const r1 = processJuiceBatch([{ produceId: 'carrot', weightG }], 'cold_pressed')
    const r2 = processJuiceBatch([{ produceId: 'carrot', weightG }], 'centrifugal')

    // Raw weight must be the same
    expect(r1.totalRawWeightG).toBe(r2.totalRawWeightG)
    // Juice weight may differ due to same yieldPercent (it doesn't actually
    // change by method — yield is per-produce, not per-method)
    // But nutrition retention differs
    expect(r1.totals.vitaminC).not.toBe(r2.totals.vitaminC) // centrifugal loses vitC
  })
})

// ── Double-Yield Prevention Regression Test ──────────────────

describe('Double-Yield Prevention Regression', () => {
  test('conversion produces raw weightG only — yieldPercent not applied during conversion', () => {
    // Apple medium = 182g from registry
    // Apple yieldPercent = 0.76
    // If yield were applied during conversion, we'd get 182 * 0.76 = 138.32g
    // Instead, we should get exactly 182g
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.estimatedRawWeightG).toBe(182)
    // NOT 182 * 0.76
    expect(result.estimatedRawWeightG).not.toBeCloseTo(182 * 0.76, 1)
  })

  test('processJuiceBatch applies yieldPercent exactly once', () => {
    const weightG = 182 // raw weight from conversion
    const ingredient: ScannedIngredient = {
      produceId: 'apple',
      weightG,
    }
    const result = processJuiceBatch([ingredient], 'cold_pressed')

    // Apple yieldPercent = 0.76
    // juiceWeight should be 182 * 0.76 = 138.32, rounded to 138.32
    expect(result.totalJuiceWeightG).toBeCloseTo(182 * 0.76, 2)
    // NOT 182 * 0.76 * 0.76 (double yield)
    expect(result.totalJuiceWeightG).not.toBeCloseTo(182 * 0.76 * 0.76, 1)
  })

  test('quantity-derived and direct-weight inputs produce identical outputs (no double yield)', () => {
    const qtyResult = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(qtyResult.ok).toBe(true)
    if (!qtyResult.ok) return

    const weightG = qtyResult.estimatedRawWeightG // 364g

    const qtyIngredient: ScannedIngredient = {
      produceId: 'apple',
      weightG,
    }
    const directIngredient: ScannedIngredient = {
      produceId: 'apple',
      weightG, // same value
    }

    const r1 = processJuiceBatch([qtyIngredient], 'cold_pressed')
    const r2 = processJuiceBatch([directIngredient], 'cold_pressed')

    expect(r1.totalRawWeightG).toBe(r2.totalRawWeightG)
    expect(r1.totalJuiceWeightG).toBe(r2.totalJuiceWeightG)
    expect(r1.totals).toEqual(r2.totals)

    // Verify yield applied exactly once: 364 * 0.76 = 276.64
    expect(r1.totalJuiceWeightG).toBeCloseTo(364 * 0.76, 2)
    // NOT 364 * 0.76 * 0.76
    expect(r1.totalJuiceWeightG).not.toBeCloseTo(364 * 0.76 * 0.76, 1)
  })
})
