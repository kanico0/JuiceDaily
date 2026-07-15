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
import { logIn as revenueCatLogIn } from '../subscriptions/revenueCatClient'

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

export function addIdentityChangeListener (cb: IdentityListener): () => void {
  identityListeners.add(cb)
  return () => identityListeners.delete(cb)
}

async function notifyIdentityChanged (userId: string): Promise<void> {
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

export function isValidEmail (email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

function normalizeEmail (email: string): string {
  return email.trim().toLowerCase()
}

// ── Account status ───────────────────────────────────────────

export async function getAccountStatus (): Promise<AccountStatus> {
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

export async function isDurableUser (): Promise<boolean> {
  const status = await getAccountStatus()
  return status.isDurable
}

// ── Error classification ─────────────────────────────────────

function classifyStartError (message: string): LinkStartResult {
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

function classifyVerifyError (message: string): VerifyResult {
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
export async function beginEmailLink (rawEmail: string): Promise<LinkStartResult> {
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
export async function verifyEmailLink (rawEmail: string, token: string): Promise<VerifyResult> {
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
    await notifyIdentityChanged(userId)
    return { status: 'verified', userId }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// ── Returning-user sign-in (restores original UUID) ─────────

// Step 1: request an OTP for an EXISTING account. shouldCreateUser
// is false so a typo can never mint a new user (and a new quota).
export async function beginSignIn (rawEmail: string): Promise<LinkStartResult> {
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
export async function verifySignIn (rawEmail: string, token: string): Promise<VerifyResult> {
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
    await notifyIdentityChanged(userId)
    return { status: 'verified', userId }
  } catch (e) {
    return { status: 'error', message: (e as Error)?.message ?? 'Unknown error' }
  }
}

// ── Sign out ─────────────────────────────────────────────────
// Clears the local session only. Server-side data (quota usage,
// subscription record, history) stays attached to the UUID and is
// restored on the next sign-in.

export async function signOutAccount (): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false
  try {
    const { error } = await supabase.auth.signOut()
    return !error
  } catch {
    return false
  }
}
