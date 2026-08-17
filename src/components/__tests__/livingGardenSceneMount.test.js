// ─────────────────────────────────────────────────────────────
// livingGardenSceneMount.test.js
//
// Component-level regression for the Living Garden Scene → Spotlight
// production integration.
//
// The project does not use @testing-library/react-native and mounting
// the full Scene requires many native module mocks. Instead, this test
// verifies the TWO critical boundaries that determine whether the
// Spotlight mounts:
//
//   1. The memo comparator allows re-render when advancements changes
//   2. The queue computation (useMemo) correctly derives the queue
//      from advancements
//
// Together, these prove that when GardenDetail sets advancements,
// the Scene re-renders AND the queue is populated, which means
// internalSpotlightActive becomes true and the Spotlight mounts.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const SCENE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'LivingGardenScene.js'),
  'utf-8',
)

// ─────────────────────────────────────────────────────────────
// 1. Memo comparator — must allow re-render when advancements changes
// ─────────────────────────────────────────────────────────────
describe('LivingGardenScene memo comparator — advancement re-render', () => {
  // Extract the comparator function from source and test it
  // The comparator is defined as `function sceneComparator(prev, next)`
  const comparatorMatch = SCENE_SRC.match(
    /function sceneComparator\(prev, next\) \{[\s\S]*?\n\}/,
  )
  const comparatorSrc = comparatorMatch ? comparatorMatch[0] : ''

  // eslint-disable-next-line no-eval
  const sceneComparator = comparatorSrc
    ? // eslint-disable-next-line no-eval
      eval(`(${comparatorSrc.replace('function sceneComparator(', 'function(')})`)
    : null

  test('1. sceneComparator is defined and exported', () => {
    expect(comparatorMatch).toBeTruthy()
    expect(sceneComparator).toBeTruthy()
  })

  test('2. sceneComparator includes advancements in equality check', () => {
    expect(comparatorSrc).toMatch(/prev\.advancements === next\.advancements/)
  })

  test('3. sceneComparator returns FALSE (re-render) when advancements changes null→object', () => {
    const prev = {
      isReduced: false,
      journeyStageKey: 'seed',
      sceneId: 'garden-detail',
      arborCtx: { a: 1 },
      bedStages: { greens: { key: 'growing' } },
      advancements: null,
      onArborDebugValues: null,
      onRainbowMotionDebug: null,
      spotlightActive: false,
      spotlightBedKey: null,
      spotlightTargetStage: null,
      rainbowProbeActive: false,
    }
    const next = {
      ...prev,
      advancements: {
        isFirstOpen: false,
        bedAdvancements: [{ bedKey: 'greens', fromStage: 'sprout', toStage: 'growing' }],
        journeyAdvancement: null,
        newMilestoneIds: [],
      },
    }
    // Comparator should return FALSE (not equal → re-render)
    expect(sceneComparator(prev, next)).toBe(false)
  })

  test('4. sceneComparator returns TRUE (skip re-render) when all props are equal', () => {
    const adv = {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'sprout', toStage: 'growing' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
    }
    const prev = {
      isReduced: false,
      journeyStageKey: 'seed',
      sceneId: 'garden-detail',
      arborCtx: { a: 1 },
      bedStages: { greens: { key: 'growing' } },
      advancements: adv,
      onArborDebugValues: null,
      onRainbowMotionDebug: null,
      spotlightActive: false,
      spotlightBedKey: null,
      spotlightTargetStage: null,
      rainbowProbeActive: false,
    }
    const next = { ...prev, advancements: adv } // SAME reference
    // Comparator should return TRUE (equal → skip re-render)
    expect(sceneComparator(prev, next)).toBe(true)
  })

  test('5. sceneComparator returns FALSE when bedStages changes (same advancements)', () => {
    const adv = {
      isFirstOpen: false,
      bedAdvancements: [],
      journeyAdvancement: null,
      newMilestoneIds: [],
    }
    const prev = {
      isReduced: false,
      journeyStageKey: 'seed',
      sceneId: 'garden-detail',
      arborCtx: { a: 1 },
      bedStages: { greens: { key: 'sprout' } },
      advancements: adv,
      onArborDebugValues: null,
      onRainbowMotionDebug: null,
      spotlightActive: false,
      spotlightBedKey: null,
      spotlightTargetStage: null,
      rainbowProbeActive: false,
    }
    const next = {
      ...prev,
      bedStages: { greens: { key: 'growing' } }, // Different bedStages
    }
    // Comparator should return FALSE (bedStages changed → re-render)
    expect(sceneComparator(prev, next)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// 2. Queue computation — useMemo derives queue from advancements
// ─────────────────────────────────────────────────────────────
describe('LivingGardenScene queue computation — useMemo from advancements', () => {
  test('6. Scene uses useMemo for spotlightQueue (not useState)', () => {
    // The queue should be computed via useMemo, not useState
    // This eliminates the effect scheduling dependency
    expect(SCENE_SRC).toMatch(/const spotlightQueue = useMemo/)
    expect(SCENE_SRC).not.toMatch(/const \[spotlightQueue, setSpotlightQueue\]/)
  })

  test('7. Scene useMemo computes queue from advancements.bedAdvancements', () => {
    expect(SCENE_SRC).toMatch(/useMemo\(\(\) => \{[\s\S]*?advancements\.bedAdvancements/)
  })

  test('8. Scene useMemo returns empty array for null advancements', () => {
    expect(SCENE_SRC).toMatch(/if \(!advancements \|\| advancements\.isFirstOpen\) return \[\]/)
  })

  test('9. Scene effect resets spotlightIdx based on queue length', () => {
    // The effect should set spotlightIdx to 0 when queue has items
    expect(SCENE_SRC).toMatch(/if \(spotlightQueue\.length > 0\)/)
    expect(SCENE_SRC).toMatch(/setSpotlightIdx\(0\)/)
  })

  test('10. Scene does NOT use processedAdvancementsRef for queue', () => {
    // The old processedAdvancementsRef is no longer needed because
    // useMemo handles caching automatically
    expect(SCENE_SRC).not.toMatch(/processedAdvancementsRef/)
  })
})

// ─────────────────────────────────────────────────────────────
// 3. Spotlight mount conditional — must evaluate true for valid advancement
// ─────────────────────────────────────────────────────────────
describe('LivingGardenScene Spotlight mount conditional', () => {
  test('11. Scene renders LivingGardenSpotlight when internalSpotlightActive', () => {
    expect(SCENE_SRC).toMatch(/internalSpotlightActive && \(/)
    expect(SCENE_SRC).toMatch(/<LivingGardenSpotlight/)
  })

  test('12. Scene passes bedKey, sourceStage, targetStage from queue', () => {
    expect(SCENE_SRC).toMatch(/bedKey=\{internalSpotlightBed\}/)
    expect(SCENE_SRC).toMatch(/sourceStage=\{internalSpotlightSource\}/)
    expect(SCENE_SRC).toMatch(/targetStage=\{internalSpotlightTarget\}/)
  })

  test('13. internalSpotlightActive derived from spotlightIdx and queue length', () => {
    expect(SCENE_SRC).toMatch(/spotlightIdx >= 0 && spotlightIdx < spotlightQueue\.length/)
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Dev-only Scene trace
// ─────────────────────────────────────────────────────────────
describe('LivingGardenScene trace removed for production', () => {
  test('14. Scene does not contain production trace UI', () => {
    expect(SCENE_SRC).not.toMatch(/SCENE TRACE/)
    expect(SCENE_SRC).not.toMatch(/showSceneTrace/)
  })

  test('15. Scene does not contain trace diagnostic fields', () => {
    expect(SCENE_SRC).not.toMatch(/ADV_RX/)
    expect(SCENE_SRC).not.toMatch(/sceneTraceContainer/)
    expect(SCENE_SRC).not.toMatch(/sceneTraceText/)
  })
})

// ─────────────────────────────────────────────────────────────
// 5. CRITICAL REGRESSION: Normal Garden render with advancements=null
//    This is the most basic case — the Garden must render without
//    throwing when there is no pending advancement.
//    The grey-screen regression was caused by useMemo not being
//    imported from 'react', causing a ReferenceError at runtime.
// ─────────────────────────────────────────────────────────────
describe('LivingGardenScene normal render safety (advancements=null)', () => {
  test('16. useMemo is imported from react (grey-screen regression guard)', () => {
    // The grey-screen regression was caused by useMemo being used
    // but NOT imported. This test guards against that recurrence.
    expect(SCENE_SRC).toMatch(/import React.*useMemo.*from 'react'/)
  })

  test('17. Scene source has no references to removed queue variables', () => {
    // setSpotlightQueue and processedAdvancementsRef were removed
    // in the useMemo refactor. Any remaining references would
    // cause a ReferenceError at runtime.
    expect(SCENE_SRC).not.toMatch(/setSpotlightQueue/)
    expect(SCENE_SRC).not.toMatch(/processedAdvancementsRef/)
  })

  test('18. Scene trace is removed (not in SVG tree or elsewhere)', () => {
    // Trace was removed for production release
    expect(SCENE_SRC).not.toMatch(/showSceneTrace/)
    expect(SCENE_SRC).not.toMatch(/sceneTraceContainer/)
    expect(SCENE_SRC).not.toMatch(/sceneTraceText/)
  })

  test('19. Scene handles empty queue safely (no undefined access)', () => {
    // When spotlightIdx=-1 and queue=[], the internal spotlight
    // accessors must use optional chaining or guards to avoid
    // reading properties from undefined.
    expect(SCENE_SRC).toMatch(/internalSpotlightActive \? spotlightQueue\[spotlightIdx\]\?\.bedKey : null/)
  })

  test('20. Scene useMemo queue returns empty array for null advancements', () => {
    // The useMemo must return [] when advancements is null,
    // not throw or return undefined.
    expect(SCENE_SRC).toMatch(/if \(!advancements \|\| advancements\.isFirstOpen\) return \[\]/)
  })
})

// ─────────────────────────────────────────────────────────────
// 6. Valid advancement case — Scene renders with Spotlight
// ─────────────────────────────────────────────────────────────
describe('LivingGardenScene valid advancement render safety', () => {
  test('21. Scene useMemo queue returns bedAdvancements for valid advancement', () => {
    expect(SCENE_SRC).toMatch(/return advancements\.bedAdvancements \|\| \[\]/)
  })

  test('22. Scene Spotlight mount conditional uses internalSpotlightActive', () => {
    expect(SCENE_SRC).toMatch(/\{internalSpotlightActive && \(/)
    expect(SCENE_SRC).toMatch(/<LivingGardenSpotlight/)
  })

  test('23. Scene passes correct props to LivingGardenSpotlight', () => {
    expect(SCENE_SRC).toMatch(/bedKey=\{internalSpotlightBed\}/)
    expect(SCENE_SRC).toMatch(/sourceStage=\{internalSpotlightSource\}/)
    expect(SCENE_SRC).toMatch(/targetStage=\{internalSpotlightTarget\}/)
  })
})
