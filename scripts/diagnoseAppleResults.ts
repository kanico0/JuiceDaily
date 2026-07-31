// Diagnostic: breakdown of Apple-family recipe IDs
// Run with: npx tsx scripts/diagnoseAppleResults.ts

import { searchRecipes } from '../src/services/recipeSearch'
import { getRecipesForProduce } from '../src/services/produceRecipeMatcher'
import {
  getRecipeIdsForProduceFamily,
  PRODUCE_FAMILIES,
} from '../src/services/produceFamilies'
import { RECIPES, getRecipeById, getRecipeBlendType } from '../src/constants/recipeData'

const familyIds = getRecipeIdsForProduceFamily('apple')
console.log(`\n=== Apple Family Recipe Breakdown ===`)
console.log(`Total Apple-family recipe IDs: ${familyIds.length}`)

const browseResults = searchRecipes('apple', undefined, 1000)
const browseIds = browseResults.map((r) => r.id)
console.log(`Browse "apple" result count: ${browseIds.length}`)

const produceResults = getRecipesForProduce(['apple'])
const produceIds = produceResults.matches.map((m) => m.recipeId)
console.log(`Produce-First ['apple'] result count: ${produceIds.length}`)

const ids = familyIds

const uniqueIds = new Set(ids)
const duplicates = ids.filter((id) => ids.indexOf(id) !== ids.lastIndexOf(id))
console.log(`\nDuplicate recipe IDs: ${duplicates.length}`)

let missingMetadata = 0
for (const id of ids) {
  const recipe = getRecipeById(id)
  if (!recipe || !recipe.tier || !recipe.collection) {
    missingMetadata++
  }
}
console.log(`Recipes missing required metadata: ${missingMetadata}`)

const free = ids.filter((id) => { const r = getRecipeById(id); return r && r.tier === 'free' })
const pro = ids.filter((id) => { const r = getRecipeById(id); return r && r.tier === 'pro' })
console.log(`\n--- Tier Breakdown ---`)
console.log(`Free: ${free.length}`)
console.log(`Pro: ${pro.length}`)
if (pro.length > 0) {
  console.log(`Pro recipe IDs:`)
  for (const id of pro) {
    const r = getRecipeById(id)
    const bt = r ? getRecipeBlendType(r) : 'unknown'
    console.log(`  ${id} - "${r?.title}" (collection: ${r?.collection}, blendType: ${bt})`)
  }
}

const core = ids.filter((id) => { const r = getRecipeById(id); return r && r.collection === 'core' })
const nonCore = ids.filter((id) => { const r = getRecipeById(id); return r && r.collection !== 'core' })
console.log(`\n--- Collection Breakdown ---`)
console.log(`core: ${core.length}`)
console.log(`non-core: ${nonCore.length}`)
if (nonCore.length > 0) {
  for (const id of nonCore) {
    const r = getRecipeById(id)
    console.log(`  ${id} - "${r?.title}" (collection: ${r?.collection})`)
  }
}

const simpleFree = ids.filter((id) => { const r = getRecipeById(id); return r && r.tier === 'free' && getRecipeBlendType(r) === 'simple' })
const advancedFree = ids.filter((id) => { const r = getRecipeById(id); return r && r.tier === 'free' && getRecipeBlendType(r) === 'advanced' })
const simplePro = ids.filter((id) => { const r = getRecipeById(id); return r && r.tier === 'pro' && getRecipeBlendType(r) === 'simple' })
const advancedPro = ids.filter((id) => { const r = getRecipeById(id); return r && r.tier === 'pro' && getRecipeBlendType(r) === 'advanced' })
console.log(`\n--- Simple/Advanced Breakdown ---`)
console.log(`Simple Free: ${simpleFree.length}`)
console.log(`Advanced Free: ${advancedFree.length}`)
console.log(`Simple Pro: ${simplePro.length}`)
console.log(`Advanced Pro: ${advancedPro.length}`)

console.log(`\n--- Visibility ---`)
console.log(`Recipes visible immediately to Free user: ${free.length}`)
console.log(`Recipes requiring Pro unlock: ${pro.length}`)

const allPro = RECIPES.filter((r) => r.tier === 'pro')
console.log(`\n--- All Pro Recipes in Library ---`)
for (const r of allPro) {
  const inApple = ids.includes(r.id)
  const bt = getRecipeBlendType(r)
  console.log(`  ${r.id} - "${r.title}" (collection: ${r.collection}, blendType: ${bt}) - In Apple set: ${inApple}`)
}

const browseSet = new Set(browseIds)
const produceSet = new Set(produceIds)
const familySet = new Set(ids)
const browseMissing = [...familySet].filter((x) => !browseSet.has(x))
const produceMissing = [...familySet].filter((x) => !produceSet.has(x))
const browseExtra = [...browseSet].filter((x) => !familySet.has(x))
const produceExtra = [...produceSet].filter((x) => !familySet.has(x))
console.log(`\n--- Parity Check ---`)
console.log(`Browse missing from family: ${browseMissing.length}`)
console.log(`Browse extra vs family: ${browseExtra.length}`)
console.log(`Produce missing from family: ${produceMissing.length}`)
console.log(`Produce extra vs family: ${produceExtra.length}`)

const pineappleIds = RECIPES.filter((r) =>
  r.ingredients.some((ing) => ing.produceId.toLowerCase() === 'pineapple')
).map((r) => r.id)
const pineappleInApple = pineappleIds.filter((id) => familySet.has(id))
console.log(`\n--- Pineapple Exclusion ---`)
console.log(`Total pineapple recipes in library: ${pineappleIds.length}`)
console.log(`Pineapple recipes in Apple set: ${pineappleInApple.length}`)
if (pineappleInApple.length > 0) {
  for (const id of pineappleInApple) {
    const r = getRecipeById(id)
    const hasApple = r?.ingredients.some((ing) => {
      const pid = ing.produceId.toLowerCase()
      return pid === 'apple' || pid === 'apple_red' || pid === 'apple_green'
    })
    console.log(`  ${id} - has actual apple ingredient: ${hasApple}`)
  }
}

console.log(`\n--- All Produce Families ---`)
for (const [key, members] of Object.entries(PRODUCE_FAMILIES)) {
  console.log(`  ${key}: [${members.join(', ')}]`)
}
