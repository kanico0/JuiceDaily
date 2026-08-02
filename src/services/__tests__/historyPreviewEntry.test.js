// ─────────────────────────────────────────────────────────────
// historyPreviewEntry.test.js — Tests for the rotating
// Advanced Preview entry determination helper.
//
// Covers:
//   1-10.  getAdvancedPreviewEntryId basic scenarios
//   11-20. sortHistoryNewestFirst ordering
//   21-25. isValidHistoryEntry validation
//   26-30. isAdvancedPreviewEntry helper
//   31-35. Tie-breaker scenarios
//   36-40. Edge cases (empty, null, corrupt)
//   41-45. Immutability
// ─────────────────────────────────────────────────────────────

import {
  getAdvancedPreviewEntryId,
  sortHistoryNewestFirst,
  isValidHistoryEntry,
  isAdvancedPreviewEntry,
} from '../historyPreviewEntry'

function makeEntry(id, dateKey, createdAt) {
  return { id, dateKey, createdAt, source: 'manual', title: 'Test', ingredients: ['kale'] }
}

describe('historyPreviewEntry — getAdvancedPreviewEntryId', () => {
  test('1. Returns null for empty array', () => {
    expect(getAdvancedPreviewEntryId([])).toBeNull()
  })

  test('2. Returns the only entry ID for single entry', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    expect(getAdvancedPreviewEntryId(entries)).toBe('e1')
  })

  test('3. Returns newest by dateKey', () => {
    const entries = [
      makeEntry('e1', '2026-07-14', '2026-07-14T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
      makeEntry('e3', '2026-07-13', '2026-07-13T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('e2')
  })

  test('4. Returns newest by createdAt when same dateKey', () => {
    const entries = [
      makeEntry('e1', '2026-07-15', '2026-07-15T08:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T14:00:00'),
      makeEntry('e3', '2026-07-15', '2026-07-15T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('e2')
  })

  test('5. Handles unsorted input correctly', () => {
    const entries = [
      makeEntry('e3', '2026-07-13', '2026-07-13T10:00:00'),
      makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00'),
      makeEntry('e2', '2026-07-14', '2026-07-14T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('e1')
  })

  test('6. Returns null for null input', () => {
    expect(getAdvancedPreviewEntryId(null)).toBeNull()
  })

  test('7. Returns null for undefined input', () => {
    expect(getAdvancedPreviewEntryId(undefined)).toBeNull()
  })

  test('8. Entry without dateKey sorts after entries with dateKey', () => {
    const entries = [
      { id: 'noDate', createdAt: '2026-07-15T10:00:00' },
      makeEntry('good', '2026-07-14', '2026-07-14T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('good')
  })

  test('9. Returns null when all entries are invalid', () => {
    const entries = [
      { id: 'bad1' },
      { id: 123, createdAt: '2026-07-15T10:00:00' },
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBeNull()
  })

  test('10. Handles large number of entries', () => {
    const entries = []
    for (let i = 0; i < 100; i++) {
      entries.push(makeEntry(`e${i}`, `2026-07-${String(i % 28 + 1).padStart(2, '0')}`, `2026-07-${String(i % 28 + 1).padStart(2, '0')}T10:00:00`))
    }
    const result = getAdvancedPreviewEntryId(entries)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

describe('historyPreviewEntry — sortHistoryNewestFirst', () => {
  test('11. Sorts by dateKey descending', () => {
    const entries = [
      makeEntry('e1', '2026-07-13', '2026-07-13T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
      makeEntry('e3', '2026-07-14', '2026-07-14T10:00:00'),
    ]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted[0].id).toBe('e2')
    expect(sorted[1].id).toBe('e3')
    expect(sorted[2].id).toBe('e1')
  })

  test('12. Tie-breaks by createdAt descending', () => {
    const entries = [
      makeEntry('e1', '2026-07-15', '2026-07-15T08:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T14:00:00'),
    ]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted[0].id).toBe('e2')
    expect(sorted[1].id).toBe('e1')
  })

  test('13. Does not mutate original array', () => {
    const entries = [
      makeEntry('e1', '2026-07-13', '2026-07-13T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
    ]
    const original = [...entries]
    sortHistoryNewestFirst(entries)
    expect(entries).toEqual(original)
  })

  test('14. Returns empty array for null input', () => {
    expect(sortHistoryNewestFirst(null)).toEqual([])
  })

  test('15. Filters invalid entries from sort', () => {
    const entries = [
      makeEntry('valid', '2026-07-15', '2026-07-15T10:00:00'),
      { id: 'invalid' },
    ]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted.length).toBe(1)
    expect(sorted[0].id).toBe('valid')
  })

  test('16. Handles single entry', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted.length).toBe(1)
  })

  test('17. Preserves entry properties', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted[0].title).toBe('Test')
    expect(sorted[0].ingredients).toEqual(['kale'])
  })

  test('18. Handles same dateKey and same createdAt (stable)', () => {
    const entries = [
      makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
    ]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted.length).toBe(2)
  })

  test('19. Sort is deterministic', () => {
    const entries = [
      makeEntry('e1', '2026-07-14', '2026-07-14T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
    ]
    const s1 = sortHistoryNewestFirst(entries)
    const s2 = sortHistoryNewestFirst(entries)
    expect(s1.map((e) => e.id)).toEqual(s2.map((e) => e.id))
  })

  test('20. Returns new array instance', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted).not.toBe(entries)
  })
})

describe('historyPreviewEntry — isValidHistoryEntry', () => {
  test('21. Valid entry returns true', () => {
    expect(isValidHistoryEntry(makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00'))).toBe(true)
  })

  test('22. Null returns false', () => {
    expect(isValidHistoryEntry(null)).toBe(false)
  })

  test('23. Missing id returns false', () => {
    expect(isValidHistoryEntry({ dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' })).toBe(false)
  })

  test('24. Missing dateKey returns true (legacy compat)', () => {
    expect(isValidHistoryEntry({ id: 'e1', createdAt: '2026-07-15T10:00:00' })).toBe(true)
  })

  test('25. Malformed dateKey returns true (dateKey not validated)', () => {
    expect(isValidHistoryEntry({ id: 'e1', dateKey: 'invalid', createdAt: '2026-07-15T10:00:00' })).toBe(true)
  })
})

describe('historyPreviewEntry — isAdvancedPreviewEntry', () => {
  test('26. Returns true for the preview entry', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    expect(isAdvancedPreviewEntry(entries, 'e1')).toBe(true)
  })

  test('27. Returns false for non-preview entry', () => {
    const entries = [
      makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00'),
      makeEntry('e2', '2026-07-14', '2026-07-14T10:00:00'),
    ]
    expect(isAdvancedPreviewEntry(entries, 'e2')).toBe(false)
  })

  test('28. Returns false for null entryId', () => {
    expect(isAdvancedPreviewEntry([], null)).toBe(false)
  })

  test('29. Returns false for empty entries', () => {
    expect(isAdvancedPreviewEntry([], 'e1')).toBe(false)
  })

  test('30. Returns false for undefined entryId', () => {
    expect(isAdvancedPreviewEntry([makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')], undefined)).toBe(false)
  })
})

describe('historyPreviewEntry — tie-breaker scenarios', () => {
  test('31. Same dateKey, different createdAt — newest createdAt wins', () => {
    const entries = [
      makeEntry('a', '2026-07-15', '2026-07-15T09:00:00'),
      makeEntry('b', '2026-07-15', '2026-07-15T12:00:00'),
      makeEntry('c', '2026-07-15', '2026-07-15T11:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('b')
  })

  test('32. Different dateKey — newest date wins regardless of createdAt', () => {
    const entries = [
      makeEntry('a', '2026-07-16', '2026-07-16T06:00:00'),
      makeEntry('b', '2026-07-15', '2026-07-15T23:59:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('a')
  })

  test('33. Locale-compare date ordering is correct', () => {
    const entries = [
      makeEntry('a', '2026-07-09', '2026-07-09T10:00:00'),
      makeEntry('b', '2026-07-10', '2026-07-10T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('b')
  })

  test('34. Cross-month ordering is correct', () => {
    const entries = [
      makeEntry('a', '2026-08-01', '2026-08-01T10:00:00'),
      makeEntry('b', '2026-07-31', '2026-07-31T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('a')
  })

  test('35. Cross-year ordering is correct', () => {
    const entries = [
      makeEntry('a', '2027-01-01', '2027-01-01T10:00:00'),
      makeEntry('b', '2026-12-31', '2026-12-31T10:00:00'),
    ]
    expect(getAdvancedPreviewEntryId(entries)).toBe('a')
  })
})

describe('historyPreviewEntry — edge cases', () => {
  test('36. Empty array returns null', () => {
    expect(getAdvancedPreviewEntryId([])).toBeNull()
  })

  test('37. Array with only invalid entries returns null', () => {
    expect(getAdvancedPreviewEntryId([{ foo: 'bar' }])).toBeNull()
  })

  test('38. Entry with empty string id is invalid', () => {
    expect(isValidHistoryEntry({ id: '', dateKey: '2026-07-15', createdAt: '2026-07-15T10:00:00' })).toBe(false)
  })

  test('39. Entry with empty string createdAt is invalid', () => {
    expect(isValidHistoryEntry({ id: 'e1', dateKey: '2026-07-15', createdAt: '' })).toBe(false)
  })

  test('40. Non-object entry is invalid', () => {
    expect(isValidHistoryEntry('string')).toBe(false)
    expect(isValidHistoryEntry(42)).toBe(false)
    expect(isValidHistoryEntry(undefined)).toBe(false)
  })
})

describe('historyPreviewEntry — immutability', () => {
  test('41. sortHistoryNewestFirst does not mutate input', () => {
    const entries = [
      makeEntry('e1', '2026-07-13', '2026-07-13T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
    ]
    const before = JSON.stringify(entries)
    sortHistoryNewestFirst(entries)
    expect(JSON.stringify(entries)).toBe(before)
  })

  test('42. getAdvancedPreviewEntryId does not mutate input', () => {
    const entries = [
      makeEntry('e1', '2026-07-13', '2026-07-13T10:00:00'),
      makeEntry('e2', '2026-07-15', '2026-07-15T10:00:00'),
    ]
    const before = JSON.stringify(entries)
    getAdvancedPreviewEntryId(entries)
    expect(JSON.stringify(entries)).toBe(before)
  })

  test('43. isValidHistoryEntry does not mutate input', () => {
    const entry = makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')
    const before = JSON.stringify(entry)
    isValidHistoryEntry(entry)
    expect(JSON.stringify(entry)).toBe(before)
  })

  test('44. isAdvancedPreviewEntry does not mutate input', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    const before = JSON.stringify(entries)
    isAdvancedPreviewEntry(entries, 'e1')
    expect(JSON.stringify(entries)).toBe(before)
  })

  test('45. Sorted result is a shallow copy (not deep clone)', () => {
    const entries = [makeEntry('e1', '2026-07-15', '2026-07-15T10:00:00')]
    const sorted = sortHistoryNewestFirst(entries)
    expect(sorted[0]).toBe(entries[0]) // same object reference
  })
})
