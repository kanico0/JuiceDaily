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
import { getDevNow } from '../utils/DevClock'
import { getNudgeSettings } from './NudgeSettingsStore'
import {
  loadNotificationSettings,
  canSendNotification,
  isTimeInQuietHours,
  incrementSentToday,
  enforceGlobalNotificationCap,
} from './NotificationCapPolicy'
import { archiveScheduledNotification, removePendingArchiveEntry } from './NotificationHistoryService'

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
  Notifications.getPermissionsAsync().catch((e) => {
    available = false
    console.warn('[nudges] availability guard set to FALSE — getPermissionsAsync rejected:', e?.name || 'unknown', e?.message || '')
  })
} catch (e) {
  available = false
  console.warn('[nudges] availability guard set to FALSE — synchronous throw:', e?.name || 'unknown', e?.message || '')
}

// ── Permissions ──────────────────────────────────────────────

export async function ensurePermissions() {
  if (!available) {
    console.warn('[nudges] ensurePermissions SKIP — available=false')
    return false
  }
  try {
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') {
      console.log('[nudges] ensurePermissions OK — already granted')
      return true
    }
    const { status } = await Notifications.requestPermissionsAsync()
    console.log('[nudges] ensurePermissions requestPermissionsAsync → status:', status)
    return status === 'granted'
  } catch (e) {
    console.warn('[nudges] ensurePermissions FAIL:', e?.name || 'unknown', e?.message || '')
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
    console.log('[nudges] setAndroidNotificationChannel OK | channelId: nudges')
  } catch (e) {
    console.warn('[nudges] setAndroidNotificationChannel FAIL:', e?.name || 'unknown', e?.message || '')
  }
}

// ── Safe helpers ─────────────────────────────────────────────

async function safeCancel(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
    await removePendingArchiveEntry(id).catch(() => {})
  } catch { /* ignore */ }
}

async function safeSchedule({ id, title, body, data, triggerDate }) {
  if (!available) {
    console.warn('[nudges] safeSchedule SKIP — available=false | id:', id)
    return false
  }
  try {
    await safeCancel(id)

    // Respect NotificationService intensity caps and quiet hours
    const notifSettings = await loadNotificationSettings()
    if (!notifSettings.enabled) {
      console.warn('[nudges] safeSchedule BLOCKED — settings.enabled=false | id:', id)
      return false
    }

    // For near-future nudges, check the daily cap right now
    const isNearFuture = !triggerDate || (triggerDate - Date.now() < 60000)
    if (isNearFuture) {
      const allowed = await canSendNotification(notifSettings)
      if (!allowed) {
        console.warn('[nudges] safeSchedule BLOCKED by canSendNotification | id:', id, 'intensity:', notifSettings.intensity)
        return false
      }
    }

    // Check if the scheduled trigger time falls in quiet hours
    if (triggerDate && !isTimeInQuietHours(triggerDate.getHours(), triggerDate.getMinutes(), notifSettings)) {
      // not in quiet hours — OK to schedule
    } else if (triggerDate) {
      // trigger falls in quiet hours — skip scheduling
      console.warn('[nudges] safeSchedule BLOCKED by quiet hours | id:', id, 'trigger:', new Date(triggerDate).toISOString())
      return false
    }

    const fullText = String(body || '')
    const notificationType = String(data?.type || 'unknown')
    const scheduledForMs = triggerDate ? new Date(triggerDate).getTime() : null

    const content = {
      title,
      body: fullText,
      data: {
        ...data,
        rawLifeFlowNotification: true,
        notificationId: id,
        notificationType,
        fullText,
        scheduledFor: scheduledForMs,
        sentAt: new Date().toISOString(),
      },
      sound: 'glass_clink.wav',
    }
    if (Platform.OS === 'android') {
      content.channelId = 'nudges'
    }
    const triggerIso = triggerDate ? new Date(triggerDate).toISOString() : 'immediate'
    const trigger = triggerDate
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: 'nudges',
        }
      : null
    const result = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
      identifier: id,
    })
    console.log('[nudges] safeSchedule OK | id:', id, 'trigger:', triggerIso, 'result:', result || '(no id returned)')
    if (isNearFuture) await incrementSentToday()
    // Archive the notification for Recent Notifications page
    await archiveScheduledNotification({
      scheduleIdentifier: id,
      title: String(title || ''),
      fullText,
      notificationType,
      scheduledFor: scheduledForMs,
    }).catch(() => {})
    return true
  } catch (e) {
    console.warn('[nudges] safeSchedule FAIL | id:', id, 'error:', e?.name || 'unknown', e?.message || '')
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
  const d = getDevNow()
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
    console.log('[nudges] refreshNudges START | enabled:', settings.nudges_enabled, 'daily:', settings.nudges_daily_enabled, 'streakRisk:', settings.nudges_streakRisk_enabled, 'weekly:', settings.nudges_weekly_enabled)

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

    // Enforce global daily intensity cap across all scheduled
    // ordinary notifications from both services.
    const notifSettings = await loadNotificationSettings()
    await enforceGlobalNotificationCap(notifSettings)

    // Diagnostic: dump all scheduled notifications after refresh
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync()
      console.log('[nudges] refreshNudges DIAGNOSTIC | scheduledCount:', scheduled.length)
      for (const s of scheduled) {
        const trigger = s.trigger
        const triggerStr = trigger?.date || (trigger?.hour !== undefined ? `${trigger.hour}:${trigger.minute}` : JSON.stringify(trigger || {}))
        console.log('[nudges] scheduled | id:', s.identifier, 'trigger:', triggerStr)
      }
    } catch (e) {
      console.warn('[nudges] refreshNudges DIAGNOSTIC FAIL:', e?.name || 'unknown', e?.message || '')
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

export async function sendThreeDayTestNudges() {
  const baseTime = Date.now()
  const testNudges = [
    { id: 'nudge-test-day-1', title: 'Day 1 · Keep your glow going ✨', body: 'Ready for today\'s juice?' },
    { id: 'nudge-test-day-2', title: 'Day 2 · Your streak is waiting', body: 'A quick check-in keeps your streak alive.' },
    { id: 'nudge-test-day-3', title: 'Day 3 · Your glow week is building', body: 'See the progress you\'re creating.' },
  ]
  const results = await Promise.all(testNudges.map((nudge, index) => safeSchedule({
    ...nudge,
    data: { type: 'three_day_test', day: index + 1 },
    triggerDate: new Date(baseTime + (index + 1) * 5000),
  })))
  return results.every(Boolean)
}
