// ─────────────────────────────────────────────────────────────
// JuiceCalculatorEngine.js — Offline nutrient-goal calculator
// Given nutrient targets + preferences, recommends produce
// combinations and amounts to meet goals.
// Uses existing USDA data from JuiceEngine.ts (PRODUCE_DATA).
// Gated behind ff_juice_calculator feature flag.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { PRODUCE_DATA } from './JuiceEngine'

const CACHE_KEY = '@juicing_calculator_cache_v1'

// ── Nutrient Catalog ─────────────────────────────────────────
// Maps nutrient IDs to their keys in PRODUCE_DATA, display info,
// and recommended daily values (RDA/DV for adults).

export const NUTRIENT_CATALOG = [
  { id: 'vitC',      key: 'vitCMgPer100g',       label: 'Vitamin C',  unit: 'mg',  dv: 90,   sliderMax: 200 },
  { id: 'vitA',      key: 'vitAMcgPer100g',      label: 'Vitamin A',  unit: 'mcg', dv: 900,  sliderMax: 2000 },
  { id: 'potassium', key: 'potassiumMgPer100g',   label: 'Potassium',  unit: 'mg',  dv: 2600, sliderMax: 4700 },
  { id: 'iron',      key: 'ironMgPer100g',        label: 'Iron',       unit: 'mg',  dv: 18,   sliderMax: 40 },
  { id: 'magnesium', key: 'magnesiumMgPer100g',   label: 'Magnesium',  unit: 'mg',  dv: 420,  sliderMax: 800 },
  { id: 'folate',    key: 'folateMcgPer100g',     label: 'Folate',     unit: 'mcg', dv: 400,  sliderMax: 800 },
  { id: 'calories',  key: 'caloriesPer100g',      label: 'Calories',   unit: 'kcal', dv: null, sliderMax: 500 },
  { id: 'sugar',     key: 'sugarGPer100g',        label: 'Sugar',      unit: 'g',   dv: null, sliderMax: 50 },
]

export const NUTRIENT_MAP = Object.fromEntries(
  NUTRIENT_CATALOG.map((n) => [n.id, n])
)

// ── Preset Targets ───────────────────────────────────────────

export const TARGET_PRESETS = {
  low:      0.5,
  standard: 1.0,
  high:     1.5,
}

// ── Yield Factors ────────────────────────────────────────────
// Grams of juice per gram of raw produce. Uses yieldPercent
// from PRODUCE_DATA directly. Juice density ≈ 1.04 g/ml.

const JUICE_DENSITY_G_PER_ML = 1.04
const ML_PER_OZ = 29.5735

export function gramsToOz(juiceGrams) {
  return juiceGrams / JUICE_DENSITY_G_PER_ML / ML_PER_OZ
}

export function ozToJuiceGrams(oz) {
  return oz * ML_PER_OZ * JUICE_DENSITY_G_PER_ML
}

// ── Produce List (pre-computed for perf) ─────────────────────

function getProduceList() {
  return Object.entries(PRODUCE_DATA).map(([id, entry]) => ({
    id,
    name: entry.name,
    category: entry.category,
    nutrition: entry.nutrition,
  }))
}

// ── Nutrient yield per 100g of juice ─────────────────────────
// Accounts for juice yield + cold-pressed retention factors.

function nutrientPer100gJuice(entry, nutrientKey) {
  const n = entry.nutrition
  const yld = n.yieldPercent || 0.75
  // For 100g raw produce → yld*100g juice
  // Nutrient in that juice = (nutrientPer100gRaw * 100/100) * retention
  // Per 100g juice = nutrientPer100gRaw * retention / yld
  let retention = 1.0
  if (nutrientKey === 'vitCMgPer100g') retention = n.retentionVitC || 0.9
  else if (nutrientKey === 'vitAMcgPer100g') retention = n.retentionVitA || 0.98
  const rawPer100g = n[nutrientKey] || 0
  return (rawPer100g * retention) / yld
}

// ── Single-Produce Scoring ───────────────────────────────────
// For each produce, compute how much raw produce (grams) is
// needed to meet targets, and score by coverage vs volume.

function scoreSingleProduce(produce, targets, maxJuiceOz) {
  const maxJuiceG = ozToJuiceGrams(maxJuiceOz)
  const yld = produce.nutrition.yieldPercent || 0.75

  // For each target nutrient, compute grams of raw produce needed
  let maxRawNeeded = 0
  const coverageDetails = []

  for (const t of targets) {
    const nutPer100gJuice = nutrientPer100gJuice(produce, t.nutrientKey)
    if (nutPer100gJuice <= 0) {
      coverageDetails.push({
        nutrientId: t.nutrientId,
        target: t.target,
        achieved: 0,
        pct: 0,
      })
      continue
    }

    // Grams of juice needed to meet this target
    const juiceGNeeded = (t.target / nutPer100gJuice) * 100
    const rawGNeeded = juiceGNeeded / yld

    // Cap at max volume
    const cappedJuiceG = Math.min(juiceGNeeded, maxJuiceG)
    const cappedRawG = cappedJuiceG / yld
    const achieved = (cappedJuiceG / 100) * nutPer100gJuice
    const pct = Math.min((achieved / t.target) * 100, 100)

    coverageDetails.push({
      nutrientId: t.nutrientId,
      target: t.target,
      achieved: Math.round(achieved * 100) / 100,
      pct: Math.round(pct * 10) / 10,
    })

    maxRawNeeded = Math.max(maxRawNeeded, rawGNeeded)
  }

  // Use the max raw grams needed (capped by volume)
  const cappedRawG = Math.min(maxRawNeeded, maxJuiceG / yld)
  const juiceG = cappedRawG * yld
  const juiceOz = gramsToOz(juiceG)

  // Recompute actual coverage at capped amount
  const finalCoverage = targets.map((t) => {
    const nutPer100gJ = nutrientPer100gJuice(produce, t.nutrientKey)
    const achieved = (juiceG / 100) * nutPer100gJ
    const pct = t.target > 0 ? Math.min((achieved / t.target) * 100, 100) : 100
    return {
      nutrientId: t.nutrientId,
      target: t.target,
      achieved: Math.round(achieved * 100) / 100,
      pct: Math.round(pct * 10) / 10,
    }
  })

  // Score: average coverage % with penalty for overshoot volume
  const avgCoverage = finalCoverage.reduce((s, c) => s + c.pct, 0) / (finalCoverage.length || 1)
  const volumePenalty = juiceOz > maxJuiceOz ? (juiceOz - maxJuiceOz) * 2 : 0
  const score = Math.max(0, avgCoverage - volumePenalty)

  return {
    produceId: produce.id,
    produceName: produce.name,
    category: produce.category,
    rawGrams: Math.round(cappedRawG),
    juiceOz: Math.round(juiceOz * 10) / 10,
    juiceGrams: Math.round(juiceG),
    coverage: finalCoverage,
    avgCoverage: Math.round(avgCoverage * 10) / 10,
    score: Math.round(score * 10) / 10,
  }
}

// ── Multi-Produce Greedy Selection ───────────────────────────
// Iteratively pick produce that best improves deficit.

function greedyMultiProduce(allProduce, targets, maxJuiceOz, excludeIds, maxItems = 5) {
  const maxJuiceG = ozToJuiceGrams(maxJuiceOz)
  const remaining = targets.map((t) => ({ ...t, deficit: t.target }))
  const selected = []
  let usedJuiceG = 0
  const excludeSet = new Set(excludeIds)
  // Track used produce names to avoid duplicates (e.g. apple vs apple_green)
  const usedNames = new Set()

  for (let iter = 0; iter < maxItems; iter++) {
    const budgetG = maxJuiceG - usedJuiceG
    if (budgetG <= 10) break

    // Check if all targets are met (within 5% tolerance)
    const allMet = remaining.every((r) => r.deficit <= r.target * 0.05)
    if (allMet) break

    let bestCandidate = null
    let bestImprovement = -1

    for (const produce of allProduce) {
      if (excludeSet.has(produce.id)) continue
      if (usedNames.has(produce.name)) continue

      const yld = produce.nutrition.yieldPercent || 0.75

      // For each deficit nutrient, compute how much this produce helps
      let totalImprovement = 0
      let rawGForBest = 0

      for (const r of remaining) {
        if (r.deficit <= 0) continue
        const nutPer100gJ = nutrientPer100gJuice(produce, r.nutrientKey)
        if (nutPer100gJ <= 0) continue

        // How much juice to fill this deficit
        const juiceGNeeded = (r.deficit / nutPer100gJ) * 100
        const cappedJuiceG = Math.min(juiceGNeeded, budgetG)
        const achieved = (cappedJuiceG / 100) * nutPer100gJ
        const improvement = Math.min(achieved, r.deficit) / r.target
        totalImprovement += improvement
        rawGForBest = Math.max(rawGForBest, cappedJuiceG / yld)
      }

      if (totalImprovement > bestImprovement) {
        bestImprovement = totalImprovement
        bestCandidate = { produce, rawG: rawGForBest }
      }
    }

    if (!bestCandidate || bestImprovement <= 0) break

    const { produce, rawG } = bestCandidate
    const yld = produce.nutrition.yieldPercent || 0.75

    // Determine optimal raw grams: enough to cover the biggest deficit
    // but capped by remaining budget
    const juiceG = Math.min(rawG * yld, budgetG)
    const finalRawG = juiceG / yld

    // Update deficits
    for (const r of remaining) {
      const nutPer100gJ = nutrientPer100gJuice(produce, r.nutrientKey)
      const achieved = (juiceG / 100) * nutPer100gJ
      r.deficit = Math.max(0, r.deficit - achieved)
    }

    selected.push({
      produceId: produce.id,
      produceName: produce.name,
      category: produce.category,
      rawGrams: Math.round(finalRawG),
      juiceGrams: Math.round(juiceG),
      juiceOz: Math.round(gramsToOz(juiceG) * 10) / 10,
    })

    usedJuiceG += juiceG
    usedNames.add(produce.name)
  }

  // Compute final coverage
  const coverage = targets.map((t) => {
    let achieved = 0
    for (const sel of selected) {
      const produce = allProduce.find((p) => p.id === sel.produceId)
      if (!produce) continue
      const nutPer100gJ = nutrientPer100gJuice(produce, t.nutrientKey)
      achieved += (sel.juiceGrams / 100) * nutPer100gJ
    }
    const pct = t.target > 0 ? Math.min((achieved / t.target) * 100, 100) : 100
    return {
      nutrientId: t.nutrientId,
      target: t.target,
      achieved: Math.round(achieved * 100) / 100,
      pct: Math.round(pct * 10) / 10,
    }
  })

  const avgCoverage = coverage.reduce((s, c) => s + c.pct, 0) / (coverage.length || 1)
  const totalJuiceOz = selected.reduce((s, sel) => s + sel.juiceOz, 0)

  return {
    items: selected,
    coverage,
    avgCoverage: Math.round(avgCoverage * 10) / 10,
    totalJuiceOz: Math.round(totalJuiceOz * 10) / 10,
  }
}

// ── Build explanation text ───────────────────────────────────

function buildExplanation(result, targets, maxJuiceOz) {
  const topNutrients = targets
    .map((t) => NUTRIENT_MAP[t.nutrientId]?.label || t.nutrientId)
    .slice(0, 3)
    .join(' + ')

  if (result.items) {
    // Multi-produce
    const names = result.items.map((i) => i.produceName).join(', ')
    const parts = [`This mix of ${names} is the closest match`]
    if (topNutrients) parts[0] += ` for ${topNutrients}`
    if (result.totalJuiceOz <= maxJuiceOz) {
      parts.push(`staying within ${maxJuiceOz} oz.`)
    } else {
      parts.push(`at ${result.totalJuiceOz} oz total.`)
    }
    return parts.join(', ')
  }

  // Single produce
  const parts = [`${result.produceName} is the best single-produce match`]
  if (topNutrients) parts[0] += ` for ${topNutrients}`
  parts.push(`at ${result.juiceOz} oz.`)
  return parts.join(', ')
}

// ── Main Calculator Function ─────────────────────────────────

export function runCalculator({
  selectedNutrients,
  timeframe = 'day',
  allowMulti = true,
  excludeIds = [],
  maxJuiceOz = 24,
  maxItems = 5,
}) {
  const allProduce = getProduceList()
  const filtered = allProduce.filter((p) => !new Set(excludeIds).has(p.id))

  // Build target vector
  const targets = selectedNutrients.map((sn) => ({
    nutrientId: sn.nutrientId,
    nutrientKey: NUTRIENT_MAP[sn.nutrientId]?.key,
    target: timeframe === 'week' ? sn.target / 7 : sn.target,
  })).filter((t) => t.nutrientKey && t.target > 0)

  if (targets.length === 0) {
    return { singleResults: [], multiResults: [], warnings: ['No valid nutrient targets selected.'] }
  }

  const warnings = []

  // Check for extreme targets
  for (const t of targets) {
    const meta = NUTRIENT_MAP[t.nutrientId]
    if (meta?.dv && t.target > meta.dv * 3) {
      warnings.push(
        `Your ${meta.label} target (${t.target} ${meta.unit}/day) is over 3× the daily value. ` +
        `This is informational only — consult a healthcare provider for personalized advice.`
      )
    }
  }

  // Single-produce scoring
  const singleScores = filtered.map((p) => scoreSingleProduce(p, targets, maxJuiceOz))
  singleScores.sort((a, b) => b.score - a.score)
  const singleResults = singleScores.slice(0, 5).map((r) => ({
    ...r,
    explanation: buildExplanation(r, targets, maxJuiceOz),
    resultType: 'single',
  }))

  // Multi-produce scoring (3 variations with different starting seeds)
  const multiResults = []
  if (allowMulti) {
    // Variation 1: default greedy
    const mix1 = greedyMultiProduce(filtered, targets, maxJuiceOz, excludeIds, maxItems)
    mix1.explanation = buildExplanation(mix1, targets, maxJuiceOz)
    mix1.resultType = 'multi'
    multiResults.push(mix1)

    // Variation 2: exclude top pick from mix1, re-run
    if (mix1.items.length > 0) {
      const exclude2 = [...excludeIds, mix1.items[0].produceId]
      const mix2 = greedyMultiProduce(filtered, targets, maxJuiceOz, exclude2, maxItems)
      mix2.explanation = buildExplanation(mix2, targets, maxJuiceOz)
      mix2.resultType = 'multi'
      if (mix2.items.length > 0) multiResults.push(mix2)
    }

    // Variation 3: exclude top 2 picks from mix1
    if (mix1.items.length > 1) {
      const exclude3 = [...excludeIds, mix1.items[0].produceId, mix1.items[1].produceId]
      const mix3 = greedyMultiProduce(filtered, targets, maxJuiceOz, exclude3, maxItems)
      mix3.explanation = buildExplanation(mix3, targets, maxJuiceOz)
      mix3.resultType = 'multi'
      if (mix3.items.length > 0) multiResults.push(mix3)
    }

    multiResults.sort((a, b) => b.avgCoverage - a.avgCoverage)
  }

  // Volume warning
  const bestSingle = singleResults[0]
  if (bestSingle && bestSingle.juiceOz > maxJuiceOz) {
    warnings.push(
      `Even the best single produce requires ${bestSingle.juiceOz} oz, exceeding your ${maxJuiceOz} oz limit. ` +
      `Consider a multi-produce mix or adjusting targets.`
    )
  }

  return { singleResults, multiResults, warnings }
}

// ── Cache Last Run ───────────────────────────────────────────

export async function cacheCalculatorRun(inputs, results) {
  try {
    const payload = {
      inputs,
      results: {
        singleCount: results.singleResults?.length || 0,
        multiCount: results.multiResults?.length || 0,
        warnings: results.warnings,
      },
      cachedAt: new Date().toISOString(),
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch (e) {
    // Non-fatal
  }
}

export async function getCachedCalculatorRun() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}
