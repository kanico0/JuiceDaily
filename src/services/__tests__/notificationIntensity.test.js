// ─────────────────────────────────────────────────────────────
// Regression tests for notification intensity scheduling defects
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const NOTIF_SRC = fs.readFileSync(path.join(__dirname, '..', 'NotificationService.js'), 'utf8')

const NUDGE_SRC = fs.readFileSync(path.join(__dirname, '..', 'NotificationNudges.js'), 'utf8')

describe('Notification intensity scheduling — defect regression', () => {
  // ── Defect 1: reconcileNotificationSchedule must cancel wilt-warning ──

  describe('reconcileNotificationSchedule cancels wilt-warning on intensity change', () => {
    test('1. reconcileNotificationSchedule includes wilt-warning in cancel list', () => {
      const reconcileStart = NOTIF_SRC.indexOf(
        'export async function reconcileNotificationSchedule',
      )
      const reconcileSection = NOTIF_SRC.substring(reconcileStart, reconcileStart + 1200)
      expect(reconcileSection).toContain("safeCancel('wilt-warning')")
    })

    test('2. wilt-warning cancel is in the enabled-reschedule block (not just disabled block)', () => {
      const reconcileStart = NOTIF_SRC.indexOf(
        'export async function reconcileNotificationSchedule',
      )
      const reconcileSection = NOTIF_SRC.substring(reconcileStart)

      // Find the block after the enabled check that reschedules
      const rescheduleBlock = reconcileSection.substring(
        reconcileSection.indexOf('Cancel and reschedule'),
      )
      expect(rescheduleBlock).toContain("safeCancel('wilt-warning')")
    })
  })

  // ── Defect 2: reconcileNotificationSchedule must call refreshNudges ──

  describe('reconcileNotificationSchedule calls refreshNudges', () => {
    test('3. reconcileNotificationSchedule calls refreshNudges', () => {
      const reconcileStart = NOTIF_SRC.indexOf(
        'export async function reconcileNotificationSchedule',
      )
      const reconcileSection = NOTIF_SRC.substring(reconcileStart, reconcileStart + 2000)
      expect(reconcileSection).toMatch(/refreshNudges/)
    })

    test('4. refreshNudges call is wrapped in try/catch for safety', () => {
      const reconcileStart = NOTIF_SRC.indexOf(
        'export async function reconcileNotificationSchedule',
      )
      const reconcileSection = NOTIF_SRC.substring(reconcileStart)
      const refreshIdx = reconcileSection.indexOf('refreshNudges')
      const surroundingCode = reconcileSection.substring(refreshIdx - 80, refreshIdx + 120)
      expect(surroundingCode).toMatch(/try\s*{/)
      expect(surroundingCode).toMatch(/catch/)
    })
  })

  // ── Defect 3: NotificationNudges must increment sentToday for near-future ──

  describe('NotificationNudges increments sentToday for near-future nudges', () => {
    test('5. NotificationNudges imports incrementSentToday from NotificationService', () => {
      expect(NUDGE_SRC).toMatch(/incrementSentToday/)
    })

    test('6. safeSchedule calls incrementSentToday after scheduling', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/incrementSentToday/)
    })

    test('7. incrementSentToday is called only for near-future nudges', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 3000)
      expect(safeScheduleSection).toMatch(/isNearFuture[\s\S]*incrementSentToday/)
    })
  })

  // ── Existing behavior preserved ──

  describe('Existing intensity cap behavior is preserved', () => {
    test('8. INTENSITY_CAPS still defines zen=1, balanced=3, high-vibe=5', () => {
      expect(NOTIF_SRC).toMatch(/zen:\s*1/)
      expect(NOTIF_SRC).toMatch(/balanced:\s*3/)
      expect(NOTIF_SRC).toMatch(/'high-vibe':\s*5/)
    })

    test('9. canSendNotification checks frequency cap', () => {
      const canSendStart = NOTIF_SRC.indexOf('export async function canSendNotification')
      const canSendSection = NOTIF_SRC.substring(canSendStart, canSendStart + 400)
      expect(canSendSection).toMatch(/INTENSITY_CAPS/)
      expect(canSendSection).toMatch(/sent\s*>=\s*cap/)
    })

    test('10. canSendNotification checks quiet hours', () => {
      const canSendStart = NOTIF_SRC.indexOf('export async function canSendNotification')
      const canSendSection = NOTIF_SRC.substring(canSendStart, canSendStart + 800)
      expect(canSendSection).toMatch(/quietStart/)
      expect(canSendSection).toMatch(/quietEnd/)
    })

    test('11. scheduleNotif still checks cap for near-future only', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 1200)
      expect(scheduleSection).toMatch(/isNearFuture/)
      expect(scheduleSection).toMatch(/canSendNotification/)
    })

    test('12. scheduleNotif increments sentToday for near-future', () => {
      const scheduleStart = NOTIF_SRC.indexOf('async function scheduleNotif')
      const scheduleSection = NOTIF_SRC.substring(scheduleStart, scheduleStart + 3000)
      expect(scheduleSection).toMatch(/isNearFuture[\s\S]*incrementSentToday/)
    })

    test('13. incrementSentToday is exported from NotificationService', () => {
      expect(NOTIF_SRC).toMatch(/export\s+async\s+function\s+incrementSentToday/)
    })
  })

  // ── Nudge quiet hours check preserved ──

  describe('Nudge quiet hours check is preserved', () => {
    test('14. safeSchedule checks isTimeInQuietHours for trigger time', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 2000)
      expect(safeScheduleSection).toMatch(/isTimeInQuietHours/)
    })

    test('15. safeSchedule checks canSendNotification for near-future', () => {
      const safeScheduleStart = NUDGE_SRC.indexOf('async function safeSchedule')
      const safeScheduleSection = NUDGE_SRC.substring(safeScheduleStart, safeScheduleStart + 2000)
      expect(safeScheduleSection).toMatch(/canSendNotification/)
    })
  })
})
