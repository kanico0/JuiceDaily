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
const glowJourneyDetailSrc = fs.readFileSync(
  path.join(__dirname, '..', 'GlowJourneyDetail.js'),
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
    // The entryToken must NOT be passed to useGardenMotion or
    // any advancement/progression service. It is presentation-only.
    const motionHookMatch = livingGardenSceneSrc.match(
      /useGardenMotion\(\{[\s\S]*?\}\)/,
    )
    expect(motionHookMatch).toBeTruthy()
    // entryToken must not appear inside the useGardenMotion call
    expect(motionHookMatch[0]).not.toContain('entryToken')
    // GardenDetail must not write entryToken to any service
    expect(gardenDetailSrc).not.toMatch(/saveLastSeenState.*entryToken/)
    expect(gardenDetailSrc).not.toMatch(/detectAdvancements.*entryToken/)
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
