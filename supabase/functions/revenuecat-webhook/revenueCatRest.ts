// ─────────────────────────────────────────────────────────────
// revenueCatRest.ts — Server-side RevenueCat CustomerInfo fetch.
//
// Calls GET https://api.revenuecat.com/v1/subscribers/{lookup_key}
// with any valid UUID from the webhook event to get authoritative
// CustomerInfo.
//
// The REST response provides TWO authoritative pieces of data:
//   1. subscriber.original_app_user_id — the CANONICAL RawLifeFlow
//      UUID (first App User ID used by that customer). This is the
//      subscription ownership authority, NOT event.app_user_id.
//   2. subscriber.entitlements.pro — the authoritative current Pro
//      entitlement state.
//
// SECURITY:
//   - Uses REVENUECAT_SERVER_API_KEY (server secret only)
//   - NEVER exposed to the mobile app
//   - Only called from Edge Functions (server-side)
//
// REVENUECAT_SERVER_API_KEY HUMAN CONFIGURATION REQUIRED
//   This secret must be set via Supabase CLI:
//     supabase secrets set REVENUECAT_SERVER_API_KEY=sk_xxxxx
//   The key is a RevenueCat "Secret API Key" from:
//     RevenueCat Dashboard → Project Settings → API Keys → Secret API Key
//
// HTTP status handling:
//   200/201 — parse CustomerInfo normally
//   401/403 — configuration/authentication failure
//   404     — unexpected REST/configuration failure (NOT proof of Free)
//   429     — retryable
//   5xx     — retryable
//   network/timeout — retryable
//   malformed — failure
//
//   On ANY reconciliation failure, returns { ok: false } so the
//   caller leaves the event pending/failed for RevenueCat retry.
//   Only valid CustomerInfo with no active "pro" entitlement may
//   set the account Free.
// ─────────────────────────────────────────────────────────────

import { isValidSupabaseUuid } from './identityResolver.ts'

export interface ProEntitlementState {
  isActive: boolean
  expirationDate: string | null
  productId: string | null
  willRenew: boolean
  store: 'play_store' | 'app_store' | 'promotional' | null
}

export interface RestReconciliationResult {
  ok: boolean
  // The canonical RawLifeFlow UUID from RevenueCat CustomerInfo.
  // This is subscriber.original_app_user_id — the FIRST App User ID
  // used by that customer. NOT event.app_user_id.
  canonicalUserId?: string
  entitlement?: ProEntitlementState
  error?: string
}

// Fetch current RevenueCat CustomerInfo using a lookup key (any valid
// UUID from the webhook event). Returns the canonical RawLifeFlow UUID
// (from subscriber.original_app_user_id) and the Pro entitlement state.
//
// Returns { ok: false, error } on ANY failure — caller must handle
// by leaving event pending/failed for retry.
//
// Only { ok: true } results may mutate subscription state.
// A 404 is NOT proof of Free — it's an unexpected failure.
export async function fetchProEntitlement(
  lookupKey: string,
  serverApiKey: string,
): Promise<RestReconciliationResult> {
  if (!serverApiKey) {
    return { ok: false, error: 'REVENUECAT_SERVER_API_KEY not configured' }
  }

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(lookupKey)}`

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Platform': 'android',
        Authorization: `Bearer ${serverApiKey}`,
      },
    })

    // 200/201 — parse CustomerInfo normally
    if (resp.status === 200 || resp.status === 201) {
      const data = await resp.json()
      return parseProEntitlement(data)
    }

    // 401/403 — configuration/authentication failure
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, error: `RevenueCat auth failed: ${resp.status}` }
    }

    // 404 — unexpected REST/configuration failure.
    // RevenueCat API v1 GET /v1/subscribers/{app_user_id} is documented
    // as "Get or Create Customer" and normally succeeds with 200 or 201.
    // A 404 indicates a configuration or API issue, NOT that the user
    // is Free. Do NOT revoke Pro from a 404.
    if (resp.status === 404) {
      return { ok: false, error: 'RevenueCat API returned 404 — unexpected configuration failure' }
    }

    // 429 — retryable
    if (resp.status === 429) {
      return { ok: false, error: 'RevenueCat API rate limited (429)' }
    }

    // 5xx and other — retryable
    return { ok: false, error: `RevenueCat API returned ${resp.status}` }
  } catch (e) {
    // network/timeout — retryable
    return { ok: false, error: (e as Error)?.message ?? 'fetch failed' }
  }
}

// Parse RevenueCat subscriber response and extract:
//   1. canonicalUserId from subscriber.original_app_user_id
//   2. Pro entitlement state from subscriber.entitlements.pro
//
// Defensive against malformed responses.
function parseProEntitlement(data: Record<string, unknown>): RestReconciliationResult {
  try {
    const subscriber = data.subscriber as Record<string, unknown> | undefined
    if (!subscriber) {
      return { ok: false, error: 'malformed_response: no subscriber object' }
    }

    // ── Extract canonical UUID from subscriber.original_app_user_id ──
    // This is the FIRST App User ID used by that customer and is the
    // subscription ownership authority. NOT event.app_user_id.
    const originalAppUserId = String(subscriber.original_app_user_id ?? '')
    if (!isValidSupabaseUuid(originalAppUserId)) {
      // REST CustomerInfo does not contain a valid RawLifeFlow UUID
      // as original_app_user_id. This could mean:
      //   - The subscriber is anonymous-only ($RCAnonymousID)
      //   - The original_app_user_id is an email or malformed
      //   - The field is missing
      // In any case, we cannot establish canonical ownership.
      return {
        ok: false,
        error: `invalid_canonical_uuid: original_app_user_id is not a valid Supabase UUID`,
      }
    }

    const entitlements = subscriber.entitlements as Record<string, unknown> | undefined
    if (!entitlements) {
      // No entitlements object at all — malformed, treat as failure.
      // Do NOT assume Free from a missing entitlements object.
      return { ok: false, error: 'malformed_response: no entitlements object' }
    }

    const proEntitlement = entitlements.pro as Record<string, unknown> | undefined
    if (!proEntitlement) {
      // Valid CustomerInfo with no "pro" entitlement — legitimately Free.
      // This is the ONLY path that may set the account Free.
      // canonicalUserId is still returned so the caller can record
      // the Free state under the correct account.
      return {
        ok: true,
        canonicalUserId: originalAppUserId,
        entitlement: {
          isActive: false,
          expirationDate: null,
          productId: null,
          willRenew: false,
          store: null,
        },
      }
    }

    const expirationDate = (proEntitlement.expires_date as string) ?? null
    const productId = (proEntitlement.product_identifier as string) ?? null
    const isActive = proEntitlement.expires_date === null || new Date(expirationDate!) > new Date()

    // Determine store from subscriptions
    const subscriptions = subscriber.subscriptions as Record<string, unknown> | undefined
    let store: 'play_store' | 'app_store' | 'promotional' | null = null
    let willRenew = false
    if (productId && subscriptions) {
      const sub = subscriptions[productId] as Record<string, unknown> | undefined
      if (sub) {
        const storeStr = String(sub.store ?? '').toLowerCase()
        if (storeStr === 'play_store') store = 'play_store'
        else if (storeStr === 'app_store') store = 'app_store'
        else if (storeStr === 'promotional') store = 'promotional'
        willRenew = Boolean(sub.is_sandbox === false && sub.ownership_type !== 'UNOWNED')
      }
    }

    return {
      ok: true,
      canonicalUserId: originalAppUserId,
      entitlement: {
        isActive,
        expirationDate,
        productId,
        willRenew,
        store,
      },
    }
  } catch (e) {
    return { ok: false, error: `parse_error: ${(e as Error)?.message}` }
  }
}
