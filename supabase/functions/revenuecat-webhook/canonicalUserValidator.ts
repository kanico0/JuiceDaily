// canonicalUserValidator.ts — Canonical RawLifeFlow user validation.
//
// Extracted from the webhook handler so the three validation outcomes
// (valid user, genuinely absent user, lookup/infrastructure error) can
// be exercised by execution-level tests without standing up a Deno
// Edge Function runtime.
//
// IMPORTANT: This MUST use the Supabase Auth Admin API
// (admin.auth.admin.getUserById), NOT a PostgREST query against
// `auth.users`. PostgREST resolves `from('auth.users')` as a relation
// named "auth.users" inside the public schema, which does not exist,
// returning a PGRST205 schema error with data: null. The previous
// implementation discarded that error and treated the user as absent,
// permanently stranding paying subscribers as Free.

export type CanonicalUserValidation =
  | { status: 'valid' }
  | { status: 'missing' }
  | { status: 'error'; message: string }

/**
 * Validate that a canonical UUID (from RevenueCat REST
 * subscriber.original_app_user_id) corresponds to a real RawLifeFlow
 * Auth account.
 *
 * Outcomes:
 *   A. VALID USER       → { status: 'valid' }
 *   B. GENUINELY ABSENT → { status: 'missing' }
 *   C. LOOKUP ERROR     → { status: 'error', message } (do NOT treat as missing)
 */
export async function validateCanonicalUser (
  admin: { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: unknown } | null, error: { message: string } | null }> } } },
  canonicalUuid: string,
): Promise<CanonicalUserValidation> {
  const { data: userData, error: userLookupError } = await admin
    .auth
    .admin
    .getUserById(canonicalUuid)

  if (userLookupError) {
    // Outcome C — infrastructure / lookup error. Do NOT confuse this
    // with a genuine "user not found".
    return { status: 'error', message: userLookupError.message }
  }

  if (!userData?.user) {
    // Outcome B — the Auth Admin API definitively reports no user
    // exists for this UUID. This is a genuine absence.
    return { status: 'missing' }
  }

  // Outcome A — valid RawLifeFlow account.
  return { status: 'valid' }
}
