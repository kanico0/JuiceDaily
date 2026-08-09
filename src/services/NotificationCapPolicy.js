// ─────────────────────────────────────────────────────────────
// NotificationCapPolicy.js — Shared notification intensity cap
//
// Independent module owning:
//   - INTENSITY_CAPS
//   - notification priority definitions
//   - notification classification (all notifications count)
//   - local-day grouping
//   - enforceGlobalNotificationCap()
//   - settings persistence (load/save)
//   - sentToday counter (get/increment)
//   - canSendNotification()
//   - isTimeInQuietHours()
//
// This module MUST NOT import NotificationService or
// NotificationNudges. Both services import from here.
// ─────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Lazy import to avoid pulling supabase/identity (and its transitive
// deps like react-native-url-polyfill) at module load time. This
// prevents test failures in modules that import NotificationCapPolicy
// without mocking the full Supabase chain.
let _removePendingArchiveEntry = null
async function getRemovePendingArchiveEntry() {
  if (!_removePendingArchiveEntry) {
    const mod = await import('./NotificationHistoryService')
    _removePendingArchiveEntry = mod.removePendingArchiveEntry
  }
  return _removePendingArchiveEntry
}

// ── Intensity Caps ───────────────────────────────────────────

export const INTENSITY_CAPS = {
  zen: 1,
  balanced: 3,
  'high-vibe': 5,
}

// ── Default Settings ─────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  enabled: true,
  intensity: 'balanced',
  quietStart: { hour: 21, minute: 30 },
  quietEnd: { hour: 6, minute: 30 },
  affirmations: true,
  vitalityReminders: true,
  freezerAlerts: true, // Legacy field — tolerated, no longer drives behavior
  comebackReminders: true, // Legacy field — tolerated, no longer drives behavior (retired 1.0.20)
  typicalJuiceHour: 7,
  typicalJuiceMinute: 30,
}

// ── Storage Keys ─────────────────────────────────────────────

const KEYS = {
  SENT_TODAY: '@notif_sent_today',
  SENT_DATE: '@notif_sent_date',
  SETTINGS: '@notification_settings',
}

// ── Settings Persistence ─────────────────────────────────────

export async function loadNotificationSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS }
}

export async function saveNotificationSettings(settings) {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings))
  } catch (e) { /* ignore */ }
}

// ── Frequency Cap (sentToday counter) ────────────────────────

export async function getSentToday() {
  try {
    const dateStr = await AsyncStorage.getItem(KEYS.SENT_DATE)
    const today = new Date().toISOString().split('T')[0]
    if (dateStr !== today) {
      await AsyncStorage.setItem(KEYS.SENT_DATE, today)
      await AsyncStorage.setItem(KEYS.SENT_TODAY, '0')
      return 0
    }
    const count = parseInt(await AsyncStorage.getItem(KEYS.SENT_TODAY) || '0', 10)
    return count
  } catch (e) { return 0 }
}

export async function incrementSentToday() {
  try {
    const count = await getSentToday()
    await AsyncStorage.setItem(KEYS.SENT_TODAY, String(count + 1))
  } catch (e) { /* ignore */ }
}

// ── canSendNotification ──────────────────────────────────────
// Checks the sentToday counter and quiet hours for near-future
// delivery. No isEmergency bypass — all notifications count.

export async function canSendNotification(settings) {
  if (!settings.enabled) return false

  // Frequency cap
  const sent = await getSentToday()
  const cap = INTENSITY_CAPS[settings.intensity] || 3
  if (sent >= cap) return false

  // Quiet hours check
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  if (isTimeInQuietHours(hour, minute, settings)) return false

  return true
}

// ── Quiet Hours ──────────────────────────────────────────────

export function isTimeInQuietHours(hour, minute, settings) {
  const targetMin = hour * 60 + minute
  const quietStartMin = settings.quietStart.hour * 60 + settings.quietStart.minute
  const quietEndMin = settings.quietEnd.hour * 60 + settings.quietEnd.minute

  if (quietStartMin > quietEndMin) {
    return targetMin >= quietStartMin || targetMin < quietEndMin
  }
  return targetMin >= quietStartMin && targetMin < quietEndMin
}

// ── Global Notification Priority ─────────────────────────────
// Every active user-facing notification counts toward the cap.
// Lower index = higher priority (kept first when cap exceeded).

export const NOTIFICATION_PRIORITY = [
  'identity-affirmation',     // 1. Core daily affirmation
  'nudge-daily-glow',         // 2. User's primary daily reminder
  'educational-tip',          // 3. Educational/vitality content
  'nudge-streak-risk',        // 4. Streak protector
  'streak-shield',            // 5. Streak shield (loss aversion)
  'nudge-weekly-summary',     // 6. Weekly glow summary
  'freezer-morning',          // 7. (Legacy — no longer scheduled)
  'wilt-warning',             // 8. (Retired 1.0.20 — kept for cap priority legacy)
  'saturday-rainbow-nudge',   // 9. (Retired 1.0.20 — kept for cap priority legacy)
  'dormant-reminder-day-7',   // 10. Comeback reminder 7-day
  'dormant-reminder-day-14',  // 11. Comeback reminder 14-day
  'dormant-reminder-day-30',  // 12. Comeback reminder 30-day
  'dormant-reminder-day-60',  // 13. Comeback reminder 60-day
  'surprise-',                // 14. Surprise & delight (prefix)
  'weight-',                  // 15. Weight milestone (prefix)
  'onboarding-',              // 16. Onboarding sequence (prefix)
]

// ── Notification Classification ──────────────────────────────
// ALL user-facing notifications count toward the cap.
// No exemptions. No emergency bypass.

export function getNotificationPriority(id) {
  // Check exact match first
  const exactIdx = NOTIFICATION_PRIORITY.indexOf(id)
  if (exactIdx !== -1) return exactIdx
  // Check prefix matches (surprise-, weight-, onboarding-)
  for (let i = 0; i < NOTIFICATION_PRIORITY.length; i++) {
    const entry = NOTIFICATION_PRIORITY[i]
    if (entry.endsWith('-') && id.startsWith(entry)) return i
  }
  // Unknown notifications get lowest priority
  return NOTIFICATION_PRIORITY.length
}

export function getLocalDayKey(timestamp) {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Safe Cancel ──────────────────────────────────────────────

async function safeCancel(id) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
    // Remove the pending archive entry so Recent Notifications
    // doesn't claim the user received something that was canceled.
    const removePending = await getRemovePendingArchiveEntry()
    await removePending(id).catch(() => {})
  } catch (e) { /* ignore */ }
}

// ── Enforce Global Daily Intensity Cap ───────────────────────
// Gets all scheduled notifications, groups by local calendar day,
// cancels excess lowest-priority notifications per day.
//
// @param {object} settings - Notification settings with intensity
// @returns {Promise<string[]>} Array of cancelled notification IDs

export async function enforceGlobalNotificationCap(settings) {
  if (!settings || !settings.enabled) return []
  const cap = INTENSITY_CAPS[settings.intensity] || 3

  let scheduled
  try {
    scheduled = await Notifications.getAllScheduledNotificationsAsync()
  } catch (e) {
    console.warn('[cap] enforceGlobalNotificationCap — getAllScheduledNotificationsAsync FAIL:', e?.message || '')
    return []
  }

  // Group ALL notifications by local calendar day
  // expo-notifications trigger format: { channelId, value, repeats, type }
  // where `value` is the Unix timestamp in milliseconds.
  // Some versions may also expose `date` — check both.
  const byDay = new Map()
  for (const notif of scheduled) {
    const trigger = notif.trigger
    if (!trigger) continue
    const ts = trigger.value || trigger.date
    if (!ts || typeof ts !== 'number') continue
    const dayKey = getLocalDayKey(ts)
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey).push(notif)
  }

  // For each day, cancel excess lowest-priority notifications
  const toCancel = []
  for (const [dayKey, notifs] of byDay) {
    if (notifs.length <= cap) continue
    // Sort by priority (highest priority first)
    notifs.sort((a, b) => getNotificationPriority(a.identifier) - getNotificationPriority(b.identifier))
    // Cancel the excess (lowest priority)
    const excess = notifs.slice(cap)
    for (const notif of excess) {
      toCancel.push(notif.identifier)
    }
  }

  if (toCancel.length > 0) {
    console.log('[cap] enforceGlobalNotificationCap | intensity:', settings.intensity, 'cap:', cap, 'cancelling:', toCancel.length, 'excess | ids:', toCancel.join(', '))
    await Promise.all(toCancel.map((id) => {
      console.log('[cap] cancelling excess notification | id:', id)
      return safeCancel(id)
    }))
  } else {
    console.log('[cap] enforceGlobalNotificationCap | intensity:', settings.intensity, 'cap:', cap, 'no excess found')
  }

  return toCancel
}

// ── Exported for testing ─────────────────────────────────────

export const __capPolicy = {
  NOTIFICATION_PRIORITY,
  getNotificationPriority,
  getLocalDayKey,
  KEYS,
}
