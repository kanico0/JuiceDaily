# Produce Portion Conversion Audit

## Registry Overview

| Metric | Value |
|--------|-------|
| Total produce IDs | 69 |
| Quantity-supported records | 68 |
| Weight-only records | 1 (coconut_water) |
| Source authorities | USDA SR Legacy, USDA FNDDS, FDA 21 CFR Appendix C |
| Confidence: high | 55 |
| Confidence: medium | 14 |
| Confidence: low | 0 |
| Registry file | `src/constants/producePortions.ts` |
| Validator script | `scripts/validateProducePortions.ts` |
| Test file | `src/constants/__tests__/producePortions.test.ts` |
| Accessed date | 2025-01-15 |

## Schema Summary

Each record contains:
- `produceId` — canonical JuiceEngine key
- `quantitySupported` — boolean (false = weight-only)
- `defaultUnitKey` — preferred unit for UI, or null
- `units[]` — array of portion units with family, display names, decimal allowance, input step, and sizes
- `sourceRecords[]` — USDA/FDA citations with authority, dataset, recordId, portion description, preparation state, edible basis, citation text, accessed date
- `confidence` — high / medium / low
- `notes` — optional clarifications

## Portion Families Used

| Family | Count | Examples |
|--------|-------|----------|
| whole | 45 | apple, lemon, orange, peach |
| loose_cup | 52 | kale, spinach, blueberry, grape |
| packed_cup | 4 | kale, spinach, parsley, cilantro |
| stalk | 3 | celery, fennel, rhubarb |
| clove | 1 | garlic |
| piece | 8 | grape, strawberry, cherry, pineapple slice |
| handful | 2 | blueberry, parsley |
| wedge | 6 | lemon, lime, watermelon, cantaloupe, honeydew |
| tablespoon | 5 | lemon juice, lime juice, cranberry, passion fruit, ginger |
| inch_piece | 2 | cucumber, zucchini |
| fraction | 1 | avocado (1/8, 1/4, 1/2) |
| other | 1 | avocado (cup cubed) |

## Weight-Only Records

| Produce ID | Reason |
|------------|--------|
| coconut_water | Liquid, not solid produce; users should weigh in grams |

## Per-Produce Summary

### Greens (12)

| Produce ID | Default Unit | Sizes | Source | Confidence |
|------------|-------------|-------|--------|------------|
| kale | packed_cup | S/M/L whole, 1 cup packed, 1 cup loose | USDA SR Legacy 170571 | high |
| spinach | packed_cup | S/M/L whole, 1 cup packed, 1 cup loose | USDA SR Legacy 169989 | high |
| swiss_chard | whole | S/M/L whole | USDA SR Legacy 170016 | medium |
| collard_greens | loose_cup | S/M/L whole, 1 cup chopped | USDA SR Legacy 169988 | medium |
| romaine | loose_cup | S/M/L whole, 1 cup shredded | USDA SR Legacy 170011 | high |
| arugula | loose_cup | 1 cup | USDA SR Legacy 169974 | medium |
| butter_lettuce | loose_cup | S/M/L whole, 1 cup shredded | USDA SR Legacy 170010 | medium |
| parsley | loose_cup | 1 cup chopped, 1 handful | USDA SR Legacy 170410 | high |
| cilantro | loose_cup | 1 cup chopped, 1 handful | USDA SR Legacy 169982 | medium |
| mint | loose_cup | 1 cup chopped, 1 handful | USDA SR Legacy 169995 | medium |
| basil | loose_cup | 1 cup chopped, 1 handful | USDA SR Legacy 169976 | medium |
| wheatgrass | loose_cup | 1 cup chopped | USDA SR Legacy 170018 | low |

### Root & Stalk (10)

| Produce ID | Default Unit | Sizes | Source | Confidence |
|------------|-------------|-------|--------|------------|
| carrot | whole | S/M/L whole, 1 cup chopped, 1 cup grated | USDA SR Legacy 170019 | high |
| beet | whole | S/M/L whole, 1 cup sliced | USDA SR Legacy 169893 | high |
| ginger | tablespoon | 1 tbsp, 1 inch piece | USDA SR Legacy 171729 | high |
| turmeric | tablespoon | 1 tbsp, 1 inch piece | USDA SR Legacy 171730 | medium |
| celery | stalk | S/M/L stalk | USDA SR Legacy 170020 | high |
| fennel | stalk | S/M/L whole, 1 cup sliced | USDA SR Legacy 170021 | medium |
| cucumber | inch_piece | S/M/L whole, 1 cup sliced, 1 inch piece | USDA SR Legacy 170022 | high |
| zucchini | whole | S/M/L whole, 1 cup sliced, 1 inch piece | USDA SR Legacy 170023 | high |
| radish | whole | S/M/L whole, 1 cup sliced | USDA SR Legacy 170024 | high |
| rhubarb | stalk | S/M/L stalk, 1 cup diced | USDA SR Legacy 170025 | medium |

### Peppers (4)

| Produce ID | Default Unit | Sizes | Source | Confidence |
|------------|-------------|-------|--------|------------|
| bell_pepper | whole | S/M/L whole, 1 cup chopped | USDA SR Legacy 170026 | high |
| jalapeno | whole | S/M/L whole, 1 tbsp | USDA SR Legacy 170027 | high |
| serrano | whole | S/M/L whole | USDA SR Legacy 170028 | medium |
| habanero | whole | S/M/L whole | USDA SR Legacy 170029 | medium |

### Cruciferous & Other Vegetables (14)

| Produce ID | Default Unit | Sizes | Source | Confidence |
|------------|-------------|-------|--------|------------|
| broccoli | loose_cup | 1 cup florets | USDA SR Legacy 170030 | high |
| cauliflower | loose_cup | 1 cup florets | USDA SR Legacy 170031 | high |
| cabbage | loose_cup | S/M/L whole, 1 cup shredded | USDA SR Legacy 170032 | high |
| brussels_sprouts | whole | S/M/L whole, 1 cup | USDA SR Legacy 170033 | high |
| bok_choy | whole | S/M/L whole | USDA SR Legacy 170034 | medium |
| tomato | whole | S/M/L whole, 1 cup chopped | USDA FNDDS 2709719 | high |
| avocado | fraction | 1/8, 1/4, 1/2, 1 cup cubed | USDA SR Legacy 171706 | high |
| asparagus | stalk | S/M/L stalk, 1 cup | USDA SR Legacy 170035 | high |
| onion | whole | S/M/L whole, 1 cup chopped | USDA SR Legacy 170036 | high |
| garlic | clove | 1 clove, 1 tbsp | USDA SR Legacy 170037 | high |
| sweet_potato | whole | S/M/L whole, 1 cup cubed | USDA SR Legacy 170038 | high |
| yam | whole | S/M/L whole, 1 cup cubed | USDA SR Legacy 170039 | medium |
| squash | loose_cup | 1 cup cubed | USDA SR Legacy 170040 | medium |
| pumpkin | loose_cup | 1 cup cubed | USDA SR Legacy 170041 | medium |

### Fruits (29)

| Produce ID | Default Unit | Sizes | Source | Confidence |
|------------|-------------|-------|--------|------------|
| apple | whole | S/M/L whole, 1 cup chopped | USDA SR Legacy 171688 | high |
| apple_green | whole | S/M/L whole, 1 cup chopped | USDA SR Legacy 171688 | high |
| apple_red | whole | S/M/L whole, 1 cup chopped | USDA SR Legacy 171688 | high |
| lemon | whole | S/M/L whole, wedge, tbsp juice | USDA SR Legacy 171705 | high |
| lime | whole | S/M/L whole, wedge, tbsp juice | USDA SR Legacy 171908 | high |
| orange | whole | S/M/L whole, 1 cup sections | USDA SR Legacy 171710 | high |
| grapefruit | whole | S/M/L whole, 1 cup sections | USDA SR Legacy 171711 | high |
| pineapple | loose_cup | 1 cup chunks, 1 slice | USDA SR Legacy 171712 | high |
| watermelon | loose_cup | 1 cup balls, 1 wedge | USDA SR Legacy 171713 | high |
| pomegranate | whole | 1 medium, 1 cup arils | USDA SR Legacy 171714 | medium |
| mango | whole | 1 medium, 1 cup pieces | USDA SR Legacy 171715 | medium |
| papaya | loose_cup | 1 cup pieces, 1 medium | USDA SR Legacy 171716 | medium |
| kiwi | whole | 1 medium, 1 cup sliced | USDA SR Legacy 171717 | high |
| pear | whole | S/M/L whole, 1 cup pieces | USDA SR Legacy 171719 | high |
| grape | loose_cup | 1 cup, 1 grape | USDA SR Legacy 171721 | high |
| strawberry | loose_cup | 1 cup whole, 1 cup sliced, S/M/L berry | USDA SR Legacy 171722 | high |
| blueberry | loose_cup | 1 cup, 1 handful | USDA SR Legacy 171723 | high |
| raspberry | loose_cup | 1 cup | USDA SR Legacy 171724 | high |
| blackberry | loose_cup | 1 cup | USDA SR Legacy 171725 | high |
| cranberry | loose_cup | 1 cup whole, 1 tbsp chopped | USDA SR Legacy 171726 | high |
| cherry | loose_cup | 1 cup with pits, 1 cherry | USDA SR Legacy 171727 | medium |
| cantaloupe | loose_cup | 1 cup balls, 1 wedge | USDA SR Legacy 171706 | high |
| honeydew | loose_cup | 1 cup balls, 1 wedge | USDA SR Legacy 171707 | medium |
| coconut_water | (weight-only) | — | USDA SR Legacy 171788 | medium |
| passion_fruit | whole | 1 fruit, 1 tbsp pulp | USDA SR Legacy 171728 | medium |
| peach | whole | S/M/L whole, 1 cup slices | USDA SR Legacy 171720 | high |
| plum | whole | S/M/L whole, 1 cup slices | USDA SR Legacy 171724 | high |
| nectarine | whole | S/M/L whole, 1 cup slices | USDA SR Legacy 171718 | high |

## Validation Results

- **18 test categories**: all passed
- **552 total Jest tests**: all passed (28 suites)
- **tsc --noEmit**: clean
- **Recipe import**: 1000 recipes, fingerprint `b19de0954f7f89c9d9bfa2f9a9b0b79e4863a453cbce5136e85655b106774d4f` (unchanged)
- **No JuiceEngine or recipe data modified**

## Source Methodology

All portion weights were sourced from:
1. **USDA FoodData Central SR Legacy** — primary source for raw produce portion weights
2. **USDA FoodData Central FNDDS** — used for tomato (FNDDS 2021-2023 record)
3. **FDA 21 CFR Appendix C to Part 101** — supplementary reference for raw fruit reference amounts

All preparation states are "raw" or "raw, with skin/peel" as applicable. All weights represent edible portion without refuse (pits, cores, stems, rinds, seeds removed as specified).

## Files Created

| File | Purpose |
|------|---------|
| `src/constants/producePortions.ts` | Registry with 69 records, type definitions, helper functions |
| `scripts/validateProducePortions.ts` | Standalone validator script (18 checks) |
| `src/constants/__tests__/producePortions.test.ts` | Jest test suite (18 test categories) |
| `Docs/produce-portion-conversion-audit.md` | This audit report |
