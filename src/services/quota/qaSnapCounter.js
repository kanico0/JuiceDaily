// ─────────────────────────────────────────────────────────────
// qaSnapCounter.js — QA-only client Snap usage counter
//
// Tracks Juice Snap usage when QA Pro Simulation is active.
// This is CLIENT SIMULATION ONLY — it does NOT affect server
// quota. The actual remote AI request may still be rejected
// if the server sees the account as Free.
//
// Resettable from Developer Options.
// Never available in production builds.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDevNow } from '../../utils/DevClock'

const QA_SNAP_KEY = '@juicing_qa_pro_snap_counter_v1'
const QA_SNAP_RESET_KEY = '@juicing_qa_pro_snap_reset_v1'

/**
 * Get the QA Pro snap usage record.
 * Returns { used: number, monthKey: string }
 */
export async function getQaProSnapUsage() {
  try {
    const raw = await AsyncStorage.getItem(QA_SNAP_KEY)
    if (!raw) return { used: 0, monthKey: currentMonthKey() }
    const parsed = JSON.parse(raw)
    const month = currentMonthKey()
    if (parsed.monthKey !== month) {
      // New month — reset usage
      return { used: 0, monthKey: month }
    }
    return { used: parsed.used || 0, monthKey: parsed.monthKey }
  } catch {
    return { used: 0, monthKey: currentMonthKey() }
  }
}

/**
 * Increment the QA Pro snap usage counter.
 * Returns the updated usage.
 */
export async function incrementQaProSnapUsage() {
  const current = await getQaProSnapUsage()
  const updated = { used: current.used + 1, monthKey: current.monthKey }
  await AsyncStorage.setItem(QA_SNAP_KEY, JSON.stringify(updated))
  return updated
}

/**
 * Reset the QA Pro snap usage counter.
 */
export async function resetQaProSnapUsage() {
  const month = currentMonthKey()
  const reset = { used: 0, monthKey: month }
  await AsyncStorage.setItem(QA_SNAP_KEY, JSON.stringify(reset))
  await AsyncStorage.setItem(QA_SNAP_RESET_KEY, new Date().toISOString())
  return reset
}

/**
 * Get the remaining QA Pro snaps for the month.
 * @param {number} limit - The Pro monthly limit (default 12)
 * @returns {Promise<number>}
 */
export async function getQaProSnapRemaining(limit = 12) {
  const { used } = await getQaProSnapUsage()
  return Math.max(0, limit - used)
}

function currentMonthKey() {
  const d = getDevNow()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
