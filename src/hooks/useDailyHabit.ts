// ─────────────────────────────────────────────────────────────
// useDailyHabit.ts — Daily habit state for dashboard
// Tracks currentStreak, lastJuiceDate, weeklyCount.
// Uses AsyncStorage for persistence. Structured for future expansion.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const HABIT_KEY = '@juicing_daily_habit_v1'

interface DailyHabitState {
  currentStreak: number
  lastJuiceDate: string | null
  weeklyCount: number
  weekStartDate: string | null
}

function createEmpty(): DailyHabitState {
  return {
    currentStreak: 0,
    lastJuiceDate: null,
    weeklyCount: 0,
    weekStartDate: null,
  }
}

function getTodayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getYesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekStart(): string {
  const d = new Date()
  const dow = d.getDay()
  const diff = d.getDate() - dow + (dow === 0 ? -6 : 1)
  const monday = new Date(d.getFullYear(), d.getMonth(), diff)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const day = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useDailyHabit() {
  const [state, setState] = useState<DailyHabitState>(createEmpty)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from storage
  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(HABIT_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          const currentWeekStart = getWeekStart()

          // Reset weekly count if we're in a new week
          if (parsed.weekStartDate !== currentWeekStart) {
            parsed.weeklyCount = 0
            parsed.weekStartDate = currentWeekStart
          }

          // Reset streak if last juice was before yesterday
          const today = getTodayKey()
          const yesterday = getYesterdayKey()
          if (parsed.lastJuiceDate && parsed.lastJuiceDate !== today && parsed.lastJuiceDate !== yesterday) {
            parsed.currentStreak = 0
          }

          setState(parsed)
        }
      } catch (e) {
        console.warn('[useDailyHabit] hydrate failed:', (e as Error)?.message)
      } finally {
        setIsHydrated(true)
      }
    })()
  }, [])

  // Persist on change
  useEffect(() => {
    if (!isHydrated) return
    ;(async () => {
      try {
        await AsyncStorage.setItem(HABIT_KEY, JSON.stringify(state))
      } catch (e) {
        console.warn('[useDailyHabit] persist failed:', (e as Error)?.message)
      }
    })()
  }, [state, isHydrated])

  const recordJuice = useCallback(() => {
    setState((prev) => {
      const today = getTodayKey()
      const yesterday = getYesterdayKey()
      const currentWeekStart = getWeekStart()

      let newStreak = prev.currentStreak
      if (prev.lastJuiceDate === today) {
        // Already logged today — no streak change
      } else if (!prev.lastJuiceDate || prev.lastJuiceDate === yesterday) {
        newStreak = prev.currentStreak + 1
      } else {
        newStreak = 1
      }

      let newWeekly = prev.weeklyCount
      if (prev.weekStartDate === currentWeekStart) {
        if (prev.lastJuiceDate !== today) {
          newWeekly = prev.weeklyCount + 1
        }
      } else {
        newWeekly = 1
      }

      return {
        currentStreak: newStreak,
        lastJuiceDate: today,
        weeklyCount: newWeekly,
        weekStartDate: currentWeekStart,
      }
    })
  }, [])

  const resetHabit = useCallback(async () => {
    setState(createEmpty())
    try {
      await AsyncStorage.removeItem(HABIT_KEY)
    } catch (e) {
      console.warn('[useDailyHabit] reset failed:', (e as Error)?.message)
    }
  }, [])

  return {
    currentStreak: state.currentStreak,
    lastJuiceDate: state.lastJuiceDate,
    weeklyCount: state.weeklyCount,
    hasLoggedToday: state.lastJuiceDate === getTodayKey(),
    recordJuice,
    resetHabit,
    isHydrated,
  }
}
