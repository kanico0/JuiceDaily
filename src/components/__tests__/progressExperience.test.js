// ─────────────────────────────────────────────────────────────
// progressExperience.test.js — Tests for the corrected first-
// release Progress Experience: Glow delta, Garden redesign,
// Journey Tree, and Milestone Arbor.
//
// Uses source inspection pattern (matching existing tests) since
// @testing-library/react-native is not available.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}))

import {
  GLOW_JOURNEY_PALETTE,
  getLeafVisualState,
} from '../GlowJourneyVisualState'
import {
  getRevealTier,
} from '../GardenProduceIcons'
import {
  GARDEN_PALETTE,
  BED_POSITIONS,
  BED_POSITIONS_COMPACT,
  TREE_POSITION,
  ARBOR_POSITION,
  TREE_POSITION_COMPACT,
  ARBOR_POSITION_COMPACT,
  getColorMarkerColor,
} from '../GardenVisualState'
import { GLOW_JOURNEY_STAGES, WEEKLY_GLOW_GOAL, getJourneyStage } from '../../constants/glowJourneyStages'
import { GARDEN_BEDS, GARDEN_COLORS } from '../../constants/gardenTaxonomy'
import { GARDEN_STAGES, getBedStages, isRainbowHarvestComplete } from '../../services/gardenService'
import { ARBOR_CATALOG, getArborEarnedCount, getArborSlotStates, ORNAMENT_TIERS } from '../MilestoneArborArtwork'
import { TREE_DESCRIPTORS } from '../JourneyTreeArtwork'

function readSrc(filename) {
  return fs.readFileSync(path.join(__dirname, '..', filename), 'utf-8')
}

function makeEntries(ingredientGroups) {
  return ingredientGroups.map((ingredients, i) => ({
    id: `entry-${i}`,
    dateKey: `2026-01-${String(i + 1).padStart(2, '0')}`,
    ingredients,
  }))
}

// ── Glow Journey delta tests ─────────────────────────────────

describe('Glow Journey — FINAL handoff delta', () => {
  test('WEEKLY_GLOW_GOAL remains exactly 3', () => {
    expect(WEEKLY_GLOW_GOAL).toBe(3)
  })

  test('juice-colored liquid palette is defined', () => {
    expect(GLOW_JOURNEY_PALETTE.juiceLiquidBase).toBeDefined()
    expect(GLOW_JOURNEY_PALETTE.juiceLiquidTopBand).toBeDefined()
    // Warm orange base (hex color string)
    expect(typeof GLOW_JOURNEY_PALETTE.juiceLiquidBase).toBe('string')
    expect(GLOW_JOURNEY_PALETTE.juiceLiquidBase.startsWith('#')).toBe(true)
    // Mint/green secondary band (hex color string)
    expect(typeof GLOW_JOURNEY_PALETTE.juiceLiquidTopBand).toBe('string')
    expect(GLOW_JOURNEY_PALETTE.juiceLiquidTopBand.startsWith('#')).toBe(true)
  })

  test('GlowJourneyDropArtwork uses two-tone juice gradient', () => {
    const src = readSrc('GlowJourneyDropArtwork.js')
    expect(src).toContain('juiceLiquidBase')
    expect(src).toContain('juiceLiquidTopBand')
    // Should NOT use stageProps.liquidColor for the liquid gradient
    expect(src).not.toContain('stopColor={stageProps.liquidColor}')
  })

  test('custom vector stage icon replaces emoji in production UI', () => {
    const src = readSrc('GlowJourneyDrop.js')
    expect(src).toContain('GlowJourneyStageIcon')
    // Emoji Text should no longer be rendered
    expect(src).not.toContain('stage.emoji')
  })

  test('GlowJourneyStageIcon component exists with all 7 stages', () => {
    const src = readSrc('GlowJourneyStageIcon.js')
    expect(src).toContain("case 'seed'")
    expect(src).toContain("case 'sprout'")
    expect(src).toContain("case 'growing'")
    expect(src).toContain("case 'blooming'")
    expect(src).toContain("case 'thriving'")
    expect(src).toContain("case 'radiant'")
    expect(src).toContain("case 'legend'")
    // No emoji characters
    expect(src).not.toMatch(/[🌱🌿🌳🌸✨🌅👑]/)
  })

  test('halo leaf fill uses bright green/mint color', () => {
    // Correction addendum §1.2: filled leaves use solid bright green/mint
    const leaf = { hasLog: true, isToday: false, isFuture: false }
    const stageProps = { liquidColor: '#DCE7D3' }
    const visual = getLeafVisualState(leaf, stageProps)
    expect(visual.fillColor).toBe(GLOW_JOURNEY_PALETTE.haloFilledColor)
    expect(visual.showGoldDot).toBe(true)
  })

  test('halo unfilled leaf has dim outline only, no fill', () => {
    // Correction addendum §1.2: unfilled leaves are thin outline only
    const leaf = { hasLog: false, isToday: false, isFuture: false }
    const stageProps = { liquidColor: '#DCE7D3' }
    const visual = getLeafVisualState(leaf, stageProps)
    expect(visual.filled).toBe(false)
    expect(visual.fillColor).toBe('none')
    expect(visual.strokeColor).toBe(GLOW_JOURNEY_PALETTE.haloUnfilledStroke)
    expect(visual.showGoldDot).toBe(false)
  })

  test('Journey stages and thresholds unchanged', () => {
    expect(GLOW_JOURNEY_STAGES).toHaveLength(7)
    expect(GLOW_JOURNEY_STAGES[0].key).toBe('seed')
    expect(GLOW_JOURNEY_STAGES[0].min).toBe(1)
    expect(GLOW_JOURNEY_STAGES[6].key).toBe('legend')
    expect(GLOW_JOURNEY_STAGES[6].min).toBe(200)
  })

  test('time-horizon clarity: This Week / Lifetime chip grouping', () => {
    const src = readSrc('GlowJourneyDrop.js')
    expect(src).toContain('This Week')
    expect(src).toContain('Lifetime')
  })

  test('reduced-motion path preserved in GlowJourneyDrop', () => {
    const src = readSrc('GlowJourneyDrop.js')
    expect(src).toContain('isReduced')
  })
})

// ── Garden redesign tests ────────────────────────────────────

describe('Garden — FINAL handoff redesign', () => {
  test('exactly 7 produce beds', () => {
    expect(GARDEN_BEDS).toHaveLength(7)
    expect(GARDEN_BEDS).toContain('greens')
    expect(GARDEN_BEDS).toContain('roots')
    expect(GARDEN_BEDS).toContain('citrus')
    expect(GARDEN_BEDS).toContain('orchard')
    expect(GARDEN_BEDS).toContain('berries')
    expect(GARDEN_BEDS).toContain('tropical')
    expect(GARDEN_BEDS).toContain('herbs')
  })

  test('no Melon Patch or Wheatgrass beds', () => {
    expect(GARDEN_BEDS).not.toContain('melon')
    expect(GARDEN_BEDS).not.toContain('wheatgrass_sprouts')
  })

  test('BED_POSITIONS has all 7 beds in 3x3 grid', () => {
    const beds = Object.keys(BED_POSITIONS)
    expect(beds).toHaveLength(7)
    for (const bed of beds) {
      expect(BED_POSITIONS[bed].x).toBeDefined()
      expect(BED_POSITIONS[bed].y).toBeDefined()
      expect(BED_POSITIONS[bed].w).toBeDefined()
      expect(BED_POSITIONS[bed].h).toBeDefined()
    }
  })

  test('TREE_POSITION and ARBOR_POSITION are defined', () => {
    expect(TREE_POSITION).toBeDefined()
    expect(TREE_POSITION.x).toBeDefined()
    expect(ARBOR_POSITION).toBeDefined()
    expect(ARBOR_POSITION.x).toBeDefined()
  })

  test('BED_POSITIONS_COMPACT has all 7 beds', () => {
    const beds = Object.keys(BED_POSITIONS_COMPACT)
    expect(beds).toHaveLength(7)
  })

  test('TREE_POSITION_COMPACT and ARBOR_POSITION_COMPACT are defined', () => {
    expect(TREE_POSITION_COMPACT).toBeDefined()
    expect(ARBOR_POSITION_COMPACT).toBeDefined()
  })

  test('three-tier reveal mapping from 6-stage engine', () => {
    // Empty -> not_tried
    expect(getRevealTier('empty')).toBe('not_tried')
    expect(getRevealTier(null)).toBe('not_tried')
    // Seed/Sprout/Growing -> tried
    expect(getRevealTier('seed')).toBe('tried')
    expect(getRevealTier('sprout')).toBe('tried')
    expect(getRevealTier('growing')).toBe('tried')
    // Harvesting/Flourishing -> well_explored
    expect(getRevealTier('harvesting')).toBe('well_explored')
    expect(getRevealTier('flourishing')).toBe('well_explored')
  })

  test('Garden thresholds unchanged (6 stages)', () => {
    expect(GARDEN_STAGES).toHaveLength(6)
    expect(GARDEN_STAGES[0].key).toBe('empty')
    expect(GARDEN_STAGES[0].threshold).toBe(0)
    expect(GARDEN_STAGES[5].key).toBe('flourishing')
    expect(GARDEN_STAGES[5].threshold).toBe(7)
  })

  test('literal produce icons exist for all 7 beds', () => {
    const src = readSrc('GardenProduceIcons.js')
    expect(src).toContain('GreensIcon')
    expect(src).toContain('RootsIcon')
    expect(src).toContain('CitrusIcon')
    expect(src).toContain('OrchardIcon')
    expect(src).toContain('BerriesIcon')
    expect(src).toContain('TropicalIcon')
    expect(src).toContain('HerbsIcon')
  })

  test('GardenArtwork renders 3x3 grid with Tree and Arbor', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).toContain('garden_tree')
    expect(src).toContain('garden_arbor')
    expect(src).toContain('JourneyTreeArtwork')
    expect(src).toContain('MilestoneArborArtwork')
    expect(src).toContain('GardenProduceIcon')
    expect(src).toContain('GardenColorMarker')
  })

  test('GardenCompactArtwork renders Tree and Arbor', () => {
    const src = readSrc('GardenCompactArtwork.js')
    expect(src).toContain('garden_compact_tree')
    expect(src).toContain('garden_compact_arbor')
    expect(src).toContain('JourneyTreeArtwork')
    expect(src).toContain('MilestoneArborArtwork')
  })

  test('shaped color markers exist with 6 distinct shapes', () => {
    const src = readSrc('GardenColorMarkers.js')
    expect(src).toContain('LeafMarker')
    expect(src).toContain('CircleMarker')
    expect(src).toContain('DiamondMarker')
    expect(src).toContain('SunRaysMarker')
    expect(src).toContain('BerryClusterMarker')
    expect(src).toContain('SeedMarker')
  })

  test('GardenArtwork does not load external SVG files', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).not.toContain('Docs/')
    expect(src).not.toMatch(/\.svg['"]/)
  })

  test('GardenCompactArtwork does not load external SVG files', () => {
    const src = readSrc('GardenCompactArtwork.js')
    expect(src).not.toContain('Docs/')
    expect(src).not.toMatch(/\.svg['"]/)
  })

  test('native labels under each card in GardenArtwork', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).toContain('shortLabel')
  })

  test('GardenCard passes journeyStageKey and arborCtx', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('journeyStageKey')
    expect(src).toContain('arborCtx')
    expect(src).toContain('unlockedAchievementIds')
  })

  test('GardenDetail passes journeyStageKey and arborCtx to artwork', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('journeyStageKey')
    expect(src).toContain('arborCtx')
    expect(src).toContain('unlockedAchievementIds')
  })

  test('GardenDetail has Journey Tree and Milestone Arbor sections', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('Journey Tree')
    expect(src).toContain('Milestone Arbor')
    expect(src).toContain('earned so far')
  })
})

// ── Journey Tree tests ───────────────────────────────────────

describe('Journey Tree — pure second renderer', () => {
  test('TREE_DESCRIPTORS has all 7 stages', () => {
    expect(Object.keys(TREE_DESCRIPTORS)).toHaveLength(7)
    expect(TREE_DESCRIPTORS.seed).toBe('Seed')
    expect(TREE_DESCRIPTORS.sprout).toBe('Sprout')
    expect(TREE_DESCRIPTORS.growing).toBe('Sapling')
    expect(TREE_DESCRIPTORS.blooming).toBe('Young Tree')
    expect(TREE_DESCRIPTORS.thriving).toBe('Established Tree')
    expect(TREE_DESCRIPTORS.radiant).toBe('Elder Tree')
    expect(TREE_DESCRIPTORS.legend).toBe('Heritage Tree')
  })

  test('JourneyTreeArtwork renders all 7 stages', () => {
    const src = readSrc('JourneyTreeArtwork.js')
    expect(src).toContain("case 'seed'")
    expect(src).toContain("case 'sprout'")
    expect(src).toContain("case 'growing'")
    expect(src).toContain("case 'blooming'")
    expect(src).toContain("case 'thriving'")
    expect(src).toContain("case 'radiant'")
    expect(src).toContain("case 'legend'")
  })

  test('Tree uses same canonical Journey Stage as Glow', () => {
    // Verify that getJourneyStage produces the same stages the Tree expects
    const stage1 = getJourneyStage(1)
    expect(stage1.key).toBe('seed')
    const stage200 = getJourneyStage(200)
    expect(stage200.key).toBe('legend')
    // Tree descriptors must match these keys
    expect(TREE_DESCRIPTORS[stage1.key]).toBeDefined()
    expect(TREE_DESCRIPTORS[stage200.key]).toBeDefined()
  })

  test('Tree has ghost-next-canopy mechanic', () => {
    const src = readSrc('JourneyTreeArtwork.js')
    expect(src).toContain('tree_canopy_ghost_next')
  })

  test('Tree has no Heritage bird', () => {
    const src = readSrc('JourneyTreeArtwork.js')
    // No bird rendering in the SVG artwork (excluding comments)
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
    const codeOnly = codeLines.join('\n')
    expect(codeOnly).not.toMatch(/<[^>]*bird/i)
    expect(codeOnly).not.toContain('HeritageBird')
    expect(codeOnly).not.toContain('heritage_bird')
  })

  test('Tree does not create separate progression state', () => {
    const src = readSrc('JourneyTreeArtwork.js')
    // Should not import from AsyncStorage or create new persistence
    expect(src).not.toContain('AsyncStorage')
    expect(src).not.toContain('useState')
  })

  test('Tree reuses Drop stage motifs (gold trim, rays, glow)', () => {
    const src = readSrc('JourneyTreeArtwork.js')
    expect(src).toContain('tree_gold_vein_trim')
    expect(src).toContain('tree_rays')
    expect(src).toContain('tree_resting_glow')
  })
})

// ── Milestone Arbor tests ────────────────────────────────────

describe('Milestone Arbor — 12-slot launch catalog', () => {
  test('exactly 12 catalog entries', () => {
    expect(ARBOR_CATALOG).toHaveLength(12)
  })

  test('catalog includes 4 existing achievements', () => {
    const ids = ARBOR_CATALOG.map((e) => e.id)
    expect(ids).toContain('first_juice')
    expect(ids).toContain('streak_3')
    expect(ids).toContain('streak_7')
    expect(ids).toContain('logs_10')
  })

  test('catalog includes 7 bed flourishing milestones', () => {
    const ids = ARBOR_CATALOG.map((e) => e.id)
    expect(ids).toContain('greens_flourishing')
    expect(ids).toContain('roots_flourishing')
    expect(ids).toContain('citrus_flourishing')
    expect(ids).toContain('orchard_flourishing')
    expect(ids).toContain('berries_flourishing')
    expect(ids).toContain('tropical_flourishing')
    expect(ids).toContain('herbs_flourishing')
  })

  test('catalog includes Rainbow Harvest', () => {
    const ids = ARBOR_CATALOG.map((e) => e.id)
    expect(ids).toContain('rainbow_harvest')
  })

  test('no Journey stage milestones in Arbor', () => {
    const ids = ARBOR_CATALOG.map((e) => e.id)
    expect(ids).not.toContain('journey_seed')
    expect(ids).not.toContain('journey_sprout')
    expect(ids).not.toContain('journey_growing')
    expect(ids).not.toContain('journey_blooming')
    expect(ids).not.toContain('journey_thriving')
    expect(ids).not.toContain('journey_radiant')
    expect(ids).not.toContain('journey_legend')
  })

  test('no anniversary milestones in Arbor', () => {
    const ids = ARBOR_CATALOG.map((e) => e.id)
    expect(ids).not.toContain('anniversary')
    expect(ids).not.toContain('first_anniversary')
  })

  test('tier mapping: first_juice = LEAF', () => {
    const entry = ARBOR_CATALOG.find((e) => e.id === 'first_juice')
    expect(entry.tier).toBe(ORNAMENT_TIERS.LEAF)
  })

  test('tier mapping: streak_3 = BLOSSOM', () => {
    const entry = ARBOR_CATALOG.find((e) => e.id === 'streak_3')
    expect(entry.tier).toBe(ORNAMENT_TIERS.BLOSSOM)
  })

  test('tier mapping: streak_7 = FRUIT', () => {
    const entry = ARBOR_CATALOG.find((e) => e.id === 'streak_7')
    expect(entry.tier).toBe(ORNAMENT_TIERS.FRUIT)
  })

  test('tier mapping: logs_10 = MEDALLION', () => {
    const entry = ARBOR_CATALOG.find((e) => e.id === 'logs_10')
    expect(entry.tier).toBe(ORNAMENT_TIERS.MEDALLION)
  })

  test('tier mapping: all 7 flourishing = FRUIT', () => {
    const flourishing = ARBOR_CATALOG.filter((e) => e.id.endsWith('_flourishing'))
    expect(flourishing).toHaveLength(7)
    for (const entry of flourishing) {
      expect(entry.tier).toBe(ORNAMENT_TIERS.FRUIT)
    }
  })

  test('tier mapping: rainbow_harvest = MEDALLION', () => {
    const entry = ARBOR_CATALOG.find((e) => e.id === 'rainbow_harvest')
    expect(entry.tier).toBe(ORNAMENT_TIERS.MEDALLION)
  })

  test('flourishing qualification reads existing bed stage === flourishing', () => {
    const entries = makeEntries([
      ['kale', 'spinach', 'swiss_chard', 'collard_greens', 'arugula', 'romaine', 'bok_choy'],
    ])
    const bedStages = getBedStages(entries)
    const ctx = {
      unlockedAchievementIds: [],
      bedStages,
      rainbowComplete: false,
    }
    // Greens bed has 7 produce -> flourishing
    expect(bedStages.greens.key).toBe('flourishing')
    const greensSlot = ARBOR_CATALOG.find((e) => e.id === 'greens_flourishing')
    expect(greensSlot.qualifies(ctx)).toBe(true)
  })

  test('Rainbow Harvest qualification reads existing isRainbowHarvestComplete', () => {
    const entries = makeEntries([['kale', 'strawberry', 'carrot', 'lemon', 'blueberry', 'ginger']])
    const rainbowComplete = isRainbowHarvestComplete(entries)
    expect(rainbowComplete).toBe(true)
    const ctx = {
      unlockedAchievementIds: [],
      bedStages: {},
      rainbowComplete,
    }
    const rainbowSlot = ARBOR_CATALOG.find((e) => e.id === 'rainbow_harvest')
    expect(rainbowSlot.qualifies(ctx)).toBe(true)
  })

  test('achievement qualification reads existing unlockedAchievementIds', () => {
    const ctx = {
      unlockedAchievementIds: ['first_juice', 'streak_3'],
      bedStages: {},
      rainbowComplete: false,
    }
    const firstJuiceSlot = ARBOR_CATALOG.find((e) => e.id === 'first_juice')
    expect(firstJuiceSlot.qualifies(ctx)).toBe(true)
    const streak3Slot = ARBOR_CATALOG.find((e) => e.id === 'streak_3')
    expect(streak3Slot.qualifies(ctx)).toBe(true)
    const streak7Slot = ARBOR_CATALOG.find((e) => e.id === 'streak_7')
    expect(streak7Slot.qualifies(ctx)).toBe(false)
  })

  test('getArborEarnedCount returns correct count', () => {
    const ctx = {
      unlockedAchievementIds: ['first_juice', 'streak_3'],
      bedStages: {},
      rainbowComplete: false,
    }
    expect(getArborEarnedCount(ctx)).toBe(2)
  })

  test('getArborSlotStates returns 12 slot states', () => {
    const ctx = {
      unlockedAchievementIds: [],
      bedStages: {},
      rainbowComplete: false,
    }
    const slots = getArborSlotStates(ctx)
    expect(slots).toHaveLength(12)
    for (const slot of slots) {
      expect(slot.earned).toBe(false)
      expect(slot.tier).toBeDefined()
      expect(slot.label).toBeDefined()
    }
  })

  test('Arbor displays "earned so far" not "X of Y"', () => {
    const src = readSrc('MilestoneArborArtwork.js')
    expect(src).toContain('earned so far')
    expect(src).not.toContain('of 12')
  })

  test('Arbor has generic empty peg for unearned slots', () => {
    const src = readSrc('MilestoneArborArtwork.js')
    expect(src).toContain('EmptyPeg')
    expect(src).toContain('arbor_slot_empty')
  })

  test('Arbor does not preview ornament icon in unearned slots', () => {
    const src = readSrc('MilestoneArborArtwork.js')
    // Unearned slots should only render EmptyPeg, not a ghosted ornament
    expect(src).toContain('slot.earned')
    expect(src).toContain('EmptyPeg')
    // The ternary should gate ornament rendering on slot.earned
    expect(src).toContain('slot.earned && OrnamentRenderer')
  })

  test('Arbor has 4 ornament tier renderers', () => {
    const src = readSrc('MilestoneArborArtwork.js')
    expect(src).toContain('LeafOrnament')
    expect(src).toContain('BlossomOrnament')
    expect(src).toContain('FruitOrnament')
    expect(src).toContain('MedallionOrnament')
  })

  test('Arbor does not create new thresholds or persistence', () => {
    const src = readSrc('MilestoneArborArtwork.js')
    // No AsyncStorage import (no new persistence)
    expect(src).not.toMatch(/import.*AsyncStorage/)
    // No new threshold constants defined in code (excluding comments)
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//'))
    const codeOnly = codeLines.join('\n')
    expect(codeOnly).not.toMatch(/const\s+\w*Threshold\w*\s*=/)
    expect(codeOnly).not.toMatch(/THRESHOLD\s*=/)
  })
})

// ── Regression: existing tests still valid ───────────────────

describe('Regression — existing architecture preserved', () => {
  test('Garden palette still has required tokens', () => {
    expect(GARDEN_PALETTE.canvasColor).toBeDefined()
    expect(GARDEN_PALETTE.glowColor).toBeDefined()
    expect(GARDEN_PALETTE.particleColor).toBeDefined()
    expect(GARDEN_PALETTE.bedSoilColor).toBeDefined()
  })

  test('getColorMarkerColor returns color for each key', () => {
    for (const key of GARDEN_COLORS) {
      expect(getColorMarkerColor(key)).toBeTruthy()
    }
  })

  test('GardenArtwork defines canonical SVG named groups', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).toContain('garden_canvas')
    expect(src).toContain('garden_beds')
    expect(src).toContain('garden_color_markers')
    expect(src).toContain('garden_rainbow_harvest')
  })

  test('GardenCompactArtwork defines compact named groups', () => {
    const src = readSrc('GardenCompactArtwork.js')
    expect(src).toContain('garden_compact_canvas')
    expect(src).toContain('garden_compact_beds')
    expect(src).toContain('garden_compact_color_markers')
  })

  test('no idle animation loops in Garden components', () => {
    const files = ['GardenArtwork.js', 'GardenCompactArtwork.js', 'GardenCard.js', 'GardenDetail.js']
    for (const file of files) {
      const src = readSrc(file)
      expect(src).not.toContain('Animated.loop')
    }
  })

  test('Garden components accept isReduced prop', () => {
    const files = ['GardenArtwork.js', 'GardenCompactArtwork.js', 'GardenCard.js', 'GardenDetail.js']
    for (const file of files) {
      const src = readSrc(file)
      expect(src).toContain('isReduced')
    }
  })

  test('Garden components have accessibility labels', () => {
    const files = ['GardenArtwork.js', 'GardenCompactArtwork.js', 'GardenCard.js', 'GardenDetail.js']
    for (const file of files) {
      const src = readSrc(file)
      expect(src).toContain('accessibilityLabel')
    }
  })
})
