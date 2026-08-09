// ─────────────────────────────────────────────────────────────
// Regression tests for notification trigger format compatibility
// with Expo SDK 54+ / expo-notifications typed trigger API.
//
// The obsolete `{ date: triggerDate }` trigger was rejected by
// expo-notifications with:
//   TypeError: The `trigger` object you provided is invalid.
//   It needs to contain a `type` or `channelId` entry.
//
// The fix uses Notifications.SchedulableTriggerInputTypes.DATE
// with the established channelId for each scheduling path.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const NOTIF_SRC = fs.readFileSync(path.join(__dirname, '..', 'NotificationService.js'), 'utf8')

const CAP_POLICY_SRC = fs.readFileSync(path.join(__dirname, '..', 'NotificationCapPolicy.js'), 'utf8')

const NUDGE_SRC = fs.readFileSync(path.join(__dirname, '..', 'NotificationNudges.js'), 'utf8')

const DORMANT_SRC = fs.readFileSync(path.join(__dirname, '..', 'DormantReminderService.js'), 'utf8')

describe('Notification trigger format — Expo SDK 54+ typed trigger', () => {
  // ── 1. NotificationService uses SchedulableTriggerInputTypes.DATE ──

  describe('NotificationService scheduleNotif uses typed DATE trigger', () => {
    test('1. scheduleNotif includes SchedulableTriggerInputTypes.DATE', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 3000)
      expect(scheduleSection).toMatch(/SchedulableTriggerInputTypes\.DATE/)
    })

    test('2. scheduleNotif passes the date value to the typed trigger', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 3000)
      // The typed trigger must include date: triggerDate
      expect(scheduleSection).toMatch(/type:\s*Notifications\.SchedulableTriggerInputTypes\.DATE[\s\S]*date:\s*triggerDate/)
    })

    test('3. scheduleNotif uses rawlifeflow-reminders channelId on Android', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 3000)
      expect(scheduleSection).toMatch(/channelId:\s*ANDROID_CHANNEL_ID/)
    })

    test('4. ANDROID_CHANNEL_ID is rawlifeflow-reminders', () => {
      expect(NOTIF_SRC).toMatch(/ANDROID_CHANNEL_ID\s*=\s*['"]rawlifeflow-reminders['"]/)
    })
  })

  // ── 2. NotificationNudges uses SchedulableTriggerInputTypes.DATE ──

  describe('NotificationNudges safeSchedule uses typed DATE trigger', () => {
    test('5. safeSchedule includes SchedulableTriggerInputTypes.DATE', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/SchedulableTriggerInputTypes\.DATE/)
    })

    test('6. safeSchedule passes the date value to the typed trigger', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/type:\s*Notifications\.SchedulableTriggerInputTypes\.DATE[\s\S]*date:\s*triggerDate/)
    })

    test('7. safeSchedule uses nudges channelId', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/channelId:\s*['"]nudges['"]/)
    })
  })

  // ── 3. DormantReminderService retired (1.0.20) ──

  describe('DormantReminderService retired — no scheduling functions', () => {
    test('8. DormantReminderService no longer has scheduleDormantReminders function', () => {
      expect(DORMANT_SRC).not.toMatch(/function scheduleDormantReminders/)
    })

    test('8b. DormantReminderService does not schedule notifications', () => {
      expect(DORMANT_SRC).not.toMatch(/scheduleNotificationAsync/)
    })

    test('8c. DormantReminderService only cancels (no-op retirement)', () => {
      expect(DORMANT_SRC).toMatch(/cancelDormantReminders/)
      expect(DORMANT_SRC).toMatch(/RETIRED/)
    })
  })

  // ── 4. No obsolete date-only trigger objects remain ──

  describe('No obsolete trigger: { date: ... } remains in production code', () => {
    test('9. NotificationService has no obsolete trigger: { date:', () => {
      expect(NOTIF_SRC).not.toMatch(/trigger:\s*triggerDate\s*\?\s*\{\s*date:/)
      expect(NOTIF_SRC).not.toMatch(/trigger:\s*\{\s*date:\s*triggerDate\s*\}/)
    })

    test('10. NotificationNudges has no obsolete trigger: { date:', () => {
      expect(NUDGE_SRC).not.toMatch(/trigger:\s*triggerDate\s*\?\s*\{\s*date:/)
      expect(NUDGE_SRC).not.toMatch(/trigger:\s*\{\s*date:\s*triggerDate\s*\}/)
    })

    test('11. DormantReminderService has no obsolete trigger: { date:', () => {
      expect(DORMANT_SRC).not.toMatch(/trigger:\s*\{\s*date:\s*triggerDate\s*\}/)
    })
  })

  // ── 5. Immediate trigger (null) behavior preserved ──

  describe('Immediate trigger (null) behavior preserved', () => {
    test('12. scheduleNotif still passes null trigger for immediate notifications', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 3000)
      // The ternary must still produce null when triggerDate is falsy
      expect(scheduleSection).toMatch(/triggerDate\s*\?/)
      expect(scheduleSection).toMatch(/:\s*null/)
    })

    test('13. safeSchedule still passes null trigger for immediate notifications', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/triggerDate\s*\?/)
      expect(safeScheduleSection).toMatch(/:\s*null/)
    })
  })

  // ── 6. Intensity caps unchanged ──

  describe('Intensity caps remain unchanged', () => {
    test('14. INTENSITY_CAPS still defines zen=1, balanced=3, high-vibe=5', () => {
      expect(CAP_POLICY_SRC).toMatch(/zen:\s*1/)
      expect(CAP_POLICY_SRC).toMatch(/balanced:\s*3/)
      expect(CAP_POLICY_SRC).toMatch(/'high-vibe':\s*5/)
    })
  })

  // ── 7. Quiet hours behavior unchanged ──

  describe('Quiet-hours behavior remains unchanged', () => {
    test('15. isTimeInQuietHours still checks quietStart and quietEnd', () => {
      const quietStart = CAP_POLICY_SRC.indexOf('export function isTimeInQuietHours')
      const quietSection = CAP_POLICY_SRC.substring(quietStart, quietStart + 500)
      expect(quietSection).toMatch(/quietStart/)
      expect(quietSection).toMatch(/quietEnd/)
    })

    test('16. scheduleNotif still checks quiet hours before scheduling', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 3000)
      expect(scheduleSection).toMatch(/isTimeInQuietHours/)
    })

    test('17. safeSchedule still checks quiet hours before scheduling', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/isTimeInQuietHours/)
    })
  })

  // ── 8. Reconciliation tests remain compatible ──

  describe('Reconciliation behavior preserved', () => {
    test('18. reconcileNotificationSchedule still cancels wilt-warning', () => {
      const reconcileStart = NOTIF_SRC.indexOf('export async function reconcileNotificationSchedule')
      const reconcileSection = NOTIF_SRC.substring(reconcileStart, reconcileStart + 2000)
      expect(reconcileSection).toContain("safeCancel('wilt-warning')")
    })

    test('19. reconcileNotificationSchedule still calls refreshNudges', () => {
      const reconcileStart = NOTIF_SRC.indexOf('export async function reconcileNotificationSchedule')
      const reconcileSection = NOTIF_SRC.substring(reconcileStart, reconcileStart + 2000)
      expect(reconcileSection).toMatch(/refreshNudges/)
    })
  })
})
