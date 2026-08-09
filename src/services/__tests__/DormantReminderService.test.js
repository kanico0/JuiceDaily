const mockScheduled = new Map()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
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
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}))

const {
  cancelDormantReminders,
  recordMeaningfulActivity,
  reconcileDormantReminders,
  setComebackRemindersEnabled,
} = require('../DormantReminderService')

describe('DormantReminderService — retired (1.0.20)', () => {
  beforeEach(() => {
    mockScheduled.clear()
    jest.clearAllMocks()
  })

  test('cancelDormantReminders cancels all four dormant reminder IDs', async () => {
    // Pre-populate with scheduled reminders
    mockScheduled.set('dormant-reminder-day-7', { content: {} })
    mockScheduled.set('dormant-reminder-day-14', { content: {} })
    mockScheduled.set('dormant-reminder-day-30', { content: {} })
    mockScheduled.set('dormant-reminder-day-60', { content: {} })

    await cancelDormantReminders()

    expect(mockScheduled.size).toBe(0)
  })

  test('recordMeaningfulActivity is a no-op that only cancels (never schedules)', async () => {
    mockScheduled.set('dormant-reminder-day-7', { content: {} })
    await recordMeaningfulActivity()
    expect(mockScheduled.size).toBe(0)
    // Verify no new scheduling happened
    const { scheduleNotificationAsync } = require('expo-notifications')
    expect(scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  test('reconcileDormantReminders is a no-op that only cancels (never schedules)', async () => {
    mockScheduled.set('dormant-reminder-day-14', { content: {} })
    await reconcileDormantReminders()
    expect(mockScheduled.size).toBe(0)
    const { scheduleNotificationAsync } = require('expo-notifications')
    expect(scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  test('setComebackRemindersEnabled is a no-op that only cancels (never schedules)', async () => {
    mockScheduled.set('dormant-reminder-day-30', { content: {} })
    await setComebackRemindersEnabled(true)
    expect(mockScheduled.size).toBe(0)
    const { scheduleNotificationAsync } = require('expo-notifications')
    expect(scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  test('legacy AsyncStorage comebackReminders=true cannot reactivate scheduling', async () => {
    // Even if legacy storage has comebackReminders=true, no scheduling occurs
    await recordMeaningfulActivity()
    const { scheduleNotificationAsync } = require('expo-notifications')
    expect(scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  test('cancelDormantReminders does not cancel unrelated notifications', async () => {
    mockScheduled.set('dormant-reminder-day-7', { content: {} })
    mockScheduled.set('identity-affirmation', { content: {} })
    mockScheduled.set('educational-tip', { content: {} })

    await cancelDormantReminders()

    expect(mockScheduled.has('dormant-reminder-day-7')).toBe(false)
    expect(mockScheduled.has('identity-affirmation')).toBe(true)
    expect(mockScheduled.has('educational-tip')).toBe(true)
  })
})
