// ─────────────────────────────────────────────────────────────
// weeklySummary.js — Weekly Glow Summary (7-day hook)
//
// Shows a "Your Glow Week" card once per 7-day cycle.
// Persists cycle start and last-shown dates via AsyncStorage.
// Respects DevClock for testing.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDevNow } from '../utils/DevClock'

const KEY_LAST_SHOWN = 'weeklySummary_lastShownDate'
const KEY_CYCLE_START = 'weeklySummary_cycleStartDate'

function getTodayKey() {
  const d = getDevNow()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return 0
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  return Math.round(Math.abs(b - a) / 86400000)
}

// Check if we should show the weekly summary card today.
// Returns { show: boolean, cycleDay: number }
export async function shouldShowWeeklySummary() {
  const today = getTodayKey()
  const [lastShown, cycleStart] = await Promise.all([
    AsyncStorage.getItem(KEY_LAST_SHOWN),
    AsyncStorage.getItem(KEY_CYCLE_START),
  ])

  // No cycle started yet — start one now
  if (!cycleStart) {
    await AsyncStorage.setItem(KEY_CYCLE_START, today)
    return { show: false, cycleDay: 1 }
  }

  const cycleDay = daysBetween(cycleStart, today) + 1

  // Not yet 7 days into cycle
  if (cycleDay < 7) {
    return { show: false, cycleDay }
  }

  // Already shown in this cycle
  if (lastShown) {
    const daysSinceShown = daysBetween(lastShown, today)
    const daysSinceCycleStart = daysBetween(cycleStart, today)
    // If shown within the current 7-day window, don't show again
    if (daysSinceShown < 7 && daysSinceCycleStart < 14) {
      return { show: false, cycleDay }
    }
  }

  return { show: true, cycleDay }
}

// Mark weekly summary as shown and start next cycle
export async function dismissWeeklySummary() {
  const today = getTodayKey()
  await AsyncStorage.multiSet([
    [KEY_LAST_SHOWN, today],
    [KEY_CYCLE_START, today],
  ])
}

// Build summary data from available context
export function buildWeeklySummaryData({ juicesThisWeek, glowStreak, recentNutrients }) {
  // Pick a highlight nutrient from recent logs (or placeholder)
  const highlightNutrient = recentNutrients && recentNutrients.length > 0
    ? recentNutrients[0]
    : 'Vitamin C'

  return {
    juicesThisWeek: juicesThisWeek || 0,
    glowStreak: glowStreak || 0,
    highlightNutrient,
  }
}

// Dev reset
export async function resetWeeklySummary() {
  await AsyncStorage.multiRemove([KEY_LAST_SHOWN, KEY_CYCLE_START])
}
