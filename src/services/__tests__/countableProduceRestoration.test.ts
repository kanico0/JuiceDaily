import {
  isQuantitySupported,
  getSupportedCountUnits,
  getSupportedPortionUnits,
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

const FORMERLY_WEIGHT_ONLY = [
  'wheatgrass',
  'turmeric',
  'cayenne',
]

const VOLUME_ONLY = [
  'coconut_water',
]

const NEWLY_COUNTABLE = [
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

  test.each(FORMERLY_WEIGHT_ONLY)('isQuantitySupported returns true for formerly weight-only %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(true)
  })

  test.each(FORMERLY_WEIGHT_ONLY)('getDefaultPortionUnit returns a non-null unit for %s', (pid) => {
    const unit = getDefaultPortionUnit(pid)
    expect(unit).not.toBeNull()
  })

  test.each(FORMERLY_WEIGHT_ONLY)('getSupportedPortionUnits returns at least 1 unit for %s', (pid) => {
    const units = getSupportedPortionUnits(pid)
    expect(units.length).toBeGreaterThanOrEqual(1)
  })

  test.each(VOLUME_ONLY)('isQuantitySupported returns false for volume-only %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(false)
  })

  test.each(VOLUME_ONLY)('getSupportedPortionUnits returns 0 units for volume-only %s', (pid) => {
    const units = getSupportedPortionUnits(pid)
    expect(units.length).toBe(0)
  })

  test.each(NEWLY_COUNTABLE)('isQuantitySupported returns true for %s', (pid) => {
    expect(isQuantitySupported(pid)).toBe(true)
  })

  test.each(NEWLY_COUNTABLE)('getSupportedCountUnits returns at least 1 count unit for %s', (pid) => {
    const countUnits = getSupportedCountUnits(pid)
    expect(countUnits.length).toBeGreaterThanOrEqual(1)
  })

  test.each(NEWLY_COUNTABLE)('getDefaultPortionUnit returns a count-family unit for %s', (pid) => {
    const unit = getDefaultPortionUnit(pid)
    expect(unit).not.toBeNull()
    const VOLUME_FAMILIES = new Set(['packed_cup', 'loose_cup', 'tablespoon'])
    expect(VOLUME_FAMILIES.has(unit!.family)).toBe(false)
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
