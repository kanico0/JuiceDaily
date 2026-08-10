// ─────────────────────────────────────────────────────────────
// revenuecat-webhook — Receives RevenueCat subscription lifecycle
// events and updates the backend subscription record.
//
// Security: requires "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>".
// Idempotency: event IDs are recorded in revenuecat_webhook_events;
// replays are acknowledged without reprocessing.
//
// Event ordering: each event carries event_timestamp_ms. Before
// upserting a subscription row, we check the existing row's
// last_revenuecat_event_id and the stored event timestamp. An older
// event arriving after a newer one is acknowledged but does NOT
// overwrite the subscription state.
//
// Secrets (Supabase function secrets):
//   REVENUECAT_WEBHOOK_SECRET
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Events that end Pro access.
const DEACTIVATING_TYPES = new Set(['EXPIRATION', 'CANCELLATION_REVOKED'])
// Events that activate/extend access.
const ACTIVATING_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
])
// Events that keep access until expiration (grace/cancel-but-still-paid).
const GRACE_TYPES = new Set(['CANCELLATION', 'BILLING_ISSUE'])
// Paused: access suspended during pause period.
const PAUSE_TYPES = new Set(['SUBSCRIPTION_PAUSED'])

function planFromProductId(productId: string | null): string | null {
  if (!productId) return null
  const id = productId.toLowerCase()
  if (id.includes('annual') || id.includes('year')) return 'pro_annual'
  return 'pro_monthly'
}

// Sanitize the event for diagnostic storage — strip any fields that
// could contain secrets or PII. Keep only lifecycle-relevant metadata.
function sanitizeEventForDetail(event: Record<string, unknown>): string {
  const safe: Record<string, unknown> = {
    type: event.type,
    store: event.store,
    product_id: event.product_id,
    entitlement_ids: event.entitlement_ids,
    period_type: event.period_type,
    purchased_at_ms: event.purchased_at_ms,
    expiration_at_ms: event.expiration_at_ms,
    expiration_date: event.expiration_date,
    cancellation_reason: event.cancellation_reason,
    auto_renew_status: event.auto_renew_status,
    grace_period_expires_at: event.grace_period_expires_at,
    transaction_id: event.transaction_id,
    original_transaction_id: event.original_transaction_id,
  }
  return JSON.stringify(safe)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' })

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
  if (!secret) return json(500, { message: 'Server not configured' })

  // ── Authenticate the webhook ───────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return json(401, { message: 'Unauthorized' })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { message: 'Invalid JSON' })
  }

  const event = (body.event ?? {}) as Record<string, unknown>
  const eventId = String(event.id ?? '')
  const eventType = String(event.type ?? '')
  const appUserId = String(event.app_user_id ?? '')
  const environment =
    String(event.environment ?? 'PRODUCTION').toLowerCase() === 'sandbox' ? 'sandbox' : 'production'
  const eventTimestampMs = Number(event.event_timestamp_ms ?? 0)

  if (!eventId || !eventType) return json(400, { message: 'Missing event id/type' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // ── Idempotency: insert as 'pending' first ─────────────────
  const { error: insertError } = await admin.from('revenuecat_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    app_user_id: appUserId,
    environment,
    event_timestamp_ms: eventTimestampMs > 0 ? eventTimestampMs : null,
    status: 'pending',
    detail: sanitizeEventForDetail(event),
  })

  if (insertError) {
    // Duplicate primary key → already processed. Acknowledge quietly.
    if (insertError.code === '23505') return json(200, { ok: true, duplicate: true })
    console.error('[revenuecat-webhook] insert failed:', insertError.message)
    return json(500, { message: 'Event persistence failed' })
  }

  // ── Map to the internal user ───────────────────────────────
  // The App User ID is the Supabase auth user UUID.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(appUserId)) {
    // Anonymous RevenueCat IDs ($RCAnonymousID:...) cannot be mapped.
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: 'unmappable_app_user_id' })
  }

  // ── Stale-event protection ─────────────────────────────────
  // If the existing subscription row has a newer event timestamp,
  // this event is stale and must NOT overwrite current state.
  if (eventTimestampMs > 0) {
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('last_revenuecat_event_id, updated_at')
      .eq('user_id', appUserId)
      .maybeSingle()

    if (existingSub?.last_revenuecat_event_id) {
      // Look up the timestamp of the event that last updated the sub.
      const { data: lastEvent } = await admin
        .from('revenuecat_webhook_events')
        .select('event_timestamp_ms')
        .eq('event_id', existingSub.last_revenuecat_event_id)
        .maybeSingle()

      const lastEventTs = lastEvent?.event_timestamp_ms
      if (lastEventTs && Number(lastEventTs) > eventTimestampMs) {
        // This event is older than the last applied event. Skip.
        await admin
          .from('revenuecat_webhook_events')
          .update({ status: 'skipped', processed_at: new Date().toISOString() })
          .eq('event_id', eventId)
        return json(200, { ok: true, skipped: 'stale_event' })
      }
    }
  }

  const productId = (event.product_id as string) ?? null
  const expirationMs = Number(event.expiration_at_ms ?? 0)
  const purchaseMs = Number(event.purchased_at_ms ?? 0)
  const expirationDate = expirationMs > 0 ? new Date(expirationMs).toISOString() : null
  const purchaseDate = purchaseMs > 0 ? new Date(purchaseMs).toISOString() : null
  const store =
    String(event.store ?? '').toUpperCase() === 'PLAY_STORE'
      ? 'play_store'
      : String(event.store ?? '').toUpperCase() === 'PROMOTIONAL'
        ? 'promotional'
        : 'app_store'

  // ── Determine active status by event type ──────────────────
  const now = Date.now()
  let isActive: boolean
  let willRenew: boolean

  if (DEACTIVATING_TYPES.has(eventType)) {
    // EXPIRATION, CANCELLATION_REVOKED → access ends now.
    isActive = false
    willRenew = false
  } else if (PAUSE_TYPES.has(eventType)) {
    // SUBSCRIPTION_PAUSED → access suspended during pause.
    isActive = false
    willRenew = false
  } else if (GRACE_TYPES.has(eventType)) {
    // CANCELLATION → still paid until expiration, no renewal.
    // BILLING_ISSUE → grace period, keep access until expiration.
    isActive = !expirationDate || expirationMs > now
    willRenew = eventType !== 'CANCELLATION'
  } else if (ACTIVATING_TYPES.has(eventType)) {
    // INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, etc.
    isActive = !expirationDate || expirationMs > now
    willRenew = true
  } else {
    // Unknown event type: default to expiration-based check.
    isActive = !expirationDate || expirationMs > now
    willRenew = true
  }

  const record = {
    user_id: appUserId,
    entitlement: 'pro',
    is_active: isActive,
    store,
    plan: planFromProductId(productId),
    product_id: productId,
    original_transaction_id: (event.original_transaction_id as string) ?? null,
    purchase_date: purchaseDate,
    expiration_date: expirationDate,
    will_renew: willRenew,
    billing_issue_detected_at: eventType === 'BILLING_ISSUE' ? new Date().toISOString() : null,
    environment,
    last_revenuecat_event_id: eventId,
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await admin
    .from('subscriptions')
    .upsert(record, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('[revenuecat-webhook] upsert failed:', upsertError.message)
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(500, { message: 'Subscription update failed' })
  }

  // Sync the quota plan (resolve_quota refreshes limits; never
  // grants duplicate allowances on retries).
  const { error: quotaError } = await admin.rpc('resolve_quota', { p_user_id: appUserId })
  if (quotaError) console.error('[revenuecat-webhook] quota sync failed:', quotaError.message)

  await admin
    .from('revenuecat_webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId)

  return json(200, { ok: true })
})
