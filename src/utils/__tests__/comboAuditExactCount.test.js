// ─────────────────────────────────────────────────────────────
// comboAuditExactCount.test.js — Programmatically verifies the
// exact launchable vs non-launchable count for all Today's Focus
// combos against the authoritative comboToProduceIds resolver.
//
// After QA5 corrections, ALL 32 combos are launchable — every
// ingredient resolves to a builder-supported produce ID.
// ─────────────────────────────────────────────────────────────

// Mock AsyncStorage (required by focusNutrient.js)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

import { comboToProduceIds, isComboLaunchable } from '../comboToProduceIds'
import { FOCUS_NUTRIENTS } from '../../services/focusNutrient'

describe("Today's Focus combo audit — exact programmatic count", () => {
  // Flatten all combos from all nutrients
  const allCombos = FOCUS_NUTRIENTS.flatMap((n) =>
    n.combos.map((combo) => ({ nutrientId: n.id, nutrientName: n.name, combo }))
  )

  test('total combo count is 32', () => {
    expect(allCombos.length).toBe(32)
  })

  const launchable = allCombos.filter((c) => isComboLaunchable(c.combo))
  const nonLaunchable = allCombos.filter((c) => !isComboLaunchable(c.combo))

  test('launchable count is 32 (all combos launchable)', () => {
    expect(launchable.length).toBe(32)
  })

  test('non-launchable count is 0', () => {
    expect(nonLaunchable.length).toBe(0)
  })

  test('launchable + non-launchable = total', () => {
    expect(launchable.length + nonLaunchable.length).toBe(allCombos.length)
  })

  test('every launchable combo resolves ALL ingredients', () => {
    for (const c of launchable) {
      const { produceIds } = comboToProduceIds(c.combo)
      const ingredientCount = c.combo.split('+').map((s) => s.trim()).length
      expect(produceIds.length).toBe(ingredientCount)
    }
  })

  test('no combo produces the "unavailable ingredients" warning', () => {
    for (const c of allCombos) {
      const { unmapped } = comboToProduceIds(c.combo)
      expect(unmapped).toEqual([])
    }
  })
})
