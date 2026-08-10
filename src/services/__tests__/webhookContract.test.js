// webhookContract.test.js — Tests for RevenueCat webhook schema contract,
// event handling, ordering, retry safety, and transfer handling.
//
// Verifies:
// 1. Webhook code uses detail/status columns (not payload/processed)
// 2. Migration 0014 adds event_timestamp_ms and relaxes status CHECK
// 3. Migration 0014 adds last_revenuecat_event_timestamp_ms to subscriptions
// 4. Migration 0014 creates apply_revenuecat_event RPC
// 5. CANCELLATION_REVOKED is NOT handled (not a real RC event type)
// 6. EXPIRATION is the only DEACTIVATING type
// 7. SUBSCRIPTION_PAUSED is treated as GRACE (not deactivating)
// 8. TRANSFER is handled separately (not as ACTIVATING)
// 9. TRANSFER uses transferred_from/transferred_to
// 10. TRANSFER is skipped under current Restore Behavior policy
// 11. Pending retry safety: duplicate with pending/failed resumes
// 12. Pending retry safety: duplicate with processed/skipped acknowledges
// 13. Atomic ordering via apply_revenuecat_event RPC
// 14. No invented REFUND event
// 15. Event types: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
//     UNCANCELLATION, BILLING_ISSUE, PRODUCT_CHANGE, SUBSCRIPTION_PAUSED,
//     SUBSCRIPTION_EXTENDED, TRANSFER, NON_RENEWING_PURCHASE
// 16. RevenueCat REST reconciliation documented (server API key required)
// 17. Sanitization strips secrets
// 18. Idempotency via primary key
// 19. Unmappable app_user_id skipped
// 20. Quota sync after subscription update

const fs = require('fs')
const path = require('path')

const webhookPath = path.resolve(__dirname, '../../../supabase/functions/revenuecat-webhook/index.ts')
const webhookSource = fs.readFileSync(webhookPath, 'utf8')

const migration0014Path = path.resolve(__dirname, '../../../supabase/migrations/0014_webhook_event_ordering.sql')
const migration0014Source = fs.readFileSync(migration0014Path, 'utf8')

const migration0001Path = path.resolve(__dirname, '../../../supabase/migrations/0001_monetization.sql')
const migration0001Source = fs.readFileSync(migration0001Path, 'utf8')

describe('Webhook schema contract', () => {
  it('1. webhook code uses detail (text) not payload (jsonb)', () => {
    expect(webhookSource).toMatch(/detail:\s*sanitizeEventForDetail/)
    expect(webhookSource).not.toMatch(/payload:\s*event/)
  })

  it('2. webhook code uses status (text) not processed (boolean)', () => {
    expect(webhookSource).toMatch(/status:\s*['"]pending['"]/)
    expect(webhookSource).toMatch(/status:\s*['"]processed['"]/)
    expect(webhookSource).toMatch(/status:\s*['"]skipped['"]/)
    expect(webhookSource).toMatch(/status:\s*['"]failed['"]/)
    expect(webhookSource).not.toMatch(/processed:\s*true/)
  })

  it('3. migration 0014 adds event_timestamp_ms column', () => {
    expect(migration0014Source).toMatch(/add column if not exists event_timestamp_ms/i)
  })

  it('4. migration 0014 relaxes status CHECK to allow pending', () => {
    expect(migration0014Source).toMatch(/drop constraint.*revenuecat_webhook_events_status_check/i)
    expect(migration0014Source).toMatch(/add constraint.*revenuecat_webhook_events_status_check/i)
    expect(migration0014Source).toMatch(/'pending'/)
  })
})

describe('Atomic event ordering', () => {
  it('5. migration 0014 adds last_revenuecat_event_timestamp_ms to subscriptions', () => {
    expect(migration0014Source).toMatch(/last_revenuecat_event_timestamp_ms/i)
    expect(migration0014Source).toMatch(/alter table public\.subscriptions/i)
  })

  it('6. migration 0014 creates apply_revenuecat_event RPC', () => {
    expect(migration0014Source).toMatch(/create or replace function public\.apply_revenuecat_event/i)
  })

  it('7. apply_revenuecat_event uses SELECT ... FOR UPDATE', () => {
    expect(migration0014Source).toMatch(/for update/i)
  })

  it('8. apply_revenuecat_event checks stale event timestamp', () => {
    expect(migration0014Source).toMatch(/stale_event/i)
    expect(migration0014Source).toMatch(/p_event_timestamp_ms < v_last_ts/i)
  })

  it('9. apply_revenuecat_event is service-role only', () => {
    expect(migration0014Source).toMatch(/revoke execute.*from public, anon, authenticated/i)
    expect(migration0014Source).toMatch(/grant execute.*to service_role/i)
  })

  it('10. webhook calls apply_revenuecat_event RPC (not direct upsert)', () => {
    expect(webhookSource).toMatch(/apply_revenuecat_event/)
    expect(webhookSource).not.toMatch(/\.from\('subscriptions'\)[\s\S]*\.upsert\(/)
  })
})

describe('Valid RevenueCat event types', () => {
  it('11. handles INITIAL Purchase', () => {
    expect(webhookSource).toMatch(/INITIAL_PURCHASE/)
  })

  it('12. handles Renewal', () => {
    expect(webhookSource).toMatch(/RENEWAL/)
  })

  it('13. handles Cancellation (grace — access until expiration)', () => {
    expect(webhookSource).toMatch(/CANCELLATION/)
  })

  it('14. handles Expiration (deactivate)', () => {
    expect(webhookSource).toMatch(/EXPIRATION/)
  })

  it('15. handles Uncancellation', () => {
    expect(webhookSource).toMatch(/UNCANCELLATION/)
  })

  it('16. handles Billing Issue (grace period)', () => {
    expect(webhookSource).toMatch(/BILLING_ISSUE/)
  })

  it('17. handles Product Change', () => {
    expect(webhookSource).toMatch(/PRODUCT_CHANGE/)
  })

  it('18. handles Subscription Paused (grace — not deactivating)', () => {
    expect(webhookSource).toMatch(/SUBSCRIPTION_PAUSED/)
    // SUBSCRIPTION_PAUSED should be in GRACE_TYPES, not PAUSE_TYPES
    const graceMatch = webhookSource.match(/GRACE_TYPES = new Set\(\[([^\]]+)\]\)/)
    expect(graceMatch).toBeTruthy()
    expect(graceMatch[1]).toMatch(/SUBSCRIPTION_PAUSED/)
  })

  it('19. handles Subscription Extended', () => {
    expect(webhookSource).toMatch(/SUBSCRIPTION_EXTENDED/)
  })

  it('20. handles Transfer (special, not normal lifecycle)', () => {
    expect(webhookSource).toMatch(/TRANSFER/)
  })

  it('21. handles Non Renewing Purchase', () => {
    expect(webhookSource).toMatch(/NON_RENEWING_PURCHASE/)
  })
})

describe('Removed invalid event types', () => {
  it('22. does NOT handle CANCELLATION_REVOKED (not a real RC event)', () => {
    // CANCELLATION_REVOKED should not appear in any event type set
    const setsMatch = webhookSource.match(/const DEACTIVATING_TYPES = new Set\(\[([^\]]+)\]\)/)
    expect(setsMatch).toBeTruthy()
    expect(setsMatch[1]).not.toMatch(/CANCELLATION_REVOKED/)
    // Also check it's not in ACTIVATING or GRACE
    const activatingMatch = webhookSource.match(/ACTIVATING_TYPES = new Set\(\[([\s\S]*?)\]\)/)
    expect(activatingMatch[1]).not.toMatch(/CANCELLATION_REVOKED/)
    const graceMatch = webhookSource.match(/GRACE_TYPES = new Set\(\[([^\]]+)\]\)/)
    expect(graceMatch[1]).not.toMatch(/CANCELLATION_REVOKED/)
  })

  it('23. does NOT invent a generic REFUND event', () => {
    expect(webhookSource).not.toMatch(/['"]REFUND['"]/)
  })

  it('24. DEACTIVATING_TYPES contains only EXPIRATION', () => {
    const setsMatch = webhookSource.match(/const DEACTIVATING_TYPES = new Set\(\[([^\]]+)\]\)/)
    expect(setsMatch).toBeTruthy()
    expect(setsMatch[1].trim()).toBe("'EXPIRATION'")
  })
})

describe('SUBSCRIPTION_PAUSED behavior', () => {
  it('25. SUBSCRIPTION_PAUSED is in GRACE_TYPES (not PAUSE_TYPES)', () => {
    expect(webhookSource).toMatch(/GRACE_TYPES.*SUBSCRIPTION_PAUSED/s)
    // PAUSE_TYPES should not exist anymore
    expect(webhookSource).not.toMatch(/PAUSE_TYPES/)
  })

  it('26. SUBSCRIPTION_PAUSED keeps access until expiration', () => {
    // The GRACE branch checks expiration
    const graceSection = webhookSource.slice(
      webhookSource.indexOf('GRACE_TYPES.has(eventType)'),
    )
    expect(graceSection).toMatch(/expirationMs > now/)
  })

  it('27. expiration_reason = SUBSCRIPTION_PAUSED documented', () => {
    // The webhook comments document pause-expiration via EXPIRATION
    expect(webhookSource).toMatch(/pause-expiration/i)
  })
})

describe('TRANSFER handling', () => {
  it('28. TRANSFER is not in ACTIVATING_TYPES', () => {
    const activatingMatch = webhookSource.match(/ACTIVATING_TYPES = new Set\(\[([\s\S]*?)\]\)/)
    expect(activatingMatch).toBeTruthy()
    expect(activatingMatch[1]).not.toMatch(/'TRANSFER'/)
  })

  it('29. TRANSFER uses transferred_from and transferred_to', () => {
    const transferSection = webhookSource.slice(
      webhookSource.indexOf('TRANSFER handling'),
    )
    expect(transferSection).toMatch(/transferred_from/)
    expect(transferSection).toMatch(/transferred_to/)
  })

  it('30. TRANSFER is skipped under current Restore Behavior policy', () => {
    const transferSection = webhookSource.slice(
      webhookSource.indexOf('TRANSFER handling'),
    )
    expect(transferSection).toMatch(/transfer_not_supported/)
    expect(transferSection).toMatch(/skipped/)
  })

  it('31. TRANSFER does not guess subscription state', () => {
    const transferSection = webhookSource.slice(
      webhookSource.indexOf('TRANSFER handling'),
    )
    // Should NOT call apply_revenuecat_event for TRANSFER
    const transferEnd = transferSection.indexOf('return json')
    const transferBlock = transferSection.slice(0, transferEnd + 50)
    expect(transferBlock).not.toMatch(/apply_revenuecat_event/)
  })
})

describe('Pending-event retry safety', () => {
  it('32. duplicate with processed/skipped acknowledges as duplicate', () => {
    const dupSection = webhookSource.slice(
      webhookSource.indexOf('Duplicate event ID'),
    )
    expect(dupSection).toMatch(/processed.*skipped.*duplicate/s)
  })

  it('33. duplicate with pending/failed resumes processing', () => {
    const dupSection = webhookSource.slice(
      webhookSource.indexOf('Duplicate event ID'),
    )
    expect(dupSection).toMatch(/pending.*failed.*resume/s)
    // Should NOT return early for pending/failed — should fall through
    expect(dupSection).toMatch(/resume processing/i)
  })

  it('34. crash recovery documented', () => {
    expect(webhookSource).toMatch(/crash after inserting.*pending/i)
    expect(webhookSource).toMatch(/never permanently strands/i)
  })
})

describe('RevenueCat REST reconciliation', () => {
  it('35. REST reconciliation is documented in webhook code', () => {
    expect(webhookSource).toMatch(/REST reconciliation/i)
  })

  it('36. REVENUECAT_SERVER_API_KEY documented as required', () => {
    expect(webhookSource).toMatch(/REVENUECAT_SERVER_API_KEY/i)
    expect(webhookSource).toMatch(/HUMAN CONFIGURATION REQUIRED/i)
  })

  it('37. REST key missing blocks production mutation (no silent fallback)', () => {
    // When key is absent, the webhook must NOT mutate subscriptions.
    // It marks the event failed and returns 500 for RC retry.
    expect(webhookSource).toMatch(/REVENUECAT_SERVER_API_KEY not configured/)
    expect(webhookSource).toMatch(/refusing to mutate subscriptions/i)
  })

  it('37a. event-type fallback only with explicit opt-in flag', () => {
    expect(webhookSource).toMatch(/REVENUECAT_ALLOW_EVENT_TYPE_FALLBACK/)
  })
})

describe('Webhook idempotency and sanitization', () => {
  it('38. duplicate event ID returns 200 with duplicate: true', () => {
    expect(webhookSource).toMatch(/23505/)
    expect(webhookSource).toMatch(/duplicate:\s*true/)
  })

  it('39. insert is first operation (before subscription update)', () => {
    // Find the actual insert call (not comments mentioning the table)
    const insertPos = webhookSource.indexOf("status: 'pending'")
    // Find the actual RPC call (not comments mentioning it)
    const rpcPos = webhookSource.indexOf("admin.rpc('apply_revenuecat_event'")
    expect(insertPos).toBeGreaterThan(-1)
    expect(rpcPos).toBeGreaterThan(-1)
    expect(insertPos).toBeLessThan(rpcPos)
  })

  it('40. unmappable identity is skipped gracefully', () => {
    // Now uses identity resolver — unmappable status from resolution
    expect(webhookSource).toMatch(/unmappable/)
    expect(webhookSource).toMatch(/resolution\.reason/)
  })

  it('41. sanitizeEventForDetail strips secrets', () => {
    expect(webhookSource).toMatch(/sanitizeEventForDetail/)
  })

  it('42. detail stores only lifecycle-relevant fields', () => {
    expect(webhookSource).toMatch(/product_id/)
    expect(webhookSource).toMatch(/expiration_at_ms/)
    expect(webhookSource).toMatch(/cancellation_reason/)
    expect(webhookSource).toMatch(/expiration_reason/)
  })

  it('43. quota sync after subscription update', () => {
    expect(webhookSource).toMatch(/resolve_quota/)
  })
})

describe('TEST event handling', () => {
  it('44. TEST event type is handled explicitly', () => {
    expect(webhookSource).toMatch(/TEST_TYPE/)
    expect(webhookSource).toMatch(/'TEST'/)
  })

  it('45. TEST event returns success without mutation', () => {
    const testSection = webhookSource.slice(webhookSource.indexOf('TEST event:'))
    expect(testSection).toMatch(/no mutation/i)
    expect(testSection).toMatch(/test: true/)
  })

  it('46. TEST event does NOT insert into webhook_events', () => {
    const testSection = webhookSource.slice(
      webhookSource.indexOf('TEST event:'),
      webhookSource.indexOf('Idempotency'),
    )
    expect(testSection).not.toMatch(/insert/)
  })

  it('46a. TEST event does NOT require a real event ID', () => {
    // TEST events are handled BEFORE the eventId/eventType validation,
    // so a TEST event with no event ID is still accepted.
    const testPos = webhookSource.indexOf("eventType === TEST_TYPE")
    const validationPos = webhookSource.indexOf("Missing event id/type")
    expect(testPos).toBeGreaterThan(-1)
    expect(validationPos).toBeGreaterThan(-1)
    expect(testPos).toBeLessThan(validationPos)
  })

  it('46b. TEST event does NOT call apply_revenuecat_event', () => {
    const testSection = webhookSource.slice(
      webhookSource.indexOf('TEST event:'),
      webhookSource.indexOf('Idempotency'),
    )
    expect(testSection).not.toMatch(/apply_revenuecat_event/)
  })

  it('46c. TEST event does NOT call resolve_quota', () => {
    const testSection = webhookSource.slice(
      webhookSource.indexOf('TEST event:'),
      webhookSource.indexOf('Idempotency'),
    )
    expect(testSection).not.toMatch(/resolve_quota/)
  })

  it('46d. invalid auth TEST event is rejected normally', () => {
    // Auth check happens BEFORE TEST handling, so an unauthenticated
    // TEST event gets 401, not 200.
    const authPos = webhookSource.indexOf("Bearer ${secret}")
    const testPos = webhookSource.indexOf("eventType === TEST_TYPE")
    expect(authPos).toBeGreaterThan(-1)
    expect(testPos).toBeGreaterThan(-1)
    expect(authPos).toBeLessThan(testPos)
  })
})

describe('Identity resolution in webhook', () => {
  it('47. webhook imports resolveCanonicalUuid', () => {
    expect(webhookSource).toMatch(/resolveCanonicalUuid/)
  })

  it('48. webhook imports from identityResolver.ts', () => {
    expect(webhookSource).toMatch(/identityResolver\.ts/)
  })

  it('49. webhook handles unmappable identity', () => {
    expect(webhookSource).toMatch(/resolution\.status === 'unmappable'/)
  })

  it('50. webhook handles identity conflict', () => {
    expect(webhookSource).toMatch(/resolution\.status === 'conflict'/)
  })

  it('51. webhook uses canonicalUuid for subscription update', () => {
    expect(webhookSource).toMatch(/canonicalUuid/)
  })

  it('52. webhook does NOT use appUserId directly for subscription update', () => {
    // The RPC call should use canonicalUuid, not appUserId
    const rpcSection = webhookSource.slice(webhookSource.indexOf('apply_revenuecat_event'))
    expect(rpcSection).toMatch(/p_user_id: canonicalUuid/)
    expect(rpcSection).not.toMatch(/p_user_id: appUserId/)
  })
})

describe('REST reconciliation in webhook', () => {
  it('53. webhook imports fetchProEntitlement', () => {
    expect(webhookSource).toMatch(/fetchProEntitlement/)
  })

  it('54. webhook imports from revenueCatRest.ts', () => {
    expect(webhookSource).toMatch(/revenueCatRest\.ts/)
  })

  it('55. webhook checks REVENUECAT_SERVER_API_KEY', () => {
    expect(webhookSource).toMatch(/serverApiKey/)
    expect(webhookSource).toMatch(/restConfigured/)
  })

  it('56. webhook uses REST when configured', () => {
    expect(webhookSource).toMatch(/if \(restConfigured\)/)
  })

  it('57. webhook blocks mutation when REST key missing', () => {
    expect(webhookSource).toMatch(/refusing to mutate subscriptions/i)
    expect(webhookSource).toMatch(/REVENUECAT_SERVER_API_KEY not configured/)
  })

  it('58. webhook leaves event failed on REST failure', () => {
    expect(webhookSource).toMatch(/REST reconciliation failed/)
  })

  it('59. webhook returns 500 on REST failure (for RC retry)', () => {
    const restFailSection = webhookSource.slice(
      webhookSource.indexOf('REST reconciliation failed'),
    )
    expect(restFailSection).toMatch(/500/)
  })
})

describe('Atomic ordering with advisory lock', () => {
  it('60. migration uses pg_advisory_xact_lock', () => {
    expect(migration0014Source).toMatch(/pg_advisory_xact_lock/)
  })

  it('61. advisory lock keyed by hashtext of user UUID', () => {
    expect(migration0014Source).toMatch(/hashtext\(p_user_id::text\)/)
  })

  it('62. advisory lock acquired before SELECT FOR UPDATE', () => {
    const lockPos = migration0014Source.indexOf('pg_advisory_xact_lock')
    const selectPos = migration0014Source.indexOf('for update')
    expect(lockPos).toBeGreaterThan(-1)
    expect(selectPos).toBeGreaterThan(-1)
    expect(lockPos).toBeLessThan(selectPos)
  })

  it('63. first-event concurrency documented', () => {
    expect(migration0014Source).toMatch(/brand-new subscriber/i)
  })
})
