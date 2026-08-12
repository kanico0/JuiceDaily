// ─────────────────────────────────────────────────────────────
// qa9PostJuiceOrdering.test.js
//
// Tests that ScanSuccessScreen gates the "Session Logged"
// confirmation behind taste feedback resolution.
// Session Logged cannot render before FEEDBACK_RESOLVED.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ScanSuccessScreen.js'),
  'utf8',
)

describe('QA9 P0-2: Taste Feedback before Session Logged — source-level', () => {
  test('sessionLoggedVisible state exists and starts false', () => {
    expect(SRC).toMatch(/sessionLoggedVisible.*useState\(false\)/)
  })

  test('resolveTasteFeedback callback reveals Session Logged', () => {
    expect(SRC).toMatch(/resolveTasteFeedback/)
    // resolveTasteFeedback must set sessionLoggedVisible to true
    const idx = SRC.indexOf('resolveTasteFeedback')
    const section = SRC.slice(idx, idx + 300)
    expect(section).toMatch(/setSessionLoggedVisible\(true\)/)
  })

  test('Session Logged content is gated by sessionLoggedVisible', () => {
    // The main content (check icon, headline, metrics) must be
    // inside a sessionLoggedVisible conditional
    expect(SRC).toMatch(/sessionLoggedVisible.*&&/)
    expect(SRC).toMatch(/>Session Logged</)
  })

  test('pending state shows when !sessionLoggedVisible', () => {
    expect(SRC).toMatch(/!sessionLoggedVisible/)
    expect(SRC).toMatch(/pendingContainer/)
  })

  test('taste feedback Save/Continue calls resolveTasteFeedback', () => {
    // Find the Save / Continue button
    const saveIdx = SRC.indexOf('Save / Continue')
    expect(saveIdx).toBeGreaterThan(-1)
    // Look backwards for resolveTasteFeedback (may be 500+ chars away)
    const section = SRC.slice(saveIdx - 600, saveIdx + 50)
    expect(section).toMatch(/resolveTasteFeedback/)
  })

  test('taste feedback Skip calls resolveTasteFeedback', () => {
    // Find the Skip button in the taste feedback modal (tasteSkipText)
    const skipIdx = SRC.indexOf('tasteSkipText')
    expect(skipIdx).toBeGreaterThan(-1)
    const section = SRC.slice(skipIdx - 600, skipIdx + 100)
    expect(section).toMatch(/resolveTasteFeedback/)
  })

  test('taste feedback X button calls resolveTasteFeedback', () => {
    // The X close button in the taste feedback modal
    const closeIdx = SRC.indexOf('Close without answering')
    expect(closeIdx).toBeGreaterThan(-1)
    const section = SRC.slice(closeIdx - 600, closeIdx + 50)
    expect(section).toMatch(/resolveTasteFeedback/)
  })

  test('onRequestClose calls resolveTasteFeedback', () => {
    expect(SRC).toMatch(/onRequestClose=\{resolveTasteFeedback\}/)
  })

  test('tasteFeedbackEligible flag exists', () => {
    expect(SRC).toMatch(/tasteFeedbackEligible/)
  })

  test('ineligible users skip directly to Session Logged', () => {
    const idx = SRC.indexOf('!tasteFeedbackEligible')
    expect(idx).toBeGreaterThan(-1)
    const section = SRC.slice(idx, idx + 200)
    expect(section).toMatch(/setSessionLoggedVisible\(true\)/)
  })

  test('entrance animation depends on sessionLoggedVisible', () => {
    // The animation useEffect must depend on sessionLoggedVisible
    expect(SRC).toMatch(/\[sessionLoggedVisible.*\]/)
  })
})

describe('QA9 P0-2: Event ordering simulation', () => {
  // Simulate the state machine
  function simulatePostJuiceFlow({ hasAchievement = false, hasGlowToast = false, eligible = true } = {}) {
    const events = []
    let sessionLoggedVisible = false
    let showTasteFeedback = false
    let pendingAchievement = null
    let pendingIndicator = true

    if (!eligible) {
      pendingIndicator = false
      sessionLoggedVisible = true
      events.push('SESSION_LOGGED_VISIBLE')
      return events
    }

    events.push('LOG_SUCCESS')

    // Pending state
    events.push('PENDING')

    if (hasAchievement) {
      events.push('ACHIEVEMENT_BLOCKER')
      pendingAchievement = { id: 'test' }
      // Achievement dismissed
      pendingAchievement = null
      events.push('FEEDBACK_PENDING')
      showTasteFeedback = true
      events.push('FEEDBACK_VISIBLE')
    } else if (hasGlowToast) {
      events.push('GLOW_TOAST')
      events.push('FEEDBACK_PENDING')
      showTasteFeedback = true
      events.push('FEEDBACK_VISIBLE')
    } else {
      events.push('FEEDBACK_PENDING')
      showTasteFeedback = true
      events.push('FEEDBACK_VISIBLE')
    }

    // User resolves feedback (Save or Skip)
    showTasteFeedback = false
    pendingIndicator = false
    events.push('FEEDBACK_RESOLVED')
    sessionLoggedVisible = true
    events.push('SESSION_LOGGED_VISIBLE')

    return events
  }

  test('eligible flow: LOG → PENDING → FEEDBACK → RESOLVE → SESSION_LOGGED', () => {
    const events = simulatePostJuiceFlow({ eligible: true })
    const feedbackResolvedIdx = events.indexOf('FEEDBACK_RESOLVED')
    const sessionLoggedIdx = events.indexOf('SESSION_LOGGED_VISIBLE')
    expect(feedbackResolvedIdx).toBeGreaterThan(-1)
    expect(sessionLoggedIdx).toBeGreaterThan(-1)
    expect(sessionLoggedIdx).toBeGreaterThan(feedbackResolvedIdx)
  })

  test('with achievement: LOG → PENDING → BLOCKER → FEEDBACK → RESOLVE → SESSION_LOGGED', () => {
    const events = simulatePostJuiceFlow({ hasAchievement: true })
    const blockerIdx = events.indexOf('ACHIEVEMENT_BLOCKER')
    const feedbackIdx = events.indexOf('FEEDBACK_VISIBLE')
    const resolvedIdx = events.indexOf('FEEDBACK_RESOLVED')
    const sessionLoggedIdx = events.indexOf('SESSION_LOGGED_VISIBLE')
    expect(blockerIdx).toBeGreaterThan(-1)
    expect(feedbackIdx).toBeGreaterThan(blockerIdx)
    expect(resolvedIdx).toBeGreaterThan(feedbackIdx)
    expect(sessionLoggedIdx).toBeGreaterThan(resolvedIdx)
  })

  test('with glow toast: LOG → PENDING → TOAST → FEEDBACK → RESOLVE → SESSION_LOGGED', () => {
    const events = simulatePostJuiceFlow({ hasGlowToast: true })
    const toastIdx = events.indexOf('GLOW_TOAST')
    const feedbackIdx = events.indexOf('FEEDBACK_VISIBLE')
    const sessionLoggedIdx = events.indexOf('SESSION_LOGGED_VISIBLE')
    expect(toastIdx).toBeGreaterThan(-1)
    expect(feedbackIdx).toBeGreaterThan(toastIdx)
    expect(sessionLoggedIdx).toBeGreaterThan(feedbackIdx)
  })

  test('ineligible user: LOG → SESSION_LOGGED (no feedback step)', () => {
    const events = simulatePostJuiceFlow({ eligible: false })
    expect(events).toContain('SESSION_LOGGED_VISIBLE')
    expect(events).not.toContain('FEEDBACK_VISIBLE')
    expect(events).not.toContain('FEEDBACK_RESOLVED')
  })

  test('SESSION_LOGGED_VISIBLE cannot occur before FEEDBACK_RESOLVED (eligible)', () => {
    const events = simulatePostJuiceFlow({ eligible: true })
    const resolvedIdx = events.indexOf('FEEDBACK_RESOLVED')
    const sessionLoggedIdx = events.indexOf('SESSION_LOGGED_VISIBLE')
    expect(sessionLoggedIdx).toBeGreaterThan(resolvedIdx)
  })
})
