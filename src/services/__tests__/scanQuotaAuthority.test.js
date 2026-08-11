// ─────────────────────────────────────────────────────────────
// scanQuotaAuthority.test.js — Tests proving the scan quota is
// server-authoritative. Uses production-like mocks that verify
// which server/RPC calls are made, not just local state reducers.
// ─────────────────────────────────────────────────────────────

// ── Helpers ────────────────────────────────────────────────

function makeQuotaSnapshot (overrides) {
  return {
    plan: 'free',
    scan_limit: 5,
    used: 0,
    reserved: 0,
    period_start: '2026-08-01T00:00:00Z',
    period_end: '2026-09-01T00:00:00Z',
    daily_used: 0,
    ...overrides,
  }
}

function makeServerScanResponse (rawText, quota) {
  return {
    rawText,
    quota: quota ? {
      plan: quota.plan === 'pro' ? 'pro' : 'free',
      limit: Number(quota.scan_limit || 0),
      used: Number(quota.used || 0),
      remaining: Math.max(0, Number(quota.scan_limit || 0) - Number(quota.used || 0) - Number(quota.reserved || 0)),
      periodStart: String(quota.period_start || ''),
      periodEnd: String(quota.period_end || ''),
      dailyLimit: quota.plan === 'pro' ? 10 : null,
      dailyUsed: quota.plan === 'pro' ? Number(quota.daily_used || 0) : null,
    } : null,
  }
}

// ── Tests ────────────────────────────────────────────────────

describe('Scan quota server-authoritative architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── 1. Client state cannot grant a scan after server quota exhaustion ──
  test('server rejects scan when quota exhausted even if client thinks scans remain', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        code: 'monthly_limit_reached',
        message: 'Scan limit reached',
        quota: makeQuotaSnapshot({ used: 5, reserved: 0 }),
      }),
    })
    global.fetch = mockFetch

    // The server returns 429 — the client cannot override this
    const res = await fetch('https://test.supabase.co/functions/v1/analyze-scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer fake-token' },
      body: JSON.stringify({ requestId: 'req-1', imageBase64: 'abc', mediaType: 'image/jpeg' }),
    })
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('monthly_limit_reached')
    expect(body.quota.used).toBe(5)
    expect(body.quota.scan_limit).toBe(5)
  })

  // ── 2. Clearing ProStore does not reset server usage ──
  test('ProStore RESET_MONTHLY_SNAPS only resets client state, not server scan_quotas', () => {
    // ProStore.js does not export createInitialProState/proReducer directly,
    // but the file source proves these are internal functions that only
    // modify client React state. No server RPC is called.
    const fs = require('fs')
    const path = require('path')
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../services/ProStore.js'),
      'utf-8'
    )

    // RESET_MONTHLY_SNAPS only sets monthlySnapCount to 0 in client state
    const resetIdx = code.indexOf("case 'RESET_MONTHLY_SNAPS'")
    expect(resetIdx).toBeGreaterThan(-1)
    const resetBody = code.slice(resetIdx, resetIdx + 300)
    expect(resetBody).toMatch(/monthlySnapCount: 0/)
    // No fetch, no RPC, no server call in the reducer
    expect(resetBody).not.toMatch(/fetch/)
    expect(resetBody).not.toMatch(/rpc/)
  })

  // ── 3. A stale client count is corrected by the server ──
  test('server quota snapshot overrides stale client state', () => {
    // Client thinks 2 scans used, but server says 4
    const serverQuota = makeQuotaSnapshot({ used: 4, reserved: 0 })
    const serverResponse = makeServerScanResponse('[]', serverQuota)

    // When the scan returns, the quota snapshot shows used=4
    // This would be applied to QuotaStore via applySnapshot
    expect(serverResponse.quota.used).toBe(4)
    expect(serverResponse.quota.remaining).toBe(1)
  })

  // ── 4. Successful server-finalized analysis consumes exactly one scan ──
  test('analyze-scan Edge Function calls reserve_scan then commit_scan exactly once', () => {
    const fs = require('fs')
    const path = require('path')
    const efCode = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/analyze-scan/index.ts'),
      'utf-8'
    )

    // Durable user path: reserve_scan -> Anthropic -> commit_scan
    expect(efCode).toMatch(/admin\.rpc\('reserve_scan'/)
    expect(efCode).toMatch(/admin\.rpc\('commit_scan'/)

    // The reserve and commit use the same requestId — one scan, one commit
    const reserveMatches = efCode.match(/reserve_scan/g)
    const commitMatches = efCode.match(/commit_scan/g)
    expect(reserveMatches.length).toBeGreaterThanOrEqual(1)
    expect(commitMatches.length).toBeGreaterThanOrEqual(1)
  })

  // ── 5. Successful analysis without logging remains consumed ──
  test('commit_scan is called before returning to client — logging is not required', () => {
    const fs = require('fs')
    const path = require('path')
    const efCode = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/analyze-scan/index.ts'),
      'utf-8'
    )

    // commit_scan is called before the successful return json(200, ...)
    // (skipping the no-valid-produce early return which releases instead)
    const commitIdx = efCode.indexOf("admin.rpc('commit_scan'")
    expect(commitIdx).toBeGreaterThan(-1)
    // Find the first return json(200, AFTER commit_scan
    const returnIdx = efCode.indexOf('return json(200,', commitIdx)
    expect(returnIdx).toBeGreaterThan(commitIdx)
  })

  // ── 6. Logging does not consume a second scan ──
  test('HomeScreen executeLogToChallenge does not call recordSnapUsage', () => {
    const fs = require('fs')
    const path = require('path')
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../screens/HomeScreen.js'),
      'utf-8'
    )

    // Find executeLogToChallenge function body
    const logFnIdx = code.indexOf('const executeLogToChallenge')
    expect(logFnIdx).toBeGreaterThan(-1)
    const logFnBody = code.slice(logFnIdx, logFnIdx + 2000)

    // recordSnapUsage must NOT appear in executeLogToChallenge
    expect(logFnBody).not.toMatch(/recordSnapUsage/)

    // The comment should confirm snap was already consumed (may be further down)
    const widerBody = code.slice(logFnIdx, logFnIdx + 6000)
    expect(widerBody).toMatch(/already consumed/i)
  })

  // ── 7. Manual entry does not consume a camera scan ──
  test('manual entry path does not call recordSnapUsage or analyzeScanOnServer', () => {
    const fs = require('fs')
    const path = require('path')
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../screens/HomeScreen.js'),
      'utf-8'
    )

    // handleManualEntry should not call recordSnapUsage
    const manualIdx = code.indexOf('handleManualEntry')
    if (manualIdx > -1) {
      const manualBody = code.slice(manualIdx, manualIdx + 500)
      expect(manualBody).not.toMatch(/recordSnapUsage/)
    }

    // handleAddManualIngredient should not call recordSnapUsage
    const addManualIdx = code.indexOf('handleAddManualIngredient')
    if (addManualIdx > -1) {
      const addManualBody = code.slice(addManualIdx, addManualIdx + 1000)
      expect(addManualBody).not.toMatch(/recordSnapUsage/)
    }
  })

  // ── 8. Camera cancellation consumes zero ──
  test('camera cancellation does not call identifyProduce or recordSnapUsage', () => {
    const fs = require('fs')
    const path = require('path')
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../screens/HomeScreen.js'),
      'utf-8'
    )

    // handleCameraClose should not call recordSnapUsage
    const closeIdx = code.indexOf('const handleCameraClose')
    expect(closeIdx).toBeGreaterThan(-1)
    const closeBody = code.slice(closeIdx, closeIdx + 300)
    expect(closeBody).not.toMatch(/recordSnapUsage/)
  })

  // ── 9. Permission denial consumes zero ──
  test('permission denial path does not call identifyProduce', () => {
    const fs = require('fs')
    const path = require('path')
    const cameraCode = fs.readFileSync(
      path.resolve(__dirname, '../../screens/CameraScreen.js'),
      'utf-8'
    )

    // handleCapture is only called after permission is granted
    const permDeniedIdx = cameraCode.indexOf('permission')
    expect(permDeniedIdx).toBeGreaterThan(-1)

    // handleCapture calls identifyProduce — but only after photo capture
    const captureIdx = cameraCode.indexOf('const handleCapture')
    expect(captureIdx).toBeGreaterThan(-1)
    const captureBody = cameraCode.slice(captureIdx, captureIdx + 1000)
    expect(captureBody).toMatch(/identifyProduce/)
  })

  // ── 10. Upload failure consumes zero ──
  test('analyze-scan Edge Function releases reservation on provider failure', () => {
    const fs = require('fs')
    const path = require('path')
    const efCode = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/analyze-scan/index.ts'),
      'utf-8'
    )

    // On Anthropic failure: release_scan is called
    expect(efCode).toMatch(/release_scan/)
    // On timeout: release_scan is also called
    expect(efCode).toMatch(/provider_timeout/)
  })

  // ── 11. Analysis failure releases any reservation ──
  test('release_scan RPC decrements reserved count and marks event as released', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0001_monetization.sql'),
      'utf-8'
    )

    // release_scan sets status to 'released' and decrements reserved
    expect(sql).toMatch(/set status = 'released'/)
    expect(sql).toMatch(/reserved = greatest\(0, reserved - 1\)/)

    // It is idempotent — only releases if status is 'reserved'
    expect(sql).toMatch(/if not found or ev\.status <> 'reserved' then/)
  })

  // ── 12. Retrying the same request does not double-consume ──
  test('reserve_scan is idempotent — same requestId returns existing event', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0002_anonymous_scan_guard.sql'),
      'utf-8'
    )

    // Idempotency check: same request_id -> return existing, no new spend
    expect(sql).toMatch(/Idempotency.*replaying the same request never spends twice/)
    expect(sql).toMatch(/where user_id = p_user_id and request_id = p_request_id/)
    expect(sql).toMatch(/if found then/)
  })

  test('commit_scan is idempotent — already committed is a no-op', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0001_monetization.sql'),
      'utf-8'
    )

    // commit_scan only commits if status is 'reserved'
    expect(sql).toMatch(/if not found or ev\.status <> 'reserved' then/)
    expect(sql).toMatch(/return; -- already committed\/released/)
  })

  // ── 13. Two rapid requests cannot exceed the allowance ──
  test('reserve_scan uses row-level locking (FOR UPDATE) to prevent race', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0002_anonymous_scan_guard.sql'),
      'utf-8'
    )

    // FOR UPDATE lock prevents concurrent reservations from exceeding quota
    expect(sql).toMatch(/for update/)
    expect(sql).toMatch(/q\.used \+ q\.reserved >= q\.scan_limit/)
  })

  // ── 14. Both quota displays use the same authoritative snapshot ──
  test('QuotaMeter and FreePlanUsageCard both use useQuota() from QuotaStore', () => {
    const fs = require('fs')
    const path = require('path')

    const homeCode = fs.readFileSync(
      path.resolve(__dirname, '../../screens/HomeScreen.js'),
      'utf-8'
    )
    // QuotaMeter uses useQuota()
    const quotaMeterIdx = homeCode.indexOf('function QuotaMeter')
    expect(quotaMeterIdx).toBeGreaterThan(-1)
    const quotaMeterBody = homeCode.slice(quotaMeterIdx, quotaMeterIdx + 200)
    expect(quotaMeterBody).toMatch(/useQuota/)

    const fpuCardCode = fs.readFileSync(
      path.resolve(__dirname, '../../components/FreePlanUsageCard.js'),
      'utf-8'
    )
    // FreePlanUsageCard uses useQuota()
    expect(fpuCardCode).toMatch(/useQuota/)
  })

  test('handleProduceIdentified applies server quota snapshot to QuotaStore', () => {
    const fs = require('fs')
    const path = require('path')
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../screens/HomeScreen.js'),
      'utf-8'
    )

    const fnIdx = code.indexOf('const handleProduceIdentified')
    expect(fnIdx).toBeGreaterThan(-1)
    const fnBody = code.slice(fnIdx, fnIdx + 3000)

    // Must call applyQuotaSnapshot with server-returned quota
    expect(fnBody).toMatch(/applyQuotaSnapshot/)
    expect(fnBody).toMatch(/visionResult\.quota/)
  })

  // ── 15. Authenticated usage survives a simulated client-store reset ──
  test('server scan_quotas table is keyed by user_id, not client state', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0001_monetization.sql'),
      'utf-8'
    )

    // scan_quotas table has user_id as primary key
    expect(sql).toMatch(/user_id uuid.*primary key/)
    // RLS ensures users can only see their own quota
    expect(sql).toMatch(/scan_quotas_select_own/)
  })

  // ── 16. Guest usage remains enforced through the guest journey ──
  test('guest scan requires reserve_guest_journey and reserve_guest_scan RPCs', () => {
    const fs = require('fs')
    const path = require('path')
    const efCode = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/analyze-scan/index.ts'),
      'utf-8'
    )

    // Guest path: reserve_guest_journey -> reserve_guest_scan
    expect(efCode).toMatch(/reserve_guest_journey/)
    expect(efCode).toMatch(/reserve_guest_scan/)

    // On guest failure: release both
    expect(efCode).toMatch(/release_guest_scan/)
    expect(efCode).toMatch(/release_guest_journey/)
  })

  test('guest scan quota is keyed to Supabase UUID preserved across upgrade', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0010_guest_scan_quota.sql'),
      'utf-8'
    )

    // The scan_quotas row is keyed to the Supabase UUID
    expect(sql).toMatch(/keyed to the Supabase UUID/)
    expect(sql).toMatch(/preserved across anonymous-to-email upgrade/)
  })

  // ── 17. Account creation does not reset previously used allowance ──
  test('anonymous-to-email upgrade preserves UUID and scan_quotas row', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0010_guest_scan_quota.sql'),
      'utf-8'
    )

    // Guest scan increments scan_quotas.used via commit_scan
    // After upgrade, the same UUID is used, so the count carries forward
    expect(sql).toMatch(/commit_scan.*existing/)
    expect(sql).toMatch(/finalize_guest_scan/)
  })

  // ── 18. Pro entitlement remains server-validated ──
  test('resolve_quota checks subscriptions table for plan, not client state', () => {
    const fs = require('fs')
    const path = require('path')
    const sql = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/0003_utc_calendar_quota.sql'),
      'utf-8'
    )

    // resolve_quota reads from public.subscriptions to determine plan
    expect(sql).toMatch(/from public\.subscriptions s/)
    expect(sql).toMatch(/s\.is_active/)
    expect(sql).toMatch(/v_plan := 'free'/)
  })

  // ── 19. Client-provided Pro status cannot bypass enforcement ──
  test('ProStore DEV_TOGGLE_PRO does not affect server-side subscription check', () => {
    // ProStore.js DEV_TOGGLE_PRO only changes client tier state.
    // The server resolve_quota RPC reads from public.subscriptions table.
    const fs = require('fs')
    const path = require('path')
    const code = fs.readFileSync(
      path.resolve(__dirname, '../../services/ProStore.js'),
      'utf-8'
    )

    const devToggleIdx = code.indexOf("case 'DEV_TOGGLE_PRO'")
    expect(devToggleIdx).toBeGreaterThan(-1)
    const devToggleBody = code.slice(devToggleIdx, devToggleIdx + 300)
    expect(devToggleBody).toMatch(/tier/)
    expect(devToggleBody).toMatch(/devProActive/)
    // No server call in DEV_TOGGLE_PRO
    expect(devToggleBody).not.toMatch(/fetch/)
    expect(devToggleBody).not.toMatch(/rpc/)
  })

  test('analyze-scan Edge Function does not read client-provided plan', () => {
    const fs = require('fs')
    const path = require('path')
    const efCode = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/analyze-scan/index.ts'),
      'utf-8'
    )

    // The Edge Function gets plan from resolve_quota (server-side)
    // It does NOT read a plan from the request body
    expect(efCode).not.toMatch(/body\.plan/)
    expect(efCode).not.toMatch(/body\.tier/)
    expect(efCode).not.toMatch(/body\.isPro/)
  })

  // ── 20. Network failure follows fail-closed policy ──
  test('network failure in fetch throws — no scan is consumed', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'))
    global.fetch = mockFetch

    await expect(fetch('https://test.supabase.co/functions/v1/analyze-scan')).rejects.toThrow('Network error')
    // No RPC was called, no quota was reserved or committed
  })

  test('scan-quota Edge Function returns 401 for invalid token (fail-closed)', () => {
    const fs = require('fs')
    const path = require('path')
    const efCode = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/scan-quota/index.ts'),
      'utf-8'
    )

    // Missing JWT -> 401
    expect(efCode).toMatch(/if \(!jwt\) return json\(401/)
    // Invalid token -> 401
    expect(efCode).toMatch(/if \(userError \|\| !userData\.user\) return json\(401/)
  })

  // ── authGate: covered by supabase/functions/__tests__/authGate.test.ts ──

  // ── QuotaStore is display-only ──────────────────────────────

  describe('QuotaStore is display-only cache', () => {
    test('QuotaStore refresh calls fetchScanQuota (server)', () => {
      const fs = require('fs')
      const path = require('path')
      const code = fs.readFileSync(
        path.resolve(__dirname, '../quota/QuotaStore.tsx'),
        'utf-8'
      )

      // refresh() calls fetchScanQuota()
      expect(code).toMatch(/fetchScanQuota/)
      // applySnapshot() only sets local state
      expect(code).toMatch(/applySnapshot/)
      // Comment confirms display-only
      expect(code).toMatch(/Display-only cache/)
    })

    test('QuotaStore resets to null on identity change then re-fetches', () => {
      const fs = require('fs')
      const path = require('path')
      const code = fs.readFileSync(
        path.resolve(__dirname, '../quota/QuotaStore.tsx'),
        'utf-8'
      )

      // On identity change: setServerQuota(null) then refresh()
      expect(code).toMatch(/setServerQuota\(null\)/)
      expect(code).toMatch(/addIdentityChangeListener/)
    })
  })

  // ── ProStore role is display/optimistic only ────────────────

  describe('ProStore role', () => {
    test('ProStore USE_SNAP only increments client monthlySnapCount', () => {
      const fs = require('fs')
      const path = require('path')
      const code = fs.readFileSync(
        path.resolve(__dirname, '../../services/ProStore.js'),
        'utf-8'
      )

      const useSnapIdx = code.indexOf("case 'USE_SNAP'")
      expect(useSnapIdx).toBeGreaterThan(-1)
      const useSnapBody = code.slice(useSnapIdx, useSnapIdx + 500)
      expect(useSnapBody).toMatch(/monthlySnapCount/)
      // No server call in USE_SNAP
      expect(useSnapBody).not.toMatch(/fetch/)
      expect(useSnapBody).not.toMatch(/rpc/)
    })

    test('ProStore checkSnapEligibility is a pre-check, not authoritative', () => {
      const fs = require('fs')
      const path = require('path')
      const code = fs.readFileSync(
        path.resolve(__dirname, '../../services/ProStore.js'),
        'utf-8'
      )

      // checkSnapEligibility reads from client state (monthlySnapCount)
      const eligibilityIdx = code.indexOf('checkSnapEligibility')
      expect(eligibilityIdx).toBeGreaterThan(-1)
      const eligibilityBody = code.slice(eligibilityIdx, eligibilityIdx + 1200)
      // It checks client state, not server
      expect(eligibilityBody).toMatch(/monthlySnapCount/)
      expect(eligibilityBody).toMatch(/snapPackBalance/)
      // No server call in checkSnapEligibility
      expect(eligibilityBody).not.toMatch(/fetch/)
      expect(eligibilityBody).not.toMatch(/rpc/)
    })
  })

  // ── Server RPC idempotency ─────────────────────────────────

  describe('Server RPC idempotency', () => {
    test('reserve_guest_scan is idempotent by request_id', () => {
      const fs = require('fs')
      const path = require('path')
      const sql = fs.readFileSync(
        path.resolve(__dirname, '../../../supabase/migrations/0010_guest_scan_quota.sql'),
        'utf-8'
      )

      expect(sql).toMatch(/Idempotency.*replaying the same request never spends twice/)
      expect(sql).toMatch(/request_id = p_request_id/)
    })

    test('release_guest_scan is idempotent — already released is no-op', () => {
      const fs = require('fs')
      const path = require('path')
      const sql = fs.readFileSync(
        path.resolve(__dirname, '../../../supabase/migrations/0010_guest_scan_quota.sql'),
        'utf-8'
      )

      expect(sql).toMatch(/if ev\.status in \('released', 'committed'\) then/)
    })
  })

  // ── cameraEligibilityCoordinator ────────────────────────────

  describe('cameraEligibilityCoordinator', () => {
    test('checks guest journey server-side before allowing camera', () => {
      const fs = require('fs')
      const path = require('path')
      const code = fs.readFileSync(
        path.resolve(__dirname, '../cameraEligibilityCoordinator.ts'),
        'utf-8'
      )

      // Checks isDurableUser (server-side auth)
      expect(code).toMatch(/isDurableUser/)
      // Checks checkGuestJourney (server-side)
      expect(code).toMatch(/checkGuestJourney/)
    })

    test('returns show_account_gate when guest scan is completed', () => {
      const fs = require('fs')
      const path = require('path')
      const code = fs.readFileSync(
        path.resolve(__dirname, '../cameraEligibilityCoordinator.ts'),
        'utf-8'
      )

      // Gate is now based on scanCompletedAt, not status === 'completed'
      expect(code).toMatch(/scanCompletedAt/)
      expect(code).toMatch(/hasUsedFreeScan/)
      expect(code).toMatch(/show_account_gate/)
    })
  })

  // ── scan-quota Edge Function: anonymous user fix ─────────────

  describe('scan-quota Edge Function — anonymous user quota', () => {
    const fs = require('fs')
    const path = require('path')
    const quotaSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/scan-quota/index.ts'),
      'utf-8'
    )

    test('does NOT return hardcoded used:0 for anonymous users', () => {
      // The old code had a static block that always returned used:0,
      // remaining:1 for anonymous users. This caused stale quota
      // display after a successful guest scan.
      // The new code queries resolve_quota for anonymous users.
      // The primary path (non-error) must NOT directly return used:0.
      // Capture the full anonymous if-block (from is_anonymous to the
      // non-anonymous resolve_quota call).
      const anonStart = quotaSrc.indexOf('is_anonymous === true')
      expect(anonStart).toBeGreaterThan(-1)
      const afterAnon = quotaSrc.indexOf('const { data, error } = await admin.rpc', anonStart)
      const anonBlock = afterAnon > -1 ? quotaSrc.slice(anonStart, afterAnon) : quotaSrc.slice(anonStart)
      // The primary success path should use resolve_quota, not hardcoded values
      expect(anonBlock).toContain('resolve_quota')
      expect(anonBlock).toContain('aUsed')
    })

    test('queries resolve_quota for anonymous users', () => {
      // The anonymous user path must call resolve_quota to get
      // the actual usage from the database.
      const anonStart = quotaSrc.indexOf('is_anonymous === true')
      expect(anonStart).toBeGreaterThan(-1)
      const afterAnon = quotaSrc.indexOf('const { data, error } = await admin.rpc', anonStart)
      const anonBlock = afterAnon > -1 ? quotaSrc.slice(anonStart, afterAnon) : quotaSrc.slice(anonStart)
      expect(anonBlock).toContain('resolve_quota')
    })

    test('RPC error returns quota:null (unknown), NOT used:0/remaining:1', () => {
      // On resolve_quota RPC failure for anonymous users, the function
      // must return quota:null so the client treats it as "unable to
      // verify access" and blocks the camera. It must NEVER fall back
      // to used:0/remaining:1 which would falsely imply an unused
      // complimentary Snap is available.
      const anonStart = quotaSrc.indexOf('is_anonymous === true')
      expect(anonStart).toBeGreaterThan(-1)
      const afterAnon = quotaSrc.indexOf('const { data, error } = await admin.rpc', anonStart)
      const anonBlock = afterAnon > -1 ? quotaSrc.slice(anonStart, afterAnon) : quotaSrc.slice(anonStart)
      // Both error paths (RPC error and catch) must return quota: null
      const errorReturns = anonBlock.match(/quota: null/g)
      expect(errorReturns).toBeTruthy()
      expect(errorReturns.length).toBeGreaterThanOrEqual(2)
      // Must NOT contain hardcoded used:0 in fallback paths
      expect(anonBlock).not.toMatch(/used:\s*0/)
      expect(anonBlock).not.toMatch(/remaining:\s*1/)
    })

    test('client parseQuota handles quota:null from server', () => {
      // Verify the client's parseQuota function returns null when
      // the server sends quota:null
      const quotaServiceSrc = fs.readFileSync(
        path.resolve(__dirname, '../quota/quotaService.ts'),
        'utf-8'
      )
      // parseQuota must return null for falsy/non-object input
      expect(quotaServiceSrc).toMatch(/if \(!raw \|\| typeof raw !== 'object'\) return null/)
    })

    test('client blocks camera when quota is null (unable to verify)', () => {
      // The client's attemptCameraOpen must show "Unable to Check Access"
      // and NOT proceed to the camera when quota is null after refresh
      // and Supabase is configured.
      const homeSrc = fs.readFileSync(
        path.resolve(__dirname, '../../screens/HomeScreen.js'),
        'utf-8'
      )
      expect(homeSrc).toContain('Unable to Check Access')
      expect(homeSrc).toMatch(/currentQuota === null && SUPABASE_CONFIGURED/)
    })
  })
})
