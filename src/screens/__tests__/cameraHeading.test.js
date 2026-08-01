import fs from 'fs'
import path from 'path'

const CAMERA_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'CameraScreen.js'),
  'utf8'
)

describe('Item 7 — Change camera-screen heading', () => {
  test('heading contains "Scan Produce"', () => {
    expect(CAMERA_SRC).toContain('Scan Produce')
  })

  test('heading contains "or Exit to Enter Manually"', () => {
    expect(CAMERA_SRC).toContain('or Exit to Enter Manually')
  })

  test('old standalone "Scan Produce" heading is replaced', () => {
    expect(CAMERA_SRC).not.toContain('>Scan Produce<')
  })

  test('heading allows two-line wrapping with newline', () => {
    expect(CAMERA_SRC).toContain("'\\n'")
  })

  test('topTitle style has flex for wrapping', () => {
    expect(CAMERA_SRC).toContain('flex: 1')
  })

  test('topTitle style has textAlign center', () => {
    expect(CAMERA_SRC).toContain('textAlign: \'center\'')
  })

  test('topTitle font size is reduced for longer text', () => {
    expect(CAMERA_SRC).toContain('fontSize: 14')
  })

  test('close button is still present (exit behavior preserved)', () => {
    expect(CAMERA_SRC).toContain('onClose')
  })

  test('manual entry behavior is preserved', () => {
    expect(CAMERA_SRC).toContain('onManualEntry')
  })

  test('camera controls (capture button) are still present', () => {
    expect(CAMERA_SRC).toContain('handleCapture')
  })
})
