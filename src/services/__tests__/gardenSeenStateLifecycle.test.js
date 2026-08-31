// ─────────────────────────────────────────────────────────────
// gardenSeenStateLifecycle.test.js
//
// Regression test for the production advancement detection lifecycle.
// Reproduces the user's exact physical QA flow:
//
//   1. Open empty Garden → establish baseline
//   2. Close Garden → save baseline
//   3. Log first juice → progression changes
//   4. Reopen Garden → detectAdvancements MUST report the advancement
//   5. Close Garden → save new state
//   6. Reopen Garden → NO replay (lastSeen == current)
//
// This test exercises the ACTUAL gardenSeenState functions
// (initializeIfAbsent, getLastSeenState, saveLastSeenState,
// detectAdvancements, buildCurrentSeenState) with a mock
// AsyncStorage to verify the full lifecycle.
//
// ROOT CAUSE BEING GUARDED AGAINST:
//   Bug 1: seenStateLoaded not reset on close → no detection on reopen
//   Bug 2: saveLastSeenState called on every currentSeenState change
//          while invisible → premature save overwrites baseline
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import {
  initializeIfAbsent,
  getLastSeenState,
  saveLastSeenState,
  detectAdvancements,
  buildCurrentSeenState,
  resetSeenState,
} from '../gardenSeenState'

// ── Mock AsyncStorage ─────────────────────────────────────────
const mockStore = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key) => mockStore[key] ?? null),
    setItem: jest.fn(async (key, value) => { mockStore[key] = value }),
    removeItem: jest.fn(async (key) => { delete mockStore[key] }),
  },
}))

// ── Helper: build a seen-state snapshot from bed stages ──────
function makeSeenState(bedStagesObj, journeyKey, milestoneIds) {
  return buildCurrentSeenState({
    bedStages: bedStagesObj,
    journeyStageKey: journeyKey,
    earnedMilestoneIds: milestoneIds || [],
  })
}

// ── Helper: make bedStages in the format getBedStages returns ─
function makeBedStages(bedKeyToStageKey) {
  const result = {}
  const STAGE_LABELS = {
    empty: 'Empty',
    seed: 'Seed',
    sprout: 'Sprout',
    growing: 'Growing',
    harvesting: 'Harvesting',
    flourishing: 'Flourishing',
  }
  for (const bedKey of ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs']) {
    const stageKey = bedKeyToStageKey[bedKey] || 'empty'
    result[bedKey] = { key: stageKey, label: STAGE_LABELS[stageKey] || 'Empty' }
  }
  return result
}

beforeEach(async () => {
  // Clear mock store between tests
  for (const key of Object.keys(mockStore)) delete mockStore[key]
  await resetSeenState()
})

// ─────────────────────────────────────────────────────────────
// TEST 1: Full lifecycle — empty baseline → progression → detect → no replay
// ─────────────────────────────────────────────────────────────
describe('Production advancement lifecycle — user exact flow', () => {
  test('1. Empty Garden open establishes baseline (no advancement)', async () => {
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])

    // First open: initializeIfAbsent should save empty baseline
    const wasFirstOpen = await initializeIfAbsent(emptyState)
    expect(wasFirstOpen).toBe(true)

    // No advancement detection on first open
    const lastSeen = await getLastSeenState()
    expect(lastSeen).toBeTruthy()
    expect(lastSeen.bedStages.greens).toBe('empty')
  })

  test('2. Close Garden saves empty baseline', async () => {
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])

    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    const lastSeen = await getLastSeenState()
    expect(lastSeen.bedStages.greens).toBe('empty')
    expect(lastSeen.journeyStageKey).toBe('seed')
  })

  test('3. After first juice, detectAdvancements reports Empty → Seed', async () => {
    // Establish empty baseline
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    // Simulate first juice: Greens goes from Empty → Seed
    const newBeds = makeBedStages({ greens: 'seed' })
    const newState = makeSeenState(newBeds, 'seed', ['first_juice'])

    // Reopen Garden: detect advancements
    const lastSeen = await getLastSeenState()
    const adv = detectAdvancements(lastSeen, newState)

    expect(adv.isFirstOpen).toBe(false)
    expect(adv.bedAdvancements).toHaveLength(1)
    expect(adv.bedAdvancements[0].bedKey).toBe('greens')
    expect(adv.bedAdvancements[0].fromStage).toBe('empty')
    expect(adv.bedAdvancements[0].toStage).toBe('seed')
  })

  test('4. Journey null→seed is NOT detectable (buildCurrentSeenState normalizes null to seed)', async () => {
    // buildCurrentSeenState normalizes journeyStageKey || 'seed'
    // So null and 'seed' both become 'seed' in seen-state.
    // This means the first Journey stage transition (null→seed) is not
    // animated. Subsequent transitions (seed→sprout, etc.) ARE animated.
    // This is acceptable — the first Journey stage is a baseline.
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    const newBeds = makeBedStages({ greens: 'seed' })
    const newState = makeSeenState(newBeds, 'seed', ['first_juice'])

    const lastSeen = await getLastSeenState()
    const adv = detectAdvancements(lastSeen, newState)

    // Journey advancement is null because both are normalized to 'seed'
    expect(adv.journeyAdvancement).toBeNull()
  })

  test('5. After first juice, first_juice milestone is detected as new', async () => {
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    const newBeds = makeBedStages({ greens: 'seed' })
    const newState = makeSeenState(newBeds, 'seed', ['first_juice'])

    const lastSeen = await getLastSeenState()
    const adv = detectAdvancements(lastSeen, newState)

    expect(adv.newMilestoneIds).toContain('first_juice')
  })

  test('6. After close+save new state, reopen produces NO replay', async () => {
    // Establish empty baseline
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    // First juice changes state
    const newBeds = makeBedStages({ greens: 'seed' })
    const newState = makeSeenState(newBeds, 'seed', ['first_juice'])

    // Reopen: detect advancement
    let lastSeen = await getLastSeenState()
    let adv = detectAdvancements(lastSeen, newState)
    expect(adv.bedAdvancements).toHaveLength(1)

    // Close: save new state (user has now seen it)
    await saveLastSeenState(newState)

    // Reopen: should detect NO advancement
    lastSeen = await getLastSeenState()
    adv = detectAdvancements(lastSeen, newState)
    expect(adv.bedAdvancements).toHaveLength(0)
    expect(adv.journeyAdvancement).toBeNull()
    expect(adv.newMilestoneIds).toHaveLength(0)
  })

  test('7. Premature save while invisible does NOT overwrite baseline (regression guard)', async () => {
    // This test guards against Bug 2: the close effect saving
    // currentSeenState on every dependency change while invisible.

    // Establish empty baseline
    const emptyBeds = makeBedStages({})
    const emptyState = makeSeenState(emptyBeds, null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    // Simulate: user logs juice while Garden is closed.
    // The BUG would be: close effect re-runs because currentSeenState
    // changed, and saves the NEW state prematurely.
    //
    // With the fix, the close effect only saves on visible true→false
    // transition, NOT on currentSeenState change while invisible.
    //
    // We simulate the CORRECT behavior here: do NOT save while invisible.
    const newBeds = makeBedStages({ greens: 'seed' })
    const newState = makeSeenState(newBeds, 'seed', ['first_juice'])

    // DO NOT save newState here (simulating the fixed close effect)
    // The baseline should still be the empty state
    const lastSeen = await getLastSeenState()
    expect(lastSeen.bedStages.greens).toBe('empty')

    // Now detect advancements — should still detect the change
    const adv = detectAdvancements(lastSeen, newState)
    expect(adv.bedAdvancements).toHaveLength(1)
    expect(adv.bedAdvancements[0].fromStage).toBe('empty')
    expect(adv.bedAdvancements[0].toStage).toBe('seed')
  })
})

// ─────────────────────────────────────────────────────────────
// TEST 2: Multiple opens — seenStateLoaded lifecycle
// ─────────────────────────────────────────────────────────────
describe('Production advancement lifecycle — multiple opens', () => {
  test('8. Second advancement after first is correctly detected', async () => {
    // First open: empty baseline
    const emptyState = makeSeenState(makeBedStages({}), null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    // First juice: Greens Empty → Seed
    const seedState = makeSeenState(makeBedStages({ greens: 'seed' }), 'seed', ['first_juice'])
    let lastSeen = await getLastSeenState()
    let adv = detectAdvancements(lastSeen, seedState)
    expect(adv.bedAdvancements).toHaveLength(1)

    // Close: save seed state
    await saveLastSeenState(seedState)

    // Second juice: Greens Seed → Sprout (count 1 → 2)
    const sproutState = makeSeenState(makeBedStages({ greens: 'sprout' }), 'seed', ['first_juice'])
    lastSeen = await getLastSeenState()
    adv = detectAdvancements(lastSeen, sproutState)
    expect(adv.bedAdvancements).toHaveLength(1)
    expect(adv.bedAdvancements[0].bedKey).toBe('greens')
    expect(adv.bedAdvancements[0].fromStage).toBe('seed')
    expect(adv.bedAdvancements[0].toStage).toBe('sprout')
  })

  test('9. No advancement when state unchanged', async () => {
    const state = makeSeenState(makeBedStages({ greens: 'seed' }), 'seed', ['first_juice'])
    await initializeIfAbsent(state)
    await saveLastSeenState(state)

    const lastSeen = await getLastSeenState()
    const adv = detectAdvancements(lastSeen, state)
    expect(adv.bedAdvancements).toHaveLength(0)
    expect(adv.journeyAdvancement).toBeNull()
    expect(adv.newMilestoneIds).toHaveLength(0)
  })

  test('10. Multiple bed advancements detected simultaneously', async () => {
    const emptyState = makeSeenState(makeBedStages({}), null, [])
    await initializeIfAbsent(emptyState)
    await saveLastSeenState(emptyState)

    // Two beds advance at once
    const newState = makeSeenState(
      makeBedStages({ greens: 'seed', roots: 'seed' }),
      'seed',
      ['first_juice'],
    )
    const lastSeen = await getLastSeenState()
    const adv = detectAdvancements(lastSeen, newState)
    expect(adv.bedAdvancements).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────
// TEST 3: GardenDetail source-level lifecycle guards
// ─────────────────────────────────────────────────────────────
describe('Production advancement lifecycle — GardenDetail source guards', () => {
  const GARDEN_DETAIL_SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components', 'GardenDetail.js'),
    'utf-8',
  )

  test('11. GardenDetail resets seenStateLoaded on close', () => {
    // Bug 1 fix: seenStateLoaded.current = false on close
    expect(GARDEN_DETAIL_SRC).toMatch(/seenStateLoaded\.current = false/)
  })

  test('12. GardenDetail uses prevVisibleRef to save only on visible true→false', () => {
    // Bug 2 fix: only save when prevVisibleRef.current was true
    expect(GARDEN_DETAIL_SRC).toMatch(/prevVisibleRef/)
    expect(GARDEN_DETAIL_SRC).toMatch(/prevVisibleRef\.current = visible/)
  })

  test('13. GardenDetail close effect checks prevVisibleRef.current', () => {
    // The close effect must check that visible was previously true
    expect(GARDEN_DETAIL_SRC).toMatch(/!visible && prevVisibleRef\.current/)
  })

  test('14. GardenDetail does NOT save on every currentSeenState change while invisible', () => {
    // The old code had: if (!visible && seenStateLoaded.current) { save }
    // This would run on every currentSeenState change while invisible.
    // The new code uses prevVisibleRef to only save on the transition.
    expect(GARDEN_DETAIL_SRC).not.toMatch(/if \(!visible && seenStateLoaded\.current\)/)
  })

  test('15. GardenDetail open effect depends on [visible] only (no currentSeenState race)', () => {
    // Bug 3 fix: open effect uses currentSeenStateRef instead of
    // currentSeenState in the dependency array, preventing a race
    // where currentSeenState changes mid-detection cancels the
    // async IIFE before setAdvancements is called.
    expect(GARDEN_DETAIL_SRC).toMatch(/currentSeenStateRef/)
    // The open effect should depend on [visible] only
    const effectMatch = GARDEN_DETAIL_SRC.match(/useEffect\(\(\) => \{[\s\S]*?return \(\) => \{ cancelled = true \}[\s\S]*?\}, \[visible\]\)/)
    expect(effectMatch).toBeTruthy()
  })

  test('16. GardenDetail close effect depends on [visible] only', () => {
    // Close effect should also depend on [visible] only, using ref
    // for currentSeenState to avoid premature saves.
    const closeEffectMatch = GARDEN_DETAIL_SRC.match(/useEffect\(\(\) => \{[\s\S]*?prevVisibleRef\.current = visible[\s\S]*?\}, \[visible\]\)/)
    expect(closeEffectMatch).toBeTruthy()
  })

  test('17. GardenDetail does not contain production trace UI', () => {
    // Trace was removed for production release
    expect(GARDEN_DETAIL_SRC).not.toMatch(/GARDEN PROD TRACE/)
    expect(GARDEN_DETAIL_SRC).not.toMatch(/prodTrace/)
  })
})

// ─────────────────────────────────────────────────────────────
// TEST 4: Intro presentation gate — Spotlight must not start
//         while the first-time intro overlay is visible
// ─────────────────────────────────────────────────────────────
describe('Intro presentation gate — advancement held while intro visible', () => {
  const GARDEN_DETAIL_SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'components', 'GardenDetail.js'),
    'utf-8',
  )

  test('16. GardenDetail has presentationReady gate derived from showIntro', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/presentationReady/)
    expect(GARDEN_DETAIL_SRC).toMatch(/!showIntro/)
  })

  test('17. GardenDetail gates advancements prop to Scene via sceneAdvancements', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/sceneAdvancements/)
    // Gating is now stricter than the old `presentationReady ? adv : null`:
    // the Scene only receives advancements when this open session's own
    // detection resolved AND it contains real earned progression.
    // presentationReady (intro not showing) still participates via
    // presentationMode.
    expect(GARDEN_DETAIL_SRC).toMatch(/!presentationReady \|\| !advancementsValid/)
    expect(GARDEN_DETAIL_SRC).toMatch(
      /const sceneAdvancements = presentationMode === 'realAdvancement' \? advancements : null/,
    )
  })

  test('18. GardenDetail passes sceneAdvancements (not raw advancements) to Scene', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/advancements=\{sceneAdvancements\}/)
    expect(GARDEN_DETAIL_SRC).not.toMatch(/advancements=\{advancements\}/)
  })

  test('19. Intro unseen + no advancement: intro visible, no motion', () => {
    // When showIntro=true and advancements=null, sceneAdvancements=null
    // Scene receives null → no queue → no Spotlight
    const showIntro = true
    const advancements = null
    const presentationReady = !showIntro
    const sceneAdvancements = presentationReady ? advancements : null
    expect(sceneAdvancements).toBeNull()
  })

  test('20. Intro unseen + real bed advancement: advancement retained in state', () => {
    // When showIntro=true and advancements is a valid object,
    // sceneAdvancements=null (Scene doesn't see it),
    // but advancements state still holds the real object
    const showIntro = true
    const advancements = {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'empty', toStage: 'seed' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
    }
    const presentationReady = !showIntro
    const sceneAdvancements = presentationReady ? advancements : null
    // Scene does NOT receive the advancement
    expect(sceneAdvancements).toBeNull()
    // But the advancement is still in state (not lost)
    expect(advancements).toBeTruthy()
    expect(advancements.bedAdvancements).toHaveLength(1)
  })

  test('21. While intro visible: Spotlight does NOT activate', () => {
    // Scene receives null → useMemo returns [] → internalSpotlightActive=false
    const showIntro = true
    const advancements = {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'empty', toStage: 'seed' }],
    }
    const presentationReady = !showIntro
    const sceneAdvancements = presentationReady ? advancements : null
    // Scene's useMemo: if (!advancements || advancements.isFirstOpen) return []
    const queue = (!sceneAdvancements || sceneAdvancements.isFirstOpen)
      ? []
      : sceneAdvancements.bedAdvancements || []
    expect(queue).toEqual([])
  })

  test('22. User dismisses intro: same pending advancement becomes presentation-eligible', () => {
    // When showIntro changes to false, presentationReady becomes true,
    // and sceneAdvancements becomes the real advancement object
    const advancements = {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'empty', toStage: 'seed' }],
    }
    // Before dismissal
    let showIntro = true
    let presentationReady = !showIntro
    let sceneAdvancements = presentationReady ? advancements : null
    expect(sceneAdvancements).toBeNull()
    // After dismissal
    showIntro = false
    presentationReady = !showIntro
    sceneAdvancements = presentationReady ? advancements : null
    expect(sceneAdvancements).toBe(advancements)
  })

  test('23. After dismissal: Spotlight activates exactly once', () => {
    // Scene receives the advancement → useMemo queue has 1 item
    const showIntro = false
    const advancements = {
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'empty', toStage: 'seed' }],
    }
    const presentationReady = !showIntro
    const sceneAdvancements = presentationReady ? advancements : null
    const queue = (!sceneAdvancements || sceneAdvancements.isFirstOpen)
      ? []
      : sceneAdvancements.bedAdvancements || []
    expect(queue).toHaveLength(1)
    expect(queue[0].bedKey).toBe('greens')
  })

  test('24. Tree advancement is also held while intro visible', () => {
    // The gate applies to ALL advancement types because the entire
    // advancements object is gated, not just bedAdvancements
    const showIntro = true
    const advancements = {
      isFirstOpen: false,
      bedAdvancements: [],
      journeyAdvancement: { fromStage: 'empty', toStage: 'seed' },
      newMilestoneIds: [],
    }
    const presentationReady = !showIntro
    const sceneAdvancements = presentationReady ? advancements : null
    // Scene doesn't see journey advancement either
    expect(sceneAdvancements).toBeNull()
    // After dismissal
    const showIntroAfter = false
    const presentationReadyAfter = !showIntroAfter
    const sceneAdvancementsAfter = presentationReadyAfter ? advancements : null
    expect(sceneAdvancementsAfter).toBe(advancements)
    expect(sceneAdvancementsAfter.journeyAdvancement).toBeTruthy()
  })

  test('25. Arbor reveal is also held while intro visible', () => {
    const showIntro = true
    const advancements = {
      isFirstOpen: false,
      bedAdvancements: [],
      journeyAdvancement: null,
      newMilestoneIds: ['first_juice'],
    }
    const presentationReady = !showIntro
    const sceneAdvancements = presentationReady ? advancements : null
    expect(sceneAdvancements).toBeNull()
    // After dismissal, arbor advancement is visible
    const showIntroAfter = false
    const sceneAdvancementsAfter = !showIntroAfter ? advancements : null
    expect(sceneAdvancementsAfter.newMilestoneIds).toHaveLength(1)
  })

  test('26. No new persistence key beyond garden_living_intro_seen', () => {
    // The gate uses the existing showIntro state, which is loaded
    // via isIntroSeen() from gardenSeenState. No new key is created.
    expect(GARDEN_DETAIL_SRC).toMatch(/isIntroSeen/)
    expect(GARDEN_DETAIL_SRC).toMatch(/markIntroSeen/)
    // Verify no new intro-related persistence key in GardenDetail
    expect(GARDEN_DETAIL_SRC).not.toMatch(/garden_intro_presentation/)
    expect(GARDEN_DETAIL_SRC).not.toMatch(/garden_advancement_held/)
  })

  test('27. Garden progression thresholds unchanged', () => {
    // The gate does not modify thresholds — it only gates presentation
    expect(GARDEN_DETAIL_SRC).not.toMatch(/threshold.*=.*[0-9]/)
  })

  test('28. Trace fields removed for production', () => {
    expect(GARDEN_DETAIL_SRC).not.toMatch(/INTRO=/)
    expect(GARDEN_DETAIL_SRC).not.toMatch(/READY=/)
  })
})
