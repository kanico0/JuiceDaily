// ─────────────────────────────────────────────────────────────
// Regression tests for camera timeout false positive fix (Item 9)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'useCamera.ts'),
  'utf8',
)

describe('Item 9: Camera timeout false positive fix', () => {
  test('1. CAMERA_READY_TIMEOUT_MS is 15000 (increased from 10000)', () => {
    expect(SOURCE).toMatch(/CAMERA_READY_TIMEOUT_MS\s*=\s*15000/)
  })

  test('2. timeout callback checks isCapturing before firing error', () => {
    expect(SOURCE).toMatch(/prev\.isCapturing/)
  })

  test('3. timeout callback still checks camera_mounting phase', () => {
    expect(SOURCE).toMatch(/prev\.phase\s*===\s*['"]camera_mounting['"]/)
  })

  test('4. onCameraReady clears the timer', () => {
    const onReadyIdx = SOURCE.indexOf('onCameraReady')
    const onReadySection = SOURCE.substring(onReadyIdx, onReadyIdx + 200)
    expect(onReadySection).toContain('clearReadyTimer')
  })

  test('5. takePhoto clears the timer defensively', () => {
    const takePhotoIdx = SOURCE.indexOf('takePhoto')
    const takePhotoSection = SOURCE.substring(takePhotoIdx, takePhotoIdx + 300)
    expect(takePhotoSection).toContain('clearReadyTimer')
  })

  test('6. session ID guards against stale timers', () => {
    expect(SOURCE).toMatch(/session\s*!==\s*sessionRef\.current/)
  })

  test('7. clearReadyTimer is called on unmount', () => {
    expect(SOURCE).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*clearReadyTimer/)
  })

  test('8. clearReadyTimer is called when app goes to background', () => {
    const appStateIdx = SOURCE.indexOf('AppState.addEventListener')
    const appStateSection = SOURCE.substring(appStateIdx - 200, appStateIdx + 100)
    expect(appStateSection).toContain('clearReadyTimer')
  })
})
