// ─────────────────────────────────────────────────────────────
// Regression tests for camera timeout false positive fix (Item 9)
//
// The invariant: Once the current camera session reaches
// camera_ready, an initialization-timeout callback for that
// session cannot subsequently produce "Camera initialization
// timeout."
//
// The primary guard is the phase check: the timeout callback
// only fires if prev.phase === 'camera_mounting'. Once
// onCameraReady fires, the timer is cleared AND the phase
// transitions to camera_ready, so even a stale callback is a
// no-op.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'useCamera.ts'), 'utf8')

const CAM_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'CameraScreen.js'),
  'utf8',
)

describe('Item 9: Camera timeout false positive fix', () => {
  test('1. timeout callback checks camera_mounting phase (sole guard)', () => {
    expect(SOURCE).toMatch(/prev\.phase\s*===\s*['"]camera_mounting['"]/)
  })

  test('2. timeout callback does NOT check isCapturing (removed — phase check is sufficient)', () => {
    const timeoutIdx = SOURCE.indexOf('setTimeout(() => {')
    const timeoutSection = SOURCE.substring(timeoutIdx, timeoutIdx + 600)
    // The phase check should be the sole condition, not combined with isCapturing
    expect(timeoutSection).not.toMatch(/prev\.isCapturing/)
  })

  test('3. onCameraReady clears the timer', () => {
    const onReadyIdx = SOURCE.indexOf('const onCameraReady = useCallback')
    const onReadySection = SOURCE.substring(onReadyIdx, onReadyIdx + 300)
    expect(onReadySection).toContain('clearReadyTimer')
  })

  test('4. takePhoto clears the timer defensively', () => {
    const takePhotoIdx = SOURCE.indexOf('takePhoto')
    const takePhotoSection = SOURCE.substring(takePhotoIdx, takePhotoIdx + 500)
    expect(takePhotoSection).toContain('clearReadyTimer')
  })

  test('5. session ID guards against stale timers', () => {
    expect(SOURCE).toMatch(/session\s*!==\s*sessionRef\.current/)
  })

  test('6. clearReadyTimer is called on unmount', () => {
    expect(SOURCE).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*clearReadyTimer/)
  })

  test('7. clearReadyTimer is called when app goes to background', () => {
    const appStateIdx = SOURCE.indexOf('AppState.addEventListener')
    const appStateSection = SOURCE.substring(appStateIdx - 200, appStateIdx + 100)
    expect(appStateSection).toContain('clearReadyTimer')
  })

  test('8. startReadyTimeout is NOT exported from the hook (encapsulation)', () => {
    // The return object should not include startReadyTimeout
    const returnIdx = SOURCE.lastIndexOf('return {')
    const returnSection = SOURCE.substring(returnIdx)
    expect(returnSection).not.toMatch(/startReadyTimeout/)
  })

  test('9. CameraScreen does NOT call startReadyTimeout directly', () => {
    expect(CAM_SCREEN_SRC).not.toMatch(/startReadyTimeout/)
  })

  test('10. CameraScreen mount effect only calls requestAccess, not startReadyTimeout', () => {
    const mountEffectIdx = CAM_SCREEN_SRC.indexOf('Request permission on mount')
    const mountEffectSection = CAM_SCREEN_SRC.substring(mountEffectIdx, mountEffectIdx + 300)
    expect(mountEffectSection).not.toMatch(/startReadyTimeout/)
    expect(mountEffectSection).toMatch(/requestAccess/)
  })

  // ── Lifecycle invariant tests ──

  test('11. timeout callback is a no-op when phase is not camera_mounting', () => {
    // The callback returns prev unchanged if phase !== camera_mounting
    const timeoutIdx = SOURCE.indexOf('setTimeout(() => {')
    const timeoutSection = SOURCE.substring(timeoutIdx, timeoutIdx + 1200)
    // Must have a return prev (no-op) path
    expect(timeoutSection).toMatch(/return prev/)
  })

  test('12. onCameraReady transitions phase to camera_ready (not camera_mounting)', () => {
    const onReadyIdx = SOURCE.indexOf('const onCameraReady = useCallback')
    const onReadySection = SOURCE.substring(onReadyIdx, onReadyIdx + 400)
    expect(onReadySection).toMatch(/camera_ready/)
  })

  test('13. useCamera permission effect only arms timer when phase is idle', () => {
    const effectIdx = SOURCE.indexOf('hasPermission === true')
    const effectSection = SOURCE.substring(effectIdx, effectIdx + 400)
    expect(effectSection).toMatch(/state\.phase\s*===\s*['"]idle['"]/)
  })
})
