// ─────────────────────────────────────────────────────────────
// suppressWarnings.js — Patch console.warn AND console.error
// before any module that emits known warnings gets imported.
// Import this file FIRST in App.js (before all other imports).
// ─────────────────────────────────────────────────────────────

const SUPPRESSED = [
  'expo-notifications',
  'Android push notification',
]

function shouldSuppress(args) {
  if (typeof args[0] === 'string') {
    return SUPPRESSED.some((s) => args[0].includes(s))
  }
  return false
}

const _origWarn = console.warn
console.warn = (...args) => {
  if (shouldSuppress(args)) return
  _origWarn.apply(console, args)
}

const _origError = console.error
console.error = (...args) => {
  if (shouldSuppress(args)) return
  _origError.apply(console, args)
}
