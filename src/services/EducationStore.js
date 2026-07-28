// ─────────────────────────────────────────────────────────────
// EducationStore.js — Persistent education state
// Tracks: cumulative metrics (Total Lbs Juiced), safety acknowledgement
// Uses Context + useReducer (matches ChallengeStore pattern)
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
// educationContent imports removed — read-status tracking no longer needed

const STORAGE_KEY = '@juicing_education_v1'

// ── Initial State ────────────────────────────────────────────

const initialState = {
  // Cumulative metrics
  metrics: {
    totalJuices: 0,
    totalLbsJuiced: 0,
    totalVitC: 0,
    totalIron: 0,
    organicUses: 0,
  },
  // Safety disclaimer acknowledged
  safetyAcknowledged: false,
  // Hydrated from storage
  isHydrated: false,
}

// ── Reducer ──────────────────────────────────────────────────

function educationReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, isHydrated: true }

    case 'INCREMENT_METRIC': {
      const { metric, amount } = action.payload
      return {
        ...state,
        metrics: {
          ...state.metrics,
          [metric]: (state.metrics[metric] || 0) + amount,
        },
      }
    }

    case 'ACKNOWLEDGE_SAFETY':
      return { ...state, safetyAcknowledged: true }

    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────

const EducationContext = createContext(null)

export function EducationProvider({ children }) {
  const [state, dispatch] = useReducer(educationReducer, initialState)

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          dispatch({ type: 'HYDRATE', payload: JSON.parse(raw) })
        } catch {
          dispatch({ type: 'HYDRATE', payload: {} })
        }
      } else {
        dispatch({ type: 'HYDRATE', payload: {} })
      }
    }).catch(() => {
      dispatch({ type: 'HYDRATE', payload: {} })
    })
  }, [])

  // Persist on every state change after hydration
  useEffect(() => {
    if (!state.isHydrated) return
    const { isHydrated, ...persistable } = state
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistable)).catch(() => {})
  }, [state])

  // ── Actions ──────────────────────────────────────────────

  const incrementMetric = useCallback((metric, amount = 1) => {
    dispatch({ type: 'INCREMENT_METRIC', payload: { metric, amount } })
  }, [])

  const acknowledgeSafety = useCallback(() => {
    dispatch({ type: 'ACKNOWLEDGE_SAFETY' })
  }, [])

  const value = useMemo(() => ({
    ...state,
    incrementMetric,
    acknowledgeSafety,
  }), [
    state,
    incrementMetric,
    acknowledgeSafety,
  ])

  return (
    <EducationContext.Provider value={value}>
      {children}
    </EducationContext.Provider>
  )
}

export function useEducation() {
  const ctx = useContext(EducationContext)
  if (!ctx) throw new Error('useEducation must be used within EducationProvider')
  return ctx
}
