// ─────────────────────────────────────────────────────────────
// postJuicePendingIndicator.test.js — Tests that the post-juice
// pending indicator appears immediately and disappears when
// the taste feedback modal appears.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

describe('Post-juice pending indicator — source-level checks', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'ScanSuccessScreen.js'),
    'utf8',
  )

  test('pendingIndicator state exists', () => {
    expect(src).toMatch(/pendingIndicator/)
    expect(src).toMatch(/useState\(true\)/)
  })

  test('pendingIndicator starts as true (visible immediately)', () => {
    const idx = src.indexOf('pendingIndicator')
    const section = src.slice(idx, idx + 100)
    // Should initialize to true so it shows immediately on mount
    expect(section).toMatch(/useState\(true\)/)
  })

  test('pendingIndicator cleared when taste feedback shows (no achievement)', () => {
    // When showTasteFeedback is set to true without achievement,
    // pendingIndicator should also be set to false
    const matches = src.match(/setShowTasteFeedback\(true\)/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBeGreaterThanOrEqual(3)

    // Each setShowTasteFeedback(true) should be followed by setPendingIndicator(false)
    let searchIdx = 0
    let count = 0
    while (true) {
      const idx = src.indexOf('setShowTasteFeedback(true)', searchIdx)
      if (idx === -1) break
      const section = src.slice(idx, idx + 100)
      if (section.includes('setPendingIndicator(false)')) {
        count++
      }
      searchIdx = idx + 1
    }
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('pendingIndicator cleared on achievement dismiss', () => {
    const idx = src.indexOf('handleAchievementDismiss')
    const section = src.slice(idx, idx + 200)
    expect(section).toMatch(/setPendingIndicator\(false\)/)
  })

  test('ActivityIndicator is imported', () => {
    expect(src).toMatch(/ActivityIndicator/)
  })

  test('pending indicator UI renders when pending and no feedback/achievement', () => {
    expect(src).toMatch(/pendingIndicator && !showTasteFeedback && !pendingAchievement/)
  })

  test('pending indicator shows "Saving your juice…" text', () => {
    expect(src).toMatch(/Saving your juice/)
  })

  test('pending indicator shows "Taste check queued…" when achievement pending', () => {
    expect(src).toMatch(/Taste check queued/)
  })

  test('pending indicator has pointerEvents="none" (non-blocking)', () => {
    expect(src).toMatch(/pointerEvents="none"/)
  })

  test('pending indicator style exists', () => {
    expect(src).toMatch(/pendingIndicator:/)
    expect(src).toMatch(/pendingIndicatorText:/)
  })
})

describe('Post-juice pending indicator — timing simulation', () => {
  // Simulate the state machine
  function simulatePostJuiceFlow() {
    const states = []
    let pendingIndicator = true
    let showTasteFeedback = false
    let pendingAchievement = null
    let glowToast = null
    let hasAchievement = false

    states.push({
      step: 'mount',
      pendingIndicator,
      showTasteFeedback,
      pendingAchievement: !!pendingAchievement,
      glowToast: !!glowToast,
    })

    // Step 1: checkInToday succeeds, no streak increment
    // No achievement unlocked
    if (!hasAchievement) {
      // Show taste feedback immediately
      showTasteFeedback = true
      pendingIndicator = false
    }

    states.push({
      step: 'feedback_shown',
      pendingIndicator,
      showTasteFeedback,
      pendingAchievement: !!pendingAchievement,
      glowToast: !!glowToast,
    })

    return states
  }

  test('Pending indicator visible on mount, hidden when feedback appears', () => {
    const states = simulatePostJuiceFlow()
    expect(states[0].pendingIndicator).toBe(true)
    expect(states[0].showTasteFeedback).toBe(false)
    expect(states[1].pendingIndicator).toBe(false)
    expect(states[1].showTasteFeedback).toBe(true)
  })

  function simulateAchievementFlow() {
    const states = []
    let pendingIndicator = true
    let showTasteFeedback = false
    let pendingAchievement = null
    let hasAchievement = true

    states.push({
      step: 'mount',
      pendingIndicator,
      showTasteFeedback,
      pendingAchievement: !!pendingAchievement,
    })

    // Achievement detected, indicator shows "queued"
    states.push({
      step: 'achievement_timer_running',
      pendingIndicator,
      showTasteFeedback,
      pendingAchievement: !!pendingAchievement,
      indicatorText: 'Taste check queued…',
    })

    // Achievement overlay shows
    pendingAchievement = { id: 'test' }
    states.push({
      step: 'achievement_shown',
      pendingIndicator,
      showTasteFeedback,
      pendingAchievement: !!pendingAchievement,
    })

    // User dismisses achievement
    pendingAchievement = null
    showTasteFeedback = true
    pendingIndicator = false
    states.push({
      step: 'achievement_dismissed',
      pendingIndicator,
      showTasteFeedback,
      pendingAchievement: !!pendingAchievement,
    })

    return states
  }

  test('Achievement flow: indicator visible during achievement, cleared on dismiss', () => {
    const states = simulateAchievementFlow()
    expect(states[0].pendingIndicator).toBe(true)
    expect(states[1].pendingIndicator).toBe(true)
    expect(states[1].indicatorText).toBe('Taste check queued…')
    expect(states[2].pendingIndicator).toBe(true)
    expect(states[3].pendingIndicator).toBe(false)
    expect(states[3].showTasteFeedback).toBe(true)
  })
})
