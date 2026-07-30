/**
 * Cross-check every USDA sr() call in producePortions.ts against the manifest.
 * Reports any NDB, FDC ID, or description mismatches.
 *
 * Usage: node scripts/crossCheck.js
 * Exits 0 if all records match, 1 if any mismatches are found.
 *
 * Validation-only — does not modify any files.
 */
const fs = require('fs')
const path = require('path')

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Docs', 'generated', 'official-source-manifest.json'), 'utf8'))
const content = fs.readFileSync(path.join(__dirname, '..', 'src', 'constants', 'producePortions.ts'), 'utf8')

// Extract all sr() calls with their produceId context
const srRegex = /sr\(\s*'USDA',\s*'([^']+)',\s*(null|'[^']*'),\s*(null|\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g
let match
const mismatches = []
const correct = []

while ((match = srRegex.exec(content)) !== null) {
  const [full, dataset, ndbRaw, fdcRaw, portionDesc, prepState, edibleBasis, citation] = match
  const ndb = ndbRaw === 'null' ? null : ndbRaw.replace(/'/g, '')
  const fdc = fdcRaw === 'null' ? null : parseInt(fdcRaw, 10)

  // Find which produceId this belongs to
  const beforeText = content.substring(0, match.index)
  const produceIdMatches = [...beforeText.matchAll(/produceId:\s*'([^']+)'/g)]
  const produceId = produceIdMatches.length > 0 ? produceIdMatches[produceIdMatches.length - 1][1] : null

  if (!produceId) continue

  // Look up in manifest (try both exact and normalized match)
  let manifestRecord = manifest.records[produceId]
  if (!manifestRecord) {
    // Try normalized (remove ñ → n)
    const normalized = produceId.replace(/ñ/g, 'n').replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
    manifestRecord = manifest.records[normalized]
  }

  if (!manifestRecord) {
    mismatches.push({ produceId, issue: 'NOT IN MANIFEST', ndb, fdc, citation })
    continue
  }

  const issues = []
  if (ndb && manifestRecord.ndbNumber && ndb !== manifestRecord.ndbNumber) {
    issues.push(`NDB mismatch: registry=${ndb}, manifest=${manifestRecord.ndbNumber}`)
  }
  if (fdc && manifestRecord.fdcId && fdc !== manifestRecord.fdcId) {
    issues.push(`FDC mismatch: registry=${fdc}, manifest=${manifestRecord.fdcId}`)
  }

  // Skip description check for null/null records (no standard USDA data —
  // citation is a descriptive note, not a USDA food description)
  if (ndb !== null || fdc !== null) {
    if (!citation.includes(manifestRecord.description.split(',')[0])) {
      const descPart = manifestRecord.description.split(',')[0].trim()
      if (!citation.includes(descPart)) {
        issues.push(`Description mismatch: citation doesn't include "${descPart}"`)
      }
    }
  }

  if (issues.length > 0) {
    mismatches.push({ produceId, issues, ndb, fdc, manifestNdb: manifestRecord.ndbNumber, manifestFdc: manifestRecord.fdcId, citation })
  } else {
    correct.push({ produceId, ndb, fdc })
  }
}

console.log('=== CROSS-CHECK: Registry vs Manifest ===\n')
console.log(`Total USDA sr() calls: ${correct.length + mismatches.length}`)
console.log(`Correct: ${correct.length}`)
console.log(`Mismatches: ${mismatches.length}`)

if (mismatches.length > 0) {
  console.log('\n--- MISMATCHES ---')
  for (const m of mismatches) {
    console.log(`\n  ${m.produceId}:`)
    if (m.issue) {
      console.log(`    ${m.issue}`)
    } else {
      for (const i of m.issues) console.log(`    ${i}`)
    }
    console.log(`    Registry: NDB=${m.ndb}, FDC=${m.fdc}`)
    if (m.manifestNdb) console.log(`    Manifest: NDB=${m.manifestNdb}, FDC=${m.manifestFdc}`)
    console.log(`    Citation: ${m.citation}`)
  }
  console.log(`\n${mismatches.length} mismatch(es) found.`)
  process.exit(1)
} else {
  console.log('\nAll USDA sr() calls match the manifest.')
}
