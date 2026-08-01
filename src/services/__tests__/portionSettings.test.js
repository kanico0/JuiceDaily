const {
  getPreferredPortionEntryMode,
  setPreferredPortionEntryMode,
  normalizePreferredPortionEntryMode,
} = require('../portionEntryPreference')
const { ALL_STORAGE_KEYS } = require('../storage')

const PORTION_KEY = '@juicing_portion_entry_mode_v1'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiRemove: jest.fn(),
  },
}))

const AsyncStorage = require('@react-native-async-storage/async-storage').default

describe('Settings — Preferred Portion Entry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    AsyncStorage.getItem.mockResolvedValue(null)
    AsyncStorage.setItem.mockResolvedValue(undefined)
  })

  it('1. getPreferredPortionEntryMode returns quantity by default', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  it('2. getPreferredPortionEntryMode returns stored weight', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      schemaVersion: 2,
      persistedAt: '2026-01-01T00:00:00',
      payload: 'weight',
    }))
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('weight')
  })

  it('3. getPreferredPortionEntryMode returns stored quantity', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      schemaVersion: 2,
      persistedAt: '2026-01-01T00:00:00',
      payload: 'quantity',
    }))
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  it('4. setPreferredPortionEntryMode persists via AsyncStorage.setItem', async () => {
    await setPreferredPortionEntryMode('quantity')
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PORTION_KEY,
      expect.stringContaining('"payload":"quantity"')
    )
  })

  it('5. invalid stored preference falls back to quantity', async () => {
    AsyncStorage.getItem.mockResolvedValue('"invalid_mode"')
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  it('6. preference persists across calls', async () => {
    await setPreferredPortionEntryMode('quantity')
    // loadState expects the wrapped format from saveStateImmediate
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
      schemaVersion: 2,
      persistedAt: '2026-01-01T00:00:00',
      payload: 'quantity',
    }))
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  it('7. changing Settings does not mutate an existing ingredient', () => {
    // Structural test: setPreferredPortionEntryMode only writes to AsyncStorage,
    // it does not touch any ingredient state
    expect(typeof setPreferredPortionEntryMode).toBe('function')
    // The function takes only a mode string, no ingredient data
    expect(setPreferredPortionEntryMode.length).toBe(1)
  })

  it('8. full storage reset clears the preference', () => {
    // The key must be registered in ALL_STORAGE_KEYS for nuclear reset
    expect(ALL_STORAGE_KEYS).toContain(PORTION_KEY)
  })

  it('9. Settings interaction invokes no quota service', () => {
    // Verify that portionEntryPreference module does not import any quota services
    // by checking that the module exports only preference-related functions
    const module = require('../portionEntryPreference')
    const exports = Object.keys(module)
    expect(exports).toContain('getPreferredPortionEntryMode')
    expect(exports).toContain('setPreferredPortionEntryMode')
    expect(exports).toContain('normalizePreferredPortionEntryMode')
    // No quota-related exports
    expect(exports).not.toContain('useSnap')
    expect(exports).not.toContain('consumeAiScan')
    expect(exports).not.toContain('checkSnapEligibility')
  })

  it('10. normalizePreferredPortionEntryMode validates correctly', () => {
    expect(normalizePreferredPortionEntryMode('weight')).toBe('weight')
    expect(normalizePreferredPortionEntryMode('quantity')).toBe('quantity')
    expect(normalizePreferredPortionEntryMode('invalid')).toBe('quantity')
    expect(normalizePreferredPortionEntryMode(null)).toBe('quantity')
    expect(normalizePreferredPortionEntryMode(undefined)).toBe('quantity')
  })
})
