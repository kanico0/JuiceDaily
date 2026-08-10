// ─────────────────────────────────────────────────────────────
// identityResolver.ts — RevenueCat webhook identity LOOKUP KEY
// extraction.
//
// IMPORTANT: This module does NOT determine the canonical RawLifeFlow
// subscription owner. Event fields (app_user_id, original_app_user_id,
// aliases[]) are ONLY used as lookup keys to query RevenueCat REST
// CustomerInfo. The canonical UUID is established from:
//
//   subscriber.original_app_user_id
//
// in the REST CustomerInfo response (see revenueCatRest.ts and
// index.ts).
//
// RevenueCat documents:
//   app_user_id          = last-seen App User ID (NOT stable enough
//                          for subscription ownership)
//   original_app_user_id = first App User ID used by that customer
//   aliases[]            = all App User IDs associated with that
//                          customer (lookup/diagnostic evidence)
//
// Lookup key selection order (any valid UUID works as a lookup key
// since RevenueCat returns the same CustomerInfo for any alias of
// the same customer):
//   1. original_app_user_id (if valid Supabase UUID)
//   2. app_user_id (if valid Supabase UUID)
//   3. first valid Supabase UUID from aliases[]
//
// Rules:
//   - $RCAnonymousID values are NOT RawLifeFlow UUIDs
//   - Email addresses are NOT RawLifeFlow UUIDs
//   - Multiple aliases are NOT an error — they are lookup evidence
// ─────────────────────────────────────────────────────────────

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type LookupKeyResolution =
  | { status: 'resolved'; lookupKey: string }
  | { status: 'unmappable'; reason: string }

// Check if an ID is a $RCAnonymousID (RevenueCat anonymous ID format)
function isRCAnonymousId(id: string): boolean {
  return id.startsWith('$RCAnonymousID:')
}

// Check if an ID is an email address
function isEmail(id: string): boolean {
  return id.includes('@') && !UUID_PATTERN.test(id)
}

// Check if an ID is a valid Supabase UUID (not anonymous, not email)
export function isValidSupabaseUuid(id: string): boolean {
  if (!id) return false
  if (isRCAnonymousId(id)) return false
  if (isEmail(id)) return false
  return UUID_PATTERN.test(id)
}

// Collect all candidate UUIDs from all identity fields.
// Used for diagnostics only — NOT for canonical resolution.
export function collectCandidateUuids(event: Record<string, unknown>): string[] {
  const candidates = new Set<string>()

  const appUserId = String(event.app_user_id ?? '')
  if (isValidSupabaseUuid(appUserId)) candidates.add(appUserId)

  const originalAppUserId = String(event.original_app_user_id ?? '')
  if (isValidSupabaseUuid(originalAppUserId)) candidates.add(originalAppUserId)

  const aliases = event.aliases as string[] | undefined
  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      const aliasStr = String(alias ?? '')
      if (isValidSupabaseUuid(aliasStr)) candidates.add(aliasStr)
    }
  }

  return Array.from(candidates)
}

// Extract a lookup key from the webhook event for RevenueCat REST
// API query. This is NOT the canonical RawLifeFlow UUID — it is
// merely a key to fetch CustomerInfo from RevenueCat.
//
// The canonical UUID is determined from the REST response's
// subscriber.original_app_user_id field.
export function resolveLookupKey(event: Record<string, unknown>): LookupKeyResolution {
  const appUserId = String(event.app_user_id ?? '')
  const originalAppUserId = String(event.original_app_user_id ?? '')

  // Prefer original_app_user_id as lookup key (most stable event field)
  if (isValidSupabaseUuid(originalAppUserId)) {
    return { status: 'resolved', lookupKey: originalAppUserId }
  }

  // Fall back to app_user_id
  if (isValidSupabaseUuid(appUserId)) {
    return { status: 'resolved', lookupKey: appUserId }
  }

  // Fall back to first valid UUID in aliases[]
  const aliases = event.aliases as string[] | undefined
  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      const aliasStr = String(alias ?? '')
      if (isValidSupabaseUuid(aliasStr)) {
        return { status: 'resolved', lookupKey: aliasStr }
      }
    }
  }

  // No valid Supabase UUID in any field
  const hasAnonymous =
    isRCAnonymousId(appUserId) ||
    isRCAnonymousId(originalAppUserId) ||
    (Array.isArray(aliases) && aliases.some((a) => isRCAnonymousId(String(a ?? ''))))

  if (hasAnonymous) {
    return { status: 'unmappable', reason: 'anonymous_id_only' }
  }
  return { status: 'unmappable', reason: 'no_valid_uuid' }
}
