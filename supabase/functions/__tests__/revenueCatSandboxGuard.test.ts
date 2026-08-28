// ─────────────────────────────────────────────────────────────
// revenueCatSandboxGuard.test.ts — Regression tests proving
// SANDBOX RevenueCat events can never activate production Pro
// entitlement by default (P1 security fix).
//
// Prior defect: revenuecat-webhook/index.ts computed
// event.environment but never used it to gate the call to
// apply_revenuecat_event(), so a SANDBOX purchase event (delivered
// to the same webhook URL as production events by default) could
// set subscriptions.is_active = true for a real account.
//
// Fix: shouldSkipSandboxEvent() (revenuecat-webhook/sandboxGuard.ts)
// is a pure, server-controlled decision — environment comes from
// RevenueCat's own event classification, and the escape hatch
// (allowSandboxEntitlement) is ONLY ever derived from a Supabase
// function secret, never from client/request input.
// ─────────────────────────────────────────────────────────────

import { shouldSkipSandboxEvent } from '../revenuecat-webhook/sandboxGuard'

describe('shouldSkipSandboxEvent — pure decision function', () => {
  test('1. SANDBOX INITIAL_PURCHASE-equivalent (environment=sandbox) is skipped by default', () => {
    expect(shouldSkipSandboxEvent('sandbox', false)).toBe(true)
  })

  test('2. SANDBOX RENEWAL-equivalent is skipped by default', () => {
    // eventType is irrelevant to this guard — it operates purely on
    // environment, so any lifecycle event type in sandbox is skipped.
    expect(shouldSkipSandboxEvent('sandbox', false)).toBe(true)
  })

  test('3. PRODUCTION events are never skipped by this guard', () => {
    expect(shouldSkipSandboxEvent('production', false)).toBe(false)
    expect(shouldSkipSandboxEvent('production', true)).toBe(false)
  })

  test('4. SANDBOX is only allowed through when allowSandboxEntitlement=true (server-only escape hatch)', () => {
    expect(shouldSkipSandboxEvent('sandbox', true)).toBe(false)
  })

  test('5. Default (no explicit flag) treats sandbox as skip — fail closed', () => {
    // Simulates Deno.env.get(...) returning undefined -> '1' comparison false
    const allowSandboxEntitlement = (undefined as unknown as string) === '1'
    expect(shouldSkipSandboxEvent('sandbox', allowSandboxEntitlement)).toBe(true)
  })
})

describe('revenuecat-webhook/index.ts — sandbox guard wiring (source verification)', () => {
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'revenuecat-webhook', 'index.ts'),
    'utf-8',
  )

  test('6. Guard is derived from Deno.env.get, never from client/event/request body', () => {
    expect(src).toMatch(
      /allowSandboxEntitlement\s*=\s*Deno\.env\.get\('REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT'\)\s*===\s*'1'/,
    )
    // Must not read an equivalent flag from the event payload or body
    expect(src).not.toMatch(/event\.allow_sandbox/)
    expect(src).not.toMatch(/body\.allowSandbox/)
  })

  test('7. Guard runs BEFORE any REST reconciliation / apply_revenuecat_event call', () => {
    const guardIdx = src.indexOf('shouldSkipSandboxEvent(environment, allowSandboxEntitlement)')
    const restIdx = src.indexOf('fetchProEntitlement(lookupKey')
    const applyIdx = src.indexOf("admin.rpc('apply_revenuecat_event'")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(restIdx).toBeGreaterThan(-1)
    expect(applyIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(restIdx)
    expect(guardIdx).toBeLessThan(applyIdx)
  })

  test('8. Skipped sandbox events return HTTP 200 (no retry storm) and mark status skipped, not failed', () => {
    const skipBlockMatch = src.match(
      /if \(shouldSkipSandboxEvent\(environment, allowSandboxEntitlement\)\) \{[\s\S]*?sandbox_environment_not_authoritative[\s\S]*?\}\)\n {2}\}/,
    )
    expect(skipBlockMatch).toBeTruthy()
    expect(skipBlockMatch![0]).toContain("status: 'skipped'")
    expect(skipBlockMatch![0]).toContain('json(200,')
    expect(skipBlockMatch![0]).not.toContain("status: 'failed'")
  })

  test('9. Production events still reach apply_revenuecat_event unaffected by the guard', () => {
    // The guard only early-returns for skip; production flow below it
    // is untouched and still calls apply_revenuecat_event with
    // p_environment derived from the same `environment` variable.
    expect(src).toContain('p_environment: environment')
  })
})
