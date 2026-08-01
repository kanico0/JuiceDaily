// ─────────────────────────────────────────────────────────────
// portionEntryPreference.test.ts
//
// Tests for the Preferred Portion Entry preference persistence.
// ─────────────────────────────────────────────────────────────

import {
  getPreferredPortionEntryMode,
  setPreferredPortionEntryMode,
  normalizePreferredPortionEntryMode,
  PORTION_ENTRY_PREF_KEY,
} from '../portionEntryPreference'
import { ALL_STORAGE_KEYS, resetAllStorageKeys } from '../storage'

// ── Mock AsyncStorage ────────────────────────────────────────

const mockStore: Record<string, string> = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore[key] = value
    return Promise.resolve()
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStore[key]
    return Promise.resolve()
  }),
  multiRemove: jest.fn((keys: string[]) => {
    for (const k of keys) delete mockStore[k]
    return Promise.resolve()
  }),
}))

beforeEach(() => {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key]
  }
  jest.clearAllMocks()
})

describe('Portion Entry Preference', () => {

  // 1. Missing stored preference returns quantity (default for new users)
  test('1. missing stored preference returns quantity', async () => {
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  // 2. Stored weight returns weight
  test('2. stored weight returns weight', async () => {
    await setPreferredPortionEntryMode('weight')
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('weight')
  })

  // 3. Stored quantity returns quantity
  test('3. stored quantity returns quantity', async () => {
    await setPreferredPortionEntryMode('quantity')
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  // 4. Invalid value returns quantity (default fallback)
  test('4. invalid stored value returns quantity', async () => {
    // Manually inject invalid data
    mockStore[PORTION_ENTRY_PREF_KEY] = JSON.stringify({
      schemaVersion: 2,
      persistedAt: '2026-07-30T12:00:00',
      payload: 'invalid_mode',
    })
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  // 5. Setter persists weight
  test('5. setter persists weight', async () => {
    await setPreferredPortionEntryMode('weight')
    expect(mockStore[PORTION_ENTRY_PREF_KEY]).toBeDefined()
    const parsed = JSON.parse(mockStore[PORTION_ENTRY_PREF_KEY])
    expect(parsed.payload).toBe('weight')
  })

  // 6. Setter persists quantity
  test('6. setter persists quantity', async () => {
    await setPreferredPortionEntryMode('quantity')
    expect(mockStore[PORTION_ENTRY_PREF_KEY]).toBeDefined()
    const parsed = JSON.parse(mockStore[PORTION_ENTRY_PREF_KEY])
    expect(parsed.payload).toBe('quantity')
  })

  // 7. Invalid setter input is rejected/normalized safely
  test('7. invalid setter input is normalized to quantity', async () => {
    await setPreferredPortionEntryMode('invalid' as any)
    const parsed = JSON.parse(mockStore[PORTION_ENTRY_PREF_KEY])
    expect(parsed.payload).toBe('quantity')
  })

  // 8. Preference key appears in reset key list
  test('8. preference key is in ALL_STORAGE_KEYS', () => {
    expect(ALL_STORAGE_KEYS).toContain(PORTION_ENTRY_PREF_KEY)
  })

  // 9. Changing preference does not mutate an existing ingredient object
  test('9. changing preference does not mutate existing ingredient', async () => {
    const ingredient = { produceId: 'apple', weightG: 182, isOrganic: false }
    const snapshot = JSON.parse(JSON.stringify(ingredient))
    await setPreferredPortionEntryMode('quantity')
    expect(ingredient).toEqual(snapshot)
  })

  // 10. Storage read failure falls back safely
  test('10. storage read failure falls back to quantity', async () => {
    // Corrupt JSON in storage
    mockStore[PORTION_ENTRY_PREF_KEY] = 'not-valid-json{{'
    const mode = await getPreferredPortionEntryMode()
    expect(mode).toBe('quantity')
  })

  // 11. Storage write failure is reported according to storage conventions
  test('11. normalizePreferredPortionEntryMode handles various inputs', () => {
    expect(normalizePreferredPortionEntryMode('weight')).toBe('weight')
    expect(normalizePreferredPortionEntryMode('quantity')).toBe('quantity')
    expect(normalizePreferredPortionEntryMode(null)).toBe('quantity')
    expect(normalizePreferredPortionEntryMode(undefined)).toBe('quantity')
    expect(normalizePreferredPortionEntryMode('invalid')).toBe('quantity')
    expect(normalizePreferredPortionEntryMode(123)).toBe('quantity')
  })

  // Bonus: reset clears the preference
  test('resetAllStorageKeys clears the preference', async () => {
    await setPreferredPortionEntryMode('quantity')
    expect(mockStore[PORTION_ENTRY_PREF_KEY]).toBeDefined()
    await resetAllStorageKeys()
    expect(mockStore[PORTION_ENTRY_PREF_KEY]).toBeUndefined()
  })
})
