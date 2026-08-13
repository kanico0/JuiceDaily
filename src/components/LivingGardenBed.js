// ─────────────────────────────────────────────────────────────
// LivingGardenBed.js — Per-bed renderer for the immersive scene
//
// Renders all 7 produce areas × 6 existing Garden stages.
// Pure function of the existing stage key. No new thresholds.
//
// Earned-Color Refinement (Rev A):
//   Chroma gate: rendered = mix(#20291F, token, chroma[stage])
//   Alpha gate:  alpha = alpha[stage]
//   Element-count ramp: 1 → 1 → 2 → 4 → 7
//   Ground bloom from Growing onward (local, per-bed produce hue)
//   Warm soil rim at Harvesting+ (mix(#46271B, produce, 0.16))
//
// Zero state (Empty) is frozen — ghost silhouette and soil treatment
// remain unchanged. Chroma gate applies to earned stages only.
//
// Memoised on stageKey alone — a bed re-renders only when its
// own stage changes (spec §22).
// ─────────────────────────────────────────────────────────────

import React, { memo } from 'react'
import { G, Path, Ellipse, Circle, Rect, Line, Defs, RadialGradient, Stop } from 'react-native-svg'
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

// ── Chroma gate (spec §1) ─────────────────────────────────────
const NEUTRAL_BASE = '#20291F'
const STAGE_CHROMA = {
  empty: 0,
  seed: 0.1,
  sprout: 0.32,
  growing: 0.58,
  harvesting: 0.86,
  flourishing: 1.0,
}
const STAGE_ALPHA = {
  empty: 0,
  seed: 0.35,
  sprout: 0.58,
  growing: 0.78,
  harvesting: 0.93,
  flourishing: 1.0,
}
const STAGE_BLOOM = {
  empty: 0,
  seed: 0,
  sprout: 0,
  growing: 0.15,
  harvesting: 0.45,
  flourishing: 0.85,
}

// ── Per-bed full-strength token palettes (spec §2) ────────────
const BED_PALETTES = {
  greens: {
    leaf: '#6FBF6A',
    deep: '#2F7D4F',
    produce: '#8FD46B',
    accent: '#A8E063',
    alt: '#BFE8CB',
    bloom: '#F2F7E4',
  },
  roots: {
    leaf: '#6FBF5A',
    deep: '#3B7A45',
    produce: '#E8843A',
    accent: '#F0A24A',
    alt: '#B03A54',
    bloom: '#FFE7C2',
  },
  citrus: {
    leaf: '#4FA968',
    deep: '#2E7A50',
    produce: '#F2D24B',
    accent: '#F2A03D',
    alt: '#EFE08A',
    bloom: '#FFF3C4',
  },
  orchard: {
    leaf: '#3E8E5A',
    deep: '#2A6B44',
    produce: '#D9453F',
    accent: '#E8B84B',
    alt: '#E85C4A',
    bloom: '#FFF6E8',
  },
  berries: {
    leaf: '#4E9A62',
    deep: '#2F6B45',
    produce: '#C42847',
    accent: '#F0728A',
    alt: '#6B4A7A',
    bloom: '#FFE2EA',
  },
  tropical: {
    leaf: '#7FA83C',
    deep: '#4C7A32',
    produce: '#E8B93C',
    accent: '#F08A35',
    alt: '#9FC94A',
    bloom: '#FFF0CE',
  },
  herbs: {
    leaf: '#4A9B5E',
    deep: '#2E6B45',
    produce: '#7FD6A2',
    accent: '#C3E8B0',
    alt: '#D9CFE8',
    bloom: '#EFF9EE',
  },
}

// ── Bed metadata for artwork ──────────────────────────────────
const BED_ARTWORK = {
  greens: { growthForm: 'rosette' },
  roots: { growthForm: 'fern_tuft' },
  citrus: { growthForm: 'standard_tree' },
  orchard: { growthForm: 'lobed_tree' },
  berries: { growthForm: 'low_mound' },
  tropical: { growthForm: 'sword_rosette' },
  herbs: { growthForm: 'cushion' },
}

// ── Color helpers ─────────────────────────────────────────────
function mixColor(hex, mixHex, ratio) {
  const r1 = parseInt(hex.slice(1, 3), 16)
  const g1 = parseInt(hex.slice(3, 5), 16)
  const b1 = parseInt(hex.slice(5, 7), 16)
  const r2 = parseInt(mixHex.slice(1, 3), 16)
  const g2 = parseInt(mixHex.slice(3, 5), 16)
  const b2 = parseInt(mixHex.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * ratio)
  const g = Math.round(g1 + (g2 - g1) * ratio)
  const b = Math.round(b1 + (b2 - b1) * ratio)
  const toHex2 = (v) => v.toString(16).padStart(2, '0').toUpperCase()
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
}

function gateColor(token, stageKey) {
  const chroma = STAGE_CHROMA[stageKey] || 0
  return mixColor(NEUTRAL_BASE, token, chroma)
}

function gatedPalette(bedKey, stageKey) {
  const p = BED_PALETTES[bedKey]
  if (!p) return null
  return {
    leaf: gateColor(p.leaf, stageKey),
    deep: gateColor(p.deep, stageKey),
    produce: gateColor(p.produce, stageKey),
    accent: gateColor(p.accent, stageKey),
    alt: gateColor(p.alt, stageKey),
    bloom: gateColor(p.bloom, stageKey),
  }
}

// Canopy blend for tree-form beds (Citrus, Orchard) — spec §3.3, §3.4
function canopyBlend(leaf, produce, stageKey) {
  if (stageKey === STAGE_FLOURISHING) return produce
  if (stageKey === STAGE_HARVESTING) return mixColor(leaf, produce, 0.72)
  if (stageKey === STAGE_GROWING) return mixColor(leaf, produce, 0.18)
  return leaf
}

// ── Soil bed (shared by all stages) ───────────────────────────
// Warm soil rim applied at Harvesting+ (spec §6.2)
function SoilBed({ bedKey, sceneId, stageKey }) {
  const blob = BED_BLOBS[bedKey]
  const placement = BED_PLACEMENT[bedKey]
  const isWarm = stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING
  const warmSoilColor = isWarm
    ? mixColor('#46271B', BED_PALETTES[bedKey].produce, 0.16)
    : SCENE_PALETTE.loamLit
  const warmSoilOpacity = isWarm ? 0.5 : 0.4
  return (
    <G>
      <Path d={blob} fill={SCENE_PALETTE.loamDark} />
      <Path d={blob} fill={warmSoilColor} opacity={warmSoilOpacity} />
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

// ── Ghost silhouette (11% of Sprout art) — FROZEN, zero-state ─
function GhostSilhouette({ bedKey, sceneId }) {
  const placement = BED_PLACEMENT[bedKey]
  const color = PRODUCE_COLORS[bedKey]
  const cx = placement.cx
  const cy = placement.cy - 2
  return (
    <G opacity="0.18">
      <Ellipse
        cx={cx - 3}
        cy={cy - 4}
        rx="3"
        ry="2"
        fill={color}
        transform={`rotate(-20 ${cx - 3} ${cy - 4})`}
      />
      <Ellipse
        cx={cx + 3}
        cy={cy - 4}
        rx="3"
        ry="2"
        fill={color}
        transform={`rotate(20 ${cx + 3} ${cy - 4})`}
      />
      <Line x1={cx} y1={cy} x2={cx} y2={cy - 5} stroke={color} strokeWidth="0.8" />
    </G>
  )
}

// ── Ground bloom (spec §6.1) — from Growing onward ────────────
// Local borrowed-hue radial gradient beneath each bed.
// Radius: 1.75 × bed half-width horizontal, 0.72 × vertical.
// Peak opacity: 0.10 × bloom[stage].
function GroundBloom({ bedKey, placement, stageKey }) {
  const palette = BED_PALETTES[bedKey]
  const bloomFactor = STAGE_BLOOM[stageKey] || 0
  if (bloomFactor <= 0) return null
  const opacity = 0.1 * bloomFactor
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

// ── Seed marker (shared by all beds) ──────────────────────────
function SeedMarker({ cx, cy, gated }) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy - 1} rx="2" ry="1.5" fill={SCENE_PALETTE.loamLit} opacity="0.7" />
      <Circle cx={cx} cy={cy - 2} r="0.8" fill={gated.produce} opacity="0.6" />
    </G>
  )
}

// ── Greens: upright rosettes of ruffled strap leaves ──────────
// Spec §3.1: 1 → 2 → 4 → 6 rosettes.
// Flourishing: deep emerald base, fresh leaf mid, lime rim, mint highlight.
function GreensArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const heightScale = stageKey === STAGE_SPROUT ? 0.25 : stageKey === STAGE_GROWING ? 0.55 : 1.0
  const plantCount =
    stageKey === STAGE_SPROUT
      ? 1
      : stageKey === STAGE_GROWING
        ? 2
        : stageKey === STAGE_HARVESTING
          ? 4
          : 6

  const plants = []
  for (let i = 0; i < plantCount; i++) {
    const offset = (i - (plantCount - 1) / 2) * 12
    const px = cx + offset
    const py = cy
    const h = 18 * heightScale
    // At Flourishing, vary token per rosette for green separation
    const tokenIdx = i % 4
    const color =
      stageKey === STAGE_FLOURISHING
        ? [gated.deep, gated.leaf, gated.produce, gated.accent][tokenIdx]
        : gated.leaf
    plants.push(
      <G key={`greens-plant-${i}`}>
        <Path
          d={`M ${px} ${py} Q ${px - 6} ${py - h * 0.6} ${px - 4} ${py - h}`}
          stroke={color}
          strokeWidth="1.4"
          fill="none"
          opacity="0.9"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} Q ${px + 6} ${py - h * 0.6} ${px + 4} ${py - h}`}
          stroke={color}
          strokeWidth="1.4"
          fill="none"
          opacity="0.9"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} Q ${px - 3} ${py - h * 0.7} ${px - 1} ${py - h * 1.1}`}
          stroke={color}
          strokeWidth="1.4"
          fill="none"
          opacity="0.9"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} Q ${px + 3} ${py - h * 0.7} ${px + 1} ${py - h * 1.1}`}
          stroke={color}
          strokeWidth="1.4"
          fill="none"
          opacity="0.9"
          strokeLinecap="round"
        />
        {stageKey === STAGE_FLOURISHING && (
          <G>
            <Line
              x1={px}
              y1={py}
              x2={px}
              y2={py - h * 1.6}
              stroke={color}
              strokeWidth="0.8"
              opacity="0.7"
            />
            <Circle cx={px} cy={py - h * 1.6} r="1.5" fill={gated.alt} opacity="0.8" />
          </G>
        )}
      </G>,
    )
  }
  return <G opacity={alpha}>{plants}</G>
}

// ── Roots: low ferny tufts, orange shoulders ──────────────────
// Spec §3.2: fronds 1 → 2 → 3 → 5.
// Carrot shoulders emerge at Harvesting. Frond color → Accent at Harvesting+.
// Beet/radish (Alt) only at Flourishing, as two small forms at bed edges.
function RootsArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const heightScale = stageKey === STAGE_SPROUT ? 0.25 : stageKey === STAGE_GROWING ? 0.55 : 1.0
  const tuftCount =
    stageKey === STAGE_SPROUT
      ? 1
      : stageKey === STAGE_GROWING
        ? 2
        : stageKey === STAGE_HARVESTING
          ? 3
          : 5
  // Frond color switches from Leaf to Accent at Harvesting (spec §3.2)
  const frondColor =
    stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING ? gated.accent : gated.leaf

  const tufts = []
  for (let i = 0; i < tuftCount; i++) {
    const offset = (i - (tuftCount - 1) / 2) * 14
    const px = cx + offset
    const py = cy
    const h = 12 * heightScale
    tufts.push(
      <G key={`roots-tuft-${i}`}>
        <Path
          d={`M ${px} ${py} L ${px - 4} ${py - h}`}
          stroke={frondColor}
          strokeWidth="0.8"
          opacity="0.8"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px - 2} ${py - h * 1.1}`}
          stroke={frondColor}
          strokeWidth="0.8"
          opacity="0.8"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px} ${py - h * 1.2}`}
          stroke={frondColor}
          strokeWidth="0.8"
          opacity="0.8"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px + 2} ${py - h * 1.1}`}
          stroke={frondColor}
          strokeWidth="0.8"
          opacity="0.8"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px + 4} ${py - h}`}
          stroke={frondColor}
          strokeWidth="0.8"
          opacity="0.8"
          strokeLinecap="round"
        />
        {/* Carrot shoulders emerge at Harvesting+ */}
        {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
          <Ellipse cx={px} cy={py - 1} rx="2.5" ry="1.5" fill={gated.produce} opacity="0.85" />
        )}
      </G>,
    )
  }
  // Beet/radish (Alt) only at Flourishing — two small forms at bed edges
  if (stageKey === STAGE_FLOURISHING) {
    tufts.push(
      <G key="roots-beet-left">
        <Ellipse
          cx={cx - placement.rx * 0.7}
          cy={cy - 2}
          rx="2"
          ry="2.5"
          fill={gated.alt}
          opacity="0.8"
        />
      </G>,
    )
    tufts.push(
      <G key="roots-beet-right">
        <Ellipse
          cx={cx + placement.rx * 0.7}
          cy={cy - 2}
          rx="2"
          ry="2.5"
          fill={gated.alt}
          opacity="0.8"
        />
      </G>,
    )
  }
  return <G opacity={alpha}>{tufts}</G>
}

// ── Citrus: small standard tree, round dense crown ────────────
// Spec §3.3: canopy blend, radius 0.16 → 0.34 → 0.52 → 0.66 × rx.
// Fruit dots: 0 → 3 → 6 in Accent. Flourishing: 3 blossoms + rim arc.
function CitrusArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const trunkH = stageKey === STAGE_SPROUT ? 4 : stageKey === STAGE_GROWING ? 10 : 18
  const crownR =
    stageKey === STAGE_SPROUT
      ? placement.rx * 0.16
      : stageKey === STAGE_GROWING
        ? placement.rx * 0.34
        : stageKey === STAGE_HARVESTING
          ? placement.rx * 0.52
          : placement.rx * 0.66
  const canopyColor = gateColor(canopyBlend(palette.leaf, palette.produce, stageKey), stageKey)
  const trunkTopY = cy - trunkH
  const fruitCount = stageKey === STAGE_HARVESTING ? 3 : stageKey === STAGE_FLOURISHING ? 6 : 0

  const fruitDots = []
  for (let i = 0; i < fruitCount; i++) {
    const angle = (i / fruitCount) * Math.PI * 2
    const fx = cx + Math.cos(angle) * crownR * 0.5
    const fy = trunkTopY - crownR * 0.5 + Math.sin(angle) * crownR * 0.4
    fruitDots.push(<Circle key={`citrus-fruit-${i}`} cx={fx} cy={fy} r="2" fill={gated.accent} />)
  }

  return (
    <G opacity={alpha}>
      <Line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={trunkTopY}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx={cx} cy={trunkTopY - crownR * 0.5} r={crownR} fill={canopyColor} opacity="0.85" />
      <Circle
        cx={cx - crownR * 0.4}
        cy={trunkTopY - crownR * 0.3}
        r={crownR * 0.6}
        fill={canopyColor}
        opacity="0.7"
      />
      <Circle
        cx={cx + crownR * 0.4}
        cy={trunkTopY - crownR * 0.3}
        r={crownR * 0.6}
        fill={canopyColor}
        opacity="0.7"
      />
      {fruitDots}
      {stageKey === STAGE_FLOURISHING && (
        <G>
          {/* 3 blossoms in Bloom at 0.85 */}
          <Circle
            cx={cx + crownR * 0.2}
            cy={trunkTopY - crownR * 0.8}
            r="1.2"
            fill={gated.bloom}
            opacity="0.85"
          />
          <Circle
            cx={cx - crownR * 0.2}
            cy={trunkTopY - crownR * 0.2}
            r="1.2"
            fill={gated.bloom}
            opacity="0.85"
          />
          <Circle
            cx={cx + crownR * 0.5}
            cy={trunkTopY - crownR * 0.5}
            r="1.2"
            fill={gated.bloom}
            opacity="0.85"
          />
          {/* 1.4px rim arc */}
          <Path
            d={`M ${cx - crownR * 0.5} ${trunkTopY - crownR * 0.8} A ${crownR * 0.7} ${crownR * 0.7} 0 0 1 ${cx + crownR * 0.3} ${trunkTopY - crownR * 0.9}`}
            fill="none"
            stroke={gated.bloom}
            strokeWidth="1.4"
            opacity="0.5"
            strokeLinecap="round"
          />
        </G>
      )}
    </G>
  )
}

// ── Orchard: larger tree, irregular lobed crown, forked trunk ─
// Spec §3.4: same canopy blend. Fruit uses Alt (#E85C4A) not Accent.
// Gold #E8B84B reserved for Flourishing under-canopy shadow lift only.
function OrchardArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const trunkH = stageKey === STAGE_SPROUT ? 5 : stageKey === STAGE_GROWING ? 12 : 22
  const crownR =
    stageKey === STAGE_SPROUT
      ? placement.rx * 0.16
      : stageKey === STAGE_GROWING
        ? placement.rx * 0.34
        : stageKey === STAGE_HARVESTING
          ? placement.rx * 0.52
          : placement.rx * 0.66
  const canopyColor = gateColor(canopyBlend(palette.leaf, palette.produce, stageKey), stageKey)
  const trunkTopY = cy - trunkH
  const fruitCount = stageKey === STAGE_HARVESTING ? 3 : stageKey === STAGE_FLOURISHING ? 6 : 0

  const fruitDots = []
  for (let i = 0; i < fruitCount; i++) {
    const angle = (i / fruitCount) * Math.PI * 2 + 0.3
    const fx = cx + Math.cos(angle) * crownR * 0.5
    const fy = trunkTopY - crownR * 0.4 + Math.sin(angle) * crownR * 0.35
    // Orchard fruit uses Alt (#E85C4A) not Accent (spec §3.4)
    fruitDots.push(<Circle key={`orchard-fruit-${i}`} cx={fx} cy={fy} r="2.2" fill={gated.alt} />)
  }

  return (
    <G opacity={alpha}>
      {/* Forked trunk */}
      <Line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={trunkTopY + 4}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Line
        x1={cx}
        y1={trunkTopY + 4}
        x2={cx - 4}
        y2={trunkTopY}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Line
        x1={cx}
        y1={trunkTopY + 4}
        x2={cx + 4}
        y2={trunkTopY}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Irregular lobed crown */}
      <Circle cx={cx} cy={trunkTopY - crownR * 0.4} r={crownR} fill={canopyColor} opacity="0.85" />
      <Circle
        cx={cx - crownR * 0.5}
        cy={trunkTopY - crownR * 0.2}
        r={crownR * 0.65}
        fill={canopyColor}
        opacity="0.75"
      />
      <Circle
        cx={cx + crownR * 0.5}
        cy={trunkTopY - crownR * 0.3}
        r={crownR * 0.6}
        fill={canopyColor}
        opacity="0.75"
      />
      <Circle
        cx={cx}
        cy={trunkTopY - crownR * 0.9}
        r={crownR * 0.5}
        fill={canopyColor}
        opacity="0.7"
      />
      {fruitDots}
      {/* Gold under-canopy shadow lift at Flourishing only (spec §3.4) */}
      {stageKey === STAGE_FLOURISHING && (
        <G>
          <Ellipse
            cx={cx}
            cy={trunkTopY - crownR * 0.2}
            rx={crownR * 0.4}
            ry={crownR * 0.25}
            fill={gated.accent}
            opacity="0.25"
          />
          {/* Windfall on grass */}
          <Circle cx={cx + placement.rx * 0.6} cy={cy - 2} r="2" fill={gated.alt} opacity="0.8" />
        </G>
      )}
    </G>
  )
}

// ── Berries: row of low mounds with visible ruby/crimson/pink fruit ──
// Spec §3.5: berry count 0 → 2 → 4 → 7, cycling Produce / mix(Produce,Alt,0.35) / Accent.
// From Harvesting: 0.7-alpha specular dot in Bloom at 24% of berry radius.
// Purple stays below 15% of colored area.
// CRITICAL: berry fruit CIRCLES must be visually dominant over green mounds
// at Harvesting/Flourishing. Mounds are foliage support, not the main visual.
function BerriesArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const heightScale = stageKey === STAGE_SPROUT ? 0.25 : stageKey === STAGE_GROWING ? 0.55 : 1.0
  const moundCount =
    stageKey === STAGE_SPROUT
      ? 1
      : stageKey === STAGE_GROWING
        ? 2
        : stageKey === STAGE_HARVESTING
          ? 3
          : 4
  const berryCount =
    stageKey === STAGE_GROWING
      ? 2
      : stageKey === STAGE_HARVESTING
        ? 4
        : stageKey === STAGE_FLOURISHING
          ? 7
          : 0

  // Berry color cycling: Produce / mix(Produce, Alt, 0.35) / Accent
  const berryColors = [
    gated.produce,
    gateColor(mixColor(palette.produce, palette.alt, 0.35), stageKey),
    gated.accent,
  ]

  // Berry radius grows with stage so fruit becomes dominant at Harvesting/Flourishing
  const berryR =
    stageKey === STAGE_SPROUT
      ? 1.0
      : stageKey === STAGE_GROWING
        ? 1.8
        : stageKey === STAGE_HARVESTING
          ? 2.8
          : 3.4

  // Mound size is restrained — foliage support, not the main visual
  const moundRx = stageKey === STAGE_FLOURISHING ? 5 : 6
  const moundRy = 3 * heightScale

  const mounds = []
  for (let i = 0; i < moundCount; i++) {
    const offset = (i - (moundCount - 1) / 2) * 12
    const px = cx + offset
    const py = cy
    const h = 10 * heightScale
    mounds.push(
      <G key={`berries-mound-${i}`}>
        <Ellipse cx={px} cy={py - h * 0.3} rx={moundRx} ry={moundRy} fill={gated.leaf} opacity="0.55" />
        <Ellipse cx={px - 3} cy={py - h * 0.4} rx="1.8" ry="1.2" fill={gated.leaf} opacity="0.5" />
        <Ellipse cx={px + 3} cy={py - h * 0.4} rx="1.8" ry="1.2" fill={gated.leaf} opacity="0.5" />
      </G>,
    )
  }

  // Berries distributed across mounds — visible CIRCLES on top of foliage
  const berries = []
  for (let i = 0; i < berryCount; i++) {
    const moundIdx = i % moundCount
    const offset = (moundIdx - (moundCount - 1) / 2) * 12
    const px = cx + offset + (Math.floor(i / moundCount) - 0.5) * 4
    const py = cy
    const h = 10 * heightScale
    const berryColor = berryColors[i % 3]
    // Berry sits above mound, clearly visible
    const berryCy = py - h * 0.55
    berries.push(
      <G key={`berry-${i}`}>
        <Circle cx={px} cy={berryCy} r={berryR} fill={berryColor} opacity="0.92" />
        {/* Specular dot from Harvesting+ */}
        {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
          <Circle
            cx={px - berryR * 0.3}
            cy={berryCy - berryR * 0.3}
            r={berryR * 0.28}
            fill={gated.bloom}
            opacity="0.7"
          />
        )}
      </G>,
    )
  }

  return (
    <G opacity={alpha}>
      {mounds}
      {berries}
      {stageKey === STAGE_FLOURISHING && (
        <G>
          {/* Five-petal flower */}
          <Circle
            cx={cx}
            cy={cy - 10 * heightScale * 0.9}
            r="1.2"
            fill={gated.bloom}
            opacity="0.85"
          />
          {/* Runner creeping onto path */}
          <Path
            d={`M ${cx + 5} ${cy} Q ${cx + 8} ${cy - 1} ${cx + 10} ${cy}`}
            stroke={gated.leaf}
            strokeWidth="0.6"
            fill="none"
            opacity="0.6"
          />
        </G>
      )}
    </G>
  )
}

// ── Tropical: radial sword-leaf rosettes, pineapples ──────────
// Spec §3.6: most yellow-shifted leaf green. Mango orange at Harvesting+.
// Pineapple gold dominates at Flourishing.
function TropicalArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const heightScale = stageKey === STAGE_SPROUT ? 0.25 : stageKey === STAGE_GROWING ? 0.55 : 1.0
  const rosetteCount =
    stageKey === STAGE_SPROUT
      ? 1
      : stageKey === STAGE_GROWING
        ? 2
        : stageKey === STAGE_HARVESTING
          ? 3
          : 4

  const rosettes = []
  for (let i = 0; i < rosetteCount; i++) {
    const offset = (i - (rosetteCount - 1) / 2) * 14
    const px = cx + offset
    const py = cy
    const h = 16 * heightScale
    rosettes.push(
      <G key={`tropical-ros-${i}`}>
        <Path
          d={`M ${px} ${py} L ${px - 6} ${py - h}`}
          stroke={gated.leaf}
          strokeWidth="1.2"
          opacity="0.85"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px - 3} ${py - h * 1.15}`}
          stroke={gated.leaf}
          strokeWidth="1.2"
          opacity="0.85"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px} ${py - h * 1.25}`}
          stroke={gated.leaf}
          strokeWidth="1.2"
          opacity="0.85"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px + 3} ${py - h * 1.15}`}
          stroke={gated.leaf}
          strokeWidth="1.2"
          opacity="0.85"
          strokeLinecap="round"
        />
        <Path
          d={`M ${px} ${py} L ${px + 6} ${py - h}`}
          stroke={gated.leaf}
          strokeWidth="1.2"
          opacity="0.85"
          strokeLinecap="round"
        />
        {/* Pineapple at Harvesting+ — mango orange enters, gold dominates at Flourishing */}
        {(stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) && (
          <G>
            <Ellipse cx={px} cy={py - h * 0.6} rx="2.5" ry="4" fill={gated.produce} opacity="0.9" />
            <Path
              d={`M ${px - 1} ${py - h * 0.9} L ${px - 1} ${py - h * 1.1}`}
              stroke={gated.accent}
              strokeWidth="0.8"
            />
            <Path
              d={`M ${px + 1} ${py - h * 0.9} L ${px + 1} ${py - h * 1.1}`}
              stroke={gated.accent}
              strokeWidth="0.8"
            />
            <Path
              d={`M ${px} ${py - h * 0.9} L ${px} ${py - h * 1.15}`}
              stroke={gated.accent}
              strokeWidth="0.8"
            />
          </G>
        )}
      </G>,
    )
  }
  return <G opacity={alpha}>{rosettes}</G>
}

// ── Herbs: dense cushion of paired round leaves ───────────────
// Spec §3.7: tufts 1 → 2 → 4 → 6. Cool mint family.
// Accent flower head from Harvesting. Pale lilac (Alt) flowers at Flourishing only.
function HerbsArt({ stageKey, placement, gated, palette, alpha }) {
  const cx = placement.cx
  const cy = placement.cy
  if (stageKey === STAGE_SEED) return <SeedMarker cx={cx} cy={cy} gated={gated} />

  const heightScale = stageKey === STAGE_SPROUT ? 0.25 : stageKey === STAGE_GROWING ? 0.55 : 1.0
  const cushionCount =
    stageKey === STAGE_SPROUT
      ? 1
      : stageKey === STAGE_GROWING
        ? 2
        : stageKey === STAGE_HARVESTING
          ? 4
          : 6

  const leaves = []
  for (let i = 0; i < cushionCount; i++) {
    const angle = (i / cushionCount) * Math.PI * 2
    const r = 8 * heightScale
    const px = cx + Math.cos(angle) * r
    const py = cy + Math.sin(angle) * r * 0.4 - 2 * heightScale
    const leafR = 2.5 * heightScale
    leaves.push(
      <G key={`herbs-leaf-${i}`}>
        <Circle cx={px} cy={py} r={leafR} fill={gated.produce} opacity="0.85" />
        <Circle
          cx={px + leafR * 0.8}
          cy={py - leafR * 0.3}
          r={leafR * 0.7}
          fill={gated.leaf}
          opacity="0.75"
        />
      </G>,
    )
  }
  // Accent flower head from Harvesting+
  if (stageKey === STAGE_HARVESTING || stageKey === STAGE_FLOURISHING) {
    leaves.push(
      <G key="herbs-flower">
        <Line
          x1={cx}
          y1={cy - 4}
          x2={cx}
          y2={cy - 12 * heightScale}
          stroke={gated.leaf}
          strokeWidth="0.8"
          opacity="0.8"
        />
        <Circle cx={cx} cy={cy - 12 * heightScale} r="1.2" fill={gated.accent} opacity="0.8" />
      </G>,
    )
  }
  // Pale lilac (Alt) flowers only at Flourishing
  if (stageKey === STAGE_FLOURISHING) {
    leaves.push(
      <G key="herbs-lilac">
        <Circle cx={cx - 6} cy={cy - 10 * heightScale} r="1.5" fill={gated.alt} opacity="0.75" />
        <Circle cx={cx + 6} cy={cy - 10 * heightScale} r="1.5" fill={gated.alt} opacity="0.75" />
      </G>,
    )
  }
  return <G opacity={alpha}>{leaves}</G>
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

// ── Main Bed component ────────────────────────────────────────
// Memoised on stageKey alone (spec §22).
function LivingGardenBedComponent({ bedKey, stageKey, sceneId }) {
  const placement = BED_PLACEMENT[bedKey]
  if (!placement) return null

  const Renderer = BED_RENDERERS[bedKey]
  if (!Renderer) return null

  const isEmpty = stageKey === STAGE_EMPTY
  const gated = gatedPalette(bedKey, stageKey)
  const palette = BED_PALETTES[bedKey]
  const alpha = STAGE_ALPHA[stageKey] || 0

  return (
    <G>
      {/* Ground bloom from Growing onward (rendered under soil) */}
      <GroundBloom bedKey={bedKey} placement={placement} stageKey={stageKey} />
      {/* Soil bed + edging + fringe */}
      <SoilBed bedKey={bedKey} sceneId={sceneId} stageKey={stageKey} />
      {/* Ghost on Empty (11% of Sprout) — FROZEN zero-state */}
      {isEmpty && <GhostSilhouette bedKey={bedKey} sceneId={sceneId} />}
      {/* Plant artwork (earned stages only) */}
      {stageKey !== STAGE_EMPTY && (
        <Renderer
          stageKey={stageKey}
          placement={placement}
          gated={gated}
          palette={palette}
          alpha={alpha}
        />
      )}
    </G>
  )
}

// ── Custom comparator — re-render only on stageKey change ─────
function bedComparator(prev, next) {
  return (
    prev.bedKey === next.bedKey && prev.stageKey === next.stageKey && prev.sceneId === next.sceneId
  )
}

export const LivingGardenBed = memo(LivingGardenBedComponent, bedComparator)

// ── Exports for testing ───────────────────────────────────────
export {
  NEUTRAL_BASE,
  STAGE_CHROMA,
  STAGE_ALPHA,
  STAGE_BLOOM,
  BED_PALETTES,
  mixColor,
  gateColor,
  gatedPalette,
  canopyBlend,
}

export default LivingGardenBed
