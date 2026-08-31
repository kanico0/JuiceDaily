// ─────────────────────────────────────────────────────────────
// revenueCatRestHeaders.test.ts — Regression test for a confirmed
// production defect: fetchProEntitlement() previously sent an
// 'X-Platform' header alongside the RevenueCat Secret API key,
// which RevenueCat's REST API rejects with HTTP 403
// { code: 7243, message: "Secret API keys should not be used in
// your app." } — causing EVERY server-side REST reconciliation
// call to fail permanently (confirmed via production diagnostic
// on 2026-08-31: 0/0 historical webhook events had ever reached
// 'processed' status; a live diagnostic call without the header
// against the real paid subscriber's RevenueCat record succeeded
// with HTTP 200 and returned an active "pro" entitlement).
//
// This test proves, from source, that the header is not sent.
// ─────────────────────────────────────────────────────────────

import * as fs from 'fs'
import * as path from 'path'

const restSource = fs.readFileSync(
  path.resolve(__dirname, '../revenuecat-webhook/revenueCatRest.ts'),
  'utf8',
)

describe('fetchProEntitlement — RevenueCat REST headers', () => {
  it('does NOT send an X-Platform header alongside the Secret API key', () => {
    // The Secret key + X-Platform combination is rejected by
    // RevenueCat with HTTP 403 (code 7243). Server-to-server calls
    // must omit platform-identifying headers entirely.
    // (Explanatory comments may still mention the string "X-Platform"
    // — assert there is no actual header property in the fetch call.)
    expect(restSource).not.toMatch(/'X-Platform'\s*:/)
  })

  it('sends only the Authorization bearer header to the subscribers endpoint', () => {
    const fetchIdx = restSource.indexOf('const resp = await fetch(url')
    expect(fetchIdx).toBeGreaterThan(-1)
    const fetchBlock = restSource.slice(fetchIdx, fetchIdx + 300)
    expect(fetchBlock).toMatch(/Authorization:\s*`Bearer \$\{serverApiKey\}`/)
  })

  it('fetches the correct RevenueCat REST endpoint', () => {
    expect(restSource).toContain('https://api.revenuecat.com/v1/subscribers/')
  })
})

describe('fetchProEntitlement — behavioral simulation of the fix', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetModules()
  })

  it('a request without X-Platform succeeds where one with it would 403 (documented via mock)', async () => {
    let capturedHeaders: Record<string, string> = {}
    global.fetch = jest.fn(async (_url: any, init: any) => {
      capturedHeaders = init.headers
      // Simulate RevenueCat's real behavior: reject any request that
      // includes X-Platform when using a secret key.
      if ('X-Platform' in capturedHeaders) {
        return {
          status: 403,
          json: async () => ({ code: 7243, message: 'Secret API keys should not be used in your app.' }),
          text: async () => JSON.stringify({ code: 7243 }),
        } as any
      }
      return {
        status: 200,
        json: async () => ({
          subscriber: {
            original_app_user_id: '6a169845-4384-4049-aff4-263f469696ae',
            entitlements: {
              pro: { expires_date: null, product_identifier: 'juicing_daily_pro' },
            },
            subscriptions: {},
          },
        }),
      } as any
    }) as any

    // Re-require the module fresh so it picks up the mocked fetch.
    const { fetchProEntitlement } = require('../revenuecat-webhook/revenueCatRest')
    const result = await fetchProEntitlement('6a169845-4384-4049-aff4-263f469696ae', 'sk_test_key')

    expect(result.ok).toBe(true)
    expect(capturedHeaders).not.toHaveProperty('X-Platform')
  })

  it('combines product_identifier + product_plan_identifier into "id:plan" (confirmed production bug: REST omits base-plan suffix from product_identifier alone)', async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      json: async () => ({
        subscriber: {
          original_app_user_id: '6a169845-4384-4049-aff4-263f469696ae',
          entitlements: {
            pro: {
              expires_date: '2026-09-30T14:26:16Z',
              product_identifier: 'juicing_daily_pro',
              product_plan_identifier: 'monthly',
            },
          },
          subscriptions: {
            juicing_daily_pro: {
              store: 'play_store',
              is_sandbox: false,
              ownership_type: 'PURCHASED',
            },
          },
        },
      }),
    })) as any

    const { fetchProEntitlement } = require('../revenuecat-webhook/revenueCatRest')
    const result = await fetchProEntitlement('6a169845-4384-4049-aff4-263f469696ae', 'sk_test_key')

    expect(result.ok).toBe(true)
    expect(result.entitlement?.productId).toBe('juicing_daily_pro:monthly')
    expect(result.entitlement?.store).toBe('play_store')
    expect(result.entitlement?.isActive).toBe(true)
  })
})
