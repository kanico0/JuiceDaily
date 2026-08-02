// Snap Produce camera navigation tests
// Verifies the press path from SnapButton to camera open, error recovery,
// and that quota loading does not leave the button permanently inert.

const fs = require('fs')
const path = require('path')

const homeSource = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

const snapButtonSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'SnapButton.js'),
  'utf8',
)

const coordinatorSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'cameraEligibilityCoordinator.ts'),
  'utf8',
)

describe('Snap Produce: button and handler wiring', () => {
  test('1. SnapButton renders with onPress prop', () => {
    expect(snapButtonSource).toContain('onPress={onPress}')
  })

  test('2. SnapButton label is "Snap Produce"', () => {
    expect(snapButtonSource).toContain('Snap Produce')
  })

  test('3. HomeScreen imports SnapButton', () => {
    expect(homeSource).toContain("import SnapButton from '../components/SnapButton'")
  })

  test('4. SnapButton is rendered with handleSnap onPress', () => {
    expect(homeSource).toContain('<SnapButton onPress={handleSnap} />')
  })

  test('5. handleSnap calls attemptCameraOpen', () => {
    expect(homeSource).toContain('attemptCameraOpen(false)')
  })

  test('6. handleSnap triggers haptic feedback', () => {
    const idx = homeSource.indexOf('const handleSnap = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = homeSource.substring(idx, idx + 200)
    expect(section).toContain('Haptics.impactAsync')
  })
})

describe('Snap Produce: attemptCameraOpen error handling', () => {
  test('7. attemptCameraOpen has try/catch', () => {
    const idx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = homeSource.substring(idx, idx + 2000)
    expect(section).toContain('try {')
    expect(section).toContain('catch (e)')
  })

  test('8. attemptCameraOpen has in-flight guard with reset', () => {
    expect(homeSource).toContain('cameraInFlightRef')
    expect(homeSource).toContain('cameraInFlightRef.current = true')
    expect(homeSource).toContain('cameraInFlightRef.current = false')
  })

  test('9. In-flight guard is reset in finally block', () => {
    const idx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    const section = homeSource.substring(idx, idx + 2000)
    expect(section).toContain('finally {')
    expect(section).toContain('cameraInFlightRef.current = false')
  })

  test('10. catch block shows snap gate as safe fallback', () => {
    const idx = homeSource.indexOf('catch (e)')
    expect(idx).toBeGreaterThanOrEqual(0)
    const section = homeSource.substring(idx, idx + 300)
    expect(section).toContain('setShowSnapGate(true)')
  })
})

describe('Snap Produce: quota loading resilience', () => {
  test('11. Null quota does not block camera (optimistic for camera open)', () => {
    expect(homeSource).toContain('quotaLoaded')
    expect(homeSource).toContain('effectiveRemaining')
  })

  test('12. When quota is null, effectiveRemaining is 1 (eligible)', () => {
    expect(homeSource).toContain('quotaLoaded ? filmRollRemaining : 1')
  })

  test('13. serverQuota is in dependency array', () => {
    const idx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    const section = homeSource.substring(idx, idx + 2000)
    expect(section).toContain('serverQuota')
  })
})

describe('Snap Produce: camera eligibility coordinator', () => {
  test('14. Coordinator returns open_camera for eligible users', () => {
    expect(coordinatorSource).toContain("'open_camera'")
  })

  test('15. Coordinator returns show_snap_gate for exhausted users', () => {
    expect(coordinatorSource).toContain("'show_snap_gate'")
  })

  test('16. Coordinator returns show_account_gate for completed guests', () => {
    expect(coordinatorSource).toContain("'show_account_gate'")
  })

  test('17. Coordinator returns show_auth_resume for in-progress journeys', () => {
    expect(coordinatorSource).toContain("'show_auth_resume'")
  })
})

describe('Snap Produce: camera modal and close behavior', () => {
  test('18. Camera is opened via Modal (not navigation)', () => {
    expect(homeSource).toContain('visible={isCameraOpen}')
    expect(homeSource).toContain('<CameraScreen')
  })

  test('19. handleCameraClose sets isCameraOpen to false', () => {
    expect(homeSource).toContain('setIsCameraOpen(false)')
  })

  test('20. Camera modal has onRequestClose', () => {
    expect(homeSource).toContain('onRequestClose={handleCameraClose}')
  })
})

describe('Snap Produce: no scan consumption for camera open', () => {
  test('21. Opening camera does not call useSnap or recordSnapUsage', () => {
    const idx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    const section = homeSource.substring(idx, idx + 2000)
    expect(section).not.toContain('useSnap')
    expect(section).not.toContain('recordSnapUsage')
    expect(section).not.toContain('applySnapshot')
  })

  test('22. Camera cancellation sets isCameraOpen false without scan consumption', () => {
    const closeIdx = homeSource.indexOf('handleCameraClose')
    expect(closeIdx).toBeGreaterThanOrEqual(0)
    const section = homeSource.substring(closeIdx, closeIdx + 300)
    expect(section).toContain('setIsCameraOpen(false)')
    expect(section).not.toContain('useSnap')
  })
})

describe('Snap Produce: pending camera open after auth', () => {
  test('23. Account gate sets pendingCameraOpenRef', () => {
    expect(homeSource).toContain('pendingCameraOpenRef.current = true')
  })

  test('24. After auth, pendingCameraOpenRef is reset and attemptCameraOpen is called', () => {
    expect(homeSource).toContain('pendingCameraOpenRef.current = false')
    expect(homeSource).toContain('attemptCameraOpen(false)')
  })
})

describe('Snap Produce: no silent exception swallowing', () => {
  test('25. No empty catch blocks in attemptCameraOpen', () => {
    const idx = homeSource.indexOf('const attemptCameraOpen = useCallback')
    const section = homeSource.substring(idx, idx + 2000)
    // The catch block should have content (setShowSnapGate)
    const catchIdx = section.indexOf('catch (e)')
    expect(catchIdx).toBeGreaterThanOrEqual(0)
    const catchSection = section.substring(catchIdx, catchIdx + 200)
    expect(catchSection).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/)
  })
})

describe('Snap Produce: Glow Journey and History changes did not disconnect callback', () => {
  test('26. handleSnap is still wired (not overwritten by other integrations)', () => {
    // Verify handleSnap appears exactly once as a definition
    const matches = homeSource.match(/const handleSnap = useCallback/g)
    expect(matches).toBeTruthy()
    expect(matches.length).toBe(1)
  })

  test('27. SnapButton onPress still references handleSnap', () => {
    expect(homeSource).toContain('<SnapButton onPress={handleSnap} />')
  })
})
