// ─────────────────────────────────────────────────────────────
// producePortionConversion.test.ts
//
// Tests for the quantity-to-raw-weight conversion service.
// Covers: conversion, validation, weight-only, precision, labels,
// immutability, determinism, and all five weight-only items.
// ─────────────────────────────────────────────────────────────

import {
  estimateRawWeightGrams,
  estimateRawWeightOz,
  formatQuantityDescription,
  validateQuantityPortionInput,
  getPortionRegistryRecord,
  isQuantitySupported,
  getSupportedPortionUnits,
  getSupportedCountUnits,
  getDefaultPortionUnit,
  getSupportedSizes,
  GRAMS_PER_OZ,
  REGISTRY_SOURCE_VERSION,
  type ConversionResult,
} from '../producePortionConversion'
import { PRODUCE_PORTIONS } from '../../constants/producePortions'

// ── Test data from the accepted registry ─────────────────────
// apple: whole, S/M/L, integer-only, high confidence
//   small=149g, medium=182g, large=223g
// celery: stalk, S/M/L, integer-only, high confidence
//   small=17g, medium=40g, large=64g
// kale: loose_cup, standard only, decimal allowed (step 0.5), high confidence
//   standard=67g
// dandelion_greens: loose_cup, standard only, decimal allowed, medium confidence
//   standard=55g
// carrot: whole (S/M/L, integer) + loose_cup (standard, decimal), high confidence
//   whole medium=61g, loose_cup standard=128g

const WEIGHT_ONLY = [
  'wheatgrass', 'turmeric', 'cayenne', 'coconut_water',
]

const COUNT_SUPPORTED_GREENS = [
  'spinach', 'swiss_chard', 'collard_greens', 'dandelion_greens',
  'arugula', 'romaine', 'parsley', 'cilantro', 'mint', 'basil',
  'watercress',
]

describe('Produce Portion Conversion Service', () => {

  // 1. Known high-confidence whole produce conversion
  test('1. high-confidence whole produce: 2 medium apples = 364g', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(2 * 182)
    expect(result.confidence).toBe('high')
  })

  // 2. Medium-confidence supported conversion — turnip whole
  test('2. medium-confidence: 1 medium turnip = 130g', () => {
    const result = estimateRawWeightGrams({
      produceId: 'turnip',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(130)
    expect(result.confidence).toBe('medium')
  })

  // 3. Integer quantity conversion
  test('3. integer quantity: 3 medium carrots = 183g', () => {
    const result = estimateRawWeightGrams({
      produceId: 'carrot',
      quantity: 3,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(3 * 61)
  })

  // 4. Decimal quantity where allowed
  test('4. decimal quantity allowed: 1.5 cups kale = 100.5g', () => {
    const result = estimateRawWeightGrams({
      produceId: 'kale',
      quantity: 1.5,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(1.5 * 67)
  })

  // 5. Fractional quantity rejected where disallowed
  test('5. fractional quantity rejected for integer-only unit', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1.5,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('decimal_not_allowed')
  })

  // 6. Quantity exactly on configured step
  test('6. quantity on step: 2.5 cups kale (step 0.5) is valid', () => {
    const result = estimateRawWeightGrams({
      produceId: 'kale',
      quantity: 2.5,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(true)
  })

  // 7. Quantity violating configured step
  test('7. quantity violating step: 0.3 cups kale (step 0.5) is invalid', () => {
    const result = estimateRawWeightGrams({
      produceId: 'kale',
      quantity: 0.3,
      unitKey: 'loose_cup',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('invalid_step')
  })

  // 8. Zero quantity rejected
  test('8. zero quantity rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 0,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('invalid_quantity')
  })

  // 9. Negative quantity rejected
  test('9. negative quantity rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: -2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('invalid_quantity')
  })

  // 10. NaN rejected
  test('10. NaN quantity rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: NaN,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('invalid_quantity')
  })

  // 11. Infinity rejected
  test('11. Infinity quantity rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: Infinity,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('invalid_quantity')
  })

  // 12. Unknown produce rejected
  test('12. unknown produce ID rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'dragonfruit',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('unknown_produce')
  })

  // 13. Weight-only produce returns quantity_not_supported
  test.each(WEIGHT_ONLY)('13. weight-only produce %s returns quantity_not_supported', (pid) => {
    const result = estimateRawWeightGrams({
      produceId: pid,
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('quantity_not_supported')
  })

  // 14. Unknown unit rejected
  test('14. unknown unit rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'bushel',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('unknown_unit')
  })

  // 15. Missing required size rejected
  test('15. missing required size for S/M/L unit rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('size_required')
  })

  // 16. Unknown size rejected
  test('16. unknown size rejected', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'extra_large',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('unknown_size')
  })

  // 17. Size from the wrong unit rejected
  test('17. size from wrong unit rejected', () => {
    // 'standard' is a valid sizeKey for kale's loose_cup, but not for apple's whole
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('unknown_size')
  })

  // 18. Standard-size unit works without S/M/L
  test('18. standard-size unit works without specifying sizeKey', () => {
    const result = estimateRawWeightGrams({
      produceId: 'kale',
      quantity: 2,
      unitKey: 'loose_cup',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(2 * 67)
    expect(result.sizeKey).toBeNull()
  })

  // 19. Full internal precision retained
  test('19. full floating-point precision retained', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 3,
      unitKey: 'whole',
      sizeKey: 'small',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(3 * 149)
    // No rounding applied — exact product
    expect(result.estimatedRawWeightG).toBe(447)
  })

  // 20. UI ounce value is derived from exact grams
  test('20. ounce value derived from exact grams using GRAMS_PER_OZ', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expectedOz = 182 / GRAMS_PER_OZ
    expect(result.estimatedRawWeightOz).toBeCloseTo(expectedOz, 15)
  })

  // 21. Display description uses registry labels
  test('21. display description uses registry labels', () => {
    const desc = formatQuantityDescription({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(desc).toContain('2')
    expect(desc).toContain('apple')
    expect(desc).toContain('medium')
  })

  // 22. Singular label for quantity 1
  test('22. singular label for quantity 1', () => {
    const desc = formatQuantityDescription({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(desc).toContain('1 apple')
    expect(desc).not.toContain('1 apples')
  })

  // 23. Plural label for quantity other than 1
  test('23. plural label for quantity 2', () => {
    const desc = formatQuantityDescription({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(desc).toContain('2 apples')
  })

  // 24. Registry source version included
  test('24. source version included in result', () => {
    const result = estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sourceVersion).toBe(REGISTRY_SOURCE_VERSION)
    expect(result.sourceVersion).toBe('manifest-2.0')
  })

  // 25. No registry object mutation
  test('25. conversion does not mutate the registry', () => {
    const before = JSON.stringify(PRODUCE_PORTIONS.apple)
    estimateRawWeightGrams({
      produceId: 'apple',
      quantity: 5,
      unitKey: 'whole',
      sizeKey: 'large',
    })
    const after = JSON.stringify(PRODUCE_PORTIONS.apple)
    expect(after).toBe(before)
  })

  // 26. Repeated calls return identical results
  test('26. repeated calls return identical results', () => {
    const input = {
      produceId: 'celery',
      quantity: 3,
      unitKey: 'stalk',
      sizeKey: 'medium',
    }
    const r1 = estimateRawWeightGrams(input)
    const r2 = estimateRawWeightGrams(input)
    expect(r1).toEqual(r2)
  })

  // ── Registry lookup tests ──────────────────────────────────

  test('getPortionRegistryRecord returns record for known produce', () => {
    const record = getPortionRegistryRecord('apple')
    expect(record).not.toBeNull()
    expect(record!.produceId).toBe('apple')
  })

  test('getPortionRegistryRecord returns null for unknown produce', () => {
    expect(getPortionRegistryRecord('dragonfruit')).toBeNull()
  })

  test('isQuantitySupported returns true for apple', () => {
    expect(isQuantitySupported('apple')).toBe(true)
  })

  test.each(WEIGHT_ONLY)('isQuantitySupported returns false for %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(false)
  })

  test.each(COUNT_SUPPORTED_GREENS)('isQuantitySupported returns true for %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(true)
  })

  test.each(COUNT_SUPPORTED_GREENS)('getSupportedCountUnits returns at least one count unit for %s', (pid) => {
    const units = getSupportedCountUnits(pid)
    expect(units.length).toBeGreaterThan(0)
  })

  test.each(COUNT_SUPPORTED_GREENS)('getDefaultPortionUnit returns a count-family unit for %s', (pid) => {
    const unit = getDefaultPortionUnit(pid)
    expect(unit).not.toBeNull()
    const VOLUME_FAMILIES = new Set(['packed_cup', 'loose_cup', 'tablespoon'])
    expect(VOLUME_FAMILIES.has(unit!.family)).toBe(false)
  })

  test('getSupportedPortionUnits returns units for apple', () => {
    const units = getSupportedPortionUnits('apple')
    expect(units.length).toBeGreaterThan(0)
    expect(units.some((u) => u.unitKey === 'whole')).toBe(true)
  })

  test('getDefaultPortionUnit returns the default unit', () => {
    const unit = getDefaultPortionUnit('apple')
    expect(unit).not.toBeNull()
    expect(unit!.unitKey).toBe('whole')
  })

  test('getSupportedSizes returns sizes for apple/whole', () => {
    const sizes = getSupportedSizes('apple', 'whole')
    expect(sizes.length).toBe(3)
    expect(sizes.some((s) => s.sizeKey === 'medium')).toBe(true)
  })

  test('validateQuantityPortionInput returns null for valid input', () => {
    const err = validateQuantityPortionInput({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(err).toBeNull()
  })
})
