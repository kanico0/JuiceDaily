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
 */
export function shouldSkipSandboxEvent(
  environment: RevenueCatEnvironment,
  allowSandboxEntitlement: boolean,
): boolean {
  if (environment !== 'sandbox') return false
  return !allowSandboxEntitlement
}
