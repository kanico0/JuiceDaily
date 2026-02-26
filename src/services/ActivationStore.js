// ─────────────────────────────────────────────────────────────
// ActivationStore.js — Progressive feature unlock tracking
// Tracks totalLogsCount, firstLogDate, daysSinceFirstLog.
// Computes which features should be unlocked based on usage.
// Offline-first via AsyncStorage. Gated by ff_progressive_unlock.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@juicing_activation_v1'

// ── Unlock Thresholds ────────────────────────────────────────

export const UNLOCK_RULES = {
  nutrient_halo: { logThreshold: 3, label: 'Nutrient Halo' },
  weekly_pillar: { logThreshold: 5, label: 'Weekly Pillar View' },
  optimize_tab: { logThreshold: 7, label: 'Optimize Tab' },
}

// ── Reducer ──────────────────────────────────────────────────

function activationReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload }
    case 'RECORD_LOG': {
      const now = new Date().toISOString()
      return {
        ...state,
        totalLogsCount: state.totalLogsCount + 1,
        firstLogDate: state.firstLogDate || now,
        lastLogDate: now,
        introDismissed: true,
      }
    }
    case 'RECORD_ONBOARDING_COMPLETE':
      return { ...state, onboardingComplete: true }
    case 'RECORD_TRACKING_OPT_IN':
      return { ...state, trackingOptIn: true }
    case 'SET_GOAL':
      return { ...state, selectedGoal: action.goal }
    case 'RECORD_INTRO_DISMISSED':
      return { ...state, introDismissed: true }
    case 'RESET':
      return createEmptyState()
    default:
      return state
  }
}

function createEmptyState() {
  return {
    totalLogsCount: 0,
    firstLogDate: null,
    lastLogDate: null,
    onboardingComplete: false,
    trackingOptIn: false,
    selectedGoal: null,
    introDismissed: false,
  }
}

// ── Computed Unlocks ─────────────────────────────────────────

export function computeDaysSinceFirstLog(firstLogDate) {
  if (!firstLogDate) return 0
  const first = new Date(firstLogDate)
  const now = new Date()
  const diffMs = now.getTime() - first.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function computeUnlocks(state) {
  const days = computeDaysSinceFirstLog(state.firstLogDate)
  const logs = state.totalLogsCount
  return {
    nutrientHalo: logs >= UNLOCK_RULES.nutrient_halo.logThreshold,
    weeklyPillar: logs >= UNLOCK_RULES.weekly_pillar.logThreshold,
    optimizeTab: logs >= UNLOCK_RULES.optimize_tab.logThreshold,
    daysSinceFirstLog: days,
    totalLogsCount: logs,
  }
}

// ── Context + Provider ───────────────────────────────────────

const ActivationContext = createContext(null)

export function ActivationProvider({ children }) {
  const [state, dispatch] = useReducer(activationReducer, createEmptyState())
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) dispatch({ type: 'HYDRATE', payload: JSON.parse(raw) })
      } catch (e) { /* use empty */ }
      setIsHydrated(true)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (e) { /* non-fatal */ }
    })()
  }, [state])

  const recordLog = useCallback(() => {
    dispatch({ type: 'RECORD_LOG' })
  }, [])

  const recordOnboardingComplete = useCallback(() => {
    dispatch({ type: 'RECORD_ONBOARDING_COMPLETE' })
  }, [])

  const recordTrackingOptIn = useCallback(() => {
    dispatch({ type: 'RECORD_TRACKING_OPT_IN' })
  }, [])

  const setGoal = useCallback((goal) => {
    dispatch({ type: 'SET_GOAL', goal })
  }, [])

  const recordIntroDismissed = useCallback(() => {
    dispatch({ type: 'RECORD_INTRO_DISMISSED' })
  }, [])

  const resetActivation = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const unlocks = useMemo(() => computeUnlocks(state), [state])

  const value = useMemo(() => ({
    activation: state,
    isHydrated,
    unlocks,
    recordLog,
    recordOnboardingComplete,
    recordTrackingOptIn,
    setGoal,
    recordIntroDismissed,
    resetActivation,
  }), [state, isHydrated, unlocks, recordLog, recordOnboardingComplete, recordTrackingOptIn, setGoal, recordIntroDismissed, resetActivation])

  return (
    <ActivationContext.Provider value={value}>
      {children}
    </ActivationContext.Provider>
  )
}

export function useActivation() {
  const ctx = useContext(ActivationContext)
  if (!ctx) throw new Error('useActivation must be used within <ActivationProvider>')
  return ctx
}
