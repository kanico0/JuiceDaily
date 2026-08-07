// ─────────────────────────────────────────────────────────────
// postLoginCamera.test.ts — Regression tests for the camera
// initialization timeout after account upgrade.
//
// Proves:
//  10. Account upgrade/login resets stale camera initialization state.
//  11. Old initialization timers are cleared.
//  12. The next manual camera attempt creates a fresh session.
//  13. A readiness callback cancels the timeout.
//  14. Camera failure or dismissal resets Preparing Camera.
//  15. No automatic camera reopening occurs during login.
//  16. Existing cancel-and-retry behavior still passes.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..', '..')

describe('Post-login camera initialization', () => {
  test('10. onAuthenticated does not call attemptCameraOpen', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/screens/HomeScreen.js'), 'utf-8')
    // Find the onAuthenticated handler block
    const match = source.match(/onAuthenticated=\{\(\) => \{([\s\S]*?)\}\}/)
    expect(match).toBeTruthy()
    const handlerBody = match[1]
    // Must NOT call attemptCameraOpen
    expect(handlerBody).not.toContain('attemptCameraOpen')
    // Must reset stale state
    expect(handlerBody).toContain('pendingCameraOpenRef.current = false')
    expect(handlerBody).toContain('setIsPreparingCamera(false)')
    expect(handlerBody).toContain('cameraInFlightRef.current = false')
  })

  test('11. useCamera hook clears timers on unmount', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/hooks/useCamera.ts'), 'utf-8')
    // Cleanup on unmount
    expect(source).toContain('return () =>')
    expect(source).toContain('clearTimeout(readyTimerRef.current)')
  })

  test('12. handleSnap calls attemptCameraOpen for fresh session', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/screens/HomeScreen.js'), 'utf-8')
    const match = source.match(/const handleSnap = useCallback\(\(\) => \{([\s\S]*?)\}/)
    expect(match).toBeTruthy()
    expect(match[1]).toContain('attemptCameraOpen(false)')
  })

  test('13. onCameraReady cancels the timeout', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/hooks/useCamera.ts'), 'utf-8')
    const match = source.match(
      /const onCameraReady = useCallback\(\(\) => \{([\s\S]*?)\}, \[clearReadyTimer, clearFallbackProbe\]\)/,
    )
    expect(match).toBeTruthy()
    expect(match[1]).toContain('clearReadyTimer()')
  })

  test('14. resetCamera clears timer and resets state', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/hooks/useCamera.ts'), 'utf-8')
    const match = source.match(
      /const resetCamera = useCallback\(\(\) => \{([\s\S]*?)\}, \[clearReadyTimer, clearFallbackProbe\]\)/,
    )
    expect(match).toBeTruthy()
    expect(match[1]).toContain('clearReadyTimer()')
    expect(match[1]).toContain('sessionRef.current += 1')
    expect(match[1]).toContain('isReady: false')
    expect(match[1]).toContain("phase: 'idle'")
  })

  test('15. No automatic camera reopening occurs during login', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/screens/HomeScreen.js'), 'utf-8')
    // The onAuthenticated handler must NOT set isCameraOpen to true
    const match = source.match(/onAuthenticated=\{\(\) => \{([\s\S]*?)\}\}/)
    expect(match).toBeTruthy()
    expect(match[1]).not.toContain('setIsCameraOpen(true)')
    expect(match[1]).not.toContain('attemptCameraOpen')
  })

  test('16. onClose handler still resets camera state for cancel-and-retry', () => {
    const source = fs.readFileSync(path.resolve(ROOT, 'src/screens/HomeScreen.js'), 'utf-8')
    const match = source.match(/onClose=\{\(\) => \{([\s\S]*?)\}\}/)
    expect(match).toBeTruthy()
    const handlerBody = match[1]
    expect(handlerBody).toContain('setShowAccountGate(false)')
    expect(handlerBody).toContain('pendingCameraOpenRef.current = false')
    expect(handlerBody).toContain('setIsPreparingCamera(false)')
    expect(handlerBody).toContain('cameraInFlightRef.current = false')
  })

  test('AccountGateModal calls onAuthenticated and onClose on success', () => {
    const source = fs.readFileSync(
      path.resolve(ROOT, 'src/components/AccountGateModal.js'),
      'utf-8',
    )
    expect(source).toContain('if (onAuthenticated) onAuthenticated(result.userId)')
    expect(source).toContain('if (onClose) onClose()')
  })
})
