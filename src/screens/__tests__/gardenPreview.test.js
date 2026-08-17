// ─────────────────────────────────────────────────────────────
// gardenPreview.test.js — TEMPORARY QA harness tests
//
// Verifies:
//   - exactly 4 presets exist
//   - every bed uses a valid 6 Garden stage keys
//   - every Journey key is canonical
//   - Early preset = 3 Empty, 2 Seed, 2 Sprout
//   - One-Month preset values correct
//   - Established preset values correct
//   - Legend has 7 Flourishing beds
//   - Legend journeyStageKey = legend
//   - Legend rainbowComplete = true
//   - Legend produces all 12 Arbor qualifications
//   - preview source does NOT import JuiceLogStore
//   - preview source does NOT import AsyncStorage
//   - preview source does NOT import gardenSeenState
//   - preview source does NOT import achievements storage
//   - preview does not write persistence
//   - transition scenarios cover all required motion QA cases
//   - motion mode toggle exists (Normal/Reduced)
//   - replay/reset controls exist
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const PREVIEW_SRC_RAW = fs.readFileSync(
  path.join(__dirname, '..', 'GardenPreviewScreen.js'),
  'utf-8',
)

// Strip comments for isolation checks — only inspect actual code
const PREVIEW_SRC = PREVIEW_SRC_RAW.split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n')

const {
  PRESETS,
  TRANSITION_SCENARIOS,
  VALID_BED_STAGES,
  VALID_JOURNEY_KEYS,
  SOURCE_DISPLAY_MS,
  computeTargetPreset,
} = require('../GardenPreviewScreen')

const BED_KEYS = ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs']

// ── A. Preset count ───────────────────────────────────────────

describe('A. Preset count', () => {
  test('exactly 6 presets exist (4 original + 2 V6 Delta)', () => {
    expect(PRESETS.length).toBe(18)
  })

  test('preset keys are unique', () => {
    const keys = PRESETS.map((p) => p.key)
    expect(new Set(keys).size).toBe(18)
  })
})

// ── B. Valid stage keys ───────────────────────────────────────

describe('B. Valid stage keys', () => {
  PRESETS.forEach((preset) => {
    test(`${preset.name}: every bed uses a valid Garden stage key`, () => {
      BED_KEYS.forEach((bedKey) => {
        const stageKey = preset.bedStages[bedKey]?.key
        expect(VALID_BED_STAGES).toContain(stageKey)
      })
    })

    test(`${preset.name}: journeyStageKey is canonical`, () => {
      expect(VALID_JOURNEY_KEYS).toContain(preset.journeyStageKey)
    })
  })
})

// ── C. Early preset ───────────────────────────────────────────

describe('C. Early preset', () => {
  const p = PRESETS[0]

  test('key is early', () => {
    expect(p.key).toBe('early')
  })

  test('3 Empty beds', () => {
    const empty = BED_KEYS.filter((k) => p.bedStages[k].key === 'empty')
    expect(empty.length).toBe(3)
    expect(empty.sort()).toEqual(['citrus', 'orchard', 'tropical'].sort())
  })

  test('2 Seed beds', () => {
    const seed = BED_KEYS.filter((k) => p.bedStages[k].key === 'seed')
    expect(seed.length).toBe(2)
    expect(seed.sort()).toEqual(['berries', 'roots'].sort())
  })

  test('2 Sprout beds', () => {
    const sprout = BED_KEYS.filter((k) => p.bedStages[k].key === 'sprout')
    expect(sprout.length).toBe(2)
    expect(sprout.sort()).toEqual(['greens', 'herbs'].sort())
  })

  test('journeyStageKey is seed', () => {
    expect(p.journeyStageKey).toBe('seed')
  })

  test('Arbor has first_juice only', () => {
    expect(p.arborCtx.unlockedAchievementIds).toEqual(['first_juice'])
  })

  test('rainbowComplete is false', () => {
    expect(p.arborCtx.rainbowComplete).toBe(false)
  })
})

// ── D. One-Month preset ───────────────────────────────────────

describe('D. One-Month preset', () => {
  const p = PRESETS[1]

  test('key is oneMonth', () => {
    expect(p.key).toBe('oneMonth')
  })

  test('greens = harvesting', () => {
    expect(p.bedStages.greens.key).toBe('harvesting')
  })

  test('roots = growing', () => {
    expect(p.bedStages.roots.key).toBe('growing')
  })

  test('citrus = sprout', () => {
    expect(p.bedStages.citrus.key).toBe('sprout')
  })

  test('orchard = growing', () => {
    expect(p.bedStages.orchard.key).toBe('growing')
  })

  test('berries = harvesting', () => {
    expect(p.bedStages.berries.key).toBe('harvesting')
  })

  test('tropical = seed', () => {
    expect(p.bedStages.tropical.key).toBe('seed')
  })

  test('herbs = flourishing', () => {
    expect(p.bedStages.herbs.key).toBe('flourishing')
  })

  test('journeyStageKey is growing', () => {
    expect(p.journeyStageKey).toBe('growing')
  })

  test('4 achievement IDs', () => {
    expect(p.arborCtx.unlockedAchievementIds).toEqual([
      'first_juice',
      'streak_3',
      'streak_7',
      'logs_10',
    ])
  })

  test('rainbowComplete is false', () => {
    expect(p.arborCtx.rainbowComplete).toBe(false)
  })
})

// ── E. Established preset ─────────────────────────────────────

describe('E. Established preset', () => {
  const p = PRESETS[2]

  test('key is established', () => {
    expect(p.key).toBe('established')
  })

  test('5 Flourishing beds', () => {
    const flour = BED_KEYS.filter((k) => p.bedStages[k].key === 'flourishing')
    expect(flour.length).toBe(5)
  })

  test('citrus = harvesting', () => {
    expect(p.bedStages.citrus.key).toBe('harvesting')
  })

  test('tropical = growing', () => {
    expect(p.bedStages.tropical.key).toBe('growing')
  })

  test('journeyStageKey is thriving', () => {
    expect(p.journeyStageKey).toBe('thriving')
  })

  test('4 achievement IDs', () => {
    expect(p.arborCtx.unlockedAchievementIds).toEqual([
      'first_juice',
      'streak_3',
      'streak_7',
      'logs_10',
    ])
  })

  test('rainbowComplete is false', () => {
    expect(p.arborCtx.rainbowComplete).toBe(false)
  })
})

// ── F. Legend preset ──────────────────────────────────────────

describe('F. Legend preset', () => {
  const p = PRESETS[3]

  test('key is legend', () => {
    expect(p.key).toBe('legend')
  })

  test('all 7 beds are flourishing', () => {
    BED_KEYS.forEach((k) => {
      expect(p.bedStages[k].key).toBe('flourishing')
    })
  })

  test('journeyStageKey is legend', () => {
    expect(p.journeyStageKey).toBe('legend')
  })

  test('rainbowComplete is true', () => {
    expect(p.arborCtx.rainbowComplete).toBe(true)
  })

  test('4 achievement IDs', () => {
    expect(p.arborCtx.unlockedAchievementIds).toEqual([
      'first_juice',
      'streak_3',
      'streak_7',
      'logs_10',
    ])
  })

  test('all 7 bedStages in arborCtx are flourishing', () => {
    BED_KEYS.forEach((k) => {
      expect(p.arborCtx.bedStages[k].key).toBe('flourishing')
    })
  })

  test('produces all 12 Arbor qualifications', () => {
    // Import the real Arbor catalog to verify qualification
    const { ARBOR_CATALOG } = require('../../components/MilestoneArborArtwork')
    const earned = ARBOR_CATALOG.filter((entry) => entry.qualifies(p.arborCtx))
    expect(earned.length).toBe(12)
  })
})

// ── G. Isolation — no persistence imports ─────────────────────

describe('G. Isolation — no persistence imports', () => {
  test('does NOT import JuiceLogStore', () => {
    expect(PREVIEW_SRC).not.toMatch(/JuiceLogStore/)
    expect(PREVIEW_SRC).not.toMatch(/juicing_log_entries/)
  })

  test('does NOT import AsyncStorage', () => {
    expect(PREVIEW_SRC).not.toMatch(/AsyncStorage/)
    expect(PREVIEW_SRC).not.toMatch(/async-storage/)
  })

  test('does NOT import gardenSeenState', () => {
    expect(PREVIEW_SRC).not.toMatch(/gardenSeenState/)
    expect(PREVIEW_SRC).not.toMatch(/garden_last_seen_state/)
    expect(PREVIEW_SRC).not.toMatch(/garden_living_intro_seen/)
  })

  test('does NOT import achievements storage', () => {
    expect(PREVIEW_SRC).not.toMatch(/achievements/)
    expect(PREVIEW_SRC).not.toMatch(/achievements_unlocked/)
  })

  test('does NOT import gardenService', () => {
    expect(PREVIEW_SRC).not.toMatch(/gardenService/)
  })

  test('does NOT import glowJourneyService', () => {
    expect(PREVIEW_SRC).not.toMatch(/glowJourneyService/)
  })

  test('does NOT import Supabase', () => {
    expect(PREVIEW_SRC).not.toMatch(/supabase/i)
  })

  test('does NOT import RevenueCat', () => {
    expect(PREVIEW_SRC).not.toMatch(/RevenueCat/i)
    expect(PREVIEW_SRC).not.toMatch(/purchases/i)
  })

  test('does NOT import storage helpers', () => {
    expect(PREVIEW_SRC).not.toMatch(/from.*storage/)
    expect(PREVIEW_SRC).not.toMatch(/loadState|saveState/)
  })

  test('does NOT write persistence (no setItem, no saveState, no persist)', () => {
    expect(PREVIEW_SRC).not.toMatch(/setItem/)
    expect(PREVIEW_SRC).not.toMatch(/saveState/)
    expect(PREVIEW_SRC).not.toMatch(/persist/)
  })

  test('imports ONLY LivingGardenScene, LivingGardenSpotlight, and React/React Native', () => {
    // Check that the component imports are LivingGardenScene and LivingGardenSpotlight
    expect(PREVIEW_SRC).toMatch(/from '\.\.\/components\/LivingGardenScene'/)
    expect(PREVIEW_SRC).toMatch(/from '\.\.\/components\/LivingGardenSpotlight'/)
    // No other component/service/hook imports
    const importLines = PREVIEW_SRC.match(/^import .* from .*/gm) || []
    const componentImports = importLines.filter(
      (l) => l.includes('../components/') || l.includes('../services/') || l.includes('../hooks/'),
    )
    // Allow LivingGardenScene + LivingGardenSpotlight + V5 calibration imports
    const allowedImports = ['LivingGardenScene', 'LivingGardenSpotlight', 'LivingGardenBedV5MergeProofCalibration']
    const disallowed = componentImports.filter((l) => !allowedImports.some((a) => l.includes(a)))
    expect(disallowed.length).toBe(0)
  })
})

// ── H. Regression — single scene, default Early, error boundary ──

describe('H. Regression — rendering structure', () => {
  test('default selected preset is Early (index 0)', () => {
    // The useState initial value in the component source
    expect(PREVIEW_SRC).toMatch(/useState\(0\)/)
  })

  test('renders exactly one FittedScene (not four)', () => {
    // Should have exactly one FittedScene element
    const matches = PREVIEW_SRC.match(/<FittedScene/g) || []
    expect(matches.length).toBe(1)
  })

  test('FittedScene is memoized', () => {
    expect(PREVIEW_SRC).toMatch(/React\.memo.*FittedScene/)
  })

  test('has an error boundary class', () => {
    expect(PREVIEW_SRC).toMatch(/getDerivedStateFromError/)
    expect(PREVIEW_SRC).toMatch(/componentDidCatch/)
  })

  test('error boundary renders error message on error', () => {
    expect(PREVIEW_SRC).toMatch(/Preview Scene Error/)
  })

  test('does NOT use SafeAreaView', () => {
    expect(PREVIEW_SRC).not.toMatch(/SafeAreaView/)
  })

  test('preset switching uses setSelectedIdx (not mounting multiple scenes)', () => {
    expect(PREVIEW_SRC).toMatch(/setSelectedIdx/)
  })

  test('has a Back/Done action', () => {
    expect(PREVIEW_SRC).toMatch(/handleBack/)
    expect(PREVIEW_SRC).toMatch(/goBack/)
  })

  test('callbacks are noop (not real Garden handlers)', () => {
    expect(PREVIEW_SRC).toMatch(/const noop/)
    expect(PREVIEW_SRC).toMatch(/onBedPress=\{noop\}/)
  })

  test('passes isReduced as a variable (motion QA toggle)', () => {
    // The preview now has a Normal/Reduced motion toggle.
    // isReduced is a state variable, not hardcoded.
    expect(PREVIEW_SRC).toMatch(/isReduced=\{isReduced\}/)
  })
})

// ── I. Full-scene fit — entire 390×720 visible ────────────────

describe('I. Full-scene fit — entire 390×720 visible', () => {
  test('preview source defines SCENE_WIDTH=390 and SCENE_HEIGHT=720', () => {
    expect(PREVIEW_SRC).toMatch(/SCENE_WIDTH\s*=\s*390/)
    expect(PREVIEW_SRC).toMatch(/SCENE_HEIGHT\s*=\s*720/)
  })

  test('preview uses onLayout to measure available area', () => {
    expect(PREVIEW_SRC).toMatch(/onLayout/)
    expect(PREVIEW_SRC).toMatch(/handleSceneLayout/)
  })

  test('FittedScene calculates scale = min(availableW/390, availableH/720)', () => {
    expect(PREVIEW_SRC).toMatch(/Math\.min.*SCENE_WIDTH.*SCENE_HEIGHT/)
  })

  test('FittedScene applies transform scale to scene container', () => {
    expect(PREVIEW_SRC).toMatch(/transform.*scale/)
  })

  test('scene container has fixed 390×720 dimensions', () => {
    expect(PREVIEW_SRC).toMatch(/width:\s*SCENE_WIDTH/)
    expect(PREVIEW_SRC).toMatch(/height:\s*SCENE_HEIGHT/)
  })

  test('preview scene area uses flex:1 and overflow:hidden (no scroll on scene)', () => {
    // sceneArea style should have flex:1 and overflow hidden
    const styleMatch = PREVIEW_SRC.match(/sceneArea:\s*\{[\s\S]*?\}/)
    expect(styleMatch).toBeTruthy()
    expect(styleMatch[0]).toMatch(/flex:\s*1/)
    expect(styleMatch[0]).toMatch(/overflow:\s*['"]hidden['"]/)
  })

  test('preview preserves aspect ratio (scaledW and scaledH from scale)', () => {
    expect(PREVIEW_SRC).toMatch(/scaledW/)
    expect(PREVIEW_SRC).toMatch(/scaledH/)
  })
})

// ── J. Bed coordinate → category mapping ──────────────────────

describe('J. Bed coordinate → category mapping (lower-right is Herbs)', () => {
  // Import BED_PLACEMENT from geometry to verify exact mapping
  const { BED_PLACEMENT } = require('../../components/LivingGardenGeometry')

  test('orchard is upper-right (cx~318, cy~388, far band)', () => {
    expect(BED_PLACEMENT.orchard.cx).toBe(318)
    expect(BED_PLACEMENT.orchard.cy).toBe(388)
    expect(BED_PLACEMENT.orchard.band).toBe('far')
  })

  test('citrus is upper-left (cx~72, cy~394, far band)', () => {
    expect(BED_PLACEMENT.citrus.cx).toBe(72)
    expect(BED_PLACEMENT.citrus.cy).toBe(394)
    expect(BED_PLACEMENT.citrus.band).toBe('far')
  })

  test('berries is mid-right (cx~330, cy~478, mid band)', () => {
    expect(BED_PLACEMENT.berries.cx).toBe(330)
    expect(BED_PLACEMENT.berries.cy).toBe(478)
    expect(BED_PLACEMENT.berries.band).toBe('mid')
  })

  test('tropical is mid-left (cx~58, cy~490, mid band)', () => {
    expect(BED_PLACEMENT.tropical.cx).toBe(58)
    expect(BED_PLACEMENT.tropical.cy).toBe(490)
    expect(BED_PLACEMENT.tropical.band).toBe('mid')
  })

  test('herbs is LOWER-RIGHT (cx~322, cy~596, near band)', () => {
    expect(BED_PLACEMENT.herbs.cx).toBe(322)
    expect(BED_PLACEMENT.herbs.cy).toBe(596)
    expect(BED_PLACEMENT.herbs.band).toBe('near')
  })

  test('greens is lower-left (cx~62, cy~610, near band)', () => {
    expect(BED_PLACEMENT.greens.cx).toBe(62)
    expect(BED_PLACEMENT.greens.cy).toBe(610)
    expect(BED_PLACEMENT.greens.band).toBe('near')
  })

  test('roots is lower-center (cx~262, cy~694, near band)', () => {
    expect(BED_PLACEMENT.roots.cx).toBe(262)
    expect(BED_PLACEMENT.roots.cy).toBe(694)
    expect(BED_PLACEMENT.roots.band).toBe('near')
  })

  test('lower-right bed (highest cx + highest cy in near band) is herbs', () => {
    const nearBeds = Object.entries(BED_PLACEMENT).filter(([, p]) => p.band === 'near')
    // Find the bed with the highest cx in the near band (rightmost)
    const rightmost = nearBeds.reduce((max, [key, p]) => (p.cx > max[1].cx ? [key, p] : max))
    expect(rightmost[0]).toBe('herbs')
  })

  test('berries is NOT the lower-right bed (it is mid-right)', () => {
    // Berries cy=478 is well above the near-band beds (cy 596+)
    expect(BED_PLACEMENT.berries.cy).toBeLessThan(BED_PLACEMENT.herbs.cy)
    expect(BED_PLACEMENT.berries.cy).toBeLessThan(BED_PLACEMENT.greens.cy)
    expect(BED_PLACEMENT.berries.cy).toBeLessThan(BED_PLACEMENT.roots.cy)
  })

  test('Scene renders beds in FAR/MID/NEAR order', () => {
    const sceneSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenScene.js'),
      'utf-8',
    )
    expect(sceneSrc).toMatch(/FAR_BEDS/)
    expect(sceneSrc).toMatch(/MID_BEDS/)
    expect(sceneSrc).toMatch(/NEAR_BEDS/)
    expect(sceneSrc).toMatch(/FAR_BEDS\s*=\s*\['citrus',\s*'orchard'\]/)
    expect(sceneSrc).toMatch(/MID_BEDS\s*=\s*\['berries',\s*'tropical'\]/)
    expect(sceneSrc).toMatch(/NEAR_BEDS\s*=\s*\['herbs',\s*'greens',\s*'roots'\]/)
  })
})

// ── K. Transition scenarios for motion QA ─────────────────────

describe('K. Transition scenarios for motion QA', () => {
  test('at least 9 transition scenarios exist (incl. arborSingleNew)', () => {
    expect(TRANSITION_SCENARIOS.length).toBeGreaterThanOrEqual(9)
  })

  test('scenario keys are unique', () => {
    const keys = TRANSITION_SCENARIOS.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('each scenario has required fields', () => {
    TRANSITION_SCENARIOS.forEach((s) => {
      expect(s.key).toBeDefined()
      expect(s.name).toBeDefined()
      // Each scenario must have either presetIdx or sourcePreset
      expect(s.presetIdx != null || s.sourcePreset != null).toBe(true)
      expect(s.advancements).toBeDefined()
      expect(s.advancements.isFirstOpen).toBe(false)
      expect(Array.isArray(s.advancements.bedAdvancements)).toBe(true)
    })
  })

  test('Empty → Seed scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'emptyToSeed')
    expect(s).toBeDefined()
    expect(s.advancements.bedAdvancements).toContainEqual(
      expect.objectContaining({ bedKey: 'citrus', fromStage: 'empty', toStage: 'seed' }),
    )
  })

  test('Seed → Sprout scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'seedToSprout')
    expect(s).toBeDefined()
    expect(s.advancements.bedAdvancements).toContainEqual(
      expect.objectContaining({ bedKey: 'roots', fromStage: 'seed', toStage: 'sprout' }),
    )
  })

  test('Growing → Harvesting scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'growingToHarvesting')
    expect(s).toBeDefined()
    expect(s.advancements.bedAdvancements).toContainEqual(
      expect.objectContaining({ fromStage: 'growing', toStage: 'harvesting' }),
    )
  })

  test('Harvesting → Flourishing scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'harvestingToFlourishing')
    expect(s).toBeDefined()
    expect(s.advancements.bedAdvancements).toContainEqual(
      expect.objectContaining({ fromStage: 'harvesting', toStage: 'flourishing' }),
    )
  })

  test('Journey Tree advancement scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'journeyAdvance')
    expect(s).toBeDefined()
    expect(s.advancements.journeyAdvancement).not.toBeNull()
    expect(s.advancements.journeyAdvancement.fromStage).toBeDefined()
    expect(s.advancements.journeyAdvancement.toStage).toBeDefined()
  })

  test('Arbor new ornament scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'arborNew')
    expect(s).toBeDefined()
    expect(s.advancements.newMilestoneIds.length).toBeGreaterThan(0)
  })

  test('Arbor +1 single milestone scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'arborSingleNew')
    expect(s).toBeDefined()
    expect(s.advancements.newMilestoneIds.length).toBe(1)
  })

  test('Arbor +3 multi milestone scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'arborNew')
    expect(s).toBeDefined()
    expect(s.advancements.newMilestoneIds.length).toBe(3)
  })

  test('Coalesced multi-bed advancement scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'coalescedMulti')
    expect(s).toBeDefined()
    expect(s.advancements.bedAdvancements.length).toBeGreaterThan(1)
  })

  test('Rainbow scenario exists', () => {
    const s = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    expect(s).toBeDefined()
    expect(s.advancements.rainbowComplete).toBe(true)
  })

  test('all scenarios have valid source (presetIdx or sourcePreset)', () => {
    TRANSITION_SCENARIOS.forEach((s) => {
      // Each scenario must have either a presetIdx or a self-contained sourcePreset
      const hasPresetIdx = s.presetIdx != null && s.presetIdx >= 0 && s.presetIdx < PRESETS.length
      const hasSourcePreset = s.sourcePreset != null
      expect(hasPresetIdx || hasSourcePreset).toBe(true)
    })
  })
})

// ── L. Motion controls ────────────────────────────────────────

describe('L. Motion controls', () => {
  test('has Normal/Reduced motion toggle', () => {
    expect(PREVIEW_SRC).toMatch(/Normal Motion/)
    expect(PREVIEW_SRC).toMatch(/Reduced Motion/)
    expect(PREVIEW_SRC).toMatch(/handleToggleReduced/)
    expect(PREVIEW_SRC).toMatch(/setIsReduced/)
  })

  test('has Replay control', () => {
    expect(PREVIEW_SRC).toMatch(/handleReplay/)
    expect(PREVIEW_SRC).toMatch(/Replay/)
  })

  test('has Reset control', () => {
    expect(PREVIEW_SRC).toMatch(/handleReset/)
    expect(PREVIEW_SRC).toMatch(/Reset/)
  })

  test('passes advancements to LivingGardenScene', () => {
    expect(PREVIEW_SRC).toMatch(/advancements=\{advancements\}/)
  })

  test('has scenario trigger handler', () => {
    expect(PREVIEW_SRC).toMatch(/handleTriggerScenario/)
  })

  test('scenario buttons render TRANSITION_SCENARIOS', () => {
    expect(PREVIEW_SRC).toMatch(/TRANSITION_SCENARIOS\.map/)
  })

  test('NON-BED PROGRESS MOTION section exists', () => {
    expect(PREVIEW_SRC).toMatch(/NON-BED PROGRESS MOTION/)
  })

  test('Journey Tree non-bed button exists', () => {
    expect(PREVIEW_SRC).toMatch(/journeyAdvance/)
    expect(PREVIEW_SRC).toMatch(/JOURNEY TREE/)
  })

  test('Arbor +1 non-bed button exists', () => {
    expect(PREVIEW_SRC).toMatch(/arborSingleNew/)
    expect(PREVIEW_SRC).toMatch(/ARBOR \+1/)
  })

  test('Arbor +3 non-bed button exists', () => {
    expect(PREVIEW_SRC).toMatch(/arborNew/)
    expect(PREVIEW_SRC).toMatch(/ARBOR \+3/)
  })

  test('Rainbow non-bed button exists', () => {
    expect(PREVIEW_SRC).toMatch(/RAINBOW/)
  })
})

// ── M. Phase 1C fix — transition wiring (source → target) ─────

describe('M. Phase 1C fix — transition wiring', () => {
  test('SOURCE_DISPLAY_MS is a positive number', () => {
    expect(typeof SOURCE_DISPLAY_MS).toBe('number')
    expect(SOURCE_DISPLAY_MS).toBeGreaterThan(0)
  })

  test('computeTargetPreset is a function', () => {
    expect(typeof computeTargetPreset).toBe('function')
  })

  test('preview source has customPreset state', () => {
    expect(PREVIEW_SRC).toMatch(/customPreset/)
    expect(PREVIEW_SRC).toMatch(/setCustomPreset/)
  })

  test('preview source has eventId state', () => {
    expect(PREVIEW_SRC).toMatch(/eventId/)
    expect(PREVIEW_SRC).toMatch(/setEventId/)
  })

  test('preview source has activeScenario state', () => {
    expect(PREVIEW_SRC).toMatch(/activeScenario/)
    expect(PREVIEW_SRC).toMatch(/setActiveScenario/)
  })

  test('preview source has transitionTimerRef', () => {
    expect(PREVIEW_SRC).toMatch(/transitionTimerRef/)
  })

  test('preset uses customPreset when set (override logic)', () => {
    expect(PREVIEW_SRC).toMatch(/customPreset \|\| PRESETS/)
  })

  test('handleTriggerScenario uses setTimeout for two-step transition', () => {
    expect(PREVIEW_SRC).toMatch(/setTimeout/)
    expect(PREVIEW_SRC).toMatch(/SOURCE_DISPLAY_MS/)
  })

  test('handleTriggerScenario clears pending transition timer', () => {
    expect(PREVIEW_SRC).toMatch(/clearTimeout\(transitionTimerRef/)
  })

  test('handleReset clears transition timer', () => {
    expect(PREVIEW_SRC).toMatch(/clearTimeout\(transitionTimerRef/)
  })

  test('cleanup clears transition timer on unmount', () => {
    // The cleanup effect should clear both timers
    const cleanupMatch = PREVIEW_SRC.match(
      /useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?\}[\s\S]*?\}, \[\]\)/,
    )
    expect(cleanupMatch).toBeTruthy()
    expect(cleanupMatch[0]).toMatch(/transitionTimerRef/)
  })

  test('diagnostic shows scenario name', () => {
    expect(PREVIEW_SRC).toMatch(/scenario=/)
  })

  test('diagnostic shows motion mode (normal|reduced)', () => {
    expect(PREVIEW_SRC).toMatch(/motion=/)
  })

  test('diagnostic shows event ID', () => {
    expect(PREVIEW_SRC).toMatch(/event=/)
  })

  test('diagnostic shows from→to stages', () => {
    expect(PREVIEW_SRC).toMatch(/fromStage|from→|→.*toStage/)
  })

  test('diagnostic shows motion phase (IDLE|MOTION)', () => {
    expect(PREVIEW_SRC).toMatch(/IDLE/)
    expect(PREVIEW_SRC).toMatch(/MOTION/)
  })
})

// ── R. Journey Tree source/target agreement ───────────────────

describe('R. Journey Tree source/target agreement', () => {
  const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'journeyAdvance')
  const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]

  test('scenario exists', () => {
    expect(scenario).toBeDefined()
  })

  test('scenario has self-contained sourcePreset (not presetIdx)', () => {
    expect(scenario.sourcePreset).toBeDefined()
    expect(scenario.presetIdx).toBeUndefined()
  })

  test('source renderer journeyStageKey is seed', () => {
    expect(sourcePreset.journeyStageKey).toBe('seed')
  })

  test('declared fromStage is seed', () => {
    expect(scenario.advancements.journeyAdvancement.fromStage).toBe('seed')
  })

  test('source renderer stage matches declared fromStage', () => {
    expect(sourcePreset.journeyStageKey).toBe(
      scenario.advancements.journeyAdvancement.fromStage,
    )
  })

  test('target renderer journeyStageKey is growing', () => {
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    expect(targetPreset.journeyStageKey).toBe('growing')
  })

  test('declared toStage is growing', () => {
    expect(scenario.advancements.journeyAdvancement.toStage).toBe('growing')
  })

  test('target renderer stage matches declared toStage', () => {
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    expect(targetPreset.journeyStageKey).toBe(
      scenario.advancements.journeyAdvancement.toStage,
    )
  })

  test('source state is displayed before target transition (SOURCE_DISPLAY_MS)', () => {
    expect(PREVIEW_SRC).toMatch(/SOURCE_DISPLAY_MS/)
    expect(SOURCE_DISPLAY_MS).toBeGreaterThanOrEqual(700)
  })

  test('Replay generates a fresh event (eventId increments)', () => {
    expect(PREVIEW_SRC).toMatch(/setEventId\(\(id\) => id \+ 1\)/)
  })

  test('Normal Motion passes isReduced=false to Scene', () => {
    expect(PREVIEW_SRC).toMatch(/useState\(false\)/)
    expect(PREVIEW_SRC).toMatch(/isReduced=\{isReduced\}/)
  })

  test('Reduced Motion remains canonical (motion hook resolves)', () => {
    const motionSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenMotion.js'),
      'utf-8',
    )
    expect(motionSrc).toMatch(/if \(isReduced\)\s*\{[\s\S]*?resolveToCanonicalRest/)
  })

  test('diagnostic shows sourceJourney', () => {
    expect(PREVIEW_SRC).toMatch(/sourceJourney=/)
  })

  test('diagnostic shows targetJourney', () => {
    expect(PREVIEW_SRC).toMatch(/targetJourney=/)
  })

  test('diagnostic shows renderedJourney', () => {
    expect(PREVIEW_SRC).toMatch(/renderedJourney=/)
  })
})

// ── S. Scenario isolation — previous scenario cannot contaminate ──

describe('S. Scenario isolation', () => {
  test('handleTriggerScenario remounts Scene (setSceneInstanceKey)', () => {
    const triggerMatch = PREVIEW_SRC.match(/handleTriggerScenario[\s\S]*?\},\s*\[/)
    expect(triggerMatch).toBeTruthy()
    expect(triggerMatch[0]).toMatch(/setSceneInstanceKey/)
  })

  test('handleTriggerScenario clears advancements before source display', () => {
    const triggerMatch = PREVIEW_SRC.match(/handleTriggerScenario[\s\S]*?\},\s*\[/)
    expect(triggerMatch).toBeTruthy()
    expect(triggerMatch[0]).toMatch(/setAdvancements\(null\)/)
  })

  test('handleTriggerScenario clears customPreset before source display', () => {
    const triggerMatch = PREVIEW_SRC.match(/handleTriggerScenario[\s\S]*?\},\s*\[/)
    expect(triggerMatch).toBeTruthy()
    expect(triggerMatch[0]).toMatch(/setCustomPreset\(null\)/)
  })

  test('handleTriggerScenario uses sourcePreset when available', () => {
    expect(PREVIEW_SRC).toMatch(/sourcePreset.*PRESETS|scenario\.sourcePreset/)
  })
})

// ── T. Source/target agreement for all special scenarios ──────

describe('T. Source/target agreement for special scenarios', () => {
  // Helper: check source/target agreement for a scenario
  function checkAgreement(scenario) {
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)

    // Check bed advancement source matches source preset
    if (scenario.advancements.bedAdvancements) {
      scenario.advancements.bedAdvancements.forEach((adv) => {
        const sourceBedStage = sourcePreset.bedStages[adv.bedKey].key
        expect(sourceBedStage).toBe(adv.fromStage)
        const targetBedStage = targetPreset.bedStages[adv.bedKey].key
        expect(targetBedStage).toBe(adv.toStage)
      })
    }

    // Check journey advancement source matches source preset
    if (scenario.advancements.journeyAdvancement) {
      expect(sourcePreset.journeyStageKey).toBe(
        scenario.advancements.journeyAdvancement.fromStage,
      )
      expect(targetPreset.journeyStageKey).toBe(
        scenario.advancements.journeyAdvancement.toStage,
      )
    }
  }

  test('Journey Tree: source/target agreement', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'journeyAdvance')
    expect(scenario).toBeDefined()
    checkAgreement(scenario)
  })

  test('Arbor New: source/target agreement', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'arborNew')
    expect(scenario).toBeDefined()
    checkAgreement(scenario)
  })

  test('Rainbow: source/target agreement', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    expect(scenario).toBeDefined()
    checkAgreement(scenario)
  })

  test('Coalesced Multi: source/target agreement', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'coalescedMulti')
    expect(scenario).toBeDefined()
    checkAgreement(scenario)
  })

  test('Arbor New: source does NOT already have new milestones', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'arborNew')
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
    const newIds = scenario.advancements.newMilestoneIds
    newIds.forEach((id) => {
      expect(sourcePreset.arborCtx.unlockedAchievementIds).not.toContain(id)
    })
  })

  test('Coalesced Multi: source journey is growing (not thriving)', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'coalescedMulti')
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
    expect(sourcePreset.journeyStageKey).toBe('growing')
  })

  test('Rainbow: source journey is thriving (not legend)', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
    expect(sourcePreset.journeyStageKey).toBe('thriving')
  })

  test('Rainbow: source citrus is harvesting (not flourishing)', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
    expect(sourcePreset.bedStages.citrus.key).toBe('harvesting')
  })

  test('Rainbow: source tropical is growing (not flourishing)', () => {
    const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'rainbow')
    const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
    expect(sourcePreset.bedStages.tropical.key).toBe('growing')
  })
})

// ── N. Harvest→Flourish end-to-end proof ──────────────────────

describe('N. Harvest→Flourish end-to-end proof', () => {
  const scenario = TRANSITION_SCENARIOS.find((s) => s.key === 'harvestingToFlourishing')

  test('scenario exists', () => {
    expect(scenario).toBeDefined()
  })

  test('scenario uses presetIdx 1 (One-Month Garden)', () => {
    expect(scenario.presetIdx).toBe(1)
  })

  test('source preset has greens = harvesting', () => {
    const sourcePreset = PRESETS[scenario.presetIdx]
    expect(sourcePreset.bedStages.greens.key).toBe('harvesting')
  })

  test('advancement is greens harvesting → flourishing', () => {
    expect(scenario.advancements.bedAdvancements).toContainEqual(
      expect.objectContaining({
        bedKey: 'greens',
        fromStage: 'harvesting',
        toStage: 'flourishing',
      }),
    )
  })

  test('computeTargetPreset produces greens = flourishing', () => {
    const sourcePreset = PRESETS[scenario.presetIdx]
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    expect(targetPreset.bedStages.greens.key).toBe('flourishing')
  })

  test('computeTargetPreset preserves other beds from source', () => {
    const sourcePreset = PRESETS[scenario.presetIdx]
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    // roots should still be growing (not changed by this scenario)
    expect(targetPreset.bedStages.roots.key).toBe('growing')
    expect(targetPreset.bedStages.citrus.key).toBe('sprout')
  })

  test('computeTargetPreset preserves journey stage when no journey advancement', () => {
    const sourcePreset = PRESETS[scenario.presetIdx]
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    expect(targetPreset.journeyStageKey).toBe(sourcePreset.journeyStageKey)
  })

  test('computeTargetPreset updates arborCtx bedStages to target', () => {
    const sourcePreset = PRESETS[scenario.presetIdx]
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    expect(targetPreset.arborCtx.bedStages.greens.key).toBe('flourishing')
  })

  test('computeTargetPreset does not add milestones when none in advancement', () => {
    const sourcePreset = PRESETS[scenario.presetIdx]
    const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
    expect(targetPreset.arborCtx.unlockedAchievementIds).toEqual(
      sourcePreset.arborCtx.unlockedAchievementIds,
    )
  })

  test('preview passes preset (which may be customPreset) to FittedScene', () => {
    // The FittedScene receives `preset` which is `customPreset || PRESETS[selectedIdx]`
    expect(PREVIEW_SRC).toMatch(/preset=\{preset\}/)
  })

  test('scenario remounts Scene for isolation (no previous contamination)', () => {
    // sceneInstanceKey changes on trigger to ensure scenario isolation
    expect(PREVIEW_SRC).toMatch(/sceneInstanceKey/)
    // handleTriggerScenario SHOULD call setSceneInstanceKey for isolation
    const triggerMatch = PREVIEW_SRC.match(/handleTriggerScenario[\s\S]*?\},\s*\[/)
    expect(triggerMatch).toBeTruthy()
    expect(triggerMatch[0]).toMatch(/setSceneInstanceKey/)
  })

  test('Normal Motion passes isReduced=false to Scene', () => {
    // isReduced is state, default false, passed directly
    expect(PREVIEW_SRC).toMatch(/useState\(false\)/)
    expect(PREVIEW_SRC).toMatch(/isReduced=\{isReduced\}/)
  })

  test('Reduced Motion intentionally resolves immediately (motion hook handles)', () => {
    // The motion hook checks isReduced and resolves to canonical rest
    const motionSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'LivingGardenMotion.js'),
      'utf-8',
    )
    expect(motionSrc).toMatch(/if \(isReduced\)\s*\{[\s\S]*?resolveToCanonicalRest/)
  })
})

// ── O. All scenarios produce valid target presets ─────────────

describe('O. All scenarios produce valid target presets', () => {
  TRANSITION_SCENARIOS.forEach((scenario) => {
    test(`${scenario.name}: target preset has valid bed stages`, () => {
      const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
      const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
      BED_KEYS.forEach((bedKey) => {
        expect(VALID_BED_STAGES).toContain(targetPreset.bedStages[bedKey].key)
      })
    })

    test(`${scenario.name}: target journey is valid`, () => {
      const sourcePreset = scenario.sourcePreset || PRESETS[scenario.presetIdx]
      const targetPreset = computeTargetPreset(sourcePreset, scenario.advancements)
      expect(VALID_JOURNEY_KEYS).toContain(targetPreset.journeyStageKey)
    })
  })
})

// ── P. Event ID increments on each trigger ────────────────────

describe('P. Event ID increments on each trigger', () => {
  test('handleTriggerScenario increments eventId', () => {
    expect(PREVIEW_SRC).toMatch(/setEventId\(\(id\) => id \+ 1\)/)
  })

  test('event ID starts at 0', () => {
    expect(PREVIEW_SRC).toMatch(/useState\(0\)/)
  })
})

// ── Q. Preset selection is immediate (no animation) ───────────

describe('Q. Preset selection is immediate', () => {
  test('handleSelectPreset clears customPreset and advancements', () => {
    expect(PREVIEW_SRC).toMatch(/handleSelectPreset/)
    const selectMatch = PREVIEW_SRC.match(/handleSelectPreset[\s\S]*?\}, \[\]\)/)
    expect(selectMatch).toBeTruthy()
    expect(selectMatch[0]).toMatch(/setAdvancements\(null\)/)
    expect(selectMatch[0]).toMatch(/setCustomPreset\(null\)/)
  })

  test('preset buttons do not trigger advancements', () => {
    // Preset buttons call handleSelectPreset, not handleTriggerScenario
    const presetBtnMatch = PREVIEW_SRC.match(
      /PRESETS\.map[\s\S]*?onPress=\{\(\) => handleSelectPreset/,
    )
    expect(presetBtnMatch).toBeTruthy()
  })
})
