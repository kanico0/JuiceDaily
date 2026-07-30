#!/usr/bin/env node
// scripts/import-recipes.js
// Deterministic import pipeline: reads combined recipe JSON, repairs
// mojibake, validates schema, writes normalized bundled JSON.
//
// Usage: node scripts/import-recipes.js
// Exit code: nonzero on validation failure

const fs = require('fs')
const path = require('path')

const { computeDatasetFingerprint } = require('../src/utils/datasetFingerprint')

const INPUT_PATH = path.resolve(__dirname, '../Docs/RawLifeFlow_1000_Combined_Recipe_Library.json')
const OUTPUT_PATH = path.resolve(__dirname, '../src/constants/recipeLibrary1000.json')
const REPAIR_REPORT_PATH = path.resolve(__dirname, '../Docs/generated/encoding-repair-report.json')

// ── Mojibake repair map ──────────────────────────────────────
// Emoji mojibake patterns (from juiceIdeas90.js double-encoding)
const EMOJI_REPAIRS = [
  ['\u00f0\u0178\u0152\u00bf', '\uD83C\uDF3F'], // ðŸŒ¿ → 🌿
  ['\u00e2\u02dc\u20ac\u00ef\u00b8', '\u2600\uFE0F'], // â˜€ï¸ → ☀️
  ['\u00e2\u00a4\u00ef\u00b8', '\u2764\uFE0F'],     // â¤ï¸ → ❤️
  ['\u00f0\u0178\u0160', '\uD83D\uDCAA'],           // ðŸŠ → 💪
  ['\u00f0\u0178\u00ef\u00b8', '\uD83C\uDF34'],     // ðŸï¸ → 🌴
  ['\u00f0\u0178\u2019\u00a7', '\uD83D\uDCA7'],     // ðŸ'§ → 💧
  ['\u00f0\u0178\u0152\u00b1', '\uD83C\uDF31'],     // ðŸŒ± → 🌱
  ['\u00f0\u0178\u00a5\u00ac', '\uD83E\uDD6C'],     // ðŸ¥¬ → 🥬
  ['\u00f0\u0178\u201d\u00a5', '\uD83D\uDD25'],     // ðŸ"¥ → 🔥
]

// Character-level mojibake repairs
const MOJIBAKE_REPLACEMENTS = [
  [/\u00C2\u00BD/g, '\u00BD'],   // Â½ → ½
  [/\u00C3\u0082\u00C2\u00BD/g, '\u00BD'], // Ã‚Â½ → ½
  [/\u00C3\u0082/g, ''],          // Ã‚ → strip
  [/\u00C2\u00A0/g, ' '],         // non-breaking space → space
  // JalapeÃ±o → Jalapeño
  [/Jalape\u00C3\u00B1o/g, 'Jalape\u00F1o'],
]

// Known mojibake markers that should NOT appear after repair
// Check for Latin-1 supplement chars that indicate mojibake
const MOJIBAKE_MARKERS = /[\u00C0-\u00FF]{2,}/g

function repairString(str) {
  if (typeof str !== 'string') return str
  let result = str

  // Fix emoji mojibake first (multi-byte sequences)
  for (const [bad, good] of EMOJI_REPAIRS) {
    while (result.includes(bad)) {
      result = result.replace(bad, good)
    }
  }

  // Fix character-level mojibake
  for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }

  // Fix remaining Â½ patterns (U+00C2 before a fraction)
  result = result.replace(/\u00C2\u00BD/g, '\u00BD')
  result = result.replace(/\u00C2\u00BC/g, '\u00BC')
  result = result.replace(/\u00C2\u00BE/g, '\u00BE')
  // Strip stray U+00C2 (Ã‚) that remains after fraction fixes
  result = result.replace(/\u00C2(?!\u00BD|\u00BC|\u00BE)/g, '')

  return result
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  console.log('Reading combined recipe library...')
  const rawData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'))
  const recipes = rawData.recipes

  console.log(`Found ${recipes.length} recipes`)

  // ── Repair mojibake ────────────────────────────────────────
  const repairs = []
  const repairedRecipes = recipes.map((recipe) => {
    const repaired = { ...recipe }

    // title
    const origTitle = recipe.title
    repaired.title = repairString(origTitle)
    if (repaired.title !== origTitle) {
      repairs.push({ id: recipe.id, field: 'title', original: origTitle, corrected: repaired.title })
    }

    // vibeTag
    const origVibe = recipe.vibeTag
    repaired.vibeTag = repairString(origVibe)
    if (repaired.vibeTag !== origVibe) {
      repairs.push({ id: recipe.id, field: 'vibeTag', original: origVibe, corrected: repaired.vibeTag })
    }

    // description
    const origDesc = recipe.description
    repaired.description = repairString(origDesc)
    if (repaired.description !== origDesc) {
      repairs.push({ id: recipe.id, field: 'description', original: origDesc, corrected: repaired.description })
    }

    // ingredients
    repaired.ingredients = recipe.ingredients.map((ing, idx) => {
      const rIng = { ...ing }
      const origName = ing.name
      rIng.name = repairString(origName)
      if (rIng.name !== origName) {
        repairs.push({ id: recipe.id, field: `ingredients[${idx}].name`, original: origName, corrected: rIng.name })
      }
      const origAmount = ing.amount
      rIng.amount = repairString(origAmount)
      if (rIng.amount !== origAmount) {
        repairs.push({ id: recipe.id, field: `ingredients[${idx}].amount`, original: origAmount, corrected: rIng.amount })
      }
      return rIng
    })

    // benefits
    if (recipe.benefits) {
      repaired.benefits = recipe.benefits.map((b, idx) => {
        const rB = { ...b }
        const origLabel = b.label
        rB.label = repairString(origLabel)
        if (rB.label !== origLabel) {
          repairs.push({ id: recipe.id, field: `benefits[${idx}].label`, original: origLabel, corrected: rB.label })
        }
        return rB
      })
    }

    return repaired
  })

  // ── Validation ─────────────────────────────────────────────
  const errors = []

  // 1. Exactly 1000 recipes
  if (repairedRecipes.length !== 1000) {
    errors.push(`Expected 1000 recipes, got ${repairedRecipes.length}`)
  }

  // 2. Unique IDs
  const ids = repairedRecipes.map((r) => r.id)
  const idSet = new Set(ids)
  if (idSet.size !== ids.length) {
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i)
    errors.push(`Duplicate IDs: ${[...new Set(dupIds)].join(', ')}`)
  }

  // 3. Unique titles
  const titles = repairedRecipes.map((r) => r.title)
  const titleSet = new Set(titles)
  if (titleSet.size !== titles.length) {
    const dupTitles = titles.filter((t, i) => titles.indexOf(t) !== i)
    errors.push(`Duplicate titles: ${[...new Set(dupTitles)].join(', ')}`)
  }

  // 4. Valid ingredients
  for (const r of repairedRecipes) {
    if (!r.ingredients || r.ingredients.length === 0) {
      errors.push(`${r.id}: no ingredients`)
    }
    for (const ing of r.ingredients || []) {
      if (!ing.produceId || ing.produceId.length === 0) {
        errors.push(`${r.id}: ingredient missing produceId`)
      }
      if (!ing.name || ing.name.length === 0) {
        errors.push(`${r.id}: ingredient missing name`)
      }
      if (!ing.amount || ing.amount.length === 0) {
        errors.push(`${r.id}: ingredient missing amount`)
      }
      if (typeof ing.ratio !== 'number' || ing.ratio < 0 || ing.ratio > 1) {
        errors.push(`${r.id}: invalid ratio ${ing.ratio} for ${ing.name}`)
      }
      if (!ing.color || !ing.color.startsWith('#')) {
        errors.push(`${r.id}: invalid color ${ing.color} for ${ing.name}`)
      }
    }
  }

  // 5. Ratios totaling 1.00 within tolerance
  const RATIO_TOLERANCE = 0.02
  for (const r of repairedRecipes) {
    const sum = r.ingredients.reduce((acc, ing) => acc + ing.ratio, 0)
    if (Math.abs(sum - 1.0) > RATIO_TOLERANCE) {
      errors.push(`${r.id}: ratios sum to ${sum.toFixed(4)} (tolerance ±${RATIO_TOLERANCE})`)
    }
  }

  // 6. Valid tiers
  const validTiers = new Set(['free', 'pro'])
  for (const r of repairedRecipes) {
    if (!validTiers.has(r.tier)) {
      errors.push(`${r.id}: invalid tier "${r.tier}"`)
    }
  }

  // 7. Valid collections
  const validCollections = new Set(['core', 'glow_library', 'seasonal', 'beginner_path'])
  for (const r of repairedRecipes) {
    if (!validCollections.has(r.collection)) {
      errors.push(`${r.id}: invalid collection "${r.collection}"`)
    }
  }

  // 8. Valid pillars
  const validPillars = new Set(['base', 'power', 'kick'])
  for (const r of repairedRecipes) {
    if (!r.pillars || r.pillars.length === 0) {
      errors.push(`${r.id}: no pillars`)
    }
    for (const p of r.pillars || []) {
      if (!validPillars.has(p)) {
        errors.push(`${r.id}: invalid pillar "${p}"`)
      }
    }
  }

  // 9. Valid cleanupScore
  for (const r of repairedRecipes) {
    if (typeof r.cleanupScore !== 'number' || r.cleanupScore < 0 || r.cleanupScore > 5) {
      errors.push(`${r.id}: invalid cleanupScore ${r.cleanupScore}`)
    }
  }

  // 10. Valid gradientColors
  for (const r of repairedRecipes) {
    if (!r.gradientColors || r.gradientColors.length !== 3) {
      errors.push(`${r.id}: gradientColors must have 3 entries`)
    }
    for (const c of r.gradientColors || []) {
      if (!c || !c.startsWith('#')) {
        errors.push(`${r.id}: invalid gradient color ${c}`)
      }
    }
  }

  // 11. Valid benefit icons
  const validIcons = new Set([
    'Zap', 'Shield', 'Droplets', 'Flame', 'Sparkles', 'Sun', 'Heart',
    'Leaf', 'Crown', 'Star', 'Moon', 'Cloud', 'Wind', 'Target',
    'Activity', 'Award', 'Check', 'Coffee', 'Eye', 'Feather',
  ])
  for (const r of repairedRecipes) {
    for (const b of r.benefits || []) {
      if (!validIcons.has(b.icon)) {
        // Not blocking — just warn
        console.warn(`WARN: ${r.id}: unknown benefit icon "${b.icon}"`)
      }
    }
  }

  // 12. No exact duplicate recipe objects
  const seen = new Set()
  for (const r of repairedRecipes) {
    const sig = JSON.stringify(r)
    if (seen.has(sig)) {
      errors.push(`${r.id}: exact duplicate recipe object`)
    }
    seen.add(sig)
  }

  // 13. Check for remaining mojibake markers
  for (const r of repairedRecipes) {
    const checkStr = [r.title, r.vibeTag, r.description, ...r.ingredients.map((i) => `${i.name} ${i.amount}`)].join(' ')
    const matches = checkStr.match(MOJIBAKE_MARKERS)
    if (matches) {
      errors.push(`${r.id}: remaining mojibake markers: ${matches.slice(0, 5).join(', ')}`)
    }
  }

  // ── Report ─────────────────────────────────────────────────
  console.log(`\nValidation: ${errors.length === 0 ? 'PASS' : 'FAIL'}`)
  if (errors.length > 0) {
    console.error(`\n${errors.length} validation errors:`)
    for (const e of errors.slice(0, 50)) {
      console.error(`  ${e}`)
    }
    if (errors.length > 50) {
      console.error(`  ... and ${errors.length - 50} more`)
    }
    process.exit(1)
  }

  // Stats
  const tiers = {}
  const collections = {}
  const pillars = {}
  const produceIds = new Set()
  let simpleCount = 0
  let advancedCount = 0

  for (const r of repairedRecipes) {
    tiers[r.tier] = (tiers[r.tier] || 0) + 1
    collections[r.collection] = (collections[r.collection] || 0) + 1
    for (const p of r.pillars) pillars[p] = (pillars[p] || 0) + 1
    const distinctIds = new Set(r.ingredients.map((i) => i.produceId.toLowerCase()))
    for (const id of distinctIds) produceIds.add(id)
    if (distinctIds.size >= 5) advancedCount++
    else simpleCount++
  }

  console.log('\nDataset statistics:')
  console.log(`  Total recipes: ${repairedRecipes.length}`)
  console.log(`  Tiers: ${JSON.stringify(tiers)}`)
  console.log(`  Collections: ${JSON.stringify(collections)}`)
  console.log(`  Pillars: ${JSON.stringify(pillars)}`)
  console.log(`  Simple: ${simpleCount}`)
  console.log(`  Advanced: ${advancedCount}`)
  console.log(`  Distinct produceIds: ${produceIds.size}`)

  // ── Compute dataset fingerprint ────────────────────────────
  // SHA-256 over normalized content that affects Wellness matching:
  // recipe ID + sorted distinct produceIds + distinct produceId count
  const datasetFingerprint = computeDatasetFingerprint(repairedRecipes)
  console.log(`\nDataset fingerprint: ${datasetFingerprint}`)

  // ── Write repair report ─────────────────────────────────────
  console.log(`Encoding repairs: ${repairs.length}`)
  fs.writeFileSync(REPAIR_REPORT_PATH, JSON.stringify({
    totalRepairs: repairs.length,
    repairs,
  }, null, 2))
  console.log(`Repair report: ${REPAIR_REPORT_PATH}`)

  // ── Write normalized bundled JSON ──────────────────────────
  const output = {
    exportedAt: rawData.exportedAt,
    totalRecipes: repairedRecipes.length,
    datasetFingerprint,
    recipes: repairedRecipes,
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 0))
  console.log(`\nBundled JSON written: ${OUTPUT_PATH}`)
  console.log('Done.')
}

main()
