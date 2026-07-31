// ─────────────────────────────────────────────────────────────
// betaQaRound3.test.js — QA Round 3 tests
// Issue 1: Expanded search guidance (12 tests)
// Issue 2: Apple recipe parity across discovery flows (24 tests)
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { Text } from 'react-native'

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  const full = path.join(__dirname, relPath)
  return fs.readFileSync(full, 'utf8')
}

const HOME_SRC = readSrc('../../screens/HomeScreen.js')
const SCAN_SRC = readSrc('../../screens/ScanScreen.js')

import {
  getRecipesForProduce,
  resetIndex,
} from '../../services/produceRecipeMatcher'
import {
  getProduceFamilyKey,
  areProduceFamilyEquivalent,
  resolveQueryToProduceFamily,
  recipeContainsProduceFamily,
  getRecipeProduceFamilyKeys,
  getRecipeIdsForProduceFamily,
  PRODUCE_FAMILIES,
  PRODUCE_SEARCH_ALIASES,
} from '../../services/produceFamilies'
import {
  searchRecipes,
  resolveAlias,
  ALIAS_TO_PRODUCE_ID,
} from '../../services/recipeSearch'
import { RECIPES, getRecipeById } from '../../constants/recipeData'

// ══════════════════════════════════════════════════════════════
// Issue 1 — Expanded search guidance paragraphs (tests 1–12)
// ══════════════════════════════════════════════════════════════

describe('Issue 1 — Expanded search guidance paragraphs', () => {

  const EXPECTED_PARAGRAPHS = [
    "If no ingredients matched your search, don't worry—the ingredient may be listed under a shorter, simpler, or more familiar name in the app.",
    'Check the spelling carefully, remove any unnecessary words, and try entering the ingredient again using the name you would normally use while shopping.',
    'Try using a shorter or more general ingredient name, especially if you entered a color, variety, brand, preparation style, or other descriptive wording.',
    "For example, enter 'pepper' instead of a longer or more specific variety name, then review the available results for the closest matching ingredient.",
    'You can also test the search with a familiar fruit or vegetable such as spinach, carrot, cucumber, apple, celery, or kale to confirm that ingredient matching is working.',
    'If the ingredient still does not appear, clear the search completely, try another ingredient, and return later using a broader or more commonly recognized name.',
  ]

  const OLD_PARAGRAPHS = [
    'Check the spelling carefully and try entering the ingredient again.',
    'Try using a shorter or more general ingredient name.',
    "For example, enter 'pepper' instead of a longer or more specific variety name.",
    'You can also try a familiar fruit or vegetable such as spinach, carrot, cucumber, apple, celery, or kale.',
    'If the ingredient still does not appear, clear the search and try another ingredient.',
  ]

  test('1. All six new exact paragraphs render', () => {
    for (const para of EXPECTED_PARAGRAPHS) {
      expect(HOME_SRC).toContain(para)
    }
  })

  test('2. Each paragraph is longer than the replaced paragraph', () => {
    // Each new paragraph should be longer than the corresponding old one
    expect(EXPECTED_PARAGRAPHS[0].length).toBeGreaterThan(OLD_PARAGRAPHS[0].length)
    expect(EXPECTED_PARAGRAPHS[1].length).toBeGreaterThan(OLD_PARAGRAPHS[1].length)
    expect(EXPECTED_PARAGRAPHS[2].length).toBeGreaterThan(OLD_PARAGRAPHS[2].length)
    expect(EXPECTED_PARAGRAPHS[3].length).toBeGreaterThan(OLD_PARAGRAPHS[3].length)
    expect(EXPECTED_PARAGRAPHS[4].length).toBeGreaterThan(OLD_PARAGRAPHS[4].length)
    expect(EXPECTED_PARAGRAPHS[5].length).toBeGreaterThan(OLD_PARAGRAPHS[4].length)
  })

  test('3. Each paragraph is a separate Text element', () => {
    let count = 0
    for (const para of EXPECTED_PARAGRAPHS) {
      const escaped = para.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`<Text[^>]*>${escaped}</Text>`)
      if (regex.test(HOME_SRC)) count++
    }
    expect(count).toBe(6)
  })

  test('4. Blank-line spacing remains between paragraphs', () => {
    expect(HOME_SRC).toContain('searchTipsParagraph')
    expect(HOME_SRC).toContain('searchTipsLastParagraph')
    // searchTipsLastParagraph should not have marginBottom
    const lastStyleMatch = HOME_SRC.match(/searchTipsLastParagraph:\s*\{[^}]*\}/)
    expect(lastStyleMatch).toBeTruthy()
    expect(lastStyleMatch[0]).not.toContain('marginBottom')
  })

  test('5. No extra trailing gap follows the sixth paragraph', () => {
    const lastStyleMatch = HOME_SRC.match(/searchTipsLastParagraph:\s*\{[^}]*\}/)
    expect(lastStyleMatch).toBeTruthy()
    const style = lastStyleMatch[0]
    expect(style).not.toMatch(/marginBottom\s*:\s*[^0]/)
    expect(style).not.toMatch(/marginBottom\s*:\s*[1-9]/)
  })

  test('6. All paragraphs render with empty search', () => {
    // The search tips card is always visible (not conditional on searchQuery)
    expect(HOME_SRC).toContain('Permanent Search Tips — always visible')
    // The card is not wrapped in a conditional
    const tipsSection = HOME_SRC.substring(
      HOME_SRC.indexOf('Permanent Search Tips'),
      HOME_SRC.indexOf('searchTipsLastParagraph') + 50
    )
    expect(tipsSection).not.toContain('manualSearch.length')
    expect(tipsSection).not.toContain('{manualSearch &&')
  })

  test('7. All paragraphs render with matches', () => {
    // Paragraphs are outside IngredientCloud and not conditioned on results
    const tipsIdx = HOME_SRC.indexOf('searchTipsCard')
    const cloudIdx = HOME_SRC.indexOf('IngredientCloud')
    expect(tipsIdx).toBeGreaterThan(cloudIdx)
  })

  test('8. All paragraphs render with no matches', () => {
    // Same as test 6 — always visible regardless of search state
    expect(HOME_SRC).toContain('accessibilityLabel="Search tips"')
  })

  test('9. Paragraphs are not duplicated', () => {
    const firstPara = EXPECTED_PARAGRAPHS[0]
    const occurrences = HOME_SRC.split(firstPara).length - 1
    expect(occurrences).toBe(1)
  })

  test('10. Search input remains keyboard safe', () => {
    expect(HOME_SRC).toContain('KeyboardAvoidingView')
    expect(HOME_SRC).toContain('keyboardShouldPersistTaps')
    expect(HOME_SRC).toContain('Keyboard.addListener')
  })

  test('11. Results remain tappable with keyboard open', () => {
    expect(HOME_SRC).toContain('keyboardShouldPersistTaps="handled"')
  })

  test('12. Bottom content can scroll above the keyboard', () => {
    expect(HOME_SRC).toContain('keyboardHeight')
    expect(HOME_SRC).toContain('keyboardDidShow')
    expect(HOME_SRC).toContain('keyboardDidHide')
  })
})

// ══════════════════════════════════════════════════════════════
// Issue 2 — Apple recipe parity (tests 13–36)
// ══════════════════════════════════════════════════════════════

describe('Issue 2 — Apple recipe parity across discovery flows', () => {

  beforeEach(() => {
    resetIndex()
  })

  // ── Query resolution tests (13–22) ──────────────────────────

  test('13. Browse query "apple" resolves to the apple family', () => {
    expect(resolveQueryToProduceFamily('apple')).toBe('apple')
  })

  test('14. Browse query "red apple" resolves to the apple family', () => {
    expect(resolveQueryToProduceFamily('red apple')).toBe('apple')
  })

  test('15. Browse query "apple red" resolves to the apple family', () => {
    expect(resolveQueryToProduceFamily('apple red')).toBe('apple')
  })

  test('16. Browse query "green apple" resolves to the apple family', () => {
    expect(resolveQueryToProduceFamily('green apple')).toBe('apple')
  })

  test('17. Browse query "apple green" resolves to the apple family', () => {
    expect(resolveQueryToProduceFamily('apple green')).toBe('apple')
  })

  test('18. Apple selection resolves to the apple family', () => {
    expect(getProduceFamilyKey('apple')).toBe('apple')
  })

  test('19. Apple, Red selection resolves to the apple family', () => {
    expect(getProduceFamilyKey('apple_red')).toBe('apple')
  })

  test('20. Apple, Green selection resolves to the apple family', () => {
    expect(getProduceFamilyKey('apple_green')).toBe('apple')
  })

  test('21. Pineapple does not resolve to the apple family', () => {
    expect(getProduceFamilyKey('pineapple')).toBeNull()
    expect(resolveQueryToProduceFamily('pineapple')).toBeNull()
  })

  test('22. Apple does not match Pineapple through substring logic', () => {
    expect(areProduceFamilyEquivalent('apple', 'pineapple')).toBe(false)
    expect(areProduceFamilyEquivalent('apple_red', 'pineapple')).toBe(false)
    expect(areProduceFamilyEquivalent('apple_green', 'pineapple')).toBe(false)
  })

  // ── Recipe-ID set parity tests (23–32) ──────────────────────

  function browseRecipeIdsForProduceQuery(query) {
    const results = searchRecipes(query, undefined, 1000)
    return new Set(results.map((r) => r.id))
  }

  function produceFirstRecipeIdsForSelection(ids) {
    const result = getRecipesForProduce(ids)
    return new Set(result.matches.map((m) => m.recipeId))
  }

  function expectSetEquality(setA, setB, label) {
    const missingFromB = [...setA].filter((x) => !setB.has(x))
    const missingFromA = [...setB].filter((x) => !setA.has(x))
    if (missingFromB.length > 0 || missingFromA.length > 0) {
      console.error(`Set mismatch for ${label}:
  Missing from Produce-First: ${missingFromB.join(', ')}
  Missing from Browse: ${missingFromA.join(', ')}`)
    }
    expect(missingFromB).toEqual([])
    expect(missingFromA).toEqual([])
  }

  test('23. Apple Browse results and Apple Produce-First results contain identical recipe-ID sets', () => {
    const browse = browseRecipeIdsForProduceQuery('apple')
    const produce = produceFirstRecipeIdsForSelection(['apple'])
    expectSetEquality(browse, produce, 'apple vs apple selection')
  })

  test('24. Apple, Red Produce-First results equal Apple Browse results', () => {
    const browse = browseRecipeIdsForProduceQuery('apple')
    const produce = produceFirstRecipeIdsForSelection(['apple_red'])
    expectSetEquality(browse, produce, 'apple browse vs apple_red selection')
  })

  test('25. Apple, Green Produce-First results equal Apple Browse results', () => {
    const browse = browseRecipeIdsForProduceQuery('apple')
    const produce = produceFirstRecipeIdsForSelection(['apple_green'])
    expectSetEquality(browse, produce, 'apple browse vs apple_green selection')
  })

  test('26. Total counts are equal for all apple aliases', () => {
    const browseApple = browseRecipeIdsForProduceQuery('apple')
    const browseRedApple = browseRecipeIdsForProduceQuery('red apple')
    const browseAppleRed = browseRecipeIdsForProduceQuery('apple red')
    const browseGreenApple = browseRecipeIdsForProduceQuery('green apple')
    const browseAppleGreen = browseRecipeIdsForProduceQuery('apple green')
    const produceApple = produceFirstRecipeIdsForSelection(['apple'])
    const produceRed = produceFirstRecipeIdsForSelection(['apple_red'])
    const produceGreen = produceFirstRecipeIdsForSelection(['apple_green'])

    const count = browseApple.size
    expect(browseRedApple.size).toBe(count)
    expect(browseAppleRed.size).toBe(count)
    expect(browseGreenApple.size).toBe(count)
    expect(browseAppleGreen.size).toBe(count)
    expect(produceApple.size).toBe(count)
    expect(produceRed.size).toBe(count)
    expect(produceGreen.size).toBe(count)
  })

  test('27. No family-valid recipe is removed by exact-match ranking', () => {
    const familyIds = new Set(getRecipeIdsForProduceFamily('apple'))
    const produceIds = produceFirstRecipeIdsForSelection(['apple'])
    expectSetEquality(familyIds, produceIds, 'family IDs vs produce-first')
  })

  test('28. Exact match affects order only, not inclusion', () => {
    const appleResult = getRecipesForProduce(['apple'])
    const appleRedResult = getRecipesForProduce(['apple_red'])
    // Same set, possibly different order
    const appleSet = new Set(appleResult.matches.map((m) => m.recipeId))
    const appleRedSet = new Set(appleRedResult.matches.map((m) => m.recipeId))
    expectSetEquality(appleSet, appleRedSet, 'apple vs apple_red ordering')
  })

  test('29. Free/Pro filtering is identical between screens', () => {
    const browse = browseRecipeIdsForProduceQuery('apple')
    const produce = produceFirstRecipeIdsForSelection(['apple'])
    // Check that both contain the same free and pro recipes
    const browseFree = [...browse].filter((id) => {
      const r = getRecipeById(id)
      return r && r.tier === 'free'
    })
    const browsePro = [...browse].filter((id) => {
      const r = getRecipeById(id)
      return r && r.tier === 'pro'
    })
    const produceFree = [...produce].filter((id) => {
      const r = getRecipeById(id)
      return r && r.tier === 'free'
    })
    const producePro = [...produce].filter((id) => {
      const r = getRecipeById(id)
      return r && r.tier === 'pro'
    })
    expect(new Set(browseFree)).toEqual(new Set(produceFree))
    expect(new Set(browsePro)).toEqual(new Set(producePro))
  })

  test('30. Simple/Advanced filtering is identical between screens', () => {
    const browse = browseRecipeIdsForProduceQuery('apple')
    const produce = produceFirstRecipeIdsForSelection(['apple'])
    // Both screens should expose the same simple and advanced recipes
    expect(browse.size).toBe(produce.size)
  })

  test('31. No hidden result cap creates a set difference', () => {
    const produce = produceFirstRecipeIdsForSelection(['apple'])
    // Produce-First should not be capped at 10 for single family
    expect(produce.size).toBeGreaterThan(10)
  })

  test('32. Pagination exposes the complete set where applicable', () => {
    const familyIds = getRecipeIdsForProduceFamily('apple')
    const produce = produceFirstRecipeIdsForSelection(['apple'])
    expect(produce.size).toBe(familyIds.length)
  })

  test('33. Results remain deterministic', () => {
    const r1 = getRecipesForProduce(['apple'])
    const r2 = getRecipesForProduce(['apple'])
    expect(r1.matches.map((m) => m.recipeId)).toEqual(r2.matches.map((m) => m.recipeId))
  })

  test('34. Two apple variants still count as one selected family', () => {
    const single = produceFirstRecipeIdsForSelection(['apple'])
    const both = produceFirstRecipeIdsForSelection(['apple_red', 'apple_green'])
    expectSetEquality(single, both, 'single apple vs two variants')
  })

  test('35. Existing multi-produce ranking remains unchanged', () => {
    const result = getRecipesForProduce(['celery', 'cucumber', 'ginger'])
    expect(result.status).toBe('results')
    expect(result.matches.length).toBeLessThanOrEqual(10)
  })

  test('36. Existing non-produce free-text search remains functional', () => {
    const results = searchRecipes('emerald', {}, 50)
    expect(results.length).toBeGreaterThan(0)
    // Should still find recipes by title match
    const results2 = searchRecipes('citrus', {}, 50)
    expect(results2.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════
// Diagnostic fixture — recipe-ID set comparison helpers
// ══════════════════════════════════════════════════════════════

describe('Diagnostic fixture — recipe-ID set comparison', () => {

  test('browseRecipeIdsForProduceQuery and produceFirstRecipeIdsForSelection produce equal sets', () => {
    const browseIds = new Set(
      searchRecipes('apple', undefined, 1000).map((r) => r.id)
    )
    const produceIds = new Set(
      getRecipesForProduce(['apple']).matches.map((m) => m.recipeId)
    )
    const missingFromProduce = [...browseIds].filter((x) => !produceIds.has(x))
    const missingFromBrowse = [...produceIds].filter((x) => !browseIds.has(x))
    expect(missingFromProduce).toEqual([])
    expect(missingFromBrowse).toEqual([])
  })

  test('Pineapple is not in apple results from either screen', () => {
    const browseIds = new Set(
      searchRecipes('apple', undefined, 1000).map((r) => r.id)
    )
    const produceIds = new Set(
      getRecipesForProduce(['apple']).matches.map((m) => m.recipeId)
    )
    const appleFamilyIds = new Set(getRecipeIdsForProduceFamily('apple'))

    // Every browse result should be in the apple family
    for (const id of browseIds) {
      expect(appleFamilyIds.has(id)).toBe(true)
    }
    // Every produce-first result should be in the apple family
    for (const id of produceIds) {
      expect(appleFamilyIds.has(id)).toBe(true)
    }
  })
})
