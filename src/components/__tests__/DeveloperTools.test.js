// ─────────────────────────────────────────────────────────────
// DeveloperTools.test.js — 32 focused tests for the hidden
// Developer Tools menu, seven-tap gesture, authorization,
// diagnostics, sanitization, and security.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

// ── Source file paths ────────────────────────────────────────

const SETTINGS_PATH = path.resolve(__dirname, '../../screens/SettingsScreen.js')
const HOOK_PATH = path.resolve(__dirname, '../../hooks/useDeveloperAccess.js')
const PANEL_PATH = path.resolve(__dirname, '../../components/DeveloperToolsPanel.js')
const SERVICE_PATH = path.resolve(__dirname, '../../services/supabase/developerAccess.ts')
const MIGRATION_PATH = path.resolve(__dirname, '../../../supabase/migrations/0008_developer_access.sql')

const settingsSource = fs.readFileSync(SETTINGS_PATH, 'utf-8')
const hookSource = fs.readFileSync(HOOK_PATH, 'utf-8')
const panelSource = fs.readFileSync(PANEL_PATH, 'utf-8')
const serviceSource = fs.readFileSync(SERVICE_PATH, 'utf-8')
const migrationSource = fs.readFileSync(MIGRATION_PATH, 'utf-8')

// ── Tests ────────────────────────────────────────────────────

describe('Developer Tools — Hidden Menu', () => {

  // 1. Developer Tools is hidden by default
  test('devToolsVisible defaults to false', () => {
    expect(hookSource).toContain('useState(false)')
    expect(hookSource).toContain('devToolsVisible')
  })

  // 2. One to six taps do not reveal the tools
  test('TAP_THRESHOLD is 7', () => {
    expect(hookSource).toContain('TAP_THRESHOLD = 7')
  })

  test('tap count below 7 does not trigger checkAccess', () => {
    expect(hookSource).toContain('if (nextCount >= TAP_THRESHOLD)')
    // The check only fires at threshold, not before
    const thresholdCheck = hookSource.indexOf('if (nextCount >= TAP_THRESHOLD)')
    const setTapCountAfter = hookSource.indexOf('setTapCount(nextCount)', thresholdCheck)
    expect(setTapCountAfter).toBeGreaterThan(thresholdCheck)
  })

  // 3. Seven taps trigger authorization checking
  test('seven taps call checkAccess', () => {
    expect(hookSource).toContain('checkAccess()')
    const thresholdBlock = hookSource.indexOf('if (nextCount >= TAP_THRESHOLD)')
    const checkAccessCall = hookSource.indexOf('checkAccess()', thresholdBlock)
    expect(checkAccessCall).toBeGreaterThan(thresholdBlock)
  })

  // 4. Tap count resets after the allowed interval
  test('tap reset timer exists with TAP_RESET_MS', () => {
    expect(hookSource).toContain('TAP_RESET_MS')
    expect(hookSource).toContain('setTimeout(() => {')
    expect(hookSource).toContain('resetTaps()')
  })

  test('TAP_RESET_MS is between 5000 and 10000', () => {
    const match = hookSource.match(/TAP_RESET_MS\s*=\s*(\d+)/)
    expect(match).toBeTruthy()
    const ms = parseInt(match[1], 10)
    expect(ms).toBeGreaterThanOrEqual(5000)
    expect(ms).toBeLessThanOrEqual(10000)
  })

  // 5. Four, five, and six taps show correct remaining-tap feedback
  test('feedback starts at tap 4', () => {
    expect(hookSource).toContain('if (nextCount >= 4)')
  })

  test('feedback shows remaining count', () => {
    expect(hookSource).toContain('remaining')
    expect(hookSource).toContain('more tap')
  })

  test('feedback uses singular for 1 remaining', () => {
    expect(hookSource).toContain("remaining === 1 ? '' : 's'")
  })

  // 6. Seven taps alone cannot authorize a production user
  test('checkAccess calls checkDeveloperAccess server-side', () => {
    expect(hookSource).toContain('checkDeveloperAccess')
  })

  test('seven taps alone does not set devToolsVisible without authorization', () => {
    // The checkAccess function only sets devToolsVisible true if result.authorized
    expect(hookSource).toContain('if (result.authorized)')
    expect(hookSource).toContain('setDevToolsVisible(true)')
  })

  // 7. Unauthorized signed-in users remain blocked
  test('unauthorized user gets blocked message', () => {
    expect(hookSource).toContain('Developer access is not available for this account.')
  })

  // 8. Signed-out users remain blocked
  test('signed-out user gets sign-in prompt', () => {
    expect(hookSource).toContain('Sign in with an authorized developer account')
  })

  // 9. Anonymous users remain blocked
  test('anonymous users are blocked by isDurable check', () => {
    expect(hookSource).toContain('!status.isDurable')
  })

  // 10. Active authorized developer is allowed
  test('authorized result sets devToolsVisible true', () => {
    expect(hookSource).toContain('result.authorized')
    expect(hookSource).toContain('setDevToolsVisible(true)')
  })

  // 11. Inactive access is blocked (migration check)
  test('migration blocks inactive access', () => {
    expect(migrationSource).toContain('NOT v_row.is_active')
  })

  // 12. Expired access is blocked (migration check)
  test('migration blocks expired access', () => {
    expect(migrationSource).toContain('expires_at < now()')
  })

  // 13. The authorization function checks only auth.uid()
  test('RPC uses auth.uid() not a parameter', () => {
    expect(migrationSource).toContain('auth.uid()')
    expect(migrationSource).not.toContain('p_user_id')
    expect(migrationSource).not.toContain('IN user_id')
  })

  // 14. Client cannot supply another UUID
  test('checkDeveloperAccess takes no arguments', () => {
    expect(serviceSource).toContain('checkDeveloperAccess ()')
    expect(serviceSource).not.toContain('userId')
  })

  test('RPC call has no parameters', () => {
    expect(serviceSource).toContain("rpc('check_developer_access')")
    // No args object in the RPC call
    const rpcCall = serviceSource.indexOf("rpc('check_developer_access')")
    const rpcCallEnd = serviceSource.indexOf(')', rpcCall)
    const rpcCallSection = serviceSource.substring(rpcCall, rpcCallEnd)
    expect(rpcCallSection).not.toContain('{')
  })

  // 15. Developer Tools appears only once
  test('DeveloperToolsPanel appears once in SettingsScreen', () => {
    const matches = settingsSource.match(/DeveloperToolsPanel/g)
    expect(matches).toBeTruthy()
    expect(matches.length).toBe(3) // import name + import path + JSX usage
  })

  // 16. Account remains the first Settings section
  test('AccountSection appears before About section', () => {
    const accountIdx = settingsSource.indexOf('AccountSection')
    const aboutIdx = settingsSource.indexOf('═══ ABOUT')
    expect(accountIdx).toBeGreaterThan(0)
    expect(aboutIdx).toBeGreaterThan(0)
    expect(accountIdx).toBeLessThan(aboutIdx)
  })

  // 17. Developer Tools appears near the bottom of Settings
  test('Developer Tools appears after Help & Support', () => {
    const helpIdx = settingsSource.indexOf('Help & Support')
    const devToolsIdx = settingsSource.indexOf('DEVELOPER TOOLS')
    expect(helpIdx).toBeGreaterThan(0)
    expect(devToolsIdx).toBeGreaterThan(0)
    expect(devToolsIdx).toBeGreaterThan(helpIdx)
  })

  // 18. Signing out hides the section
  test('auth state change listener hides dev tools on SIGNED_OUT', () => {
    expect(hookSource).toContain('onAuthStateChange')
    expect(hookSource).toContain('SIGNED_OUT')
    expect(hookSource).toContain('hideDevTools()')
  })

  // 19. Identity change hides the section
  test('identity change listener hides dev tools', () => {
    expect(hookSource).toContain('addIdentityChangeListener')
    expect(hookSource).toContain('hideDevTools()')
  })

  // 20. Local development bypass exists only under __DEV__
  test('dev bypass uses __DEV__', () => {
    expect(serviceSource).toContain('__DEV__')
    expect(serviceSource).toContain('isDevBypassAvailable')
  })

  // 21. Production cannot use the local bypass
  test('dev bypass is checked after isDurable, not before', () => {
    const durableCheck = hookSource.indexOf('!status.isDurable')
    const devBypass = hookSource.indexOf('isDevBypassAvailable()')
    expect(durableCheck).toBeGreaterThan(0)
    expect(devBypass).toBeGreaterThan(0)
    expect(devBypass).toBeGreaterThan(durableCheck)
  })

  test('isDevBypassAvailable returns __DEV__ only', () => {
    expect(serviceSource).toContain('return __DEV__')
  })

  // 22. Diagnostic report masks UUID
  test('maskUuid function exists', () => {
    expect(panelSource).toContain('maskUuid')
  })

  test('maskUuid returns last 8 chars with ellipsis', () => {
    expect(panelSource).toContain("slice(-8)")
    expect(panelSource).toContain("'…'")
  })

  // 23. Diagnostic report contains no secrets
  test('panel does not expose API keys', () => {
    expect(panelSource).not.toContain('apiKey')
    expect(panelSource).not.toContain('API_KEY')
  })

  test('panel does not expose JWT or tokens', () => {
    expect(panelSource).not.toContain('jwt')
    expect(panelSource).not.toContain('access_token')
    expect(panelSource).not.toContain('refresh_token')
    expect(panelSource).not.toContain('purchaseToken')
    expect(panelSource).not.toContain('integrityToken')
  })

  test('panel does not expose service-role keys', () => {
    expect(panelSource).not.toContain('service_role')
    expect(panelSource).not.toContain('serviceRole')
  })

  test('report does not include full email', () => {
    expect(panelSource).not.toContain('account.email')
  })

  // 24. Refresh quota uses the existing QuotaStore
  test('panel uses useQuota from QuotaStore', () => {
    expect(panelSource).toContain('useQuota')
    expect(panelSource).toContain('refreshQuota')
  })

  // 25. Refresh subscription uses the existing SubscriptionStore
  test('panel uses useSubscription from SubscriptionStore', () => {
    expect(panelSource).toContain('useSubscription')
    expect(panelSource).toContain('refreshSubscription')
  })

  // 26. No action can grant Pro
  test('panel has no setPro or grantPro function', () => {
    expect(panelSource).not.toContain('setPro')
    expect(panelSource).not.toContain('grantPro')
    expect(panelSource).not.toContain('toggleDevPro')
  })

  // 27. No action can add or reset scans
  test('panel has no addScans or resetScans', () => {
    expect(panelSource).not.toContain('addScans')
    expect(panelSource).not.toContain('resetScans')
    expect(panelSource).not.toContain('resetQuota')
  })

  // 28. No action can reset Device Recall
  test('panel has no resetDevice or clearDeviceRecall', () => {
    expect(panelSource).not.toContain('resetDevice')
    expect(panelSource).not.toContain('clearDeviceRecall')
  })

  // 29. No hardcoded developer email exists
  test('no hardcoded email in changed files', () => {
    expect(hookSource).not.toMatch(/[a-z]+@[a-z]+\.[a-z]+/i)
    expect(serviceSource).not.toMatch(/[a-z]+@[a-z]+\.[a-z]+/i)
    expect(panelSource).not.toMatch(/[a-z]+@[a-z]+\.[a-z]+/i)
  })

  // 30. No hardcoded developer UUID exists
  test('no hardcoded UUID in changed files', () => {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    expect(hookSource).not.toMatch(uuidPattern)
    expect(serviceSource).not.toMatch(uuidPattern)
    expect(panelSource).not.toMatch(uuidPattern)
  })

  // 31. No server secret is exposed
  test('no service_role key in client files', () => {
    expect(hookSource).not.toContain('service_role')
    expect(serviceSource).not.toContain('service_role')
    expect(panelSource).not.toContain('service_role')
  })

  test('no anon key value in client files', () => {
    expect(hookSource).not.toContain('SUPABASE_ANON_KEY')
    expect(panelSource).not.toContain('SUPABASE_ANON_KEY')
  })

  // 32. Current customer Settings behavior remains intact
  test('SettingsScreen still has Account section', () => {
    expect(settingsSource).toContain('AccountSection')
  })

  test('SettingsScreen still has Subscription section', () => {
    expect(settingsSource).toContain('SubscriptionSection')
  })

  test('SettingsScreen still has Help & Support section', () => {
    expect(settingsSource).toContain('Help & Support')
  })

  test('SettingsScreen still has Developer Flags section', () => {
    expect(settingsSource).toContain('Developer Flags')
  })
})

// ── Migration security tests ─────────────────────────────────

describe('Developer Access Migration Security', () => {
  test('RLS is enabled', () => {
    expect(migrationSource).toContain('ENABLE ROW LEVEL SECURITY')
  })

  test('anon and authenticated have no direct table access', () => {
    expect(migrationSource).toContain('REVOKE ALL ON public.developer_access FROM anon, authenticated')
  })

  test('function is SECURITY DEFINER', () => {
    expect(migrationSource).toContain('SECURITY DEFINER')
  })

  test('search_path is set to public, auth', () => {
    expect(migrationSource).toContain('SET search_path = public, auth')
  })

  test('function returns only authorized, role, expires_at', () => {
    expect(migrationSource).toContain('RETURNS TABLE (authorized BOOLEAN, role TEXT, expires_at TIMESTAMPTZ)')
  })

  test('public execution is revoked', () => {
    expect(migrationSource).toContain('REVOKE ALL ON FUNCTION public.check_developer_access() FROM anon, public')
  })

  test('only authenticated can execute', () => {
    expect(migrationSource).toContain('GRANT EXECUTE ON FUNCTION public.check_developer_access() TO authenticated')
  })

  test('anonymous users return unauthorized', () => {
    expect(migrationSource).toContain('v_uid IS NULL')
    expect(migrationSource).toContain('RETURN QUERY SELECT false')
  })
})
