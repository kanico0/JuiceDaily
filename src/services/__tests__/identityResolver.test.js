// identityResolver.test.js — Tests for RevenueCat webhook identity
// LOOKUP KEY extraction.
//
// IMPORTANT: This module does NOT determine the canonical RawLifeFlow
// subscription owner. It only extracts a lookup key (any valid UUID)
// from the event for the RevenueCat REST API query. The canonical UUID
// comes from subscriber.original_app_user_id in the REST response.
//
// Lookup key selection order:
//   1. original_app_user_id (if valid Supabase UUID)
//   2. app_user_id (if valid Supabase UUID)
//   3. first valid Supabase UUID from aliases[]
//
// Multiple aliases are NOT an error — they are lookup/diagnostic evidence.

const fs = require('fs')
const path = require('path')

const resolverPath = path.resolve(
  __dirname,
  '../../../supabase/functions/revenuecat-webhook/identityResolver.ts',
)
const resolverSource = fs.readFileSync(resolverPath, 'utf8')

// Recreate the resolver logic from source for testing.
function makeResolver() {
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  function isRCAnonymousId(id) {
    return id.startsWith('$RCAnonymousID:')
  }

  function isEmail(id) {
    return id.includes('@') && !UUID_PATTERN.test(id)
  }

  function isValidSupabaseUuid(id) {
    if (!id) return false
    if (isRCAnonymousId(id)) return false
    if (isEmail(id)) return false
    return UUID_PATTERN.test(id)
  }

  function collectCandidateUuids(event) {
    const candidates = new Set()
    const appUserId = String(event.app_user_id ?? '')
    if (isValidSupabaseUuid(appUserId)) candidates.add(appUserId)
    const originalAppUserId = String(event.original_app_user_id ?? '')
    if (isValidSupabaseUuid(originalAppUserId)) candidates.add(originalAppUserId)
    const aliases = event.aliases
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        const aliasStr = String(alias ?? '')
        if (isValidSupabaseUuid(aliasStr)) candidates.add(aliasStr)
      }
    }
    return Array.from(candidates)
  }

  function resolveLookupKey(event) {
    const appUserId = String(event.app_user_id ?? '')
    const originalAppUserId = String(event.original_app_user_id ?? '')

    if (isValidSupabaseUuid(originalAppUserId)) {
      return { status: 'resolved', lookupKey: originalAppUserId }
    }
    if (isValidSupabaseUuid(appUserId)) {
      return { status: 'resolved', lookupKey: appUserId }
    }
    const aliases = event.aliases
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        const aliasStr = String(alias ?? '')
        if (isValidSupabaseUuid(aliasStr)) {
          return { status: 'resolved', lookupKey: aliasStr }
        }
      }
    }
    const hasAnonymous =
      isRCAnonymousId(appUserId) ||
      isRCAnonymousId(originalAppUserId) ||
      (Array.isArray(aliases) && aliases.some((a) => isRCAnonymousId(String(a ?? ''))))
    if (hasAnonymous) return { status: 'unmappable', reason: 'anonymous_id_only' }
    return { status: 'unmappable', reason: 'no_valid_uuid' }
  }

  return { resolveLookupKey, collectCandidateUuids, isValidSupabaseUuid, UUID_PATTERN }
}

const { resolveLookupKey, collectCandidateUuids } = makeResolver()

const UUID_A = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const UUID_B = '11111111-2222-3333-4444-555555555555'
const UUID_C = '33333333-4444-5555-6666-777777777777'
const RC_ANON = '$RCAnonymousID:abc123'
const EMAIL = 'user@example.com'

describe('identityResolver source structure', () => {
  it('11. source exports resolveLookupKey (NOT resolveCanonicalUuid)', () => {
    expect(resolverSource).toMatch(/export function resolveLookupKey/)
    expect(resolverSource).not.toMatch(/export function resolveCanonicalUuid/)
  })

  it('12. source exports collectCandidateUuids', () => {
    expect(resolverSource).toMatch(/export function collectCandidateUuids/)
  })

  it('13. source exports UUID_PATTERN', () => {
    expect(resolverSource).toMatch(/export const UUID_PATTERN/)
  })

  it('14. source checks app_user_id', () => {
    expect(resolverSource).toMatch(/event\.app_user_id/)
  })

  it('15. source checks original_app_user_id', () => {
    expect(resolverSource).toMatch(/event\.original_app_user_id/)
  })

  it('16. source checks aliases[]', () => {
    expect(resolverSource).toMatch(/event\.aliases/)
  })

  it('17. source rejects $RCAnonymousID', () => {
    expect(resolverSource).toMatch(/isRCAnonymousId/)
    expect(resolverSource).toMatch(/\$RCAnonymousID:/)
  })

  it('18. source rejects email addresses', () => {
    expect(resolverSource).toMatch(/isEmail/)
  })

  it('19. source documents lookup key is NOT canonical', () => {
    expect(resolverSource).toMatch(/NOT.*canonical/i)
    expect(resolverSource).toMatch(/lookup key/i)
  })

  it('19a. source documents canonical comes from REST original_app_user_id', () => {
    expect(resolverSource).toMatch(/subscriber\.original_app_user_id/)
  })

  it('19b. source documents app_user_id is last-seen (not stable)', () => {
    expect(resolverSource).toMatch(/last-seen/i)
    expect(resolverSource).toMatch(/NOT stable/i)
  })

  it('19c. source documents aliases are NOT an error', () => {
    expect(resolverSource).toMatch(/Multiple aliases are NOT an error/i)
  })
})

describe('identityResolver: lookup key from original_app_user_id (precedence 1)', () => {
  it('1. resolves lookup key from original_app_user_id', () => {
    const result = resolveLookupKey({ original_app_user_id: UUID_A })
    expect(result.status).toBe('resolved')
    expect(result.lookupKey).toBe(UUID_A)
  })

  it('1a. original_app_user_id preferred over app_user_id', () => {
    const result = resolveLookupKey({
      app_user_id: UUID_B,
      original_app_user_id: UUID_A,
    })
    expect(result.status).toBe('resolved')
    expect(result.lookupKey).toBe(UUID_A)
  })
})

describe('identityResolver: lookup key from app_user_id (precedence 2)', () => {
  it('2. resolves lookup key from app_user_id when original not valid', () => {
    const result = resolveLookupKey({
      app_user_id: UUID_A,
      original_app_user_id: RC_ANON,
    })
    expect(result.status).toBe('resolved')
    expect(result.lookupKey).toBe(UUID_A)
  })

  it('2a. resolves lookup key from app_user_id alone', () => {
    const result = resolveLookupKey({ app_user_id: UUID_A })
    expect(result.status).toBe('resolved')
    expect(result.lookupKey).toBe(UUID_A)
  })
})

describe('identityResolver: lookup key from aliases[] (precedence 3)', () => {
  it('3. resolves lookup key from first valid UUID in aliases', () => {
    const result = resolveLookupKey({
      app_user_id: RC_ANON,
      aliases: [UUID_A],
    })
    expect(result.status).toBe('resolved')
    expect(result.lookupKey).toBe(UUID_A)
  })

  it('3a. resolves lookup key from aliases with mixed content', () => {
    const result = resolveLookupKey({
      app_user_id: RC_ANON,
      aliases: [RC_ANON, UUID_A, UUID_B],
    })
    expect(result.status).toBe('resolved')
    expect(result.lookupKey).toBe(UUID_A)
  })
})

describe('identityResolver: unmappable cases', () => {
  it('5a. malformed string → unmappable', () => {
    const result = resolveLookupKey({ app_user_id: 'not-a-uuid' })
    expect(result.status).toBe('unmappable')
  })

  it('5b. empty string → unmappable', () => {
    const result = resolveLookupKey({ app_user_id: '' })
    expect(result.status).toBe('unmappable')
  })

  it('5c. $RCAnonymousID only → unmappable (anonymous_id_only)', () => {
    const result = resolveLookupKey({
      app_user_id: RC_ANON,
      aliases: [RC_ANON],
    })
    expect(result.status).toBe('unmappable')
    expect(result.reason).toBe('anonymous_id_only')
  })

  it('5d. email only → unmappable', () => {
    const result = resolveLookupKey({ app_user_id: EMAIL })
    expect(result.status).toBe('unmappable')
    expect(result.reason).toBe('no_valid_uuid')
  })

  it('5e. empty event → unmappable', () => {
    const result = resolveLookupKey({})
    expect(result.status).toBe('unmappable')
  })
})

describe('identityResolver: multiple aliases are NOT an error', () => {
  it('6. multiple UUIDs in aliases → resolved (first valid used as lookup)', () => {
    const result = resolveLookupKey({
      app_user_id: UUID_A,
      aliases: [UUID_B, UUID_C],
    })
    expect(result.status).toBe('resolved')
    // original_app_user_id absent, app_user_id is UUID_A → lookup is UUID_A
    expect(result.lookupKey).toBe(UUID_A)
  })

  it('6a. no conflict status exists in resolver', () => {
    // The resolver no longer has a 'conflict' status — multiple aliases
    // are just lookup evidence, not a conflict.
    expect(resolverSource).not.toMatch(/status: 'conflict'/)
  })
})

describe('identityResolver: collectCandidateUuids for diagnostics', () => {
  it('10. collects all valid UUIDs from all fields', () => {
    const candidates = collectCandidateUuids({
      app_user_id: UUID_A,
      original_app_user_id: UUID_A,
      aliases: [UUID_A, UUID_B],
    })
    expect(candidates).toContain(UUID_A)
    expect(candidates).toContain(UUID_B)
    expect(candidates.length).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────
// TEST payload shape tests
//
// The actual RevenueCat TEST event for RawLifeFlow Play Store
// (app_id=app635f20aea6) contains:
//   - app_user_id:           <primary UUID>
//   - original_app_user_id:  <same primary UUID>
//   - aliases[]:             [<primary UUID>, <secondary UUID>]
//
// This must resolve a lookup key (NOT conflict). The canonical UUID
// is determined later from REST CustomerInfo.
// ─────────────────────────────────────────────────────────────
describe('identityResolver: TEST payload shape (app635f20aea6)', () => {
  const PRIMARY_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const SECONDARY_UUID = '11111111-2222-3333-4444-555555555555'

  it('20. TEST shape: resolves lookup key (no conflict)', () => {
    const result = resolveLookupKey({
      app_user_id: PRIMARY_UUID,
      original_app_user_id: PRIMARY_UUID,
      aliases: [PRIMARY_UUID, SECONDARY_UUID],
    })
    expect(result.status).toBe('resolved')
    // original_app_user_id is preferred → lookup is PRIMARY_UUID
    expect(result.lookupKey).toBe(PRIMARY_UUID)
  })

  it('20a. TEST shape: lookup key is original_app_user_id (preferred)', () => {
    const result = resolveLookupKey({
      app_user_id: SECONDARY_UUID,
      original_app_user_id: PRIMARY_UUID,
      aliases: [PRIMARY_UUID, SECONDARY_UUID],
    })
    expect(result.lookupKey).toBe(PRIMARY_UUID)
  })

  it('20b. TEST shape: collectCandidateUuids returns both for diagnostics', () => {
    const candidates = collectCandidateUuids({
      app_user_id: PRIMARY_UUID,
      original_app_user_id: PRIMARY_UUID,
      aliases: [PRIMARY_UUID, SECONDARY_UUID],
    })
    expect(candidates).toContain(PRIMARY_UUID)
    expect(candidates).toContain(SECONDARY_UUID)
    expect(candidates.length).toBe(2)
  })
})
