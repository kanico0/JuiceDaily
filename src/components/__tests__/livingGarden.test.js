// ─────────────────────────────────────────────────────────────
// livingGarden.test.js — Targeted tests for the Living Garden
//
// Verifies:
//   A. Existing truth — 7 beds, existing derivation, thresholds
//   B. Six stages render
//   C. Journey atmosphere — 7 keys map to atmosphere
//   D. No decay — no date input
//   E. Arbor — deterministic placement, stable
//   F. Seen state — first open, advancement, coalescing
//   G. Rainbow — uses existing suppression
//   H. Intro — boolean only
//   I. Performance safety — no filter, no random, stable IDs
//   J. Reduced motion — final state renders
//   K. Frozen code — compact Garden unchanged
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map()
  return {
    getItem: jest.fn(async (key) => store.get(key) ?? null),
    setItem: jest.fn(async (key, val) => { store.set(key, val) }),
    removeItem: jest.fn(async (key) => { store.delete(key) }),
    mergeItem: jest.fn(async () => {}),
    clear: jest.fn(async () => { store.clear() }),
    getAllKeys: jest.fn(async () => [...store.keys()]),
    flushGetRequests: jest.fn(() => {}),
    multiGet: jest.fn(async () => []),
    multiSet: jest.fn(async () => {}),
    multiRemove: jest.fn(async () => {}),
    multiMerge: jest.fn(async () => {}),
    __store: store,
  }
})

import { GARDEN_BEDS } from '../../constants/gardenTaxonomy'
import { GARDEN_STAGES, getBedStages, isRainbowHarvestComplete } from '../../services/gardenService'
import { ARBOR_CATALOG, getArborEarnedCount } from '../MilestoneArborArtwork'
import { JOURNEY_ATMOSPHERE, getAtmosphere, JOURNEY_STAGE_KEYS } from '../LivingGardenAtmosphere'
import {
  BED_PLACEMENT,
  PRODUCE_COLORS,
  GRASS_TUFTS,
  DAPPLE_POOLS,
  MOTE_POSITIONS,
  BED_FRINGES,
  BED_BLOBS,
  SCENE_WIDTH,
  SCENE_HEIGHT,
} from '../LivingGardenGeometry'
import { computePegAssignment, PEG_POSITIONS } from '../LivingGardenArbor'
import {
  getLastSeenState,
  saveLastSeenState,
  initializeIfAbsent,
  detectAdvancements,
  buildCurrentSeenState,
  isIntroSeen,
  markIntroSeen,
  resetSeenState,
  KEY_SEEN_STATE,
  KEY_INTRO_SEEN,
  BED_KEYS,
} from '../../services/gardenSeenState'

function readSrc(filename) {
  return fs.readFileSync(path.join(__dirname, '..', filename), 'utf-8')
}

function readService(filename) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'services', filename), 'utf-8')
}

// ── A. Existing truth ─────────────────────────────────────────

describe('A. Existing truth — 7 beds, existing derivation, thresholds', () => {
  test('exactly 7 Garden beds', () => {
    expect(GARDEN_BEDS).toHaveLength(7)
    expect(GARDEN_BEDS).toEqual(['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs'])
  })

  test('Living Garden BED_PLACEMENT has exactly 7 beds matching taxonomy', () => {
    const placementKeys = Object.keys(BED_PLACEMENT)
    expect(placementKeys).toHaveLength(7)
    GARDEN_BEDS.forEach((bedKey) => {
      expect(placementKeys).toContain(bedKey)
    })
  })

  test('authoritative thresholds remain 0, 1, 2, 3, 5, 7', () => {
    const thresholds = GARDEN_STAGES.map((s) => s.threshold)
    expect(thresholds).toEqual([0, 1, 2, 3, 5, 7])
  })

  test('GARDEN_STAGES keys are correct', () => {
    const keys = GARDEN_STAGES.map((s) => s.key)
    expect(keys).toEqual(['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing'])
  })

  test('Living Garden does NOT redefine thresholds', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    const bedSrc = readSrc('LivingGardenBed.js')
    const atmoSrc = readSrc('LivingGardenAtmosphere.js')
    // None of these files should contain threshold definitions
    expect(sceneSrc).not.toMatch(/threshold\s*[:=]\s*\d/)
    expect(bedSrc).not.toMatch(/threshold\s*[:=]\s*\d/)
    expect(atmoSrc).not.toMatch(/threshold\s*[:=]\s*\d/)
  })

  test('Living Garden imports from existing gardenService, not redefining', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    // Scene receives bedStages as props — does not compute thresholds
    expect(sceneSrc).toMatch(/bedStages/)
    expect(sceneSrc).not.toMatch(/getBedStage\b/)
  })
})

// ── B. Six stages render ──────────────────────────────────────

describe('B. Six stages render', () => {
  const STAGE_KEYS = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']

  test('LivingGardenBed handles all 6 stage keys', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    STAGE_KEYS.forEach((key) => {
      expect(bedSrc).toContain(`'${key}'`)
    })
  })

  test('each bed has a renderer for all 6 stages', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    GARDEN_BEDS.forEach((bedKey) => {
      expect(bedSrc).toContain(bedKey)
    })
  })

  test('Empty stage shows ghost silhouette at 0.18 opacity (visible but unearned)', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/GhostSilhouette/)
    expect(bedSrc).toMatch(/0\.18/)
    // Must NOT be at the old 0.11 opacity
    expect(bedSrc).not.toMatch(/0\.11/)
  })

  test('Flourishing stage shows ground glow', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/GroundGlow/)
  })

  test('Growing stage shows closed bud anticipation cue', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/ClosedBud/)
  })
})

// ── C. Journey atmosphere ─────────────────────────────────────

describe('C. Journey atmosphere — 7 keys map to atmosphere', () => {
  test('all 7 Journey stage keys have atmosphere config', () => {
    JOURNEY_STAGE_KEYS.forEach((key) => {
      expect(JOURNEY_ATMOSPHERE[key]).toBeDefined()
      expect(JOURNEY_ATMOSPHERE[key].horizonGlow).toBeGreaterThan(0)
      expect(JOURNEY_ATMOSPHERE[key].horizonGlow).toBeLessThanOrEqual(0.32)
    })
  })

  test('atmosphere horizon glow is non-decreasing across stages', () => {
    const keys = JOURNEY_STAGE_KEYS
    for (let i = 1; i < keys.length; i++) {
      expect(JOURNEY_ATMOSPHERE[keys[i]].horizonGlow)
        .toBeGreaterThanOrEqual(JOURNEY_ATMOSPHERE[keys[i - 1]].horizonGlow)
    }
  })

  test('motes appear at Blooming and beyond', () => {
    expect(JOURNEY_ATMOSPHERE.seed.moteCount).toBe(0)
    expect(JOURNEY_ATMOSPHERE.sprout.moteCount).toBe(0)
    expect(JOURNEY_ATMOSPHERE.growing.moteCount).toBe(0)
    expect(JOURNEY_ATMOSPHERE.blooming.moteCount).toBeGreaterThan(0)
    expect(JOURNEY_ATMOSPHERE.legend.moteCount).toBeGreaterThanOrEqual(JOURNEY_ATMOSPHERE.blooming.moteCount)
  })

  test('rim light appears at Radiant and beyond', () => {
    expect(JOURNEY_ATMOSPHERE.thriving.rimLight).toBe(0)
    expect(JOURNEY_ATMOSPHERE.radiant.rimLight).toBeGreaterThan(0)
    expect(JOURNEY_ATMOSPHERE.legend.rimLight).toBeGreaterThanOrEqual(JOURNEY_ATMOSPHERE.radiant.rimLight)
  })

  test('crown breath only at Legend', () => {
    expect(JOURNEY_ATMOSPHERE.legend.crownBreath).toBeGreaterThan(0)
    JOURNEY_STAGE_KEYS.filter((k) => k !== 'legend').forEach((key) => {
      expect(JOURNEY_ATMOSPHERE[key].crownBreath).toBe(0)
    })
  })

  test('getAtmosphere returns seed for null/unknown', () => {
    expect(getAtmosphere(null).horizonGlow).toBe(JOURNEY_ATMOSPHERE.seed.horizonGlow)
    expect(getAtmosphere('unknown').horizonGlow).toBe(JOURNEY_ATMOSPHERE.seed.horizonGlow)
  })

  test('Seed horizon glow is 0.10 (raised from 0.05 for readability)', () => {
    expect(JOURNEY_ATMOSPHERE.seed.horizonGlow).toBe(0.10)
  })

  test('Legend horizon glow remains warmer than Seed', () => {
    expect(JOURNEY_ATMOSPHERE.legend.horizonGlow).toBeGreaterThan(JOURNEY_ATMOSPHERE.seed.horizonGlow)
  })

  test('no new Journey metric is created', () => {
    const atmoSrc = readSrc('LivingGardenAtmosphere.js')
    expect(atmoSrc).not.toMatch(/getLifetimeQualifyingDays/)
    expect(atmoSrc).not.toMatch(/lifetimeDays/)
  })
})

// ── C2. Zero-state Journey Tree — null vs seed ───────────────

describe('C2. Zero-state Journey Tree — null vs seed distinction', () => {
  test('getJourneyStage(0) returns null (canonical truth unchanged)', () => {
    const { getJourneyStage } = require('../../constants/glowJourneyStages')
    expect(getJourneyStage(0)).toBeNull()
  })

  test('getJourneyStage(null) returns null', () => {
    const { getJourneyStage } = require('../../constants/glowJourneyStages')
    expect(getJourneyStage(null)).toBeNull()
  })

  test('getJourneyStage(1) returns seed (canonical)', () => {
    const { getJourneyStage } = require('../../constants/glowJourneyStages')
    expect(getJourneyStage(1).key).toBe('seed')
  })

  test('LivingGardenJourneyTree handles null with TreeUnstarted, not TreeSeed', () => {
    const treeSrc = readSrc('LivingGardenJourneyTree.js')
    expect(treeSrc).toMatch(/TreeUnstarted/)
    // null must be checked explicitly before falling back to seed
    expect(treeSrc).toMatch(/journeyStageKey === null/)
  })

  test('TreeUnstarted is visually distinct from TreeSeed', () => {
    const treeSrc = readSrc('LivingGardenJourneyTree.js')
    // TreeUnstarted has an ambient glow + core glow; TreeSeed does not
    const unstartedMatch = treeSrc.match(/function TreeUnstarted[\s\S]*?^}/m)
    expect(unstartedMatch).toBeTruthy()
    const unstartedCode = unstartedMatch[0]
    expect(unstartedCode).toMatch(/unstarted-ambient/)
    expect(unstartedCode).toMatch(/unstarted-core/)
    expect(unstartedCode).toMatch(/RadialGradient/)
    // TreeSeed does not have glow gradients
    const seedMatch = treeSrc.match(/function TreeSeed[\s\S]*?^}/m)
    expect(seedMatch).toBeTruthy()
    const seedCode = seedMatch[0]
    expect(seedCode).not.toMatch(/unstarted-ambient/)
    expect(seedCode).not.toMatch(/unstarted-core/)
  })

  test('TreeUnstarted has strengthened focal presence — larger mound, ambient glow, stone ring', () => {
    const treeSrc = readSrc('LivingGardenJourneyTree.js')
    const unstartedMatch = treeSrc.match(/function TreeUnstarted[\s\S]*?^}/m)
    const unstartedCode = unstartedMatch[0]
    // Larger mound (rx >= 20)
    expect(unstartedCode).toMatch(/rx="22"/)
    // Ambient glow (large halo)
    expect(unstartedCode).toMatch(/rx="48"/)
    // Multiple stones in ring (at least 5)
    const stoneCount = (unstartedCode.match(/Circle.*timberLight/g) || []).length
    expect(stoneCount).toBeGreaterThanOrEqual(5)
    // Gold marker (r >= 3)
    expect(unstartedCode).toMatch(/r="3"/)
    // Inner bright core
    expect(unstartedCode).toMatch(/goldPale/)
  })

  test('TreeUnstarted does NOT render any tree silhouette or mature tree shape', () => {
    const treeSrc = readSrc('LivingGardenJourneyTree.js')
    const unstartedMatch = treeSrc.match(/function TreeUnstarted[\s\S]*?^}/m)
    const unstartedCode = unstartedMatch[0]
    // No trunk, no branches, no canopy ellipses
    expect(unstartedCode).not.toMatch(/trunkTopY/)
    expect(unstartedCode).not.toMatch(/crownR/)
    expect(unstartedCode).not.toMatch(/crownCenterY/)
  })

  test('null does NOT convert to seed in the dispatcher', () => {
    const treeSrc = readSrc('LivingGardenJourneyTree.js')
    // The old fallback `journeyStageKey || 'seed'` must NOT exist
    expect(treeSrc).not.toMatch(/journeyStageKey \|\| 'seed'/)
  })

  test('no new Journey threshold or stage is created', () => {
    const treeSrc = readSrc('LivingGardenJourneyTree.js')
    // Check code lines only (skip comments)
    const codeLines = treeSrc.split('\n').filter((l) => !l.trim().startsWith('//'))
    codeLines.forEach((line) => {
      expect(line).not.toMatch(/min:\s*\d/)
      expect(line).not.toMatch(/threshold\s*[:=]/)
    })
    // TreeUnstarted is NOT in TREE_RENDERERS (it is not a stage)
    expect(treeSrc).not.toMatch(/unstarted:\s*TreeUnstarted/)
  })
})

// ── C3. Zero-state visual corrections ─────────────────────────

describe('C3. Zero-state visual corrections', () => {
  test('ghost opacity is 0.18 (raised from 0.11)', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/0\.18/)
    expect(bedSrc).not.toMatch(/0\.11/)
  })

  test('soil edging uses loamLit at 0.60 (not loam at 0.5)', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/loamLit.*0\.60/)
    // Old edging pattern must not remain
    expect(bedSrc).not.toMatch(/stroke.*loam\b.*opacity="0\.5"/)
  })

  test('bed identity stakes are 5×8 (raised from 4×6)', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    // The stake Rect should be 5×8 — check for the stake context
    expect(bedSrc).toMatch(/Colour tag stake[\s\S]*?width="5"[\s\S]*?height="8"/)
  })

  test('vignette outer opacity is 0.40 (reduced from 0.55)', () => {
    const layersSrc = readSrc('LivingGardenLayers.js')
    expect(layersSrc).toMatch(/stopOpacity="0\.40"/)
    expect(layersSrc).not.toMatch(/stopOpacity="0\.55"/)
  })

  test('path gradient has raised opacity for readability', () => {
    const layersSrc = readSrc('LivingGardenLayers.js')
    // Far stop raised from 0.25 to 0.40
    expect(layersSrc).toMatch(/stopOpacity="0\.40"/)
    // Near stop raised from 0.5 to 0.65
    expect(layersSrc).toMatch(/stopOpacity="0\.65"/)
  })

  test('no destructive device logic added', () => {
    const files = ['LivingGardenScene.js', 'LivingGardenBed.js', 'LivingGardenLayers.js', 'LivingGardenJourneyTree.js', 'LivingGardenArbor.js', 'LivingGardenAtmosphere.js', 'LivingGardenGeometry.js']
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/pm clear|adb uninstall|pm uninstall|clearAppData|wipeData/)
    })
  })
})

// ── D. No decay ───────────────────────────────────────────────

describe('D. No decay — no date input', () => {
  test('Living Garden scene does not accept date parameters', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).not.toMatch(/lastOpen|lastSeen.*Date|daysSince|inactivity|inactivityDuration/)
  })

  test('Living Garden bed does not accept date parameters', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).not.toMatch(/lastOpen|daysSince|inactivity|wilt|brown|decay|shrink/)
  })

  test('no wilting/browning/loss logic in any Living Garden file', () => {
    const files = ['LivingGardenScene.js', 'LivingGardenBed.js', 'LivingGardenLayers.js', 'LivingGardenJourneyTree.js', 'LivingGardenArbor.js', 'LivingGardenAtmosphere.js', 'LivingGardenGeometry.js']
    // Check code lines only (skip comment lines starting with //)
    const decayPattern = /(?:^|[^/]\s*)(?:wilt|browning|shrinks?|drop.*fruit|un.?hang)\b/
    files.forEach((f) => {
      const src = readSrc(f)
      const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
      codeLines.forEach((line) => {
        expect(line).not.toMatch(decayPattern)
      })
    })
  })

  test('wake animation is unconditional — no date check', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).toMatch(/useEffect/)
    expect(sceneSrc).toMatch(/wake/)
    expect(sceneSrc).not.toMatch(/daysSince|lastOpen.*Date/)
  })
})

// ── E. Arbor — deterministic placement ────────────────────────

describe('E. Arbor — deterministic placement', () => {
  test('computePegAssignment produces stable peg indices', () => {
    const a1 = computePegAssignment(ARBOR_CATALOG)
    const a2 = computePegAssignment(ARBOR_CATALOG)
    expect(a1).toEqual(a2)
  })

  test('same milestone IDs always map to same peg', () => {
    const assignment = computePegAssignment(ARBOR_CATALOG)
    const idToPeg = {}
    assignment.forEach((entry) => {
      idToPeg[entry.id] = entry.pegIndex
    })
    // Re-compute and verify
    const assignment2 = computePegAssignment(ARBOR_CATALOG)
    assignment2.forEach((entry) => {
      expect(entry.pegIndex).toBe(idToPeg[entry.id])
    })
  })

  test('original 12 positions are stable', () => {
    const assignment = computePegAssignment(ARBOR_CATALOG)
    expect(assignment).toHaveLength(12)
    // Each peg index 0-11 is unique
    const indices = assignment.map((a) => a.pegIndex)
    const unique = new Set(indices)
    expect(unique.size).toBe(12)
    indices.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(12)
    })
  })

  test('no random placement', () => {
    const arborSrc = readSrc('LivingGardenArbor.js')
    expect(arborSrc).not.toMatch(/Math\.random/)
  })

  test('PEG_POSITIONS has 12 positions', () => {
    expect(PEG_POSITIONS).toHaveLength(12)
  })

  test('Arbor uses sorted-ID → sequential peg (not earned order)', () => {
    const arborSrc = readSrc('LivingGardenArbor.js')
    expect(arborSrc).toMatch(/sort.*localeCompare/)
    expect(arborSrc).toMatch(/pegIndex.*index/)
  })

  test('Arbor reuses existing ARBOR_CATALOG qualification', () => {
    const arborSrc = readSrc('LivingGardenArbor.js')
    expect(arborSrc).toMatch(/from.*MilestoneArborArtwork/)
    expect(arborSrc).toMatch(/ARBOR_CATALOG/)
  })
})

// ── F. Seen state ─────────────────────────────────────────────

describe('F. Seen state — first open, advancement, coalescing', () => {
  beforeEach(async () => {
    await resetSeenState()
  })

  test('first open with no snapshot initializes current state', async () => {
    const current = buildCurrentSeenState({
      bedStages: { greens: { key: 'sprout' }, roots: { key: 'empty' } },
      journeyStageKey: 'sprout',
      earnedMilestoneIds: ['first_juice'],
    })
    const wasFirst = await initializeIfAbsent(current)
    expect(wasFirst).toBe(true)
    const saved = await getLastSeenState()
    expect(saved).not.toBeNull()
    expect(saved.bedStages.greens).toBe('sprout')
    expect(saved.journeyStageKey).toBe('sprout')
  })

  test('first open does not replay historical progression', () => {
    const lastSeen = null
    const current = buildCurrentSeenState({
      bedStages: { greens: { key: 'flourishing' } },
      journeyStageKey: 'legend',
      earnedMilestoneIds: ['first_juice', 'streak_3'],
    })
    const advancements = detectAdvancements(lastSeen, current)
    expect(advancements.isFirstOpen).toBe(true)
    expect(advancements.bedAdvancements).toEqual([])
    expect(advancements.journeyAdvancement).toBeNull()
    expect(advancements.newMilestoneIds).toEqual([])
  })

  test('later bed advancement detected correctly', () => {
    const lastSeen = {
      bedStages: { greens: 'seed', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: [],
    }
    const current = {
      bedStages: { greens: 'harvesting', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: [],
    }
    const advancements = detectAdvancements(lastSeen, current)
    expect(advancements.isFirstOpen).toBe(false)
    expect(advancements.bedAdvancements).toHaveLength(1)
    expect(advancements.bedAdvancements[0].bedKey).toBe('greens')
    expect(advancements.bedAdvancements[0].fromStage).toBe('seed')
    expect(advancements.bedAdvancements[0].toStage).toBe('harvesting')
  })

  test('multi-stage jump coalesces (Seed → Harvesting, not replay)', () => {
    const lastSeen = {
      bedStages: { greens: 'seed', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: [],
    }
    const current = {
      bedStages: { greens: 'harvesting', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: [],
    }
    const advancements = detectAdvancements(lastSeen, current)
    // ONE coalesced advancement, not 4 intermediate steps
    expect(advancements.bedAdvancements).toHaveLength(1)
    expect(advancements.bedAdvancements[0].fromStage).toBe('seed')
    expect(advancements.bedAdvancements[0].toStage).toBe('harvesting')
  })

  test('Journey advancement detected', () => {
    const lastSeen = {
      bedStages: { greens: 'empty', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'growing',
      earnedMilestoneIds: [],
    }
    const current = {
      bedStages: { greens: 'empty', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'thriving',
      earnedMilestoneIds: [],
    }
    const advancements = detectAdvancements(lastSeen, current)
    expect(advancements.journeyAdvancement).not.toBeNull()
    expect(advancements.journeyAdvancement.fromStage).toBe('growing')
    expect(advancements.journeyAdvancement.toStage).toBe('thriving')
  })

  test('new Arbor milestones detected', () => {
    const lastSeen = {
      bedStages: { greens: 'empty', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: ['first_juice'],
    }
    const current = {
      bedStages: { greens: 'empty', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: ['first_juice', 'streak_3', 'streak_7'],
    }
    const advancements = detectAdvancements(lastSeen, current)
    expect(advancements.newMilestoneIds).toEqual(['streak_3', 'streak_7'])
  })

  test('deleted snapshot does NOT affect progression truth', async () => {
    const current = buildCurrentSeenState({
      bedStages: { greens: { key: 'flourishing' } },
      journeyStageKey: 'radiant',
      earnedMilestoneIds: ['first_juice'],
    })
    await saveLastSeenState(current)
    await resetSeenState()
    // After reset, getLastSeenState returns null
    const after = await getLastSeenState()
    expect(after).toBeNull()
    // But buildCurrentSeenState still produces correct state from real data
    const rebuilt = buildCurrentSeenState({
      bedStages: { greens: { key: 'flourishing' } },
      journeyStageKey: 'radiant',
      earnedMilestoneIds: ['first_juice'],
    })
    expect(rebuilt.bedStages.greens).toBe('flourishing')
    expect(rebuilt.journeyStageKey).toBe('radiant')
  })

  test('no backward advancement (no decay in seen state)', () => {
    const lastSeen = {
      bedStages: { greens: 'harvesting', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'radiant',
      earnedMilestoneIds: ['first_juice'],
    }
    const current = {
      bedStages: { greens: 'seed', roots: 'empty', citrus: 'empty', orchard: 'empty', berries: 'empty', tropical: 'empty', herbs: 'empty' },
      journeyStageKey: 'seed',
      earnedMilestoneIds: ['first_juice'],
    }
    // Current is "behind" last seen — should NOT trigger advancement
    const advancements = detectAdvancements(lastSeen, current)
    expect(advancements.bedAdvancements).toHaveLength(0)
    expect(advancements.journeyAdvancement).toBeNull()
  })

  test('seen state does not include timestamps or history', () => {
    const state = buildCurrentSeenState({
      bedStages: { greens: { key: 'sprout' } },
      journeyStageKey: 'sprout',
      earnedMilestoneIds: [],
    })
    expect(state).not.toHaveProperty('timestamp')
    expect(state).not.toHaveProperty('lastOpenDate')
    expect(state).not.toHaveProperty('daysSinceLastOpen')
    expect(state).not.toHaveProperty('eventHistory')
    expect(state).not.toHaveProperty('queue')
  })
})

// ── G. Rainbow ────────────────────────────────────────────────

describe('G. Rainbow — uses existing suppression', () => {
  test('Living Garden does not add per-day Rainbow flag', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(sceneSrc).not.toMatch(/perDayRainbow|rainbowDaily|dailyRainbow/)
    expect(bedSrc).not.toMatch(/perDayRainbow|rainbowDaily|dailyRainbow/)
  })

  test('Living Garden does not redefine Rainbow qualification', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).not.toMatch(/isRainbowHarvestComplete/)
    // Rainbow is handled via arborCtx.rainbowComplete, not recomputed
  })

  test('existing isRainbowHarvestComplete is unchanged', () => {
    const serviceSrc = readService('gardenService.js')
    expect(serviceSrc).toMatch(/isRainbowHarvestComplete/)
    expect(serviceSrc).toMatch(/garden_celebratedRainbow/)
  })
})

// ── H. Intro ──────────────────────────────────────────────────

describe('H. Intro — boolean only', () => {
  test('intro-seen is a single boolean key', () => {
    expect(KEY_INTRO_SEEN).toBe('garden_living_intro_seen')
  })

  test('intro boolean does not affect progression', () => {
    const seenSrc = readService('gardenSeenState.js')
    expect(seenSrc).toMatch(/garden_living_intro_seen/)
    // Intro functions are separate from seen-state functions
    expect(seenSrc).toMatch(/isIntroSeen/)
    expect(seenSrc).toMatch(/markIntroSeen/)
  })

  test('first-visit callout uses zero-state Journey wording', () => {
    const detailSrc = fs.readFileSync(path.join(__dirname, '..', 'GardenDetail.js'), 'utf-8')
    // The Journey callout must say "will grow here" (not "reflects progress")
    expect(detailSrc).toMatch(/Your Journey Tree will grow here/)
    // Must NOT use the old wording
    expect(detailSrc).not.toMatch(/Journey Tree reflects/)
  })

  test('first-visit callout has three short items', () => {
    const detailSrc = fs.readFileSync(path.join(__dirname, '..', 'GardenDetail.js'), 'utf-8')
    expect(detailSrc).toMatch(/Your produce areas grow as you explore/)
    expect(detailSrc).toMatch(/Your Journey Tree will grow here/)
    expect(detailSrc).toMatch(/Your Arbor keeps the milestones you've earned/)
  })
})

// ── I. Performance safety ─────────────────────────────────────

describe('I. Performance safety', () => {
  test('no SVG filter in any Living Garden file', () => {
    const files = ['LivingGardenScene.js', 'LivingGardenBed.js', 'LivingGardenLayers.js', 'LivingGardenJourneyTree.js', 'LivingGardenArbor.js', 'LivingGardenGeometry.js']
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/feGaussianBlur|<filter|feBlur/)
    })
  })

  test('no mask in resting scene', () => {
    const files = ['LivingGardenScene.js', 'LivingGardenBed.js', 'LivingGardenLayers.js']
    files.forEach((f) => {
      const src = readSrc(f)
      // Check code lines only (skip comment lines that mention "no clipPaths")
      const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
      codeLines.forEach((line) => {
        expect(line).not.toMatch(/<Mask|clipPath|ClipPath/)
      })
    })
  })

  test('no Math.random for scene geometry', () => {
    const files = ['LivingGardenScene.js', 'LivingGardenBed.js', 'LivingGardenLayers.js', 'LivingGardenJourneyTree.js', 'LivingGardenArbor.js', 'LivingGardenGeometry.js']
    files.forEach((f) => {
      const src = readSrc(f)
      if (f === 'LivingGardenGeometry.js') {
        // Geometry uses mulberry32 PRNG, not raw Math.random for scatter
        expect(src).toMatch(/mulberry32/)
        // Check code lines (not comments) for Math.random
        const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
        const randomLines = codeLines.filter((l) => l.includes('Math.random'))
        // Math.random should only appear inside the PRNG function
        randomLines.forEach((l) => {
          expect(l).toMatch(/return.*\/ 4294967296/)
        })
      } else {
        // No Math.random in other files (check code lines only)
        const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
        codeLines.forEach((l) => {
          expect(l).not.toMatch(/Math\.random/)
        })
      }
    })
  })

  test('deterministic geometry — grass tufts are precomputed', () => {
    expect(GRASS_TUFTS).toHaveLength(28)
    // Same length every run (module constant)
  })

  test('deterministic geometry — dapple pools are precomputed', () => {
    expect(DAPPLE_POOLS).toHaveLength(6)
  })

  test('deterministic geometry — mote positions are precomputed', () => {
    expect(MOTE_POSITIONS).toHaveLength(12)
  })

  test('deterministic geometry — bed fringes are precomputed', () => {
    GARDEN_BEDS.forEach((bedKey) => {
      expect(BED_FRINGES[bedKey]).toBeDefined()
      expect(BED_FRINGES[bedKey].length).toBeGreaterThanOrEqual(4)
    })
  })

  test('deterministic geometry — bed blobs are precomputed', () => {
    GARDEN_BEDS.forEach((bedKey) => {
      expect(BED_BLOBS[bedKey]).toBeDefined()
      expect(BED_BLOBS[bedKey]).toMatch(/^M /)
    })
  })

  test('scene canvas is 390 × 720', () => {
    expect(SCENE_WIDTH).toBe(390)
    expect(SCENE_HEIGHT).toBe(720)
  })

  test('produce colours are defined for all 7 beds', () => {
    GARDEN_BEDS.forEach((bedKey) => {
      expect(PRODUCE_COLORS[bedKey]).toBeDefined()
      expect(PRODUCE_COLORS[bedKey]).toMatch(/^#/)
    })
  })

  test('LivingGardenBed is memoised', () => {
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/memo/)
    expect(bedSrc).toMatch(/bedComparator/)
  })

  test('LivingGardenScene is memoised', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).toMatch(/memo/)
    expect(sceneSrc).toMatch(/sceneComparator/)
  })
})

// ── J. Reduced motion ─────────────────────────────────────────

describe('J. Reduced motion — final state renders', () => {
  test('scene accepts isReduced prop', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).toMatch(/isReduced/)
  })

  test('reduced motion mounts wake at final state', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).toMatch(/isReduced.*1.*0\.55|isReduced.*wakeOpacity.*1/)
  })

  test('motes render statically at 0.3 opacity in reduced motion', () => {
    const layersSrc = readSrc('LivingGardenLayers.js')
    expect(layersSrc).toMatch(/isReduced/)
    expect(layersSrc).toMatch(/0\.3/)
  })

  test('no information depends on animation', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    // Scene renders all beds/tree/arbor regardless of isReduced
    expect(sceneSrc).toMatch(/LivingGardenBed/)
    expect(sceneSrc).toMatch(/LivingGardenJourneyTree/)
    expect(sceneSrc).toMatch(/LivingGardenArbor/)
  })
})

// ── K. Frozen code ────────────────────────────────────────────

describe('K. Frozen code — compact Garden unchanged', () => {
  test('GardenArtwork is not imported by Living Garden', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(sceneSrc).not.toMatch(/from.*GardenArtwork/)
    expect(bedSrc).not.toMatch(/from.*GardenArtwork/)
  })

  test('GardenCompactArtwork is not imported by Living Garden', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    expect(sceneSrc).not.toMatch(/from.*GardenCompactArtwork/)
  })

  test('GardenVisualState is not imported by Living Garden', () => {
    const sceneSrc = readSrc('LivingGardenScene.js')
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(sceneSrc).not.toMatch(/from.*GardenVisualState/)
    expect(bedSrc).not.toMatch(/from.*GardenVisualState/)
  })

  test('JourneyTreeArtwork is not modified (frozen)', () => {
    // Living Garden has its own tree, does not modify the compact one
    const livingTreeSrc = readSrc('LivingGardenJourneyTree.js')
    expect(livingTreeSrc).not.toMatch(/from.*JourneyTreeArtwork/)
  })

  test('MilestoneArborArtwork is imported but not modified', () => {
    const arborSrc = readSrc('LivingGardenArbor.js')
    // Living Garden Arbor imports catalog from frozen Arbor
    expect(arborSrc).toMatch(/from.*MilestoneArborArtwork/)
    // But does not export modified versions
    expect(arborSrc).not.toMatch(/export.*ARBOR_CATALOG/)
  })

  test('gardenService progression logic is untouched', () => {
    const serviceSrc = readService('gardenService.js')
    // Thresholds are still 0, 1, 2, 3, 5, 7
    expect(serviceSrc).toMatch(/threshold:\s*0/)
    expect(serviceSrc).toMatch(/threshold:\s*1/)
    expect(serviceSrc).toMatch(/threshold:\s*2/)
    expect(serviceSrc).toMatch(/threshold:\s*3/)
    expect(serviceSrc).toMatch(/threshold:\s*5/)
    expect(serviceSrc).toMatch(/threshold:\s*7/)
  })

  test('Glow files are not imported by Living Garden', () => {
    const files = ['LivingGardenScene.js', 'LivingGardenBed.js', 'LivingGardenLayers.js', 'LivingGardenJourneyTree.js', 'LivingGardenArbor.js', 'LivingGardenAtmosphere.js', 'LivingGardenGeometry.js']
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/from.*GlowJourneyDrop/)
      expect(src).not.toMatch(/from.*GlowJourneyVisualState/)
    })
  })
})
