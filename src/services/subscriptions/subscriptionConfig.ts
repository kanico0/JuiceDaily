// ─────────────────────────────────────────────────────────────
// subscriptionConfig.ts — Single source of truth for monetization
// constants. Only PUBLIC values live here.
//
// Rollback strategy: MONETIZATION_ENABLED auto-disables the whole
// subscription layer when required public keys are missing, so the
// app falls back to its previous free behavior with no code change.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import Constants from 'expo-constants'

// ── Env readers ──────────────────────────────────────────────
// EXPO_PUBLIC_* vars are inlined by Expo at build time, but native
// dev clients may also read them via expo-constants extra.

function readPublic (name: string): string | null {
  const fromProcess = (process.env as Record<string, string | undefined>)[name]
  if (fromProcess && fromProcess !== '') return fromProcess
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined
  const fromExtra = extra?.[name]
  if (fromExtra && fromExtra !== '') return fromExtra
  return null
}

// ── Entitlement / offering identifiers (RevenueCat) ──────────

export const PRO_ENTITLEMENT_ID = 'pro'
export const DEFAULT_OFFERING_ID = 'default'

// ── Store product identifiers ────────────────────────────────

export const APPLE_PRODUCT_IDS = {
  monthly: 'com.juicingapp.app.pro.monthly',
  annual: 'com.juicingapp.app.pro.annual',
} as const

export const GOOGLE_SUBSCRIPTION_ID = 'juicing_daily_pro'
export const GOOGLE_BASE_PLANS = {
  monthly: 'monthly',
  annual: 'annual',
} as const

// ── Quota constants (display only — server is authoritative) ─

export const FREE_MONTHLY_SCAN_LIMIT = 5
export const PRO_MONTHLY_SCAN_LIMIT = 60
export const PRO_DAILY_SCAN_SAFETY_LIMIT = 10

export const FREE_WARNING_THRESHOLDS = [2, 1]
export const PRO_WARNING_THRESHOLDS = [10, 5]

// ── Public keys from environment ─────────────────────────────

export const REVENUECAT_PUBLIC_API_KEY: string | null = Platform.select({
  ios: readPublic('EXPO_PUBLIC_REVENUECAT_IOS_KEY'),
  android: readPublic('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY'),
  default: null,
}) ?? null

// Supabase project URL + anon (public) key — safe to ship.
export const SUPABASE_URL: string | null = readPublic('EXPO_PUBLIC_SUPABASE_URL')
export const SUPABASE_ANON_KEY: string | null = readPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY')

// Legal links for the paywall / settings.
export const TERMS_URL: string | null = readPublic('EXPO_PUBLIC_TERMS_URL')
export const PRIVACY_URL: string | null = readPublic('EXPO_PUBLIC_PRIVACY_URL')

// ── Master switch ────────────────────────────────────────────
// Placeholder RevenueCat keys (appl_your-*/goog_your-*) do not count
// as configured, so the layer stays off until real keys exist.

function isRealKey (key: string | null): boolean {
  if (!key) return false
  return !key.includes('your-')
}

const envFlag = readPublic('EXPO_PUBLIC_MONETIZATION_ENABLED')
const explicitlyDisabled = envFlag !== null && envFlag.toLowerCase() === 'false'

export const SUPABASE_CONFIGURED: boolean = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const MONETIZATION_ENABLED: boolean =
  !explicitlyDisabled &&
  SUPABASE_CONFIGURED &&
  isRealKey(REVENUECAT_PUBLIC_API_KEY)
