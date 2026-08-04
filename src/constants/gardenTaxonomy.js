// ─────────────────────────────────────────────────────────────
// gardenTaxonomy.js — Deterministic Garden taxonomy mapping
// every canonical produce ID to a Garden bed and color group.
//
// Seven beds: greens, roots, citrus, orchard, berries, tropical, herbs
// Six color groups: green, red, orange, yellow, purple, tan
//
// This file is the single source of truth for produce → bed/color
// classification. It is deterministic and never changes at runtime.
// ─────────────────────────────────────────────────────────────

// ── Bed keys ─────────────────────────────────────────────────
export const GARDEN_BEDS = [
  'greens',
  'roots',
  'citrus',
  'orchard',
  'berries',
  'tropical',
  'herbs',
]

// ── Color group keys ─────────────────────────────────────────
export const GARDEN_COLORS = [
  'green',
  'red',
  'orange',
  'yellow',
  'purple',
  'tan',
]

// ── Bed metadata ─────────────────────────────────────────────
export const BED_METADATA = {
  greens: {
    key: 'greens',
    label: 'Green Garden',
    shortLabel: 'Greens',
    description: 'Leafy greens and cruciferous vegetables',
  },
  roots: {
    key: 'roots',
    label: 'Root Garden',
    shortLabel: 'Roots',
    description: 'Root vegetables and stalks',
  },
  citrus: {
    key: 'citrus',
    label: 'Citrus Grove',
    shortLabel: 'Citrus',
    description: 'Citrus fruits',
  },
  orchard: {
    key: 'orchard',
    label: 'Orchard',
    shortLabel: 'Orchard',
    description: 'Tree fruits and stone fruits',
  },
  berries: {
    key: 'berries',
    label: 'Berry & Purple Patch',
    shortLabel: 'Berries',
    description: 'Berries and small fruits',
  },
  tropical: {
    key: 'tropical',
    label: 'Tropical Garden',
    shortLabel: 'Tropical',
    description: 'Tropical and exotic fruits',
  },
  herbs: {
    key: 'herbs',
    label: 'Herb & Booster Bed',
    shortLabel: 'Herbs',
    description: 'Herbs, spices, and boosters',
  },
}

// ── Color metadata ───────────────────────────────────────────
export const COLOR_METADATA = {
  green: { key: 'green', label: 'Green' },
  red: { key: 'red', label: 'Red' },
  orange: { key: 'orange', label: 'Orange' },
  yellow: { key: 'yellow', label: 'Yellow' },
  purple: { key: 'purple', label: 'Purple' },
  tan: { key: 'tan', label: 'Tan' },
}

// ── Produce → Bed mapping ────────────────────────────────────
// Maps canonical produce IDs (after family collapse) to beds.
// Uses the same canonical key as getCanonicalProduceKey().
const PRODUCE_TO_BED = {
  // Greens
  kale: 'greens',
  spinach: 'greens',
  swiss_chard: 'greens',
  collard_greens: 'greens',
  dandelion_greens: 'greens',
  arugula: 'greens',
  romaine: 'greens',
  bok_choy: 'greens',
  wheatgrass: 'greens',
  watercress: 'greens',
  broccoli: 'greens',
  cabbage: 'greens',
  cabbage_green: 'greens',
  cabbage_red: 'greens',
  cauliflower: 'greens',
  kohlrabi: 'greens',
  cucumber: 'greens',
  zucchini: 'greens',
  celery: 'greens',
  fennel: 'greens',
  asparagus: 'greens',

  // Roots
  carrot: 'roots',
  beet: 'roots',
  sweet_potato: 'roots',
  turnip: 'roots',
  celeriac: 'roots',
  jicama: 'roots',
  radish: 'roots',

  // Citrus
  lemon: 'citrus',
  lime: 'citrus',
  orange: 'citrus',
  grapefruit: 'citrus',

  // Orchard
  apple: 'orchard',
  apple_green: 'orchard',
  apple_red: 'orchard',
  pear: 'orchard',
  peach: 'orchard',
  plum: 'orchard',
  nectarine: 'orchard',
  pomegranate: 'orchard',
  cherry: 'orchard',

  // Berries
  strawberry: 'berries',
  blueberry: 'berries',
  raspberry: 'berries',
  blackberry: 'berries',
  cranberry: 'berries',
  grape: 'berries',

  // Tropical
  pineapple: 'tropical',
  mango: 'tropical',
  papaya: 'tropical',
  kiwi: 'tropical',
  watermelon: 'tropical',
  cantaloupe: 'tropical',
  honeydew: 'tropical',
  coconut_water: 'tropical',
  passion_fruit: 'tropical',

  // Herbs & Boosters
  parsley: 'herbs',
  cilantro: 'herbs',
  mint: 'herbs',
  basil: 'herbs',
  aloe_vera: 'herbs',
  ginger: 'herbs',
  turmeric: 'herbs',
  garlic: 'herbs',
  bell_pepper: 'herbs',
  bell_pepper_red: 'herbs',
  bell_pepper_yellow: 'herbs',
  bell_pepper_green: 'herbs',
  jalapeño: 'herbs',
  cayenne: 'herbs',
  tomato: 'herbs',
}

// ── Produce → Color mapping ──────────────────────────────────
const PRODUCE_TO_COLOR = {
  // Greens — green
  kale: 'green',
  spinach: 'green',
  swiss_chard: 'green',
  collard_greens: 'green',
  dandelion_greens: 'green',
  arugula: 'green',
  romaine: 'green',
  bok_choy: 'green',
  wheatgrass: 'green',
  watercress: 'green',
  broccoli: 'green',
  cabbage: 'green',
  cabbage_green: 'green',
  cauliflower: 'tan',
  cabbage_red: 'purple',
  kohlrabi: 'green',
  cucumber: 'green',
  zucchini: 'green',
  celery: 'green',
  fennel: 'green',
  asparagus: 'green',

  // Roots
  carrot: 'orange',
  beet: 'red',
  sweet_potato: 'orange',
  turnip: 'tan',
  celeriac: 'tan',
  jicama: 'tan',
  radish: 'red',

  // Citrus
  lemon: 'yellow',
  lime: 'green',
  orange: 'orange',
  grapefruit: 'red',

  // Orchard
  apple: 'red',
  apple_green: 'green',
  apple_red: 'red',
  pear: 'green',
  peach: 'orange',
  plum: 'purple',
  nectarine: 'orange',
  pomegranate: 'red',
  cherry: 'red',

  // Berries
  strawberry: 'red',
  blueberry: 'purple',
  raspberry: 'red',
  blackberry: 'purple',
  cranberry: 'red',
  grape: 'purple',

  // Tropical
  pineapple: 'yellow',
  mango: 'orange',
  papaya: 'orange',
  kiwi: 'green',
  watermelon: 'red',
  cantaloupe: 'orange',
  honeydew: 'green',
  coconut_water: 'tan',
  passion_fruit: 'purple',

  // Herbs & Boosters
  parsley: 'green',
  cilantro: 'green',
  mint: 'green',
  basil: 'green',
  aloe_vera: 'green',
  ginger: 'tan',
  turmeric: 'orange',
  garlic: 'tan',
  bell_pepper: 'red',
  bell_pepper_red: 'red',
  bell_pepper_yellow: 'yellow',
  bell_pepper_green: 'green',
  jalapeño: 'green',
  cayenne: 'red',
  tomato: 'red',
}

// ── API ──────────────────────────────────────────────────────

export function getBedForProduce(produceId) {
  const pid = (produceId || '').toLowerCase()
  return PRODUCE_TO_BED[pid] || null
}

export function getColorForProduce(produceId) {
  const pid = (produceId || '').toLowerCase()
  return PRODUCE_TO_COLOR[pid] || null
}

export function getBedMetadata(bedKey) {
  return BED_METADATA[bedKey] || null
}

export function getColorMetadata(colorKey) {
  return COLOR_METADATA[colorKey] || null
}

export function getAllBedKeys() {
  return [...GARDEN_BEDS]
}

export function getAllColorKeys() {
  return [...GARDEN_COLORS]
}
