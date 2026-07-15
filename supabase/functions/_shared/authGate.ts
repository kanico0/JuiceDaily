// ─────────────────────────────────────────────────────────────
// authGate.ts — Shared server-side account gate for the scan
// Edge Functions (analyze-scan, scan-quota).
//
// Pure logic (no Deno APIs) so it is unit-testable from the app's
// jest suite while being bundled into the deployed functions.
//
// Trust model:
//   * The caller must obtain `user` from supabase.auth.getUser(jwt)
//     — the Auth server cryptographically validates signature and
//     expiry. A merely Base64-decoded JWT payload must NEVER be
//     passed here.
//   * Supabase anonymous users carry the 'authenticated' role, so
//     role/uid presence is insufficient: only the server-trusted
//     is_anonymous flag on the verified user record decides.
//   * The canonical user id is derived exclusively from that
//     verified record — request-body identity fields are ignored
//     by design.
// ─────────────────────────────────────────────────────────────

export interface VerifiedUser {
  id: string
  is_anonymous?: boolean | null
}

export type GateResult =
  | { ok: true; userId: string }
  | {
      ok: false
      status: 401 | 403
      code: 'missing_authorization' | 'invalid_token' | 'account_required'
      message: string
    }

// Extract the bearer token from an Authorization header value.
export function extractBearerToken (authHeader: string | null): string | null {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  return token.length > 0 ? token : null
}

// Decide whether a verified user may perform funded scan work.
// verifyError is the error returned by auth.getUser(jwt): any
// verification failure (expired, malformed, forged signature)
// yields 401 regardless of what the token payload claims.
export function evaluateScanUser (
  user: VerifiedUser | null,
  verifyError: { message: string } | null,
): GateResult {
  if (verifyError || !user || !user.id) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_token',
      message: 'Invalid token',
    }
  }

  if (user.is_anonymous === true) {
    return {
      ok: false,
      status: 403,
      code: 'account_required',
      message: 'A verified account is required before scanning',
    }
  }

  return { ok: true, userId: user.id }
}
