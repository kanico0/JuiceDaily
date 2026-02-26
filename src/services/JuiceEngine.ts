// ─────────────────────────────────────────────────────────────
// JuiceEngine.ts — True Retention Formula for cold-pressed juice
//
// %TR = (Nc * Gc) / (Nr * Gr) * 100
//
// Takes raw ingredients + weights from a camera scan, applies
// juice yield percentages, subtracts 100% insoluble fiber,
// applies vitamin retention factors, and returns the final
// liquid nutritional profile.
// Enforces the 80/20 Metabolic Guardrail (80% veg / 20% fruit).
//
// Supports:
// - Organic vs conventional produce (nutrient multipliers)
// - Cold-pressed vs centrifugal juicing (retention factors)
// ─────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────

export type ProduceCategory = 'vegetable' | 'fruit'
export type JuiceMethod = 'cold_pressed' | 'centrifugal'

export interface RawNutrition {
  caloriesPer100g: number
  sugarGPer100g: number
  vitCMgPer100g: number
  vitAMcgPer100g: number
  potassiumMgPer100g: number
  ironMgPer100g: number
  magnesiumMgPer100g: number
  folateMcgPer100g: number
  yieldPercent: number        // juice yield as decimal (0–1)
  retentionVitC: number       // fraction retained after cold-pressed juicing (0–1)
  retentionVitA: number       // fraction retained after cold-pressed juicing (0–1)
}

export interface ProduceEntry {
  name: string
  category: ProduceCategory
  nutrition: RawNutrition
}

export interface ScannedIngredient {
  produceId: string   // key into PRODUCE_DATA
  weightG: number     // grams of raw produce
  isOrganic?: boolean // true if user marked as organic
}

export interface JuiceNutrition {
  calories: number
  sugar: number
  fiber: number       // always 0 — 100% insoluble fiber removed
  vitaminC: number
  vitaminA: number
  potassium: number
  iron: number
  magnesium: number
  folate: number
}

export interface JuiceResult {
  ingredients: IngredientBreakdown[]
  totals: JuiceNutrition
  totalRawWeightG: number
  totalJuiceWeightG: number
  veggieRatio: number       // 0–1, weight-based
  fruitRatio: number        // 0–1, weight-based
  warnings: string[]
  juiceMethod: JuiceMethod
}

export interface IngredientBreakdown {
  name: string
  category: ProduceCategory
  rawWeightG: number
  juiceWeightG: number
  isOrganic: boolean
  nutrition: JuiceNutrition
}

// ── Organic Nutrient Multipliers ─────────────────────────────
// Based on meta-analyses (British Journal of Nutrition 2014,
// Newcastle University 2016): organic produce shows measurably
// higher antioxidant, vitamin C, and mineral concentrations.
export const ORGANIC_MULTIPLIERS = {
  vitaminC: 1.12,     // +12% avg (range 6–20%)
  vitaminA: 1.15,     // +15% avg (carotenoids)
  potassium: 1.07,    // +7% avg
  iron: 1.10,         // +10% avg
  magnesium: 1.08,    // +8% avg
  folate: 1.10,       // +10% avg
  // calories and sugar are NOT affected by organic status
}

// ── Juice Method Retention Factors ───────────────────────────
// Cold-pressed (masticating/hydraulic) preserves more nutrients
// due to minimal heat and oxidation. Centrifugal juicers
// generate heat and introduce air, degrading heat-sensitive
// vitamins and enzymes.
export const JUICE_METHOD_RETENTION: Record<JuiceMethod, {
  vitC: number
  vitA: number
  potassium: number
  iron: number
  magnesium: number
  folate: number
}> = {
  cold_pressed: {
    vitC: 1.0,        // baseline — retention factors in PRODUCE_DATA are for cold-pressed
    vitA: 1.0,
    potassium: 1.0,
    iron: 1.0,
    magnesium: 1.0,
    folate: 1.0,
  },
  centrifugal: {
    vitC: 0.78,       // ~22% loss from heat + oxidation
    vitA: 0.88,       // ~12% loss (fat-soluble, more stable)
    potassium: 0.95,  // minerals fairly stable, slight loss
    iron: 0.95,
    magnesium: 0.95,
    folate: 0.72,     // folate is very heat-sensitive
  },
}

// ── Produce Nutritional Database ─────────────────────────────
// Source: USDA FoodData Central + JSON_nuttrionalData.md
// Nutrition values are per 100 g of raw produce.
// Yield and retention factors are for cold-pressed extraction.

function p(
  name: string,
  category: ProduceCategory,
  cal: number, sugar: number,
  vitC: number, vitA: number,
  potassium: number, iron: number, magnesium: number, folate: number,
  yieldPct: number, retC: number, retA: number,
): ProduceEntry {
  return {
    name, category,
    nutrition: {
      caloriesPer100g: cal, sugarGPer100g: sugar,
      vitCMgPer100g: vitC, vitAMcgPer100g: vitA,
      potassiumMgPer100g: potassium, ironMgPer100g: iron,
      magnesiumMgPer100g: magnesium, folateMcgPer100g: folate,
      yieldPercent: yieldPct, retentionVitC: retC, retentionVitA: retA,
    },
  }
}

export const PRODUCE_DATA: Record<string, ProduceEntry> = {
  // ── Greens ──
  kale:             p('Kale',             'vegetable', 49, 2.3,  120,  500, 491, 1.5, 47, 141, 0.74, 0.90, 0.98),
  spinach:          p('Spinach',          'vegetable', 23, 0.4,   28,  469, 558, 2.7, 79, 194, 0.74, 0.88, 0.98),
  swiss_chard:      p('Swiss Chard',      'vegetable', 19, 1.1,   30,  306, 379, 1.8, 81,  14, 0.72, 0.88, 0.98),
  collard_greens:   p('Collard Greens',   'vegetable', 32, 0.5,   35,  251, 213, 0.5, 27, 129, 0.70, 0.88, 0.98),
  dandelion_greens: p('Dandelion Greens', 'vegetable', 45, 0.7,   35,  508, 397, 3.1, 36,  27, 0.68, 0.88, 0.98),
  arugula:          p('Arugula',          'vegetable', 25, 2.1,   15,  119, 369, 1.5, 47,  97, 0.72, 0.90, 0.98),
  romaine:          p('Romaine Lettuce',  'vegetable', 17, 1.2,   24,  436, 247, 1.0, 14, 136, 0.80, 0.92, 0.98),
  bok_choy:         p('Bok Choy',         'vegetable', 13, 1.2,   45,  223, 252, 0.8, 19,  66, 0.78, 0.92, 0.98),
  wheatgrass:       p('Wheatgrass',       'vegetable', 20, 0.3,    1,   18, 147, 0.6, 24,  38, 0.65, 0.90, 0.98),
  parsley:          p('Parsley',          'vegetable', 36, 0.9,  133,  421, 554, 6.2, 50, 152, 0.70, 0.88, 0.98),
  cilantro:         p('Cilantro',         'vegetable', 23, 0.9,   27,  337, 521, 1.8, 26,  62, 0.68, 0.90, 0.98),
  mint:             p('Mint',             'vegetable', 70, 0.0,   32,  212, 569, 5.1, 80, 114, 0.65, 0.90, 0.98),
  basil:            p('Basil',            'vegetable', 23, 0.3,   18,  264, 295, 3.2, 64,  68, 0.65, 0.90, 0.98),
  aloe_vera:        p('Aloe Vera',        'vegetable', 15, 0.0,    9,    0,  75, 0.2, 17,   0, 0.90, 0.95, 1.00),

  // ── Cruciferous & Cabbage ──
  broccoli:         p('Broccoli',         'vegetable', 34, 1.7,   89,   31, 316, 0.7, 21,  63, 0.70, 0.88, 0.98),
  cabbage_green:    p('Green Cabbage',    'vegetable', 25, 3.2,   37,    5, 170, 0.5, 12,  43, 0.78, 0.92, 0.98),
  cabbage_red:      p('Red Cabbage',      'vegetable', 31, 3.8,   57,   56, 243, 0.8, 16,  18, 0.78, 0.92, 0.98),
  cauliflower:      p('Cauliflower',      'vegetable', 25, 1.9,   48,    0, 299, 0.4, 15,  57, 0.72, 0.90, 0.98),
  kohlrabi:         p('Kohlrabi',         'vegetable', 27, 2.6,   62,    2, 350, 0.4, 19,  16, 0.76, 0.92, 0.98),

  // ── Root & Stalk ──
  carrot:           p('Carrot',           'vegetable', 41, 4.7,    6,  835, 320, 0.3, 12,  19, 0.82, 0.92, 0.98),
  celery:           p('Celery',           'vegetable', 16, 1.8,    3,   22, 260, 0.2, 11,  36, 0.75, 0.94, 0.97),
  beet:             p('Beet',             'vegetable', 43, 6.8,    5,    2, 325, 0.8, 23, 109, 0.76, 0.90, 0.98),
  cucumber:         p('Cucumber',         'vegetable', 15, 1.7,    3,    5, 147, 0.3, 13,   7, 0.95, 0.95, 0.98),
  fennel:           p('Fennel',           'vegetable', 31, 3.9,   12,    7, 414, 0.7, 17,  27, 0.78, 0.92, 0.98),
  sweet_potato:     p('Sweet Potato',     'vegetable', 86, 4.2,    2,  709, 337, 0.6, 25,  11, 0.65, 0.88, 0.98),
  turnip:           p('Turnip',           'vegetable', 28, 3.8,   21,    0, 191, 0.3, 11,  15, 0.78, 0.92, 0.98),
  celeriac:         p('Celeriac',         'vegetable', 42, 1.6,    8,    0, 300, 0.7, 20,   8, 0.74, 0.92, 0.98),
  jicama:           p('Jicama',           'vegetable', 38, 1.8,   20,    1, 150, 0.6, 12,  12, 0.80, 0.92, 0.98),
  zucchini:         p('Zucchini',         'vegetable', 17, 2.5,   18,   10, 261, 0.4, 18,  24, 0.88, 0.92, 0.98),
  asparagus:        p('Asparagus',        'vegetable', 20, 1.9,    6,   38, 202, 2.1, 14,  52, 0.72, 0.90, 0.98),
  radish:           p('Radish',           'vegetable', 16, 1.9,   15,    0, 233, 0.3, 10,  25, 0.80, 0.92, 0.98),
  ginger:           p('Ginger',           'vegetable', 80, 1.7,    5,    0, 415, 0.6, 43,  11, 0.85, 0.95, 1.00),
  turmeric:         p('Turmeric',         'vegetable',312, 3.2,   26,    0,2525,41.4,193,  39, 0.85, 0.95, 1.00),
  garlic:           p('Garlic',           'vegetable',149, 1.0,   31,    0, 401, 1.7, 25,   3, 0.80, 0.92, 1.00),

  // ── Peppers ──
  bell_pepper_red:    p('Red Bell Pepper',    'vegetable', 31, 4.2, 128, 157, 211, 0.4, 12, 46, 0.78, 0.90, 0.98),
  bell_pepper_yellow: p('Yellow Bell Pepper', 'vegetable', 27, 0.0, 184,  10, 212, 0.5, 12, 26, 0.78, 0.90, 0.98),
  bell_pepper_green:  p('Green Bell Pepper',  'vegetable', 20, 2.4,  80,  18, 175, 0.3, 10, 10, 0.78, 0.90, 0.98),
  jalapeño:           p('Jalapeño',           'vegetable', 29, 4.1, 119,  54, 248, 0.3, 15, 27, 0.78, 0.90, 0.98),
  cayenne:            p('Cayenne Pepper',     'vegetable',318, 5.3,  76,2081,2014, 7.8,152,106, 0.80, 0.90, 0.98),
  tomato:             p('Tomato',             'vegetable', 18, 2.6,  14,   42, 237, 0.3, 11, 15, 0.88, 0.92, 0.98),

  // ── Fruits ──
  apple:            p('Green Apple',      'fruit', 52,10.4,    5,    3, 107, 0.1,  5,   3, 0.76, 0.92, 0.98),
  apple_green:      p('Green Apple',      'fruit', 52,10.4,    5,    3, 107, 0.1,  5,   3, 0.76, 0.92, 0.98),
  apple_red:        p('Red Apple',        'fruit', 52,10.4,    5,    3, 107, 0.1,  5,   3, 0.76, 0.92, 0.98),
  lemon:            p('Lemon',            'fruit', 29, 2.5,   53,    1, 138, 0.6,  8,  11, 0.45, 0.96, 0.98),
  lime:             p('Lime',             'fruit', 30, 1.7,   29,    2, 102, 0.6,  6,   8, 0.45, 0.96, 0.98),
  orange:           p('Orange',           'fruit', 47, 9.4,   53,   11, 181, 0.1, 10,  30, 0.72, 0.92, 0.98),
  grapefruit:       p('Grapefruit',       'fruit', 42, 6.9,   31,   58, 135, 0.1,  9,  13, 0.72, 0.92, 0.98),
  pineapple:        p('Pineapple',        'fruit', 50, 9.9,   48,    3, 109, 0.3, 12,  18, 0.52, 0.92, 0.98),
  watermelon:       p('Watermelon',       'fruit', 30, 6.2,    8,   28, 112, 0.2, 10,   3, 0.88, 0.92, 0.98),
  pomegranate:      p('Pomegranate',      'fruit', 83, 13.7,  10,    0, 236, 0.3, 12,  38, 0.55, 0.90, 0.98),
  mango:            p('Mango',            'fruit', 60,13.7,   36,   54, 168, 0.2, 10,  43, 0.60, 0.90, 0.98),
  papaya:           p('Papaya',           'fruit', 43, 7.8,   61,   47, 182, 0.3, 21,  37, 0.70, 0.90, 0.98),
  kiwi:             p('Kiwi',             'fruit', 61,9.0,    93,    4, 312, 0.3, 17,  25, 0.65, 0.90, 0.98),
  pear:             p('Pear',             'fruit', 57,9.8,     4,    1, 116, 0.2,  7,   7, 0.72, 0.92, 0.98),
  grape:            p('Red Grape',        'fruit', 69,15.5,    3,    3, 191, 0.4,  7,   2, 0.72, 0.92, 0.98),
  strawberry:       p('Strawberry',       'fruit', 32, 4.9,   59,    1, 153, 0.4, 13,  24, 0.72, 0.90, 0.98),
  blueberry:        p('Blueberry',        'fruit', 57, 9.7,   10,    3,  77, 0.3,  6,   6, 0.55, 0.88, 0.98),
  raspberry:        p('Raspberry',        'fruit', 52, 4.4,   26,    2, 151, 0.7, 22,  21, 0.50, 0.88, 0.98),
  blackberry:       p('Blackberry',       'fruit', 43, 4.9,   21,   11, 162, 0.6, 20,  25, 0.50, 0.88, 0.98),
  cranberry:        p('Cranberry',        'fruit', 46, 4.0,   13,    3,  85, 0.3,  6,   1, 0.55, 0.90, 0.98),
  cherry:           p('Tart Cherry',      'fruit', 50,8.5,    10,   64, 173, 0.3,  9,   8, 0.60, 0.90, 0.98),
  cantaloupe:       p('Cantaloupe',       'fruit', 34, 7.9,   37,  169, 267, 0.2, 12,  21, 0.80, 0.92, 0.98),
  honeydew:         p('Honeydew Melon',   'fruit', 36, 8.1,   18,    3, 228, 0.2, 10,  19, 0.80, 0.92, 0.98),
  coconut_water:    p('Coconut Water',    'fruit', 19, 2.6,    2,    0, 250, 0.3, 25,   3, 1.00, 0.98, 1.00),
  passion_fruit:    p('Passion Fruit',    'fruit', 97, 11.2,  30,   64, 348, 1.6, 29,  14, 0.50, 0.88, 0.98),
  peach:            p('Peach',            'fruit', 39, 8.4,    7,   16, 190, 0.3,  9,   4, 0.72, 0.92, 0.98),
  plum:             p('Plum',             'fruit', 46, 9.9,   10,   17, 157, 0.2,  7,   5, 0.70, 0.92, 0.98),
  nectarine:        p('Nectarine',        'fruit', 44, 7.9,    5,   17, 201, 0.3,  9,   5, 0.72, 0.92, 0.98),
}

// ── Constants ────────────────────────────────────────────────

const FRUIT_RATIO_LIMIT = 0.20
const EMPTY_NUTRITION: JuiceNutrition = {
  calories: 0, sugar: 0, fiber: 0,
  vitaminC: 0, vitaminA: 0,
  potassium: 0, iron: 0, magnesium: 0, folate: 0,
}

// ── Helpers ──────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// True Retention Formula with organic + juice method multipliers
function calcJuiceNutrition(
  entry: ProduceEntry,
  weightG: number,
  isOrganic: boolean,
  method: JuiceMethod,
): JuiceNutrition {
  const n = entry.nutrition
  const scale = (weightG / 100) * n.yieldPercent
  const org = isOrganic ? ORGANIC_MULTIPLIERS : { vitaminC: 1, vitaminA: 1, potassium: 1, iron: 1, magnesium: 1, folate: 1 }
  const meth = JUICE_METHOD_RETENTION[method]

  return {
    calories: round2(n.caloriesPer100g * scale),
    sugar: round2(n.sugarGPer100g * scale),
    fiber: 0,
    vitaminC:  round2(n.vitCMgPer100g       * scale * n.retentionVitC * org.vitaminC  * meth.vitC),
    vitaminA:  round2(n.vitAMcgPer100g      * scale * n.retentionVitA * org.vitaminA  * meth.vitA),
    potassium: round2(n.potassiumMgPer100g  * scale * org.potassium  * meth.potassium),
    iron:      round2(n.ironMgPer100g       * scale * org.iron       * meth.iron),
    magnesium: round2(n.magnesiumMgPer100g  * scale * org.magnesium  * meth.magnesium),
    folate:    round2(n.folateMcgPer100g    * scale * org.folate     * meth.folate),
  }
}

// ── Main Engine ──────────────────────────────────────────────

export function processJuiceBatch(
  scannedItems: ScannedIngredient[],
  juiceMethod: JuiceMethod = 'cold_pressed',
): JuiceResult {
  if (scannedItems.length === 0) {
    return {
      ingredients: [],
      totals: { ...EMPTY_NUTRITION },
      totalRawWeightG: 0,
      totalJuiceWeightG: 0,
      veggieRatio: 0,
      fruitRatio: 0,
      warnings: [],
      juiceMethod,
    }
  }

  const ingredients: IngredientBreakdown[] = []
  const totals: JuiceNutrition = { ...EMPTY_NUTRITION }

  let totalRawWeightG = 0
  let totalJuiceWeightG = 0
  let fruitWeightG = 0
  let vegWeightG = 0
  const warnings: string[] = []
  const unknownIds: string[] = []

  for (const item of scannedItems) {
    const entry = PRODUCE_DATA[item.produceId.toLowerCase()]

    if (!entry) {
      unknownIds.push(item.produceId)
      continue
    }

    const isOrganic = item.isOrganic ?? false
    const juiceWeightG = round2(item.weightG * entry.nutrition.yieldPercent)
    const nutrition = calcJuiceNutrition(entry, item.weightG, isOrganic, juiceMethod)

    ingredients.push({
      name: entry.name,
      category: entry.category,
      rawWeightG: item.weightG,
      juiceWeightG,
      isOrganic,
      nutrition,
    })

    totals.calories  += nutrition.calories
    totals.sugar     += nutrition.sugar
    totals.vitaminC  += nutrition.vitaminC
    totals.vitaminA  += nutrition.vitaminA
    totals.potassium += nutrition.potassium
    totals.iron      += nutrition.iron
    totals.magnesium += nutrition.magnesium
    totals.folate    += nutrition.folate

    totalRawWeightG += item.weightG
    totalJuiceWeightG += juiceWeightG

    if (entry.category === 'fruit') {
      fruitWeightG += item.weightG
    } else {
      vegWeightG += item.weightG
    }
  }

  // Round totals
  totals.calories  = round2(totals.calories)
  totals.sugar     = round2(totals.sugar)
  totals.vitaminC  = round2(totals.vitaminC)
  totals.vitaminA  = round2(totals.vitaminA)
  totals.potassium = round2(totals.potassium)
  totals.iron      = round2(totals.iron)
  totals.magnesium = round2(totals.magnesium)
  totals.folate    = round2(totals.folate)

  // Compute ratios
  const veggieRatio = totalRawWeightG > 0
    ? round2(vegWeightG / totalRawWeightG)
    : 0
  const fruitRatio = totalRawWeightG > 0
    ? round2(fruitWeightG / totalRawWeightG)
    : 0

  // ── Metabolic Guardrails ───────────────────────────────────
  if (fruitRatio > FRUIT_RATIO_LIMIT) {
    warnings.push(
      `Fruit ratio is ${Math.round(fruitRatio * 100)}% — exceeds the 20% limit. ` +
      `Add more vegetables to reduce blood-sugar impact.`
    )
  }

  if (unknownIds.length > 0) {
    warnings.push(
      `Unknown produce ID(s) skipped: ${unknownIds.join(', ')}. ` +
      `Check spelling or add them to PRODUCE_DATA.`
    )
  }

  if (juiceMethod === 'centrifugal') {
    warnings.push(
      'Centrifugal juicing reduces heat-sensitive nutrients (Vitamin C −22%, Folate −28%). ' +
      'Consider cold-pressed for maximum nutrition.'
    )
  }

  return {
    ingredients,
    totals,
    totalRawWeightG: round2(totalRawWeightG),
    totalJuiceWeightG: round2(totalJuiceWeightG),
    veggieRatio,
    fruitRatio,
    warnings,
    juiceMethod,
  }
}
