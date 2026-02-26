// ─────────────────────────────────────────────────────────────
// DevClock.js — Global dev-only time offset for testing
//
// Stores a day offset that shifts the app's perceived "now".
// Used by JuiceLogStore and other date-sensitive modules.
// Only affects dev builds — production should never call advance().
// ─────────────────────────────────────────────────────────────

let _dayOffset = 0
const _listeners = new Set()

export function getDevNow() {
  const d = new Date()
  if (_dayOffset !== 0) {
    d.setDate(d.getDate() + _dayOffset)
  }
  return d
}

export function getDevDayOffset() {
  return _dayOffset
}

export function advanceDevDay(days = 1) {
  _dayOffset += days
  console.log('[DevClock] offset now:', _dayOffset, 'days — perceived date:', getDevNow().toISOString())
  _listeners.forEach((fn) => fn(_dayOffset))
}

export function resetDevClock() {
  _dayOffset = 0
  console.log('[DevClock] reset to real time')
  _listeners.forEach((fn) => fn(_dayOffset))
}

export function onDevClockChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
