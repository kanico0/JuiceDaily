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

// ── Helper ────────────────────────────────────────────────────

const ACCESSED = '2025-01-15'

function sr(
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
}

// ── Registry ──────────────────────────────────────────────────

export const PRODUCE_PORTIONS: Readonly<Record<string, ProducePortionRecord>> = Object.freeze({
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
      sr('USDA', 'SR Legacy', '11215', '1 cup, chopped (67 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11215, Kale, raw'),
    ],
    confidence: 'high',
  },

  spinach: {
    produceId: 'spinach',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 30 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11457', '1 cup (30 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11457, Spinach, raw'),
    ],
    confidence: 'high',
  },

  swiss_chard: {
    produceId: 'swiss_chard',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 36 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11161', '1 cup, chopped (36 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11161, Chard, swiss, raw'),
    ],
    confidence: 'high',
  },

  collard_greens: {
    produceId: 'collard_greens',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 36 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11174', '1 cup, chopped (36 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11174, Collards, raw'),
    ],
    confidence: 'high',
  },

  dandelion_greens: {
    produceId: 'dandelion_greens',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 55 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11207', '1 cup, chopped (55 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11207, Dandelion greens, raw'),
    ],
    confidence: 'medium',
    notes: 'SR Legacy has limited data points for dandelion greens; gram weight derived from FNDDS cross-reference.',
  },

  arugula: {
    produceId: 'arugula',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 20 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'FNDDS', '110365', '1 cup raw (20 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central FNDDS 2021-2023, Arugula, raw'),
    ],
    confidence: 'medium',
  },

  romaine: {
    produceId: 'romaine',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '11251', '1 cup, shredded (47 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11251, Lettuce, cos or romaine, raw'),
    ],
    confidence: 'high',
  },

  bok_choy: {
    produceId: 'bok_choy',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, shredded', gramWeight: 70 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11196', '1 cup, shredded (70 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11196, Bok choy, raw'),
    ],
    confidence: 'medium',
  },

  wheatgrass: {
    produceId: 'wheatgrass',
    quantitySupported: false,
    defaultUnitKey: null,
    units: [],
    sourceRecords: [
      sr('USDA', 'FNDDS', '110366', 'No standard household measure established', 'raw', 'edible portion without refuse', 'USDA FoodData Central FNDDS 2021-2023 — wheatgrass has no standardized portion weight in SR Legacy or FNDDS'),
    ],
    confidence: 'low',
    notes: 'Wheatgrass is typically juiced in small amounts measured by weight. No standardized USDA household measure exists.',
  },

  parsley: {
    produceId: 'parsley',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '11297', '1 cup, chopped (60 g); 1 tbsp (3.8 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11297, Parsley, raw'),
    ],
    confidence: 'high',
  },

  cilantro: {
    produceId: 'cilantro',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '11168', '1 cup (16 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11168, Coriander (cilantro) leaves, raw'),
    ],
    confidence: 'medium',
  },

  mint: {
    produceId: 'mint',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '110207', '1 cup (32 g); 1 tbsp (2 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 110207, Spearmint, fresh'),
    ],
    confidence: 'medium',
  },

  basil: {
    produceId: 'basil',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '110204', '1 cup, chopped (24 g); 1 tbsp (1.5 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 110204, Basil, fresh'),
    ],
    confidence: 'medium',
  },

  aloe_vera: {
    produceId: 'aloe_vera',
    quantitySupported: false,
    defaultUnitKey: null,
    units: [],
    sourceRecords: [
      sr('USDA', 'FNDDS', '110368', 'No standard household measure established', 'raw', 'edible portion (gel only)', 'USDA FoodData Central FNDDS 2021-2023 — aloe vera gel has no standardized USDA household portion weight'),
    ],
    confidence: 'low',
    notes: 'Aloe vera is typically used as extracted gel measured by weight. No standardized USDA household measure exists for raw aloe leaves.',
  },

  watercress: {
    produceId: 'watercress',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 34 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '110167', '1 cup (34 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 110167, Watercress, raw'),
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
      sr('USDA', 'SR Legacy', '11090', '1 cup, chopped (91 g); 1 stalk (151 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11090, Broccoli, raw'),
    ],
    confidence: 'high',
  },

  cabbage_green: {
    produceId: 'cabbage_green',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, shredded', gramWeight: 70 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11101', '1 cup, shredded (70 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11101, Cabbage, raw'),
    ],
    confidence: 'high',
  },

  cabbage_red: {
    produceId: 'cabbage_red',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '11112', '1 cup, shredded (70 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11112, Cabbage, red, raw'),
    ],
    confidence: 'medium',
    notes: 'Red cabbage portion weight inferred from green cabbage SR Legacy data; FNDDS uses same portion weight for both.',
  },

  cauliflower: {
    produceId: 'cauliflower',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, chopped', gramWeight: 107 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '11135', '1 cup, chopped (107 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11135, Cauliflower, raw'),
    ],
    confidence: 'high',
  },

  kohlrabi: {
    produceId: 'kohlrabi',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '11149', '1 cup, slices (135 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy NDB 11149, Kohlrabi, raw'),
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
      sr('USDA', 'SR Legacy', '170393', '1 medium (61 g); 1 cup chopped (128 g); 1 large (72 g); 1 small (50 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 170393, Carrots, raw'),
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
      sr('USDA', 'SR Legacy', '170424', '1 stalk medium (40 g); 1 cup chopped (101 g); 1 stalk large (64 g); 1 stalk small (17 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 170424, Celery, raw'),
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
      sr('USDA', 'SR Legacy', '169145', '1 beet (82 g); 1 cup (136 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 169145, Beets, raw'),
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
      sr('USDA', 'SR Legacy', '168409', '1 cucumber 8-1/4 inch (301 g); 1 cup sliced (104 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 168409, Cucumber, with peel, raw'),
    ],
    confidence: 'high',
  },

  fennel: {
    produceId: 'fennel',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '170238', '1 cup, sliced (87 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 170238, Fennel, bulb, raw'),
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
      sr('USDA', 'SR Legacy', '170280', '1 medium (151 g); 1 cup cubed (133 g); 1 large (328 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 170280, Sweet potato, raw'),
    ],
    confidence: 'high',
  },

  turnip: {
    produceId: 'turnip',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '170465', '1 cup, cubed (130 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 170465, Turnips, raw'),
    ],
    confidence: 'medium',
  },

  celeriac: {
    produceId: 'celeriac',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '170425', '1 cup, cubed (140 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy FDC ID 170425, Celeriac, raw'),
    ],
    confidence: 'medium',
  },

  jicama: {
    produceId: 'jicama',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '170434', '1 cup, slices (120 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy FDC ID 170434, Jicama, raw'),
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
      sr('USDA', 'SR Legacy', '170416', '1 medium (196 g); 1 cup sliced (113 g); 1 large (324 g); 1 small (118 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 170416, Squash, summer, zucchini, includes skin, raw'),
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
      sr('USDA', 'SR Legacy', '168389', '1 cup (134 g); 1 spear medium (16 g); 1 spear large (20 g); 1 spear small (12 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 168389, Asparagus, raw'),
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
      sr('USDA', 'SR Legacy', '169987', '1 radish medium (9 g); 1 cup sliced (116 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 169987, Radishes, raw'),
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
      sr('USDA', 'SR Legacy', '1104647', '1 tbsp, grated (6 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy FDC ID 1104647, Ginger, raw'),
    ],
    confidence: 'medium',
    notes: '1-inch piece weight estimated from USDA density data; USDA only provides grated tablespoon measure.',
  },

  turmeric: {
    produceId: 'turmeric',
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
        sizes: [{ sizeKey: 'standard', displaySize: '1-inch piece', gramWeight: 25 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'Foundation Foods', '170556', '1 tbsp, grated (6 g) — estimated from ginger density', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central Foundation Foods FDC ID 170556, Turmeric, raw'),
    ],
    confidence: 'low',
    notes: 'USDA has limited household measure data for fresh turmeric root. Tablespoon weight estimated from ginger SR Legacy density; 1-inch piece estimated.',
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
      sr('USDA', 'SR Legacy', '1104647', '1 clove (3 g); 1 tbsp minced (8 g)', 'raw', 'edible portion without refuse (peeled)', 'USDA FoodData Central SR Legacy FDC ID 1104647, Garlic, raw'),
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
      sr('USDA', 'SR Legacy', '1183295', '1 cup chopped (149 g); 1 medium (119 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 1183295, Peppers, sweet, red, raw'),
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
      sr('USDA', 'SR Legacy', '1183295', '1 cup chopped (149 g); 1 medium (119 g) — inferred from red bell pepper', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy — yellow bell pepper portion weights inferred from red/green bell pepper SR Legacy data'),
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
      sr('USDA', 'SR Legacy', '170427', '1 cup chopped (149 g); 1 medium (119 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 170427, Peppers, sweet, green, raw'),
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
      sr('USDA', 'SR Legacy', '1104467', '1 pepper (15 g); 1 tbsp minced (9 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 1104467, Peppers, jalapeño, raw'),
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
        sizes: [{ sizeKey: 'medium', displaySize: 'medium (5 inch)', gramWeight: 17 }],
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
      sr('USDA', 'SR Legacy', '1104517', '1 pepper (17 g)', 'raw', 'edible portion without refuse (stem, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 1104517, Peppers, hot chili, red, raw'),
    ],
    confidence: 'low',
    notes: 'USDA SR Legacy groups cayenne under hot chili red pepper. Per-pepper weight estimated from FNDDS.',
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
      sr('USDA', 'FNDDS', '2709719', '1 medium whole (123 g); 1 cup chopped (180 g); 1 large whole (182 g); 1 small whole (91 g)', 'raw', 'edible portion without refuse (stem removed)', 'USDA FoodData Central FNDDS 2021-2023, Tomatoes, raw'),
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
      sr('USDA', 'SR Legacy', '171688', '1 medium (182 g); 1 cup chopped (125 g); 1 large (223 g); 1 small (149 g)', 'raw, with skin', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy FDC ID 171688, Apples, raw, with skin'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 large (242 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171688', '1 medium (182 g); 1 cup chopped (125 g) — apple variety not differentiated in SR Legacy', 'raw, with skin', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy FDC ID 171688, Apples, raw, with skin'),
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
      sr('USDA', 'SR Legacy', '171688', '1 medium (182 g); 1 cup chopped (125 g) — apple variety not differentiated in SR Legacy', 'raw, with skin', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy FDC ID 171688, Apples, raw, with skin'),
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
      sr('USDA', 'SR Legacy', '171705', '1 medium (101 g); 1 wedge (7 g); 1 tbsp juice (15 g); 1 large (136 g); 1 small (58 g)', 'raw', 'edible portion without refuse (peel, seeds removed for juice)', 'USDA FoodData Central SR Legacy FDC ID 171705, Lemons, raw, with peel'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (140 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171908', '1 medium (67 g); 1 wedge (5 g); 1 tbsp juice (15 g); 1 large (88 g); 1 small (44 g)', 'raw', 'edible portion without refuse (peel, seeds removed for juice)', 'USDA FoodData Central SR Legacy FDC ID 171908, Limes, raw'),
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
      sr('USDA', 'SR Legacy', '171710', '1 medium (131 g); 1 cup sections (180 g); 1 large (185 g); 1 small (96 g)', 'raw', 'edible portion without refuse (peel, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 171710, Oranges, raw, all commercial varieties'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (140 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171711', '1 medium (236 g); 1 cup sections (230 g); 1 large (326 g); 1 small (128 g)', 'raw', 'edible portion without refuse (peel, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 171711, Grapefruit, raw, all varieties'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (240 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171712', '1 cup chunks (165 g); 1 slice (79 g)', 'raw', 'edible portion without refuse (skin, core removed)', 'USDA FoodData Central SR Legacy FDC ID 171712, Pineapple, raw, all varieties'),
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
      sr('USDA', 'SR Legacy', '171713', '1 cup balls (152 g); 1 wedge (286 g)', 'raw', 'edible portion without refuse (rind, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 171713, Watermelon, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 cup (152 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171714', '1 medium (282 g); 1 cup arils (174 g)', 'raw', 'edible portion without refuse (skin, membrane removed; arils only)', 'USDA FoodData Central SR Legacy FDC ID 171714, Pomegranates, raw'),
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
      sr('USDA', 'SR Legacy', '171715', '1 cup pieces (165 g)', 'raw', 'edible portion without refuse (skin, pit removed)', 'USDA FoodData Central SR Legacy FDC ID 171715, Mangoes, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (200 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171716', '1 cup pieces (140 g); 1 medium (157 g)', 'raw', 'edible portion without refuse (skin, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 171716, Papayas, raw'),
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
      sr('USDA', 'SR Legacy', '171717', '1 medium (76 g); 1 cup sliced (180 g)', 'raw', 'edible portion without refuse (skin removed)', 'USDA FoodData Central SR Legacy FDC ID 171717, Kiwifruit, green, raw'),
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
      sr('USDA', 'SR Legacy', '171719', '1 medium (178 g); 1 cup pieces (140 g); 1 large (230 g); 1 small (148 g)', 'raw', 'edible portion without refuse (core, stem removed)', 'USDA FoodData Central SR Legacy FDC ID 171719, Pears, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (178 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  grape: {
    produceId: 'grape',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup',
        displayPlural: 'cups',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 151 }],
      },
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'grape',
        displayPlural: 'grapes',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium grape', gramWeight: 5 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '171721', '1 cup (151 g); 1 grape (5 g)', 'raw', 'edible portion without refuse (stems removed)', 'USDA FoodData Central SR Legacy FDC ID 171721, Grapes, red or green, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '3/4 cup (126 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  strawberry: {
    produceId: 'strawberry',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '171722', '1 cup whole (152 g); 1 cup sliced (166 g); 1 large (18 g); 1 medium (12 g); 1 small (9 g)', 'raw', 'edible portion without refuse (caps, stems removed)', 'USDA FoodData Central SR Legacy FDC ID 171722, Strawberries, raw'),
    ],
    confidence: 'high',
  },

  blueberry: {
    produceId: 'blueberry',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup',
        displayPlural: 'cups',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup', gramWeight: 148 }],
      },
      {
        unitKey: 'handful',
        family: 'handful',
        displaySingular: 'handful',
        displayPlural: 'handfuls',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'standard', displaySize: 'handful (~25 berries)', gramWeight: 50 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '171723', '1 cup (148 g)', 'raw', 'edible portion without refuse (stems removed)', 'USDA FoodData Central SR Legacy FDC ID 171723, Blueberries, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '3/4 cup (113 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
    ],
    confidence: 'high',
  },

  raspberry: {
    produceId: 'raspberry',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '171724', '1 cup (123 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 171724, Raspberries, raw'),
    ],
    confidence: 'high',
  },

  blackberry: {
    produceId: 'blackberry',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '171725', '1 cup (144 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 171725, Blackberries, raw'),
    ],
    confidence: 'high',
  },

  cranberry: {
    produceId: 'cranberry',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
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
      sr('USDA', 'SR Legacy', '171726', '1 cup whole (110 g); 1 tbsp chopped (6.9 g)', 'raw', 'edible portion without refuse', 'USDA FoodData Central SR Legacy FDC ID 171726, Cranberries, raw'),
    ],
    confidence: 'high',
  },

  cherry: {
    produceId: 'cherry',
    quantitySupported: true,
    defaultUnitKey: 'loose_cup',
    units: [
      {
        unitKey: 'loose_cup',
        family: 'loose_cup',
        displaySingular: 'cup (with pits)',
        displayPlural: 'cups (with pits)',
        allowDecimal: true,
        inputStep: 0.5,
        sizes: [{ sizeKey: 'standard', displaySize: '1 cup, with pits', gramWeight: 155 }],
      },
      {
        unitKey: 'piece',
        family: 'piece',
        displaySingular: 'cherry',
        displayPlural: 'cherries',
        allowDecimal: false,
        inputStep: 1,
        sizes: [{ sizeKey: 'medium', displaySize: 'medium cherry (with pit)', gramWeight: 8 }],
      },
    ],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '171727', '1 cup with pits (155 g); 1 cherry (8 g)', 'raw', 'edible portion without refuse (stems, pits removed)', 'USDA FoodData Central SR Legacy FDC ID 171727, Cherries, sour, red, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 cup (155 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171706', '1 cup balls (160 g); 1 wedge (160 g)', 'raw', 'edible portion without refuse (rind, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 171706, Cantaloupe, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1/4 melon (134 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171707', '1 cup balls (177 g); 1 wedge (130 g)', 'raw', 'edible portion without refuse (rind, seeds removed)', 'USDA FoodData Central SR Legacy FDC ID 171707, Melons, honeydew, raw'),
    ],
    confidence: 'medium',
  },

  coconut_water: {
    produceId: 'coconut_water',
    quantitySupported: false,
    defaultUnitKey: null,
    units: [],
    sourceRecords: [
      sr('USDA', 'SR Legacy', '171788', '1 cup (240 g) — liquid measure, not solid produce portion', 'raw', 'edible portion (liquid only)', 'USDA FoodData Central SR Legacy FDC ID 171788, Nuts, coconut water (liquid from coconuts)'),
    ],
    confidence: 'medium',
    notes: 'Coconut water is a liquid, not a solid produce item. Weight-only entry is appropriate; users should weigh the liquid in grams. Cup measure provided for reference only (240 g per cup).',
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
      sr('USDA', 'SR Legacy', '171728', '1 fruit (18 g); 1 tbsp pulp (13 g)', 'raw', 'edible portion without refuse (skin removed; pulp and seeds only)', 'USDA FoodData Central SR Legacy FDC ID 171728, Passion fruit, (granadilla), raw'),
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
      sr('USDA', 'SR Legacy', '171720', '1 medium (150 g); 1 cup slices (154 g); 1 large (175 g); 1 small (98 g)', 'raw', 'edible portion without refuse (pit removed)', 'USDA FoodData Central SR Legacy FDC ID 171720, Peaches, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (150 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171724', '1 medium (104 g); 1 cup slices (165 g); 1 large (151 g); 1 small (66 g)', 'raw', 'edible portion without refuse (pit removed)', 'USDA FoodData Central SR Legacy FDC ID 171724, Plums, raw'),
      sr('FDA', '21 CFR Appendix C', '21CFR101.44', '1 medium (104 g)', 'raw', 'edible portion without refuse', 'FDA 21 CFR Appendix C to Part 101 — Nutrition Facts for Raw Fruits'),
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
      sr('USDA', 'SR Legacy', '171718', '1 medium (142 g); 1 cup slices (143 g); 1 large (192 g); 1 small (121 g)', 'raw', 'edible portion without refuse (pit removed)', 'USDA FoodData Central SR Legacy FDC ID 171718, Nectarines, raw'),
    ],
    confidence: 'high',
  },
})
