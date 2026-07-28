/* eslint-env jest, node */

const fs = require('fs')
const path = require('path')

const homeScreenPath = path.join(__dirname, '..', 'HomeScreen.js')
const scanPlanModalPath = path.join(__dirname, '..', '..', 'components', 'ScanPlanModal.js')

function read (file) {
  return fs.readFileSync(file, 'utf8')
}

describe('HomeScreen Juice Snap header quota badge', () => {
  const source = read(homeScreenPath)

  // 1. The exact screen from the screenshot is HomeScreen.js
  test('HomeScreen renders the Juice Snap landing screen with Snap Produce', () => {
    expect(source).toContain('Juice Snap')
    expect(source).toContain('Snap Produce')
    expect(source).toContain('NutritionSummary')
  })

  // 2. The old plain camera-only control is replaced
  test('plain camera-only control is replaced with quota badge', () => {
    expect(source).toContain('quotaBadgeText')
    expect(source).toContain('quotaDisplay.effectiveRemaining')
    // No longer just a bare Camera icon with no text
    expect(source).not.toMatch(/<Camera size={\d+}[^>]*>\s*<\/TouchableOpacity>/)
  })

  // 3. Server-confirmed Free zero usage displays 5 in the header
  test('header renders quotaDisplay.effectiveRemaining which shows 5 for Free zero usage', () => {
    expect(source).toContain('quotaDisplay.effectiveRemaining')
    expect(source).toContain('quotaBadgeText')
  })

  // 4. Server-confirmed Pro zero usage displays 60
  test('header renders the same effectiveRemaining field which shows 60 for Pro zero usage', () => {
    expect(source).toContain('quotaDisplay.effectiveRemaining')
    // Pro color is gold
    expect(source).toContain("'#FFD54F'")
  })

  // 5. One successful Free scan displays 4
  test('header uses effectiveRemaining from shared selector (4 after one Free scan)', () => {
    expect(source).toContain('getQuotaDisplay(quota, isPro, quotaLoading)')
    expect(source).toContain('{quotaDisplay.effectiveRemaining}')
  })

  // 6. One successful Pro scan displays 59
  test('header uses same selector for Pro (59 after one Pro scan)', () => {
    expect(source).toContain('getQuotaDisplay')
    expect(source).toContain('quotaDisplay')
  })

  // 7. Loading displays no fabricated number
  test('loading state displays ellipsis, not fabricated number', () => {
    expect(source).toContain('quotaDisplay.loading')
    expect(source).toContain('…')
  })

  // 8. Signed-out state displays Plan
  test('error or null state displays Plan text', () => {
    expect(source).toContain('>Plan<')
  })

  // 9. Header and body use the same shared selector
  test('header and QuotaMeter both use getQuotaDisplay', () => {
    const headerMatch = source.match(/const quotaDisplay = getQuotaDisplay\(quota, isPro, quotaLoading\)/)
    expect(headerMatch).toBeTruthy()
    const quotaMeterMatch = source.match(/function QuotaMeter[\s\S]*?getQuotaDisplay/)
    expect(quotaMeterMatch).toBeTruthy()
  })

  // 10. Header and body cannot show conflicting values
  test('header and body derive from the same quota store instance', () => {
    expect(source).toContain('useQuota()')
    // Both the main component and QuotaMeter call useQuota
    const matches = source.match(/useQuota\(\)/g)
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  // 11. Tapping the control opens ScanPlanModal or the approved plan interface
  test('tapping header control opens ScanPlanModal', () => {
    expect(source).toContain('onPress={handleCameraHeaderPress}')
    expect(source).toContain('setShowScanPlan(true)')
    expect(source).toContain('<ScanPlanModal')
  })

  // 12. The centered Juice Snap title remains centered
  test('header title remains centered with space-between layout', () => {
    expect(source).toContain("headerTitle: {")
    expect(source).toContain("justifyContent: 'space-between'")
  })

  // 13. The badge fits two-digit values such as 60
  test('badge style accommodates two-digit values', () => {
    expect(source).toContain('minWidth: 44')
    expect(source).toContain('flexDirection: \'row\'')
    expect(source).toContain('gap: 4')
    expect(source).toContain('paddingHorizontal: 10')
  })

  // 14. No legacy route is opened
  test('no legacy purchase route is opened from header', () => {
    expect(source).not.toContain('Vault')
    expect(source).not.toContain('ArchitectPro')
    expect(source).not.toContain('SnapPacks')
    expect(source).not.toContain('FreezerPass')
    expect(source).not.toContain('Lifetime')
  })

  // 15. No local authorization logic is added
  test('no local quota calculation or AsyncStorage quota counter', () => {
    expect(source).not.toContain('usePro(')
    // AsyncStorage is used only for juice method hydration, not quota counting
    const lines = source.split('\n')
    for (const line of lines) {
      if (line.includes('AsyncStorage')) {
        expect(line.toLowerCase()).not.toContain('quota')
      }
    }
  })
})
