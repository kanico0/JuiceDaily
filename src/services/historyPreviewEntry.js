// ─────────────────────────────────────────────────────────────
// historyPreviewEntry.js — Pure helper to determine which
// history entry receives the rotating Advanced Preview for
// free users.
//
// Uses the same canonical sort order as HistoryScreen:
//   1. dateKey descending (localeCompare)
//   2. createdAt descending (localeCompare) as tie-breaker
//
// Only valid, displayable entries are eligible.
// ─────────────────────────────────────────────────────────────

/**
 * Check if a history entry is valid and displayable.
 * Mirrors the sanitization in JuiceLogStore and HistoryScreen.
 *
 * @param {any} entry
 * @returns {boolean}
 */
export function isValidHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (typeof entry.id !== 'string' || !entry.id) return false
  if (typeof entry.createdAt !== 'string' || !entry.createdAt) return false
  if (typeof entry.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey)) return false
  return true
}

/**
 * Sort entries newest-to-oldest using canonical order:
 *   1. dateKey descending
 *   2. createdAt descending (deterministic tie-breaker)
 *
 * Does NOT mutate the input array.
 *
 * @param {Array} entries
 * @returns {Array} sorted copy
 */
export function sortHistoryNewestFirst(entries) {
  if (!Array.isArray(entries)) return []
  return [...entries].filter(isValidHistoryEntry).sort((a, b) => {
    const dateCmp = (b.dateKey || '').localeCompare(a.dateKey || '')
    if (dateCmp !== 0) return dateCmp
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })
}

/**
 * Determine the entry ID that should receive the Advanced Preview.
 *
 * For a free user, the preview is the first valid entry in
 * canonical newest-to-oldest order.
 *
 * @param {Array} entries - Raw entries from JuiceLogStore (unsorted OK).
 * @returns {string|null} The preview entry ID, or null if no valid entries.
 */
export function getAdvancedPreviewEntryId(entries) {
  const sorted = sortHistoryNewestFirst(entries)
  if (sorted.length === 0) return null
  return sorted[0].id
}

/**
 * Check if a specific entry ID is the current preview entry.
 *
 * @param {Array} entries
 * @param {string} entryId
 * @returns {boolean}
 */
export function isAdvancedPreviewEntry(entries, entryId) {
  if (!entryId) return false
  return getAdvancedPreviewEntryId(entries) === entryId
}
