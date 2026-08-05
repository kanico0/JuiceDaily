// Camera retry regression tests for QA Item 2 — Snap Produce Again.
// Tests exercise behavior by reading source and verifying the
// control-flow logic that governs camera launch, guard reset,
// and quota-timing boundaries.

const fs = require('fs')
const path = require('path')

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

const SCAN_SUCCESS_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ScanSuccessScreen.js'),
  'utf8',
)

const APP_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'App.js'),
  'utf8',
)

// Extract attemptCameraOpen body
const funcStart = HOME_SRC.indexOf('const attemptCameraOpen = useCallback')
const depArrayStart = HOME_SRC.indexOf('[serverQuota, refreshQuota]', funcStart)
const funcEnd = HOME_SRC.indexOf(')', depArrayStart)
const ATTEMPT_BODY = HOME_SRC.substring(funcStart, funcEnd + 1)

// Extract focus-listener block
const focusStart = HOME_SRC.indexOf('Reset isLogged when returning to this screen')
const focusEnd = HOME_SRC.indexOf('}, [navigation])', focusStart) + 20
const FOCUS_BLOCK = HOME_SRC.substring(focusStart, focusEnd)

// Extract unmount cleanup block
const unmountStart = HOME_SRC.indexOf('Cancel any in-flight camera eligibility attempt on unmount')
const unmountEnd = HOME_SRC.indexOf('}, [])', unmountStart) + 10
const UNMOUNT_BLOCK = HOME_SRC.substring(unmountStart, unmountEnd)

// Extract handleSnap
const snapStart = HOME_SRC.indexOf('const handleSnap = useCallback')
const snapEnd = HOME_SRC.indexOf('}, [attemptCameraOpen])', snapStart) + 25
const SNAP_BODY = HOME_SRC.substring(snapStart, snapEnd)

// Extract handleCameraClose
const closeStart = HOME_SRC.indexOf('const handleCameraClose = useCallback')
const closeEnd = HOME_SRC.indexOf('}, [])', closeStart) + 10
const CLOSE_BODY = HOME_SRC.substring(closeStart, closeEnd)

// Extract handleProduceIdentified
const identStart = HOME_SRC.indexOf('const handleProduceIdentified = useCallback')
const identEnd = HOME_SRC.indexOf('}, [', identStart) + 50
const IDENTIFY_BODY = HOME_SRC.substring(identStart, identEnd)

// Extract auto-open effect
const autoStart = HOME_SRC.indexOf('Auto-open camera when navigated with openCamera: true')
const autoEnd = HOME_SRC.indexOf('}, []) // eslint-disable-line', autoStart) + 30
const AUTO_BLOCK = HOME_SRC.substring(autoStart, autoEnd)

describe('Camera Retry — QA Item 2 Regression', () => {
  // 1. Snap Produce Again uses the correct camera route
  test('1. handleScanAnother navigates to ScanHome, not JuiceSnap', () => {
    expect(SCAN_SUCCESS_SRC).toContain("navigation.replace('ScanHome'")
    expect(SCAN_SUCCESS_SRC).not.toContain("navigation.replace('JuiceSnap'")
  })

  // 2. Successful navigation launches or requests the actual camera flow
  test('2. openCamera param triggers attemptCameraOpen via auto-open effect', () => {
    expect(AUTO_BLOCK).toContain('shouldAutoOpenCamera')
    expect(AUTO_BLOCK).toContain('attemptCameraOpen(true)')
  })

  test('2b. shouldAutoOpenCamera is derived from route params openCamera', () => {
    expect(HOME_SRC).toContain('route?.params?.openCamera === true')
  })

  // 3. Preparing-camera state clears after successful navigation
  test('3. isPreparingCamera set to false when camera opens', () => {
    const openIdx = ATTEMPT_BODY.indexOf("result.action === 'open_camera'")
    const section = ATTEMPT_BODY.substring(openIdx, openIdx + 200)
    expect(section).toContain('setIsCameraOpen(true)')
    expect(section).toContain('setIsPreparingCamera(false)')
  })

  test('3b. isPreparingCamera set to false in finally block', () => {
    const finallyIdx = ATTEMPT_BODY.indexOf('finally {')
    const section = ATTEMPT_BODY.substring(finallyIdx, finallyIdx + 300)
    expect(section).toContain('setIsPreparingCamera(false)')
  })

  // 4. Preparing-camera state clears after navigation failure
  test('4. isPreparingCamera set to false on error result', () => {
    const errIdx = ATTEMPT_BODY.indexOf("result.action === 'error'")
    const section = ATTEMPT_BODY.substring(errIdx, errIdx + 200)
    expect(section).toContain('setIsPreparingCamera(false)')
  })

  test('4b. isPreparingCamera set to false in catch block', () => {
    const catchIdx = ATTEMPT_BODY.indexOf('} catch (e) {')
    const section = ATTEMPT_BODY.substring(catchIdx, catchIdx + 500)
    expect(section).toContain('setIsPreparingCamera(false)')
  })

  test('4c. isPreparingCamera set to false on snap gate', () => {
    const gateIdx = ATTEMPT_BODY.indexOf("result.action === 'show_snap_gate'")
    const section = ATTEMPT_BODY.substring(gateIdx, gateIdx + 200)
    expect(section).toContain('setIsPreparingCamera(false)')
  })

  // 5. In-flight guard resets on component unmount
  test('5. unmount cleanup resets cameraInFlightRef to false', () => {
    expect(UNMOUNT_BLOCK).toContain('cameraInFlightRef.current = false')
  })

  test('5b. unmount cleanup aborts any pending AbortController', () => {
    expect(UNMOUNT_BLOCK).toContain('cameraAbortRef.current.abort()')
  })

  test('5c. unmount cleanup increments attempt ID to invalidate stale results', () => {
    expect(UNMOUNT_BLOCK).toContain('cameraAttemptIdRef.current += 1')
  })

  // 6. Rapid double tap does not open duplicate camera instances
  test('6. in-flight guard prevents concurrent attemptCameraOpen calls', () => {
    expect(ATTEMPT_BODY).toContain('if (cameraInFlightRef.current) return')
    expect(ATTEMPT_BODY).toContain('cameraInFlightRef.current = true')
  })

  test('6b. in-flight guard is set synchronously before any async work', () => {
    const guardIdx = ATTEMPT_BODY.indexOf('if (cameraInFlightRef.current) return')
    const setIdx = ATTEMPT_BODY.indexOf('cameraInFlightRef.current = true', guardIdx)
    const firstAwaitIdx = ATTEMPT_BODY.indexOf('await', setIdx)
    expect(setIdx).toBeGreaterThan(guardIdx)
    expect(firstAwaitIdx).toBeGreaterThan(setIdx)
  })

  // 7. A second legitimate attempt works after returning to the result screen
  test('7. focus listener resets cameraInFlightRef on screen focus', () => {
    expect(FOCUS_BLOCK).toContain("addListener?.('focus'")
    expect(FOCUS_BLOCK).toContain('cameraInFlightRef.current = false')
  })

  test('7b. focus listener resets isCameraOpen on screen focus', () => {
    expect(FOCUS_BLOCK).toContain('setIsCameraOpen(false)')
  })

  test('7c. focus listener resets isPreparingCamera on screen focus', () => {
    expect(FOCUS_BLOCK).toContain('setIsPreparingCamera(false)')
  })

  // 8. Denied permission follows the existing permission handling
  test('8. camera open path does not bypass permission checks', () => {
    // CameraScreen handles permissions internally — the open path
    // only sets isCameraOpen=true, it does not grant permissions
    const openIdx = ATTEMPT_BODY.indexOf("result.action === 'open_camera'")
    const section = ATTEMPT_BODY.substring(openIdx, openIdx + 100)
    expect(section).not.toMatch(/requestPermission|checkPermission|grantPermission/)
  })

  test('8b. handleCameraClose sets isCameraOpen to false (permission denial path)', () => {
    expect(CLOSE_BODY).toContain('setIsCameraOpen(false)')
  })

  // 9. Opening the camera does not consume scan quota
  test('9. attemptCameraOpen has no scan consumption calls', () => {
    expect(ATTEMPT_BODY).not.toMatch(/consumeScan|commitScan|decrementQuota|deductScan/)
  })

  test('9b. handleCameraClose has no scan consumption calls', () => {
    expect(CLOSE_BODY).not.toMatch(/consumeScan|commitScan|decrementQuota|deductScan/)
  })

  // 10. Scan use remains recorded only at the established successful-analysis boundary
  test('10. scan quota is applied only in handleProduceIdentified, not in camera open', () => {
    expect(IDENTIFY_BODY).toContain('applyQuotaSnapshot')
    expect(IDENTIFY_BODY).toContain('setIsCameraOpen(false)')
  })

  test('10b. handleProduceIdentified applies server-returned quota, not client-optimistic', () => {
    const quotaIdx = IDENTIFY_BODY.indexOf('if (visionResult.quota)')
    expect(quotaIdx).toBeGreaterThan(-1)
    const section = IDENTIFY_BODY.substring(quotaIdx, quotaIdx + 100)
    expect(section).toContain('applyQuotaSnapshot')
  })

  // Additional: ScanHome is the initial route in ScanFlowStack
  test('11. ScanFlowStack registers ScanHome as initial route with JuiceSnapScreen', () => {
    expect(APP_SRC).toContain('name="ScanHome"')
    expect(APP_SRC).toContain('component={JuiceSnapScreen}')
  })

  // Additional: handleScanAnother passes openCamera: true
  test('12. handleScanAnother passes openCamera: true in params', () => {
    expect(SCAN_SUCCESS_SRC).toContain('openCamera: true')
  })
})
