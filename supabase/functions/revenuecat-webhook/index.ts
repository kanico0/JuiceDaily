// ─────────────────────────────────────────────────────────────
// revenuecat-webhook — Receives RevenueCat subscription lifecycle
// events and updates the backend subscription record.
//
// Security: requires "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>".
//
// Idempotency + retry safety:
//   - Event IDs are recorded in revenuecat_webhook_events.
//   - On duplicate event ID:
//     * status 'processed'/'skipped' → acknowledge (already done)
//     * status 'pending'/'failed' → resume processing (crash recovery)
//   - A crash after inserting 'pending' never permanently strands a
//     paying customer as Free — the next RevenueCat retry resumes.
//
// Event ordering:
//   - Each event carries event_timestamp_ms.
//   - Subscription state is applied via apply_revenuecat_event() RPC
//     which atomically checks the incoming timestamp against the
//     last applied timestamp using SELECT ... FOR UPDATE.
//   - An older event arriving after a newer one is acknowledged but
//     does NOT overwrite subscription state.
//
// REST reconciliation:
//   RevenueCat recommends fetching current CustomerInfo after webhook
//   receipt. This requires a RevenueCat Server API Key (secret) that
//   is NOT currently configured. See report section 6.
//   REVENUECAT_SERVER_API_KEY HUMAN CONFIGURATION REQUIRED
//
// Secrets (Supabase function secrets):
//   REVENUECAT_WEBHOOK_SECRET
//   REVENUECAT_SERVER_API_KEY  (NOT YET CONFIGURED — see report)
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Valid RevenueCat webhook event types for Google Play ──────
// Reference: RevenueCat webhook documentation.
// We handle only documented event types. No invented types.
//
// EXPIRATION         — access ends (includes pause-expiration via
//                      expiration_reason = SUBSCRIPTION_PAUSED)
// INITIAL_PURCHASE   — first purchase, activates Pro
// RENEWAL            — period renewal, extends access
// CANCELLATION       — user cancelled, access continues until expiration
// UNCANCELLATION     — user uncancelled, renewal re-enabled
// BILLING_ISSUE      — payment problem, grace period until expiration
// PRODUCT_CHANGE     — plan upgrade/downgrade
// SUBSCRIPTION_PAUSED — scheduled pause, access continues through
//                       current paid period; loss occurs on EXPIRATION
// SUBSCRIPTION_EXTENDED — period extended (e.g. promotional)
// NON_RENEWING_PURCHASE — one-time purchase with entitlement
// TRANSFER           — NOT a normal lifecycle event; uses
//                      transferred_from[]/transferred_to[]

// Events that end Pro access immediately.
const DEACTIVATING_TYPES = new Set(['EXPIRATION'])
// Events that activate/extend access.
const ACTIVATING_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
])
// Events that keep access until expiration (grace/cancel-but-still-paid/paused).
// SUBSCRIPTION_PAUSED: user retains Pro through the current paid period.
//   Actual loss of entitlement occurs on EXPIRATION with
//   expiration_reason = SUBSCRIPTION_PAUSED.
const GRACE_TYPES = new Set(['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'])
// TRANSFER: special handling — not a normal lifecycle event.
const TRANSFER_TYPE = 'TRANSFER'

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
    expiration_reason: event.expiration_reason,
    cancellation_reason: event.cancellation_reason,
    auto_renew_status: event.auto_renew_status,
    grace_period_expires_at: event.grace_period_expires_at,
    transaction_id: event.transaction_id,
    original_transaction_id: event.original_transaction_id,
    transferred_from: event.transferred_from,
    transferred_to: event.transferred_to,
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

  // ── Idempotency + retry safety ─────────────────────────────
  // Try to insert the event as 'pending'. If the event ID already
  // exists, check its status:
  //   - 'processed'/'skipped' → already done, acknowledge duplicate
  //   - 'pending'/'failed' → previous attempt crashed or failed;
  //     RESUME processing (do not strand a paying customer as Free)
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
    if (insertError.code === '23505') {
      // Duplicate event ID — check existing status for retry safety.
      const { data: existingEvent } = await admin
        .from('revenuecat_webhook_events')
        .select('status')
        .eq('event_id', eventId)
        .maybeSingle()

      const existingStatus = existingEvent?.status
      if (existingStatus === 'processed' || existingStatus === 'skipped') {
        // Already fully handled. Acknowledge quietly.
        return json(200, { ok: true, duplicate: true })
      }
      // Status is 'pending' or 'failed' — previous attempt did not
      // complete. Fall through to resume processing.
      // Update detail with the latest event payload for diagnostics.
      await admin
        .from('revenuecat_webhook_events')
        .update({ detail: sanitizeEventForDetail(event), status: 'pending' })
        .eq('event_id', eventId)
    } else {
      console.error('[revenuecat-webhook] insert failed:', insertError.message)
      return json(500, { message: 'Event persistence failed' })
    }
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

  // ── TRANSFER handling ──────────────────────────────────────
  // TRANSFER is NOT a normal subscription lifecycle event. It uses
  // transferred_from[] and transferred_to[] arrays, not the standard
  // app_user_id/product_id/expiration_at_ms fields.
  //
  // RawLifeFlow's intended Restore Behavior is "Keep with original
  // App User ID" (human verification required). Under that policy,
  // transfers should not occur. If a TRANSFER event arrives:
  //   - Log it safely for diagnostics
  //   - Do NOT guess subscription state from the transfer payload
  //   - Mark as skipped (transfer not supported under current policy)
  //
  // If transfer behavior is later enabled, this handler must be
  // updated to reconcile BOTH source and destination users by
  // fetching current RevenueCat CustomerInfo for each affected ID.
  if (eventType === TRANSFER_TYPE) {
    const transferredFrom = event.transferred_from as string[] | undefined
    const transferredTo = event.transferred_to as string[] | undefined
    console.warn(
      '[revenuecat-webhook] TRANSFER event received — not supported under current Restore Behavior policy.',
      'from:',
      JSON.stringify(transferredFrom),
      'to:',
      JSON.stringify(transferredTo),
    )
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: 'transfer_not_supported' })
  }

  // ── REST reconciliation (NOT YET IMPLEMENTED) ──────────────
  // RevenueCat recommends fetching current CustomerInfo after webhook
  // receipt to make RevenueCat's state authoritative. This requires
  // a RevenueCat Server API Key (secret) that is NOT currently
  // configured in Supabase secrets.
  //
  // REVENUECAT_SERVER_API_KEY HUMAN CONFIGURATION REQUIRED
  //
  // When configured, the preferred flow would be:
  //   1. Authenticate webhook
  //   2. Idempotency/event log
  //   3. Determine affected UUID
  //   4. GET /v1/subscribers/{app_user_id} with Server API Key
  //   5. Inspect entitlement "pro" active status
  //   6. Atomically update subscriptions via apply_revenuecat_event()
  //   7. resolve_quota()
  //
  // Until then, we derive entitlement state from the event payload
  // using the documented event-type classification below.

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
  // Only documented RevenueCat event types are handled.
  const now = Date.now()
  let isActive: boolean
  let willRenew: boolean

  if (DEACTIVATING_TYPES.has(eventType)) {
    // EXPIRATION → access ends now.
    // (Includes pause-expiration: RevenueCat sends EXPIRATION with
    // expiration_reason = SUBSCRIPTION_PAUSED when the pause period
    // ends and the subscription is not resumed.)
    isActive = false
    willRenew = false
  } else if (GRACE_TYPES.has(eventType)) {
    // CANCELLATION → still paid until expiration, no renewal.
    // BILLING_ISSUE → grace period, keep access until expiration.
    // SUBSCRIPTION_PAUSED → user retains Pro through current paid
    //   period. Actual loss occurs on EXPIRATION with
    //   expiration_reason = SUBSCRIPTION_PAUSED.
    isActive = !expirationDate || expirationMs > now
    willRenew = eventType !== 'CANCELLATION'
  } else if (ACTIVATING_TYPES.has(eventType)) {
    // INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE,
    // NON_RENEWING_PURCHASE, SUBSCRIPTION_EXTENDED.
    isActive = !expirationDate || expirationMs > now
    willRenew = true
  } else {
    // Unknown event type: default to expiration-based check.
    // Do not deactivate — safer for the paying customer.
    isActive = !expirationDate || expirationMs > now
    willRenew = true
  }

  // ── Atomic subscription update ─────────────────────────────
  // apply_revenuecat_event() uses SELECT ... FOR UPDATE to prevent
  // race conditions. It only applies the update if the incoming
  // event timestamp is >= the last applied timestamp.
  const { data: applyResult, error: applyError } = await admin.rpc('apply_revenuecat_event', {
    p_user_id: appUserId,
    p_event_id: eventId,
    p_event_timestamp_ms: eventTimestampMs > 0 ? eventTimestampMs : null,
    p_is_active: isActive,
    p_store: store,
    p_plan: planFromProductId(productId),
    p_product_id: productId,
    p_original_transaction_id: (event.original_transaction_id as string) ?? null,
    p_purchase_date: purchaseDate,
    p_expiration_date: expirationDate,
    p_will_renew: willRenew,
    p_billing_issue_detected_at: eventType === 'BILLING_ISSUE' ? new Date().toISOString() : null,
    p_environment: environment,
  })

  if (applyError) {
    console.error('[revenuecat-webhook] apply_revenuecat_event failed:', applyError.message)
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'failed', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(500, { message: 'Subscription update failed' })
  }

  const applied = (applyResult as Record<string, unknown>)?.applied === true
  if (!applied) {
    // Stale event — older than the last applied event. Skip.
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: 'stale_event' })
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
