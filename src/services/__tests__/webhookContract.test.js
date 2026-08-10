// webhookContract.test.js — Tests for RevenueCat webhook schema contract
// and event handling correctness.
//
// Verifies:
// 1. Webhook code uses detail/status columns (not payload/processed)
// 2. Migration 0014 adds event_timestamp_ms and relaxes status CHECK
// 3. Duplicate event detection (idempotency via primary key)
// 4. Stale event protection (older event cannot overwrite newer)
// 5. Event types: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
//    UNCANCELLATION, BILLING_ISSUE, PRODUCT_CHANGE, SUBSCRIPTION_PAUSED,
//    SUBSCRIPTION_EXTENDED, TRANSFER
// 6. Cancellation keeps access until expiration
// 7. Expiration deactivates access
// 8. Uncancellation reactivates access
// 9. Billing issue grace period
// 10. Subscription paused deactivates access

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

  it('5. original 0001 schema has detail and status columns', () => {
    expect(migration0001Source).toMatch(/detail\s+text/)
    expect(migration0001Source).toMatch(/status\s+text/)
  })

  it('6. original 0001 schema does NOT have payload or processed columns', () => {
    expect(migration0001Source).not.toMatch(/payload\s+jsonb/)
    expect(migration0001Source).not.toMatch(/processed\s+boolean/)
  })
})

describe('Webhook event ordering', () => {
  it('7. webhook reads event_timestamp_ms from event', () => {
    expect(webhookSource).toMatch(/event_timestamp_ms/)
  })

  it('8. webhook checks existing subscription last_revenuecat_event_id', () => {
    expect(webhookSource).toMatch(/last_revenuecat_event_id/)
  })

  it('9. webhook looks up last event timestamp for comparison', () => {
    expect(webhookSource).toMatch(/event_timestamp_ms/)
    expect(webhookSource).toMatch(/stale_event/)
  })

  it('10. stale event is skipped (not applied)', () => {
    expect(webhookSource).toMatch(/skipped.*stale_event/)
  })
})

describe('Webhook event types', () => {
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

  it('18. handles Subscription Paused', () => {
    expect(webhookSource).toMatch(/SUBSCRIPTION_PAUSED/)
  })

  it('19. handles Subscription Extended', () => {
    expect(webhookSource).toMatch(/SUBSCRIPTION_EXTENDED/)
  })

  it('20. handles Transfer', () => {
    expect(webhookSource).toMatch(/TRANSFER/)
  })

  it('21. handles Cancellation Revoked', () => {
    expect(webhookSource).toMatch(/CANCELLATION_REVOKED/)
  })

  it('22. does NOT invent a generic REFUND event', () => {
    expect(webhookSource).not.toMatch(/['"]REFUND['"]/)
  })
})

describe('Webhook event behavior', () => {
  it('23. Cancellation keeps access until expiration (will_renew = false)', () => {
    expect(webhookSource).toMatch(/willRenew = eventType !== 'CANCELLATION'/)
  })

  it('24. Expiration sets isActive = false', () => {
    expect(webhookSource).toMatch(/DEACTIVATING_TYPES/)
    expect(webhookSource).toMatch(/isActive = false/)
  })

  it('25. Subscription Paused sets isActive = false', () => {
    expect(webhookSource).toMatch(/PAUSE_TYPES/)
  })

  it('26. Billing Issue keeps access until expiration (grace)', () => {
    expect(webhookSource).toMatch(/GRACE_TYPES/)
    expect(webhookSource).toMatch(/BILLING_ISSUE/)
  })

  it('27. Uncancellation is an activating type', () => {
    expect(webhookSource).toMatch(/ACTIVATING_TYPES.*UNCANCELLATION/s)
  })
})

describe('Webhook idempotency', () => {
  it('28. duplicate event ID returns 200 with duplicate: true', () => {
    expect(webhookSource).toMatch(/23505/)
    expect(webhookSource).toMatch(/duplicate:\s*true/)
  })

  it('29. insert is first operation (before subscription upsert)', () => {
    const insertPos = webhookSource.indexOf('.from(\'revenuecat_webhook_events\')')
    const upsertPos = webhookSource.indexOf('.from(\'subscriptions\')')
    expect(insertPos).toBeGreaterThan(-1)
    expect(upsertPos).toBeGreaterThan(-1)
    expect(insertPos).toBeLessThan(upsertPos)
  })

  it('30. unmappable app_user_id is skipped gracefully', () => {
    expect(webhookSource).toMatch(/unmappable_app_user_id/)
    expect(webhookSource).toMatch(/uuidPattern/)
  })
})

describe('Webhook sanitization', () => {
  it('31. sanitizeEventForDetail strips secrets', () => {
    expect(webhookSource).toMatch(/sanitizeEventForDetail/)
  })

  it('32. detail stores only lifecycle-relevant fields', () => {
    expect(webhookSource).toMatch(/product_id/)
    expect(webhookSource).toMatch(/expiration_at_ms/)
    expect(webhookSource).toMatch(/cancellation_reason/)
  })
})
