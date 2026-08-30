// ─────────────────────────────────────────────────────────────
// productionConfig.ts — Build-time and runtime validation of
// required production configuration.
//
// Two modes:
//   1. Build-time preflight (scripts/preflight-production.js)
//      → fails the build before an AAB is created.
//   2. Runtime validation (ProductionConfigGate component)
//      → blocking recovery screen if a production binary is
//         missing required configuration.
//
// A missing or malformed REQUIRED production value is a BUILD
// CONFIGURATION FAILURE, not a temporary service outage. The app
// must not continue into normal operation.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import {
  MONETIZATION_ENABLED,
  REVENUECAT_PUBLIC_API_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  readPublic,
} from './subscriptionConfig'

// Root cause (release-blocker investigation, fixed): this used to read
// the raw flag via a hand-rolled globalThis.process.env lookup that
// deliberately avoided Babel's static process.env.EXPO_PUBLIC_*
// inlining. In a compiled Hermes release bundle there is no live,
// dotenv-populated process.env object at runtime, so that lookup
// always resolved to null/undefined — causing this ONE check to fail
// startup validation on every real device build, regardless of
// whether the app was actually configured correctly (the real
// MONETIZATION_ENABLED constant below, and every other check in this
// file, already read correctly via readPublic()'s
// Constants.expoConfig.extra fallback). Reuse that same reader here
// so this check observes the same value the rest of the app uses.
function readMonetizationEnvFlag (): string | null {
  return readPublic('EXPO_PUBLIC_MONETIZATION_ENABLED')
}

// ── Types ────────────────────────────────────────────────────

export interface ConfigCheck {
  key: string
  label: string
  required: boolean
  valid: boolean
  reason: string | null
}

export interface ProductionConfigResult {
  ok: boolean
  checks: ConfigCheck[]
  missing: ConfigCheck[]
}

// ── Validators ───────────────────────────────────────────────

function isValidSupabaseUrl (url: string | null): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function isValidSupabaseAnonKey (key: string | null): boolean {
  if (!key) return false
  if (key.length < 100) return false
  // JWT structure: header.payload.signature
  const parts = key.split('.')
  return parts.length === 3
}

function isValidRevenueCatKey (key: string | null): boolean {
  if (!key) return false
  // Reject placeholder keys
  if (key.includes('your-')) return false
  // Android keys start with 'goog_'
  if (Platform.OS === 'android') {
    return key.startsWith('goog_')
  }
  // iOS keys start with 'appl_'
  if (Platform.OS === 'ios') {
    return key.startsWith('appl_')
  }
  return key.startsWith('goog_') || key.startsWith('appl_')
}

function isValidMonetizationFlag (flag: string | null): boolean {
  if (flag === null) return false
  const lower = flag.toLowerCase()
  return lower === 'true' || lower === 'false'
}

// ── Public API ───────────────────────────────────────────────

/**
 * Validate all required production configuration.
 *
 * In production, every check must pass. In development, the
 * monetization flag may be absent (the app runs in dev/free mode).
 *
 * @param isProduction — when true, all checks are required.
 *                       when false, only format checks run
 *                       (missing values are acceptable in dev).
 */
export function validateProductionConfig (isProduction: boolean): ProductionConfigResult {
  const checks: ConfigCheck[] = [
    {
      key: 'EXPO_PUBLIC_SUPABASE_URL',
      label: 'Supabase URL',
      required: isProduction,
      valid: isValidSupabaseUrl(SUPABASE_URL),
      reason: null,
    },
    {
      key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      label: 'Supabase public key',
      required: isProduction,
      valid: isValidSupabaseAnonKey(SUPABASE_ANON_KEY),
      reason: null,
    },
    {
      key: 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
      label: 'RevenueCat public key',
      required: isProduction,
      valid: isValidRevenueCatKey(REVENUECAT_PUBLIC_API_KEY),
      reason: null,
    },
    {
      key: 'EXPO_PUBLIC_MONETIZATION_ENABLED',
      label: 'Monetization flag',
      required: isProduction,
      valid: isValidMonetizationFlag(readMonetizationEnvFlag()),
      reason: null,
    },
  ]

  // Fill in reasons for failed checks
  for (const check of checks) {
    if (!check.valid) {
      if (check.key === 'EXPO_PUBLIC_SUPABASE_URL') {
        check.reason = 'Missing or invalid format (expected https://<project>.supabase.co)'
      } else if (check.key === 'EXPO_PUBLIC_SUPABASE_ANON_KEY') {
        check.reason = 'Missing or not a valid JWT anon key'
      } else if (check.key === 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY') {
        check.reason = 'Missing, placeholder, or wrong platform prefix'
      } else if (check.key === 'EXPO_PUBLIC_MONETIZATION_ENABLED') {
        check.reason = 'Must be explicitly "true" or "false"'
      }
    }
  }

  const missing = checks.filter((c) => c.required && !c.valid)
  return {
    ok: missing.length === 0,
    checks,
    missing,
  }
}

/**
 * Determine whether the current build is a production build.
 *
 * In Expo, __DEV__ is false in production bundles. This is the
 * most reliable runtime signal.
 */
export function isProductionBuild (): boolean {
  return !__DEV__
}
