// ─────────────────────────────────────────────────────────────
// NudgeSettingsStore.js — Persistence for Motivation Reminders
//
// Stores user preferences for the three nudge types:
//   - Daily Glow Reminder
//   - Streak Protector
//   - Weekly Glow Summary
//
// All settings default ON (nudges_enabled defaults to true).
// Uses AsyncStorage directly for simplicity.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@nudge_settings'

const DEFAULTS = {
  nudges_enabled: true,
  nudges_daily_enabled: true,
  nudges_daily_time: '08:30',
  nudges_streakRisk_enabled: true,
  nudges_streakRisk_time: '18:00',
  nudges_weekly_enabled: true,
  nudges_weekly_day: 0, // 0 = Sunday
  nudges_weekly_time: '19:00',
}

export async function getNudgeSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export async function setNudgeSettings(partial) {
  try {
    const current = await getNudgeSettings()
    const updated = { ...current, ...partial }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch { /* ignore */ }
  return null
}

export async function resetNudgeSettings() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export { DEFAULTS as NUDGE_DEFAULTS }
