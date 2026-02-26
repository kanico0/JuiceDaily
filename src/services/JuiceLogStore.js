// ─────────────────────────────────────────────────────────────
// JuiceLogStore.js — Persisted juice log entries for Today dashboard.
//
// Each log entry records:
//   - id (uuid), createdAt (ISO), source (photo|manual|demo)
//   - title (short label), ingredients (array of produceIds)
//   - nutrientSummary (batch totals), scoreContribution
//
// Entries are grouped by dateKey (YYYY-MM-DD local time).
// Uses storage.ts for schema-versioned persistence.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react'
import { loadState, saveState } from './storage'
import { PRODUCE_DATA } from './JuiceEngine'
import { getDevNow, onDevClockChange } from '../utils/DevClock'

const STORAGE_KEY = '@juicing_log_entries_v1'
const SCHEMA_VERSION = 2

// ── Helpers ──────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function localDateKey(date) {
  const d = date || getDevNow()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localISOString() {
  const d = getDevNow()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}:${s}`
}

function buildTitle(ingredientIds) {
  if (!ingredientIds || ingredientIds.length === 0) return 'Empty Juice'
  const names = ingredientIds.slice(0, 3).map((id) => {
    const entry = PRODUCE_DATA[id]
    return entry ? entry.name : id
  })
  const label = names.join(', ')
  if (ingredientIds.length > 3) return label + ` +${ingredientIds.length - 3}`
  return label
}

// ── State Shape ──────────────────────────────────────────────

function createEmptyState() {
  return {
    entries: [],  // JuiceLogEntry[]
  }
}

// ── Reducer ──────────────────────────────────────────────────

function logReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload || createEmptyState()

    case 'ADD_ENTRY': {
      const entry = action.payload
      return { ...state, entries: [entry, ...state.entries] }
    }

    case 'DELETE_ENTRY': {
      const id = action.payload
      return { ...state, entries: state.entries.filter((e) => e.id !== id) }
    }

    case 'RESET':
      return createEmptyState()

    default:
      return state
  }
}

// ── Sanitize ─────────────────────────────────────────────────

function sanitizeLogState(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyState()
  const entries = Array.isArray(raw.entries) ? raw.entries.filter(
    (e) => e && typeof e.id === 'string' && typeof e.createdAt === 'string'
  ) : []
  return { entries }
}

// ── Context ──────────────────────────────────────────────────

const JuiceLogContext = createContext(null)

export function JuiceLogProvider({ children }) {
  const [state, dispatch] = useReducer(logReducer, createEmptyState())
  const hydratedRef = useRef(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [devClockTick, setDevClockTick] = useState(0)

  // Re-derive when dev clock advances
  useEffect(() => {
    return onDevClockChange(() => setDevClockTick((t) => t + 1))
  }, [])

  // Hydrate from storage
  useEffect(() => {
    ;(async () => {
      const restored = await loadState({
        key: STORAGE_KEY,
        version: SCHEMA_VERSION,
        sanitize: sanitizeLogState,
      })
      if (restored) {
        dispatch({ type: 'HYDRATE', payload: restored })
      }
      hydratedRef.current = true
      setIsHydrated(true)
    })()
  }, [])

  // Persist on state changes
  useEffect(() => {
    if (!hydratedRef.current) return
    saveState(STORAGE_KEY, SCHEMA_VERSION, state)
  }, [state])

  const addEntry = useCallback(({ source, ingredientIds, nutrientSummary, scoreContribution }) => {
    const entry = {
      id: generateId(),
      createdAt: localISOString(),
      dateKey: localDateKey(),
      source: source || 'photo',
      title: buildTitle(ingredientIds),
      ingredients: ingredientIds || [],
      nutrientSummary: nutrientSummary || {},
      scoreContribution: scoreContribution || null,
    }
    dispatch({ type: 'ADD_ENTRY', payload: entry })
    return entry
  }, [])

  const deleteEntry = useCallback((id) => {
    dispatch({ type: 'DELETE_ENTRY', payload: id })
  }, [])

  const resetLog = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  // Derived data
  const todayKey = localDateKey()
  const todayEntries = state.entries.filter((e) => e.dateKey === todayKey)
  const last7DaysEntries = state.entries.filter((e) => {
    const d = new Date(e.createdAt)
    const now = getDevNow()
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 7
  })

  // Drill-down stats
  const diversityStats = {
    uniqueToday: [...new Set(todayEntries.flatMap((e) => e.ingredients))].length,
    repeatsToday: todayEntries.flatMap((e) => e.ingredients).length -
      [...new Set(todayEntries.flatMap((e) => e.ingredients))].length,
    uniqueWeek: [...new Set(last7DaysEntries.flatMap((e) => e.ingredients))].length,
    groupBreakdown: (() => {
      const groups = {}
      const allIds = todayEntries.flatMap((e) => e.ingredients)
      allIds.forEach((id) => {
        const entry = PRODUCE_DATA[id]
        const cat = entry ? entry.category : 'unknown'
        groups[cat] = (groups[cat] || 0) + 1
      })
      return groups
    })(),
    topRepeated: (() => {
      const counts = {}
      todayEntries.flatMap((e) => e.ingredients).forEach((id) => {
        counts[id] = (counts[id] || 0) + 1
      })
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      if (sorted.length === 0) return null
      const [id, count] = sorted[0]
      const entry = PRODUCE_DATA[id]
      return { name: entry ? entry.name : id, count }
    })(),
  }

  const consistencyStats = {
    totalEntriesToday: todayEntries.length,
    totalEntriesWeek: last7DaysEntries.length,
    activeDaysWeek: [...new Set(last7DaysEntries.map((e) => e.dateKey))].length,
    avgEntriesPerDay: last7DaysEntries.length > 0
      ? Math.round((last7DaysEntries.length / 7) * 10) / 10
      : 0,
    loggingTimePattern: (() => {
      const pattern = { morning: 0, afternoon: 0, evening: 0 }
      todayEntries.forEach((e) => {
        const h = new Date(e.createdAt).getHours()
        if (h < 12) pattern.morning++
        else if (h < 17) pattern.afternoon++
        else pattern.evening++
      })
      return pattern
    })(),
  }

  const totalLogCount = state.entries.length

  const value = {
    entries: state.entries,
    isHydrated,
    totalLogCount,
    todayEntries,
    last7DaysEntries,
    diversityStats,
    consistencyStats,
    addEntry,
    deleteEntry,
    resetLog,
  }

  return (
    <JuiceLogContext.Provider value={value}>
      {children}
    </JuiceLogContext.Provider>
  )
}

export function useJuiceLog() {
  const ctx = useContext(JuiceLogContext)
  if (!ctx) throw new Error('useJuiceLog must be used within JuiceLogProvider')
  return ctx
}
