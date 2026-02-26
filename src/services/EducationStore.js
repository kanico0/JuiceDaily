// ─────────────────────────────────────────────────────────────
// EducationStore.js — Persistent education state
// Tracks: screen completion, Knowledge XP, badges, cumulative
// metrics (Total Lbs Juiced), Reboot Recipe unlock
// Uses Context + useReducer (matches ChallengeStore pattern)
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  NOVICE_SCREENS,
  XP_PER_SCREEN,
  TOTAL_JOURNEY_XP,
  BEGINNER_BADGE,
} from '../constants/educationContent'

const STORAGE_KEY = '@juicing_education_v1'

// ── Initial State ────────────────────────────────────────────

const initialState = {
  // Which screens have been completed: { [screenId]: true }
  completedScreens: {},
  // Current highest unlocked screen index (progressive disclosure)
  highestUnlocked: 0,
  // Knowledge XP earned
  knowledgeXP: 0,
  // Earned badge IDs
  earnedBadges: [],
  // Whether Reboot Recipe library is unlocked
  rebootRecipesUnlocked: false,
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

    case 'COMPLETE_SCREEN': {
      const { screenId, screenIndex } = action.payload
      if (state.completedScreens[screenId]) return state

      const xp = XP_PER_SCREEN[screenId] || 0
      const newCompleted = { ...state.completedScreens, [screenId]: true }
      const newXP = state.knowledgeXP + xp
      const newHighest = Math.max(state.highestUnlocked, screenIndex + 1)

      // Check if all 5 screens are now done
      const allDone = NOVICE_SCREENS.every((s) => newCompleted[s.id])
      const newBadges = [...state.earnedBadges]
      let rebootUnlocked = state.rebootRecipesUnlocked

      if (allDone && !newBadges.includes(BEGINNER_BADGE.id)) {
        newBadges.push(BEGINNER_BADGE.id)
        rebootUnlocked = true
      }

      return {
        ...state,
        completedScreens: newCompleted,
        highestUnlocked: newHighest,
        knowledgeXP: newXP,
        earnedBadges: newBadges,
        rebootRecipesUnlocked: rebootUnlocked,
      }
    }

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

  const completeScreen = useCallback((screenId, screenIndex) => {
    dispatch({ type: 'COMPLETE_SCREEN', payload: { screenId, screenIndex } })
  }, [])

  const incrementMetric = useCallback((metric, amount = 1) => {
    dispatch({ type: 'INCREMENT_METRIC', payload: { metric, amount } })
  }, [])

  const acknowledgeSafety = useCallback(() => {
    dispatch({ type: 'ACKNOWLEDGE_SAFETY' })
  }, [])

  // ── Derived ──────────────────────────────────────────────

  const isScreenUnlocked = useCallback((screenIndex) => {
    return screenIndex <= state.highestUnlocked
  }, [state.highestUnlocked])

  const isScreenCompleted = useCallback((screenId) => {
    return !!state.completedScreens[screenId]
  }, [state.completedScreens])

  const journeyComplete = useMemo(() => {
    return NOVICE_SCREENS.every((s) => state.completedScreens[s.id])
  }, [state.completedScreens])

  const journeyProgress = useMemo(() => {
    const done = NOVICE_SCREENS.filter((s) => state.completedScreens[s.id]).length
    return done / NOVICE_SCREENS.length
  }, [state.completedScreens])

  const value = useMemo(() => ({
    ...state,
    completeScreen,
    incrementMetric,
    acknowledgeSafety,
    isScreenUnlocked,
    isScreenCompleted,
    journeyComplete,
    journeyProgress,
  }), [
    state,
    completeScreen,
    incrementMetric,
    acknowledgeSafety,
    isScreenUnlocked,
    isScreenCompleted,
    journeyComplete,
    journeyProgress,
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
