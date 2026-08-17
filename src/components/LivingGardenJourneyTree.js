// ─────────────────────────────────────────────────────────────
// LivingGardenJourneyTree.js — Large-scale Journey Tree
//
// Renders the Journey Tree at scene scale (244×268 envelope)
// with environmental lighting driven by the existing Journey stage.
//
// Spec §10: Base pinned at 196, 344. Crown bottom never below y=250.
//   Seed:    16h × 16w
//   Sprout:  40h × 30w
//   Growing: 100h × 82w
//   Blooming: 152h × 132w
//   Thriving: 202h × 176w
//   Radiant:  236h × 208w
//   Legend:   268h × 244w
//
// Spec §11: Tree is the scene's light source.
//   Rim light at Radiant+, crown breath at Legend.
//
// Consumes the SAME journeyStageKey as the compact Tree.
// No new Tree stage. No new thresholds. No decay.
//
// Does NOT modify src/components/JourneyTreeArtwork.js (frozen).
// ─────────────────────────────────────────────────────────────

import React, { memo, useState, useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import {
  G,
  Path,
  Ellipse,
  Circle,
  Line,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg'
import { TREE_BASE, SCENE_PALETTE } from './LivingGardenGeometry'

// ── SVG transform strings (NOT animated G wrapper — react-native-svg
// crashes with "Underflow in restore" when an animated G wrapper
// receives RN transform arrays). Animated.Value objects are consumed
// via listeners that update state with SVG transform strings.
// DOCUMENTED EXCEPTION (same pattern as Bed colorProgress/produceReveal).

// ── Tree dimensions per stage (spec §10) ──────────────────────
const TREE_DIMENSIONS = {
  seed: { height: 16, crownWidth: 16, crownBottom: null },
  sprout: { height: 40, crownWidth: 30, crownBottom: null },
  growing: { height: 100, crownWidth: 82, crownBottom: 274 },
  blooming: { height: 152, crownWidth: 132, crownBottom: 250 },
  thriving: { height: 202, crownWidth: 176, crownBottom: 226 },
  radiant: { height: 236, crownWidth: 208, crownBottom: 212 },
  legend: { height: 268, crownWidth: 244, crownBottom: 196 },
}

// ── Canopy colour tones (darker → lighter, layered) ───────────
// Earned-Color Refinement (Rev A): thriving and legend use deeper,
// cooler crown bases so warm produce colors below win the hierarchy.
//   Established (thriving) crown base: #256B4E
//   Legend crown base: #1B6248
// Lobe variation: mix(base, #4FA97A, 0.30) alternating with mix(base, #14503B, 0.22)
// Inner light: #63BC8C @ 0.22, upper-left, 0.52 × crown radius
// Warm rim: #F2D9A0 (0.13 established, 0.22 legend)
// Gold specks: #F0D06A @ 0.45, r 3.4 (7 established, 14 legend)
// Fruit detail: #D9453F @ 0.72, r 6 (5 established, 9 legend)
// Blossoms: #FFF6E8 @ 0.58, r 4.2 (3 established, 6 legend)
// Tree fruit/blossoms are DECORATIVE ONLY — no progression/persistence.
function mixHex(hex, mixHex, ratio) {
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

// Mature crown bases and lobe variations (spec §4)
const ESTABLISHED_BASE = '#256B4E'
const LEGEND_BASE = '#1B6248'
const LOBE_LIGHT = '#4FA97A'
const LOBE_DARK = '#14503B'
const INNER_LIGHT = '#63BC8C'
const WARM_RIM = '#F2D9A0'
const GOLD_SPECK = '#F0D06A'
const TREE_FRUIT = '#D9453F'
const TREE_BLOSSOM = '#FFF6E8'
const TREE_TRUNK = '#5A3A24'
const TREE_TRUNK_RIM = '#8A5E38'

const CANOPY_TONES = {
  seed: ['#1A3020'],
  sprout: ['#1F3A26', '#2A4D32'],
  growing: ['#20502F', '#2A6440', '#347650'],
  blooming: ['#20502F', '#2A6440', '#347650', '#3C875A'],
  // Established: deeper cooler base with lobe variation
  thriving: [
    ESTABLISHED_BASE,
    mixHex(ESTABLISHED_BASE, LOBE_DARK, 0.22),
    mixHex(ESTABLISHED_BASE, LOBE_LIGHT, 0.3),
    mixHex(ESTABLISHED_BASE, LOBE_DARK, 0.22),
    mixHex(ESTABLISHED_BASE, LOBE_LIGHT, 0.3),
  ],
  radiant: ['#1C4828', '#20502F', '#2A6440', '#347650', '#3C875A', '#45926A'],
  // Legend: deepest/coolest base with lobe variation
  legend: [
    LEGEND_BASE,
    mixHex(LEGEND_BASE, LOBE_DARK, 0.22),
    mixHex(LEGEND_BASE, LOBE_LIGHT, 0.3),
    mixHex(LEGEND_BASE, LOBE_DARK, 0.22),
    mixHex(LEGEND_BASE, LOBE_LIGHT, 0.3),
    mixHex(LEGEND_BASE, LOBE_DARK, 0.22),
    mixHex(LEGEND_BASE, LOBE_LIGHT, 0.3),
  ],
}

// ── Mature Tree earned detail renderer (spec §4) ──────────────
// Decorative ONLY — no progression, no persistence, no click rewards.
function MatureTreeDetail({ baseX, crownCenterY, crownR, isLegend }) {
  const goldSpeckCount = isLegend ? 14 : 7
  const fruitCount = isLegend ? 9 : 5
  const blossomCount = isLegend ? 6 : 3
  const specks = []
  const fruits = []
  const blossoms = []
  // Deterministic positions using fixed angles (no Math.random)
  for (let i = 0; i < goldSpeckCount; i++) {
    const angle = (i / goldSpeckCount) * Math.PI * 2
    const r = crownR * (0.3 + (i % 3) * 0.15)
    const sx = baseX + Math.cos(angle) * r
    const sy = crownCenterY + Math.sin(angle) * r * 0.7
    specks.push(
      <Circle key={`tree-speck-${i}`} cx={sx} cy={sy} r="3.4" fill={GOLD_SPECK} opacity="0.45" />,
    )
  }
  for (let i = 0; i < fruitCount; i++) {
    const angle = (i / fruitCount) * Math.PI * 2 + 0.4
    const r = crownR * (0.4 + (i % 2) * 0.2)
    const fx = baseX + Math.cos(angle) * r
    const fy = crownCenterY + Math.sin(angle) * r * 0.6
    fruits.push(
      <Circle key={`tree-fruit-${i}`} cx={fx} cy={fy} r="6" fill={TREE_FRUIT} opacity="0.72" />,
    )
  }
  for (let i = 0; i < blossomCount; i++) {
    const angle = (i / blossomCount) * Math.PI * 2 + 0.8
    const r = crownR * (0.5 + (i % 2) * 0.15)
    const bx = baseX + Math.cos(angle) * r
    const by = crownCenterY + Math.sin(angle) * r * 0.5
    blossoms.push(
      <Circle
        key={`tree-blossom-${i}`}
        cx={bx}
        cy={by}
        r="4.2"
        fill={TREE_BLOSSOM}
        opacity="0.58"
      />,
    )
  }
  return (
    <G>
      {specks}
      {fruits}
      {blossoms}
    </G>
  )
}

// ── Tree renderer per stage ───────────────────────────────────
function TreeSeed({ baseX, baseY, sceneId, treeOpacity = 1 }) {
  // A mound, a stone marker, one warm ember of light in the soil
  return (
    <G>
      <Ellipse cx={baseX} cy={baseY} rx="8" ry="3" fill={SCENE_PALETTE.loam} opacity={0.8 * treeOpacity} />
      <Circle cx={baseX} cy={baseY - 1} r="2" fill={SCENE_PALETTE.loamLit} opacity={0.6 * treeOpacity} />
      {/* Stone marker */}
      <Ellipse
        cx={baseX}
        cy={baseY - 4}
        rx="2"
        ry="3"
        fill={SCENE_PALETTE.timberDark}
        opacity={0.7 * treeOpacity}
      />
      {/* Warm ember */}
      <Circle cx={baseX} cy={baseY - 1} r="1" fill={SCENE_PALETTE.gold} opacity={0.6 * treeOpacity} />
    </G>
  )
}

function TreeSprout({ baseX, baseY, sceneId, trunkOpacity = 1, canopyOpacity = 1 }) {
  // Two-leaf seedling inside a small ring of placed stones
  const topY = baseY - 40
  return (
    <G>
      {/* Stone ring */}
      <Circle cx={baseX - 5} cy={baseY - 1} r="1.5" fill={SCENE_PALETTE.timberDark} opacity="0.6" />
      <Circle cx={baseX + 5} cy={baseY - 1} r="1.5" fill={SCENE_PALETTE.timberDark} opacity="0.6" />
      <Circle cx={baseX} cy={baseY - 1} r="1.5" fill={SCENE_PALETTE.timberDark} opacity="0.6" />
      {/* Stem */}
      <Line
        x1={baseX}
        y1={baseY}
        x2={baseX}
        y2={topY + 8}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="1"
      />
      {/* Two leaves */}
      <Ellipse
        cx={baseX - 4}
        cy={topY + 6}
        rx="4"
        ry="2.5"
        fill="#2A6440"
        transform={`rotate(-25 ${baseX - 4} ${topY + 6})`}
      />
      <Ellipse
        cx={baseX + 4}
        cy={topY + 6}
        rx="4"
        ry="2.5"
        fill="#2A6440"
        transform={`rotate(25 ${baseX + 4} ${topY + 6})`}
      />
    </G>
  )
}

function TreeGrowing({ baseX, baseY, sceneId, trunkOpacity = 1, canopyOpacity = 1 }) {
  // Sapling with slim trunk and first real crown
  const trunkH = 60
  const crownR = 30
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.5
  const tones = CANOPY_TONES.growing
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-growing`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SCENE_PALETTE.barkDark} />
          <Stop offset="0.55" stopColor={SCENE_PALETTE.bark} />
          <Stop offset="1" stopColor={SCENE_PALETTE.barkDark} />
        </LinearGradient>
      </Defs>
      {/* Trunk */}
      <Path
        d={`M ${baseX - 2} ${baseY} L ${baseX - 1.5} ${trunkTopY} L ${baseX + 1.5} ${trunkTopY} L ${baseX + 2} ${baseY} Z`}
        fill={`url(#${sceneId}-bark-growing)`}
        opacity={trunkOpacity}
      />
      {/* First branches */}
      <Path
        d={`M ${baseX} ${trunkTopY + 10} L ${baseX - 12} ${trunkTopY + 2}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity={trunkOpacity}
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 10} L ${baseX + 12} ${trunkTopY + 2}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity={trunkOpacity}
      />
      {/* Crown — layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.8} fill={tones[0]} opacity={canopyOpacity} />
      <Ellipse
        cx={baseX - crownR * 0.3}
        cy={crownCenterY + 4}
        rx={crownR * 0.7}
        ry={crownR * 0.6}
        fill={tones[1]}
        opacity={canopyOpacity * 0.85}
      />
      <Ellipse
        cx={baseX + crownR * 0.3}
        cy={crownCenterY + 2}
        rx={crownR * 0.6}
        ry={crownR * 0.5}
        fill={tones[2]}
        opacity={canopyOpacity * 0.8}
      />
      {/* Cast shadow */}
      <Ellipse cx={baseX} cy={baseY + 2} rx={crownR * 0.6} ry="3" fill="#000" opacity={0.2 * trunkOpacity} />
    </G>
  )
}

function TreeBlooming({ baseX, baseY, sceneId, trunkOpacity = 1, canopyOpacity = 1, detailOpacity = 1 }) {
  // Young tree, blossom specks through the crown
  const trunkH = 90
  const crownR = 50
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.4
  const tones = CANOPY_TONES.blooming
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-blooming`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SCENE_PALETTE.barkDark} />
          <Stop offset="0.55" stopColor={SCENE_PALETTE.bark} />
          <Stop offset="1" stopColor={SCENE_PALETTE.barkDark} />
        </LinearGradient>
      </Defs>
      <Path
        d={`M ${baseX - 3} ${baseY} L ${baseX - 2} ${trunkTopY} L ${baseX + 2} ${trunkTopY} L ${baseX + 3} ${baseY} Z`}
        fill={`url(#${sceneId}-bark-blooming)`}
      />
      {/* Branches */}
      <Path
        d={`M ${baseX} ${trunkTopY + 15} L ${baseX - 18} ${trunkTopY + 4}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 15} L ${baseX + 18} ${trunkTopY + 4}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 25} L ${baseX - 10} ${trunkTopY + 18}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Crown — layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.85} fill={tones[0]} />
      <Ellipse
        cx={baseX - crownR * 0.35}
        cy={crownCenterY + 6}
        rx={crownR * 0.7}
        ry={crownR * 0.65}
        fill={tones[1]}
        opacity="0.85"
      />
      <Ellipse
        cx={baseX + crownR * 0.35}
        cy={crownCenterY + 4}
        rx={crownR * 0.65}
        ry={crownR * 0.6}
        fill={tones[2]}
        opacity="0.8"
      />
      <Ellipse
        cx={baseX}
        cy={crownCenterY - crownR * 0.3}
        rx={crownR * 0.5}
        ry={crownR * 0.45}
        fill={tones[3]}
        opacity="0.75"
      />
      {/* Blossom specks */}
      <Circle cx={baseX - 12} cy={crownCenterY - 8} r="1.1" fill="#F3E3D2" opacity="0.85" />
      <Circle cx={baseX + 14} cy={crownCenterY - 4} r="1.1" fill="#F3E3D2" opacity="0.85" />
      <Circle cx={baseX - 4} cy={crownCenterY + 10} r="1" fill="#F3E3D2" opacity="0.8" />
      <Circle cx={baseX + 6} cy={crownCenterY - 14} r="1" fill="#F3E3D2" opacity="0.8" />
    </G>
  )
}

function TreeThriving({ baseX, baseY, sceneId, atmosphere, trunkOpacity = 1, canopyOpacity = 1, detailOpacity = 1 }) {
  // Established tree: deeper cooler crown, warm rim, earned detail
  const trunkH = 120
  const crownR = 70
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.35
  const tones = CANOPY_TONES.thriving
  const rimOpacity = 0.13
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-thriving`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={TREE_TRUNK} />
          <Stop offset="0.55" stopColor={mixHex(TREE_TRUNK, TREE_TRUNK_RIM, 0.3)} />
          <Stop offset="1" stopColor={TREE_TRUNK} />
        </LinearGradient>
      </Defs>
      {/* Buttressed trunk base + surface roots */}
      <Path
        d={`M ${baseX - 5} ${baseY} L ${baseX - 3} ${trunkTopY} L ${baseX + 3} ${trunkTopY} L ${baseX + 5} ${baseY} Z`}
        fill={`url(#${sceneId}-bark-thriving)`}
      />
      <Path
        d={`M ${baseX - 5} ${baseY} L ${baseX - 12} ${baseY + 1}`}
        stroke={TREE_TRUNK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX + 5} ${baseY} L ${baseX + 12} ${baseY + 1}`}
        stroke={TREE_TRUNK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Trunk rim */}
      <Path
        d={`M ${baseX - 4} ${trunkTopY + 20} L ${baseX - 3} ${trunkTopY}`}
        stroke={TREE_TRUNK_RIM}
        strokeWidth="0.8"
        opacity="0.55"
        fill="none"
        strokeLinecap="round"
      />
      {/* Branches */}
      <Path
        d={`M ${baseX} ${trunkTopY + 20} L ${baseX - 24} ${trunkTopY + 6}`}
        stroke={TREE_TRUNK}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 20} L ${baseX + 24} ${trunkTopY + 6}`}
        stroke={TREE_TRUNK}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 35} L ${baseX - 14} ${trunkTopY + 25}`}
        stroke={TREE_TRUNK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 35} L ${baseX + 14} ${trunkTopY + 25}`}
        stroke={TREE_TRUNK}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Crown — 5 layered tones with lobe variation */}
      <Ellipse
        cx={baseX}
        cy={crownCenterY}
        rx={crownR}
        ry={crownR * 0.88}
        fill={tones[0]}
        opacity="0.92"
      />
      <Ellipse
        cx={baseX - crownR * 0.35}
        cy={crownCenterY + 8}
        rx={crownR * 0.75}
        ry={crownR * 0.7}
        fill={tones[1]}
        opacity="0.82"
      />
      <Ellipse
        cx={baseX + crownR * 0.35}
        cy={crownCenterY + 6}
        rx={crownR * 0.7}
        ry={crownR * 0.65}
        fill={tones[2]}
        opacity="0.80"
      />
      <Ellipse
        cx={baseX - crownR * 0.15}
        cy={crownCenterY - crownR * 0.3}
        rx={crownR * 0.55}
        ry={crownR * 0.5}
        fill={tones[3]}
        opacity="0.74"
      />
      <Ellipse
        cx={baseX + crownR * 0.2}
        cy={crownCenterY - crownR * 0.35}
        rx={crownR * 0.5}
        ry={crownR * 0.45}
        fill={tones[4]}
        opacity="0.62"
      />
      {/* Inner light — upper-left, 0.52 × crown radius */}
      <Ellipse
        cx={baseX - crownR * 0.2}
        cy={crownCenterY - crownR * 0.25}
        rx={crownR * 0.52}
        ry={crownR * 0.45}
        fill={INNER_LIGHT}
        opacity="0.22"
      />
      {/* Warm rim — upper-left arc, opacity 0.13 */}
      <Path
        d={`M ${baseX - crownR * 0.6} ${crownCenterY - crownR * 0.2} A ${crownR * 0.85} ${crownR * 0.78} 0 0 1 ${baseX + crownR * 0.1} ${crownCenterY - crownR * 0.7}`}
        fill="none"
        stroke={WARM_RIM}
        strokeWidth="6"
        opacity={rimOpacity}
        strokeLinecap="round"
      />
      {/* Earned detail — 7 gold specks, 5 fruit, 3 blossoms (decorative only) */}
      <MatureTreeDetail
        baseX={baseX}
        crownCenterY={crownCenterY}
        crownR={crownR}
        isLegend={false}
      />
    </G>
  )
}

function TreeRadiant({ baseX, baseY, sceneId, atmosphere, trunkOpacity = 1, canopyOpacity = 1, detailOpacity = 1 }) {
  // Backlit: gold rim light along upper-left crown edge
  const trunkH = 140
  const crownR = 85
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.3
  const tones = CANOPY_TONES.radiant
  const rimOpacity = atmosphere.rimLight * 0.24
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-radiant`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SCENE_PALETTE.barkDark} />
          <Stop offset="0.55" stopColor={SCENE_PALETTE.bark} />
          <Stop offset="1" stopColor={SCENE_PALETTE.barkDark} />
        </LinearGradient>
      </Defs>
      {/* Trunk + roots */}
      <Path
        d={`M ${baseX - 6} ${baseY} L ${baseX - 4} ${trunkTopY} L ${baseX + 4} ${trunkTopY} L ${baseX + 6} ${baseY} Z`}
        fill={`url(#${sceneId}-bark-radiant)`}
      />
      <Path
        d={`M ${baseX - 6} ${baseY} L ${baseX - 14} ${baseY + 1}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX + 6} ${baseY} L ${baseX + 14} ${baseY + 1}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Branches */}
      <Path
        d={`M ${baseX} ${trunkTopY + 25} L ${baseX - 28} ${trunkTopY + 8}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 25} L ${baseX + 28} ${trunkTopY + 8}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 45} L ${baseX - 18} ${trunkTopY + 32}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 45} L ${baseX + 18} ${trunkTopY + 32}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Crown — 6 layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.9} fill={tones[0]} />
      <Ellipse
        cx={baseX - crownR * 0.35}
        cy={crownCenterY + 10}
        rx={crownR * 0.78}
        ry={crownR * 0.72}
        fill={tones[1]}
        opacity="0.85"
      />
      <Ellipse
        cx={baseX + crownR * 0.35}
        cy={crownCenterY + 8}
        rx={crownR * 0.72}
        ry={crownR * 0.68}
        fill={tones[2]}
        opacity="0.8"
      />
      <Ellipse
        cx={baseX - crownR * 0.15}
        cy={crownCenterY - crownR * 0.35}
        rx={crownR * 0.58}
        ry={crownR * 0.52}
        fill={tones[3]}
        opacity="0.75"
      />
      <Ellipse
        cx={baseX + crownR * 0.22}
        cy={crownCenterY - crownR * 0.4}
        rx={crownR * 0.52}
        ry={crownR * 0.48}
        fill={tones[4]}
        opacity="0.7"
      />
      <Ellipse
        cx={baseX}
        cy={crownCenterY - crownR * 0.5}
        rx={crownR * 0.4}
        ry={crownR * 0.38}
        fill={tones[5]}
        opacity="0.65"
      />
      {/* Gold rim light along upper-left edge */}
      <Path
        d={`M ${baseX - crownR * 0.6} ${crownCenterY - crownR * 0.2} A ${crownR * 0.85} ${crownR * 0.78} 0 0 1 ${baseX + crownR * 0.1} ${crownCenterY - crownR * 0.7}`}
        fill="none"
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="1.8"
        opacity={rimOpacity}
        strokeLinecap="round"
      />
      {/* Two soft shafts falling to ground */}
      <Path
        d={`M ${baseX - 20} ${trunkTopY + 10} L ${baseX - 30} ${baseY}`}
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="3"
        opacity={rimOpacity * 0.5}
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX + 20} ${trunkTopY + 10} L ${baseX + 30} ${baseY}`}
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="3"
        opacity={rimOpacity * 0.5}
        strokeLinecap="round"
      />
    </G>
  )
}

function TreeLegend({ baseX, baseY, sceneId, atmosphere, isReduced, trunkOpacity = 1, canopyOpacity = 1, detailOpacity = 1 }) {
  // Ancient: deepest/coolest crown, widest, warm rim 0.22, earned detail
  const trunkH = 160
  const crownR = 100
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.28
  const tones = CANOPY_TONES.legend
  const rimOpacity = 0.22
  const breathOpacity = isReduced ? 0.12 : 0.12
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-legend`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={TREE_TRUNK} />
          <Stop offset="0.55" stopColor={mixHex(TREE_TRUNK, TREE_TRUNK_RIM, 0.3)} />
          <Stop offset="1" stopColor={TREE_TRUNK} />
        </LinearGradient>
      </Defs>
      {/* Buttressed roots */}
      <Path
        d={`M ${baseX - 8} ${baseY} L ${baseX - 5} ${trunkTopY} L ${baseX + 5} ${trunkTopY} L ${baseX + 8} ${baseY} Z`}
        fill={`url(#${sceneId}-bark-legend)`}
      />
      <Path
        d={`M ${baseX - 8} ${baseY} L ${baseX - 18} ${baseY + 2} L ${baseX - 14} ${baseY - 4}`}
        fill={TREE_TRUNK}
        opacity="0.8"
      />
      <Path
        d={`M ${baseX + 8} ${baseY} L ${baseX + 18} ${baseY + 2} L ${baseX + 14} ${baseY - 4}`}
        fill={TREE_TRUNK}
        opacity="0.8"
      />
      {/* Trunk rim */}
      <Path
        d={`M ${baseX - 6} ${trunkTopY + 30} L ${baseX - 5} ${trunkTopY}`}
        stroke={TREE_TRUNK_RIM}
        strokeWidth="1"
        opacity="0.55"
        fill="none"
        strokeLinecap="round"
      />
      {/* Branches */}
      <Path
        d={`M ${baseX} ${trunkTopY + 30} L ${baseX - 34} ${trunkTopY + 10}`}
        stroke={TREE_TRUNK}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 30} L ${baseX + 34} ${trunkTopY + 10}`}
        stroke={TREE_TRUNK}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 55} L ${baseX - 22} ${trunkTopY + 40}`}
        stroke={TREE_TRUNK}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX} ${trunkTopY + 55} L ${baseX + 22} ${trunkTopY + 40}`}
        stroke={TREE_TRUNK}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Crown — 7 layered tones with lobe variation, layered alpha */}
      <Ellipse
        cx={baseX}
        cy={crownCenterY}
        rx={crownR}
        ry={crownR * 0.92}
        fill={tones[0]}
        opacity="0.92"
      />
      <Ellipse
        cx={baseX - crownR * 0.38}
        cy={crownCenterY + 12}
        rx={crownR * 0.8}
        ry={crownR * 0.75}
        fill={tones[1]}
        opacity="0.82"
      />
      <Ellipse
        cx={baseX + crownR * 0.38}
        cy={crownCenterY + 10}
        rx={crownR * 0.75}
        ry={crownR * 0.7}
        fill={tones[2]}
        opacity="0.80"
      />
      <Ellipse
        cx={baseX - crownR * 0.18}
        cy={crownCenterY - crownR * 0.38}
        rx={crownR * 0.6}
        ry={crownR * 0.55}
        fill={tones[3]}
        opacity="0.74"
      />
      <Ellipse
        cx={baseX + crownR * 0.25}
        cy={crownCenterY - crownR * 0.42}
        rx={crownR * 0.55}
        ry={crownR * 0.5}
        fill={tones[4]}
        opacity="0.62"
      />
      <Ellipse
        cx={baseX}
        cy={crownCenterY - crownR * 0.55}
        rx={crownR * 0.42}
        ry={crownR * 0.4}
        fill={tones[5]}
        opacity="0.55"
      />
      <Ellipse
        cx={baseX + crownR * 0.1}
        cy={crownCenterY - crownR * 0.65}
        rx={crownR * 0.3}
        ry={crownR * 0.28}
        fill={tones[6]}
        opacity="0.55"
      />
      {/* Inner light — upper-left, 0.52 × crown radius */}
      <Ellipse
        cx={baseX - crownR * 0.2}
        cy={crownCenterY - crownR * 0.25}
        rx={crownR * 0.52}
        ry={crownR * 0.45}
        fill={INNER_LIGHT}
        opacity="0.22"
      />
      {/* Warm rim — upper-left arc, opacity 0.22 */}
      <Path
        d={`M ${baseX - crownR * 0.65} ${crownCenterY - crownR * 0.25} A ${crownR * 0.9} ${crownR * 0.82} 0 0 1 ${baseX + crownR * 0.15} ${crownCenterY - crownR * 0.75}`}
        fill="none"
        stroke={WARM_RIM}
        strokeWidth="6"
        opacity={rimOpacity}
        strokeLinecap="round"
      />
      {/* Luminance breath inside canopy (static at 0.12 for reduced) */}
      <Ellipse
        cx={baseX}
        cy={crownCenterY}
        rx={crownR * 0.5}
        ry={crownR * 0.45}
        fill={SCENE_PALETTE.goldPale}
        opacity={breathOpacity}
      />
      {/* Earned detail — 14 gold specks, 9 fruit, 6 blossoms (decorative only) */}
      <MatureTreeDetail baseX={baseX} crownCenterY={crownCenterY} crownR={crownR} isLegend={true} />
      {/* Soft shafts */}
      <Path
        d={`M ${baseX - 24} ${trunkTopY + 15} L ${baseX - 36} ${baseY}`}
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="3.5"
        opacity={rimOpacity * 0.5}
        strokeLinecap="round"
      />
      <Path
        d={`M ${baseX + 24} ${trunkTopY + 15} L ${baseX + 36} ${baseY}`}
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="3.5"
        opacity={rimOpacity * 0.5}
        strokeLinecap="round"
      />
    </G>
  )
}

// ── Unstarted / prepared Journey destination ──────────────────
// Visual-only treatment for journeyStageKey === null.
// This is NOT a Journey stage. It does not modify getJourneyStage().
// It communicates: "Your Journey Tree will grow here."
//
// Renders a prepared planting mound with a warm ambient glow,
// clearly distinct from the earned Seed-stage Tree (which has
// a stone marker + ember). The glow is large enough to anchor
// the scene's focal destination at zero history without drawing
// a mature Tree or falsely awarding Seed.
function TreeUnstarted({ baseX, baseY, sceneId, atmosphere, isReduced, trunkOpacity = 1, canopyOpacity = 1, detailOpacity = 1 }) {
  return (
    <G>
      <Defs>
        {/* Outer ambient glow — larger, draws the eye through the Arbor */}
        <RadialGradient id={`${sceneId}-unstarted-ambient`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={SCENE_PALETTE.gold} stopOpacity="0.32" />
          <Stop offset="0.35" stopColor={SCENE_PALETTE.gold} stopOpacity="0.14" />
          <Stop offset="0.7" stopColor={SCENE_PALETTE.gold} stopOpacity="0.04" />
          <Stop offset="1" stopColor={SCENE_PALETTE.gold} stopOpacity="0" />
        </RadialGradient>
        {/* Inner focused glow — warm core at the planting point */}
        <RadialGradient id={`${sceneId}-unstarted-core`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={SCENE_PALETTE.goldPale} stopOpacity="0.45" />
          <Stop offset="0.5" stopColor={SCENE_PALETTE.gold} stopOpacity="0.18" />
          <Stop offset="1" stopColor={SCENE_PALETTE.gold} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Outer ambient glow — large soft halo, anchors the destination */}
      <Ellipse
        cx={baseX}
        cy={baseY - 12}
        rx="48"
        ry="34"
        fill={`url(#${sceneId}-unstarted-ambient)`}
        opacity="0.22"
      />

      {/* Inner focused glow — warm core */}
      <Ellipse
        cx={baseX}
        cy={baseY - 4}
        rx="20"
        ry="14"
        fill={`url(#${sceneId}-unstarted-core)`}
        opacity="0.30"
      />

      {/* Prepared planting mound — wider, clearly prepared soil */}
      <Ellipse cx={baseX} cy={baseY} rx="22" ry="5" fill={SCENE_PALETTE.loam} opacity="0.90" />
      <Ellipse
        cx={baseX}
        cy={baseY - 1}
        rx="16"
        ry="4"
        fill={SCENE_PALETTE.loamLit}
        opacity="0.55"
      />
      {/* Mound highlight — warm light on the soil surface */}
      <Ellipse
        cx={baseX}
        cy={baseY - 2}
        rx="12"
        ry="2"
        fill={SCENE_PALETTE.loamLit}
        opacity="0.35"
      />

      {/* Ring of placed stones — larger, clearly intentional and prepared */}
      <Circle cx={baseX - 12} cy={baseY} r="2.5" fill={SCENE_PALETTE.timberLight} opacity="0.75" />
      <Circle cx={baseX + 12} cy={baseY} r="2.5" fill={SCENE_PALETTE.timberLight} opacity="0.75" />
      <Circle cx={baseX - 6} cy={baseY + 3} r="2" fill={SCENE_PALETTE.timberLight} opacity="0.65" />
      <Circle cx={baseX + 6} cy={baseY + 3} r="2" fill={SCENE_PALETTE.timberLight} opacity="0.65" />
      <Circle cx={baseX} cy={baseY + 4} r="1.8" fill={SCENE_PALETTE.timberLight} opacity="0.55" />

      {/* Warm gold marker — larger, clearly visible focal point */}
      <Circle cx={baseX} cy={baseY - 3} r="3" fill={SCENE_PALETTE.gold} opacity="0.85" />
      {/* Inner bright core of the marker */}
      <Circle cx={baseX} cy={baseY - 3} r="1.5" fill={SCENE_PALETTE.goldPale} opacity="0.7" />

      {/* Small label-stick marker — taller, more visible */}
      <Line
        x1={baseX}
        y1={baseY - 3}
        x2={baseX}
        y2={baseY - 16}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="1"
        opacity="0.55"
      />
      {/* Small cap on the label-stick */}
      <Circle cx={baseX} cy={baseY - 16} r="1.2" fill={SCENE_PALETTE.timberLight} opacity="0.5" />
    </G>
  )
}

// ── Tree renderer dispatcher ──────────────────────────────────
const TREE_RENDERERS = {
  seed: TreeSeed,
  sprout: TreeSprout,
  growing: TreeGrowing,
  blooming: TreeBlooming,
  thriving: TreeThriving,
  radiant: TreeRadiant,
  legend: TreeLegend,
}

// ── Main LivingGardenJourneyTree component ────────────────────
// Consumes the same journeyStageKey as the compact JourneyTreeArtwork.
// When journeyStageKey is null (0 lifetime days → getJourneyStage returns
// null), renders the unstarted/prepared visual. This is NOT a Journey
// stage — it is a visual-only placeholder that does not modify
// getJourneyStage() or introduce a new threshold.
//
// treeMotion (optional): animated motion values from useGardenMotion.
//   { scaleY, opacity, canopyProgress, detailProgress, rimProgress, breathScale }
// Multi-channel choreography (Phase 1B):
//   - scaleY + opacity: trunk/base establishes (whole tree grows from base)
//   - canopyProgress: branches/canopy arrive (subtle opacity modulation)
//   - detailProgress: renderer-owned detail settles (subtle opacity modulation)
//   - rimProgress: temporary rim/glow acknowledgement (resolves to 0)
//   - breathScale: idle canopy breath (subtle, 1.0 at rest)
// At rest, all wrappers are identity/pixel-neutral.
//
// Phase 1C: treeMotion is an object of Animated.Value objects.
// Transforms/opacity are driven via listeners that update state with
// SVG transform strings (DOCUMENTED EXCEPTION — not AnimatedG, which
// crashes react-native-svg with "Underflow in restore").
// Tree trunk/base remains completely static during idle.
// Only canopy/detail receive breath motion.
function LivingGardenJourneyTreeComponent({
  journeyStageKey,
  fromStage = null,
  transitionId = null,
  atmosphere,
  isReduced,
  sceneId,
  treeMotion,
}) {
  const { x: baseX, y: baseY } = TREE_BASE

  // ── Tree motion channels (Phase 1C: Animated.Value objects) ─
  // When treeMotion is provided, it contains Animated.Value objects.
  // When not provided (rest), we use plain canonical values (no animation).
  const hasAnimMotion = treeMotion && treeMotion.scaleY instanceof Animated.Value

  // Idle canopy breath (subtle scale, ~1.004 amplitude)
  // Tree trunk/base remains completely static.
  const breathY = baseY - 80

  // ── Phase 1D pre-paint transition guard (one-shot per generation) ──
  // PROBLEM: When the parent switches journeyStageKey from source to
  // destination AND passes advancements simultaneously, the Scene
  // re-renders with the destination stage BEFORE the motion hook's
  // useEffect runs runTreeGrowth() to set transition-start values.
  // The Animated.Values still contain OLD CANONICAL values (trunk=1,
  // canopy=1, detail=1, source=0). Even readSync(__getValue()) reads
  // these stale values, causing a one-frame flash of the complete
  // destination Tree.
  //
  // FIX: A one-shot first-target render guard with explicit lifecycle
  // phases per transition generation:
  //   UNPREPARED → RUNNING → COMPLETE
  //
  // UNPREPARED: New transition identity detected. Force transition-start
  //   values (source=1, trunk=0, canopy=0, detail=0) on every render
  //   until the motion hook initializes the Animated.Values.
  // RUNNING: Motion hook has initialized (trunkOpacity moved below 1).
  //   Guard releases. Normal Animated.Value reads take over.
  // COMPLETE: Animation finished or cancelled. Values are canonical.
  //   Guard NEVER reactivates for this generation, even though values
  //   return to canonical (trunk=1, canopy=1). A later render must
  //   continue showing the canonical Growing Tree.
  //
  // A NEW transition identity (new advancements object reference) creates
  // a fresh generation starting at UNPREPARED.
  //
  // Reduced Motion bypasses the guard entirely — renders canonical
  // destination immediately (source=0, trunk=1, canopy=1, detail=1).

  // ── Generation identity ──
  // Use a component-local monotonic counter incremented when a new
  // transitionId object reference arrives. This avoids [object Object]
  // string collision and provides deterministic unique identity per
  // advancement event. No persistence — presentation lifecycle only.
  const prevTransitionIdRef = useRef(null)
  const generationRef = useRef(0)
  // Guard phase: 0=IDLE, 1=UNPREPARED, 2=RUNNING, 3=COMPLETE
  const guardPhaseRef = useRef(0)
  // Track hook generation at time guard was armed
  const guardArmedHookGenRef = useRef(0)

  const isTransition = !!(fromStage && fromStage !== journeyStageKey)

  // Detect new transition identity by object reference (not stringification)
  if (isTransition && transitionId && transitionId !== prevTransitionIdRef.current) {
    prevTransitionIdRef.current = transitionId
    generationRef.current += 1
    // Only arm guard if not Reduced Motion
    guardPhaseRef.current = isReduced ? 3 : 1 // UNPREPARED (or COMPLETE if reduced)
    // Record current hook generation so we can detect when hook processes this
    guardArmedHookGenRef.current = hasAnimMotion && treeMotion.transitionGeneration != null
      ? treeMotion.transitionGeneration
      : 0
  }
  // If transition ends (fromStage cleared or matches destination), reset to IDLE
  if (!isTransition && guardPhaseRef.current !== 0) {
    guardPhaseRef.current = 0
    prevTransitionIdRef.current = null
  }

  // ── Listener-based transform state (DOCUMENTED EXCEPTION) ──
  // SVG transform strings updated via Animated.Value listeners.
  // Avoids AnimatedG crash with react-native-svg.
  //
  // Phase 1D fix: State is initialized LAZILY from Animated.Value objects
  // via useState(() => ...) so the VERY FIRST render after journeyStageKey
  // switch already has the correct transition-start values (e.g. trunkOpacity=0,
  // canopyOpacity=0). This prevents the one-frame flash where stale canonical
  // defaults (opacity=1) would briefly show the complete destination Tree.
  const readAnimValue = (v, fallback) => (v && v.__getValue ? v.__getValue() : fallback)
  const [treeTransform, setTreeTransform] = useState(() => {
    if (!hasAnimMotion) return ''
    const scaleY = readAnimValue(treeMotion.scaleY, 1)
    const ty = (1 - scaleY) * baseY
    return `translate(0 ${ty}) scale(1 ${scaleY})`
  })
  const [treeOpacityState, setTreeOpacityState] = useState(() =>
    hasAnimMotion ? readAnimValue(treeMotion.opacity, 1) : 1,
  )
  const [innerOpacityState, setInnerOpacityState] = useState(1)
  const [rimOpacityState, setRimOpacityState] = useState(() =>
    hasAnimMotion ? Math.max(0, Math.min(0.25, readAnimValue(treeMotion.rim, 0) * 0.25)) : 0,
  )
  const [breathTransform, setBreathTransform] = useState(() => {
    if (!hasAnimMotion) return ''
    const breath = readAnimValue(treeMotion.breath, 1)
    const bty = (1 - breath) * breathY
    return `translate(0 ${bty}) scale(1 ${breath})`
  })
  // Phase 1D: destination-layer reveal state — lazy init from Animated.Value
  // to prevent first-frame flash of complete destination Tree
  const [sourceOpacityState, setSourceOpacityState] = useState(() =>
    hasAnimMotion ? readAnimValue(treeMotion.sourceOpacity, 0) : 0,
  )
  const [trunkOpacityState, setTrunkOpacityState] = useState(() =>
    hasAnimMotion ? readAnimValue(treeMotion.trunkOpacity, 1) : 1,
  )
  const [canopyOpacityState, setCanopyOpacityState] = useState(() =>
    hasAnimMotion ? readAnimValue(treeMotion.canopyOpacity, 1) : 1,
  )
  const [detailOpacityState, setDetailOpacityState] = useState(() =>
    hasAnimMotion ? readAnimValue(treeMotion.detailOpacity, 1) : 1,
  )

  useEffect(() => {
    if (!hasAnimMotion) return
    const updateAll = () => {
      const scaleY = treeMotion.scaleY.__getValue()
      const ty = (1 - scaleY) * baseY
      setTreeTransform(`translate(0 ${ty}) scale(1 ${scaleY})`)
      setTreeOpacityState(treeMotion.opacity.__getValue())
      // Inner opacity = canopy * detail
      const canopy = treeMotion.canopy.__getValue()
      const detail = treeMotion.detail.__getValue()
      const canopyOp = Math.max(0.6, Math.min(1, 0.6 + 0.4 * canopy))
      const detailOp = Math.max(0.5, Math.min(1, 0.5 + 0.5 * detail))
      setInnerOpacityState(canopyOp * detailOp)
      // Rim opacity
      const rim = treeMotion.rim.__getValue()
      setRimOpacityState(Math.max(0, Math.min(0.25, rim * 0.25)))
      // Breath transform
      const breath = treeMotion.breath.__getValue()
      const bty = (1 - breath) * breathY
      setBreathTransform(`translate(0 ${bty}) scale(1 ${breath})`)
      // Phase 1D: destination-layer channels
      if (treeMotion.sourceOpacity) {
        setSourceOpacityState(treeMotion.sourceOpacity.__getValue())
      }
      if (treeMotion.trunkOpacity) {
        setTrunkOpacityState(treeMotion.trunkOpacity.__getValue())
      }
      if (treeMotion.canopyOpacity) {
        setCanopyOpacityState(treeMotion.canopyOpacity.__getValue())
      }
      if (treeMotion.detailOpacity) {
        setDetailOpacityState(treeMotion.detailOpacity.__getValue())
      }
    }
    updateAll()
    const listeners = [
      treeMotion.scaleY.addListener(updateAll),
      treeMotion.opacity.addListener(updateAll),
      treeMotion.canopy.addListener(updateAll),
      treeMotion.detail.addListener(updateAll),
      treeMotion.rim.addListener(updateAll),
      treeMotion.breath.addListener(updateAll),
    ]
    // Phase 1D: add listeners for new channels
    if (treeMotion.sourceOpacity) {
      listeners.push(treeMotion.sourceOpacity.addListener(updateAll))
    }
    if (treeMotion.trunkOpacity) {
      listeners.push(treeMotion.trunkOpacity.addListener(updateAll))
    }
    if (treeMotion.canopyOpacity) {
      listeners.push(treeMotion.canopyOpacity.addListener(updateAll))
    }
    if (treeMotion.detailOpacity) {
      listeners.push(treeMotion.detailOpacity.addListener(updateAll))
    }
    return () => {
      treeMotion.scaleY.removeListener(listeners[0])
      treeMotion.opacity.removeListener(listeners[1])
      treeMotion.canopy.removeListener(listeners[2])
      treeMotion.detail.removeListener(listeners[3])
      treeMotion.rim.removeListener(listeners[4])
      treeMotion.breath.removeListener(listeners[5])
      if (treeMotion.sourceOpacity) treeMotion.sourceOpacity.removeListener(listeners[6])
      if (treeMotion.trunkOpacity) {
        treeMotion.trunkOpacity.removeListener(listeners[7])
      }
      if (treeMotion.canopyOpacity) {
        treeMotion.canopyOpacity.removeListener(listeners[8])
      }
      if (treeMotion.detailOpacity) {
        treeMotion.detailOpacity.removeListener(listeners[9])
      }
    }
  }, [hasAnimMotion, treeMotion, baseY, breathY])

  const motionWrapper = (children) => {
    if (!hasAnimMotion) return children
    // react-native-svg 15.x bug: G with opacity prop causes "Underflow in
    // restore" crash during rapid state updates. Only use transform on G.
    // Opacity is applied to individual SVG elements instead.
    return (
      <G transform={treeTransform}>
        {children}
        {/* Temporary rim/glow acknowledgement — resolves to 0 */}
        {rimOpacityState > 0.01 && (
          <Ellipse
            cx={baseX}
            cy={baseY - 100}
            rx="60"
            ry="50"
            fill={WARM_RIM}
            opacity={rimOpacityState * 0.15}
            pointerEvents="none"
          />
        )}
        {/* Idle canopy breath — subtle scale, pixel-neutral at rest */}
        <G transform={breathTransform} pointerEvents="none">
          <Ellipse cx={baseX} cy={breathY} rx="40" ry="30" fill="none" opacity="0" />
        </G>
      </G>
    )
  }

  // null = unstarted (0 lifetime days) — NOT seed
  if (journeyStageKey === null || journeyStageKey === undefined) {
    return (
      <G>
        {motionWrapper(
          <TreeUnstarted
            baseX={baseX}
            baseY={baseY}
            sceneId={sceneId}
            atmosphere={atmosphere}
            isReduced={isReduced}
          />,
        )}
      </G>
    )
  }

  const Renderer = TREE_RENDERERS[journeyStageKey] || TREE_RENDERERS.seed

  // Phase 1D: source/destination transition layer
  // Source canonical Tree renders with fading opacity (1→0)
  // Destination canonical Tree subgroups reveal progressively
  //
  // Phase 1D pre-paint guard: Read Animated.Value DIRECTLY during render for
  // subgroup opacities, NOT from React state. This eliminates the one-frame
  // flash where stale canonical state (opacity=1) would briefly show the
  // complete destination Tree before the listener delivers transition-start
  // values (opacity=0). __getValue() is synchronous and always current.
  //
  // One-shot guard lifecycle: UNPREPARED → RUNNING → COMPLETE
  // The guard forces transition-start values ONLY while UNPREPARED.
  // Once the motion hook initializes (trunkOpacity < 1), transition to RUNNING.
  // Once values return to canonical (trunk=1, canopy=1, source=0), transition
  // to COMPLETE. After COMPLETE, the guard NEVER reactivates for this generation.
  const readSync = (v, fallback) => (v && v.__getValue ? v.__getValue() : fallback)
  let syncSourceOpacity = hasAnimMotion ? readSync(treeMotion.sourceOpacity, 0) : 0
  let syncTrunkOpacity = hasAnimMotion ? readSync(treeMotion.trunkOpacity, 1) : 1
  let syncCanopyOpacity = hasAnimMotion ? readSync(treeMotion.canopyOpacity, 1) : 1
  let syncDetailOpacity = hasAnimMotion ? readSync(treeMotion.detailOpacity, 1) : 1

  // ── Guard phase transitions (during render, synchronous) ──
  // transitionGeneration from motion hook increments when the hook
  // processes a new advancement. If the hook's generation has increased
  // since the guard was armed, the hook has run its useEffect.
  const hookGeneration = hasAnimMotion && treeMotion.transitionGeneration != null
    ? treeMotion.transitionGeneration
    : 0

  if (guardPhaseRef.current === 1) {
    // UNPREPARED: check if motion hook has initialized
    if (syncTrunkOpacity < 1 || syncCanopyOpacity < 1) {
      // Motion hook has set transition-start values → RUNNING
      guardPhaseRef.current = 2
    } else if (hookGeneration > guardArmedHookGenRef.current) {
      // Hook has processed this advancement but values are still canonical.
      // This means the transition was cancelled (Reduced Motion or background
      // interruption called resolveToCanonicalRest). → COMPLETE
      guardPhaseRef.current = 3
    }
  } else if (guardPhaseRef.current === 2) {
    // RUNNING: check if animation completed (values back to canonical)
    if (syncTrunkOpacity >= 1 && syncCanopyOpacity >= 1 && syncSourceOpacity < 0.01) {
      // Values returned to canonical → COMPLETE
      guardPhaseRef.current = 3
    }
  }

  // ── Apply guard: force transition-start values while UNPREPARED ──
  if (guardPhaseRef.current === 1) {
    syncSourceOpacity = 1
    syncTrunkOpacity = 0
    syncCanopyOpacity = 0
    syncDetailOpacity = 0
  }

  const hasSourceLayer = fromStage && fromStage !== journeyStageKey && syncSourceOpacity > 0.01
  const SourceRenderer = hasSourceLayer ? TREE_RENDERERS[fromStage] || null : null

  // Subgroup opacity props for destination renderer — read synchronously
  // from Animated.Value to prevent first-frame flash
  const destTrunkOpacity = syncTrunkOpacity
  const destCanopyOpacity = syncCanopyOpacity
  const destDetailOpacity = syncDetailOpacity

  return (
    <G>
      {/* Phase 1D: source canonical Tree layer (fades out) */}
      {hasSourceLayer && SourceRenderer && (
        <SourceRenderer
          baseX={baseX}
          baseY={baseY}
          sceneId={`${sceneId}-src`}
          atmosphere={atmosphere}
          isReduced={isReduced}
          treeOpacity={syncSourceOpacity}
        />
      )}
      {/* Destination canonical Tree with subgroup reveal */}
      {motionWrapper(
        <Renderer
          baseX={baseX}
          baseY={baseY}
          sceneId={sceneId}
          atmosphere={atmosphere}
          isReduced={isReduced}
          trunkOpacity={destTrunkOpacity}
          canopyOpacity={destCanopyOpacity}
          detailOpacity={destDetailOpacity}
        />,
      )}
    </G>
  )
}

function treeComparator(prev, next) {
  return (
    prev.journeyStageKey === next.journeyStageKey &&
    prev.fromStage === next.fromStage &&
    prev.transitionId === next.transitionId &&
    prev.isReduced === next.isReduced &&
    prev.sceneId === next.sceneId &&
    prev.treeMotion === next.treeMotion
  )
}

export const LivingGardenJourneyTree = memo(LivingGardenJourneyTreeComponent, treeComparator)

// ── Exports for testing ───────────────────────────────────────
export {
  ESTABLISHED_BASE,
  LEGEND_BASE,
  WARM_RIM,
  GOLD_SPECK,
  TREE_FRUIT,
  TREE_BLOSSOM,
  INNER_LIGHT,
  CANOPY_TONES,
  mixHex,
}

export default LivingGardenJourneyTree
