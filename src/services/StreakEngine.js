// ─────────────────────────────────────────────────────────────
// StreakEngine.js — Streak tracking with grace days
// Safe, non-judgmental messaging. User controls to pause/reset.
// Gated behind ff_streaks_grace feature flag.
// ─────────────────────────────────────────────────────────────

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { trackEvent } from './AnalyticsService'

const STORAGE_KEY = '@juicing_streak_v1'
const DEFAULT_GRACE_DAYS = 1

// ── Helpers ──────────────────────────────────────────────────

function getTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(dateKeyA, dateKeyB) {
  const a = new Date(dateKeyA + 'T00:00:00')
  const b = new Date(dateKeyB + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

// ── Safe Messaging ───────────────────────────────────────────
// Non-judgmental, encouraging, no guilt-tripping.

function getStreakMessage(streak, graceDaysUsed, isPaused) {
  if (isPaused) return { text: 'Streak paused — take your time.', tone: 'neutral' }
  if (streak === 0) return { text: 'Ready when you are. Every juice counts.', tone: 'warm' }
  if (streak === 1) return { text: 'Day 1 — great start!', tone: 'encouraging' }
  if (streak <= 3) return { text: `${streak} days strong. Building momentum.`, tone: 'encouraging' }
  if (streak <= 7) return { text: `${streak}-day streak! You're finding your rhythm.`, tone: 'celebrating' }
  if (streak <= 14) return { text: `${streak} days — consistency is your superpower.`, tone: 'celebrating' }
  if (streak <= 30) return { text: `${streak}-day streak! Incredible dedication.`, tone: 'celebrating' }
  return { text: `${streak} days — you're a juicing legend.`, tone: 'celebrating' }
}

function getGraceMessage(graceDaysRemaining) {
  if (graceDaysRemaining <= 0) return null
  return {
    text: `Life happens — you have ${graceDaysRemaining} grace day${graceDaysRemaining > 1 ? 's' : ''} to keep your streak.`,
    tone: 'supportive',
  }
}

function getBreakMessage(previousStreak) {
  if (previousStreak <= 1) return { text: 'No worries — fresh start anytime.', tone: 'warm' }
  if (previousStreak <= 7) return { text: `Your ${previousStreak}-day streak ended. That was real progress — start again whenever you like.`, tone: 'warm' }
  return { text: `Your ${previousStreak}-day streak was amazing. Every streak starts with day one.`, tone: 'warm' }
}

// ── Reducer ──────────────────────────────────────────────────

function createEmptyStreak() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastLogDate: null,
    graceDaysUsed: 0,
    graceDaysAllowed: DEFAULT_GRACE_DAYS,
    isPaused: false,
    pausedAt: null,
    history: [],
  }
}

function streakReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      const hydrated = { ...state, ...action.payload }
      // Revalidate streak against actual gap since lastLogDate
      if (hydrated.lastLogDate && !hydrated.isPaused) {
        const gap = daysBetween(hydrated.lastLogDate, getTodayKey())
        if (gap > 1 + hydrated.graceDaysAllowed) {
          // Streak broken while app was closed
          hydrated.currentStreak = 0
        }
      }
      return hydrated
    }

    case 'RECORD_LOG': {
      const today = getTodayKey()
      if (state.lastLogDate === today) return state

      let newStreak = state.currentStreak
      let graceDaysUsed = 0

      if (state.isPaused) {
        // Resume from pause — start fresh streak
        newStreak = 1
      } else if (!state.lastLogDate) {
        // First ever log
        newStreak = 1
      } else {
        const gap = daysBetween(state.lastLogDate, today)
        if (gap === 1) {
          // Consecutive day
          newStreak = state.currentStreak + 1
        } else if (gap <= 1 + state.graceDaysAllowed) {
          // Within grace window
          graceDaysUsed = gap - 1
          newStreak = state.currentStreak + 1
        } else {
          // Streak broken
          newStreak = 1
        }
      }

      const longestStreak = Math.max(state.longestStreak, newStreak)
      const historyEntry = { date: today, streak: newStreak, graceDaysUsed }

      return {
        ...state,
        currentStreak: newStreak,
        longestStreak,
        lastLogDate: today,
        graceDaysUsed,
        isPaused: false,
        pausedAt: null,
        history: [...state.history.slice(-90), historyEntry],
      }
    }

    case 'PAUSE_STREAK':
      return {
        ...state,
        isPaused: true,
        pausedAt: getTodayKey(),
      }

    case 'RESUME_STREAK':
      return {
        ...state,
        isPaused: false,
        pausedAt: null,
      }

    case 'SET_GRACE_DAYS':
      return {
        ...state,
        graceDaysAllowed: Math.max(0, Math.min(action.payload.days, 3)),
      }

    case 'RESET_STREAK':
      return {
        ...createEmptyStreak(),
        longestStreak: state.longestStreak,
        graceDaysAllowed: state.graceDaysAllowed,
      }

    case 'DEV_ADVANCE_DAY': {
      // Simulate one more elapsed day by shifting lastLogDate back
      // and incrementing streak count
      const newStreak = state.currentStreak + 1
      let newLastLog = state.lastLogDate
      if (newLastLog) {
        const d = new Date(newLastLog + 'T00:00:00')
        d.setDate(d.getDate() - 1)
        newLastLog = d.toISOString().split('T')[0]
      }
      const newHistory = [...(state.history || [])]
      if (newLastLog) {
        newHistory.push({ date: newLastLog, streak: newStreak, graceDaysUsed: 0 })
      }
      return {
        ...state,
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak, newStreak),
        lastLogDate: newLastLog,
        history: newHistory.slice(-90),
      }
    }

    default:
      return state
  }
}

// ── Context + Provider ───────────────────────────────────────

const StreakContext = createContext(null)

export function StreakProvider({ children }) {
  const [state, dispatch] = useReducer(streakReducer, createEmptyStreak())

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        if (raw) dispatch({ type: 'HYDRATE', payload: JSON.parse(raw) })
      } catch (e) { /* use empty */ }
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
    const prevStreak = state.currentStreak
    dispatch({ type: 'RECORD_LOG' })

    // Determine if streak just started
    if (prevStreak === 0 && !state.isPaused) {
      trackEvent('streak_started', {
        grace_days_allowed: state.graceDaysAllowed,
        source: 'auto',
      })
    }
  }, [state.currentStreak, state.isPaused, state.graceDaysAllowed])

  const pauseStreak = useCallback(() => {
    dispatch({ type: 'PAUSE_STREAK' })
  }, [])

  const resumeStreak = useCallback(() => {
    dispatch({ type: 'RESUME_STREAK' })
  }, [])

  const setGraceDays = useCallback((days) => {
    dispatch({ type: 'SET_GRACE_DAYS', payload: { days } })
  }, [])

  const resetStreak = useCallback(() => {
    const prevStreak = state.currentStreak
    dispatch({ type: 'RESET_STREAK' })
    if (prevStreak > 0) {
      trackEvent('streak_broken', {
        streak_length_bucket: prevStreak,
        grace_days_used: state.graceDaysUsed,
        break_reason: 'user_reset',
      })
    }
  }, [state.currentStreak, state.graceDaysUsed])

  const devAdvanceDay = useCallback(() => {
    dispatch({ type: 'DEV_ADVANCE_DAY' })
  }, [])

  // Check if streak is at risk (gap detected but still within grace)
  const streakStatus = useMemo(() => {
    const today = getTodayKey()
    if (state.isPaused) return 'paused'
    if (!state.lastLogDate) return 'none'
    if (state.lastLogDate === today) return 'logged_today'

    const gap = daysBetween(state.lastLogDate, today)
    if (gap <= 1) return 'active'
    if (gap <= 1 + state.graceDaysAllowed) return 'grace'
    return 'broken'
  }, [state.lastLogDate, state.isPaused, state.graceDaysAllowed])

  const graceDaysRemaining = useMemo(() => {
    if (state.isPaused || !state.lastLogDate) return state.graceDaysAllowed
    const today = getTodayKey()
    const gap = daysBetween(state.lastLogDate, today)
    return Math.max(0, state.graceDaysAllowed - (gap - 1))
  }, [state.lastLogDate, state.isPaused, state.graceDaysAllowed])

  const message = useMemo(() => {
    if (streakStatus === 'broken') {
      return getBreakMessage(state.currentStreak) || { text: 'Fresh start anytime.', tone: 'warm' }
    }
    if (streakStatus === 'grace') {
      return getGraceMessage(graceDaysRemaining) || getStreakMessage(state.currentStreak, state.graceDaysUsed, state.isPaused)
    }
    return getStreakMessage(state.currentStreak, state.graceDaysUsed, state.isPaused)
  }, [streakStatus, state.currentStreak, state.graceDaysUsed, state.isPaused, graceDaysRemaining])

  const value = useMemo(() => ({
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    lastLogDate: state.lastLogDate,
    graceDaysAllowed: state.graceDaysAllowed,
    graceDaysRemaining,
    isPaused: state.isPaused,
    streakStatus,
    message,
    history: state.history,
    recordLog,
    pauseStreak,
    resumeStreak,
    setGraceDays,
    resetStreak,
    devAdvanceDay,
  }), [state, graceDaysRemaining, streakStatus, message, recordLog, pauseStreak, resumeStreak, setGraceDays, resetStreak, devAdvanceDay])

  return (
    <StreakContext.Provider value={value}>
      {children}
    </StreakContext.Provider>
  )
}

export function useStreak() {
  const ctx = useContext(StreakContext)
  if (!ctx) throw new Error('useStreak must be used within <StreakProvider>')
  return ctx
}

export { getStreakMessage, getGraceMessage, getBreakMessage }
