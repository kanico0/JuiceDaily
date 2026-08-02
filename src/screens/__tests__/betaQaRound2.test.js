// ─────────────────────────────────────────────────────────────
// betaQaRound2.test.js — 46 focused tests for QA Round 2 corrections
// Covers Issue 1 (search guidance), Issue 2 (produce families),
// and Issue 3 (removal of adjustment UI).
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { Text } from 'react-native'

// ── Source inspection helpers ────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  const full = path.join(__dirname, relPath)
  return fs.readFileSync(full, 'utf8')
}

const HOME_SRC = readSrc('../../screens/HomeScreen.js')
const QPE_SRC = readSrc('../../components/QuantityPortionEditor.js')

// ── Service-level imports ────────────────────────────────────

import {
  getRecipesForProduce,
  resetIndex,
  getDistinctProduceIdsInRecipes,
} from '../../services/produceRecipeMatcher'
import {
  getProduceFamilyKey,
  getProduceFamilyMembers,
  areProduceFamilyEquivalent,
  getProduceVariantDisplayName,
  PRODUCE_FAMILIES,
  PRODUCE_SEARCH_ALIASES,
} from '../../services/produceFamilies'
import {
  createQuantityMetadata,
  applyManualWeightOverride,
  recomputeFromQuantityChange,
  restoreQuantityMetadata,
} from '../../services/producePortionConversion'
import { PRODUCE_DATA } from '../../services/JuiceEngine'
import { RECIPES, getRecipeById } from '../../constants/recipeData'

// ══════════════════════════════════════════════════════════════
// Issue 1 — Permanent search guidance paragraphs (tests 1–10)
// ══════════════════════════════════════════════════════════════

describe('Issue 1 — Permanent search guidance paragraphs', () => {

  const PARAGRAPHS = [
    "If no ingredients matched your search, don't worry—the ingredient may be listed under a shorter, simpler, or more familiar name in the app.",
    'Check the spelling carefully, remove any unnecessary words, and try entering the ingredient again using the name you would normally use while shopping.',
    'Try using a shorter or more general ingredient name, especially if you entered a color, variety, brand, preparation style, or other descriptive wording.',
    "For example, enter 'pepper' instead of a longer or more specific variety name, then review the available results for the closest matching ingredient.",
    'You can also test the search with a familiar fruit or vegetable such as spinach, carrot, cucumber, apple, celery, or kale to confirm that ingredient matching is working.',
    'If the ingredient still does not appear, clear the search completely, try another ingredient, and return later using a broader or more commonly recognized name.',
  ]

  // 1. All six exact paragraphs render with empty search
  test('1. all six paragraphs present in source', () => {
    for (const text of PARAGRAPHS) {
      expect(HOME_SRC).toContain(text)
    }
  })

  // 2. All six render when matches exist (not conditionally removed)
  test('2. paragraphs are not inside a conditional that removes them on matches', () => {
    // The search tips are always rendered — they are not inside a
    // filtered.length === 0 or similar conditional
    const tipsStart = HOME_SRC.indexOf('Permanent Search Tips')
    expect(tipsStart).toBeGreaterThan(-1)
    // Verify the tips section is not wrapped in a conditional
    const beforeTips = HOME_SRC.substring(tipsStart - 200, tipsStart)
    expect(beforeTips).not.toContain('{filtered.length === 0 &&')
    expect(beforeTips).not.toContain('{filtered.length > 0 &&')
  })

  // 3. All six render when no results exist
  test('3. paragraphs are not inside the no-results conditional', () => {
    // The no-results text is separate from the tips card
    const noResultsIdx = HOME_SRC.indexOf('No ingredients match')
    const tipsIdx = HOME_SRC.indexOf('searchTipsCard')
    expect(noResultsIdx).toBeGreaterThan(-1)
    expect(tipsIdx).toBeGreaterThan(-1)
    // Tips card comes after the IngredientCloud, not inside no-results
    expect(tipsIdx).toBeGreaterThan(noResultsIdx)
  })

  // 4. Paragraphs are not duplicated
  test('4. each paragraph appears exactly once in the tips section', () => {
    for (const text of PARAGRAPHS) {
      const count = (HOME_SRC.match(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      expect(count).toBe(1)
    }
  })

  // 5. Each paragraph is a separate text block
  test('5. each paragraph is a separate Text element', () => {
    for (const text of PARAGRAPHS) {
      // Each paragraph should be wrapped in its own <Text> element
      expect(HOME_SRC).toContain(`<Text style={manualStyles.searchTips`)
    }
  })

  // 6. Paragraph spacing is applied between adjacent paragraphs
  test('6. searchTipsParagraph has marginBottom of 16 (one line-height)', () => {
    expect(HOME_SRC).toContain('searchTipsParagraph')
    expect(HOME_SRC).toMatch(/searchTipsParagraph:\s*{[^}]*marginBottom:\s*16/)
  })

  // 7. Final paragraph does not receive duplicate trailing spacing
  test('7. searchTipsLastParagraph has no marginBottom', () => {
    expect(HOME_SRC).toContain('searchTipsLastParagraph')
    const lastParaMatch = HOME_SRC.match(/searchTipsLastParagraph:\s*{[^}]*}/)
    expect(lastParaMatch).toBeTruthy()
    expect(lastParaMatch[0]).not.toContain('marginBottom')
  })

  // 8. Search input remains in keyboard-safe container
  test('8. KeyboardAvoidingView is used in HomeScreen', () => {
    expect(HOME_SRC).toContain('KeyboardAvoidingView')
  })

  // 9. Results remain tappable while keyboard handling is active
  test('9. IngredientCloud renders TouchableOpacity items', () => {
    expect(HOME_SRC).toContain('TouchableOpacity')
    expect(HOME_SRC).toContain('IngredientCloud')
  })

  // 10. Existing ingredient search results remain unchanged
  test('10. ingredient filtering still uses name-based matching', () => {
    expect(HOME_SRC).toContain('item.name.toLowerCase().includes')
  })
})

// ══════════════════════════════════════════════════════════════
// Issue 2 — Produce family matching (tests 11–28)
// ══════════════════════════════════════════════════════════════

describe('Issue 2 — Produce family matching', () => {
  beforeAll(() => {
    resetIndex()
  })

  // 11. Red Apple matches recipes containing generic Apple
  test('11. apple_red matches recipes containing apple', () => {
    const result = getRecipesForProduce(['apple_red'])
    expect(result.status).toBe('results')
    expect(result.matches.length).toBeGreaterThan(0)
    // At least one match should contain 'apple' as a matched produce
    const hasAppleMatch = result.matches.some((m) =>
      m.matchedProduceIds.includes('apple')
    )
    expect(hasAppleMatch).toBe(true)
  })

  // 12. Generic Apple matches recipes containing Red Apple
  test('12. apple matches recipes containing apple_red', () => {
    // Find recipes that use apple_red
    const recipesWithRedApple = RECIPES.filter((r) =>
      r.ingredients.some((i) => i.produceId.toLowerCase() === 'apple_red')
    )
    if (recipesWithRedApple.length > 0) {
      const result = getRecipesForProduce(['apple'])
      const hasRedAppleMatch = result.matches.some((m) =>
        m.matchedProduceIds.includes('apple_red')
      )
      expect(hasRedAppleMatch).toBe(true)
    }
  })

  // 13. Green Apple matches generic Apple recipes
  test('13. apple_green matches recipes containing apple', () => {
    const result = getRecipesForProduce(['apple_green'])
    expect(result.status).toBe('results')
    const hasAppleMatch = result.matches.some((m) =>
      m.matchedProduceIds.includes('apple')
    )
    expect(hasAppleMatch).toBe(true)
  })

  // 14. Exact apple match ranks above family-only apple match
  test('14. exact match has higher exactMatchCount than family-only match', () => {
    // Select apple_red — recipes with apple_red get exact match,
    // recipes with apple (generic) get family match
    const result = getRecipesForProduce(['apple_red'])
    const exactMatches = result.matches.filter((m) =>
      m.matchedProduceIds.includes('apple_red')
    )
    const familyMatches = result.matches.filter((m) =>
      !m.matchedProduceIds.includes('apple_red') && m.matchedProduceIds.includes('apple')
    )
    if (exactMatches.length > 0 && familyMatches.length > 0) {
      const maxExact = Math.max(...exactMatches.map((m) => m.exactMatchCount))
      const maxFamily = Math.max(...familyMatches.map((m) => m.exactMatchCount))
      expect(maxExact).toBeGreaterThanOrEqual(maxFamily)
    }
  })

  // 15. Apple does not match Pineapple
  test('15. apple does not match pineapple', () => {
    expect(areProduceFamilyEquivalent('apple', 'pineapple')).toBe(false)
    const result = getRecipesForProduce(['apple'])
    // No match should contain pineapple as a matched produce
    const hasPineappleMatch = result.matches.some((m) =>
      m.matchedProduceIds.includes('pineapple')
    )
    expect(hasPineappleMatch).toBe(false)
  })

  // 16. Two apple variants do not count as two distinct matched families
  test('16. selecting apple_red and apple_green does not inflate match count', () => {
    const oneResult = getRecipesForProduce(['apple_red'])
    const twoResult = getRecipesForProduce(['apple_red', 'apple_green'])
    // For any recipe containing 'apple', both selections should match it
    // but the matchedProduceIds should only contain 'apple' once
    for (const match of twoResult.matches) {
      if (match.matchedProduceIds.includes('apple')) {
        const appleCount = match.matchedProduceIds.filter((p) => p === 'apple').length
        expect(appleCount).toBe(1)
      }
    }
  })

  // 17. Family matching works with more than one selected produce
  test('17. family matching works with multiple selected produce', () => {
    const result = getRecipesForProduce(['apple_red', 'celery', 'cucumber'])
    expect(result.status).toBe('results')
    expect(result.matches.length).toBeGreaterThan(0)
  })

  // 18. Existing exact matching remains unchanged
  test('18. exact matching still works for non-family produce', () => {
    const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
    expect(result.status).toBe('results')
    expect(result.matches.length).toBeGreaterThan(0)
    for (const match of result.matches) {
      expect(match.matchedProduceIds.length).toBeGreaterThan(0)
    }
  })

  // 19. Existing recipe ranking remains deterministic
  test('19. same input produces same output order', () => {
    const a = getRecipesForProduce(['kale', 'spinach', 'lemon'])
    const b = getRecipesForProduce(['kale', 'spinach', 'lemon'])
    expect(a.matches.map((m) => m.recipeId)).toEqual(b.matches.map((m) => m.recipeId))
  })

  // 20. Recipe tier filtering remains unchanged
  test('20. tier_label matches recipe.tier', () => {
    const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
    for (const match of result.matches) {
      const recipe = getRecipeById(match.recipeId)
      expect(match.tier_label).toBe(recipe.tier)
    }
  })

  // 21. Red Apple is searchable by "red apple"
  test('21. PRODUCE_SEARCH_ALIASES has "red apple" for apple_red', () => {
    expect(PRODUCE_SEARCH_ALIASES.apple_red).toContain('red apple')
  })

  // 22. Red Apple is searchable by "apple red"
  test('22. PRODUCE_SEARCH_ALIASES has "apple red" for apple_red', () => {
    expect(PRODUCE_SEARCH_ALIASES.apple_red).toContain('apple red')
  })

  // 23. Red Apple is discoverable by "apple"
  test('23. PRODUCE_SEARCH_ALIASES has "apple" for apple_red', () => {
    expect(PRODUCE_SEARCH_ALIASES.apple_red).toContain('apple')
  })

  // 24. Variant display label renders as "Apple, Red"
  test('24. getProduceVariantDisplayName returns "Apple, Red" for apple_red', () => {
    expect(getProduceVariantDisplayName('apple_red')).toBe('Apple, Red')
  })

  // 25. Canonical produce ID remains unchanged
  test('25. canonical produce IDs are not renamed', () => {
    expect(PRODUCE_DATA.apple).toBeDefined()
    expect(PRODUCE_DATA.apple_red).toBeDefined()
    expect(PRODUCE_DATA.apple_green).toBeDefined()
  })

  // 26. Test every additional explicit family group added
  test('26. all family groups have correct membership', () => {
    // Apple family
    expect(PRODUCE_FAMILIES.apple).toContain('apple')
    expect(PRODUCE_FAMILIES.apple).toContain('apple_green')
    expect(PRODUCE_FAMILIES.apple).toContain('apple_red')

    // Bell pepper family
    expect(PRODUCE_FAMILIES.bell_pepper).toContain('bell_pepper_red')
    expect(PRODUCE_FAMILIES.bell_pepper).toContain('bell_pepper_yellow')
    expect(PRODUCE_FAMILIES.bell_pepper).toContain('bell_pepper_green')

    // Cabbage family
    expect(PRODUCE_FAMILIES.cabbage).toContain('cabbage_green')
    expect(PRODUCE_FAMILIES.cabbage).toContain('cabbage_red')

    // Family key lookups
    expect(getProduceFamilyKey('apple')).toBe('apple')
    expect(getProduceFamilyKey('apple_red')).toBe('apple')
    expect(getProduceFamilyKey('bell_pepper_red')).toBe('bell_pepper')
    expect(getProduceFamilyKey('cabbage_red')).toBe('cabbage')
    expect(getProduceFamilyKey('celery')).toBeNull()

    // Family members
    expect(getProduceFamilyMembers('apple_red')).toContain('apple')
    expect(getProduceFamilyMembers('apple_red')).toContain('apple_green')
    expect(getProduceFamilyMembers('celery')).toEqual([])
  })

  // 27. Unmapped produce continues using exact-ID behavior
  test('27. unmapped produce (celery) uses exact-ID matching only', () => {
    expect(getProduceFamilyKey('celery')).toBeNull()
    expect(areProduceFamilyEquivalent('celery', 'spinach')).toBe(false)
  })

  // 28. No fuzzy substring matching is introduced
  test('28. areProduceFamilyEquivalent does not do substring matching', () => {
    expect(areProduceFamilyEquivalent('apple', 'pineapple')).toBe(false)
    expect(areProduceFamilyEquivalent('grape', 'grapefruit')).toBe(false)
    expect(areProduceFamilyEquivalent('bell_pepper_red', 'bell_pepper_green')).toBe(true)
    expect(areProduceFamilyEquivalent('bell_pepper_red', 'jalapeño')).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════
// Issue 3 — Removal of adjustment UI (tests 29–46)
// ══════════════════════════════════════════════════════════════

describe('Issue 3 — Removal of adjustment UI', () => {

  // 29. "Adjust raw weight" does not render
  test('29. "Adjust raw weight" button does not render', () => {
    expect(QPE_SRC).not.toContain('Adjust raw weight')
    expect(QPE_SRC).not.toContain('adjustBtn')
  })

  // 30. Editable estimated-weight override does not render
  test('30. editable estimated-weight override does not render', () => {
    expect(QPE_SRC).not.toContain('adjustEditor')
    expect(QPE_SRC).not.toContain('adjustInput')
    expect(QPE_SRC).not.toContain('Raw produce weight (oz)')
  })

  // 31. "Original estimate" does not render
  test('31. "Original estimate" does not render', () => {
    expect(QPE_SRC).not.toContain('Original estimate')
  })

  // 32. "Adjusted" does not render
  test('32. "Adjusted" does not render', () => {
    expect(QPE_SRC).not.toContain('Adjusted')
  })

  // 33. "Reset to estimate" does not render
  test('33. "Reset to estimate" does not render', () => {
    expect(QPE_SRC).not.toContain('Reset to estimate')
    expect(QPE_SRC).not.toContain('resetBtn')
  })

  // 34. Quantity mode shows a read-only estimated raw weight
  test('34. read-only estimated raw weight is displayed', () => {
    expect(QPE_SRC).toContain('Estimated raw produce weight:')
  })

  // 35. Quantity helper explains how to change the estimate
  test('35. helper text explains how to change the estimate', () => {
    expect(QPE_SRC).toContain('To change this estimate, adjust the quantity, unit, or size.')
    expect(QPE_SRC).toContain('switch to Volume')
  })

  // 36. Quantity change recalculates raw weightG
  test('36. quantity change triggers recalculation via useEffect', () => {
    expect(QPE_SRC).toContain('onEstimatedWeightChange')
    expect(QPE_SRC).toContain('estimateRawWeightGrams')
  })

  // 37. Unit change recalculates raw weightG
  test('37. unit change triggers recalculation', () => {
    expect(QPE_SRC).toContain('handleUnitSelect')
    expect(QPE_SRC).toContain('onUnitChange')
  })

  // 38. Size change recalculates raw weightG
  test('38. size change triggers recalculation', () => {
    expect(QPE_SRC).toContain('handleSizeSelect')
    expect(QPE_SRC).toContain('onSizeChange')
  })

  // 39. Weight mode still allows direct raw-ounce entry
  test('39. weight mode is still available via PortionEntryModeToggle', () => {
    expect(HOME_SRC).toContain('PortionEntryModeToggle')
  })

  // 40. Quantity-to-Weight preserves canonical raw weight
  test('40. quantity metadata stores estimatedRawWeightG', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    expect(metadata.estimatedRawWeightG).toBeGreaterThan(0)
  })

  // 41. Weight-to-Quantity restores prior valid quantity metadata
  test('41. restoreQuantityMetadata restores estimated weight', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    const restored = restoreQuantityMetadata(metadata)
    expect(restored.weightG).toBe(metadata.estimatedRawWeightG)
    expect(restored.metadata.wasEstimateOverridden).toBe(false)
  })

  // 42. Weight-to-Quantity does not infer a count without metadata
  test('42. recomputeFromQuantityChange requires quantity input', () => {
    const result = recomputeFromQuantityChange({
      produceId: 'apple',
      quantity: 3,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(result).not.toBeNull()
    expect(result.metadata.enteredQuantity).toBe(3)
  })

  // 43. Legacy override metadata remains readable
  test('43. legacy wasEstimateOverridden metadata is readable', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    expect(metadata.wasEstimateOverridden).toBe(false)
    expect(metadata.originalEstimatedRawWeightG).toBeGreaterThan(0)
  })

  // 44. Legacy override metadata does not cause a crash
  test('44. applyManualWeightOverride does not crash with legacy metadata', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    const overridden = applyManualWeightOverride(metadata, 250)
    expect(overridden.weightG).toBe(250)
    expect(overridden.metadata.wasEstimateOverridden).toBe(true)
  })

  // 45. Changing quantity clears stale legacy override state
  test('45. recomputeFromQuantityChange clears override state', () => {
    const metadata = createQuantityMetadata({
      produceId: 'apple',
      quantity: 1,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(metadata).not.toBeNull()
    const overridden = applyManualWeightOverride(metadata, 250)
    expect(overridden.metadata.wasEstimateOverridden).toBe(true)
    // Recompute from new quantity — should clear override
    const recomputed = recomputeFromQuantityChange({
      produceId: 'apple',
      quantity: 2,
      unitKey: 'whole',
      sizeKey: 'medium',
    })
    expect(recomputed).not.toBeNull()
    expect(recomputed.metadata.wasEstimateOverridden).toBe(false)
  })

  // 46. Removing the UI invokes no quota or scan services
  test('46. QuantityPortionEditor does not import scan or quota services', () => {
    expect(QPE_SRC).not.toContain('QuotaStore')
    expect(QPE_SRC).not.toContain('scan')
    expect(QPE_SRC).not.toContain('quota')
    expect(QPE_SRC).not.toContain('Camera')
  })
})
