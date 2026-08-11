// ─────────────────────────────────────────────────────────────
// JuiceLogStore.js — Persisted juice log entries for Today dashboard.
//
// Each log entry records:
//   - id (uuid), createdAt (ISO), source (juice_snap|manual|wellness_focus|browse_ideas|todays_focus|today_spotlight|make_again|simple_blend|seasonal_glow|produce_recipe|glow_library|beginner_glow|unknown)
//   - title (short label), ingredients (array of produceIds)
//   - nutrientSummary (batch totals), scoreContribution
//   - ingredientDetails (optional array of { produceId, weightG, portionEntryMode, portionMetadata })
//   - rating (optional 1–5 stars, null = unrated)
//   - note (optional personal note string)
//   - favorite (optional boolean)
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

    case 'SET_TASTE_REACTION': {
      const { id, reaction } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, tasteReaction: reaction } : e
        ),
      }
    }

    case 'UPDATE_ENTRY': {
      const { id, updates } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      }
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

  const addEntry = useCallback(({ source, ingredientIds, nutrientSummary, scoreContribution, ingredientDetails }) => {
    const entry = {
      id: generateId(),
      createdAt: localISOString(),
      dateKey: localDateKey(),
      source: source || 'unknown',
      title: buildTitle(ingredientIds),
      ingredients: ingredientIds || [],
      nutrientSummary: nutrientSummary || {},
      scoreContribution: scoreContribution || null,
      // Optional portion data for Detailed History (Pro)
      // Array of { produceId, weightG, portionEntryMode, portionMetadata }
      ingredientDetails: Array.isArray(ingredientDetails) ? ingredientDetails : undefined,
      // Optional personal fields (Pro Detailed History)
      rating: undefined,   // 1–5 or null/undefined = unrated
      note: undefined,     // string or undefined
      favorite: undefined, // boolean or undefined
    }
    dispatch({ type: 'ADD_ENTRY', payload: entry })
    return entry
  }, [])

  const deleteEntry = useCallback((id) => {
    dispatch({ type: 'DELETE_ENTRY', payload: id })
  }, [])

  const setTasteReaction = useCallback((id, reaction) => {
    dispatch({ type: 'SET_TASTE_REACTION', payload: { id, reaction } })
  }, [])

  const setRating = useCallback((id, rating) => {
    // rating: 1–5 or null to clear
    const validRating = (typeof rating === 'number' && rating >= 1 && rating <= 5)
      ? Math.round(rating)
      : null
    dispatch({ type: 'UPDATE_ENTRY', payload: { id, updates: { rating: validRating } } })
  }, [])

  const setNote = useCallback((id, note) => {
    // note: string or null/undefined to clear
    const cleanNote = (typeof note === 'string' && note.trim().length > 0)
      ? note.trim().slice(0, 500)
      : null
    dispatch({ type: 'UPDATE_ENTRY', payload: { id, updates: { note: cleanNote } } })
  }, [])

  const toggleFavorite = useCallback((id) => {
    const entry = state.entries.find((e) => e.id === id)
    const current = entry?.favorite === true
    dispatch({ type: 'UPDATE_ENTRY', payload: { id, updates: { favorite: !current } } })
  }, [state.entries])

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
    setTasteReaction,
    setRating,
    setNote,
    toggleFavorite,
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
