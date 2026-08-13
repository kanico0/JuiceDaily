// ─────────────────────────────────────────────────────────────
// LivingGardenBed.js — Per-bed renderer for the immersive scene
//
// Renders all 7 produce areas × 6 existing Garden stages.
// Pure function of the existing stage key. No new thresholds.
//
// Spec §8: Recognition carried by growth form before colour.
// Spec §9: Same grammar in every area. Six stages.
//   Empty:      prepared soil, edging, colour tag, 11% ghost
//   Seed:       small mounds with visible seed, soil sheen lifts
//   Sprout:     3-4 cotyledon pairs at ~20% height, desaturated
//   Growing:    recognisable plant, ~55% height, no produce, muted
//   Harvesting: full plant, produce present, full saturation, rim
//   Flourishing:more plants, more produce, signature flourish, glow
//
// The ghost is the ONLY future state (always next step, never two).
// Anticipation, not a preview.
//
// Memoised on stageKey alone — a bed re-renders only when its
// own stage changes (spec §22).
// ─────────────────────────────────────────────────────────────

import React, { memo } from 'react'
import { G, Path, Ellipse, Circle, Rect, Line } from 'react-native-svg'
import {
  BED_PLACEMENT,
  BED_BLOBS,
  BED_FRINGES,
  PRODUCE_COLORS,
  SCENE_PALETTE,
} from './LivingGardenGeometry'

// ── Stage keys (mirror existing gardenService) ────────────────
const STAGE_EMPTY = 'empty'
const STAGE_SEED = 'seed'
const STAGE_SPROUT = 'sprout'
const STAGE_GROWING = 'growing'
const STAGE_HARVESTING = 'harvesting'
const STAGE_FLOURISHING = 'flourishing'

// ── Bed metadata for artwork ──────────────────────────────────
// Growth-form vocabulary per area (spec §8).
const BED_ARTWORK = {
  greens: {
    growthForm: 'rosette',
    // upright rosettes of ruffled strap leaves
    // bolting flower stalk at Flourishing
  },
  roots: {
    growthForm: 'fern_tuft',
    // low ferny tufts, wide and feathery
    // orange shoulders breaking soil; pulled carrot at Flourishing
  },
  citrus: {
    growthForm: 'standard_tree',
    // small standard tree, round dense crown on clear trunk
    // spherical fruit + white blossom
  },
  orchard: {
    growthForm: 'lobed_tree',
    // larger tree, irregular lobed crown, forked trunk
    // apples with stem and highlight; windfall at Flourishing
  },
  berries: {
    growthForm: 'low_mound',
    // row of low mounds, wider than tall
    // pointed berries in clusters, five-petal flowers, runner
  },
  tropical: {
    growthForm: 'sword_rosette',
    // radial sword-leaf rosettes + tall blade leaves
    // pineapples rising from rosette centre
  },
  herbs: {
    growthForm: 'cushion',
    // dense cushion of paired round leaves on short stems
    // flowering spikes; tied bundle at Harvesting
  },
}

// ── Soil bed (shared by all stages) ───────────────────────────
function SoilBed({ bedKey, sceneId }) {
  const blob = BED_BLOBS[bedKey]
  const placement = BED_PLACEMENT[bedKey]
  return (
    <G>
      {/* Soil blob — organic shape, not ellipse */}
      <Path d={blob} fill={SCENE_PALETTE.loamDark} />
      <Path d={blob} fill={SCENE_PALETTE.loamLit} opacity="0.4" />
      {/* Bed edging — readable prepared-soil boundary */}
      <Path d={blob} fill="none" stroke={SCENE_PALETTE.loamLit} strokeWidth="0.8" opacity="0.60" />
      {/* Colour tag stake — small marker in bed colour */}
      <Rect
        x={placement.cx - 2.5}
        y={placement.cy - placement.ry - 8}
        width="5"
        height="8"
        fill={PRODUCE_COLORS[bedKey]}
        opacity="0.7"
        rx="1"
      />
      {/* Fringe grass — precomputed per-bed */}
      {BED_FRINGES[bedKey].map((tuft, i) => (
        <Path
          key={`fringe-${bedKey}-${i}`}
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

// ── Ghost silhouette (11% of Sprout art) ──────────────────────
// Only shown on Empty beds. Always the NEXT step, never two ahead.
function GhostSilhouette({ bedKey, sceneId }) {
  const placement = BED_PLACEMENT[bedKey]
  const color = PRODUCE_COLORS[bedKey]
  const cx = placement.cx
  const cy = placement.cy - 2
  // Simple ghost — a small sprout silhouette at 11% opacity
  return (
    <G opacity="0.18">
      {/* Two cotyledon leaves */}
      <Ellipse cx={cx - 3} cy={cy - 4} rx="3" ry="2" fill={color} transform={`rotate(-20 ${cx - 3} ${cy - 4})`} />
      <Ellipse cx={cx + 3} cy={cy - 4} rx="3" ry="2" fill={color} transform={`rotate(20 ${cx + 3} ${cy - 4})`} />
      {/* Stem */}
      <Line x1={cx} y1={cy} x2={cx} y2={cy - 5} stroke={color} strokeWidth="0.8" />
    </G>
  )
}

// ── Per-bed artwork by growth form ────────────────────────────
// Each function renders the plant at a given stage height/saturation.
// Saturation is faked by mixing produce colour with loam (muted) or
// using full colour (harvesting+).

function mixColor(hex, mixHex, ratio) {
  // Simple hex mix — ratio 0 = pure hex, 1 = pure mixHex
  const r1 = parseInt(hex.slice(1, 3), 16)
  const g1 = parseInt(hex.slice(3, 5), 16)
  const b1 = parseInt(hex.slice(5, 7), 16)
  const r2 = parseInt(mixHex.slice(1, 3), 16)
  const g2 = parseInt(mixHex.slice(3, 5), 16)
  const b2 = parseInt(mixHex.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * ratio)
  const g = Math.round(g1 + (g2 - g1) * ratio)
  const b = Math.round(b1 + (b2 - b1) * ratio)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ── Greens: upright rosettes of ruffled strap leaves ──────────
function GreensArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.45)
  const fullColor = color
  const plantColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const heightScale = stageKey === STAGE_SEED ? 0.15
    : stageKey === STAGE_SPROUT ? 0.25
    : stageKey === STAGE_GROWING ? 0.55
    : 1.0
  const plantCount = stageKey === STAGE_FLOURISHING ? 4
    : stageKey === STAGE_HARVESTING ? 3
    : stageKey === STAGE_GROWING ? 2
    : 1

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx - 8} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Ellipse cx={cx + 6} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx - 8} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
        <Circle cx={cx + 6} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const plants = []
  for (let i = 0; i < plantCount; i++) {
    const offset = (i - (plantCount - 1) / 2) * 14
    const px = cx + offset
    const py = cy
    const h = 18 * heightScale
    plants.push(
      <G key={`greens-plant-${i}`}>
        {/* Strap leaves — ruffled rosette */}
        <Path d={`M ${px} ${py} Q ${px - 6} ${py - h * 0.6} ${px - 4} ${py - h}`} stroke={plantColor} strokeWidth="1.4" fill="none" opacity="0.9" strokeLinecap="round" />
        <Path d={`M ${px} ${py} Q ${px + 6} ${py - h * 0.6} ${px + 4} ${py - h}`} stroke={plantColor} strokeWidth="1.4" fill="none" opacity="0.9" strokeLinecap="round" />
        <Path d={`M ${px} ${py} Q ${px - 3} ${py - h * 0.7} ${px - 1} ${py - h * 1.1}`} stroke={plantColor} strokeWidth="1.4" fill="none" opacity="0.9" strokeLinecap="round" />
        <Path d={`M ${px} ${py} Q ${px + 3} ${py - h * 0.7} ${px + 1} ${py - h * 1.1}`} stroke={plantColor} strokeWidth="1.4" fill="none" opacity="0.9" strokeLinecap="round" />
        {/* Bolting flower stalk at Flourishing */}
        {stageKey === STAGE_FLOURISHING && (
          <G>
            <Line x1={px} y1={py} x2={px} y2={py - h * 1.6} stroke={plantColor} strokeWidth="0.8" opacity="0.7" />
            <Circle cx={px} cy={py - h * 1.6} r="1.5" fill={SCENE_PALETTE.goldPale} opacity="0.8" />
          </G>
        )}
      </G>
    )
  }
  return <G>{plants}</G>
}

// ── Roots: low ferny tufts, orange shoulders ──────────────────
function RootsArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.45)
  const fullColor = color
  const plantColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const heightScale = stageKey === STAGE_SEED ? 0.15
    : stageKey === STAGE_SPROUT ? 0.25
    : stageKey === STAGE_GROWING ? 0.55
    : 1.0
  const tuftCount = stageKey === STAGE_FLOURISHING ? 5
    : stageKey === STAGE_HARVESTING ? 4
    : stageKey === STAGE_GROWING ? 3
    : 2

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx - 10} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Ellipse cx={cx + 8} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx - 10} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
        <Circle cx={cx + 8} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const tufts = []
  for (let i = 0; i < tuftCount; i++) {
    const offset = (i - (tuftCount - 1) / 2) * 16
    const px = cx + offset
    const py = cy
    const h = 12 * heightScale
    tufts.push(
      <G key={`roots-tuft-${i}`}>
        {/* Feathery fern tuft */}
        <Path d={`M ${px} ${py} L ${px - 4} ${py - h}`} stroke={plantColor} strokeWidth="0.8" opacity="0.8" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px - 2} ${py - h * 1.1}`} stroke={plantColor} strokeWidth="0.8" opacity="0.8" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px} ${py - h * 1.2}`} stroke={plantColor} strokeWidth="0.8" opacity="0.8" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px + 2} ${py - h * 1.1}`} stroke={plantColor} strokeWidth="0.8" opacity="0.8" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px + 4} ${py - h}`} stroke={plantColor} strokeWidth="0.8" opacity="0.8" strokeLinecap="round" />
        {/* Orange shoulder breaking soil at Harvesting+ */}
        {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
          <Ellipse cx={px} cy={py - 1} rx="2.5" ry="1.5" fill={fullColor} opacity="0.85" />
        )}
      </G>
    )
  }
  // Pulled carrot on rim at Flourishing
  if (stageKey === STAGE_FLOURISHING) {
    tufts.push(
      <G key="roots-pulled">
        <Path d={`M ${cx + placement.rx * 0.7} ${cy - 2} L ${cx + placement.rx * 0.7} ${cy + 6}`} fill={fullColor} opacity="0.9" />
        <Path d={`M ${cx + placement.rx * 0.7 - 2} ${cy - 4} L ${cx + placement.rx * 0.7 + 2} ${cy - 4} L ${cx + placement.rx * 0.7} ${cy - 8} Z`} fill={plantColor} opacity="0.8" />
      </G>
    )
  }
  return <G>{tufts}</G>
}

// ── Citrus: small standard tree, round dense crown ────────────
function CitrusArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.4)
  const fullColor = color
  const crownColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const trunkH = stageKey === STAGE_SEED ? 2
    : stageKey === STAGE_SPROUT ? 4
    : stageKey === STAGE_GROWING ? 10
    : 18
  const crownR = stageKey === STAGE_SEED ? 0
    : stageKey === STAGE_SPROUT ? 4
    : stageKey === STAGE_GROWING ? 10
    : stageKey === STAGE_HARVESTING ? 16
    : 20

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const trunkTopY = cy - trunkH
  return (
    <G>
      {/* Trunk — clear trunk, bark colour */}
      <Line x1={cx} y1={cy} x2={cx} y2={trunkTopY} stroke={SCENE_PALETTE.bark} strokeWidth="2" strokeLinecap="round" />
      {/* Crown — round dense */}
      <Circle cx={cx} cy={trunkTopY - crownR * 0.5} r={crownR} fill={crownColor} opacity="0.85" />
      <Circle cx={cx - crownR * 0.4} cy={trunkTopY - crownR * 0.3} r={crownR * 0.6} fill={crownColor} opacity="0.7" />
      <Circle cx={cx + crownR * 0.4} cy={trunkTopY - crownR * 0.3} r={crownR * 0.6} fill={crownColor} opacity="0.7" />
      {/* Fruit + blossom at Harvesting+ */}
      {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
        <G>
          <Circle cx={cx - crownR * 0.5} cy={trunkTopY - crownR * 0.6} r="2" fill={fullColor} />
          <Circle cx={cx + crownR * 0.4} cy={trunkTopY - crownR * 0.4} r="2" fill={fullColor} />
          {stageKey === STAGE_FLOURISHING && (
            <G>
              <Circle cx={cx + crownR * 0.2} cy={trunkTopY - crownR * 0.8} r="1.2" fill="#F3E3D2" opacity="0.9" />
              <Circle cx={cx - crownR * 0.2} cy={trunkTopY - crownR * 0.2} r="1.2" fill="#F3E3D2" opacity="0.9" />
            </G>
          )}
        </G>
      )}
      {/* Rim highlight at Harvesting+ */}
      {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
        <Circle cx={cx - crownR * 0.3} cy={trunkTopY - crownR * 0.7} r={crownR * 0.3} fill={SCENE_PALETTE.goldPale} opacity="0.15" />
      )}
    </G>
  )
}

// ── Orchard: larger tree, irregular lobed crown, forked trunk ─
function OrchardArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.4)
  const fullColor = color
  const crownColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const trunkH = stageKey === STAGE_SEED ? 2
    : stageKey === STAGE_SPROUT ? 5
    : stageKey === STAGE_GROWING ? 12
    : 22
  const crownR = stageKey === STAGE_SEED ? 0
    : stageKey === STAGE_SPROUT ? 5
    : stageKey === STAGE_GROWING ? 12
    : stageKey === STAGE_HARVESTING ? 20
    : 26

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const trunkTopY = cy - trunkH
  return (
    <G>
      {/* Forked trunk */}
      <Line x1={cx} y1={cy} x2={cx} y2={trunkTopY + 4} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1={cx} y1={trunkTopY + 4} x2={cx - 4} y2={trunkTopY} stroke={SCENE_PALETTE.bark} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1={cx} y1={trunkTopY + 4} x2={cx + 4} y2={trunkTopY} stroke={SCENE_PALETTE.bark} strokeWidth="1.8" strokeLinecap="round" />
      {/* Irregular lobed crown */}
      <Circle cx={cx} cy={trunkTopY - crownR * 0.4} r={crownR} fill={crownColor} opacity="0.85" />
      <Circle cx={cx - crownR * 0.5} cy={trunkTopY - crownR * 0.2} r={crownR * 0.65} fill={crownColor} opacity="0.75" />
      <Circle cx={cx + crownR * 0.5} cy={trunkTopY - crownR * 0.3} r={crownR * 0.6} fill={crownColor} opacity="0.75" />
      <Circle cx={cx} cy={trunkTopY - crownR * 0.9} r={crownR * 0.5} fill={crownColor} opacity="0.7" />
      {/* Apples at Harvesting+ */}
      {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
        <G>
          <Circle cx={cx - crownR * 0.4} cy={trunkTopY - crownR * 0.5} r="2.2" fill={fullColor} />
          <Circle cx={cx + crownR * 0.3} cy={trunkTopY - crownR * 0.3} r="2.2" fill={fullColor} />
          {stageKey === STAGE_FLOURISHING && (
            <G>
              <Circle cx={cx + crownR * 0.1} cy={trunkTopY - crownR * 0.7} r="2" fill={fullColor} />
              {/* Windfall on grass */}
              <Circle cx={cx + placement.rx * 0.6} cy={cy - 2} r="2" fill={fullColor} opacity="0.8" />
            </G>
          )}
        </G>
      )}
      {/* Rim highlight */}
      {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
        <Circle cx={cx - crownR * 0.3} cy={trunkTopY - crownR * 0.8} r={crownR * 0.25} fill={SCENE_PALETTE.goldPale} opacity="0.15" />
      )}
    </G>
  )
}

// ── Berries: row of low mounds, pointed berries ───────────────
function BerriesArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.4)
  const fullColor = color
  const plantColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const moundCount = stageKey === STAGE_FLOURISHING ? 4
    : stageKey === STAGE_HARVESTING ? 3
    : stageKey === STAGE_GROWING ? 2
    : 1
  const heightScale = stageKey === STAGE_SEED ? 0.15
    : stageKey === STAGE_SPROUT ? 0.25
    : stageKey === STAGE_GROWING ? 0.55
    : 1.0

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const mounds = []
  for (let i = 0; i < moundCount; i++) {
    const offset = (i - (moundCount - 1) / 2) * 12
    const px = cx + offset
    const py = cy
    const h = 10 * heightScale
    mounds.push(
      <G key={`berries-mound-${i}`}>
        {/* Low mound — wider than tall */}
        <Ellipse cx={px} cy={py - h * 0.4} rx="6" ry={h * 0.5} fill={plantColor} opacity="0.8" />
        {/* Leaves */}
        <Ellipse cx={px - 3} cy={py - h * 0.5} rx="2" ry="1.5" fill={plantColor} opacity="0.7" />
        <Ellipse cx={px + 3} cy={py - h * 0.5} rx="2" ry="1.5" fill={plantColor} opacity="0.7" />
        {/* Pointed berries at Harvesting+ */}
        {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
          <G>
            <Path d={`M ${px - 2} ${py - h * 0.7} L ${px - 2.5} ${py - h * 0.9} L ${px - 1.5} ${py - h * 0.7} Z`} fill={fullColor} />
            <Path d={`M ${px + 2} ${py - h * 0.7} L ${px + 2.5} ${py - h * 0.9} L ${px + 1.5} ${py - h * 0.7} Z`} fill={fullColor} />
            {stageKey === STAGE_FLOURISHING && (
              <G>
                {/* Five-petal flower */}
                <Circle cx={px} cy={py - h * 0.9} r="1.2" fill="#F3E3D2" opacity="0.85" />
                {/* Runner creeping onto path */}
                <Path d={`M ${px + 5} ${py} Q ${px + 8} ${py - 1} ${px + 10} ${py}`} stroke={plantColor} strokeWidth="0.6" fill="none" opacity="0.6" />
              </G>
            )}
          </G>
        )}
      </G>
    )
  }
  return <G>{mounds}</G>
}

// ── Tropical: radial sword-leaf rosettes, pineapples ──────────
function TropicalArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.4)
  const fullColor = color
  const plantColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const heightScale = stageKey === STAGE_SEED ? 0.15
    : stageKey === STAGE_SPROUT ? 0.25
    : stageKey === STAGE_GROWING ? 0.55
    : 1.0
  const rosetteCount = stageKey === STAGE_FLOURISHING ? 3
    : stageKey === STAGE_HARVESTING ? 2
    : 1

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const rosettes = []
  for (let i = 0; i < rosetteCount; i++) {
    const offset = (i - (rosetteCount - 1) / 2) * 16
    const px = cx + offset
    const py = cy
    const h = 16 * heightScale
    rosettes.push(
      <G key={`tropical-ros-${i}`}>
        {/* Sword leaves — radial */}
        <Path d={`M ${px} ${py} L ${px - 6} ${py - h}`} stroke={plantColor} strokeWidth="1.2" opacity="0.85" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px - 3} ${py - h * 1.15}`} stroke={plantColor} strokeWidth="1.2" opacity="0.85" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px} ${py - h * 1.25}`} stroke={plantColor} strokeWidth="1.2" opacity="0.85" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px + 3} ${py - h * 1.15}`} stroke={plantColor} strokeWidth="1.2" opacity="0.85" strokeLinecap="round" />
        <Path d={`M ${px} ${py} L ${px + 6} ${py - h}`} stroke={plantColor} strokeWidth="1.2" opacity="0.85" strokeLinecap="round" />
        {/* Pineapple at Harvesting+ */}
        {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
          <G>
            <Ellipse cx={px} cy={py - h * 0.6} rx="2.5" ry="4" fill={fullColor} opacity="0.9" />
            {/* Pineapple crown */}
            <Path d={`M ${px - 1} ${py - h * 0.9} L ${px - 1} ${py - h * 1.1}`} stroke={plantColor} strokeWidth="0.8" />
            <Path d={`M ${px + 1} ${py - h * 0.9} L ${px + 1} ${py - h * 1.1}`} stroke={plantColor} strokeWidth="0.8" />
            <Path d={`M ${px} ${py - h * 0.9} L ${px} ${py - h * 1.15}`} stroke={plantColor} strokeWidth="0.8" />
          </G>
        )}
      </G>
    )
  }
  return <G>{rosettes}</G>
}

// ── Herbs: dense cushion of paired round leaves ───────────────
function HerbsArt({ stageKey, placement, color }) {
  const cx = placement.cx
  const cy = placement.cy
  const muted = mixColor(color, SCENE_PALETTE.loamLit, 0.4)
  const fullColor = color
  const plantColor = (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) ? fullColor : muted
  const heightScale = stageKey === STAGE_SEED ? 0.15
    : stageKey === STAGE_SPROUT ? 0.25
    : stageKey === STAGE_GROWING ? 0.55
    : 1.0
  const cushionCount = stageKey === STAGE_FLOURISHING ? 6
    : stageKey === STAGE_HARVESTING ? 5
    : stageKey === STAGE_GROWING ? 3
    : 2

  if (stageKey === STAGE_SEED) {
    return (
      <G>
        <Ellipse cx={cx} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
        <Circle cx={cx} cy={cy - 2} r="0.8" fill={fullColor} opacity="0.6" />
      </G>
    )
  }

  const leaves = []
  for (let i = 0; i < cushionCount; i++) {
    const angle = (i / cushionCount) * Math.PI * 2
    const r = 8 * heightScale
    const px = cx + Math.cos(angle) * r
    const py = cy + Math.sin(angle) * r * 0.4 - 2 * heightScale
    const leafR = 2.5 * heightScale
    leaves.push(
      <G key={`herbs-leaf-${i}`}>
        {/* Paired round leaves on short stems */}
        <Circle cx={px} cy={py} r={leafR} fill={plantColor} opacity="0.85" />
        <Circle cx={px + leafR * 0.8} cy={py - leafR * 0.3} r={leafR * 0.7} fill={plantColor} opacity="0.75" />
      </G>
    )
  }
  // Flowering spikes at Harvesting+
  if (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) {
    leaves.push(
      <G key="herbs-spike">
        <Line x1={cx} y1={cy - 4} x2={cx} y2={cy - 12 * heightScale} stroke={plantColor} strokeWidth="0.8" opacity="0.8" />
        <Circle cx={cx} cy={cy - 12 * heightScale} r="1" fill={SCENE_PALETTE.goldPale} opacity="0.8" />
        <Circle cx={cx} cy={cy - 9 * heightScale} r="0.8" fill={SCENE_PALETTE.goldPale} opacity="0.7" />
      </G>
    )
    // Tied bundle on rim at Harvesting
    if (stageKey === STAGE_HARVESTING) {
      leaves.push(
        <G key="herbs-bundle">
          <Rect x={cx + placement.rx * 0.6} y={cy - 4} width="3" height="6" fill={plantColor} opacity="0.8" rx="1" />
          <Line x1={cx + placement.rx * 0.6 - 1} y1={cy - 2} x2={cx + placement.rx * 0.6 + 4} y2={cy - 2} stroke={SCENE_PALETTE.timberLight} strokeWidth="0.5" />
        </G>
      )
    }
  }
  return <G>{leaves}</G>
}

// ── Bed artwork dispatcher ────────────────────────────────────
const BED_RENDERERS = {
  greens: GreensArt,
  roots: RootsArt,
  citrus: CitrusArt,
  orchard: OrchardArt,
  berries: BerriesArt,
  tropical: TropicalArt,
  herbs: HerbsArt,
}

// ── Ground glow under bed at Flourishing (spec §9) ────────────
function GroundGlow({ bedKey, placement }) {
  const color = PRODUCE_COLORS[bedKey]
  return (
    <Ellipse
      cx={placement.cx}
      cy={placement.cy + placement.ry * 0.3}
      rx={placement.rx * 1.2}
      ry={placement.ry * 1.5}
      fill={color}
      opacity="0.13"
    />
  )
}

// ── Closed bud at Growing (spec §9 anticipation cue) ──────────
function ClosedBud({ bedKey, placement }) {
  const color = PRODUCE_COLORS[bedKey]
  const cx = placement.cx + placement.rx * 0.7
  const cy = placement.cy - 4
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx="1.5" ry="2.5" fill={color} opacity="0.7" />
      <Path d={`M ${cx - 1} ${cy + 2} L ${cx + 1} ${cy + 2}`} stroke={color} strokeWidth="0.5" opacity="0.5" />
    </G>
  )
}

// ── Main Bed component ────────────────────────────────────────
// Memoised on stageKey alone (spec §22).
function LivingGardenBedComponent({ bedKey, stageKey, sceneId }) {
  const placement = BED_PLACEMENT[bedKey]
  if (!placement) return null

  const Renderer = BED_RENDERERS[bedKey]
  if (!Renderer) return null

  const color = PRODUCE_COLORS[bedKey]
  const isFlourishing = stageKey === STAGE_FLOURISHING
  const isGrowing = stageKey === STAGE_GROWING
  const isEmpty = stageKey === STAGE_EMPTY

  return (
    <G>
      {/* Ground glow at Flourishing (rendered under soil) */}
      {isFlourishing && <GroundGlow bedKey={bedKey} placement={placement} />}
      {/* Soil bed + edging + fringe */}
      <SoilBed bedKey={bedKey} sceneId={sceneId} />
      {/* Ghost on Empty (11% of Sprout) */}
      {isEmpty && <GhostSilhouette bedKey={bedKey} sceneId={sceneId} />}
      {/* Plant artwork */}
      {stageKey !== STAGE_EMPTY && (
        <Renderer stageKey={stageKey} placement={placement} color={color} />
      )}
      {/* Closed bud at Growing (anticipation cue) */}
      {isGrowing && <ClosedBud bedKey={bedKey} placement={placement} />}
    </G>
  )
}

// ── Custom comparator — re-render only on stageKey change ─────
function bedComparator(prev, next) {
  return prev.bedKey === next.bedKey
    && prev.stageKey === next.stageKey
    && prev.sceneId === next.sceneId
}

export const LivingGardenBed = memo(LivingGardenBedComponent, bedComparator)

export default LivingGardenBed
