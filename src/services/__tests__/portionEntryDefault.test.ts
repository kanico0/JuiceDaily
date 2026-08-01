jest.mock('../../services/storage', () => ({
  loadState: jest.fn(),
  saveStateImmediate: jest.fn(),
  ALL_STORAGE_KEYS: [],
}))

import { normalizePreferredPortionEntryMode } from '../../services/portionEntryPreference'

describe('Item 2 — Default new users to Quantity measurement', () => {
  test('normalizePreferredPortionEntryMode returns "quantity" for null', () => {
    expect(normalizePreferredPortionEntryMode(null)).toBe('quantity')
  })

  test('normalizePreferredPortionEntryMode returns "quantity" for undefined', () => {
    expect(normalizePreferredPortionEntryMode(undefined)).toBe('quantity')
  })

  test('normalizePreferredPortionEntryMode returns "quantity" for empty string', () => {
    expect(normalizePreferredPortionEntryMode('')).toBe('quantity')
  })

  test('normalizePreferredPortionEntryMode returns "quantity" for invalid value', () => {
    expect(normalizePreferredPortionEntryMode('invalid')).toBe('quantity')
  })

  test('normalizePreferredPortionEntryMode preserves "weight" for existing users', () => {
    expect(normalizePreferredPortionEntryMode('weight')).toBe('weight')
  })

  test('normalizePreferredPortionEntryMode preserves "quantity" for existing users', () => {
    expect(normalizePreferredPortionEntryMode('quantity')).toBe('quantity')
  })

  test('new user with no preference gets "quantity" not "weight"', () => {
    const newUserPref = null
    const result = normalizePreferredPortionEntryMode(newUserPref)
    expect(result).toBe('quantity')
    expect(result).not.toBe('weight')
  })
})
