# Produce Portion Conversion Audit

## Registry Overview

| Metric | Value |
|--------|-------|
| Total produce IDs | 69 |
| SR Legacy records | 65 |
| Foundation Foods records | 2 |
| No standard USDA data records | 2 |
| Source authorities | USDA SR Legacy, USDA Foundation Foods, USDA FNDDS, FDA 21 CFR Appendix C |
| Confidence: high | 66 |
| Confidence: medium | 0 |
| Confidence: low | 3 |
| Registry file | `src/constants/producePortions.ts` |
| Validator script | `scripts/validateProducePortions.ts` |
| Test file | `src/constants/__tests__/producePortions.test.ts` |
| Official manifest | `Docs/generated/official-source-manifest.json` |
| Accessed date | 2025-01-15 |

## Schema Summary (v2 — Redesigned)

Each `SourceRecord` contains:
- `authority` — 'USDA' | 'FDA' | 'peer-reviewed'
- `dataset` — e.g. 'SR Legacy', 'Foundation Foods', 'FNDDS', '21 CFR Appendix C'
- `ndbNumber` — USDA NDB number (string | null) — stable identifier linked to the food, not the record
- `fdcId` — USDA FoodData Central ID (number | null) — permanent identifier for the food record
- `recordId` — computed: `ndbNumber ?? String(fdcId) ?? ''`
- `sourcePortionDescription` — description of the portion measure from the source
- `preparationState` — e.g. 'raw', 'raw, with skin'
- `edibleBasis` — e.g. 'edible portion without refuse'
- `citationText` — full citation string
- `accessedDate` — date the data was accessed

## Identifier Correction Summary

This audit documents a correction from the original registry which had **51 mismatched NDB numbers** and **6 missing NDB numbers** out of 65 SR Legacy records. The original registry used FDC IDs (6-digit numbers like 170393) in the `recordId` field instead of NDB numbers (4-5 digit numbers like 11124). The corrected registry uses proper NDB numbers as the primary identifier, with FDC IDs stored in the new typed `fdcId` field.

### Data Sources

| Dataset | Records | Description |
|---------|---------|-------------|
| SR Legacy (April 2018) | 65 | Primary source — exact description matching against `food.csv` and `food_portion.csv` |
| Foundation Foods (April 2026) | 2 | Bok choy (FDC 2685572, NDB 11116) and turmeric (FDC 170556) |
| FNDDS 2021-2023 | 2 | Wheatgrass and aloe vera — no standardized USDA household measures exist |

## Per-Produce Summary

### Greens (12)

| Produce ID | NDB | FDC ID | Description | Dataset | Confidence |
|------------|-----|--------|-------------|---------|------------|
| kale | 11233 | 168421 | Kale, raw | SR Legacy | high |
| spinach | 11457 | 168462 | Spinach, raw | SR Legacy | high |
| swiss_chard | 11147 | 169991 | Chard, swiss, raw | SR Legacy | high |
| collard_greens | 11161 | 170406 | Collards, raw | SR Legacy | high |
| dandelion_greens | 11207 | 169226 | Dandelion greens, raw | SR Legacy | high |
| arugula | 11959 | 169387 | Arugula, raw | SR Legacy | high |
| romaine | 11251 | 169247 | Lettuce, cos or romaine, raw | SR Legacy | high |
| parsley | 11297 | 170416 | Parsley, fresh | SR Legacy | high |
| cilantro | 11165 | 169997 | Coriander (cilantro) leaves, raw | SR Legacy | high |
| mint | 2065 | 173475 | Spearmint, fresh | SR Legacy | high |
| basil | 2044 | 172232 | Basil, fresh | SR Legacy | high |
| watercress | 11591 | 170068 | Watercress, raw | SR Legacy | high |

## Weight-Only Records

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
- **Official source manifest**: `Docs/generated/official-source-manifest.json` (69 records, 278 portions)

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
| `src/constants/producePortions.ts` | Registry with 69 records, redesigned SourceRecord schema with typed NDB + FDC IDs |
| `scripts/validateProducePortions.ts` | Standalone validator script (22 checks including manifest reconciliation) |
| `src/constants/__tests__/producePortions.test.ts` | Jest test suite (22 test categories) |
| `Docs/generated/official-source-manifest.json` | Official source manifest with verified NDB numbers, FDC IDs, and portion data |
| `Docs/produce-portion-conversion-audit.md` | This audit report |
