// ─────────────────────────────────────────────────────────────
// gardenCelebration.test.js — Tests for Garden celebration
// overlay, coordinator integration, and TodayScreen integration.
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}))

import { CELEBRATION_TYPES } from '../../hooks/useCelebrationCoordinator'

function readSrc(filepath) {
  return fs.readFileSync(path.join(__dirname, '..', filepath), 'utf-8')
}

function readScreenSrc() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'screens', 'TodayScreen.js'),
    'utf-8'
  )
}

// ── Celebration coordinator tests ─────────────────────────────

describe('Garden celebration coordinator types', () => {
  test('CELEBRATION_TYPES includes Garden types', () => {
    expect(CELEBRATION_TYPES.GARDEN_DISCOVERY).toBe('garden_discovery')
    expect(CELEBRATION_TYPES.GARDEN_BED_MILESTONE).toBe('garden_bed_milestone')
    expect(CELEBRATION_TYPES.GARDEN_COLOR).toBe('garden_color')
    expect(CELEBRATION_TYPES.GARDEN_RAINBOW).toBe('garden_rainbow')
  })

  test('existing Glow Journey types are preserved', () => {
    expect(CELEBRATION_TYPES.WEEKLY).toBe('weekly')
    expect(CELEBRATION_TYPES.STAGE).toBe('stage')
  })
})

// ── GardenCelebrationOverlay source tests ────────────────────

describe('GardenCelebrationOverlay', () => {
  test('handles all four Garden celebration types', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).toContain('garden_discovery')
    expect(src).toContain('garden_bed_milestone')
    expect(src).toContain('garden_color')
    expect(src).toContain('garden_rainbow')
  })

  test('uses isReduced for animationType', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).toContain('isReduced')
    expect(src).toContain("isReduced ? 'none' : 'fade'")
  })

  test('uses SEMANTIC_COLORS not hard-coded', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).toContain('SEMANTIC_COLORS')
  })

  test('has accessibility labels', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).toContain('accessibilityLabel')
    expect(src).toContain('accessibilityRole')
  })

  test('has no Animated.loop', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).not.toContain('Animated.loop')
  })

  test('has no Glow Journey imports', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).not.toContain('GlowJourney')
    expect(src).not.toContain('glowJourney')
  })

  test('has 44pt min touch target', () => {
    const src = readSrc('GardenCelebrationOverlay.js')
    expect(src).toContain('minHeight: 44')
  })
})

// ── TodayScreen integration tests ────────────────────────────

describe('TodayScreen Garden integration', () => {
  test('imports GardenCard, GardenDetail, and GardenCelebrationOverlay', () => {
    const src = readScreenSrc()
    expect(src).toContain('GardenCard')
    expect(src).toContain('GardenDetail')
    expect(src).toContain('GardenCelebrationOverlay')
  })

  test('imports gardenService functions', () => {
    const src = readScreenSrc()
    expect(src).toContain('getGardenSummary')
    expect(src).toContain('initializeGardenBaseline')
    expect(src).toContain('detectNewDiscoveries')
    expect(src).toContain('detectBedMilestones')
    expect(src).toContain('detectRainbowHarvest')
  })

  test('imports CELEBRATION_TYPES', () => {
    const src = readScreenSrc()
    expect(src).toContain('CELEBRATION_TYPES')
  })

  test('has gardenViewedRef for once-only analytics', () => {
    const src = readScreenSrc()
    expect(src).toContain('gardenViewedRef')
  })

  test('has prevGardenEntriesRef for discovery detection', () => {
    const src = readScreenSrc()
    expect(src).toContain('prevGardenEntriesRef')
  })

  test('calls initializeGardenBaseline', () => {
    const src = readScreenSrc()
    expect(src).toContain('initializeGardenBaseline')
  })

  test('tracks garden_viewed analytics event', () => {
    const src = readScreenSrc()
    expect(src).toContain("trackEvent('garden_viewed'")
  })

  test('tracks garden_card_tapped analytics event', () => {
    const src = readScreenSrc()
    expect(src).toContain("trackEvent('garden_card_tapped'")
  })

  test('tracks garden_produce_discovered analytics event', () => {
    const src = readScreenSrc()
    expect(src).toContain("trackEvent('garden_produce_discovered'")
  })

  test('tracks garden_bed_stage_reached analytics event', () => {
    const src = readScreenSrc()
    expect(src).toContain("trackEvent('garden_bed_stage_reached'")
  })

  test('tracks garden_color_discovered analytics event', () => {
    const src = readScreenSrc()
    expect(src).toContain("trackEvent('garden_color_discovered'")
  })

  test('tracks garden_rainbow_harvest analytics event', () => {
    const src = readScreenSrc()
    expect(src).toContain("trackEvent('garden_rainbow_harvest'")
  })

  test('renders GardenCard in ScrollView', () => {
    const src = readScreenSrc()
    expect(src).toContain('<GardenCard')
  })

  test('renders GardenDetail modal', () => {
    const src = readScreenSrc()
    expect(src).toContain('<GardenDetail')
  })

  test('renders GardenCelebrationOverlay', () => {
    const src = readScreenSrc()
    expect(src).toContain('<GardenCelebrationOverlay')
  })

  test('Garden celebration checks pendingAchievement and stageCelebration', () => {
    const src = readScreenSrc()
    expect(src).toContain('!pendingAchievement && !stageCelebration && gardenCelebration')
  })

  test('passes isReduced to GardenCard', () => {
    const src = readScreenSrc()
    expect(src).toContain('isReduced={isReduced}')
  })

  test('passes isReduced to GardenDetail', () => {
    const src = readScreenSrc()
    expect(src).toContain('isReduced={isReduced}')
  })

  test('passes isReduced to GardenCelebrationOverlay', () => {
    const src = readScreenSrc()
    expect(src).toContain('isReduced={isReduced}')
  })
})

// ── Analytics schema tests ───────────────────────────────────

describe('Garden analytics event schemas', () => {
  test('all Garden event schemas exist in AnalyticsService', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'AnalyticsService.js'),
      'utf-8'
    )
    expect(src).toContain('garden_viewed')
    expect(src).toContain('garden_tapped')
    expect(src).toContain('garden_card_tapped')
    expect(src).toContain('garden_produce_discovered')
    expect(src).toContain('garden_bed_stage_reached')
    expect(src).toContain('garden_color_discovered')
    expect(src).toContain('garden_rainbow_harvest')
  })

  test('no Garden analytics schema contains prohibited fields', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'AnalyticsService.js'),
      'utf-8'
    )
    const gardenSection = src.substring(
      src.indexOf('RawLife Garden'),
      src.indexOf('History Access')
    )
    expect(gardenSection).not.toContain('ingredient')
    expect(gardenSection).not.toContain('produce_name')
    expect(gardenSection).not.toContain('recipe_name')
    expect(gardenSection).not.toContain('name')
    expect(gardenSection).not.toContain('photo')
  })
})
