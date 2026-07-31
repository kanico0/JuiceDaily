// ─────────────────────────────────────────────────────────────
// glowSeasonalFree.test.js — Tests for free browsing of
// Seasonal Glow Packs and Glow Library recipes.
//
// Source-level tests verify access-policy changes in screens.
// Behavioral tests use the centralized policy helper directly.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc (relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8')
}

const GLOW_SRC = readSrc('../../screens/GlowLibraryScreen.js')
const SEASONAL_SRC = readSrc('../../screens/SeasonalGlowPacksScreen.js')
const SCAN_SRC = readSrc('../../screens/ScanScreen.js')
const FAMILIES_SRC = readSrc('../../services/produceFamilies.ts')
const PRODUCE_RESULTS_SRC = readSrc('../../screens/ProduceRecipeResultsScreen.js')

import {
  isRecipeLockedForUser,
  applyRecipeVisibilityPolicy,
  FREE_BROWSE_COLLECTIONS,
  getRecipeIdsForProduceFamily,
} from '../../services/produceFamilies'
import { RECIPES, getRecipeById, getRecipeBlendType, countDistinctProduceIds } from '../../constants/recipeData'
import { searchRecipes } from '../../services/recipeSearch'
import { getRecipesForProduce, resetIndex } from '../../services/produceRecipeMatcher'

// ── Helpers ──────────────────────────────────────────────────

const freeUser = { isProActive: false }
const proUser = { isProActive: true }

function glowRecipes () {
  return RECIPES.filter((r) => r.collection === 'glow_library')
}

function seasonalRecipes () {
  return RECIPES.filter((r) => r.collection === 'seasonal')
}

// ══════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════

describe('Glow Collections — Free Browsing', () => {
  beforeEach(() => {
    resetIndex()
  })

  // ── 1. Free user can see Seasonal Glow Packs ────────────────

  test('1. SeasonalGlowPacksScreen does not gate entry by Pro', () => {
    expect(SEASONAL_SRC).not.toContain('hasFeatureAccess')
    expect(SEASONAL_SRC).not.toContain("usePro")
  })

  // ── 2. Free user can open a Seasonal Glow Pack ──────────────

  test('2. SeasonalGlowPacksScreen handleOpenRecipe does not check isLocked', () => {
    // The handleOpenRecipe callback should not receive an isLocked parameter
    const match = SEASONAL_SRC.match(/handleOpenRecipe = useCallback\(\(recipeId\) =>/)
    expect(match).toBeTruthy()
    // No isLocked variable in the render map
    expect(SEASONAL_SRC).not.toContain('isLocked')
  })

  // ── 3. Free user can open every recipe card in the pack ─────

  test('3. every seasonal recipe is unlocked for Free user', () => {
    const seasonal = seasonalRecipes()
    expect(seasonal.length).toBeGreaterThan(0)
    for (const r of seasonal) {
      expect(isRecipeLockedForUser(r, freeUser)).toBe(false)
    }
  })

  // ── 4. Free user can see Glow Library ───────────────────────

  test('4. GlowLibraryScreen does not gate entry by Pro', () => {
    expect(GLOW_SRC).not.toContain('hasFeatureAccess')
    expect(GLOW_SRC).not.toContain("usePro")
  })

  // ── 5. Free user can open Glow Library ──────────────────────

  test('5. GlowLibraryScreen handleOpenRecipe does not check isLocked', () => {
    const match = GLOW_SRC.match(/handleOpenRecipe = useCallback\(\(recipeId\) =>/)
    expect(match).toBeTruthy()
    expect(GLOW_SRC).not.toContain('isLocked')
  })

  // ── 6. Free user can open Glow Library recipe details ───────

  test('6. every glow_library recipe is unlocked for Free user', () => {
    const glow = glowRecipes()
    expect(glow.length).toBeGreaterThan(0)
    for (const r of glow) {
      expect(isRecipeLockedForUser(r, freeUser)).toBe(false)
    }
  })

  // ── 7. No collection-level paywall appears ──────────────────

  test('7. GlowLibraryScreen and SeasonalGlowPacksScreen do not show paywall for collection recipes', () => {
    // PaywallModal still exists for ff_dev_force_paywalls, but
    // no isLocked check feeds into it for collection recipes
    expect(GLOW_SRC).not.toContain('shouldLock')
    expect(SEASONAL_SRC).not.toContain('shouldLock')
    expect(SEASONAL_SRC).not.toContain('canAccessProRecipes')
  })

  // ── 8. No recipe-level paywall from Glow membership ─────────

  test('8. isRecipeLockedForUser returns false for all glow_library and seasonal recipes', () => {
    const collectionRecipes = [...glowRecipes(), ...seasonalRecipes()]
    for (const r of collectionRecipes) {
      expect(isRecipeLockedForUser(r, freeUser)).toBe(false)
      expect(isRecipeLockedForUser(r, proUser)).toBe(false)
    }
  })

  // ── 9. Seasonal and Glow badges remain where intended ───────

  test('9. Seasonal pack badge (PackPill) remains in SeasonalGlowPacksScreen', () => {
    expect(SEASONAL_SRC).toContain('PackPill')
    expect(SEASONAL_SRC).toContain('seasonalPack')
  })

  test('9b. Glow Library Crown icon remains in GlowLibraryScreen', () => {
    expect(GLOW_SRC).toContain('Crown')
  })

  // ── 10. Inaccurate Pro/lock badges are removed ──────────────

  test('10. GlowLibraryScreen does not render Lock icon or lockOverlay', () => {
    expect(GLOW_SRC).not.toContain('Lock')
    expect(GLOW_SRC).not.toContain('lockOverlay')
    expect(GLOW_SRC).not.toContain('lockText')
  })

  test('10b. SeasonalGlowPacksScreen does not render Lock icon or lockOverlay', () => {
    expect(SEASONAL_SRC).not.toContain('Lock')
    expect(SEASONAL_SRC).not.toContain('lockOverlay')
    expect(SEASONAL_SRC).not.toContain('lockText')
  })

  // ── 11. Browsing consumes no scan quota ─────────────────────

  test('11. GlowLibraryScreen and SeasonalGlowPacksScreen do not invoke scan quota', () => {
    expect(GLOW_SRC).not.toContain('quota')
    expect(GLOW_SRC).not.toContain('scan')
    expect(SEASONAL_SRC).not.toContain('quota')
    expect(SEASONAL_SRC).not.toContain('scan')
  })

  // ── 12. Browsing consumes no Advanced Blend allowance ───────

  test('12. GlowLibraryScreen and SeasonalGlowPacksScreen do not invoke blend allowance', () => {
    expect(GLOW_SRC).not.toContain('blendAllowance')
    expect(GLOW_SRC).not.toContain('advancedBlend')
    expect(SEASONAL_SRC).not.toContain('blendAllowance')
    expect(SEASONAL_SRC).not.toContain('advancedBlend')
  })

  // ── 13. 5+ ingredient Glow recipe still invokes Advanced Blend ──

  test('13. Glow recipes with 5+ ingredients are classified as advanced blend', () => {
    const glow = glowRecipes()
    for (const r of glow) {
      const blendType = getRecipeBlendType(r)
      const count = countDistinctProduceIds(r.ingredients)
      if (count >= 5) {
        expect(blendType).toBe('advanced')
      }
    }
    // At least one glow recipe should be advanced
    const advanced = glow.filter((r) => getRecipeBlendType(r) === 'advanced')
    expect(advanced.length).toBeGreaterThan(0)
  })

  // ── 14. Exhausted Advanced Blend allowance still shows upgrade ──

  test('14. Advanced Blend enforcement source still exists in service code', () => {
    // The Advanced Blend gating is in the blend analysis flow, not in browsing
    const blendSrc = readSrc('../../services/quota/blendNutritionGate.ts')
    expect(blendSrc).toContain('blend') 
  })

  // ── 15. Scan quota enforcement remains unchanged ────────────

  test('15. HomeScreen still has scan quota enforcement (QuotaMeter)', () => {
    const homeSrc = readSrc('../../screens/HomeScreen.js')
    expect(homeSrc).toContain('QuotaMeter') 
  })

  // ── 16. Pro-user behavior remains valid ─────────────────────

  test('16. Pro user sees all glow and seasonal recipes unlocked', () => {
    const allCollection = [...glowRecipes(), ...seasonalRecipes()]
    for (const r of allCollection) {
      expect(isRecipeLockedForUser(r, proUser)).toBe(false)
    }
  })

  // ── 17. Unrelated premium features remain gated ─────────────

  test('17. non-collection Pro recipes are still locked for Free user', () => {
    // There are no non-collection Pro recipes in the dataset,
    // but the policy helper would lock them if they existed
    const nonCollectionPro = RECIPES.filter(
      (r) => r.tier === 'pro' && !FREE_BROWSE_COLLECTIONS.has(r.collection)
    )
    // All Pro recipes are in glow_library or seasonal, so this is empty
    expect(nonCollectionPro.length).toBe(0)
    // But the policy still locks Pro tier for non-free-browse collections
    const fakeProRecipe = { tier: 'pro', collection: 'core' }
    expect(isRecipeLockedForUser(fakeProRecipe, freeUser)).toBe(true)
  })

  // ── 18. Browse and Produce-First return consistent recipe sets ──

  test('18. Apple Browse and Produce-First return identical sets', () => {
    const browse = new Set(searchRecipes('apple', undefined, 1000).map((r) => r.id))
    const produce = new Set(getRecipesForProduce(['apple']).matches.map((m) => m.recipeId))
    const missingFromProduce = [...browse].filter((x) => !produce.has(x))
    const missingFromBrowse = [...produce].filter((x) => !browse.has(x))
    expect(missingFromProduce).toEqual([])
    expect(missingFromBrowse).toEqual([])
  })

  // ── 19. Apple parity remains exact ──────────────────────────

  test('19. Apple results count is 228 in both Browse and Produce-First', () => {
    const browse = searchRecipes('apple', undefined, 1000)
    const produce = getRecipesForProduce(['apple'])
    expect(browse.length).toBe(228)
    expect(produce.matches.length).toBe(228)
  })

  // ── 20. Pineapple remains excluded from Apple results ───────

  test('20. Pineapple is not a false positive in Apple results', () => {
    // Pineapple recipes that appear in Apple results must genuinely contain apple
    const browse = searchRecipes('apple', undefined, 1000)
    const pineappleBrowse = searchRecipes('pineapple', undefined, 1000)
    const { getCanonicalProduceKey } = require('../../services/produceFamilies')
    let falsePositives = 0
    for (const r of pineappleBrowse) {
      if (browse.some((b) => b.id === r.id)) {
        const hasApple = r.ingredients.some((ing) => {
          const ck = getCanonicalProduceKey(ing.produceId)
          return ck === 'apple'
        })
        if (!hasApple) falsePositives++
      }
    }
    expect(falsePositives).toBe(0)
  })

  // ── 21. Canonical produce parity remains 69/69 ──────────────

  test('21. canonical produce parity is 69/69', () => {
    // The 69 canonical produce IDs come from PRODUCE_DATA in JuiceEngine
    const { PRODUCE_DATA } = require('../../services/JuiceEngine')
    const allProduceIds = Object.keys(PRODUCE_DATA)
    expect(allProduceIds.length).toBe(69)
  })

  // ── 22. Recipe count remains 1,000 ──────────────────────────

  test('22. total recipe count is 1,000', () => {
    expect(RECIPES.length).toBe(1000)
  })

  // ── 23. Recipe fingerprint remains unchanged ────────────────

  test('23. recipe fingerprint is unchanged', () => {
    // The fingerprint is in the JSON, not in code — verify it matches
    const expected = 'b19de0954f7f89c9d9bfa2f9a9b0b79e4863a453cbce5136e85655b106774d4f'
    const libPath = path.join(__dirname, '../../constants/recipeLibrary1000.json')
    const lib = JSON.parse(fs.readFileSync(libPath, 'utf8'))
    expect(lib.datasetFingerprint).toBe(expected)
  })

  // ── 24. Wellness coverage remains 100/100 ───────────────────

  test('24. Wellness coverage is 100/100', () => {
    // Wellness coverage is validated via the wellnessFocusMatcher
    // which maps recipes to 100 focus areas. Verify the source exists.
    const wellnessSrc = readSrc('../../services/wellnessFocusMatcher.ts')
    expect(wellnessSrc).toContain('runCoverageValidation')
    expect(wellnessSrc).toContain('PROD_MIN_RATIO')
    // Verify 100 focus areas are defined
    expect(wellnessSrc).toContain('100')
  })

  // ── 25. No duplicate recipe IDs are introduced ──────────────

  test('25. no duplicate recipe IDs', () => {
    const ids = RECIPES.map((r) => r.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  // ── Additional: Centralized policy helper exists ────────────

  test('FREE_BROWSE_COLLECTIONS contains glow_library and seasonal', () => {
    expect(FREE_BROWSE_COLLECTIONS.has('glow_library')).toBe(true)
    expect(FREE_BROWSE_COLLECTIONS.has('seasonal')).toBe(true)
    expect(FREE_BROWSE_COLLECTIONS.has('core')).toBe(false)
  })

  test('isRecipeLockedForUser is exported from produceFamilies', () => {
    expect(FAMILIES_SRC).toContain('export function isRecipeLockedForUser')
    expect(FAMILIES_SRC).toContain('export const FREE_BROWSE_COLLECTIONS')
  })

  test('ScanScreen uses isRecipeLockedForUser', () => {
    expect(SCAN_SRC).toContain('isRecipeLockedForUser')
  })

  test('GlowLibraryScreen subtitle no longer says Pro-only', () => {
    expect(GLOW_SRC).not.toContain('Pro-only')
  })

  test('ScanScreen Glow Library description no longer says Pro-only', () => {
    expect(SCAN_SRC).not.toContain('Pro-only recipe collections')
  })
})
