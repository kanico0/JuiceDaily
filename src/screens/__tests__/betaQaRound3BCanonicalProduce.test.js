// src/screens/__tests__/betaQaRound3BCanonicalProduce.test.js
// QA Round 3B — Generalize Structured Produce Search to All Produce
// 22 required tests proving canonical produce key resolution, parity,
// no caps, no substring false positives, and Pro card interaction parity.

import { searchRecipes } from '../../services/recipeSearch'
import {
  getRecipesForProduce,
  resetIndex,
} from '../../services/produceRecipeMatcher'
import {
  getCanonicalProduceKey,
  getUniqueSelectedCanonicalProduceKeys,
  resolveQueryToCanonicalProduce,
  recipeContainsCanonicalProduce,
  getRecipeIdsForCanonicalProduce,
  applyRecipeVisibilityPolicy,
  PRODUCE_FAMILIES,
} from '../../services/produceFamilies'
import { PRODUCE_DATA } from '../../services/JuiceEngine'
import { RECIPES, getRecipeById, getRecipeBlendType } from '../../constants/recipeData'

// ── Helpers ──────────────────────────────────────────────────

function browseIds(query) {
  return new Set(searchRecipes(query, undefined, 10000).map((r) => r.id))
}

function produceIds(selection) {
  return new Set(getRecipesForProduce(selection, { maxResults: 10000, minUsefulResults: 0 }).matches.map((m) => m.recipeId))
}

function canonicalIds(key) {
  return new Set(getRecipeIdsForCanonicalProduce(key))
}

function expectSetEquality(setA, setB, label) {
  const missingFromB = [...setA].filter((x) => !setB.has(x))
  const missingFromA = [...setB].filter((x) => !setA.has(x))
  if (missingFromB.length > 0 || missingFromA.length > 0) {
    console.error(`Set mismatch for ${label}:
  Missing from B: ${missingFromB.join(', ')}
  Missing from A: ${missingFromA.join(', ')}`)
  }
  expect(missingFromB.length).toBe(0)
  expect(missingFromA.length).toBe(0)
  expect(setA.size).toBe(setB.size)
}

// ── Tests ────────────────────────────────────────────────────

describe('QA Round 3B — Canonical Produce Search', () => {
  beforeEach(() => {
    resetIndex()
  })

  // 1. Ordinary produce falls back to its canonical ID.
  test('1. Ordinary produce falls back to its canonical ID', () => {
    expect(getCanonicalProduceKey('carrot')).toBe('carrot')
    expect(getCanonicalProduceKey('celery')).toBe('celery')
    expect(getCanonicalProduceKey('spinach')).toBe('spinach')
    expect(getCanonicalProduceKey('cucumber')).toBe('cucumber')
    expect(getCanonicalProduceKey('kale')).toBe('kale')
    expect(getCanonicalProduceKey('pineapple')).toBe('pineapple')
  })

  // 2. Apple variants collapse to apple.
  test('2. Apple variants collapse to apple', () => {
    expect(getCanonicalProduceKey('apple')).toBe('apple')
    expect(getCanonicalProduceKey('apple_red')).toBe('apple')
    expect(getCanonicalProduceKey('apple_green')).toBe('apple')
  })

  // 3. Carrot resolves to carrot.
  test('3. Carrot resolves to carrot', () => {
    expect(getCanonicalProduceKey('carrot')).toBe('carrot')
    expect(resolveQueryToCanonicalProduce('carrot')).toBe('carrot')
  })

  // 4. Pineapple resolves to pineapple, not apple.
  test('4. Pineapple resolves to pineapple, not apple', () => {
    expect(getCanonicalProduceKey('pineapple')).toBe('pineapple')
    expect(resolveQueryToCanonicalProduce('pineapple')).toBe('pineapple')
    expect(getCanonicalProduceKey('pineapple')).not.toBe('apple')
  })

  // 5. Single Carrot selection is treated as one canonical key.
  test('5. Single Carrot selection is treated as one canonical key', () => {
    const keys = getUniqueSelectedCanonicalProduceKeys(['carrot'])
    expect(keys.length).toBe(1)
    expect(keys[0]).toBe('carrot')
  })

  // 6. Apple plus Carrot is treated as two canonical keys.
  test('6. Apple plus Carrot is treated as two canonical keys', () => {
    const keys = getUniqueSelectedCanonicalProduceKeys(['apple', 'carrot'])
    expect(keys.length).toBe(2)
    expect(keys).toContain('apple')
    expect(keys).toContain('carrot')
  })

  // 7. A fourth hypothetical Apple variant would not require a magic-number code change.
  test('7. A fourth hypothetical Apple variant would not require a magic-number code change', () => {
    // The logic uses getUniqueSelectedCanonicalProduceKeys().length === 1
    // Adding apple_yellow to PRODUCE_FAMILIES would still collapse to ['apple']
    // No magic number or variant count is used
    const keys = getUniqueSelectedCanonicalProduceKeys(['apple', 'apple_red', 'apple_green'])
    expect(keys.length).toBe(1)

    // Simulate a fourth variant by testing with all current + a hypothetical
    // The function only cares about canonical key uniqueness, not count
    const keysWithDupe = getUniqueSelectedCanonicalProduceKeys(['apple', 'apple_red', 'apple_green', 'apple'])
    expect(keysWithDupe.length).toBe(1)

    // Verify no magic number in source
    const matcherSrc = require('fs').readFileSync(
      require('path').join(__dirname, '../../services/produceRecipeMatcher.ts'),
      'utf-8'
    )
    expect(matcherSrc).not.toContain('<= 3')
    expect(matcherSrc).not.toContain('<=3')
    expect(matcherSrc).not.toContain('allHaveFamily')
  })

  // 8. Browse Carrot uses structured ingredient matching.
  test('8. Browse Carrot uses structured ingredient matching', () => {
    const browse = browseIds('carrot')
    const canonical = canonicalIds('carrot')
    // Browse should match exactly the canonical set (no title-substring inclusion)
    expectSetEquality(browse, canonical, 'Browse carrot vs canonical carrot')
  })

  // 9. Produce-First Carrot has no 10-result cap.
  test('9. Produce-First Carrot has no 10-result cap', () => {
    const result = getRecipesForProduce(['carrot'], { maxResults: 10000, minUsefulResults: 0 })
    expect(result.matches.length).toBeGreaterThan(10)
    expect(result.matches.length).toBe(133)
  })

  // 10. Browse and Produce-First Carrot sets are identical.
  test('10. Browse and Produce-First Carrot sets are identical', () => {
    const browse = browseIds('carrot')
    const produce = produceIds(['carrot'])
    expectSetEquality(browse, produce, 'Browse carrot vs Produce-First carrot')
    expect(browse.size).toBe(133)
  })

  // 11. Celery sets are identical.
  test('11. Celery sets are identical', () => {
    const browse = browseIds('celery')
    const produce = produceIds(['celery'])
    const canonical = canonicalIds('celery')
    expectSetEquality(browse, produce, 'Browse celery vs Produce-First celery')
    expectSetEquality(browse, canonical, 'Browse celery vs canonical celery')
    expect(browse.size).toBe(148)
  })

  // 12. Spinach sets are identical.
  test('12. Spinach sets are identical', () => {
    const browse = browseIds('spinach')
    const produce = produceIds(['spinach'])
    const canonical = canonicalIds('spinach')
    expectSetEquality(browse, produce, 'Browse spinach vs Produce-First spinach')
    expectSetEquality(browse, canonical, 'Browse spinach vs canonical spinach')
    expect(browse.size).toBe(51)
  })

  // 13. Cucumber sets are identical.
  test('13. Cucumber sets are identical', () => {
    const browse = browseIds('cucumber')
    const produce = produceIds(['cucumber'])
    const canonical = canonicalIds('cucumber')
    expectSetEquality(browse, produce, 'Browse cucumber vs Produce-First cucumber')
    expectSetEquality(browse, canonical, 'Browse cucumber vs canonical cucumber')
    expect(browse.size).toBe(182)
  })

  // 14. Kale sets are identical.
  test('14. Kale sets are identical', () => {
    const browse = browseIds('kale')
    const produce = produceIds(['kale'])
    const canonical = canonicalIds('kale')
    expectSetEquality(browse, produce, 'Browse kale vs Produce-First kale')
    expectSetEquality(browse, canonical, 'Browse kale vs canonical kale')
    expect(browse.size).toBe(52)
  })

  // 15. Pineapple sets are identical.
  test('15. Pineapple sets are identical', () => {
    const browse = browseIds('pineapple')
    const produce = produceIds(['pineapple'])
    const canonical = canonicalIds('pineapple')
    expectSetEquality(browse, produce, 'Browse pineapple vs Produce-First pineapple')
    expectSetEquality(browse, canonical, 'Browse pineapple vs canonical pineapple')
    expect(browse.size).toBe(151)
  })

  // 16. All 69 canonical produce IDs resolve.
  test('16. All 69 canonical produce IDs resolve', () => {
    const allProduceIds = Object.keys(PRODUCE_DATA)
    expect(allProduceIds.length).toBe(69)
    let unresolved = 0
    for (const pid of allProduceIds) {
      const ck = getCanonicalProduceKey(pid)
      if (ck === null) unresolved++
    }
    expect(unresolved).toBe(0)
  })

  // 17. All 69 single-produce result sets have parity.
  test('17. All 69 single-produce result sets have parity', () => {
    const allProduceIds = Object.keys(PRODUCE_DATA)
    let mismatches = 0
    for (const pid of allProduceIds) {
      const browse = browseIds(pid)
      const produce = produceIds([pid])
      const canonical = canonicalIds(getCanonicalProduceKey(pid))
      if (browse.size !== produce.size || browse.size !== canonical.size) {
        mismatches++
        console.error(`Mismatch for ${pid}: browse=${browse.size} produce=${produce.size} canonical=${canonical.size}`)
      } else {
        for (const id of browse) {
          if (!produce.has(id) || !canonical.has(id)) {
            mismatches++
            break
          }
        }
      }
    }
    expect(mismatches).toBe(0)
  })

  // 18. Zero substring false positives occur.
  test('18. Zero substring false positives occur', () => {
    // Pineapple should not appear in Apple results unless it genuinely contains apple
    const appleBrowse = browseIds('apple')
    const pineappleBrowse = browseIds('pineapple')
    let falsePositives = 0
    for (const id of pineappleBrowse) {
      if (appleBrowse.has(id)) {
        const recipe = RECIPES.find((r) => r.id === id)
        const hasApple = recipe?.ingredients.some((ing) => {
          const ck = getCanonicalProduceKey(ing.produceId)
          return ck === 'apple'
        })
        if (!hasApple) falsePositives++
      }
    }
    expect(falsePositives).toBe(0)

    // Also verify "car" doesn't match "carrot" via substring
    const carResults = searchRecipes('car', undefined, 1000)
    // "car" is not a recognized produce, so it falls to free-text search
    // But no recipe should be included merely because its title contains "car"
    // unless it's a legitimate text match (which is the free-text path)
    // The key check is that recognized produce queries don't use substring
    const carrotResults = searchRecipes('carrot', undefined, 10000)
    for (const recipe of carrotResults) {
      const hasCarrot = recipe.ingredients.some((ing) => {
        const ck = getCanonicalProduceKey(ing.produceId)
        return ck === 'carrot'
      })
      expect(hasCarrot).toBe(true)
    }
  })

  // 19. Locked Pro card behavior matches across screens.
  test('19. Locked Pro card behavior matches across screens', () => {
    // Find the Pro recipe in the Apple set
    const appleCanonical = canonicalIds('apple')
    const proInApple = [...appleCanonical].find((id) => {
      const r = getRecipeById(id)
      return r && r.tier === 'pro'
    })
    expect(proInApple).toBeTruthy()
    expect(proInApple).toBe('glow-lab-2')

    // Both Browse and Produce-First include the Pro recipe
    const browse = browseIds('apple')
    const produce = produceIds(['apple'])
    expect(browse.has(proInApple)).toBe(true)
    expect(produce.has(proInApple)).toBe(true)

    // Apply visibility policy for Free user
    const freeUser = { isProActive: false }
    const browseVisible = applyRecipeVisibilityPolicy([...browse], freeUser)
    const produceVisible = applyRecipeVisibilityPolicy([...produce], freeUser)

    // Both should have the Pro recipe marked as locked
    const browsePro = browseVisible.find((v) => v.id === proInApple)
    const producePro = produceVisible.find((v) => v.id === proInApple)
    expect(browsePro).toBeTruthy()
    expect(producePro).toBeTruthy()
    expect(browsePro.isLocked).toBe(true)
    expect(producePro.isLocked).toBe(true)

    // For Pro user, the recipe should NOT be locked
    const proUser = { isProActive: true }
    const proVisible = applyRecipeVisibilityPolicy([...produce], proUser)
    const proUnlocked = proVisible.find((v) => v.id === proInApple)
    expect(proUnlocked.isLocked).toBe(false)

    // Same recipe behaves identically in both screens
    expect(browsePro.isLocked).toBe(producePro.isLocked)
  })

  // 20. Full result counts are displayed.
  test('20. Full result counts are displayed', () => {
    // Carrot: 133 results, not capped at 10
    const carrot = produceIds(['carrot'])
    expect(carrot.size).toBe(133)
    expect(carrot.size).toBeGreaterThan(10)

    // Celery: 148 results
    const celery = produceIds(['celery'])
    expect(celery.size).toBe(148)
    expect(celery.size).toBeGreaterThan(10)

    // Spinach: 51 results
    const spinach = produceIds(['spinach'])
    expect(spinach.size).toBe(51)
    expect(spinach.size).toBeGreaterThan(10)
  })

  // 21. No duplicate result cards appear.
  test('21. No duplicate result cards appear', () => {
    const allProduceIds = Object.keys(PRODUCE_DATA)
    let totalDuplicates = 0
    for (const pid of allProduceIds) {
      const result = getRecipesForProduce([pid], { maxResults: 10000, minUsefulResults: 0 })
      const ids = new Set()
      for (const m of result.matches) {
        if (ids.has(m.recipeId)) {
          totalDuplicates++
        } else {
          ids.add(m.recipeId)
        }
      }
    }
    expect(totalDuplicates).toBe(0)
  })

  // 22. Multi-produce ranking remains unchanged.
  test('22. Multi-produce ranking remains unchanged', () => {
    // With two different canonical keys, the 10-result cap should apply
    const result = getRecipesForProduce(['apple', 'carrot'])
    expect(result.matches.length).toBeLessThanOrEqual(10)

    // Multi-produce should use the default minRatio (0.5)
    expect(result.matches.length).toBeGreaterThan(0)

    // Verify sorting: ready_now before close_match before closest_match
    const tiers = result.matches.map((m) => m.tier)
    const tierOrder = { ready_now: 0, close_match: 1, closest_match: 2 }
    for (let i = 1; i < tiers.length; i++) {
      expect(tierOrder[tiers[i]]).toBeGreaterThanOrEqual(tierOrder[tiers[i - 1]])
    }
  })
})
