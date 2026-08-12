// ─────────────────────────────────────────────────────────────
// comboReferentialIntegrity.test.js
// Verifies that every Suggested Combo ingredient resolves to a
// builder-supported produce ID. No launch combo should produce
// the "some ingredients aren't available in the builder yet"
// warning.
// ─────────────────────────────────────────────────────────────

import { FOCUS_NUTRIENTS } from '../focusNutrient'
import { comboToProduceIds, isComboLaunchable } from '../../utils/comboToProduceIds'
import { PRODUCE_DATA } from '../JuiceEngine'

describe('Today Focus Suggested Combos — referential integrity', () => {
  // Collect all combos from all focus nutrients
  const allCombos = []
  FOCUS_NUTRIENTS.forEach((nutrient) => {
    nutrient.combos.forEach((combo, index) => {
      allCombos.push({ nutrientId: nutrient.id, nutrientName: nutrient.name, combo, index })
    })
  })

  test('every combo is launchable (no unavailable ingredients)', () => {
    const failures = []
    allCombos.forEach(({ nutrientId, nutrientName, combo, index }) => {
      const launchable = isComboLaunchable(combo)
      if (!launchable) {
        const { unmapped } = comboToProduceIds(combo)
        failures.push(`${nutrientName} combo #${index + 1}: "${combo}" — unmapped: ${unmapped.join(', ')}`)
      }
    })
    expect(failures).toEqual([])
  })

  test('every combo ingredient resolves to a PRODUCE_DATA ID', () => {
    allCombos.forEach(({ nutrientName, combo }) => {
      const { produceIds, unmapped } = comboToProduceIds(combo)
      expect(unmapped).toEqual([])
      produceIds.forEach((id) => {
        expect(PRODUCE_DATA[id]).toBeDefined()
      })
    })
  })

  test('no combo contains banana, avocado, cacao, chia, or other unsupported produce', () => {
    // "coconut" alone is unsupported but "coconut water" IS supported.
    // Check for standalone "coconut" not followed by " water".
    const unsupportedPatterns = [
      'banana', 'avocado', 'cacao', 'chia', 'flaxseed', 'hemp seed',
      'walnut milk', 'pea protein', 'almond milk', 'cashew milk',
      'pumpkin seed', 'nutritional yeast', 'fig', 'sesame', 'acai',
    ]
    allCombos.forEach(({ combo }) => {
      const lower = combo.toLowerCase()
      unsupportedPatterns.forEach((name) => {
        expect(lower).not.toContain(name)
      })
      // Check "coconut" is only present as "coconut water"
      if (lower.includes('coconut')) {
        expect(lower).toContain('coconut water')
      }
    })
  })

  test('each combo has at least 2 resolved produce IDs', () => {
    allCombos.forEach(({ combo }) => {
      const { produceIds } = comboToProduceIds(combo)
      expect(produceIds.length).toBeGreaterThanOrEqual(2)
    })
  })

  test('total combo count is preserved (16 nutrients × 2 combos = 32)', () => {
    expect(FOCUS_NUTRIENTS.length).toBe(16)
    expect(allCombos.length).toBe(32)
  })
})
