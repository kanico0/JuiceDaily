// ─────────────────────────────────────────────────────────────
// getDefaultCountUnit.test.ts
//
// Tests that getDefaultCountUnit returns count units (not volume
// units) and that the Kale Leaf default is correctly resolved.
// ─────────────────────────────────────────────────────────────

import {
  getDefaultCountUnit,
  getDefaultPortionUnit,
  getDefaultSizeForUnit,
  getSupportedCountUnits,
} from '../producePortionConversion'

describe('getDefaultCountUnit', () => {
  test('kale default count unit is leaf (not loose_cup)', () => {
    const unit = getDefaultCountUnit('kale')
    expect(unit).not.toBeNull()
    expect(unit!.unitKey).toBe('leaf')
  })

  test('kale default portion unit is loose_cup (volume family)', () => {
    const unit = getDefaultPortionUnit('kale')
    expect(unit).not.toBeNull()
    expect(unit!.unitKey).toBe('loose_cup')
  })

  test('kale count units exclude loose_cup', () => {
    const countUnits = getSupportedCountUnits('kale')
    const unitKeys = countUnits.map((u) => u.unitKey)
    expect(unitKeys).not.toContain('loose_cup')
    expect(unitKeys).toContain('leaf')
  })

  test('spinach default count unit is handful (not loose_cup)', () => {
    const unit = getDefaultCountUnit('spinach')
    expect(unit).not.toBeNull()
    // spinach has handful and loose_cup; handful is not a volume family
    // so it should be the first count unit
    expect(unit!.unitKey).toBe('handful')
  })

  test('getDefaultCountUnit returns null for unsupported produce', () => {
    const unit = getDefaultCountUnit('nonexistent_produce')
    expect(unit).toBeNull()
  })
})

describe('getDefaultSizeForUnit', () => {
  test('kale leaf unit returns medium as default size', () => {
    const countUnits = getSupportedCountUnits('kale')
    const leafUnit = countUnits.find((u) => u.unitKey === 'leaf')
    expect(leafUnit).toBeDefined()
    const defaultSize = getDefaultSizeForUnit(leafUnit!)
    expect(defaultSize).toBe('medium')
  })

  test('kale loose_cup unit returns null (standard only)', () => {
    const allUnits = getDefaultPortionUnit('kale') // loose_cup
    const defaultSize = getDefaultSizeForUnit(allUnits!)
    expect(defaultSize).toBeNull()
  })

  test('spinach handful unit returns null (standard only)', () => {
    const countUnits = getSupportedCountUnits('spinach')
    const handfulUnit = countUnits.find((u) => u.unitKey === 'handful')
    expect(handfulUnit).toBeDefined()
    const defaultSize = getDefaultSizeForUnit(handfulUnit!)
    expect(defaultSize).toBeNull()
  })
})
