// ─────────────────────────────────────────────────────────────
// sandboxGuard.ts — Pure decision function for the RevenueCat
// webhook sandbox/production boundary.
//
// event.environment ('sandbox' | 'production') reflects RevenueCat's
// own classification of the underlying store purchase. It is NOT a
// value the mobile client can set directly. RevenueCat delivers both
// sandbox and production events to the SAME webhook URL by default,
// so a sandbox purchase (e.g. a TestFlight/Play internal-testing
// sandbox tester) must never be allowed to activate real production
// Pro entitlement.
//
// `allowSandboxEntitlement` must ONLY ever be derived from a
// server-side Supabase function secret (e.g.
// Deno.env.get('REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT') === '1'),
// intended for a dedicated, explicitly-provisioned QA project only.
// It must never be sourced from client/request input.
// ─────────────────────────────────────────────────────────────

export type RevenueCatEnvironment = 'sandbox' | 'production'

/**
 * Returns true when a sandbox event must be skipped (never mutate
 * production subscription state). Production events are never
 * skipped by this guard.
 *
 * Used ONLY as an early bail-out when RevenueCat REST reconciliation
 * is not configured/available, so a canonical identity cannot be
 * safely resolved for the reviewer-allowlist check below. When REST
 * IS configured, the final decision is made by
 * `shouldSkipSandboxEventForCanonicalUser` AFTER canonical identity
 * has been resolved and validated — this function alone must never
 * be used to permit a sandbox mutation.
 */
export function shouldSkipSandboxEvent(
  environment: RevenueCatEnvironment,
  allowSandboxEntitlement: boolean,
): boolean {
  if (environment !== 'sandbox') return false
  return !allowSandboxEntitlement
}

/**
 * Parses the server-only REVENUECAT_SANDBOX_REVIEWER_UUIDS secret
 * (comma-separated Supabase auth.users UUIDs) into a normalized
 * (lowercased, trimmed) allowlist. Never sourced from client/request
 * input — must only ever be read from Deno.env.get(...) by the
 * caller.
 */
export function parseSandboxReviewerAllowlist(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Returns true when the given CANONICAL Supabase UUID (already
 * resolved via RevenueCat REST `subscriber.original_app_user_id`
 * AND validated to exist in auth.users — never the raw, unvalidated
 * webhook `event.app_user_id`) is present in the server-only
 * reviewer allowlist.
 */
export function isSandboxReviewerAllowed(
  canonicalUuid: string,
  reviewerAllowlist: string[],
): boolean {
  if (!canonicalUuid) return false
  return reviewerAllowlist.includes(canonicalUuid.trim().toLowerCase())
}

/**
 * Final, post-reconciliation decision for a SANDBOX event: skip
 * unless the global escape hatch is enabled (never used in
 * production) OR the canonical, auth.users-validated UUID is on the
 * server-only reviewer allowlist. Must be called only AFTER
 * canonical identity has been resolved via RevenueCat REST and
 * validated against auth.users — never against a raw/unvalidated
 * webhook payload field.
 */
export function shouldSkipSandboxEventForCanonicalUser(
  environment: RevenueCatEnvironment,
  allowSandboxEntitlement: boolean,
  canonicalUuid: string,
  reviewerAllowlist: string[],
): boolean {
  if (environment !== 'sandbox') return false
  if (allowSandboxEntitlement) return false
  return !isSandboxReviewerAllowed(canonicalUuid, reviewerAllowlist)
}
