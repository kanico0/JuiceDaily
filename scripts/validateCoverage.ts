import { runCoverageValidation, PROD_MIN_RATIO } from '../src/services/wellnessFocusMatcher'
import { RECIPES } from '../src/constants/recipeData'
import { PRODUCE_DATA } from '../src/services/JuiceEngine'

const report = runCoverageValidation(1, PROD_MIN_RATIO)

// ── Check for unknown produce IDs ────────────────────────────
const knownProduceIds = new Set(Object.keys(PRODUCE_DATA))
const unknownProduceIds = new Set<string>()
for (const recipe of RECIPES) {
  for (const ing of recipe.ingredients) {
    if (ing.produceId && !knownProduceIds.has(ing.produceId.toLowerCase())) {
      unknownProduceIds.add(ing.produceId)
    }
  }
}

// ── Check for unresolved recipe IDs (duplicates or missing) ──
const recipeIds = RECIPES.map((r) => r.id)
const idSet = new Set(recipeIds)
const duplicateIds = recipeIds.filter((id) => recipeIds.indexOf(id) !== recipeIds.lastIndexOf(id))
const unresolvedRecipeIds = recipeIds.filter((id) => !idSet.has(id))

// ── Report ───────────────────────────────────────────────────
console.log('═══ RECIPE COVERAGE VALIDATION ═══')
console.log(`Recipes loaded: ${report.total_recipes}`)
console.log(`Focus areas: ${report.total_focus_areas}`)
console.log()

console.log('── Coverage Summary ──')
const mappedCount = report.total_recipes - report.recipes_with_zero_matches.length
console.log(`Recipes mapped to ≥1 focus area: ${mappedCount}/${report.total_recipes} (${report.coverage_pct_recipes_mapped}%)`)
const filledCount = report.total_focus_areas - report.focus_areas_with_zero_recipes.length
console.log(`Focus areas with ≥1 recipe: ${filledCount}/${report.total_focus_areas} (${report.coverage_pct_focus_areas_filled}%)`)
console.log()

console.log('── Integrity Checks ──')
console.log(`Unknown produce IDs: ${unknownProduceIds.size}`)
if (unknownProduceIds.size > 0) {
  for (const id of unknownProduceIds) {
    console.log(`  UNKNOWN: ${id}`)
  }
}
console.log(`Unresolved recipe IDs: ${unresolvedRecipeIds.length}`)
if (duplicateIds.length > 0) {
  console.log(`Duplicate recipe IDs: ${[...new Set(duplicateIds)].length}`)
  for (const id of [...new Set(duplicateIds)]) {
    console.log(`  DUPLICATE: ${id}`)
  }
}
console.log()

if (report.recipes_with_zero_matches.length > 0) {
  console.log('── Recipes with ZERO focus area matches ──')
  for (const r of report.recipes_with_zero_matches) {
    console.log(`  ${r.id}: ${r.name}`)
    console.log(`    ingredients: ${r.ingredients.join(', ')}`)
  }
  console.log()
}

if (report.focus_areas_with_zero_recipes.length > 0) {
  console.log('── Focus areas with ZERO matching recipes ──')
  for (const a of report.focus_areas_with_zero_recipes) {
    console.log(`  ${a.id}: ${a.label}`)
    console.log(`    sample needed ingredients: ${a.needs_ingredients.join(', ')}`)
  }
  console.log()
}

// ── Final verdict ────────────────────────────────────────────
const blockingFailures: string[] = []
if (report.total_recipes !== 1000) blockingFailures.push(`Expected exactly 1,000 recipes, got ${report.total_recipes}`)
if (mappedCount !== report.total_recipes) blockingFailures.push(`${report.recipes_with_zero_matches.length} recipes not mapped to any focus area`)
if (filledCount !== report.total_focus_areas) blockingFailures.push(`${report.focus_areas_with_zero_recipes.length} focus areas have no matching recipes`)
if (unknownProduceIds.size > 0) blockingFailures.push(`${unknownProduceIds.size} unknown produce IDs found`)
if (unresolvedRecipeIds.length > 0) blockingFailures.push(`${unresolvedRecipeIds.length} unresolved recipe IDs`)
if (duplicateIds.length > 0) blockingFailures.push(`${new Set(duplicateIds).size} duplicate recipe IDs`)

console.log('── Final Verdict ──')
console.log(`Blocking failures: ${blockingFailures.length}`)
if (blockingFailures.length > 0) {
  for (const f of blockingFailures) {
    console.log(`  FAIL: ${f}`)
  }
}

const pass = blockingFailures.length === 0
console.log()
console.log(pass ? '✅ All checks passed.' : '❌ Validation FAILED.')
process.exit(pass ? 0 : 1)
