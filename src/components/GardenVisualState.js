// ─────────────────────────────────────────────────────────────
// GardenVisualState.js — Garden palette, bed visual props,
// and helper functions for driving the SVG Garden artwork.
//
// Follows the same pattern as GlowJourneyVisualState:
//   - Procedural SVG with named groups (no external SVG files)
//   - display prop driven by data, not image swapping
//   - Shared palette family with Glow Journey
// ─────────────────────────────────────────────────────────────

import { SEMANTIC_COLORS } from '../constants/tokens'

// ── Garden palette (provisional, shared family with Glow Journey) ──
export const GARDEN_PALETTE = {
  canvasColor: '#0D1510',
  bedSoilColor: '#1A2418',
  bedSoilElevated: '#212E1D',
  bedBorder: 'rgba(255,255,255,0.06)',
  bedBorderActive: 'rgba(129,199,132,0.25)',
  textPrimary: '#E8EDE9',
  textSecondary: '#B0BEC5',
  textMuted: '#90A4AE',
  particleColor: '#F5D98B',
  glowColor: '#81C784',
}

// ── Per-stage visual props for beds ──────────────────────────
const STAGE_VISUAL_PROPS = {
  empty: {
    soilFill: '#1A2418',
    soilStroke: 'rgba(255,255,255,0.04)',
    plantOpacity: 0,
    showSprouts: false,
    showLeaves: false,
    showFlowers: false,
    showFruit: false,
    glowOpacity: 0,
  },
  seed: {
    soilFill: '#1F2A1B',
    soilStroke: 'rgba(255,255,255,0.06)',
    plantOpacity: 0.5,
    showSprouts: true,
    showLeaves: false,
    showFlowers: false,
    showFruit: false,
    glowOpacity: 0,
  },
  sprout: {
    soilFill: '#222E1D',
    soilStroke: 'rgba(129,199,132,0.10)',
    plantOpacity: 0.7,
    showSprouts: true,
    showLeaves: true,
    showFlowers: false,
    showFruit: false,
    glowOpacity: 0.03,
  },
  growing: {
    soilFill: '#25321F',
    soilStroke: 'rgba(129,199,132,0.15)',
    plantOpacity: 0.85,
    showSprouts: true,
    showLeaves: true,
    showFlowers: false,
    showFruit: false,
    glowOpacity: 0.06,
  },
  harvesting: {
    soilFill: '#283621',
    soilStroke: 'rgba(129,199,132,0.20)',
    plantOpacity: 1.0,
    showSprouts: false,
    showLeaves: true,
    showFlowers: true,
    showFruit: true,
    glowOpacity: 0.10,
  },
  flourishing: {
    soilFill: '#2B3A23',
    soilStroke: 'rgba(129,199,132,0.25)',
    plantOpacity: 1.0,
    showSprouts: false,
    showLeaves: true,
    showFlowers: true,
    showFruit: true,
    glowOpacity: 0.14,
  },
}

export function getBedStageVisualProps(stageKey) {
  if (!stageKey) return STAGE_VISUAL_PROPS.empty
  return STAGE_VISUAL_PROPS[stageKey] || STAGE_VISUAL_PROPS.empty
}

// ── Color group marker colors (FINAL handoff dark palette) ───
const COLOR_MARKER_COLORS = {
  green: '#5FD98A',
  red: '#E0605A',
  orange: '#E8873A',
  yellow: '#F2C14E',
  purple: '#A374C9',
  tan: '#D7CCB8',
}

export function getColorMarkerColor(colorKey) {
  return COLOR_MARKER_COLORS[colorKey] || '#90A4AE'
}

// ── Bed positions on the full canvas (400×520 viewBox) ───────
// FINAL handoff 3×3 grid layout:
//   Top row:    greens (left),  roots (center),   citrus (right)
//   Middle row: orchard (left), tropical (center), berries (right)
//   Bottom row: journey_tree (left), herbs (center), milestone_arbor (right)
export const BED_POSITIONS = {
  greens:   { x: 30,  y: 40,  w: 100, h: 130 },
  roots:    { x: 150, y: 40,  w: 100, h: 130 },
  citrus:   { x: 270, y: 40,  w: 100, h: 130 },
  orchard:  { x: 30,  y: 190, w: 100, h: 130 },
  tropical: { x: 150, y: 190, w: 100, h: 130 },
  berries:  { x: 270, y: 190, w: 100, h: 130 },
  herbs:    { x: 150, y: 340, w: 100, h: 130 },
}

// Tree and Arbor positions (bottom-row bookends)
export const TREE_POSITION = { x: 30,  y: 340, w: 100, h: 130 }
export const ARBOR_POSITION = { x: 270, y: 340, w: 100, h: 130 }

// ── Compact layout positions (160×200 viewBox) ───────────────
// 3×3 grid: 7 beds + Tree + Arbor
export const BED_POSITIONS_COMPACT = {
  greens:   { x: 12,  y: 16,  w: 40, h: 52 },
  roots:    { x: 60,  y: 16,  w: 40, h: 52 },
  citrus:   { x: 108, y: 16,  w: 40, h: 52 },
  orchard:  { x: 12,  y: 76,  w: 40, h: 52 },
  tropical: { x: 60,  y: 76,  w: 40, h: 52 },
  berries:  { x: 108, y: 76,  w: 40, h: 52 },
  herbs:    { x: 60,  y: 136, w: 40, h: 52 },
}

export const TREE_POSITION_COMPACT = { x: 12,  y: 136, w: 40, h: 52 }
export const ARBOR_POSITION_COMPACT = { x: 108, y: 136, w: 40, h: 52 }

// ── Build visual state from garden summary ───────────────────
export function buildGardenVisualState(summary) {
  if (!summary) return null

  const bedVisuals = {}
  for (const bedKey of Object.keys(BED_POSITIONS)) {
    const stageKey = summary.bedStages[bedKey]
      ? summary.bedStages[bedKey].key
      : 'empty'
    const count = summary.bedCounts[bedKey] || 0
    bedVisuals[bedKey] = {
      stageKey,
      count,
      visualProps: getBedStageVisualProps(stageKey),
    }
  }

  const colorMarkers = {}
  for (const colorKey of Object.keys(COLOR_MARKER_COLORS)) {
    colorMarkers[colorKey] = {
      discovered: summary.discoveredColors.includes(colorKey),
      color: getColorMarkerColor(colorKey),
    }
  }

  return {
    bedVisuals,
    colorMarkers,
    discoveredCount: summary.discoveredCount,
    rainbowComplete: summary.rainbowComplete,
    bedsStarted: summary.bedsStarted,
  }
}
