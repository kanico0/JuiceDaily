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
// ── NEW LAUNCH POLICY (1.0.21): Free = 1 LIFETIME Snap ───────
//
// The Free Snap is now a LIFETIME introductory allowance, not a
// monthly one. Once consumed on this installation, it never resets.
// This is tracked using a constant LIFETIME window key — there is no
// monthly anniversary window for Free users.
//
// ── NOT THE CANONICAL AUTHORITY ───────────────────────────────
//
// The SERVER is the sole authority for Free introductory
// eligibility, via the durable, monotonic marker:
//
//   public.scan_quotas.free_lifetime_consumed   (migration 0018)
//
// which is set exactly once inside commit_scan() and is never
// reset by monthly windows, plan changes, upgrade, downgrade,
// expiration, logout or reinstall. reserve_scan() /
// reserve_guest_scan() reject a second Free Snap server-side.
//
// This install-level guard is UX / DEFENSE-IN-DEPTH ONLY. Its sole
// purpose is to close the "logout → new anonymous UUID → fresh
// server quota row" loophole that exists BEFORE a durable account
// is established, and to avoid showing an allowance the server
// will refuse.
//
// It is deliberately one-directional: composeEffectiveQuota() takes
// min(server remaining, install remaining), so this local state can
// only ever RESTRICT access, never GRANT it. Stale, cleared, or
// tampered local state can therefore never authorize a Snap the
// server would deny — and clearing app data cannot mint a new
// introductory Snap for a durable signed-in account, because the
// server marker persists independently.
//
// The install anchor is still established (for diagnostic purposes
// and potential future use), but the consumption marker uses
// 'LIFETIME' as its windowKey, so it never expires or resets.
//
// For Free users, the effective remaining is:
//   min(account remaining, install remaining)
//
// Pro users bypass this guard entirely.
//
// No hardware identifiers or device-specific tracking are used.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'

export const INSTALL_FREE_SNAP_KEY = '@juicing_install_free_snap_v1'
export const INSTALL_ANCHOR_KEY = '@juicing_install_anchor_v1'

// NEW POLICY: Free Snap is a LIFETIME introductory allowance.
// The window key is a constant — it never changes, so once
// consumed, the marker persists forever (no monthly reset).
export const LIFETIME_WINDOW_KEY = 'LIFETIME'

// ── Install anchor record ─────────────────────────────────────
interface InstallAnchorRecord {
  // The ISO timestamp of the install anchor. Seeded once from the
  // first serverQuota.periodStart and never changed.
  anchorISO: string
  // When the anchor was established (for debugging only).
  establishedAt: string
}

// ── Consumed marker record ────────────────────────────────────
interface InstallFreeSnapRecord {
  // The install anniversary window key when the snap was consumed.
  // Computed from the install anchor (NOT the server's periodStart).
  // A mismatch means a new install anniversary window has begun.
  windowKey: string
  // ISO timestamp of consumption (for debugging only).
  consumedAt: string
}

// ── Anniversary window helpers (TypeScript) ───────────────────
// These mirror the server-side _add_months_from_anchor and
// anniversary_window_start functions. Each window is computed
// from the original anchor, NOT chained, to handle end-of-month
// clamping correctly (Jan 31 → Feb 28 → Mar 31, not Mar 28).

// Add N months to a date, using the ANCHOR's day-of-month clamped
// to the last day of the target month. The anchor's day is always
// used (not the intermediate date's day) to prevent drift.
export function addMonthsFromAnchor (anchor: Date, n: number): Date {
  const result = new Date(anchor.getTime())
  const anchorDay = anchor.getUTCDate()
  result.setUTCMonth(result.getUTCMonth() + n)
  // If the day overflowed (e.g., Jan 31 → Mar 3 because Feb has 28
  // days), clamp back to the last day of the target month.
  if (result.getUTCDate() < anchorDay) {
    result.setUTCDate(0) // Last day of previous month
  }
  return result
}

// Compute the start of the anniversary monthly window containing
// `now`, given the immutable anchor. Each window is computed
// independently from the anchor (not chained).
export function anniversaryWindowStart (anchor: Date, now: Date): Date {
  if (anchor >= now) return new Date(anchor.getTime())
  let months = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12
    + (now.getUTCMonth() - anchor.getUTCMonth())
  let candidate = addMonthsFromAnchor(anchor, months)
  if (candidate > now) {
    months--
    candidate = addMonthsFromAnchor(anchor, months)
  }
  return candidate
}

// Compute the ISO window key for the install anchor at the current
// time. This is the key used to track consumption.
export function computeInstallWindowKey (anchorISO: string, now: Date = new Date()): string {
  const anchor = new Date(anchorISO)
  if (isNaN(anchor.getTime())) return ''
  return anniversaryWindowStart(anchor, now).toISOString()
}

// ── AsyncStorage helpers ──────────────────────────────────────

async function readAnchorRecord (): Promise<InstallAnchorRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(INSTALL_ANCHOR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.anchorISO === 'string' &&
      typeof parsed.establishedAt === 'string'
    ) {
      return parsed as InstallAnchorRecord
    }
    return null
  } catch {
    return null
  }
}

async function writeAnchorRecord (record: InstallAnchorRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_ANCHOR_KEY, JSON.stringify(record))
  } catch (e) {
    console.warn('[installFreeSnapGuard] anchor write failed:', (e as Error)?.message)
  }
}

async function readRecord (): Promise<InstallFreeSnapRecord | null> {
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

async function writeRecord (record: InstallFreeSnapRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_FREE_SNAP_KEY, JSON.stringify(record))
  } catch (e) {
    console.warn('[installFreeSnapGuard] write failed:', (e as Error)?.message)
  }
}

// ── Install anchor management ─────────────────────────────────

// Get the existing install anchor, or seed it from the server's
// authoritative anchorAt (auth.users.created_at) if no anchor
// exists yet.
//
// The anchor is established ONCE and never changed. Subsequent
// calls always return the same anchor, regardless of which Supabase
// UUID is active.
//
// Seeding priority:
//   1. serverQuota.anchorAt (auth.users.created_at — the true
//      immutable first-use timestamp)
//   2. serverQuota.periodStart (fallback for older servers that
//      don't yet return anchorAt)
//
// Returns null if no anchor exists and serverQuota is null or has
// neither anchorAt nor periodStart (cannot seed).
export async function getOrCreateInstallAnchor (
  serverQuota: ScanQuotaSnapshot | null,
): Promise<string | null> {
  const existing = await readAnchorRecord()
  if (existing) return existing.anchorISO
  if (!serverQuota) return null
  // Prefer the authoritative anchorAt (auth.users.created_at)
  const seedISO = serverQuota.anchorAt || serverQuota.periodStart
  if (!seedISO) return null
  await writeAnchorRecord({
    anchorISO: seedISO,
    establishedAt: new Date().toISOString(),
  })
  return seedISO
}

// Read the install anchor without creating it.
export async function getInstallAnchor (): Promise<string | null> {
  const existing = await readAnchorRecord()
  return existing ? existing.anchorISO : null
}

// ── Install Free Snap remaining ───────────────────────────────

// Returns the install-level remaining allowance for Free users:
//   1 — no consumed marker exists (lifetime allowance unused)
//   0 — consumed marker exists (lifetime allowance used)
//   null — install state is unknown (no anchor, no serverQuota)
//
// NEW POLICY: The Free Snap is LIFETIME. The window key is a
// constant 'LIFETIME' — it never changes, so once consumed, the
// marker persists forever. There is no monthly reset.
export async function getInstallFreeSnapRemaining (
  serverQuota: ScanQuotaSnapshot | null,
): Promise<number | null> {
  if (!serverQuota) return null
  // Ensure the install anchor exists (seed from serverQuota if needed)
  const anchorISO = await getOrCreateInstallAnchor(serverQuota)
  if (!anchorISO) return null
  const record = await readRecord()
  if (!record) return 1
  // LIFETIME: any consumption record means the lifetime allowance
  // is used. No monthly reset.
  return 0
}

// ── Mark install consumed ─────────────────────────────────────

// Mark the install-level Free Snap as consumed.
//
// NEW POLICY: Uses the LIFETIME window key — once consumed, the
// marker persists forever. There is no monthly reset.
//
// Idempotent — calling multiple times is safe.
export async function markInstallFreeSnapConsumed (
  serverQuota: ScanQuotaSnapshot | null,
): Promise<void> {
  const anchorISO = await getOrCreateInstallAnchor(serverQuota)
  if (!anchorISO) return
  const existing = await readRecord()
  if (existing && existing.windowKey === LIFETIME_WINDOW_KEY) return
  await writeRecord({
    windowKey: LIFETIME_WINDOW_KEY,
    consumedAt: new Date().toISOString(),
  })
}

// ── Self-heal ─────────────────────────────────────────────────

// Self-heal: if an authoritative server Free quota snapshot shows
// the allowance already consumed (used >= 1, remaining === 0),
// persist the install marker for the current INSTALL anniversary
// window (computed from the install anchor, not the server's
// periodStart).
//
// This bridges the upgrade/migration gap: a device that consumed
// its Free Snap on an older APK (before the install marker existed)
// will have no install marker. Without self-heal, logging out and
// creating a new anonymous UUID would reset the effective quota.
//
// Strict conditions — only an authoritative exhausted FREE quota
// may bootstrap the marker:
//   - serverQuota must be non-null and plan === 'free'
//   - valid positive limit
//   - used >= limit (authoritative exhaustion — covers legacy
//     over-limit migration rows like used=5, limit=1)
//   - OR normalized remaining <= 0 (defense-in-depth)
//
// Do NOT seed from: null, Pro, malformed, or unused quota.
export async function selfHealInstallMarker (
  serverQuota: ScanQuotaSnapshot | null,
): Promise<boolean> {
  if (!serverQuota) return false
  if (serverQuota.plan !== 'free') return false
  // Need a valid positive limit to evaluate exhaustion
  if (!serverQuota.limit || serverQuota.limit <= 0) return false
  // Exhausted: used >= limit (authoritative) OR remaining <= 0
  // (normalized). The used >= limit check is primary because it
  // handles legacy over-limit rows (e.g. used=5, limit=1) where
  // remaining may have been negative before normalization.
  const isExhausted = serverQuota.used >= serverQuota.limit ||
    Math.max(0, serverQuota.remaining) <= 0 && serverQuota.used >= 1
  if (!isExhausted) return false
  // Ensure the install anchor exists, then mark consumed with the
  // LIFETIME window key.
  const anchorISO = await getOrCreateInstallAnchor(serverQuota)
  if (!anchorISO) return false
  const existing = await readRecord()
  if (existing && existing.windowKey === LIFETIME_WINDOW_KEY) return true
  await writeRecord({
    windowKey: LIFETIME_WINDOW_KEY,
    consumedAt: new Date().toISOString(),
  })
  return true
}

// ── Nuclear reset helpers ─────────────────────────────────────

export async function clearInstallFreeSnapState (): Promise<void> {
  try {
    await AsyncStorage.removeItem(INSTALL_FREE_SNAP_KEY)
  } catch (e) {
    console.warn('[installFreeSnapGuard] clear failed:', (e as Error)?.message)
  }
}

export async function clearInstallAnchor (): Promise<void> {
  try {
    await AsyncStorage.removeItem(INSTALL_ANCHOR_KEY)
  } catch (e) {
    console.warn('[installFreeSnapGuard] anchor clear failed:', (e as Error)?.message)
  }
}

// ── Effective quota composition ───────────────────────────────

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
// is null for Free users (fail-closed).
export function composeEffectiveQuota (
  serverQuota: ScanQuotaSnapshot | null,
  installRemaining: number | null,
): ScanQuotaSnapshot | null {
  if (!serverQuota) return null
  if (serverQuota.plan === 'pro') return serverQuota
  if (installRemaining === null) return null
  // Clamp server remaining to >= 0 — legacy migration may have
  // used > limit (e.g. used=5, limit=1), which produces negative
  // remaining. The Edge Function normalizes this, but defend
  // in-depth on the client as well.
  const serverRemaining = Math.max(0, serverQuota.remaining)
  const effectiveRemaining = Math.min(serverRemaining, installRemaining)
  const effectiveUsed = Math.max(0, serverQuota.limit - effectiveRemaining)
  return {
    ...serverQuota,
    remaining: effectiveRemaining,
    used: effectiveUsed,
  }
}
