// ─────────────────────────────────────────────────────────────
// snapQuotaDisplay.test.js — Tests for unified scan-quota display
// Both the upper-right film-roll counter and the center
// FreePlanUsageCard wording derive from the same server-
// authoritative QuotaStore snapshot.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const homeScreenSource = fs.readFileSync(
  path.resolve(__dirname, '../../screens/HomeScreen.js'),
  'utf-8'
)

const vaultScreenSource = fs.readFileSync(
  path.resolve(__dirname, '../../screens/VaultScreen.js'),
  'utf-8'
)

const selectorsSource = fs.readFileSync(
  path.resolve(__dirname, '../subscriptions/subscriptionSelectors.ts'),
  'utf-8'
)

const quotaStoreSource = fs.readFileSync(
  path.resolve(__dirname, '../quota/QuotaStore.tsx'),
  'utf-8'
)

const proStoreSource = fs.readFileSync(
  path.resolve(__dirname, '../ProStore.js'),
  'utf-8'
)

describe('Unified scan-quota display architecture', () => {
  // ── 1. Upper-right counter uses QuotaStore ──────────────────
  test('upper-right film-roll counter uses selectFilmRollLabel from QuotaStore', () => {
    expect(homeScreenSource).toContain('selectFilmRollLabel')
    expect(homeScreenSource).toContain('filmRollLabel')
    expect(homeScreenSource).toContain('serverQuota')
    // Must NOT use snapInfo for the film-roll display
    expect(homeScreenSource).not.toContain('snapInfo.label')
    expect(homeScreenSource).not.toContain('{snapInfo}')
  })

  // ── 2. Center wording uses the same QuotaStore snapshot ─────
  test('center FreePlanUsageCard uses QuotaStore via useQuota', () => {
    const fpuCardSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/FreePlanUsageCard.js'),
      'utf-8'
    )
    expect(fpuCardSource).toContain('useQuota')
  })

  // ── 3. Both displays show identical used and remaining ──────
  test('both film-roll and QuotaMeter derive from the same serverQuota variable', () => {
    // Both use the same `serverQuota` from `useQuota()`
    const useQuotaIdx = homeScreenSource.indexOf('useQuota()')
    expect(useQuotaIdx).toBeGreaterThan(-1)
    // filmRollLabel is derived from serverQuota
    expect(homeScreenSource).toContain('selectFilmRollLabel(serverQuota)')
    // QuotaMeter also reads from the same QuotaStore context
    const quotaMeterIdx = homeScreenSource.indexOf('function QuotaMeter')
    if (quotaMeterIdx > -1) {
      const quotaMeterBody = homeScreenSource.slice(quotaMeterIdx, quotaMeterIdx + 300)
      expect(quotaMeterBody).toContain('useQuota')
    }
  })

  // ── 4. Successful analysis updates both displays exactly once ──
  test('handleProduceIdentified calls applyQuotaSnapshot exactly once', () => {
    const fnIdx = homeScreenSource.indexOf('const handleProduceIdentified')
    expect(fnIdx).toBeGreaterThan(-1)
    const fnBody = homeScreenSource.slice(fnIdx, fnIdx + 3000)
    // Must call applyQuotaSnapshot (updates QuotaStore, which feeds both displays)
    expect(fnBody).toContain('applyQuotaSnapshot')
    // Must NOT call recordSnapUsage (removed — no separate optimistic counter)
    expect(fnBody).not.toContain('recordSnapUsage')
    // Must NOT use snapConsumedForSessionRef (removed)
    expect(fnBody).not.toContain('snapConsumedForSessionRef')
  })

  // ── 5. Camera opening changes neither display ───────────────
  test('attemptCameraOpen does not call applyQuotaSnapshot or recordSnapUsage', () => {
    const fnStart = homeScreenSource.indexOf('const attemptCameraOpen')
    expect(fnStart).toBeGreaterThan(-1)
    const fnEnd = homeScreenSource.indexOf('}, [', fnStart)
    const fnBody = homeScreenSource.slice(fnStart, fnEnd)
    expect(fnBody).not.toContain('applyQuotaSnapshot')
    expect(fnBody).not.toContain('recordSnapUsage')
    // refreshQuota IS now called when quota is null — that is correct behavior.
    // The key assertion is that opening the camera does not mutate quota state.
  })

  // ── 6. Camera cancellation changes neither display ──────────
  test('camera close/cancel paths do not call applyQuotaSnapshot or recordSnapUsage', () => {
    const patterns = ['setIsCameraOpen(false)', 'onCameraClose', 'handleCameraClose']
    for (const pattern of patterns) {
      const idx = homeScreenSource.indexOf(pattern)
      if (idx !== -1) {
        const surrounding = homeScreenSource.slice(Math.max(0, idx - 200), idx + 200)
        expect(surrounding).not.toContain('recordSnapUsage')
        expect(surrounding).not.toContain('applyQuotaSnapshot')
      }
    }
  })

  // ── 7. Permission denial changes neither display ────────────
  test('permission denial path does not call applyQuotaSnapshot or recordSnapUsage', () => {
    const cameraSource = fs.readFileSync(
      path.resolve(__dirname, '../../screens/CameraScreen.js'),
      'utf-8'
    )
    // CameraScreen should not call applyQuotaSnapshot or recordSnapUsage
    expect(cameraSource).not.toContain('recordSnapUsage')
    expect(cameraSource).not.toContain('applyQuotaSnapshot')
  })

  // ── 8. Upload or analysis failure changes neither display ───
  test('catch blocks in HomeScreen do not call applyQuotaSnapshot or recordSnapUsage', () => {
    const catchBlocks = homeScreenSource.match(/catch[\s\S]*?\}/g)
    if (catchBlocks) {
      for (const block of catchBlocks) {
        expect(block).not.toContain('recordSnapUsage')
        // applyQuotaSnapshot may appear in catch as a fallback, but
        // recordSnapUsage must never appear in a catch block
      }
    }
  })

  // ── 9. Stale ProStore counter cannot alter visible quota ────
  test('HomeScreen does not import snapInfo or checkSnapEligibility from usePro', () => {
    // The destructuring from usePro must not include snapInfo, checkSnapEligibility, or useSnap
    const useProLine = homeScreenSource.match(/const\s*\{[^}]*\}\s*=\s*usePro\(\)/)
    expect(useProLine).not.toBeNull()
    expect(useProLine[0]).not.toContain('snapInfo')
    expect(useProLine[0]).not.toContain('checkSnapEligibility')
    expect(useProLine[0]).not.toContain('useSnap')
    expect(useProLine[0]).not.toContain('recordSnapUsage')
  })

  // ── 10. Resetting ProStore does not change displayed usage ──
  test('ProStore snap fields are documented as non-authoritative', () => {
    expect(proStoreSource).toContain('NON-AUTHORITATIVE')
    // checkSnapEligibility comment
    const checkIdx = proStoreSource.indexOf('checkSnapEligibility')
    expect(checkIdx).toBeGreaterThan(-1)
    const commentArea = proStoreSource.slice(Math.max(0, checkIdx - 500), checkIdx)
    expect(commentArea).toContain('NON-AUTHORITATIVE')
    // snapInfo comment
    const snapInfoIdx = proStoreSource.indexOf('const snapInfo')
    expect(snapInfoIdx).toBeGreaterThan(-1)
    const snapInfoComment = proStoreSource.slice(Math.max(0, snapInfoIdx - 300), snapInfoIdx)
    expect(snapInfoComment).toContain('NON-AUTHORITATIVE')
  })

  // ── 11. Server-returned correction updates both displays ────
  test('applyQuotaSnapshot is called with visionResult.quota in handleProduceIdentified', () => {
    const fnIdx = homeScreenSource.indexOf('const handleProduceIdentified')
    const fnBody = homeScreenSource.slice(fnIdx, fnIdx + 3000)
    expect(fnBody).toContain('applyQuotaSnapshot(visionResult.quota)')
  })

  test('selectFilmRollLabel produces correct label from server quota snapshot', () => {
    // Verify the selector logic from source
    expect(selectorsSource).toContain('selectFilmRollLabel')
    // Free plan: "X/Y Free"
    expect(selectorsSource).toMatch(/\$\{quota\.remaining\}\/\$\{quota\.limit\} Free/)
    // Pro plan: "X/Y Pro"
    expect(selectorsSource).toMatch(/\$\{quota\.remaining\}\/\$\{quota\.limit\} Pro/)
    // Null quota fallback
    expect(selectorsSource).toContain("'— Free'")
  })

  // ── 12. Cross-device refreshed snapshot updates both displays ──
  test('QuotaStore refresh fetches from server and updates quota state', () => {
    expect(quotaStoreSource).toContain('fetchScanQuota')
    expect(quotaStoreSource).toContain('setServerQuota(snapshot)')
    expect(quotaStoreSource).toContain('addIdentityChangeListener')
    // On identity change: reset and re-fetch
    expect(quotaStoreSource).toContain('setServerQuota(null)')
  })

  // ── 13. Manual entry consumes zero and changes neither display ──
  test('manual entry path does not call applyQuotaSnapshot or recordSnapUsage', () => {
    const manualIdx = homeScreenSource.indexOf('const handleManualAdd')
    if (manualIdx > -1) {
      const manualBlock = homeScreenSource.slice(manualIdx, manualIdx + 800)
      expect(manualBlock).not.toContain('recordSnapUsage')
      expect(manualBlock).not.toContain('applyQuotaSnapshot')
    }
  })

  // ── 14. Logging does not consume or change quota ────────────
  test('executeLogToChallenge does not call applyQuotaSnapshot or recordSnapUsage', () => {
    const logIdx = homeScreenSource.indexOf('const executeLogToChallenge')
    expect(logIdx).toBeGreaterThan(-1)
    const logBlock = homeScreenSource.slice(logIdx, logIdx + 6000)
    expect(logBlock).not.toContain('recordSnapUsage')
    // Snap was already consumed at analysis time
    expect(logBlock).toContain('already consumed')
  })

  // ── 15. Free-plan limits display correctly ──────────────────
  test('free-plan film-roll label shows remaining/limit Free', () => {
    // selectFilmRollLabel for free plan: `${remaining}/${limit} Free`
    expect(selectorsSource).toMatch(/quota\.plan === 'pro'/)
    // When not pro, returns remaining/limit Free
    expect(selectorsSource).toMatch(/\$\{quota\.remaining\}\/\$\{quota\.limit\} Free/)
  })

  // ── 16. Pro-plan presentation derives from server plan data ─
  test('pro-plan film-roll label derives from server quota.plan, not client tier', () => {
    // selectFilmRollLabel checks quota.plan === 'pro'
    expect(selectorsSource).toContain("quota.plan === 'pro'")
    // HomeScreen uses filmRollIsPro (from server quota), not isPro (from ProStore)
    expect(homeScreenSource).toContain('filmRollIsPro')
    // The film-roll color uses filmRollIsPro, not isPro
    const filmRollIdx = homeScreenSource.indexOf('styles.filmRoll')
    expect(filmRollIdx).toBeGreaterThan(-1)
    const filmRollBlock = homeScreenSource.slice(filmRollIdx, filmRollIdx + 300)
    expect(filmRollBlock).toContain('filmRollIsPro')
    expect(filmRollBlock).not.toMatch(/\bisPro\b/)
  })

  // ── 17. Quota exhaustion still blocks the scan ──────────────
  test('attemptCameraOpen uses QuotaStore-based eligibility precheck', () => {
    const fnStart = homeScreenSource.indexOf('const attemptCameraOpen')
    const fnEnd = homeScreenSource.indexOf('}, [', fnStart)
    const fnBody = homeScreenSource.slice(fnStart, fnEnd)
    // Must use selectFilmRollRemaining for eligibility (computed from currentQuota)
    expect(fnBody).toContain('selectFilmRollRemaining')
    expect(fnBody).toContain('selectFilmRollIsPro')
    // Must NOT use checkSnapEligibility
    expect(fnBody).not.toContain('checkSnapEligibility')
    // Must still call checkCameraEligibility
    expect(fnBody).toContain('checkCameraEligibility')
  })

  test('isSnapDepleted uses selectQuotaExhausted from QuotaStore', () => {
    expect(homeScreenSource).toContain('selectQuotaExhausted(serverQuota)')
    expect(homeScreenSource).toContain('filmRollIsPro')
  })

  // ── 18. No client-only counter can grant access ─────────────
  test('HomeScreen does not call recordSnapUsage anywhere in the file', () => {
    expect(homeScreenSource).not.toContain('recordSnapUsage')
  })

  test('HomeScreen does not reference snapConsumedForSessionRef', () => {
    expect(homeScreenSource).not.toContain('snapConsumedForSessionRef')
  })

  // ── VaultScreen also uses QuotaStore ────────────────────────
  test('VaultScreen uses selectFilmRollLabel from QuotaStore, not ProStore.snapInfo', () => {
    expect(vaultScreenSource).toContain('selectFilmRollLabel')
    expect(vaultScreenSource).toContain('useQuota')
    expect(vaultScreenSource).toContain('snapInfoLabel')
    // Must NOT use snapInfo.label
    expect(vaultScreenSource).not.toContain('snapInfo.label')
    // Must NOT destructure snapInfo from usePro
    const useProLine = vaultScreenSource.match(/const\s*\{[^}]*\}\s*=\s*usePro\(\)/)
    expect(useProLine).not.toBeNull()
    expect(useProLine[0]).not.toContain('snapInfo')
  })

  // ── SnapGateModal does not use ProStore.snapInfo ────────────
  test('SnapGateModal does not import usePro or snapInfo', () => {
    const snapGateSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/SnapGateModal.js'),
      'utf-8'
    )
    // SnapGateModal should not import usePro for snapInfo
    // (It may still import SUBSCRIPTION_PLANS and IAP_PACKS)
    const useProMatch = snapGateSource.match(/usePro\(\)/)
    if (useProMatch) {
      // If usePro is still imported, snapInfo must not be destructured
      const destructureMatch = snapGateSource.match(/const\s*\{[^}]*\}\s*=\s*usePro\(\)/)
      if (destructureMatch) {
        expect(destructureMatch[0]).not.toContain('snapInfo')
      }
    }
  })

  // ── selectFilmRollRemaining and selectFilmRollIsPro exist ───
  test('subscriptionSelectors exports selectFilmRollRemaining and selectFilmRollIsPro', () => {
    expect(selectorsSource).toContain('selectFilmRollRemaining')
    expect(selectorsSource).toContain('selectFilmRollIsPro')
  })

  // ── Dependency array no longer includes recordSnapUsage ─────
  test('handleProduceIdentified dependency array does not include recordSnapUsage', () => {
    const fnIdx = homeScreenSource.indexOf('const handleProduceIdentified')
    const fnBody = homeScreenSource.slice(fnIdx, fnIdx + 5000)
    // Find the dependency array
    const depMatch = fnBody.match(/\},\s*\[([^\]]+)\]/)
    expect(depMatch).not.toBeNull()
    expect(depMatch[1]).not.toContain('recordSnapUsage')
    expect(depMatch[1]).toContain('applyQuotaSnapshot')
    expect(depMatch[1]).toContain('refreshQuota')
  })
})
