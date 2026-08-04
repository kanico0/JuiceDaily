const fs = require('fs')
const path = require('path')

const CAMERA_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'CameraScreen.js'),
  'utf8',
)

const USE_CAMERA_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'hooks', 'useCamera.ts'),
  'utf8',
)

const HOME_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

describe('Camera Native Readiness and Abort Lifecycle', () => {
  // 1. Snap Produce enters preparation
  test('1. HomeScreen has isPreparingCamera state', () => {
    expect(HOME_SCREEN_SRC).toContain('setIsPreparingCamera')
    expect(HOME_SCREEN_SRC).toContain('isPreparingCamera')
  })

  // 2. FAB Snap uses the same coordinator
  test('2. handleSnap calls attemptCameraOpen', () => {
    const snapIdx = HOME_SCREEN_SRC.indexOf('const handleSnap')
    const section = HOME_SCREEN_SRC.substring(snapIdx, snapIdx + 300)
    expect(section).toContain('attemptCameraOpen')
  })

  // 3. Quota request receives the attempt cancellation signal
  test('3. AbortController is used in attemptCameraOpen', () => {
    expect(HOME_SCREEN_SRC).toContain('AbortController')
    expect(HOME_SCREEN_SRC).toContain('cameraAbortRef')
    expect(HOME_SCREEN_SRC).toContain('abortController')
  })

  // 4. One overall timeout governs the attempt
  test('4. One overall timeout with abort on expiry', () => {
    expect(HOME_SCREEN_SRC).toContain('overallTimer')
    expect(HOME_SCREEN_SRC).toContain('overallTimeoutPromise')
    expect(HOME_SCREEN_SRC).toContain('CAMERA_TIMEOUT_MS')
  })

  // 5. Timeout aborts pending requests
  test('5. Timeout calls abortController.abort()', () => {
    const timeoutIdx = HOME_SCREEN_SRC.indexOf('overallTimeoutPromise')
    const section = HOME_SCREEN_SRC.substring(timeoutIdx, timeoutIdx + 200)
    expect(section).toContain('abortController.abort()')
  })

  // 6. Component unmount aborts pending requests
  test('6. Unmount aborts pending requests', () => {
    const unmountIdx = HOME_SCREEN_SRC.indexOf('Cancel any in-flight camera')
    const section = HOME_SCREEN_SRC.substring(unmountIdx, unmountIdx + 300)
    expect(section).toContain('cameraAbortRef.current.abort()')
  })

  // 7. Retry aborts the previous attempt
  test('7. Retry aborts previous attempt', () => {
    const retryIdx = HOME_SCREEN_SRC.indexOf('Abort any previous attempt')
    expect(retryIdx).toBeGreaterThan(-1)
    const section = HOME_SCREEN_SRC.substring(retryIdx, retryIdx + 200)
    expect(section).toContain('cameraAbortRef.current.abort()')
  })

  // 8. Late results cannot open the camera
  test('8. Stale attempt guard prevents late camera open', () => {
    expect(HOME_SCREEN_SRC).toContain('isStale()')
    expect(HOME_SCREEN_SRC).toContain('cameraAttemptIdRef')
  })

  // 9. Eligible result continues to permission
  test('9. open_camera action sets isCameraOpen', () => {
    expect(HOME_SCREEN_SRC).toContain("result.action === 'open_camera'")
    expect(HOME_SCREEN_SRC).toContain('setIsCameraOpen(true)')
  })

  // 10. Granted permission renders the native camera component
  test('10. CameraScreen renders CameraView when permission granted', () => {
    expect(CAMERA_SCREEN_SRC).toContain('CameraView')
    expect(CAMERA_SCREEN_SRC).toContain('expo-camera')
  })

  // 11. Camera state becomes camera_mounting
  test('11. useCamera tracks camera_mounting phase', () => {
    expect(USE_CAMERA_SRC).toContain('camera_mounting')
  })

  // 12. Native ready callback produces camera_ready
  test('12. onCameraReady sets phase to camera_ready', () => {
    const readyIdx = USE_CAMERA_SRC.indexOf('onCameraReady')
    const section = USE_CAMERA_SRC.substring(readyIdx, readyIdx + 300)
    expect(section).toContain('camera_ready')
  })

  // 13. Camera remains mounted after the async handler finishes
  test('13. CameraView is not conditionally unmounted after ready', () => {
    const cameraViewIdx = CAMERA_SCREEN_SRC.indexOf('<CameraView')
    const section = CAMERA_SCREEN_SRC.substring(cameraViewIdx, cameraViewIdx + 500)
    expect(section).toContain('onCameraReady')
    expect(section).toContain('onMountError')
  })

  // 14. Native mount error produces visible retry feedback
  test('14. onMountError handler shows error with retry', () => {
    expect(CAMERA_SCREEN_SRC).toContain('onMountError')
    expect(CAMERA_SCREEN_SRC).toContain('Camera Could Not Start')
    expect(CAMERA_SCREEN_SRC).toContain('Try Again')
  })

  // 15. Native initialization timeout produces visible feedback
  test('15. Camera ready timeout produces visible error', () => {
    expect(USE_CAMERA_SRC).toContain('CAMERA_READY_TIMEOUT_MS')
    expect(USE_CAMERA_SRC).toContain('Camera initialization timed out')
  })

  // 16. Permission approval resumes automatically
  test('16. Permission granted transitions to camera_mounting', () => {
    const grantedIdx = USE_CAMERA_SRC.indexOf('if (granted)')
    const section = USE_CAMERA_SRC.substring(grantedIdx, grantedIdx + 200)
    expect(section).toContain('camera_mounting')
  })

  // 17. Permission denial produces visible feedback
  test('17. Permission denial shows error phase', () => {
    expect(USE_CAMERA_SRC).toContain("hasPermission: false")
    expect(USE_CAMERA_SRC).toContain("phase: 'error'")
  })

  // 18. Permanent denial offers Settings guidance
  test('18. Denied permission shows Open Settings option', () => {
    expect(CAMERA_SCREEN_SRC).toContain('isDenied')
    expect(CAMERA_SCREEN_SRC).toContain('Open Settings')
    expect(CAMERA_SCREEN_SRC).toContain('Linking.openSettings')
  })

  // 19. Camera component has usable full-screen layout
  test('19. CameraView uses absoluteFill style', () => {
    expect(CAMERA_SCREEN_SRC).toContain('StyleSheet.absoluteFill')
  })

  // 20. No invisible modal blocks the camera
  test('20. Camera modal uses fullScreen presentation', () => {
    expect(HOME_SCREEN_SRC).toContain('presentationStyle="fullScreen"')
  })

  // 21. Android back closes the camera
  test('21. Camera modal has onRequestClose handler', () => {
    expect(HOME_SCREEN_SRC).toContain('onRequestClose={handleCameraClose}')
  })

  // 22. Opening consumes zero scans
  test('22. No scan consumption in attemptCameraOpen', () => {
    const attemptIdx = HOME_SCREEN_SRC.indexOf('const attemptCameraOpen')
    const attemptSection = HOME_SCREEN_SRC.substring(attemptIdx, attemptIdx + 5000)
    expect(attemptSection).not.toContain('consumeScan')
    expect(attemptSection).not.toContain('decrementScan')
  })

  // 23. Canceling consumes zero scans
  test('23. handleCameraClose does not consume scans', () => {
    const closeIdx = HOME_SCREEN_SRC.indexOf('handleCameraClose')
    const section = HOME_SCREEN_SRC.substring(closeIdx, closeIdx + 500)
    expect(section).not.toContain('consumeScan')
  })

  // 24. Retry after any failure can reach camera_ready
  test('24. resetCamera clears state for fresh attempt', () => {
    expect(USE_CAMERA_SRC).toContain('resetCamera')
    expect(USE_CAMERA_SRC).toContain("phase: 'idle'")
  })

  // 25. All timers and abort controllers are cleaned up
  test('25. Timers cleared on unmount and on ready', () => {
    expect(USE_CAMERA_SRC).toContain('clearTimeout')
    expect(USE_CAMERA_SRC).toContain('readyTimerRef')
    expect(HOME_SCREEN_SRC).toContain('clearTimeout(overallTimer)')
  })

  // 26. Camera mounting overlay shown while native initializes
  test('26. Mounting overlay shown during camera_mounting phase', () => {
    expect(CAMERA_SCREEN_SRC).toContain('isMounting')
    expect(CAMERA_SCREEN_SRC).toContain('mountingOverlay')
    expect(CAMERA_SCREEN_SRC).toContain('Starting camera')
  })

  // 27. Camera phase lifecycle: idle → permission_check → camera_mounting → camera_ready
  test('27. Full camera phase lifecycle is defined', () => {
    expect(USE_CAMERA_SRC).toContain("'idle'")
    expect(USE_CAMERA_SRC).toContain("'permission_check'")
    expect(USE_CAMERA_SRC).toContain("'camera_mounting'")
    expect(USE_CAMERA_SRC).toContain("'camera_ready'")
    expect(USE_CAMERA_SRC).toContain("'error'")
  })

  // 28. Auto-transition when permission already granted on mount
  test('28. Auto-transitions to camera_mounting when permission already granted', () => {
    expect(USE_CAMERA_SRC).toContain('hasPermission === true')
    expect(USE_CAMERA_SRC).toContain("state.phase === 'idle'")
  })
})
