/**
 * Apply all corrections to producePortions.ts:
 * 1. Redesign SourceRecord with typed ndbNumber and fdcId fields
 * 2. Update sr() helper to accept new fields
 * 3. Fix all incorrect sr() calls with correct NDB numbers and FDC IDs
 *
 * Usage: node scripts/applyCorrections.js
 *
 * Depends on: Docs/generated/source-record-corrections.json
 *   (regenerate with: node scripts/generateCorrections.js)
 *
 * WARNING: This script rewrites src/constants/producePortions.ts in place.
 * Review the diff with git diff after running.
 */
const fs = require('fs')
const path = require('path')

const corrections = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Docs', 'generated', 'source-record-corrections.json'), 'utf8'))
const filePath = path.join(__dirname, '..', 'src', 'constants', 'producePortions.ts')
let content = fs.readFileSync(filePath, 'utf8')

// Step 1: Update SourceRecord interface
const oldInterface = `export interface SourceRecord {
  authority: 'USDA' | 'FDA' | 'peer-reviewed'
  dataset: string
  recordId: string
  sourcePortionDescription: string
  preparationState: string
  edibleBasis: string
  citationText: string
  accessedDate: string
}`

const newInterface = `export interface SourceRecord {
  authority: 'USDA' | 'FDA' | 'peer-reviewed'
  dataset: string
  ndbNumber: string | null
  fdcId: number | null
  recordId: string
  sourcePortionDescription: string
  preparationState: string
  edibleBasis: string
  citationText: string
  accessedDate: string
}`

content = content.replace(oldInterface, newInterface)

// Step 2: Update sr() helper
const oldHelper = `function sr(
  authority: SourceRecord['authority'],
  dataset: string,
  recordId: string,
  sourcePortionDescription: string,
  preparationState: string,
  edibleBasis: string,
  citationText: string,
): SourceRecord {
  return {
    authority,
    dataset,
    recordId,
    sourcePortionDescription,
    preparationState,
    edibleBasis,
    citationText,
    accessedDate: ACCESSED,
  }
}`

const newHelper = `function sr(
  authority: SourceRecord['authority'],
  dataset: string,
  ndbNumber: string | null,
  fdcId: number | null,
  sourcePortionDescription: string,
  preparationState: string,
  edibleBasis: string,
  citationText: string,
): SourceRecord {
  return {
    authority,
    dataset,
    ndbNumber,
    fdcId,
    recordId: ndbNumber ?? (fdcId != null ? String(fdcId) : ''),
    sourcePortionDescription,
    preparationState,
    edibleBasis,
    citationText,
    accessedDate: ACCESSED,
  }
}`

content = content.replace(oldHelper, newHelper)

// Step 3: Apply corrections to all USDA sr() calls
// New format: sr('USDA', 'SR Legacy', '11233', 168421, '...', '...', '...', '...')
// Old format: sr('USDA', 'SR Legacy', '11215', '...', '...', '...', '...')

// First, handle all USDA sr() calls that need correction
// We need to find each sr() call, determine which produceId it belongs to,
// and replace it with the corrected version

// Build a map of old sr() strings to new sr() strings
const srRegex = /sr\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]((?:[^'"]|\\.)*)['"]\s*,\s*['"]((?:[^'"]|\\.)*)['"]\s*,\s*['"]((?:[^'"]|\\.)*)['"]\s*,\s*['"]((?:[^'"]|\\.)*)['"]\s*\)/g

let match
let lastIndex = 0
const replacements = []

while ((match = srRegex.exec(content)) !== null) {
  const [fullMatch, authority, dataset, recordId, portionDesc, prepState, edibleBasis, citation] = match

  // Find which produceId this belongs to
  const beforeText = content.substring(0, match.index)
  const produceIdMatches = [...beforeText.matchAll(/produceId:\s*['"](\w+)['"]/g)]
  const produceId = produceIdMatches.length > 0
    ? produceIdMatches[produceIdMatches.length - 1][1]
    : null

  if (!produceId) continue

  const corr = corrections[produceId]
  if (!corr) continue

  if (authority === 'USDA') {
    // Build new sr() call with typed ndbNumber and fdcId
    const ndb = corr.newNdb && corr.newNdb !== 'null' ? `'${corr.newNdb}'` : 'null'
    const fdc = corr.newFdcId && corr.newFdcId !== 'null' ? corr.newFdcId : 'null'
    const newDataset = corr.dataset

    // Escape single quotes in citation
    const escapedCitation = corr.newCitation.replace(/'/g, "\\'")
    const escapedPortionDesc = portionDesc.replace(/'/g, "\\'")
    const escapedPrepState = prepState.replace(/'/g, "\\'")
    const escapedEdibleBasis = edibleBasis.replace(/'/g, "\\'")

    const newSr = `sr('USDA', '${newDataset}', ${ndb}, ${fdc}, '${escapedPortionDesc}', '${escapedPrepState}', '${escapedEdibleBasis}', '${escapedCitation}')`

    replacements.push({ old: fullMatch, new: newSr, start: match.index, end: match.index + fullMatch.length })
  } else if (authority === 'FDA') {
    // FDA records: add null, null for ndbNumber and fdcId
    const escapedPortionDesc = portionDesc.replace(/'/g, "\\'")
    const escapedPrepState = prepState.replace(/'/g, "\\'")
    const escapedEdibleBasis = edibleBasis.replace(/'/g, "\\'")
    const escapedCitation = citation.replace(/'/g, "\\'")

    const newSr = `sr('FDA', '${dataset}', null, null, '${escapedPortionDesc}', '${escapedPrepState}', '${escapedEdibleBasis}', '${escapedCitation}')`

    replacements.push({ old: fullMatch, new: newSr, start: match.index, end: match.index + fullMatch.length })
  }
}

// Apply replacements in reverse order to preserve indices
replacements.sort((a, b) => b.start - a.start)
for (const r of replacements) {
  content = content.substring(0, r.start) + r.new + content.substring(r.end)
}

// Write the corrected file
fs.writeFileSync(filePath, content)

console.log(`Applied ${replacements.length} corrections to ${filePath}`)
console.log(`  USDA corrections: ${replacements.filter(r => r.new.startsWith("sr('USDA'")).length}`)
console.log(`  FDA corrections: ${replacements.filter(r => r.new.startsWith("sr('FDA'")).length}`)
