// ─────────────────────────────────────────────────────────────
// Regression tests for global notification intensity cap
// enforcement across NotificationService + NotificationNudges.
//
// The sentToday counter only governs near-future delivery.
// Far-future scheduled notifications bypass canSendNotification(),
// so enforceGlobalNotificationCap() must cancel excess
// ordinary notifications per local calendar day.
// ─────────────────────────────────────────────────────────────

const mockStorage = new Map()
const mockScheduled = new Map()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key) => {
    mockStorage.delete(key)
    return Promise.resolve()
  }),
}))

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve(
    Array.from(mockScheduled, ([identifier, notification]) => ({ identifier, ...notification }))
  )),
  cancelScheduledNotificationAsync: jest.fn((identifier) => {
    mockScheduled.delete(identifier)
    return Promise.resolve()
  }),
  scheduleNotificationAsync: jest.fn((notification) => {
    mockScheduled.set(notification.identifier, notification)
    return Promise.resolve(notification.identifier)
  }),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
  setNotificationHandler: jest.fn(),
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  LogBox: { ignoreLogs: jest.fn() },
}))

const {
  enforceGlobalNotificationCap,
  INTENSITY_CAPS,
  __capPolicy,
} = require('../NotificationService')

// Helper: create a mock scheduled notification
function makeNotif(id, dayOffset, hour = 12, extra = {}) {
  const date = new Date(2026, 7, 8 + dayOffset, hour, 0, 0, 0)
  return {
    identifier: id,
    content: { data: extra.data || {} },
    trigger: { type: 'date', date: date.getTime(), channelId: 'nudges' },
  }
}

// Helper: populate mockScheduled with a set of ordinary notifications
function setScheduled(notifs) {
  mockScheduled.clear()
  for (const n of notifs) {
    mockScheduled.set(n.identifier, n)
  }
}

describe('Global notification intensity cap — enforceGlobalNotificationCap', () => {
  beforeEach(() => {
    mockStorage.clear()
    mockScheduled.clear()
    jest.clearAllMocks()
  })

  // ── 1. Zen with 5 ordinary candidates → only 1 scheduled ──

  test('1. Zen with 5 ordinary candidates → only 1 scheduled for that local day', async () => {
    const five = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('saturday-rainbow-nudge', 0, 10),
    ]
    setScheduled(five)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(4)
    expect(mockScheduled.size).toBe(1)
    // Highest priority (identity-affirmation) should be kept
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
  })

  // ── 2. Balanced with 5 ordinary candidates → only 3 scheduled ──

  test('2. Balanced with 5 ordinary candidates → only 3 scheduled', async () => {
    const five = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('saturday-rainbow-nudge', 0, 10),
    ]
    setScheduled(five)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(2)
    expect(mockScheduled.size).toBe(3)
    // Top 3 by priority: identity-affirmation, nudge-daily-glow, educational-tip
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
  })

  // ── 3. High-Vibe with 6+ ordinary candidates → only 5 scheduled ──

  test('3. High-Vibe with 6+ ordinary candidates → only 5 scheduled', async () => {
    const six = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('streak-shield', 0, 20),
      makeNotif('wilt-warning', 0, 15),
    ]
    setScheduled(six)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'high-vibe' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.size).toBe(5)
    // wilt-warning (priority 6) should be cancelled
    expect(mockScheduled.has('wilt-warning')).toBe(false)
    // Top 5 should remain
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
    expect(mockScheduled.has('nudge-streak-risk')).toBe(true)
    expect(mockScheduled.has('streak-shield')).toBe(true)
  })

  // ── 4. Combined NotificationService + NotificationNudges cannot exceed cap ──

  test('4. Combined NotificationService + NotificationNudges cannot exceed cap', async () => {
    // Mix of IDs from both services on the same day
    const mixed = [
      makeNotif('identity-affirmation', 0, 7),    // NotificationService
      makeNotif('educational-tip', 0, 12),         // NotificationService
      makeNotif('saturday-rainbow-nudge', 0, 10),  // NotificationService
      makeNotif('wilt-warning', 0, 15),            // NotificationService
      makeNotif('nudge-daily-glow', 0, 8),        // NotificationNudges
      makeNotif('nudge-streak-risk', 0, 18),      // NotificationNudges
      makeNotif('nudge-weekly-summary', 0, 19),   // NotificationNudges
    ]
    setScheduled(mixed)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(4)
    expect(mockScheduled.size).toBe(3)
    // Top 3 by priority: identity-affirmation, nudge-daily-glow, educational-tip
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
  })

  // ── 5. Reconciliation removes excess when moving High-Vibe → Zen ──

  test('5. Reconciliation removes excess when moving High-Vibe → Zen', async () => {
    // Simulate 5 notifications already scheduled (high-vibe allowed)
    const five = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('streak-shield', 0, 20),
    ]
    setScheduled(five)

    // Now enforce Zen
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(4)
    expect(mockScheduled.size).toBe(1)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
  })

  // ── 6. Moving Zen → Balanced allows additional schedules ──

  test('6. Moving Zen → Balanced allows additional schedules', async () => {
    // Only 1 scheduled (Zen enforced previously)
    const one = [makeNotif('identity-affirmation', 0, 7)]
    setScheduled(one)

    // Enforce Balanced — should NOT cancel anything (1 < 3)
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(0)
    expect(mockScheduled.size).toBe(1)
    // The caller would then reschedule additional notifications
  })

  // ── 7. Quiet hours still work (source-level check) ──

  test('7. Quiet hours function still exists and works', () => {
    const { isTimeInQuietHours } = require('../NotificationService')
    const settings = { quietStart: { hour: 21, minute: 30 }, quietEnd: { hour: 6, minute: 30 } }
    expect(isTimeInQuietHours(22, 0, settings)).toBe(true)   // 10 PM — quiet
    expect(isTimeInQuietHours(10, 0, settings)).toBe(false)  // 10 AM — not quiet
    expect(isTimeInQuietHours(3, 0, settings)).toBe(true)    // 3 AM — quiet
  })

  // ── 8. Exempt emergency notifications do not consume ordinary cap ──

  test('8. freezer-morning (emergency) does not consume ordinary cap', async () => {
    const withEmergency = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('freezer-morning', 0, 7, { data: { type: 'freezer_morning' } }),
    ]
    setScheduled(withEmergency)

    // Zen = 1 ordinary. freezer-morning is exempt.
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.size).toBe(2)
    // freezer-morning should NOT be cancelled
    expect(mockScheduled.has('freezer-morning')).toBe(true)
    // identity-affirmation (higher priority) kept, nudge-daily-glow cancelled
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(false)
  })

  test('8b. streak-shield with freezerPasses > 0 is exempt', async () => {
    const withEmergency = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('streak-shield', 0, 20, { data: { freezerPasses: 2 } }),
    ]
    setScheduled(withEmergency)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.size).toBe(2)
    // streak-shield with freezerPasses should NOT be cancelled
    expect(mockScheduled.has('streak-shield')).toBe(true)
  })

  test('8c. dormant-reminder is exempt', async () => {
    const withDormant = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('dormant-reminder-day-7', 7, 10),
    ]
    setScheduled(withDormant)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.size).toBe(2)
    expect(mockScheduled.has('dormant-reminder-day-7')).toBe(true)
  })

  // ── 9. Typed Expo DATE trigger format remains correct (source check) ──

  test('9. Typed DATE trigger format remains in scheduleNotif', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'NotificationService.js'), 'utf8')
    const start = src.indexOf('async function scheduleNotif')
    const section = src.substring(start, start + 3000)
    expect(section).toMatch(/SchedulableTriggerInputTypes\.DATE/)
  })

  // ── 10. No duplicate identifiers/schedules ──

  test('10. enforceGlobalNotificationCap does not create duplicates', async () => {
    const three = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
    ]
    setScheduled(three)

    // Balanced = 3, so nothing should be cancelled
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(0)
    expect(mockScheduled.size).toBe(3)
    // Run again — idempotent
    const cancelled2 = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled2.length).toBe(0)
    expect(mockScheduled.size).toBe(3)
  })

  // ── Cap policy unit tests ──

  describe('Cap policy helpers', () => {
    test('ORDINARY_NOTIFICATION_PRIORITY has 8 entries in priority order', () => {
      expect(__capPolicy.ORDINARY_NOTIFICATION_PRIORITY).toHaveLength(8)
      expect(__capPolicy.ORDINARY_NOTIFICATION_PRIORITY[0]).toBe('identity-affirmation')
      expect(__capPolicy.ORDINARY_NOTIFICATION_PRIORITY[7]).toBe('nudge-weekly-summary')
    })

    test('isOrdinaryNotification identifies ordinary IDs', () => {
      expect(__capPolicy.isOrdinaryNotification({ identifier: 'identity-affirmation' })).toBe(true)
      expect(__capPolicy.isOrdinaryNotification({ identifier: 'nudge-daily-glow' })).toBe(true)
      expect(__capPolicy.isOrdinaryNotification({ identifier: 'freezer-morning' })).toBe(false)
      expect(__capPolicy.isOrdinaryNotification({ identifier: 'dormant-reminder-day-7' })).toBe(false)
    })

    test('getNotificationPriority returns lower number for higher priority', () => {
      expect(__capPolicy.getNotificationPriority('identity-affirmation')).toBe(0)
      expect(__capPolicy.getNotificationPriority('nudge-weekly-summary')).toBe(7)
      expect(__capPolicy.getNotificationPriority('unknown-id')).toBe(8)
    })

    test('getLocalDayKey groups by local calendar date', () => {
      const ts = new Date(2026, 7, 8, 23, 30, 0).getTime() // Aug 8, 2026 11:30 PM
      expect(__capPolicy.getLocalDayKey(ts)).toBe('2026-08-08')
      const ts2 = new Date(2026, 7, 9, 0, 15, 0).getTime() // Aug 9, 2026 12:15 AM
      expect(__capPolicy.getLocalDayKey(ts2)).toBe('2026-08-09')
    })

    test('INTENSITY_CAPS defines zen=1, balanced=3, high-vibe=5', () => {
      expect(INTENSITY_CAPS.zen).toBe(1)
      expect(INTENSITY_CAPS.balanced).toBe(3)
      expect(INTENSITY_CAPS['high-vibe']).toBe(5)
    })
  })

  // ── Multi-day grouping test ──

  test('Multi-day: cap applies independently per local day', async () => {
    // Use unique IDs per day to avoid Map key collision in mock.
    // In real expo-notifications, same identifier overwrites, so
    // each notification ID is unique per schedule.
    const multiDay = [
      makeNotif('identity-affirmation', 0, 7),    // Day 1
      makeNotif('nudge-daily-glow', 0, 8),        // Day 1
      makeNotif('educational-tip', 0, 12),        // Day 1
      makeNotif('streak-shield', 1, 20),          // Day 2
      makeNotif('wilt-warning', 1, 15),           // Day 2
    ]
    setScheduled(multiDay)

    // Zen = 1/day. Day 1 has 3 → cancel 2. Day 2 has 2 → cancel 1.
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(3)
    expect(mockScheduled.size).toBe(2)
    // Day 1: identity-affirmation (priority 0) kept
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    // Day 2: streak-shield (priority 4) vs wilt-warning (priority 5)
    // streak-shield has higher priority, so wilt-warning cancelled
    expect(mockScheduled.has('streak-shield')).toBe(true)
    expect(mockScheduled.has('wilt-warning')).toBe(false)
  })

  // ── Disabled notifications: no enforcement ──

  test('Disabled notifications: enforceGlobalNotificationCap returns empty', async () => {
    const three = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
    ]
    setScheduled(three)

    const cancelled = await enforceGlobalNotificationCap({ enabled: false, intensity: 'zen' })
    expect(cancelled.length).toBe(0)
  })
})
