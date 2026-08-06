// ─────────────────────────────────────────────────────────────
// deviceRecallBits.ts — Shared pure logic for encoding and
// decoding Google Play Integrity Device Recall values.
//
// This file is duplicated in both:
//   src/services/devicePool/deviceRecallBits.ts (client)
//   supabase/functions/_shared/deviceRecallBits.ts (server)
//
// They must be kept in sync. The pure logic has no platform
// dependencies so it works in both React Native and Deno.
// ─────────────────────────────────────────────────────────────

export const DEVICE_POOL_LIMIT = 5

export interface DeviceRecallBits {
  bitFirst: boolean
  bitSecond: boolean
  bitThird: boolean
}

export interface DeviceRecallTimestamps {
  bitFirstTimestamp: string | null
  bitSecondTimestamp: string | null
  bitThirdTimestamp: string | null
}

export interface DeviceRecallState {
  bits: DeviceRecallBits
  timestamps: DeviceRecallTimestamps
}

export type EnforcementMode = 'off' | 'observe' | 'enforce'

export function encodeDeviceUsageCount(count: number): DeviceRecallBits {
  if (count < 0 || count > 5) {
    throw new Error(`encodeDeviceUsageCount: count must be 0-5, got ${count}`)
  }
  return {
    bitFirst: count >= 4,
    bitSecond: (count % 4) >= 2,
    bitThird: (count % 2) >= 1,
  }
}

export function decodeDeviceUsageCount(bits: DeviceRecallBits): number {
  const binary = (bits.bitFirst ? 4 : 0) + (bits.bitSecond ? 2 : 0) + (bits.bitThird ? 1 : 0)
  if (binary > 5) {
    return DEVICE_POOL_LIMIT
  }
  return binary
}

export function isValidDeviceUsageCount(bits: DeviceRecallBits): boolean {
  const binary = (bits.bitFirst ? 4 : 0) + (bits.bitSecond ? 2 : 0) + (bits.bitThird ? 1 : 0)
  return binary <= 5
}

export function getUtcMonthKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getUtcMonthStart(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function getUtcMonthEnd(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

export function determineDeviceUsageMonth(timestamps: DeviceRecallTimestamps): string | null {
  const ts: string[] = [
    timestamps.bitFirstTimestamp,
    timestamps.bitSecondTimestamp,
    timestamps.bitThirdTimestamp,
  ].filter((t): t is string => t != null && t.length > 0)

  if (ts.length === 0) return null

  const sorted = ts.sort((a, b) => b.localeCompare(a))
  const latest = new Date(sorted[0])
  if (Number.isNaN(latest.getTime())) return null

  return getUtcMonthKey(latest)
}

export function isDeviceUsageCurrentPeriod(
  timestamps: DeviceRecallTimestamps,
  now: Date = new Date(),
): boolean {
  const usageMonth = determineDeviceUsageMonth(timestamps)
  if (usageMonth == null) return true
  return usageMonth === getUtcMonthKey(now)
}

export function calculateDeviceRemaining(
  bits: DeviceRecallBits,
  timestamps: DeviceRecallTimestamps,
  now: Date = new Date(),
): number {
  if (!isDeviceUsageCurrentPeriod(timestamps, now)) {
    return DEVICE_POOL_LIMIT
  }
  const used = decodeDeviceUsageCount(bits)
  return Math.max(0, DEVICE_POOL_LIMIT - used)
}

export function calculateEffectiveFreeRemaining(
  accountRemaining: number,
  deviceRemaining: number,
): number {
  return Math.max(0, Math.min(DEVICE_POOL_LIMIT, accountRemaining, deviceRemaining))
}

export function nextDeviceUsageCount(
  bits: DeviceRecallBits,
  timestamps: DeviceRecallTimestamps,
  now: Date = new Date(),
): number {
  if (!isDeviceUsageCurrentPeriod(timestamps, now)) {
    return 1
  }
  const currentUsed = decodeDeviceUsageCount(bits)
  return Math.min(DEVICE_POOL_LIMIT, currentUsed + 1)
}
