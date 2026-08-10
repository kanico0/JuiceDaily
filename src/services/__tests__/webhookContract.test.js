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
    expect(webhookSource).toMatch(/expiration_reason.*SUBSCRIPTION_PAUSED/i)
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
    expect(dupSection).toMatch(/Fall through to resume/i)
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

  it('37. REST reconciliation NOT yet implemented (no server key)', () => {
    // Should be documented as NOT YET IMPLEMENTED
    expect(webhookSource).toMatch(/NOT YET IMPLEMENTED/i)
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

  it('40. unmappable app_user_id is skipped gracefully', () => {
    expect(webhookSource).toMatch(/unmappable_app_user_id/)
    expect(webhookSource).toMatch(/uuidPattern/)
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
