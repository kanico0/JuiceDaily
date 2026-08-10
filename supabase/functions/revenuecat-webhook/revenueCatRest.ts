// ─────────────────────────────────────────────────────────────
// revenueCatRest.ts — Server-side RevenueCat CustomerInfo fetch.
//
// Calls GET https://api.revenuecat.com/v1/subscribers/{app_user_id}
// with the canonical Supabase UUID to get authoritative current
// entitlement state.
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
// ─────────────────────────────────────────────────────────────

export interface ProEntitlementState {
  isActive: boolean
  expirationDate: string | null
  productId: string | null
  willRenew: boolean
  store: 'play_store' | 'app_store' | 'promotional' | null
}

export interface RestReconciliationResult {
  ok: boolean
  entitlement?: ProEntitlementState
  error?: string
}

// Fetch current RevenueCat CustomerInfo and derive Pro entitlement.
// Returns { ok: false, error } on failure — caller must handle
// by leaving event pending/failed for retry.
export async function fetchProEntitlement(
  appUserId: string,
  serverApiKey: string,
): Promise<RestReconciliationResult> {
  if (!serverApiKey) {
    return { ok: false, error: 'REVENUECAT_SERVER_API_KEY not configured' }
  }

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Platform': 'android',
        Authorization: `Bearer ${serverApiKey}`,
      },
    })

    if (!resp.ok) {
      // 401/403: auth error — do not deactivate existing subscriber
      // 404: subscriber not found — treat as no entitlement
      // 5xx: temporary failure — leave pending for retry
      if (resp.status === 404) {
        return {
          ok: true,
          entitlement: {
            isActive: false,
            expirationDate: null,
            productId: null,
            willRenew: false,
            store: null,
          },
        }
      }
      return { ok: false, error: `RevenueCat API returned ${resp.status}` }
    }

    const data = await resp.json()
    return parseProEntitlement(data)
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? 'fetch failed' }
  }
}

// Parse RevenueCat subscriber response and extract Pro entitlement.
// Defensive against malformed responses.
function parseProEntitlement(data: Record<string, unknown>): RestReconciliationResult {
  try {
    const subscriber = data.subscriber as Record<string, unknown> | undefined
    if (!subscriber) {
      return { ok: false, error: 'malformed_response: no subscriber object' }
    }

    const entitlements = subscriber.entitlements as Record<string, unknown> | undefined
    if (!entitlements) {
      // No entitlements at all — Free
      return {
        ok: true,
        entitlement: {
          isActive: false,
          expirationDate: null,
          productId: null,
          willRenew: false,
          store: null,
        },
      }
    }

    const proEntitlement = entitlements.pro as Record<string, unknown> | undefined
    if (!proEntitlement) {
      // No "pro" entitlement — Free
      return {
        ok: true,
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

    // Determine store from non_subscriptions or subscriptions
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
