// ─────────────────────────────────────────────────────────────
// quantityVolumeSeparation.test.ts
//
// Tests that Quantity/Count mode uses only discrete/count-family units
// and Volume mode uses only volume-family units.
//
// Rules:
//   - Count units: whole, piece, handful, bunch, stalk, head, leaf,
//     root, bulb, pod, coconut, inch_piece, clove, etc.
//   - Volume units: cup (packed_cup, loose_cup), tablespoon, teaspoon,
//     ounce, milliliter
//   - No Quantity unit uses cup, tablespoon, teaspoon, ounce, or milliliter.
//   - No Volume unit is presented as Count.
//   - Every whole-produce entry supports both Count and Volume modes.
//   - Prepared liquids remain volume-only (quantitySupported: false).
// ─────────────────────────────────────────────────────────────

import {
  isQuantitySupported,
  getSupportedCountUnits,
  getSupportedPortionUnits,
  getDefaultPortionUnit,
  getPortionRegistryRecord,
  estimateRawWeightGrams,
} from '../producePortionConversion'
import { PRODUCE_PORTIONS } from '../../constants/producePortions'

const VOLUME_FAMILIES = new Set([
  'packed_cup',
  'loose_cup',
  'tablespoon',
  'teaspoon',
  'ounce',
  'milliliter',
  'fluid_ounce',
])

const VOLUME_UNIT_KEYS = new Set([
  'packed_cup',
  'loose_cup',
  'tablespoon',
  'teaspoon',
  'ounce',
  'milliliter',
  'fluid_ounce',
  'cup',
])

describe('Quantity vs Volume Unit Separation', () => {

  // 1. No Quantity/count unit uses cup, tablespoon, teaspoon, ounce, or milliliter
  test('1. no count unit uses volume family or volume unitKey', () => {
    const produceIds = Object.keys(PRODUCE_PORTIONS)
    for (const pid of produceIds) {
      const countUnits = getSupportedCountUnits(pid)
      for (const unit of countUnits) {
        expect(VOLUME_FAMILIES.has(unit.family)).toBe(false)
        expect(VOLUME_UNIT_KEYS.has(unit.unitKey)).toBe(false)
      }
    }
  })

  // 2. No Volume unit is presented as Count
  test('2. volume-family units are excluded from getSupportedCountUnits', () => {
    const produceIds = Object.keys(PRODUCE_PORTIONS)
    for (const pid of produceIds) {
      const allUnits = getSupportedPortionUnits(pid)
      const countUnits = getSupportedCountUnits(pid)
      const volumeUnits = allUnits.filter((u) => VOLUME_FAMILIES.has(u.family))
      for (const vu of volumeUnits) {
        expect(countUnits.find((cu) => cu.unitKey === vu.unitKey)).toBeUndefined()
      }
    }
  })

  // 3. Wheatgrass supports meaningful Count and Volume
  test('3. wheatgrass has count units (handful) and volume units (loose_cup)', () => {
    expect(isQuantitySupported('wheatgrass')).toBe(true)
    const countUnits = getSupportedCountUnits('wheatgrass')
    const allUnits = getSupportedPortionUnits('wheatgrass')
    const volumeUnits = allUnits.filter((u) => VOLUME_FAMILIES.has(u.family))
    expect(countUnits.length).toBeGreaterThanOrEqual(1)
    expect(volumeUnits.length).toBeGreaterThanOrEqual(1)
    expect(countUnits.find((u) => u.unitKey === 'handful')).toBeDefined()
    expect(volumeUnits.find((u) => u.unitKey === 'loose_cup')).toBeDefined()
    const defaultUnit = getDefaultPortionUnit('wheatgrass')
    expect(defaultUnit).not.toBeNull()
    expect(VOLUME_FAMILIES.has(defaultUnit!.family)).toBe(false)
  })

  // 4. Turmeric supports meaningful Count and Volume
  test('4. turmeric has count units (inch_piece) and volume units (tablespoon)', () => {
    expect(isQuantitySupported('turmeric')).toBe(true)
    const countUnits = getSupportedCountUnits('turmeric')
    const allUnits = getSupportedPortionUnits('turmeric')
    const volumeUnits = allUnits.filter((u) => VOLUME_FAMILIES.has(u.family))
    expect(countUnits.length).toBeGreaterThanOrEqual(1)
    expect(volumeUnits.length).toBeGreaterThanOrEqual(1)
    expect(countUnits.find((u) => u.unitKey === 'inch_piece')).toBeDefined()
    expect(volumeUnits.find((u) => u.unitKey === 'tablespoon')).toBeDefined()
    const defaultUnit = getDefaultPortionUnit('turmeric')
    expect(defaultUnit).not.toBeNull()
    expect(VOLUME_FAMILIES.has(defaultUnit!.family)).toBe(false)
  })

  // 5. Cayenne supports meaningful Count and Volume
  test('5. cayenne has count units (whole) and volume units (tablespoon)', () => {
    expect(isQuantitySupported('cayenne')).toBe(true)
    const countUnits = getSupportedCountUnits('cayenne')
    const allUnits = getSupportedPortionUnits('cayenne')
    const volumeUnits = allUnits.filter((u) => VOLUME_FAMILIES.has(u.family))
    expect(countUnits.length).toBeGreaterThanOrEqual(1)
    expect(volumeUnits.length).toBeGreaterThanOrEqual(1)
    expect(countUnits.find((u) => u.unitKey === 'whole')).toBeDefined()
    expect(volumeUnits.find((u) => u.unitKey === 'tablespoon')).toBeDefined()
    const defaultUnit = getDefaultPortionUnit('cayenne')
    expect(defaultUnit).not.toBeNull()
    expect(VOLUME_FAMILIES.has(defaultUnit!.family)).toBe(false)
  })

  // 6. Coconut water follows the approved discrete-or-volume-only rule
  test('6. coconut_water is volume-only (prepared liquid, not whole produce)', () => {
    expect(isQuantitySupported('coconut_water')).toBe(false)
    const countUnits = getSupportedCountUnits('coconut_water')
    expect(countUnits.length).toBe(0)
    const allUnits = getSupportedPortionUnits('coconut_water')
    expect(allUnits.length).toBe(0)
    const record = getPortionRegistryRecord('coconut_water')
    expect(record).not.toBeNull()
    expect(record!.notes).toContain('prepared liquid')
  })

  // 7. Every whole-produce entry with quantitySupported has at least 1 count unit
  test('7. every quantitySupported produce has at least 1 count unit', () => {
    const produceIds = Object.keys(PRODUCE_PORTIONS)
    for (const pid of produceIds) {
      const record = PRODUCE_PORTIONS[pid]
      if (!record.quantitySupported) continue
      const countUnits = getSupportedCountUnits(pid)
      expect(countUnits.length).toBeGreaterThanOrEqual(1)
    }
  })

  // 8. Genuine prepared liquids remain correctly classified
  test('8. coconut_water is not quantitySupported (prepared liquid)', () => {
    const record = getPortionRegistryRecord('coconut_water')
    expect(record).not.toBeNull()
    expect(record!.quantitySupported).toBe(false)
  })

  // 9. Nutrition calculations remain finite and based on correct gram conversions
  test('9. wheatgrass count conversion produces finite positive weight', () => {
    const result = estimateRawWeightGrams({
      produceId: 'wheatgrass',
      quantity: 2,
      unitKey: 'handful',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Number.isFinite(result.estimatedRawWeightG)).toBe(true)
    expect(result.estimatedRawWeightG).toBe(50)
  })

  test('9b. turmeric count conversion produces finite positive weight', () => {
    const result = estimateRawWeightGrams({
      produceId: 'turmeric',
      quantity: 1,
      unitKey: 'inch_piece',
      sizeKey: 'standard',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Number.isFinite(result.estimatedRawWeightG)).toBe(true)
    expect(result.estimatedRawWeightG).toBe(20)
  })

  test('9c. cayenne count conversion produces finite positive weight', () => {
    const result = estimateRawWeightGrams({
      produceId: 'cayenne',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Number.isFinite(result.estimatedRawWeightG)).toBe(true)
    expect(result.estimatedRawWeightG).toBe(17)
  })

  // 10. All paths use the same capability helper (isQuantitySupported)
  test('10. isQuantitySupported is the single source of truth for quantity support', () => {
    expect(isQuantitySupported('wheatgrass')).toBe(true)
    expect(isQuantitySupported('turmeric')).toBe(true)
    expect(isQuantitySupported('cayenne')).toBe(true)
    expect(isQuantitySupported('coconut_water')).toBe(false)
    expect(isQuantitySupported('apple')).toBe(true)
    expect(isQuantitySupported('dragonfruit')).toBe(false)
  })
})
