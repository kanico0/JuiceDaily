// ─────────────────────────────────────────────────────────────
// glowStreak.js — Glow Streak daily check-in persistence
//
// Tracks a daily juicing streak with silent streak protection.
// - 1 missed day (gap == 2): streak silently preserved
// - 2+ missed days (gap >= 3): streak resets calmly
// - Manual "Not today" grace: one free skip per streak cycle
// Uses AsyncStorage with device-local dates (YYYY-MM-DD).
// Respects DevClock for testing.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDevNow } from '../utils/DevClock'

const KEY_COUNT = 'glowStreak_count'
const KEY_LAST_DATE = 'glowStreak_lastCheckInDate'
const KEY_GRACE_DATE = 'glowStreak_graceUsedDate'
const KEY_FIRST_DATE = 'glowStreak_firstCheckInDate'

function getTodayKey() {
  const d = getDevNow()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Days between two YYYY-MM-DD strings
function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return 0
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  return Math.round(Math.abs(b - a) / 86400000)
}

export async function getGlowState() {
  const [rawCount, lastCheckInDate, graceUsedDate, firstCheckInDate] = await Promise.all([
    AsyncStorage.getItem(KEY_COUNT),
    AsyncStorage.getItem(KEY_LAST_DATE),
    AsyncStorage.getItem(KEY_GRACE_DATE),
    AsyncStorage.getItem(KEY_FIRST_DATE),
  ])
  return {
    count: rawCount ? parseInt(rawCount, 10) : 0,
    lastCheckInDate: lastCheckInDate || undefined,
    graceUsedDate: graceUsedDate || undefined,
    firstCheckInDate: firstCheckInDate || undefined,
  }
}

// "Yes, I juiced" — increment streak once per day
// Silent streak protection: if gap == 2 days, streak preserved.
// If gap >= 3 days, streak resets to 1 (this new check-in).
export async function checkInToday() {
  const today = getTodayKey()
  const state = await getGlowState()

  // Already checked in today
  if (state.lastCheckInDate === today) {
    return { count: state.count, wasIncremented: false, silentGrace: false, wasReset: false }
  }

  const gap = state.lastCheckInDate ? daysBetween(state.lastCheckInDate, today) : 0

  // Gap >= 3 days → streak resets, start new cycle at 1
  if (gap >= 3) {
    await AsyncStorage.multiSet([
      [KEY_COUNT, '1'],
      [KEY_LAST_DATE, today],
      [KEY_GRACE_DATE, ''],
      [KEY_FIRST_DATE, today],
    ])
    return { count: 1, wasIncremented: true, silentGrace: false, wasReset: true }
  }

  // Gap == 2 → silent grace (1 missed day), streak continues
  const silentGrace = gap === 2

  const newCount = state.count + 1
  const sets = [
    [KEY_COUNT, String(newCount)],
    [KEY_LAST_DATE, today],
  ]
  // Record first check-in date if not set
  if (!state.firstCheckInDate) {
    sets.push([KEY_FIRST_DATE, today])
  }
  await AsyncStorage.multiSet(sets)

  return { count: newCount, wasIncremented: true, silentGrace, wasReset: false }
}

// "Not today" — manual grace: one free skip per streak cycle
export async function skipToday() {
  const today = getTodayKey()
  const state = await getGlowState()

  // Grace not yet used for this streak cycle
  if (!state.graceUsedDate || state.graceUsedDate !== today) {
    // Check if grace was already used on a previous day (2nd skip)
    if (state.graceUsedDate && state.graceUsedDate !== '') {
      // Grace was already used on a different day → reset streak calmly
      await AsyncStorage.multiSet([
        [KEY_COUNT, '0'],
        [KEY_GRACE_DATE, ''],
      ])
      return { count: 0, usedGrace: false, streakReset: true }
    }
    // First grace use in this streak cycle
    await AsyncStorage.setItem(KEY_GRACE_DATE, today)
    return { count: state.count, usedGrace: true, streakReset: false }
  }

  // Grace already used today — no-op, streak protected
  return { count: state.count, usedGrace: true, streakReset: false }
}

// Dev/testing: clear all glow streak data
export async function resetGlowStreak() {
  await AsyncStorage.multiRemove([KEY_COUNT, KEY_LAST_DATE, KEY_GRACE_DATE, KEY_FIRST_DATE])
}
