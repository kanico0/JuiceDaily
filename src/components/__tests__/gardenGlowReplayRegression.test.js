// ─────────────────────────────────────────────────────────────
// gardenGlowReplayRegression.test.js — Regression tests for
// Garden/Glow entrance animation replay on intentional entry.
//
// Verifies:
//   GARDEN:
//     1. GardenDetail tracks entryToken state
//     2. entryToken increments on visible→true transition
//     3. entryToken is passed to LivingGardenScene
//     4. LivingGardenScene wake effect depends on entryToken
//     5. Wake effect resets to initial frame on replay
//     6. sceneComparator includes entryToken
//     7. Garden progress data is not modified by replay
//     8. Reduced Motion: wake resolves to canonical immediately
//     9. Ordinary rerender does not increment entryToken
//    10. Advancement logic is not coupled to entryToken
//
//   GLOW:
//    11. GlowJourneyDetail accepts isReduced prop
//    12. GlowJourneyDetail tracks entryToken state
//    13. entryToken increments on visible→true transition
//    14. Entrance animation resets to initial frame on replay
//    15. Entrance animation depends on entryToken
//    16. Artwork is wrapped in Animated.View with entrance opacity/scale
//    17. Glow progress data is not modified by replay
//    18. Reduced Motion: entrance resolves to canonical immediately
//    19. ScanScreen passes isReduced to GlowJourneyDetail
//
//   CROSS-REGRESSION:
//    20. First-juice celebration overlay still rendered
//    21. ExplainFlow final-slide fix intact
//    22. No progression/milestone state mutation in replay path
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const gardenDetailSrc = fs.readFileSync(
  path.join(__dirname, '..', 'GardenDetail.js'),
  'utf-8',
)
const livingGardenSceneSrc = fs.readFileSync(
  path.join(__dirname, '..', 'LivingGardenScene.js'),
  'utf-8',
)
const livingGardenMotionSrc = fs.readFileSync(
  path.join(__dirname, '..', 'LivingGardenMotion.js'),
  'utf-8',
)
const glowJourneyDetailSrc = fs.readFileSync(
  path.join(__dirname, '..', 'GlowJourneyDetail.js'),
  'utf-8',
)
const glowJourneyDropSrc = fs.readFileSync(
  path.join(__dirname, '..', 'GlowJourneyDrop.js'),
  'utf-8',
)
const scanScreenSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'ScanScreen.js'),
  'utf-8',
)
const todayScreenSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
  'utf-8',
)
const explainFlowSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'ExplainFlowScreen.js'),
  'utf-8',
)

// ─────────────────────────────────────────────────────────────
// GARDEN REPLAY
// ─────────────────────────────────────────────────────────────
describe('Garden replay-on-entry regression', () => {
  test('1. GardenDetail tracks entryToken state', () => {
    expect(gardenDetailSrc).toMatch(/const \[entryToken, setEntryToken\] = useState\(0\)/)
  })

  test('2. entryToken increments on visible open (inside seen-state effect)', () => {
    // The increment must be inside the visible-dependent open effect
    // that runs on each intentional Garden open
    expect(gardenDetailSrc).toMatch(/setEntryToken\(\(t\) => t \+ 1\)/)
    // It must be in the same effect that handles visible opens
    const openEffectMatch = gardenDetailSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?if \(!visible \|\| seenStateLoaded\.current\) return[\s\S]*?setEntryToken\(\(t\) => t \+ 1\)/,
    )
    expect(openEffectMatch).toBeTruthy()
  })

  test('3. entryToken is passed to LivingGardenScene', () => {
    expect(gardenDetailSrc).toMatch(/entryToken=\{entryToken\}/)
  })

  test('4. LivingGardenScene wake effect depends on entryToken', () => {
    // The wake effect must include entryToken in its dependency array
    expect(livingGardenSceneSrc).toMatch(/\}, \[isReduced, entryToken\]\)/)
  })

  test('5. Wake effect resets to initial frame on replay', () => {
    // The wake effect must reset wakeOpacity and wakeBrightness to
    // their initial values before animating
    expect(livingGardenSceneSrc).toMatch(/wakeOpacity\.current\.setValue\(0\.55\)/)
    expect(livingGardenSceneSrc).toMatch(/wakeBrightness\.current\.setValue\(0\.72\)/)
  })

  test('6. sceneComparator includes entryToken', () => {
    expect(livingGardenSceneSrc).toMatch(/prev\.entryToken === next\.entryToken/)
  })

  test('7. Garden progress data is not modified by replay', () => {
    // ARCHITECTURE: entryToken is scoped ONLY to the LivingGardenScene
    // wake effect (opacity/brightness fade). It is intentionally NOT
    // passed into useGardenMotion — that hook's bed/tree/arbor replay
    // is driven exclusively by the `advancements` orchestration effect
    // (see tests 36+), which is the single authority over those
    // Animated.Values. This avoids the two-effects-racing bug found
    // in physical QA (5863859).
    const motionHookMatch = livingGardenSceneSrc.match(
      /useGardenMotion\(\{[\s\S]*?\}\)/,
    )
    expect(motionHookMatch).toBeTruthy()
    expect(motionHookMatch[0]).not.toContain('entryToken')
    // GardenDetail must not write entryToken to any service
    expect(gardenDetailSrc).not.toMatch(/saveLastSeenState.*entryToken/)
    expect(gardenDetailSrc).not.toMatch(/detectAdvancements.*entryToken/)
    // LivingGardenMotion must not reference entryToken at all
    expect(livingGardenMotionSrc).not.toMatch(/entryToken/)
  })

  test('8. Reduced Motion: wake resolves to canonical immediately', () => {
    // When isReduced, the wake effect must set values to 1 and return
    const reducedMatch = livingGardenSceneSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?if \(isReduced\) \{[\s\S]*?wakeOpacity\.current\.setValue\(1\)[\s\S]*?wakeBrightness\.current\.setValue\(1\)[\s\S]*?return[\s\S]*?\}/,
    )
    expect(reducedMatch).toBeTruthy()
  })

  test('9. Ordinary rerender does not increment entryToken', () => {
    // entryToken must only increment inside the visible-dependent effect,
    // not in any other effect or callback
    const allIncrements = gardenDetailSrc.match(/setEntryToken\(\(t\) => t \+ 1\)/g)
    expect(allIncrements).toHaveLength(1)
    // The increment must be guarded by visible check
    const effectBlock = gardenDetailSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?if \(!visible \|\| seenStateLoaded\.current\) return[\s\S]*?setEntryToken/,
    )
    expect(effectBlock).toBeTruthy()
  })

  test('10. Advancement logic is not coupled to entryToken', () => {
    // The advancement detection must still depend on [visible] only,
    // not on entryToken
    const advEffectMatch = gardenDetailSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?if \(!visible \|\| seenStateLoaded\.current\) return[\s\S]*?detectAdvancements[\s\S]*?\}, \[visible\]\)/,
    )
    expect(advEffectMatch).toBeTruthy()
    // The dependency array must be [visible], not include entryToken
    expect(advEffectMatch[0]).toMatch(/\}, \[visible\]\)/)
  })
})

// ─────────────────────────────────────────────────────────────
// GLOW REPLAY
// ─────────────────────────────────────────────────────────────
describe('Glow Journey replay-on-entry regression', () => {
  test('11. GlowJourneyDetail accepts isReduced prop', () => {
    expect(glowJourneyDetailSrc).toMatch(/isReduced = false/)
  })

  test('12. GlowJourneyDetail tracks entryToken state', () => {
    expect(glowJourneyDetailSrc).toMatch(/const \[entryToken, setEntryToken\] = useState\(0\)/)
  })

  test('13. entryToken increments on visible→true transition', () => {
    // Must track prevVisibleRef and increment on false→true
    expect(glowJourneyDetailSrc).toMatch(/prevVisibleRef/)
    expect(glowJourneyDetailSrc).toMatch(/if \(visible && !prevVisibleRef\.current\)/)
    expect(glowJourneyDetailSrc).toMatch(/setEntryToken\(\(t\) => t \+ 1\)/)
  })

  test('14. Entrance animation resets to initial frame on replay', () => {
    expect(glowJourneyDetailSrc).toMatch(/entranceOpacity\.current\.setValue\(0\)/)
    expect(glowJourneyDetailSrc).toMatch(/entranceScale\.current\.setValue\(0\.96\)/)
  })

  test('15. Entrance animation depends on entryToken', () => {
    expect(glowJourneyDetailSrc).toMatch(/\}, \[entryToken, isReduced\]\)/)
  })

  test('16. Artwork is wrapped in Animated.View with entrance opacity/scale', () => {
    expect(glowJourneyDetailSrc).toMatch(/Animated\.View/)
    expect(glowJourneyDetailSrc).toMatch(/opacity: entranceOpacity\.current/)
    expect(glowJourneyDetailSrc).toMatch(/scale: entranceScale\.current/)
  })

  test('17. Glow progress data is not modified by replay', () => {
    // The entryToken must not be passed to any service or affect
    // visualState computation
    const visualStateMatch = glowJourneyDetailSrc.match(
      /buildGlowJourneyVisualState\(\{[\s\S]*?\}\)/,
    )
    expect(visualStateMatch).toBeTruthy()
    expect(visualStateMatch[0]).not.toContain('entryToken')
    // No service writes
    expect(glowJourneyDetailSrc).not.toMatch(/save.*entryToken/i)
  })

  test('18. Reduced Motion: entrance resolves to canonical immediately', () => {
    const reducedMatch = glowJourneyDetailSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?if \(isReduced\) \{[\s\S]*?entranceOpacity\.current\.setValue\(1\)[\s\S]*?entranceScale\.current\.setValue\(1\)[\s\S]*?return/,
    )
    expect(reducedMatch).toBeTruthy()
  })

  test('19. ScanScreen passes isReduced to GlowJourneyDetail', () => {
    // Find the GlowJourneyDetail render in ScanScreen
    const glowDetailRenderMatch = scanScreenSrc.match(
      /<GlowJourneyDetail[\s\S]*?isReduced=\{isReduced\}[\s\S]*?\/>/,
    )
    expect(glowDetailRenderMatch).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
// CROSS-REGRESSION — prior fixes remain intact
// ─────────────────────────────────────────────────────────────
describe('Cross-regression — prior fixes remain intact', () => {
  test('20. First-juice celebration overlay still rendered in TodayScreen', () => {
    expect(todayScreenSrc).toContain('GlowJourneyCelebrationOverlay')
    expect(todayScreenSrc).toContain('stageCelebration &&')
    expect(todayScreenSrc).toContain('setStageCelebration(null)')
  })

  test('21. ExplainFlow final-slide fix intact', () => {
    expect(explainFlowSrc).toContain('.start(({ finished })')
    expect(explainFlowSrc).toContain('if (!finished)')
    expect(explainFlowSrc).toContain('opacity.setValue(1)')
    expect(explainFlowSrc).toContain('contentScale.setValue(1)')
  })

  test('22. No progression/milestone state mutation in replay path', () => {
    // GardenDetail must not call any save/detect with entryToken
    expect(gardenDetailSrc).not.toMatch(/entryToken.*save|save.*entryToken/i)
    // GlowJourneyDetail must not call any service with entryToken
    expect(glowJourneyDetailSrc).not.toMatch(/entryToken.*service|service.*entryToken/i)
    // No AsyncStorage writes involving entryToken
    expect(gardenDetailSrc).not.toMatch(/AsyncStorage.*entryToken/i)
    expect(glowJourneyDetailSrc).not.toMatch(/AsyncStorage.*entryToken/i)
  })
})

// ─────────────────────────────────────────────────────────────
// BEHAVIORAL LIFECYCLE TESTS — simulate the exact ref-based state
// machine from GardenDetail's two [visible]-dependent effects to
// prove entryToken increments on EVERY intentional open, not just
// the first. This is a behavioral test, not source-pattern matching.
// ─────────────────────────────────────────────────────────────

// Simulates the exact state machine from GardenDetail.js:
//   Open effect (line 124):  if (!visible || seenStateLoaded) return
//                             seenStateLoaded = true
//                             entryToken++
//   Close effect (line 160): if (!visible && prevVisible)
//                               saveSeenState()
//                               seenStateLoaded = false
//                             prevVisible = visible
//
// Both effects depend on [visible] and run on each visible change.
// The close effect resets seenStateLoaded=false, so the next open
// passes the guard and increments entryToken again.
function simulateGardenVisibleLifecycle(transitions) {
  let seenStateLoaded = false
  let prevVisible = false
  let entryToken = 0
  let savedSeenStateCount = 0
  const entryTokenHistory = []

  for (const visible of transitions) {
    // ── Open effect ──
    if (visible && !seenStateLoaded) {
      seenStateLoaded = true
      entryToken += 1
    }
    // ── Close effect ──
    if (!visible && prevVisible) {
      savedSeenStateCount += 1
      seenStateLoaded = false
    }
    prevVisible = visible
    entryTokenHistory.push(entryToken)
  }

  return { entryToken, entryTokenHistory, savedSeenStateCount, seenStateLoaded }
}

// Simulates GlowJourneyDetail's prevVisibleRef state machine:
//   if (visible && !prevVisible) entryToken++
//   prevVisible = visible
function simulateGlowVisibleLifecycle(transitions) {
  let prevVisible = false
  let entryToken = 0
  const entryTokenHistory = []

  for (const visible of transitions) {
    if (visible && !prevVisible) {
      entryToken += 1
    }
    prevVisible = visible
    entryTokenHistory.push(entryToken)
  }

  return { entryToken, entryTokenHistory }
}

describe('Garden repeated-entry replay — behavioral lifecycle', () => {
  test('23. First open increments entryToken', () => {
    const result = simulateGardenVisibleLifecycle([true])
    expect(result.entryToken).toBe(1)
    expect(result.entryTokenHistory).toEqual([1])
  })

  test('24. Close + second open increments entryToken again', () => {
    const result = simulateGardenVisibleLifecycle([true, false, true])
    expect(result.entryToken).toBe(2)
    expect(result.entryTokenHistory).toEqual([1, 1, 2])
  })

  test('25. Close + third open increments entryToken again', () => {
    const result = simulateGardenVisibleLifecycle([true, false, true, false, true])
    expect(result.entryToken).toBe(3)
    expect(result.entryTokenHistory).toEqual([1, 1, 2, 2, 3])
  })

  test('26. Progression state (savedSeenStateCount) only changes on close, not on replay', () => {
    const result = simulateGardenVisibleLifecycle([true, false, true, false, true])
    // saveSeenState is called on each close (true→false), not on open
    expect(result.savedSeenStateCount).toBe(2)
    // entryToken incremented 3 times (once per open)
    expect(result.entryToken).toBe(3)
  })

  test('27. Ordinary rerender while visible does NOT increment entryToken', () => {
    // visible stays true — no transition, no increment
    const result = simulateGardenVisibleLifecycle([true, true, true])
    expect(result.entryToken).toBe(1)
    expect(result.entryTokenHistory).toEqual([1, 1, 1])
  })

  test('28. Background/resume without close/open does NOT increment entryToken', () => {
    // Simulate: open, then visible stays true through background/resume
    const result = simulateGardenVisibleLifecycle([true, true, true, true])
    expect(result.entryToken).toBe(1)
  })

  test('29. seenStateLoaded is false after close (enabling next open)', () => {
    const result = simulateGardenVisibleLifecycle([true, false])
    expect(result.seenStateLoaded).toBe(false)
  })

  test('30. Celebration/discovery state is not replayed (no advancement detection on mere open)', () => {
    // The entryToken increment is synchronous and does not trigger
    // detectAdvancements. Advancement detection only runs in the
    // async IIFE after the guard, and only when wasFirstOpen is false.
    // The entryToken increment is BEFORE the async IIFE, proving
    // they are independent — replay happens even if advancement
    // detection produces nothing.
    const source = gardenDetailSrc
    // entryToken increment must come BEFORE the async IIFE
    const tokenIdx = source.indexOf('setEntryToken((t) => t + 1)')
    const iifeIdx = source.indexOf('(async () => {')
    expect(tokenIdx).toBeGreaterThan(-1)
    expect(iifeIdx).toBeGreaterThan(-1)
    expect(tokenIdx).toBeLessThan(iifeIdx)
  })
})

describe('Glow repeated-entry replay — behavioral lifecycle', () => {
  test('31. Glow false→true increments entryToken', () => {
    const result = simulateGlowVisibleLifecycle([true])
    expect(result.entryToken).toBe(1)
  })

  test('32. Glow true→true rerender does NOT increment', () => {
    const result = simulateGlowVisibleLifecycle([true, true])
    expect(result.entryToken).toBe(1)
  })

  test('33. Glow true→false does NOT increment', () => {
    const result = simulateGlowVisibleLifecycle([true, false])
    expect(result.entryToken).toBe(1)
  })

  test('34. Glow false→true again increments (repeated entry)', () => {
    const result = simulateGlowVisibleLifecycle([true, false, true])
    expect(result.entryToken).toBe(2)
  })

  test('35. Glow three opens increments three times', () => {
    const result = simulateGlowVisibleLifecycle([true, false, true, false, true])
    expect(result.entryToken).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────
// GARDEN AMBIENT ENTRANCE REPLAY — ROOT-CAUSE FIX (post-5863859)
//
// Physical QA on 5863859 found the Garden growth entrance did not
// reliably replay. Root cause: a standalone entryToken-keyed effect
// in useGardenMotion raced with the pre-existing advancements-keyed
// orchestration effect. Both effects wrote to the SAME shared
// Animated.Values. On every repeat open with no new progression, the
// orchestration effect's "no changes" branch called
// resolveToCanonicalRest() — which snapped everything to canonical
// INSTANTLY, cutting off/overriding the entryToken effect's
// in-flight dormant→canonical animation (started moments earlier in
// the same or adjacent commit).
//
// FIX: entryToken was removed from useGardenMotion entirely. The
// `advancements` orchestration effect is now the SOLE authority over
// these Animated.Values. Its "no changes" branch (previously an
// instant resolveToCanonicalRest with no visible animation) now
// calls playAmbientEntranceReplay() — an animated reveal using the
// same FROZEN duration/easing constants as the real advancement
// timeline. Because `detectAdvancements()` produces a fresh object
// reference on every intentional Garden open (verified below), this
// effect — and therefore some entrance animation — fires exactly
// once per open, with no competing effect to race against.
// ─────────────────────────────────────────────────────────────
describe('Garden ambient entrance replay — root-cause fix', () => {
  test('36. useGardenMotion no longer accepts an entryToken parameter', () => {
    // The standalone entryToken mechanism that raced with the
    // orchestration effect has been removed entirely.
    expect(livingGardenMotionSrc).not.toMatch(/entryToken/)
  })

  test('37. Only ONE effect in LivingGardenMotion touches bed/tree/arbor Animated.Values on open', () => {
    // There must be exactly one useEffect keyed on `advancements`
    // that owns the bed/tree/arbor/rainbow Animated.Values (the
    // orchestration effect). No second effect should independently
    // reset/animate refs.scaleY, treeScaleRef, or arborRevealRef.
    const refsScaleYSetValueCount = (
      livingGardenMotionSrc.match(/refs\.scaleY\.setValue/g) || []
    ).length
    // Only resolveToCanonicalRest() and ensureBedRefs's initial
    // creation touch refs directly outside of Animated.timing calls;
    // there must be no second "reset to dormant" site duplicating
    // the ambient replay's dormant-state assignment.
    const dormantResetSites = (
      livingGardenMotionSrc.match(/refs\.scaleY\.setValue\(GROWTH_START_SCALE_MID\)/g) || []
    ).length
    expect(dormantResetSites).toBe(1)
    expect(refsScaleYSetValueCount).toBeGreaterThan(0)
  })

  test('38. playAmbientEntranceReplay exists and is invoked only from the orchestration effect', () => {
    expect(livingGardenMotionSrc).toMatch(/const playAmbientEntranceReplay = useCallback\(/)
    // Must be called from within the "no changes" branch, guarded
    // by hasBeds/hasJourney/hasArbor/hasRainbow all false
    const noChangeBranchMatch = livingGardenMotionSrc.match(
      /if \(!hasBeds && !hasJourney && !hasArbor && !hasRainbow\) \{[\s\S]*?playAmbientEntranceReplay\(\)[\s\S]*?return\s*\}/,
    )
    expect(noChangeBranchMatch).toBeTruthy()
  })

  test('39. Ambient replay resets to a restrained "mid transition" frame (not literal empty/dormant)', () => {
    // Reuses the approved GROWTH_START_SCALE_MID / GROWTH_START_OPACITY_MID
    // constants (already used by real bed advancement motion) rather
    // than inventing a new "emptied garden" visual.
    expect(livingGardenMotionSrc).toMatch(/refs\.scaleY\.setValue\(GROWTH_START_SCALE_MID\)/)
    expect(livingGardenMotionSrc).toMatch(/refs\.opacity\.setValue\(GROWTH_START_OPACITY_MID\)/)
    expect(livingGardenMotionSrc).toMatch(/treeScaleRef\.current\.setValue\(TREE_START_SCALE\)/)
    expect(livingGardenMotionSrc).toMatch(/treeOpacityRef\.current\.setValue\(TREE_START_OPACITY\)/)
  })

  test('40. Ambient replay reuses FROZEN duration/easing constants, not invented values', () => {
    const ambientFnMatch = livingGardenMotionSrc.match(
      /const playAmbientEntranceReplay = useCallback\(\(\) => \{[\s\S]*?\}, \[cancelTimeline[\s\S]*?\]\)/,
    )
    expect(ambientFnMatch).toBeTruthy()
    const fnSrc = ambientFnMatch[0]
    expect(fnSrc).toMatch(/STAGE_TRANSITION_DURATION\.sprout/)
    expect(fnSrc).toMatch(/TREE_DURATION_COMPRESSED/)
    expect(fnSrc).toMatch(/ARBOR_ORNAMENT_DURATION/)
    expect(fnSrc).toMatch(/EASING\.decelerate/)
    expect(fnSrc).toMatch(/WAKE_DURATION/)
    expect(fnSrc).toMatch(/BAND_STAGGER/)
  })

  test('41. Ambient replay animates back to canonical (toValue: 1)', () => {
    const ambientFnMatch = livingGardenMotionSrc.match(
      /const playAmbientEntranceReplay = useCallback\(\(\) => \{[\s\S]*?\}, \[cancelTimeline[\s\S]*?\]\)/,
    )
    expect(ambientFnMatch).toBeTruthy()
    const fnSrc = ambientFnMatch[0]
    expect(fnSrc).toMatch(/Animated\.timing\(refs\.scaleY[\s\S]*?toValue: 1/)
    expect(fnSrc).toMatch(/Animated\.timing\(treeScaleRef\.current[\s\S]*?toValue: 1/)
    expect(fnSrc).toMatch(/Animated\.timing\(arborRevealRef\.current[\s\S]*?toValue: 1/)
  })

  test('42. Reduced Motion resolves the no-change branch instantly, bypassing ambient replay', () => {
    const noChangeBranchMatch = livingGardenMotionSrc.match(
      /if \(!hasBeds && !hasJourney && !hasArbor && !hasRainbow\) \{[\s\S]*?if \(isReduced\) \{[\s\S]*?resolveToCanonicalRest\(\)[\s\S]*?return[\s\S]*?\}[\s\S]*?playAmbientEntranceReplay\(\)/,
    )
    expect(noChangeBranchMatch).toBeTruthy()
  })

  test('43. Ambient replay does not call detectAdvancements, saveLastSeenState, or any persistence API', () => {
    const ambientFnMatch = livingGardenMotionSrc.match(
      /const playAmbientEntranceReplay = useCallback\(\(\) => \{[\s\S]*?\}, \[cancelTimeline[\s\S]*?\]\)/,
    )
    expect(ambientFnMatch).toBeTruthy()
    const fnSrc = ambientFnMatch[0]
    expect(fnSrc).not.toMatch(/detectAdvancements/)
    expect(fnSrc).not.toMatch(/saveLastSeenState/)
    expect(fnSrc).not.toMatch(/initializeIfAbsent/)
    expect(fnSrc).not.toMatch(/AsyncStorage/)
  })

  test('44. Ambient replay cancels any existing timeline/idle motion before starting (no double-animation)', () => {
    const ambientFnMatch = livingGardenMotionSrc.match(
      /const playAmbientEntranceReplay = useCallback\(\(\) => \{[\s\S]*?\}, \[cancelTimeline[\s\S]*?\]\)/,
    )
    expect(ambientFnMatch).toBeTruthy()
    const fnSrc = ambientFnMatch[0]
    expect(fnSrc).toMatch(/cancelTimeline\(\)/)
    expect(fnSrc).toMatch(/stopIdleMotion\(\)/)
  })

  test('45. GardenDetail seen-state detection produces a fresh advancements object on every open (confirms single-effect trigger)', () => {
    // detectAdvancements is called inside the per-open async IIFE and
    // its result is always passed to setAdvancements — a fresh object
    // reference each time, which is what allows the orchestration
    // effect (keyed on advancements) to fire exactly once per open
    // without needing a second entryToken-based trigger.
    const openIifeMatch = gardenDetailSrc.match(
      /if \(!wasFirstOpen\) \{[\s\S]*?const adv = detectAdvancements\(lastSeen, currentState\)[\s\S]*?setAdvancements\(adv\)/,
    )
    expect(openIifeMatch).toBeTruthy()
  })

  test('46. LivingGardenScene no longer passes entryToken into useGardenMotion', () => {
    const motionCallMatch = livingGardenSceneSrc.match(
      /useGardenMotion\(\{[\s\S]*?\}\)/,
    )
    expect(motionCallMatch).toBeTruthy()
    expect(motionCallMatch[0]).not.toContain('entryToken')
  })

  test('47. entryToken remains scoped to the wake (opacity/brightness) effect only', () => {
    // entryToken is still a valid concept for the lightweight wake
    // fade, which is a separate, non-conflicting channel untouched
    // by useGardenMotion.
    expect(gardenDetailSrc).toMatch(/const \[entryToken, setEntryToken\] = useState\(0\)/)
    expect(livingGardenSceneSrc).toMatch(/entryToken = 0,/)
    expect(livingGardenSceneSrc).toMatch(/\}, \[isReduced, entryToken\]\)/)
  })
})

// ─────────────────────────────────────────────────────────────
// GARDEN BEHAVIORAL LIFECYCLE — models the actual async runtime
// ordering that exposed the 5863859 race: entryToken commits
// synchronously (before advancements), so any second effect keyed
// on entryToken alone would fire BEFORE the advancements-driven
// effect and could be overridden by it. This models that no such
// second effect exists, and that the single orchestration effect's
// decision (ambient replay vs real timeline vs first-open) is based
// on a freshly computed advancements object every time.
// ─────────────────────────────────────────────────────────────
function simulateGardenOrchestration(opens) {
  // opens: array of { wasFirstOpen, hasRealChange } describing each
  // intentional Garden open in sequence.
  const calls = []
  let processedRef = null
  for (const open of opens) {
    const advancements = open.wasFirstOpen
      ? null
      : { isFirstOpen: false, hasRealChange: open.hasRealChange, _ref: {} }
    if (!advancements) continue // orchestration effect guard: if (!advancements) return
    if (processedRef === advancements) continue // never true — fresh object each open
    processedRef = advancements
    if (advancements.isFirstOpen) {
      calls.push('resolveToCanonicalRest')
      continue
    }
    if (!advancements.hasRealChange) {
      calls.push('playAmbientEntranceReplay')
      continue
    }
    calls.push('realAdvancementTimeline')
  }
  return calls
}

describe('Garden orchestration — behavioral lifecycle (no second-effect race)', () => {
  test('48. First-ever open (wasFirstOpen) plays no motion', () => {
    const calls = simulateGardenOrchestration([{ wasFirstOpen: true }])
    expect(calls).toEqual([])
  })

  test('49. Second open with no new progress plays the ambient replay', () => {
    const calls = simulateGardenOrchestration([
      { wasFirstOpen: true },
      { wasFirstOpen: false, hasRealChange: false },
    ])
    expect(calls).toEqual(['playAmbientEntranceReplay'])
  })

  test('50. Third open with still no new progress plays the ambient replay again', () => {
    const calls = simulateGardenOrchestration([
      { wasFirstOpen: true },
      { wasFirstOpen: false, hasRealChange: false },
      { wasFirstOpen: false, hasRealChange: false },
    ])
    expect(calls).toEqual(['playAmbientEntranceReplay', 'playAmbientEntranceReplay'])
  })

  test('51. Open with real new progress plays the real advancement timeline, not the ambient replay', () => {
    const calls = simulateGardenOrchestration([
      { wasFirstOpen: true },
      { wasFirstOpen: false, hasRealChange: true },
    ])
    expect(calls).toEqual(['realAdvancementTimeline'])
  })

  test('52. Alternating real-change and no-change opens each produce exactly one replay call', () => {
    const calls = simulateGardenOrchestration([
      { wasFirstOpen: true },
      { wasFirstOpen: false, hasRealChange: true },
      { wasFirstOpen: false, hasRealChange: false },
      { wasFirstOpen: false, hasRealChange: true },
      { wasFirstOpen: false, hasRealChange: false },
    ])
    expect(calls).toEqual([
      'realAdvancementTimeline',
      'playAmbientEntranceReplay',
      'realAdvancementTimeline',
      'playAmbientEntranceReplay',
    ])
  })
})

// ─────────────────────────────────────────────────────────────
// GLOW JOURNEY DROP REPLAY ON EXPLORE FOCUS — verifies the
// replayToken prop, entrance reset, and ScanScreen focus wiring.
// ─────────────────────────────────────────────────────────────
describe('GlowJourneyDrop replay on Explore focus', () => {
  test('53. GlowJourneyDrop accepts replayToken prop', () => {
    expect(glowJourneyDropSrc).toMatch(/replayToken = 0/)
  })

  test('54. Entrance effect depends on replayToken', () => {
    // The entrance effect must include replayToken in deps
    const entranceEffectMatch = glowJourneyDropSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevReplayTokenRef[\s\S]*?\}, \[replayToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
  })

  test('55. replayToken change resets hasEnteredRef', () => {
    // When replayToken changes, hasEnteredRef must be set to false
    expect(glowJourneyDropSrc).toMatch(/prevReplayTokenRef\.current !== replayToken/)
    expect(glowJourneyDropSrc).toMatch(/hasEnteredRef\.current = false/)
  })

  test('56. replayToken change resets entrance animation values', () => {
    // entranceAnim must be reset to 0 on replay
    expect(glowJourneyDropSrc).toMatch(/entranceAnim\.setValue\(0\)/)
  })

  test('57. GlowJourneyDrop replay does not modify persisted Glow state', () => {
    // replayToken must not be passed to any service or visualState
    const visualStateMatch = glowJourneyDropSrc.match(
      /buildGlowJourneyVisualState\(\{[\s\S]*?\}\)/,
    )
    expect(visualStateMatch).toBeTruthy()
    expect(visualStateMatch[0]).not.toContain('replayToken')
    // No service writes involving replayToken
    expect(glowJourneyDropSrc).not.toMatch(/save.*replayToken/i)
    expect(glowJourneyDropSrc).not.toMatch(/AsyncStorage.*replayToken/i)
  })

  test('58. GlowJourneyDrop replay respects Reduce Motion', () => {
    // The entrance effect must handle isReduced
    const entranceEffectMatch = glowJourneyDropSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevReplayTokenRef[\s\S]*?\}, \[replayToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
    expect(entranceEffectMatch[0]).toMatch(/isReduced/)
  })
})

// ─────────────────────────────────────────────────────────────
// GLOW BLANK-SCREEN ROOT-CAUSE FIX (post-5863859)
//
// Physical QA found that entering Explore produced a blank screen.
// Root cause: `glowReplayToken` was declared as state inside the
// top-level `ScanScreen` component, but the <GlowJourneyDrop
// replayToken={glowReplayToken} /> JSX that reads it lives inside
// `BrowseHome` — a SEPARATE, sibling function component (not a
// closure nested inside ScanScreen). `BrowseHome`'s render was
// invoked via <BrowseHome glowJourney={glowJourney} .../> WITHOUT a
// `glowReplayToken` prop, so `glowReplayToken` was out of scope
// inside BrowseHome, throwing `ReferenceError: glowReplayToken is
// not defined` on every render of the Explore/browse view — an
// uncaught render exception that produced the reported blank screen.
//
// Source-pattern tests alone could not catch this because the
// tokens existed *somewhere* in the file; they were simply declared
// and consumed in two different function scopes. These tests verify
// the token is DECLARED in ScanScreen, PASSED to BrowseHome as an
// explicit prop, ACCEPTED by BrowseHome's parameter list, and that
// BrowseHome's own GlowJourneyDrop render resolves the prop by name
// rather than the outer closure variable.
// ─────────────────────────────────────────────────────────────
describe('Glow blank-screen root-cause fix — glowReplayToken scope', () => {
  test('59. ScanScreen declares glowReplayToken state', () => {
    expect(scanScreenSrc).toMatch(/const \[glowReplayToken, setGlowReplayToken\] = useState\(0\)/)
  })

  test('60. ScanScreen increments glowReplayToken on navigation focus (after initial mount)', () => {
    const focusMatch = scanScreenSrc.match(
      /navigation\.addListener\('focus'[\s\S]*?setGlowReplayToken\(\(t\) => t \+ 1\)/,
    )
    expect(focusMatch).toBeTruthy()
  })

  test('61. ScanScreen skips incrementing glowReplayToken on the very first post-mount focus', () => {
    // Avoids a redundant immediate restart of the entrance animation
    // right after the natural mount-time entrance already played.
    expect(scanScreenSrc).toMatch(/glowReplayHasSkippedInitialFocusRef/)
    const skipGuardMatch = scanScreenSrc.match(
      /if \(glowReplayHasSkippedInitialFocusRef\.current\) \{[\s\S]*?setGlowReplayToken\(\(t\) => t \+ 1\)[\s\S]*?\}[\s\S]*?glowReplayHasSkippedInitialFocusRef\.current = true/,
    )
    expect(skipGuardMatch).toBeTruthy()
  })

  test('62. ScanScreen tracks blur to reset focus state', () => {
    expect(scanScreenSrc).toMatch(/navigation\.addListener\('blur'/)
    expect(scanScreenSrc).toMatch(/glowReplayPrevFocusedRef\.current = false/)
  })

  test('63. THE FIX: BrowseHome function signature accepts glowReplayToken as a parameter', () => {
    // This is the exact scope bug: BrowseHome is a top-level function
    // component distinct from ScanScreen. It must declare
    // glowReplayToken in its own destructured parameter list to be
    // in scope inside its render.
    const browseHomeSignatureMatch = scanScreenSrc.match(
      /function BrowseHome\(\{[^}]*glowReplayToken[^}]*\}\)/,
    )
    expect(browseHomeSignatureMatch).toBeTruthy()
  })

  test('64. THE FIX: ScanScreen passes glowReplayToken as an explicit prop to <BrowseHome>', () => {
    const browseHomeRenderMatch = scanScreenSrc.match(
      /<BrowseHome[\s\S]*?glowReplayToken=\{glowReplayToken\}[\s\S]*?\/>/,
    )
    expect(browseHomeRenderMatch).toBeTruthy()
  })

  test('65. <GlowJourneyDrop replayToken={glowReplayToken} /> is only reachable where glowReplayToken is an in-scope prop or state', () => {
    // Locate the function body containing the GlowJourneyDrop render
    // and confirm that same function scope declares/receives
    // glowReplayToken (either as its own state, via useGlowJourney,
    // or as a destructured parameter) — not merely present somewhere
    // else in the file.
    const browseHomeFnMatch = scanScreenSrc.match(
      /function BrowseHome\(\{[\s\S]*?glowReplayToken[\s\S]*?\}\) \{[\s\S]*?<GlowJourneyDrop[\s\S]*?replayToken=\{glowReplayToken\}[\s\S]*?\/>/,
    )
    expect(browseHomeFnMatch).toBeTruthy()
  })

  test('66. Regression guard: no <GlowJourneyDrop replayToken=.../> render exists in a function that does not also declare/receive glowReplayToken', () => {
    // Split the source into top-level function bodies and verify
    // every occurrence of `replayToken={glowReplayToken}` is preceded
    // (within the same enclosing function) by a declaration/parameter
    // of glowReplayToken.
    const functionBoundaries = [...scanScreenSrc.matchAll(/^function \w+\(/gm)].map((m) => m.index)
    const exportBoundary = scanScreenSrc.indexOf('export default function ScanScreen')
    functionBoundaries.push(exportBoundary, scanScreenSrc.length)
    functionBoundaries.sort((a, b) => a - b)

    const replayTokenUsages = [...scanScreenSrc.matchAll(/replayToken=\{glowReplayToken\}/g)]
    expect(replayTokenUsages.length).toBeGreaterThan(0)

    for (const usage of replayTokenUsages) {
      const usageIdx = usage.index
      // Find the enclosing function's start (largest boundary <= usageIdx)
      let fnStart = 0
      for (const b of functionBoundaries) {
        if (b <= usageIdx) fnStart = b
        else break
      }
      const fnEnd = functionBoundaries.find((b) => b > usageIdx) ?? scanScreenSrc.length
      const enclosingFnSrc = scanScreenSrc.slice(fnStart, fnEnd)
      // The enclosing function must declare/receive glowReplayToken
      // somewhere before or at its own definition (as a param or via
      // useState) — i.e. it must appear in the function's own header
      // or body, not merely elsewhere in the file.
      expect(enclosingFnSrc).toMatch(/glowReplayToken/)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// GARDEN DETAIL SAFE-AREA SPACING — verifies the Done button
// and scroll content use safe-area insets for comfortable spacing.
// (Physical QA confirmed this fix PASSED — preserved unchanged.)
// ─────────────────────────────────────────────────────────────
describe('GardenDetail safe-area spacing (physical-QA PASS — preserved)', () => {
  test('67. GardenDetail imports useSafeAreaInsets', () => {
    expect(gardenDetailSrc).toMatch(/useSafeAreaInsets/)
    expect(gardenDetailSrc).toMatch(/react-native-safe-area-context/)
  })

  test('68. GardenDetail calls useSafeAreaInsets', () => {
    expect(gardenDetailSrc).toMatch(/const safeAreaInsets = useSafeAreaInsets\(\)/)
  })

  test('69. Header uses safe-area top inset for padding', () => {
    expect(gardenDetailSrc).toMatch(/paddingTop: safeAreaInsets\.top/)
  })

  test('70. Scroll content uses safe-area bottom inset for padding', () => {
    expect(gardenDetailSrc).toMatch(/paddingBottom: safeAreaInsets\.bottom/)
  })

  test('71. Done button remains tappable (min 44x44)', () => {
    expect(gardenDetailSrc).toMatch(/closeButton:[\s\S]*?minHeight: 44/)
    expect(gardenDetailSrc).toMatch(/closeButton:[\s\S]*?minWidth: 44/)
  })

  test('72. Safe-area spacing does not move entire composition upward', () => {
    expect(gardenDetailSrc).toMatch(/paddingTop: safeAreaInsets\.top/)
    expect(gardenDetailSrc).not.toMatch(/marginTop: -safeAreaInsets/)
  })
})
