const fs = require('fs')
const path = require('path')
const {
  formatQuotaResetDate,
  getQuotaModalContent,
} = require('../ScanQuotaReachedModal')

const cameraSource = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'CameraScreen.js'), 'utf8')
const homeSource = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'HomeScreen.js'), 'utf8')
const paywallSource = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'PaywallScreen.js'), 'utf8')

describe('ScanQuotaReachedModal', () => {
  test('shows the Free invitation only with the authoritative Free quota snapshot', () => {
    const content = getQuotaModalContent({
      plan: 'free',
      used: 5,
      limit: 5,
      remaining: 0,
      periodEnd: '2026-08-01T00:00:00.000Z',
    })

    expect(content.isPro).toBe(false)
    expect(content.title).toBe('You’ve used your 5 free AI scans this month')
    expect(content.body).toContain('RawLifeFlow Pro')
    expect(content.body).toContain('reset on')
  })

  test('does not invent a reset date when the authoritative response omits it', () => {
    const content = getQuotaModalContent({
      plan: 'free',
      used: 5,
      limit: 5,
      remaining: 0,
      periodEnd: '',
    })

    expect(formatQuotaResetDate('')).toBeNull()
    expect(content.body).not.toContain('reset on')
  })

  test('shows an informational Pro quota state without an upgrade invitation', () => {
    const content = getQuotaModalContent({
      plan: 'pro',
      used: 60,
      limit: 60,
      remaining: 0,
      periodEnd: '2026-08-01T00:00:00.000Z',
    })

    expect(content.isPro).toBe(true)
    expect(content.title).toBe('You’ve used your 60 Pro AI scans for this period')
    expect(content.body).not.toContain('RawLifeFlow Pro')
  })

  test('opens the modal only for the monthly quota error, not technical scan failures', () => {
    expect(cameraSource).toContain("err.code === 'monthly_limit_reached' && err.quota")
    expect(cameraSource).toContain('setQuotaModal(err.quota)')
    expect(cameraSource).toContain("err.code === 'account_required'")
    expect(cameraSource).toContain("setError(message)")
  })

  test('keeps the existing manual-entry handoff and does not invoke scan authorization', () => {
    expect(cameraSource).toContain('handleManualEntry()')
    expect(homeSource).toContain('setIsCameraOpen(false)')
    expect(homeSource).toContain('setIsManualMode(true)')
    expect(cameraSource).not.toContain('useSnap()')
  })

  test('uses the existing paywall and RevenueCat restore path', () => {
    expect(homeSource).toContain("navigation.navigate('Paywall', { source: 'scan_quota_exhausted' })")
    expect(paywallSource).toContain("trackEvent('scan_quota_restore_selected'")
    expect(paywallSource).toContain('const outcome = await restore()')
    expect(paywallSource).toContain('await refreshQuota()')
  })

  test('tracks quota-modal actions with non-sensitive quota properties', () => {
    expect(cameraSource).toContain("'scan_quota_modal_viewed'")
    expect(cameraSource).toContain("'pro_scan_quota_modal_viewed'")
    expect(cameraSource).toContain("'scan_quota_upgrade_selected'")
    expect(cameraSource).toContain("'scan_quota_manual_entry_selected'")
    expect(cameraSource).toContain("'scan_quota_modal_dismissed'")
  })
})
