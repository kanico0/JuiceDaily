// ─────────────────────────────────────────────────────────────
// NutrientPillars.js — Nutrient Halo scoring layer
// Maps juice logs (ingredients) → nutrient pillar hits.
// Derives daily, weekly, and monthly pillar data from
// existing ChallengeStore log storage. Works offline.
// ─────────────────────────────────────────────────────────────

import { PRODUCE_DATA } from './JuiceEngine'

// ── Nutrient Pillar Definitions ─────────────────────────────
// 8 pillars covering the key nutrient families in juicing.
// Each pillar has a threshold: minimum mg/mcg per juice to
// count as a "hit" for that pillar.

export const NUTRIENT_PILLARS = {
  hydration: {
    key: 'hydration',
    label: 'Hydration',
    shortLabel: 'Hydra',
    color: '#64B5F6',
    icon: 'Droplets',
    description: 'High-water-content produce that supports cellular hydration.',
    nutrientKey: null,
    produceIds: ['cucumber', 'celery', 'watermelon', 'melon', 'coconut_water', 'zucchini', 'romaine', 'bok_choy', 'aloe_vera'],
    threshold: 100, // grams of qualifying produce
  },
  vitaminC: {
    key: 'vitaminC',
    label: 'Vitamin C',
    shortLabel: 'Vit C',
    color: '#FFD54F',
    icon: 'Sun',
    description: 'Antioxidant vitamin supporting immune function and collagen synthesis.',
    nutrientKey: 'vitCMgPer100g',
    produceIds: null,
    threshold: 20, // mg in final juice
  },
  vitaminA: {
    key: 'vitaminA',
    label: 'Vitamin A',
    shortLabel: 'Vit A',
    color: '#FF8A65',
    icon: 'Eye',
    description: 'Fat-soluble vitamin important for vision and skin health.',
    nutrientKey: 'vitAMcgPer100g',
    produceIds: null,
    threshold: 100, // mcg in final juice
  },
  iron: {
    key: 'iron',
    label: 'Iron',
    shortLabel: 'Iron',
    color: '#E57373',
    icon: 'Shield',
    description: 'Essential mineral for oxygen transport and energy metabolism.',
    nutrientKey: 'ironMgPer100g',
    produceIds: null,
    threshold: 1.0, // mg in final juice
  },
  potassium: {
    key: 'potassium',
    label: 'Potassium',
    shortLabel: 'K+',
    color: '#81C784',
    icon: 'Heart',
    description: 'Electrolyte supporting heart rhythm and muscle function.',
    nutrientKey: 'potassiumMgPer100g',
    produceIds: null,
    threshold: 200, // mg in final juice
  },
  magnesium: {
    key: 'magnesium',
    label: 'Magnesium',
    shortLabel: 'Mg',
    color: '#9575CD',
    icon: 'Moon',
    description: 'Mineral involved in 300+ enzymatic reactions including energy production.',
    nutrientKey: 'magnesiumMgPer100g',
    produceIds: null,
    threshold: 15, // mg in final juice
  },
  folate: {
    key: 'folate',
    label: 'Folate',
    shortLabel: 'Folate',
    color: '#4DD0E1',
    icon: 'Leaf',
    description: 'B-vitamin essential for DNA synthesis and cell division.',
    nutrientKey: 'folateMcgPer100g',
    produceIds: null,
    threshold: 30, // mcg in final juice
  },
  antiInflammatory: {
    key: 'antiInflammatory',
    label: 'Anti-Inflam',
    shortLabel: 'Anti-I',
    color: '#FFB74D',
    icon: 'Flame',
    description: 'Ingredients with known anti-inflammatory compounds (gingerols, curcumin, etc.).',
    nutrientKey: null,
    produceIds: ['ginger', 'turmeric', 'garlic', 'cayenne', 'pineapple', 'beet', 'celery', 'blueberry', 'cherry'],
    threshold: 15, // grams of qualifying produce
  },
}

export const PILLAR_KEYS = Object.keys(NUTRIENT_PILLARS)
export const PILLAR_COUNT = PILLAR_KEYS.length

// ── Score a single juice log → pillar hits ──────────────────
// Takes an array of { produceId, weightG } and returns which
// pillars are "hit" (met threshold).

export function scoreJuicePillars(ingredients) {
  if (!ingredients || ingredients.length === 0) return {}

  const hits = {}
  const nutrientTotals = {
    vitCMgPer100g: 0,
    vitAMcgPer100g: 0,
    ironMgPer100g: 0,
    potassiumMgPer100g: 0,
    magnesiumMgPer100g: 0,
    folateMcgPer100g: 0,
  }
  const produceWeights = {}

  for (const ing of ingredients) {
    const entry = PRODUCE_DATA[ing.produceId]
    if (!entry) continue
    const wG = ing.weightG || 150
    const yieldFraction = entry.nutrition.yieldPercent || 0.75

    // Accumulate nutrient totals (juice yield applied)
    const juiceG = wG * yieldFraction
    for (const nKey of Object.keys(nutrientTotals)) {
      const per100 = entry.nutrition[nKey] || 0
      nutrientTotals[nKey] += (per100 * juiceG) / 100
    }

    // Track produce weights for produce-based pillars
    produceWeights[ing.produceId] = (produceWeights[ing.produceId] || 0) + wG
  }

  // Evaluate each pillar
  for (const [key, pillar] of Object.entries(NUTRIENT_PILLARS)) {
    if (pillar.produceIds) {
      // Produce-based pillar: sum weights of qualifying produce
      let qualifyingWeight = 0
      for (const pid of pillar.produceIds) {
        qualifyingWeight += produceWeights[pid] || 0
      }
      hits[key] = qualifyingWeight >= pillar.threshold
    } else if (pillar.nutrientKey) {
      // Nutrient-based pillar: check accumulated total
      hits[key] = (nutrientTotals[pillar.nutrientKey] || 0) >= pillar.threshold
    }
  }

  return hits
}

// ── Score a full day's juice logs → pillar hits ─────────────
// Takes a dayLog object { juices: [{ ingredients: [...] }] }

export function scoreDayPillars(dayLog) {
  if (!dayLog || !dayLog.juices || dayLog.juices.length === 0) {
    return emptyPillarHits()
  }

  // Combine all ingredients across all juices for the day
  const allIngredients = []
  for (const juice of dayLog.juices) {
    if (juice.ingredients) {
      allIngredients.push(...juice.ingredients)
    }
  }

  return scoreJuicePillars(allIngredients)
}

// ── Compute daily pillar hits for current challenge ─────────
// Returns { [dateKey]: { hydration: bool, vitaminC: bool, ... } }

export function computeDailyPillarHits(challengeDays) {
  const result = {}
  for (const [dateKey, dayLog] of Object.entries(challengeDays || {})) {
    result[dateKey] = scoreDayPillars(dayLog)
  }
  return result
}

// ── Compute weekly pillar counts ────────────────────────────
// Returns { hydration: 3, vitaminC: 5, ... } — count of days
// each pillar was hit in the current week.

export function computeWeeklyPillarCounts(challengeDays, weekStartKey, todayKey) {
  const counts = {}
  for (const key of PILLAR_KEYS) counts[key] = 0

  for (const [dateKey, dayLog] of Object.entries(challengeDays || {})) {
    if (dateKey < weekStartKey || dateKey > todayKey) continue
    const hits = scoreDayPillars(dayLog)
    for (const key of PILLAR_KEYS) {
      if (hits[key]) counts[key]++
    }
  }

  return counts
}

// ── Compute monthly dominant pillar ─────────────────────────
// Returns the pillar key that was hit most frequently in a
// given month. Used for monthly heatmap coloring.

export function computeMonthlyDominantPillar(challengeDays, year, month) {
  const counts = {}
  for (const key of PILLAR_KEYS) counts[key] = 0

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  for (const [dateKey, dayLog] of Object.entries(challengeDays || {})) {
    if (!dateKey.startsWith(monthStr)) continue
    const hits = scoreDayPillars(dayLog)
    for (const key of PILLAR_KEYS) {
      if (hits[key]) counts[key]++
    }
  }

  let dominant = null
  let maxCount = 0
  for (const [key, count] of Object.entries(counts)) {
    if (count > maxCount) {
      dominant = key
      maxCount = count
    }
  }

  return { dominant, counts }
}

// ── Compute day dominant pillar ─────────────────────────────
// Returns the single most prominent pillar for a given day.
// Used for monthly heatmap cell coloring.

export function computeDayDominantPillar(dayLog) {
  const hits = scoreDayPillars(dayLog)
  const hitKeys = PILLAR_KEYS.filter((k) => hits[k])
  if (hitKeys.length === 0) return null

  // If multiple pillars hit, pick the one with highest nutrient
  // contribution. For simplicity, return the first hit in order.
  return hitKeys[0]
}

// ── Count filled pillars for a day ──────────────────────────

export function countFilledPillars(dayLog) {
  const hits = scoreDayPillars(dayLog)
  return PILLAR_KEYS.filter((k) => hits[k]).length
}

// ── Empty pillar hits object ────────────────────────────────

export function emptyPillarHits() {
  const hits = {}
  for (const key of PILLAR_KEYS) hits[key] = false
  return hits
}

// ── Get week start key (Monday) ─────────────────────────────

export function getWeekStartKey(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// ── Get today key ───────────────────────────────────────────

export function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}
