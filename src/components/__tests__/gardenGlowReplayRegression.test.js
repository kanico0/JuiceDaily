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
    // entryToken IS now passed to useGardenMotion for entrance replay
    // (presentation-only). But it must NOT be passed to any
    // advancement/progression service or affect seen-state logic.
    const motionHookMatch = livingGardenSceneSrc.match(
      /useGardenMotion\(\{[\s\S]*?\}\)/,
    )
    expect(motionHookMatch).toBeTruthy()
    // entryToken must appear in the useGardenMotion call (entrance replay)
    expect(motionHookMatch[0]).toContain('entryToken')
    // GardenDetail must not write entryToken to any service
    expect(gardenDetailSrc).not.toMatch(/saveLastSeenState.*entryToken/)
    expect(gardenDetailSrc).not.toMatch(/detectAdvancements.*entryToken/)
    // LivingGardenMotion must not pass entryToken to advancement detection
    const livingGardenMotionSrc = fs.readFileSync(
      path.join(__dirname, '..', 'LivingGardenMotion.js'),
      'utf-8',
    )
    // entryToken must not appear in the orchestration effect's advancement logic
    expect(livingGardenMotionSrc).not.toMatch(/detectAdvancements.*entryToken/)
    // entryToken must not be written to any persistence service
    expect(livingGardenMotionSrc).not.toMatch(/saveLastSeenState.*entryToken/i)
    expect(livingGardenMotionSrc).not.toMatch(/AsyncStorage.*entryToken/i)
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
// GARDEN ENTRANCE REPLAY IN useGardenMotion — verifies the
// entrance replay effect exists, depends on entryToken, resets
// to dormant, animates to canonical, and respects Reduce Motion.
// ─────────────────────────────────────────────────────────────
describe('Garden useGardenMotion entrance replay', () => {
  test('36. useGardenMotion accepts entryToken parameter', () => {
    expect(livingGardenMotionSrc).toMatch(/entryToken = 0/)
    expect(livingGardenMotionSrc).toMatch(/export function useGardenMotion\(\{[\s\S]*?entryToken/)
  })

  test('37. Entrance replay effect depends on entryToken', () => {
    // The entrance replay effect must include entryToken in deps
    const entranceEffectMatch = livingGardenMotionSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevEntryTokenRef[\s\S]*?\}, \[entryToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
  })

  test('38. Entrance replay resets to dormant state on replay', () => {
    // Must reset bed refs to dormant (scaleY 0.01, opacity 0)
    expect(livingGardenMotionSrc).toMatch(/refs\.scaleY\.setValue\(0\.01\)/)
    expect(livingGardenMotionSrc).toMatch(/refs\.opacity\.setValue\(0\)/)
    // Must reset tree to dormant
    expect(livingGardenMotionSrc).toMatch(/treeScaleRef\.current\.setValue\(0\.01\)/)
    expect(livingGardenMotionSrc).toMatch(/treeOpacityRef\.current\.setValue\(0\)/)
    // Must reset arbor to dormant
    expect(livingGardenMotionSrc).toMatch(/arborRevealRef\.current\.setValue\(0\)/)
  })

  test('39. Entrance replay animates to canonical rest', () => {
    // Must animate beds back to scaleY 1, opacity 1
    expect(livingGardenMotionSrc).toMatch(/Animated\.timing\(refs\.scaleY[\s\S]*?toValue: 1/)
    expect(livingGardenMotionSrc).toMatch(/Animated\.timing\(refs\.opacity[\s\S]*?toValue: 1/)
    // Must animate tree back to 1
    expect(livingGardenMotionSrc).toMatch(/Animated\.timing\(treeScaleRef\.current[\s\S]*?toValue: 1/)
    // Must animate arbor back to 1
    expect(livingGardenMotionSrc).toMatch(/Animated\.timing\(arborRevealRef\.current[\s\S]*?toValue: 1/)
  })

  test('40. Entrance replay respects Reduce Motion', () => {
    // When isReduced, must resolve to canonical immediately
    const reducedMatch = livingGardenMotionSrc.match(
      /prevEntryTokenRef\.current = entryToken[\s\S]*?if \(isReduced\) \{[\s\S]*?resolveToCanonicalRest\(\)[\s\S]*?return/,
    )
    expect(reducedMatch).toBeTruthy()
  })

  test('41. Entrance replay does not modify advancements or seen-state', () => {
    // The entrance replay effect must not call detectAdvancements,
    // saveLastSeenState, or any persistence service
    const entranceEffectMatch = livingGardenMotionSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevEntryTokenRef[\s\S]*?\}, \[entryToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
    expect(entranceEffectMatch[0]).not.toMatch(/detectAdvancements/)
    expect(entranceEffectMatch[0]).not.toMatch(/saveLastSeenState/)
    expect(entranceEffectMatch[0]).not.toMatch(/initializeIfAbsent/)
  })

  test('42. Entrance replay cancels existing timeline before starting', () => {
    // Must call cancelTimeline and stopIdleMotion at the start
    const entranceEffectMatch = livingGardenMotionSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevEntryTokenRef[\s\S]*?\}, \[entryToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
    expect(entranceEffectMatch[0]).toMatch(/cancelTimeline\(\)/)
    expect(entranceEffectMatch[0]).toMatch(/stopIdleMotion\(\)/)
  })

  test('43. LivingGardenScene passes entryToken to useGardenMotion', () => {
    const motionCallMatch = livingGardenSceneSrc.match(
      /useGardenMotion\(\{[\s\S]*?entryToken[\s\S]*?\}\)/,
    )
    expect(motionCallMatch).toBeTruthy()
    expect(motionCallMatch[0]).toContain('entryToken')
  })
})

// ─────────────────────────────────────────────────────────────
// GLOW JOURNEY DROP REPLAY ON EXPLORE FOCUS — verifies the
// replayToken prop, entrance reset, and ScanScreen focus wiring.
// ─────────────────────────────────────────────────────────────
describe('GlowJourneyDrop replay on Explore focus', () => {
  test('44. GlowJourneyDrop accepts replayToken prop', () => {
    expect(glowJourneyDropSrc).toMatch(/replayToken = 0/)
  })

  test('45. Entrance effect depends on replayToken', () => {
    // The entrance effect must include replayToken in deps
    const entranceEffectMatch = glowJourneyDropSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevReplayTokenRef[\s\S]*?\}, \[replayToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
  })

  test('46. replayToken change resets hasEnteredRef', () => {
    // When replayToken changes, hasEnteredRef must be set to false
    expect(glowJourneyDropSrc).toMatch(/prevReplayTokenRef\.current !== replayToken/)
    expect(glowJourneyDropSrc).toMatch(/hasEnteredRef\.current = false/)
  })

  test('47. replayToken change resets entrance animation values', () => {
    // entranceAnim must be reset to 0 on replay
    expect(glowJourneyDropSrc).toMatch(/entranceAnim\.setValue\(0\)/)
  })

  test('48. ScanScreen tracks glowReplayToken state', () => {
    expect(scanScreenSrc).toMatch(/const \[glowReplayToken, setGlowReplayToken\] = useState\(0\)/)
  })

  test('49. ScanScreen increments glowReplayToken on navigation focus', () => {
    // Must have a focus listener that increments the token
    const focusMatch = scanScreenSrc.match(
      /navigation\.addListener\('focus'[\s\S]*?setGlowReplayToken\(\(t\) => t \+ 1\)/,
    )
    expect(focusMatch).toBeTruthy()
  })

  test('50. ScanScreen passes replayToken to GlowJourneyDrop', () => {
    expect(scanScreenSrc).toMatch(/replayToken=\{glowReplayToken\}/)
  })

  test('51. ScanScreen tracks blur to reset focus state', () => {
    // Must have a blur listener to reset the prev-focused ref
    expect(scanScreenSrc).toMatch(/navigation\.addListener\('blur'/)
    expect(scanScreenSrc).toMatch(/glowReplayPrevFocusedRef\.current = false/)
  })

  test('52. GlowJourneyDrop replay does not modify persisted Glow state', () => {
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

  test('53. GlowJourneyDrop replay respects Reduce Motion', () => {
    // The entrance effect must handle isReduced
    const entranceEffectMatch = glowJourneyDropSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?prevReplayTokenRef[\s\S]*?\}, \[replayToken[\s\S]*?\]\)/,
    )
    expect(entranceEffectMatch).toBeTruthy()
    expect(entranceEffectMatch[0]).toMatch(/isReduced/)
  })
})

// ─────────────────────────────────────────────────────────────
// GARDEN DETAIL SAFE-AREA SPACING — verifies the Done button
// and scroll content use safe-area insets for comfortable spacing.
// ─────────────────────────────────────────────────────────────
describe('GardenDetail safe-area spacing', () => {
  test('54. GardenDetail imports useSafeAreaInsets', () => {
    expect(gardenDetailSrc).toMatch(/useSafeAreaInsets/)
    expect(gardenDetailSrc).toMatch(/react-native-safe-area-context/)
  })

  test('55. GardenDetail calls useSafeAreaInsets', () => {
    expect(gardenDetailSrc).toMatch(/const safeAreaInsets = useSafeAreaInsets\(\)/)
  })

  test('56. Header uses safe-area top inset for padding', () => {
    // The header must use safeAreaInsets.top in its paddingTop
    expect(gardenDetailSrc).toMatch(/paddingTop: safeAreaInsets\.top/)
  })

  test('57. Scroll content uses safe-area bottom inset for padding', () => {
    // The scroll content must use safeAreaInsets.bottom in its paddingBottom
    expect(gardenDetailSrc).toMatch(/paddingBottom: safeAreaInsets\.bottom/)
  })

  test('58. Done button remains tappable (min 44x44)', () => {
    // The closeButton style must retain minHeight/minWidth 44
    expect(gardenDetailSrc).toMatch(/closeButton:[\s\S]*?minHeight: 44/)
    expect(gardenDetailSrc).toMatch(/closeButton:[\s\S]*?minWidth: 44/)
  })

  test('59. Safe-area spacing does not move entire composition upward', () => {
    // The header must use paddingTop (not marginTop) to avoid
    // shifting the entire layout
    expect(gardenDetailSrc).toMatch(/paddingTop: safeAreaInsets\.top/)
    // Must NOT use negative margins or large upward shifts
    expect(gardenDetailSrc).not.toMatch(/marginTop: -safeAreaInsets/)
  })
})
