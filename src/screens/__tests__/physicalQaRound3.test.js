// ─────────────────────────────────────────────────────────────
// physicalQaRound3.test.js — Regression tests for physical QA
// round 3 issues:
//   Issue 1: Save Juice disappears but nothing happens
//   Issue 2: Snap Produce Again stuck on Preparing camera
//   Issue 3: Disable Log Juice Today while any ingredient has red X
//   Issue 4: Adaptive icon backgroundColor
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc(relPath) {
  const full = path.join(__dirname, relPath)
  return fs.readFileSync(full, 'utf8')
}

const ROOT = path.join(__dirname, '..', '..', '..')
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const HOME_SRC = readSrc('../HomeScreen.js')

// ── Issue 1: Save Juice disappears but nothing happens ───────

describe('Issue 1 — Save Juice / Log to Today feedback', () => {
  it('handleLogToChallenge wraps the body in try/catch', () => {
    const fnMatch = HOME_SRC.match(
      /const handleLogToChallenge = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/,
    )
    expect(fnMatch).toBeTruthy()
    const body = fnMatch[1]
    expect(body).toContain('try {')
    expect(body).toContain('catch (err)')
    expect(body).toContain('Alert.alert')
  })

  it('executeLogToChallenge sets isLogged AFTER navigation.navigate', () => {
    const fnMatch = HOME_SRC.match(
      /const executeLogToChallenge = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/,
    )
    expect(fnMatch).toBeTruthy()
    const body = fnMatch[1]
    const navIdx = body.indexOf("navigation.navigate('ScanSuccess'")
    const loggedIdx = body.indexOf('setIsLogged(true)')
    expect(navIdx).toBeGreaterThan(-1)
    expect(loggedIdx).toBeGreaterThan(-1)
    expect(loggedIdx).toBeGreaterThan(navIdx)
  })

  it('executeLogToChallenge catch block resets isLogged to false', () => {
    const fnMatch = HOME_SRC.match(
      /const executeLogToChallenge = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/,
    )
    expect(fnMatch).toBeTruthy()
    const body = fnMatch[1]
    const catchIdx = body.indexOf('} catch (err) {')
    const catchBlock = body.substring(catchIdx)
    expect(catchBlock).toContain('setIsLogged(false)')
  })

  it('authorizeGuestLog failure surfaces an Alert for network errors', () => {
    const fnMatch = HOME_SRC.match(
      /const executeLogToChallenge = useCallback\(async \(\) => \{([\s\S]*?)\n  \}, \[/,
    )
    expect(fnMatch).toBeTruthy()
    const body = fnMatch[1]
    const gateIdx = body.indexOf('const logGate = await authorizeGuestLog()')
    const afterGate = body.substring(gateIdx)
    expect(afterGate).toContain("logGate.reason === 'error'")
    expect(afterGate).toContain('Alert.alert')
  })

  it('AccountGateModal is rendered outside the camera Modal', () => {
    const cameraModalIdx = HOME_SRC.indexOf('visible={isCameraOpen}')
    const cameraModalEndIdx = HOME_SRC.indexOf('</Modal>', cameraModalIdx)
    const accountGateIdx = HOME_SRC.indexOf(
      '<AccountGateModal',
      cameraModalEndIdx,
    )
    expect(cameraModalIdx).toBeGreaterThan(-1)
    expect(cameraModalEndIdx).toBeGreaterThan(-1)
    expect(accountGateIdx).toBeGreaterThan(cameraModalEndIdx)
  })

  it('focus listener resets showAdvancedBlendModal', () => {
    const focusMatch = HOME_SRC.match(
      /const resetLoggedOnFocus = \(\) => \{([\s\S]*?)\n    \}/,
    )
    expect(focusMatch).toBeTruthy()
    expect(focusMatch[1]).toContain('setShowAdvancedBlendModal(false)')
  })
})

// ── Issue 2: Snap Produce Again stuck on Preparing camera ────

describe('Issue 2 — Snap Produce Again camera reset', () => {
  it('focus listener resets showAccountGate', () => {
    const focusMatch = HOME_SRC.match(
      /const resetLoggedOnFocus = \(\) => \{([\s\S]*?)\n    \}/,
    )
    expect(focusMatch).toBeTruthy()
    expect(focusMatch[1]).toContain('setShowAccountGate(false)')
  })

  it('AccountGateModal is not nested inside camera Modal (so it shows when camera is closed)', () => {
    const cameraModalIdx = HOME_SRC.indexOf('visible={isCameraOpen}')
    const cameraModalEndIdx = HOME_SRC.indexOf('</Modal>', cameraModalIdx)
    const accountGateIdx = HOME_SRC.indexOf('<AccountGateModal')
    // AccountGateModal must appear AFTER the camera Modal closes
    expect(accountGateIdx).toBeGreaterThan(cameraModalEndIdx)
  })

  it('attemptCameraOpen finally block always resets isPreparingCamera', () => {
    const finallyIdx = HOME_SRC.indexOf('} finally {', HOME_SRC.indexOf('const attemptCameraOpen'))
    expect(finallyIdx).toBeGreaterThan(-1)
    const finallyBlock = HOME_SRC.substring(finallyIdx, finallyIdx + 300)
    expect(finallyBlock).toContain('setIsPreparingCamera(false)')
    expect(finallyBlock).toContain('cameraInFlightRef.current = false')
  })
})

// ── Issue 3: Disable Log Juice Today with invalid ingredients ─

describe('Issue 3 — Disable Log to Today with invalid ingredients', () => {
  it('computes hasInvalidIngredients via useMemo', () => {
    expect(HOME_SRC).toContain('hasInvalidIngredients')
    expect(HOME_SRC).toMatch(/useMemo\(\(\) => \{[\s\S]*?hasInvalidIngredients/)
  })

  it('hasInvalidIngredients delegates to validateBatchForLog', () => {
    const memoMatch = HOME_SRC.match(
      /const hasInvalidIngredients = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[batch\.scannedIngredients\]\)/,
    )
    expect(memoMatch).toBeTruthy()
    const body = memoMatch[1]
    expect(body).toContain('validateBatchForLog')
    expect(body).toContain('.valid')
  })

  it('Log to Today button is disabled when hasInvalidIngredients', () => {
    expect(HOME_SRC).toContain('hasInvalidIngredients && styles.logButtonDisabled')
    expect(HOME_SRC).toContain(
      "disabled={isLogging || hasInvalidIngredients}",
    )
  })

  it('Log to Today button has disabled accessibility state', () => {
    expect(HOME_SRC).toContain(
      'disabled: isLogging || hasInvalidIngredients',
    )
  })

  it('logButtonDisabled style exists', () => {
    expect(HOME_SRC).toContain('logButtonDisabled')
  })

  it('handleLogToChallenge enforces guard before any persistence or navigation', () => {
    const handlerIdx = HOME_SRC.indexOf('const handleLogToChallenge')
    expect(handlerIdx).toBeGreaterThan(-1)
    // Guard must use validateBatchForLog and appear before the try block
    const tryIdx = HOME_SRC.indexOf('try {', handlerIdx)
    expect(tryIdx).toBeGreaterThan(-1)
    const section = HOME_SRC.substring(handlerIdx, tryIdx)
    expect(section).toContain('validateBatchForLog')
    expect(section).toContain('.valid')
  })
})

// ── Issue 4: Adaptive icon backgroundColor ───────────────────

describe('Issue 4 — Adaptive icon backgroundColor', () => {
  it('backgroundColor is not white', () => {
    const bg = APP_JSON.expo.android?.adaptiveIcon?.backgroundColor
    expect(bg).toBeTruthy()
    expect(bg.toLowerCase()).not.toBe('#ffffff')
  })

  it('backgroundColor is exact black (#000000)', () => {
    const bg = APP_JSON.expo.android?.adaptiveIcon?.backgroundColor
    expect(bg).toBe('#000000')
  })

  it('adaptive foreground image is 1024x1024', () => {
    const fg = APP_JSON.expo.android?.adaptiveIcon?.foregroundImage
    expect(fg).toBeTruthy()
    const buf = fs.readFileSync(path.join(ROOT, fg))
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
    const w = buf.readUInt32BE(16)
    const h = buf.readUInt32BE(20)
    expect(w).toBe(1024)
    expect(h).toBe(1024)
  })
})
