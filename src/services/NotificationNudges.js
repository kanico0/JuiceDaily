// ─────────────────────────────────────────────────────────────
// NotificationNudges.js — Motivation Notification System
//
// Three nudge types:
//   1. Daily Glow Reminder (user-chosen time)
//   2. Streak Protector (evening if no check-in)
//   3. Weekly Glow Summary (chosen day + time)
//
// Strategy A: schedule only the NEXT upcoming notification,
// then reschedule on app foreground / check-in via refreshNudges().
// This allows "logic gating" — e.g. cancel streak-risk if
// user already checked in today.
// ─────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { getGlowState } from './glowStreak'
import { getNudgeSettings } from './NudgeSettingsStore'

// ── Notification IDs ─────────────────────────────────────────

const IDS = {
  DAILY: 'nudge-daily-glow',
  STREAK_RISK: 'nudge-streak-risk',
  WEEKLY: 'nudge-weekly-summary',
  TEST: 'nudge-test',
}

// ── Availability guard ───────────────────────────────────────

let available = true
try {
  Notifications.getPermissionsAsync().catch(() => { available = false })
} catch {
  available = false
}

// ── Permissions ──────────────────────────────────────────────

export async function ensurePermissions() {
  if (!available) return false
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

// ── Android Channel ──────────────────────────────────────────

export async function setAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.setNotificationChannelAsync('nudges', {
      name: 'Motivation Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#81C784',
      sound: 'glass_clink.wav',
    })
  } catch {
    // Channel setup failed — non-fatal
  }
}

// ── Safe helpers ─────────────────────────────────────────────

async function safeCancel(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch { /* ignore */ }
}

async function safeSchedule({ id, title, body, data, triggerDate }) {
  if (!available) return false
  try {
    await safeCancel(id)
    const content = {
      title,
      body,
      data: { ...data, sentAt: new Date().toISOString() },
      sound: 'glass_clink.wav',
    }
    if (Platform.OS === 'android') {
      content.channelId = 'nudges'
    }
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: triggerDate ? { date: triggerDate } : null,
      identifier: id,
    })
    return true
  } catch {
    return false
  }
}

// ── Parse "HH:MM" string ────────────────────────────────────

function parseTime(timeStr) {
  const [h, m] = (timeStr || '08:30').split(':').map(Number)
  return { hour: h || 0, minute: m || 0 }
}

// ── Next occurrence of a given time ─────────────────────────

function nextOccurrence(hour, minute) {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  if (target <= now) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

// ── Next occurrence of a given weekday + time ───────────────

function nextWeekdayOccurrence(dayOfWeek, hour, minute) {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)

  const currentDay = now.getDay()
  let daysUntil = (dayOfWeek - currentDay + 7) % 7

  // If it's the same day but time already passed, schedule next week
  if (daysUntil === 0 && target <= now) {
    daysUntil = 7
  }

  target.setDate(target.getDate() + daysUntil)
  return target
}

// ── Today key (YYYY-MM-DD) ──────────────────────────────────

function getTodayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════
// Schedule Individual Nudges
// ═══════════════════════════════════════════════════════════════

export async function scheduleDailyNudge(timeHHMM) {
  const { hour, minute } = parseTime(timeHHMM)
  const triggerDate = nextOccurrence(hour, minute)

  return safeSchedule({
    id: IDS.DAILY,
    title: 'Keep your glow going ✨',
    body: 'Ready for today\'s juice?',
    data: { type: 'daily', action: 'open_dashboard' },
    triggerDate,
  })
}

export async function scheduleStreakRiskNudge(timeHHMM) {
  const { hour, minute } = parseTime(timeHHMM)
  const triggerDate = nextOccurrence(hour, minute)

  return safeSchedule({
    id: IDS.STREAK_RISK,
    title: 'Glow streak check-in',
    body: 'A quick check-in keeps your streak alive.',
    data: { type: 'streakRisk', action: 'open_dashboard' },
    triggerDate,
  })
}

export async function scheduleWeeklySummaryNudge(dayOfWeek, timeHHMM) {
  const { hour, minute } = parseTime(timeHHMM)
  const triggerDate = nextWeekdayOccurrence(dayOfWeek, hour, minute)

  return safeSchedule({
    id: IDS.WEEKLY,
    title: 'Your Glow Week is ready',
    body: 'See your weekly progress in 10 seconds.',
    data: { type: 'weekly', action: 'open_weekly_report' },
    triggerDate,
  })
}

// ═══════════════════════════════════════════════════════════════
// Cancel All Nudges
// ═══════════════════════════════════════════════════════════════

export async function cancelAllNudges() {
  await Promise.all([
    safeCancel(IDS.DAILY),
    safeCancel(IDS.STREAK_RISK),
    safeCancel(IDS.WEEKLY),
    safeCancel(IDS.TEST),
  ])
}

// ═══════════════════════════════════════════════════════════════
// refreshNudges() — Main orchestrator
//
// Called on:
//   - App foreground (AppState → "active")
//   - After checkInToday() succeeds
//   - After a successful juice log
//
// Reads user settings + glow state, then schedules/cancels
// the next occurrence of each nudge type.
// ═══════════════════════════════════════════════════════════════

export async function refreshNudges() {
  try {
    const settings = await getNudgeSettings()

    // Master toggle off → cancel everything
    if (!settings.nudges_enabled) {
      await cancelAllNudges()
      return
    }

    // Ensure Android channel exists
    await setAndroidNotificationChannel()

    // ── Daily Glow Reminder ──
    if (settings.nudges_daily_enabled) {
      await scheduleDailyNudge(settings.nudges_daily_time)
    } else {
      await safeCancel(IDS.DAILY)
    }

    // ── Streak Protector ──
    // Only schedule if user has a streak AND hasn't checked in today
    if (settings.nudges_streakRisk_enabled) {
      const glowState = await getGlowState()
      const today = getTodayKey()
      const hasCheckedInToday = glowState.lastCheckInDate === today
      const hasStreak = glowState.count > 0

      if (hasStreak && !hasCheckedInToday) {
        await scheduleStreakRiskNudge(settings.nudges_streakRisk_time)
      } else {
        // Already checked in today or no streak — cancel streak risk
        await safeCancel(IDS.STREAK_RISK)
      }
    } else {
      await safeCancel(IDS.STREAK_RISK)
    }

    // ── Weekly Summary ──
    if (settings.nudges_weekly_enabled) {
      await scheduleWeeklySummaryNudge(
        settings.nudges_weekly_day,
        settings.nudges_weekly_time,
      )
    } else {
      await safeCancel(IDS.WEEKLY)
    }
  } catch (e) {
    console.warn('[NotificationNudges] refreshNudges error:', e)
  }
}

// ═══════════════════════════════════════════════════════════════
// Test Notification (dev)
// ═══════════════════════════════════════════════════════════════

export async function sendTestNudge() {
  const triggerDate = new Date(Date.now() + 5000)
  return safeSchedule({
    id: IDS.TEST,
    title: 'Test nudge 🧪',
    body: 'If you see this, notifications are working!',
    data: { type: 'test' },
    triggerDate,
  })
}
