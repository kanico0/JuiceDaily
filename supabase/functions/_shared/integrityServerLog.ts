// ─────────────────────────────────────────────────────────────
// integrityServerLog.ts — Sanitized server-side Play Integrity
// observability for Edge Functions.
//
// Logs only stage, sanitized request correlation, and
// success/failure with reason codes. Never logs tokens,
// credentials, full request IDs, account UUIDs, or Device
// Recall state keys.
// ─────────────────────────────────────────────────────────────

/**
 * Returns a short sanitized suffix from a request ID.
 * Extracts the last segment after the final hyphen,
 * truncated to 8 characters.
 */
export function sanitizeRequestId(requestId: string): string {
  if (!requestId) return 'unknown'
  const parts = requestId.split('-')
  const suffix = parts[parts.length - 1] ?? 'unknown'
  return suffix.length > 8 ? suffix.slice(0, 8) : suffix
}

/**
 * Returns a masked user ID — first 4 chars + asterisks.
 */
export function maskUserId(userId: string): string {
  if (!userId || userId.length < 8) return '****'
  return userId.slice(0, 4) + '****'
}

/**
 * Returns a masked Device Recall state key — first 6 chars + asterisks.
 */
export function maskDeviceRecallKey(key: string): string {
  if (!key || key.length < 10) return '****'
  return key.slice(0, 6) + '****'
}

type ServerIntegrityStage =
  | 'request_accepted'
  | 'user_classification'
  | 'pool_mode'
  | 'integrity_field'
  | 'verification_block'
  | 'verify_called'
  | 'verification_result'
  | 'device_recall_present'
  | 'device_recall_decoded'
  | 'effective_remaining'
  | 'observe_decision'
  | 'enforcement_attempted'
  | 'account_reservation'
  | 'device_reservation'
  | 'analysis'
  | 'account_finalization'
  | 'device_finalization'

/**
 * Emits a sanitized server-side integrity log line.
 */
export function serverIntegrityLog(
  stage: ServerIntegrityStage,
  requestId: string,
  ok: boolean,
  reason?: string,
  extra?: Record<string, string | boolean | number>,
): void {
  const sid = sanitizeRequestId(requestId)
  const parts = ['[integrity-server]', `stage=${stage}`, `sid=${sid}`, `ok=${ok}`]
  if (reason) parts.push(`reason=${reason}`)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      parts.push(`${k}=${v}`)
    }
  }
  console.log(parts.join(' '))
}
