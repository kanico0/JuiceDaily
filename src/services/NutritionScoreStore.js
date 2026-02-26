// ─────────────────────────────────────────────────────────────
// NutritionScoreStore.js — React context + reducer for the
// Nutrition Performance scoring system.
//
// Wraps NutritionScoreEngine.ts pure functions with:
//   - AsyncStorage persistence (offline-first)
//   - useReducer for state management
//   - useMemo for computed values (breakdown, momentum, etc.)
//   - Monthly cycle reset on hydrate
//
// Pattern matches existing stores (ChallengeStore, ActivationStore).
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  createEmptyScoreState,
  createLogEntry,
  recordLog as engineRecordLog,
  processMonthlyReset,
  computeScoreBreakdown,
  currentMomentum,
  totalScore,
  daysRemainingInCycle,
  daysElapsedInCycle,
  countUniqueIngredients,
  countNutrientsCovered,
  computeStreakInCycle,
  computeWeeklyActivityCount,
  isValidCycle,
  CYCLE_DAYS,
} from './NutritionScoreEngine'
import { loadState, saveState } from './storage'

export const STORAGE_KEY = '@juicing_nutrition_score_v1'
const SCHEMA_VERSION = 2

// ── Reducer ──────────────────────────────────────────────────

/** Validate and sanitize hydrated state from storage */
function sanitizeHydratedState(raw) {
  const empty = createEmptyScoreState()
  if (!raw || typeof raw !== 'object') return empty

  return {
    activeCycle: isValidCycle(raw.activeCycle) ? raw.activeCycle : empty.activeCycle,
    completedCycles: Array.isArray(raw.completedCycles)
      ? raw.completedCycles.filter(isValidCycle)
      : [],
    lifetimeScore: typeof raw.lifetimeScore === 'number' && !isNaN(raw.lifetimeScore)
      ? raw.lifetimeScore : 0,
    allTimeUniqueIngredients: Array.isArray(raw.allTimeUniqueIngredients)
      ? raw.allTimeUniqueIngredients.filter((s) => typeof s === 'string')
      : [],
    allTimeNutrientsDiscovered: Array.isArray(raw.allTimeNutrientsDiscovered)
      ? raw.allTimeNutrientsDiscovered.filter((s) => typeof s === 'string')
      : [],
    longestEverStreak: typeof raw.longestEverStreak === 'number' && !isNaN(raw.longestEverStreak)
      ? raw.longestEverStreak : 0,
    totalLifetimeScans: typeof raw.totalLifetimeScans === 'number' && !isNaN(raw.totalLifetimeScans)
      ? raw.totalLifetimeScans : 0,
  }
}

function scoreReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      const hydrated = sanitizeHydratedState(action.payload)
      return processMonthlyReset(hydrated)
    }

    case 'RECORD_LOG': {
      const { ingredientIds, totals } = action.payload || {}
      if (!Array.isArray(ingredientIds)) return state
      const entry = createLogEntry(ingredientIds, totals)
      return engineRecordLog(state, entry)
    }

    case 'RESET':
      return createEmptyScoreState()

    default:
      return state
  }
}

// ── Context + Provider ───────────────────────────────────────

const NutritionScoreContext = createContext(null)

export function NutritionScoreProvider({ children }) {
  const [state, dispatch] = useReducer(scoreReducer, createEmptyScoreState())

  // Track whether initial hydration is complete to avoid persisting empty state
  const isHydrated = useRef(false)

  // Hydrate from storage on mount (schema-versioned, with migration)
  useEffect(() => {
    ;(async () => {
      const restored = await loadState({
        key: STORAGE_KEY,
        version: SCHEMA_VERSION,
        sanitize: sanitizeHydratedState,
      })
      if (restored) {
        dispatch({ type: 'HYDRATE', payload: restored })
      }
      isHydrated.current = true
    })()
  }, [])

  // Persist to storage on every state change (debounced 300ms)
  useEffect(() => {
    if (!isHydrated.current) return
    saveState(STORAGE_KEY, SCHEMA_VERSION, state)
  }, [state])

  // ── Actions ──

  const recordNutritionLog = useCallback((ingredientIds, totals) => {
    dispatch({
      type: 'RECORD_LOG',
      payload: { ingredientIds, totals },
    })
  }, [])

  const resetScore = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  // ── Computed values (memoized) ──

  const cycle = state.activeCycle

  const breakdown = useMemo(
    () => computeScoreBreakdown(cycle),
    [cycle]
  )

  const momentum = useMemo(
    () => currentMomentum(state),
    [state]
  )

  const lifetime = useMemo(
    () => totalScore(state),
    [state]
  )

  const cycleProgress = useMemo(() => ({
    daysRemaining: daysRemainingInCycle(cycle),
    daysElapsed: daysElapsedInCycle(cycle),
    startDate: cycle?.startDate || '',
    endDate: cycle?.endDate || '',
    cycleId: cycle?.cycleId || '',
    logCount: cycle?.logs?.length || 0,
  }), [cycle])

  const diversity = useMemo(() => ({
    cycleUnique: countUniqueIngredients(cycle),
    allTimeUnique: (state.allTimeUniqueIngredients || []).length,
    allTimeIngredients: state.allTimeUniqueIngredients || [],
  }), [cycle, state.allTimeUniqueIngredients])

  const coverage = useMemo(() => ({
    cycleNutrients: countNutrientsCovered(cycle),
    allTimeNutrients: (state.allTimeNutrientsDiscovered || []).length,
    allTimeNutrientsList: state.allTimeNutrientsDiscovered || [],
  }), [cycle, state.allTimeNutrientsDiscovered])

  const streak = useMemo(() => ({
    currentCycleStreak: computeStreakInCycle(cycle),
    longestEver: state.longestEverStreak || 0,
  }), [cycle, state.longestEverStreak])

  const weeklyActivity = useMemo(
    () => computeWeeklyActivityCount(cycle),
    [cycle]
  )

  const value = useMemo(() => ({
    // Raw state (for persistence / debugging)
    scoreState: state,

    // Actions
    recordNutritionLog,
    resetScore,

    // Computed scores
    breakdown,
    momentum,
    lifetime,

    // Cycle info
    cycleProgress,
    completedCycles: state.completedCycles,

    // Dimension details
    diversity,
    coverage,
    streak,
    weeklyActivity,

    // Lifetime counters
    totalLifetimeScans: state.totalLifetimeScans,
  }), [
    state, recordNutritionLog, resetScore,
    breakdown, momentum, lifetime,
    cycleProgress, diversity, coverage, streak, weeklyActivity,
  ])

  return (
    <NutritionScoreContext.Provider value={value}>
      {children}
    </NutritionScoreContext.Provider>
  )
}

export function useNutritionScore() {
  const ctx = useContext(NutritionScoreContext)
  if (!ctx) throw new Error('useNutritionScore must be used within <NutritionScoreProvider>')
  return ctx
}
