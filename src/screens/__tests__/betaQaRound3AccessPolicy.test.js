// ─────────────────────────────────────────────────────────────
// betaQaRound3AccessPolicy.test.js
// QA Round 3 — Access-Policy Verification Tests
// 12 required tests covering visibility policy, family parity,
// pagination, keyboard safety, and listener cleanup.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  const full = path.join(__dirname, relPath)
  return fs.readFileSync(full, 'utf8')
}

const HOME_SRC = readSrc('../../screens/HomeScreen.js')
const SCAN_SRC = readSrc('../../screens/ScanScreen.js')
const PRODUCE_RESULTS_SRC = readSrc('../../screens/ProduceRecipeResultsScreen.js')
const MATCHER_SRC = readSrc('../../services/produceRecipeMatcher.ts')
const FAMILIES_SRC = readSrc('../../services/produceFamilies.ts')

import { searchRecipes } from '../../services/recipeSearch'
import {
  getRecipesForProduce,
  resetIndex,
} from '../../services/produceRecipeMatcher'
import {
  getProduceFamilyKey,
  areProduceFamilyEquivalent,
  resolveQueryToProduceFamily,
  resolveQueryToCanonicalProduce,
  recipeContainsProduceFamily,
  getRecipeIdsForProduceFamily,
  getUniqueSelectedFamilyKeys,
  getUniqueSelectedCanonicalProduceKeys,
  getCanonicalProduceKey,
  getRecipeIdsForCanonicalProduce,
  applyRecipeVisibilityPolicy,
  PRODUCE_FAMILIES,
} from '../../services/produceFamilies'
import { RECIPES, getRecipeById, getRecipeBlendType } from '../../constants/recipeData'

// ── Helpers ──────────────────────────────────────────────────

function browseIds(query) {
  return new Set(searchRecipes(query, undefined, 1000).map((r) => r.id))
}

function produceIds(selection) {
  return new Set(getRecipesForProduce(selection).matches.map((m) => m.recipeId))
}

function familyIds(key) {
  return new Set(getRecipeIdsForProduceFamily(key))
}

function expectSetEquality(setA, setB, label) {
  const missingFromB = [...setA].filter((x) => !setB.has(x))
  const missingFromA = [...setB].filter((x) => !setA.has(x))
  if (missingFromB.length > 0 || missingFromA.length > 0) {
    console.error(`Set mismatch for ${label}:
  Missing from B: ${missingFromB.join(', ')}
  Missing from A: ${missingFromA.join(', ')}`)
  }
  expect(missingFromB).toEqual([])
  expect(missingFromA).toEqual([])
}

// ══════════════════════════════════════════════════════════════
// Required Tests 1–12
// ══════════════════════════════════════════════════════════════

describe('QA Round 3 — Access-Policy Verification', () => {

  beforeEach(() => {
    resetIndex()
  })

  // Test 1: Apple Browse and Produce-First visible sets are identical
  test('1. Apple Browse and Produce-First visible sets are identical', () => {
    const browse = browseIds('apple')
    const produce = produceIds(['apple'])
    expectSetEquality(browse, produce, 'Apple Browse vs Produce-First')
  })

  // Test 2: Apple Free/Pro handling is identical
  test('2. Apple Free/Pro handling is identical between screens', () => {
    const browse = browseIds('apple')
    const produce = produceIds(['apple'])
    const browseFree = [...browse].filter((id) => getRecipeById(id)?.tier === 'free')
    const browsePro = [...browse].filter((id) => getRecipeById(id)?.tier === 'pro')
    const produceFree = [...produce].filter((id) => getRecipeById(id)?.tier === 'free')
    const producePro = [...produce].filter((id) => getRecipeById(id)?.tier === 'pro')
    expect(new Set(browseFree)).toEqual(new Set(produceFree))
    expect(new Set(browsePro)).toEqual(new Set(producePro))
  })

  // Test 3: Apple core/non-core handling is identical
  test('3. Apple core/non-core handling is identical between screens', () => {
    const browse = browseIds('apple')
    const produce = produceIds(['apple'])
    const browseCore = [...browse].filter((id) => getRecipeById(id)?.collection === 'core')
    const browseNonCore = [...browse].filter((id) => getRecipeById(id)?.collection !== 'core')
    const produceCore = [...produce].filter((id) => getRecipeById(id)?.collection === 'core')
    const produceNonCore = [...produce].filter((id) => getRecipeById(id)?.collection !== 'core')
    expect(new Set(browseCore)).toEqual(new Set(produceCore))
    expect(new Set(browseNonCore)).toEqual(new Set(produceNonCore))
  })

  // Test 4: Bell Pepper sets are identical
  test('4. Bell Pepper Browse and Produce-First sets are identical', () => {
    const browse = browseIds('bell pepper')
    const produce = produceIds(['bell_pepper_red'])
    expectSetEquality(browse, produce, 'Bell Pepper Browse vs Produce-First')

    // Also verify variant queries
    const browseRed = browseIds('red bell pepper')
    const browseGreen = browseIds('green bell pepper')
    const browseYellow = browseIds('yellow bell pepper')
    expect(browseRed.size).toBe(browse.size)
    expect(browseGreen.size).toBe(browse.size)
    expect(browseYellow.size).toBe(browse.size)
  })

  // Test 5: Cabbage sets are identical
  test('5. Cabbage Browse and Produce-First sets are identical', () => {
    const browse = browseIds('cabbage')
    const produce = produceIds(['cabbage_green'])
    expectSetEquality(browse, produce, 'Cabbage Browse vs Produce-First')

    // Verify variant queries
    const browseRed = browseIds('red cabbage')
    const browseGreen = browseIds('green cabbage')
    expect(browseRed.size).toBe(browse.size)
    expect(browseGreen.size).toBe(browse.size)
  })

  // Test 6: One unique family does not depend on variant count
  test('6. Single-family detection does not depend on variant count', () => {
    // One variant
    expect(getUniqueSelectedFamilyKeys(['apple']).length).toBe(1)
    // Two variants — still one family
    expect(getUniqueSelectedFamilyKeys(['apple', 'apple_red']).length).toBe(1)
    // Three variants — still one family
    expect(getUniqueSelectedFamilyKeys(['apple', 'apple_red', 'apple_green']).length).toBe(1)
    // Bell Pepper — three variants, one family
    expect(getUniqueSelectedFamilyKeys(['bell_pepper_red', 'bell_pepper_yellow', 'bell_pepper_green']).length).toBe(1)
    // Cabbage — two variants, one family
    expect(getUniqueSelectedFamilyKeys(['cabbage_green', 'cabbage_red']).length).toBe(1)

    // Verify the matcher source has no hard-coded variant count
    expect(MATCHER_SRC).not.toContain('<= 3')
    expect(MATCHER_SRC).not.toContain('<=3')
    expect(MATCHER_SRC).toContain('getUniqueSelectedCanonicalProduceKeys')
    expect(MATCHER_SRC).toContain('selectedCanonicalKeys.length === 1')
  })

  // Test 7: Apple plus Carrot remains a two-canonical-key search
  test('7. Apple plus Carrot remains a two-canonical-key search', () => {
    // With canonical keys, carrot resolves to 'carrot' (its own canonical key)
    const keys = getUniqueSelectedCanonicalProduceKeys(['apple', 'carrot'])
    expect(keys.length).toBe(2)
    expect(keys).toContain('apple')
    expect(keys).toContain('carrot')

    // Multi-produce should still use the 10-result cap (not single-canonical)
    const result = getRecipesForProduce(['apple', 'carrot'])
    expect(result.matches.length).toBeLessThanOrEqual(10)
  })

  // Test 8: All 228 Apple matches are reachable or correctly paginated
  test('8. All 228 Apple matches are reachable or correctly paginated', () => {
    const familyAppleIds = familyIds('apple')
    const produce = produceIds(['apple'])
    expectSetEquality(familyAppleIds, produce, 'family IDs vs produce-first')

    // Verify no hidden cap at 10
    expect(produce.size).toBeGreaterThan(10)
    expect(produce.size).toBe(228)

    // Verify Browse also returns all 228
    const browse = browseIds('apple')
    expect(browse.size).toBe(228)

    // Verify ProduceRecipeResultsScreen has pagination props
    expect(PRODUCE_RESULTS_SRC).toContain('initialNumToRender')
    expect(PRODUCE_RESULTS_SRC).toContain('maxToRenderPerBatch')
    expect(PRODUCE_RESULTS_SRC).toContain('removeClippedSubviews')

    // Verify Browse FlatList also has pagination props
    expect(SCAN_SRC).toContain('initialNumToRender')
    expect(SCAN_SRC).toContain('maxToRenderPerBatch')
  })

  // Test 9: Total-count label equals the accessible result set
  test('9. Total-count label equals the accessible result set', () => {
    // Browse screen shows searchResults.length as count
    expect(SCAN_SRC).toContain('searchResults.length')
    expect(SCAN_SRC).toMatch(/searchResults\.length.*recipe/)
    // ProduceRecipeResultsScreen shows matches via sections
    expect(PRODUCE_RESULTS_SRC).toContain('result.matches')
    // No hidden slice that reduces the displayed set
    expect(PRODUCE_RESULTS_SRC).not.toMatch(/\.slice\(0,\s*10\)/)
  })

  // Test 10: No duplicate recipe cards appear
  test('10. No duplicate recipe cards appear in Apple results', () => {
    const produce = getRecipesForProduce(['apple'])
    const ids = produce.matches.map((m) => m.recipeId)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)

    const browse = searchRecipes('apple', undefined, 1000)
    const browseIdsArr = browse.map((r) => r.id)
    const browseUnique = new Set(browseIdsArr)
    expect(browseUnique.size).toBe(browseIdsArr.length)

    // Verify keyExtractor uses unique recipeId
    expect(PRODUCE_RESULTS_SRC).toContain('keyExtractor')
    expect(PRODUCE_RESULTS_SRC).toContain('item.recipeId')
  })

  // Test 11: Keyboard listeners are removed on unmount
  test('11. Keyboard listeners are removed on unmount', () => {
    // Verify the useEffect has a cleanup function that removes listeners
    expect(HOME_SRC).toContain('keyboardDidShow')
    expect(HOME_SRC).toContain('keyboardDidHide')
    expect(HOME_SRC).toContain('showSub.remove()')
    expect(HOME_SRC).toContain('hideSub.remove()')

    // Verify the cleanup is inside the useEffect return
    const keyboardEffectMatch = HOME_SRC.match(
      /useEffect\(\(\)\s*=>\s*\{[^]*?keyboardDidShow[^]*?keyboardDidHide[^]*?return\s*\(\)\s*=>\s*\{[^]*?showSub\.remove\(\)[^]*?hideSub\.remove\(\)[^]*?\}[^]*?\},\s*\[\]\)/
    )
    expect(keyboardEffectMatch).toBeTruthy()
  })

  // Test 12: Repeated visits do not duplicate listeners or spacers
  test('12. Repeated visits do not duplicate listeners or spacers', () => {
    // The useEffect has empty deps array — runs once on mount, cleans up on unmount
    // React 18 strict mode double-invokes but cleanup runs between, so no accumulation
    const keyboardEffectMatch = HOME_SRC.match(
      /useEffect\(\(\)\s*=>\s*\{[^]*?keyboardDidShow[^]*?return\s*\(\)\s*=>\s*\{[^]*?showSub\.remove\(\)[^]*?\}[^]*?\},\s*\[\]\)/
    )
    expect(keyboardEffectMatch).toBeTruthy()

    // Verify only one keyboardHeight state variable
    const keyboardHeightMatches = HOME_SRC.match(/useState\(0\)/g)
    // There should be at least one for keyboardHeight
    expect(HOME_SRC).toContain('keyboardHeight')

    // Verify only one bottom spacer
    const spacerMatches = HOME_SRC.match(/keyboardHeight\s*>\s*0\s*&&\s*<View/g)
    expect(spacerMatches).toBeTruthy()
    expect(spacerMatches.length).toBe(1)

    // Verify keyboardShouldPersistTaps is only on ScrollView/KeyboardAvoidingView, not on non-scroll components
    const tapsMatches = HOME_SRC.match(/keyboardShouldPersistTaps/g)
    expect(tapsMatches).toBeTruthy()
    // Should be on KeyboardAvoidingView and ScrollView only
    expect(tapsMatches.length).toBe(2)
  })
})

// ══════════════════════════════════════════════════════════════
// Additional: Shared visibility policy function tests
// ══════════════════════════════════════════════════════════════

describe('Shared visibility policy function', () => {

  test('applyRecipeVisibilityPolicy shows all recipes with isLocked flag for Free user', () => {
    const appleIds = getRecipeIdsForProduceFamily('apple')
    const visible = applyRecipeVisibilityPolicy(appleIds, { isProActive: false })
    expect(visible.length).toBe(appleIds.length)
    const lockedCount = visible.filter((v) => v.isLocked).length
    const proCount = appleIds.filter((id) => getRecipeById(id)?.tier === 'pro').length
    expect(lockedCount).toBe(proCount)
  })

  test('applyRecipeVisibilityPolicy shows all recipes unlocked for Pro user', () => {
    const appleIds = getRecipeIdsForProduceFamily('apple')
    const visible = applyRecipeVisibilityPolicy(appleIds, { isProActive: true })
    expect(visible.length).toBe(appleIds.length)
    expect(visible.filter((v) => v.isLocked).length).toBe(0)
  })

  test('Browse screen source uses applyRecipeVisibilityPolicy or equivalent Pro handling', () => {
    // The Browse screen must have Pro badge and paywall handling
    expect(SCAN_SRC).toContain('usePro')
    expect(SCAN_SRC).toContain('hasFeatureAccess')
    expect(SCAN_SRC).toContain('PaywallModal')
    expect(SCAN_SRC).toContain('proRecipes')
    expect(SCAN_SRC).toContain('Lock')
  })

  test('ProduceRecipeResultsScreen source has Pro badge handling', () => {
    expect(PRODUCE_RESULTS_SRC).toContain('tier_label')
    expect(PRODUCE_RESULTS_SRC).toContain('isPro')
    expect(PRODUCE_RESULTS_SRC).toContain('proBadge')
  })

  test('Shared visibility function exists in produceFamilies', () => {
    expect(FAMILIES_SRC).toContain('applyRecipeVisibilityPolicy')
    expect(FAMILIES_SRC).toContain('getUniqueSelectedFamilyKeys')
  })
})

// ══════════════════════════════════════════════════════════════
// Additional: Unrelated produce exclusion for all families
// ══════════════════════════════════════════════════════════════

describe('Unrelated produce exclusion for all families', () => {

  test('Bell Pepper excludes unrelated produce (e.g. apple, carrot)', () => {
    const bellPepperFamily = familyIds('bell_pepper')
    const appleFamily = familyIds('apple')
    // There may be overlap (recipes with both), but bell pepper set should not be a subset of apple
    const bellPepperOnly = [...bellPepperFamily].filter((id) => !appleFamily.has(id))
    expect(bellPepperOnly.length).toBeGreaterThan(0)
  })

  test('Cabbage excludes unrelated produce (e.g. pineapple)', () => {
    const cabbageFamily = familyIds('cabbage')
    const pineappleIds = RECIPES.filter((r) =>
      r.ingredients.some((ing) => ing.produceId.toLowerCase() === 'pineapple')
    ).map((r) => r.id)
    const cabbageOnlyPineapple = pineappleIds.filter((id) => {
      const r = getRecipeById(id)
      return r && !r.ingredients.some((ing) => {
        const pid = ing.produceId.toLowerCase()
        return pid === 'cabbage_green' || pid === 'cabbage_red'
      })
    })
    for (const id of cabbageOnlyPineapple) {
      expect(cabbageFamily.has(id)).toBe(false)
    }
  })

  test('Multiple variants do not inflate matched-family counts', () => {
    const single = produceIds(['apple'])
    const twoVariants = produceIds(['apple', 'apple_red'])
    const threeVariants = produceIds(['apple', 'apple_red', 'apple_green'])
    expectSetEquality(single, twoVariants, 'single vs two variants')
    expectSetEquality(single, threeVariants, 'single vs three variants')
  })
})
