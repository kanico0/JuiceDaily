// ─────────────────────────────────────────────────────────────
// livingGardenProductionIntegration.test.js
//
// Production integration tests for the Living Garden motion
// system. Verifies that real Garden advancement detection
// connects to the approved motion systems via the existing
// seen-state architecture.
//
// DOES NOT test visual rendering — tests the integration path:
//   detectAdvancements → advancements prop → motion orchestration
//   → Spotlight queue → Tree/Arbor wiring → no Rainbow in production
//
// Uses source inspection (same pattern as livingGardenNonBedMotion.test.js)
// to verify the production wiring without mounting components.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const SCENE_PATH = path.join(__dirname, '..', 'LivingGardenScene.js')
const MOTION_PATH = path.join(__dirname, '..', 'LivingGardenMotion.js')
const GARDEN_DETAIL_PATH = path.join(__dirname, '..', 'GardenDetail.js')
const SEEN_STATE_PATH = path.join(__dirname, '..', '..', 'services', 'gardenSeenState.js')

const SCENE_SRC = fs.readFileSync(SCENE_PATH, 'utf-8')
const MOTION_SRC = fs.readFileSync(MOTION_PATH, 'utf-8')
const GARDEN_DETAIL_SRC = fs.readFileSync(GARDEN_DETAIL_PATH, 'utf-8')
const SEEN_STATE_SRC = fs.readFileSync(SEEN_STATE_PATH, 'utf-8')

// ─────────────────────────────────────────────────────────────
// 1. Seen-state architecture (presentation-only, no progression truth)
// ─────────────────────────────────────────────────────────────
describe('Production integration — seen-state architecture', () => {
  test('1. garden_last_seen_state_v1 is the seen-state key (presentation only)', () => {
    expect(SEEN_STATE_SRC).toMatch(/garden_last_seen_state_v1/)
    expect(SEEN_STATE_SRC).toMatch(/NOT progression truth/)
  })

  test('2. detectAdvancements returns isFirstOpen for first visit (no historical replay)', () => {
    expect(SEEN_STATE_SRC).toMatch(/isFirstOpen: true/)
  })

  test('3. detectAdvancements returns bedAdvancements, journeyAdvancement, newMilestoneIds', () => {
    expect(SEEN_STATE_SRC).toMatch(/bedAdvancements/)
    expect(SEEN_STATE_SRC).toMatch(/journeyAdvancement/)
    expect(SEEN_STATE_SRC).toMatch(/newMilestoneIds/)
  })

  test('4. detectAdvancements does NOT return rainbowComplete (Rainbow deferred from production)', () => {
    // The detectAdvancements function must not include rainbowComplete in its return
    const fnMatch = SEEN_STATE_SRC.match(/export function detectAdvancements[\s\S]*?\n}/)
    expect(fnMatch).toBeTruthy()
    const fnCode = fnMatch[0]
    expect(fnCode).not.toMatch(/rainbowComplete/)
  })

  test('5. initializeIfAbsent saves current state on first open (baseline, no replay)', () => {
    expect(SEEN_STATE_SRC).toMatch(/initializeIfAbsent/)
    expect(SEEN_STATE_SRC).toMatch(/saveLastSeenState/)
  })

  test('6. No new persistence key beyond garden_last_seen_state_v1 and garden_living_intro_seen', () => {
    // Count AsyncStorage keys
    const keyMatches = SEEN_STATE_SRC.match(/KEY_\w+ = '/g) || []
    expect(keyMatches.length).toBeLessThanOrEqual(2)
    expect(SEEN_STATE_SRC).toMatch(/KEY_SEEN_STATE = 'garden_last_seen_state_v1'/)
    expect(SEEN_STATE_SRC).toMatch(/KEY_INTRO_SEEN = 'garden_living_intro_seen'/)
  })
})

// ─────────────────────────────────────────────────────────────
// 2. GardenDetail production path
// ─────────────────────────────────────────────────────────────
describe('Production integration — GardenDetail path', () => {
  test('7. GardenDetail imports detectAdvancements and buildCurrentSeenState', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/detectAdvancements/)
    expect(GARDEN_DETAIL_SRC).toMatch(/buildCurrentSeenState/)
  })

  test('8. GardenDetail initializes seen-state on first visible (no historical replay)', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/initializeIfAbsent/)
  })

  test('9. GardenDetail detects advancements from last-seen vs current', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/getLastSeenState/)
    expect(GARDEN_DETAIL_SRC).toMatch(/detectAdvancements\(lastSeen/)
  })

  test('10. GardenDetail passes sceneAdvancements to LivingGardenScene (gated by intro)', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/advancements=\{sceneAdvancements\}/)
    expect(GARDEN_DETAIL_SRC).toMatch(/sceneAdvancements/)
    expect(GARDEN_DETAIL_SRC).toMatch(/presentationReady/)
  })

  test('11. GardenDetail saves seen-state on close (presentation only)', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/saveLastSeenState/)
  })

  test('12. GardenDetail does NOT pass spotlightActive (Scene manages internally)', () => {
    // GardenDetail should not pass spotlight props — the Scene handles Spotlight internally
    expect(GARDEN_DETAIL_SRC).not.toMatch(/spotlightActive=/)
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Scene — V6 Spotlight production integration
// ─────────────────────────────────────────────────────────────
describe('Production integration — Scene V6 Spotlight wiring', () => {
  test('13. Scene imports LivingGardenSpotlight', () => {
    expect(SCENE_SRC).toMatch(/import.*LivingGardenSpotlight.*from.*LivingGardenSpotlight/)
  })

  test('14. Scene has internal Spotlight queue state for production bed advancements', () => {
    expect(SCENE_SRC).toMatch(/spotlightQueue/)
    expect(SCENE_SRC).toMatch(/spotlightIdx/)
  })

  test('15. Scene starts Spotlight queue when advancements contain bed advancements', () => {
    expect(SCENE_SRC).toMatch(/bedAdvancements/)
    // Queue is computed via useMemo (not setSpotlightQueue)
    expect(SCENE_SRC).toMatch(/useMemo/)
    expect(SCENE_SRC).toMatch(/setSpotlightIdx\(0\)/)
  })

  test('16. Scene renders LivingGardenSpotlight inside sceneCanvas for production', () => {
    expect(SCENE_SRC).toMatch(/internalSpotlightActive/)
    expect(SCENE_SRC).toMatch(/<LivingGardenSpotlight/)
  })

  test('17. Scene passes bedKey, sourceStage, targetStage from advancement queue', () => {
    expect(SCENE_SRC).toMatch(/bedKey=\{internalSpotlightBed\}/)
    expect(SCENE_SRC).toMatch(/sourceStage=\{internalSpotlightSource\}/)
    expect(SCENE_SRC).toMatch(/targetStage=\{internalSpotlightTarget\}/)
  })

  test('18. Scene advances Spotlight queue on complete', () => {
    expect(SCENE_SRC).toMatch(/handleSpotlightComplete/)
    expect(SCENE_SRC).toMatch(/onComplete=\{handleSpotlightComplete\}/)
  })

  test('19. Scene merges internal and external spotlight state', () => {
    expect(SCENE_SRC).toMatch(/effectiveSpotlightActive/)
    expect(SCENE_SRC).toMatch(/effectiveSpotlightBedKey/)
    expect(SCENE_SRC).toMatch(/effectiveSpotlightTargetStage/)
  })

  test('20. Scene uses effective spotlight state for grid bed hiding', () => {
    expect(SCENE_SRC).toMatch(/bedKey === effectiveSpotlightBedKey && effectiveSpotlightActive/)
  })

  test('21. Scene clears Spotlight queue on first open (no replay)', () => {
    expect(SCENE_SRC).toMatch(/isFirstOpen/)
    // On first open, queue should be cleared
    const effectMatch = SCENE_SRC.match(/if \(!advancements \|\| advancements\.isFirstOpen\)[\s\S]*?\n\s*\n/)
    expect(effectMatch).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Motion hook — bed motion suppression + Tree/Arbor wiring
// ─────────────────────────────────────────────────────────────
describe('Production integration — motion hook wiring', () => {
  test('22. Motion hook suppresses runBedMotion for bed advancements (Spotlight handles beds)', () => {
    // The runBedMotion call should be commented out or suppressed
    expect(MOTION_SRC).toMatch(/Suppress old per-bed motion/)
    expect(MOTION_SRC).toMatch(/V6 Spotlight/)
    // The actual runBedMotion call should be commented out
    expect(MOTION_SRC).toMatch(/\/\/ runBedMotion/)
  })

  test('23. Motion hook still computes Tree/Arbor timing from bed advancements', () => {
    // Tree/Arbor timing computation should still use bedAdvancements
    expect(MOTION_SRC).toMatch(/advancements\.bedAdvancements\[0\]\.fromStage/)
  })

  test('24. Motion hook runs Journey Tree motion when journeyAdvancement exists', () => {
    expect(MOTION_SRC).toMatch(/hasJourney/)
  })

  test('25. Motion hook runs Arbor reveal when newMilestoneIds exist', () => {
    expect(MOTION_SRC).toMatch(/hasArbor/)
    expect(MOTION_SRC).toMatch(/runArborReveal/)
  })

  test('26. Motion hook does NOT trigger Rainbow from production advancements', () => {
    // hasRainbow checks advancements.rainbowComplete which detectAdvancements never sets
    expect(MOTION_SRC).toMatch(/hasRainbow = !!advancements\.rainbowComplete/)
    // detectAdvancements does not return rainbowComplete
    const fnMatch = SEEN_STATE_SRC.match(/export function detectAdvancements[\s\S]*?\n}/)
    const fnCode = fnMatch[0]
    expect(fnCode).not.toMatch(/rainbowComplete/)
  })

  test('27. Motion hook resolves to canonical rest on first open', () => {
    expect(MOTION_SRC).toMatch(/isFirstOpen/)
    expect(MOTION_SRC).toMatch(/resolveToCanonicalRest/)
  })

  test('28. Motion hook resolves to canonical rest when no advancements', () => {
    expect(MOTION_SRC).toMatch(/!hasBeds && !hasJourney && !hasArbor && !hasRainbow/)
  })

  test('29. Motion hook uses needsCompression for multiple advancement classes', () => {
    expect(MOTION_SRC).toMatch(/needsCompression/)
  })
})

// ─────────────────────────────────────────────────────────────
// 5. Frozen systems — unchanged
// ─────────────────────────────────────────────────────────────
describe('Production integration — frozen systems untouched', () => {
  test('30. Garden thresholds unchanged (empty/seed/sprout/growing/harvesting/flourishing)', () => {
    expect(SEEN_STATE_SRC).toMatch(/STAGE_ORDER = \['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing'\]/)
  })

  test('31. Journey thresholds unchanged (seed/sprout/growing/blooming/thriving/radiant/legend)', () => {
    expect(SEEN_STATE_SRC).toMatch(/JOURNEY_ORDER = \['seed', 'sprout', 'growing', 'blooming', 'thriving', 'radiant', 'legend'\]/)
  })

  test('32. Bed keys unchanged (7 beds)', () => {
    expect(SEEN_STATE_SRC).toMatch(/\['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'\]/)
  })

  test('33. Spotlight visual constants unchanged (SPOTLIGHT_HOLD_SCALE = 1.50)', () => {
    const spotlightPath = path.join(__dirname, '..', 'LivingGardenSpotlight.js')
    const spotlightSrc = fs.readFileSync(spotlightPath, 'utf-8')
    expect(spotlightSrc).toMatch(/SPOTLIGHT_HOLD_SCALE = 1\.50/)
    expect(spotlightSrc).toMatch(/SPOTLIGHT_DURATION_MS = 2500/)
  })

  test('34. Rainbow peak opacity unchanged (0.35)', () => {
    expect(MOTION_SRC).toMatch(/RAINBOW_PEAK_OPACITY = 0\.35/)
  })

  test('35. Rainbow probe remains 0.50', () => {
    expect(SCENE_SRC).toMatch(/0\.5/)
  })
})

// ─────────────────────────────────────────────────────────────
// 6. No progression truth written by motion
// ─────────────────────────────────────────────────────────────
describe('Production integration — no progression truth from motion', () => {
  test('36. Motion hook does not write to AsyncStorage', () => {
    expect(MOTION_SRC).not.toMatch(/AsyncStorage/)
  })

  test('37. Scene does not write to AsyncStorage', () => {
    expect(SCENE_SRC).not.toMatch(/AsyncStorage/)
  })

  test('38. Spotlight does not write to AsyncStorage', () => {
    const spotlightPath = path.join(__dirname, '..', 'LivingGardenSpotlight.js')
    const spotlightSrc = fs.readFileSync(spotlightPath, 'utf-8')
    expect(spotlightSrc).not.toMatch(/AsyncStorage/)
  })

  test('39. GardenDetail saves seen-state only on close visible true→false (presentation state)', () => {
    // Bug fix: saveLastSeenState is called only when visible transitions
    // from true to false (using prevVisibleRef), NOT on every currentSeenState
    // change while invisible.
    expect(GARDEN_DETAIL_SRC).toMatch(/saveLastSeenState/)
    expect(GARDEN_DETAIL_SRC).toMatch(/prevVisibleRef/)
    expect(GARDEN_DETAIL_SRC).toMatch(/seenStateLoaded\.current = false/)
    // Old pattern must NOT exist (it saved on every currentSeenState change)
    expect(GARDEN_DETAIL_SRC).not.toMatch(/if \(!visible && seenStateLoaded\.current\)/)
  })

  test('40. GardenDetail open effect uses currentSeenStateRef (no race condition)', () => {
    // Bug 3 fix: open effect uses ref for currentSeenState to prevent
    // race where currentSeenState changes mid-detection cancels the
    // async IIFE before setAdvancements is called.
    expect(GARDEN_DETAIL_SRC).toMatch(/currentSeenStateRef/)
    expect(GARDEN_DETAIL_SRC).toMatch(/currentSeenStateRef\.current/)
  })

  test('41. GardenDetail does not contain production trace UI', () => {
    expect(GARDEN_DETAIL_SRC).not.toMatch(/GARDEN PROD TRACE/)
    expect(GARDEN_DETAIL_SRC).not.toMatch(/prodTrace/)
  })
})
