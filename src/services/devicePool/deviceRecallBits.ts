// ─────────────────────────────────────────────────────────────
// deviceRecallBits.ts — Pure logic for encoding and decoding
// Google Play Integrity Device Recall values for RawLifeFlow's
// two independent FREE device-level AI-cost allowances.
//
// This file is duplicated in both:
//   src/services/devicePool/deviceRecallBits.ts (client)
//   supabase/functions/_shared/deviceRecallBits.ts (server)
//
// They must be kept in sync. The pure logic has no platform
// dependencies so it works in both React Native and Deno.
//
// ── Bit Allocation (RawLifeFlow canonical) ───────────────────
//
// Google Play Integrity Device Recall provides three privacy-
// preserving per-device bits that persist across app reinstall
// and device factory reset. They are shared across ALL apps
// under the same Google Play developer account.
//
// RawLifeFlow reserves:
//
//   bitFirst  = Free Snap monthly consumption
//     false = not consumed this month
//     true  = consumed (yyyymmFirst determines which month)
//     Monthly reset: if yyyymmFirst < current YYYYMM, treat as
//     not consumed (new month).
//
//   bitSecond = Free Advanced Blend lifetime count (MSB)
//   bitThird  = Free Advanced Blend lifetime count (LSB)
//     Standard binary encoding:
//       00 = 0 used (bitSecond=false, bitThird=false)
//       01 = 1 used (bitSecond=false, bitThird=true)
//       10 = 2 used (bitSecond=true,  bitThird=false)
//       11 = 3 used / exhausted (bitSecond=true, bitThird=true)
//     Lifetime: never reset by the app. Google retains bits for
//     3 years after last read/write access.
//
// Snap writes touch ONLY bitFirst.
// Blend writes touch ONLY bitSecond/bitThird.
// The bits are independently writable and independently dated.
//
// PLAY CONSOLE HUMAN VERIFICATION REQUIRED: Before production
// Device Recall writes are enabled, verify that no other app
// under the same Google Play developer account already uses
// Device Recall bits. Overwriting another app's state would
// corrupt its anti-abuse data.
// ─────────────────────────────────────────────────────────────

export const FREE_DEVICE_SNAP_LIMIT = 1
export const FREE_DEVICE_BLEND_LIMIT = 3

export interface DeviceRecallBits {
  bitFirst: boolean
  bitSecond: boolean
  bitThird: boolean
}

export interface DeviceRecallWriteDates {
  yyyymmFirst: number | null
  yyyymmSecond: number | null
  yyyymmThird: number | null
}

export interface DeviceRecallState {
  bits: DeviceRecallBits
  writeDates: DeviceRecallWriteDates
}

export type EnforcementMode = 'off' | 'observe' | 'enforce'

// ── YYYYMM helper ─────────────────────────────────────────────

export function currentYyyymm(date: Date = new Date()): number {
  return date.getUTCFullYear() * 100 + (date.getUTCMonth() + 1)
}

// ── Snap: bitFirst ────────────────────────────────────────────

export function isSnapConsumedThisMonth(
  bitFirst: boolean,
  yyyymmFirst: number | null,
  now: Date = new Date(),
): boolean {
  if (!bitFirst) return false
  if (yyyymmFirst == null) return true // bit set but no date → conservatively consumed
  return yyyymmFirst === currentYyyymm(now)
}

export function deviceSnapRemaining(
  bitFirst: boolean,
  yyyymmFirst: number | null,
  now: Date = new Date(),
): number {
  return isSnapConsumedThisMonth(bitFirst, yyyymmFirst, now) ? 0 : FREE_DEVICE_SNAP_LIMIT
}

// ── Advanced Blend: bitSecond (MSB) + bitThird (LSB) ──────────
// Standard binary encoding:
//   00 = 0 used, 01 = 1 used, 10 = 2 used, 11 = 3 used

export function decodeBlendDeviceUsed(bitSecond: boolean, bitThird: boolean): number {
  return (bitSecond ? 2 : 0) + (bitThird ? 1 : 0)
}

export function deviceBlendRemaining(bitSecond: boolean, bitThird: boolean): number {
  return Math.max(0, FREE_DEVICE_BLEND_LIMIT - decodeBlendDeviceUsed(bitSecond, bitThird))
}

// Next blend state after one successful analysis.
// Returns only the bits that CHANGED (to minimize writes).
// Google API: unspecified bits remain unchanged.
//
// Transitions:
//   0 (00) → 1 (01): set bitThird=true
//   1 (01) → 2 (10): set bitSecond=true, bitThird=false
//   2 (10) → 3 (11): set bitThird=true
//   3 (11) → 3 (11): no change (exhausted)
export function encodeNextBlendWriteValues(currentUsed: number): {
  bitSecond?: boolean
  bitThird?: boolean
} {
  const next = Math.min(FREE_DEVICE_BLEND_LIMIT, currentUsed + 1)
  const currentSecond = currentUsed >= 2
  const currentThird = currentUsed % 2 === 1
  const nextSecond = next >= 2
  const nextThird = next % 2 === 1

  const result: { bitSecond?: boolean; bitThird?: boolean } = {}
  if (nextSecond !== currentSecond) result.bitSecond = nextSecond
  if (nextThird !== currentThird) result.bitThird = nextThird
  return result
}

// ── Effective remaining (min of account and device) ───────────

export function effectiveSnapRemaining(accountRemaining: number, deviceRemaining: number): number {
  return Math.max(0, Math.min(accountRemaining, deviceRemaining))
}

export function effectiveBlendRemaining(accountRemaining: number, deviceRemaining: number): number {
  return Math.max(0, Math.min(accountRemaining, deviceRemaining))
}

// ── Backward-compatibility aliases (deprecated) ───────────────
// These preserve API compatibility for code that still imports
// the old names. They delegate to the new logic.

export const DEVICE_POOL_LIMIT = FREE_DEVICE_SNAP_LIMIT

export function getUtcMonthKey(date: Date = new Date()): string {
  const yyyymm = currentYyyymm(date)
  const year = Math.floor(yyyymm / 100)
  const month = String(yyyymm % 100).padStart(2, '0')
  return `${year}-${month}`
}

export function getUtcMonthStart(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function getUtcMonthEnd(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}
