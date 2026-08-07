// ─────────────────────────────────────────────────────────────
// Regression tests for camera free-scan guidance (Item 10)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'CameraScreen.js'), 'utf8')

describe('Item 10: Camera free-scan guidance', () => {
  test('1. guest first-scan notice mentions free scan with no account needed', () => {
    expect(SOURCE).toContain('first scan is free')
    expect(SOURCE).toContain('no account needed')
  })

  test('2. first-scan notice explains what scanning does', () => {
    expect(SOURCE).toContain('identify it instantly')
  })

  test('3. guide hint text exists below the guide frame', () => {
    expect(SOURCE).toMatch(/guideHint/)
  })

  test('4. guide hint explains scanning identifies produce and estimates nutrition', () => {
    expect(SOURCE).toContain('identify your produce')
    expect(SOURCE).toContain('estimate nutrition')
  })

  test('5. guide hint is placed after guideText and before the fallback panel', () => {
    const guideTextIdx = SOURCE.indexOf('guideText')
    const guideHintIdx = SOURCE.indexOf('guideHint')
    const fallbackIdx = SOURCE.indexOf('fallbackPanel')
    expect(guideTextIdx).toBeGreaterThan(-1)
    expect(guideHintIdx).toBeGreaterThan(-1)
    expect(fallbackIdx).toBeGreaterThan(-1)
    expect(guideHintIdx).toBeGreaterThan(guideTextIdx)
  })

  test('6. guideHint style is defined', () => {
    expect(SOURCE).toMatch(/guideHint:\s*\{/)
  })

  test('7. first-scan notice is suppressed during processing', () => {
    expect(SOURCE).toMatch(/guestFirstScan\s*&&\s*!isProcessing\s*&&\s*!error/)
  })
})
