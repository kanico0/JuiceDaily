// ─────────────────────────────────────────────────────────────
// DevClock.js — Global dev-only time offset for testing
//
// Stores a day offset that shifts the app's perceived "now".
// Used by JuiceLogStore and other date-sensitive modules.
// Only affects dev builds — production should never call advance().
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@juicing_dev_clock_offset_v1'
let _dayOffset = 0
const _listeners = new Set()

function notifyListeners() {
  _listeners.forEach((fn) => fn(_dayOffset))
}

async function persistOffset() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, String(_dayOffset))
  } catch (error) {
    console.warn('[DevClock] failed to persist offset:', error)
  }
}

export async function hydrateDevClock() {
  try {
    const storedOffset = await AsyncStorage.getItem(STORAGE_KEY)
    const parsedOffset = Number.parseInt(storedOffset || '0', 10)
    _dayOffset = Number.isFinite(parsedOffset) ? parsedOffset : 0
  } catch (error) {
    console.warn('[DevClock] failed to hydrate offset:', error)
    _dayOffset = 0
  }
  notifyListeners()
}

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

export async function advanceDevDay(days = 1) {
  _dayOffset += days
  await persistOffset()
  console.log('[DevClock] offset now:', _dayOffset, 'days — perceived date:', getDevNow().toISOString())
  notifyListeners()
}

export async function resetDevClock() {
  _dayOffset = 0
  await persistOffset()
  console.log('[DevClock] reset to real time')
  notifyListeners()
}

export function onDevClockChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}
