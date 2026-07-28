const mockCancelScheduledNotificationAsync = jest.fn(() => Promise.resolve())
const mockScheduleNotificationAsync = jest.fn(() => Promise.resolve())

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { DEFAULT: 3 },
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

const mockGetGlowState = jest.fn()
const mockGetGlowTodayKey = jest.fn(() => '2026-07-21')

jest.mock('../glowStreak', () => ({
  getGlowState: mockGetGlowState,
  getGlowTodayKey: mockGetGlowTodayKey,
}))

jest.mock('../NudgeSettingsStore', () => ({
  getNudgeSettings: jest.fn(() => Promise.resolve({
    nudges_enabled: true,
    nudges_daily_enabled: false,
    nudges_streakRisk_enabled: true,
    nudges_streakRisk_time: '19:00',
    nudges_weekly_enabled: false,
  })),
}))

const { refreshNudges } = require('../NotificationNudges')

describe('NotificationNudges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('cancels the current streak-risk reminder after an automatic Glow check-in refresh', async () => {
    mockGetGlowState.mockResolvedValue({ count: 4, lastCheckInDate: '2026-07-21' })

    await refreshNudges()

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('nudge-streak-risk')
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled()
  })

  test('keeps the streak-risk reminder eligible before a Glow check-in', async () => {
    mockGetGlowState.mockResolvedValue({ count: 4, lastCheckInDate: '2026-07-20' })

    await refreshNudges()

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'nudge-streak-risk',
    }))
  })
})
