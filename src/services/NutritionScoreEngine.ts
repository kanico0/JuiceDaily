// ─────────────────────────────────────────────────────────────
// NutritionScoreEngine.ts — Pure scoring math for Nutrition
// Performance system. No React, no side effects.
//
// Two scores:
//   1) Nutrition Momentum (0–1000, resets every 30-day cycle)
//   2) Lifetime Nutrition Score (unlimited, accumulates cycles)
//
// Momentum is calculated from 4 weighted dimensions:
//   - Ingredient Diversity  (30%) — unique produce scanned
//   - Nutrient Coverage     (30%) — distinct nutrients discovered
//   - Consistency / Streak  (20%) — longest streak in cycle
//   - Weekly Activity       (20%) — rolling 7-day scan count
//
// All functions are pure. State shape defined via interfaces.
// ─────────────────────────────────────────────────────────────

// ── Interfaces ───────────────────────────────────────────────

/** Single juice log entry recorded per scan */
export interface NutritionLogEntry {
  id: string
  timestamp: string                 // ISO 8601
  ingredientIds: string[]           // produceId keys from PRODUCE_DATA
  nutrientsDiscovered: string[]     // nutrient keys with non-zero values
  totalNutrients: Record<string, number>  // e.g. { vitaminC: 12.5, iron: 0.8 }
}

/** A single 30-day scoring cycle */
export interface MomentumCycle {
  cycleId: string                   // e.g. "2026-01" (year-month of start)
  startDate: string                 // ISO date string (YYYY-MM-DD)
  endDate: string                   // ISO date string (YYYY-MM-DD)
  logs: NutritionLogEntry[]
  finalScore: number | null         // null while active, 0–1000 when finalized
}

/** Rolling 7-day activity window snapshot */
export interface WeeklyActivity {
  windowStart: string               // ISO date
  windowEnd: string                 // ISO date
  scanCount: number                 // total scans in window
  activeDays: number                // distinct days with ≥1 scan
}

/** Full score breakdown for transparency */
export interface ScoreBreakdown {
  ingredientDiversity: DimensionScore
  nutrientCoverage: DimensionScore
  consistency: DimensionScore
  weeklyActivity: DimensionScore
  totalMomentum: number             // 0–1000
}

/** Individual dimension score */
export interface DimensionScore {
  raw: number                       // raw metric value
  normalized: number                // 0–1 normalized score
  weighted: number                  // after weight applied (contribution to total)
  weight: number                    // weight factor (0.2–0.3)
  label: string                     // human-readable label
  maxPossible: number               // theoretical max for raw value
}

/** Top-level persisted state */
export interface NutritionScoreState {
  activeCycle: MomentumCycle
  completedCycles: MomentumCycle[]
  lifetimeScore: number             // sum of all finalized cycle scores
  allTimeUniqueIngredients: string[]
  allTimeNutrientsDiscovered: string[]
  longestEverStreak: number
  totalLifetimeScans: number
}

// ── Constants ────────────────────────────────────────────────

/** Scoring dimension weights — must sum to 1.0 */
export const DIMENSION_WEIGHTS = {
  ingredientDiversity: 0.30,
  nutrientCoverage: 0.30,
  consistency: 0.20,
  weeklyActivity: 0.20,
} as const

/** Maximum Momentum score per cycle */
export const MAX_MOMENTUM = 1000

/** Cycle length in days */
export const CYCLE_DAYS = 30

/**
 * All trackable nutrients from JuiceEngine.
 * A nutrient is "discovered" when a scan yields a non-zero value for it.
 */
export const ALL_NUTRIENTS = [
  'calories',
  'sugar',
  'vitaminC',
  'vitaminA',
  'potassium',
  'iron',
  'magnesium',
  'folate',
] as const

export type NutrientKey = typeof ALL_NUTRIENTS[number]

/**
 * Thresholds for normalizing raw metrics to 0–1.
 * These define "excellent" performance for each dimension.
 *
 * ingredientDiversity: 20 unique ingredients in a cycle = 1.0
 *   (PRODUCE_DATA has ~40+ items; 20 is ambitious but achievable)
 *
 * nutrientCoverage: all 8 nutrients discovered = 1.0
 *   (most juices hit 6–8 nutrients per scan, so coverage builds fast)
 *
 * consistency: 25 days with ≥1 scan out of 30 = 1.0
 *   (allows 5 rest days per cycle)
 *
 * weeklyActivity: 10 scans in rolling 7-day window = 1.0
 *   (roughly 1–2 scans per day)
 */
export const NORMALIZATION_CAPS = {
  ingredientDiversity: 20,
  nutrientCoverage: ALL_NUTRIENTS.length,  // 8
  consistency: 25,
  weeklyActivity: 10,
} as const

// ── Validation Helpers ───────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Validate an ISO date string (YYYY-MM-DD). Returns false for invalid dates. */
export function isValidISODate(date: string): boolean {
  if (!date || !ISO_DATE_RE.test(date)) return false
  const d = new Date(date)
  return !isNaN(d.getTime())
}

/** Safely parse a date string, returning today (local time) if invalid */
function safeDateOrToday(date: string | undefined | null): string {
  if (date && isValidISODate(date)) return date
  return getTodayISO()
}

/** Ensure a cycle object has valid shape (guards against corrupt storage) */
export function isValidCycle(cycle: unknown): cycle is MomentumCycle {
  if (!cycle || typeof cycle !== 'object') return false
  const c = cycle as Record<string, unknown>
  return (
    typeof c.cycleId === 'string' &&
    typeof c.startDate === 'string' &&
    typeof c.endDate === 'string' &&
    Array.isArray(c.logs)
  )
}

/** Ensure a log entry has valid shape */
export function isValidLogEntry(entry: unknown): entry is NutritionLogEntry {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    typeof e.timestamp === 'string' &&
    Array.isArray(e.ingredientIds) &&
    Array.isArray(e.nutrientsDiscovered)
  )
}

// ── Cycle Management ─────────────────────────────────────────

/** Get today as YYYY-MM-DD in local time (not UTC) */
export function getTodayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Compute end date from start date + CYCLE_DAYS */
export function computeCycleEndDate(startDate: string): string {
  const safe = safeDateOrToday(startDate)
  const [y, m, day] = safe.split('-').map(Number)
  const d = new Date(y, m - 1, day + CYCLE_DAYS - 1)
  const ey = d.getFullYear()
  const em = String(d.getMonth() + 1).padStart(2, '0')
  const ed = String(d.getDate()).padStart(2, '0')
  return `${ey}-${em}-${ed}`
}

/** Generate a cycle ID from a start date (YYYY-MM format) */
export function generateCycleId(startDate: string): string {
  const safe = safeDateOrToday(startDate)
  return safe.substring(0, 7)
}

/** Create a fresh 30-day cycle starting today */
export function createNewCycle(startDate?: string): MomentumCycle {
  const start = safeDateOrToday(startDate)
  return {
    cycleId: generateCycleId(start),
    startDate: start,
    endDate: computeCycleEndDate(start),
    logs: [],
    finalScore: null,
  }
}

/**
 * Check if a cycle has expired (today > endDate).
 * Returns true if the cycle should be finalized and a new one started.
 * Returns false for invalid cycles (safe default: don't reset).
 */
export function isCycleExpired(cycle: MomentumCycle): boolean {
  if (!isValidCycle(cycle)) return false
  return getTodayISO() > cycle.endDate
}

/**
 * Finalize a cycle: compute its final Momentum score and freeze it.
 * Returns the cycle with `finalScore` set.
 */
export function finalizeCycle(cycle: MomentumCycle): MomentumCycle {
  const breakdown = computeScoreBreakdown(cycle)
  return {
    ...cycle,
    finalScore: breakdown.totalMomentum,
  }
}

/**
 * Monthly reset logic:
 * 1) If active cycle is expired → finalize it, push to completedCycles
 * 2) Create a new active cycle starting today
 * 3) Add finalized score to lifetimeScore
 *
 * Returns updated state. Pure function — no side effects.
 */
export function processMonthlyReset(state: NutritionScoreState): NutritionScoreState {
  if (!isCycleExpired(state.activeCycle)) return state

  const finalized = finalizeCycle(state.activeCycle)
  const cycleScore = finalized.finalScore || 0

  return {
    ...state,
    activeCycle: createNewCycle(),
    completedCycles: [...state.completedCycles, finalized],
    lifetimeScore: state.lifetimeScore + cycleScore,
  }
}

// ── Scoring Calculations ─────────────────────────────────────

/**
 * Count unique ingredient IDs across all logs in a cycle.
 *
 * Math: |{ ingredientId ∈ log.ingredientIds ∀ log ∈ cycle.logs }|
 */
export function countUniqueIngredients(cycle: MomentumCycle): number {
  const set = new Set<string>()
  for (const log of (cycle?.logs || [])) {
    for (const id of (log?.ingredientIds || [])) {
      if (typeof id === 'string' && id.length > 0) set.add(id)
    }
  }
  return set.size
}

/**
 * Count distinct nutrients discovered across all logs in a cycle.
 * A nutrient is "discovered" when any scan yields a non-zero value.
 *
 * Math: |{ nutrient ∈ log.nutrientsDiscovered ∀ log ∈ cycle.logs }|
 */
export function countNutrientsCovered(cycle: MomentumCycle): number {
  const set = new Set<string>()
  for (const log of (cycle?.logs || [])) {
    for (const n of (log?.nutrientsDiscovered || [])) {
      if (typeof n === 'string' && n.length > 0) set.add(n)
    }
  }
  return set.size
}

/**
 * Compute the longest consecutive-day streak within a cycle.
 * A "day" counts if it has ≥1 scan.
 *
 * Algorithm:
 * 1) Collect all unique scan dates in the cycle
 * 2) Sort them chronologically
 * 3) Walk through, counting consecutive days
 * 4) Track the max streak seen
 */
export function computeStreakInCycle(cycle: MomentumCycle): number {
  const daySet = new Set<string>()
  for (const log of (cycle?.logs || [])) {
    const ts = log?.timestamp
    if (typeof ts === 'string' && ts.length >= 10) {
      daySet.add(ts.split('T')[0])
    }
  }

  if (daySet.size === 0) return 0

  const sortedDays = Array.from(daySet).sort()
  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diffMs = curr.getTime() - prev.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  return maxStreak
}

/**
 * Compute rolling 7-day activity: total scans in the last 7 days.
 *
 * Window: [today - 6 days, today] inclusive.
 */
export function computeWeeklyActivityCount(cycle: MomentumCycle): WeeklyActivity {
  const today = getTodayISO()
  const [y, m, d] = today.split('-').map(Number)
  const ws = new Date(y, m - 1, d - 6)
  const windowStart = `${ws.getFullYear()}-${String(ws.getMonth() + 1).padStart(2, '0')}-${String(ws.getDate()).padStart(2, '0')}`

  let scanCount = 0
  const activeDaySet = new Set<string>()

  for (const log of (cycle?.logs || [])) {
    const ts = log?.timestamp
    if (typeof ts !== 'string' || ts.length < 10) continue
    const logDate = ts.split('T')[0]
    if (logDate >= windowStart && logDate <= today) {
      scanCount++
      activeDaySet.add(logDate)
    }
  }

  return {
    windowStart,
    windowEnd: today,
    scanCount,
    activeDays: activeDaySet.size,
  }
}

/**
 * Normalize a raw value to 0–1, capped at 1.0.
 *
 * Math: min(raw / cap, 1.0)
 */
function normalize(raw: number, cap: number): number {
  if (cap <= 0) return 0
  return Math.min(raw / cap, 1.0)
}

/**
 * Compute the full score breakdown for a cycle.
 *
 * Each dimension:
 *   1) Extract raw metric
 *   2) Normalize to 0–1 using NORMALIZATION_CAPS
 *   3) Multiply by weight (DIMENSION_WEIGHTS)
 *   4) Scale to MAX_MOMENTUM contribution
 *
 * Total Momentum = Σ(normalized_i × weight_i) × MAX_MOMENTUM
 *
 * Example with perfect scores:
 *   diversity:  1.0 × 0.30 = 0.30
 *   coverage:   1.0 × 0.30 = 0.30
 *   streak:     1.0 × 0.20 = 0.20
 *   activity:   1.0 × 0.20 = 0.20
 *   Total: 1.0 × 1000 = 1000
 */
export function computeScoreBreakdown(cycle: MomentumCycle): ScoreBreakdown {
  const uniqueIngredients = countUniqueIngredients(cycle)
  const nutrientsCovered = countNutrientsCovered(cycle)
  const streak = computeStreakInCycle(cycle)
  const weekly = computeWeeklyActivityCount(cycle)

  const divNorm = normalize(uniqueIngredients, NORMALIZATION_CAPS.ingredientDiversity)
  const covNorm = normalize(nutrientsCovered, NORMALIZATION_CAPS.nutrientCoverage)
  const strNorm = normalize(streak, NORMALIZATION_CAPS.consistency)
  const actNorm = normalize(weekly.scanCount, NORMALIZATION_CAPS.weeklyActivity)

  const divWeighted = divNorm * DIMENSION_WEIGHTS.ingredientDiversity
  const covWeighted = covNorm * DIMENSION_WEIGHTS.nutrientCoverage
  const strWeighted = strNorm * DIMENSION_WEIGHTS.consistency
  const actWeighted = actNorm * DIMENSION_WEIGHTS.weeklyActivity

  const totalNormalized = divWeighted + covWeighted + strWeighted + actWeighted
  const totalMomentum = Math.round(totalNormalized * MAX_MOMENTUM)

  return {
    ingredientDiversity: {
      raw: uniqueIngredients,
      normalized: divNorm,
      weighted: divWeighted * MAX_MOMENTUM,
      weight: DIMENSION_WEIGHTS.ingredientDiversity,
      label: 'Ingredient Diversity',
      maxPossible: NORMALIZATION_CAPS.ingredientDiversity,
    },
    nutrientCoverage: {
      raw: nutrientsCovered,
      normalized: covNorm,
      weighted: covWeighted * MAX_MOMENTUM,
      weight: DIMENSION_WEIGHTS.nutrientCoverage,
      label: 'Nutrient Coverage',
      maxPossible: NORMALIZATION_CAPS.nutrientCoverage,
    },
    consistency: {
      raw: streak,
      normalized: strNorm,
      weighted: strWeighted * MAX_MOMENTUM,
      weight: DIMENSION_WEIGHTS.consistency,
      label: 'Consistency',
      maxPossible: NORMALIZATION_CAPS.consistency,
    },
    weeklyActivity: {
      raw: weekly.scanCount,
      normalized: actNorm,
      weighted: actWeighted * MAX_MOMENTUM,
      weight: DIMENSION_WEIGHTS.weeklyActivity,
      label: 'Weekly Activity',
      maxPossible: NORMALIZATION_CAPS.weeklyActivity,
    },
    totalMomentum,
  }
}

// ── State Factory ────────────────────────────────────────────

/** Create a fresh empty state for a brand-new user */
export function createEmptyScoreState(): NutritionScoreState {
  return {
    activeCycle: createNewCycle(),
    completedCycles: [],
    lifetimeScore: 0,
    allTimeUniqueIngredients: [],
    allTimeNutrientsDiscovered: [],
    longestEverStreak: 0,
    totalLifetimeScans: 0,
  }
}

// ── Log Recording ────────────────────────────────────────────

/**
 * Derive which nutrients were discovered from a JuiceEngine totals object.
 * A nutrient is "discovered" if its value > 0.
 */
export function deriveNutrientsFromTotals(
  totals: Record<string, number> | null | undefined
): string[] {
  if (!totals || typeof totals !== 'object') return []
  const discovered: string[] = []
  for (const key of ALL_NUTRIENTS) {
    const val = Number(totals[key])
    if (!isNaN(val) && val > 0) {
      discovered.push(key)
    }
  }
  return discovered
}

/**
 * Create a NutritionLogEntry from scan data.
 * Called when a juice is logged — bridges JuiceEngine output to score system.
 */
export function createLogEntry(
  ingredientIds: string[],
  totals: Record<string, number> | null | undefined,
): NutritionLogEntry {
  const safeIds = Array.isArray(ingredientIds)
    ? ingredientIds.filter((id) => typeof id === 'string' && id.length > 0)
    : []
  const safeTotals = (totals && typeof totals === 'object') ? { ...totals } : {}
  // Use local-time ISO string so date extraction (split('T')[0]) matches the
  // user's local day — critical for streak and weekly activity calculations.
  const now = new Date()
  const localISO = `${getTodayISO()}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: localISO,
    ingredientIds: safeIds,
    nutrientsDiscovered: deriveNutrientsFromTotals(safeTotals),
    totalNutrients: safeTotals,
  }
}

/**
 * Record a new log entry into the state.
 * Updates active cycle, all-time trackers, and lifetime counters.
 * Pure function — returns new state.
 */
export function recordLog(
  state: NutritionScoreState,
  entry: NutritionLogEntry,
): NutritionScoreState {
  if (!isValidLogEntry(entry)) return state

  // Check for monthly reset first
  let current = processMonthlyReset(state)

  // Add log to active cycle
  const updatedCycle: MomentumCycle = {
    ...current.activeCycle,
    logs: [...(current.activeCycle?.logs || []), entry],
  }

  // Update all-time unique ingredients
  const ingredientSet = new Set(current.allTimeUniqueIngredients || [])
  for (const id of (entry.ingredientIds || [])) {
    if (typeof id === 'string' && id.length > 0) ingredientSet.add(id)
  }

  // Update all-time nutrients discovered
  const nutrientSet = new Set(current.allTimeNutrientsDiscovered || [])
  for (const n of (entry.nutrientsDiscovered || [])) {
    if (typeof n === 'string' && n.length > 0) nutrientSet.add(n)
  }

  // Update longest-ever streak
  const cycleStreak = computeStreakInCycle(updatedCycle)
  const longestEver = Math.max(current.longestEverStreak || 0, cycleStreak)

  return {
    ...current,
    activeCycle: updatedCycle,
    allTimeUniqueIngredients: Array.from(ingredientSet),
    allTimeNutrientsDiscovered: Array.from(nutrientSet),
    longestEverStreak: longestEver,
    totalLifetimeScans: (current.totalLifetimeScans || 0) + 1,
  }
}

// ── Computed Helpers ─────────────────────────────────────────

/** Days remaining in the active cycle (local-time safe) */
export function daysRemainingInCycle(cycle: MomentumCycle): number {
  if (!cycle?.endDate) return CYCLE_DAYS
  const todayStr = getTodayISO()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const [ey, em, ed] = cycle.endDate.split('-').map(Number)
  if (isNaN(ey) || isNaN(em) || isNaN(ed)) return CYCLE_DAYS
  const todayMs = new Date(ty, tm - 1, td).getTime()
  const endMs = new Date(ey, em - 1, ed).getTime()
  const diff = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24))
  return Math.max(diff, 0)
}

/** Days elapsed in the active cycle */
export function daysElapsedInCycle(cycle: MomentumCycle): number {
  return CYCLE_DAYS - daysRemainingInCycle(cycle)
}

/** Current Momentum score for the active cycle (live, not finalized) */
export function currentMomentum(state: NutritionScoreState): number {
  return computeScoreBreakdown(state.activeCycle).totalMomentum
}

/** Total score: lifetime + current active cycle momentum */
export function totalScore(state: NutritionScoreState): number {
  return state.lifetimeScore + currentMomentum(state)
}

// ── Mock Data ────────────────────────────────────────────────

/**
 * Generate sample mock data for testing and development.
 * Simulates a user who has completed 1 cycle and is mid-way through cycle 2.
 */
export function createMockScoreState(): NutritionScoreState {
  // ── Completed cycle (30 days ago) ──
  // User scanned 15 unique ingredients, discovered all 8 nutrients,
  // had a 12-day streak, and averaged 6 scans/week.
  const completedCycleStart = '2026-01-01'
  const completedCycle: MomentumCycle = {
    cycleId: '2026-01',
    startDate: completedCycleStart,
    endDate: computeCycleEndDate(completedCycleStart),
    logs: generateMockLogs(completedCycleStart, 18, [
      'kale', 'spinach', 'carrot', 'beet', 'cucumber',
      'celery', 'ginger', 'lemon', 'apple_green', 'pineapple',
      'turmeric', 'broccoli', 'sweet_potato', 'blueberry', 'mint',
    ]),
    finalScore: 712,  // Pre-calculated: div 0.75×300 + cov 1.0×300 + str 0.48×200 + act 0.6×200 = 225+300+96+120 = 741 (rounded)
  }

  // ── Active cycle (current) ──
  const activeCycleStart = '2026-02-01'
  const activeCycle: MomentumCycle = {
    cycleId: '2026-02',
    startDate: activeCycleStart,
    endDate: computeCycleEndDate(activeCycleStart),
    logs: generateMockLogs(activeCycleStart, 8, [
      'kale', 'spinach', 'carrot', 'ginger', 'lemon',
      'cucumber', 'beet', 'parsley',
    ]),
    finalScore: null,
  }

  return {
    activeCycle,
    completedCycles: [completedCycle],
    lifetimeScore: completedCycle.finalScore || 0,
    allTimeUniqueIngredients: [
      'kale', 'spinach', 'carrot', 'beet', 'cucumber',
      'celery', 'ginger', 'lemon', 'apple_green', 'pineapple',
      'turmeric', 'broccoli', 'sweet_potato', 'blueberry', 'mint',
      'parsley',
    ],
    allTimeNutrientsDiscovered: [...ALL_NUTRIENTS],
    longestEverStreak: 12,
    totalLifetimeScans: 26,
  }
}

/**
 * Generate mock log entries spread across days from a start date.
 * Each log uses a random subset of the provided ingredient pool.
 */
function generateMockLogs(
  startDate: string,
  count: number,
  ingredientPool: string[],
): NutritionLogEntry[] {
  const logs: NutritionLogEntry[] = []
  const start = new Date(startDate)

  for (let i = 0; i < count; i++) {
    const logDate = new Date(start)
    // Spread logs across the cycle — roughly every 1–2 days
    logDate.setDate(logDate.getDate() + Math.floor(i * 1.6))

    // Pick 2–5 random ingredients per scan
    const numIngredients = 2 + Math.floor(Math.random() * 4)
    const shuffled = [...ingredientPool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, numIngredients)

    // Mock nutrient totals — realistic ranges
    const totals: Record<string, number> = {
      calories: 40 + Math.round(Math.random() * 120),
      sugar: 2 + Math.round(Math.random() * 15),
      vitaminC: 10 + Math.round(Math.random() * 80),
      vitaminA: 50 + Math.round(Math.random() * 500),
      potassium: 100 + Math.round(Math.random() * 400),
      iron: Math.round(Math.random() * 30) / 10,
      magnesium: 10 + Math.round(Math.random() * 60),
      folate: 20 + Math.round(Math.random() * 150),
    }

    logs.push({
      id: `mock-${i}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: logDate.toISOString(),
      ingredientIds: selected,
      nutrientsDiscovered: deriveNutrientsFromTotals(totals),
      totalNutrients: totals,
    })
  }

  return logs
}
