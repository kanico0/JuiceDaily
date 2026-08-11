// ─────────────────────────────────────────────────────────────
// comboAuditExactCount.test.js — Programmatically verifies the
// exact launchable vs non-launchable count for all Today's Focus
// combos against the authoritative comboToProduceIds resolver.
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

  test('launchable count is 17', () => {
    expect(launchable.length).toBe(17)
  })

  test('non-launchable count is 15', () => {
    expect(nonLaunchable.length).toBe(15)
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

  test('every non-launchable combo has at least one unresolved ingredient', () => {
    for (const c of nonLaunchable) {
      const { produceIds } = comboToProduceIds(c.combo)
      const ingredientCount = c.combo.split('+').map((s) => s.trim()).length
      expect(produceIds.length).toBeLessThan(ingredientCount)
    }
  })

  test('partially resolvable combos are NOT launchable', () => {
    for (const c of nonLaunchable) {
      const { produceIds } = comboToProduceIds(c.combo)
      // Some ingredients may resolve but not all
      expect(produceIds.length).toBeGreaterThan(0)
      expect(isComboLaunchable(c.combo)).toBe(false)
    }
  })

  // ── List all launchable combos ──
  test('launchable combos list', () => {
    const list = launchable.map((c) => c.combo)
    // Snapshot the exact list for documentation
    expect(list).toEqual([
      'Orange + Red Pepper + Pineapple',
      'Kiwi + Strawberry + Lemon',
      'Apple + Celery + Ginger',
      'Pear + Spinach + Cucumber',
      'Sweet Potato + Orange + Carrot',
      'Spinach + Beet + Orange',
      'Carrot + Mango + Turmeric',
      'Sweet Potato + Ginger + Orange',
      'Swiss Chard + Pineapple + Mint',
      'Spinach + Lemon + Beet',
      'Kale + Orange + Ginger',
      'Blueberry + Pomegranate + Beet',
      'Kale + Cucumber + Apple',
      'Broccoli + Parsley + Lemon',
      'Beet + Orange + Ginger',
      'Tomato + Watermelon + Basil',
      'Red Grapefruit + Carrot + Ginger',
    ])
  })

  // ── List all non-launchable combos with unresolved ingredients ──
  test('non-launchable combos list', () => {
    const list = nonLaunchable.map((c) => c.combo)
    expect(list).toEqual([
      'Banana + Spinach + Coconut Water',
      'Kale + Avocado + Lemon',
      'Spinach + Banana + Cacao',
      'Acai + Grape + Ginger',
      'Flaxseed + Spinach + Apple',
      'Chia + Walnut Milk + Blueberry',
      'Hemp Seed + Spinach + Banana',
      'Pea Protein + Mango + Coconut',
      'Avocado + Spinach + Mango',
      'Almond Milk + Kiwi + Banana',
      'Pumpkin Seed + Spinach + Orange',
      'Cashew Milk + Ginger + Turmeric',
      'Banana + Spinach + Nutritional Yeast',
      'Kale + Orange + Almond Milk',
      'Broccoli + Fig + Sesame',
    ])
  })
})
