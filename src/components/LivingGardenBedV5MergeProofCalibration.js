// ─────────────────────────────────────────────────────────────
// LivingGardenBedV5MergeProofCalibration.js
// Motion V5 Phase A — Botanical Takeover Merge Proof
// Greens: Canonical Harvesting → Large Hero → Seamless Merge back
//
// PREVIEW ONLY. Not production. Not propagated to other beds.
// Enabled only when motionVariant='v5-merge-proof' is passed through
// the Garden Visual Preview.
//
// PURPOSE:
//   Prove that a large temporary foreground plant (3.6× canonical)
//   can resolve seamlessly into the small canonical Garden bed.
//   This is NOT the full V5 choreography — only the merge mechanism.
//
// ARCHITECTURE:
//   - Base/canonical layer: renders canonical Harvesting Greens bed
//   - Hero presentation layer: renders SAME Harvesting path data at
//     runtime-selectable hero scale (3.15×, 3.60×, 3.90×)
//   - Hero renders ABOVE all other beds (z-order in Scene)
//   - Decoupled scale: ground/bed footprint stays 1.00×, collar ~1.15×,
//     hero vegetation scales independently
//   - Stroke compensation: strokeWidth ∝ sqrt(heroScale), NOT heroScale
//
// SEQUENCE:
//   Step 1: Large Hero Hold (800–1200ms) — inspect hero at full scale
//   Step 2: Scale Convergence (400–600ms) — hero 3.6×→1.0×, collar 1.15×→1.0×
//   Step 3: Registration Gate — verify pos/scale/rot deltas before crossfade
//   Step 4: Transform Freeze — all geometric transforms halted
//   Step 5: Crossfade Handoff (120ms) — complementary opacity, geometry frozen
//   Step 6: Deferred Hero Unmount (120–200ms after handoff)
//
// HARD RULES:
//   - Hero uses EXACT canonical Harvesting path data (no new artwork)
//   - Ground/bed footprint stays exactly 1.00× (no bed magnification)
//   - No critical G-opacity dependency (individual element opacity + structural gates)
//   - Crossfade gated on registration conditions
//   - Final frame = pixel-equivalent canonical Harvesting artwork
//   - No progression truth changes
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react'
import { Animated, Easing, AppState, View, StyleSheet } from 'react-native'
import Svg from 'react-native-svg'
import { G, Path, Ellipse, Circle, Rect, Line } from 'react-native-svg'
import {
  BED_PLACEMENT,
  BED_BLOBS,
  BED_FRINGES,
  PRODUCE_COLORS,
  SCENE_PALETTE,
} from './LivingGardenGeometry'
import {
  STAGE_CHROMA,
  STAGE_ALPHA,
  BED_PALETTES,
  mixColor,
  gateColor,
} from './LivingGardenBed'

// ── V5 Phase B0.2 Constants ───────────────────────────────────
// Per-rosette local Hero geometry: ROOTS PIN, FOLIAGE ESCAPES.
//
// B0 proved that one global scale around a common anchor magnifies
// inter-rosette root spacing by the full foliage scale, causing
// the four rosettes to become a horizontal row across the foreground.
//
// B0.1 replaced the single global scale with two independent controls:
//   rootSpreadScale — modestly parts root bases (1.0–1.5× canonical)
//   localRosetteScale — scales each rosette's foliage around its OWN base
//
// B0.2 retires occupancy-derived scales (27× was physically rejected as
// a giant green wall). The new presets are perceptual calibration values
// chosen for botanical readability — large enough for visible leaf motion
// but small enough that rosettes remain distinguishable as plants.

// Canonical root-base geometry
const ROSETTE_OFFSETS = [-18, -6, 6, 18] // relative to cx
const CANONICAL_ROOT_SPREAD = 36 // outer-to-outer: 18 - (-18)

// Root spread at Hero peak (modest parting, NOT global foliage scale)
const ROOT_SPREAD_SCALE_PEAK = 1.3 // 1.0–1.5× canonical

// Canonical foliage bbox per rosette (measured from path data)
const ROSETTE_FOLIAGE_W = 12 // ±6 control points
const ROSETTE_FOLIAGE_H = 19.8 // py - h*1.1
const ROSETTE_FOLIAGE_AREA = ROSETTE_FOLIAGE_W * ROSETTE_FOLIAGE_H // 237.6

// Largest individual leaf dimensions (canonical, from path data)
// Outer leaves: M px py → Q (px±6) (py-h*0.6) → (px±4) (py-h)
// Length ≈ h = 18, width ≈ 8 (control point spread)
const LARGEST_LEAF_LENGTH_CANONICAL = 18 // SVG units (h = LEAF_HEIGHT_BASE)
const LARGEST_LEAF_WIDTH_CANONICAL = 8 // SVG units (control point spread)

// Garden viewport (SVG coordinate system)
const GARDEN_VIEWPORT_W = 390
const GARDEN_VIEWPORT_H = 720
const GARDEN_VIEWPORT_AREA = GARDEN_VIEWPORT_W * GARDEN_VIEWPORT_H // 280800

// Greens bed position
const GREENS_CX = 62
const GREENS_CY = 610

// ── Hero bbox calculation ──
// At rootSpreadScale r and localRosetteScale s:
//   heroLeft  = cx - 18*r - 6*s
//   heroRight = cx + 18*r + 6*s
//   heroTop   = cy - 19.8*s
//   heroBottom = cy

function computeHeroBBoxSvg(localRosetteScale, rootSpreadScale, cx, cy) {
  const halfSpread = (CANONICAL_ROOT_SPREAD / 2) * rootSpreadScale
  const halfFoliage = (ROSETTE_FOLIAGE_W / 2) * localRosetteScale
  const foliageH = ROSETTE_FOLIAGE_H * localRosetteScale
  return {
    left: cx - halfSpread - halfFoliage,
    right: cx + halfSpread + halfFoliage,
    top: cy - foliageH,
    bottom: cy,
    w: halfSpread * 2 + halfFoliage * 2,
    h: foliageH,
  }
}

function computeVisibleIntersection(heroBBox, gardenW, gardenH) {
  const visLeft = Math.max(0, heroBBox.left)
  const visRight = Math.min(gardenW, heroBBox.right)
  const visTop = Math.max(0, heroBBox.top)
  const visBottom = Math.min(gardenH, heroBBox.bottom)
  const visW = Math.max(0, visRight - visLeft)
  const visH = Math.max(0, visBottom - visTop)
  return {
    left: visLeft,
    right: visRight,
    top: visTop,
    bottom: visBottom,
    w: visW,
    h: visH,
    area: visW * visH,
  }
}

function calculateVisibleOccupancy(localRosetteScale, rootSpreadScale) {
  const heroBBox = computeHeroBBoxSvg(localRosetteScale, rootSpreadScale, GREENS_CX, GREENS_CY)
  const intersection = computeVisibleIntersection(heroBBox, GARDEN_VIEWPORT_W, GARDEN_VIEWPORT_H)
  return intersection.area / GARDEN_VIEWPORT_AREA
}

// ── B1A Perceptual calibration — single rich Hero configuration ──
// B0.2 proved that simple scaled canonical geometry is insufficient.
// 27× = giant wall, 14× = excessive mass, 11× = merged forms, 8× = too simple.
// B1A uses ~8.5× horizontal / ~10.0× vertical anisotropic + RICH geometry.
const HERO_HORIZONTAL_SCALE = 8.5
const HERO_VERTICAL_SCALE = 10.0
const HERO_ANISOTROPY = HERO_VERTICAL_SCALE / HERO_HORIZONTAL_SCALE // ~1.18

// Single preset for B1A (no selectors — one rich configuration)
const LOCAL_ROSETTE_SCALE_PRESETS = { B1A: HERO_HORIZONTAL_SCALE }
const DEFAULT_SCALE_PRESET = 'B1A'
const PRESET_LABELS = { B1A: 'B1A RICH 8.5×' }

// Legacy alias for tests/exports
const HERO_SCALE_PRESETS = LOCAL_ROSETTE_SCALE_PRESETS

// Collar scale (soil bridge) — peaks at 1.15×, resolves to 1.00×
const COLLAR_PEAK_SCALE = 1.15

// Timing (ms)
const HERO_HOLD_DURATION = 1000 // Step 1: inspect hero at full scale
const CONVERGENCE_DURATION = 500 // Step 2: 3.6×→1.0× (within 400–600ms target)
const FREEZE_HOLD_DURATION = 50 // Step 4: brief freeze before crossfade
const CROSSFADE_DURATION = 120 // Step 5: opacity handoff
const DEFERRED_UNMOUNT_DELAY = 150 // Step 6: unmount after handoff

// Registration gate thresholds
const GATE_POS_DELTA_MAX = 1.5 // dp
const GATE_SCALE_DELTA_MAX = 0.04 // 4%
const GATE_ROT_DELTA_MAX = 2 // degrees

// Canonical Harvesting geometry constants
const HARVEST_PLANT_COUNT = 4
const PLANT_SPACING = 12
const LEAF_HEIGHT_BASE = 18
const HARVESTING_HEIGHT_SCALE = 1.0
const HARVESTING_ALPHA = STAGE_ALPHA.harvesting // 0.93
const PATH_BASE_OPACITY = 0.9
const BASE_STROKE_WIDTH = 1.4

// ── Easing helpers ────────────────────────────────────────────
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// ── Color helpers ──
const TO_STAGE = 'harvesting'

function harvestingLeafColor() {
  return gateColor(BED_PALETTES.greens.leaf, TO_STAGE)
}

// ── Stroke compensation ───────────────────────────────────────
// At hero scale, stroke should be ~sqrt(heroScale) × base, NOT heroScale × base.
// At 3.6×: sqrt(3.6) ≈ 1.897 → stroke ≈ 1.4 × 1.897 ≈ 2.66 (premium, not 5.04)
function compensatedStrokeWidth(heroScale) {
  return BASE_STROKE_WIDTH * Math.sqrt(Math.max(1, heroScale))
}

// ── B1A: Rich Botanical Hero Geometry ─────────────────────────
// Presentation-only foreground blade system. Does NOT alter canonical paths.
// ~89 visible blades: 4 primary rosettes (17 each) + 3 subordinate clusters (7 each).
// Six leaf families, five render bands, three populations (HANDOFF/TEMPORARY/SUPPORT).

// Seeded RNG for reproducible blade variation
function makeBladeRng(seed) {
  let s = seed
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Canonical lobe paths in local space (base at 0,0, h=18)
// These are the EXACT canonical Harvesting leaf paths, shifted to local origin.
const CANONICAL_LOBE_PATHS = [
  'M 0 0 Q -6 -10.8 -4 -18',    // lobe 0: left outer
  'M 0 0 Q 6 -10.8 4 -18',      // lobe 1: right outer
  'M 0 0 Q -3 -12.6 -1 -19.8',  // lobe 2: left inner
  'M 0 0 Q 3 -12.6 1 -19.8',    // lobe 3: right inner
]

// Structured canonical lobe coordinates (local space, base at 0,0)
// Derived from CANONICAL_LOBE_PATHS for absolute path construction in the overlay.
const CANONICAL_LOBE_COORDS = CANONICAL_LOBE_PATHS.map((p) => {
  const m = p.match(/^M 0 0 Q (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/)
  if (!m) throw new Error(`Invalid canonical lobe: ${p}`)
  return { cpX: parseFloat(m[1]), cpY: parseFloat(m[2]), endX: parseFloat(m[3]), endY: parseFloat(m[4]) }
})

// Canonical lobe angles (degrees from vertical, 0=up, +=right)
const CANONICAL_LOBE_ANGLES = [-12.5, 12.5, -2.9, 2.9]

// Leaf family metadata: render band, value offset, base opacity
const LEAF_FAMILIES = {
  back_fan:     { renderBand: 1, valueOffset: -0.18, baseOpacity: 0.65 },
  core_upright: { renderBand: 2, valueOffset: 0.0,   baseOpacity: 0.88 },
  side_flare:   { renderBand: 2, valueOffset: -0.06, baseOpacity: 0.82 },
  outer_skirt:  { renderBand: 3, valueOffset: -0.12, baseOpacity: 0.75 },
  inner_heart:  { renderBand: 4, valueOffset: 0.08,  baseOpacity: 0.92 },
  accent_tip:   { renderBand: 4, valueOffset: 0.14,  baseOpacity: 1.0 },
}

// Render band order (low to high = back to front)
const RENDER_BANDS = [0, 1, 2, 3, 4]

// ── B1A.2: Closed-blade silhouette parameters per family ──
// Preserved for reference. B1A.5 lead rosette uses ART_DIRECTED_LEAD_BLADES
// with per-blade explicit silhouette params. Other rosettes use open centerlines.
const SILHOUETTE_BASE = {
  back_fan:     { maxWidth: 2.1, shoulderFrac: 0.55, petioleFrac: 0.15, asymmetry: 0.05, tipPinch: 0.18 },
  core_upright: { maxWidth: 3.0, shoulderFrac: 0.38, petioleFrac: 0.28, asymmetry: 0.08, tipPinch: 0.20 },
  side_flare:   { maxWidth: 2.7, shoulderFrac: 0.55, petioleFrac: 0.22, asymmetry: 0.28, tipPinch: 0.20 },
  outer_skirt:  { maxWidth: 3.0, shoulderFrac: 0.40, petioleFrac: 0.18, asymmetry: 0.14, tipPinch: 0.30 },
  inner_heart:  { maxWidth: 2.3, shoulderFrac: 0.50, petioleFrac: 0.22, asymmetry: 0.04, tipPinch: 0.25 },
  accent_tip:   { maxWidth: 1.7, shoulderFrac: 0.60, petioleFrac: 0.22, asymmetry: 0.12, tipPinch: 0.12 },
}

// ── B1A.5: Art-directed hand-authored lead rosette ──
// STOP procedural calibration. Every lead rosette blade is explicitly authored.
// 7 principal + 6 secondary + 4 crown/support = 17 total.
// No RNG for any lead rosette geometry.
//
// Two visible background wedges:
//   WEDGE A: between prin-3 (-18°) and prin-4 (0°) = 18° gap
//   WEDGE B: between prin-4 (0°) and prin-5 (+18°) = 18° gap
// No secondary/crown leaf occupies these wedge zones at mid-height.

const PRINCIPAL_BLADE_IDS = [
  'p1-prin-1', 'p1-prin-2', 'p1-prin-3',  // LEFT: outer, mid, inner
  'p1-prin-4',                              // CENTER HERO
  'p1-prin-5', 'p1-prin-6', 'p1-prin-7',  // RIGHT: inner, mid, outer
]

const SECONDARY_BLADE_IDS = [
  'p1-sec-1', 'p1-sec-2', 'p1-sec-3', 'p1-sec-4', 'p1-sec-5', 'p1-sec-6',
]

const CROWN_BLADE_IDS = [
  'p1-crown-1', 'p1-crown-2', 'p1-crown-3', 'p1-crown-4',
]

// Root-core dimensions (preserved from B1A.3)
const ROOT_CORE_WIDTH = 4.0   // ±2.0 SVG units in x
const ROOT_CORE_HEIGHT = 3.0  // ±1.5 SVG units in y

// Helper to define a hand-authored blade
function authoredBlade(id, family, opts) {
  return {
    id,
    rosetteIndex: 1,
    family,
    population: opts.population || 'TEMPORARY',
    renderBand: opts.renderBand,
    peakAngle: opts.angle,
    peakLength: opts.length,
    peakPerp: 0,
    valueOffset: opts.valueOffset,
    baseOpacity: opts.baseOpacity,
    canonicalLobeIndex: opts.canonicalLobeIndex !== undefined ? opts.canonicalLobeIndex : null,
    secondaryHandoff: opts.secondaryHandoff || false,
    isPrincipal: opts.isPrincipal || false,
    isSecondary: opts.isSecondary || false,
    isCrown: opts.isCrown || false,
    silhouette: {
      maxWidth: opts.maxWidth,
      shoulderFrac: opts.shoulderFrac,
      petioleFrac: opts.petioleFrac,
      asymmetry: opts.asymmetry,
      tipPinch: opts.tipPinch,
    },
    rootCoreOffset: { dx: opts.dx, dy: opts.dy },
  }
}

// 17 hand-authored blades. NO RNG. Every parameter explicit.
const ART_DIRECTED_LEAD_BLADES = [
  // ── 7 PRINCIPAL LEAVES (carry the recognizable silhouette) ──
  authoredBlade('p1-prin-1', 'back_fan', {
    isPrincipal: true, angle: -45, length: 21, maxWidth: 2.2,
    shoulderFrac: 0.40, petioleFrac: 0.22, asymmetry: 0.18, tipPinch: 0.15,
    valueOffset: -0.08, baseOpacity: 0.85, renderBand: 1,
    dx: -1.5, dy: 0.5,
  }),
  authoredBlade('p1-prin-2', 'side_flare', {
    isPrincipal: true, angle: -30, length: 23, maxWidth: 2.6,
    shoulderFrac: 0.38, petioleFrac: 0.25, asymmetry: 0.10, tipPinch: 0.18,
    valueOffset: -0.04, baseOpacity: 0.88, renderBand: 2,
    dx: -1.0, dy: 0.0,
  }),
  authoredBlade('p1-prin-3', 'core_upright', {
    isPrincipal: true, angle: -18, length: 24, maxWidth: 2.2,
    shoulderFrac: 0.35, petioleFrac: 0.28, asymmetry: 0.05, tipPinch: 0.16,
    valueOffset: 0.00, baseOpacity: 0.90, renderBand: 3,
    population: 'HANDOFF', canonicalLobeIndex: 0,
    dx: -0.5, dy: -0.5,
  }),
  authoredBlade('p1-prin-4', 'inner_heart', {
    isPrincipal: true, angle: 0, length: 25, maxWidth: 2.4,
    shoulderFrac: 0.33, petioleFrac: 0.30, asymmetry: 0.00, tipPinch: 0.14,
    valueOffset: 0.02, baseOpacity: 0.92, renderBand: 4,
    population: 'HANDOFF', canonicalLobeIndex: 3,
    dx: 0.0, dy: -1.0,
  }),
  authoredBlade('p1-prin-5', 'core_upright', {
    isPrincipal: true, angle: 18, length: 24, maxWidth: 2.2,
    shoulderFrac: 0.35, petioleFrac: 0.28, asymmetry: -0.05, tipPinch: 0.16,
    valueOffset: 0.00, baseOpacity: 0.90, renderBand: 3,
    population: 'HANDOFF', canonicalLobeIndex: 1,
    dx: 0.5, dy: -0.5,
  }),
  authoredBlade('p1-prin-6', 'side_flare', {
    isPrincipal: true, angle: 30, length: 23, maxWidth: 2.6,
    shoulderFrac: 0.38, petioleFrac: 0.25, asymmetry: -0.10, tipPinch: 0.18,
    valueOffset: -0.04, baseOpacity: 0.88, renderBand: 2,
    dx: 1.0, dy: 0.0,
  }),
  authoredBlade('p1-prin-7', 'back_fan', {
    isPrincipal: true, angle: 45, length: 21, maxWidth: 2.2,
    shoulderFrac: 0.40, petioleFrac: 0.22, asymmetry: -0.18, tipPinch: 0.15,
    valueOffset: -0.08, baseOpacity: 0.85, renderBand: 1,
    dx: 1.5, dy: 0.5,
  }),

  // ── 6 SECONDARY LEAVES (between/behind principals, 60-80% prominence) ──
  authoredBlade('p1-sec-1', 'back_fan', {
    isSecondary: true, angle: -25, length: 18, maxWidth: 1.8,
    shoulderFrac: 0.38, petioleFrac: 0.25, asymmetry: 0.08, tipPinch: 0.20,
    valueOffset: -0.10, baseOpacity: 0.75, renderBand: 2,
    population: 'HANDOFF', canonicalLobeIndex: 2,
    dx: -1.2, dy: 0.8,
  }),
  authoredBlade('p1-sec-2', 'back_fan', {
    isSecondary: true, angle: -38, length: 17, maxWidth: 1.6,
    shoulderFrac: 0.40, petioleFrac: 0.22, asymmetry: 0.12, tipPinch: 0.18,
    valueOffset: -0.12, baseOpacity: 0.72, renderBand: 0,
    dx: -1.8, dy: 1.0,
  }),
  authoredBlade('p1-sec-3', 'back_fan', {
    isSecondary: true, angle: 25, length: 18, maxWidth: 1.8,
    shoulderFrac: 0.38, petioleFrac: 0.25, asymmetry: -0.08, tipPinch: 0.20,
    valueOffset: -0.10, baseOpacity: 0.75, renderBand: 2,
    dx: 1.2, dy: 0.8,
  }),
  authoredBlade('p1-sec-4', 'back_fan', {
    isSecondary: true, angle: 38, length: 17, maxWidth: 1.6,
    shoulderFrac: 0.40, petioleFrac: 0.22, asymmetry: -0.12, tipPinch: 0.18,
    valueOffset: -0.12, baseOpacity: 0.72, renderBand: 0,
    dx: 1.8, dy: 1.0,
  }),
  authoredBlade('p1-sec-5', 'back_fan', {
    isSecondary: true, angle: -55, length: 16, maxWidth: 1.5,
    shoulderFrac: 0.42, petioleFrac: 0.20, asymmetry: 0.22, tipPinch: 0.16,
    valueOffset: -0.14, baseOpacity: 0.68, renderBand: 0,
    dx: -2.0, dy: 1.2,
  }),
  authoredBlade('p1-sec-6', 'back_fan', {
    isSecondary: true, angle: 55, length: 16, maxWidth: 1.5,
    shoulderFrac: 0.42, petioleFrac: 0.20, asymmetry: -0.22, tipPinch: 0.16,
    valueOffset: -0.14, baseOpacity: 0.68, renderBand: 0,
    dx: 2.0, dy: 1.2,
  }),

  // ── 4 CROWN/SUPPORT LEAVES (small, near root, 40-60% principal length) ──
  authoredBlade('p1-crown-1', 'outer_skirt', {
    isCrown: true, angle: -8, length: 9, maxWidth: 1.4,
    shoulderFrac: 0.35, petioleFrac: 0.20, asymmetry: 0.04, tipPinch: 0.18,
    valueOffset: -0.12, baseOpacity: 0.70, renderBand: 3,
    dx: -0.3, dy: 1.0,
  }),
  authoredBlade('p1-crown-2', 'outer_skirt', {
    isCrown: true, angle: 8, length: 9, maxWidth: 1.4,
    shoulderFrac: 0.35, petioleFrac: 0.20, asymmetry: -0.04, tipPinch: 0.18,
    valueOffset: -0.12, baseOpacity: 0.70, renderBand: 3,
    dx: 0.3, dy: 1.0,
  }),
  authoredBlade('p1-crown-3', 'outer_skirt', {
    isCrown: true, angle: -42, length: 10, maxWidth: 1.5,
    shoulderFrac: 0.38, petioleFrac: 0.18, asymmetry: 0.10, tipPinch: 0.20,
    valueOffset: -0.14, baseOpacity: 0.65, renderBand: 1,
    population: 'HANDOFF', canonicalLobeIndex: 0, secondaryHandoff: true,
    dx: -1.5, dy: 1.3,
  }),
  authoredBlade('p1-crown-4', 'outer_skirt', {
    isCrown: true, angle: 42, length: 10, maxWidth: 1.5,
    shoulderFrac: 0.38, petioleFrac: 0.18, asymmetry: -0.10, tipPinch: 0.20,
    valueOffset: -0.14, baseOpacity: 0.65, renderBand: 1,
    dx: 1.5, dy: 1.3,
  }),
]

// Intended visible background wedges (for engineering reference only —
// visual approval is by physical observation, NOT by these definitions).
const BACKGROUND_WEDGES = [
  { id: 'WEDGE_A', leftBladeId: 'p1-prin-3', rightBladeId: 'p1-prin-4', centerAngle: -9 },
  { id: 'WEDGE_B', leftBladeId: 'p1-prin-4', rightBladeId: 'p1-prin-5', centerAngle: 9 },
]

// ── B1A.6: Literal SVG paths for the 7 principal leaves ──
// Each principal leaf has its OWN unique hand-authored closed SVG path.
// NO generic bladeSilhouettePath() or common shape generator is used.
// Paths are in absolute SVG coordinates, centered on (baseX, baseY).
// Blade extends upward (negative Y). Transform handles rotation/scale.
//
// Each path uses cubic Beziers for organic curvature.
// Left and right edges are NOT mirrors. Each leaf has its own character.

// Helper: build path string from baseX, baseY and relative offsets
function lp(baseX, baseY, segs) {
  let d = `M ${fmtPathNum(baseX)} ${fmtPathNum(baseY)} `
  for (const s of segs) {
    d += `C ${fmtPathNum(baseX + s[0])} ${fmtPathNum(baseY + s[1])} ${fmtPathNum(baseX + s[2])} ${fmtPathNum(baseY + s[3])} ${fmtPathNum(baseX + s[4])} ${fmtPathNum(baseY + s[5])} `
  }
  return d + 'Z'
}

// p1-prin-1 LEFT OUTER: long, strongly swept left, asymmetric
// Left edge bows outward, right edge straighter, tip hooks slightly left
const PRIN_1_PATH = (bx, by) => lp(bx, by, [
  [-0.1, -2, -0.5, -5, -1.2, -8],     // left lower edge
  [-1.8, -11, -2.2, -14, -2.0, -17],  // left shoulder to upper
  [-1.5, -19, -0.8, -20.5, -0.2, -21], // upper left to tip (hooks left)
  [0.3, -20, 0.6, -17, 0.8, -13],     // right upper edge
  [0.7, -9, 0.4, -5, 0.1, -2],        // right lower edge to base
])

// p1-prin-2 LEFT MID: shorter, broad lower shoulder, hooked tip
// Broad shoulder low at ~35%, tip hooks right
const PRIN_2_PATH = (bx, by) => lp(bx, by, [
  [-0.2, -2, -1.0, -5, -1.8, -8],     // left lower (broad early)
  [-2.4, -11, -2.6, -14, -2.0, -17],  // left shoulder (wide)
  [-1.2, -20, -0.3, -22, 0.5, -23],   // upper left to tip (hooks right)
  [0.8, -22, 0.6, -19, 0.8, -15],     // right upper
  [1.0, -11, 0.6, -6, 0.1, -2],       // right lower to base
])

// p1-prin-3 LEFT INNER: upright, curved, narrow with S-curve
// Gentle S-curve on left edge, narrow throughout
const PRIN_3_PATH = (bx, by) => lp(bx, by, [
  [-0.1, -3, -0.4, -7, -0.8, -11],    // left lower (narrow)
  [-1.2, -15, -1.5, -19, -1.0, -22],  // left shoulder to upper (S-curve)
  [-0.5, -23.5, 0.1, -24, 0.3, -24],  // to tip (slightly right)
  [0.5, -23, 0.8, -19, 1.0, -15],     // right upper
  [0.8, -10, 0.4, -5, 0.1, -2],       // right lower to base
])

// p1-prin-4 CENTER HERO: tallest, narrow, off-axis tip
// Very narrow, tip leans right, NOT a broad central panel
const PRIN_4_PATH = (bx, by) => lp(bx, by, [
  [0.1, -3, -0.2, -7, -0.5, -11],     // left lower (very narrow)
  [-0.8, -15, -1.0, -19, -0.6, -22],  // left shoulder (narrow)
  [-0.2, -24, 0.3, -25, 0.8, -25],    // to tip (leans right)
  [1.0, -24, 1.0, -20, 0.9, -16],     // right upper
  [0.7, -11, 0.4, -6, 0.1, -2],       // right lower to base
])

// p1-prin-5 RIGHT INNER: different shoulder height from left inner
// Higher shoulder (45%), slight right curve, NOT a mirror of prin-3
const PRIN_5_PATH = (bx, by) => lp(bx, by, [
  [0.1, -3, 0.3, -7, 0.6, -11],       // right lower (narrow)
  [1.0, -15, 1.2, -18, 1.0, -21],     // right shoulder (higher)
  [0.6, -23, 0.1, -24, -0.2, -24],    // to tip (slightly left)
  [-0.5, -23, -0.7, -19, -0.8, -15],  // left upper
  [-0.7, -10, -0.4, -5, -0.1, -2],    // left lower to base
])

// p1-prin-6 RIGHT MID: different curl from left mid
// More upper curve, tip hooks left, NOT a mirror of prin-2
const PRIN_6_PATH = (bx, by) => lp(bx, by, [
  [0.2, -2, 0.8, -5, 1.5, -8],        // right lower
  [2.2, -11, 2.5, -14, 2.2, -17],     // right shoulder
  [1.5, -20, 0.5, -22, -0.3, -23],    // to tip (hooks left)
  [-0.6, -22, -0.5, -19, -0.7, -15],  // left upper
  [-0.9, -11, -0.5, -6, -0.1, -2],    // left lower to base
])

// p1-prin-7 RIGHT OUTER: different length/lean from left outer
// More gradual taper, right edge bows out, NOT a mirror of prin-1
const PRIN_7_PATH = (bx, by) => lp(bx, by, [
  [0.1, -2, 0.4, -5, 1.0, -8],        // right lower (bows out)
  [1.6, -11, 2.0, -14, 1.8, -17],     // right shoulder
  [1.3, -19, 0.6, -20.5, 0.1, -21],   // to tip (leans right)
  [-0.3, -20, -0.5, -17, -0.7, -13],  // left upper
  [-0.6, -9, -0.3, -5, -0.1, -2],     // left lower to base
])

// Map principal blade ID to its literal path generator
const PRINCIPAL_LITERAL_PATHS = {
  'p1-prin-1': PRIN_1_PATH,
  'p1-prin-2': PRIN_2_PATH,
  'p1-prin-3': PRIN_3_PATH,
  'p1-prin-4': PRIN_4_PATH,
  'p1-prin-5': PRIN_5_PATH,
  'p1-prin-6': PRIN_6_PATH,
  'p1-prin-7': PRIN_7_PATH,
}

// Format a number for SVG path output.
// Returns '0' for zero/NaN/Infinity to avoid malformed path strings.
function fmtPathNum(v) {
  if (!Number.isFinite(v)) return '0'
  if (v === 0) return '0'
  return v.toFixed(2)
}

// Generate a blade path.
// When baseX/baseY are provided (absolute mode), the path starts at (baseX, baseY)
// and all Q coordinates are offset by (baseX, baseY).
// When omitted (local mode), the path starts at (0, 0).
// angle: degrees from vertical (0=up, +=right)
// length: SVG units
// perpOffset: perpendicular bow offset (positive = right curve)
function bladePath(angle, length, perpOffset, baseX = 0, baseY = 0) {
  const rad = (angle * Math.PI) / 180
  const sinA = Math.sin(rad)
  const cosA = Math.cos(rad)
  const tipX = baseX + sinA * length
  const tipY = baseY - cosA * length
  const cpX = baseX + sinA * length * 0.55 + perpOffset * cosA
  const cpY = baseY - cosA * length * 0.55 + perpOffset * sinA
  return `M ${fmtPathNum(baseX)} ${fmtPathNum(baseY)} Q ${fmtPathNum(cpX)} ${fmtPathNum(cpY)} ${fmtPathNum(tipX)} ${fmtPathNum(tipY)}`
}

// Generate a CLOSED filled blade silhouette in absolute coordinates.
// Base at (baseX, baseY), pointing up (negative Y).
// Shape: narrow petiole → widening shoulder → tapering tip → return on opposite edge → close.
// length: total blade length (SVG units)
// maxWidth: widest blade body width
// shoulderFrac: fraction of length where max width occurs
// petioleFrac: fraction of length that is narrow before widening
// asymmetry: left/right asymmetry (0=symmetric, +=right-leaning curve)
// tipPinch: pinch factor before tip (0.12=sharp, 0.55=round)
function bladeSilhouettePath(length, maxWidth, shoulderFrac, petioleFrac, asymmetry, tipPinch, baseX, baseY) {
  const halfMax = maxWidth / 2
  const shoulderY = -length * shoulderFrac
  const petioleY = -length * petioleFrac
  const petioleHalf = halfMax * 0.12

  // Left edge (wider side with positive asymmetry)
  const shoulderLx = -halfMax * (1 + asymmetry)
  const shoulderRx = halfMax * (1 - asymmetry)

  // Control points: base → shoulder (petiole widening)
  const cpL1x = -petioleHalf * (1 + asymmetry * 0.3)
  const cpL1y = petioleY * 0.6
  // Control points: shoulder → tip (tapering)
  const cpL2x = shoulderLx * tipPinch
  const cpL2y = -length * (0.85 + tipPinch * 0.1)
  // Control points: tip → shoulder (right edge)
  const cpR2x = shoulderRx * tipPinch
  const cpR2y = -length * (0.85 + tipPinch * 0.1)
  // Control points: shoulder → base (right petiole)
  const cpR1x = petioleHalf * (1 - asymmetry * 0.3)
  const cpR1y = petioleY * 0.6

  return (
    `M ${fmtPathNum(baseX)} ${fmtPathNum(baseY)} ` +
    `Q ${fmtPathNum(baseX + cpL1x)} ${fmtPathNum(baseY + cpL1y)} ${fmtPathNum(baseX + shoulderLx)} ${fmtPathNum(baseY + shoulderY)} ` +
    `Q ${fmtPathNum(baseX + cpL2x)} ${fmtPathNum(baseY + cpL2y)} ${fmtPathNum(baseX)} ${fmtPathNum(baseY - length)} ` +
    `Q ${fmtPathNum(baseX + cpR2x)} ${fmtPathNum(baseY + cpR2y)} ${fmtPathNum(baseX + shoulderRx)} ${fmtPathNum(baseY + shoulderY)} ` +
    `Q ${fmtPathNum(baseX + cpR1x)} ${fmtPathNum(baseY + cpR1y)} ${fmtPathNum(baseX)} ${fmtPathNum(baseY)} Z`
  )
}

// ── B1A.3: Edge-to-edge clearance calculation ──
// Computes the half-width of a blade silhouette at a given fraction of its length.
// Profile: narrow petiole → linear widening to shoulder → linear taper to tip.
function bladeHalfWidthAtFrac(maxWidth, shoulderFrac, petioleFrac, frac) {
  const halfMax = maxWidth / 2
  const petioleHalf = halfMax * 0.12
  if (frac <= petioleFrac) return petioleHalf
  if (frac <= shoulderFrac) {
    const t = (frac - petioleFrac) / Math.max(0.01, shoulderFrac - petioleFrac)
    return petioleHalf + (halfMax - petioleHalf) * t
  }
  const t = (frac - shoulderFrac) / Math.max(0.01, 1.0 - shoulderFrac)
  return halfMax * (1.0 - t)
}

// Computes edge-to-edge clearance between two blades at a given length fraction.
// Positive = visible gap, negative = overlap.
// blade1/blade2: { peakAngle, peakLength, silhouette: { maxWidth, shoulderFrac, petioleFrac } }
function computeEdgeClearance(blade1, blade2, frac) {
  const angleGapRad = Math.abs(blade1.peakAngle - blade2.peakAngle) * Math.PI / 180
  const avgLength = (blade1.peakLength + blade2.peakLength) / 2
  const dist = avgLength * frac
  const arcDistance = dist * Math.sin(angleGapRad)
  const half1 = bladeHalfWidthAtFrac(
    blade1.silhouette.maxWidth, blade1.silhouette.shoulderFrac,
    blade1.silhouette.petioleFrac, frac,
  )
  const half2 = bladeHalfWidthAtFrac(
    blade2.silhouette.maxWidth, blade2.silhouette.shoulderFrac,
    blade2.silhouette.petioleFrac, frac,
  )
  return arcDistance - half1 - half2
}

// ── B1A.4: Transformed geometry helpers for corridor checking ──
// Transforms a local blade point to Hero space (post-rotation, post-anisotropic-scale).
// Accounts for root-core offset at Hero Hold (convProgress=0).
function transformBladePoint(lx, ly, angle, hScale, vScale, rootDx, rootDy) {
  const rad = angle * Math.PI / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  // SVG rotation (clockwise): (lx*cos - ly*sin, lx*sin + ly*cos)
  const rx = lx * cosA - ly * sinA
  const ry = lx * sinA + ly * cosA
  // Anisotropic scale
  return {
    x: rx * hScale + rootDx,
    y: ry * vScale + rootDy,
  }
}

// Computes a blade's transformed silhouette polygon in Hero space.
// Returns array of {x, y} points outlining the closed silhouette.
// Uses 12 sample fractions for a smooth polygon approximation.
function computeTransformedBladePolygon(blade, hScale, vScale) {
  const s = blade.silhouette
  if (!s) return null
  const angle = blade.peakAngle
  const length = blade.peakLength
  const dx = blade.rootCoreOffset ? blade.rootCoreOffset.dx : 0
  const dy = blade.rootCoreOffset ? blade.rootCoreOffset.dy : 0
  const leftEdge = []
  const rightEdge = []
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps
    const hw = bladeHalfWidthAtFrac(s.maxWidth, s.shoulderFrac, s.petioleFrac, frac)
    const ly = -length * frac
    leftEdge.push(transformBladePoint(-hw, ly, angle, hScale, vScale, dx, dy))
    rightEdge.push(transformBladePoint(hw, ly, angle, hScale, vScale, dx, dy))
  }
  // Polygon: left edge base→tip, then right edge tip→base
  const polygon = leftEdge.concat(rightEdge.reverse())
  return polygon
}

// Point-in-polygon test (ray casting algorithm).
function pointInPolygon(px, py, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    if (((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// Generates corridor sample points in Hero space.
// Points along the corridor centerline at several fractions of max blade length.
function generateCorridorPoints(corridor, maxBladeLength, hScale, vScale) {
  const points = []
  const rad = corridor.centerAngle * Math.PI / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  // Sample at 40%, 45%, 50%, 55%, 60% of max blade length
  const fracs = [0.40, 0.45, 0.50, 0.55, 0.60]
  for (const f of fracs) {
    const dist = maxBladeLength * f
    // Centerline direction: (sin(angle), -cos(angle)) in local space
    const lx = dist * sinA
    const ly = -dist * cosA
    // Apply anisotropic scale (no rotation needed — already in corridor direction)
    points.push({ x: lx * hScale, y: ly * vScale, frac: f })
  }
  return points
}

// Checks all 17 lead rosette blades against both protected corridors.
// Returns { corridorId, blocked, blockingBladeIds } for each corridor.
// A corridor passes when ZERO blade polygons contain any corridor sample point.
function checkAllCorridors(blades, corridors, hScale, vScale, maxBladeLength) {
  const leadBlades = blades.filter((b) => b.rosetteIndex === 1 && b.silhouette)
  const results = []
  for (const corridor of corridors) {
    const corridorPoints = generateCorridorPoints(corridor, maxBladeLength, hScale, vScale)
    const blockingBladeIds = []
    for (const blade of leadBlades) {
      const polygon = computeTransformedBladePolygon(blade, hScale, vScale)
      if (!polygon) continue
      for (const cp of corridorPoints) {
        if (pointInPolygon(cp.x, cp.y, polygon)) {
          blockingBladeIds.push(blade.id)
          break
        }
      }
    }
    results.push({
      corridorId: corridor.id,
      blocked: blockingBladeIds.length > 0,
      blockingBladeIds,
    })
  }
  return results
}

// Per-rosette variation: rotation bias, scale bias, angle spread
// Rosette 1 (second from left) is the VISUAL LEAD
const ROSETTE_VARIATION = [
  { rotBias: -3, scaleBias: 0.95, angleSpread: 1.0 },   // rosette 0 (leftmost)
  { rotBias: 0,  scaleBias: 1.05, angleSpread: 0.85 },  // rosette 1 (VISUAL LEAD)
  { rotBias: 2,  scaleBias: 0.98, angleSpread: 0.95 },  // rosette 2
  { rotBias: 4,  scaleBias: 0.92, angleSpread: 1.1 },   // rosette 3 (rightmost)
]

// Generate all Hero blade definitions (static, computed once at module load)
function generateHeroBladeDefinitions() {
  const rng = makeBladeRng(42)
  const blades = []

  // ── 4 primary rosettes, 17 blades each = 68 ──
  // B1A.5: Rosette 1 is hand-authored — skip procedural generation for r=1.
  for (let r = 0; r < 4; r++) {
    if (r === 1) continue // B1A.5: art-directed blades added below
    const v = ROSETTE_VARIATION[r]

    // back_fan: 3 blades, wide angles, darker (TEMPORARY)
    for (let i = 0; i < 3; i++) {
      const angle = (-65 + i * 45 + v.rotBias + (rng() - 0.5) * 8) * v.angleSpread
      const length = (17 + rng() * 3) * v.scaleBias
      const perp = (rng() - 0.5) * 4 + 3
      blades.push({
        id: `p${r}-bf-${i}`, rosetteIndex: r, family: 'back_fan',
        population: 'TEMPORARY', renderBand: LEAF_FAMILIES.back_fan.renderBand,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: LEAF_FAMILIES.back_fan.valueOffset,
        baseOpacity: LEAF_FAMILIES.back_fan.baseOpacity,
        canonicalLobeIndex: null,
      })
    }

    // core_upright: 4 blades, near-vertical (2 HANDOFF for lobes 0,1)
    for (let i = 0; i < 4; i++) {
      const angle = (-15 + i * 10 + v.rotBias + (rng() - 0.5) * 5) * v.angleSpread
      const length = (19 + rng() * 2) * v.scaleBias
      const perp = (rng() - 0.5) * 3
      const isHandoff = i < 2
      blades.push({
        id: `p${r}-cu-${i}`, rosetteIndex: r, family: 'core_upright',
        population: isHandoff ? 'HANDOFF' : 'TEMPORARY',
        renderBand: LEAF_FAMILIES.core_upright.renderBand,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: LEAF_FAMILIES.core_upright.valueOffset,
        baseOpacity: LEAF_FAMILIES.core_upright.baseOpacity,
        canonicalLobeIndex: isHandoff ? i : null,
        secondaryHandoff: false,
      })
    }

    // side_flare: 3 blades, medium angles (TEMPORARY)
    for (let i = 0; i < 3; i++) {
      const angle = (-35 + i * 35 + v.rotBias + (rng() - 0.5) * 6) * v.angleSpread
      const length = (18 + rng() * 2) * v.scaleBias
      const perp = (rng() - 0.5) * 4 + 2
      blades.push({
        id: `p${r}-sf-${i}`, rosetteIndex: r, family: 'side_flare',
        population: 'TEMPORARY', renderBand: LEAF_FAMILIES.side_flare.renderBand,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: LEAF_FAMILIES.side_flare.valueOffset,
        baseOpacity: LEAF_FAMILIES.side_flare.baseOpacity,
        canonicalLobeIndex: null,
      })
    }

    // outer_skirt: 3 blades, lower cupping (2 HANDOFF for lobes 2,3)
    for (let i = 0; i < 3; i++) {
      const angle = (-20 + i * 20 + v.rotBias + (rng() - 0.5) * 5) * v.angleSpread
      const length = (16 + rng() * 2) * v.scaleBias
      const perp = (rng() - 0.5) * 5 + 4
      const isHandoff = i < 2
      blades.push({
        id: `p${r}-os-${i}`, rosetteIndex: r, family: 'outer_skirt',
        population: isHandoff ? 'HANDOFF' : 'TEMPORARY',
        renderBand: LEAF_FAMILIES.outer_skirt.renderBand,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: LEAF_FAMILIES.outer_skirt.valueOffset,
        baseOpacity: LEAF_FAMILIES.outer_skirt.baseOpacity,
        canonicalLobeIndex: isHandoff ? i + 2 : null,
        secondaryHandoff: false,
      })
    }

    // inner_heart: 2 blades, center, lighter (1 HANDOFF, secondary → lobe 0)
    for (let i = 0; i < 2; i++) {
      const angle = (-3 + i * 6 + v.rotBias + (rng() - 0.5) * 3) * v.angleSpread
      const length = (20 + rng() * 2) * v.scaleBias
      const perp = (rng() - 0.5) * 2
      const isHandoff = i === 0
      blades.push({
        id: `p${r}-ih-${i}`, rosetteIndex: r, family: 'inner_heart',
        population: isHandoff ? 'HANDOFF' : 'TEMPORARY',
        renderBand: LEAF_FAMILIES.inner_heart.renderBand,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: LEAF_FAMILIES.inner_heart.valueOffset,
        baseOpacity: LEAF_FAMILIES.inner_heart.baseOpacity,
        canonicalLobeIndex: isHandoff ? 0 : null,
        secondaryHandoff: isHandoff, // retires at 80% convergence
      })
    }

    // accent_tip: 2 blades, tallest, lightest (TEMPORARY)
    for (let i = 0; i < 2; i++) {
      const angle = (-5 + i * 10 + v.rotBias + (rng() - 0.5) * 3) * v.angleSpread
      const length = (21 + rng() * 2) * v.scaleBias
      const perp = (rng() - 0.5) * 2
      blades.push({
        id: `p${r}-at-${i}`, rosetteIndex: r, family: 'accent_tip',
        population: 'TEMPORARY', renderBand: LEAF_FAMILIES.accent_tip.renderBand,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: LEAF_FAMILIES.accent_tip.valueOffset,
        baseOpacity: LEAF_FAMILIES.accent_tip.baseOpacity,
        canonicalLobeIndex: null,
      })
    }
  }

  // ── 3 subordinate connective clusters, 7 blades each = 21 ──
  // Positioned between primary rosettes at ~45% primary scale
  const subOffsets = [-9, 0, 9] // between rosettes 0-1, 1-2, 2-3
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 7; i++) {
      const angle = -30 + i * 8 + (rng() - 0.5) * 6
      const length = (14 + rng() * 3) * 0.45 // 45% of primary
      const perp = (rng() - 0.5) * 3 + 2
      blades.push({
        id: `sub${s}-${i}`, rosetteIndex: -1, subordinateIndex: s,
        subordinateOffset: subOffsets[s],
        family: i < 4 ? 'back_fan' : 'core_upright',
        population: 'TEMPORARY',
        renderBand: i < 4 ? 1 : 2,
        peakAngle: angle, peakLength: length, peakPerp: perp,
        valueOffset: -0.10, baseOpacity: 0.7,
        canonicalLobeIndex: null,
      })
    }
  }

  // ── B1A.5: Insert hand-authored lead rosette blades ──
  // All 17 lead rosette blades are explicitly authored — no RNG.
  // They are appended here and will be sorted by renderBand during rendering.
  for (const blade of ART_DIRECTED_LEAD_BLADES) {
    blades.push(blade)
  }

  return blades
}

const HERO_BLADE_DEFINITIONS = generateHeroBladeDefinitions()

// Pre-compute blade counts by population
const HANDOFF_BLADE_COUNT = HERO_BLADE_DEFINITIONS.filter((b) => b.population === 'HANDOFF').length
const TEMPORARY_BLADE_COUNT = HERO_BLADE_DEFINITIONS.filter((b) => b.population === 'TEMPORARY').length
const PRIMARY_BLADE_COUNT = HERO_BLADE_DEFINITIONS.filter((b) => b.rosetteIndex >= 0).length
const SUBORDINATE_BLADE_COUNT = HERO_BLADE_DEFINITIONS.filter((b) => b.rosetteIndex === -1).length
const TOTAL_HERO_BLADES = HERO_BLADE_DEFINITIONS.length

// Apply value offset to a color (positive = lighter, negative = darker)
function applyValueOffset(color, offset) {
  if (offset === 0) return color
  const target = offset > 0 ? '#FFFFFF' : '#000000'
  return mixColor(color, target, Math.abs(offset))
}

// ── Canonical Harvesting Greens path data generator ────────────
// Renders the EXACT same path data as LivingGardenBed's GreensArt
// at stageKey='harvesting'. No new artwork.
function CanonicalHarvestingPaths({ cx, cy, color, opacity, strokeWidth }) {
  const h = LEAF_HEIGHT_BASE * HARVESTING_HEIGHT_SCALE
  const plants = []
  for (let i = 0; i < HARVEST_PLANT_COUNT; i++) {
    const offset = (i - (HARVEST_PLANT_COUNT - 1) / 2) * PLANT_SPACING
    const px = cx + offset
    const py = cy
    const op = opacity * PATH_BASE_OPACITY
    plants.push(
      <G key={`harvest-plant-${i}`}>
        <Path
          d={`M ${px} ${py} Q ${px - 6} ${py - h * 0.6} ${px - 4} ${py - h}`}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={op}
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} Q ${px + 6} ${py - h * 0.6} ${px + 4} ${py - h}`}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={op}
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} Q ${px - 3} ${py - h * 0.7} ${px - 1} ${py - h * 1.1}`}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={op}
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} Q ${px + 3} ${py - h * 0.7} ${px + 1} ${py - h * 1.1}`}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={op}
          strokeLinecap="round"
        />
      </G>,
    )
  }
  return <G>{plants}</G>
}

// ── Single Harvesting Rosette (for per-rosette local Hero transforms) ──
// Renders ONE plant at the given base position. Used by V5HeroOverlay
// to apply an independent local scale around each rosette's own root.
function SingleHarvestingRosette({ baseX, baseY, color, opacity, strokeWidth }) {
  const h = LEAF_HEIGHT_BASE * HARVESTING_HEIGHT_SCALE
  const px = baseX
  const py = baseY
  const op = opacity * PATH_BASE_OPACITY
  return (
    <G>
      <Path
        d={`M ${px} ${py} Q ${px - 6} ${py - h * 0.6} ${px - 4} ${py - h}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px + 6} ${py - h * 0.6} ${px + 4} ${py - h}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px - 3} ${py - h * 0.7} ${px - 1} ${py - h * 1.1}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px + 3} ${py - h * 0.7} ${px + 1} ${py - h * 1.1}`}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
    </G>
  )
}

// ── Soil bed (canonical Harvesting, for base layer) ───────────
function V5SoilBed({ bedKey }) {
  const blob = BED_BLOBS[bedKey]
  const placement = BED_PLACEMENT[bedKey]
  const warmSoilColor = mixColor('#46271B', BED_PALETTES[bedKey].produce, 0.16)
  return (
    <G>
      <Path d={blob} fill={SCENE_PALETTE.loamDark} />
      <Path d={blob} fill={warmSoilColor} opacity={0.5} />
      <Path d={blob} fill="none" stroke={SCENE_PALETTE.loamLit} strokeWidth="0.8" opacity="0.60" />
      <Rect
        x={placement.cx - 2.5}
        y={placement.cy - placement.ry - 8}
        width="5"
        height="8"
        fill={PRODUCE_COLORS[bedKey]}
        opacity="0.7"
        rx="1"
      />
      {BED_FRINGES[bedKey].map((tuft, i) => (
        <Path
          key={`v5-fringe-${bedKey}-${i}`}
          d={`M ${tuft.x.toFixed(2)} ${(tuft.y + tuft.h).toFixed(2)} L ${(tuft.x + tuft.lean).toFixed(2)} ${tuft.y.toFixed(2)}`}
          stroke={SCENE_PALETTE.groundFar}
          strokeWidth="0.7"
          opacity="0.7"
          strokeLinecap="round"
        />
      ))}
    </G>
  )
}

// ── Hero collar / soil bridge ─────────────────────────────────
// A small organic collar at the soil line that bridges the hero
// vegetation to the Garden ground. Scales to ~1.15× at peak, 1.0× at rest.
function V5HeroCollar({ cx, cy, bedKey, collarScale, opacity }) {
  if (opacity <= 0) return null
  const palette = BED_PALETTES[bedKey]
  const r = 6 * collarScale
  return (
    <Ellipse
      cx={cx}
      cy={cy + 2}
      rx={r}
      ry={r * 0.4}
      fill={mixColor(SCENE_PALETTE.loamDark, palette.deep, 0.3)}
      opacity={opacity * 0.8}
    />
  )
}

// ── Ground bloom (canonical Harvesting level) ─────────────────
function V5GroundBloom({ bedKey, placement }) {
  const palette = BED_PALETTES[bedKey]
  const bloomFactor = 0.45
  const opacity = 0.1 * bloomFactor
  if (opacity <= 0) return null
  return (
    <Ellipse
      cx={placement.cx}
      cy={placement.cy + placement.ry * 0.3}
      rx={placement.rx * 1.75}
      ry={placement.ry * 0.72}
      fill={palette.produce}
      opacity={opacity}
    />
  )
}

// ── V5 Phase A sequence states ────────────────────────────────
// IDLE: nothing happening, canonical Harvesting visible
// HERO_HOLD: large hero rendered at selected scale
// CONVERGENCE: hero scale converging 3.6×→1.0×
// FREEZE: transforms halted, checking registration gate
// CROSSFADE: complementary opacity handoff
// DEFERRED_UNMOUNT: waiting to unmount hero
// COMPLETE: canonical Harvesting only
const PHASE_NAMES = ['IDLE', 'HERO_HOLD', 'CONVERGENCE', 'FREEZE', 'CROSSFADE', 'DEFERRED_UNMOUNT', 'COMPLETE']
const PHASE_IDLE = 0
const PHASE_HERO_HOLD = 1
const PHASE_CONVERGENCE = 2
const PHASE_FREEZE = 3
const PHASE_CROSSFADE = 4
const PHASE_DEFERRED_UNMOUNT = 5
const PHASE_COMPLETE = 6

// ── Main V5 Phase A Merge Proof Component ─────────────────────
export const GreensV5MergeProofCalibrationBed = React.memo(
  function GreensV5MergeProofCalibrationBed({
    bedKey,
    stageKey,
    sceneId,
    advancements,
    isReduced,
    heroScalePreset = DEFAULT_SCALE_PRESET,
    onV5Debug,
    replayToken = 0,
  }) {
    const placement = BED_PLACEMENT[bedKey]
    const timelineRef = useRef(new Animated.Value(0))
    const animRef = useRef(null)
    const processedAdvancementRef = useRef(null)
    const processedReplayTokenRef = useRef(0)
    const unmountTimerRef = useRef(null)
    const phaseRef = useRef(PHASE_IDLE)
    const componentGenerationRef = useRef(0)
    const triggerReceivedRef = useRef(false)
    const timelineStartRef = useRef(false)

    // Increment component generation on every render (for diagnostics)
    componentGenerationRef.current += 1

    const targetHeroScale = LOCAL_ROSETTE_SCALE_PRESETS[heroScalePreset] || LOCAL_ROSETTE_SCALE_PRESETS[DEFAULT_SCALE_PRESET]

    // Single state object
    // B1A: heroScale = horizontal scale, verticalScale = vertical anisotropy
    //      localRosetteScale = horizontal (alias)
    //      rootSpreadScale = modest root-base parting
    //      populationOpacity = controls TEMPORARY/SUPPORT retirement
    const [motion, setMotion] = useState({
      phase: PHASE_IDLE,
      phaseName: 'IDLE',
      heroScale: 1.0, // horizontal scale (alias for localRosetteScale)
      localRosetteScale: 1.0,
      verticalScale: 1.0, // B1A: vertical anisotropy
      rootSpreadScale: 1.0,
      collarScale: 1.0,
      heroOpacity: 0,
      baseOpacity: 1,
      populationOpacity: 1, // B1A: 1=full, 0=temporary/support retired
      frozen: false,
      gatePassed: false,
      posDelta: 0,
      scaleDelta: 0,
      rotDelta: 0,
      crossfadeProgress: 0,
      timelineProgress: 0,
      replayToken: 0,
      triggerReceived: false,
      componentGeneration: componentGenerationRef.current,
      timelineStart: false,
    })

    // ── Detect advancement trigger ─────────────────────────
    // V5 Phase A uses Harvesting→Harvesting (no progression change).
    // The merge proof is a presentation-layer test, not a progression
    // animation. Therefore we accept ANY greens advancement where
    // toStage === 'harvesting', regardless of fromStage.
    // This is the isolated QA preview path — production advancement
    // semantics are NOT altered.
    const greensAdvancement = advancements?.bedAdvancements?.find(
      (a) => a.bedKey === 'greens' && a.toStage === 'harvesting',
    )

    // ── Start sequence (shared by advancement + replayToken triggers) ──
    const startSequence = () => {
      // Clear any pending unmount timer
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current)
        unmountTimerRef.current = null
      }

      if (isReduced) {
        // Reduced Motion: skip directly to canonical
        phaseRef.current = PHASE_COMPLETE
        triggerReceivedRef.current = true
        timelineStartRef.current = false
        setMotion({
          phase: PHASE_COMPLETE,
          phaseName: 'COMPLETE',
          heroScale: 1.0,
          localRosetteScale: 1.0,
          verticalScale: 1.0,
          rootSpreadScale: 1.0,
          collarScale: 1.0,
          heroOpacity: 0,
          baseOpacity: 1,
          populationOpacity: 0,
          frozen: true,
          gatePassed: true,
          posDelta: 0,
          scaleDelta: 0,
          rotDelta: 0,
          crossfadeProgress: 1,
          timelineProgress: 1,
          replayToken,
          triggerReceived: true,
          componentGeneration: componentGenerationRef.current,
          timelineStart: false,
        })
        return
      }

      // Cancel any running animation
      if (animRef.current) animRef.current.stop()

      // ── Phase A sequence ──
      const totalAnimDuration = HERO_HOLD_DURATION + CONVERGENCE_DURATION + FREEZE_HOLD_DURATION + CROSSFADE_DURATION

      // Phase 1: HERO_HOLD — hero at full scale, opacity 1, base hidden
      // B1A: anisotropic scale (8.5× horizontal, 10.0× vertical), populationOpacity=1
      phaseRef.current = PHASE_HERO_HOLD
      triggerReceivedRef.current = true
      timelineStartRef.current = true
      setMotion({
        phase: PHASE_HERO_HOLD,
        phaseName: 'HERO_HOLD',
        heroScale: targetHeroScale, // horizontal scale
        localRosetteScale: targetHeroScale,
        verticalScale: HERO_VERTICAL_SCALE, // B1A anisotropy
        rootSpreadScale: ROOT_SPREAD_SCALE_PEAK,
        collarScale: COLLAR_PEAK_SCALE,
        heroOpacity: 1,
        baseOpacity: 0, // base hidden during hero hold
        populationOpacity: 1, // all populations visible
        frozen: false,
        gatePassed: false,
        posDelta: 0,
        scaleDelta: (targetHeroScale - 1) * 100,
        rotDelta: 0,
        crossfadeProgress: 0,
        timelineProgress: 0,
        replayToken,
        triggerReceived: true,
        componentGeneration: componentGenerationRef.current,
        timelineStart: true,
      })

      // Start the master timeline
      timelineRef.current.setValue(0)
      const anim = Animated.timing(timelineRef.current, {
        toValue: 1,
        duration: totalAnimDuration,
        easing: Easing.linear,
        useNativeDriver: false,
      })
      animRef.current = anim
      anim.start(({ finished }) => {
        if (finished) {
          // Schedule deferred unmount
          phaseRef.current = PHASE_DEFERRED_UNMOUNT
          setMotion((prev) => ({
            ...prev,
            phase: PHASE_DEFERRED_UNMOUNT,
            phaseName: 'DEFERRED_UNMOUNT',
          }))
          unmountTimerRef.current = setTimeout(() => {
            phaseRef.current = PHASE_COMPLETE
            timelineStartRef.current = false
            setMotion({
              phase: PHASE_COMPLETE,
              phaseName: 'COMPLETE',
              heroScale: 1.0,
              localRosetteScale: 1.0,
              verticalScale: 1.0,
              rootSpreadScale: 1.0,
              collarScale: 1.0,
              heroOpacity: 0,
              baseOpacity: 1,
              populationOpacity: 0,
              frozen: true,
              gatePassed: true,
              posDelta: 0,
              scaleDelta: 0,
              rotDelta: 0,
              crossfadeProgress: 1,
              timelineProgress: 1,
              replayToken,
              triggerReceived: true,
              componentGeneration: componentGenerationRef.current,
              timelineStart: false,
            })
            unmountTimerRef.current = null
          }, DEFERRED_UNMOUNT_DELAY)
        }
        animRef.current = null
      })
    }

    // ── Trigger 1: advancement detection ──────────────────
    useEffect(() => {
      if (!greensAdvancement) return
      if (processedAdvancementRef.current === advancements) return
      processedAdvancementRef.current = advancements
      startSequence()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [advancements, greensAdvancement, isReduced, targetHeroScale])

    // ── Trigger 2: explicit replay token ──────────────────
    // The QA Replay action increments v5ReplayToken in GardenPreviewScreen.
    // This is the authoritative trigger for V5 Phase A — it does NOT
    // depend on advancement semantics or source/target stage comparison.
    useEffect(() => {
      if (replayToken <= 0) return
      if (processedReplayTokenRef.current === replayToken) return
      processedReplayTokenRef.current = replayToken
      startSequence()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [replayToken, isReduced, targetHeroScale])

    // ── Cleanup on unmount ────────────────────────────────
    useEffect(() => {
      return () => {
        if (animRef.current) {
          animRef.current.stop()
          animRef.current = null
        }
        if (unmountTimerRef.current) {
          clearTimeout(unmountTimerRef.current)
          unmountTimerRef.current = null
        }
      }
    }, [])

    // ── Background interruption: cancel + canonical ────────
    useEffect(() => {
      const handleAppState = (nextState) => {
        if (nextState === 'background' || nextState === 'inactive') {
          if (animRef.current) {
            animRef.current.stop()
            animRef.current = null
          }
          if (unmountTimerRef.current) {
            clearTimeout(unmountTimerRef.current)
            unmountTimerRef.current = null
          }
          phaseRef.current = PHASE_COMPLETE
          timelineRef.current.setValue(1)
          setMotion({
            phase: PHASE_COMPLETE,
            phaseName: 'COMPLETE',
            heroScale: 1.0,
            localRosetteScale: 1.0,
            verticalScale: 1.0,
            rootSpreadScale: 1.0,
            collarScale: 1.0,
            heroOpacity: 0,
            baseOpacity: 1,
            populationOpacity: 0,
            frozen: true,
            gatePassed: true,
            posDelta: 0,
            scaleDelta: 0,
            rotDelta: 0,
            crossfadeProgress: 1,
            timelineProgress: 1,
          })
        }
      }
      const sub = AppState.addEventListener('change', handleAppState)
      return () => sub.remove()
    }, [])

    // ── Single listener: drive the sequence ────────────────
    useEffect(() => {
      const update = ({ value: t }) => {
        // t goes 0→1 over totalAnimDuration
        // Calculate phase boundaries as fractions of total
        const totalDuration = HERO_HOLD_DURATION + CONVERGENCE_DURATION + FREEZE_HOLD_DURATION + CROSSFADE_DURATION
        const holdEnd = HERO_HOLD_DURATION / totalDuration
        const convergenceEnd = (HERO_HOLD_DURATION + CONVERGENCE_DURATION) / totalDuration
        const freezeEnd = (HERO_HOLD_DURATION + CONVERGENCE_DURATION + FREEZE_HOLD_DURATION) / totalDuration
        // crossfadeEnd = 1.0

        let phase = PHASE_HERO_HOLD
        let localRosetteScale = targetHeroScale
        let verticalScale = HERO_VERTICAL_SCALE
        let rootSpreadScale = ROOT_SPREAD_SCALE_PEAK
        let collarScale = COLLAR_PEAK_SCALE
        let heroOpacity = 1
        let baseOpacity = 0
        let populationOpacity = 1 // B1A: controls TEMPORARY/SUPPORT retirement
        let frozen = false
        let gatePassed = false
        let posDelta = 0
        let scaleDelta = 0
        let rotDelta = 0
        let crossfadeProgress = 0

        if (t < holdEnd) {
          // Phase 1: HERO_HOLD — full rich hero, all populations visible
          phase = PHASE_HERO_HOLD
          localRosetteScale = targetHeroScale
          verticalScale = HERO_VERTICAL_SCALE
          rootSpreadScale = ROOT_SPREAD_SCALE_PEAK
          collarScale = COLLAR_PEAK_SCALE
          heroOpacity = 1
          baseOpacity = 0
          populationOpacity = 1
          posDelta = 0
          scaleDelta = (targetHeroScale - 1) * 100
        } else if (t < convergenceEnd) {
          // Phase 2: CONVERGENCE
          // B1A: anisotropy → uniform, rootSpread → 1.0, populations retire
          const convRaw = clamp((t - holdEnd) / (convergenceEnd - holdEnd), 0, 1)
          const conv = easeInOutCubic(convRaw)
          phase = PHASE_CONVERGENCE
          localRosetteScale = targetHeroScale + (1.0 - targetHeroScale) * conv
          verticalScale = HERO_VERTICAL_SCALE + (1.0 - HERO_VERTICAL_SCALE) * conv
          rootSpreadScale = ROOT_SPREAD_SCALE_PEAK + (1.0 - ROOT_SPREAD_SCALE_PEAK) * conv
          collarScale = COLLAR_PEAK_SCALE + (1.0 - COLLAR_PEAK_SCALE) * conv
          heroOpacity = 1
          baseOpacity = 0
          // TEMPORARY and SUPPORT populations retire during convergence
          // Secondary handoff blades retire at 80% convergence
          populationOpacity = 1.0 - conv
          posDelta = 0
          scaleDelta = Math.abs(localRosetteScale - 1.0) * 100
          rotDelta = 0
        } else if (t < freezeEnd) {
          // Phase 3+4: REGISTRATION GATE + TRANSFORM FREEZE
          // B1A: anisotropy = 1.0 (uniform), only HANDOFF blades visible
          const freezeRaw = clamp((t - convergenceEnd) / (freezeEnd - convergenceEnd), 0, 1)
          phase = PHASE_FREEZE
          localRosetteScale = 1.0 // converged to canonical
          verticalScale = 1.0 // uniform
          rootSpreadScale = 1.0
          collarScale = 1.0
          heroOpacity = 1
          baseOpacity = 0
          populationOpacity = 0 // temporary/support fully retired
          frozen = true
          posDelta = 0
          scaleDelta = 0
          rotDelta = 0
          gatePassed = posDelta < GATE_POS_DELTA_MAX &&
            scaleDelta < GATE_SCALE_DELTA_MAX * 100 &&
            rotDelta < GATE_ROT_DELTA_MAX
        } else {
          // Phase 5: CROSSFADE — handoff blades fade, base canonical appears
          const xfRaw = clamp((t - freezeEnd) / (1.0 - freezeEnd), 0, 1)
          phase = PHASE_CROSSFADE
          localRosetteScale = 1.0
          verticalScale = 1.0
          rootSpreadScale = 1.0
          collarScale = 1.0
          populationOpacity = 0
          frozen = true
          gatePassed = true
          crossfadeProgress = xfRaw
          heroOpacity = Math.sqrt(1 - xfRaw)
          baseOpacity = Math.sqrt(xfRaw)
          posDelta = 0
          scaleDelta = 0
          rotDelta = 0
        }

        setMotion((prev) => ({
          ...prev, // preserve latched trigger fields
          phase,
          phaseName: PHASE_NAMES[phase] || 'IDLE',
          heroScale: localRosetteScale, // alias (horizontal)
          localRosetteScale,
          verticalScale,
          rootSpreadScale,
          collarScale,
          heroOpacity,
          baseOpacity,
          populationOpacity,
          frozen,
          gatePassed,
          posDelta,
          scaleDelta,
          rotDelta,
          crossfadeProgress,
          timelineProgress: t,
        }))
      }
      const id = timelineRef.current.addListener(update)
      // Don't call update on mount — IDLE state is correct until advancement triggers
      return () => timelineRef.current.removeListener(id)
    }, [targetHeroScale])

    // ── Diagnostic callback ────────────────────────────────
    useEffect(() => {
      if (!onV5Debug) return
      // B0.1A: Defensive assertion — if a valid preset is selected but
      // targetHeroScale resolves to ≤1.01, the preset resolution failed.
      const presetIsValid = heroScalePreset === 'B1A' || heroScalePreset === 'SMALL' || heroScalePreset === 'MEDIUM' || heroScalePreset === 'LARGE'
      const presetResolutionError = presetIsValid && targetHeroScale <= 1.01
      onV5Debug({
        phase: motion.phase,
        phaseName: motion.phaseName,
        scalePreset: heroScalePreset,
        heroScaleValue: targetHeroScale,
        heroScale: motion.heroScale,
        localRosetteScale: motion.localRosetteScale,
        verticalScale: motion.verticalScale,
        rootSpreadScale: motion.rootSpreadScale,
        collarScale: motion.collarScale,
        populationOpacity: motion.populationOpacity,
        posDelta: motion.posDelta,
        scaleDelta: motion.scaleDelta,
        rotDelta: motion.rotDelta,
        frozen: motion.frozen,
        crossfade: motion.crossfadeProgress,
        heroOpacity: motion.heroOpacity,
        baseOpacity: motion.baseOpacity,
        gate: motion.gatePassed ? 'PASS' : 'FAIL',
        progress: motion.timelineProgress,
        replayToken: motion.replayToken,
        triggerReceived: motion.triggerReceived,
        componentGeneration: motion.componentGeneration,
        timelineStart: motion.timelineStart,
        presetResolutionError,
      })
    }, [onV5Debug, motion, heroScalePreset, targetHeroScale])

    // ── Render ─────────────────────────────────────────────
    // Phase B0: The V5 component renders ONLY the base/canonical layer
    // inside the root SVG. The hero presentation layer is rendered by
    // V5HeroOverlay (a separate SVG absolutely positioned above the
    // root SVG) so the hero can extend beyond the root SVG viewport
    // without being clipped. This is required because the Greens bed
    // is at the left edge (cx=62) and large hero scales (10–13×) push
    // foliage far beyond x=0.
    if (!placement) return null

    const cx = placement.cx
    const cy = placement.cy // SOIL LINE ANCHOR
    const color = harvestingLeafColor()

    // ── Base/canonical layer (always rendered, opacity varies) ──
    const baseVisible = motion.baseOpacity > 0
    const baseStrokeW = BASE_STROKE_WIDTH // canonical stroke at 1.0×

    return (
      <G>
        {/* ── BASE/CANONICAL LAYER (inside root SVG) ── */}
        {/* Ground bloom (always at canonical level) */}
        <V5GroundBloom bedKey={bedKey} placement={placement} />
        {/* Soil bed (canonical, always visible at footprint 1.00×) */}
        <V5SoilBed bedKey={bedKey} />
        {/* Canonical Harvesting foliage (opacity = baseOpacity) */}
        {baseVisible && (
          <CanonicalHarvestingPaths
            cx={cx}
            cy={cy}
            color={color}
            opacity={motion.baseOpacity}
            strokeWidth={baseStrokeW}
          />
        )}
        {/* ── HERO LAYER: rendered by V5HeroOverlay (outside root SVG) ── */}
      </G>
    )
  },
  (prev, next) =>
    prev.bedKey === next.bedKey &&
    prev.stageKey === next.stageKey &&
    prev.advancements === next.advancements &&
    prev.isReduced === next.isReduced &&
    prev.heroScalePreset === next.heroScalePreset &&
    prev.onV5Debug === next.onV5Debug &&
    prev.replayToken === next.replayToken,
)

// ── Export scale presets for QA selector ──────────────────────
export {
  HERO_SCALE_PRESETS,
  LOCAL_ROSETTE_SCALE_PRESETS,
  DEFAULT_SCALE_PRESET,
  PRESET_LABELS,
  HERO_HORIZONTAL_SCALE,
  HERO_VERTICAL_SCALE,
  HERO_ANISOTROPY,
  ROOT_SPREAD_SCALE_PEAK,
  CANONICAL_ROOT_SPREAD,
  ROSETTE_OFFSETS,
  ROSETTE_FOLIAGE_W,
  ROSETTE_FOLIAGE_H,
  LARGEST_LEAF_LENGTH_CANONICAL,
  LARGEST_LEAF_WIDTH_CANONICAL,
  GARDEN_VIEWPORT_W,
  GARDEN_VIEWPORT_H,
  GARDEN_VIEWPORT_AREA,
  GREENS_CX,
  GREENS_CY,
  calculateVisibleOccupancy,
  computeHeroBBoxSvg,
  computeVisibleIntersection,
  compensatedStrokeWidth,
  CanonicalHarvestingPaths,
  SingleHarvestingRosette,
  V5HeroCollar,
  harvestingLeafColor,
  // B1A exports
  HERO_BLADE_DEFINITIONS,
  CANONICAL_LOBE_PATHS,
  CANONICAL_LOBE_COORDS,
  CANONICAL_LOBE_ANGLES,
  LEAF_FAMILIES,
  RENDER_BANDS,
  HANDOFF_BLADE_COUNT,
  TEMPORARY_BLADE_COUNT,
  PRIMARY_BLADE_COUNT,
  SUBORDINATE_BLADE_COUNT,
  TOTAL_HERO_BLADES,
  bladePath,
  bladeSilhouettePath,
  bladeHalfWidthAtFrac,
  computeEdgeClearance,
  transformBladePoint,
  computeTransformedBladePolygon,
  pointInPolygon,
  SILHOUETTE_BASE,
  ART_DIRECTED_LEAD_BLADES,
  PRINCIPAL_BLADE_IDS,
  SECONDARY_BLADE_IDS,
  CROWN_BLADE_IDS,
  BACKGROUND_WEDGES,
  PRINCIPAL_LITERAL_PATHS,
  PRIN_1_PATH,
  PRIN_2_PATH,
  PRIN_3_PATH,
  PRIN_4_PATH,
  PRIN_5_PATH,
  PRIN_6_PATH,
  PRIN_7_PATH,
  ROOT_CORE_WIDTH,
  ROOT_CORE_HEIGHT,
  fmtPathNum,
  applyValueOffset,
}

export default GreensV5MergeProofCalibrationBed

// ─────────────────────────────────────────────────────────────
// V5HeroOverlay — Foreground Hero Presentation Layer
// (Phase B0: renders hero OUTSIDE the root SVG to avoid viewport clipping)
//
// The root Garden SVG has viewBox="0 0 390 720" and clips anything
// outside that viewport. The Greens bed is at cx=62 (left edge), so
// at hero scales of 10–13× the foliage extends far beyond x=0.
//
// This overlay renders a SEPARATE SVG absolutely positioned above the
// root SVG, covering the full sceneArea. It maps the Greens soil-line
// anchor from SVG coordinates into screen/container coordinates and
// renders the hero at the mapped position.
//
// KEY: ROOTS PIN. FOLIAGE ESCAPES.
// The hero's root origin maps to the exact Greens soil location.
// The foliage is allowed to extend beyond the Garden viewport.
//
// MERGE PRESERVATION:
// At heroScale=1.0, the overlay hero occupies the exact same screen
// position as the base in the root SVG. The proven Phase A merge
// (convergence → freeze → crossfade → deferred unmount) is preserved.
// ─────────────────────────────────────────────────────────────

// ── Hero overlay geometry helpers ─────────────────────────────
// Compute the screen-space position of a SVG coordinate
function svgToScreen(svgX, svgY, scale, offsetX, offsetY) {
  return {
    x: offsetX + svgX * scale,
    y: offsetY + svgY * scale,
  }
}

export const V5HeroOverlay = React.memo(
  function V5HeroOverlay({
    heroState, // { localRosetteScale, verticalScale, rootSpreadScale, heroOpacity, collarScale, populationOpacity, phase, ... }
    sceneGeometry, // { scale, offsetX, offsetY, width, height }
    bedKey = 'greens',
  }) {
    if (!heroState || !sceneGeometry) return null
    if (heroState.phase === PHASE_IDLE || heroState.phase === PHASE_COMPLETE) return null
    if (heroState.heroOpacity <= 0) return null

    const placement = BED_PLACEMENT[bedKey]
    if (!placement) return null

    const cx = placement.cx
    const cy = placement.cy
    const { scale, offsetX, offsetY, width, height } = sceneGeometry

    const hScale = heroState.localRosetteScale || heroState.heroScale || 1.0
    const vScale = heroState.verticalScale || hScale // B1A anisotropy
    const rootSpread = heroState.rootSpreadScale || 1.0
    const popOpacity = heroState.populationOpacity !== undefined ? heroState.populationOpacity : 1.0
    const heroStrokeW = compensatedStrokeWidth(Math.max(hScale, vScale))
    const baseColor = harvestingLeafColor()
    const heroOpacity = heroState.heroOpacity

    // Convergence progress for blade interpolation (0=peak, 1=canonical)
    const convProgress = heroState.frozen ? 1.0 : (heroState.phase === PHASE_HERO_HOLD ? 0.0 : 1.0 - Math.abs(hScale - 1.0) / Math.max(0.01, HERO_HORIZONTAL_SCALE - 1.0))

    // Render blades grouped by render band (interleaved across rosettes)
    const bandGroups = [[], [], [], [], []]

    for (let bi = 0; bi < HERO_BLADE_DEFINITIONS.length; bi++) {
      const blade = HERO_BLADE_DEFINITIONS[bi]
      const isHandoff = blade.population === 'HANDOFF'
      const bladeOpacity = isHandoff ? heroOpacity : heroOpacity * popOpacity

      // Secondary handoff retires at 80% convergence
      let effOpacity = bladeOpacity
      if (blade.secondaryHandoff && convProgress > 0.8) {
        effOpacity = bladeOpacity * (1.0 - (convProgress - 0.8) / 0.2)
      }

      if (effOpacity <= 0.01) continue

      // Compute blade base position
      let baseX, baseY
      if (blade.rosetteIndex >= 0) {
        const offset = ROSETTE_OFFSETS[blade.rosetteIndex]
        baseX = cx + offset * rootSpread
        baseY = cy
      } else {
        // Subordinate cluster between rosettes
        baseX = cx + blade.subordinateOffset * rootSpread
        baseY = cy
      }

      // B1A.3: Apply root-core micro-offset for lead rosette (converges to zero)
      if (blade.rosetteIndex === 1 && blade.rootCoreOffset) {
        const offsetScale = 1.0 - convProgress
        baseX += blade.rootCoreOffset.dx * offsetScale
        baseY += blade.rootCoreOffset.dy * offsetScale
      }

      // Map from SVG coords to screen coords
      const screenBase = svgToScreen(baseX, baseY, scale, offsetX, offsetY)

      // Compute blade transform: anisotropic scale + rotation
      // At peak: scale(hScale, vScale) + rotate(peakAngle)
      // At freeze: scale(1,1) + rotate(canonicalAngle) for handoff, invisible for temporary
      let bladeAngle = blade.peakAngle
      let bladeLength = blade.peakLength
      let bladePerp = blade.peakPerp

      if (isHandoff && blade.canonicalLobeIndex !== null) {
        // Interpolate angle and length toward canonical
        const targetAngle = CANONICAL_LOBE_ANGLES[blade.canonicalLobeIndex]
        bladeAngle = blade.peakAngle + (targetAngle - blade.peakAngle) * convProgress
        // Length converges to canonical (18 for outer, 19.8 for inner)
        bladeLength = blade.peakLength + (1.0 - blade.peakLength) * convProgress
      }

      // Total anisotropic scale for this blade's rosette
      const totalScaleX = scale * hScale
      const totalScaleY = scale * vScale

      // Subordinate clusters at 45% scale
      const subScale = blade.rosetteIndex === -1 ? 0.45 : 1.0
      const effScaleX = totalScaleX * subScale
      const effScaleY = totalScaleY * subScale

      // Transform: translate to screen base, anisotropic scale, rotate, translate back
      const transform = `translate(${screenBase.x} ${screenBase.y}) scale(${effScaleX} ${effScaleY}) rotate(${bladeAngle}) translate(${-baseX} ${-baseY})`

      // Generate path in ABSOLUTE SVG coordinates.
      // The transform includes translate(-baseX, -baseY) which maps the
      // absolute base point to the origin for rotation/scaling, then
      // translate(screenBase) maps back to screen position.
      // Therefore ALL path coordinates must be absolute (baseX + localOffset).
      //
      // B1A.1: Lead rosette (rosette 1) uses CLOSED FILLED silhouettes.
      // Other rosettes retain OPEN centerline rendering as A/B controls.
      // At freeze, handoff blades always use canonical lobe paths (open centerlines)
      // so the merge converges into the canonical Harvesting artwork.
      const atFreezeHandoff = isHandoff && heroState.frozen && blade.canonicalLobeIndex !== null
      const useSilhouette = blade.rosetteIndex === 1 && blade.silhouette && !atFreezeHandoff

      // Value-offset color (defined before path construction)
      const bladeColor = applyValueOffset(baseColor, blade.valueOffset * (1.0 - convProgress))

      // Stroke width: compensated for scale, slightly varied per family
      const famStrokeMult = blade.family === 'accent_tip' ? 0.85 : blade.family === 'back_fan' ? 1.1 : 1.0
      const strokeW = heroStrokeW * famStrokeMult

      // B1A.6: Principal leaves get darker edge stroke at Hero Hold.
      // Edge darkness = 12% darker than fill, neutralizes during convergence.
      // At Hero Hold (convProgress=0): full 12% darker edge.
      // At freeze (convProgress=1): edge = fill (no contrast).
      let pathStrokeColor = bladeColor
      if (blade.isPrincipal) {
        const edgeDarkness = 0.12 * (1.0 - convProgress)
        pathStrokeColor = applyValueOffset(baseColor, blade.valueOffset * (1.0 - convProgress) - edgeDarkness)
      }

      let pathD
      let pathFill = 'none'
      let pathStrokeWidth = strokeW

      if (atFreezeHandoff) {
        // Use exact canonical lobe path at freeze (open centerline)
        const lobe = CANONICAL_LOBE_COORDS[blade.canonicalLobeIndex]
        pathD = `M ${fmtPathNum(baseX)} ${fmtPathNum(baseY)} Q ${fmtPathNum(baseX + lobe.cpX)} ${fmtPathNum(baseY + lobe.cpY)} ${fmtPathNum(baseX + lobe.endX)} ${fmtPathNum(baseY + lobe.endY)}`
        pathFill = 'none'
      } else if (useSilhouette && blade.isPrincipal && PRINCIPAL_LITERAL_PATHS[blade.id]) {
        // B1A.6: Principal leaves use LITERAL hand-authored SVG paths
        // NO generic bladeSilhouettePath() for principals.
        pathD = PRINCIPAL_LITERAL_PATHS[blade.id](baseX, baseY)
        pathFill = bladeColor
        pathStrokeWidth = strokeW * 0.60
      } else if (useSilhouette) {
        // B1A.1: Secondary/crown leaves use generic silhouette
        const s = blade.silhouette
        pathD = bladeSilhouettePath(bladeLength, s.maxWidth, s.shoulderFrac, s.petioleFrac, s.asymmetry, s.tipPinch, baseX, baseY)
        pathFill = bladeColor
        pathStrokeWidth = strokeW * 0.20
      } else {
        // Other rosettes: open centerline (B1A control)
        pathD = bladePath(0, bladeLength, bladePerp, baseX, baseY)
        pathFill = 'none'
      }

      bandGroups[blade.renderBand].push(
        <Path
          key={blade.id}
          d={pathD}
          stroke={pathStrokeColor}
          strokeWidth={pathStrokeWidth}
          fill={pathFill}
          opacity={effOpacity * blade.baseOpacity}
          strokeLinecap="round"
          transform={transform}
        />,
      )
    }

    // Soil-line occluder (SUPPORT population, render band 3)
    // Covers blade bases so plants appear to emerge from behind soil
    const soilOccluderOpacity = heroOpacity * popOpacity
    let soilOccluder = null
    if (soilOccluderOpacity > 0.01) {
      const soilScreenBase = svgToScreen(cx, cy, scale, offsetX, offsetY)
      const soilRx = 40 * rootSpread * scale // wider than canonical bed
      const soilRy = 10 * scale
      const soilColor = mixColor(SCENE_PALETTE.loamDark, BED_PALETTES[bedKey].deep, 0.3)
      soilOccluder = (
        <Ellipse
          cx={soilScreenBase.x}
          cy={soilScreenBase.y + 3 * scale}
          rx={soilRx}
          ry={soilRy}
          fill={soilColor}
          opacity={soilOccluderOpacity * 0.9}
        />
      )
    }

    // Collar: modest bridge scaled by rootSpreadScale (NOT foliage scale)
    const collarScreenBase = svgToScreen(cx, cy, scale, offsetX, offsetY)
    const collarTotalScale = scale * heroState.collarScale * rootSpread
    const collarTransform = `translate(${collarScreenBase.x} ${collarScreenBase.y}) scale(${collarTotalScale}) translate(${-cx} ${-cy})`

    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}
      >
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ overflow: 'visible' }}
        >
          {/* Hero collar / soil bridge (scales with root spread, not foliage) */}
          <G transform={collarTransform}>
            <V5HeroCollar
              cx={cx}
              cy={cy}
              bedKey={bedKey}
              collarScale={heroState.collarScale * rootSpread}
              opacity={heroState.heroOpacity}
            />
          </G>
          {/* Render band 0: deep back (currently empty — back_fan starts at band 1) */}
          {bandGroups[0]}
          {/* Render band 1: back fan + subordinate back clusters */}
          {bandGroups[1]}
          {/* Render band 2: main body (core upright + side flare + subordinate mid) */}
          {bandGroups[2]}
          {/* Render band 3: skirt / soil bridge — soil occluder + outer skirt blades */}
          {soilOccluder}
          {bandGroups[3]}
          {/* Render band 4: front accents (inner heart + accent tips) */}
          {bandGroups[4]}
        </Svg>
      </View>
    )
  },
  (prev, next) =>
    prev.heroState === next.heroState &&
    prev.sceneGeometry === next.sceneGeometry &&
    prev.bedKey === next.bedKey,
)
