// ─────────────────────────────────────────────────────────────
// gardenService.js — Derived Garden progress model.
//
// Derives discovery state from existing JuiceLogStore entries.
// Does NOT duplicate logging logic or modify entries.
//
// Responsibilities:
//   - Normalize produce IDs to canonical keys
//   - Compute discovered produce set, per-bed counts, per-color sets
//   - Compute bed growth stages (Empty → Flourishing)
//   - Compute color coverage and Rainbow Harvest eligibility
//   - Baseline protection (same pattern as glowJourneyService)
//   - Celebration persistence (discovered produce, bed milestones, colors)
//
// All functions are pure where possible; persistence uses AsyncStorage
// directly, matching the glowJourneyService pattern.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getCanonicalProduceKey } from './produceFamilies'
import { PRODUCE_DATA } from './JuiceEngine'
import {
  GARDEN_BEDS,
  GARDEN_COLORS,
  getBedForProduce,
  getColorForProduce,
} from '../constants/gardenTaxonomy'

// ── Storage keys ─────────────────────────────────────────────
const KEY_DISCOVERED = 'garden_discoveredProduce'
const KEY_CELEBRATED_BEDS = 'garden_celebratedBeds'
const KEY_CELEBRATED_COLORS = 'garden_celebratedColors'
const KEY_CELEBRATED_RAINBOW = 'garden_celebratedRainbow'
const KEY_BASELINE_INITIALIZED = 'garden_baselineInitialized'

// ── Growth stages ────────────────────────────────────────────
export const GARDEN_STAGES = [
  { key: 'empty', label: 'Empty', threshold: 0 },
  { key: 'seed', label: 'Seed', threshold: 1 },
  { key: 'sprout', label: 'Sprout', threshold: 2 },
  { key: 'growing', label: 'Growing', threshold: 3 },
  { key: 'harvesting', label: 'Harvesting', threshold: 5 },
  { key: 'flourishing', label: 'Flourishing', threshold: 7 },
]

export const STAGE_EMPTY = 'empty'
export const STAGE_SEED = 'seed'
export const STAGE_SPROUT = 'sprout'
export const STAGE_GROWING = 'growing'
export const STAGE_HARVESTING = 'harvesting'
export const STAGE_FLOURISHING = 'flourishing'

// ── Normalization ────────────────────────────────────────────

export function normalizeProduceId(produceId) {
  if (!produceId || typeof produceId !== 'string') return null
  const pid = produceId.toLowerCase()
  const canonical = getCanonicalProduceKey(pid)
  if (canonical) return canonical
  if (PRODUCE_DATA[pid]) return pid
  return null
}

export function normalizeProduceIds(produceIds) {
  if (!Array.isArray(produceIds)) return []
  const seen = new Set()
  const result = []
  for (const pid of produceIds) {
    const normalized = normalizeProduceId(pid)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }
  return result
}

// ── Discovery set ────────────────────────────────────────────

export function getDiscoveredProduce(entries) {
  if (!Array.isArray(entries)) return []
  const seen = new Set()
  for (const entry of entries) {
    if (!entry || !Array.isArray(entry.ingredients)) continue
    for (const pid of entry.ingredients) {
      const normalized = normalizeProduceId(pid)
      if (normalized) seen.add(normalized)
    }
  }
  return [...seen]
}

export function getDiscoveredProduceSet(entries) {
  return new Set(getDiscoveredProduce(entries))
}

// ── Per-bed counts and stages ────────────────────────────────

export function getProduceByBed(entries) {
  const discovered = getDiscoveredProduce(entries)
  const byBed = {}
  for (const bed of GARDEN_BEDS) {
    byBed[bed] = []
  }
  for (const pid of discovered) {
    const bed = getBedForProduce(pid)
    if (bed && byBed[bed]) {
      byBed[bed].push(pid)
    }
  }
  return byBed
}

export function getBedCounts(entries) {
  const byBed = getProduceByBed(entries)
  const counts = {}
  for (const bed of GARDEN_BEDS) {
    counts[bed] = byBed[bed].length
  }
  return counts
}

export function getBedStage(count) {
  if (count <= 0) return GARDEN_STAGES[0]
  let stage = GARDEN_STAGES[0]
  for (const s of GARDEN_STAGES) {
    if (count >= s.threshold) stage = s
  }
  return stage
}

export function getBedStages(entries) {
  const counts = getBedCounts(entries)
  const stages = {}
  for (const bed of GARDEN_BEDS) {
    stages[bed] = getBedStage(counts[bed])
  }
  return stages
}

export function getBedStageKey(bedKey, entries) {
  const stages = getBedStages(entries)
  return stages[bedKey] ? stages[bedKey].key : STAGE_EMPTY
}

// ── Per-color coverage ───────────────────────────────────────

export function getDiscoveredColors(entries) {
  const discovered = getDiscoveredProduce(entries)
  const colors = new Set()
  for (const pid of discovered) {
    const color = getColorForProduce(pid)
    if (color) colors.add(color)
  }
  return [...colors]
}

export function getColorCoverage(entries) {
  const discovered = getDiscoveredProduce(entries)
  const byColor = {}
  for (const color of GARDEN_COLORS) {
    byColor[color] = []
  }
  for (const pid of discovered) {
    const color = getColorForProduce(pid)
    if (color && byColor[color]) {
      byColor[color].push(pid)
    }
  }
  return byColor
}

export function getColorCounts(entries) {
  const coverage = getColorCoverage(entries)
  const counts = {}
  for (const color of GARDEN_COLORS) {
    counts[color] = coverage[color].length
  }
  return counts
}

// ── Rainbow Harvest ──────────────────────────────────────────

export function isRainbowHarvestComplete(entries) {
  const discovered = getDiscoveredColors(entries)
  return GARDEN_COLORS.every((c) => discovered.includes(c))
}

// ── Summary ──────────────────────────────────────────────────

export function getGardenSummary(entries) {
  const discovered = getDiscoveredProduce(entries)
  const bedStages = getBedStages(entries)
  const discoveredColors = getDiscoveredColors(entries)
  const bedCounts = getBedCounts(entries)
  const colorCounts = getColorCounts(entries)
  const rainbowComplete = isRainbowHarvestComplete(entries)

  const bedsStarted = GARDEN_BEDS.filter(
    (bed) => bedCounts[bed] > 0
  ).length

  return {
    discoveredProduce: discovered,
    discoveredCount: discovered.length,
    bedStages,
    bedCounts,
    discoveredColors,
    discoveredColorCount: discoveredColors.length,
    colorCounts,
    rainbowComplete,
    bedsStarted,
    totalBeds: GARDEN_BEDS.length,
    totalColors: GARDEN_COLORS.length,
  }
}

// ── Next-discovery hint ──────────────────────────────────────

export function getNextDiscoveryHint(entries) {
  const summary = getGardenSummary(entries)
  const bedStages = summary.bedStages
  const bedCounts = summary.bedCounts

  // Find the bed with the lowest count that isn't empty,
  // or the first empty bed if all are empty
  let candidate = null
  let lowestCount = Infinity

  for (const bed of GARDEN_BEDS) {
    const count = bedCounts[bed]
    if (count < lowestCount) {
      lowestCount = count
      candidate = bed
    }
  }

  if (!candidate) return null

  const stage = bedStages[candidate]

  if (lowestCount === 0) {
    return {
      bedKey: candidate,
      stageKey: stage.key,
      count: 0,
      message: 'Try something new to start a new area',
    }
  }

  const nextStageIdx = GARDEN_STAGES.findIndex((s) => s.key === stage.key) + 1
  const nextStage = nextStageIdx < GARDEN_STAGES.length ? GARDEN_STAGES[nextStageIdx] : null

  if (nextStage) {
    const remaining = nextStage.threshold - lowestCount
    return {
      bedKey: candidate,
      stageKey: stage.key,
      nextStageKey: nextStage.key,
      count: lowestCount,
      remaining,
      message: remaining === 1
        ? 'One more discovery to grow this area'
        : `${remaining} more discoveries to grow this area`,
    }
  }

  return {
    bedKey: candidate,
    stageKey: stage.key,
    count: lowestCount,
    message: 'This area is flourishing',
  }
}

// ── New-discovery detection ──────────────────────────────────

export function detectNewDiscoveries(prevEntries, currentEntries) {
  const prevSet = getDiscoveredProduceSet(prevEntries)
  const currentDiscovered = getDiscoveredProduce(currentEntries)
  const newProduce = currentDiscovered.filter((pid) => !prevSet.has(pid))

  const prevColors = new Set(getDiscoveredColors(prevEntries))
  const currentColors = getDiscoveredColors(currentEntries)
  const newColors = currentColors.filter((c) => !prevColors.has(c))

  return { newProduce, newColors }
}

// ── Bed milestone detection ──────────────────────────────────

export function detectBedMilestones(prevEntries, currentEntries) {
  const prevStages = getBedStages(prevEntries)
  const currentStages = getBedStages(currentEntries)
  const milestones = []

  for (const bed of GARDEN_BEDS) {
    const prevKey = prevStages[bed] ? prevStages[bed].key : STAGE_EMPTY
    const currKey = currentStages[bed] ? currentStages[bed].key : STAGE_EMPTY
    if (prevKey !== currKey && currKey !== STAGE_EMPTY) {
      milestones.push({
        bedKey: bed,
        fromStage: prevKey,
        toStage: currKey,
        stage: currentStages[bed],
      })
    }
  }

  return milestones
}

// ── Rainbow Harvest detection ────────────────────────────────

export function detectRainbowHarvest(prevEntries, currentEntries) {
  const wasComplete = isRainbowHarvestComplete(prevEntries)
  const isComplete = isRainbowHarvestComplete(currentEntries)
  return !wasComplete && isComplete
}

// ── Celebration persistence ──────────────────────────────────

export async function getDiscoveredProducePersisted() {
  try {
    const raw = await AsyncStorage.getItem(KEY_DISCOVERED)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getCelebratedBeds() {
  try {
    const raw = await AsyncStorage.getItem(KEY_CELEBRATED_BEDS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getCelebratedColors() {
  try {
    const raw = await AsyncStorage.getItem(KEY_CELEBRATED_COLORS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function isRainbowCelebrated() {
  try {
    return (await AsyncStorage.getItem(KEY_CELEBRATED_RAINBOW)) === 'true'
  } catch {
    return false
  }
}

export async function markBedCelebrated(bedKey, stageKey) {
  const celebrated = await getCelebratedBeds()
  const entry = `${bedKey}:${stageKey}`
  if (!celebrated.includes(entry)) {
    celebrated.push(entry)
    await AsyncStorage.setItem(KEY_CELEBRATED_BEDS, JSON.stringify(celebrated))
  }
}

export async function markColorCelebrated(colorKey) {
  const celebrated = await getCelebratedColors()
  if (!celebrated.includes(colorKey)) {
    celebrated.push(colorKey)
    await AsyncStorage.setItem(KEY_CELEBRATED_COLORS, JSON.stringify(celebrated))
  }
}

export async function markRainbowCelebrated() {
  await AsyncStorage.setItem(KEY_CELEBRATED_RAINBOW, 'true')
}

export async function shouldCelebrateBed(bedKey, stageKey) {
  const celebrated = await getCelebratedBeds()
  const entry = `${bedKey}:${stageKey}`
  if (celebrated.includes(entry)) return false
  const initialized = await isBaselineInitialized()
  if (!initialized) return false
  return true
}

export async function shouldCelebrateColor(colorKey) {
  const celebrated = await getCelebratedColors()
  if (celebrated.includes(colorKey)) return false
  const initialized = await isBaselineInitialized()
  if (!initialized) return false
  return true
}

export async function shouldCelebrateRainbow() {
  if (await isRainbowCelebrated()) return false
  const initialized = await isBaselineInitialized()
  if (!initialized) return false
  return true
}

// ── Baseline initialization ──────────────────────────────────

export async function isBaselineInitialized() {
  try {
    return (await AsyncStorage.getItem(KEY_BASELINE_INITIALIZED)) === 'true'
  } catch {
    return false
  }
}

export async function initializeGardenBaseline(entries) {
  const already = await isBaselineInitialized()
  if (already) return false

  // Mark all current bed stages as celebrated
  const stages = getBedStages(entries)
  const celebratedBeds = []
  for (const bed of GARDEN_BEDS) {
    const stage = stages[bed]
    if (stage && stage.key !== STAGE_EMPTY) {
      celebratedBeds.push(`${bed}:${stage.key}`)
    }
  }
  if (celebratedBeds.length > 0) {
    await AsyncStorage.setItem(KEY_CELEBRATED_BEDS, JSON.stringify(celebratedBeds))
  }

  // Mark all current colors as celebrated
  const discoveredColors = getDiscoveredColors(entries)
  if (discoveredColors.length > 0) {
    await AsyncStorage.setItem(KEY_CELEBRATED_COLORS, JSON.stringify(discoveredColors))
  }

  // Mark rainbow as celebrated if already complete
  if (isRainbowHarvestComplete(entries)) {
    await AsyncStorage.setItem(KEY_CELEBRATED_RAINBOW, 'true')
  }

  // Persist discovered produce set
  const discovered = getDiscoveredProduce(entries)
  if (discovered.length > 0) {
    await AsyncStorage.setItem(KEY_DISCOVERED, JSON.stringify(discovered))
  }

  await AsyncStorage.setItem(KEY_BASELINE_INITIALIZED, 'true')
  return true
}

// ── Dev reset ────────────────────────────────────────────────

export async function resetGardenCelebrations() {
  await AsyncStorage.multiRemove([
    KEY_DISCOVERED,
    KEY_CELEBRATED_BEDS,
    KEY_CELEBRATED_COLORS,
    KEY_CELEBRATED_RAINBOW,
    KEY_BASELINE_INITIALIZED,
  ])
}
