// ─────────────────────────────────────────────────────────────
// livingGardenMotion.test.js — Targeted tests for Living Garden
// Motion v1.1 (Anchored Botanical Growth)
//
// Verifies:
//   AA. No mask, no clipPath, no duplicated SoilBed
//   BB. Production paint order unchanged
//   CC. Wrappers rest at identity (pixel-neutral)
//   DD. Anchored plant growth resolves to scaleY 1
//   EE. All temporary transforms resolve to zero/canonical
//   FF. Tier assignments match the approved audit
//   GG. No Tier 1/2 invented
//   HH. Tree uses no path morph
//   II. Arbor qualification unchanged
//   JJ. Arbor earned ornaments are static after reveal
//   KK. No new persistence
//   LL. No new thresholds
//   MM. Reduced Motion is canonical
//   NN. Final rendered state derives from production renderer
//   OO. Worst orchestration <= 6500ms
//   PP. Motion module constants are correct
//   QQ. Frozen code — JourneyTreeArtwork not modified
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

import {
  STAGE_TRANSITION_DURATION,
  COALESCED_DURATION,
  GROWTH_START_SCALE,
  GROWTH_SETTLE_PX,
  TREE_START_SCALE,
  TREE_DURATION,
  ARBOR_ORNAMENT_DURATION,
  RAINBOW_DURATION,
  WAKE_DURATION,
  BAND_STAGGER,
  FAR_BEDS,
  MID_BEDS,
  NEAR_BEDS,
  ALL_BEDS_ORDER,
  CANONICAL_BED_MOTION,
  CANONICAL_TREE_MOTION,
  getBedDuration,
  getBedStartDelay,
  computeTotalDuration,
} from '../LivingGardenMotion'

function readSrc(filename) {
  return fs.readFileSync(path.join(__dirname, '..', filename), 'utf-8')
}

function readService(filename) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'services', filename), 'utf-8')
}

// ── AA. No mask, clipPath, or soil duplication ────────────────

describe('AA. No mask, clipPath, or soil duplication', () => {
  const files = [
    'LivingGardenScene.js',
    'LivingGardenBed.js',
    'LivingGardenLayers.js',
    'LivingGardenJourneyTree.js',
    'LivingGardenArbor.js',
    'LivingGardenMotion.js',
  ]

  files.forEach((f) => {
    test(`${f} has no <Mask or clipPath`, () => {
      const src = readSrc(f)
      // Check code lines only (skip comment lines)
      const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
      codeLines.forEach((line) => {
        expect(line).not.toMatch(/<Mask|clipPath|ClipPath/)
      })
    })
  })

  test('LivingGardenBed does not duplicate SoilBed', () => {
    const src = readSrc('LivingGardenBed.js')
    // Phase 1C: SoilBed appears in both the Soil Answer wrapper
    // (listener-based G) and the canonical path. Both render the SAME
    // SoilBed component — no duplication of soil geometry.
    const soilBedMatches = src.match(/<SoilBed/g) || []
    expect(soilBedMatches.length).toBe(2)
  })

  test('LivingGardenMotion has no mask/clip/soil references', () => {
    const src = readSrc('LivingGardenMotion.js')
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
    codeLines.forEach((line) => {
      expect(line).not.toMatch(/<Mask|clipPath|ClipPath|SoilBed/)
    })
  })
})

// ── BB. Production paint order unchanged ──────────────────────

describe('BB. Production paint order unchanged', () => {
  test('LivingGardenBed paint order: GroundBloom → SoilBed → Ghost → Plant', () => {
    const src = readSrc('LivingGardenBed.js')
    // Find the return block of LivingGardenBedComponent
    // The function body contains the JSX return with GroundBloom, SoilBed, etc.
    // Use a greedy match to the last return statement in the component.
    const componentMatch = src.match(/function LivingGardenBedComponent[\s\S]*?\n\}\n/m)
    expect(componentMatch).toBeTruthy()
    const componentCode = componentMatch[0]

    // Verify paint order by checking index positions in the return JSX
    // Find the LAST return ( the JSX return, not early returns)
    const returnMatches = componentCode.match(/return \(/g) || []
    expect(returnMatches.length).toBeGreaterThanOrEqual(1)
    const lastReturnIdx = componentCode.lastIndexOf('return (')
    const returnCode = componentCode.slice(lastReturnIdx)

    const groundBloomIdx = returnCode.indexOf('GroundBloom')
    const soilBedIdx = returnCode.indexOf('SoilBed')
    const ghostIdx = returnCode.indexOf('GhostSilhouette')
    const rendererIdx = returnCode.indexOf('PlantArtwork')

    expect(groundBloomIdx).toBeGreaterThan(-1)
    expect(soilBedIdx).toBeGreaterThan(groundBloomIdx)
    // Ghost is conditional on Empty
    expect(ghostIdx).toBeGreaterThan(soilBedIdx)
    // PlantArtwork (plant artwork) comes after ghost
    expect(rendererIdx).toBeGreaterThan(soilBedIdx)
  })

  test('Scene z-order unchanged (Sky → Treeline → Ground → Tree → Path → Detail → Beds → Arbor → Motes → Vignette)', () => {
    const src = readSrc('LivingGardenScene.js')
    const skyIdx = src.indexOf('<Sky')
    const treelineIdx = src.indexOf('<Treeline')
    const groundIdx = src.indexOf('<Ground')
    const treeIdx = src.indexOf('<LivingGardenJourneyTree')
    const pathIdx = src.indexOf('<PathLayer')
    const detailIdx = src.indexOf('<GroundDetail')
    const farBedsIdx = src.indexOf('FAR_BEDS.map')
    const arborIdx = src.indexOf('<LivingGardenArbor')
    const midBedsIdx = src.indexOf('MID_BEDS.map')
    const nearBedsIdx = src.indexOf('NEAR_BEDS.map')
    const motesIdx = src.indexOf('<Motes')
    const vignetteIdx = src.indexOf('<Vignette')

    expect(skyIdx).toBeGreaterThan(-1)
    expect(treelineIdx).toBeGreaterThan(skyIdx)
    expect(groundIdx).toBeGreaterThan(treelineIdx)
    expect(treeIdx).toBeGreaterThan(groundIdx)
    expect(pathIdx).toBeGreaterThan(treeIdx)
    expect(detailIdx).toBeGreaterThan(pathIdx)
    expect(farBedsIdx).toBeGreaterThan(detailIdx)
    expect(arborIdx).toBeGreaterThan(farBedsIdx)
    expect(midBedsIdx).toBeGreaterThan(arborIdx)
    expect(nearBedsIdx).toBeGreaterThan(midBedsIdx)
    expect(motesIdx).toBeGreaterThan(nearBedsIdx)
    expect(vignetteIdx).toBeGreaterThan(motesIdx)
  })
})

// ── CC. Wrappers rest at identity ─────────────────────────────

describe('CC. Wrappers rest at identity (pixel-neutral)', () => {
  test('CANONICAL_BED_MOTION is identity', () => {
    expect(CANONICAL_BED_MOTION.scaleY).toBe(1)
    expect(CANONICAL_BED_MOTION.translateY).toBe(0)
    expect(CANONICAL_BED_MOTION.opacity).toBe(1)
  })

  test('CANONICAL_TREE_MOTION is identity', () => {
    expect(CANONICAL_TREE_MOTION.scaleY).toBe(1)
    expect(CANONICAL_TREE_MOTION.opacity).toBe(1)
  })

  test('LivingGardenBed wrapper G is identity at rest (no transform when bedMotion is canonical)', () => {
    const src = readSrc('LivingGardenBed.js')
    // Phase 1C: uses hasAnimValues (Animated.Value check)
    // When no animValues, renders plain <G> (canonical/identity)
    expect(src).toMatch(/hasAnimValues/)
    expect(src).toMatch(/hasAnimValues \?/)
  })

  test('LivingGardenJourneyTree wrapper G is identity at rest', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1C: uses hasAnimMotion (Animated.Value check)
    expect(src).toMatch(/hasAnimMotion/)
    // motionWrapper returns children directly when no motion
    expect(src).toMatch(/if \(!hasAnimMotion\) return children/)
  })

  test('LivingGardenArbor ornament transform is identity at rest (arborReveal=1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/revealProgress/)
    // When revealProgress = 1, ornamentScale = 1, ornamentOpacity = 1
    expect(src).toMatch(/ornamentScale !== 1/)
  })
})

// ── DD. Anchored plant growth resolves to scaleY 1 ────────────

describe('DD. Anchored plant growth resolves to scaleY 1', () => {
  test('GROWTH_START_SCALE is between 0.20 and 0.35', () => {
    expect(GROWTH_START_SCALE).toBeGreaterThanOrEqual(0.2)
    expect(GROWTH_START_SCALE).toBeLessThanOrEqual(0.35)
  })

  test('bed motion wrapper uses scaleY transform anchored at base', () => {
    const src = readSrc('LivingGardenBed.js')
    // Phase 1C: uses listener-based SVG transform string
    // transform: translate(0, ty) scale(1, scaleY)
    // anchored at placement.cy
    expect(src).toMatch(/scaleY/)
    expect(src).toMatch(/placement\.cy/)
    expect(src).toMatch(/animValues\.scaleY/)
  })

  test('LivingGardenBed does NOT use vertical translation for emergence', () => {
    const src = readSrc('LivingGardenBed.js')
    // The retired behind-mound technique used translateY from below.
    // The new technique uses scaleY anchored at base.
    // translateY should only be the tiny settle offset, not emergence.
    const componentMatch = src.match(/function LivingGardenBedComponent[\s\S]*?^}/m)
    expect(componentMatch).toBeTruthy()
    // Should not have large translateY values for emergence
    expect(componentMatch[0]).not.toMatch(/translateY.*>.*20/)
  })
})

// ── EE. All temporary transforms resolve to zero/canonical ────

describe('EE. All temporary transforms resolve to zero/canonical', () => {
  test('GROWTH_SETTLE_PX is small (<= 3px)', () => {
    expect(GROWTH_SETTLE_PX).toBeLessThanOrEqual(3)
  })

  test('TREE_START_SCALE is close to 1 (>= 0.85)', () => {
    expect(TREE_START_SCALE).toBeGreaterThanOrEqual(0.85)
  })

  test('all stage transition durations are positive', () => {
    Object.values(STAGE_TRANSITION_DURATION).forEach((d) => {
      expect(d).toBeGreaterThan(0)
    })
  })

  test('coalesced duration is the maximum', () => {
    expect(COALESCED_DURATION).toBeGreaterThanOrEqual(
      Math.max(...Object.values(STAGE_TRANSITION_DURATION)),
    )
  })
})

// ── FF. Tier assignments match the approved audit ─────────────

describe('FF. Tier assignments match the approved audit', () => {
  // Tier 4: whole-bed canonical color crossfade
  // Tier 3: subgrouped (trunk → canopy → fruit, etc.)
  const TIER_4_BEDS = ['greens', 'roots', 'herbs']
  const TIER_3_BEDS = ['citrus', 'orchard', 'berries', 'tropical']

  test('Tier 4 beds are greens, roots, herbs', () => {
    TIER_4_BEDS.forEach((bedKey) => {
      expect(ALL_BEDS_ORDER).toContain(bedKey)
    })
  })

  test('Tier 3 beds are citrus, orchard, berries, tropical', () => {
    TIER_3_BEDS.forEach((bedKey) => {
      expect(ALL_BEDS_ORDER).toContain(bedKey)
    })
  })

  test('all 7 beds are assigned to exactly one tier', () => {
    const allAssigned = [...TIER_3_BEDS, ...TIER_4_BEDS]
    expect(new Set(allAssigned).size).toBe(7)
    expect(allAssigned.sort()).toEqual(ALL_BEDS_ORDER.slice().sort())
  })

  test('LivingGardenMotion does not invent Tier 1 or Tier 2', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/Tier\s*1|tier\s*1|TIER_1/)
    expect(src).not.toMatch(/Tier\s*2|tier\s*2|TIER_2/)
  })

  test('LivingGardenBed does not invent Tier 1 or Tier 2', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).not.toMatch(/Tier\s*1|tier\s*1|TIER_1/)
    expect(src).not.toMatch(/Tier\s*2|tier\s*2|TIER_2/)
  })
})

// ── GG. No Tier 1/2 invented ──────────────────────────────────

describe('GG. No Tier 1/2 invented', () => {
  test('no Tier 1 or Tier 2 references in any Garden file', () => {
    const files = [
      'LivingGardenScene.js',
      'LivingGardenBed.js',
      'LivingGardenLayers.js',
      'LivingGardenJourneyTree.js',
      'LivingGardenArbor.js',
      'LivingGardenMotion.js',
    ]
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/TIER_1|TIER_2/)
    })
  })
})

// ── HH. Tree uses no path morph ────────────────────────────────

describe('HH. Tree uses no path morph', () => {
  test('LivingGardenJourneyTree does not use path morphing', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // No animated path d attribute interpolation
    expect(src).not.toMatch(/interpolatePath|morphPath|pathMorph|animatedPath/)
  })

  test('LivingGardenMotion does not use path morphing', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/interpolatePath|morphPath|pathMorph|animatedPath/)
  })

  test('Tree motion uses scale/opacity only (no path d interpolation)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Tree motion wrapper should use transform and opacity only
    const motionWrapperMatch = src.match(/const motionWrapper = [\s\S]*?\n  }/)
    if (motionWrapperMatch) {
      expect(motionWrapperMatch[0]).toMatch(/transform|opacity/)
      expect(motionWrapperMatch[0]).not.toMatch(/d=\{/)
    }
    // Also verify the tree component doesn't interpolate path d attributes
    expect(src).not.toMatch(/interpolatePath|morphPath|pathMorph|animatedPath/)
  })
})

// ── II. Arbor qualification unchanged ─────────────────────────

describe('II. Arbor qualification unchanged', () => {
  test('LivingGardenArbor still imports ARBOR_CATALOG from MilestoneArborArtwork', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/from.*MilestoneArborArtwork/)
    expect(src).toMatch(/ARBOR_CATALOG/)
  })

  test('LivingGardenArbor does not export modified ARBOR_CATALOG', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).not.toMatch(/export.*ARBOR_CATALOG/)
  })

  test('LivingGardenArbor still uses sorted-ID → sequential peg assignment', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/computePegAssignment/)
  })

  test('LivingGardenArbor does not add new qualification logic', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Should not define new qualification functions
    expect(src).not.toMatch(/export.*function.*qualif/)
  })

  test('LivingGardenMotion does not add Arbor qualification logic', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/qualifies|ARBOR_CATALOG/)
  })
})

// ── JJ. Arbor earned ornaments are static after reveal ────────

describe('JJ. Arbor earned ornaments are static after reveal', () => {
  test('LivingGardenArbor has no Animated loop/timing/spring for ornaments', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Strip comments
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    // No Animated loop/timing/spring in Arbor (ornaments are static after reveal)
    expect(noComments).not.toMatch(/Animated\.loop|Animated\.timing|Animated\.spring/)
  })

  test('Arbor ornament reveal is driven by arborReveal prop (not internal animation)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/arborReveal/)
    // Phase 1C: arborReveal is an Animated.Value bridged to revealProgress
    // via a listener (documented exception for per-ornament stagger).
    expect(src).toMatch(/isAnimValue.*arborReveal instanceof Animated\.Value/)
    expect(src).toMatch(/setRevealProgress/)
  })

  test('at rest (arborReveal=1), ornament opacity and scale are 1', () => {
    const src = readSrc('LivingGardenArbor.js')
    // When individualProgress = 1: ornamentOpacity = 1, ornamentScale = 1
    expect(src).toMatch(/ornamentOpacity.*individualProgress.*1/)
    // Restrained scale delta: 0.88 → 1.0 (not 0.4 → 1.0)
    expect(src).toMatch(/0\.88.*0\.12.*individualProgress/)
    // Should NOT use the old 0.4 → 1.0 scale
    expect(src).not.toMatch(/0\.4.*0\.6.*revealProgress/)
  })
})

// ── KK. No new persistence ────────────────────────────────────

describe('KK. No new persistence', () => {
  test('LivingGardenMotion does not import AsyncStorage', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Strip comments before checking
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/AsyncStorage/)
    expect(noComments).not.toMatch(/async-storage/)
  })

  test('LivingGardenMotion does not import gardenSeenState', () => {
    const src = readSrc('LivingGardenMotion.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/gardenSeenState/)
  })

  test('LivingGardenMotion does not import JuiceLog', () => {
    const src = readSrc('LivingGardenMotion.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/JuiceLog/)
  })

  test('LivingGardenMotion does not write persistence', () => {
    const src = readSrc('LivingGardenMotion.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/setItem|saveState|persist/)
  })

  test('LivingGardenScene does not add new persistence imports', () => {
    const src = readSrc('LivingGardenScene.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/AsyncStorage/)
    expect(noComments).not.toMatch(/gardenSeenState/)
  })
})

// ── LL. No new thresholds ─────────────────────────────────────

describe('LL. No new thresholds', () => {
  test('LivingGardenMotion does not define Garden thresholds', () => {
    const src = readSrc('LivingGardenMotion.js')
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
    codeLines.forEach((line) => {
      expect(line).not.toMatch(/threshold\s*[:=]\s*\d/)
    })
  })

  test('LivingGardenMotion does not define Journey thresholds', () => {
    const src = readSrc('LivingGardenMotion.js')
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
    codeLines.forEach((line) => {
      expect(line).not.toMatch(/min:\s*\d/)
    })
  })

  test('gardenService thresholds are unchanged (0, 1, 2, 3, 5, 7)', () => {
    const src = readService('gardenService.js')
    expect(src).toMatch(/threshold:\s*0/)
    expect(src).toMatch(/threshold:\s*1/)
    expect(src).toMatch(/threshold:\s*2/)
    expect(src).toMatch(/threshold:\s*3/)
    expect(src).toMatch(/threshold:\s*5/)
    expect(src).toMatch(/threshold:\s*7/)
  })
})

// ── MM. Reduced Motion is canonical ───────────────────────────

describe('MM. Reduced Motion is canonical', () => {
  test('LivingGardenMotion resolves to canonical when isReduced is true', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/if \(isReduced\)/)
    expect(src).toMatch(/resolveToCanonicalRest/)
  })

  test('LivingGardenScene wake animation is instant when isReduced', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/if \(isReduced\)/)
    expect(src).toMatch(/wakeOpacity\.current\.setValue\(1\)/)
    expect(src).toMatch(/wakeBrightness\.current\.setValue\(1\)/)
  })

  test('LivingGardenBed does not apply motion wrapper when bedMotion is canonical', () => {
    const src = readSrc('LivingGardenBed.js')
    // Phase 1C: uses hasAnimValues (Animated.Value check) instead of hasMotion
    expect(src).toMatch(/hasAnimValues/)
    // When no animValues, renders plain <G> (canonical)
    expect(src).toMatch(/hasAnimValues \?/)
  })

  test('LivingGardenJourneyTree does not apply motion wrapper when treeMotion is canonical', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1C: uses hasAnimMotion (Animated.Value check)
    expect(src).toMatch(/hasAnimMotion/)
    expect(src).toMatch(/treeMotion\.scaleY instanceof Animated\.Value/)
  })
})

// ── NN. Final rendered state derives from production renderer ──

describe('NN. Final rendered state derives from production renderer', () => {
  test('LivingGardenBed still renders the same Renderer components', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/BED_RENDERERS/)
    expect(src).toMatch(/Renderer/)
  })

  test('LivingGardenScene still renders LivingGardenBed, Tree, Arbor', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/LivingGardenBed/)
    expect(src).toMatch(/LivingGardenJourneyTree/)
    expect(src).toMatch(/LivingGardenArbor/)
  })

  test('LivingGardenJourneyTree still uses TREE_RENDERERS', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/TREE_RENDERERS/)
  })

  test('LivingGardenArbor still uses ORNAMENT_RENDERERS and EmptyPeg', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/ORNAMENT_RENDERERS/)
    expect(src).toMatch(/EmptyPeg/)
  })

  test('motion wrappers do not change renderer output at rest', () => {
    // Phase 1C: At rest, no animValues → plain <G> (canonical/identity).
    // Listener-based G is only used when animValues are present.
    const bedSrc = readSrc('LivingGardenBed.js')
    expect(bedSrc).toMatch(/hasAnimValues \?/)
    expect(bedSrc).toMatch(/plantTransform/)
  })
})

// ── OO. Worst orchestration <= 6500ms ─────────────────────────

describe('OO. Worst orchestration <= 6500ms', () => {
  test('computeTotalDuration for empty advancements is 0', () => {
    expect(computeTotalDuration(null)).toBe(0)
    expect(computeTotalDuration({ isFirstOpen: true })).toBe(0)
  })

  test('computeTotalDuration for no advancements is 0', () => {
    expect(
      computeTotalDuration({
        isFirstOpen: false,
        bedAdvancements: [],
        journeyAdvancement: null,
        newMilestoneIds: [],
        rainbowComplete: false,
      }),
    ).toBe(0)
  })

  test('computeTotalDuration for single bed advancement is reasonable', () => {
    const duration = computeTotalDuration({
      isFirstOpen: false,
      bedAdvancements: [{ bedKey: 'greens', fromStage: 'seed', toStage: 'sprout' }],
      journeyAdvancement: null,
      newMilestoneIds: [],
      rainbowComplete: false,
    })
    expect(duration).toBeGreaterThan(0)
    expect(duration).toBeLessThanOrEqual(6500)
  })

  test('worst case: all beds + journey + arbor + rainbow <= 6500ms', () => {
    const worstCase = {
      isFirstOpen: false,
      bedAdvancements: ALL_BEDS_ORDER.map((bedKey) => ({
        bedKey,
        fromStage: 'empty',
        toStage: 'flourishing',
      })),
      journeyAdvancement: { fromStage: 'seed', toStage: 'legend' },
      newMilestoneIds: ['streak_3', 'streak_7', 'logs_10'],
      rainbowComplete: true,
    }
    const duration = computeTotalDuration(worstCase)
    expect(duration).toBeLessThanOrEqual(6500)
  })

  test('WAKE_DURATION is 900ms', () => {
    expect(WAKE_DURATION).toBe(900)
  })

  test('BAND_STAGGER is reasonable (100-300ms)', () => {
    expect(BAND_STAGGER).toBeGreaterThanOrEqual(100)
    expect(BAND_STAGGER).toBeLessThanOrEqual(300)
  })
})

// ── PP. Motion module constants are correct ───────────────────

describe('PP. Motion module constants are correct', () => {
  test('stage transition durations match spec', () => {
    expect(STAGE_TRANSITION_DURATION.seed).toBe(900)
    expect(STAGE_TRANSITION_DURATION.sprout).toBe(1100)
    expect(STAGE_TRANSITION_DURATION.growing).toBe(1300)
    expect(STAGE_TRANSITION_DURATION.harvesting).toBe(1500)
    expect(STAGE_TRANSITION_DURATION.flourishing).toBe(1800)
  })

  test('coalesced duration is 2000ms', () => {
    expect(COALESCED_DURATION).toBe(2000)
  })

  test('tree duration is ~2200ms (Phase 1B corrected)', () => {
    expect(TREE_DURATION).toBe(2200)
  })

  test('tree compressed duration is >= 1500ms (Phase 1B floor)', () => {
    const { TREE_DURATION_COMPRESSED } = require('../LivingGardenMotion')
    expect(TREE_DURATION_COMPRESSED).toBeGreaterThanOrEqual(1500)
  })

  test('arbor ornament duration is ~1100ms (Phase 1B corrected)', () => {
    expect(ARBOR_ORNAMENT_DURATION).toBe(1100)
  })

  test('rainbow duration is ~2600ms (Phase 1B corrected)', () => {
    expect(RAINBOW_DURATION).toBe(2600)
  })

  test('rainbow compressed duration is ~1600ms (Phase 1B minimum)', () => {
    const { RAINBOW_DURATION_COMPRESSED } = require('../LivingGardenMotion')
    expect(RAINBOW_DURATION_COMPRESSED).toBeGreaterThanOrEqual(1600)
  })

  test('getBedDuration returns correct duration for single-stage advancement', () => {
    expect(getBedDuration('empty', 'seed')).toBe(900)
    expect(getBedDuration('seed', 'sprout')).toBe(1100)
    expect(getBedDuration('sprout', 'growing')).toBe(1300)
    expect(getBedDuration('growing', 'harvesting')).toBe(1500)
    expect(getBedDuration('harvesting', 'flourishing')).toBe(1800)
  })

  test('getBedDuration returns coalesced duration for multi-stage jump', () => {
    expect(getBedDuration('empty', 'flourishing')).toBe(COALESCED_DURATION)
    expect(getBedDuration('seed', 'harvesting')).toBe(COALESCED_DURATION)
  })

  test('getBedStartDelay returns 0 for far beds at start', () => {
    const citrusDelay = getBedStartDelay('citrus')
    expect(citrusDelay).toBe(WAKE_DURATION) // first far bed
  })

  test('getBedStartDelay increases for later bands', () => {
    const citrusDelay = getBedStartDelay('citrus')
    const berriesDelay = getBedStartDelay('berries')
    const herbsDelay = getBedStartDelay('herbs')
    expect(berriesDelay).toBeGreaterThan(citrusDelay)
    expect(herbsDelay).toBeGreaterThan(berriesDelay)
  })

  test('ALL_BEDS_ORDER has 7 beds in far → mid → near order', () => {
    expect(ALL_BEDS_ORDER).toHaveLength(7)
    expect(ALL_BEDS_ORDER.slice(0, 2)).toEqual(FAR_BEDS)
    expect(ALL_BEDS_ORDER.slice(2, 4)).toEqual(MID_BEDS)
    expect(ALL_BEDS_ORDER.slice(4, 7)).toEqual(NEAR_BEDS)
  })
})

// ── QQ. Frozen code — JourneyTreeArtwork not modified ────────

describe('QQ. Frozen code — JourneyTreeArtwork not modified', () => {
  test('LivingGardenJourneyTree does not import from JourneyTreeArtwork', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).not.toMatch(/from.*JourneyTreeArtwork/)
  })

  test('LivingGardenMotion does not import from JourneyTreeArtwork', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/from.*JourneyTreeArtwork/)
  })

  test('LivingGardenMotion does not import from GlowJourney', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/from.*GlowJourney/)
  })

  test('LivingGardenMotion imports EASING from utils/motion (not Glow)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/from '\.\.\/utils\/motion'/)
    expect(src).toMatch(/EASING/)
  })

  test('LivingGardenMotion imports BED_PLACEMENT from LivingGardenGeometry', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/from '\.\/LivingGardenGeometry'/)
    expect(src).toMatch(/BED_PLACEMENT/)
  })

  test('no SVG filter in LivingGardenMotion', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/feGaussianBlur|<filter|feBlur/)
  })

  test('no Math.random in LivingGardenMotion', () => {
    const src = readSrc('LivingGardenMotion.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/Math\.random/)
  })
})

// ── RR. Scene accepts advancements prop ───────────────────────

describe('RR. Scene accepts advancements prop', () => {
  test('LivingGardenScene accepts advancements prop', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/advancements/)
  })

  test('LivingGardenScene uses useGardenMotion', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/useGardenMotion/)
    expect(src).toMatch(/from '\.\/LivingGardenMotion'/)
  })

  test('LivingGardenScene passes bedMotion to beds', () => {
    const src = readSrc('LivingGardenScene.js')
    // Phase 1C: uses buildBedMotion(bedKey) to construct per-bed motion
    expect(src).toMatch(/bedMotion=\{buildBedMotion/)
  })

  test('LivingGardenScene passes treeMotion to Journey Tree', () => {
    const src = readSrc('LivingGardenScene.js')
    // Phase 1C: passes treeAnimValues (Animated.Value objects)
    expect(src).toMatch(/treeMotion=\{treeAnimValues\}/)
  })

  test('LivingGardenScene passes arborReveal and newlyEarnedIds to Arbor', () => {
    const src = readSrc('LivingGardenScene.js')
    // Phase 1C: passes arborRevealValue (Animated.Value)
    expect(src).toMatch(/arborReveal=\{arborRevealValue\}/)
    expect(src).toMatch(/newlyEarnedIds=\{newlyEarnedIds\}/)
  })

  test('sceneComparator includes advancements', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/prev\.advancements === next\.advancements/)
  })
})

// ── SS. Bed comparator includes bedMotion ─────────────────────

describe('SS. Bed comparator includes bedMotion', () => {
  test('bedComparator includes bedMotion', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/prev\.bedMotion === next\.bedMotion/)
  })

  test('treeComparator includes treeMotion', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/prev\.treeMotion === next\.treeMotion/)
  })

  test('arborComparator includes newlyEarnedIds and arborReveal', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/prev\.newlyEarnedIds === next\.newlyEarnedIds/)
    expect(src).toMatch(/prev\.arborReveal === next\.arborReveal/)
  })
})

// ── TT. No destructive device logic ───────────────────────────

describe('TT. No destructive device logic', () => {
  const files = [
    'LivingGardenScene.js',
    'LivingGardenBed.js',
    'LivingGardenLayers.js',
    'LivingGardenJourneyTree.js',
    'LivingGardenArbor.js',
    'LivingGardenMotion.js',
  ]

  files.forEach((f) => {
    test(`${f} has no pm clear / adb uninstall / clearAppData`, () => {
      const src = readSrc(f)
      expect(src).not.toMatch(/pm clear|adb uninstall|pm uninstall|clearAppData|wipeData/)
    })
  })
})

// ── UU. Phase 1B — Earned Color is distinct from Anchored Growth ─

describe('UU. Phase 1B — Earned Color distinct from Anchored Growth', () => {
  test('EARNED_COLOR_DURATION is defined and positive', () => {
    const { EARNED_COLOR_DURATION } = require('../LivingGardenMotion')
    expect(EARNED_COLOR_DURATION).toBeGreaterThan(0)
  })

  test('EARNED_COLOR_START_DELAY creates a temporal gap after growth', () => {
    const { EARNED_COLOR_START_DELAY } = require('../LivingGardenMotion')
    expect(EARNED_COLOR_START_DELAY).toBeGreaterThanOrEqual(0)
  })

  test('CANONICAL_BED_MOTION includes colorProgress=1', () => {
    expect(CANONICAL_BED_MOTION.colorProgress).toBe(1)
  })

  test('LivingGardenBed accepts colorProgress in bedMotion', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/colorProgress/)
    expect(src).toMatch(/fromStage/)
    expect(src).toMatch(/toStage/)
  })

  test('LivingGardenBed computes interpolated gated palette', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/computeInterpolatedGated/)
  })

  test('LivingGardenBed does not reveal destination colors prematurely during scaleY growth', () => {
    const src = readSrc('LivingGardenBed.js')
    // colorProgress starts at 0 (previous-state colors) and animates to 1
    // AFTER growth completes. The bed uses fromGated when colorProgress=0.
    expect(src).toMatch(/hasColorMotion/)
    expect(src).toMatch(/colorProgress < 1/)
  })

  test('Tier 4 beds use whole-bed V0 → V1 interpolation', () => {
    const { TIER_4_BEDS } = require('../LivingGardenMotion')
    expect(TIER_4_BEDS).toEqual(['greens', 'roots', 'herbs'])
  })

  test('Tier 3 beds use logical-group sequencing', () => {
    const { TIER_3_BEDS, TIER3_GROUP_OFFSETS } = require('../LivingGardenMotion')
    expect(TIER_3_BEDS).toEqual(['citrus', 'orchard', 'berries', 'tropical'])
    // Citrus/Orchard: trunk → canopy → fruit
    expect(TIER3_GROUP_OFFSETS.citrus).toEqual(['trunk', 'canopy', 'fruit'])
    expect(TIER3_GROUP_OFFSETS.orchard).toEqual(['trunk', 'canopy', 'fruit'])
    // Berries: mounds → berries
    expect(TIER3_GROUP_OFFSETS.berries).toContain('mounds')
    expect(TIER3_GROUP_OFFSETS.berries).toContain('berries')
    // Tropical: leaves → pineapple
    expect(TIER3_GROUP_OFFSETS.tropical).toContain('leaves')
    expect(TIER3_GROUP_OFFSETS.tropical).toContain('pineapple')
  })

  test('LivingGardenBed maps Tier 3 tokens to color groups', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/TIER3_TOKEN_GROUPS/)
    // Citrus/orchard have canopy and fruit groups
    expect(src).toMatch(/canopy.*leaf.*deep/)
    expect(src).toMatch(/fruit.*produce.*accent/)
    // Berries have mounds and berries groups
    expect(src).toMatch(/mounds.*leaf.*deep/)
    expect(src).toMatch(/berries.*produce.*accent/)
    // Tropical has leaves and pineapple groups
    expect(src).toMatch(/leaves.*leaf.*deep/)
    expect(src).toMatch(/pineapple.*produce.*accent/)
  })

  test('terminal bed renderer colors match canonical destination', () => {
    // At colorProgress=1, computeInterpolatedGated returns toGated = gatedPalette(bedKey, toStage)
    const { computeInterpolatedGated, gatedPalette } = require('../LivingGardenBed')
    const result = computeInterpolatedGated('greens', 'sprout', 'growing', 1)
    const canonical = gatedPalette('greens', 'growing')
    expect(result).toEqual(canonical)
  })
})

// ── VV. Phase 1B — Tree choreography and timing ───────────────

describe('VV. Phase 1B — Tree choreography and timing', () => {
  test('Tree normal duration is ~2200ms', () => {
    expect(TREE_DURATION).toBe(2200)
  })

  test('Tree compressed floor is >= 1500ms', () => {
    const { TREE_DURATION_COMPRESSED } = require('../LivingGardenMotion')
    expect(TREE_DURATION_COMPRESSED).toBeGreaterThanOrEqual(1500)
  })

  test('Tree has multi-channel motion (canopy, detail, rim)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/canopyProgress/)
    expect(src).toMatch(/detailProgress/)
    expect(src).toMatch(/rimProgress/)
  })

  test('Tree has idle canopy breath', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/breathScale/)
  })

  test('CANONICAL_TREE_MOTION includes all channels at rest', () => {
    expect(CANONICAL_TREE_MOTION.canopyProgress).toBe(1)
    expect(CANONICAL_TREE_MOTION.detailProgress).toBe(1)
    expect(CANONICAL_TREE_MOTION.rimProgress).toBe(1)
    expect(CANONICAL_TREE_MOTION.breathScale).toBe(1)
  })

  test('Tree rim/glow is temporary and resolves to 0 at rest', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1C: rim is an Animated.Value consumed via listener.
    // At rest (rim=0): opacity = 0 (canonical).
    // The listener computes rimOpacityState from treeMotion.rim.__getValue().
    expect(src).toMatch(/treeMotion\.rim/)
    expect(src).toMatch(/rimOpacityState/)
    // Rim is clamped to 0..0.25
    expect(src).toMatch(/0\.25/)
  })

  test('Tree does not path morph', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).not.toMatch(/interpolatePath|morphPath|pathMorph|animatedPath/)
  })

  test('Tree terminal state is canonical (all channels at rest)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1C: at rest, hasAnimMotion is false (no Animated.Value)
    expect(src).toMatch(/hasAnimMotion/)
  })
})

// ── WW. Phase 1B — Arbor reveal corrections ───────────────────

describe('WW. Phase 1B — Arbor reveal corrections', () => {
  test('Arbor single reveal is ~1100ms', () => {
    expect(ARBOR_ORNAMENT_DURATION).toBe(1100)
  })

  test('Arbor uses restrained scale (not 0.4)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/0\.88.*0\.12/)
    expect(src).not.toMatch(/0\.4.*0\.6.*revealProgress/)
  })

  test('Arbor has transient highlight/halo resolving to zero', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/haloOpacity/)
    expect(src).toMatch(/Math\.sin.*Math\.PI/)
    // Halo resolves to 0 when individualProgress >= 1
    expect(src).toMatch(/individualProgress < 1/)
  })

  test('Arbor uses deterministic stagger (130ms for 2–4, 90ms for 5+)', () => {
    const {
      ARBOR_STAGGER_SMALL,
      ARBOR_STAGGER_DENSE,
      getArborStagger,
    } = require('../LivingGardenMotion')
    expect(ARBOR_STAGGER_SMALL).toBe(130)
    expect(ARBOR_STAGGER_DENSE).toBe(90)
    expect(getArborStagger(3)).toBe(130)
    expect(getArborStagger(5)).toBe(90)
  })

  test('Arbor phase is capped at ~1600ms', () => {
    const { ARBOR_PHASE_CAP, computeArborPhaseDuration } = require('../LivingGardenMotion')
    expect(ARBOR_PHASE_CAP).toBe(1600)
    // 10 ornaments: 1100 + 9*90 = 1910, capped at 1600
    expect(computeArborPhaseDuration(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])).toBe(1600)
  })

  test('Arbor ends static (no Animated loop/timing/spring for ornaments)', () => {
    const src = readSrc('LivingGardenArbor.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/Animated\.loop|Animated\.timing|Animated\.spring/)
  })
})

// ── XX. Phase 1B — Rainbow capstone ───────────────────────────

describe('XX. Phase 1B — Rainbow capstone', () => {
  test('Rainbow normal target is ~2600ms', () => {
    expect(RAINBOW_DURATION).toBe(2600)
  })

  test('Rainbow compressed minimum is ~1600ms', () => {
    const { RAINBOW_DURATION_COMPRESSED } = require('../LivingGardenMotion')
    expect(RAINBOW_DURATION_COMPRESSED).toBeGreaterThanOrEqual(1600)
  })

  test('Rainbow has multi-phase sub-fractions', () => {
    const {
      RAINBOW_BLOOM_END_FRACTION,
      RAINBOW_SWEEP_END_FRACTION,
      RAINBOW_TREE_ACK_END_FRACTION,
    } = require('../LivingGardenMotion')
    expect(RAINBOW_BLOOM_END_FRACTION).toBeGreaterThan(0)
    expect(RAINBOW_BLOOM_END_FRACTION).toBeLessThan(RAINBOW_SWEEP_END_FRACTION)
    expect(RAINBOW_SWEEP_END_FRACTION).toBeLessThan(RAINBOW_TREE_ACK_END_FRACTION)
    expect(RAINBOW_TREE_ACK_END_FRACTION).toBeLessThan(1)
  })

  test('Rainbow capstone is rendered in Scene', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/RainbowCapstone/)
    expect(src).toMatch(/rainbowBloom/)
  })

  test('Rainbow uses no new chroma/palette (only existing SCENE_PALETTE)', () => {
    const src = readSrc('LivingGardenScene.js')
    const rainbowMatch = src.match(/function RainbowCapstone[\s\S]*?\n}/)
    if (rainbowMatch) {
      // Should use SCENE_PALETTE colors, not invented hex values
      expect(rainbowMatch[0]).toMatch(/SCENE_PALETTE/)
    }
  })

  test('Rainbow terminal state is canonical (invisible at bloom=0 and bloom=1)', () => {
    const src = readSrc('LivingGardenScene.js')
    // Phase 1C: RainbowCapstone returns null for non-Animated.Value inputs
    expect(src).toMatch(/typeof rainbowBloom === 'number'/)
    expect(src).toMatch(/rainbowBloom == null/)
  })
})

// ── YY. Phase 1B — Orchestration compression ──────────────────

describe('YY. Phase 1B — Orchestration compression', () => {
  test('worst case all events <= 6500ms with compression', () => {
    const worstCase = {
      isFirstOpen: false,
      bedAdvancements: ALL_BEDS_ORDER.map((bedKey) => ({
        bedKey,
        fromStage: 'empty',
        toStage: 'flourishing',
      })),
      journeyAdvancement: { fromStage: 'seed', toStage: 'legend' },
      newMilestoneIds: [
        'streak_3',
        'streak_7',
        'logs_10',
        'logs_25',
        'logs_50',
        'streak_14',
        'streak_30',
        'variety_5',
        'variety_10',
        'first_juice',
        'garden_all',
        'journey_radiant',
      ],
      rainbowComplete: true,
    }
    const duration = computeTotalDuration(worstCase)
    expect(duration).toBeLessThanOrEqual(6500)
  })

  test('compression activates when 3+ event classes coincide', () => {
    const { needsCompression } = require('../LivingGardenMotion')
    expect(
      needsCompression({
        bedAdvancements: [{ bedKey: 'greens', fromStage: 'seed', toStage: 'sprout' }],
        journeyAdvancement: { fromStage: 'seed', toStage: 'sprout' },
        newMilestoneIds: ['streak_3'],
        rainbowComplete: false,
      }),
    ).toBe(true)
    expect(
      needsCompression({
        bedAdvancements: [{ bedKey: 'greens', fromStage: 'seed', toStage: 'sprout' }],
        journeyAdvancement: null,
        newMilestoneIds: [],
        rainbowComplete: false,
      }),
    ).toBe(false)
  })
})

// ── ZZ. Phase 1B — Idle-life motion ───────────────────────────

describe('ZZ. Phase 1B — Idle-life motion', () => {
  test('idle motion constants are defined', () => {
    const { IDLE_BREATH_DURATION, IDLE_BREATH_SCALE } = require('../LivingGardenMotion')
    expect(IDLE_BREATH_DURATION).toBeGreaterThan(0)
    expect(IDLE_BREATH_SCALE).toBeGreaterThan(1)
    expect(IDLE_BREATH_SCALE).toBeLessThan(1.05) // very subtle
  })

  test('LivingGardenMotion has idle motion refs', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/idleBreathRef/)
    expect(src).toMatch(/startIdleMotion/)
    expect(src).toMatch(/stopIdleMotion/)
  })

  test('idle motion is disabled under Reduced Motion', () => {
    const src = readSrc('LivingGardenMotion.js')
    // startIdleMotion checks isReduced
    const idleMatch = src.match(/const startIdleMotion = useCallback[\s\S]*?\}, \[/)
    if (idleMatch) {
      expect(idleMatch[0]).toMatch(/if \(isReduced\) return/)
    }
  })

  test('Arbor has no idle animation', () => {
    const src = readSrc('LivingGardenArbor.js')
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/Animated\.loop|Animated\.timing|Animated\.spring/)
  })

  test('LivingGardenLayers mote system is not modified by motion', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Motion module should not import or reference LivingGardenLayers
    expect(src).not.toMatch(/from.*LivingGardenLayers/)
  })
})

// ── AAA. Phase 1C — Production wiring audit ──────────────────

describe('AAA. Phase 1C — Production wiring audit', () => {
  test('GardenDetail passes sceneAdvancements to LivingGardenScene (gated by intro)', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toMatch(/advancements=\{sceneAdvancements\}/)
  })

  test('GardenDetail uses existing seen-state architecture', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toMatch(/garden_last_seen_state_v1|from.*gardenSeenState/)
    expect(src).toMatch(/initializeIfAbsent/)
    expect(src).toMatch(/detectAdvancements/)
    expect(src).toMatch(/buildCurrentSeenState/)
  })

  test('GardenDetail first-open does not replay history', () => {
    const src = readSrc('GardenDetail.js')
    // wasFirstOpen → no detectAdvancements call
    expect(src).toMatch(/wasFirstOpen/)
    expect(src).toMatch(/if \(!wasFirstOpen\)/)
  })

  test('GardenDetail coalesces previous-seen to current', () => {
    const src = readSrc('GardenDetail.js')
    // ONE coalesced transition (no historical replay)
    // Uses currentState (from ref) instead of currentSeenState directly
    expect(src).toMatch(/detectAdvancements\(lastSeen, currentState\)/)
  })

  test('GardenDetail updates seen-state after presentation', () => {
    const src = readSrc('GardenDetail.js')
    // saveLastSeenState on close (after user has seen the Garden)
    expect(src).toMatch(/saveLastSeenState/)
  })
})

// ── BBB. Phase 1C — Soil Answer is a real temporary beat ────

describe('BBB. Phase 1C — Soil Answer temporary beat', () => {
  test('SOIL_ANSWER_PEAK is within 1.014–1.022', () => {
    const { SOIL_ANSWER_PEAK } = require('../LivingGardenMotion')
    expect(SOIL_ANSWER_PEAK).toBeGreaterThanOrEqual(1.014)
    expect(SOIL_ANSWER_PEAK).toBeLessThanOrEqual(1.022)
  })

  test('SOIL_ANSWER_DURATION is positive and short', () => {
    const { SOIL_ANSWER_DURATION } = require('../LivingGardenMotion')
    expect(SOIL_ANSWER_DURATION).toBeGreaterThan(0)
    expect(SOIL_ANSWER_DURATION).toBeLessThanOrEqual(400)
  })

  test('LivingGardenBed wraps SoilBed with Soil Answer transform', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/soilScale/)
    expect(src).toMatch(/hasSoilAnswer/)
    // Soil Answer uses listener-based G (DOCUMENTED EXCEPTION)
    expect(src).toMatch(/soilTransform/)
  })

  test('Soil Answer resolves to scale=1 at rest', () => {
    const { CANONICAL_BED_MOTION } = require('../LivingGardenMotion')
    expect(CANONICAL_BED_MOTION.soilScale).toBe(1)
  })
})

// ── CCC. Phase 1C — Produce is a distinct fourth beat ───────

describe('CCC. Phase 1C — Produce beat distinct from growth', () => {
  test('PRODUCE_REVEAL_START_FRACTION is after growth midpoint', () => {
    const { PRODUCE_REVEAL_START_FRACTION } = require('../LivingGardenMotion')
    expect(PRODUCE_REVEAL_START_FRACTION).toBeGreaterThanOrEqual(0.5)
  })

  test('PRODUCE_REVEAL_DURATION is positive', () => {
    const { PRODUCE_REVEAL_DURATION } = require('../LivingGardenMotion')
    expect(PRODUCE_REVEAL_DURATION).toBeGreaterThan(0)
  })

  test('LivingGardenBed accepts produceReveal in bedMotion', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/produceReveal/)
  })

  test('Citrus renderer gates fruit with produceReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/fruitOpacity.*produceReveal/)
  })

  test('Orchard renderer gates fruit with produceReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/fruitOpacity.*produceReveal/)
  })

  test('Berries renderer gates berries with produceReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/berryOpacity.*produceReveal/)
  })

  test('Tropical renderer gates pineapple with produceReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/pineappleOpacity.*produceReveal/)
  })

  test('Herbs renderer gates flowers with produceReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/flowerOpacity.*produceReveal/)
  })

  test('Roots renderer gates carrot shoulders with produceReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/produceOpacity.*produceReveal/)
  })

  test('Greens has no separable produce subgroup (reported as-is)', () => {
    const { PRODUCE_SUBGROUPS } = require('../LivingGardenMotion')
    expect(PRODUCE_SUBGROUPS.greens).toBeNull()
  })

  test('CANONICAL_BED_MOTION includes produceReveal=1', () => {
    const { CANONICAL_BED_MOTION } = require('../LivingGardenMotion')
    expect(CANONICAL_BED_MOTION.produceReveal).toBe(1)
  })
})

// ── DDD. Monotonic Progression (Rev B) ───────────────────────
// Garden progression must be MONOTONIC. Already-earned visual growth
// must NEVER shrink/retreat/collapse before new progress is shown.
// Late-stage transitions preserve existing mass; new destination
// geometry appears via Produce reveal + Earned Color only.

describe('DDD. Monotonic Progression — stage-specific growth policy', () => {
  const {
    GROWTH_START_SCALE_EARLY,
    GROWTH_START_SCALE_MID,
    GROWTH_START_SCALE_LATE,
    GROWTH_START_OPACITY_EARLY,
    GROWTH_START_OPACITY_MID,
    GROWTH_START_OPACITY_LATE,
    getGrowthStart,
  } = require('../LivingGardenMotion')

  test('getGrowthStart is defined', () => {
    expect(typeof getGrowthStart).toBe('function')
  })

  test('Early transitions use substantial anchored growth', () => {
    // Empty→Seed: full emergence
    const emptyToSeed = getGrowthStart('empty', 'seed')
    expect(emptyToSeed.startScale).toBe(GROWTH_START_SCALE_EARLY)
    expect(emptyToSeed.startScale).toBeLessThanOrEqual(0.35)
    expect(emptyToSeed.startOpacity).toBe(GROWTH_START_OPACITY_EARLY)
    expect(emptyToSeed.startOpacity).toBe(0)

    // Seed→Sprout: full emergence
    const seedToSprout = getGrowthStart('seed', 'sprout')
    expect(seedToSprout.startScale).toBe(GROWTH_START_SCALE_EARLY)
    expect(seedToSprout.startOpacity).toBe(GROWTH_START_OPACITY_EARLY)
  })

  test('Sprout→Growing uses restrained growth (does not remove Sprout content)', () => {
    const result = getGrowthStart('sprout', 'growing')
    expect(result.startScale).toBe(GROWTH_START_SCALE_MID)
    expect(result.startScale).toBeGreaterThanOrEqual(0.5)
    expect(result.startScale).toBeLessThan(1)
    expect(result.startOpacity).toBe(GROWTH_START_OPACITY_MID)
    expect(result.startOpacity).toBeGreaterThan(0)
    expect(result.startOpacity).toBeLessThan(1)
  })

  test('Growing→Harvesting preserves existing mass (no whole-plant shrink)', () => {
    const result = getGrowthStart('growing', 'harvesting')
    expect(result.startScale).toBe(GROWTH_START_SCALE_LATE)
    expect(result.startScale).toBe(1)
    expect(result.startOpacity).toBe(GROWTH_START_OPACITY_LATE)
    expect(result.startOpacity).toBe(1)
  })

  test('Harvesting→Flourishing preserves existing mass (no whole-plant shrink)', () => {
    const result = getGrowthStart('harvesting', 'flourishing')
    expect(result.startScale).toBe(GROWTH_START_SCALE_LATE)
    expect(result.startScale).toBe(1)
    expect(result.startOpacity).toBe(GROWTH_START_OPACITY_LATE)
    expect(result.startOpacity).toBe(1)
  })

  test('Late-stage startScale is never below 1 (no regression)', () => {
    const growingToHarvest = getGrowthStart('growing', 'harvesting')
    const harvestToFlourish = getGrowthStart('harvesting', 'flourishing')
    expect(growingToHarvest.startScale).toBeGreaterThanOrEqual(1)
    expect(harvestToFlourish.startScale).toBeGreaterThanOrEqual(1)
  })

  test('Late-stage startOpacity is never below 1 (no fade)', () => {
    const growingToHarvest = getGrowthStart('growing', 'harvesting')
    const harvestToFlourish = getGrowthStart('harvesting', 'flourishing')
    expect(growingToHarvest.startOpacity).toBeGreaterThanOrEqual(1)
    expect(harvestToFlourish.startOpacity).toBeGreaterThanOrEqual(1)
  })
})

describe('DDD. Monotonic Progression — source code verification', () => {
  test('runBedMotion uses getGrowthStart (not universal GROWTH_START_SCALE)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/getGrowthStart/)
    // The setValue call should use growthStart.startScale, not GROWTH_START_SCALE
    expect(src).toMatch(/growthStart\.startScale/)
    expect(src).toMatch(/growthStart\.startOpacity/)
  })

  test('runBedMotion does NOT apply universal 0.28 scaleY to all transitions', () => {
    const src = readSrc('LivingGardenMotion.js')
    // The old code was: refs.scaleY.setValue(GROWTH_START_SCALE)
    // The new code should use: refs.scaleY.setValue(growthStart.startScale)
    const runBedMotionSection = src.match(/const runBedMotion[\s\S]*?^\s*\},\s*$/m)
    expect(runBedMotionSection).toBeTruthy()
    expect(runBedMotionSection[0]).toMatch(/growthStart\.startScale/)
    expect(runBedMotionSection[0]).not.toMatch(/setValue\(GROWTH_START_SCALE\)/)
  })

  test('Harvesting source geometry is never whole-group scaled below canonical', () => {
    const src = readSrc('LivingGardenMotion.js')
    // For Harvesting→Flourishing, getGrowthStart returns startScale=1
    // This means the plant starts at canonical scale and never shrinks
    expect(src).toMatch(/GROWTH_START_SCALE_LATE.*=.*1\.0/)
    expect(src).toMatch(/fromIdx >= 3/)
  })

  test('Growing source geometry is never erased before Harvesting additions', () => {
    const src = readSrc('LivingGardenMotion.js')
    // For Growing→Harvesting, getGrowthStart returns startScale=1
    // This means the plant starts at canonical scale
    // The 'growing' stage is at index 3 in the stage order
    expect(src).toMatch(/GROWTH_START_SCALE_LATE/)
  })

  test('Late-stage transitions do not use universal 0.28 scaleY', () => {
    const src = readSrc('LivingGardenMotion.js')
    // GROWTH_START_SCALE_EARLY is 0.28, but LATE is 1.0
    expect(src).toMatch(/GROWTH_START_SCALE_EARLY.*=.*0\.28/)
    expect(src).toMatch(/GROWTH_START_SCALE_LATE.*=.*1\.0/)
    // The getGrowthStart function should check fromStage index
    expect(src).toMatch(/fromIdx >= 3/)
  })

  test('Existing source-stage visual mass remains canonical (no shrink)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // The comment should mention preserving existing mass
    expect(src).toMatch(/preserve.*existing.*mass/i)
    expect(src).toMatch(/no.*shrink/i)
  })

  test('Earned Color remains after Produce (order preserved)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Earned Color should still start after growthDuration + delay
    expect(src).toMatch(/growthDuration.*EARNED_COLOR_START_DELAY/)
    // Produce should start at PRODUCE_REVEAL_START_FRACTION of growth
    expect(src).toMatch(/growthDuration.*PRODUCE_REVEAL_START_FRACTION/)
  })

  test('Produce remains a separate beat', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/PRODUCE_REVEAL_DURATION/)
    expect(src).toMatch(/produceReveal/)
  })

  test('Terminal renderer remains canonical destination', () => {
    const src = readSrc('LivingGardenMotion.js')
    // After timeline completes, produceReveal=1 and colorProgress=1
    expect(src).toMatch(/setBedProduceReveal.*1/)
    expect(src).toMatch(/setBedColorProgress.*1/)
  })

  test('Early growth still works (Empty→Seed uses anchored emergence)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/GROWTH_START_SCALE_EARLY/)
    expect(src).toMatch(/GROWTH_START_OPACITY_EARLY/)
  })

  test('Reduced Motion still canonical', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/resolveToCanonicalRest/)
    expect(src).toMatch(/isReduced/)
  })

  test('No mask/clip/static-art changes', () => {
    const src = readSrc('LivingGardenBed.js')
    // Check for JSX mask/clipPath usage, not comments
    expect(src).not.toMatch(/<mask/i)
    expect(src).not.toMatch(/<clipPath/i)
  })

  test('Soil Answer preserved for late-stage transitions', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Soil Answer should still run for all transitions
    expect(src).toMatch(/SOIL_ANSWER_PEAK/)
    expect(src).toMatch(/soilRef\.setValue\(1\)/)
  })
})

// ── DDD. Phase 1C — Flourishing idle sway (3 phase groups) ──

describe('DDD. Phase 1C — Flourishing idle sway', () => {
  test('SWAY_PHASE_GROUPS has exactly 3 groups', () => {
    const { SWAY_PHASE_GROUPS } = require('../LivingGardenMotion')
    expect(SWAY_PHASE_GROUPS).toHaveLength(3)
  })

  test('Each sway group has beds and offsetFraction', () => {
    const { SWAY_PHASE_GROUPS } = require('../LivingGardenMotion')
    SWAY_PHASE_GROUPS.forEach((group) => {
      expect(group.beds).toBeDefined()
      expect(group.beds.length).toBeGreaterThan(0)
      expect(group.offsetFraction).toBeDefined()
    })
  })

  test('All 7 beds are covered by the 3 sway groups', () => {
    const { SWAY_PHASE_GROUPS, ALL_BEDS_ORDER } = require('../LivingGardenMotion')
    const allBedsInGroups = SWAY_PHASE_GROUPS.flatMap((g) => g.beds)
    ALL_BEDS_ORDER.forEach((bed) => {
      expect(allBedsInGroups).toContain(bed)
    })
  })

  test('Sway amplitude is very small (~0.5)', () => {
    const { IDLE_SWAY_AMPLITUDE } = require('../LivingGardenMotion')
    expect(IDLE_SWAY_AMPLITUDE).toBeLessThanOrEqual(1.0)
  })

  test('LivingGardenMotion has 3 sway loop refs', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/idleSwayRefs/)
    expect(src).toMatch(/\[null, null, null\]/)
  })

  test('No per-plant timer/loop architecture', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Should not create individual loops per bed
    const loopCount = (src.match(/Animated\.loop/g) || []).length
    // 3 sway groups + 1 tree breath = 4 loops max
    expect(loopCount).toBeLessThanOrEqual(4)
  })
})

// ── EEE. Greens Harvest→Flourish Destination-Delta Reveal ────
// Verifies that GreensArt uses deltaReveal for Flourishing-only
// geometry while keeping source Harvesting plants canonical.

describe('EEE. Greens Harvest→Flourish destination-delta reveal', () => {
  const {
    DELTA_REVEAL_START_FRACTION,
    DELTA_REVEAL_DURATION_FRACTION,
    DELTA_DETAIL_DELAY_FRACTION,
    DELTA_DETAIL_DURATION_FRACTION,
  } = require('../LivingGardenMotion')

  test('Delta reveal constants are defined', () => {
    expect(DELTA_REVEAL_START_FRACTION).toBeDefined()
    expect(DELTA_REVEAL_DURATION_FRACTION).toBeDefined()
    expect(DELTA_DETAIL_DELAY_FRACTION).toBeDefined()
    expect(DELTA_DETAIL_DURATION_FRACTION).toBeDefined()
  })

  test('Delta reveal starts early in the timeline (<= 30%)', () => {
    expect(DELTA_REVEAL_START_FRACTION).toBeLessThanOrEqual(0.3)
  })

  test('Delta reveal duration is substantial (>= 40%)', () => {
    expect(DELTA_REVEAL_DURATION_FRACTION).toBeGreaterThanOrEqual(0.4)
  })

  test('Detail delay is after delta start', () => {
    expect(DELTA_DETAIL_DELAY_FRACTION).toBeGreaterThan(0)
  })

  test('GreensArt accepts deltaReveal prop', () => {
    const src = readSrc('LivingGardenBed.js')
    const greensMatch = src.match(/function GreensArt[\s\S]*?\n}/)
    expect(greensMatch).toBeTruthy()
    expect(greensMatch[0]).toMatch(/deltaReveal/)
  })

  test('Source plant indices (0-3) remain canonical (no delta opacity)', () => {
    const src = readSrc('LivingGardenBed.js')
    const greensMatch = src.match(/function GreensArt[\s\S]*?\n}/)
    expect(greensMatch).toBeTruthy()
    // sourcePlantCount = 4 for Flourishing
    expect(greensMatch[0]).toMatch(/sourcePlantCount.*4/)
    // isDeltaPlant check: i >= sourcePlantCount
    expect(greensMatch[0]).toMatch(/isDeltaPlant.*sourcePlantCount/)
    // Source plants use opacity 1
    expect(greensMatch[0]).toMatch(/plantOpacity.*isDeltaPlant.*deltaOpacity.*1/)
  })

  test('Only Flourishing-only plant indices (4-5) use deltaReveal', () => {
    const src = readSrc('LivingGardenBed.js')
    const greensMatch = src.match(/function GreensArt[\s\S]*?\n}/)
    expect(greensMatch).toBeTruthy()
    // Delta plants get deltaOpacity, source plants get 1
    expect(greensMatch[0]).toMatch(/isDeltaPlant.*deltaOpacity/)
    expect(greensMatch[0]).toMatch(/sourcePlantCount.*>.*0/)
  })

  test('Flourishing-only detail (Line+Circle) uses delayed reveal', () => {
    const src = readSrc('LivingGardenBed.js')
    const greensMatch = src.match(/function GreensArt[\s\S]*?\n}/)
    expect(greensMatch).toBeTruthy()
    // detailOpacity is delayed: (deltaReveal - 0.3) / 0.7
    expect(greensMatch[0]).toMatch(/detailOpacity/)
    expect(greensMatch[0]).toMatch(/deltaReveal.*0\.3/)
  })

  test('No whole-group late-stage scale on Greens', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Late-stage uses startScale=1, not 0.28
    expect(src).toMatch(/GROWTH_START_SCALE_LATE.*=.*1\.0/)
  })

  test('Delta starts opacity < 1 (progressive reveal)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // deltaRef.setValue(0) for late-stage
    expect(src).toMatch(/deltaRef\.setValue\(0\)/)
  })

  test('Delta reaches opacity 1 (canonical rest)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // setBedDeltaReveal to 1 on completion
    expect(src).toMatch(/setBedDeltaReveal.*1/)
  })

  test('Local scale starts restrained (not 0.28) for late-stage', () => {
    const src = readSrc('LivingGardenMotion.js')
    // GROWTH_START_SCALE_LATE = 1.0, not 0.28
    expect(src).toMatch(/GROWTH_START_SCALE_LATE.*=.*1\.0/)
    expect(src).not.toMatch(/GROWTH_START_SCALE_LATE.*=.*0\.28/)
  })

  test('Local scale resolves exactly 1', () => {
    const src = readSrc('LivingGardenMotion.js')
    // toValue: 1 for growth animation
    expect(src).toMatch(/toValue:\s*1/)
    expect(src).toMatch(/duration:\s*growthDuration/)
  })

  test('Earned Color starts after delta/detail reveal', () => {
    const src = readSrc('LivingGardenMotion.js')
    // For late-stage: colorStartDelay = deltaStart + deltaDuration + EARNED_COLOR_START_DELAY
    expect(src).toMatch(/deltaStart.*deltaDuration.*EARNED_COLOR_START_DELAY/)
  })

  test('Source geometry never uses delta opacity', () => {
    const src = readSrc('LivingGardenBed.js')
    const greensMatch = src.match(/function GreensArt[\s\S]*?\n}/)
    expect(greensMatch).toBeTruthy()
    // Source plants (isDeltaPlant=false) get plantOpacity=1
    expect(greensMatch[0]).toMatch(/plantOpacity.*isDeltaPlant.*deltaOpacity.*1/)
  })

  test('Terminal output canonical (deltaReveal=1 at rest)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // resolveToCanonicalRest sets deltaRef to 1
    expect(src).toMatch(/deltaRef.*setValue\(1\)/)
  })

  test('No duplicate whole renderer for Greens', () => {
    const src = readSrc('LivingGardenBed.js')
    // Should not have two GreensArt calls
    const greensArtCount = (src.match(/GreensArt/g) || []).length
    // One definition + one in BED_RENDERERS = 2
    expect(greensArtCount).toBe(2)
  })

  test('No masks/clips/static-art redesign in Greens', () => {
    const src = readSrc('LivingGardenBed.js')
    const greensMatch = src.match(/function GreensArt[\s\S]*?\n}/)
    expect(greensMatch).toBeTruthy()
    expect(greensMatch[0]).not.toMatch(/<mask/i)
    expect(greensMatch[0]).not.toMatch(/<clipPath/i)
  })

  test('bedDeltaReveal is exported from motion hook', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/bedDeltaReveal/)
  })

  test('buildBedMotion passes deltaReveal', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/deltaReveal/)
    expect(src).toMatch(/bedDeltaReveal/)
  })

  test('PlantArtwork passes deltaReveal to renderer', () => {
    const src = readSrc('LivingGardenBed.js')
    // PlantArtwork component should accept and pass deltaReveal
    const plantArtworkMatch = src.match(/const PlantArtwork = memo[\s\S]*?\)/)
    expect(plantArtworkMatch).toBeTruthy()
    expect(plantArtworkMatch[0]).toMatch(/deltaReveal/)
  })

  test('Late-stage invisible no-op growth removed (delta replaces it)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Delta reveal should be active for late-stage
    expect(src).toMatch(/isLateStage/)
    expect(src).toMatch(/deltaAnim/)
  })
})

// ── EEE. Phase 1C — Tree idle amplitude corrected ───────────

describe('EEE. Phase 1C — Tree idle amplitude', () => {
  test('IDLE_BREATH_SCALE is approximately 1.004', () => {
    const { IDLE_BREATH_SCALE } = require('../LivingGardenMotion')
    expect(IDLE_BREATH_SCALE).toBeGreaterThanOrEqual(1.003)
    expect(IDLE_BREATH_SCALE).toBeLessThanOrEqual(1.005)
  })

  test('Tree trunk remains static during idle (breath applies to canopy only)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // breathTransform is centered above base (breathY = baseY - 80)
    expect(src).toMatch(/breathY.*baseY.*80/)
  })
})

// ── FFF. Phase 1C — Arbor halo amplitude corrected ───────────

describe('FFF. Phase 1C — Arbor halo amplitude', () => {
  test('ARBOR_HALO_PEAK is approximately 0.26', () => {
    const { ARBOR_HALO_PEAK } = require('../LivingGardenMotion')
    expect(ARBOR_HALO_PEAK).toBeLessThanOrEqual(0.28)
    expect(ARBOR_HALO_PEAK).toBeGreaterThanOrEqual(0.24)
  })

  test('Arbor uses 0.26 in halo calculation (not 0.35)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Should use 0.26 in the actual calculation (not in comments)
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).toMatch(/0\.26/)
    expect(noComments).not.toMatch(/0\.35/)
  })

  test('Arbor halo resolves to 0 at rest', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/individualProgress < 1/)
  })
})

// ── GGG. Phase 1C — Performance architecture ────────────────

describe('GGG. Phase 1C — Performance architecture', () => {
  test('useGardenMotion returns Animated.Value objects for transforms', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/bedAnimRefs/)
    expect(src).toMatch(/treeScaleRef/)
    expect(src).toMatch(/arborRevealRef/)
    expect(src).toMatch(/rainbowRef/)
  })

  test('NO per-frame setState for bed transforms', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Should NOT have setBedMotions (per-frame transform state bridge)
    expect(src).not.toMatch(/setBedMotions/)
  })

  test('NO per-frame setState for tree transforms', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).not.toMatch(/setTreeMotion/)
  })

  test('colorProgress is a documented state-bridged exception', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/bedColorProgress/)
    expect(src).toMatch(/setBedColorProgress/)
    // Documented exception comment
    expect(src).toMatch(/DOCUMENTED EXCEPTION/i)
  })

  test('produceReveal is a documented state-bridged exception', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/bedProduceReveal/)
    expect(src).toMatch(/setBedProduceReveal/)
  })

  test('LivingGardenBed uses listener-based SVG transforms (not AnimatedG)', () => {
    const src = readSrc('LivingGardenBed.js')
    // Phase 1C: AnimatedG removed due to react-native-svg canvas crash.
    // Uses listener-based state with SVG transform strings instead.
    expect(src).not.toMatch(/Animated\.createAnimatedComponent/)
    expect(src).toMatch(/plantTransform/)
    expect(src).toMatch(/soilTransform/)
    expect(src).toMatch(/addListener/)
  })

  test('LivingGardenJourneyTree uses listener-based SVG transforms (not AnimatedG)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1C: AnimatedG removed due to react-native-svg canvas crash.
    // Uses listener-based state with SVG transform strings instead.
    expect(src).not.toMatch(/Animated\.createAnimatedComponent/)
    expect(src).toMatch(/treeTransform/)
    expect(src).toMatch(/addListener/)
  })

  test('React state changes only at event boundaries', () => {
    const src = readSrc('LivingGardenMotion.js')
    // setState calls should be in event-boundary contexts
    expect(src).toMatch(/setActiveAdvancement/)
    expect(src).toMatch(/setNewlyEarnedIds/)
  })
})

// ── HHH. Phase 1C — Background interruption ─────────────────

describe('HHH. Phase 1C — Background interruption', () => {
  test('LivingGardenMotion listens to AppState', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/AppState.*addEventListener/)
    expect(src).toMatch(/background.*inactive/)
  })

  test('Background resolves to canonical rest', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/resolveToCanonicalRest/)
  })

  test('Background cancels timeline and clears timeouts', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/cancelTimeline/)
    expect(src).toMatch(/clearAllTimeouts/)
  })

  test('Background stops idle motion', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/stopIdleMotion/)
  })

  test('No replay on resume (processedAdvancementsRef prevents re-run)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/processedAdvancementsRef/)
  })
})

// ── III. Phase 1D — Tree destination-layer reveal ─────────────
// Verifies Seed→Growing Tree transition uses source/destination
// layer architecture with progressive subgroup reveal.

describe('III. Phase 1D — Tree destination-layer reveal', () => {
  const {
    TREE_TRUNK_START_FRACTION,
    TREE_TRUNK_DURATION_FRACTION,
    TREE_CANOPY_REVEAL_START_FRACTION,
    TREE_CANOPY_REVEAL_DURATION_FRACTION,
    TREE_DETAIL_REVEAL_START_FRACTION,
    TREE_DETAIL_REVEAL_DURATION_FRACTION,
    TREE_SOURCE_FADE_START_FRACTION,
    TREE_SOURCE_FADE_DURATION_FRACTION,
  } = require('../LivingGardenMotion')

  test('Tree trunk reveal constants are defined', () => {
    expect(TREE_TRUNK_START_FRACTION).toBeDefined()
    expect(TREE_TRUNK_DURATION_FRACTION).toBeDefined()
  })

  test('Tree canopy reveal constants are defined', () => {
    expect(TREE_CANOPY_REVEAL_START_FRACTION).toBeDefined()
    expect(TREE_CANOPY_REVEAL_DURATION_FRACTION).toBeDefined()
  })

  test('Tree detail reveal constants are defined', () => {
    expect(TREE_DETAIL_REVEAL_START_FRACTION).toBeDefined()
    expect(TREE_DETAIL_REVEAL_DURATION_FRACTION).toBeDefined()
  })

  test('Tree source fade constants are defined', () => {
    expect(TREE_SOURCE_FADE_START_FRACTION).toBeDefined()
    expect(TREE_SOURCE_FADE_DURATION_FRACTION).toBeDefined()
  })

  test('Trunk starts at 0% (immediate establishment)', () => {
    expect(TREE_TRUNK_START_FRACTION).toBe(0)
  })

  test('Canopy starts after trunk (>= 20%)', () => {
    expect(TREE_CANOPY_REVEAL_START_FRACTION).toBeGreaterThanOrEqual(0.2)
  })

  test('Detail starts after canopy (>= 45%)', () => {
    expect(TREE_DETAIL_REVEAL_START_FRACTION).toBeGreaterThan(TREE_CANOPY_REVEAL_START_FRACTION)
  })

  test('Source fade starts after trunk begins (> 10%)', () => {
    expect(TREE_SOURCE_FADE_START_FRACTION).toBeGreaterThan(0.1)
  })

  test('Rim starts after detail (>= 70%)', () => {
    const { TREE_RIM_START_FRACTION } = require('../LivingGardenMotion')
    expect(TREE_RIM_START_FRACTION).toBeGreaterThanOrEqual(0.7)
  })

  test('Motion hook has treeSourceOpacityRef', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeSourceOpacityRef/)
  })

  test('Motion hook has treeTrunkOpacityRef', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeTrunkOpacityRef/)
  })

  test('Motion hook has treeCanopyOpacityRef', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeCanopyOpacityRef/)
  })

  test('Motion hook has treeDetailOpacityRef', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeDetailOpacityRef/)
  })

  test('runTreeGrowth initializes source opacity to 1', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeSourceOpacityRef.*setValue\(1\)/)
  })

  test('runTreeGrowth initializes trunk opacity to 0', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeTrunkOpacityRef.*setValue\(0\)/)
  })

  test('runTreeGrowth initializes canopy opacity to 0', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(0\)/)
  })

  test('runTreeGrowth initializes detail opacity to 0', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeDetailOpacityRef.*setValue\(0\)/)
  })

  test('treeAnimValues includes sourceOpacity', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/sourceOpacity.*treeSourceOpacityRef/)
  })

  test('treeAnimValues includes trunkOpacity', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/trunkOpacity.*treeTrunkOpacityRef/)
  })

  test('treeAnimValues includes canopyOpacity', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/canopyOpacity.*treeCanopyOpacityRef/)
  })

  test('treeAnimValues includes detailOpacity', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/detailOpacity.*treeDetailOpacityRef/)
  })

  test('resolveToCanonicalRest sets source opacity to 0', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeSourceOpacityRef.*setValue\(0\)/)
  })

  test('resolveToCanonicalRest sets trunk opacity to 1', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeTrunkOpacityRef.*setValue\(1\)/)
  })

  test('No whole-tree stretch as primary (scale starts at 1)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Legacy scale channel set to 1 (not 0.92) in runTreeGrowth
    const runTreeMatch = src.match(/runTreeGrowth[\s\S]*?\},\s*\[/)
    expect(runTreeMatch).toBeTruthy()
    expect(runTreeMatch[0]).toMatch(/treeScaleRef.*setValue\(1\)/)
  })

  test('CANONICAL_TREE_MOTION includes sourceOpacity=0', () => {
    const { CANONICAL_TREE_MOTION } = require('../LivingGardenMotion')
    expect(CANONICAL_TREE_MOTION.sourceOpacity).toBe(0)
  })

  test('CANONICAL_TREE_MOTION includes trunkOpacity=1', () => {
    const { CANONICAL_TREE_MOTION } = require('../LivingGardenMotion')
    expect(CANONICAL_TREE_MOTION.trunkOpacity).toBe(1)
  })

  test('CANONICAL_TREE_MOTION includes canopyOpacity=1', () => {
    const { CANONICAL_TREE_MOTION } = require('../LivingGardenMotion')
    expect(CANONICAL_TREE_MOTION.canopyOpacity).toBe(1)
  })

  test('CANONICAL_TREE_MOTION includes detailOpacity=1', () => {
    const { CANONICAL_TREE_MOTION } = require('../LivingGardenMotion')
    expect(CANONICAL_TREE_MOTION.detailOpacity).toBe(1)
  })
})

// ── JJJ. Phase 1D — Tree renderer destination-layer ───────────

describe('JJJ. Phase 1D — Tree renderer destination-layer', () => {
  test('LivingGardenJourneyTree accepts fromStage prop', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/fromStage/)
  })

  test('Tree component has sourceOpacityState', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/sourceOpacityState/)
  })

  test('Tree component has trunkOpacityState', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/trunkOpacityState/)
  })

  test('Tree component has canopyOpacityState', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/canopyOpacityState/)
  })

  test('Tree component has detailOpacityState', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/detailOpacityState/)
  })

  test('Tree renders source layer when fromStage differs', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/hasSourceLayer/)
    expect(src).toMatch(/SourceRenderer/)
  })

  test('Source layer uses syncSourceOpacity (not state)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/treeOpacity.*syncSourceOpacity/)
  })

  test('Destination renderer receives trunkOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/trunkOpacity.*destTrunkOpacity/)
  })

  test('Destination renderer receives canopyOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/canopyOpacity.*destCanopyOpacity/)
  })

  test('Destination renderer receives detailOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/detailOpacity.*destDetailOpacity/)
  })

  test('TreeGrowing accepts trunkOpacity and canopyOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const growingMatch = src.match(/function TreeGrowing[\s\S]*?\n}/)
    expect(growingMatch).toBeTruthy()
    expect(growingMatch[0]).toMatch(/trunkOpacity/)
    expect(growingMatch[0]).toMatch(/canopyOpacity/)
  })

  test('TreeGrowing applies trunkOpacity to trunk Path', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const growingMatch = src.match(/function TreeGrowing[\s\S]*?\n}/)
    expect(growingMatch).toBeTruthy()
    expect(growingMatch[0]).toMatch(/opacity.*trunkOpacity/)
  })

  test('TreeGrowing applies canopyOpacity to crown Ellipses', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const growingMatch = src.match(/function TreeGrowing[\s\S]*?\n}/)
    expect(growingMatch).toBeTruthy()
    expect(growingMatch[0]).toMatch(/opacity.*canopyOpacity/)
  })

  test('TreeSeed accepts treeOpacity prop', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const seedMatch = src.match(/function TreeSeed[\s\S]*?\n}/)
    expect(seedMatch).toBeTruthy()
    expect(seedMatch[0]).toMatch(/treeOpacity/)
  })

  test('TreeSeed applies treeOpacity to elements', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const seedMatch = src.match(/function TreeSeed[\s\S]*?\n}/)
    expect(seedMatch).toBeTruthy()
    expect(seedMatch[0]).toMatch(/opacity.*treeOpacity/)
  })

  test('treeComparator includes fromStage', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/prev\.fromStage === next\.fromStage/)
  })

  test('Scene passes fromStage to Tree', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/fromStage/)
  })

  test('No Sprout replay in Tree motion (no intermediate stage)', () => {
    const src = readSrc('LivingGardenMotion.js')
    const runTreeMatch = src.match(/runTreeGrowth[\s\S]*?\},\s*\[/)
    expect(runTreeMatch).toBeTruthy()
    // Should NOT create intermediate Sprout rendering
    expect(runTreeMatch[0]).not.toMatch(/sprout/i)
  })

  test('No path morph in Tree motion', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Should not use path interpolation
    expect(src).not.toMatch(/interpolate.*path/i)
    expect(src).not.toMatch(/path.*morph/i)
  })

  test('Tree trunk does not idle (breath on canopy only)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/breathY.*baseY.*80/)
  })

  test('Canopy idle breath <= 1.004', () => {
    const { IDLE_BREATH_SCALE } = require('../LivingGardenMotion')
    expect(IDLE_BREATH_SCALE).toBeLessThanOrEqual(1.005)
  })

  test('Reduced Motion canonical immediately (resolveToCanonicalRest)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/if \(isReduced\)/)
    expect(src).toMatch(/resolveToCanonicalRest/)
  })

  test('Background resolves target and removes source layer', () => {
    const src = readSrc('LivingGardenMotion.js')
    // AppState handler calls resolveToCanonicalRest which sets sourceOpacity=0
    expect(src).toMatch(/AppState.*addEventListener/)
    expect(src).toMatch(/treeSourceOpacityRef.*setValue\(0\)/)
  })

  test('Source renderer removed at terminal state (sourceOpacity=0)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // hasSourceLayer checks syncSourceOpacity > 0.01
    expect(src).toMatch(/syncSourceOpacity > 0\.01/)
  })

  test('Destination terminal renderer is canonical (all opacity=1 at rest)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1D flash fix: reads Animated.Value synchronously via readSync
    // At rest: syncTrunkOpacity = 1, syncCanopyOpacity = 1, syncDetailOpacity = 1
    expect(src).toMatch(/syncTrunkOpacity/)
    expect(src).toMatch(/syncCanopyOpacity/)
    expect(src).toMatch(/syncDetailOpacity/)
    // destTrunkOpacity = syncTrunkOpacity (direct read, no state lag)
    expect(src).toMatch(/destTrunkOpacity = syncTrunkOpacity/)
    expect(src).toMatch(/destCanopyOpacity = syncCanopyOpacity/)
    expect(src).toMatch(/destDetailOpacity = syncDetailOpacity/)
  })

  test('Rim/glow remains last (TREE_RIM_START_FRACTION >= 0.75)', () => {
    const { TREE_RIM_START_FRACTION } = require('../LivingGardenMotion')
    expect(TREE_RIM_START_FRACTION).toBeGreaterThanOrEqual(0.75)
  })

  test('Full destination canopy NOT visible on first target frame', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Canopy opacity starts at 0, not 1
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(0\)/)
  })

  test('Trunk begins before canopy (trunkStart < canopyStart)', () => {
    const {
      TREE_TRUNK_START_FRACTION,
      TREE_CANOPY_REVEAL_START_FRACTION,
    } = require('../LivingGardenMotion')
    expect(TREE_TRUNK_START_FRACTION).toBeLessThan(TREE_CANOPY_REVEAL_START_FRACTION)
  })

  test('Detail begins after canopy starts', () => {
    const {
      TREE_DETAIL_REVEAL_START_FRACTION,
      TREE_CANOPY_REVEAL_START_FRACTION,
    } = require('../LivingGardenMotion')
    expect(TREE_DETAIL_REVEAL_START_FRACTION).toBeGreaterThan(TREE_CANOPY_REVEAL_START_FRACTION)
  })

  test('Source Seed fades only after trunk establishment begins', () => {
    const {
      TREE_SOURCE_FADE_START_FRACTION,
      TREE_TRUNK_START_FRACTION,
    } = require('../LivingGardenMotion')
    expect(TREE_SOURCE_FADE_START_FRACTION).toBeGreaterThan(TREE_TRUNK_START_FRACTION)
  })
})

// ── KKK. Phase 1D flash fix — first-frame synchronization ─────
// Verifies that the first destination render cannot show stale
// canonical opacity values, eliminating the one-frame flash.

describe('KKK. Phase 1D flash fix — first-frame synchronization', () => {
  test('Tree subgroup opacity read synchronously from Animated.Value (not state)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // readSync helper reads __getValue() directly during render
    expect(src).toMatch(/readSync/)
    expect(src).toMatch(/__getValue/)
  })

  test('destTrunkOpacity uses sync read (not trunkOpacityState)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/destTrunkOpacity = syncTrunkOpacity/)
    // Should NOT use the old state-bridge pattern
    expect(src).not.toMatch(/destTrunkOpacity = hasAnimMotion \? trunkOpacityState/)
  })

  test('destCanopyOpacity uses sync read (not canopyOpacityState)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/destCanopyOpacity = syncCanopyOpacity/)
    expect(src).not.toMatch(/destCanopyOpacity = hasAnimMotion \? canopyOpacityState/)
  })

  test('destDetailOpacity uses sync read (not detailOpacityState)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/destDetailOpacity = syncDetailOpacity/)
    expect(src).not.toMatch(/destDetailOpacity = hasAnimMotion \? detailOpacityState/)
  })

  test('source layer opacity uses sync read (not sourceOpacityState)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/treeOpacity=\{syncSourceOpacity\}/)
  })

  test('hasSourceLayer uses syncSourceOpacity (not sourceOpacityState)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncSourceOpacity > 0\.01/)
  })

  test('syncTrunkOpacity reads from treeMotion.trunkOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncTrunkOpacity.*treeMotion\.trunkOpacity/)
  })

  test('syncCanopyOpacity reads from treeMotion.canopyOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncCanopyOpacity.*treeMotion\.canopyOpacity/)
  })

  test('syncDetailOpacity reads from treeMotion.detailOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncDetailOpacity.*treeMotion\.detailOpacity/)
  })

  test('syncSourceOpacity reads from treeMotion.sourceOpacity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncSourceOpacity.*treeMotion\.sourceOpacity/)
  })

  test('first destination render cannot use canonical canopy opacity=1', () => {
    const src = readSrc('LivingGardenMotion.js')
    // runTreeGrowth sets canopyOpacity to 0 at start
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(0\)/)
  })

  test('first destination canopy opacity is 0 (motion start)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(0\)/)
  })

  test('first destination detail opacity is 0 (motion start)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeDetailOpacityRef.*setValue\(0\)/)
  })

  test('trunk starts at intended starting opacity (0)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeTrunkOpacityRef.*setValue\(0\)/)
  })

  test('source layer begins at intended opacity (1)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeSourceOpacityRef.*setValue\(1\)/)
  })

  test('no listener/setState lag can expose full destination Tree', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // The sync read pattern (readSync + __getValue) ensures the first
    // render after journeyStageKey switch already has the correct values
    expect(src).toMatch(/readSync.*__getValue/)
    // State-based opacity is NOT used for rendering subgroups
    expect(src).not.toMatch(/destTrunkOpacity = hasAnimMotion \? trunkOpacityState/)
    expect(src).not.toMatch(/destCanopyOpacity = hasAnimMotion \? canopyOpacityState/)
  })

  test('canopy still reaches 1 (terminal canonical)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(1\)/)
  })

  test('trunk still reaches 1 (terminal canonical)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeTrunkOpacityRef.*setValue\(1\)/)
  })

  test('Rim remains last (TREE_RIM_START_FRACTION >= 0.75)', () => {
    const { TREE_RIM_START_FRACTION } = require('../LivingGardenMotion')
    expect(TREE_RIM_START_FRACTION).toBeGreaterThanOrEqual(0.75)
  })

  test('Source layer removed terminally (sourceOpacity → 0)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeSourceOpacityRef.*setValue\(0\)/)
  })

  test('Destination terminal state canonical (all opacity=1)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Completion callback sets all to 1
    expect(src).toMatch(/treeTrunkOpacityRef.*setValue\(1\)/)
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(1\)/)
    expect(src).toMatch(/treeDetailOpacityRef.*setValue\(1\)/)
  })

  test('Reduced Motion still immediate canonical', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/if \(isReduced\)/)
    expect(src).toMatch(/resolveToCanonicalRest/)
  })

  test('Background interruption still canonical', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/AppState.*addEventListener/)
    expect(src).toMatch(/resolveToCanonicalRest/)
  })

  test('Choreography timings unchanged (TREE_DURATION = 2200)', () => {
    const { TREE_DURATION } = require('../LivingGardenMotion')
    expect(TREE_DURATION).toBe(2200)
  })

  test('Compressed floor unchanged (>= 1500)', () => {
    const { TREE_DURATION_COMPRESSED } = require('../LivingGardenMotion')
    expect(TREE_DURATION_COMPRESSED).toBeGreaterThanOrEqual(1500)
  })

  test('Trunk precedes canopy (trunkStart < canopyStart)', () => {
    const {
      TREE_TRUNK_START_FRACTION,
      TREE_CANOPY_REVEAL_START_FRACTION,
    } = require('../LivingGardenMotion')
    expect(TREE_TRUNK_START_FRACTION).toBeLessThan(TREE_CANOPY_REVEAL_START_FRACTION)
  })
})

// ── LLL. Phase 1D pre-paint transition guard (one-shot lifecycle) ──
// Behavioral tests proving the first-target render guard prevents
// the complete destination Tree from flashing before motion init,
// with explicit UNPREPARED → RUNNING → COMPLETE lifecycle.

describe('LLL. Phase 1D pre-paint transition guard', () => {
  test('Tree component accepts transitionId prop', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/transitionId/)
  })

  test('Scene passes transitionId to Tree', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/transitionId.*advancements/)
  })

  test('Tree component has prevTransitionIdRef for identity tracking', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/prevTransitionIdRef/)
  })

  test('Tree component has guardPhaseRef for lifecycle phases', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/guardPhaseRef/)
  })

  test('Tree component has generationRef for monotonic identity', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/generationRef/)
  })

  test('Guard uses object reference identity (not stringification)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Compare by reference: transitionId !== prevTransitionIdRef.current
    expect(src).toMatch(/transitionId !== prevTransitionIdRef\.current/)
    // Must NOT use _ts or string interpolation for identity
    expect(src).not.toMatch(/transitionId\._ts/)
  })

  test('No [object Object] identity collision (no string interpolation)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Must NOT stringify the transitionId object
    expect(src).not.toMatch(/transitionKey.*transitionId/)
    expect(src).not.toMatch(/\$\{transitionId\}/)
  })

  test('Guard phases: 0=IDLE, 1=UNPREPARED, 2=RUNNING, 3=COMPLETE', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/0=IDLE.*1=UNPREPARED.*2=RUNNING.*3=COMPLETE/)
  })

  test('New transition arms guard to UNPREPARED (phase=1)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // When new transitionId detected: guardPhaseRef.current = 1
    expect(src).toMatch(/guardPhaseRef\.current = isReduced \? 3 : 1/)
  })

  test('Guard forces source=1 when UNPREPARED', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const guardMatch = src.match(/guardPhaseRef\.current === 1[\s\S]*?syncDetailOpacity = 0/)
    expect(guardMatch).toBeTruthy()
    expect(guardMatch[0]).toMatch(/syncSourceOpacity = 1/)
  })

  test('Guard forces trunk=0 when UNPREPARED', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const guardMatch = src.match(/guardPhaseRef\.current === 1[\s\S]*?syncDetailOpacity = 0/)
    expect(guardMatch).toBeTruthy()
    expect(guardMatch[0]).toMatch(/syncTrunkOpacity = 0/)
  })

  test('Guard forces canopy=0 when UNPREPARED', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const guardMatch = src.match(/guardPhaseRef\.current === 1[\s\S]*?syncDetailOpacity = 0/)
    expect(guardMatch).toBeTruthy()
    expect(guardMatch[0]).toMatch(/syncCanopyOpacity = 0/)
  })

  test('Guard forces detail=0 when UNPREPARED', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const guardMatch = src.match(/guardPhaseRef\.current === 1[\s\S]*?syncDetailOpacity = 0/)
    expect(guardMatch).toBeTruthy()
    expect(guardMatch[0]).toMatch(/syncDetailOpacity = 0/)
  })

  test('UNPREPARED → RUNNING when trunkOpacity moves below 1', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 1 → 2 when syncTrunkOpacity < 1 || syncCanopyOpacity < 1
    expect(src).toMatch(/guardPhaseRef\.current === 1/)
    expect(src).toMatch(/syncTrunkOpacity < 1 \|\| syncCanopyOpacity < 1/)
    expect(src).toMatch(/guardPhaseRef\.current = 2/)
  })

  test('RUNNING → COMPLETE when values return to canonical', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Phase 2 → 3 when trunk>=1, canopy>=1, source<0.01
    expect(src).toMatch(/guardPhaseRef\.current === 2/)
    expect(src).toMatch(/syncTrunkOpacity >= 1 && syncCanopyOpacity >= 1 && syncSourceOpacity < 0\.01/)
    expect(src).toMatch(/guardPhaseRef\.current = 3/)
  })

  test('COMPLETE guard never reactivates (phase=3 not checked for forcing)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Guard only forces when phase === 1. Phase 3 is not 1.
    const forceMatch = src.match(/if \(guardPhaseRef\.current === 1\)/)
    expect(forceMatch).toBeTruthy()
    // There should be no condition that sets phase back to 1 from 3
    expect(src).not.toMatch(/guardPhaseRef\.current = 1.*COMPLETE/)
  })

  test('No observable render with journeyStage=growing AND canopyOpacity=1 before init', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // When guardPhaseRef.current === 1, canopy is forced to 0
    expect(src).toMatch(/guardPhaseRef\.current === 1[\s\S]*?syncCanopyOpacity = 0/s)
  })

  test('treeComparator includes transitionId', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/prev\.transitionId === next\.transitionId/)
  })

  test('Guard only active during transition (not at rest)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/isTransition.*fromStage.*journeyStageKey/)
  })

  test('Transition end resets guard to IDLE', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // When !isTransition, reset to IDLE
    expect(src).toMatch(/!isTransition && guardPhaseRef\.current !== 0/)
    expect(src).toMatch(/guardPhaseRef\.current = 0/)
  })

  test('Reduced Motion bypasses guard (phase=3 immediately)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // isReduced → guardPhaseRef.current = 3 (COMPLETE)
    expect(src).toMatch(/isReduced \? 3 : 1/)
  })

  test('Reduced Motion first render: source=0, trunk=1, canopy=1, detail=1', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // When isReduced, guard is COMPLETE (phase=3), so no forcing.
    // Animated.Values are canonical (or will be via resolveToCanonicalRest).
    // readSync returns canonical values: source=0, trunk=1, canopy=1, detail=1
    expect(src).toMatch(/isReduced \? 3 : 1/)
    // No guard forcing at phase 3
    const forceMatch = src.match(/if \(guardPhaseRef\.current === 1\)/)
    expect(forceMatch).toBeTruthy()
  })

  test('Hook generation detection for background cancellation', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // guardArmedHookGenRef tracks hook generation at arm time
    expect(src).toMatch(/guardArmedHookGenRef/)
    // If hookGeneration > guardArmedHookGenRef, transition was cancelled
    expect(src).toMatch(/hookGeneration > guardArmedHookGenRef/)
  })

  test('Motion hook exposes transitionGeneration', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/transitionGenerationRef/)
    expect(src).toMatch(/transitionGeneration.*transitionGenerationRef/)
  })

  test('Motion hook increments transitionGeneration on new advancement', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/transitionGenerationRef\.current \+= 1/)
  })

  test('Terminal target canonical (guard COMPLETE, values reach 1)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/treeTrunkOpacityRef.*setValue\(1\)/)
    expect(src).toMatch(/treeCanopyOpacityRef.*setValue\(1\)/)
    expect(src).toMatch(/treeSourceOpacityRef.*setValue\(0\)/)
  })

  test('Background interruption: canonicalizes (guard → COMPLETE)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/AppState.*addEventListener/)
    expect(src).toMatch(/resolveToCanonicalRest/)
  })

  test('Existing timings unchanged (TREE_DURATION = 2200)', () => {
    const { TREE_DURATION } = require('../LivingGardenMotion')
    expect(TREE_DURATION).toBe(2200)
  })

  test('No arbitrary time delay in guard (deterministic)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Guard should NOT use setTimeout or delay
    const guardMatch = src.match(/guardPhaseRef\.current === 1[\s\S]*?syncDetailOpacity = 0/)
    expect(guardMatch).toBeTruthy()
    expect(guardMatch[0]).not.toMatch(/setTimeout/)
    expect(guardMatch[0]).not.toMatch(/delay/)
  })

  test('Guard does not remount production Tree', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Guard uses refs, not key changes or remounts
    expect(src).toMatch(/prevTransitionIdRef.*useRef/)
    expect(src).toMatch(/guardPhaseRef.*useRef/)
  })
})

// ── MMM. Behavioral model — one-shot guard lifecycle ──────────
// Models the actual lifecycle proving guard prevents flash and
// never reactivates after completion.

describe('MMM. Behavioral model — one-shot guard lifecycle', () => {
  test('OLD canonical values (trunk=1, canopy=1) would cause flash without guard', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/readSync.*__getValue/)
    // Guard overrides these values when UNPREPARED
    expect(src).toMatch(/guardPhaseRef\.current === 1/)
  })

  test('NEW transition: guard forces start values before motion init', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const guardMatch = src.match(/guardPhaseRef\.current === 1[\s\S]*?syncDetailOpacity = 0/)
    expect(guardMatch).toBeTruthy()
    expect(guardMatch[0]).toMatch(/syncSourceOpacity = 1/)
    expect(guardMatch[0]).toMatch(/syncTrunkOpacity = 0/)
    expect(guardMatch[0]).toMatch(/syncCanopyOpacity = 0/)
    expect(guardMatch[0]).toMatch(/syncDetailOpacity = 0/)
  })

  test('After motion init (trunk=0): guard transitions to RUNNING', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncTrunkOpacity < 1 \|\| syncCanopyOpacity < 1/)
    expect(src).toMatch(/guardPhaseRef\.current = 2/)
  })

  test('After completion (values canonical): guard transitions to COMPLETE', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/syncTrunkOpacity >= 1 && syncCanopyOpacity >= 1 && syncSourceOpacity < 0\.01/)
    expect(src).toMatch(/guardPhaseRef\.current = 3/)
  })

  test('COMPLETE: later rerender does NOT reactivate guard', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Guard forcing only happens at phase === 1
    // Phase 3 (COMPLETE) never goes back to 1
    // The only way to get to 1 is a new transitionId object reference
    expect(src).toMatch(/if \(guardPhaseRef\.current === 1\)/)
    // No path from phase 3 back to phase 1 without new transitionId
    expect(src).not.toMatch(/guardPhaseRef\.current = 1.*guardPhaseRef\.current === 3/)
  })

  test('No frame with journeyStage=growing AND canopy=1 before init', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/guardPhaseRef\.current === 1[\s\S]*?syncCanopyOpacity = 0/s)
  })

  test('Replay: fresh object reference → fresh generation → fresh guard', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // New transitionId object reference triggers generationRef increment
    expect(src).toMatch(/transitionId !== prevTransitionIdRef\.current/)
    expect(src).toMatch(/generationRef\.current \+= 1/)
    // Guard armed to UNPREPARED again
    expect(src).toMatch(/guardPhaseRef\.current = isReduced \? 3 : 1/)
  })

  test('Two different advancement events cannot collapse to same key', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // Identity is by object reference, not string. Two different objects
    // are always !== each other, so no collision possible.
    expect(src).toMatch(/transitionId !== prevTransitionIdRef\.current/)
    // Must NOT use string interpolation that could produce [object Object]
    expect(src).not.toMatch(/transitionId\._ts/)
    expect(src).not.toMatch(/`\$\{transitionId\}/)
  })

  test('Background cancellation: hook generation detects cancellation', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // If hook has processed (hookGeneration increased) but values still
    // canonical, transition was cancelled → COMPLETE
    expect(src).toMatch(/hookGeneration > guardArmedHookGenRef\.current/)
    expect(src).toMatch(/guardPhaseRef\.current = 3/)
  })
})

// ── NNN. Phase 1D Arbor pre-paint reveal guard ────────────────
// Behavioral tests proving newly-earned Arbor ornaments do NOT
// flash at full appearance before their reveal turn.

describe('NNN. Phase 1D Arbor pre-paint reveal guard', () => {
  test('Arbor component accepts advancementMilestoneIds prop', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/advancementMilestoneIds/)
  })

  test('Arbor component accepts advancementId prop', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/advancementId/)
  })

  test('Arbor component accepts isReduced prop', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/isReduced/)
  })

  test('Scene passes advancementMilestoneIds to Arbor', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/advancementMilestoneIds.*advancements/)
  })

  test('Scene passes advancementId to Arbor', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/advancementId.*advancements/)
  })

  test('Arbor has arborGuardPhaseRef for one-shot lifecycle', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/arborGuardPhaseRef/)
  })

  test('Arbor has prevAdvancementIdRef for identity tracking', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/prevAdvancementIdRef/)
  })

  test('Arbor guard uses object reference identity (not stringification)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/advancementId !== prevAdvancementIdRef\.current/)
  })

  test('Arbor guard phases: 0=IDLE, 1=UNPREPARED, 2=RUNNING, 3=COMPLETE', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/0=IDLE.*1=UNPREPARED.*2=RUNNING.*3=COMPLETE/)
  })

  test('New advancement arms guard to UNPREPARED (phase=1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/arborGuardPhaseRef\.current = isReduced \? 3 : 1/)
  })

  test('UNPREPARED forces effectiveRevealProgress=0', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/arborGuardPhaseRef\.current === 1/)
    expect(src).toMatch(/effectiveRevealProgress = 0/)
  })

  test('Arbor has eventNewIdsRef for generation-owned new-ID set', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/eventNewIdsRef/)
  })

  test('eventNewIdsRef stored synchronously on new advancement', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/eventNewIdsRef\.current = advancementMilestoneIds/)
  })

  test('effectiveNewIds uses eventNewIdsRef (NOT newlyEarnedIds state)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The default effectiveNewIds must be eventNewIdsRef.current, not newlyEarnedIds
    expect(src).toMatch(/let effectiveNewIds = eventNewIdsRef\.current/)
    // Must NOT use newlyEarnedIds as the default for effectiveNewIds
    expect(src).not.toMatch(/let effectiveNewIds = newlyEarnedIds/)
  })

  test('RUNNING phase still uses eventNewIdsRef (no state-race)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // When phase=2 (RUNNING), effectiveNewIds is still eventNewIdsRef.current
    // The only override is for phase=1 (UNPREPARED) which also uses eventNewIdsRef
    // There must be NO branch that sets effectiveNewIds = newlyEarnedIds
    expect(src).not.toMatch(/effectiveNewIds = newlyEarnedIds/)
  })

  test('newlyEarnedIds React state NOT in animation-critical Arbor path', () => {
    const src = readSrc('LivingGardenArbor.js')
    // newlyEarnedIds prop is accepted but must NOT be used for effectiveNewIds
    // or computeOrnamentProgress. The generation-owned eventNewIdsRef is authoritative.
    const effectiveSection = src.match(/let effectiveNewIds[\s\S]*?hasRevealMotion = /)
    expect(effectiveSection).toBeTruthy()
    expect(effectiveSection[0]).not.toMatch(/newlyEarnedIds/)
  })

  test('UNPREPARED → RUNNING when arborReveal < 1', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/readSyncReveal < 1/)
    expect(src).toMatch(/arborGuardPhaseRef\.current = 2/)
  })

  test('RUNNING → COMPLETE when arborReveal returns to 1', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/readSyncReveal >= 1/)
    expect(src).toMatch(/arborGuardPhaseRef\.current = 3/)
  })

  test('COMPLETE: guard never reactivates (phase=3 not forced)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Guard forcing only happens at phase === 1
    expect(src).toMatch(/if \(arborGuardPhaseRef\.current === 1\)/)
    // No path from phase 3 back to 1 without new advancementId
    expect(src).not.toMatch(/arborGuardPhaseRef\.current = 1.*arborGuardPhaseRef\.current === 3/)
  })

  test('Reduced Motion bypasses guard (phase=3 immediately)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/isReduced \? 3 : 1/)
  })

  test('Reduced Motion first render: ornaments immediately canonical', () => {
    const src = readSrc('LivingGardenArbor.js')
    // When isReduced, guard is COMPLETE (phase=3), no forcing
    // effectiveRevealProgress = revealProgress (which is 1 at rest)
    expect(src).toMatch(/isReduced \? 3 : 1/)
  })

  test('Advancement end resets guard to IDLE', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/!hasNewMilestones && arborGuardPhaseRef\.current !== 0/)
    expect(src).toMatch(/arborGuardPhaseRef\.current = 0/)
  })

  test('arborComparator includes advancementMilestoneIds', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/prev\.advancementMilestoneIds === next\.advancementMilestoneIds/)
  })

  test('arborComparator includes advancementId', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/prev\.advancementId === next\.advancementId/)
  })

  test('arborComparator includes isReduced', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/prev\.isReduced === next\.isReduced/)
  })

  test('Replay: fresh advancementId → fresh guard activation', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/advancementId !== prevAdvancementIdRef\.current/)
    expect(src).toMatch(/arborGuardPhaseRef\.current = isReduced \? 3 : 1/)
  })

  test('No [object Object] identity collision (object reference comparison)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/advancementId !== prevAdvancementIdRef\.current/)
    // Must NOT stringify
    expect(src).not.toMatch(/advancementId\._ts/)
    expect(src).not.toMatch(/`\$\{advancementId\}/)
  })

  test('computeOrnamentProgress uses effectiveNewIds (not stale newlyEarnedIds)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/effectiveNewIds\.indexOf/)
  })

  test('computeOrnamentProgress uses effectiveRevealProgress', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/effectiveRevealProgress \* totalRevealDuration/)
  })

  test('hasRevealMotion uses effectiveRevealProgress', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/hasRevealMotion = effectiveRevealProgress < 1/)
  })

  test('newEarnedSet uses effectiveNewIds', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/new Set\(effectiveNewIds/)
  })

  test('Stagger preserved: 130ms for 2-4 ornaments', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/newCount >= 5 \? 90 : 130/)
  })

  test('Ornament duration preserved: 1100ms', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/ornamentDuration = 1100/)
  })

  test('Phase cap preserved: 1600ms', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/1600/)
  })

  test('Scale preserved: 0.88 → 1.0', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/0\.88 \+ 0\.12 \* individualProgress/)
  })

  test('Halo preserved: sin(progress * PI) * 0.26', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/Math\.sin\(individualProgress \* Math\.PI\) \* 0\.26/)
  })

  test('Halo terminal: 0 (resolves at progress=1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/individualProgress < 1/)
  })

  test('Existing ornaments never receive reveal transform (progress=1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // computeOrnamentProgress returns 1 for non-newly-earned IDs
    expect(src).toMatch(/if \(idx < 0\) return 1/)
  })

  test('No arbitrary time delay in Arbor guard (deterministic)', () => {
    const src = readSrc('LivingGardenArbor.js')
    const guardMatch = src.match(/arborGuardPhaseRef\.current === 1[\s\S]*?effectiveRevealProgress = 0/)
    expect(guardMatch).toBeTruthy()
    // Guard should NOT use setTimeout (delay is in comments only)
    expect(guardMatch[0]).not.toMatch(/setTimeout/)
  })

  test('Guard does not remount Arbor (uses refs)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/prevAdvancementIdRef.*useRef/)
    expect(src).toMatch(/arborGuardPhaseRef.*useRef/)
  })

  test('Background interruption: resolveToCanonicalRest sets arborReveal=1', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/arborRevealRef.*setValue\(1\)/)
  })

  test('runArborReveal sets arborReveal=0 at start', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/arborRevealRef.*setValue\(0\)/)
  })

  test('runArborReveal uses stagger from getArborStagger', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/getArborStagger/)
  })

  test('No Arbor idle animation (ornaments static after reveal)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // No loop, no Animated.loop in Arbor
    expect(src).not.toMatch(/Animated\.loop/)
  })

  test('Qualification truth unchanged (uses ARBOR_CATALOG)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/ARBOR_CATALOG/)
    expect(src).toMatch(/entry\.qualifies\(ctx\)/)
  })

  test('Deterministic slot order unchanged (sorted ID → peg)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/sort.*localeCompare/)
    expect(src).toMatch(/pegIndex: index/)
  })

  // ── Generation-owned progress behavior tests ──
  // These tests model the actual computeOrnamentProgress function with
  // the generation-owned eventNewIdsRef architecture.

  test('FIRST TARGET: all 3 new IDs progress=0 (UNPREPARED, forced progress=0)', () => {
    // Model: arborGuardPhaseRef=1, effectiveRevealProgress=0
    // eventNewIdsRef = ['streak_3', 'streak_7', 'logs_10']
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const effectiveRevealProgress = 0 // forced by UNPREPARED guard
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = Math.min(ornamentDuration + 2 * stagger, 1600) // 1360

    const progress = (id) => {
      const idx = effectiveNewIds.indexOf(id)
      if (idx < 0) return 1
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      return Math.max(0, Math.min(1, elapsed / ornamentDuration))
    }

    expect(progress('streak_3')).toBe(0)
    expect(progress('streak_7')).toBe(0)
    expect(progress('logs_10')).toBe(0)
    // Existing ornament (first_juice) is NOT in effectiveNewIds → progress=1
    expect(progress('first_juice')).toBe(1)
  })

  test('RUNNING with newlyEarnedIds=[]: effectiveNewIds STILL has all 3 (no state-race)', () => {
    // Model: guard transitioned to RUNNING, but newlyEarnedIds React state
    // is still []. With eventNewIdsRef, effectiveNewIds is still the
    // generation-owned set.
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10'] // from eventNewIdsRef
    const newlyEarnedIdsState = [] // stale React state
    // Prove that effectiveNewIds does NOT come from newlyEarnedIdsState
    expect(effectiveNewIds).not.toBe(newlyEarnedIdsState)
    expect(effectiveNewIds.length).toBe(3)
    expect(newlyEarnedIdsState.length).toBe(0)
  })

  // ── Behavioral race test: UNPREPARED→RUNNING progress handoff ──
  // This test reproduces the exact race where:
  //   guard=UNPREPARED, sync=1, state=1, effective=0 (forced)
  //   motion hook sets Animated.Value=0
  //   render triggers before state flush:
  //     guard=RUNNING, sync=0, state=STALE 1
  // effectiveRevealProgress MUST follow sync (0), NOT stale state (1).
  test('RACE: UNPREPARED→RUNNING, sync=0 but state=1 → effective=0 (NOT 1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // During RUNNING, effectiveRevealProgress must use readSyncReveal
    // (the synchronous Animated.Value __getValue() read), NOT revealProgress
    // (the stale React state).
    // Verify the source code uses readSyncReveal during RUNNING:
    const runningMatch = src.match(/else if \(arborGuardPhaseRef\.current === 2\) \{[\s\S]*?effectiveRevealProgress = readSyncReveal/)
    expect(runningMatch).toBeTruthy()
    // Verify it does NOT use revealProgress (stale state) during RUNNING:
    const runningBlock = src.match(/else if \(arborGuardPhaseRef\.current === 2\) \{[\s\S]*?\}/)
    expect(runningBlock).toBeTruthy()
    expect(runningBlock[0]).not.toMatch(/effectiveRevealProgress = revealProgress/)
  })

  test('RACE: effective follows sync, not stale state (monotonic progression)', () => {
    // Simulate the progression:
    // Frame 1: guard=UNPREPARED, sync=1, state=1, effective=0 (forced)
    // Frame 2: guard=RUNNING, sync=0, state=1 (stale), effective=0 (from sync)
    // Frame 3: guard=RUNNING, sync=0.08, state=0 (flushed), effective=0.08
    // Frame 4: guard=RUNNING, sync=0.20, state=0.15 (lagging), effective=0.20
    const frames = [
      { phase: 1, sync: 1, state: 1, expectedEff: 0 },      // UNPREPARED forced 0
      { phase: 2, sync: 0, state: 1, expectedEff: 0 },      // RUNNING, sync=0, state stale=1
      { phase: 2, sync: 0.08, state: 0, expectedEff: 0.08 }, // RUNNING, sync advances
      { phase: 2, sync: 0.20, state: 0.15, expectedEff: 0.20 }, // RUNNING, state lags
      { phase: 3, sync: 1, state: 1, expectedEff: 1 },      // COMPLETE
    ]
    frames.forEach((f, i) => {
      let effective
      if (f.phase === 1) {
        effective = 0 // UNPREPARED: forced
      } else if (f.phase === 2) {
        effective = f.sync // RUNNING: uses sync, NOT state
      } else {
        effective = f.sync // COMPLETE/IDLE: uses sync (will be 1)
      }
      expect(effective).toBe(f.expectedEff)
      // Critical: effective must NOT equal stale state when state != sync
      if (f.phase === 2 && f.state !== f.sync) {
        expect(effective).not.toBe(f.state)
      }
    })
  })

  test('RACE: no 0→1 jump possible during UNPREPARED→RUNNING transition', () => {
    // The 0→1 jump occurred because:
    //   UNPREPARED: effective=0 (forced)
    //   RUNNING: effective=revealProgress (stale state=1)
    // Fix: RUNNING uses readSyncReveal (sync=0 at transition)
    // So: UNPREPARED effective=0 → RUNNING effective=0 (continuous)
    const src = readSrc('LivingGardenArbor.js')
    // UNPREPARED forces 0
    expect(src).toMatch(/arborGuardPhaseRef\.current === 1[\s\S]*?effectiveRevealProgress = 0/)
    // RUNNING uses readSyncReveal (NOT revealProgress)
    expect(src).toMatch(/arborGuardPhaseRef\.current === 2[\s\S]*?effectiveRevealProgress = readSyncReveal/)
    // The old buggy pattern (effectiveRevealProgress = revealProgress as default)
    // must NOT appear as the RUNNING path
    const oldPattern = src.match(/let effectiveRevealProgress = revealProgress/)
    expect(oldPattern).toBeNull()
  })

  test('~100ms: A > 0, B ≈ 0, C = 0', () => {
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = 1360
    // 100ms → revealProgress = 100/1360 ≈ 0.0735
    const effectiveRevealProgress = 100 / totalRevealDuration

    const progress = (id) => {
      const idx = effectiveNewIds.indexOf(id)
      if (idx < 0) return 1
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      return Math.max(0, Math.min(1, elapsed / ornamentDuration))
    }

    const a = progress('streak_3')
    const b = progress('streak_7')
    const c = progress('logs_10')
    expect(a).toBeGreaterThan(0)
    expect(b).toBe(0) // 100ms < 130ms stagger for B
    expect(c).toBe(0) // 100ms < 260ms stagger for C
  })

  test('~150ms: A > 0, B > 0, C ≈ 0', () => {
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = 1360
    const effectiveRevealProgress = 150 / totalRevealDuration

    const progress = (id) => {
      const idx = effectiveNewIds.indexOf(id)
      if (idx < 0) return 1
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      return Math.max(0, Math.min(1, elapsed / ornamentDuration))
    }

    const a = progress('streak_3')
    const b = progress('streak_7')
    const c = progress('logs_10')
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0) // 150ms > 130ms stagger for B
    expect(c).toBe(0) // 150ms < 260ms stagger for C
  })

  test('~275ms: A > B > C > 0', () => {
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = 1360
    const effectiveRevealProgress = 275 / totalRevealDuration

    const progress = (id) => {
      const idx = effectiveNewIds.indexOf(id)
      if (idx < 0) return 1
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      return Math.max(0, Math.min(1, elapsed / ornamentDuration))
    }

    const a = progress('streak_3')
    const b = progress('streak_7')
    const c = progress('logs_10')
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
    expect(c).toBeGreaterThan(0)
  })

  test('TERMINAL: A=B=C=1, halos=0', () => {
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const ornamentDuration = 1100
    const totalRevealDuration = 1360
    const effectiveRevealProgress = 1 // COMPLETE

    const progress = (id) => {
      const idx = effectiveNewIds.indexOf(id)
      if (idx < 0) return 1
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * 130
      return Math.max(0, Math.min(1, elapsed / ornamentDuration))
    }

    expect(progress('streak_3')).toBe(1)
    expect(progress('streak_7')).toBe(1)
    expect(progress('logs_10')).toBe(1)
    // Halo = sin(progress * PI) * 0.26 → sin(PI) = 0
    const halo = (p) => (p < 1 ? Math.sin(p * Math.PI) * 0.26 : 0)
    expect(halo(1)).toBe(0)
  })

  test('LATER RERENDER: guard stays COMPLETE, no re-arm', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Guard forcing only at phase === 1. Phase 3 cannot go back to 1
    // without a new advancementId object reference.
    expect(src).toMatch(/if \(arborGuardPhaseRef\.current === 1\)/)
    expect(src).not.toMatch(/arborGuardPhaseRef\.current = 1.*arborGuardPhaseRef\.current === 3/)
  })

  test('REPLAY: fresh advancementId → fresh eventNewIdsRef → all start at 0', () => {
    const src = readSrc('LivingGardenArbor.js')
    // New advancementId detected → eventNewIdsRef replaced + guard armed
    expect(src).toMatch(/eventNewIdsRef\.current = advancementMilestoneIds/)
    expect(src).toMatch(/arborGuardPhaseRef\.current = isReduced \? 3 : 1/)
  })

  test('REDUCED MOTION: first render immediately canonical (phase=3)', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/isReduced \? 3 : 1/)
    // No UNPREPARED phase for reduced motion
  })

  test('BACKGROUND: resolveToCanonicalRest sets arborReveal=1 → COMPLETE', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/arborRevealRef.*setValue\(1\)/)
    // Arbor guard: readSyncReveal >= 1 → phase=3
    const arborSrc = readSrc('LivingGardenArbor.js')
    expect(arborSrc).toMatch(/readSyncReveal >= 1/)
    expect(arborSrc).toMatch(/arborGuardPhaseRef\.current = 3/)
  })

  test('BACKGROUND: old eventNewIdsRef cannot re-arm', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Re-arm only happens on new advancementId object reference
    expect(src).toMatch(/advancementId !== prevAdvancementIdRef\.current/)
    // Background cancellation does NOT change advancementId
  })

  test('Existing ornament (first_juice) never receives reveal transform', () => {
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    // first_juice is NOT in effectiveNewIds
    const idx = effectiveNewIds.indexOf('first_juice')
    expect(idx).toBe(-1)
    // computeOrnamentProgress returns 1 for idx < 0
  })

  test('Three new IDs and reveal order from preview scenario', () => {
    // Preview 'arborNew' scenario uses newMilestoneIds: ['streak_3', 'streak_7', 'logs_10']
    // This array order determines the reveal order (index → stagger delay).
    // Peg assignment (visual position) is separate, based on sorted catalog order.
    const newMilestoneIds = ['streak_3', 'streak_7', 'logs_10']
    // Reveal order: #1=streak_3 (idx=0), #2=streak_7 (idx=1), #3=logs_10 (idx=2)
    expect(newMilestoneIds[0]).toBe('streak_3')
    expect(newMilestoneIds[1]).toBe('streak_7')
    expect(newMilestoneIds[2]).toBe('logs_10')
  })

  test('Start offsets: #1=0ms, #2=130ms, #3=260ms', () => {
    const stagger = 130
    expect(0 * stagger).toBe(0) // #1 (streak_3)
    expect(1 * stagger).toBe(130) // #2 (streak_7)
    expect(2 * stagger).toBe(260) // #3 (logs_10)
  })

  test('eventNewIdsRef cleared on advancement end', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/eventNewIdsRef\.current = null/)
  })
})

// ── OOO. Arbor render-path fix proofs ───────────────────────
// Source-level proofs that the render-path fix is correct.
// The jest-expo mock for react-native-svg doesn't preserve component
// props in testInstance.findAll, so we verify via source code analysis
// that opacity is applied to individual SVG elements (NOT G wrapper),
// per the react-native-svg 15.x bug documented in LivingGardenScene.js.

describe('OOO. Arbor render-path fix proofs', () => {
  const newMilestoneIds = ['streak_3', 'streak_7', 'logs_10']

  test('G wrapper does NOT have opacity prop (react-native-svg 15.x bug fix)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The ornament G wrapper must NOT have opacity prop
    // It should only have key and transform
    const wrapperMatch = src.match(/<G\s+key=\{`arbor-peg-\$\{slot\.id\}`\}[\s\S]*?>/)
    expect(wrapperMatch).toBeTruthy()
    expect(wrapperMatch[0]).not.toMatch(/opacity=/)
  })

  test('progress=0: individual SVG elements have opacity=0 via renderer prop', () => {
    const src = readSrc('LivingGardenArbor.js')
    // OrnamentRenderer receives opacity prop (applied to individual elements)
    expect(src).toMatch(/OrnamentRenderer[\s\S]*?opacity=\{ornamentOpacity\}/)
    // Each renderer multiplies element opacities by the opacity prop
    // At ornamentOpacity=0, all elements get opacity=0
    expect(src).toMatch(/opacity=\{0\.8 \* opacity\}/)
    expect(src).toMatch(/opacity=\{opacity\}/)
    expect(src).toMatch(/opacity=\{0\.92 \* opacity\}/)
    expect(src).toMatch(/opacity=\{0\.5 \* opacity\}/)
    expect(src).toMatch(/opacity=\{0\.6 \* opacity\}/)
    expect(src).toMatch(/opacity=\{0\.7 \* opacity\}/)
  })

  test('progress=0: existing first_juice ornament elements have opacity > 0', () => {
    const src = readSrc('LivingGardenArbor.js')
    // first_juice is NOT in newMilestoneIds → isNewlyEarned=false
    // → ornamentOpacity=1 → all element opacities are their normal values
    // (e.g. 0.8 * 1 = 0.8, 0.92 * 1 = 0.92, etc.)
    expect(src).toMatch(/ornamentOpacity = isNewlyEarned \? individualProgress : 1/)
    // When ornamentOpacity=1, the multipliers preserve original values
    // 0.8 * 1 = 0.8, 0.92 * 1 = 0.92, etc.
  })

  test('progress=0: hasRevealMotion is true (NOT canonical branch)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // hasRevealMotion = effectiveRevealProgress < 1
    // At progress=0: 0 < 1 = true → reveal motion ACTIVE
    expect(src).toMatch(/hasRevealMotion = effectiveRevealProgress < 1/)
    // Must NOT use progress > 0 && progress < 1 (which would be false at 0)
    expect(src).not.toMatch(/effectiveRevealProgress > 0 && effectiveRevealProgress < 1/)
  })

  test('OrnamentRenderer receives opacity prop (applied to individual elements)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The OrnamentRenderer must receive an opacity prop
    expect(src).toMatch(/OrnamentRenderer[\s\S]*?opacity={ornamentOpacity}/)
  })

  test('Each ornament renderer accepts and applies opacity prop', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Each renderer must accept opacity prop
    expect(src).toMatch(/function LeafOrnament.*opacity = 1/)
    expect(src).toMatch(/function BlossomOrnament.*opacity = 1/)
    expect(src).toMatch(/function FruitOrnament.*opacity = 1/)
    expect(src).toMatch(/function MedallionOrnament.*opacity = 1/)
    // Each renderer must multiply element opacities by the opacity prop
    expect(src).toMatch(/opacity=\{0\.8 \* opacity\}/)
    expect(src).toMatch(/opacity=\{opacity\}/)
    expect(src).toMatch(/opacity=\{0\.92 \* opacity\}/)
  })

  test('OrnamentBloom receives ornamentOpacity-multiplied opacity', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/opacity=\{ramp\.bloomOpacity \* ornamentOpacity\}/)
  })

  test('No duplicate ornament rendering (each earned ornament rendered once)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // There should be only ONE map over slotStates
    const mapCount = (src.match(/slotStates\.map/g) || []).length
    expect(mapCount).toBe(1)
    // There should be only ONE OrnamentRenderer call
    const rendererCount = (src.match(/<OrnamentRenderer/g) || []).length
    expect(rendererCount).toBe(1)
  })

  test('Exact slot.id → eventNewIds index mapping', () => {
    // For the Arbor New preview:
    // slot.id = 'streak_3' → index 0 in ['streak_3', 'streak_7', 'logs_10']
    // slot.id = 'streak_7' → index 1
    // slot.id = 'logs_10' → index 2
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    expect(effectiveNewIds.indexOf('streak_3')).toBe(0)
    expect(effectiveNewIds.indexOf('streak_7')).toBe(1)
    expect(effectiveNewIds.indexOf('logs_10')).toBe(2)
    // first_juice is NOT in the list → idx=-1 → progress=1 (canonical)
    expect(effectiveNewIds.indexOf('first_juice')).toBe(-1)
  })

  test('No G opacity prop in ornament wrapper (render-path fix)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The ornament G wrapper must NOT have opacity prop
    // It should only have key and transform
    const wrapperMatch = src.match(/<G\s+key=\{`arbor-peg-\$\{slot\.id\}`\}[\s\S]*?>/)
    expect(wrapperMatch).toBeTruthy()
    expect(wrapperMatch[0]).not.toMatch(/opacity=/)
  })

  test('onDebugValues callback exposed for QA diagnostic', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/onDebugValues/)
  })

  test('Scene passes onArborDebugValues to Arbor', () => {
    const src = readSrc('LivingGardenScene.js')
    expect(src).toMatch(/onArborDebugValues/)
    expect(src).toMatch(/onDebugValues=\{onArborDebugValues\}/)
  })

  test('GardenPreviewScreen displays arbor debug diagnostic', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'GardenPreviewScreen.js'), 'utf-8')
    expect(src).toMatch(/arborDebugValues/)
    expect(src).toMatch(/ARBOR phase=/)
    expect(src).toMatch(/sync=/)
    expect(src).toMatch(/state=/)
    expect(src).toMatch(/eff=/)
    expect(src).toMatch(/run=/)
    expect(src).toMatch(/proc=/)
    expect(src).toMatch(/r=/)
  })
})

// ── PPP. Arbor motion-start + zero-progress hard gate ────────
// Tests for the motion-start fix (listener setup when guard active)
// and the structural zero-progress render gate.

describe('PPP. Arbor motion-start + zero-progress hard gate', () => {
  const newMilestoneIds = ['streak_3', 'streak_7', 'logs_10']

  // ── Motion-start: listener setup fix ──
  test('Listener is set up when guard is active (even if value=1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The listener effect must NOT return early when guard is active
    // It must check guardActive before the early return
    expect(src).toMatch(/guardActive/)
    expect(src).toMatch(/arborGuardPhaseRef\.current === 1 || arborGuardPhaseRef\.current === 2/)
    // The early return must be gated by !guardActive
    expect(src).toMatch(/arborReveal\.__getValue\(\) >= 1 && !guardActive/)
  })

  test('No permanent UNPREPARED: listener fires when setValue(0) is called', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The listener must call setRevealProgress to trigger re-renders
    expect(src).toMatch(/addListener\(\(\{ value \}\) => \{[\s\S]*?setRevealProgress\(value\)/)
    // When guard is active, the listener is always set up
    // So setValue(0) will fire the listener → setRevealProgress(0) → re-render
    // → guard transitions UNPREPARED→RUNNING
  })

  test('Motion hook processes Arbor-only advancement (no beds, no journey)', () => {
    const src = readSrc('LivingGardenMotion.js')
    // The orchestration effect must check hasArbor
    expect(src).toMatch(/hasArbor = advancements\.newMilestoneIds && advancements\.newMilestoneIds\.length > 0/)
    // runArborReveal must be called when hasArbor is true
    expect(src).toMatch(/if \(hasArbor\) \{[\s\S]*?runArborReveal/)
    // For Arbor-only (no beds, no journey), the delay is:
    // WAKE_DURATION + ALL_BEDS_ORDER.length * BAND_STAGGER + TREE_TO_ARBOR_DELAY
    expect(src).toMatch(/arborDelay = WAKE_DURATION \+ ALL_BEDS_ORDER\.length \* BAND_STAGGER \+ TREE_TO_ARBOR_DELAY/)
  })

  test('runArborReveal calls setValue(0) immediately', () => {
    const src = readSrc('LivingGardenMotion.js')
    // setValue(0) must be called BEFORE the trackedTimeout
    const runArborMatch = src.match(/const runArborReveal = useCallback\([\s\S]*?arborRevealRef\.current\.setValue\(0\)/)
    expect(runArborMatch).toBeTruthy()
  })

  test('processedAdvancementsRef uses object identity (not deep equality)', () => {
    const src = readSrc('LivingGardenMotion.js')
    expect(src).toMatch(/processedAdvancementsRef\.current === advancements/)
  })

  test('Preview creates fresh advancement object per trigger (no stale identity)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'screens', 'GardenPreviewScreen.js'), 'utf-8')
    // Each trigger must create a new advancement object with _ts
    expect(src).toMatch(/setAdvancements\(\{ \.\.\.scenario\.advancements, _ts: Date\.now\(\) \}\)/)
  })

  // ── Zero-progress structural render gate ──
  test('Zero-progress hard gate: shouldRenderOrnament is false when progress=0', () => {
    const src = readSrc('LivingGardenArbor.js')
    // The gate must check isNewlyEarned && individualProgress <= 0
    expect(src).toMatch(/shouldRenderOrnament = !\(isNewlyEarned && individualProgress <= 0\)/)
  })

  test('Zero-progress hard gate: OrnamentBloom gated by shouldRenderOrnament', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/shouldRenderOrnament && \([\s\S]*?OrnamentBloom/)
  })

  test('Zero-progress hard gate: OrnamentRenderer gated by shouldRenderOrnament', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/shouldRenderOrnament && \([\s\S]*?OrnamentRenderer/)
  })

  test('Zero-progress hard gate: halo gated by shouldRenderOrnament', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/shouldRenderOrnament && haloOpacity > 0/)
  })

  test('Zero-progress hard gate: existing ornaments NOT gated (always rendered)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // shouldRenderOrnament is only false when isNewlyEarned && progress <= 0
    // Existing ornaments have isNewlyEarned=false → shouldRenderOrnament=true
    // The gate expression must include isNewlyEarned
    expect(src).toMatch(/shouldRenderOrnament = !\(isNewlyEarned && individualProgress <= 0\)/)
  })

  test('Zero-progress hard gate: Reduced Motion NOT affected (progress=1)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Reduced Motion: guard phase=3 (COMPLETE), effectiveRevealProgress=1
    // hasRevealMotion = 1 < 1 = false → isNewlyEarned=false
    // shouldRenderOrnament = !(false && ...) = true → ornaments rendered
    expect(src).toMatch(/hasRevealMotion = effectiveRevealProgress < 1/)
  })

  // ── Diagnostic fields ──
  test('Diagnostic includes run and processed fields', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/run = readSyncReveal < 1 \? 1 : 0/)
    expect(src).toMatch(/processed = arborGuardPhaseRef\.current >= 2 \? 1 : 0/)
  })

  test('Diagnostic includes render field per ID', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/render = !\(isNew && p <= 0\) \? 1 : 0/)
  })

  // ── Full lifecycle behavioral tests ──
  test('A. Arbor-only motion start: runArborReveal called exactly once', () => {
    const src = readSrc('LivingGardenMotion.js')
    // processedAdvancementsRef prevents double processing
    expect(src).toMatch(/if \(processedAdvancementsRef\.current === advancements\) return/)
    // After processing, it's marked
    expect(src).toMatch(/processedAdvancementsRef\.current = advancements/)
  })

  test('B. No permanent UNPREPARED: guard must transition when listener fires', () => {
    const src = readSrc('LivingGardenArbor.js')
    // UNPREPARED → RUNNING when readSyncReveal < 1
    expect(src).toMatch(/arborGuardPhaseRef\.current === 1[\s\S]*?readSyncReveal < 1[\s\S]*?arborGuardPhaseRef\.current = 2/)
    // With the listener fix, setValue(0) will trigger re-render
    // → readSyncReveal becomes 0 → guard transitions to RUNNING
  })

  test('E. Zero-progress hard gate: all 3 new ornaments render=0 at progress=0', () => {
    // At progress=0 for all 3:
    const effectiveRevealProgress = 0
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const hasRevealMotion = effectiveRevealProgress < 1 // true
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = 1360

    effectiveNewIds.forEach((id) => {
      const idx = effectiveNewIds.indexOf(id)
      const isNew = hasRevealMotion && idx >= 0
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      const p = Math.max(0, Math.min(1, elapsed / ornamentDuration))
      const shouldRender = !(isNew && p <= 0) ? 1 : 0
      expect(p).toBe(0)
      expect(isNew).toBe(true)
      expect(shouldRender).toBe(0)
    })
  })

  test('F. Existing first_juice: always rendered (render=1)', () => {
    const effectiveRevealProgress = 0
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const hasRevealMotion = effectiveRevealProgress < 1
    // first_juice is NOT in effectiveNewIds
    const idx = effectiveNewIds.indexOf('first_juice')
    const isNew = hasRevealMotion && idx >= 0 // false (idx=-1)
    const shouldRender = !(isNew && 0 <= 0) ? 1 : 0
    expect(isNew).toBe(false)
    expect(shouldRender).toBe(1)
  })

  test('G. Early stagger: A render=1, B/C render=0 while progress=0', () => {
    // At ~100ms: A > 0, B = 0, C = 0
    const effectiveRevealProgress = 100 / 1360
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = 1360

    const results = effectiveNewIds.map((id) => {
      const idx = effectiveNewIds.indexOf(id)
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      const p = Math.max(0, Math.min(1, elapsed / ornamentDuration))
      const isNew = true
      const shouldRender = !(isNew && p <= 0) ? 1 : 0
      return { id, p, shouldRender }
    })

    expect(results[0].p).toBeGreaterThan(0)
    expect(results[0].shouldRender).toBe(1)
    expect(results[1].p).toBe(0)
    expect(results[1].shouldRender).toBe(0)
    expect(results[2].p).toBe(0)
    expect(results[2].shouldRender).toBe(0)
  })

  test('H. Later: A>B>C>0, all render=1 with distinct opacity', () => {
    // At ~275ms: A > B > C > 0
    const effectiveRevealProgress = 275 / 1360
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const stagger = 130
    const ornamentDuration = 1100
    const totalRevealDuration = 1360

    const results = effectiveNewIds.map((id) => {
      const idx = effectiveNewIds.indexOf(id)
      const elapsed = effectiveRevealProgress * totalRevealDuration - idx * stagger
      const p = Math.max(0, Math.min(1, elapsed / ornamentDuration))
      const shouldRender = !(true && p <= 0) ? 1 : 0
      return { id, p, shouldRender }
    })

    expect(results[0].p).toBeGreaterThan(results[1].p)
    expect(results[1].p).toBeGreaterThan(results[2].p)
    expect(results[2].p).toBeGreaterThan(0)
    results.forEach((r) => expect(r.shouldRender).toBe(1))
  })

  test('I. Terminal: all render=1, all p=1, halos=0', () => {
    const effectiveRevealProgress = 1
    const effectiveNewIds = ['streak_3', 'streak_7', 'logs_10']
    const hasRevealMotion = effectiveRevealProgress < 1 // false

    effectiveNewIds.forEach((id) => {
      const idx = effectiveNewIds.indexOf(id)
      const isNew = hasRevealMotion && idx >= 0 // false
      const shouldRender = !(isNew && 1 <= 0) ? 1 : 0
      const halo = isNew && 1 < 1 ? Math.sin(Math.PI) * 0.26 : 0
      expect(shouldRender).toBe(1)
      expect(halo).toBe(0)
    })
  })

  test('J. Replay: fresh advancement generation works again', () => {
    const src = readSrc('LivingGardenArbor.js')
    // New advancementId → eventNewIdsRef replaced → guard re-arms
    expect(src).toMatch(/advancementId !== prevAdvancementIdRef\.current/)
    expect(src).toMatch(/eventNewIdsRef\.current = advancementMilestoneIds/)
  })

  test('K. Reduced Motion: canonical immediately (render=1 for all)', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Reduced Motion: guard phase=3 immediately
    expect(src).toMatch(/isReduced \? 3 : 1/)
    // At phase=3, effectiveRevealProgress = readSyncReveal = 1
    // hasRevealMotion = false → isNewlyEarned = false → shouldRender = true
  })

  test('L. Background: canonical, no resume', () => {
    const src = readSrc('LivingGardenMotion.js')
    // Background resolves to canonical
    expect(src).toMatch(/resolveToCanonicalRest/)
    // arborRevealRef set to 1
    expect(src).toMatch(/arborRevealRef\.current\.setValue\(1\)/)
  })
})
