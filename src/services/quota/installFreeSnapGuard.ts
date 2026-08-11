// ─────────────────────────────────────────────────────────────
// installFreeSnapGuard.ts — Persistent install-level Free Snap guard.
//
// Prevents the logout → new anonymous UUID → fresh quota loophole.
//
// The Supabase user UUID changes on every logout (signInAnonymously
// creates a brand-new identity). Server quota rows are keyed by UUID,
// so a new anonymous user starts with a fresh 0/1 allowance — even
// on the same installation that already consumed a complimentary
// Snap. This module bridges that gap by tracking successful Free AI
// Snaps at the *installation* level, independent of the Supabase UUID.
//
// The marker survives logout, account switching, and app restarts.
// It resets when the server's monthly quota window changes
// (periodStart mismatch), aligning with the existing server quota
// period rather than an arbitrary timer.
//
// For Free users, the effective remaining is:
//   min(account remaining, install remaining)
//
// Pro users bypass this guard entirely — the install marker is
// irrelevant for Pro quota.
//
// No hardware identifiers or device-specific tracking are used. The
// marker is a simple AsyncStorage record keyed by the server-provided
// quota period start.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'

export const INSTALL_FREE_SNAP_KEY = '@juicing_install_free_snap_v1'

interface InstallFreeSnapRecord {
  // The server quota periodStart when the snap was consumed.
  // A mismatch with the current periodStart means a new monthly
  // window has begun and the allowance resets.
  windowKey: string
  // ISO timestamp of consumption (for debugging only).
  consumedAt: string
}

async function readRecord(): Promise<InstallFreeSnapRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_FREE_SNAP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.windowKey === 'string' &&
      typeof parsed.consumedAt === 'string'
    ) {
      return parsed as InstallFreeSnapRecord
    }
    return null
  } catch {
    return null
  }
}

async function writeRecord(record: InstallFreeSnapRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_FREE_SNAP_KEY, JSON.stringify(record))
  } catch (e) {
    console.warn('[installFreeSnapGuard] write failed:', (e as Error)?.message)
  }
}

// Returns the install-level remaining allowance for Free users:
//   1 — no consumed marker exists for the current window
//   0 — consumed marker exists for the current window
//   null — window is unknown (server quota is null or missing periodStart)
//
// When the server quota's periodStart differs from the stored
// marker's windowKey, a new monthly window has begun and the
// allowance resets to 1.
export async function getInstallFreeSnapRemaining(
  serverQuota: ScanQuotaSnapshot | null,
): Promise<number | null> {
  if (!serverQuota) return null
  if (!serverQuota.periodStart) return null
  const record = await readRecord()
  if (!record) return 1
  // Same window → consumed
  if (record.windowKey === serverQuota.periodStart) return 0
  // Different window → new month, allowance resets
  return 1
}

// Mark the install-level Free Snap as consumed for the given window.
// Idempotent — calling multiple times for the same window is safe.
// Calling with a different windowKey overwrites the previous marker
// (the old window has ended and a new one has begun).
export async function markInstallFreeSnapConsumed(
  windowKey: string,
): Promise<void> {
  if (!windowKey) return
  const existing = await readRecord()
  // Already consumed for this window — no-op
  if (existing && existing.windowKey === windowKey) return
  await writeRecord({
    windowKey,
    consumedAt: new Date().toISOString(),
  })
}

// Clear the install marker. Used by nuclear reset.
export async function clearInstallFreeSnapState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INSTALL_FREE_SNAP_KEY)
  } catch (e) {
    console.warn('[installFreeSnapGuard] clear failed:', (e as Error)?.message)
  }
}

// Compose the effective quota snapshot by applying the install guard
// to the server quota.
//
// For Free users:
//   effective remaining = min(server remaining, install remaining)
//   effective used = limit - effective remaining
//
// For Pro users:
//   The server quota is returned as-is (Pro bypasses the install guard).
//
// When installRemaining is null (loading/unknown), the effective quota
// is null for Free users (fail-closed — never imply an unused
// complimentary Snap when the install state is unknown).
export function composeEffectiveQuota(
  serverQuota: ScanQuotaSnapshot | null,
  installRemaining: number | null,
): ScanQuotaSnapshot | null {
  if (!serverQuota) return null
  // Pro bypass — install guard is irrelevant
  if (serverQuota.plan === 'pro') return serverQuota
  // Unknown install state — fail-closed for Free
  if (installRemaining === null) return null
  const effectiveRemaining = Math.min(serverQuota.remaining, installRemaining)
  const effectiveUsed = Math.max(0, serverQuota.limit - effectiveRemaining)
  return {
    ...serverQuota,
    remaining: effectiveRemaining,
    used: effectiveUsed,
  }
}
