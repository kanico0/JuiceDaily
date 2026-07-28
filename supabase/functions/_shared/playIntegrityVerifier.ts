// ─────────────────────────────────────────────────────────────
// playIntegrityVerifier.ts — Server-side Play Integrity token
// verification and Device Recall interpretation.
//
// This module runs in the Supabase Edge Function (Deno) and:
//   1. Decodes the Play Integrity token using Google's server API
//   2. Verifies package name, requestHash, freshness
//   3. Evaluates app recognition, Play licensing, device integrity
//   4. Reads Device Recall values
//   5. Classifies failures via centralized failure-policy matrix
//   6. Returns a sanitized verification result
//
// NEVER send Google service-account credentials to the client.
// Store credentials only in Supabase/server environment secrets.
//
// NEVER log raw integrity tokens, Google credentials, or
// Supabase access tokens.
//
// deviceRecallStateKey is NOT a stable device identifier.
// It is a request-scoped audit value derived from Device Recall
// bits and timestamps. It cannot join multiple accounts on the
// same physical device.
// ─────────────────────────────────────────────────────────────

import {
  calculateDeviceRemaining,
  decodeDeviceUsageCount,
  DEVICE_POOL_LIMIT,
  isDeviceUsageCurrentPeriod,
} from './deviceRecallBits.ts'

export interface DeviceRecallVerification {
  ok: boolean
  // Overall verification status
  verificationStatus: 'success' | 'failure'
  // Sanitized status for telemetry (never raw token or device ID)
  integrityStatus: 'verified' | 'unavailable' | 'failed' | 'mock'
  // Request-scoped audit value derived from Device Recall bits and
  // timestamps at verification time. NOT a stable device identifier.
  // Cannot be used to join multiple accounts on the same device.
  deviceRecallStateKey: string | null
  // Device Recall bits
  deviceBits: { bitFirst: boolean; bitSecond: boolean; bitThird: boolean } | null
  // Device Recall timestamps
  deviceTimestamps: {
    bitFirstTimestamp: string | null
    bitSecondTimestamp: string | null
    bitThirdTimestamp: string | null
  } | null
  // Device usage count for current period
  deviceUsed: number
  // Device remaining for current period
  deviceRemaining: number
  // Sanitized reason code
  reasonCode: string
  // Whether the app is recognized/licensed by Google Play
  appRecognition: 'recognized' | 'unrecognized' | 'unknown'
  // Whether the device passes integrity checks
  deviceIntegrity: 'passed' | 'failed' | 'unknown'
  // Classified failure category. null when verificationStatus is 'success'.
  failureCategory: IntegrityFailureCategory | null
}

export interface VerifyOptions {
  token: string
  expectedPackageName: string
  expectedRequestHash: string
  cloudProjectNumber: string
  serviceAccountJson: string
  isMock: boolean
  enforcementMode: string
}

// ── Centralized failure-policy classification ───────────────

export type IntegrityFailureCategory =
  | 'confirmed_security_failure'
  | 'retryable_technical_failure'
  | 'user_remediable_platform_state'
  | 'unsupported_environment'
  | 'configuration_error'

export function classifyIntegrityFailure(
  reasonCode: string,
  integrityStatus: string,
  appRecognition: string,
  deviceIntegrity: string,
): IntegrityFailureCategory {
  // Confirmed security failures — never call AI, never consume scan
  const securityFailures = new Set([
    'request_hash_mismatch',
    'package_name_mismatch',
    'stale_token',
    'integrity_failed',
    'mock_token_invalid',
  ])
  if (securityFailures.has(reasonCode)) return 'confirmed_security_failure'
  if (appRecognition === 'unrecognized') return 'confirmed_security_failure'
  if (deviceIntegrity === 'failed') return 'confirmed_security_failure'

  // User-remediable platform state
  const userRemediable = new Set([
    'play_store_outdated',
    'play_services_outdated',
    'app_not_installed_from_play',
  ])
  if (userRemediable.has(reasonCode)) return 'user_remediable_platform_state'

  // Configuration errors — missing or malformed server credentials
  const configErrors = new Set([
    'missing_credentials',
    'invalid_service_account',
    'google_api_config',
  ])
  if (configErrors.has(reasonCode)) return 'configuration_error'

  // Retryable technical failures — bounded retry, fail-open in observe
  const retryable = new Set([
    'google_api_transient',
    'google_api_error',
    'verification_error',
    'no_payload',
  ])
  if (retryable.has(reasonCode)) return 'retryable_technical_failure'

  // Unsupported environment (iOS, emulator, Device Recall beta not enabled)
  if (integrityStatus === 'unavailable' && reasonCode === 'device_recall_unavailable') {
    return 'unsupported_environment'
  }

  // Default: treat as retryable to avoid false denials
  return 'retryable_technical_failure'
}

// ── Failure-policy decision ──────────────────────────────────
// Returns whether to block the scan based on failure category and mode.

export function shouldBlockScan(
  category: IntegrityFailureCategory | null,
  enforcementMode: string,
): boolean {
  if (category === null) return false
  if (category === 'confirmed_security_failure') return true
  if (category === 'user_remediable_platform_state') return true
  if (category === 'unsupported_environment') return false // Fall back to account quota
  if (category === 'configuration_error') return enforcementMode === 'enforce'
  // Retryable: block only in enforce mode (fail-closed)
  // In observe mode: allow (fail-open)
  return enforcementMode === 'enforce'
}

export function verifyMockIntegrity(
  token: string,
  expectedRequestHash: string,
): DeviceRecallVerification {
  // Parse mock token: mock_integrity:installId:challenge:action
  const parts = token.split(':')
  if (parts.length < 4 || parts[0] !== 'mock_integrity') {
    return {
      ok: false,
      verificationStatus: 'failure',
      integrityStatus: 'failed',
      deviceRecallStateKey: null,
      deviceBits: null,
      deviceTimestamps: null,
      deviceUsed: 0,
      deviceRemaining: DEVICE_POOL_LIMIT,
      reasonCode: 'mock_token_invalid',
      appRecognition: 'unknown',
      deviceIntegrity: 'unknown',
      failureCategory: 'confirmed_security_failure',
    }
  }

  const installId = parts[1]
  const challenge = parts[2]

  // Verify request hash matches
  if (challenge !== expectedRequestHash.split('|')[0]) {
    return {
      ok: false,
      verificationStatus: 'failure',
      integrityStatus: 'failed',
      deviceRecallStateKey: null,
      deviceBits: null,
      deviceTimestamps: null,
      deviceUsed: 0,
      deviceRemaining: DEVICE_POOL_LIMIT,
      reasonCode: 'request_hash_mismatch',
      appRecognition: 'unknown',
      deviceIntegrity: 'unknown',
      failureCategory: 'confirmed_security_failure',
    }
  }

  // Mock: return a fresh device with 0 usage
  return {
    ok: true,
    verificationStatus: 'success',
    integrityStatus: 'mock',
    deviceRecallStateKey: `mock_pool_${installId}`,
    deviceBits: { bitFirst: false, bitSecond: false, bitThird: false },
    deviceTimestamps: {
      bitFirstTimestamp: null,
      bitSecondTimestamp: null,
      bitThirdTimestamp: null,
    },
    deviceUsed: 0,
    deviceRemaining: DEVICE_POOL_LIMIT,
    reasonCode: 'mock_verified',
    appRecognition: 'recognized',
    deviceIntegrity: 'passed',
    failureCategory: null,
  }
}

// ── Production verification ──────────────────────────────────

export async function verifyPlayIntegrity(opts: VerifyOptions): Promise<DeviceRecallVerification> {
  // Handle mock tokens in development
  if (opts.isMock || opts.token.startsWith('mock_integrity:')) {
    return verifyMockIntegrity(opts.token, opts.expectedRequestHash)
  }

  if (!opts.cloudProjectNumber || !opts.serviceAccountJson) {
    // Missing credentials: fail open in observe, fail closed in enforce
    return {
      ok: opts.enforcementMode !== 'enforce',
      verificationStatus: 'failure',
      integrityStatus: 'unavailable',
      deviceRecallStateKey: null,
      deviceBits: null,
      deviceTimestamps: null,
      deviceUsed: 0,
      deviceRemaining: DEVICE_POOL_LIMIT,
      reasonCode: 'missing_credentials',
      appRecognition: 'unknown',
      deviceIntegrity: 'unknown',
      failureCategory: 'configuration_error',
    }
  }

  try {
    // Step 1: Exchange the integrity token for a verdict using
    // Google Play Integrity API.
    // POST https://playintegrity.googleapis.com/v1/{resource}:decodeIntegrityToken
    const url =
      `https://playintegrity.googleapis.com/v1/projects/${opts.cloudProjectNumber}:decodeIntegrityToken`

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAccessToken(opts.serviceAccountJson)}`,
      },
      body: JSON.stringify({
        integrityToken: opts.token,
      }),
    })

    if (!resp.ok) {
      // Classify by HTTP status: 429/5xx = retryable, 400 = configuration error
      const httpStatus = resp.status
      const isRetryable = httpStatus === 429 || httpStatus >= 500
      return {
        ok: opts.enforcementMode !== 'enforce',
        verificationStatus: 'failure',
        integrityStatus: 'unavailable',
        deviceRecallStateKey: null,
        deviceBits: null,
        deviceTimestamps: null,
        deviceUsed: 0,
        deviceRemaining: DEVICE_POOL_LIMIT,
        reasonCode: isRetryable ? 'google_api_transient' : 'google_api_config',
        appRecognition: 'unknown',
        deviceIntegrity: 'unknown',
        failureCategory: isRetryable ? 'retryable_technical_failure' : 'configuration_error',
      }
    }

    const verdict = await resp.json()
    const payload = verdict.tokenPayloadExternal?.payload

    if (!payload) {
      // Malformed successful Google response — not proven tampering.
      // Could be a Google-side issue or API version mismatch.
      return {
        ok: false,
        verificationStatus: 'failure',
        integrityStatus: 'failed',
        deviceRecallStateKey: null,
        deviceBits: null,
        deviceTimestamps: null,
        deviceUsed: 0,
        deviceRemaining: DEVICE_POOL_LIMIT,
        reasonCode: 'no_payload',
        appRecognition: 'unknown',
        deviceIntegrity: 'unknown',
        failureCategory: 'retryable_technical_failure',
      }
    }

    // Step 2: Verify package name
    if (payload.appPackageName !== opts.expectedPackageName) {
      return {
        ok: false,
        verificationStatus: 'failure',
        integrityStatus: 'failed',
        deviceRecallStateKey: null,
        deviceBits: null,
        deviceTimestamps: null,
        deviceUsed: 0,
        deviceRemaining: DEVICE_POOL_LIMIT,
        reasonCode: 'package_name_mismatch',
        appRecognition: 'unrecognized',
        deviceIntegrity: 'unknown',
        failureCategory: 'confirmed_security_failure',
      }
    }

    // Step 3: Verify request hash
    if (payload.requestHash !== opts.expectedRequestHash) {
      return {
        ok: false,
        verificationStatus: 'failure',
        integrityStatus: 'failed',
        deviceRecallStateKey: null,
        deviceBits: null,
        deviceTimestamps: null,
        deviceUsed: 0,
        deviceRemaining: DEVICE_POOL_LIMIT,
        reasonCode: 'request_hash_mismatch',
        appRecognition: 'unknown',
        deviceIntegrity: 'unknown',
        failureCategory: 'confirmed_security_failure',
      }
    }

    // Step 4: Check freshness (token must be recent)
    const tokenTime = new Date(payload.timestamp * 1000)
    const now = new Date()
    const ageMs = now.getTime() - tokenTime.getTime()
    if (ageMs > 10 * 60 * 1000) { // 10 minute max
      return {
        ok: false,
        verificationStatus: 'failure',
        integrityStatus: 'failed',
        deviceRecallStateKey: null,
        deviceBits: null,
        deviceTimestamps: null,
        deviceUsed: 0,
        deviceRemaining: DEVICE_POOL_LIMIT,
        reasonCode: 'stale_token',
        appRecognition: 'unknown',
        deviceIntegrity: 'unknown',
        failureCategory: 'confirmed_security_failure',
      }
    }

    // Step 5: Evaluate app recognition
    const appRecognition = payload.appRecognitionVerdict === 'PLAY_RECOGNIZED'
      ? 'recognized'
      : 'unrecognized'

    // Step 6: Evaluate device integrity
    const deviceIntegrity =
      payload.deviceIntegrity?.deviceRecognitionVerdict?.includes('MEETS_DEVICE_INTEGRITY')
        ? 'passed'
        : 'failed'

    // Step 7: Read Device Recall values
    const deviceRecall = payload.deviceRecall

    // If Device Recall data is absent (null), do NOT treat as trusted
    // fresh zero. Device Recall is a beta feature that may not be
    // provisioned for all devices. Classify as unsupported_environment
    // so the scan falls back to account quota instead of granting
    // unearned device pool scans.
    if (!deviceRecall) {
      return {
        ok: true, // Allow scan — fall back to account quota
        verificationStatus: 'success',
        integrityStatus: 'verified',
        deviceRecallStateKey: null,
        deviceBits: null,
        deviceTimestamps: null,
        deviceUsed: 0,
        deviceRemaining: DEVICE_POOL_LIMIT,
        reasonCode: 'device_recall_unavailable',
        appRecognition,
        deviceIntegrity,
        failureCategory: null,
      }
    }

    const bits = {
      bitFirst: deviceRecall.bitFirst === true,
      bitSecond: deviceRecall.bitSecond === true,
      bitThird: deviceRecall.bitThird === true,
    }

    const timestamps = {
      bitFirstTimestamp: deviceRecall.bitFirstTimestamp ?? null,
      bitSecondTimestamp: deviceRecall.bitSecondTimestamp ?? null,
      bitThirdTimestamp: deviceRecall.bitThirdTimestamp ?? null,
    }

    // Step 8: Calculate device usage
    let deviceUsed = 0
    let deviceRemaining = DEVICE_POOL_LIMIT

    if (!isDeviceUsageCurrentPeriod(timestamps)) {
      // Previous period — reset to zero
      deviceUsed = 0
      deviceRemaining = DEVICE_POOL_LIMIT
    } else {
      deviceUsed = decodeDeviceUsageCount(bits)
      deviceRemaining = calculateDeviceRemaining(bits, timestamps)
    }

    // Step 9: Derive device recall state key for audit.
    // This is NOT a stable device identifier or HMAC. It is a
    // concatenation of the Device Recall bits and timestamp
    // observed at verification time. It cannot join multiple
    // accounts on the same physical device. Google Device Recall
    // does not provide a stable device identifier.
    const deviceRecallStateKey = `dr_${bits.bitFirst ? 1 : 0}${bits.bitSecond ? 1 : 0}${
      bits.bitThird ? 1 : 0
    }_${timestamps.bitFirstTimestamp ?? ''}`

    // Step 10: Determine if integrity verification passed
    const integrityPassed = appRecognition === 'recognized' && deviceIntegrity === 'passed'

    return {
      ok: integrityPassed,
      verificationStatus: integrityPassed ? 'success' : 'failure',
      integrityStatus: integrityPassed ? 'verified' : 'failed',
      deviceRecallStateKey,
      deviceBits: bits,
      deviceTimestamps: timestamps,
      deviceUsed,
      deviceRemaining,
      reasonCode: integrityPassed ? 'verified' : 'integrity_failed',
      appRecognition,
      deviceIntegrity,
      failureCategory: integrityPassed ? null : 'confirmed_security_failure',
    }
  } catch (_e) {
    return {
      ok: opts.enforcementMode !== 'enforce',
      verificationStatus: 'failure',
      integrityStatus: 'unavailable',
      deviceRecallStateKey: null,
      deviceBits: null,
      deviceTimestamps: null,
      deviceUsed: 0,
      deviceRemaining: DEVICE_POOL_LIMIT,
      reasonCode: 'verification_error',
      appRecognition: 'unknown',
      deviceIntegrity: 'unknown',
      failureCategory: 'retryable_technical_failure',
    }
  }
}

// ── Helper: Get Google API access token ──────────────────────
//
// Implements Google OAuth2 server-to-server flow (JWT bearer token
// grant) using the Deno Web Crypto API. No external dependencies.
//
// The service account JSON is read from a Supabase secret
// (PLAY_INTEGRITY_SERVICE_ACCOUNT) and is NEVER sent to the
// mobile client or logged.
//
// BLOCKED — REQUIRES REMOTE SUPABASE: Real credential validation
// cannot be tested locally because the service-account JSON must
// be stored as a Supabase Edge Function secret. Local tests mock
// the Google token endpoint.

function base64UrlEncode(data: Uint8Array): string {
  let binary = ''
  for (const b of data) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str))
}

// Import a PEM-encoded RSA private key for RS256 signing.
// Google service-account keys use PKCS#8 format.
// Handles escaped "\n" sequences from JSON-encoded service-account keys.
function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  // Normalize escaped newlines: JSON may contain literal "\n" sequences
  const normalizedPem = pem.replace(/\\n/g, '\n')

  // Strip PEM headers and decode base64
  const pemContents = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  // Decode base64 to binary
  const binaryString = atob(pemContents)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

// ── In-memory access-token cache ─────────────────────────────
// Cache survives only within the current Edge Function isolate.
// Do not persist in the database. Do not assume cache survives
// a cold start.

interface CachedToken {
  token: string
  expiresAt: number // Unix epoch seconds
}

let cachedAccessToken: CachedToken | null = null
const TOKEN_SAFETY_BUFFER_SECONDS = 300 // 5 minutes
const OAUTH_TIMEOUT_MS = 10000 // 10 seconds

export function clearAccessTokenCache(): void {
  cachedAccessToken = null
}

export function getCachedTokenExpiry(): number | null {
  return cachedAccessToken?.expiresAt ?? null
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  // Check in-memory cache first
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expiresAt - now > TOKEN_SAFETY_BUFFER_SECONDS) {
    return cachedAccessToken.token
  }

  const creds = JSON.parse(serviceAccountJson)

  if (!creds.client_email || !creds.private_key) {
    // Log only sanitized identifiers, never the credentials
    console.error('[playIntegrity] Invalid service account: missing client_email or private_key')
    throw new Error('Invalid service account JSON: missing client_email or private_key')
  }

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/playintegrity',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header))
  const encodedClaim = base64UrlEncodeString(JSON.stringify(claim))
  const unsignedToken = `${encodedHeader}.${encodedClaim}`

  // Import the private key and sign the JWT
  const key = await importRsaPrivateKey(creds.private_key)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken),
  )

  const encodedSignature = base64UrlEncode(new Uint8Array(signature))
  const signedJwt = `${unsignedToken}.${encodedSignature}`
  // Never log the signed assertion or unsigned token

  // Exchange the signed JWT for an OAuth2 access token with explicit timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OAUTH_TIMEOUT_MS)

  let tokenResp: Response
  try {
    tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }),
      signal: controller.signal,
    })
  } catch (fetchErr) {
    clearTimeout(timeoutId)
    // Never log the error body which may contain assertion details
    const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'AbortError'
    console.error(`[playIntegrity] OAuth fetch ${isTimeout ? 'timed out' : 'failed'}`)
    throw new Error(
      isTimeout
        ? 'Google OAuth2 token exchange timed out'
        : 'Google OAuth2 token exchange network error',
    )
  }
  clearTimeout(timeoutId)

  if (!tokenResp.ok) {
    // Log only the status, never the response body
    console.error(`[playIntegrity] Google OAuth2 token exchange failed: ${tokenResp.status}`)
    throw new Error(`Google OAuth2 token exchange failed (status ${tokenResp.status})`)
  }

  const tokenData = await tokenResp.json()

  // Validate required response fields
  if (
    !tokenData.access_token || !tokenData.token_type || typeof tokenData.expires_in !== 'number'
  ) {
    console.error('[playIntegrity] OAuth response missing required fields')
    throw new Error('Google OAuth2 response missing access_token, token_type, or expires_in')
  }

  // Cache the token with calculated expiry
  const expiresAt = now + tokenData.expires_in
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt,
  }

  return tokenData.access_token
}
