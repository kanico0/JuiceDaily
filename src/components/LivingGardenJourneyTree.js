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

import React, { memo } from 'react'
import { G, Path, Ellipse, Circle, Line, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg'
import { TREE_BASE, SCENE_PALETTE } from './LivingGardenGeometry'

// ── Tree dimensions per stage (spec §10) ──────────────────────
const TREE_DIMENSIONS = {
  seed:    { height: 16,  crownWidth: 16,  crownBottom: null },
  sprout:  { height: 40,  crownWidth: 30,  crownBottom: null },
  growing: { height: 100, crownWidth: 82,  crownBottom: 274 },
  blooming:{ height: 152, crownWidth: 132, crownBottom: 250 },
  thriving:{ height: 202, crownWidth: 176, crownBottom: 226 },
  radiant: { height: 236, crownWidth: 208, crownBottom: 212 },
  legend:  { height: 268, crownWidth: 244, crownBottom: 196 },
}

// ── Canopy colour tones (darker → lighter, layered) ───────────
const CANOPY_TONES = {
  seed:    ['#1A3020'],
  sprout:  ['#1F3A26', '#2A4D32'],
  growing: ['#20502F', '#2A6440', '#347650'],
  blooming:['#20502F', '#2A6440', '#347650', '#3C875A'],
  thriving:['#1C4828', '#20502F', '#2A6440', '#347650', '#3C875A'],
  radiant: ['#1C4828', '#20502F', '#2A6440', '#347650', '#3C875A', '#45926A'],
  legend:  ['#1A4024', '#1C4828', '#20502F', '#2A6440', '#347650', '#3C875A', '#45926A'],
}

// ── Tree renderer per stage ───────────────────────────────────
function TreeSeed({ baseX, baseY, sceneId }) {
  // A mound, a stone marker, one warm ember of light in the soil
  return (
    <G>
      <Ellipse cx={baseX} cy={baseY} rx="8" ry="3" fill={SCENE_PALETTE.loam} opacity="0.8" />
      <Circle cx={baseX} cy={baseY - 1} r="2" fill={SCENE_PALETTE.loamLit} opacity="0.6" />
      {/* Stone marker */}
      <Ellipse cx={baseX} cy={baseY - 4} rx="2" ry="3" fill={SCENE_PALETTE.timberDark} opacity="0.7" />
      {/* Warm ember */}
      <Circle cx={baseX} cy={baseY - 1} r="1" fill={SCENE_PALETTE.gold} opacity="0.6" />
    </G>
  )
}

function TreeSprout({ baseX, baseY, sceneId }) {
  // Two-leaf seedling inside a small ring of placed stones
  const topY = baseY - 40
  return (
    <G>
      {/* Stone ring */}
      <Circle cx={baseX - 5} cy={baseY - 1} r="1.5" fill={SCENE_PALETTE.timberDark} opacity="0.6" />
      <Circle cx={baseX + 5} cy={baseY - 1} r="1.5" fill={SCENE_PALETTE.timberDark} opacity="0.6" />
      <Circle cx={baseX} cy={baseY - 1} r="1.5" fill={SCENE_PALETTE.timberDark} opacity="0.6" />
      {/* Stem */}
      <Line x1={baseX} y1={baseY} x2={baseX} y2={topY + 8} stroke={SCENE_PALETTE.bark} strokeWidth="1" />
      {/* Two leaves */}
      <Ellipse cx={baseX - 4} cy={topY + 6} rx="4" ry="2.5" fill="#2A6440" transform={`rotate(-25 ${baseX - 4} ${topY + 6})`} />
      <Ellipse cx={baseX + 4} cy={topY + 6} rx="4" ry="2.5" fill="#2A6440" transform={`rotate(25 ${baseX + 4} ${topY + 6})`} />
    </G>
  )
}

function TreeGrowing({ baseX, baseY, sceneId }) {
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
      <Path d={`M ${baseX - 2} ${baseY} L ${baseX - 1.5} ${trunkTopY} L ${baseX + 1.5} ${trunkTopY} L ${baseX + 2} ${baseY} Z`} fill={`url(#${sceneId}-bark-growing)`} />
      {/* First branches */}
      <Path d={`M ${baseX} ${trunkTopY + 10} L ${baseX - 12} ${trunkTopY + 2}`} stroke={SCENE_PALETTE.bark} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 10} L ${baseX + 12} ${trunkTopY + 2}`} stroke={SCENE_PALETTE.bark} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Crown — layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.8} fill={tones[0]} />
      <Ellipse cx={baseX - crownR * 0.3} cy={crownCenterY + 4} rx={crownR * 0.7} ry={crownR * 0.6} fill={tones[1]} opacity="0.85" />
      <Ellipse cx={baseX + crownR * 0.3} cy={crownCenterY + 2} rx={crownR * 0.6} ry={crownR * 0.5} fill={tones[2]} opacity="0.8" />
      {/* Cast shadow */}
      <Ellipse cx={baseX} cy={baseY + 2} rx={crownR * 0.6} ry="3" fill="#000" opacity="0.2" />
    </G>
  )
}

function TreeBlooming({ baseX, baseY, sceneId }) {
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
      <Path d={`M ${baseX - 3} ${baseY} L ${baseX - 2} ${trunkTopY} L ${baseX + 2} ${trunkTopY} L ${baseX + 3} ${baseY} Z`} fill={`url(#${sceneId}-bark-blooming)`} />
      {/* Branches */}
      <Path d={`M ${baseX} ${trunkTopY + 15} L ${baseX - 18} ${trunkTopY + 4}`} stroke={SCENE_PALETTE.bark} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 15} L ${baseX + 18} ${trunkTopY + 4}`} stroke={SCENE_PALETTE.bark} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 25} L ${baseX - 10} ${trunkTopY + 18}`} stroke={SCENE_PALETTE.bark} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Crown — layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.85} fill={tones[0]} />
      <Ellipse cx={baseX - crownR * 0.35} cy={crownCenterY + 6} rx={crownR * 0.7} ry={crownR * 0.65} fill={tones[1]} opacity="0.85" />
      <Ellipse cx={baseX + crownR * 0.35} cy={crownCenterY + 4} rx={crownR * 0.65} ry={crownR * 0.6} fill={tones[2]} opacity="0.8" />
      <Ellipse cx={baseX} cy={crownCenterY - crownR * 0.3} rx={crownR * 0.5} ry={crownR * 0.45} fill={tones[3]} opacity="0.75" />
      {/* Blossom specks */}
      <Circle cx={baseX - 12} cy={crownCenterY - 8} r="1.1" fill="#F3E3D2" opacity="0.85" />
      <Circle cx={baseX + 14} cy={crownCenterY - 4} r="1.1" fill="#F3E3D2" opacity="0.85" />
      <Circle cx={baseX - 4} cy={crownCenterY + 10} r="1" fill="#F3E3D2" opacity="0.8" />
      <Circle cx={baseX + 6} cy={crownCenterY - 14} r="1" fill="#F3E3D2" opacity="0.8" />
    </G>
  )
}

function TreeThriving({ baseX, baseY, sceneId }) {
  // Full tree, layered crown tones, surface roots emerge
  const trunkH = 120
  const crownR = 70
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.35
  const tones = CANOPY_TONES.thriving
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-thriving`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SCENE_PALETTE.barkDark} />
          <Stop offset="0.55" stopColor={SCENE_PALETTE.bark} />
          <Stop offset="1" stopColor={SCENE_PALETTE.barkDark} />
        </LinearGradient>
      </Defs>
      {/* Buttressed trunk base + surface roots */}
      <Path d={`M ${baseX - 5} ${baseY} L ${baseX - 3} ${trunkTopY} L ${baseX + 3} ${trunkTopY} L ${baseX + 5} ${baseY} Z`} fill={`url(#${sceneId}-bark-thriving)`} />
      <Path d={`M ${baseX - 5} ${baseY} L ${baseX - 12} ${baseY + 1}`} stroke={SCENE_PALETTE.bark} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX + 5} ${baseY} L ${baseX + 12} ${baseY + 1}`} stroke={SCENE_PALETTE.bark} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Branches */}
      <Path d={`M ${baseX} ${trunkTopY + 20} L ${baseX - 24} ${trunkTopY + 6}`} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 20} L ${baseX + 24} ${trunkTopY + 6}`} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 35} L ${baseX - 14} ${trunkTopY + 25}`} stroke={SCENE_PALETTE.bark} strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 35} L ${baseX + 14} ${trunkTopY + 25}`} stroke={SCENE_PALETTE.bark} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Crown — 5 layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.88} fill={tones[0]} />
      <Ellipse cx={baseX - crownR * 0.35} cy={crownCenterY + 8} rx={crownR * 0.75} ry={crownR * 0.7} fill={tones[1]} opacity="0.85" />
      <Ellipse cx={baseX + crownR * 0.35} cy={crownCenterY + 6} rx={crownR * 0.7} ry={crownR * 0.65} fill={tones[2]} opacity="0.8" />
      <Ellipse cx={baseX - crownR * 0.15} cy={crownCenterY - crownR * 0.3} rx={crownR * 0.55} ry={crownR * 0.5} fill={tones[3]} opacity="0.75" />
      <Ellipse cx={baseX + crownR * 0.2} cy={crownCenterY - crownR * 0.35} rx={crownR * 0.5} ry={crownR * 0.45} fill={tones[4]} opacity="0.7" />
    </G>
  )
}

function TreeRadiant({ baseX, baseY, sceneId, atmosphere }) {
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
      <Path d={`M ${baseX - 6} ${baseY} L ${baseX - 4} ${trunkTopY} L ${baseX + 4} ${trunkTopY} L ${baseX + 6} ${baseY} Z`} fill={`url(#${sceneId}-bark-radiant)`} />
      <Path d={`M ${baseX - 6} ${baseY} L ${baseX - 14} ${baseY + 1}`} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX + 6} ${baseY} L ${baseX + 14} ${baseY + 1}`} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Branches */}
      <Path d={`M ${baseX} ${trunkTopY + 25} L ${baseX - 28} ${trunkTopY + 8}`} stroke={SCENE_PALETTE.bark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 25} L ${baseX + 28} ${trunkTopY + 8}`} stroke={SCENE_PALETTE.bark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 45} L ${baseX - 18} ${trunkTopY + 32}`} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 45} L ${baseX + 18} ${trunkTopY + 32}`} stroke={SCENE_PALETTE.bark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Crown — 6 layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.9} fill={tones[0]} />
      <Ellipse cx={baseX - crownR * 0.35} cy={crownCenterY + 10} rx={crownR * 0.78} ry={crownR * 0.72} fill={tones[1]} opacity="0.85" />
      <Ellipse cx={baseX + crownR * 0.35} cy={crownCenterY + 8} rx={crownR * 0.72} ry={crownR * 0.68} fill={tones[2]} opacity="0.8" />
      <Ellipse cx={baseX - crownR * 0.15} cy={crownCenterY - crownR * 0.35} rx={crownR * 0.58} ry={crownR * 0.52} fill={tones[3]} opacity="0.75" />
      <Ellipse cx={baseX + crownR * 0.22} cy={crownCenterY - crownR * 0.4} rx={crownR * 0.52} ry={crownR * 0.48} fill={tones[4]} opacity="0.7" />
      <Ellipse cx={baseX} cy={crownCenterY - crownR * 0.5} rx={crownR * 0.4} ry={crownR * 0.38} fill={tones[5]} opacity="0.65" />
      {/* Gold rim light along upper-left edge */}
      <Path d={`M ${baseX - crownR * 0.6} ${crownCenterY - crownR * 0.2} A ${crownR * 0.85} ${crownR * 0.78} 0 0 1 ${baseX + crownR * 0.1} ${crownCenterY - crownR * 0.7}`} fill="none" stroke={SCENE_PALETTE.goldPale} strokeWidth="1.8" opacity={rimOpacity} strokeLinecap="round" />
      {/* Two soft shafts falling to ground */}
      <Path d={`M ${baseX - 20} ${trunkTopY + 10} L ${baseX - 30} ${baseY}`} stroke={SCENE_PALETTE.goldPale} strokeWidth="3" opacity={rimOpacity * 0.5} strokeLinecap="round" />
      <Path d={`M ${baseX + 20} ${trunkTopY + 10} L ${baseX + 30} ${baseY}`} stroke={SCENE_PALETTE.goldPale} strokeWidth="3" opacity={rimOpacity * 0.5} strokeLinecap="round" />
    </G>
  )
}

function TreeLegend({ baseX, baseY, sceneId, atmosphere, isReduced }) {
  // Ancient: buttressed roots, widest crown, slow luminance breath
  const trunkH = 160
  const crownR = 100
  const trunkTopY = baseY - trunkH
  const crownCenterY = trunkTopY - crownR * 0.28
  const tones = CANOPY_TONES.legend
  const rimOpacity = atmosphere.rimLight * 0.24
  const breathOpacity = isReduced ? 0.12 : 0.12
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-bark-legend`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={SCENE_PALETTE.barkDark} />
          <Stop offset="0.55" stopColor={SCENE_PALETTE.bark} />
          <Stop offset="1" stopColor={SCENE_PALETTE.barkDark} />
        </LinearGradient>
      </Defs>
      {/* Buttressed roots */}
      <Path d={`M ${baseX - 8} ${baseY} L ${baseX - 5} ${trunkTopY} L ${baseX + 5} ${trunkTopY} L ${baseX + 8} ${baseY} Z`} fill={`url(#${sceneId}-bark-legend)`} />
      <Path d={`M ${baseX - 8} ${baseY} L ${baseX - 18} ${baseY + 2} L ${baseX - 14} ${baseY - 4}`} fill={SCENE_PALETTE.barkDark} opacity="0.8" />
      <Path d={`M ${baseX + 8} ${baseY} L ${baseX + 18} ${baseY + 2} L ${baseX + 14} ${baseY - 4}`} fill={SCENE_PALETTE.barkDark} opacity="0.8" />
      {/* Branches */}
      <Path d={`M ${baseX} ${trunkTopY + 30} L ${baseX - 34} ${trunkTopY + 10}`} stroke={SCENE_PALETTE.bark} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 30} L ${baseX + 34} ${trunkTopY + 10}`} stroke={SCENE_PALETTE.bark} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 55} L ${baseX - 22} ${trunkTopY + 40}`} stroke={SCENE_PALETTE.bark} strokeWidth="3" fill="none" strokeLinecap="round" />
      <Path d={`M ${baseX} ${trunkTopY + 55} L ${baseX + 22} ${trunkTopY + 40}`} stroke={SCENE_PALETTE.bark} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Crown — 7 layered tones */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR} ry={crownR * 0.92} fill={tones[0]} />
      <Ellipse cx={baseX - crownR * 0.38} cy={crownCenterY + 12} rx={crownR * 0.8} ry={crownR * 0.75} fill={tones[1]} opacity="0.85" />
      <Ellipse cx={baseX + crownR * 0.38} cy={crownCenterY + 10} rx={crownR * 0.75} ry={crownR * 0.7} fill={tones[2]} opacity="0.8" />
      <Ellipse cx={baseX - crownR * 0.18} cy={crownCenterY - crownR * 0.38} rx={crownR * 0.6} ry={crownR * 0.55} fill={tones[3]} opacity="0.75" />
      <Ellipse cx={baseX + crownR * 0.25} cy={crownCenterY - crownR * 0.42} rx={crownR * 0.55} ry={crownR * 0.5} fill={tones[4]} opacity="0.7" />
      <Ellipse cx={baseX} cy={crownCenterY - crownR * 0.55} rx={crownR * 0.42} ry={crownR * 0.4} fill={tones[5]} opacity="0.65" />
      <Ellipse cx={baseX + crownR * 0.1} cy={crownCenterY - crownR * 0.65} rx={crownR * 0.3} ry={crownR * 0.28} fill={tones[6]} opacity="0.6" />
      {/* Gold rim light */}
      <Path d={`M ${baseX - crownR * 0.65} ${crownCenterY - crownR * 0.25} A ${crownR * 0.9} ${crownR * 0.82} 0 0 1 ${baseX + crownR * 0.15} ${crownCenterY - crownR * 0.75}`} fill="none" stroke={SCENE_PALETTE.goldPale} strokeWidth="2" opacity={rimOpacity} strokeLinecap="round" />
      {/* Luminance breath inside canopy (static at 0.12 for reduced) */}
      <Ellipse cx={baseX} cy={crownCenterY} rx={crownR * 0.5} ry={crownR * 0.45} fill={SCENE_PALETTE.goldPale} opacity={breathOpacity} />
      {/* Soft shafts */}
      <Path d={`M ${baseX - 24} ${trunkTopY + 15} L ${baseX - 36} ${baseY}`} stroke={SCENE_PALETTE.goldPale} strokeWidth="3.5" opacity={rimOpacity * 0.5} strokeLinecap="round" />
      <Path d={`M ${baseX + 24} ${trunkTopY + 15} L ${baseX + 36} ${baseY}`} stroke={SCENE_PALETTE.goldPale} strokeWidth="3.5" opacity={rimOpacity * 0.5} strokeLinecap="round" />
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
function TreeUnstarted({ baseX, baseY, sceneId, atmosphere }) {
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
      <Ellipse cx={baseX} cy={baseY - 12} rx="48" ry="34" fill={`url(#${sceneId}-unstarted-ambient)`} opacity="0.22" />

      {/* Inner focused glow — warm core */}
      <Ellipse cx={baseX} cy={baseY - 4} rx="20" ry="14" fill={`url(#${sceneId}-unstarted-core)`} opacity="0.30" />

      {/* Prepared planting mound — wider, clearly prepared soil */}
      <Ellipse cx={baseX} cy={baseY} rx="22" ry="5" fill={SCENE_PALETTE.loam} opacity="0.90" />
      <Ellipse cx={baseX} cy={baseY - 1} rx="16" ry="4" fill={SCENE_PALETTE.loamLit} opacity="0.55" />
      {/* Mound highlight — warm light on the soil surface */}
      <Ellipse cx={baseX} cy={baseY - 2} rx="12" ry="2" fill={SCENE_PALETTE.loamLit} opacity="0.35" />

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
      <Line x1={baseX} y1={baseY - 3} x2={baseX} y2={baseY - 16} stroke={SCENE_PALETTE.timberLight} strokeWidth="1" opacity="0.55" />
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
function LivingGardenJourneyTreeComponent({ journeyStageKey, atmosphere, isReduced, sceneId }) {
  const { x: baseX, y: baseY } = TREE_BASE

  // null = unstarted (0 lifetime days) — NOT seed
  if (journeyStageKey === null || journeyStageKey === undefined) {
    return (
      <G>
        <TreeUnstarted
          baseX={baseX}
          baseY={baseY}
          sceneId={sceneId}
          atmosphere={atmosphere}
          isReduced={isReduced}
        />
      </G>
    )
  }

  const Renderer = TREE_RENDERERS[journeyStageKey] || TREE_RENDERERS.seed
  return (
    <G>
      <Renderer
        baseX={baseX}
        baseY={baseY}
        sceneId={sceneId}
        atmosphere={atmosphere}
        isReduced={isReduced}
      />
    </G>
  )
}

function treeComparator(prev, next) {
  return prev.journeyStageKey === next.journeyStageKey
    && prev.isReduced === next.isReduced
    && prev.sceneId === next.sceneId
}

export const LivingGardenJourneyTree = memo(LivingGardenJourneyTreeComponent, treeComparator)

export default LivingGardenJourneyTree
