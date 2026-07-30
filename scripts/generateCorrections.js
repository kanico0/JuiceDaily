/**
 * Generate corrected sourceRecords for all 69 produce items.
 * Reads the official manifest and outputs the corrected sr() calls.
 *
 * Usage: node scripts/generateCorrections.js
 *
 * Depends on: Docs/generated/official-source-manifest.json
 *   (regenerate with: node scripts/buildManifest.js)
 *
 * Output: Docs/generated/source-record-corrections.json
 */
const fs = require('fs')
const path = require('path')

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Docs', 'generated', 'official-source-manifest.json'), 'utf8'))

// Map of produceId -> { ndb, fdcId, description, dataset, citationText }
const records = manifest.records

// Read the current producePortions.ts to extract existing sr() calls
// for FDA records (which are correct and should be preserved)
const currentContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'constants', 'producePortions.ts'), 'utf8')

// For each produce item, output the corrected USDA sr() call
// FDA records stay the same
const corrections = {}

for (const [produceId, data] of Object.entries(records)) {
  if (data.sourceAuthority === 'USDA') {
    const ndb = data.ndbNumber
    const fdcId = data.fdcId
    const desc = data.description
    const dataset = data.sourceDataset.includes('SR Legacy') ? 'SR Legacy' :
                    data.sourceDataset.includes('Foundation') ? 'Foundation Foods' :
                    data.sourceDataset.includes('FNDDS') ? 'FNDDS' : data.sourceDataset

    // Build the corrected citation text
    let citation
    if (ndb && fdcId) {
      citation = `USDA FoodData Central ${dataset} NDB ${ndb}, ${desc} (FDC ID ${fdcId})`
    } else if (fdcId) {
      citation = `USDA FoodData Central ${dataset} FDC ID ${fdcId}, ${desc}`
    } else {
      citation = data.citationText
    }

    corrections[produceId] = {
      oldRecordId: null, // will be filled from current file
      newNdb: ndb,
      newFdcId: fdcId,
      newRecordId: ndb || String(fdcId),
      newCitation: citation,
      dataset,
      description: desc,
    }
  }
}

// Extract current sr() calls to find old recordIds
const srPattern = /sr\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g
let match
while ((match = srPattern.exec(currentContent)) !== null) {
  const authority = match[1]
  const dataset = match[2]
  const recordId = match[3]
  const citation = match[7]

  // Find which produce this belongs to by looking at nearby produceId
  const beforeText = currentContent.substring(0, match.index)
  const produceIdMatch = beforeText.match(/produceId:\s*['"](\w+)['"]/g)
  if (produceIdMatch) {
    const lastMatch = produceIdMatch[produceIdMatch.length - 1]
    const produceId = lastMatch.match(/produceId:\s*['"](\w+)['"]/)[1]

    if (authority === 'USDA' && corrections[produceId]) {
      corrections[produceId].oldRecordId = recordId
      corrections[produceId].oldCitation = citation
    }
  }
}

// Print corrections
console.log('=== CORRECTIONS NEEDED ===')
let count = 0
for (const [produceId, corr] of Object.entries(corrections)) {
  if (corr.oldRecordId && corr.oldRecordId !== corr.newRecordId) {
    count++
    console.log(`\n${produceId}:`)
    console.log(`  OLD: recordId='${corr.oldRecordId}', citation="${corr.oldCitation}"`)
    console.log(`  NEW: recordId='${corr.newRecordId}', citation="${corr.newCitation}"`)
  }
}
console.log(`\nTotal corrections: ${count}`)

// Save corrections to JSON for use in editing
const outPath = path.join(__dirname, '..', 'Docs', 'generated', 'source-record-corrections.json')
fs.writeFileSync(outPath, JSON.stringify(corrections, null, 2))
console.log('Saved to', outPath)
