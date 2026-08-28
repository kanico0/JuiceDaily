// ─────────────────────────────────────────────────────────────
// revenueCatSandboxGuard.test.ts — Regression tests proving
// SANDBOX RevenueCat events can never activate production Pro
// entitlement for an ordinary user, while a small server-only
// allowlist of App-Review reviewer UUIDs (resolved via canonical,
// auth.users-validated identity — never the raw webhook payload)
// may legitimately receive sandbox-purchase-driven Pro so a
// reviewer can validate the real subscription experience.
//
// Architecture (see revenuecat-webhook/index.ts):
//   1. environment === 'sandbox' && !restConfigured → skip immediately
//      (fail closed — cannot safely resolve canonical identity)
//   2. Otherwise, sandbox events go through the SAME RevenueCat REST
//      reconciliation + auth.users validation as production events.
//   3. Only AFTER canonicalUuid is resolved and validated is the
//      final decision made: skip unless the global escape hatch
//      (REVENUECAT_ALLOW_SANDBOX_ENTITLEMENT, never used in
//      production) is set, or the canonical UUID is on the
//      server-only REVENUECAT_SANDBOX_REVIEWER_UUIDS allowlist.
// ─────────────────────────────────────────────────────────────

import {
  shouldSkipSandboxEvent,
  shouldSkipSandboxEventForCanonicalUser,
  parseSandboxReviewerAllowlist,
  isSandboxReviewerAllowed,
} from '../revenuecat-webhook/sandboxGuard'

const REVIEWER_UUID = '11111111-1111-1111-1111-111111111111'
const OTHER_UUID = '22222222-2222-2222-2222-222222222222'

describe('shouldSkipSandboxEvent — early REST-unavailable bail-out', () => {
  test('1. SANDBOX is skipped by default (no REST, no global flag)', () => {
    expect(shouldSkipSandboxEvent('sandbox', false)).toBe(true)
  })

  test('2. PRODUCTION events are never skipped by this guard', () => {
    expect(shouldSkipSandboxEvent('production', false)).toBe(false)
    expect(shouldSkipSandboxEvent('production', true)).toBe(false)
  })

  test('3. Global escape hatch (never used in production) allows sandbox through this guard', () => {
    expect(shouldSkipSandboxEvent('sandbox', true)).toBe(false)
  })
})

describe('parseSandboxReviewerAllowlist', () => {
  test('4. parses comma-separated UUIDs, trims, lowercases', () => {
    expect(parseSandboxReviewerAllowlist(` ${REVIEWER_UUID.toUpperCase()} , ${OTHER_UUID} `)).toEqual([
      REVIEWER_UUID,
      OTHER_UUID,
    ])
  })

  test('5. empty/unset value produces an empty allowlist (fail closed)', () => {
    expect(parseSandboxReviewerAllowlist(undefined)).toEqual([])
    expect(parseSandboxReviewerAllowlist(null)).toEqual([])
    expect(parseSandboxReviewerAllowlist('')).toEqual([])
  })

  test('6. filters out empty segments from trailing/double commas', () => {
    expect(parseSandboxReviewerAllowlist(`${REVIEWER_UUID},,`)).toEqual([REVIEWER_UUID])
  })
})

describe('isSandboxReviewerAllowed', () => {
  const allowlist = parseSandboxReviewerAllowlist(REVIEWER_UUID)

  test('7. allowlisted canonical UUID is allowed (case-insensitive)', () => {
    expect(isSandboxReviewerAllowed(REVIEWER_UUID.toUpperCase(), allowlist)).toBe(true)
  })

  test('8. non-allowlisted canonical UUID is rejected', () => {
    expect(isSandboxReviewerAllowed(OTHER_UUID, allowlist)).toBe(false)
  })

  test('9. empty/malformed canonical UUID is rejected regardless of allowlist', () => {
    expect(isSandboxReviewerAllowed('', allowlist)).toBe(false)
    expect(isSandboxReviewerAllowed('not-a-uuid', allowlist)).toBe(false)
  })

  test('10. empty allowlist rejects everything (fail closed)', () => {
    expect(isSandboxReviewerAllowed(REVIEWER_UUID, [])).toBe(false)
  })
})

describe('shouldSkipSandboxEventForCanonicalUser — final post-reconciliation decision', () => {
  const allowlist = parseSandboxReviewerAllowlist(REVIEWER_UUID)

  test('11. ordinary sandbox user (not on allowlist) is skipped', () => {
    expect(
      shouldSkipSandboxEventForCanonicalUser('sandbox', false, OTHER_UUID, allowlist),
    ).toBe(true)
  })

  test('12. allowlisted canonical reviewer UUID is accepted (not skipped)', () => {
    expect(
      shouldSkipSandboxEventForCanonicalUser('sandbox', false, REVIEWER_UUID, allowlist),
    ).toBe(false)
  })

  test('13. forged/mismatched canonical identity (resolved via REST, differs from reviewer UUID) is still skipped', () => {
    // Simulates: attacker sends event.app_user_id = REVIEWER_UUID, but
    // RevenueCat REST resolves subscriber.original_app_user_id to a
    // DIFFERENT real canonical UUID. The check only ever runs against
    // the REST-resolved, validated canonicalUuid — never the raw
    // event payload — so this is correctly rejected.
    const restResolvedCanonicalUuid = OTHER_UUID // NOT the reviewer UUID
    expect(
      shouldSkipSandboxEventForCanonicalUser(
        'sandbox',
        false,
        restResolvedCanonicalUuid,
        allowlist,
      ),
    ).toBe(true)
  })

  test('14. nonexistent/empty canonical UUID is rejected/skipped', () => {
    expect(shouldSkipSandboxEventForCanonicalUser('sandbox', false, '', allowlist)).toBe(true)
  })

  test('15. malformed UUID is rejected/skipped', () => {
    expect(
      shouldSkipSandboxEventForCanonicalUser('sandbox', false, 'malformed-uuid', allowlist),
    ).toBe(true)
  })

  test('16. production events are never skipped, regardless of allowlist', () => {
    expect(
      shouldSkipSandboxEventForCanonicalUser('production', false, OTHER_UUID, allowlist),
    ).toBe(false)
    expect(
      shouldSkipSandboxEventForCanonicalUser('production', false, REVIEWER_UUID, allowlist),
    ).toBe(false)
  })

  test('17. global sandbox flag (never set in production) allows any sandbox user through independent of allowlist', () => {
    expect(
      shouldSkipSandboxEventForCanonicalUser('sandbox', true, OTHER_UUID, allowlist),
    ).toBe(false)
  })

  test('18. empty allowlist + global flag off → all sandbox users skipped (safe default with no reviewer configured)', () => {
    expect(
      shouldSkipSandboxEventForCanonicalUser('sandbox', false, REVIEWER_UUID, []),
    ).toBe(true)
  })
})

describe('revenuecat-webhook/index.ts — sandbox architecture wiring (source verification)', () => {
  const fs = require('fs')
  const path = require('path')
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'revenuecat-webhook', 'index.ts'),
    'utf-8',
  )

  test('19. Reviewer allowlist is derived from Deno.env.get, never from client/event/request body', () => {
    expect(src).toMatch(
      /parseSandboxReviewerAllowlist\(\s*Deno\.env\.get\('REVENUECAT_SANDBOX_REVIEWER_UUIDS'\)/,
    )
    expect(src).not.toMatch(/event\.reviewer/)
    expect(src).not.toMatch(/body\.reviewer/)
    expect(src).not.toMatch(/body\.allowSandbox/)
  })

  test('20. Early bail-out (no REST) runs before lookup key extraction / REST reconciliation', () => {
    const bailIdx = src.indexOf("environment === 'sandbox' && !restConfigured")
    const restIdx = src.indexOf('fetchProEntitlement(lookupKey')
    expect(bailIdx).toBeGreaterThan(-1)
    expect(restIdx).toBeGreaterThan(-1)
    expect(bailIdx).toBeLessThan(restIdx)
  })

  test('21. Final sandbox decision runs AFTER REST reconciliation and auth.users validation, and BEFORE apply_revenuecat_event', () => {
    const restIdx = src.indexOf('fetchProEntitlement(lookupKey')
    const validateIdx = src.indexOf('validateCanonicalUser(admin, canonicalUuid)')
    const finalCheckIdx = src.indexOf('shouldSkipSandboxEventForCanonicalUser(')
    const applyIdx = src.indexOf("admin.rpc('apply_revenuecat_event'")
    expect(restIdx).toBeGreaterThan(-1)
    expect(validateIdx).toBeGreaterThan(-1)
    expect(finalCheckIdx).toBeGreaterThan(-1)
    expect(applyIdx).toBeGreaterThan(-1)
    expect(restIdx).toBeLessThan(finalCheckIdx)
    expect(validateIdx).toBeLessThan(finalCheckIdx)
    expect(finalCheckIdx).toBeLessThan(applyIdx)
  })

  test('22. Skipped sandbox events (final decision) return HTTP 200 and mark status skipped, not failed', () => {
    const finalCheckIdx = src.indexOf('shouldSkipSandboxEventForCanonicalUser(')
    const applyIdx = src.indexOf("admin.rpc('apply_revenuecat_event'")
    const block = src.slice(finalCheckIdx, applyIdx)
    expect(block).toContain("status: 'skipped'")
    expect(block).toContain('json(200,')
    expect(block).toContain('sandbox_environment_not_authoritative')
    expect(block).not.toContain("status: 'failed'")
  })

  test('23. Production events still reach apply_revenuecat_event unaffected', () => {
    expect(src).toContain('p_environment: environment')
  })

  test('24. Webhook secret authentication is unchanged (still required for every request)', () => {
    expect(src).toContain("Deno.env.get('REVENUECAT_WEBHOOK_SECRET')")
    expect(src).toMatch(/authHeader !== `Bearer \$\{secret\}`/)
    expect(src).toContain('return json(401,')
  })

  test('25. Idempotency (duplicate event_id) handling is unchanged', () => {
    expect(src).toContain("insertError.code === '23505'")
    expect(src).toContain("existingStatus === 'processed' || existingStatus === 'skipped'")
  })

  test('26. Canonical identity is always resolved via REST + auth.users validation before the allowlist check, never trusting raw event.app_user_id', () => {
    // The allowlist check variable `canonicalUuid` must be assigned
    // from restResult.canonicalUserId, not from event.app_user_id.
    expect(src).toMatch(/canonicalUuid = restResult\.canonicalUserId!/)
    const finalCheckIdx = src.indexOf('shouldSkipSandboxEventForCanonicalUser(')
    const callArgsBlock = src.slice(finalCheckIdx, finalCheckIdx + 300)
    expect(callArgsBlock).toContain('canonicalUuid')
    expect(callArgsBlock).not.toContain('event.app_user_id')
  })
})
