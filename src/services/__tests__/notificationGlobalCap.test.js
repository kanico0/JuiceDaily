// ─────────────────────────────────────────────────────────────
// Regression tests for global notification intensity cap
// enforcement across NotificationService + NotificationNudges.
//
// ALL user-facing notifications count toward the cap — no
// exemptions (Freezer Pass retired in 1.0.20).
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
} = require('../NotificationCapPolicy')

// Helper: create a mock scheduled notification
// Uses the real expo-notifications trigger format: { channelId, value, repeats, type }
// where `value` is the Unix timestamp in milliseconds.
function makeNotif(id, dayOffset, hour = 12, extra = {}) {
  const date = new Date(2026, 7, 8 + dayOffset, hour, 0, 0, 0)
  return {
    identifier: id,
    content: { data: extra.data || {} },
    trigger: { type: 'date', value: date.getTime(), repeats: false, channelId: 'nudges' },
  }
}

// Helper: populate mockScheduled with a set of notifications
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

  // ── 1. Zen with 5 mixed notification types → exactly 1 ──

  test('1. Zen with 5 mixed notification types → exactly 1 scheduled', async () => {
    const five = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('nudge-weekly-summary', 0, 10),
    ]
    setScheduled(five)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(4)
    expect(mockScheduled.size).toBe(1)
    // Highest priority (identity-affirmation) should be kept
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
  })

  // ── 2. Balanced with 5 candidates → only 3 scheduled ──

  test('2. Balanced with 5 candidates → only 3 scheduled', async () => {
    const five = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('nudge-weekly-summary', 0, 10),
    ]
    setScheduled(five)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(2)
    expect(mockScheduled.size).toBe(3)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
  })

  // ── 3. High-Vibe with 6+ candidates → only 5 scheduled ──

  test('3. High-Vibe with 6+ candidates → only 5 scheduled', async () => {
    const six = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('streak-shield', 0, 20),
      makeNotif('nudge-weekly-summary', 0, 15),
    ]
    setScheduled(six)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'high-vibe' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.size).toBe(5)
    expect(mockScheduled.has('nudge-weekly-summary')).toBe(false)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
    expect(mockScheduled.has('nudge-streak-risk')).toBe(true)
    expect(mockScheduled.has('streak-shield')).toBe(true)
  })

  // ── 4. Combined NotificationService + NotificationNudges cannot exceed cap ──

  test('4. Combined NotificationService + NotificationNudges cannot exceed cap', async () => {
    const mixed = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-weekly-summary', 0, 10),
      makeNotif('dormant-reminder-day-7', 0, 15),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('streak-shield', 0, 19),
    ]
    setScheduled(mixed)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(4)
    expect(mockScheduled.size).toBe(3)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
  })

  // ── 5. Reconciliation removes excess when moving High-Vibe → Zen ──

  test('5. Reconciliation removes excess when moving High-Vibe → Zen', async () => {
    const five = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('nudge-streak-risk', 0, 18),
      makeNotif('streak-shield', 0, 20),
    ]
    setScheduled(five)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(4)
    expect(mockScheduled.size).toBe(1)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
  })

  // ── 6. Moving Zen → Balanced allows additional schedules ──

  test('6. Moving Zen → Balanced allows additional schedules', async () => {
    const one = [makeNotif('identity-affirmation', 0, 7)]
    setScheduled(one)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(0)
    expect(mockScheduled.size).toBe(1)
  })

  // ── 7. Quiet hours still work ──

  test('7. Quiet hours function still works', () => {
    const { isTimeInQuietHours } = require('../NotificationCapPolicy')
    const settings = { quietStart: { hour: 21, minute: 30 }, quietEnd: { hour: 6, minute: 30 } }
    expect(isTimeInQuietHours(22, 0, settings)).toBe(true)
    expect(isTimeInQuietHours(10, 0, settings)).toBe(false)
    expect(isTimeInQuietHours(3, 0, settings)).toBe(true)
  })

  // ── 8. Dormant/onboarding/one-shot notifications count toward cap ──

  test('8. Dormant reminders count toward the same cap', async () => {
    const withDormant = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('dormant-reminder-day-7', 7, 10),
    ]
    setScheduled(withDormant)

    // Zen = 1/day. Day 1 has 2 → cancel 1. Day 7 has 1 → OK.
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(1)
    // identity-affirmation (priority 0) kept, nudge-daily-glow (priority 1) cancelled
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('nudge-daily-glow')).toBe(false)
    expect(mockScheduled.has('dormant-reminder-day-7')).toBe(true)
  })

  test('8b. Onboarding notifications count toward the same cap', async () => {
    const withOnboarding = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('onboarding-1', 0, 9),
      makeNotif('onboarding-2', 0, 10),
    ]
    setScheduled(withOnboarding)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(2)
    expect(mockScheduled.size).toBe(1)
    // identity-affirmation (priority 0) > onboarding-* (priority 15)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
  })

  test('8c. Surprise notifications count toward the same cap', async () => {
    const withSurprise = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('surprise-5', 0, 14),
    ]
    setScheduled(withSurprise)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('surprise-5')).toBe(false)
  })

  test('8d. Weight milestone notifications count toward the same cap', async () => {
    const withWeight = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('weight-10', 0, 14),
    ]
    setScheduled(withWeight)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(1)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('weight-10')).toBe(false)
  })

  // ── 9. freezer-morning is NO LONGER exempt — counts toward cap ──

  test('9. freezer-morning counts toward cap (no exemption)', async () => {
    const withFreezer = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('freezer-morning', 0, 7, { data: { type: 'freezer_morning' } }),
    ]
    setScheduled(withFreezer)

    // Zen = 1/day. freezer-morning is no longer exempt.
    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(2)
    expect(mockScheduled.size).toBe(1)
    // identity-affirmation (priority 0) kept
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    // freezer-morning (priority 8) cancelled
    expect(mockScheduled.has('freezer-morning')).toBe(false)
  })

  // ── 10. streak-shield with freezerPasses data is NO LONGER exempt ──

  test('10. streak-shield with freezerPasses data is NOT exempt', async () => {
    const withShield = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('streak-shield', 0, 20, { data: { freezerPasses: 5 } }),
    ]
    setScheduled(withShield)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(2)
    expect(mockScheduled.size).toBe(1)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    // streak-shield (priority 4) cancelled because identity-affirmation is higher
    expect(mockScheduled.has('streak-shield')).toBe(false)
  })

  // ── 11. Typed Expo DATE trigger format remains correct (source check) ──

  test('11. Typed DATE trigger format remains in scheduleNotif', () => {
    const fs = require('fs')
    const path = require('path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'NotificationService.js'), 'utf8')
    const start = src.indexOf('async function scheduleNotif')
    const section = src.substring(start, start + 3000)
    expect(section).toMatch(/SchedulableTriggerInputTypes\.DATE/)
  })

  // ── 12. No duplicates (idempotent enforcement) ──

  test('12. enforceGlobalNotificationCap is idempotent', async () => {
    const three = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
    ]
    setScheduled(three)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled.length).toBe(0)
    expect(mockScheduled.size).toBe(3)
    const cancelled2 = await enforceGlobalNotificationCap({ enabled: true, intensity: 'balanced' })
    expect(cancelled2.length).toBe(0)
    expect(mockScheduled.size).toBe(3)
  })

  // ── 13. Multi-day: cap applies independently per local day ──

  test('13. Multi-day: cap applies independently per local day', async () => {
    const multiDay = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
      makeNotif('streak-shield', 1, 20),
      makeNotif('nudge-weekly-summary', 1, 15),
    ]
    setScheduled(multiDay)

    const cancelled = await enforceGlobalNotificationCap({ enabled: true, intensity: 'zen' })
    expect(cancelled.length).toBe(3)
    expect(mockScheduled.size).toBe(2)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('streak-shield')).toBe(true)
    expect(mockScheduled.has('nudge-weekly-summary')).toBe(false)
  })

  // ── 14. Disabled notifications: no enforcement ──

  test('14. Disabled notifications: enforceGlobalNotificationCap returns empty', async () => {
    const three = [
      makeNotif('identity-affirmation', 0, 7),
      makeNotif('nudge-daily-glow', 0, 8),
      makeNotif('educational-tip', 0, 12),
    ]
    setScheduled(three)

    const cancelled = await enforceGlobalNotificationCap({ enabled: false, intensity: 'zen' })
    expect(cancelled.length).toBe(0)
  })

  // ── Cap policy unit tests ──

  describe('Cap policy helpers', () => {
    test('NOTIFICATION_PRIORITY includes all notification types', () => {
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('identity-affirmation')
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('nudge-daily-glow')
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('freezer-morning')
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('dormant-reminder-day-7')
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('surprise-')
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('weight-')
      expect(__capPolicy.NOTIFICATION_PRIORITY).toContain('onboarding-')
    })

    test('getNotificationPriority returns lower number for higher priority', () => {
      expect(__capPolicy.getNotificationPriority('identity-affirmation')).toBe(0)
      expect(__capPolicy.getNotificationPriority('nudge-weekly-summary')).toBe(5)
      // Prefix matches
      expect(__capPolicy.getNotificationPriority('surprise-5')).toBeLessThan(__capPolicy.NOTIFICATION_PRIORITY.length)
      expect(__capPolicy.getNotificationPriority('weight-10')).toBeLessThan(__capPolicy.NOTIFICATION_PRIORITY.length)
      expect(__capPolicy.getNotificationPriority('onboarding-1')).toBeLessThan(__capPolicy.NOTIFICATION_PRIORITY.length)
    })

    test('getLocalDayKey groups by local calendar date', () => {
      const ts = new Date(2026, 7, 8, 23, 30, 0).getTime()
      expect(__capPolicy.getLocalDayKey(ts)).toBe('2026-08-08')
      const ts2 = new Date(2026, 7, 9, 0, 15, 0).getTime()
      expect(__capPolicy.getLocalDayKey(ts2)).toBe('2026-08-09')
    })

    test('INTENSITY_CAPS defines zen=1, balanced=3, high-vibe=5', () => {
      expect(INTENSITY_CAPS.zen).toBe(1)
      expect(INTENSITY_CAPS.balanced).toBe(3)
      expect(INTENSITY_CAPS['high-vibe']).toBe(5)
    })
  })

  // ── Architecture: no circular dependency ──

  describe('Architecture: no circular dependency', () => {
    test('NotificationCapPolicy does not import NotificationService', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(path.join(__dirname, '..', 'NotificationCapPolicy.js'), 'utf8')
      expect(src).not.toMatch(/from\s+['"]\.\/NotificationService['"]/)
      expect(src).not.toMatch(/require\(['"]\.\/NotificationService['"]\)/)
    })

    test('NotificationCapPolicy does not import NotificationNudges', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(path.join(__dirname, '..', 'NotificationCapPolicy.js'), 'utf8')
      expect(src).not.toMatch(/from\s+['"]\.\/NotificationNudges['"]/)
      expect(src).not.toMatch(/require\(['"]\.\/NotificationNudges['"]\)/)
    })

    test('NotificationNudges imports cap policy from NotificationCapPolicy', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(path.join(__dirname, '..', 'NotificationNudges.js'), 'utf8')
      expect(src).toMatch(/from\s+['"]\.\/NotificationCapPolicy['"]/)
    })
  })
})
