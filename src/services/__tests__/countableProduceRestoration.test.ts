import {
  isQuantitySupported,
  getSupportedCountUnits,
  estimateRawWeightGrams,
  getDefaultPortionUnit,
} from '../producePortionConversion'

const COUNTABLE = [
  'turnip',
  'cauliflower',
  'cabbage_green',
  'cabbage_red',
  'bok_choy',
  'fennel',
  'kohlrabi',
  'celeriac',
  'jicama',
  'aloe_vera',
  'raspberry',
  'blackberry',
  'cranberry',
]

const NOW_WEIGHT_ONLY = [
  'spinach',
  'swiss_chard',
  'collard_greens',
  'dandelion_greens',
  'arugula',
  'romaine',
  'parsley',
  'cilantro',
  'mint',
  'basil',
  'watercress',
]

describe('Issue 3 — Restore Count for Countable Produce', () => {
  test.each(COUNTABLE)('isQuantitySupported returns true for %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(true)
  })

  test.each(COUNTABLE)('getSupportedCountUnits returns at least 1 count unit for %s', (pid) => {
    const countUnits = getSupportedCountUnits(pid)
    expect(countUnits.length).toBeGreaterThanOrEqual(1)
  })

  test.each(NOW_WEIGHT_ONLY)('isQuantitySupported returns false for %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(false)
  })

  test('turnip has whole unit with medium size = 130g', () => {
    const result = estimateRawWeightGrams({
      produceId: 'turnip',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(130)
  })

  test('aloe_vera has whole leaf unit', () => {
    const result = estimateRawWeightGrams({
      produceId: 'aloe_vera',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(120)
  })

  test('cauliflower has whole head unit', () => {
    const result = estimateRawWeightGrams({
      produceId: 'cauliflower',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(575)
  })

  test('cabbage_green has whole head unit', () => {
    const result = estimateRawWeightGrams({
      produceId: 'cabbage_green',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(908)
  })

  test('bok_choy has whole head unit', () => {
    const result = estimateRawWeightGrams({
      produceId: 'bok_choy',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(170)
  })

  test('raspberry has piece unit', () => {
    const result = estimateRawWeightGrams({
      produceId: 'raspberry',
      quantity: 10,
      unitKey: 'piece',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.estimatedRawWeightG).toBe(20)
  })

  test('turnip default unit is whole', () => {
    const unit = getDefaultPortionUnit('turnip')
    expect(unit).not.toBeNull()
    expect(unit!.unitKey).toBe('whole')
  })

  test('cauliflower default unit is whole', () => {
    const unit = getDefaultPortionUnit('cauliflower')
    expect(unit).not.toBeNull()
    expect(unit!.unitKey).toBe('whole')
  })

  test('aloe_vera default unit is whole', () => {
    const unit = getDefaultPortionUnit('aloe_vera')
    expect(unit).not.toBeNull()
    expect(unit!.unitKey).toBe('whole')
  })
})
