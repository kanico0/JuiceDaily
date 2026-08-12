// ─────────────────────────────────────────────────────────────
// GardenProduceIcons.js — Literal, recognizable produce
// silhouettes for each of the 7 Garden beds.
//
// FINAL handoff §5.1: "literal silhouettes of real, recognizable
// produce — a carrot, a lemon slice, an apple, a strawberry, a
// pineapple, a mint sprig — rather than an abstract botanical or
// heart-shaped icon language."
//
// Each icon is rendered in a 0 0 100 100 viewBox and supports
// the three-tier reveal:
//   not tried  — outline only, ~52% opacity, no fill
//   tried      — outline + fill at ~55% opacity
//   well explored — full solid fill + full detail
//
// Named groups: produce_<bedKey>_container with _outline and
// _fill children, matching the system's earned/unearned pattern.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import Svg, { G, Path, Circle, Ellipse, Line, Rect, Defs, ClipPath } from 'react-native-svg'

// ── Tier visual props ────────────────────────────────────────
const TIER_PROPS = {
  not_tried: {
    strokeOpacity: 0.52,
    strokeWidth: 1.8,
    fillOpacity: 0,
    showDetail: false,
  },
  tried: {
    strokeOpacity: 1,
    strokeWidth: 1.5,
    fillOpacity: 0.55,
    showDetail: false,
  },
  well_explored: {
    strokeOpacity: 1,
    strokeWidth: 1.2,
    fillOpacity: 1,
    showDetail: true,
  },
}

export function getRevealTier(stageKey) {
  if (!stageKey || stageKey === 'empty') return 'not_tried'
  if (stageKey === 'seed' || stageKey === 'sprout' || stageKey === 'growing') return 'tried'
  return 'well_explored'
}

// ── Per-bed produce icon paths ───────────────────────────────
// Each function renders the literal produce silhouette for its bed.

function GreensIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  return (
    <G id="produce_greens_container">
      <G id="produce_greens_outline">
        {/* Tied stem bundle with broad leaves */}
        <Path d="M 50,82 Q 48,70 45,60 Q 35,55 28,45 Q 38,48 44,55 Q 40,40 38,28 Q 46,38 48,50 Q 50,35 50,22 Q 50,35 52,50 Q 54,38 62,28 Q 60,40 56,55 Q 62,48 72,45 Q 65,55 55,60 Q 52,70 50,82 Z"
              fill={color} fillOpacity={p.fillOpacity}
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
        {/* Tie mark at base */}
        <Line x1="42" y1="78" x2="58" y2="78" stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth="1.5" />
      </G>
      {p.showDetail && (
        <G id="produce_greens_detail">
          {/* Vein lines on leaves */}
          <Path d="M 44,55 Q 40,50 35,46" stroke={color} strokeOpacity="0.3" strokeWidth="0.8" fill="none" />
          <Path d="M 48,50 Q 48,40 48,30" stroke={color} strokeOpacity="0.3" strokeWidth="0.8" fill="none" />
          <Path d="M 56,55 Q 60,50 65,46" stroke={color} strokeOpacity="0.3" strokeWidth="0.8" fill="none" />
        </G>
      )}
    </G>
  )
}

function RootsIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  const greenColor = '#5FD98A'
  const ridgeColor = '#B4611F'
  return (
    <G id="produce_roots_container">
      <G id="produce_roots_outline">
        {/* Tapered wedge carrot body — wide rounded top, pointed bottom */}
        <Path d="M 42,40 Q 41,36 46,34 L 54,34 Q 59,36 58,40 L 50,80 Z"
              fill={color} fillOpacity={p.fillOpacity}
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
      </G>
      {/* Green leaf blades (3-4 thin leaves) */}
      <G id="produce_roots_leaves">
        <Path d="M 50,35 Q 46.5,28.5 45,17 Q 49,25.5 50,35 Z"
              fill={greenColor} fillOpacity={p.fillOpacity}
              stroke={greenColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 47,25 48,12 Q 51,24.5 50,35 Z"
              fill={greenColor} fillOpacity={p.fillOpacity}
              stroke={greenColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 49,25 52,12 Q 53,24.5 50,35 Z"
              fill={greenColor} fillOpacity={p.fillOpacity}
              stroke={greenColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 50.5,28.5 55,17 Q 53.5,25.5 50,35 Z"
              fill={greenColor} fillOpacity={p.fillOpacity}
              stroke={greenColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
      </G>
      {p.showDetail && (
        <G id="produce_roots_detail">
          {/* Horizontal ridge lines on carrot body */}
          <Line x1="45" y1="44" x2="55" y2="44" stroke={ridgeColor} strokeOpacity="0.6" strokeWidth="1.4" />
          <Line x1="46" y1="52" x2="54" y2="52" stroke={ridgeColor} strokeOpacity="0.6" strokeWidth="1.4" />
          <Line x1="47" y1="60" x2="53" y2="60" stroke={ridgeColor} strokeOpacity="0.6" strokeWidth="1.4" />
        </G>
      )}
    </G>
  )
}

function CitrusIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  const rindColor = '#C98A2E'
  const pithColor = '#FFF6D8'
  const fleshColor = '#F2C14E'
  const segmentColor = '#C98A2E'
  return (
    <G id="produce_citrus_container">
      <G id="produce_citrus_outline">
        {/* Outer rind ring */}
        <Circle cx="50" cy="50" r="30"
                fill={rindColor} fillOpacity={p.fillOpacity}
                stroke={rindColor} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} />
        {/* Pale pith ring */}
        <Circle cx="50" cy="50" r="27"
                fill={pithColor} fillOpacity={p.fillOpacity}
                stroke="none" />
        {/* Bright flesh center */}
        <Circle cx="50" cy="50" r="23"
                fill={fleshColor} fillOpacity={p.fillOpacity}
                stroke="none" />
      </G>
      {p.showDetail && (
        <G id="produce_citrus_detail">
          {/* 12 radial segment lines from center to just inside rind */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 - 90) * Math.PI / 180
            const x1 = 50
            const y1 = 50
            const x2 = 50 + Math.cos(angle) * 22
            const y2 = 50 + Math.sin(angle) * 22
            return (
              <Line key={`seg_${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={segmentColor} strokeOpacity="0.75" strokeWidth="1.6" />
            )
          })}
          {/* Center dot */}
          <Circle cx="50" cy="50" r="4" fill={pithColor} opacity="0.9" />
        </G>
      )}
    </G>
  )
}

function OrchardIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  return (
    <G id="produce_orchard_container">
      <G id="produce_orchard_outline">
        {/* Apple: rounded twin-lobe + stem + leaf */}
        <Path d="M 50,30 Q 48,24 46,20 Q 50,22 54,20 Q 52,24 50,30 Z"
              fill={color} fillOpacity={p.fillOpacity * 0.7}
              stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.8} />
        {/* Leaf */}
        <Path d="M 54,22 Q 62,18 64,12 Q 58,16 54,22 Z"
              fill={color} fillOpacity={p.fillOpacity * 0.6}
              stroke={color} strokeOpacity={p.strokeOpacity * 0.6} strokeWidth={p.strokeWidth * 0.7} />
        {/* Apple body — twin lobe */}
        <Path d="M 50,32 Q 30,30 28,50 Q 28,72 40,80 Q 46,84 50,80 Q 54,84 60,80 Q 72,72 72,50 Q 70,30 50,32 Z"
              fill={color} fillOpacity={p.fillOpacity}
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
      </G>
      {p.showDetail && (
        <G id="produce_orchard_detail">
          {/* Lobe indentation at top */}
          <Path d="M 44,34 Q 50,38 56,34" stroke={color} strokeOpacity="0.25" strokeWidth="0.8" fill="none" />
          {/* Highlight */}
          <Ellipse cx="38" cy="48" rx="4" ry="8" fill="#FFFFFF" opacity="0.08" />
        </G>
      )}
    </G>
  )
}

function BerriesIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  const redColor = '#D9453A'
  const seedColor = '#FFE9A8'
  const calyxColor = '#4C8F63'
  return (
    <G id="produce_berries_container">
      <G id="produce_berries_outline">
        {/* Strawberry red body — rounded heart/teardrop shape */}
        <Path d="M 33,40 Q 50,33 67,40 Q 67,66 50,78 Q 33,66 33,40 Z"
              fill={redColor} fillOpacity={p.fillOpacity}
              stroke={redColor} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
      </G>
      {/* Green five-point star calyx at top */}
      <G id="produce_berries_calyx">
        <Path d="M 50,35 Q 44.4,33.6 42.2,27.2 Q 48.6,29.4 50,35 Z"
              fill={calyxColor} fillOpacity={p.fillOpacity}
              stroke={calyxColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 45.4,31.5 45.9,24.8 Q 50.9,29.3 50,35 Z"
              fill={calyxColor} fillOpacity={p.fillOpacity}
              stroke={calyxColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 47,30 50,24 Q 53,30 50,35 Z"
              fill={calyxColor} fillOpacity={p.fillOpacity}
              stroke={calyxColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 50.9,29.3 54.1,24.8 Q 54.6,31.5 50,35 Z"
              fill={calyxColor} fillOpacity={p.fillOpacity}
              stroke={calyxColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,35 Q 55.6,33.6 57.8,27.2 Q 51.4,29.4 50,35 Z"
              fill={calyxColor} fillOpacity={p.fillOpacity}
              stroke={calyxColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
      </G>
      {p.showDetail && (
        <G id="produce_berries_detail">
          {/* 8 small light seed dots across body */}
          {[
            { cx: 43, cy: 45 }, { cx: 57, cy: 45 }, { cx: 50, cy: 53 },
            { cx: 41, cy: 58 }, { cx: 59, cy: 58 }, { cx: 50, cy: 66 },
            { cx: 44, cy: 70 }, { cx: 56, cy: 70 },
          ].map((seed, i) => (
            <Ellipse key={`seed_${i}`} cx={seed.cx} cy={seed.cy} rx="1.6" ry="2.2"
                     fill={seedColor} opacity="0.9" />
          ))}
        </G>
      )}
    </G>
  )
}

function TropicalIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  const bodyColor = '#E0A83E'
  const latticeColor = '#B4791F'
  const crownColor = '#4C8F63'
  const clipId = `tropical_clip_${tier}_${Math.random().toString(36).slice(2, 8)}`
  return (
    <G id="produce_tropical_container">
      <Defs>
        <ClipPath id={clipId}>
          <Ellipse cx="50" cy="58" rx="20" ry="28" />
        </ClipPath>
      </Defs>
      <G id="produce_tropical_outline">
        {/* Pineapple body — rich gold/tan */}
        <Ellipse cx="50" cy="58" rx="20" ry="28"
                 fill={bodyColor} fillOpacity={p.fillOpacity}
                 stroke={bodyColor} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} />
      </G>
      {/* Criss-cross diamond lattice texture */}
      {p.showDetail && (
        <G id="produce_tropical_detail" clipPath={`url(#${clipId})`}>
          {/* Diagonal set 1 */}
          {[-12, -6, 0, 6, 12, 18, 24].map((offset, i) => (
            <Path key={`d1_${i}`} d={`M ${30 + offset},30 Q ${50 + offset * 0.3},58 ${30 + offset},86`}
                  stroke={latticeColor} strokeOpacity="0.65" strokeWidth="1.3" fill="none" />
          ))}
          {/* Diagonal set 2 */}
          {[-12, -6, 0, 6, 12, 18, 24].map((offset, i) => (
            <Path key={`d2_${i}`} d={`M ${70 - offset},30 Q ${50 - offset * 0.3},58 ${70 - offset},86`}
                  stroke={latticeColor} strokeOpacity="0.5" strokeWidth="1.3" fill="none" />
          ))}
        </G>
      )}
      {/* Five pointed spiky crown leaves */}
      <G id="produce_tropical_crown">
        <Path d="M 50,32 Q 44.3,23.5 42.8,15.4 Q 47.9,24.4 50,32 Z"
              fill={crownColor} fillOpacity={p.fillOpacity}
              stroke={crownColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,32 Q 46.7,22 47.8,10.8 Q 51.3,21.2 50,32 Z"
              fill={crownColor} fillOpacity={p.fillOpacity}
              stroke={crownColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,32 Q 49,22 50,8 Q 51,22 50,32 Z"
              fill={crownColor} fillOpacity={p.fillOpacity}
              stroke={crownColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,32 Q 50.7,21.2 52.2,10.8 Q 53.3,22 50,32 Z"
              fill={crownColor} fillOpacity={p.fillOpacity}
              stroke={crownColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,32 Q 55.7,23.5 57.2,15.4 Q 52.1,24.4 50,32 Z"
              fill={crownColor} fillOpacity={p.fillOpacity}
              stroke={crownColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7} />
      </G>
    </G>
  )
}

function HerbsIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  const mintColor = '#6FA97D'
  const stemColor = '#3E5A48'
  return (
    <G id="produce_herbs_container">
      <G id="produce_herbs_outline">
        {/* Central stem */}
        <Line x1="50" y1="85" x2="50" y2="41"
              stroke={stemColor} strokeOpacity={p.strokeOpacity} strokeWidth="2.2" strokeLinecap="round" />
        {/* 3 opposite pairs of rounded oval leaves (mint-like) */}
        {/* Bottom pair — largest */}
        <Ellipse cx="38.9" cy="73" rx="7.8" ry="4.9" fill={mintColor} fillOpacity={p.fillOpacity}
                 stroke={mintColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7}
                 transform="rotate(-55 38.9 73)" />
        <Ellipse cx="61.1" cy="73" rx="7.8" ry="4.9" fill={mintColor} fillOpacity={p.fillOpacity}
                 stroke={mintColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7}
                 transform="rotate(55 61.1 73)" />
        {/* Middle pair — medium */}
        <Ellipse cx="37.8" cy="59" rx="9" ry="5.7" fill={mintColor} fillOpacity={p.fillOpacity}
                 stroke={mintColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7}
                 transform="rotate(-55 37.8 59)" />
        <Ellipse cx="62.2" cy="59" rx="9" ry="5.7" fill={mintColor} fillOpacity={p.fillOpacity}
                 stroke={mintColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7}
                 transform="rotate(55 62.2 59)" />
        {/* Top pair — smallest */}
        <Ellipse cx="39.4" cy="45" rx="7.2" ry="4.6" fill={mintColor} fillOpacity={p.fillOpacity}
                 stroke={mintColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7}
                 transform="rotate(-55 39.4 45)" />
        <Ellipse cx="60.6" cy="45" rx="7.2" ry="4.6" fill={mintColor} fillOpacity={p.fillOpacity}
                 stroke={mintColor} strokeOpacity={p.strokeOpacity * 0.8} strokeWidth={p.strokeWidth * 0.7}
                 transform="rotate(55 60.6 45)" />
      </G>
    </G>
  )
}

// ── Registry ─────────────────────────────────────────────────
const PRODUCE_ICONS = {
  greens: GreensIcon,
  roots: RootsIcon,
  citrus: CitrusIcon,
  orchard: OrchardIcon,
  berries: BerriesIcon,
  tropical: TropicalIcon,
  herbs: HerbsIcon,
}

// ── Main component ───────────────────────────────────────────
function GardenProduceIcon({ bedKey, stageKey, color, size = 100 }) {
  const tier = getRevealTier(stageKey)
  const IconComponent = PRODUCE_ICONS[bedKey]
  if (!IconComponent) return null

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100"
         accessibilityLabel={`${bedKey} produce icon, ${tier.replace('_', ' ')}`}>
      <IconComponent tier={tier} color={color} />
    </Svg>
  )
}

export default GardenProduceIcon
