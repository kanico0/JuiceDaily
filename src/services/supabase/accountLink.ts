// ─────────────────────────────────────────────────────────────
// accountLink.ts — Durable account protection for
// RawLifeFlow: Juicing Daily.
//
// Upgrades the anonymous Supabase user to a permanent email
// identity WITHOUT changing the user UUID, using the officially
// supported supabase-js v2 anonymous-upgrade flow:
//
//   1) supabase.auth.updateUser({ email })      → sends email OTP
//   2) supabase.auth.verifyOtp({ type: 'email_change' })
//
// The UUID is preserved, so quotas, subscriptions, history and the
// RevenueCat App User ID all remain attached to the same user.
//
// Returning users (reinstall / cleared storage) sign back in with:
//
//   1) supabase.auth.signInWithOtp({ email, shouldCreateUser: false })
//   2) supabase.auth.verifyOtp({ type: 'email' })
//
// which restores their ORIGINAL UUID and therefore their original
// quota usage and entitlements. RevenueCat is re-logged-in with the
// canonical UUID after any identity change.
// ─────────────────────────────────────────────────────────────

import { getSupabase } from './supabaseClient'
import { setAllowAnonFallback, ensureUser, getAccessToken } from './identity'
import { logIn as revenueCatLogIn } from '../subscriptions/revenueCatClient'
import { SUPABASE_URL, SUPABASE_CONFIGURED } from '../subscriptions/subscriptionConfig'
import { buildAuthedHeaders } from '../quota/supabaseHeaders'
import { selfHealInstallMarker } from '../quota/installFreeSnapGuard'
import { preLogoutSelfHealExpandedIngredient } from '../quota/installExpandedIngredientGuard'
import type { ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'

// ── Types ────────────────────────────────────────────────────

export interface AccountStatus {
  userId: string | null
  email: string | null
  // true when the user has a verified permanent (email) identity.
  isDurable: boolean
}

export type LinkStartResult =
  | { status: 'otp_sent' }
  | { status: 'email_in_use' }
  | { status: 'invalid_email' }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string }

export type VerifyResult =
  | { status: 'verified'; userId: string }
  | { status: 'invalid_code' }
  | { status: 'expired' }
  | { status: 'error'; message: string }

// ── Identity change listeners ────────────────────────────────
// QuotaStore / SubscriptionStore refresh when the canonical user
// changes (e.g. signing into an existing account).

type IdentityListener = (userId: string) => void
const identityListeners = new Set<IdentityListener>()

export function addIdentityChangeListener(cb: IdentityListener): () => void {
  identityListeners.add(cb)
  return () => identityListeners.delete(cb)
}

async function notifyIdentityChanged(userId: string): Promise<void> {
  // RevenueCat must always track the canonical Supabase UUID so
  // purchases can never strand under a temporary account.
  await revenueCatLogIn(userId)
  identityListeners.forEach((cb) => {
    try {
      cb(userId)
    } catch {
      // Listener errors must never break auth flows.
    }
  })
}

// ── Validation ───────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ── Account status ───────────────────────────────────────────

export async function getAccountStatus(): Promise<AccountStatus> {
  const supabase = getSupabase()
  if (!supabase) return { userId: null, email: null, isDurable: false }
  try {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return { userId: null, email: null, isDurable: false }
    const isAnonymous = Boolean((user as { is_anonymous?: boolean }).is_anonymous)
    const email = user.email ?? null
    return {
      userId: user.id,
      email,
      isDurable: !isAnonymous && Boolean(email),
    }
  } catch {
    return { userId: null, email: null, isDurable: false }
  }
}

export async function isDurableUser(): Promise<boolean> {
  const status = await getAccountStatus()
  return status.isDurable
}

// Force-refresh the Supabase session and report whether the
// refreshed user is permanent. Used when the server rejects a
// token as anonymous right after an email upgrade (stale access
// token): refresh once, then the caller may retry exactly once.
export async function refreshSessionAndCheckDurable(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  // Disable anon fallback during refresh — if the session is
  // temporarily unavailable, we must NOT create a new anonymous
  // user. The caller (quotaService) already has a durable user
  // and is retrying with a potentially stale token.
  setAllowAnonFallback(false)
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error || !data.session?.user) return false
    const user = data.session.user
    const isAnonymous = Boolean((user as { is_anonymous?: boolean }).is_anonymous)
    return !isAnonymous && Boolean(user.email)
  } catch {
    return false
  } finally {
    setAllowAnonFallback(true)
  }
}

// ── Error classification ─────────────────────────────────────

function classifyStartError(message: string): LinkStartResult {
  const msg = message.toLowerCase()
  if (
    msg.includes('already') &&
    (msg.includes('registered') || msg.includes('exists') || msg.includes('in use'))
  ) {
    return { status: 'email_in_use' }
  }
  if (msg.includes('rate') || msg.includes('too many')) {
    return { status: 'rate_limited' }
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return { status: 'invalid_email' }
  }
  return { status: 'error', message }
}

function classifyVerifyError(message: string): VerifyResult {
  const msg = message.toLowerCase()
  if (msg.includes('expired')) return { status: 'expired' }
  if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('not found')) {
    return { status: 'invalid_code' }
  }
  return { status: 'error', message }
}

// ── Anonymous → permanent upgrade (UUID preserved) ───────────

// Step 1: attach an email to the CURRENT anonymous user. Supabase
// sends a 6-digit OTP to the address. The UUID does not change.
export async function beginEmailLink(rawEmail: string): Promise<LinkStartResult> {
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email)) return { status: 'invalid_email' }

  const supabase = getSupabase()
  if (!supabase) return { status: 'error', message: 'Service unavailable' }

  try {
    const { error } = await supabase.auth.updateUser({ email })
    if (error) return classifyStartError(error.message)
    return { status: 'otp_sent' }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// Step 2: verify the OTP. On success the SAME user (same UUID) is
// now permanent. RevenueCat login is refreshed with the same UUID
// (a no-op alias-wise, but guarantees consistency).
export async function verifyEmailLink(rawEmail: string, token: string): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail)
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', message: 'Service unavailable' }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email_change',
    })
    if (error) return classifyVerifyError(error.message)
    const userId = data.user?.id ?? data.session?.user?.id
    if (!userId) return { status: 'error', message: 'Verification returned no user' }
    // Disable anon fallback — the user is now durable and should
    // never silently create a new anonymous session if the session
    // is temporarily unavailable during the identity transition.
    setAllowAnonFallback(false)
    await notifyIdentityChanged(userId)
    return { status: 'verified', userId }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// ── Returning-user sign-in (restores original UUID) ─────────

// Step 1: request an OTP for an EXISTING account. shouldCreateUser
// is false so a typo can never mint a new user (and a new quota).
export async function beginSignIn(rawEmail: string): Promise<LinkStartResult> {
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email)) return { status: 'invalid_email' }

  const supabase = getSupabase()
  if (!supabase) return { status: 'error', message: 'Service unavailable' }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('signups not allowed') || msg.includes('user not found')) {
        // No account exists for this email.
        return { status: 'error', message: 'No account found for this email' }
      }
      return classifyStartError(error.message)
    }
    return { status: 'otp_sent' }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// Step 2: verify. The session switches to the existing account's
// ORIGINAL UUID — restoring quota usage and entitlements. RevenueCat
// is logged in with the canonical UUID and stores are notified.
export async function verifySignIn(rawEmail: string, token: string): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail)
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', message: 'Service unavailable' }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email',
    })
    if (error) return classifyVerifyError(error.message)
    const userId = data.session?.user?.id ?? data.user?.id
    if (!userId) return { status: 'error', message: 'Sign-in returned no user' }
    // Disable anon fallback — the user is now durable and should
    // never silently create a new anonymous session.
    setAllowAnonFallback(false)
    await notifyIdentityChanged(userId)
    return { status: 'verified', userId }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// ── Password sign-in (Google Play reviewer access) ───────────
// Reusable email + password sign-in for the Google Play reviewer
// account. Uses real Supabase Auth — no client-side overrides.
// Available in production without Developer Tools.
export async function signInWithPassword (
  rawEmail: string,
  password: string,
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail)
  const supabase = getSupabase()
  if (!supabase) return { status: 'error', message: 'Service unavailable' }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) return classifyVerifyError(error.message)
    const userId = data.user?.id ?? data.session?.user?.id
    if (!userId) return { status: 'error', message: 'Sign-in returned no user' }
    setAllowAnonFallback(false)
    await notifyIdentityChanged(userId)
    return { status: 'verified', userId }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// ── Sign out ─────────────────────────────────────────────────
// Clears the local session and transitions RevenueCat to the new
// anonymous Supabase UUID. Server-side data (quota usage, subscription
// record, history) stays attached to the UUID and is restored on
// the next sign-in.
//
// Identity transition on signout (no Purchases.logOut() needed):
//   RevenueCat documents that direct Purchases.logIn(newUUID) is
//   valid when switching between two custom App User IDs. This
//   avoids creating an unnecessary transient $RCAnonymousID.
//
//   0. Self-heal the install Free Snap guard from the departing
//      user's authoritative Free quota BEFORE the session is
//      cleared. This bridges the upgrade/migration gap: a device
//      that consumed a Free Snap on an older APK (before the install
//      marker existed) must have the marker persisted before the
//      consumed identity is discarded, otherwise a new anonymous
//      UUID would receive a fresh 0/1 allowance on the same install.
//   1. Supabase.auth.signOut() — clears the local Supabase session.
//   2. Re-enable anon fallback so ensureUser() can create a new
//      anonymous Supabase UUID.
//   3. ensureUser() — creates a new anonymous Supabase UUID.
//   4. notifyIdentityChanged(newUUID) — calls Purchases.logIn(newUUID)
//      which directly switches RC from the old UUID to the new UUID.
//      The SubscriptionStore's identity change listener then fetches
//      fresh CustomerInfo for the new user (Free), clearing any
//      stale Pro entitlement UI.
//
// Account A's Pro entitlement cannot appear for Account B because:
//   - RC switches to the new UUID via logIn()
//   - CustomerInfo is fetched for the new UUID (no Pro)
//   - The subscriptions table is keyed by UUID (server-authoritative)

// Minimal inline quota parser — avoids a circular import with
// quotaService.ts (which imports from this module). Only the fields
// needed by selfHealInstallMarker are parsed.
function parseQuotaMinimal(raw: unknown): ScanQuotaSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  if (typeof q.limit !== 'number' || typeof q.used !== 'number') return null
  return {
    plan: q.plan === 'pro' ? 'pro' : 'free',
    limit: q.limit,
    used: q.used,
    remaining: Math.max(0, typeof q.remaining === 'number' ? q.remaining : q.limit - q.used),
    periodStart: String(q.periodStart ?? q.period_start ?? ''),
    periodEnd: String(q.periodEnd ?? q.period_end ?? ''),
    anchorAt: q.anchorAt != null ? String(q.anchorAt ?? q.anchor_at ?? '') : null,
    dailyLimit: typeof q.dailyLimit === 'number' ? q.dailyLimit : null,
    dailyUsed: typeof q.dailyUsed === 'number' ? q.dailyUsed : null,
  }
}

// Fetch the departing user's authoritative Free quota and persist
// the install marker if it shows the allowance already consumed.
// Best-effort — failures do not block logout. The QuotaStore refresh
// after identity change also self-heals, so this is a belt-and-suspenders
// guard that runs before the session is cleared.
async function persistInstallMarkerBeforeSignOut(): Promise<void> {
  if (!SUPABASE_CONFIGURED || !SUPABASE_URL) return
  try {
    const token = await getAccessToken()
    if (!token) return
    const headers = buildAuthedHeaders(token)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-quota`, {
      method: 'GET',
      headers,
    })
    if (!res.ok) return
    const body = await res.json()
    const quota = parseQuotaMinimal(body.quota ?? body)
    if (quota) {
      await selfHealInstallMarker(quota)
    }
  } catch {
    // Best-effort — do not block logout on network failure.
  }
}

// Fetch the departing user's authoritative Expanded Ingredient
// allowance and self-heal the install guard before the session is
// cleared. Best-effort — failures do not block logout.
async function persistExpandedIngredientBeforeSignOut(): Promise<void> {
  if (!SUPABASE_CONFIGURED || !SUPABASE_URL) return
  try {
    const token = await getAccessToken()
    if (!token) return
    const headers = buildAuthedHeaders(token)
    // Fetch the blend allowance snapshot from the analyze-blend function
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-blend`, {
      method: 'GET',
      headers,
    })
    if (!res.ok) return
    const body = await res.json()
    const used = typeof body.used === 'number' ? body.used : 0
    const plan = body.plan === 'pro' ? 'pro' : 'free'
    const isPro = plan === 'pro'
    await preLogoutSelfHealExpandedIngredient(
      async () => ({ used, plan }),
      isPro,
    )
  } catch {
    // Best-effort — do not block logout on network failure.
  }
}

export async function signOutAccount(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  try {
    // 0. Self-heal the install guards from the departing user's
    //    authoritative quotas BEFORE the session is cleared. This
    //    ensures the install markers are persisted even if the
    //    device consumed allowances on an older APK.
    await persistInstallMarkerBeforeSignOut()
    await persistExpandedIngredientBeforeSignOut()

    // 1. Sign out of Supabase.
    const { error } = await supabase.auth.signOut()
    if (error) return false

    // 2. Re-enable anon fallback — the next user starts fresh.
    setAllowAnonFallback(true)

    // 3. Create a new anonymous Supabase UUID.
    const newIdentity = await ensureUser()
    if (!newIdentity?.userId) return false

    // 4. Switch RevenueCat to the new UUID via direct logIn().
    //    This clears any cached CustomerInfo for the departing user
    //    and associates RC with the new anonymous UUID. The
    //    SubscriptionStore listener fires and fetches fresh
    //    CustomerInfo (Free) for the new user.
    await notifyIdentityChanged(newIdentity.userId)

    return true
  } catch {
    return false
  }
}
