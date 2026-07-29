import { runCoverageValidation, PROD_MIN_RATIO } from '../src/services/wellnessFocusMatcher'

const report = runCoverageValidation(1, PROD_MIN_RATIO)

console.log('═══ RECIPE COVERAGE VALIDATION ═══')
console.log(`Schema version: ${report.total_recipes} recipes, ${report.total_focus_areas} focus areas`)
console.log()

console.log('── Coverage Summary ──')
console.log(`Recipes mapped to ≥1 focus area: ${report.total_recipes - report.recipes_with_zero_matches.length}/${report.total_recipes} (${report.coverage_pct_recipes_mapped}%)`)
console.log(`Focus areas with ≥1 recipe: ${report.total_focus_areas - report.focus_areas_with_zero_recipes.length}/${report.total_focus_areas} (${report.coverage_pct_focus_areas_filled}%)`)
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

const pass = report.recipes_with_zero_matches.length === 0 && report.focus_areas_with_zero_recipes.length === 0
console.log(pass ? '✅ All recipes and focus areas have coverage.' : '⚠️  Coverage gaps detected (see above).')

if (!pass && report.focus_areas_with_zero_recipes.length > 20) {
  console.log(`\nNote: ${report.focus_areas_with_zero_recipes.length} focus areas have no matching recipes.`)
  console.log('This is expected when the recipe collection is smaller than the directory scope.')
  console.log('Focus areas with no matches will show "No matching recipes" in the UI.')
}

process.exit(pass ? 0 : 1)
