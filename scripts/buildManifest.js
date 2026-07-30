/**
 * Build the official source manifest JSON from SR Legacy exact matches
 * plus Foundation Foods data for bok choy and documented fallbacks
 * for wheatgrass, turmeric, and aloe vera.
 *
 * Usage: node scripts/buildManifest.js
 *
 * Depends on: Docs/generated/sr-legacy-exact-matches.json
 *   To regenerate that file, run:
 *     node scripts/parseSrLegacyExact.js
 *   after downloading the USDA SR Legacy CSV dataset from:
 *     https://fdc.nal.usda.gov/download-datasets
 *   and extracting to scripts/sr_legacy/FoodData_Central_sr_legacy_food_csv_2018-04/
 *
 * Output: Docs/generated/official-source-manifest.json
 */
const fs = require('fs')
const path = require('path')

const exactMatches = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Docs', 'generated', 'sr-legacy-exact-matches.json'), 'utf8'))

// Non-SR Legacy records (manually verified)
const nonSrRecords = {
  bok_choy: {
    fdcId: 2685572,
    ndbNumber: '11116',
    dataType: 'foundation_food',
    description: 'Cabbage, bok choy, raw',
    sourceAuthority: 'USDA',
    sourceDataset: 'Foundation Foods',
    portions: [
      { gramWeight: 70, portionDescription: '1 cup, shredded', modifier: 'cup, shredded', amount: 1, measureUnit: 'undetermined' },
    ],
    citationText: 'USDA FoodData Central Foundation Foods FDC ID 2685572, Cabbage, bok choy, raw (NDB 11116)',
    confidence: 'high',
    notes: 'Bok choy is available in Foundation Foods (April 2026 release) but not in SR Legacy (April 2018). Portion weight from Foundation Foods measure data.',
  },
  wheatgrass: {
    fdcId: null,
    ndbNumber: null,
    dataType: null,
    description: 'Wheatgrass, raw',
    sourceAuthority: 'USDA',
    sourceDataset: 'FNDDS 2021-2023',
    portions: [],
    citationText: 'USDA FoodData Central FNDDS 2021-2023 — wheatgrass has no standardized portion weight in SR Legacy, Foundation Foods, or FNDDS',
    confidence: 'low',
    notes: 'Wheatgrass is typically juiced in small amounts measured by weight. No standardized USDA household measure exists in any FoodData Central data type.',
  },
  turmeric: {
    fdcId: 170556,
    ndbNumber: null,
    dataType: 'foundation_food',
    description: 'Turmeric, raw',
    sourceAuthority: 'USDA',
    sourceDataset: 'Foundation Foods',
    portions: [],
    citationText: 'USDA FoodData Central Foundation Foods FDC ID 170556, Turmeric, raw',
    confidence: 'low',
    notes: 'USDA Foundation Foods has turmeric raw (FDC 170556) but lacks standardized household measure data. No direct suitable raw turmeric household portion was verified.',
  },
  aloe_vera: {
    fdcId: null,
    ndbNumber: null,
    dataType: null,
    description: 'Aloe vera, raw',
    sourceAuthority: 'USDA',
    sourceDataset: 'FNDDS 2021-2023',
    portions: [],
    citationText: 'USDA FoodData Central FNDDS 2021-2023 — aloe vera gel has no standardized USDA household portion weight',
    confidence: 'low',
    notes: 'Aloe vera is typically used as extracted gel measured by weight. No standardized USDA household measure exists for raw aloe leaves in any FoodData Central data type.',
  },
}

// Build the manifest
const manifest = {}
const accessedDate = '2026-07-30'

// Add SR Legacy records
for (const [produceId, data] of Object.entries(exactMatches.results)) {
  // Skip apple_green and apple_red — they alias to the same SR Legacy record as apple
  if (produceId === 'apple_green' || produceId === 'apple_red') {
    continue
  }

  manifest[produceId] = {
    produceId,
    fdcId: parseInt(data.fdcId),
    ndbNumber: data.ndbNumber,
    dataType: 'sr_legacy_food',
    description: data.description,
    sourceAuthority: 'USDA',
    sourceDataset: 'SR Legacy (April 2018)',
    citationText: `USDA FoodData Central SR Legacy NDB ${data.ndbNumber}, ${data.description} (FDC ID ${data.fdcId})`,
    accessedDate,
    portions: data.portions.map(p => ({
      gramWeight: p.gramWeight,
      portionDescription: p.portionDescription || p.modifier,
      modifier: p.modifier,
      amount: parseFloat(p.amount) || 1,
      measureUnit: p.measureUnitName,
      seqNum: parseInt(p.seqNum) || 0,
    })),
  }
}

// Add non-SR records
for (const [produceId, data] of Object.entries(nonSrRecords)) {
  manifest[produceId] = {
    produceId,
    fdcId: data.fdcId,
    ndbNumber: data.ndbNumber,
    dataType: data.dataType,
    description: data.description,
    sourceAuthority: data.sourceAuthority,
    sourceDataset: data.sourceDataset,
    citationText: data.citationText,
    accessedDate,
    portions: data.portions,
    confidence: data.confidence || 'high',
    notes: data.notes,
  }
}

// Add apple aliases
if (manifest.apple) {
  manifest.apple_green = { ...manifest.apple, produceId: 'apple_green' }
  manifest.apple_red = { ...manifest.apple, produceId: 'apple_red' }
}

// Count summary
const totalRecords = Object.keys(manifest).length
const srLegacyCount = Object.values(manifest).filter(m => m.dataType === 'sr_legacy_food').length
const foundationCount = Object.values(manifest).filter(m => m.dataType === 'foundation_food').length
const noDataCount = Object.values(manifest).filter(m => m.dataType === null).length
const totalPortions = Object.values(manifest).reduce((sum, m) => sum + m.portions.length, 0)

const output = {
  manifestVersion: '2.0',
  generatedAt: '2026-07-30T15:41:12.025Z',
  sourceDataset: 'USDA FoodData Central SR Legacy (April 2018) + Foundation Foods (April 2026)',
  accessedDate,
  summary: {
    totalRecords,
    srLegacyRecords: srLegacyCount,
    foundationFoodRecords: foundationCount,
    noStandardDataRecords: noDataCount,
    totalPortions,
  },
  records: manifest,
}

const outPath = path.join(__dirname, '..', 'Docs', 'generated', 'official-source-manifest.json')
fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

console.log('=== OFFICIAL SOURCE MANIFEST ===')
console.log('Total records:', totalRecords)
console.log('SR Legacy records:', srLegacyCount)
console.log('Foundation Foods records:', foundationCount)
console.log('No standard data records:', noDataCount)
console.log('Total portions:', totalPortions)
console.log('Saved to:', outPath)

// Print per-record summary
console.log('\n=== RECORD SUMMARY ===')
Object.entries(manifest).forEach(([id, r]) => {
  const conf = r.confidence || 'high'
  console.log(`${id}: NDB=${r.ndbNumber || 'N/A'} FDC=${r.fdcId || 'N/A'} "${r.description}" ${r.portions.length} portions [${conf}]`)
})
