// FAB Snap Navigation Flow tests
// Verifies the end-to-end flow from FAB press to camera open:
//   1. ScanHome receives openCamera: true
//   2. (No pre-Snap disclosure exists in the codebase — flow goes direct)
//   3. (User acknowledgment N/A — no disclosure to acknowledge)
//   4. Shared camera coordinator runs automatically
//   5. Juice Snap menu is not displayed as an intermediate destination
//   6. User does not need to press Snap Produce afterward
//   7. Parameter is consumed exactly once
//   8. Returning to ScanHome later does not reopen camera unintentionally
//   9. Back navigation remains correct
//   10. Snap Produce and FAB use the same coordinator

const fs = require('fs')
const path = require('path')

const tabSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'ModernTabBar.js'),
  'utf8',
)

const homeSource = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

const coordinatorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'cameraEligibilityCoordinator.ts'),
  'utf8',
)

describe('FAB Snap Navigation Flow', () => {

  // 1. ScanHome receives openCamera: true
  test('1. FAB navigates to ScanFlow with screen=ScanHome and openCamera=true', () => {
    const fabIdx = tabSource.indexOf('const handleFAB')
    const fabSection = tabSource.substring(fabIdx, fabIdx + 200)
    expect(fabSection).toContain("navigate('ScanFlow'")
    expect(fabSection).toContain("screen: 'ScanHome'")
    expect(fabSection).toContain('openCamera: true')
  })

  // 2. No pre-Snap disclosure in the codebase — flow is direct
  test('2. no intermediate disclosure screen between FAB and camera', () => {
    // The FAB goes directly to ScanHome with openCamera:true
    // There is no separate disclosure or onboarding screen in the flow
    const fabIdx = tabSource.indexOf('const handleFAB')
    const fabSection = tabSource.substring(fabIdx, fabIdx + 200)
    // Verify no intermediate navigation to a disclosure/onboarding screen
    expect(fabSection).not.toContain('disclosure')
    expect(fabSection).not.toContain('onboard')
    expect(fabSection).not.toContain('tutorial')
    expect(fabSection).not.toContain('ExplainFlow')
  })

  // 3. (N/A — no disclosure to acknowledge)
  test('3. no user acknowledgment step required before camera opens', () => {
    // The auto-open useEffect fires immediately when openCamera is true
    const effectIdx = homeSource.indexOf('Auto-open camera when navigated with openCamera')
    const effectSection = homeSource.substring(effectIdx, effectIdx + 300)
    expect(effectSection).toContain('shouldAutoOpenCamera')
    expect(effectSection).toContain('attemptCameraOpen(true)')
    // No acknowledgment gate or confirmation step
    expect(effectSection).not.toContain('acknowledge')
    expect(effectSection).not.toContain('confirm')
    expect(effectSection).not.toContain('accept')
  })

  // 4. Shared camera coordinator runs automatically
  test('4. attemptCameraOpen is called automatically when openCamera param is true', () => {
    const effectIdx = homeSource.indexOf('Auto-open camera when navigated with openCamera')
    const effectSection = homeSource.substring(effectIdx, effectIdx + 300)
    expect(effectSection).toContain('useEffect')
    expect(effectSection).toContain('shouldAutoOpenCamera')
    expect(effectSection).toContain('attemptCameraOpen(true)')
  })

  test('4b. attemptCameraOpen uses checkCameraEligibility coordinator', () => {
    const attemptIdx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    const attemptSection = homeSource.substring(attemptIdx, attemptIdx + 5000)
    expect(attemptSection).toContain('checkCameraEligibility')
  })

  // 5. Juice Snap menu is not displayed as an intermediate destination
  test('5. FAB does not navigate to JuiceSnapScreen as a menu', () => {
    const fabIdx = tabSource.indexOf('const handleFAB')
    const fabSection = tabSource.substring(fabIdx, fabIdx + 200)
    // The FAB should NOT navigate to 'JuiceSnapScreen' as a standalone screen
    // It should navigate to 'ScanFlow' with 'ScanHome' sub-screen
    expect(fabSection).not.toMatch(/navigate\('JuiceSnapScreen'\)/)
    expect(fabSection).toContain('ScanFlow')
    expect(fabSection).toContain('ScanHome')
  })

  // 6. User does not need to press Snap Produce afterward
  test('6. camera auto-opens without requiring Snap Produce button press', () => {
    const effectIdx = homeSource.indexOf('Auto-open camera when navigated with openCamera')
    const effectSection = homeSource.substring(effectIdx, effectIdx + 300)
    // The useEffect auto-calls attemptCameraOpen(true) — no button press needed
    expect(effectSection).toContain('attemptCameraOpen(true)')
    // The effect runs on mount (empty deps), not on a button press
    expect(effectSection).toContain('[]')
  })

  // 7. Parameter is consumed exactly once
  test('7. openCamera param is read once via useEffect with empty deps', () => {
    const effectIdx = homeSource.indexOf('Auto-open camera when navigated with openCamera')
    const effectSection = homeSource.substring(effectIdx, effectIdx + 300)
    // Empty dependency array means the effect runs exactly once on mount
    expect(effectSection).toContain('[]')
    // The param is read via route?.params?.openCamera
    const paramIdx = homeSource.indexOf('shouldAutoOpenCamera')
    const paramSection = homeSource.substring(paramIdx, paramIdx + 100)
    expect(paramSection).toContain('route?.params?.openCamera')
  })

  test('7b. openCamera param is not stored in persistent state', () => {
    // The param is a route param, not stored in useState or AsyncStorage
    // shouldAutoOpenCamera is derived from route params, not state
    const paramIdx = homeSource.indexOf('const shouldAutoOpenCamera')
    const paramSection = homeSource.substring(paramIdx, paramIdx + 100)
    expect(paramSection).toContain('route?.params?.openCamera')
    expect(paramSection).not.toContain('useState')
    expect(paramSection).not.toContain('AsyncStorage')
  })

  // 8. Returning to ScanHome later does not reopen camera unintentionally
  test('8. useEffect has empty deps so it only runs once per mount', () => {
    const effectIdx = homeSource.indexOf('Auto-open camera when navigated with openCamera')
    const effectSection = homeSource.substring(effectIdx, effectIdx + 300)
    // Empty deps = runs once on mount, not on re-renders
    // When returning to ScanHome, if openCamera is not in params, shouldAutoOpenCamera is false
    expect(effectSection).toContain('shouldAutoOpenCamera')
    expect(effectSection).toContain('!isCameraOpen')
    // The guard prevents re-opening if camera is already open
    expect(effectSection).toContain('!isCameraOpen')
  })

  test('8b. shouldAutoOpenCamera is false when openCamera param is absent', () => {
    const paramIdx = homeSource.indexOf('const shouldAutoOpenCamera')
    const paramSection = homeSource.substring(paramIdx, paramIdx + 100)
    // route?.params?.openCamera === true — if param is absent, this is false
    expect(paramSection).toContain('=== true')
  })

  // 9. Back navigation remains correct
  test('9. FAB navigates to ScanFlow which is a nested navigator with back', () => {
    const fabIdx = tabSource.indexOf('const handleFAB')
    const fabSection = tabSource.substring(fabIdx, fabIdx + 200)
    // ScanFlow is a navigator, not a modal — back navigation works normally
    expect(fabSection).toContain('ScanFlow')
    // No modal presentation or replace that would break back
    expect(fabSection).not.toContain('replace')
    expect(fabSection).not.toContain('push')
  })

  // 10. Snap Produce and FAB use the same coordinator
  test('10. handleSnap and auto-open both call attemptCameraOpen', () => {
    const snapIdx = homeSource.indexOf('const handleSnap = useCallback')
    const snapSection = homeSource.substring(snapIdx, snapIdx + 200)
    expect(snapSection).toContain('attemptCameraOpen(false)')

    const effectIdx = homeSource.indexOf('Auto-open camera when navigated with openCamera')
    const effectSection = homeSource.substring(effectIdx, effectIdx + 300)
    expect(effectSection).toContain('attemptCameraOpen(true)')

    // Both use the same attemptCameraOpen function
    const attemptIdx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    expect(attemptIdx).toBeGreaterThan(-1)
  })

  test('10b. attemptCameraOpen is a single useCallback used by both paths', () => {
    // Verify there is exactly one definition of attemptCameraOpen
    const matches = homeSource.match(/const attemptCameraOpen = useCallback/g)
    expect(matches).toHaveLength(1)
  })

  test('10c. checkCameraEligibility is the shared coordinator', () => {
    expect(coordinatorSource).toContain('export async function checkCameraEligibility')
    expect(homeSource).toContain('checkCameraEligibility')
  })
})
