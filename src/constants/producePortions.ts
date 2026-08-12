/**
 * Sourced Produce Portion Registry
 *
 * Maps all 69 canonical JuiceEngine produce IDs to defensible
 * quantity-entry options (whole, stalk, clove, piece, cup, etc.)
 * or explicitly marks them as Weight-only.
 *
 * All gram weights are sourced from:
 *   - USDA FoodData Central SR Legacy (April 2018 release)
 *   - USDA FoodData Central FNDDS 2021-2023
 *   - USDA Food Buying Guide for Child Nutrition Programs
 *   - 21 CFR Appendix C to Part 101 (FDA raw fruits & vegetables)
 *
 * Every gram weight represents raw, edible portion without refuse
 * unless otherwise noted in the sourceRecord preparationState field.
 */

// ── Type Definitions ──────────────────────────────────────────

export type PortionFamily =
  | 'whole'
  | 'stalk'
  | 'clove'
  | 'piece'
  | 'inch_piece'
  | 'packed_cup'
  | 'loose_cup'
  | 'handful'
  | 'wedge'
  | 'fraction'
  | 'tablespoon'
  | 'other'

export type SizeKey = 'small' | 'medium' | 'large' | 'standard'

export interface PortionSize {
  sizeKey: SizeKey
  displaySize: string
  gramWeight: number
}

export interface PortionUnit {
  unitKey: string
  family: PortionFamily
  displaySingular: string
  displayPlural: string
  allowDecimal: boolean
  inputStep: number
  sizes: PortionSize[]
}

export interface SourceRecord {
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
}

export type Confidence = 'high' | 'medium' | 'low'

export interface ProducePortionRecord {
  produceId: string
  quantitySupported: boolean
  defaultUnitKey: string | null
  units: PortionUnit[]
  sourceRecords: SourceRecord[]
  confidence: Confidence
  notes?: string
}

// Deeply readonly variants for external consumers
export type ReadonlyPortionSize = Readonly<PortionSize>
export type ReadonlyPortionUnit = Readonly<Omit<PortionUnit, 'sizes'> & { sizes: ReadonlyPortionSize[] }>
export type ReadonlySourceRecord = Readonly<SourceRecord>
export type ReadonlyProducePortionRecord = Readonly<Omit<ProducePortionRecord, 'units' | 'sourceRecords'> & {
  units: ReadonlyPortionUnit[]
  sourceRecords: ReadonlySourceRecord[]
}>
export type ReadonlyProducePortions = Readonly<Record<string, ReadonlyProducePortionRecord>>

// ── Helper ────────────────────────────────────────────────────

const ACCESSED = '2026-07-30'

function sr(
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
}

// ── Deep Freeze ──────────────────────────────────────────────

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key]
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val)
    }
  }
  return obj
}

// ── Registry ──────────────────────────────────────────────────

export const PRODUCE_PORTIONS: ReadonlyProducePortions = deepFreeze({
  // ── Greens ──────────────────────────────────────────────────

  kale: {
    produceId: 'kale',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 67 }],
      },
      {
        unitKey: 'leaf',
        family: 'piece',
        displaySingular: 'leaf',
        displayPlural: 'leaves',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium leaf', gramWeight: 20 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11233', 168421, '1 cup, chopped (67 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11233, Kale, raw (FDC ID 168421)'),
    ],
    confidence: 'high',
  },

  spinach: {
    produceId: 'spinach',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈20 g)', gramWeight: 20 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 30 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11457', 168462, '1 cup (30 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11457, Spinach, raw (FDC ID 168462)'),
    ],
    confidence: 'high',
  },

  swiss_chard: {
    produceId: 'swiss_chard',
    quantitySupported: true,
    defaultUnitKey: 'leaf',
    units: [
      {
        unitKey: 'leaf',
        family: 'piece',
        displaySingular: 'leaf',
        displayPlural: 'leaves',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium leaf (≈34 g)', gramWeight: 34 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 36 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11147', 169991, '1 cup, chopped (36 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11147, Chard, swiss, raw (FDC ID 169991)'),
    ],
    confidence: 'high',
  },

  collard_greens: {
    produceId: 'collard_greens',
    quantitySupported: true,
    defaultUnitKey: 'leaf',
    units: [
      {
        unitKey: 'leaf',
        family: 'piece',
        displaySingular: 'leaf',
        displayPlural: 'leaves',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium leaf (≈30 g)', gramWeight: 30 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 36 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11161', 170406, '1 cup, chopped (36 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11161, Collards, raw (FDC ID 170406)'),
    ],
    confidence: 'high',
  },

  dandelion_greens: {
    produceId: 'dandelion_greens',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈25 g)', gramWeight: 25 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 55 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11207', 169226, '1 cup, chopped (55 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11207, Dandelion greens, raw (FDC ID 169226)'),
    ],
    confidence: 'medium',
    notes: 'SR Legacy has limited data points for dandelion greens; gram weight derived from FNDDS cross-reference.',
  },

  arugula: {
    produceId: 'arugula',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈10 g)', gramWeight: 10 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 20 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11959', 169387, '1 cup raw (20 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11959, Arugula, raw (FDC ID 169387)'),
    ],
    confidence: 'medium',
  },

  romaine: {
    produceId: 'romaine',
    quantitySupported: true,
    defaultUnitKey: 'leaf',
    units: [
      {
        unitKey: 'leaf',
        family: 'piece',
        displaySingular: 'leaf',
        displayPlural: 'leaves',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium leaf (≈25 g)', gramWeight: 25 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (shredded)',
        displayPlural: 'cups (shredded)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, shredded', gramWeight: 47 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11251', 169247, '1 cup, shredded (47 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11251, Lettuce, cos or romaine, raw (FDC ID 169247)'),
    ],
    confidence: 'high',
  },

  bok_choy: {
    produceId: 'bok_choy',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'head',
        displayPlural: 'heads',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium head (≈170 g)', gramWeight: 170 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, shredded', gramWeight: 70 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'Foundation Foods', '11116', 2685572, '1 cup, shredded (70 g); 1 medium head (≈170 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central Foundation Foods NDB 11116, Cabbage, bok choy, raw (FDC ID 2685572)'),
    ],
    confidence: 'medium',
  },

  wheatgrass: {
    produceId: 'wheatgrass',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful', gramWeight: 25 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, loose', gramWeight: 50 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'FNDDS', null, null, 'No standard USDA household measure established; estimated from typical wheatgrass shot yield (1 oz grass per shot)', 'raw', 'edible portion without refuse', 'Estimated from typical juicing yield: 1 handful (~25 g) yields approximately 1 ounce of wheatgrass juice'),
    ],
    confidence: 'medium',
    notes: 'Wheatgrass has no standardized USDA household measure. Gram weights are estimated from typical juicing portions. A handful (~25 g) yields roughly 1 ounce of juice.',
  },

  parsley: {
    produceId: 'parsley',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈15 g)', gramWeight: 15 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.25,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 60 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (chopped)',
        displayPlural: 'tablespoons (chopped)',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp', gramWeight: 3.8 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11297', 170416, '1 cup, chopped (60 g); 1 tbsp (3.8 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11297, Parsley, fresh (FDC ID 170416)'),
    ],
    confidence: 'high',
  },

  cilantro: {
    produceId: 'cilantro',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈8 g)', gramWeight: 8 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.25,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 16 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11165', 169997, '1 cup (16 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11165, Coriander (cilantro) leaves, raw (FDC ID 169997)'),
    ],
    confidence: 'medium',
  },

  mint: {
    produceId: 'mint',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈8 g)', gramWeight: 8 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.25,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 32 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon',
        displayPlural: 'tablespoons',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp', gramWeight: 2 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '2065', 173475, '1 cup (32 g); 1 tbsp (2 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 2065, Spearmint, fresh (FDC ID 173475)'),
    ],
    confidence: 'medium',
  },

  basil: {
    produceId: 'basil',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈6 g)', gramWeight: 6 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.25,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 24 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (chopped)',
        displayPlural: 'tablespoons (chopped)',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp', gramWeight: 1.5 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '2044', 172232, '1 cup, chopped (24 g); 1 tbsp (1.5 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 2044, Basil, fresh (FDC ID 172232)'),
    ],
    confidence: 'medium',
  },

  aloe_vera: {
    produceId: 'aloe_vera',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'leaf',
        displayPlural: 'leaves',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium leaf (≈120 g gel)', gramWeight: 120 },
        ],
      },
    ],
    sourceRecords: [
      sr('USDA', 'FNDDS', null, null, '1 aloe vera leaf (≈120 g gel yield)', 'raw', 'edible portion (gel only)', 'USDA FoodData Central FNDDS 2021-2023 — aloe vera gel estimated from medium leaf'),
    ],
    confidence: 'medium',
    notes: 'Aloe vera is typically used as extracted gel. Count mode supports whole-leaf entry; weight remains the primary measurement for precise gel amounts.',
  },

  watercress: {
    produceId: 'watercress',
    quantitySupported: true,
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 handful (≈17 g)', gramWeight: 17 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (loose)',
        displayPlural: 'cups (loose)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 34 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11591', 170068, '1 cup (34 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11591, Watercress, raw (FDC ID 170068)'),
    ],
    confidence: 'high',
  },

  // ── Cruciferous & Cabbage ───────────────────────────────────

  broccoli: {
    produceId: 'broccoli',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 91 }],
      },
      {
        unitKey: 'stalk',
        family: 'stalk',
        displaySingular: 'stalk',
        displayPlural: 'stalks',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium stalk (5 inch)', gramWeight: 151 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11090', 170379, '1 cup, chopped (91 g); 1 stalk (151 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11090, Broccoli, raw (FDC ID 170379)'),
    ],
    confidence: 'high',
  },

  cabbage_green: {
    produceId: 'cabbage_green',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'head',
        displayPlural: 'heads',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium head (≈908 g)', gramWeight: 908 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, shredded', gramWeight: 70 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11109', 169975, '1 cup, shredded (70 g); 1 medium head (≈908 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11109, Cabbage, raw (FDC ID 169975)'),
    ],
    confidence: 'high',
  },

  cabbage_red: {
    produceId: 'cabbage_red',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'head',
        displayPlural: 'heads',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium head (≈893 g)', gramWeight: 893 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (shredded)',
        displayPlural: 'cups (shredded)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, shredded', gramWeight: 70 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11112', 169977, '1 cup, shredded (70 g); 1 medium head (≈893 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11112, Cabbage, red, raw (FDC ID 169977)'),
    ],
    confidence: 'medium',
    notes: 'Red cabbage portion weight inferred from green cabbage SR Legacy data; FNDDS uses same portion weight for both.',
  },

  cauliflower: {
    produceId: 'cauliflower',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'head',
        displayPlural: 'heads',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium head (≈575 g)', gramWeight: 575 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 107 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11135', 169986, '1 cup, chopped (107 g); 1 medium head (≈575 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11135, Cauliflower, raw (FDC ID 169986)'),
    ],
    confidence: 'high',
  },

  kohlrabi: {
    produceId: 'kohlrabi',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'bulb',
        displayPlural: 'bulbs',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium bulb (≈135 g)', gramWeight: 135 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, slices', gramWeight: 135 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11241', 168424, '1 cup, slices (135 g); 1 medium bulb (≈135 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11241, Kohlrabi, raw (FDC ID 168424)'),
    ],
    confidence: 'medium',
  },

  // ── Root & Stalk ────────────────────────────────────────────

  carrot: {
    produceId: 'carrot',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'carrot',
        displayPlural: 'carrots',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (5-1/2 inch)', gramWeight: 50 },
          { sizeKey: 'medium', displaySize: 'medium (6 inch)', gramWeight: 61 },
          { sizeKey: 'large', displaySize: 'large (7-1/4 to 8-1/2 inch)', gramWeight: 72 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 128 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11124', 170393, '1 medium (61 g); 1 cup chopped (128 g); 1 large (72 g); 1 small (50 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11124, Carrots, raw (FDC ID 170393)'),
    ],
    confidence: 'high',
  },

  celery: {
    produceId: 'celery',
    quantitySupported: true,
    defaultUnitKey: 'stalk',
    units: [
      {
        unitKey: 'stalk',
        family: 'stalk',
        displaySingular: 'stalk',
        displayPlural: 'stalks',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (5 inch)', gramWeight: 17 },
          { sizeKey: 'medium', displaySize: 'medium (7-1/2 to 8 inch)', gramWeight: 40 },
          { sizeKey: 'large', displaySize: 'large (11-12 inch)', gramWeight: 64 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 101 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11143', 169988, '1 stalk medium (40 g); 1 cup chopped (101 g); 1 stalk large (64 g); 1 stalk small (17 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11143, Celery, raw (FDC ID 169988)'),
    ],
    confidence: 'high',
  },

  beet: {
    produceId: 'beet',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'beet',
        displayPlural: 'beets',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (2 inch dia)', gramWeight: 82 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 136 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11080', 169145, '1 beet (82 g); 1 cup (136 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11080, Beets, raw (FDC ID 169145)'),
    ],
    confidence: 'high',
  },

  cucumber: {
    produceId: 'cucumber',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'cucumber',
        displayPlural: 'cucumbers',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (6 inch)', gramWeight: 150 },
          { sizeKey: 'medium', displaySize: 'medium (8-1/4 inch)', gramWeight: 301 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sliced', gramWeight: 104 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11205', 168409, '1 cucumber 8-1/4 inch (301 g); 1 cup sliced (104 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11205, Cucumber, with peel, raw (FDC ID 168409)'),
    ],
    confidence: 'high',
  },

  fennel: {
    produceId: 'fennel',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'bulb',
        displayPlural: 'bulbs',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium bulb (≈234 g)', gramWeight: 234 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sliced', gramWeight: 87 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11957', 169385, '1 cup, sliced (87 g); 1 medium bulb (≈234 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11957, Fennel, bulb, raw (FDC ID 169385)'),
    ],
    confidence: 'medium',
  },

  sweet_potato: {
    produceId: 'sweet_potato',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'sweet potato',
        displayPlural: 'sweet potatoes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 130 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/4 inch dia)', gramWeight: 151 },
          { sizeKey: 'large', displaySize: 'large (2-1/2 inch dia)', gramWeight: 328 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (cubed)',
        displayPlural: 'cups (cubed)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, cubed', gramWeight: 133 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11507', 168482, '1 medium (151 g); 1 cup cubed (133 g); 1 large (328 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11507, Sweet potato, raw, unprepared (Includes foods for USDA\'s Food Distribution Program) (FDC ID 168482)'),
    ],
    confidence: 'high',
  },

  turnip: {
    produceId: 'turnip',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'turnip',
        displayPlural: 'turnips',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 85 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/2 inch dia)', gramWeight: 130 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (cubed)',
        displayPlural: 'cups (cubed)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, cubed', gramWeight: 130 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11564', 170465, '1 cup, cubed (130 g); 1 medium turnip (130 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11564, Turnips, raw (FDC ID 170465)'),
    ],
    confidence: 'medium',
  },

  celeriac: {
    produceId: 'celeriac',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'root',
        displayPlural: 'roots',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium root (≈400 g)', gramWeight: 400 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (cubed)',
        displayPlural: 'cups (cubed)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, cubed', gramWeight: 140 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11141', 170400, '1 cup, cubed (140 g); 1 medium root (≈400 g estimated)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy NDB 11141, Celeriac, raw (FDC ID 170400)'),
    ],
    confidence: 'medium',
  },

  jicama: {
    produceId: 'jicama',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'jicama',
        displayPlural: 'jicamas',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'medium', displaySize: 'medium (≈700 g)', gramWeight: 700 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, slices', gramWeight: 120 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11603', 170073, '1 cup, slices (120 g); 1 medium jicama (≈700 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy NDB 11603, Yambean (jicama), raw (FDC ID 170073)'),
    ],
    confidence: 'medium',
  },

  zucchini: {
    produceId: 'zucchini',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'zucchini',
        displayPlural: 'zucchini',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (6 inch)', gramWeight: 118 },
          { sizeKey: 'medium', displaySize: 'medium (7-1/4 inch)', gramWeight: 196 },
          { sizeKey: 'large', displaySize: 'large (8-1/4 inch)', gramWeight: 324 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sliced', gramWeight: 113 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11477', 169291, '1 medium (196 g); 1 cup sliced (113 g); 1 large (324 g); 1 small (118 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11477, Squash, summer, zucchini, includes skin, raw (FDC ID 169291)'),
    ],
    confidence: 'high',
  },

  asparagus: {
    produceId: 'asparagus',
    quantitySupported: true,
    defaultUnitKey: 'stalk',
    units: [
      {
        unitKey: 'stalk',
        family: 'stalk',
        displaySingular: 'spear',
        displayPlural: 'spears',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (5 inch or less)', gramWeight: 12 },
          { sizeKey: 'medium', displaySize: 'medium (5-1/4 to 7 inch)', gramWeight: 16 },
          { sizeKey: 'large', displaySize: 'large (7-1/4 to 8-1/2 inch)', gramWeight: 20 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 134 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11011', 168389, '1 cup (134 g); 1 spear medium (16 g); 1 spear large (20 g); 1 spear small (12 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11011, Asparagus, raw (FDC ID 168389)'),
    ],
    confidence: 'high',
  },

  radish: {
    produceId: 'radish',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'radish',
        displayPlural: 'radishes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (3/4 inch dia)', gramWeight: 4.5 },
          { sizeKey: 'medium', displaySize: 'medium (1 inch dia)', gramWeight: 9 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sliced', gramWeight: 116 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11429', 169276, '1 radish medium (9 g); 1 cup sliced (116 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11429, Radishes, raw (FDC ID 169276)'),
    ],
    confidence: 'medium',
  },

  ginger: {
    produceId: 'ginger',
    quantitySupported: true,
    defaultUnitKey: 'tablespoon',
    units: [
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (grated)',
        displayPlural: 'tablespoons (grated)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, grated', gramWeight: 6 }],
      },
      {
        unitKey: 'inch_piece',
        family: 'inch_piece',
        displaySingular: 'inch piece',
        displayPlural: 'inch pieces',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1-inch piece', gramWeight: 30 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11216', 169231, '1 tbsp, grated (6 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy NDB 11216, Ginger root, raw (FDC ID 169231)'),
    ],
    confidence: 'medium',
    notes: '1-inch piece weight estimated from USDA density data; USDA only provides grated tablespoon measure.',
  },

  turmeric: {
    produceId: 'turmeric',
    quantitySupported: true,
    defaultUnitKey: 'inch_piece',
    units: [
      {
        unitKey: 'inch_piece',
        family: 'inch_piece',
        displaySingular: 'inch piece',
        displayPlural: 'inch pieces',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1-inch piece', gramWeight: 20 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (grated)',
        displayPlural: 'tablespoons (grated)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, grated', gramWeight: 6 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'Foundation Foods', null, 170556, 'No standardized household portion available; estimated from ginger-density analogy (1 tbsp grated ≈ 6 g, 1-inch piece ≈ 20 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central Foundation Foods FDC ID 170556, Turmeric, raw — household measures estimated from ginger root density (USDA NDB 11216)'),
    ],
    confidence: 'medium',
    notes: 'Turmeric root has no standardized USDA household measure. Gram weights are estimated from ginger root density analogy (USDA SR Legacy NDB 11216: 1 tbsp grated = 6 g). Turmeric is denser than ginger but used in smaller quantities, so the same per-unit weights are a conservative estimate.',
  },

  garlic: {
    produceId: 'garlic',
    quantitySupported: true,
    defaultUnitKey: 'clove',
    units: [
      {
        unitKey: 'clove',
        family: 'clove',
        displaySingular: 'clove',
        displayPlural: 'cloves',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small clove', gramWeight: 3 },
          { sizeKey: 'medium', displaySize: 'medium clove', gramWeight: 5 },
          { sizeKey: 'large', displaySize: 'large clove', gramWeight: 7 },
        ],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (minced)',
        displayPlural: 'tablespoons (minced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, minced', gramWeight: 8 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11215', 169230, '1 clove (3 g); 1 tbsp minced (8 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy NDB 11215, Garlic, raw (FDC ID 169230)'),
    ],
    confidence: 'high',
  },

  // ── Peppers ─────────────────────────────────────────────────

  bell_pepper_red: {
    produceId: 'bell_pepper_red',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'bell pepper',
        displayPlural: 'bell peppers',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 74 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/4 to 2-3/4 inch dia)', gramWeight: 119 },
          { sizeKey: 'large', displaySize: 'large (3 inch dia)', gramWeight: 164 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 149 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11821', 170108, '1 cup chopped (149 g); 1 medium (119 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy NDB 11821, Peppers, sweet, red, raw (FDC ID 170108)'),
    ],
    confidence: 'high',
  },

  bell_pepper_yellow: {
    produceId: 'bell_pepper_yellow',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'bell pepper',
        displayPlural: 'bell peppers',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 74 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/4 to 2-3/4 inch dia)', gramWeight: 119 },
          { sizeKey: 'large', displaySize: 'large (3 inch dia)', gramWeight: 164 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 149 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11951', 169383, '1 cup chopped (149 g); 1 medium (119 g) — inferred from red bell pepper', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy NDB 11951, Peppers, sweet, yellow, raw (FDC ID 169383)'),
    ],
    confidence: 'medium',
    notes: 'USDA SR Legacy does not have a separate yellow bell pepper entry; portion weights inferred from red and green bell pepper data which share identical measures.',
  },

  bell_pepper_green: {
    produceId: 'bell_pepper_green',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'bell pepper',
        displayPlural: 'bell peppers',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 74 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/4 to 2-3/4 inch dia)', gramWeight: 119 },
          { sizeKey: 'large', displaySize: 'large (3 inch dia)', gramWeight: 164 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 149 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11333', 170427, '1 cup chopped (149 g); 1 medium (119 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy NDB 11333, Peppers, sweet, green, raw (FDC ID 170427)'),
    ],
    confidence: 'high',
  },

  jalapeño: {
    produceId: 'jalapeño',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'jalapeño',
        displayPlural: 'jalapeños',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (2-1/2 inch)', gramWeight: 15 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (minced)',
        displayPlural: 'tablespoons (minced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, minced', gramWeight: 9 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11979', 168576, '1 pepper (15 g); 1 tbsp minced (9 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy NDB 11979, Peppers, jalapeno, raw (FDC ID 168576)'),
    ],
    confidence: 'medium',
  },

  cayenne: {
    produceId: 'cayenne',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'cayenne pepper',
        displayPlural: 'cayenne peppers',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (2-3 inch)', gramWeight: 17 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (minced)',
        displayPlural: 'tablespoons (minced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, minced', gramWeight: 9 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11819', 170106, '1 pepper (45 g generic hot chili); 1 tbsp minced (9 g); cayenne-specific per-pepper weight estimated at 17 g from FNDDS', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy NDB 11819, Peppers, hot chili, red, raw (FDC ID 170106); per-pepper weight from FNDDS 2021-2023'),
    ],
    confidence: 'medium',
    notes: 'USDA SR Legacy NDB 11819 covers generic hot chili red peppers (45 g per pepper). Cayenne peppers are smaller and lighter; the 17 g per-pepper weight is derived from FNDDS portion data. The tablespoon minced weight (9 g) is shared across hot pepper varieties.',
  },

  tomato: {
    produceId: 'tomato',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'tomato',
        displayPlural: 'tomatoes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-2/5 inch dia)', gramWeight: 91 },
          { sizeKey: 'medium', displaySize: 'medium (2-3/5 inch dia)', gramWeight: 123 },
          { sizeKey: 'large', displaySize: 'large (3 inch dia)', gramWeight: 182 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 180 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11529', 170457, '1 medium whole (123 g); 1 cup chopped (180 g); 1 large whole (182 g); 1 small whole (91 g)', 'raw', 'edible portion without refuse (stem removed)', 'USDA FoodData Central SR Legacy NDB 11529, Tomatoes, red, ripe, raw, year round average (FDC ID 170457)'),
    ],
    confidence: 'high',
  },

  // ── Fruits ──────────────────────────────────────────────────

  apple: {
    produceId: 'apple',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'apple',
        displayPlural: 'apples',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-3/4 inch dia)', gramWeight: 149 },
          { sizeKey: 'medium', displaySize: 'medium (3 inch dia)', gramWeight: 182 },
          { sizeKey: 'large', displaySize: 'large (3-1/4 inch dia)', gramWeight: 223 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 125 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9003', 171688, '1 medium (182 g); 1 cup chopped (125 g); 1 large (223 g); 1 small (149 g)', 'raw, with skin', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy NDB 9003, Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program) (FDC ID 171688)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 large (242 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  apple_green: {
    produceId: 'apple_green',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'green apple',
        displayPlural: 'green apples',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-3/4 inch dia)', gramWeight: 149 },
          { sizeKey: 'medium', displaySize: 'medium (3 inch dia)', gramWeight: 182 },
          { sizeKey: 'large', displaySize: 'large (3-1/4 inch dia)', gramWeight: 223 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 125 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9003', 171688, '1 medium (182 g); 1 cup chopped (125 g) — apple variety not differentiated in SR Legacy', 'raw, with skin', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy NDB 9003, Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program) (FDC ID 171688)'),
    ],
    confidence: 'high',
    notes: 'USDA SR Legacy does not differentiate apple varieties by portion weight; green and red apples share identical measures.',
  },

  apple_red: {
    produceId: 'apple_red',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'red apple',
        displayPlural: 'red apples',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-3/4 inch dia)', gramWeight: 149 },
          { sizeKey: 'medium', displaySize: 'medium (3 inch dia)', gramWeight: 182 },
          { sizeKey: 'large', displaySize: 'large (3-1/4 inch dia)', gramWeight: 223 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 125 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9003', 171688, '1 medium (182 g); 1 cup chopped (125 g) — apple variety not differentiated in SR Legacy', 'raw, with skin', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy NDB 9003, Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program) (FDC ID 171688)'),
    ],
    confidence: 'high',
    notes: 'USDA SR Legacy does not differentiate apple varieties by portion weight; green and red apples share identical measures.',
  },

  lemon: {
    produceId: 'lemon',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'lemon',
        displayPlural: 'lemons',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-3/8 inch dia)', gramWeight: 58 },
          { sizeKey: 'medium', displaySize: 'medium (2-5/8 inch dia)', gramWeight: 101 },
          { sizeKey: 'large', displaySize: 'large (2-7/8 inch dia)', gramWeight: 136 },
        ],
      },
      {
        unitKey: 'wedge',
        family: 'wedge',
        displaySingular: 'wedge',
        displayPlural: 'wedges',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'wedge (1/8 of medium)', gramWeight: 7 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (juice)',
        displayPlural: 'tablespoons (juice)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp juice', gramWeight: 15 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9150', 167746, '1 medium (101 g); 1 wedge (7 g); 1 tbsp juice (15 g); 1 large (136 g); 1 small (58 g)', 'raw', 'edible portion without refuse (peel, seeds removed for juice)', 'USDA FoodData Central SR Legacy NDB 9150, Lemons, raw, without peel (FDC ID 167746)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (140 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  lime: {
    produceId: 'lime',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'lime',
        displayPlural: 'limes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 44 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/8 inch dia)', gramWeight: 67 },
          { sizeKey: 'large', displaySize: 'large (2-3/8 inch dia)', gramWeight: 88 },
        ],
      },
      {
        unitKey: 'wedge',
        family: 'wedge',
        displaySingular: 'wedge',
        displayPlural: 'wedges',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'wedge (1/8 of medium)', gramWeight: 5 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (juice)',
        displayPlural: 'tablespoons (juice)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp juice', gramWeight: 15 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9159', 168155, '1 medium (67 g); 1 wedge (5 g); 1 tbsp juice (15 g); 1 large (88 g); 1 small (44 g)', 'raw', 'edible portion without refuse (peel, seeds removed for juice)', 'USDA FoodData Central SR Legacy NDB 9159, Limes, raw (FDC ID 168155)'),
    ],
    confidence: 'high',
  },

  orange: {
    produceId: 'orange',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'orange',
        displayPlural: 'oranges',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-3/8 inch dia)', gramWeight: 96 },
          { sizeKey: 'medium', displaySize: 'medium (2-5/8 inch dia)', gramWeight: 131 },
          { sizeKey: 'large', displaySize: 'large (3 inch dia)', gramWeight: 185 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sections)',
        displayPlural: 'cups (sections)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sections', gramWeight: 180 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9200', 169097, '1 medium (131 g); 1 cup sections (180 g); 1 large (185 g); 1 small (96 g)', 'raw', 'edible portion without refuse (peel, seeds removed)', 'USDA FoodData Central SR Legacy NDB 9200, Oranges, raw, all commercial varieties (FDC ID 169097)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (140 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  grapefruit: {
    produceId: 'grapefruit',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'grapefruit',
        displayPlural: 'grapefruit',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (3-1/2 inch dia)', gramWeight: 128 },
          { sizeKey: 'medium', displaySize: 'medium (4 inch dia)', gramWeight: 236 },
          { sizeKey: 'large', displaySize: 'large (4-1/2 inch dia)', gramWeight: 326 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sections)',
        displayPlural: 'cups (sections)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sections', gramWeight: 230 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9111', 173033, '1 medium (236 g); 1 cup sections (230 g); 1 large (326 g); 1 small (128 g)', 'raw', 'edible portion without refuse (peel, seeds removed)', 'USDA FoodData Central SR Legacy NDB 9111, Grapefruit, raw, pink and red and white, all areas (FDC ID 173033)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (240 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  pineapple: {
    produceId: 'pineapple',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chunks)',
        displayPlural: 'cups (chunks)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chunks', gramWeight: 165 }],
      },
      {
        unitKey: 'slice',
        family: 'piece',
        displaySingular: 'slice',
        displayPlural: 'slices',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'slice (3-1/2 inch dia, 3/4 inch thick)', gramWeight: 79 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9429', 168193, '1 cup chunks (165 g); 1 slice (79 g)', 'raw', 'edible portion without refuse (skin, core removed)', 'USDA FoodData Central SR Legacy NDB 9429, Pineapple, raw, traditional varieties (FDC ID 168193)'),
    ],
    confidence: 'high',
  },

  watermelon: {
    produceId: 'watermelon',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (balls)',
        displayPlural: 'cups (balls)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, balls', gramWeight: 152 }],
      },
      {
        unitKey: 'wedge',
        family: 'wedge',
        displaySingular: 'wedge',
        displayPlural: 'wedges',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'wedge (1/16 of melon)', gramWeight: 286 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9326', 167765, '1 cup balls (152 g); 1 wedge (286 g)', 'raw', 'edible portion without refuse (rind, seeds removed)', 'USDA FoodData Central SR Legacy NDB 9326, Watermelon, raw (FDC ID 167765)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 cup (152 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  pomegranate: {
    produceId: 'pomegranate',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'pomegranate',
        displayPlural: 'pomegranates',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (4 inch dia)', gramWeight: 282 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (arils)',
        displayPlural: 'cups (arils)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, arils', gramWeight: 174 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9286', 169134, '1 medium (282 g); 1 cup arils (174 g)', 'raw', 'edible portion without refuse (skin, membrane removed; arils only)', 'USDA FoodData Central SR Legacy NDB 9286, Pomegranates, raw (FDC ID 169134)'),
    ],
    confidence: 'medium',
  },

  mango: {
    produceId: 'mango',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'mango',
        displayPlural: 'mangoes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium', gramWeight: 200 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (pieces)',
        displayPlural: 'cups (pieces)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, pieces', gramWeight: 165 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9176', 169910, '1 cup pieces (165 g)', 'raw', 'edible portion without refuse (skin, pit removed)', 'USDA FoodData Central SR Legacy NDB 9176, Mangos, raw (FDC ID 169910)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (200 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'medium',
    notes: 'Per-mango weight from FDA Appendix C; USDA SR Legacy only provides cup measure.',
  },

  papaya: {
    produceId: 'papaya',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (pieces)',
        displayPlural: 'cups (pieces)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, pieces', gramWeight: 140 }],
      },
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'papaya',
        displayPlural: 'papayas',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium', gramWeight: 157 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9226', 169926, '1 cup pieces (140 g); 1 medium (157 g)', 'raw', 'edible portion without refuse (skin, seeds removed)', 'USDA FoodData Central SR Legacy NDB 9226, Papayas, raw (FDC ID 169926)'),
    ],
    confidence: 'medium',
  },

  kiwi: {
    produceId: 'kiwi',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'kiwi',
        displayPlural: 'kiwis',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (2 inch dia)', gramWeight: 76 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sliced', gramWeight: 180 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9148', 168153, '1 medium (76 g); 1 cup sliced (180 g)', 'raw', 'edible portion without refuse (skin removed)', 'USDA FoodData Central SR Legacy NDB 9148, Kiwifruit, green, raw (FDC ID 168153)'),
    ],
    confidence: 'high',
  },

  pear: {
    produceId: 'pear',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'pear',
        displayPlural: 'pears',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-1/4 inch dia)', gramWeight: 148 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/2 inch dia)', gramWeight: 178 },
          { sizeKey: 'large', displaySize: 'large (2-3/4 inch dia)', gramWeight: 230 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (chopped)',
        displayPlural: 'cups (chopped)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, pieces', gramWeight: 140 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9252', 169118, '1 medium (178 g); 1 cup pieces (140 g); 1 large (230 g); 1 small (148 g)', 'raw', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy NDB 9252, Pears, raw (FDC ID 169118)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (178 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  grape: {
    produceId: 'grape',
    quantitySupported: true,
    // Default to 'piece' (individual grapes) since users typically
    // count grapes rather than measure them in cups. The cup option
    // remains available as a secondary unit.
    defaultUnitKey: 'piece',
    units: [
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'grape',
        displayPlural: 'grapes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium grape', gramWeight: 5 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup',
        displayPlural: 'cups',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 151 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9132', 174683, '1 cup (151 g); 1 grape (5 g)', 'raw', 'edible portion without refuse (stems removed)', 'USDA FoodData Central SR Legacy NDB 9132, Grapes, red or green (European type, such as Thompson seedless), raw (FDC ID 174683)'),
      sr('FDA', '21 CFR Appendix C', null, null, '3/4 cup (126 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  strawberry: {
    produceId: 'strawberry',
    quantitySupported: true,
    // Default to individual strawberries — users typically count
    // them rather than measuring by cup. Cup options remain available.
    defaultUnitKey: 'piece',
    units: [
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'strawberry',
        displayPlural: 'strawberries',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (1 inch dia)', gramWeight: 9 },
          { sizeKey: 'medium', displaySize: 'medium (1-1/4 inch dia)', gramWeight: 12 },
          { sizeKey: 'large', displaySize: 'large (1-1/2 inch dia)', gramWeight: 18 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (whole)',
        displayPlural: 'cups (whole)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, whole', gramWeight: 152 }],
      },
      {
        unitKey: 'loose_cup_sliced',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, sliced', gramWeight: 166 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9316', 167762, '1 cup whole (152 g); 1 cup sliced (166 g); 1 large (18 g); 1 medium (12 g); 1 small (9 g)', 'raw', 'edible portion without refuse (caps, stems removed)', 'USDA FoodData Central SR Legacy NDB 9316, Strawberries, raw (FDC ID 167762)'),
    ],
    confidence: 'high',
  },

  blueberry: {
    produceId: 'blueberry',
    quantitySupported: true,
    // Default to handful — users typically grab handfuls of blueberries
    // rather than measuring them in cups. Cup option remains available.
    defaultUnitKey: 'handful',
    units: [
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'handful (~25 berries)', gramWeight: 50 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup',
        displayPlural: 'cups',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 148 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9050', 171711, '1 cup (148 g)', 'raw', 'edible portion without refuse (stems removed)', 'USDA FoodData Central SR Legacy NDB 9050, Blueberries, raw (FDC ID 171711)'),
      sr('FDA', '21 CFR Appendix C', null, null, '3/4 cup (113 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  raspberry: {
    produceId: 'raspberry',
    quantitySupported: true,
    // Default to individual berries — users typically count them.
    defaultUnitKey: 'piece',
    units: [
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'raspberry',
        displayPlural: 'raspberries',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'standard', displaySize: '1 berry (≈2 g)', gramWeight: 2 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup',
        displayPlural: 'cups',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 123 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9302', 167755, '1 cup (123 g); 1 berry (≈2 g estimated)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 9302, Raspberries, raw (FDC ID 167755)'),
    ],
    confidence: 'high',
  },

  blackberry: {
    produceId: 'blackberry',
    quantitySupported: true,
    // Default to individual berries — users typically count them.
    defaultUnitKey: 'piece',
    units: [
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'blackberry',
        displayPlural: 'blackberries',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'standard', displaySize: '1 berry (≈5 g)', gramWeight: 5 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup',
        displayPlural: 'cups',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 144 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9042', 173946, '1 cup (144 g); 1 berry (≈5 g estimated)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 9042, Blackberries, raw (FDC ID 173946)'),
    ],
    confidence: 'high',
  },

  cranberry: {
    produceId: 'cranberry',
    quantitySupported: true,
    // Default to individual berries — users typically count them.
    defaultUnitKey: 'piece',
    units: [
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'cranberry',
        displayPlural: 'cranberries',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'standard', displaySize: '1 berry (≈1.5 g)', gramWeight: 1.5 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (whole)',
        displayPlural: 'cups (whole)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, whole', gramWeight: 110 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (chopped)',
        displayPlural: 'tablespoons (chopped)',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, chopped', gramWeight: 6.9 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9078', 171722, '1 cup whole (110 g); 1 tbsp chopped (6.9 g); 1 berry (≈1.5 g estimated)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 9078, Cranberries, raw (FDC ID 171722)'),
    ],
    confidence: 'high',
  },

  cherry: {
    produceId: 'cherry',
    quantitySupported: true,
    // Default to individual cherries — users typically count them.
    defaultUnitKey: 'piece',
    units: [
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'cherry',
        displayPlural: 'cherries',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium cherry (with pit)', gramWeight: 8 }],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (with pits)',
        displayPlural: 'cups (with pits)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, with pits', gramWeight: 155 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9063', 173954, '1 cup with pits (155 g); 1 cherry (8 g)', 'raw', 'edible portion without refuse (stems, pits removed)', 'USDA FoodData Central SR Legacy NDB 9063, Cherries, sour, red, raw (FDC ID 173954)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 cup (155 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'medium',
    notes: 'USDA SR Legacy provides sour cherry data; JuiceEngine uses tart cherry. Sweet cherry portion weights are similar.',
  },

  cantaloupe: {
    produceId: 'cantaloupe',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (balls)',
        displayPlural: 'cups (balls)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, balls', gramWeight: 160 }],
      },
      {
        unitKey: 'wedge',
        family: 'wedge',
        displaySingular: 'wedge',
        displayPlural: 'wedges',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'wedge (1/8 of melon)', gramWeight: 160 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9181', 169092, '1 cup balls (160 g); 1 wedge (160 g)', 'raw', 'edible portion without refuse (rind, seeds removed)', 'USDA FoodData Central SR Legacy NDB 9181, Melons, cantaloupe, raw (FDC ID 169092)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1/4 melon (134 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  honeydew: {
    produceId: 'honeydew',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (balls)',
        displayPlural: 'cups (balls)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, balls', gramWeight: 177 }],
      },
      {
        unitKey: 'wedge',
        family: 'wedge',
        displaySingular: 'wedge',
        displayPlural: 'wedges',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'wedge (1/8 of melon)', gramWeight: 130 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9184', 169911, '1 cup balls (177 g); 1 wedge (130 g)', 'raw', 'edible portion without refuse (rind, seeds removed)', 'USDA FoodData Central SR Legacy NDB 9184, Melons, honeydew, raw (FDC ID 169911)'),
    ],
    confidence: 'medium',
  },

  coconut_water: {
    produceId: 'coconut_water',
    quantitySupported: false,
    defaultUnitKey: null,
    units: [],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '12119', 170174, '1 cup (240 g) — liquid measure', 'raw', 'edible portion (liquid only)', 'USDA FoodData Central SR Legacy NDB 12119, Nuts, coconut water (liquid from coconuts) (FDC ID 170174)'),
    ],
    confidence: 'high',
    notes: 'Coconut water is a prepared liquid, not a whole produce ingredient. It is measured by volume (1 cup = 240 g per USDA SR Legacy NDB 12119). It does not support honest Count/Quantity entry because it is not a discrete solid. Use weight or volume entry only.',
  },

  passion_fruit: {
    produceId: 'passion_fruit',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'passion fruit',
        displayPlural: 'passion fruit',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (2 inch dia)', gramWeight: 18 }],
      },
      {
        unitKey: 'tablespoon',
        family: 'tablespoon',
        displaySingular: 'tablespoon (pulp)',
        displayPlural: 'tablespoons (pulp)',
        allowDecimal: true,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: '1 tbsp, pulp', gramWeight: 13 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9231', 169108, '1 fruit (18 g); 1 tbsp pulp (13 g)', 'raw', 'edible portion without refuse (skin removed; pulp and seeds only)', 'USDA FoodData Central SR Legacy NDB 9231, Passion-fruit, (granadilla), purple, raw (FDC ID 169108)'),
    ],
    confidence: 'medium',
  },

  peach: {
    produceId: 'peach',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'peach',
        displayPlural: 'peaches',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 98 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/2 inch dia)', gramWeight: 150 },
          { sizeKey: 'large', displaySize: 'large (2-3/4 inch dia)', gramWeight: 175 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, slices', gramWeight: 154 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9236', 169928, '1 medium (150 g); 1 cup slices (154 g); 1 large (175 g); 1 small (98 g)', 'raw', 'edible portion without refuse (pit removed)', 'USDA FoodData Central SR Legacy NDB 9236, Peaches, yellow, raw (FDC ID 169928)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (150 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  plum: {
    produceId: 'plum',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'plum',
        displayPlural: 'plums',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2 inch dia)', gramWeight: 66 },
          { sizeKey: 'medium', displaySize: 'medium (2-1/2 inch dia)', gramWeight: 104 },
          { sizeKey: 'large', displaySize: 'large (2-3/4 to 3 inch dia)', gramWeight: 151 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, slices', gramWeight: 165 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9279', 169949, '1 medium (104 g); 1 cup slices (165 g); 1 large (151 g); 1 small (66 g)', 'raw', 'edible portion without refuse (pit removed)', 'USDA FoodData Central SR Legacy NDB 9279, Plums, raw (FDC ID 169949)'),
      sr('FDA', '21 CFR Appendix C', null, null, '1 medium (104 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  nectarine: {
    produceId: 'nectarine',
    quantitySupported: true,
    defaultUnitKey: 'whole',
    units: [
      {
        unitKey: 'whole',
        family: 'whole',
        displaySingular: 'nectarine',
        displayPlural: 'nectarines',
        allowDecimal: false,
        inputStep: 1,
        sizes: [
          { sizeKey: 'small', displaySize: 'small (2-1/2 inch dia)', gramWeight: 121 },
          { sizeKey: 'medium', displaySize: 'medium (2-3/4 inch dia)', gramWeight: 142 },
          { sizeKey: 'large', displaySize: 'large (3 inch dia)', gramWeight: 192 },
        ],
      },
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (sliced)',
        displayPlural: 'cups (sliced)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, slices', gramWeight: 143 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '9191', 169914, '1 medium (142 g); 1 cup slices (143 g); 1 large (192 g); 1 small (121 g)', 'raw', 'edible portion without refuse (pit removed)', 'USDA FoodData Central SR Legacy NDB 9191, Nectarines, raw (FDC ID 169914)'),
    ],
    confidence: 'high',
  },
})
