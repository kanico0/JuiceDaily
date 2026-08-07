// ─────────────────────────────────────────────────────────────
// integrityLog.ts — Sanitized Play Integrity observability.
//
// Logs only stage, sanitized request correlation, and
// success/failure with reason codes. Never logs tokens,
// credentials, full request IDs, or raw exception text.
// ─────────────────────────────────────────────────────────────

/**
 * Returns a short sanitized suffix from a request ID.
 * Extracts the last segment after the final hyphen,
 * truncated to 8 characters. This is non-reversible
 * and does not reveal timestamps or sequence info.
 */
export function sanitizeRequestId(requestId: string): string {
  if (!requestId) return 'unknown'
  const parts = requestId.split('-')
  const suffix = parts[parts.length - 1] ?? 'unknown'
  return suffix.length > 8 ? suffix.slice(0, 8) : suffix
}

export type IntegrityStage =
  | 'durable_check'
  | 'pool_mode_resolved'
  | 'provider_selected'
  | 'provider_support'
  | 'attestation_start'
  | 'native_call_start'
  | 'native_token_received'
  | 'native_token_blank'
  | 'native_error'
  | 'attestation_attached'
  | 'scan_request_sent'

export type IntegrityReasonCode =
  | 'native_module_unavailable'
  | 'provider_unsupported'
  | 'prepare_failed'
  | 'token_request_failed'
  | 'blank_token'
  | 'unexpected_error'
  | 'cloud_project_number_missing'
  | 'no_user_id'
  | 'no_access_token'
  | 'success'

/**
 * Emits a sanitized integrity log line.
 * Only visible in development/QA builds via console.debug.
 */
export function integrityLog(
  stage: IntegrityStage,
  requestId: string,
  ok: boolean,
  reason?: IntegrityReasonCode,
  extra?: Record<string, string | boolean | number>,
): void {
  const sid = sanitizeRequestId(requestId)
  const parts = ['[integrity-js]', `stage=${stage}`, `sid=${sid}`, `ok=${ok}`]
  if (reason) parts.push(`reason=${reason}`)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      parts.push(`${k}=${v}`)
    }
  }
  console.debug(parts.join(' '))
}
