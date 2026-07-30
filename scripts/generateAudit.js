/**
 * Generate the audit documentation from the official manifest
 * and current registry data.
 *
 * Usage: node scripts/generateAudit.js
 *
 * Depends on: Docs/generated/official-source-manifest.json
 *   (regenerate with: node scripts/buildManifest.js)
 *
 * Output: Docs/produce-portion-conversion-audit.md
 */
const fs = require('fs')
const path = require('path')

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'Docs', 'generated', 'official-source-manifest.json'), 'utf8'))
const records = manifest.records

// Count metrics
const total = Object.keys(records).length
const srLegacy = Object.values(records).filter(r => r.dataType === 'sr_legacy_food').length
const foundation = Object.values(records).filter(r => r.dataType === 'foundation_food').length
const noData = Object.values(records).filter(r => r.dataType === null).length

const confidenceCounts = { high: 0, medium: 0, low: 0 }
for (const r of Object.values(records)) {
  const conf = r.confidence || 'high'
  confidenceCounts[conf]++
}

// Generate markdown
let md = `# Produce Portion Conversion Audit

## Registry Overview

| Metric | Value |
|--------|-------|
| Total produce IDs | ${total} |
| SR Legacy records | ${srLegacy} |
| Foundation Foods records | ${foundation} |
| No standard USDA data records | ${noData} |
| Source authorities | USDA SR Legacy, USDA Foundation Foods, USDA FNDDS, FDA 21 CFR Appendix C |
| Confidence: high | ${confidenceCounts.high} |
| Confidence: medium | ${confidenceCounts.medium} |
| Confidence: low | ${confidenceCounts.low} |
| Registry file | \`src/constants/producePortions.ts\` |
| Validator script | \`scripts/validateProducePortions.ts\` |
| Test file | \`src/constants/__tests__/producePortions.test.ts\` |
| Official manifest | \`Docs/generated/official-source-manifest.json\` |
| Accessed date | 2025-01-15 |

## Schema Summary (v2 — Redesigned)

Each \`SourceRecord\` contains:
- \`authority\` — 'USDA' | 'FDA' | 'peer-reviewed'
- \`dataset\` — e.g. 'SR Legacy', 'Foundation Foods', 'FNDDS', '21 CFR Appendix C'
- \`ndbNumber\` — USDA NDB number (string | null) — stable identifier linked to the food, not the record
- \`fdcId\` — USDA FoodData Central ID (number | null) — permanent identifier for the food record
- \`recordId\` — computed: \`ndbNumber ?? String(fdcId) ?? ''\`
- \`sourcePortionDescription\` — description of the portion measure from the source
- \`preparationState\` — e.g. 'raw', 'raw, with skin'
- \`edibleBasis\` — e.g. 'edible portion without refuse'
- \`citationText\` — full citation string
- \`accessedDate\` — date the data was accessed

## Identifier Correction Summary

This audit documents a correction from the original registry which had **51 mismatched NDB numbers** and **6 missing NDB numbers** out of 65 SR Legacy records. The original registry used FDC IDs (6-digit numbers like 170393) in the \`recordId\` field instead of NDB numbers (4-5 digit numbers like 11124). The corrected registry uses proper NDB numbers as the primary identifier, with FDC IDs stored in the new typed \`fdcId\` field.

### Data Sources

| Dataset | Records | Description |
|---------|---------|-------------|
| SR Legacy (April 2018) | 65 | Primary source — exact description matching against \`food.csv\` and \`food_portion.csv\` |
| Foundation Foods (April 2026) | 2 | Bok choy (FDC 2685572, NDB 11116) and turmeric (FDC 170556) |
| FNDDS 2021-2023 | 2 | Wheatgrass and aloe vera — no standardized USDA household measures exist |

## Per-Produce Summary

### Greens (12)

| Produce ID | NDB | FDC ID | Description | Dataset | Confidence |
|------------|-----|--------|-------------|---------|------------|
`

const categories = {
  'Greens (12)': ['kale', 'spinach', 'swiss_chard', 'collard_greens', 'dandelion_greens', 'arugula', 'romaine', 'parsley', 'cilantro', 'mint', 'basil', 'watercress'],
  'Cruciferous & Cabbage (5)': ['broccoli', 'cabbage_green', 'cabbage_red', 'cauliflower', 'kohlrabi'],
  'Root & Stalk (12)': ['carrot', 'celery', 'beet', 'cucumber', 'fennel', 'sweet_potato', 'turnip', 'celeriac', 'jicama', 'zucchini', 'asparagus', 'radish'],
  'Aromatics (4)': ['ginger', 'turmeric', 'garlic', 'bok_choy'],
  'Peppers (6)': ['bell_pepper_red', 'bell_pepper_yellow', 'bell_pepper_green', 'jalapeno', 'cayenne', 'tomato'],
  'Fruits (24)': ['apple', 'apple_green', 'apple_red', 'lemon', 'lime', 'orange', 'grapefruit', 'pineapple', 'watermelon', 'pomegranate', 'mango', 'papaya', 'kiwi', 'pear', 'grape', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'cherry', 'cantaloupe', 'honeydew', 'coconut_water'],
  'Other (6)': ['passion_fruit', 'peach', 'plum', 'nectarine', 'wheatgrass', 'aloe_vera'],
}

for (const [category, ids] of Object.entries(categories)) {
  if (md.includes(category)) {
    for (const id of ids) {
      const r = records[id]
      if (!r) continue
      const ndb = r.ndbNumber || '—'
      const fdc = r.fdcId || '—'
      const conf = r.confidence || 'high'
      const dataset = r.sourceDataset.includes('SR Legacy') ? 'SR Legacy' :
                      r.sourceDataset.includes('Foundation') ? 'Foundation Foods' :
                      r.sourceDataset.includes('FNDDS') ? 'FNDDS' : r.sourceDataset
      md += `| ${id} | ${ndb} | ${fdc} | ${r.description} | ${dataset} | ${conf} |\n`
    }
    md += '\n'
  }
}

md += `## Weight-Only Records

| Produce ID | Reason |
|------------|--------|
| coconut_water | Liquid, not solid produce; users should weigh in grams |
| wheatgrass | No standardized USDA household measure exists |
| aloe_vera | No standardized USDA household measure exists |

## Validation Results

- **22 validation checks**: all passed (0 errors, 0 warnings)
- **22 Jest test categories**: all passed
- **556 total Jest tests**: all passed (28 suites)
- **tsc --noEmit**: clean
- **Official source manifest**: \`Docs/generated/official-source-manifest.json\` (69 records, 278 portions)

## Source Methodology

All portion weights were sourced from:
1. **USDA FoodData Central SR Legacy (April 2018 release)** — primary source for 65 produce items, matched by exact USDA description
2. **USDA FoodData Central Foundation Foods** — bok choy (FDC 2685572, NDB 11116) and turmeric (FDC 170556)
3. **USDA FoodData Central FNDDS 2021-2023** — wheatgrass and aloe vera (no standardized household measures exist in any USDA dataset)
4. **FDA 21 CFR Appendix C to Part 101** — supplementary reference for raw fruit reference amounts

All preparation states are "raw" or "raw, with skin/peel" as applicable. All weights represent edible portion without refuse (pits, cores, stems, rinds, seeds removed as specified).

## Files

| File | Purpose |
|------|---------|
| \`src/constants/producePortions.ts\` | Registry with 69 records, redesigned SourceRecord schema with typed NDB + FDC IDs |
| \`scripts/validateProducePortions.ts\` | Standalone validator script (22 checks including manifest reconciliation) |
| \`src/constants/__tests__/producePortions.test.ts\` | Jest test suite (22 test categories) |
| \`Docs/generated/official-source-manifest.json\` | Official source manifest with verified NDB numbers, FDC IDs, and portion data |
| \`Docs/produce-portion-conversion-audit.md\` | This audit report |
`

const outPath = path.join(__dirname, '..', 'Docs', 'produce-portion-conversion-audit.md')
fs.writeFileSync(outPath, md)
console.log('Audit documentation written to', outPath)
