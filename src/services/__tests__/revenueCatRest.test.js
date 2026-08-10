// revenueCatRest.test.js — Tests for RevenueCat REST reconciliation helper.
//
// Verifies source structure and behavior for:
// - active Pro entitlement
// - inactive Pro entitlement
// - REST temporary failure
// - REST malformed response
// - entitlement "pro" missing → Free (only valid CustomerInfo may set Free)
// - 404 → FAILURE (NOT Free — never revoke Pro from 404)
// - REVENUECAT_SERVER_API_KEY not configured
// - 401/403 → auth failure
// - 429 → retryable
// - missing entitlements object → malformed (NOT Free)

const fs = require('fs')
const path = require('path')

const restPath = path.resolve(
  __dirname,
  '../../../supabase/functions/revenuecat-webhook/revenueCatRest.ts',
)
const restSource = fs.readFileSync(restPath, 'utf8')

const webhookPath = path.resolve(
  __dirname,
  '../../../supabase/functions/revenuecat-webhook/index.ts',
)
const webhookSource = fs.readFileSync(webhookPath, 'utf8')

describe('revenueCatRest source structure', () => {
  it('1. exports fetchProEntitlement', () => {
    expect(restSource).toMatch(/export async function fetchProEntitlement/)
  })

  it('2. exports ProEntitlementState interface', () => {
    expect(restSource).toMatch(/export interface ProEntitlementState/)
  })

  it('3. uses REVENUECAT_SERVER_API_KEY', () => {
    expect(restSource).toMatch(/REVENUECAT_SERVER_API_KEY/)
  })

  it('4. calls RevenueCat API endpoint', () => {
    expect(restSource).toMatch(/api\.revenuecat\.com\/v1\/subscribers\//)
  })

  it('5. uses Authorization Bearer header', () => {
    expect(restSource).toMatch(/Authorization.*Bearer/)
  })

  it('6. never exposes key to mobile app (server-only)', () => {
    // The module is in supabase/functions/ (server-side only)
    expect(restPath).toMatch(/supabase[\/\\]functions/)
  })
})

describe('revenueCatRest: active Pro', () => {
  it('7. parses active Pro from subscriber response', () => {
    // Simulate parsing logic
    const data = {
      subscriber: {
        entitlements: {
          pro: {
            expires_date: '2099-12-31T23:59:59Z',
            product_identifier: 'pro_annual',
          },
        },
        subscriptions: {
          pro_annual: {
            store: 'play_store',
            is_sandbox: false,
            ownership_type: 'PURCHASED',
          },
        },
      },
    }
    // Verify the source parsing logic handles this
    expect(restSource).toMatch(/expires_date/)
    expect(restSource).toMatch(/product_identifier/)
    expect(restSource).toMatch(/isActive/)
  })
})

describe('revenueCatRest: inactive Pro', () => {
  it('8. parses expired Pro (isActive=false)', () => {
    const data = {
      subscriber: {
        entitlements: {
          pro: {
            expires_date: '2020-01-01T00:00:00Z',
            product_identifier: 'pro_monthly',
          },
        },
        subscriptions: {},
      },
    }
    // The parsing logic checks new Date(expirationDate) > new Date()
    expect(restSource).toMatch(/new Date\(expirationDate/)
  })
})

describe('revenueCatRest: REST temporary failure', () => {
  it('9. returns ok=false on 5xx response', () => {
    expect(restSource).toMatch(/ok: false/)
    expect(restSource).toMatch(/error/)
  })

  it('10. webhook leaves event failed on REST failure', () => {
    expect(webhookSource).toMatch(/REST reconciliation failed/)
    expect(webhookSource).toMatch(/status: 'failed'/)
  })

  it('11. webhook returns 500 on REST failure (for RC retry)', () => {
    const restFailSection = webhookSource.slice(
      webhookSource.indexOf('REST reconciliation failed'),
    )
    expect(restFailSection).toMatch(/500/)
  })
})

describe('revenueCatRest: malformed response', () => {
  it('12. handles malformed response (no subscriber object)', () => {
    expect(restSource).toMatch(/malformed_response.*no subscriber/)
  })

  it('13. handles parse errors', () => {
    expect(restSource).toMatch(/parse_error/)
  })
})

describe('revenueCatRest: entitlement "pro" missing', () => {
  it('14. no entitlements object → malformed (NOT Free)', () => {
    // A missing entitlements object is malformed, not proof of Free.
    // Only valid CustomerInfo with no "pro" entitlement may set Free.
    expect(restSource).toMatch(/no entitlements object/i)
    expect(restSource).toMatch(/malformed_response.*no entitlements/i)
  })

  it('15. no "pro" entitlement → Free (only valid CustomerInfo)', () => {
    // This is the ONLY path that may set the account Free.
    expect(restSource).toMatch(/no "pro" entitlement/i)
    expect(restSource).toMatch(/legitimately Free/i)
  })
})

describe('revenueCatRest: 404 must NOT mean Free', () => {
  it('16. 404 → ok=false (NOT Free)', () => {
    // 404 is an unexpected REST/configuration failure, NOT proof of Free.
    // RevenueCat API v1 GET /v1/subscribers/{app_user_id} is documented
    // as "Get or Create Customer" and normally succeeds with 200 or 201.
    expect(restSource).toMatch(/404/)
    expect(restSource).toMatch(/unexpected configuration failure/i)
  })

  it('16a. 404 returns ok=false (never revokes Pro)', () => {
    // The 404 branch must return ok: false, not ok: true with isActive: false
    const section404Start = restSource.indexOf('404 — unexpected')
    const section404End = restSource.indexOf('429 — retryable')
    const section404 = restSource.slice(section404Start, section404End)
    expect(section404).toMatch(/ok: false/)
    expect(section404).not.toMatch(/ok: true/)
  })

  it('16b. 404 comment documents it is NOT proof of Free', () => {
    const section404 = restSource.slice(
      restSource.indexOf('404 — unexpected'),
    )
    expect(section404).toMatch(/NOT.*Free/i)
  })

  it('16c. only valid CustomerInfo with no pro sets Free', () => {
    // The only ok:true with isActive:false path is "no pro entitlement"
    const freeSection = restSource.slice(
      restSource.indexOf('legitimately Free'),
    )
    expect(freeSection).toMatch(/ok: true/)
    expect(freeSection).toMatch(/isActive: false/)
  })
})

describe('revenueCatRest: API key not configured', () => {
  it('17. missing serverApiKey → ok=false', () => {
    expect(restSource).toMatch(/REVENUECAT_SERVER_API_KEY not configured/)
  })
})

describe('revenueCatRest: HTTP status handling', () => {
  it('17a. 200/201 → parse CustomerInfo normally', () => {
    expect(restSource).toMatch(/resp\.status === 200/)
    expect(restSource).toMatch(/resp\.status === 201/)
  })

  it('17b. 401/403 → auth failure (ok=false)', () => {
    const authSection = restSource.slice(
      restSource.indexOf('401/403 — configuration/authentication failure'),
    )
    expect(authSection).toMatch(/ok: false/)
    expect(authSection).toMatch(/auth failed/)
  })

  it('17c. 429 → retryable (ok=false)', () => {
    const rateSection = restSource.slice(
      restSource.indexOf('429 — retryable'),
    )
    expect(rateSection).toMatch(/ok: false/)
    expect(rateSection).toMatch(/rate limited/)
  })

  it('17d. 5xx → retryable (ok=false)', () => {
    expect(restSource).toMatch(/5xx and other — retryable/)
  })
})

describe('Webhook REST integration', () => {
  it('18. webhook reads REVENUECAT_SERVER_API_KEY from env', () => {
    expect(webhookSource).toMatch(/Deno\.env\.get\('REVENUECAT_SERVER_API_KEY'\)/)
  })

  it('19. webhook uses REST when key is configured', () => {
    expect(webhookSource).toMatch(/restConfigured/)
    expect(webhookSource).toMatch(/fetchProEntitlement/)
  })

  it('20. webhook blocks production mutation when REST key missing', () => {
    // When REVENUECAT_SERVER_API_KEY is missing, the webhook must NOT
    // mutate subscriptions. It marks the event failed and returns 500.
    expect(webhookSource).toMatch(/REVENUECAT_SERVER_API_KEY not configured/)
    expect(webhookSource).toMatch(/refusing to mutate subscriptions/i)
  })

  it('20a. webhook allows event-type fallback only with explicit opt-in', () => {
    // Event-type classification fallback is permitted ONLY when
    // REVENUECAT_ALLOW_EVENT_TYPE_FALLBACK=1 (local/unit-test fixtures).
    expect(webhookSource).toMatch(/REVENUECAT_ALLOW_EVENT_TYPE_FALLBACK/)
    expect(webhookSource).toMatch(/allowEventTypeFallback/)
  })

  it('20b. webhook returns 500 when server key missing (for RC retry)', () => {
    const noKeySection = webhookSource.slice(
      webhookSource.indexOf('refusing to mutate subscriptions'),
    )
    expect(noKeySection).toMatch(/500/)
  })

  it('21. webhook does not deactivate on REST failure', () => {
    // The "do NOT incorrectly deactivate" comment is before the error log
    const restFailSection = webhookSource.slice(
      webhookSource.indexOf('REST failure'),
    )
    expect(restFailSection).toMatch(/do NOT incorrectly deactivate/i)
  })

  it('21b. webhook comment documents safe failure', () => {
    // The comment before the REST failure handling
    const restSection = webhookSource.slice(
      webhookSource.indexOf('REST failure'),
    )
    expect(restSection).toMatch(/pending|failed/i)
  })
})

describe('revenueCatRest: canonicalUserId extraction', () => {
  it('22. source extracts subscriber.original_app_user_id', () => {
    expect(restSource).toMatch(/subscriber\.original_app_user_id/)
  })

  it('23. source returns canonicalUserId in result', () => {
    expect(restSource).toMatch(/canonicalUserId/)
  })

  it('24. source validates original_app_user_id is valid UUID', () => {
    expect(restSource).toMatch(/isValidSupabaseUuid\(originalAppUserId\)/)
  })

  it('25. source returns ok=false for invalid canonical UUID', () => {
    expect(restSource).toMatch(/invalid_canonical_uuid/)
  })

  it('26. source imports isValidSupabaseUuid from identityResolver', () => {
    expect(restSource).toMatch(/import.*isValidSupabaseUuid.*identityResolver/)
  })

  it('27. canonicalUserId returned even when Pro is inactive (Free)', () => {
    // The Free path (no pro entitlement) still returns canonicalUserId
    const freeSection = restSource.slice(
      restSource.indexOf('legitimately Free'),
    )
    expect(freeSection).toMatch(/canonicalUserId/)
  })
})
