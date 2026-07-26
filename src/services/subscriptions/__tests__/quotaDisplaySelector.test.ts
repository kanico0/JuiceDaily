// ─────────────────────────────────────────────────────────────
// quotaDisplaySelector.test.ts — Focused tests for the shared
// quota display selector, null/loading/error safety, accordion,
// OTP fix, and device-pool audit.
// ─────────────────────────────────────────────────────────────

import {
  getQuotaDisplay,
  selectQuotaLabel,
  selectQuotaExhausted,
  formatCanonicalQuotaLabel,
} from '../subscriptionSelectors'
import type { ScanQuotaSnapshot } from '../subscriptionTypes'

const fs = require('fs')
const path = require('path')

const cameraSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'screens', 'CameraScreen.js'),
  'utf8'
)

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'screens', 'SettingsScreen.js'),
  'utf8'
)

const scanPlanModalSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'components', 'ScanPlanModal.js'),
  'utf8'
)

const accountGateModalSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'components', 'AccountGateModal.js'),
  'utf8'
)

const devicePoolConfigSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'devicePool', 'devicePoolConfig.ts'),
  'utf8'
)

function makeQuota (overrides: Partial<ScanQuotaSnapshot> = {}): ScanQuotaSnapshot {
  return {
    plan: 'free',
    limit: 5,
    used: 0,
    remaining: 5,
    periodStart: '2026-07-01T00:00:00Z',
    periodEnd: '2026-08-01T00:00:00Z',
    dailyLimit: null,
    dailyUsed: null,
    ...overrides
  }
}

// ═════════════════════════════════════════════════════════════
// 1–8: getQuotaDisplay — shared selector correctness
// ═════════════════════════════════════════════════════════════

describe('getQuotaDisplay shared selector — null/loading safety', () => {
  // 1. Null quota plus loading displays no numeric balance
  test('null quota plus loading displays no numeric balance', () => {
    const d = getQuotaDisplay(null, false, true)
    expect(d.effectiveRemaining).toBeNull()
    expect(d.effectiveUsed).toBeNull()
    expect(d.displayLimit).toBeNull()
    expect(d.loading).toBe(true)
    expect(d.error).toBe(false)
  })

  // 2. Null quota does not produce 5
  test('null quota does not produce 5', () => {
    const d = getQuotaDisplay(null, false, false)
    expect(d.effectiveRemaining).not.toBe(5)
    expect(d.effectiveRemaining).toBeNull()
    expect(d.error).toBe(true)
  })

  // 3. Null quota does not produce 60
  test('null quota does not produce 60', () => {
    const d = getQuotaDisplay(null, true, false)
    expect(d.effectiveRemaining).not.toBe(60)
    expect(d.effectiveRemaining).toBeNull()
    expect(d.error).toBe(true)
  })

  // 4. Server-confirmed unused Free quota displays 5
  test('server-confirmed unused Free quota displays 5', () => {
    const d = getQuotaDisplay(makeQuota({ used: 0, remaining: 5 }), false)
    expect(d.effectiveRemaining).toBe(5)
    expect(d.effectiveUsed).toBe(0)
    expect(d.displayLimit).toBe(5)
  })

  // 5. Server-confirmed unused Pro quota displays 60
  test('server-confirmed unused Pro quota displays 60', () => {
    const d = getQuotaDisplay(makeQuota({ plan: 'pro', limit: 60, used: 0, remaining: 60 }), true)
    expect(d.effectiveRemaining).toBe(60)
    expect(d.effectiveUsed).toBe(0)
    expect(d.displayLimit).toBe(60)
  })

  // 6. Server-confirmed prior usage displays the real remaining value
  test('server-confirmed prior usage displays the real remaining value', () => {
    const d = getQuotaDisplay(makeQuota({ used: 3, remaining: 2 }), false)
    expect(d.effectiveRemaining).toBe(2)
    expect(d.effectiveUsed).toBe(3)
  })

  // 7. Device-aware effectiveRemaining overrides accountRemaining for Free
  test('device-aware effectiveRemaining overrides accountRemaining for Free', () => {
    const d = getQuotaDisplay(
      makeQuota({ used: 1, remaining: 4, effectiveRemaining: 2, deviceRemaining: 2 }),
      false
    )
    expect(d.effectiveRemaining).toBe(2)
    expect(d.effectiveUsed).toBe(3)
    expect(d.isDevicePoolActive).toBe(true)
    expect(d.deviceRemaining).toBe(2)
  })

  // 8. Reviewer support balance comes from the server snapshot
  test('reviewer support balance comes from the server snapshot', () => {
    const d = getQuotaDisplay(
      makeQuota({ used: 5, remaining: 0, effectiveRemaining: 50 }),
      false
    )
    expect(d.effectiveRemaining).toBe(50)
    expect(d.effectiveUsed).toBe(0)
  })

  // 9. Quota error does not display zero
  test('quota error does not display zero', () => {
    const d = getQuotaDisplay(null, false, false)
    expect(d.effectiveRemaining).not.toBe(0)
    expect(d.effectiveRemaining).toBeNull()
    expect(d.error).toBe(true)
  })

  // 10. Pro quota uses accountRemaining, device pool inactive
  test('pro quota uses accountRemaining, device pool inactive', () => {
    const d = getQuotaDisplay(
      makeQuota({ plan: 'pro', limit: 60, used: 10, remaining: 50 }),
      true
    )
    expect(d.effectiveRemaining).toBe(50)
    expect(d.effectiveUsed).toBe(10)
    expect(d.isDevicePoolActive).toBe(false)
    expect(d.deviceRemaining).toBeNull()
  })

  // 11. effectiveUsed is computed from displayLimit - effectiveRemaining
  test('effectiveUsed computed from limit - effectiveRemaining', () => {
    const d = getQuotaDisplay(
      makeQuota({ used: 0, remaining: 5, effectiveRemaining: 3 }),
      false
    )
    expect(d.effectiveUsed).toBe(2)
  })

  // 12. Zero-usage free quota shows full allowance from server
  test('zero-usage free quota shows full allowance from server', () => {
    const d = getQuotaDisplay(makeQuota({ used: 0, remaining: 5 }), false)
    expect(d.effectiveRemaining).toBe(5)
    expect(d.effectiveUsed).toBe(0)
  })

  // 13. Free quota without device pool uses accountRemaining
  test('free quota without device pool uses accountRemaining', () => {
    const d = getQuotaDisplay(makeQuota({ used: 2, remaining: 3 }), false)
    expect(d.effectiveRemaining).toBe(3)
    expect(d.effectiveUsed).toBe(2)
    expect(d.isDevicePoolActive).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
// Canonical quota copy: 'X of Y AI scans used this month'
// ═════════════════════════════════════════════════════════════

describe('Canonical quota copy', () => {
  test('Free quota canonical copy: 0 of 5 AI scans used this month', () => {
    const d = getQuotaDisplay(makeQuota({ used: 0, remaining: 5 }), false)
    const label = formatCanonicalQuotaLabel(d)
    expect(label).toBe('0 of 5 AI scans used this month')
  })

  test('Free quota canonical copy with usage: 3 of 5 AI scans used this month', () => {
    const d = getQuotaDisplay(makeQuota({ used: 3, remaining: 2 }), false)
    const label = formatCanonicalQuotaLabel(d)
    expect(label).toBe('3 of 5 AI scans used this month')
  })

  test('Pro quota canonical copy: 12 of 60 AI scans used this month', () => {
    const d = getQuotaDisplay(makeQuota({ plan: 'pro', limit: 60, used: 12, remaining: 48 }), true)
    const label = formatCanonicalQuotaLabel(d)
    expect(label).toBe('12 of 60 AI scans used this month')
  })

  test('Pro quota canonical copy: 0 of 60 AI scans used this month', () => {
    const d = getQuotaDisplay(makeQuota({ plan: 'pro', limit: 60, used: 0, remaining: 60 }), true)
    const label = formatCanonicalQuotaLabel(d)
    expect(label).toBe('0 of 60 AI scans used this month')
  })

  test('selectQuotaLabel returns canonical format for Free', () => {
    const label = selectQuotaLabel(makeQuota({ used: 1, remaining: 4 }))
    expect(label).toBe('1 of 5 AI scans used this month')
  })

  test('selectQuotaLabel returns canonical format for Pro', () => {
    const label = selectQuotaLabel(makeQuota({ plan: 'pro', limit: 60, used: 30, remaining: 30 }))
    expect(label).toBe('30 of 60 AI scans used this month')
  })

  test('formatCanonicalQuotaLabel returns null on loading', () => {
    const d = getQuotaDisplay(null, false, true)
    expect(formatCanonicalQuotaLabel(d)).toBeNull()
  })

  test('formatCanonicalQuotaLabel returns null on error', () => {
    const d = getQuotaDisplay(null, false, false)
    expect(formatCanonicalQuotaLabel(d)).toBeNull()
  })

  test('canonical copy does not say Juice Snaps', () => {
    const d = getQuotaDisplay(makeQuota({ used: 0, remaining: 5 }), false)
    const label = formatCanonicalQuotaLabel(d)
    expect(label).not.toContain('Juice Snaps')
    expect(label).not.toContain('snaps remaining')
    expect(label).toContain('AI scans used')
  })

  test('header accessibility labels use canonical format', () => {
    expect(cameraSource).toContain('formatCanonicalQuotaLabel')
    const homeSource = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'screens', 'HomeScreen.js'),
      'utf8'
    )
    expect(homeSource).toContain('formatCanonicalQuotaLabel')
  })

  test('manual entry remains unlimited in quota detail UI', () => {
    const scanPlanSource = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'components', 'ScanPlanModal.js'),
      'utf8'
    )
    expect(scanPlanSource).toContain('Manual ingredient entry is always unlimited')
    const settingsSource = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'screens', 'SettingsScreen.js'),
      'utf8'
    )
    expect(settingsSource).toContain('Manual ingredient entry is always unlimited')
  })
})

describe('CameraScreen badge uses shared selector', () => {
  // 9. CameraScreen imports getQuotaDisplay
  test('CameraScreen imports getQuotaDisplay', () => {
    expect(cameraSource).toContain('getQuotaDisplay')
  })

  // 10. Badge uses quotaDisplay.effectiveRemaining
  test('badge renders quotaDisplay.effectiveRemaining', () => {
    expect(cameraSource).toContain('quotaDisplay.effectiveRemaining')
    expect(cameraSource).toContain('left')
  })

  // 11. Badge shows View plan on error, not fabricated numbers
  test('badge shows View plan on error state', () => {
    expect(cameraSource).toContain('View plan')
    expect(cameraSource).toContain('quotaDisplay.error')
  })

  // 12. Exhaustion check uses quotaDisplay with null safety
  test('exhaustion check uses quotaDisplay with null safety', () => {
    expect(cameraSource).toContain('quotaDisplay.effectiveRemaining != null && quotaDisplay.effectiveRemaining <= 0')
  })

  // 13. Accessibility label uses quotaDisplay.effectiveRemaining
  test('accessibility label uses quotaDisplay.effectiveRemaining', () => {
    expect(cameraSource).toMatch(/accessibilityLabel[\s\S]*?quotaDisplay\.effectiveRemaining/)
  })

  // 14. No local quota derivation (no usePro, no AsyncStorage)
  test('no local quota derivation', () => {
    expect(cameraSource).not.toContain('usePro(')
    expect(cameraSource).not.toContain('AsyncStorage')
  })
})

// ═════════════════════════════════════════════════════════════
// 15–18: SettingsScreen Account section
// ═════════════════════════════════════════════════════════════

describe('SettingsScreen Account section', () => {
  // 15. Uses getQuotaDisplay
  test('imports and uses getQuotaDisplay', () => {
    expect(settingsSource).toContain('getQuotaDisplay')
    expect(settingsSource).toContain('quotaDisplay')
  })

  // 16. Account section is collapsible with chevron icons
  test('Account section is collapsible', () => {
    expect(settingsSource).toContain('expanded')
    expect(settingsSource).toContain('setExpanded')
    expect(settingsSource).toContain('ChevronDown')
    expect(settingsSource).toContain('ChevronUp')
  })

  // 17. Account section has accessibility expanded state
  test('Account section has accessibility expanded state', () => {
    expect(settingsSource).toContain('accessibilityState={{ expanded }}')
  })

  // 18. Settings refreshes quota on focus
  test('Settings refreshes quota on focus', () => {
    expect(settingsSource).toContain('useIsFocused')
    expect(settingsSource).toMatch(/isFocused[\s\S]*?refreshQuota/)
  })
})

// ═════════════════════════════════════════════════════════════
// 19–21: ScanPlanModal uses shared selector
// ═════════════════════════════════════════════════════════════

describe('ScanPlanModal uses shared selector', () => {
  // 19. ScanPlanModal imports getQuotaDisplay
  test('imports getQuotaDisplay', () => {
    expect(scanPlanModalSource).toContain('getQuotaDisplay')
  })

  // 20. Uses quotaDisplay for used, limit, remaining
  test('uses quotaDisplay for used, limit, remaining', () => {
    expect(scanPlanModalSource).toContain('quotaDisplay.effectiveUsed')
    expect(scanPlanModalSource).toContain('quotaDisplay.displayLimit')
    expect(scanPlanModalSource).toContain('quotaDisplay.effectiveRemaining')
  })

  // 21. Does not use raw quota?.used or quota?.remaining
  test('does not use raw quota?.used or quota?.remaining', () => {
    expect(scanPlanModalSource).not.toContain('quota?.used')
    expect(scanPlanModalSource).not.toContain('quota?.remaining')
  })
})

// ═════════════════════════════════════════════════════════════
// 22–24: OTP first-tap fix
// ═════════════════════════════════════════════════════════════

describe('OTP first-tap fix', () => {
  // 22. keyboardDismissMode is on-drag, not interactive
  test('keyboardDismissMode is on-drag', () => {
    expect(accountGateModalSource).toContain('keyboardDismissMode="on-drag"')
    expect(accountGateModalSource).not.toContain('keyboardDismissMode="interactive"')
  })

  // 23. keyboardShouldPersistTaps is always
  test('keyboardShouldPersistTaps is set to always', () => {
    expect(accountGateModalSource).toContain('keyboardShouldPersistTaps="always"')
  })

  // 24. busyRef guard is present for both sendCode and confirmCode
  test('busyRef guard present for sendCode and confirmCode', () => {
    expect(accountGateModalSource).toContain('busyRef.current')
    const sendCodeMatch = accountGateModalSource.match(/const sendCode[\s\S]*?finally[\s\S]*?\}/)
    expect(sendCodeMatch).toBeTruthy()
    expect(sendCodeMatch![0]).toContain('busyRef.current')
    const confirmCodeMatch = accountGateModalSource.match(/const confirmCode[\s\S]*?finally[\s\S]*?\}/)
    expect(confirmCodeMatch).toBeTruthy()
    expect(confirmCodeMatch![0]).toContain('busyRef.current')
  })
})

// ═════════════════════════════════════════════════════════════
// 25–28: Device-pool audit
// ═════════════════════════════════════════════════════════════

describe('Device-pool audit', () => {
  // 25. Device pool mode defaults to off when env var is absent
  test('device pool mode defaults to off', () => {
    expect(devicePoolConfigSource).toContain("'off'")
    expect(devicePoolConfigSource).toContain('getDevicePoolMode')
  })

  // 26. No local device fingerprinting in the codebase
  test('no local device fingerprinting', () => {
    const srcDir = path.join(__dirname, '..', '..')
    const allFiles: string[] = []
    function walk (dir: string) {
      const items = fs.readdirSync(dir)
      for (const item of items) {
        const full = path.join(dir, item)
        if (fs.statSync(full).isDirectory() && !item.includes('node_modules') && !item.includes('__tests__')) {
          walk(full)
        } else if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js')) {
          allFiles.push(full)
        }
      }
    }
    walk(srcDir)
    const fingerprintPatterns = ['android_id', 'androidId', 'advertisingId', 'deviceFingerprint', 'getAndroidId']
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8')
      for (const pattern of fingerprintPatterns) {
        expect(content).not.toContain(pattern)
      }
    }
  })

  // 27. Device pool uses Play Integrity, not local IDs
  test('device pool uses Play Integrity provider', () => {
    expect(devicePoolConfigSource).toContain('android_play_integrity')
    expect(devicePoolConfigSource).toContain('Platform.OS === \'android\'')
  })

  // 28. QuotaStore clears quota on identity change
  test('QuotaStore clears quota on identity change', () => {
    const quotaStoreSource = fs.readFileSync(
      path.join(__dirname, '..', '..', 'quota', 'QuotaStore.tsx'),
      'utf8'
    )
    expect(quotaStoreSource).toContain('addIdentityChangeListener')
    expect(quotaStoreSource).toContain('setQuota(null)')
    expect(quotaStoreSource).toContain('refresh()')
  })
})
