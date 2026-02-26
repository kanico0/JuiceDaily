export const EMPTY_BATCH = {
  items: [],
  totals: {
    calories: 0,
    sugar: 0,
    fiber: 0,
    vitaminC: 0,
    vitaminA: 0,
    potassium: 0,
    iron: 0,
    magnesium: 0,
    folate: 0,
  },
  veggieRatio: 0,
  fruitRatio: 0,
  warnings: [],
  totalRawWeightG: 0,
  totalJuiceWeightG: 0,
  juiceMethod: 'cold_pressed',
}

export const VEGGIE_FRUIT_TARGET = 0.8

// USDA Recommended Daily Allowance (adults 19–50, general)
// Sources: NIH Office of Dietary Supplements, USDA DRI tables
export const USDA_RDA = {
  vitaminC: 90,       // mg (men 90, women 75 — using 90 as general)
  vitaminA: 900,      // mcg RAE (men 900, women 700 — using 900)
  potassium: 2600,    // mg (adequate intake, men 3400, women 2600 — using 2600)
  iron: 18,           // mg (men 8, women 18 — using 18 as conservative)
  magnesium: 400,     // mg (men 420, women 320 — using 400 as midpoint)
  folate: 400,        // mcg DFE
}
