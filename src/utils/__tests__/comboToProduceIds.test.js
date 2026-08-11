// ─────────────────────────────────────────────────────────────
// comboToProduceIds.test.js — Tests for combo string → produce ID
// resolution. A combo is launchable only if EVERY ingredient
// resolves to a canonical produce ID.
// ─────────────────────────────────────────────────────────────

import { comboToProduceIds, isComboLaunchable } from '../comboToProduceIds'

describe('comboToProduceIds', () => {
  describe('fully resolvable combos', () => {
    test('Orange + Kiwi + Lemon → all resolve', () => {
      const { produceIds, unmapped } = comboToProduceIds('Orange + Kiwi + Lemon')
      expect(produceIds).toContain('orange')
      expect(produceIds).toContain('kiwi')
      expect(produceIds).toContain('lemon')
      expect(unmapped).toHaveLength(0)
    })

    test('Apple + Celery + Ginger → all resolve', () => {
      const { produceIds, unmapped } = comboToProduceIds('Apple + Celery + Ginger')
      expect(produceIds).toContain('apple')
      expect(produceIds).toContain('celery')
      expect(produceIds).toContain('ginger')
      expect(unmapped).toHaveLength(0)
    })

    test('Kale + Cucumber + Apple → all resolve', () => {
      const { produceIds, unmapped } = comboToProduceIds('Kale + Cucumber + Apple')
      expect(produceIds).toContain('kale')
      expect(produceIds).toContain('cucumber')
      expect(produceIds).toContain('apple')
      expect(unmapped).toHaveLength(0)
    })

    test('Sweet Potato + Orange + Carrot → all resolve via alias', () => {
      const { produceIds, unmapped } = comboToProduceIds('Sweet Potato + Orange + Carrot')
      expect(produceIds).toContain('sweet_potato')
      expect(produceIds).toContain('orange')
      expect(produceIds).toContain('carrot')
      expect(unmapped).toHaveLength(0)
    })

    test('Swiss Chard + Pineapple + Mint → all resolve via alias', () => {
      const { produceIds, unmapped } = comboToProduceIds('Swiss Chard + Pineapple + Mint')
      expect(produceIds).toContain('swiss_chard')
      expect(produceIds).toContain('pineapple')
      expect(produceIds).toContain('mint')
      expect(unmapped).toHaveLength(0)
    })

    test('Tomato + Watermelon + Basil → all resolve', () => {
      const { produceIds, unmapped } = comboToProduceIds('Tomato + Watermelon + Basil')
      expect(produceIds).toContain('tomato')
      expect(produceIds).toContain('watermelon')
      expect(produceIds).toContain('basil')
      expect(unmapped).toHaveLength(0)
    })

    test('Beet + Orange + Ginger → all resolve', () => {
      const { produceIds, unmapped } = comboToProduceIds('Beet + Orange + Ginger')
      expect(produceIds).toContain('beet')
      expect(produceIds).toContain('orange')
      expect(produceIds).toContain('ginger')
      expect(unmapped).toHaveLength(0)
    })
  })

  describe('partially resolvable combos (NOT launchable)', () => {
    test('Orange + Cacao + Pineapple → Cacao unmapped', () => {
      const { produceIds, unmapped } = comboToProduceIds('Orange + Cacao + Pineapple')
      expect(produceIds).toContain('orange')
      expect(produceIds).toContain('pineapple')
      expect(unmapped).toContain('Cacao')
      expect(unmapped.length).toBeGreaterThan(0)
    })

    test('Banana + Spinach + Coconut Water → Banana unmapped', () => {
      const { produceIds, unmapped } = comboToProduceIds('Banana + Spinach + Coconut Water')
      // Banana is NOT in PRODUCE_DATA
      expect(unmapped).toContain('Banana')
      // Coconut Water should resolve via alias
      expect(produceIds).toContain('coconut_water')
      expect(unmapped.length).toBeGreaterThan(0)
    })

    test('Kale + Avocado + Lemon → Avocado unmapped', () => {
      const { produceIds, unmapped } = comboToProduceIds('Kale + Avocado + Lemon')
      expect(produceIds).toContain('kale')
      expect(produceIds).toContain('lemon')
      expect(unmapped).toContain('Avocado')
    })

    test('Flaxseed + Spinach + Apple → Flaxseed unmapped', () => {
      const { produceIds, unmapped } = comboToProduceIds('Flaxseed + Spinach + Apple')
      expect(produceIds).toContain('spinach')
      expect(produceIds).toContain('apple')
      expect(unmapped).toContain('Flaxseed')
    })

    test('Hemp Seed + Spinach + Banana → both unmapped', () => {
      const { produceIds, unmapped } = comboToProduceIds('Hemp Seed + Spinach + Banana')
      expect(produceIds).toContain('spinach')
      expect(unmapped).toContain('Hemp Seed')
      expect(unmapped).toContain('Banana')
    })
  })

  describe('isComboLaunchable', () => {
    test('returns true for fully resolvable combo', () => {
      expect(isComboLaunchable('Apple + Celery + Ginger')).toBe(true)
    })

    test('returns false for partially resolvable combo', () => {
      expect(isComboLaunchable('Orange + Cacao + Pineapple')).toBe(false)
    })

    test('returns false for combo with no resolvable ingredients', () => {
      expect(isComboLaunchable('Cacao + Chia + Walnut Milk')).toBe(false)
    })

    test('returns false for empty string', () => {
      expect(isComboLaunchable('')).toBe(false)
    })

    test('returns false for null/undefined', () => {
      expect(isComboLaunchable(null)).toBe(false)
      expect(isComboLaunchable(undefined)).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('single ingredient that resolves', () => {
      const { produceIds, unmapped } = comboToProduceIds('Carrot')
      expect(produceIds).toEqual(['carrot'])
      expect(unmapped).toHaveLength(0)
    })

    test('single ingredient that does not resolve', () => {
      const { produceIds, unmapped } = comboToProduceIds('Cacao')
      expect(produceIds).toHaveLength(0)
      expect(unmapped).toEqual(['Cacao'])
    })

    test('handles extra whitespace around ingredient names', () => {
      const { produceIds, unmapped } = comboToProduceIds('  Apple  +  Celery  +  Ginger  ')
      expect(produceIds).toContain('apple')
      expect(produceIds).toContain('celery')
      expect(produceIds).toContain('ginger')
      expect(unmapped).toHaveLength(0)
    })

    test('returns empty for null input', () => {
      const { produceIds, unmapped } = comboToProduceIds(null)
      expect(produceIds).toHaveLength(0)
      expect(unmapped).toHaveLength(0)
    })

    test('returns empty for undefined input', () => {
      const { produceIds, unmapped } = comboToProduceIds(undefined)
      expect(produceIds).toHaveLength(0)
      expect(unmapped).toHaveLength(0)
    })
  })
})
