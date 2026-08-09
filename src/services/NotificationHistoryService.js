// ─────────────────────────────────────────────────────────────
// NotificationHistoryService.js — Local AsyncStorage archive of
// recent RawLifeFlow notifications for the Recent Notifications
// page and NotificationDetail screen.
//
// Keyed by the canonical Supabase user UUID when available.
// Anonymous → email upgrade preserves the same UUID, so history
// carries forward naturally. Different accounts on the same device
// get separate keys and cannot see each other's history.
//
// Max 30 entries per user, newest first.
// No secrets. No Supabase table. No backend infrastructure.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getUserId } from './supabase/identity'

const MAX_ENTRIES = 30
const GUEST_NAMESPACE = '__guest__'
const KEY_PREFIX = '@rlf_notif_history_'

// ── Types ────────────────────────────────────────────────────

/**
 * @typedef {Object} NotificationRecord
 * @property {string} id                 - Unique record ID (scheduleIdentifier or generated)
 * @property {string} title              - Notification title
 * @property {string} fullText           - Complete message body
 * @property {string} notificationType   - Category/type (affirmation, educational, etc.)
 * @property {number|null} scheduledFor  - Scheduled trigger time (ms epoch) or null
 * @property {number} createdAt          - When the archive record was created (ms epoch)
 * @property {number|null} openedAt      - When the user tapped the notification (ms epoch) or null
 * @property {string} scheduleIdentifier - The expo-notifications schedule identifier
 */

// ── Key resolution ───────────────────────────────────────────

async function resolveStorageKey() {
  let userId = null
  try {
    userId = await getUserId()
  } catch {
    userId = null
  }
  const namespace = userId || GUEST_NAMESPACE
  return `${KEY_PREFIX}${namespace}`
}

// ── Read / Write ─────────────────────────────────────────────

/**
 * Load all notification history records for the current user.
 * Returns newest-first array (max 30).
 * @returns {Promise<NotificationRecord[]>}
 */
export async function loadNotificationHistory() {
  try {
    const key = await resolveStorageKey()
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

async function saveHistory(records) {
  try {
    const key = await resolveStorageKey()
    // Trim to max 30, newest first
    const trimmed = records.slice(0, MAX_ENTRIES)
    await AsyncStorage.setItem(key, JSON.stringify(trimmed))
  } catch {
    // Best-effort — non-fatal
  }
}

// ── Archive on schedule ──────────────────────────────────────

/**
 * Archive a notification record when a schedule succeeds.
 * Called immediately after Notifications.scheduleNotificationAsync
 * returns a valid identifier.
 *
 * @param {Object} params
 * @param {string} params.scheduleIdentifier - The expo-notifications identifier
 * @param {string} params.title
 * @param {string} params.fullText           - Complete message body
 * @param {string} params.notificationType   - Category/type
 * @param {number|null} params.scheduledFor  - ms epoch or null (immediate)
 * @returns {Promise<void>}
 */
export async function archiveScheduledNotification({
  scheduleIdentifier,
  title,
  fullText,
  notificationType,
  scheduledFor,
}) {
  if (!scheduleIdentifier) return
  const record = {
    id: scheduleIdentifier,
    title: String(title || ''),
    fullText: String(fullText || ''),
    notificationType: String(notificationType || 'unknown'),
    scheduledFor: scheduledFor ?? null,
    createdAt: Date.now(),
    openedAt: null,
    scheduleIdentifier,
  }
  const existing = await loadNotificationHistory()
  // Remove any existing record with the same scheduleIdentifier (dedupe)
  const filtered = existing.filter((r) => r.scheduleIdentifier !== scheduleIdentifier)
  // Prepend newest first
  const updated = [record, ...filtered].slice(0, MAX_ENTRIES)
  await saveHistory(updated)
}

// ── Remove pending on cancel ─────────────────────────────────

/**
 * Remove a pending archive entry when a scheduled notification
 * is cancelled BEFORE its trigger time (e.g. by global cap).
 * Only removes entries whose scheduledFor is still in the future
 * AND openedAt is null (never tapped).
 *
 * @param {string} scheduleIdentifier
 * @returns {Promise<void>}
 */
export async function removePendingArchiveEntry(scheduleIdentifier) {
  if (!scheduleIdentifier) return
  const existing = await loadNotificationHistory()
  const now = Date.now()
  const filtered = existing.filter((r) => {
    if (r.scheduleIdentifier !== scheduleIdentifier) return true
    // Only remove if still pending (not yet delivered) and never opened
    const isPending = r.scheduledFor === null || r.scheduledFor > now
    const neverOpened = r.openedAt === null
    return !(isPending && neverOpened)
  })
  await saveHistory(filtered)
}

/**
 * Remove multiple pending archive entries at once (batch cancel).
 * @param {string[]} scheduleIdentifiers
 * @returns {Promise<void>}
 */
export async function removePendingArchiveEntries(scheduleIdentifiers) {
  if (!scheduleIdentifiers || scheduleIdentifiers.length === 0) return
  const ids = new Set(scheduleIdentifiers)
  const existing = await loadNotificationHistory()
  const now = Date.now()
  const filtered = existing.filter((r) => {
    if (!ids.has(r.scheduleIdentifier)) return true
    const isPending = r.scheduledFor === null || r.scheduledFor > now
    const neverOpened = r.openedAt === null
    return !(isPending && neverOpened)
  })
  await saveHistory(filtered)
}

// ── Mark opened on tap ───────────────────────────────────────

/**
 * Mark a notification record as opened (tapped by user).
 * If the record doesn't exist yet (e.g. app wasn't running when
 * scheduled), create it from the notification payload.
 *
 * @param {Object} params
 * @param {string} [params.scheduleIdentifier]
 * @param {string} [params.title]
 * @param {string} [params.fullText]
 * @param {string} [params.notificationType]
 * @param {number|null} [params.scheduledFor]
 * @returns {Promise<NotificationRecord|null>}
 */
export async function markNotificationOpened({
  scheduleIdentifier,
  title,
  fullText,
  notificationType,
  scheduledFor,
}) {
  const now = Date.now()
  const existing = await loadNotificationHistory()

  // Try to find existing record by scheduleIdentifier
  let found = null
  if (scheduleIdentifier) {
    found = existing.find((r) => r.scheduleIdentifier === scheduleIdentifier)
  }

  if (found) {
    found.openedAt = now
    // Update fullText if the payload has more complete data
    if (fullText && (!found.fullText || found.fullText.length < fullText.length)) {
      found.fullText = fullText
    }
    if (title && !found.title) found.title = title
    await saveHistory(existing)
    return found
  }

  // Not found — create from payload
  const id = scheduleIdentifier || `notif-${now}-${Math.random().toString(36).slice(2, 8)}`
  const record = {
    id,
    title: String(title || ''),
    fullText: String(fullText || ''),
    notificationType: String(notificationType || 'unknown'),
    scheduledFor: scheduledFor ?? null,
    createdAt: now,
    openedAt: now,
    scheduleIdentifier: id,
  }
  const updated = [record, ...existing].slice(0, MAX_ENTRIES)
  await saveHistory(updated)
  return record
}

// ── Get single record ────────────────────────────────────────

/**
 * Get a single notification record by ID.
 * @param {string} id
 * @returns {Promise<NotificationRecord|null>}
 */
export async function getNotificationRecord(id) {
  if (!id) return null
  const existing = await loadNotificationHistory()
  return existing.find((r) => r.id === id || r.scheduleIdentifier === id) || null
}

// ── Reconcile with presented notifications ───────────────────

/**
 * Reconcile the archive with currently presented notifications
 * (from the system tray). Called on app foreground/resume as a
 * secondary signal. Does NOT depend on notifications remaining
 * in the tray.
 *
 * @returns {Promise<void>}
 */
export async function reconcileWithPresentedNotifications() {
  try {
    // Lazy import to avoid circular dependency issues in tests
    const Notifications = await import('expo-notifications')
    const presented = await Notifications.getPresentedNotificationsAsync()
    if (!presented || presented.length === 0) return

    const existing = await loadNotificationHistory()
    let changed = false

    for (const notif of presented) {
      const identifier = notif.identifier || notif.request?.identifier
      if (!identifier) continue
      const data = notif.request?.content?.data || {}
      const found = existing.find((r) => r.scheduleIdentifier === identifier)
      if (!found && data?.rawLifeFlowNotification) {
        // Create record from presented notification
        const record = {
          id: identifier,
          title: String(notif.request?.content?.title || ''),
          fullText: String(data?.fullText || notif.request?.content?.body || ''),
          notificationType: String(data?.notificationType || 'unknown'),
          scheduledFor: data?.scheduledFor ?? null,
          createdAt: Date.now(),
          openedAt: null,
          scheduleIdentifier: identifier,
        }
        existing.push(record)
        changed = true
      }
    }

    if (changed) {
      // Sort newest first and trim
      existing.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      await saveHistory(existing)
    }
  } catch {
    // Best-effort
  }
}

// ── Clear history (for nuclear reset) ────────────────────────

/**
 * Clear all notification history for the current user.
 * Called during nuclear reset.
 * @returns {Promise<void>}
 */
export async function clearNotificationHistory() {
  try {
    const key = await resolveStorageKey()
    await AsyncStorage.removeItem(key)
  } catch {
    // Best-effort
  }
}

// ── Exported constants ───────────────────────────────────────

export const NOTIFICATION_HISTORY_MAX_ENTRIES = MAX_ENTRIES
export const NOTIFICATION_HISTORY_KEY_PREFIX = KEY_PREFIX
export const NOTIFICATION_HISTORY_GUEST_NAMESPACE = GUEST_NAMESPACE
