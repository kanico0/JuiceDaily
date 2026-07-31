// scripts/validateCanonicalProduceParity.ts
// Deterministic parity matrix for every canonical produce ID.
// Compares Browse recognized-produce recipe IDs vs Produce-First single-selection recipe IDs.

import { PRODUCE_DATA } from '../src/services/JuiceEngine'
import { RECIPES } from '../src/constants/recipeData'
import { searchRecipes } from '../src/services/recipeSearch'
import { getRecipesForProduce, resetIndex } from '../src/services/produceRecipeMatcher'
import {
  getCanonicalProduceKey,
  getUniqueSelectedCanonicalProduceKeys,
  resolveQueryToCanonicalProduce,
  getRecipeIdsForCanonicalProduce,
} from '../src/services/produceFamilies'

// ── Helpers ──────────────────────────────────────────────────

function browseIds(query: string): Set<string> {
  return new Set(searchRecipes(query, undefined, 10000).map((r) => r.id))
}

function produceFirstIds(produceId: string): Set<string> {
  const result = getRecipesForProduce([produceId], { maxResults: 10000, minUsefulResults: 0 })
  return new Set(result.matches.map((m) => m.recipeId))
}

function canonicalIds(key: string): Set<string> {
  return new Set(getRecipeIdsForCanonicalProduce(key))
}

function setEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) {
    if (!b.has(x)) return false
  }
  return true
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  resetIndex()

  const allProduceIds = Object.keys(PRODUCE_DATA).sort()
  const canonicalKeys = new Set<string>()
  const results: Array<{
    produceId: string
    canonicalKey: string
    browseCount: number
    produceCount: number
    canonicalCount: number
    browseProduceParity: boolean
    browseCanonicalParity: boolean
    produceCanonicalParity: boolean
    duplicates: number
  }> = []

  let parityCount = 0
  let mismatchCount = 0
  let zeroCount = 0
  let nonzeroCount = 0
  let largestSet = 0
  let largestProduceId = ''
  let smallestNonzero = Infinity
  let smallestNonzeroProduceId = ''
  let unresolvedCount = 0
  let totalDuplicates = 0

  for (const produceId of allProduceIds) {
    const ck = getCanonicalProduceKey(produceId)
    if (!ck) {
      unresolvedCount++
      continue
    }
    canonicalKeys.add(ck)

    const browse = browseIds(produceId)
    const produce = produceFirstIds(produceId)
    const canonical = canonicalIds(ck)

    // Check for duplicate recipe IDs in produce-first results
    const produceList = getRecipesForProduce([produceId], { maxResults: 10000, minUsefulResults: 0 }).matches
    const produceIdSet = new Set<string>()
    let dupes = 0
    for (const m of produceList) {
      if (produceIdSet.has(m.recipeId)) dupes++
      else produceIdSet.add(m.recipeId)
    }
    totalDuplicates += dupes

    const bp = setEqual(browse, produce)
    const bc = setEqual(browse, canonical)
    const pc = setEqual(produce, canonical)

    if (bp && bc && pc) {
      parityCount++
    } else {
      mismatchCount++
    }

    if (browse.size === 0 && produce.size === 0) {
      zeroCount++
    } else {
      nonzeroCount++
    }

    const maxCount = Math.max(browse.size, produce.size, canonical.size)
    if (maxCount > largestSet) {
      largestSet = maxCount
      largestProduceId = produceId
    }

    if (maxCount > 0 && maxCount < smallestNonzero) {
      smallestNonzero = maxCount
      smallestNonzeroProduceId = produceId
    }

    results.push({
      produceId,
      canonicalKey: ck,
      browseCount: browse.size,
      produceCount: produce.size,
      canonicalCount: canonical.size,
      browseProduceParity: bp,
      browseCanonicalParity: bc,
      produceCanonicalParity: pc,
      duplicates: dupes,
    })
  }

  // ── Report ─────────────────────────────────────────────────

  console.log('=== Canonical Produce Parity Validation ===\n')

  console.log(`Total produce IDs checked: ${allProduceIds.length}`)
  console.log(`Distinct canonical keys: ${canonicalKeys.size}`)
  console.log(`Unresolved canonical IDs: ${unresolvedCount}`)
  console.log(`Exact parity count: ${parityCount}`)
  console.log(`Mismatch count: ${mismatchCount}`)
  console.log(`Zero-result produce IDs: ${zeroCount}`)
  console.log(`Nonzero-result produce IDs: ${nonzeroCount}`)
  console.log(`Largest result set: ${largestSet} (produce: ${largestProduceId})`)
  console.log(`Smallest nonzero result set: ${smallestNonzero} (produce: ${smallestNonzeroProduceId})`)
  console.log(`Total duplicate recipe IDs: ${totalDuplicates}`)

  // ── Focused examples ────────────────────────────────────────

  const focused = [
    'apple', 'apple_red', 'apple_green',
    'carrot', 'celery', 'spinach', 'cucumber', 'kale',
    'pineapple',
    'bell_pepper_red', 'bell_pepper_green',
    'cabbage_green', 'cabbage_red',
  ]

  console.log('\n--- Focused Examples ---')
  for (const pid of focused) {
    const r = results.find((x) => x.produceId === pid)
    if (!r) {
      console.log(`  ${pid}: NOT FOUND`)
      continue
    }
    console.log(`  ${pid} → canonical: ${r.canonicalKey}, browse: ${r.browseCount}, produce: ${r.produceCount}, canonical: ${r.canonicalCount}, parity: ${r.browseProduceParity && r.browseCanonicalParity && r.produceCanonicalParity}`)
  }

  // ── Mismatches ─────────────────────────────────────────────

  if (mismatchCount > 0) {
    console.log('\n--- Mismatches ---')
    for (const r of results) {
      if (!r.browseProduceParity || !r.browseCanonicalParity || !r.produceCanonicalParity) {
        console.log(`  ${r.produceId} → ${r.canonicalKey}: browse=${r.browseCount} produce=${r.produceCount} canonical=${r.canonicalCount} | bp=${r.browseProduceParity} bc=${r.browseCanonicalParity} pc=${r.produceCanonicalParity}`)
      }
    }
  }

  // ── Zero-result produce ────────────────────────────────────

  const zeroResults = results.filter((r) => r.browseCount === 0 && r.produceCount === 0)
  if (zeroResults.length > 0) {
    console.log('\n--- Zero-Result Produce IDs ---')
    for (const r of zeroResults) {
      console.log(`  ${r.produceId} → ${r.canonicalKey}`)
    }
  }

  // ── Substring false positive check ─────────────────────────

  console.log('\n--- Substring False Positive Check ---')
  // Verify pineapple is not in apple results
  const appleBrowse = browseIds('apple')
  const pineappleBrowse = browseIds('pineapple')
  let substringFalse = 0
  for (const id of pineappleBrowse) {
    if (appleBrowse.has(id)) {
      // Check if the recipe actually contains apple
      const recipe = RECIPES.find((r) => r.id === id)
      const hasApple = recipe?.ingredients.some((ing) => {
        const ck = getCanonicalProduceKey(ing.produceId)
        return ck === 'apple'
      })
      const hasPineapple = recipe?.ingredients.some((ing) => {
        const ck = getCanonicalProduceKey(ing.produceId)
        return ck === 'pineapple'
      })
      if (hasApple && hasPineapple) {
        // Legitimate — recipe contains both
      } else if (!hasApple && hasPineapple) {
        substringFalse++
        console.log(`  FALSE POSITIVE: ${id} in apple results but has no apple ingredient`)
      }
    }
  }
  console.log(`  Substring false positives: ${substringFalse}`)

  // ── Final verdict ──────────────────────────────────────────

  console.log('\n--- Final Verdict ---')
  const allParity = parityCount === allProduceIds.length
  const allResolved = unresolvedCount === 0
  const noDuplicates = totalDuplicates === 0
  const noSubstringFalse = substringFalse === 0

  console.log(`  69/69 canonical IDs resolve: ${allResolved ? 'PASS' : 'FAIL'}`)
  console.log(`  69/69 Browse and Produce-First sets identical: ${allParity ? 'PASS' : 'FAIL'}`)
  console.log(`  Zero unexplained mismatches: ${mismatchCount === 0 ? 'PASS' : 'FAIL'}`)
  console.log(`  Zero substring-based false positives: ${noSubstringFalse ? 'PASS' : 'FAIL'}`)
  console.log(`  Zero duplicate recipe IDs: ${noDuplicates ? 'PASS' : 'FAIL'}`)

  if (allParity && allResolved && noDuplicates && noSubstringFalse) {
    console.log('\n✅ All parity checks passed.')
  } else {
    console.log('\n❌ Some checks failed. See details above.')
    process.exit(1)
  }
}

main()
