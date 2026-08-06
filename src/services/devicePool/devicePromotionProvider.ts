// ─────────────────────────────────────────────────────────────
// devicePromotionProvider.ts — Platform-neutral interface for
// device-level free scan promotion (anti-abuse).
//
// The client NEVER decides how many scans remain. It only:
//   1. Checks if device attestation is supported on this platform
//   2. Obtains a short-lived Play Integrity token (or mock) bound
//      to a server-generated challenge
//   3. Reports development/test status
//
// The server owns:
//   - Token decoding and integrity validation
//   - Device-recall interpretation
//   - Free allowance calculation
//   - Reservation, completion, rollback, enforcement
// ─────────────────────────────────────────────────────────────

export interface AttestationRequestContext {
  // Server-generated one-time challenge / request ID
  challenge: string
  // Authenticated Supabase user UUID
  userId: string
  // Intended action (always 'analyze_scan' for this provider)
  action: 'analyze_scan'
  // Canonical request payload digest (server-controlled)
  requestPayloadDigest: string
}

export interface AttestationResult {
  // Short-lived Play Integrity token, or documented mock result
  token: string
  // Provider name for telemetry
  provider: string
  // Whether this is a mock/development result
  isMock: boolean
}

export interface DevicePromotionProvider {
  // Whether this provider is supported on the current platform/build
  isSupported(): boolean

  // Request a Play Integrity token bound to the scan request context
  getAttestationForScan(ctx: AttestationRequestContext): Promise<AttestationResult>

  // Development/test status for telemetry labeling
  getDevelopmentStatus(): 'production' | 'development' | 'test'

  // Provider name for analytics
  getProviderName(): string
}
