// ─────────────────────────────────────────────────────────────
// revenuecat-webhook — Receives RevenueCat subscription lifecycle
// events and updates the backend subscription record.
//
// Security: requires "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>".
// Idempotency: event IDs are recorded in revenuecat_webhook_events;
// replays are acknowledged without reprocessing.
//
// Secrets (Supabase function secrets):
//   REVENUECAT_WEBHOOK_SECRET
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'

function json (status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Events that end Pro access when the entitlement is inactive.
const DEACTIVATING_TYPES = new Set(['EXPIRATION', 'CANCELLATION_REVOKED'])
// Events that activate/extend access.
const ACTIVATING_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
  'NON_RENEWING_PURCHASE',
])

function planFromProductId (productId: string | null): string | null {
  if (!productId) return null
  const id = productId.toLowerCase()
  if (id.includes('annual') || id.includes('year')) return 'pro_annual'
  return 'pro_monthly'
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
  const environment = String(event.environment ?? 'PRODUCTION').toLowerCase() === 'sandbox'
    ? 'sandbox'
    : 'production'

  if (!eventId || !eventType) return json(400, { message: 'Missing event id/type' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // ── Idempotency: record the event id first ─────────────────
  const { error: insertError } = await admin
    .from('revenuecat_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      app_user_id: appUserId,
      environment,
      payload: event,
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
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: 'unmappable_app_user_id' })
  }

  const productId = (event.product_id as string) ?? null
  const expirationMs = Number(event.expiration_at_ms ?? 0)
  const purchaseMs = Number(event.purchased_at_ms ?? 0)
  const expirationDate = expirationMs > 0 ? new Date(expirationMs).toISOString() : null
  const purchaseDate = purchaseMs > 0 ? new Date(purchaseMs).toISOString() : null
  const store = String(event.store ?? '').toUpperCase() === 'PLAY_STORE'
    ? 'play_store'
    : String(event.store ?? '').toUpperCase() === 'PROMOTIONAL'
      ? 'promotional'
      : 'app_store'

  // Access continues until actual expiration — CANCELLATION only
  // disables renewal; it does not deactivate the entitlement.
  const now = Date.now()
  let isActive: boolean
  if (ACTIVATING_TYPES.has(eventType)) {
    isActive = !expirationDate || expirationMs > now
  } else if (DEACTIVATING_TYPES.has(eventType)) {
    isActive = false
  } else if (eventType === 'CANCELLATION') {
    isActive = !expirationDate || expirationMs > now
  } else if (eventType === 'BILLING_ISSUE') {
    // Grace period: keep access until expiration.
    isActive = !expirationDate || expirationMs > now
  } else {
    isActive = !expirationDate || expirationMs > now
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
    will_renew: eventType !== 'CANCELLATION',
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
    return json(500, { message: 'Subscription update failed' })
  }

  // Sync the quota plan (resolve_quota refreshes limits; never
  // grants duplicate allowances on retries).
  const { error: quotaError } = await admin.rpc('resolve_quota', { p_user_id: appUserId })
  if (quotaError) console.error('[revenuecat-webhook] quota sync failed:', quotaError.message)

  await admin
    .from('revenuecat_webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('event_id', eventId)

  return json(200, { ok: true })
})
