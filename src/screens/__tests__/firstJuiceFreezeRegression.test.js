// ─────────────────────────────────────────────────────────────
// firstJuiceFreezeRegression.test.js — Regression tests for
// the first-juice Today screen freeze on iOS.
//
// Root cause: When the first juice is logged, both the
// first_juice achievement and the seed stage celebration fire
// concurrently. The AchievementOverlay Modal shows first
// (stage celebration render is guarded by !pendingAchievement).
// When the user dismisses the achievement, pendingAchievement
// becomes null in the same render cycle that the
// GlowJourneyCelebrationOverlay Modal mounts — causing two
// transparent Modals to transition simultaneously on iOS,
// leaving a touch-blocking layer.
//
// Repair (v2): On iOS, the native Modal `onDismiss` callback
// is used as the PRIMARY signal that the current celebration
// Modal has fully disappeared before permitting the next
// celebration to mount. A defensive fallback timer is retained
// in case onDismiss does not fire. Each celebration overlay
// also has an auto-dismiss timer (3500ms) that starts only
// when the celebration is visible. Manual dismiss cancels the
// auto-dismiss timer. All dismiss paths are idempotent.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const todayPath = path.join(__dirname, '..', 'TodayScreen.js')
const source = fs.readFileSync(todayPath, 'utf8')

const achievementPath = path.join(__dirname, '..', '..', 'components', 'AchievementOverlay.js')
const achievementSrc = fs.readFileSync(achievementPath, 'utf8')

const glowOverlayPath = path.join(__dirname, '..', '..', 'components', 'GlowJourneyCelebrationOverlay.js')
const glowOverlaySrc = fs.readFileSync(glowOverlayPath, 'utf8')

const gardenOverlayPath = path.join(__dirname, '..', '..', 'components', 'GardenCelebrationOverlay.js')
const gardenOverlaySrc = fs.readFileSync(gardenOverlayPath, 'utf8')

describe('First-Juice Freeze — onDismiss-based modal sequencing', () => {
  test('1. awaitingModalDismiss state exists (replaces celebrationTransitioning)', () => {
    expect(source).toContain('awaitingModalDismiss')
    expect(source).toContain('setAwaitingModalDismiss')
    expect(source).not.toContain('celebrationTransitioning')
    expect(source).not.toContain('beginCelebrationTransition')
  })

  test('2. onCelebrationModalDismissed callback exists', () => {
    expect(source).toContain('onCelebrationModalDismissed')
    expect(source).toContain('setAwaitingModalDismiss(false)')
  })

  test('3. beginAwaitingModalDismiss helper exists with fallback timer', () => {
    expect(source).toContain('beginAwaitingModalDismiss')
    expect(source).toContain('MODAL_DISMISS_FALLBACK_MS')
    expect(source).toContain('setTimeout')
  })

  test('4. AchievementOverlay onDismiss calls beginAwaitingModalDismiss', () => {
    const achievementDismissIdx = source.indexOf(
      'setPendingAchievement(null)\n          beginAwaitingModalDismiss()'
    )
    expect(achievementDismissIdx).toBeGreaterThan(-1)
  })

  test('5. AchievementOverlay passes onModalDismiss to native Modal', () => {
    expect(source).toContain('onModalDismiss={onCelebrationModalDismissed}')
  })

  test('6. Stage celebration render guarded by !awaitingModalDismiss', () => {
    expect(source).toContain(
      '!pendingAchievement && !awaitingModalDismiss && stageCelebration'
    )
  })

  test('7. Stage celebration onDismiss calls beginAwaitingModalDismiss', () => {
    const stageDismissMatch = source.match(
      /GlowJourneyCelebrationOverlay[\s\S]*?onDismiss=\{\(\) => \{[\s\S]*?setStageCelebration\(null\)[\s\S]*?beginAwaitingModalDismiss/
    )
    expect(stageDismissMatch).not.toBeNull()
  })

  test('8. Garden celebration render guarded by !awaitingModalDismiss', () => {
    expect(source).toContain(
      '!pendingAchievement && !stageCelebration && !awaitingModalDismiss && gardenCelebration'
    )
  })

  test('9. Garden celebration onDismiss calls beginAwaitingModalDismiss', () => {
    const gardenDismissMatch = source.match(
      /GardenCelebrationOverlay[\s\S]*?onDismiss=\{\(\) => \{[\s\S]*?setGardenCelebration\(null\)[\s\S]*?beginAwaitingModalDismiss/
    )
    expect(gardenDismissMatch).not.toBeNull()
  })

  test('10. modalDismissFallbackTimer cleanup on unmount', () => {
    expect(source).toContain('modalDismissFallbackTimer')
    expect(source).toContain('clearTimeout(modalDismissFallbackTimer.current)')
  })

  test('11. No two celebration Modals can mount in the same render cycle', () => {
    const stageGuard = source.includes(
      '!pendingAchievement && !awaitingModalDismiss && stageCelebration'
    )
    const gardenGuard = source.includes(
      '!pendingAchievement && !stageCelebration && !awaitingModalDismiss && gardenCelebration'
    )
    expect(stageGuard).toBe(true)
    expect(gardenGuard).toBe(true)
  })

  test('12. Achievement is always rendered (Modal visible toggles, not mount/unmount)', () => {
    expect(source).toContain('<AchievementOverlay')
    expect(source).toContain('visible={!!pendingAchievement}')
  })

  test('13. Existing discovery popup regression guards are preserved', () => {
    expect(source).toContain('isFocusedRef')
    expect(source).toContain('mountCelebration')
    expect(source).toContain('setTimeout(mountCelebration')
  })
})

describe('First-Juice Freeze — Achievement and stage race condition', () => {
  test('14. Stage celebration effect checks pendingAchievement before setting', () => {
    const effectMatch = source.match(
      /shouldCelebrateStage[\s\S]*?markStageCelebrated[\s\S]*?if \(!pendingAchievement\)[\s\S]*?setStageCelebration/
    )
    expect(effectMatch).not.toBeNull()
  })

  test('15. Stage celebration effect includes pendingAchievement in deps', () => {
    const depsMatch = source.match(
      /\[lifetimeQualifyingDays, glowJourneyEntries, pendingAchievement\]/
    )
    expect(depsMatch).not.toBeNull()
  })
})

describe('Auto-Dismiss — AchievementOverlay', () => {
  test('16. AUTO_DISMISS_MS constant is 3500', () => {
    expect(achievementSrc).toContain('AUTO_DISMISS_MS')
    expect(achievementSrc).toContain('3500')
  })

  test('17. Auto-dismiss timer starts only when visible', () => {
    expect(achievementSrc).toMatch(/if \(visible\)[\s\S]*?autoDismissTimer\.current = setTimeout/)
  })

  test('18. Manual dismiss cancels auto-dismiss timer', () => {
    expect(achievementSrc).toContain('handleDismiss')
    expect(achievementSrc).toMatch(/handleDismiss[\s\S]*?clearTimeout\(autoDismissTimer/)
  })

  test('19. Dismiss is idempotent (dismissedRef prevents duplicate)', () => {
    expect(achievementSrc).toContain('dismissedRef')
    expect(achievementSrc).toContain('if (dismissedRef.current) return')
  })

  test('20. Timer cleared on unmount/visibility change', () => {
    expect(achievementSrc).toMatch(/else \{[\s\S]*?clearTimeout\(autoDismissTimer/)
  })

  test('21. onModalDismiss prop passed to native Modal', () => {
    expect(achievementSrc).toContain('onDismiss={onModalDismiss}')
  })

  test('22. Manual dismiss button preserved (Nice ✨)', () => {
    expect(achievementSrc).toContain('Nice ✨')
  })
})

describe('Auto-Dismiss — GlowJourneyCelebrationOverlay', () => {
  test('23. AUTO_DISMISS_MS constant is 3500', () => {
    expect(glowOverlaySrc).toContain('AUTO_DISMISS_MS')
    expect(glowOverlaySrc).toContain('3500')
  })

  test('24. Auto-dismiss timer starts only when visible', () => {
    expect(glowOverlaySrc).toMatch(/if \(visible\)[\s\S]*?autoDismissTimer\.current = setTimeout/)
  })

  test('25. Manual dismiss cancels auto-dismiss timer', () => {
    expect(glowOverlaySrc).toContain('handleDismiss')
    expect(glowOverlaySrc).toMatch(/handleDismiss[\s\S]*?clearTimeout\(autoDismissTimer/)
  })

  test('26. Dismiss is idempotent (dismissedRef prevents duplicate)', () => {
    expect(glowOverlaySrc).toContain('dismissedRef')
    expect(glowOverlaySrc).toContain('if (dismissedRef.current) return')
  })

  test('27. onModalDismiss prop passed to native Modal', () => {
    expect(glowOverlaySrc).toContain('onDismiss={onModalDismiss}')
  })

  test('28. Manual dismiss button preserved (Continue)', () => {
    expect(glowOverlaySrc).toContain('Continue')
  })
})

describe('Auto-Dismiss — GardenCelebrationOverlay', () => {
  test('29. AUTO_DISMISS_MS constant is 3500', () => {
    expect(gardenOverlaySrc).toContain('AUTO_DISMISS_MS')
    expect(gardenOverlaySrc).toContain('3500')
  })

  test('30. Auto-dismiss timer starts only when visible', () => {
    expect(gardenOverlaySrc).toMatch(/if \(visible\)[\s\S]*?autoDismissTimer\.current = setTimeout/)
  })

  test('31. Manual dismiss cancels auto-dismiss timer', () => {
    expect(gardenOverlaySrc).toContain('handleDismiss')
    expect(gardenOverlaySrc).toMatch(/handleDismiss[\s\S]*?clearTimeout\(autoDismissTimer/)
  })

  test('32. Dismiss is idempotent (dismissedRef prevents duplicate)', () => {
    expect(gardenOverlaySrc).toContain('dismissedRef')
    expect(gardenOverlaySrc).toContain('if (dismissedRef.current) return')
  })

  test('33. onModalDismiss prop passed to native Modal', () => {
    expect(gardenOverlaySrc).toContain('onDismiss={onModalDismiss}')
  })

  test('34. Manual dismiss button preserved (Continue)', () => {
    expect(gardenOverlaySrc).toContain('Continue')
  })
})

describe('Auto-Dismiss — Action-required popups NOT auto-dismissed', () => {
  test('35. AccountGateModal does not have auto-dismiss', () => {
    // AccountGateModal should NOT have AUTO_DISMISS_MS or autoDismissTimer
    const accountGatePath = path.join(__dirname, '..', '..', 'components', 'AccountGateModal.js')
    const accountGateSrc = fs.readFileSync(accountGatePath, 'utf8')
    expect(accountGateSrc).not.toContain('AUTO_DISMISS_MS')
    expect(accountGateSrc).not.toContain('autoDismissTimer')
  })

  test('36. PaywallModal does not have auto-dismiss', () => {
    const paywallPath = path.join(__dirname, '..', '..', 'components', 'PaywallModal.js')
    if (fs.existsSync(paywallPath)) {
      const paywallSrc = fs.readFileSync(paywallPath, 'utf8')
      expect(paywallSrc).not.toContain('AUTO_DISMISS_MS')
      expect(paywallSrc).not.toContain('autoDismissTimer')
    }
  })

  test('37. first_juice achievement and seed stage exist', () => {
    const achPath = path.join(__dirname, '..', '..', 'services', 'achievements.js')
    const achSource = fs.readFileSync(achPath, 'utf8')
    expect(achSource).toContain('first_juice')
    expect(achSource).toContain('First Juice Logged')
    expect(achSource).toContain('Your glow journey begins')

    const stagesPath = path.join(
      __dirname, '..', '..', 'constants', 'glowJourneyStages.js'
    )
    const stagesSource = fs.readFileSync(stagesPath, 'utf8')
    expect(stagesSource).toContain("'seed'")
    expect(stagesSource).toContain('Seed')
    expect(stagesSource).toContain('min: 1')
  })
})
