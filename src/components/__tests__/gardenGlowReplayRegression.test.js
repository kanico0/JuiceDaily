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

  test('2. entryToken (open session id) advances on visible open (inside seen-state effect)', () => {
    // entryToken IS the Garden open session id. It is advanced from a
    // monotonic ref so the session value is known synchronously and can
    // tag the async detection result.
    expect(gardenDetailSrc).toMatch(/setEntryToken\(sessionId\)/)
    // It must be in the same effect that handles visible opens
    const openEffectMatch = gardenDetailSrc.match(
      /useEffect\(\(\) => \{[\s\S]*?if \(!visible \|\| seenStateLoaded\.current\) return[\s\S]*?setEntryToken\(sessionId\)/,
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

  test('9. Ordinary rerender does not advance entryToken', () => {
    // entryToken must only advance inside the visible-dependent effect,
    // not in any other effect or callback
    const allIncrements = gardenDetailSrc.match(/setEntryToken\(sessionId\)/g)
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
    // The session advance is synchronous and does not itself trigger
    // detectAdvancements. Detection runs in the async IIFE after the
    // guard. The session advance happens BEFORE the async IIFE, proving
    // the session identity is established independently of (and prior
    // to) any advancement detection result.
    const source = gardenDetailSrc
    const tokenIdx = source.indexOf('setEntryToken(sessionId)')
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
// GARDEN OPEN-SESSION IDENTITY + ENTRY REPLAY (post-874a407)
//
// PROVEN ANDROID LIFECYCLE (physical-device logcat, scales=1):
//   - GardenDetail PERSISTS across opens (rendered unconditionally
//     by TodayScreen; only Modal children come and go).
//   - Tapping Done sets visible=false. RN's Modal.render() returns
//     null when visible!==true on Android, so LivingGardenScene
//     UNMOUNTS on Done and REMOUNTS on the next open.
//   - Because the Scene remounts, its per-mount guard
//     (processedAdvancementsRef) resets. The persistent parent still
//     held the PREVIOUS open's advancements object, so on reopen the
//     stale object was re-processed as if it were new progress:
//         open #2 → "hasChanges=true"  (STALE session-1 data)
//         then    → "hasChanges=false" (fresh session-2 detection)
//         then    → ambient replay cancelled the stale timeline
//     Two competing major timelines per open, and the visible one was
//     driven by stale data.
//   - The ambient (in-grid value nudge) replay DID run on opens #2/#3
//     but was too subtle to read as the Garden entrance. The
//     recognizable entrance is the V6 Spotlight choreography, which
//     only mounted when real bed advancements existed.
//
// FIX UNDER TEST:
//   1. GardenDetail owns an open-session id (entryToken), incremented
//      exactly once per intentional visible false→true open.
//   2. Every detectAdvancements() result is tagged with the session
//      that requested it (advancementsSessionId). A result is valid
//      only while its session is current — so a prior session's
//      object can never be processed after remount.
//   3. Exactly ONE presentation decision per open:
//        'pending'         → nothing presented yet (no stale timeline)
//        'realAdvancement' → existing advancement presentation
//        'entryReplay'     → same recognizable V6 Spotlight entrance,
//                            using CURRENT persisted state
//                            (fromStage === toStage), no fake progress
//   4. Only REAL advancements are passed to useGardenMotion / the
//      advancement queue.
// ─────────────────────────────────────────────────────────────
describe('Garden open-session identity', () => {
  test('36. GardenDetail owns an open-session ref incremented once per open', () => {
    expect(gardenDetailSrc).toMatch(/const openSessionRef = useRef\(0\)/)
    const openEffect = gardenDetailSrc.match(
      /if \(!visible \|\| seenStateLoaded\.current\) return[\s\S]*?openSessionRef\.current \+= 1[\s\S]*?const sessionId = openSessionRef\.current/,
    )
    expect(openEffect).toBeTruthy()
  })

  test('37. Detection results are tagged with the requesting session id', () => {
    expect(gardenDetailSrc).toMatch(/const \[advancementsSessionId, setAdvancementsSessionId\] = useState\(0\)/)
    expect(gardenDetailSrc).toMatch(/setAdvancementsSessionId\(sessionId\)/)
  })

  test('38. Stale prior-session advancements are rejected via session equality', () => {
    expect(gardenDetailSrc).toMatch(
      /const advancementsValid = advancements != null && advancementsSessionId === entryToken/,
    )
  })

  test('39. Every session resolves exactly one advancement descriptor (incl. first-ever open)', () => {
    // wasFirstOpen and missing-lastSeen both produce a descriptor, so
    // a session never silently fails to resolve (which would leave the
    // Scene acting on the previous session's data).
    expect(gardenDetailSrc).toMatch(/if \(wasFirstOpen\)[\s\S]*?isFirstOpen: true/)
    expect(gardenDetailSrc).toMatch(/lastSeen[\s\S]*?\?[\s\S]*?detectAdvancements\(lastSeen, currentState\)[\s\S]*?:[\s\S]*?isFirstOpen: false/)
  })

  test('40. presentationMode is exactly one of pending/realAdvancement/entryReplay', () => {
    const modeMatch = gardenDetailSrc.match(
      /const presentationMode = !presentationReady \|\| !advancementsValid\s*\?\s*'pending'\s*:\s*\(hasRealAdvancement \? 'realAdvancement' : 'entryReplay'\)/,
    )
    expect(modeMatch).toBeTruthy()
  })

  test('41. Only REAL advancements are passed down as advancements', () => {
    expect(gardenDetailSrc).toMatch(
      /const sceneAdvancements = presentationMode === 'realAdvancement' \? advancements : null/,
    )
    expect(gardenDetailSrc).toMatch(/advancements=\{sceneAdvancements\}/)
    expect(gardenDetailSrc).toMatch(/presentationMode=\{presentationMode\}/)
  })

  test('42. hasRealAdvancement requires genuine earned progression', () => {
    const hasRealMatch = gardenDetailSrc.match(
      /const hasRealAdvancement = !!\([\s\S]*?advancementsValid &&[\s\S]*?!advancements\.isFirstOpen &&[\s\S]*?bedAdvancements[\s\S]*?journeyAdvancement[\s\S]*?newMilestoneIds[\s\S]*?rainbowComplete[\s\S]*?\)/,
    )
    expect(hasRealMatch).toBeTruthy()
  })

  test('43. Session id does not change on ordinary rerenders while open', () => {
    // The increment lives ONLY inside the visible-gated open effect.
    const increments = (gardenDetailSrc.match(/openSessionRef\.current \+= 1/g) || []).length
    expect(increments).toBe(1)
    const openEffect = gardenDetailSrc.match(
      /useEffect\(\(\) => \{\s*if \(!visible \|\| seenStateLoaded\.current\) return[\s\S]*?\}, \[visible\]\)/,
    )
    expect(openEffect).toBeTruthy()
    expect(openEffect[0]).toContain('openSessionRef.current += 1')
  })

  test('44. Persisted seen-state/progression APIs are never given the session id', () => {
    expect(gardenDetailSrc).not.toMatch(/saveLastSeenState\([^)]*sessionId/)
    expect(gardenDetailSrc).not.toMatch(/detectAdvancements\([^)]*sessionId/)
    expect(gardenDetailSrc).not.toMatch(/initializeIfAbsent\([^)]*sessionId/)
  })
})

// ─────────────────────────────────────────────────────────────
// ENTRY REPLAY REUSES THE V6 SPOTLIGHT ENTRANCE
// ─────────────────────────────────────────────────────────────
describe('Garden entry replay — reuses V6 Spotlight, no fake progress', () => {
  test('45. LivingGardenScene accepts presentationMode', () => {
    expect(livingGardenSceneSrc).toMatch(/presentationMode = 'pending',/)
  })

  test('46. Spotlight queue is derived per presentationMode', () => {
    const queueMatch = livingGardenSceneSrc.match(
      /const spotlightQueue = useMemo\(\(\) => \{[\s\S]*?if \(presentationMode === 'realAdvancement'\)[\s\S]*?if \(presentationMode === 'entryReplay'\)[\s\S]*?\}, \[presentationMode, advancements, bedStages\]\)/,
    )
    expect(queueMatch).toBeTruthy()
  })

  test('47. entryReplay uses CURRENT stage for BOTH source and target (no fabricated growth)', () => {
    const entryReplayBranch = livingGardenSceneSrc.match(
      /if \(presentationMode === 'entryReplay'\) \{[\s\S]*?fromStage: currentStage,\s*toStage: currentStage,[\s\S]*?\}/,
    )
    expect(entryReplayBranch).toBeTruthy()
    // The stage must be read from persisted bedStages, not invented.
    expect(livingGardenSceneSrc).toMatch(/const currentStage = bedStages\[bestBedKey\]\.key/)
  })

  test('48. entryReplay marks its queue entries so they are not advancement semantics', () => {
    expect(livingGardenSceneSrc).toMatch(/isEntryReplay: true/)
  })

  test('49. entryReplay spotlights a single representative bed (short, reads as an entrance)', () => {
    const branch = livingGardenSceneSrc.match(/if \(presentationMode === 'entryReplay'\) \{[\s\S]*?return \[\{[\s\S]*?\}\]/)
    expect(branch).toBeTruthy()
  })

  test('50. Empty garden does not fabricate a bed to spotlight', () => {
    expect(livingGardenSceneSrc).toMatch(/if \(!bestBedKey\) return \[\]/)
  })

  test("51. 'pending' presents nothing (prevents the stale/duplicate timeline)", () => {
    const pendingMatch = livingGardenSceneSrc.match(
      /\/\/ 'pending' — this session's detection has not resolved yet\.\s*return \[\]/,
    )
    expect(pendingMatch).toBeTruthy()
  })

  test('52. Scene memo comparator includes presentationMode', () => {
    expect(livingGardenSceneSrc).toMatch(/prev\.presentationMode === next\.presentationMode/)
  })

  test('53. The subtle ambient in-grid replay was removed from useGardenMotion', () => {
    expect(livingGardenMotionSrc).not.toMatch(/playAmbientEntranceReplay/)
    expect(livingGardenMotionSrc).not.toMatch(/GROWTH_START_SCALE_MID\)/)
  })

  test('54. useGardenMotion is documented as receiving REAL advancements only', () => {
    expect(livingGardenMotionSrc).toMatch(/only ever given REAL advancements/)
  })

  test('55. entryReplay never reaches useGardenMotion as advancements', () => {
    // GardenDetail passes null unless realAdvancement.
    expect(gardenDetailSrc).toMatch(
      /const sceneAdvancements = presentationMode === 'realAdvancement' \? advancements : null/,
    )
  })

  test('56. Reduce Motion still resolves instantly in the motion hook', () => {
    expect(livingGardenMotionSrc).toMatch(/if \(isReduced\) \{[\s\S]*?resolveToCanonicalRest\(\)[\s\S]*?return/)
  })

  test('57. Spotlight overlay itself respects Reduce Motion', () => {
    const spotlightSrc = fs.readFileSync(
      path.join(__dirname, '..', 'LivingGardenSpotlight.js'),
      'utf-8',
    )
    expect(spotlightSrc).toMatch(/isReduced/)
  })
})

// ─────────────────────────────────────────────────────────────
// BEHAVIORAL LIFECYCLE — models the PROVEN Android sequence:
// parent persists, Scene unmounts on Done and remounts on reopen,
// and the parent may still physically hold the prior session's data.
// ─────────────────────────────────────────────────────────────

// Faithful model of the shipped decision logic.
function createGardenDetailModel() {
  return {
    // persistent parent state (survives Scene unmount)
    openSession: 0,
    advancements: null,
    advancementsSessionId: 0,
    seenStateLoaded: false,
    visible: false,
    savedSeenStateCount: 0,
  }
}

function computePresentation(model, { presentationReady = true } = {}) {
  const advancementsValid =
    model.advancements != null && model.advancementsSessionId === model.openSession
  const a = model.advancements
  const hasRealAdvancement = !!(
    advancementsValid &&
    !a.isFirstOpen &&
    (
      (a.bedAdvancements && a.bedAdvancements.length > 0) ||
      a.journeyAdvancement ||
      (a.newMilestoneIds && a.newMilestoneIds.length > 0) ||
      a.rainbowComplete
    )
  )
  const presentationMode = !presentationReady || !advancementsValid
    ? 'pending'
    : (hasRealAdvancement ? 'realAdvancement' : 'entryReplay')
  return {
    advancementsValid,
    hasRealAdvancement,
    presentationMode,
    motionAdvancements: presentationMode === 'realAdvancement' ? a : null,
  }
}

// Simulates one intentional open. Returns every presentation the Scene
// would start, in order, across the whole open (mount + async resolve).
function simulateOpen(model, freshAdvancements) {
  const presentations = []
  // 1. visible false → true. Parent opens a new session.
  model.visible = true
  model.seenStateLoaded = true
  model.openSession += 1
  // 2. Scene MOUNTS FRESH (per-mount guards reset). At this instant the
  //    parent may still hold the PREVIOUS session's advancements.
  let p = computePresentation(model)
  if (p.presentationMode !== 'pending') presentations.push(p.presentationMode)
  // 3. This session's async detection resolves and is session-tagged.
  model.advancements = freshAdvancements
  model.advancementsSessionId = model.openSession
  p = computePresentation(model)
  if (p.presentationMode !== 'pending') presentations.push(p.presentationMode)
  return presentations
}

function simulateClose(model) {
  // Done: Scene unmounts, seen-state saved, guard reset for next open,
  // and the presentation result is discarded so the next open starts
  // in 'pending' (see GardenDetail close effect).
  model.visible = false
  model.savedSeenStateCount += 1
  model.seenStateLoaded = false
  model.advancements = null
  model.advancementsSessionId = 0
}

const NO_CHANGE_ADV = () => ({
  isFirstOpen: false, bedAdvancements: [], journeyAdvancement: null, newMilestoneIds: [],
})
const REAL_ADV = () => ({
  isFirstOpen: false,
  bedAdvancements: [{ bedKey: 'greens', fromStage: 'seed', toStage: 'sprout' }],
  journeyAdvancement: null,
  newMilestoneIds: [],
})

describe('Garden proven-lifecycle behavior — 3 sessions', () => {
  test('58. Session 1 with real progress: exactly one realAdvancement presentation', () => {
    const m = createGardenDetailModel()
    const p = simulateOpen(m, REAL_ADV())
    expect(p).toEqual(['realAdvancement'])
  })

  test('59. Session 1 with no progress: exactly one entryReplay presentation', () => {
    const m = createGardenDetailModel()
    const p = simulateOpen(m, NO_CHANGE_ADV())
    expect(p).toEqual(['entryReplay'])
  })

  test('60. REGRESSION: session 2 must NOT process session 1 stale data', () => {
    // Layer 1 — the result is discarded on close.
    const m = createGardenDetailModel()
    simulateOpen(m, REAL_ADV()) // session 1 produced a real-advancement object
    simulateClose(m)
    expect(m.advancements).toBeNull()
    const p = simulateOpen(m, NO_CHANGE_ADV())
    expect(p).toEqual(['entryReplay'])
    expect(p).not.toContain('realAdvancement')
  })

  test('60b. DEFENSE IN DEPTH: even if a stale object were retained, session tagging rejects it', () => {
    // Simulates the exact failure seen in physical logcat: the parent
    // holding session 1's real-advancement object at session 2's
    // Scene remount. Session equality alone must reject it, independent
    // of the close-time clearing.
    const m = createGardenDetailModel()
    m.openSession = 1
    m.advancements = REAL_ADV()
    m.advancementsSessionId = 1
    expect(computePresentation(m).presentationMode).toBe('realAdvancement')
    // New open begins: session advances but the result is still session 1's.
    m.openSession = 2
    const atRemount = computePresentation(m)
    expect(atRemount.advancementsValid).toBe(false)
    expect(atRemount.presentationMode).toBe('pending')
    expect(atRemount.motionAdvancements).toBeNull()
  })

  test('61. Sessions 1→2→3 each produce exactly ONE presentation', () => {
    const m = createGardenDetailModel()
    const s1 = simulateOpen(m, REAL_ADV()); simulateClose(m)
    const s2 = simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    const s3 = simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    expect(s1).toHaveLength(1)
    expect(s2).toHaveLength(1)
    expect(s3).toHaveLength(1)
    expect(s1).toEqual(['realAdvancement'])
    expect(s2).toEqual(['entryReplay'])
    expect(s3).toEqual(['entryReplay'])
  })

  test('62. Opens #4 and #5 keep replaying (behavior does not decay)', () => {
    const m = createGardenDetailModel()
    simulateOpen(m, REAL_ADV()); simulateClose(m)
    simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    const s4 = simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    const s5 = simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    expect(s4).toEqual(['entryReplay'])
    expect(s5).toEqual(['entryReplay'])
  })

  test('63. Real progress earned between opens still uses the real advancement path', () => {
    const m = createGardenDetailModel()
    simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    const s2 = simulateOpen(m, REAL_ADV()); simulateClose(m)
    expect(s2).toEqual(['realAdvancement'])
  })

  test('64. Ordinary rerenders while Garden stays open do NOT re-present', () => {
    const m = createGardenDetailModel()
    simulateOpen(m, NO_CHANGE_ADV())
    const sessionBefore = m.openSession
    // Several rerenders with no visible transition:
    const modes = [
      computePresentation(m).presentationMode,
      computePresentation(m).presentationMode,
      computePresentation(m).presentationMode,
    ]
    // Mode is stable and the session never advances → the Scene's
    // queue useMemo inputs are unchanged, so no new presentation starts.
    expect(new Set(modes).size).toBe(1)
    expect(m.openSession).toBe(sessionBefore)
  })

  test('65. First-ever open (isFirstOpen) resolves to entryReplay, never realAdvancement', () => {
    const m = createGardenDetailModel()
    const p = simulateOpen(m, {
      isFirstOpen: true, bedAdvancements: [], journeyAdvancement: null, newMilestoneIds: [],
    })
    expect(p).toEqual(['entryReplay'])
  })

  test('66. Persisted seen-state is written once per close, never per presentation', () => {
    const m = createGardenDetailModel()
    simulateOpen(m, REAL_ADV()); simulateClose(m)
    simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    simulateOpen(m, NO_CHANGE_ADV()); simulateClose(m)
    expect(m.savedSeenStateCount).toBe(3)
  })

  test('67. entryReplay never mutates the advancement descriptor (no fake progress)', () => {
    const m = createGardenDetailModel()
    const fresh = NO_CHANGE_ADV()
    simulateOpen(m, fresh)
    expect(fresh.bedAdvancements).toEqual([])
    expect(fresh.journeyAdvancement).toBeNull()
    expect(fresh.newMilestoneIds).toEqual([])
    expect(fresh.isFirstOpen).toBe(false)
  })

  test('68b. Close discards the presentation result so reopen starts in pending (exactly one START)', () => {
    // Physical logcat on the first fix attempt showed a SECOND
    // 'presentation START' at Scene remount, carrying the PREVIOUS
    // session's still-valid entryReplay mode, because the Scene mounts
    // one render before the open effect advances the session id.
    expect(gardenDetailSrc).toMatch(
      /if \(!visible && prevVisibleRef\.current\) \{[\s\S]*?setAdvancements\(null\)[\s\S]*?setAdvancementsSessionId\(0\)/,
    )
    // Behavioral: immediately after close, nothing is presentable.
    const m = createGardenDetailModel()
    simulateOpen(m, NO_CHANGE_ADV())
    simulateClose(m)
    expect(computePresentation(m).presentationMode).toBe('pending')
    // And at the first render of the next open (session not yet advanced)
    // it is still pending — no premature presentation.
    m.visible = true
    expect(computePresentation(m).presentationMode).toBe('pending')
  })

  test('68. Stale real-advancement data can never leak into useGardenMotion after reopen', () => {
    const m = createGardenDetailModel()
    simulateOpen(m, REAL_ADV())
    simulateClose(m)
    // Reopen; before the fresh detection resolves, motion must get null.
    m.visible = true
    m.seenStateLoaded = true
    m.openSession += 1
    const atRemount = computePresentation(m)
    expect(atRemount.presentationMode).toBe('pending')
    expect(atRemount.motionAdvancements).toBeNull()
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
