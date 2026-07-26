/* eslint-env jest, node */

const fs = require('fs')
const path = require('path')

const homeScreenPath = path.join(__dirname, '..', 'HomeScreen.js')
const scanPlanModalPath = path.join(__dirname, '..', '..', 'components', 'ScanPlanModal.js')
const analyticsPath = path.join(__dirname, '..', '..', 'services', 'AnalyticsService.js')
const proStorePath = path.join(__dirname, '..', '..', 'services', 'ProStore.js')
const subscriptionConfigPath = path.join(__dirname, '..', '..', 'services', 'subscriptions', 'subscriptionConfig.ts')

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

describe('JuiceSnap quota counter cleanup', () => {
  test('legacy 3/3 Free label is no longer rendered in HomeScreen', () => {
    const source = read(homeScreenPath)
    expect(source).not.toContain('snapInfo.label')
    expect(source).not.toContain('3/3 Free')
    expect(source).not.toContain('${remaining}/${FREE_MONTHLY_SNAPS}')
  })

  test('camera icon remains visible in the upper-right header', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('<Camera size={14}')
    expect(source).toMatch(/<TouchableOpacity[^>]*style=\{styles\.filmRoll\}/)
  })

  test('camera icon is tappable and has a meaningful accessibility label', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('onPress={handleCameraHeaderPress}')
    expect(source).toMatch(/accessibilityLabel[\s\S]*?quotaDisplay/)
    expect(source).toContain('accessibilityHint="Shows your current scan allowance and RawLifeFlow Pro options."')
    expect(source).toContain('accessibilityRole="button"')
  })

  test('camera header icon touch target is at least 44 by 44', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('filmRoll: {')
    expect(source).toContain('minWidth: 44')
    expect(source).toContain('height: 44')
  })

  test('HomeScreen no longer calls legacy useSnap before opening camera', () => {
    const source = read(homeScreenPath)
    expect(source).not.toContain('useSnap()')
    expect(source).not.toContain('checkSnapEligibility()')
    expect(source).not.toContain('const snapEligibility =')
  })

  test('HomeScreen uses the authoritative quota store instead of ProStore snap counting', () => {
    const source = read(homeScreenPath)
    expect(source).toContain("const { quota, loading: quotaLoading, refresh: refreshQuota } = useQuota()")
    expect(source).toContain('getQuotaDisplay(quota, isPro, quotaLoading)')
    expect(source).toContain('quotaDisplay.effectiveRemaining != null && quotaDisplay.effectiveRemaining <= 0')
  })

  test('opening the camera does not consume a legacy snap', () => {
    const source = read(homeScreenPath)
    const handleSnapMatch = source.match(/const handleSnap = useCallback\(\(\) => \{([\s\S]*?)\}, \[canUseAuthoritativeQuota, isQuotaExhausted\]\)/)
    expect(handleSnapMatch).toBeTruthy()
    const body = handleSnapMatch[1]
    expect(body).toContain('setIsCameraOpen(true)')
    expect(body).not.toContain('useSnap')
  })

  test('Free user with scans remaining opens the ScanPlanModal, not an exhausted modal', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('<ScanPlanModal')
    expect(source).toContain('visible={showScanPlan}')
    expect(source).toContain("onUpgrade={handleScanPlanUpgrade}")
    expect(source).toContain("navigation.navigate('Paywall', { source: 'camera_header_icon' })")
    const scanPlanSource = read(scanPlanModalPath)
    expect(scanPlanSource).toContain('Free Scan Plan')
    expect(scanPlanSource).toContain('Continue with Free')
    expect(scanPlanSource).not.toContain('Upgrade to Pro')
  })

  test('Free user with zero scans opens the existing quota-exhausted invitation', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('<ScanQuotaReachedModal')
    expect(source).toContain("onManualEntry={handleQuotaManualEntry}")
    expect(source).toContain("onUpgrade={handleQuotaUpgrade}")
    expect(source).toContain("navigation.navigate('Paywall', { source: 'scan_quota_exhausted' })")
  })

  test('Pro user with scans remaining does not see an upgrade invitation in ScanPlanModal', () => {
    const scanPlanSource = read(scanPlanModalPath)
    expect(scanPlanSource).toContain('RawLifeFlow Pro')
    expect(scanPlanSource).toMatch(/Your Pro plan is active\. You have used \$\{used\} of \$\{limit\} AI scans this month/)
    expect(scanPlanSource).toContain('{isPro ? \'Continue\' : \'Continue with Free\'}')
  })

  test('Pro user with zero scans uses the existing Pro informational state', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('<ScanQuotaReachedModal')
    const scanQuotaSource = read(path.join(__dirname, '..', '..', 'components', 'ScanQuotaReachedModal.js'))
    expect(scanQuotaSource).toContain('You’ve used your ${scanLimit} Pro AI scans for this period')
    expect(scanQuotaSource).toContain('manual')
  })

  test('ScanPlanModal uses authoritative quota for usage copy', () => {
    const scanPlanSource = read(scanPlanModalPath)
    expect(scanPlanSource).toContain('getQuotaDisplay')
    expect(scanPlanSource).toContain('quotaDisplay.effectiveUsed')
    expect(scanPlanSource).toContain('quotaDisplay.displayLimit')
    expect(scanPlanSource).toContain('quotaDisplay.effectiveRemaining')
    expect(scanPlanSource).not.toContain('FREE_MONTHLY_SNAPS')
    expect(scanPlanSource).not.toContain('monthlySnapCount')
  })

  test('authoritative Free limit remains 5 and Pro limit remains 60', () => {
    const config = read(subscriptionConfigPath)
    expect(config).toContain('FREE_MONTHLY_SCAN_LIMIT = 5')
    expect(config).toContain('PRO_MONTHLY_SCAN_LIMIT = 60')
  })

  test('legacy FREE_MONTHLY_SNAPS = 3 is no longer referenced by HomeScreen', () => {
    const source = read(homeScreenPath)
    expect(source).not.toContain('FREE_MONTHLY_SNAPS')
    expect(source).not.toContain('monthlySnapCount')
  })

  test('manual ingredient entry does not consume scan quota', () => {
    const source = read(homeScreenPath)
    const handleManualAddMatch = source.match(/const handleManualAdd = useCallback\(\(item\) => \{([\s\S]*?)\}, \[/)
    expect(handleManualAddMatch).toBeTruthy()
    expect(handleManualAddMatch[1]).not.toContain('useSnap')
    expect(handleManualAddMatch[1]).not.toContain('quota')
  })

  test('QuotaMeter continues to display authoritative usage', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('function QuotaMeter')
    expect(source).toContain('selectQuotaLabel(quota)')
    expect(source).toContain('<QuotaMeter navigation={navigation} />')
  })

  test('camera header icon tap is tracked with scan_plan_icon_tapped analytics event', () => {
    const analyticsSource = read(analyticsPath)
    expect(analyticsSource).toContain('scan_plan_icon_tapped:')
    expect(analyticsSource).toContain("optional: ['plan', 'scans_used', 'scans_limit', 'quota_exhausted', 'placement']")
    const homeSource = read(homeScreenPath)
    expect(homeSource).toContain("trackEvent('scan_plan_icon_tapped'")
    expect(homeSource).toContain("placement: 'camera_header_icon'")
  })

  test('ScanPlanModal supports reduced motion', () => {
    const scanPlanSource = read(scanPlanModalPath)
    expect(scanPlanSource).toContain('useReducedMotion')
    expect(scanPlanSource).toContain("animationType={isReduced ? 'none' : 'fade'}")
  })

  test('legacy SnapGateModal is no longer used in HomeScreen', () => {
    const source = read(homeScreenPath)
    expect(source).not.toContain('<SnapGateModal')
    expect(source).not.toContain("import SnapGateModal")
  })
})

describe('Juice Snap juicer-type controls removed', () => {
  test('Cold Pressed and Centrifugal toggle buttons are absent from Juice Snap', () => {
    const source = read(homeScreenPath)
    expect(source).not.toContain('handleToggleJuiceMethod')
    expect(source).not.toContain('juiceMethodRow')
    expect(source).not.toContain('juiceMethodBtn')
    expect(source).not.toContain('juiceMethodBtnActive')
    expect(source).not.toContain('juiceMethodText')
    expect(source).not.toContain('juiceMethodTextActive')
  })

  test('Cog icon import is removed since it was only used by the toggle', () => {
    const source = read(homeScreenPath)
    expect(source).not.toContain('Cog')
  })

  test('juiceMethod state and hydration from Settings persist (read-only)', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('const [juiceMethod, setJuiceMethod] = useState')
    expect(source).toContain('JUICE_METHOD_STORAGE_KEY')
    expect(source).toContain('hydrateJuiceMethod')
    expect(source).toContain("AsyncStorage.getItem(JUICE_METHOD_STORAGE_KEY)")
  })

  test('nutrition pipeline still passes juiceMethod to buildBatch', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('buildBatch(')
    expect(source).toContain(', juiceMethod)')
    expect(source).toContain('processJuiceBatch(scannedIngredients, juiceMethod)')
  })

  test('ProduceEditRow still receives juiceMethod for nutrition yield', () => {
    const source = read(homeScreenPath)
    expect(source).toContain('juiceMethod={juiceMethod}')
  })

  test('Settings screen retains juicer-type configuration', () => {
    const settingsPath = path.join(__dirname, '..', 'SettingsScreen.js')
    const source = read(settingsPath)
    expect(source).toContain('JUICE_METHOD_STORAGE_KEY')
    expect(source).toContain('JUICER_TYPE_OPTIONS')
    expect(source).toContain('handleSetJuicerType')
    expect(source).toContain('cold_pressed')
    expect(source).toContain('centrifugal')
  })
})
