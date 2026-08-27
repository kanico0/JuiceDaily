// ─────────────────────────────────────────────────────────────
// preflight-production.mjs — Build-time validation of required
// production configuration.
//
// Run BEFORE creating a production AAB. Exits non-zero if any
// required production configuration is missing or malformed.
//
// Usage:
//   node scripts/preflight-production.mjs
//
// Exit codes:
//   0 — all checks passed, safe to build
//   1 — one or more required checks failed, DO NOT build
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// ── Read .env file (Expo inlines EXPO_PUBLIC_* at build time) ──

function readEnvFile (filePath) {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    env[key] = value
  }
  return env
}

// Merge .env and .env.local (process.env takes precedence)
const env = {
  ...readEnvFile(resolve(projectRoot, '.env')),
  ...readEnvFile(resolve(projectRoot, '.env.local')),
  ...process.env,
}

// ── Validators ───────────────────────────────────────────────

function isValidSupabaseUrl (url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

function isValidSupabaseAnonKey (key) {
  if (!key) return false
  if (key.length < 100) return false
  return key.split('.').length === 3
}

function isValidRevenueCatAndroidKey (key) {
  if (!key) return false
  if (key.includes('your-')) return false
  return key.startsWith('goog_')
}

function isValidMonetizationFlag (flag) {
  if (flag === null || flag === undefined) return false
  const lower = String(flag).toLowerCase()
  return lower === 'true' || lower === 'false'
}

// ── Required production checks ───────────────────────────────

const checks = [
  {
    key: 'EXPO_PUBLIC_SUPABASE_URL',
    label: 'Supabase URL',
    getValue: () => env.EXPO_PUBLIC_SUPABASE_URL,
    validate: isValidSupabaseUrl,
    reason: 'Must be a valid https://<project>.supabase.co URL',
  },
  {
    key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    label: 'Supabase public key',
    getValue: () => env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    validate: isValidSupabaseAnonKey,
    reason: 'Must be a valid JWT anon key (header.payload.signature)',
  },
  {
    key: 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
    label: 'RevenueCat Android public key',
    getValue: () => env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    validate: isValidRevenueCatAndroidKey,
    reason: 'Must start with "goog_" and not be a placeholder',
  },
  {
    key: 'EXPO_PUBLIC_MONETIZATION_ENABLED',
    label: 'Monetization flag',
    getValue: () => env.EXPO_PUBLIC_MONETIZATION_ENABLED,
    validate: isValidMonetizationFlag,
    reason: 'Must be explicitly "true" or "false"',
  },
]

// ── Run checks ───────────────────────────────────────────────

console.log('\n┌─────────────────────────────────────────────────────────┐')
console.log('│  RawLifeFlow Production Preflight Validation            │')
console.log('└─────────────────────────────────────────────────────────┘\n')

let allPassed = true
const failures = []

for (const check of checks) {
  const value = check.getValue()
  const valid = check.validate(value)
  const status = valid ? 'PASS' : 'FAIL'
  const icon = valid ? '✓' : '✗'

  console.log(`  ${icon} ${status}  ${check.label} (${check.key})`)

  if (!valid) {
    console.log(`         Reason: ${check.reason}`)
    if (value) {
      const display = value.length > 40 ? value.slice(0, 37) + '...' : value
      console.log(`         Got: ${display}`)
    } else {
      console.log(`         Got: (missing)`)
    }
    failures.push(check)
    allPassed = false
  }
}

// ── Summary ──────────────────────────────────────────────────

console.log('')
if (allPassed) {
  console.log('  ┌─────────────────────────────────────────────────────┐')
  console.log('  │  All production configuration checks PASSED.        │')
  console.log('  │  Safe to proceed with production build.             │')
  console.log('  └─────────────────────────────────────────────────────┘\n')
  process.exit(0)
} else {
  console.log('  ┌─────────────────────────────────────────────────────┐')
  console.log('  │  PRODUCTION PREFLIGHT FAILED.                       │')
  console.log(`  │  ${failures.length} required check(s) failed.                       │`)
  console.log('  │  DO NOT create a production AAB until resolved.     │')
  console.log('  └─────────────────────────────────────────────────────┘\n')
  process.exit(1)
}
