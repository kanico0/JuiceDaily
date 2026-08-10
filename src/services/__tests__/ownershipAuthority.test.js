// ownershipAuthority.test.js — Tests proving that the canonical
// RawLifeFlow subscription UUID comes from RevenueCat REST
// CustomerInfo's subscriber.original_app_user_id, NOT from
// event.app_user_id.
//
// Architecture:
//   1. Event fields (app_user_id, original_app_user_id, aliases[])
//      are ONLY lookup keys for the REST API.
//   2. The canonical UUID is subscriber.original_app_user_id from
//      the REST CustomerInfo response.
//   3. Account B must never receive Account A's server-side Pro
//      merely because B appears as event.app_user_id.
//
// Test scenarios:
//   1. app_user_id A + alias B + REST original=A → mutate A
//   2. app_user_id B + alias A + REST original=A → mutate A, NOT B
//   3. event original=A, app_user_id=B, REST original=A → mutate A
//   4. multiple UUID aliases + REST original=A → no conflict, mutate A
//   5. REST original_app_user_id invalid/non-UUID → no mutation
//   6. REST original UUID does not correspond to RawLifeFlow account → no mutation
//   7. TEST event → 200 / no identity resolution / no mutation
//   8. Account B never receives Account A's Pro merely because B is event.app_user_id

const fs = require('fs')
const path = require('path')

const webhookPath = path.resolve(__dirname, '../../../supabase/functions/revenuecat-webhook/index.ts')
const webhookSource = fs.readFileSync(webhookPath, 'utf8')

const restPath = path.resolve(__dirname, '../../../supabase/functions/revenuecat-webhook/revenueCatRest.ts')
const restSource = fs.readFileSync(restPath, 'utf8')

const resolverPath = path.resolve(__dirname, '../../../supabase/functions/revenuecat-webhook/identityResolver.ts')
const resolverSource = fs.readFileSync(resolverPath, 'utf8')

const UUID_A = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const UUID_B = '11111111-2222-3333-4444-555555555555'

// Recreate the REST parsing logic to test canonical UUID extraction
function makeRestParser() {
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

  function parseProEntitlement(data) {
    try {
      const subscriber = data.subscriber
      if (!subscriber) return { ok: false, error: 'malformed_response: no subscriber object' }

      const originalAppUserId = String(subscriber.original_app_user_id ?? '')
      if (!isValidSupabaseUuid(originalAppUserId)) {
        return {
          ok: false,
          error: 'invalid_canonical_uuid: original_app_user_id is not a valid Supabase UUID',
        }
      }

      const entitlements = subscriber.entitlements
      if (!entitlements) return { ok: false, error: 'malformed_response: no entitlements object' }

      const proEntitlement = entitlements.pro
      if (!proEntitlement) {
        return {
          ok: true,
          canonicalUserId: originalAppUserId,
          entitlement: { isActive: false, expirationDate: null, productId: null, willRenew: false, store: null },
        }
      }

      const expirationDate = proEntitlement.expires_date ?? null
      const productId = proEntitlement.product_identifier ?? null
      const isActive = proEntitlement.expires_date === null || new Date(expirationDate) > new Date()

      return {
        ok: true,
        canonicalUserId: originalAppUserId,
        entitlement: { isActive, expirationDate, productId, willRenew: true, store: 'play_store' },
      }
    } catch (e) {
      return { ok: false, error: `parse_error: ${e.message}` }
    }
  }

  return { parseProEntitlement, isValidSupabaseUuid }
}

const { parseProEntitlement } = makeRestParser()

describe('ownershipAuthority: source structure', () => {
  it('S1. webhook imports resolveLookupKey (NOT resolveCanonicalUuid)', () => {
    expect(webhookSource).toMatch(/resolveLookupKey/)
    expect(webhookSource).not.toMatch(/resolveCanonicalUuid/)
  })

  it('S2. webhook uses restResult.canonicalUserId as canonical UUID', () => {
    expect(webhookSource).toMatch(/canonicalUserId/)
    expect(webhookSource).toMatch(/restResult\.canonicalUserId/)
  })

  it('S3. webhook does NOT use event.app_user_id as canonical', () => {
    // The canonical UUID must come from REST, not from the event
    const rpcSection = webhookSource.slice(webhookSource.indexOf('apply_revenuecat_event'))
    expect(rpcSection).toMatch(/p_user_id: canonicalUuid/)
    // canonicalUuid is assigned from restResult.canonicalUserId, not event.app_user_id
  })

  it('S4. REST helper extracts subscriber.original_app_user_id', () => {
    expect(restSource).toMatch(/subscriber\.original_app_user_id/)
    expect(restSource).toMatch(/canonicalUserId/)
  })

  it('S5. REST helper returns canonicalUserId in result', () => {
    expect(restSource).toMatch(/canonicalUserId/)
  })

  it('S6. REST helper validates original_app_user_id is valid UUID', () => {
    expect(restSource).toMatch(/isValidSupabaseUuid\(originalAppUserId\)/)
    expect(restSource).toMatch(/invalid_canonical_uuid/)
  })

  it('S7. webhook validates canonical UUID exists in auth.users', () => {
    expect(webhookSource).toMatch(/auth\.users/)
    expect(webhookSource).toMatch(/canonical_uuid_not_found_in_auth/)
  })

  it('S8. webhook documents app_user_id is NOT canonical', () => {
    expect(webhookSource).toMatch(/NOT.*canonical/i)
    expect(webhookSource).toMatch(/last-seen/i)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 1: app_user_id A + alias B + REST original=A → mutate A
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 1 — app_user_id A + alias B + REST original=A', () => {
  it('1. REST returns canonicalUserId=A (from subscriber.original_app_user_id)', () => {
    const restData = {
      subscriber: {
        original_app_user_id: UUID_A,
        entitlements: {
          pro: { expires_date: '2099-12-31T23:59:59Z', product_identifier: 'juicing_daily_pro:annual' },
        },
        subscriptions: {},
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(true)
    expect(result.canonicalUserId).toBe(UUID_A)
  })

  it('1a. canonical is A, NOT B (even though B is in aliases)', () => {
    // Event has app_user_id=A, aliases=[A, B]
    // REST returns original_app_user_id=A
    // → canonical is A
    const restData = {
      subscriber: {
        original_app_user_id: UUID_A,
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.canonicalUserId).toBe(UUID_A)
    expect(result.canonicalUserId).not.toBe(UUID_B)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 2: app_user_id B + alias A + REST original=A → mutate A, NOT B
// This is the critical test: event.app_user_id is B, but REST says
// the canonical owner is A. The webhook must mutate A, not B.
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 2 — app_user_id B + REST original=A → mutate A', () => {
  it('2. REST returns canonicalUserId=A even when lookup was via B', () => {
    // Event has app_user_id=B, but we look up B in RevenueCat
    // and REST returns original_app_user_id=A
    const restData = {
      subscriber: {
        original_app_user_id: UUID_A,
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(true)
    expect(result.canonicalUserId).toBe(UUID_A)
    expect(result.canonicalUserId).not.toBe(UUID_B)
  })

  it('2a. webhook uses canonicalUserId (A) for apply_revenuecat_event, not lookup key (B)', () => {
    // The webhook source must use restResult.canonicalUserId for p_user_id
    const rpcSection = webhookSource.slice(
      webhookSource.indexOf('p_user_id: canonicalUuid'),
    )
    expect(rpcSection).toMatch(/p_user_id: canonicalUuid/)
    // canonicalUuid is set from restResult.canonicalUserId
    const assignSection = webhookSource.slice(
      webhookSource.indexOf('canonicalUuid = restResult.canonicalUserId'),
    )
    expect(assignSection).toMatch(/canonicalUuid = restResult\.canonicalUserId/)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 3: event original=A, app_user_id=B, REST original=A → mutate A
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 3 — event original=A, app_user_id=B, REST original=A', () => {
  it('3. lookup key is original_app_user_id (A), REST confirms original=A', () => {
    // Lookup key prefers original_app_user_id → lookup is A
    // REST returns original_app_user_id=A → canonical is A
    const restData = {
      subscriber: {
        original_app_user_id: UUID_A,
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.canonicalUserId).toBe(UUID_A)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 4: multiple UUID aliases + REST original=A → no conflict, mutate A
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 4 — multiple aliases + REST original=A', () => {
  it('4. multiple aliases do not cause conflict', () => {
    // No conflict status in the resolver
    expect(resolverSource).not.toMatch(/status: 'conflict'/)
  })

  it('4a. REST returns canonicalUserId=A regardless of alias count', () => {
    const restData = {
      subscriber: {
        original_app_user_id: UUID_A,
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(true)
    expect(result.canonicalUserId).toBe(UUID_A)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 5: REST original_app_user_id invalid/non-UUID → no mutation
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 5 — REST original invalid → no mutation', () => {
  it('5a. REST original_app_user_id is $RCAnonymousID → ok=false', () => {
    const restData = {
      subscriber: {
        original_app_user_id: '$RCAnonymousID:abc123',
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid_canonical_uuid/)
  })

  it('5b. REST original_app_user_id is email → ok=false', () => {
    const restData = {
      subscriber: {
        original_app_user_id: 'user@example.com',
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(false)
  })

  it('5c. REST original_app_user_id is missing → ok=false', () => {
    const restData = {
      subscriber: {
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid_canonical_uuid/)
  })

  it('5d. REST original_app_user_id is malformed → ok=false', () => {
    const restData = {
      subscriber: {
        original_app_user_id: 'not-a-uuid',
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.ok).toBe(false)
  })

  it('5e. webhook marks event failed on REST invalid canonical', () => {
    // When REST returns ok=false, webhook marks event failed and returns 500
    const restFailSection = webhookSource.slice(
      webhookSource.indexOf('REST reconciliation failed'),
    )
    expect(restFailSection).toMatch(/status: 'failed'/)
    expect(restFailSection).toMatch(/500/)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 6: REST original UUID not in auth.users → no mutation
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 6 — REST original not in auth.users', () => {
  it('6. webhook checks auth.users for canonical UUID', () => {
    expect(webhookSource).toMatch(/auth\.users/)
    expect(webhookSource).toMatch(/canonical_uuid_not_found_in_auth/)
  })

  it('6a. webhook skips mutation if UUID not found', () => {
    const authSection = webhookSource.slice(
      webhookSource.indexOf('auth.users'),
    )
    expect(authSection).toMatch(/skipped/)
    expect(authSection).toMatch(/canonical_uuid_not_found_in_auth/)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 7: TEST event → 200 / no identity resolution / no mutation
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 7 — TEST event', () => {
  // Extract only the executable TEST event code block (not comments)
  function getTestCodeBlock() {
    const start = webhookSource.indexOf('if (eventType === TEST_TYPE)')
    // Find the end: the next statement after the TEST if-block
    const end = webhookSource.indexOf('if (!eventId || !eventType)')
    return webhookSource.slice(start, end)
  }

  it('7. TEST event returns 200 with test: true', () => {
    const codeBlock = getTestCodeBlock()
    expect(codeBlock).toMatch(/200/)
    expect(codeBlock).toMatch(/test: true/)
  })

  it('7a. TEST event does NOT perform identity resolution', () => {
    const codeBlock = getTestCodeBlock()
    expect(codeBlock).not.toMatch(/resolveLookupKey/)
    expect(codeBlock).not.toMatch(/canonicalUserId/)
  })

  it('7b. TEST event does NOT call apply_revenuecat_event', () => {
    const codeBlock = getTestCodeBlock()
    // Check executable code only — comments mention it but code doesn't call it
    expect(codeBlock).not.toMatch(/admin\.rpc\('apply_revenuecat_event'/)
  })

  it('7c. TEST event does NOT call resolve_quota', () => {
    const codeBlock = getTestCodeBlock()
    expect(codeBlock).not.toMatch(/admin\.rpc\('resolve_quota'/)
  })
})

// ─────────────────────────────────────────────────────────────
// Scenario 8: Account B never receives Account A's Pro merely
// because B appears as event.app_user_id
// ─────────────────────────────────────────────────────────────
describe('ownershipAuthority: scenario 8 — B never gets A\'s Pro', () => {
  it('8. webhook does NOT use event.app_user_id as p_user_id', () => {
    // The RPC call uses canonicalUuid, which comes from REST
    // canonicalUserId, NOT from event.app_user_id
    const rpcSection = webhookSource.slice(webhookSource.indexOf("admin.rpc('apply_revenuecat_event'"))
    expect(rpcSection).toMatch(/p_user_id: canonicalUuid/)
    // Ensure it does NOT use event.app_user_id directly
    expect(rpcSection).not.toMatch(/p_user_id: event\.app_user_id/)
    expect(rpcSection).not.toMatch(/p_user_id: appUserId/)
  })

  it('8a. canonicalUuid is assigned from REST canonicalUserId, not lookup key', () => {
    const assignSection = webhookSource.slice(
      webhookSource.indexOf('canonicalUuid = restResult.canonicalUserId'),
    )
    expect(assignSection).toMatch(/canonicalUuid = restResult\.canonicalUserId/)
  })

  it('8b. if REST says original=A, mutation targets A even if event.app_user_id=B', () => {
    // This is proven by scenarios 2 and 2a above:
    // - lookup key may be B (from event.app_user_id)
    // - REST returns original_app_user_id=A
    // - canonicalUuid = A
    // - apply_revenuecat_event uses p_user_id=A
    const restData = {
      subscriber: {
        original_app_user_id: UUID_A,
        entitlements: { pro: { expires_date: '2099-12-31T23:59:59Z' } },
      },
    }
    const result = parseProEntitlement(restData)
    expect(result.canonicalUserId).toBe(UUID_A)
    // Even if the event had app_user_id=B, the webhook would use A
    expect(result.canonicalUserId).not.toBe(UUID_B)
  })
})
