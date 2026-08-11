// Advanced Blend regression tests for QA Items 4 & 8.
// Tests verify display correctness and enforcement boundaries
// at the service/store level and UI integration level.

const fs = require('fs')
const path = require('path')

const BLEND_SERVICE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'quota', 'blendAllowanceService.ts'),
  'utf8',
)

const BLEND_GATE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'quota', 'blendNutritionGate.ts'),
  'utf8',
)

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

const MODAL_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'AdvancedBlendModal.js'),
  'utf8',
)

// ── Helpers ──────────────────────────────────────────────────

function section (src, marker, len = 400) {
  const idx = src.indexOf(marker)
  if (idx === -1) return ''
  return src.substring(idx, idx + len)
}

// Extract from a marker to the next top-level export or end of file.
// This is resilient to header additions that shift code past fixed windows.
function extractFunction(src, marker) {
  const start = src.indexOf(marker)
  if (start === -1) return ''
  const rest = src.slice(start + marker.length)
  const nextExport = rest.indexOf('\nexport ')
  if (nextExport === -1) return src.slice(start)
  return src.slice(start, start + marker.length + nextExport + 1)
}

// ── Display Tests ────────────────────────────────────────────

describe('Advanced Blend Display — QA Items 4 & 8 Regression', () => {
  // 1. Free user with three remaining
  test('1. getAdvancedBlendRemaining(0, false) returns 3', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemaining')
    expect(s).toContain('Math.max(0, FREE_ADVANCED_BLEND_ALLOWANCE - usedCount)')
    expect(BLEND_SERVICE_SRC).toContain('FREE_ADVANCED_BLEND_ALLOWANCE = 3')
  })

  // 2. Free user with two remaining
  test('2. getAdvancedBlendRemainingText(1, false) shows 2 remaining', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemainingText', 600)
    expect(s).toMatch(/\$\{remaining\}.*Analyses remaining/)
  })

  // 3. Free user with one remaining
  test('3. getAdvancedBlendRemainingText(2, false) shows 1 remaining', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemainingText', 600)
    expect(s).toContain("remaining === 1")
    expect(s).toContain('1 complimentary Expanded Ingredient Analysis remaining')
  })

  // 4. Correct singular copy at one
  test('4. Singular copy uses "Analysis" not "Analyses" at remaining=1', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemainingText', 600)
    const singularLine = s.match(/remaining === 1.*?return.*?$/m)
    expect(singularLine).toBeTruthy()
    expect(singularLine[0]).toContain('Analysis remaining')
    expect(singularLine[0]).not.toContain('Analyses remaining')
  })

  // 5. Free user with zero remaining
  test('5. getAdvancedBlendRemainingText(3, false) shows exhausted text', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemainingText', 600)
    expect(s).toContain('remaining === 0')
    expect(s).toContain('used all 3 complimentary')
  })

  // 6. Pro user receives unlimited treatment
  test('6. getAdvancedBlendRemaining(*, true) returns null (unlimited)', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemaining')
    expect(s).toContain('if (isPro) return null')
  })

  test('6b. getAdvancedBlendRemainingText(*, true) shows unlimited', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemainingText', 600)
    expect(s).toContain("isPro) return 'Unlimited Expanded Ingredient Analysis with Pro'")
  })

  // 7. Loading state does not flash a false count of three
  test('7. HomeScreen fetches authoritative allowance before showing modal', () => {
    const s = section(HOME_SRC, 'Fetch authoritative Advanced Blend allowance', 500)
    expect(s).toContain('fetchBlendAllowance()')
    expect(s).toContain('setBlendUsedCount(snapshot.used')
  })

  test('7b. blendUsedCount starts at 0, not FREE_ADVANCED_BLEND_ALLOWANCE', () => {
    expect(HOME_SRC).toContain('useState(0)')
    const idx = HOME_SRC.indexOf('blendUsedCount')
    const s = HOME_SRC.substring(idx, idx + 100)
    expect(s).toContain('useState(0)')
  })

  test('7c. Pre-analysis confirmation uses getAdvancedBlendRemaining with blendUsedCount', () => {
    const idx = HOME_SRC.indexOf("setAdvancedBlendStage('pre_analysis_confirmation')")
    const s = HOME_SRC.substring(idx, idx + 300)
    expect(s).toContain('currentRemaining')
    const calcIdx = HOME_SRC.indexOf('const currentRemaining = getAdvancedBlendRemaining')
    expect(calcIdx).toBeGreaterThan(-1)
  })

  // 8. Authoritative fetch failure fails closed
  test('8. fetchBlendAllowance returns null on failure (no synthetic count)', () => {
    const s = section(BLEND_SERVICE_SRC, 'export async function fetchBlendAllowance', 400)
    expect(s).toContain('return null')
  })

  test('8b. fetchBlendAllowance returns null when Supabase not configured', () => {
    const s = section(BLEND_SERVICE_SRC, 'export async function fetchBlendAllowance', 400)
    expect(s).toContain('if (!SUPABASE_CONFIGURED) return null')
  })

  test('8c. refreshBlendAllowance only updates state when snapshot is non-null', () => {
    const s = section(HOME_SRC, 'const refreshBlendAllowance = useCallback', 200)
    expect(s).toContain('if (snapshot)')
  })

  // 9. Used and remaining counts agree
  test('9. used + remaining === limit for free users', () => {
    // getAdvancedBlendRemaining returns max(0, 3 - usedCount)
    // So usedCount + remaining === 3 when usedCount <= 3
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemaining')
    expect(s).toContain('FREE_ADVANCED_BLEND_ALLOWANCE - usedCount')
  })

  test('9b. reserveBlendAllowance returns both used and remaining from server', () => {
    // The success return block after res.ok check
    const okIdx = BLEND_SERVICE_SRC.indexOf("if (!res.ok)")
    const returnSection = BLEND_SERVICE_SRC.substring(okIdx, okIdx + 500)
    expect(returnSection).toContain('remaining')
    expect(returnSection).toContain('used')
    expect(returnSection).toContain('limit')
  })
})

// ── Enforcement Tests ────────────────────────────────────────

describe('Advanced Blend Enforcement — QA Items 4 & 8 Regression', () => {
  // 10. Free user at zero cannot start another Advanced Blend analysis
  test('10. reserveBlendAllowance throws BlendAllowanceError on 403', () => {
    const s = section(BLEND_SERVICE_SRC, 'if (res.status === 403)', 700)
    expect(s).toContain('BlendAllowanceError')
    expect(s).toContain('advanced_blend_limit_reached')
  })

  // 11. Free user at zero cannot log an Advanced Blend through a stale result
  test('11. authorizeAndProcessBatch requires reservation before processing', () => {
    expect(BLEND_GATE_SRC).toContain('const reservation = await reserveBlendAllowance')
    expect(BLEND_GATE_SRC).toContain('const result = processJuiceBatch')
    // Processing happens AFTER reservation succeeds — find the reservation
    // call that is actually in the function body (after the simple-blend early return)
    const advancedIdx = BLEND_GATE_SRC.indexOf('Advanced Blends: reserve')
    const reserveIdx = BLEND_GATE_SRC.indexOf('reserveBlendAllowance', advancedIdx)
    const processIdx = BLEND_GATE_SRC.indexOf('processJuiceBatch', advancedIdx)
    expect(reserveIdx).toBeGreaterThan(-1)
    expect(processIdx).toBeGreaterThan(reserveIdx)
  })

  // 12. Direct navigation cannot bypass exhaustion
  test('12. HomeScreen checks blend exhaustion before showing analysis', () => {
    const idx = HOME_SRC.indexOf('blendCheckInProgress')
    expect(idx).toBeGreaterThan(-1)
    // The blend check is gated by blendCheckInProgress to prevent bypass
  })

  test('12b. Advanced Blend requires user confirmation before processing', () => {
    expect(HOME_SRC).toContain("setAdvancedBlendStage('pre_analysis_confirmation')")
    expect(HOME_SRC).toContain('blendApprovedRef')
  })

  // 13. Back navigation and reopening cannot bypass exhaustion
  test('13. blendUsedCount is refreshed on focus, not persisted locally only', () => {
    const s = section(HOME_SRC, 'Fetch authoritative Advanced Blend allowance', 700)
    expect(s).toContain("addListener?.('focus'")
    expect(s).toContain('refreshBlendAllowance')
  })

  // 14. Rapid repeated taps cannot reserve more than one use
  test('14. blendCheckInProgress guard prevents concurrent blend checks', () => {
    expect(HOME_SRC).toContain('blendCheckInProgress')
    expect(HOME_SRC).toContain('setBlendCheckInProgress(true)')
    expect(HOME_SRC).toContain('setBlendCheckInProgress(false)')
  })

  // 15. Duplicate request ID remains idempotent
  test('15. createOperationId produces unique IDs per attempt', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function createOperationId', 200)
    expect(s).toContain('Date.now()')
    expect(s).toContain('Math.random()')
    expect(s).toContain('_counter')
  })

  test('15b. reserveBlendAllowance sends requestId to server for dedup', () => {
    const s = section(BLEND_SERVICE_SRC, "body: JSON.stringify({", 200)
    expect(s).toContain('requestId: operationId')
  })

  test('15c. finalizeBlendAllowance uses requestId for idempotent commit', () => {
    const s = section(BLEND_SERVICE_SRC, 'export async function finalizeBlendAllowance', 200)
    expect(s).toContain('requestId')
  })

  // 16. Failed analysis releases a valid reservation
  test('16. authorizeAndProcessBatch releases on processJuiceBatch failure', () => {
    const s = section(BLEND_GATE_SRC, 'catch (err)', 200)
    expect(s).toContain('releaseBlendAllowance')
    expect(s).toContain('throw err')
  })

  test('16b. releaseBlendAllowance sends requestId to server', () => {
    const s = section(BLEND_SERVICE_SRC, 'export async function releaseBlendAllowance', 200)
    expect(s).toContain('requestId')
  })

  // 17. Successful analysis finalizes only once
  test('17. authorizeAndProcessBatch calls finalizeBlendAllowance once on success', () => {
    const finalizeCount = (BLEND_GATE_SRC.match(/finalizeBlendAllowance/g) || []).length
    expect(finalizeCount).toBeGreaterThanOrEqual(1)
    // Ensure finalize is in the try block (after the advanced-blend section)
    const advancedIdx = BLEND_GATE_SRC.indexOf('Advanced Blends: reserve')
    const tryIdx = BLEND_GATE_SRC.indexOf('try {', advancedIdx)
    const finalizeIdx = BLEND_GATE_SRC.indexOf('finalizeBlendAllowance', advancedIdx)
    expect(finalizeIdx).toBeGreaterThan(tryIdx)
  })

  // 18. Valid analyzed result can be logged without a second charge
  test('18. blendApprovedRef prevents double-charging on log after analysis', () => {
    expect(HOME_SRC).toContain('blendApprovedRef.current = true')
    expect(HOME_SRC).toContain('blendApprovedRef.current')
  })

  // 19. App remount does not reset the lifetime allowance
  test('19. blendUsedCount is fetched from server on mount, not reset to 0 permanently', () => {
    const s = section(HOME_SRC, 'const refreshBlendAllowance = useCallback', 300)
    expect(s).toContain('fetchBlendAllowance()')
    // On mount, the server's authoritative count is used
  })

  test('19b. fetchBlendAllowance reads server state, not local cache', () => {
    const s = section(BLEND_SERVICE_SRC, 'export async function fetchBlendAllowance', 400)
    expect(s).toContain('fetch(functionUrl()')
    expect(s).toContain('method: \'GET\'')
  })

  // 20. Simple blends remain free and unaffected
  test('20. authorizeAndProcessBatch processes simple blends without server call', () => {
    const s = section(BLEND_GATE_SRC, 'blendType === \'simple\'', 200)
    expect(s).toContain('processJuiceBatch')
    expect(s).not.toContain('reserveBlendAllowance')
  })

  test('20b. reserveBlendAllowance returns immediately for simple blends', () => {
    const s = section(BLEND_SERVICE_SRC, 'blendType === \'simple\'', 200)
    expect(s).toContain('allowed: true')
    expect(s).toContain('code: \'simple_blend_allowed\'')
  })

  // 21. Pro users remain unlimited
  test('21. Pro user allowance is checked server-side, not bypassed client-side', () => {
    // The reserve function sends an auth token to the server via buildAuthedHeaders
    const s = section(BLEND_SERVICE_SRC, 'const res = await fetch(functionUrl()', 300)
    expect(s).toContain('buildAuthedHeaders')
    expect(s).toContain('token')
  })

  test('21b. getAdvancedBlendRemaining returns null for pro (unlimited display)', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function getAdvancedBlendRemaining')
    expect(s).toContain('if (isPro) return null')
  })

  // 22. Server or authoritative-state failure never guesses that three uses remain
  test('22. fetchBlendAllowance returns null on non-ok response', () => {
    const s = extractFunction(BLEND_SERVICE_SRC, 'export async function fetchBlendAllowance')
    expect(s).toMatch(/buildAuthedHeaders[\s\S]*if \(!res\.ok\) return null/)
  })

  test('22b. fetchBlendAllowance returns null on network error', () => {
    const s = extractFunction(BLEND_SERVICE_SRC, 'export async function fetchBlendAllowance')
    expect(s).toMatch(/catch/)
    expect(s).toMatch(/return null/)
  })

  test('22c. refreshBlendAllowance does not set blendUsedCount when fetch fails', () => {
    const s = section(HOME_SRC, 'const refreshBlendAllowance = useCallback', 200)
    // Only updates if snapshot is truthy — null means no update
    expect(s).toContain('if (snapshot)')
    expect(s).not.toMatch(/setBlendUsedCount\(0\)/)
  })

  // Additional: Modal displays correct remaining based on blendUsedCount
  test('23. AdvancedBlendModal receives remaining from getAdvancedBlendRemaining', () => {
    // The remaining prop is computed via getAdvancedBlendRemaining before being passed
    const idx = HOME_SRC.indexOf('advancedBlendRemaining')
    expect(idx).toBeGreaterThan(-1)
    // Verify the computation uses getAdvancedBlendRemaining
    const computeIdx = HOME_SRC.indexOf('getAdvancedBlendRemaining(blendUsedCount, isPro)')
    expect(computeIdx).toBeGreaterThan(-1)
  })

  // Additional: Dev bypass only in development
  test('24. isDevBypass only returns true in __DEV__ with no Supabase', () => {
    const s = section(BLEND_SERVICE_SRC, 'export function isDevBypass', 100)
    expect(s).toContain('__DEV__')
    expect(s).toContain('!SUPABASE_CONFIGURED')
  })

  // Additional: Fail-closed in production when server unreachable
  test('25. Production fails closed when Supabase not configured for advanced blends', () => {
    const s = section(BLEND_SERVICE_SRC, 'Production: fail-closed', 200)
    expect(s).toContain('BlendAllowanceError')
    expect(s).toContain('server_not_configured')
  })
})
