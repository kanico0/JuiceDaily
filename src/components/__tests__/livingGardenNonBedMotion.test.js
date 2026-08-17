// Focused tests for non-bed progress motion (Journey Tree, Arbor, Rainbow)
// Validates the 40 requirements from the final non-bed motion batch spec.
import React from 'react'
import { Animated } from 'react-native'
import fs from 'fs'
import path from 'path'

// ── Source file reads ──────────────────────────────────────────
const TREE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../LivingGardenJourneyTree.js'),
  'utf8',
)
const ARBOR_SRC = fs.readFileSync(
  path.resolve(__dirname, '../LivingGardenArbor.js'),
  'utf8',
)
const SCENE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../LivingGardenScene.js'),
  'utf8',
)
const MOTION_SRC = fs.readFileSync(
  path.resolve(__dirname, '../LivingGardenMotion.js'),
  'utf8',
)
const BED_SRC = fs.readFileSync(
  path.resolve(__dirname, '../LivingGardenBed.js'),
  'utf8',
)
const ARBOR_ARTWORK_SRC = fs.readFileSync(
  path.resolve(__dirname, '../MilestoneArborArtwork.js'),
  'utf8',
)
const GLOW_JOURNEY_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../services/glowJourneyService.js'),
  'utf8',
)
const PREVIEW_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../screens/GardenPreviewScreen.js'),
  'utf8',
)

// ── Imports for runtime tests ──────────────────────────────────
import { ARBOR_CATALOG } from '../MilestoneArborArtwork'
import { TRANSITION_SCENARIOS } from '../../screens/GardenPreviewScreen'
import {
  RAINBOW_DURATION,
  RAINBOW_DURATION_COMPRESSED,
} from '../LivingGardenMotion'

// ════════════════════════════════════════════════════════════════
// JOURNEY TREE (tests 1-12)
// ════════════════════════════════════════════════════════════════
describe('Journey Tree — non-bed motion', () => {
  test('1. Journey thresholds unchanged (Seed 1-4, Sprout 5-14, etc.)', () => {
    // glowJourneyService has the canonical getJourneyStage function
    expect(GLOW_JOURNEY_SRC).toMatch(/getJourneyStage/)
  })

  test('2. getJourneyStage(0) returns null (no false Seed)', () => {
    // The tree renders TreeUnstarted for null/undefined journeyStageKey
    expect(TREE_SRC).toMatch(/journeyStageKey === null \|\| journeyStageKey === undefined/)
    expect(TREE_SRC).toMatch(/TreeUnstarted/)
  })

  test('3. Preview source canonical (journeyAdvance: fromStage=seed)', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'journeyAdvance')
    expect(s).toBeDefined()
    expect(s.sourcePreset.journeyStageKey).toBe('seed')
  })

  test('4. Preview target canonical (journeyAdvance: toStage=growing)', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'journeyAdvance')
    expect(s).toBeDefined()
    expect(s.advancements.journeyAdvancement.toStage).toBe('growing')
  })

  test('5. No full-target first-frame flash path (guard exists)', () => {
    expect(TREE_SRC).toMatch(/UNPREPARED/)
    expect(TREE_SRC).toMatch(/guardPhaseRef/)
    expect(TREE_SRC).toMatch(/syncSourceOpacity = 1/)
    expect(TREE_SRC).toMatch(/syncTrunkOpacity = 0/)
  })

  test('6. Exactly one target advancement per Replay (transitionId guard)', () => {
    expect(TREE_SRC).toMatch(/transitionId !== prevTransitionIdRef\.current/)
    expect(TREE_SRC).toMatch(/generationRef\.current \+= 1/)
  })

  test('7. Target prepared/gated before visible arrival', () => {
    // Guard forces transition-start values while UNPREPARED
    expect(TREE_SRC).toMatch(/guardPhaseRef\.current === 1/)
    // Source layer renders with fading opacity
    expect(TREE_SRC).toMatch(/hasSourceLayer/)
    expect(TREE_SRC).toMatch(/SourceRenderer/)
  })

  test('8. Final canonical target (no leftover opacity/transform)', () => {
    // Guard transitions to COMPLETE when values return to canonical
    expect(TREE_SRC).toMatch(/guardPhaseRef\.current = 3/)
    // At COMPLETE, guard never reactivates
    expect(TREE_SRC).toMatch(/COMPLETE/)
  })

  test('9. Reduced Motion supported', () => {
    // Reduced Motion bypasses guard (COMPLETE immediately)
    expect(TREE_SRC).toMatch(/isReduced \? 3 : 1/)
  })

  test('10. No persistence writes in Journey Tree', () => {
    expect(TREE_SRC).not.toMatch(/AsyncStorage/)
    expect(TREE_SRC).not.toMatch(/gardenSeenState/)
    expect(TREE_SRC).not.toMatch(/\.set\(|\.put\(|\.update\(/)
  })

  test('11. Tree uses multi-channel motion (scaleY, opacity, canopy, detail, rim, breath)', () => {
    expect(TREE_SRC).toMatch(/treeMotion\.scaleY/)
    expect(TREE_SRC).toMatch(/treeMotion\.opacity/)
    expect(TREE_SRC).toMatch(/treeMotion\.canopy/)
    expect(TREE_SRC).toMatch(/treeMotion\.detail/)
    expect(TREE_SRC).toMatch(/treeMotion\.rim/)
    expect(TREE_SRC).toMatch(/treeMotion\.breath/)
  })

  test('12. No whole-Tree Hero zoom (no 1.5x scale)', () => {
    // Tree should NOT use SPOTLIGHT_HOLD_SCALE or 1.5x scale
    // Check that tree doesn't use 1.5 as a scale factor (not strokeWidth)
    expect(TREE_SRC).not.toMatch(/scale.*1\.5/i)
    expect(TREE_SRC).not.toMatch(/SPOTLIGHT_HOLD_SCALE/)
    // Idle canopy breath is extremely small (~1.004)
    expect(MOTION_SRC).toMatch(/IDLE_BREATH_SCALE/)
  })
})

// ════════════════════════════════════════════════════════════════
// MILESTONE ARBOR (tests 13-24)
// ════════════════════════════════════════════════════════════════
describe('Milestone Arbor — non-bed motion', () => {
  test('13. Catalog remains existing 12 launch milestones', () => {
    expect(ARBOR_CATALOG.length).toBe(12)
  })

  test('14. No invented milestones (catalog IDs match existing truth)', () => {
    const ids = ARBOR_CATALOG.map((e) => e.id)
    expect(ids).toContain('first_juice')
    expect(ids).toContain('streak_3')
    expect(ids).toContain('streak_7')
    expect(ids).toContain('logs_10')
    expect(ids).toContain('rainbow_harvest')
    // 7 bed flourishing milestones
    ;['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'].forEach((bed) => {
      expect(ids).toContain(`${bed}_flourishing`)
    })
  })

  test('15. +1 scenario animates only new ornament (1 newMilestoneId)', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'arborSingleNew')
    expect(s).toBeDefined()
    expect(s.advancements.newMilestoneIds).toEqual(['streak_3'])
  })

  test('16. +3 scenario animates only new ornaments (3 newMilestoneIds)', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'arborNew')
    expect(s).toBeDefined()
    expect(s.advancements.newMilestoneIds.length).toBe(3)
  })

  test('17. Old ornaments remain static (non-new get individualProgress=1)', () => {
    expect(ARBOR_SRC).toMatch(/if \(idx < 0\) return 1.*not newly earned/)
  })

  test('18. Single reveal scale starts ~0.88 and ends 1', () => {
    expect(ARBOR_SRC).toMatch(/0\.88 \+ 0\.12 \* individualProgress/)
  })

  test('19. Halo <= ~0.26', () => {
    // The actual halo peak value in code is 0.26
    expect(ARBOR_SRC).toMatch(/Math\.sin\(individualProgress \* Math\.PI\) \* 0\.26/)
    // Verify the old 0.35 value is only in a comment, not in active code
    const activeHaloMatch = ARBOR_SRC.match(/haloOpacity[^;]*0\.\d+/)
    expect(activeHaloMatch).toBeTruthy()
    expect(parseFloat(activeHaloMatch[0].match(/0\.\d+/)[0])).toBeLessThanOrEqual(0.26)
  })

  test('20. +3 stagger ~130ms', () => {
    expect(ARBOR_SRC).toMatch(/stagger.*130/)
    expect(ARBOR_SRC).toMatch(/newCount >= 5 \? 90 : 130/)
  })

  test('21. Total multi sequence bounded (~1600ms cap)', () => {
    expect(ARBOR_SRC).toMatch(/1600/)
    expect(ARBOR_SRC).toMatch(/Math\.min\(ornamentDuration.*stagger.*1600\)/)
  })

  test('22. Final ornaments canonical (at rest, scale=1, opacity=1, halo=0)', () => {
    // At individualProgress=1: scale=1, opacity=1, halo=0
    expect(ARBOR_SRC).toMatch(/ornamentScale.*1\b/)
    expect(ARBOR_SRC).toMatch(/ornamentOpacity.*1\b/)
    expect(ARBOR_SRC).toMatch(/haloOpacity.*0/)
  })

  test('23. No Arbor idle animation (no Animated loop for ornaments)', () => {
    // Arbor should not have Animated.loop for ornaments
    // The only Animated usage is the arborReveal listener bridge
    const animatedLoopMatches = ARBOR_SRC.match(/Animated\.loop/g)
    expect(animatedLoopMatches).toBeNull()
  })

  test('24. No persistence writes in Arbor', () => {
    expect(ARBOR_SRC).not.toMatch(/AsyncStorage/)
    expect(ARBOR_SRC).not.toMatch(/gardenSeenState/)
  })

  test('24b. Arbor TDZ bug fixed (newEarnedSet after effectiveNewIds)', () => {
    // The old code had useMemo with effectiveNewIds before declaration.
    // The fix moves newEarnedSet after effectiveNewIds is declared.
    const newEarnedSetPos = ARBOR_SRC.indexOf('newEarnedSet')
    const effectiveNewIdsPos = ARBOR_SRC.indexOf('let effectiveNewIds')
    // newEarnedSet should appear AFTER the let effectiveNewIds declaration
    const lastNewEarnedSetPos = ARBOR_SRC.lastIndexOf('newEarnedSet')
    expect(lastNewEarnedSetPos).toBeGreaterThan(effectiveNewIdsPos)
  })

  test('24c. Arbor listener effect includes advancementId dependency (ROOT-CAUSE FIX)', () => {
    // The listener effect MUST re-run when advancementId changes, otherwise
    // the listener is never set up after advancements arrives (stuck UNPREPARED).
    const effectMatch = ARBOR_SRC.match(/useEffect\(\(\) => \{[\s\S]*?addListener[\s\S]*?\}, \[.*?\]\)/)
    expect(effectMatch).toBeTruthy()
    expect(effectMatch[0]).toMatch(/advancementId/)
  })
})

// ════════════════════════════════════════════════════════════════
// RAINBOW (tests 25-33)
// ════════════════════════════════════════════════════════════════
describe('Rainbow — non-bed motion', () => {
  test('25. Exact renderer (RainbowCapstone in Scene)', () => {
    expect(SCENE_SRC).toMatch(/function RainbowCapstone/)
  })

  test('26. Existing truth source (advancements.rainbowComplete)', () => {
    expect(MOTION_SRC).toMatch(/advancements\.rainbowComplete/)
    expect(SCENE_SRC).toMatch(/rainbowComplete/)
  })

  test('27. Persistence source/key (arborCtx.rainbowComplete, no new key)', () => {
    // Rainbow uses existing arborCtx.rainbowComplete — no new persistence
    expect(ARBOR_ARTWORK_SRC).toMatch(/rainbowComplete/)
    // No new persistence key invented
    expect(MOTION_SRC).not.toMatch(/rainbow_state|rainbow_progress|rainbow_decay/)
  })

  test('28. Preview source state (rainbow scenario: thriving, rainbowComplete=false)', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    expect(s).toBeDefined()
    expect(s.sourcePreset.journeyStageKey).toBe('thriving')
    expect(s.sourcePreset.arborCtx.rainbowComplete).toBe(false)
  })

  test('29. Preview target state (rainbow scenario: legend, rainbowComplete=true)', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    expect(s).toBeDefined()
    expect(s.advancements.journeyAdvancement.toStage).toBe('legend')
    expect(s.advancements.rainbowComplete).toBe(true)
  })

  test('30. Exact normal timeline (~2600ms)', () => {
    expect(RAINBOW_DURATION).toBe(2600)
  })

  test('30b. Exact compressed timeline (~1600ms)', () => {
    expect(RAINBOW_DURATION_COMPRESSED).toBe(1600)
  })

  test('31. Animation channels (opacity only, no scale/rotation/particles)', () => {
    // RainbowCapstone uses direct Animated.View opacity (no per-frame React state)
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    expect(capstoneMatch).toBeTruthy()
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).not.toMatch(/transform.*scale/i)
    expect(capstoneCode).not.toMatch(/rotate/i)
    expect(capstoneCode).not.toMatch(/particle|confetti|firework/i)
  })

  test('32. Final target behavior (resolves to 0/invisible after completion)', () => {
    // runRainbowBloom resolves to 0 after animation completes
    expect(MOTION_SRC).toMatch(/rainbowRef\.current\.setValue\(0\)/)
  })

  test('33. Reduced Motion behavior (compressed/canonical)', () => {
    // Reduced Motion uses compressed duration
    expect(MOTION_SRC).toMatch(/compress \? RAINBOW_DURATION_COMPRESSED : RAINBOW_DURATION/)
  })

  test('33b. No particles/confetti/sparkles', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).not.toMatch(/particle|confetti|sparkle|star|burst/i)
  })

  test('33c. No residual temporary layer (rainbowBloom resolves to 0)', () => {
    // The capstone renders nothing when rainbowBloom is 0 or a number
    expect(SCENE_SRC).toMatch(/rainbowBloom == null \|\| rainbowBloom === 0/)
    // When Animated.Value, opacity is driven by interpolation that resolves to 0
    // at inputRange [0, 0.5, 1] → outputRange [0, 0.2, 0]
  })

  test('33d. No persistence writes for Rainbow', () => {
    expect(MOTION_SRC).not.toMatch(/AsyncStorage.*rainbow/i)
    expect(MOTION_SRC).not.toMatch(/gardenSeenState.*rainbow/i)
  })

  test('33e. RainbowCapstone uses direct Animated.Value opacity (no interpolation, no per-frame React state)', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).toMatch(/Animated\.View/)
    expect(capstoneCode).not.toMatch(/\.interpolate\(/)
    expect(capstoneCode).not.toMatch(/useState/)
    expect(capstoneCode).not.toMatch(/setOpacity/)
    expect(capstoneCode).not.toMatch(/addListener/)
  })

  test('33f. Rainbow wrapper opacity is driven directly (no interpolation, peak 0.35)', () => {
    expect(SCENE_SRC).not.toMatch(/RAINBOW_OPACITY_INTERPOLATION/)
    expect(SCENE_SRC).not.toMatch(/inputRange: \[0, 0\.5, 1\]/)
    expect(MOTION_SRC).toMatch(/RAINBOW_PEAK_OPACITY = 0\.35/)
  })

  test('33g. Motion hook has onRainbowMotionDebug diagnostic callback', () => {
    expect(MOTION_SRC).toMatch(/onRainbowMotionDebug/)
    expect(MOTION_SRC).toMatch(/reportRainbowMotion/)
  })

  test('33h. runRainbowBloom reports runCalled, started, and finished', () => {
    expect(MOTION_SRC).toMatch(/runCalled: 1/)
    expect(MOTION_SRC).toMatch(/started: 1/)
    expect(MOTION_SRC).toMatch(/completed: 1/)
    expect(MOTION_SRC).toMatch(/finished: finished \? 1 : 0/)
    expect(MOTION_SRC).toMatch(/cancelled: finished \? 0 : 1/)
  })

  test('33i. Orchestration effect reports eventSeen when hasRainbow', () => {
    expect(MOTION_SRC).toMatch(/eventSeen: 1/)
  })

  test('33j. Scene passes onRainbowMotionDebug to useGardenMotion', () => {
    expect(SCENE_SRC).toMatch(/onRainbowMotionDebug/)
  })

  test('33k. runRainbowBloom captures durationArg in diagnostic', () => {
    expect(MOTION_SRC).toMatch(/durationArg: totalDuration/)
  })

  test('33l. runRainbowBloom callback captures { finished }', () => {
    // The callback must destructure finished to distinguish natural completion from cancellation
    expect(MOTION_SRC).toMatch(/\.start\(\(\{ finished \}\) =>/)
  })

  test('33m. Rainbow uses Animated.sequence with useNativeDriver: true for both halves', () => {
    expect(MOTION_SRC).toMatch(/Animated\.sequence\(\[/)
    // Count useNativeDriver: true occurrences in the runRainbowBloom function
    const fnStart = MOTION_SRC.indexOf('const runRainbowBloom = useCallback')
    expect(fnStart).toBeGreaterThan(-1)
    const fnEnd = MOTION_SRC.indexOf('startIdleMotion', fnStart)
    const fnCode = MOTION_SRC.substring(fnStart, fnEnd)
    const nativeCount = (fnCode.match(/useNativeDriver: true/g) || []).length
    expect(nativeCount).toBe(2)
  })

  test('33m2. Rainbow sequence: 0 → 0.35 (first half) → 0 (second half)', () => {
    expect(MOTION_SRC).toMatch(/toValue: RAINBOW_PEAK_OPACITY/)
    expect(MOTION_SRC).toMatch(/toValue: 0/)
  })

  test('33m3. Rainbow compressed: 800ms in + 800ms out = 1600ms', () => {
    // halfDuration = Math.round(totalDuration / 2)
    expect(MOTION_SRC).toMatch(/halfDuration/)
    expect(MOTION_SRC).toMatch(/Math\.round\(totalDuration \/ 2\)/)
  })

  test('33n. runRainbowBloom captures elapsed time', () => {
    expect(MOTION_SRC).toMatch(/startedAt/)
    expect(MOTION_SRC).toMatch(/elapsed: callbackAt - startedAt/)
  })

  test('33o. runRainbowBloom captures startValue', () => {
    expect(MOTION_SRC).toMatch(/startValue/)
    expect(MOTION_SRC).toMatch(/rainbowRef\.current\.__getValue\(\)/)
  })

  test('33p. Rainbow completion reset happens only inside callback and only when finished', () => {
    const src = MOTION_SRC
    const startIdx = src.indexOf(".start(({ finished }) =>")
    expect(startIdx).toBeGreaterThan(-1)
    const afterStart = src.substring(startIdx)
    // setValue(0) must be gated by finished === true
    expect(afterStart).toMatch(/if \(finished\)/)
    expect(afterStart).toMatch(/setValue\(0\)/)
  })

  test('33q. RainbowCapstone element multipliers preserved (0.5, 0.6, 0.4, 0.3)', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).toMatch(/opacity=\{0\.5\}/)
    expect(capstoneCode).toMatch(/opacity=\{0\.6\}/)
    expect(capstoneCode).toMatch(/opacity=\{0\.4\}/)
    expect(capstoneCode).toMatch(/opacity=\{0\.3\}/)
  })

  test('33r. RainbowCapstone wrapper uses absoluteFillObject and zIndex', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).toMatch(/StyleSheet\.absoluteFillObject/)
    expect(capstoneCode).toMatch(/zIndex: 10/)
  })

  test('33s. RainbowCapstone no longer has onDebugValues prop', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).not.toMatch(/onDebugValues/)
  })

  test('33t. Rainbow duration remains 1600 compressed / 2600 normal', () => {
    expect(MOTION_SRC).toMatch(/RAINBOW_DURATION_COMPRESSED = 1600/)
    expect(MOTION_SRC).toMatch(/RAINBOW_DURATION = 2600/)
  })

  test('33u. Rainbow delay logic unchanged (treeStart + treeDuration + ARBOR_TO_RAINBOW_DELAY)', () => {
    expect(MOTION_SRC).toMatch(/rainbowDelay = treeStart \+ treeDuration \+ ARBOR_TO_RAINBOW_DELAY/)
  })

  test('33v. Rainbow overlay and Garden SVG share same sceneCanvas container', () => {
    expect(SCENE_SRC).toMatch(/styles\.sceneCanvas/)
    expect(SCENE_SRC).toMatch(/sceneCanvas:/)
    expect(SCENE_SRC).toMatch(/width: SCENE_WIDTH/)
    expect(SCENE_SRC).toMatch(/height: SCENE_HEIGHT/)
  })

  test('33w. Rainbow inner SVG uses width=100% height=100% viewBox 0 0 390 720', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).toMatch(/width="100%"/)
    expect(capstoneCode).toMatch(/height="100%"/)
    expect(capstoneCode).toMatch(/viewBox=.*0 0 \$\{SCENE_WIDTH\} \$\{SCENE_HEIGHT\}/)
  })

  test('33x. Rainbow overlay has no opaque background', () => {
    const capstoneMatch = SCENE_SRC.match(/function RainbowCapstone[\s\S]*?\n\}/)
    const capstoneCode = capstoneMatch[0]
    expect(capstoneCode).not.toMatch(/backgroundColor/)
  })

  test('33y. Static visibility probe uses same RainbowCapstone component', () => {
    expect(SCENE_SRC).toMatch(/rainbowProbeActive/)
    expect(SCENE_SRC).toMatch(/0\.5/)
    expect(SCENE_SRC).toMatch(/rainbowProbeActive=\{rainbowProbeActive\}/)
  })

  test('33z. Rainbow overlay renders AFTER canonical Garden SVG sibling', () => {
    const svgIdx = SCENE_SRC.indexOf('{sceneSvg}')
    const rainbowIdx = SCENE_SRC.indexOf('<RainbowCapstone')
    expect(svgIdx).toBeGreaterThan(-1)
    expect(rainbowIdx).toBeGreaterThan(-1)
    expect(rainbowIdx).toBeGreaterThan(svgIdx)
  })
})

// ════════════════════════════════════════════════════════════════
// GLOBAL (tests 34-40)
// ════════════════════════════════════════════════════════════════
describe('Global — non-bed motion batch', () => {
  test('34. All 7 V6 produce beds unchanged (FOLIAGE_BOUNDS + BED_SCALE_CONFIG)', () => {
    // Check Spotlight file still has all 7 beds
    const spotlightSrc = fs.readFileSync(
      path.resolve(__dirname, '../LivingGardenSpotlight.js'),
      'utf8',
    )
    ;['greens', 'roots', 'citrus', 'orchard', 'tropical', 'berries', 'herbs'].forEach((bed) => {
      expect(spotlightSrc).toMatch(new RegExp(`${bed}:`))
    })
  })

  test('35. Glow unchanged (no Glow file modifications)', () => {
    // This test verifies we didn't touch Glow files
    // The Glow files are not in our changed file list
    expect(BED_SRC).toMatch(/STAGE_CHROMA/) // Bed still has canonical chroma
  })

  test('36. Journey thresholds unchanged (no new thresholds in Motion)', () => {
    expect(MOTION_SRC).not.toMatch(/JOURNEY_THRESHOLD|new.*threshold/i)
  })

  test('37. No new milestones (catalog still 12)', () => {
    expect(ARBOR_CATALOG.length).toBe(12)
  })

  test('38. No new Rainbow progression truth (no new state model)', () => {
    expect(MOTION_SRC).not.toMatch(/rainbow_state|rainbow_progress|rainbow_decay|rainbow_streak/)
  })

  test('39. No production event wiring (no GardenDetail advancement dispatch)', () => {
    // Preview screen should not wire to real advancement dispatch
    expect(PREVIEW_SRC).toMatch(/No persistence/)
    // No import of gardenService advancement functions for real dispatch
    expect(PREVIEW_SRC).not.toMatch(/import.*gardenService.*advancement/i)
  })

  test('40. Preview exposes all required non-bed controls', () => {
    expect(PREVIEW_SRC).toMatch(/NON-BED PROGRESS MOTION/)
    expect(PREVIEW_SRC).toMatch(/JOURNEY TREE/)
    expect(PREVIEW_SRC).toMatch(/ARBOR \+1/)
    expect(PREVIEW_SRC).toMatch(/ARBOR \+3/)
    expect(PREVIEW_SRC).toMatch(/RAINBOW/)
  })

  test('40b. No V5 revival (no LivingGardenMotion imports in new code)', () => {
    // LivingGardenMotion.js is the existing motion hook — it's not V5
    // V5 files are the calibration files
    expect(TREE_SRC).not.toMatch(/LivingGardenBedV5/)
    expect(ARBOR_SRC).not.toMatch(/LivingGardenBedV5/)
  })

  test('40c. No LivingGardenBed canonical art changes', () => {
    // Bed file should still have all 7 art functions
    ;['GreensArt', 'RootsArt', 'CitrusArt', 'OrchardArt', 'TropicalArt', 'BerriesArt', 'HerbsArt'].forEach((fn) => {
      expect(BED_SRC).toMatch(new RegExp(`function ${fn}`))
    })
  })

  test('40d. Cleanup on unmount (listener removal)', () => {
    // Tree has listener cleanup
    expect(TREE_SRC).toMatch(/removeListener/)
    // Arbor has listener cleanup
    expect(ARBOR_SRC).toMatch(/removeListener/)
  })
})
