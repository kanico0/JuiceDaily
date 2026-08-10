// ─────────────────────────────────────────────────────────────
// identityResolver.ts — Canonical RawLifeFlow UUID resolution
// from RevenueCat webhook event identity fields.
//
// RevenueCat webhook identity can include:
//   event.app_user_id
//   event.original_app_user_id
//   event.aliases[]
//
// We collect candidate IDs from all three sources, filter to valid
// Supabase UUIDs, and identify the canonical RawLifeFlow UUID.
//
// Rules:
//   - $RCAnonymousID values are NOT RawLifeFlow UUIDs
//   - Email addresses are NOT RawLifeFlow UUIDs
//   - If more than one distinct valid UUID is implicated, STOP normal
//     state mutation and return a conflict result for reconciliation
//   - Prefer an exact valid UUID that exists in auth.users
// ─────────────────────────────────────────────────────────────

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type IdentityResolution =
  | { status: 'resolved'; uuid: string }
  | { status: 'unmappable'; reason: string }
  | { status: 'conflict'; uuids: string[]; reason: string }

// Check if an ID is a $RCAnonymousID (RevenueCat anonymous ID format)
function isRCAnonymousId(id: string): boolean {
  return id.startsWith('$RCAnonymousID:')
}

// Check if an ID is an email address
function isEmail(id: string): boolean {
  return id.includes('@') && !UUID_PATTERN.test(id)
}

// Check if an ID is a valid Supabase UUID (not anonymous, not email)
function isValidSupabaseUuid(id: string): boolean {
  if (!id) return false
  if (isRCAnonymousId(id)) return false
  if (isEmail(id)) return false
  return UUID_PATTERN.test(id)
}

// Collect all candidate UUIDs from the event's identity fields.
// Returns deduplicated list of valid Supabase UUIDs.
export function collectCandidateUuids(event: Record<string, unknown>): string[] {
  const candidates = new Set<string>()

  // app_user_id
  const appUserId = String(event.app_user_id ?? '')
  if (isValidSupabaseUuid(appUserId)) candidates.add(appUserId)

  // original_app_user_id
  const originalAppUserId = String(event.original_app_user_id ?? '')
  if (isValidSupabaseUuid(originalAppUserId)) candidates.add(originalAppUserId)

  // aliases[]
  const aliases = event.aliases as string[] | undefined
  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      const aliasStr = String(alias ?? '')
      if (isValidSupabaseUuid(aliasStr)) candidates.add(aliasStr)
    }
  }

  return Array.from(candidates)
}

// Resolve the canonical RawLifeFlow UUID from a webhook event.
// Does NOT query the database — pure identity-field analysis.
// The caller should verify the resolved UUID exists in auth.users
// before applying subscription state.
export function resolveCanonicalUuid(event: Record<string, unknown>): IdentityResolution {
  const candidates = collectCandidateUuids(event)

  if (candidates.length === 0) {
    // No valid Supabase UUID found in any identity field.
    // Check if there were only anonymous IDs or emails.
    const appUserId = String(event.app_user_id ?? '')
    const originalAppUserId = String(event.original_app_user_id ?? '')
    const aliases = event.aliases as string[] | undefined

    const hasAnonymous =
      isRCAnonymousId(appUserId) ||
      isRCAnonymousId(originalAppUserId) ||
      (Array.isArray(aliases) && aliases.some((a) => isRCAnonymousId(String(a ?? ''))))

    if (hasAnonymous) {
      return { status: 'unmappable', reason: 'anonymous_id_only' }
    }
    return { status: 'unmappable', reason: 'no_valid_uuid' }
  }

  if (candidates.length === 1) {
    return { status: 'resolved', uuid: candidates[0] }
  }

  // More than one distinct valid UUID — conflict.
  // Do NOT silently choose between conflicting UUIDs.
  // Caller must reconcile through RevenueCat CustomerInfo.
  return {
    status: 'conflict',
    uuids: candidates,
    reason: 'multiple_conflicting_uuids',
  }
}
