// ─────────────────────────────────────────────────────────────
// organicPreference.js — Organic default preference context
// Modes: 'all_organic', 'all_non_organic', 'per_ingredient'
// Persists user preference to AsyncStorage
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@juicing_organic_pref_v1'

export const ORGANIC_MODES = [
  { key: 'all_non_organic', label: 'Default Non-Organic' },
  { key: 'all_organic', label: 'Default Organic' },
  { key: 'per_ingredient', label: 'Choose Per Ingredient' },
]

// ── Context ──────────────────────────────────────────────────

const OrganicPrefContext = createContext({ mode: 'all_non_organic', setMode: () => {} })

export function OrganicPrefProvider({ children }) {
  const [mode, setModeState] = useState('all_non_organic')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val && ['all_organic', 'all_non_organic', 'per_ingredient'].includes(val)) {
        setModeState(val)
      }
    }).catch(() => {})
  }, [])

  const setMode = useCallback((newMode) => {
    setModeState(newMode)
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {})
  }, [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])

  return (
    <OrganicPrefContext.Provider value={value}>
      {children}
    </OrganicPrefContext.Provider>
  )
}

export function useOrganicPref() {
  return useContext(OrganicPrefContext)
}

// ── Helper: get default organic value for a new ingredient ───

export function getDefaultOrganic(mode) {
  if (mode === 'all_organic') return true
  if (mode === 'all_non_organic') return false
  return false // per_ingredient defaults to non-organic
}
