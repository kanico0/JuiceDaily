// ─────────────────────────────────────────────────────────────
// gardenVisual.test.js — Tests for Garden visual state,
// artwork components, card, and detail.
//
// Uses source inspection pattern (matching glowJourney.test.js)
// since @testing-library/react-native is not available.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}))

import {
  GARDEN_PALETTE,
  getBedStageVisualProps,
  getColorMarkerColor,
  BED_POSITIONS,
  BED_POSITIONS_COMPACT,
  buildGardenVisualState,
} from '../GardenVisualState'
import { getGardenSummary } from '../../services/gardenService'

// ── Helper ───────────────────────────────────────────────────
function makeEntries(ingredientGroups) {
  return ingredientGroups.map((ingredients, i) => ({
    id: `entry-${i}`,
    dateKey: `2026-01-${String(i + 1).padStart(2, '0')}`,
    ingredients,
  }))
}

function readSrc(filename) {
  return fs.readFileSync(
    path.join(__dirname, '..', filename),
    'utf-8'
  )
}

// ── GardenVisualState tests ──────────────────────────────────

describe('GardenVisualState', () => {
  test('GARDEN_PALETTE has required color tokens', () => {
    expect(GARDEN_PALETTE.canvasColor).toBeDefined()
    expect(GARDEN_PALETTE.glowColor).toBeDefined()
    expect(GARDEN_PALETTE.particleColor).toBeDefined()
    expect(GARDEN_PALETTE.bedSoilColor).toBeDefined()
  })

  test('getBedStageVisualProps returns props for each stage', () => {
    const stages = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']
    for (const stage of stages) {
      const props = getBedStageVisualProps(stage)
      expect(props).toBeDefined()
      expect(props.soilFill).toBeDefined()
      expect(props.plantOpacity).toBeDefined()
    }
  })

  test('getBedStageVisualProps returns empty for null/unknown', () => {
    expect(getBedStageVisualProps(null).soilFill).toBeDefined()
    expect(getBedStageVisualProps('unknown').soilFill).toBeDefined()
  })

  test('getColorMarkerColor returns color for each color key', () => {
    expect(getColorMarkerColor('green')).toBeTruthy()
    expect(getColorMarkerColor('red')).toBeTruthy()
    expect(getColorMarkerColor('orange')).toBeTruthy()
    expect(getColorMarkerColor('yellow')).toBeTruthy()
    expect(getColorMarkerColor('purple')).toBeTruthy()
    expect(getColorMarkerColor('tan')).toBeTruthy()
  })

  test('BED_POSITIONS has all 7 beds', () => {
    const beds = Object.keys(BED_POSITIONS)
    expect(beds).toHaveLength(7)
    for (const bed of beds) {
      expect(BED_POSITIONS[bed].x).toBeDefined()
      expect(BED_POSITIONS[bed].y).toBeDefined()
      expect(BED_POSITIONS[bed].w).toBeDefined()
      expect(BED_POSITIONS[bed].h).toBeDefined()
    }
  })

  test('BED_POSITIONS_COMPACT has all 7 beds', () => {
    const beds = Object.keys(BED_POSITIONS_COMPACT)
    expect(beds).toHaveLength(7)
  })

  test('buildGardenVisualState returns complete state object', () => {
    const entries = makeEntries([['kale', 'carrot', 'lemon']])
    const summary = getGardenSummary(entries)
    const visualState = buildGardenVisualState(summary)
    expect(visualState).toBeDefined()
    expect(visualState.bedVisuals).toBeDefined()
    expect(visualState.colorMarkers).toBeDefined()
    expect(visualState.discoveredCount).toBe(3)
    expect(visualState.rainbowComplete).toBe(false)
    expect(visualState.bedsStarted).toBe(3)
  })

  test('buildGardenVisualState returns null for null summary', () => {
    expect(buildGardenVisualState(null)).toBeNull()
  })

  test('buildGardenVisualState reflects rainbow completion', () => {
    const entries = makeEntries([['kale', 'strawberry', 'carrot', 'lemon', 'blueberry', 'ginger']])
    const summary = getGardenSummary(entries)
    const visualState = buildGardenVisualState(summary)
    expect(visualState.rainbowComplete).toBe(true)
  })
})

// ── Named group tests ────────────────────────────────────────

describe('Garden artwork named groups', () => {
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

  test('GardenBedArtwork defines per-bed growth layer groups', () => {
    const src = readSrc('GardenBedArtwork.js')
    expect(src).toContain('garden_${bedKey}_soil')
    expect(src).toContain('garden_${bedKey}_sprouts')
    expect(src).toContain('garden_${bedKey}_leaves')
    expect(src).toContain('garden_${bedKey}_flowers')
    expect(src).toContain('garden_${bedKey}_fruit')
    expect(src).toContain('garden_${bedKey}_glow')
  })

  test('artwork uses display prop not image swapping', () => {
    const src = readSrc('GardenBedArtwork.js')
    expect(src).toContain('display=')
  })
})

// ── No external SVG file loading ─────────────────────────────

describe('No runtime SVG file loading', () => {
  test('GardenArtwork does not load SVG files from Docs', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).not.toContain('Docs/')
    expect(src).not.toContain('.svg')
  })

  test('GardenCompactArtwork does not load SVG files', () => {
    const src = readSrc('GardenCompactArtwork.js')
    expect(src).not.toContain('Docs/')
    expect(src).not.toContain('.svg')
  })

  test('GardenBedArtwork does not load SVG files', () => {
    const src = readSrc('GardenBedArtwork.js')
    expect(src).not.toContain('Docs/')
    expect(src).not.toContain('.svg')
  })
})

// ── Semantic tokens usage ────────────────────────────────────

describe('Semantic token usage', () => {
  test('GardenCard uses SEMANTIC_COLORS not hard-coded', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('SEMANTIC_COLORS')
    expect(src).toContain('SEMANTIC_TYPOGRAPHY')
  })

  test('GardenDetail uses SEMANTIC_COLORS not hard-coded', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('SEMANTIC_COLORS')
    expect(src).toContain('SEMANTIC_TYPOGRAPHY')
  })
})

// ── Responsive behavior ──────────────────────────────────────

describe('Responsive behavior', () => {
  test('GardenCard uses useWindowDimensions not static Dimensions', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('useWindowDimensions')
    expect(src).not.toContain('Dimensions.get')
  })

  test('GardenDetail uses useWindowDimensions', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('useWindowDimensions')
  })

  test('GardenCard has MIN_CARD_WIDTH and MAX_CARD_WIDTH bounds', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('MIN_CARD_WIDTH')
    expect(src).toContain('MAX_CARD_WIDTH')
  })
})

// ── Accessibility ────────────────────────────────────────────

describe('Accessibility', () => {
  test('GardenCard has accessibilityLabel and accessibilityRole', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('accessibilityLabel')
    expect(src).toContain('accessibilityRole')
    expect(src).toContain('accessibilityHint')
  })

  test('GardenDetail has accessibilityLabel', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('accessibilityLabel')
  })

  test('GardenArtwork has accessibilityLabel', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).toContain('accessibilityLabel')
  })

  test('GardenCard has min 44pt touch target (Pressable)', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('Pressable')
  })

  test('GardenDetail bed items have min 44pt touch target', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('minHeight: 44')
  })
})

// ── No idle animation loops ──────────────────────────────────

describe('No idle animation loops', () => {
  test('GardenArtwork has no Animated.loop', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).not.toContain('Animated.loop')
  })

  test('GardenCompactArtwork has no Animated.loop', () => {
    const src = readSrc('GardenCompactArtwork.js')
    expect(src).not.toContain('Animated.loop')
  })

  test('GardenCard has no Animated.loop', () => {
    const src = readSrc('GardenCard.js')
    expect(src).not.toContain('Animated.loop')
  })

  test('GardenDetail has no Animated.loop', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).not.toContain('Animated.loop')
  })
})

// ── Reduced motion support ───────────────────────────────────

describe('Reduced motion support', () => {
  test('GardenCard accepts isReduced prop', () => {
    const src = readSrc('GardenCard.js')
    expect(src).toContain('isReduced')
  })

  test('GardenDetail accepts isReduced prop', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).toContain('isReduced')
  })

  test('GardenArtwork accepts isReduced prop', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).toContain('isReduced')
  })

  test('GardenCompactArtwork accepts isReduced prop', () => {
    const src = readSrc('GardenCompactArtwork.js')
    expect(src).toContain('isReduced')
  })
})

// ── No Glow Journey imports in Garden components ─────────────

describe('No cross-contamination with Glow Journey', () => {
  test('GardenArtwork does not import GlowJourney components', () => {
    const src = readSrc('GardenArtwork.js')
    expect(src).not.toContain('GlowJourney')
    expect(src).not.toContain('glowJourney')
  })

  test('GardenCard does not import GlowJourney components', () => {
    const src = readSrc('GardenCard.js')
    expect(src).not.toContain('GlowJourney')
    expect(src).not.toContain('glowJourney')
  })

  test('GardenDetail does not import GlowJourney components', () => {
    const src = readSrc('GardenDetail.js')
    expect(src).not.toContain('GlowJourney')
    expect(src).not.toContain('glowJourney')
  })
})
