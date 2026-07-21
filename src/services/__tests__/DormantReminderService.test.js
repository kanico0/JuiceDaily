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

describe('DormantReminderService', () => {
  beforeEach(() => {
    mockStorage.clear()
    mockScheduled.clear()
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-07-20T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('schedules one reminder at each supported dormant interval', async () => {
    await recordMeaningfulActivity()

    expect(Array.from(mockScheduled.keys())).toEqual([
      'dormant-reminder-day-7',
      'dormant-reminder-day-14',
      'dormant-reminder-day-30',
      'dormant-reminder-day-60',
    ])
    expect(mockScheduled.get('dormant-reminder-day-7').trigger.date).toEqual(new Date('2026-07-27T12:00:00.000Z'))
    expect(mockScheduled.get('dormant-reminder-day-60').trigger.date).toEqual(new Date('2026-09-18T12:00:00.000Z'))
  })

  test('cancels the complete dormant sequence when comeback reminders are disabled', async () => {
    await recordMeaningfulActivity()
    await setComebackRemindersEnabled(false)

    expect(mockScheduled.size).toBe(0)
  })

  test('reconciliation removes expired reminders and restores only upcoming ones', async () => {
    mockStorage.set('@dormant_reminder_last_activity', '2026-07-10T12:00:00.000Z')
    await reconcileDormantReminders()

    expect(Array.from(mockScheduled.keys())).toEqual([
      'dormant-reminder-day-14',
      'dormant-reminder-day-30',
      'dormant-reminder-day-60',
    ])
    await cancelDormantReminders()
    expect(mockScheduled.size).toBe(0)
  })
})
