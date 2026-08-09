import * as Notifications from 'expo-notifications'

// ─────────────────────────────────────────────────────────────
// DormantReminderService.js — RETIRED in RawLifeFlow 1.0.20
//
// Comeback Reminders (dormant-reminder-day-7/14/30/60) were retired
// along with the Kitchen Utility section removal from Preferences &
// Privacy. The functions remain exported for compatibility but are
// now no-ops that only cancel any existing scheduled reminders.
//
// Legacy AsyncStorage values (@notification_settings.comebackReminders,
// @dormant_reminder_last_activity) are tolerated but can no longer
// reactivate the feature — scheduling is permanently disabled.
// ─────────────────────────────────────────────────────────────

const RETIRED_REMINDER_IDS = [
  'dormant-reminder-day-7',
  'dormant-reminder-day-14',
  'dormant-reminder-day-30',
  'dormant-reminder-day-60',
]

// Cancel any existing scheduled dormant reminders. Called on every
// reconcile and on activity recording to ensure no new reminders fire.
export async function cancelDormantReminders() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    const retiredIds = new Set(RETIRED_REMINDER_IDS)
    await Promise.all(scheduled
      .filter(({ identifier }) => retiredIds.has(identifier))
      .map(({ identifier }) => Notifications.cancelScheduledNotificationAsync(identifier)))
  } catch {}
}

// No-op — no longer schedules. Only cancels existing reminders.
export async function recordMeaningfulActivity() {
  await cancelDormantReminders()
}

// No-op — no longer reconciles/schedules. Only cancels existing reminders.
export async function reconcileDormantReminders() {
  await cancelDormantReminders()
}

// No-op — setting is retired. Only cancels existing reminders.
export async function setComebackRemindersEnabled() {
  await cancelDormantReminders()
}
