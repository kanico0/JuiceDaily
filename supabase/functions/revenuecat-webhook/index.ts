// ─────────────────────────────────────────────────────────────
// revenuecat-webhook — Receives RevenueCat subscription lifecycle
// events and updates the backend subscription record.
//
// Security: requires "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>".
//
// Identity ownership architecture:
//   Event fields (app_user_id, original_app_user_id, aliases[]) are
//   ONLY used as lookup keys for the RevenueCat REST API. They are
//   NOT the canonical RawLifeFlow subscription owner.
//
//   The canonical UUID is established from:
//     subscriber.original_app_user_id
//   in the REST CustomerInfo response. This is the FIRST App User ID
//   used by that customer and is the stable subscription ownership
//   authority.
//
//   event.app_user_id is the LAST-SEEN App User ID and is NOT stable
//   enough for subscription ownership. Account B must never receive
//   Account A's Pro merely because B appears as event.app_user_id.
//
// Flow:
//   1. Authenticate webhook
//   2. Idempotency / retry safety
//   3. Extract lookup key from event (any valid UUID)
//   4. Fetch RevenueCat CustomerInfo via REST
//   5. Extract canonical UUID from subscriber.original_app_user_id
//   6. Validate canonical UUID (valid, not anonymous, not email,
//      exists in auth.users)
//   7. Use canonical UUID for apply_revenuecat_event + resolve_quota
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
//   - apply_revenuecat_event() uses pg_advisory_xact_lock(hashtext(uuid))
//     to serialize concurrent invocations for the same user, including
//     the brand-new subscriber case.
//   - An older event arriving after a newer one is acknowledged but
//     does NOT overwrite subscription state.
//
// REST reconciliation (required for production mutation):
//   RevenueCat current CustomerInfo is the production authority for
//   BOTH identity (original_app_user_id) and entitlement state.
//   When REVENUECAT_SERVER_API_KEY is set, the webhook fetches current
//   CustomerInfo and uses subscriber.original_app_user_id as the
//   canonical UUID and the "pro" entitlement as authoritative state.
//   When the key is absent AND the event requires subscription mutation,
//   the webhook does NOT mutate subscriptions, marks the event as
//   failed (configuration failure), and returns non-2xx so RevenueCat
//   can retry after configuration is corrected.
//   Event-type classification fallback is for local/unit-test fixtures
//   only — never silently used in production.
//
//   REVENUECAT_SERVER_API_KEY HUMAN CONFIGURATION REQUIRED
//
// TEST event handling:
//   RevenueCat TEST webhooks are authenticated normally, acknowledged
//   with success, and do NOT mutate any subscription. Used for
//   dashboard connectivity verification. No identity resolution occurs.
//
// Sandbox environment boundary:
//   event.environment ('SANDBOX' | 'PRODUCTION') is set by RevenueCat
//   from the underlying store purchase, not by the mobile client.
//   RevenueCat delivers both sandbox and production events to the
//   SAME webhook URL by default. SANDBOX events are skipped (never
//   mutate subscriptions.is_active) UNLESS either:
//     a) the server-only secret REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT=1
//        is explicitly set — must never be set on the production
//        project, or
//     b) the event's CANONICAL identity (resolved via RevenueCat
//        REST subscriber.original_app_user_id, then validated to
//        exist in auth.users — never the raw, unvalidated webhook
//        event.app_user_id) is present in the server-only
//        REVENUECAT_SANDBOX_REVIEWER_UUIDS allowlist. This lets a
//        small number of pre-provisioned App Review / QA reviewer
//        accounts receive real Pro entitlement from a sandbox
//        purchase so reviewers can validate the subscription
//        experience end-to-end, without opening sandbox entitlement
//        to arbitrary users. The allowlist decision is made only
//        AFTER the same REST reconciliation, auth.users validation,
//        idempotency, and event-ordering guarantees used for
//        production events.
//
// Secrets (Supabase function secrets):
//   REVENUECAT_WEBHOOK_SECRET
//   REVENUECAT_SERVER_API_KEY  (required for REST reconciliation)
//   REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT  (must be unset/0 in production)
//   REVENUECAT_SANDBOX_REVIEWER_UUIDS  (comma-separated auth.users UUIDs;
//     optional — a small, curated allowlist for App Review only)
// ─────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveLookupKey, type LookupKeyResolution } from './identityResolver.ts'
import { fetchProEntitlement, type ProEntitlementState } from './revenueCatRest.ts'
import { validateCanonicalUser } from './canonicalUserValidator.ts'
import {
  shouldSkipSandboxEvent,
  shouldSkipSandboxEventForCanonicalUser,
  parseSandboxReviewerAllowlist,
} from './sandboxGuard.ts'

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Valid RevenueCat webhook event types for Google Play ──────
// Only documented types. No invented types.
//
// EXPIRATION         — access ends (includes pause-expiration)
// INITIAL_PURCHASE   — first purchase, activates Pro
// RENEWAL            — period renewal, extends access
// CANCELLATION       — user cancelled, access continues until expiration
// UNCANCELLATION     — user uncancelled, renewal re-enabled
// BILLING_ISSUE      — payment problem, grace period until expiration
// PRODUCT_CHANGE     — plan upgrade/downgrade
// SUBSCRIPTION_PAUSED — scheduled pause, access through current paid period
// SUBSCRIPTION_EXTENDED — period extended (e.g. promotional)
// NON_RENEWING_PURCHASE — one-time purchase with entitlement
// TRANSFER           — NOT a normal lifecycle event; uses
//                      transferred_from[]/transferred_to[]
// TEST               — RevenueCat connectivity test; no mutation

// Events that end Pro access immediately (event-type fallback only).
const DEACTIVATING_TYPES = new Set(['EXPIRATION'])
// Events that activate/extend access (event-type fallback only).
const ACTIVATING_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
])
// Events that keep access until expiration (grace/cancel/paused).
const GRACE_TYPES = new Set(['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'])
// TRANSFER: special handling — not a normal lifecycle event.
const TRANSFER_TYPE = 'TRANSFER'
// TEST: RevenueCat connectivity test — authenticate, acknowledge, no mutation.
const TEST_TYPE = 'TEST'

// Determine plan from a RevenueCat/Google Play product identifier.
//
// Google Play base-plan format (RevenueCat may pass either form):
//   juicing_daily_pro:monthly   → pro_monthly
//   juicing_daily_pro:annual    → pro_annual
//   juicing_daily_pro           → must inspect base-plan suffix; if
//                                 absent, returns null (do not guess).
//
// Never returns a false Pro-plan label for an unknown base plan.
// The active "pro" entitlement itself remains the source for whether
// Pro access is active — this function only labels the plan tier.
function planFromProductId(productId: string | null): string | null {
  if (!productId) return null
  const id = productId.toLowerCase()

  // Google Play base-plan form: "<subscription_id>:<base_plan>"
  if (id.includes(':')) {
    const basePlan = id.split(':')[1] ?? ''
    if (basePlan === 'monthly') return 'pro_monthly'
    if (basePlan === 'annual' || basePlan === 'yearly') return 'pro_annual'
    // Unknown base plan — do NOT guess. Return null for safe
    // diagnostic handling; never false Pro-plan metadata.
    return null
  }

  // Legacy / non-base-plan form: inspect keywords.
  if (id.includes('annual') || id.includes('year') || id.includes('yearly')) {
    return 'pro_annual'
  }
  if (id.includes('monthly') || id.includes('month')) {
    return 'pro_monthly'
  }

  // Bare subscription id with no base-plan suffix and no keyword —
  // do NOT guess. Return null.
  return null
}

// Sanitize the event for diagnostic storage — strip secrets/PII.
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
    app_user_id: event.app_user_id,
    original_app_user_id: event.original_app_user_id,
    aliases: event.aliases,
  }
  return JSON.stringify(safe)
}

// Derive entitlement state from event type (fallback when REST
// reconciliation is not available — development/test only).
function deriveStateFromEventType(
  eventType: string,
  expirationMs: number,
  expirationDate: string | null,
): { isActive: boolean; willRenew: boolean } {
  const now = Date.now()
  if (DEACTIVATING_TYPES.has(eventType)) {
    return { isActive: false, willRenew: false }
  }
  if (GRACE_TYPES.has(eventType)) {
    return {
      isActive: !expirationDate || expirationMs > now,
      willRenew: eventType !== 'CANCELLATION',
    }
  }
  if (ACTIVATING_TYPES.has(eventType)) {
    return { isActive: !expirationDate || expirationMs > now, willRenew: true }
  }
  // Unknown event type: default to expiration-based check.
  // Do not deactivate — safer for the paying customer.
  return { isActive: !expirationDate || expirationMs > now, willRenew: true }
}

// Derive subscription record fields from REST entitlement state.
function deriveStateFromRest(
  entitlement: ProEntitlementState,
  event: Record<string, unknown>,
): {
  isActive: boolean
  willRenew: boolean
  store: string
  plan: string | null
  productId: string | null
  expirationDate: string | null
  purchaseDate: string | null
} {
  const eventProductId = (event.product_id as string) ?? null
  const productId = entitlement.productId ?? eventProductId
  const expirationDate = entitlement.expirationDate
  const purchaseMs = Number(event.purchased_at_ms ?? 0)
  const purchaseDate = purchaseMs > 0 ? new Date(purchaseMs).toISOString() : null
  const store =
    entitlement.store ??
    (String(event.store ?? '').toUpperCase() === 'PLAY_STORE'
      ? 'play_store'
      : String(event.store ?? '').toUpperCase() === 'PROMOTIONAL'
        ? 'promotional'
        : 'app_store')

  return {
    isActive: entitlement.isActive,
    willRenew: entitlement.willRenew,
    store,
    plan: planFromProductId(productId),
    productId,
    expirationDate,
    purchaseDate,
  }
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
  const environment =
    String(event.environment ?? 'PRODUCTION').toLowerCase() === 'sandbox' ? 'sandbox' : 'production'
  const eventTimestampMs = Number(event.event_timestamp_ms ?? 0)

  // ── TEST event: authenticate, acknowledge, no mutation ─────
  // RevenueCat sends TEST events to verify webhook connectivity.
  // We authenticate normally, validate the envelope (event object
  // with type === 'TEST'), and return success without touching any
  // subscription state.
  //
  // TEST events:
  //   - DO NOT require a real RawLifeFlow customer UUID
  //   - DO NOT call apply_revenuecat_event()
  //   - DO NOT change subscriptions
  //   - DO NOT call resolve_quota()
  //   - DO NOT require an event ID (TEST events may omit it)
  //   - DO NOT perform identity resolution
  //   - return HTTP 200 with a clear test acknowledgement
  if (eventType === TEST_TYPE) {
    console.log('[revenuecat-webhook] TEST event received — acknowledged, no mutation')
    return json(200, { ok: true, test: true })
  }

  if (!eventId || !eventType) return json(400, { message: 'Missing event id/type' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // ── Idempotency + retry safety ─────────────────────────────
  const { error: insertError } = await admin.from('revenuecat_webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    app_user_id: String(event.app_user_id ?? ''),
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
        return json(200, { ok: true, duplicate: true })
      }
      // Status is 'pending' or 'failed' — resume processing.
      await admin
        .from('revenuecat_webhook_events')
        .update({ detail: sanitizeEventForDetail(event), status: 'pending' })
        .eq('event_id', eventId)
    } else {
      console.error('[revenuecat-webhook] insert failed:', insertError.message)
      return json(500, { message: 'Event persistence failed' })
    }
  }

  // ── TRANSFER handling ──────────────────────────────────────
  // TRANSFER is NOT a normal lifecycle event. Uses transferred_from[]/
  // transferred_to[]. Under "Keep with original App User ID" policy,
  // transfers should not occur. Skip and log for diagnostics.
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

  // ── SANDBOX environment boundary ────────────────────────────
  // event.environment reflects RevenueCat's own classification of
  // the underlying store purchase (sandbox vs production), not a
  // value the mobile client can set directly. Sandbox purchases
  // (e.g. TestFlight / Play internal-testing sandbox testers, or an
  // App-Review reviewer's sandbox purchase) are delivered to the
  // SAME webhook URL as production purchases by default. A sandbox
  // purchase must NEVER be allowed to activate real production Pro
  // entitlement for an ordinary user.
  //
  // EXCEPTION: a small, server-only allowlist of pre-provisioned
  // reviewer Supabase UUIDs (REVENUECAT_SANDBOX_REVIEWER_UUIDS) may
  // receive normal Pro entitlement from a sandbox purchase, so an
  // Apple/Google App Review reviewer can validate the real
  // subscription experience end-to-end. This check is performed
  // ONLY after RevenueCat REST reconciliation resolves the canonical
  // UUID (subscriber.original_app_user_id) and that UUID is
  // validated to exist in auth.users — the raw, unvalidated webhook
  // `event.app_user_id` is never sufficient on its own and is never
  // compared against the allowlist. See the final decision below,
  // near the apply_revenuecat_event call.
  //
  // This boundary is controlled ONLY by server-side Supabase
  // function secrets (REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT,
  // REVENUECAT_SANDBOX_REVIEWER_UUIDS), never by any client-supplied
  // request field.
  const allowSandboxEntitlement = Deno.env.get('REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT') === '1'
  const sandboxReviewerAllowlist = parseSandboxReviewerAllowlist(
    Deno.env.get('REVENUECAT_SANDBOX_REVIEWER_UUIDS'),
  )

  // ── Lookup key extraction ──────────────────────────────────
  // Extract ANY valid UUID from the event to use as a RevenueCat
  // REST lookup key. This is NOT the canonical RawLifeFlow UUID.
  // The canonical UUID comes from the REST CustomerInfo response's
  // subscriber.original_app_user_id field.
  const lookupResolution: LookupKeyResolution = resolveLookupKey(event)

  if (lookupResolution.status === 'unmappable') {
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: lookupResolution.reason })
  }

  const lookupKey = lookupResolution.lookupKey

  // ── REST reconciliation (required for production mutation) ──
  // RevenueCat current CustomerInfo is the production authority for
  // BOTH identity (subscriber.original_app_user_id) and entitlement
  // state (subscriber.entitlements.pro).
  //
  // The canonical RawLifeFlow UUID is extracted from the REST
  // response's subscriber.original_app_user_id — NOT from
  // event.app_user_id (which is only the last-seen App User ID).
  //
  // When the key is absent AND the event requires subscription
  // mutation, do NOT mutate subscriptions. Mark the event as
  // failed (configuration failure) and return non-2xx so RevenueCat
  // can retry after configuration is corrected.
  //
  // Event-type classification fallback is permitted ONLY when
  // REVENUECAT_ALLOW_EVENT_TYPE_FALLBACK is explicitly set to '1'
  // (local/unit-test fixtures, controlled development). Never
  // silently used in production.
  const serverApiKey = Deno.env.get('REVENUECAT_SERVER_API_KEY')
  const restConfigured = Boolean(serverApiKey)
  const allowEventTypeFallback = Deno.env.get('REVENUECAT_ALLOW_EVENT_TYPE_FALLBACK') === '1'

  // ── SANDBOX early bail-out when REST is unavailable ────────
  // The reviewer-allowlist exception requires a REST-resolved,
  // auth.users-validated canonical UUID. Without REST reconciliation
  // there is no safe way to resolve that identity, so a sandbox
  // event is skipped immediately (fail closed) rather than falling
  // through to the non-authoritative event-type-fallback path.
  if (environment === 'sandbox' && !restConfigured && shouldSkipSandboxEvent(environment, allowSandboxEntitlement)) {
    console.warn(
      '[revenuecat-webhook] SANDBOX event received with no REST reconciliation configured — ignored.',
      'event_id:', eventId, 'type:', eventType,
    )
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: 'sandbox_environment_not_authoritative' })
  }

  let canonicalUuid: string
  let isActive: boolean
  let willRenew: boolean
  let store: string
  let plan: string | null
  let productId: string | null
  let expirationDate: string | null
  let purchaseDate: string | null

  if (restConfigured) {
    const restResult = await fetchProEntitlement(lookupKey, serverApiKey!)

    if (!restResult.ok) {
      // REST failure — do NOT incorrectly deactivate an existing
      // paying subscriber from an ambiguous event. Leave event
      // pending/failed so RevenueCat retry can recover.
      console.error('[revenuecat-webhook] REST reconciliation failed:', restResult.error)
      await admin
        .from('revenuecat_webhook_events')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('event_id', eventId)
      // Return 500 so RevenueCat retries.
      return json(500, { message: 'REST reconciliation failed' })
    }

    // ── Canonical UUID from REST CustomerInfo ──────────────
    // subscriber.original_app_user_id is the FIRST App User ID
    // used by that customer. This is the stable subscription
    // ownership authority.
    canonicalUuid = restResult.canonicalUserId!

    // ── Validate canonical UUID exists in auth.users ────────
    // The REST-returned original_app_user_id must correspond to
    // a real RawLifeFlow account. If it doesn't, do NOT mutate.
    //
    // Uses the Supabase Auth Admin API (admin.auth.admin.getUserById)
    // via validateCanonicalUser(). Three outcomes:
    //   A. VALID USER       → continue processing
    //   B. GENUINELY ABSENT → skipped + HTTP 200
    //   C. LOOKUP ERROR     → failed + non-2xx (RevenueCat retries)
    const userValidation = await validateCanonicalUser(admin, canonicalUuid)

    if (userValidation.status === 'error') {
      // Outcome C — infrastructure / lookup error. Do NOT confuse
      // this with a genuine "user not found". Mark failed and return
      // non-2xx so RevenueCat can retry after the issue resolves.
      console.error(
        '[revenuecat-webhook] Auth Admin lookup error for canonical UUID:',
        canonicalUuid,
        'error:',
        userValidation.message,
      )
      await admin
        .from('revenuecat_webhook_events')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('event_id', eventId)
      return json(500, { message: 'canonical_uuid_lookup_failed' })
    }

    if (userValidation.status === 'missing') {
      // Outcome B — the Auth Admin API definitively reports no user
      // exists for this UUID. Skipped + HTTP 200 is appropriate.
      console.error(
        '[revenuecat-webhook] REST canonical UUID does not correspond to a RawLifeFlow account:',
        canonicalUuid,
      )
      await admin
        .from('revenuecat_webhook_events')
        .update({ status: 'skipped', processed_at: new Date().toISOString() })
        .eq('event_id', eventId)
      return json(200, { ok: true, skipped: 'canonical_uuid_not_found_in_auth' })
    }
    // Outcome A — valid RawLifeFlow account. Continue.

    const ent = restResult.entitlement!
    const derived = deriveStateFromRest(ent, event)
    isActive = derived.isActive
    willRenew = derived.willRenew
    store = derived.store
    plan = derived.plan
    productId = derived.productId
    expirationDate = derived.expirationDate
    purchaseDate = derived.purchaseDate
  } else if (allowEventTypeFallback) {
    // Controlled development / unit-test fixtures only.
    // Explicitly opted in via REVENUECAT_ALLOW_EVENT_TYPE_FALLBACK=1.
    // Never silently used in production.
    // In fallback mode, the lookup key is used as canonical (no REST
    // authority available — development only).
    canonicalUuid = lookupKey
    const expirationMs = Number(event.expiration_at_ms ?? 0)
    expirationDate = expirationMs > 0 ? new Date(expirationMs).toISOString() : null
    const purchaseMs = Number(event.purchased_at_ms ?? 0)
    purchaseDate = purchaseMs > 0 ? new Date(purchaseMs).toISOString() : null
    productId = (event.product_id as string) ?? null
    store =
      String(event.store ?? '').toUpperCase() === 'PLAY_STORE'
        ? 'play_store'
        : String(event.store ?? '').toUpperCase() === 'PROMOTIONAL'
          ? 'promotional'
          : 'app_store'

    const derived = deriveStateFromEventType(eventType, expirationMs, expirationDate)
    isActive = derived.isActive
    willRenew = derived.willRenew
    plan = planFromProductId(productId)
  } else {
    // REVENUECAT_SERVER_API_KEY is missing and event-type fallback
    // is not explicitly enabled. This is a production configuration
    // failure. Do NOT mutate subscriptions. Mark the event failed
    // and return non-2xx so RevenueCat retries after the key is set.
    console.error(
      '[revenuecat-webhook] REVENUECAT_SERVER_API_KEY not configured — refusing to mutate subscriptions for lifecycle event.',
      'event_id:',
      eventId,
      'type:',
      eventType,
    )
    await admin
      .from('revenuecat_webhook_events')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        detail: sanitizeEventForDetail(event),
      })
      .eq('event_id', eventId)
    return json(500, { message: 'REVENUECAT_SERVER_API_KEY not configured' })
  }

  // ── Final SANDBOX decision (post-reconciliation) ────────────
  // By this point, for a sandbox event, canonicalUuid has been
  // resolved via RevenueCat REST (subscriber.original_app_user_id)
  // and validated to exist in auth.users (the restConfigured branch
  // above returns early on REST failure or a missing/invalid user).
  // Only NOW — against this validated identity, never the raw
  // webhook event.app_user_id — do we decide whether this sandbox
  // event may proceed to mutate subscriptions.
  if (
    shouldSkipSandboxEventForCanonicalUser(
      environment,
      allowSandboxEntitlement,
      canonicalUuid,
      sandboxReviewerAllowlist,
    )
  ) {
    console.warn(
      '[revenuecat-webhook] SANDBOX event received — canonical user not on reviewer allowlist, ignored.',
      'event_id:', eventId, 'type:', eventType,
    )
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    // 200 (not an error) so RevenueCat does not retry-storm a
    // sandbox event that is intentionally never going to mutate
    // production state.
    return json(200, { ok: true, skipped: 'sandbox_environment_not_authoritative' })
  }

  // ── Atomic subscription update ─────────────────────────────
  // apply_revenuecat_event() uses pg_advisory_xact_lock(hashtext(uuid))
  // to serialize concurrent invocations, including first-event case.
  // Uses the REST-derived canonical UUID, NOT event.app_user_id.
  const { data: applyResult, error: applyError } = await admin.rpc('apply_revenuecat_event', {
    p_user_id: canonicalUuid,
    p_event_id: eventId,
    p_event_timestamp_ms: eventTimestampMs > 0 ? eventTimestampMs : null,
    p_is_active: isActive,
    p_store: store,
    p_plan: plan,
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
    await admin
      .from('revenuecat_webhook_events')
      .update({ status: 'skipped', processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return json(200, { ok: true, skipped: 'stale_event' })
  }

  // Sync the quota plan using the REST-derived canonical UUID.
  const { error: quotaError } = await admin.rpc('resolve_quota', { p_user_id: canonicalUuid })
  if (quotaError) console.error('[revenuecat-webhook] quota sync failed:', quotaError.message)

  await admin
    .from('revenuecat_webhook_events')
    .update({ status: 'processed', processed_at: new Date().toISOString() })
    .eq('event_id', eventId)

  return json(200, { ok: true })
})
