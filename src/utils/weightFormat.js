// ─────────────────────────────────────────────────────────────
// weightFormat.js — Weight display utility + context
// Supports three modes: 'both' (g + oz), 'grams', 'oz'
// Persists user preference to AsyncStorage
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@juicing_weight_unit_v1'
const G_PER_OZ = 28.3495

export const WEIGHT_MODES = [
  { key: 'both', label: 'Both (g + oz)' },
  { key: 'grams', label: 'Grams only' },
  { key: 'oz', label: 'Ounces only' },
]

// ── Pure formatting functions ────────────────────────────────

export function formatWeightG(grams, mode = 'both') {
  if (grams == null || isNaN(grams)) return ''
  const g = Math.round(grams)
  const oz = (grams / G_PER_OZ).toFixed(1)

  switch (mode) {
    case 'grams':
      return `${g}g`
    case 'oz':
      return `${oz} oz`
    case 'both':
    default:
      return `${g}g (${oz} oz)`
  }
}

export function formatWeightLbs(grams, mode = 'both') {
  if (grams == null || isNaN(grams)) return ''
  const g = Math.round(grams)
  const lbs = (grams / 453.592).toFixed(1)
  const oz = (grams / G_PER_OZ).toFixed(1)

  switch (mode) {
    case 'grams':
      return `${g}g`
    case 'oz':
      return `${lbs} lbs`
    case 'both':
    default:
      return `${lbs} lbs (${g}g)`
  }
}

// ── Context ──────────────────────────────────────────────────

const WeightUnitContext = createContext({ mode: 'both', setMode: () => {} })

export function WeightUnitProvider({ children }) {
  const [mode, setModeState] = useState('both')

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val && ['both', 'grams', 'oz'].includes(val)) setModeState(val)
    }).catch(() => {})
  }, [])

  const setMode = useCallback((newMode) => {
    setModeState(newMode)
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {})
  }, [])

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])

  return (
    <WeightUnitContext.Provider value={value}>
      {children}
    </WeightUnitContext.Provider>
  )
}

export function useWeightUnit() {
  return useContext(WeightUnitContext)
}

// ── Hook: format with current preference ─────────────────────

export function useFormatWeight() {
  const { mode } = useWeightUnit()
  return useMemo(() => ({
    fmtG: (grams) => formatWeightG(grams, mode),
    fmtLbs: (grams) => formatWeightLbs(grams, mode),
    mode,
  }), [mode])
}
