const fs = require('fs')
const path = require('path')

const cameraSource = fs.readFileSync(
  path.join(__dirname, '..', 'CameraScreen.js'),
  'utf8'
)

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', 'SettingsScreen.js'),
  'utf8'
)

const scanPlanModalSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'ScanPlanModal.js'),
  'utf8'
)

describe('Camera header quota badge', () => {
  test('imports ScanPlanModal, AccountGateModal, and getAccountStatus', () => {
    expect(cameraSource).toContain('import ScanPlanModal')
    expect(cameraSource).toContain('import AccountGateModal')
    expect(cameraSource).toContain('import { getAccountStatus }')
  })

  test('replaces the empty placeholder View with a tappable quota badge', () => {
    expect(cameraSource).not.toContain('<View style={{ width: 40 }} />')
    expect(cameraSource).toContain('styles.quotaBadge')
    expect(cameraSource).toContain('accessibilityRole="button"')
  })

  test('uses authoritative quota from QuotaStore via shared selector', () => {
    expect(cameraSource).toContain('useQuota')
    expect(cameraSource).toContain('getQuotaDisplay')
    expect(cameraSource).toContain('quotaDisplay.effectiveRemaining')
  })

  test('shows remaining count from server quota, not a hardcoded value', () => {
    expect(cameraSource).toContain('quotaDisplay')
    expect(cameraSource).not.toContain('Infinity')
    expect(cameraSource).not.toContain('unlimited')
  })

  test('opens ScanPlanModal when tapped by a signed-in user with remaining scans', () => {
    expect(cameraSource).toContain('setShowScanPlan(true)')
    expect(cameraSource).toContain('<ScanPlanModal')
    expect(cameraSource).toContain('visible={showScanPlan}')
  })

  test('opens AccountGateModal when tapped by a signed-out user', () => {
    expect(cameraSource).toContain('setShowAccountGate(true)')
    expect(cameraSource).toContain('<AccountGateModal')
    expect(cameraSource).toContain('visible={showAccountGate}')
    expect(cameraSource).toContain("initialMode=\"signin\"")
  })

  test('opens ScanQuotaReachedModal when quota is exhausted', () => {
    expect(cameraSource).toContain('setQuotaModal(quota)')
  })

  test('refreshes quota and account status after successful authentication', () => {
    expect(cameraSource).toContain('refreshQuota()')
    expect(cameraSource).toContain('getAccountStatus()')
    expect(cameraSource).toContain('setIsDurable')
  })

  test('applies server-returned quota snapshot after a successful scan', () => {
    expect(cameraSource).toContain('if (result.quota) applySnapshot(result.quota)')
  })

  test('provides dynamic accessibility labels for all badge states', () => {
    expect(cameraSource).toContain('accessibilityLabel')
    expect(cameraSource).toContain('accessibilityHint')
    expect(cameraSource).toContain('accessibilityState')
    expect(cameraSource).toContain('Sign in to view your Juice Snap plan')
    expect(cameraSource).toContain('formatCanonicalQuotaLabel')
    expect(cameraSource).toContain('canonical')
  })

  test('does not reference legacy features (snap packs, freezer passes, lifetime, unlimited)', () => {
    expect(cameraSource).not.toContain('snapPack')
    expect(cameraSource).not.toContain('freezerPass')
    expect(cameraSource).not.toContain('lifetime')
    expect(cameraSource).not.toContain('unlimited')
    expect(cameraSource).not.toContain('architectPro')
  })
})

describe('Settings AccountSection sign-in entry', () => {
  test('shows a single "Sign In or Create Account" entry for anonymous users', () => {
    expect(settingsSource).toContain('Sign In or Create Account')
  })

  test('opens AccountGateModal with protect mode for new users', () => {
    expect(settingsSource).toContain("openGate('protect')")
    expect(settingsSource).toContain('<AccountGateModal')
  })

  test('displays plan label and quota for signed-in users', () => {
    expect(settingsSource).toContain('RawLifeFlow Pro')
    expect(settingsSource).toContain('Free Plan')
    expect(settingsSource).toContain('formatCanonicalQuotaLabel')
    expect(settingsSource).toContain('Manual ingredient entry is always unlimited')
    expect(settingsSource).toContain('quotaDisplay')
    expect(settingsSource).toContain('getQuotaDisplay')
  })

  test('refreshes quota and subscription after sign-in', () => {
    expect(settingsSource).toContain('refreshQuota()')
    expect(settingsSource).toContain('refreshSubscription()')
  })

  test('refreshes quota and subscription after sign-out', () => {
    const signOutBlock = settingsSource.match(/handleSignOut[\s\S]*?loadAccount\(\)[\s\S]*?\n\s*\}/)
    expect(signOutBlock).toBeTruthy()
    expect(signOutBlock[0]).toContain('refreshQuota()')
    expect(signOutBlock[0]).toContain('refreshSubscription()')
  })

  test('does not reference legacy features', () => {
    expect(settingsSource).not.toContain('snapPack')
    expect(settingsSource).not.toContain('freezerPass')
    expect(settingsSource).not.toContain('lifetime')
    expect(settingsSource).not.toContain('unlimited scans')
  })
})

describe('ScanPlanModal manual entry action', () => {
  test('accepts an onManualEntry prop', () => {
    expect(scanPlanModalSource).toContain('onManualEntry')
  })

  test('renders "Enter Ingredients Manually" button when onManualEntry is provided', () => {
    expect(scanPlanModalSource).toContain('Enter Ingredients Manually')
    expect(scanPlanModalSource).toContain('accessibilityLabel="Enter ingredients manually"')
  })
})
