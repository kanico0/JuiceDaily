// ─────────────────────────────────────────────────────────────
// FeatureFlags.js — AsyncStorage-backed feature flag store
// All flags default OFF. Toggle via setFlag() or DevTools.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@juicing_feature_flags_v2'

// ── Flag Definitions ─────────────────────────────────────────
// Every flag MUST be listed here with default = false

const DEFAULT_FLAGS = {
  // Foundation
  ff_today_hub: true,
  ff_3step_logger: true,
  ff_reward_splash: true,

  // Differentiation
  ff_smart_pantry: true,
  ff_use_soon_cards: true,
  ff_recipe_linking: true,

  // Premium
  ff_templates: true,
  ff_insights: true,
  ff_streaks_grace: true,
  ff_social_challenges: true,

  // Acceleration
  ff_photo_draft: true,
  ff_ai_suggestions: true,
  ff_liquid_motion_v2: true,

  // Emotional First-Launch + Aha
  ff_first_launch_orchestrator: true,
  ff_emotional_copy: true,
  ff_reward_polish: true,
  ff_streak_visual: true,
  ff_pantry_ai_priority: true,

  // Step 1 — Nutrient Halo Progress System
  ff_nutrient_halo_progress: true,
  ff_weekly_pillar_view: true,
  ff_monthly_heatmap: true,

  // Step 2 — Liquid UX System
  ff_liquid_surfaces: true,
  ff_liquid_background: true,
  ff_liquid_motion: true,
  ff_juice_splash: true,

  // Juice Calculator
  ff_juice_calculator: true,

  // Scan-First Navigation
  ff_progressive_unlock: true,
  ff_optimize_tab: true,
  ff_scan_secondary_actions: false,

  // Dev overrides
  ff_force_onboarding: false,
}

// ── Reducer ──────────────────────────────────────────────────

function flagReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...DEFAULT_FLAGS, ...action.payload }
    case 'SET_FLAG':
      return { ...state, [action.key]: action.value }
    case 'RESET_ALL':
      return { ...DEFAULT_FLAGS }
    default:
      return state
  }
}

// ── Context ──────────────────────────────────────────────────

const FlagContext = createContext(null)

export function FlagProvider({ children }) {
  const [flags, dispatch] = useReducer(flagReducer, DEFAULT_FLAGS)

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          dispatch({ type: 'HYDRATE', payload: saved })
        }
      } catch (e) {
        // Silently use defaults
      }
    })()
  }, [])

  const persist = useCallback(async (nextFlags) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlags))
    } catch (e) {
      // Persist failure is non-fatal
    }
  }, [])

  const setFlag = useCallback((key, value) => {
    if (!(key in DEFAULT_FLAGS)) return
    dispatch({ type: 'SET_FLAG', key, value: !!value })
    const next = { ...flags, [key]: !!value }
    persist(next)
  }, [flags, persist])

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET_ALL' })
    persist(DEFAULT_FLAGS)
  }, [persist])

  const isEnabled = useCallback((key) => {
    return !!flags[key]
  }, [flags])

  return (
    <FlagContext.Provider value={{ flags, setFlag, resetAll, isEnabled }}>
      {children}
    </FlagContext.Provider>
  )
}

export function useFlags() {
  const ctx = useContext(FlagContext)
  if (!ctx) throw new Error('useFlags must be used within <FlagProvider>')
  return ctx
}

export { DEFAULT_FLAGS }
