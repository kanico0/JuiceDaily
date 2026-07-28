const mockStorage = new Map()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStorage.get(key) || null)),
  setItem: jest.fn((key, value) => {
    mockStorage.set(key, value)
    return Promise.resolve()
  }),
  multiSet: jest.fn((entries) => {
    entries.forEach(([key, value]) => mockStorage.set(key, value))
    return Promise.resolve()
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((key) => mockStorage.delete(key))
    return Promise.resolve()
  }),
}))

const mockGetDevNow = jest.fn()

jest.mock('../../utils/DevClock', () => ({ getDevNow: mockGetDevNow }))

const {
  checkInToday,
  getGlowState,
  getGlowTodayKey,
  resetGlowStreak,
} = require('../glowStreak')

function setLocalDay(year, month, day) {
  mockGetDevNow.mockReturnValue({
    getFullYear: () => year,
    getMonth: () => month - 1,
    getDate: () => day,
  })
}

describe('glowStreak', () => {
  beforeEach(async () => {
    mockStorage.clear()
    jest.clearAllMocks()
    setLocalDay(2026, 7, 21)
    await resetGlowStreak()
  })

  test('uses the local date key at a positive UTC offset boundary', () => {
    setLocalDay(2026, 7, 21)

    expect(new Date('2026-07-20T16:30:00.000Z').toISOString().slice(0, 10)).toBe('2026-07-20')
    expect(getGlowTodayKey()).toBe('2026-07-21')
  })

  test('first check-in creates a one-day Glow Streak', async () => {
    await expect(checkInToday()).resolves.toMatchObject({
      count: 1,
      wasIncremented: true,
      wasReset: false,
    })

    await expect(getGlowState()).resolves.toMatchObject({
      count: 1,
      lastCheckInDate: '2026-07-21',
    })
  })

  test('multiple check-ins on the same local day increment only once', async () => {
    await checkInToday()

    await expect(checkInToday()).resolves.toMatchObject({
      count: 1,
      wasIncremented: false,
    })
  })

  test('consecutive local-day check-ins increment the Glow Streak', async () => {
    await checkInToday()
    setLocalDay(2026, 7, 22)

    await expect(checkInToday()).resolves.toMatchObject({
      count: 2,
      wasIncremented: true,
      silentGrace: false,
    })
  })

  test('one missed local day uses the existing silent grace behavior', async () => {
    await checkInToday()
    setLocalDay(2026, 7, 23)

    await expect(checkInToday()).resolves.toMatchObject({
      count: 2,
      wasIncremented: true,
      silentGrace: true,
      wasReset: false,
    })
  })

  test('a larger local-day gap resets the Glow Streak to one', async () => {
    await checkInToday()
    setLocalDay(2026, 7, 24)

    await expect(checkInToday()).resolves.toMatchObject({
      count: 1,
      wasIncremented: true,
      silentGrace: false,
      wasReset: true,
    })
  })
})
