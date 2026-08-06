// ─────────────────────────────────────────────────────────────
// identity.ts — Stable user identity via Supabase anonymous auth.
//
// The Supabase user UUID is immutable and survives reinstalls only
// through session persistence; it is used as the RevenueCat App User
// ID and as the server-side key for quotas and subscriptions.
// ─────────────────────────────────────────────────────────────

import { getSupabase } from './supabaseClient'

export interface UserIdentity {
  userId: string
  accessToken: string
}

let inFlight: Promise<UserIdentity | null> | null = null

// When false, getAccessToken will NOT fall back to signInAnonymously()
// if no session is found. This prevents creating a new anonymous
// session after an account upgrade (e.g., email link verification)
// when the old session is temporarily unavailable during refresh.
// Set to false by accountLink.ts before session refresh, and reset
// to true after refresh completes.
let allowAnonFallback = true

export function setAllowAnonFallback(allowed: boolean): void {
  allowAnonFallback = allowed
}

async function resolveUser(): Promise<UserIdentity | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    // 1) Existing persisted session?
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session
    if (session?.user?.id && session.access_token) {
      return { userId: session.user.id, accessToken: session.access_token }
    }

    // 2) Create a new anonymous user.
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error || !data.session?.user?.id) {
      if (__DEV__) console.warn('[identity] anonymous sign-in failed:', error?.message)
      return null
    }
    return {
      userId: data.session.user.id,
      accessToken: data.session.access_token,
    }
  } catch (e) {
    if (__DEV__) console.warn('[identity] ensureUser failed:', (e as Error)?.message)
    return null
  }
}

// Ensure a stable authenticated (anonymous) user. Deduplicates
// concurrent calls so only one sign-in ever runs at a time.
export async function ensureUser(): Promise<UserIdentity | null> {
  if (!inFlight) {
    inFlight = resolveUser().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

// Fresh access token for authenticated Edge Function calls.
// Falls back to ensureUser() (which may create an anonymous session)
// only when allowAnonFallback is true. After account upgrade,
// accountLink.ts disables the fallback to prevent creating a stale
// anonymous session that would send requests with a mismatched token.
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) return data.session.access_token
  if (!allowAnonFallback) {
    if (__DEV__) console.warn('[identity] no session and anon fallback disabled')
    return null
  }
  const identity = await ensureUser()
  return identity?.accessToken ?? null
}

export async function getUserId(): Promise<string | null> {
  const identity = await ensureUser()
  return identity?.userId ?? null
}
