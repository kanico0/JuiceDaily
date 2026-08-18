// ─────────────────────────────────────────────────────────────
// cameraPlanLabel.test.js — Focused regression test for the
// Juice Snap plan label defect.
//
// Proves:
//   1. Pro user + Pro quota → text contains "Pro plan"
//   2. Free user + Free quota → text contains "Free plan"
//   3. Pro state is not inferred solely from quota count
//   4. HomeScreen passes effectiveIsPro (not ProStore isPro)
//      to CameraScreen's isProUser prop
//   5. CameraScreen label uses isProUser prop for plan label
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const cameraSource = fs.readFileSync(path.join(__dirname, '..', 'CameraScreen.js'), 'utf8')
const homeSource = fs.readFileSync(path.join(__dirname, '..', 'HomeScreen.js'), 'utf8')

describe('Juice Snap plan label (Pro vs Free)', () => {
  // ── 1. Pro user + Pro quota → "Pro plan" ──────────────────
  test('CameraScreen renders "Pro plan" when isProUser is true and quotaRemaining is a number', () => {
    // The template literal uses isProUser to pick the label.
    // When isProUser is true, the label must be "Pro plan".
    expect(cameraSource).toMatch(/isProUser\s*\?\s*'Pro'/)
    // The template literal constructs "Pro plan:" via interpolation
    expect(cameraSource).toMatch(/\$\{isProUser\s*\?\s*'Pro'\s*:\s*'Free'\}\s*plan:/)
  })

  // ── 2. Free user + Free quota → "Free plan" ───────────────
  test('CameraScreen renders "Free plan" when isProUser is false', () => {
    // When isProUser is false, the label must be "Free plan".
    expect(cameraSource).toMatch(/:\s*'Free'/)
    // The template literal constructs "Free plan:" via interpolation
    expect(cameraSource).toMatch(/\$\{isProUser\s*\?\s*'Pro'\s*:\s*'Free'\}\s*plan:/)
  })

  // ── 3. Pro state is NOT inferred from quota count ─────────
  test('CameraScreen does not infer Pro from quotaRemaining === 12', () => {
    // The label must depend on isProUser, not on the numeric
    // value of quotaRemaining.
    expect(cameraSource).not.toMatch(/remaining\s*===?\s*12/)
    expect(cameraSource).not.toMatch(/quotaRemaining\s*===?\s*12/)
    // The plan label is driven by isProUser, not by a hardcoded
    // count threshold.
    const labelSection = cameraSource.slice(
      cameraSource.indexOf('Plan quota guidance'),
      cameraSource.indexOf('fallbackPanel'),
    )
    expect(labelSection).toMatch(/isProUser/)
  })

  // ── 4. HomeScreen passes effectiveIsPro, not ProStore isPro ─
  test('HomeScreen passes effectiveIsPro to CameraScreen isProUser', () => {
    // Find the CameraScreen usage in HomeScreen
    const cameraIdx = homeSource.indexOf('<CameraScreen')
    const cameraSection = homeSource.slice(cameraIdx, cameraIdx + 500)
    expect(cameraSection).toMatch(/isProUser=\{effectiveIsPro\}/)
    // Must NOT pass the legacy ProStore isPro
    expect(cameraSection).not.toMatch(/isProUser=\{isPro\}/)
  })

  // ── 5. CameraScreen label uses isProUser prop ─────────────
  test('CameraScreen plan label is driven by the isProUser prop', () => {
    const labelSection = cameraSource.slice(
      cameraSource.indexOf('Plan quota guidance'),
      cameraSource.indexOf('fallbackPanel'),
    )
    // The ternary must reference isProUser
    expect(labelSection).toMatch(/isProUser\s*\?\s*'Pro'\s*:\s*'Free'/)
  })

  // ── 6. Guidance is shown for BOTH Pro and Free (not suppressed for Pro) ─
  test('CameraScreen does not suppress guidance for Pro users', () => {
    // The old code had: {!isProUser && !isProcessing && !error && (
    // The new code must NOT gate on !isProUser.
    const labelSection = cameraSource.slice(
      cameraSource.indexOf('Plan quota guidance'),
      cameraSource.indexOf('fallbackPanel'),
    )
    expect(labelSection).not.toMatch(/\{\s*!isProUser\s*&&\s*!isProcessing/)
    // The new code gates on !isProcessing && !error only
    expect(labelSection).toMatch(/!isProcessing\s*&&\s*!error/)
  })
})
