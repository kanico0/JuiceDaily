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
import Svg, { G, Path, Circle, Ellipse, Line, Rect } from 'react-native-svg'

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
  return (
    <G id="produce_roots_container">
      <G id="produce_roots_outline">
        {/* Carrot: tapered root + small green top */}
        <Path d="M 50,88 Q 44,75 42,60 Q 41,45 50,28 Q 59,45 58,60 Q 56,75 50,88 Z"
              fill={color} fillOpacity={p.fillOpacity}
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
        {/* Green top */}
        <Path d="M 50,30 Q 42,22 38,14 Q 44,20 50,24 Q 56,20 62,14 Q 58,22 50,30 Z"
              fill={color} fillOpacity={p.fillOpacity * 0.6}
              stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.8} />
      </G>
      {p.showDetail && (
        <G id="produce_roots_detail">
          {/* Horizontal ridges on carrot body */}
          <Line x1="44" y1="55" x2="56" y2="55" stroke={color} strokeOpacity="0.25" strokeWidth="0.6" />
          <Line x1="43" y1="65" x2="57" y2="65" stroke={color} strokeOpacity="0.25" strokeWidth="0.6" />
          <Line x1="45" y1="45" x2="55" y2="45" stroke={color} strokeOpacity="0.25" strokeWidth="0.6" />
        </G>
      )}
    </G>
  )
}

function CitrusIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  return (
    <G id="produce_citrus_container">
      <G id="produce_citrus_outline">
        {/* Lemon/orange slice: circle + segment lines */}
        <Circle cx="50" cy="52" r="30"
                fill={color} fillOpacity={p.fillOpacity}
                stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} />
        {/* Inner ring */}
        <Circle cx="50" cy="52" r="24"
                fill="none"
                stroke={color} strokeOpacity={p.strokeOpacity * 0.5} strokeWidth="1" />
      </G>
      {p.showDetail && (
        <G id="produce_citrus_detail">
          {/* Segment divider lines */}
          {[
            { x1: 50, y1: 28, x2: 50, y2: 76 },
            { x1: 26, y1: 52, x2: 74, y2: 52 },
            { x1: 33, y1: 35, x2: 67, y2: 69 },
            { x1: 33, y1: 69, x2: 67, y2: 35 },
          ].map((seg, i) => (
            <Line key={`seg_${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke={color} strokeOpacity="0.3" strokeWidth="0.8" />
          ))}
          {/* Center dot */}
          <Circle cx="50" cy="52" r="2" fill={color} opacity="0.4" />
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
  return (
    <G id="produce_berries_container">
      <G id="produce_berries_outline">
        {/* Strawberry: teardrop body + calyx + seeds */}
        <Path d="M 50,82 Q 30,70 30,48 Q 30,32 50,28 Q 70,32 70,48 Q 70,70 50,82 Z"
              fill={color} fillOpacity={p.fillOpacity}
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
        {/* Calyx (leafy top) */}
        <Path d="M 50,30 Q 42,24 36,22 Q 40,28 44,30 Q 38,26 34,28 Q 40,30 46,30 Q 50,26 54,30 Q 60,30 66,28 Q 62,26 56,30 Q 60,28 64,22 Q 58,24 50,30 Z"
              fill={color} fillOpacity={p.fillOpacity * 0.6}
              stroke={color} strokeOpacity={p.strokeOpacity * 0.6} strokeWidth={p.strokeWidth * 0.7} />
      </G>
      {p.showDetail && (
        <G id="produce_berries_detail">
          {/* Seeds — small dots scattered on body */}
          {[
            { cx: 42, cy: 45 }, { cx: 55, cy: 43 }, { cx: 48, cy: 52 },
            { cx: 38, cy: 55 }, { cx: 58, cy: 55 }, { cx: 45, cy: 62 },
            { cx: 55, cy: 62 }, { cx: 50, cy: 68 }, { cx: 42, cy: 70 },
            { cx: 58, cy: 70 },
          ].map((seed, i) => (
            <Ellipse key={`seed_${i}`} cx={seed.cx} cy={seed.cy} rx="1.2" ry="2"
                     fill={color} opacity="0.4" transform={`rotate(${(seed.cx - 50) * 5} ${seed.cx} ${seed.cy})`} />
          ))}
        </G>
      )}
    </G>
  )
}

function TropicalIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  return (
    <G id="produce_tropical_container">
      <G id="produce_tropical_outline">
        {/* Pineapple: textured oval body + spiky top */}
        <Path d="M 50,82 Q 34,75 34,55 Q 34,40 50,36 Q 66,40 66,55 Q 66,75 50,82 Z"
              fill={color} fillOpacity={p.fillOpacity}
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth} strokeLinejoin="round" />
        {/* Spiky top leaves */}
        <Path d="M 50,38 Q 44,28 40,18 Q 46,24 50,32 Q 54,24 60,18 Q 56,28 50,38 Z"
              fill={color} fillOpacity={p.fillOpacity * 0.6}
              stroke={color} strokeOpacity={p.strokeOpacity * 0.6} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,36 Q 46,22 44,12 Q 50,18 50,30 Q 50,18 56,12 Q 54,22 50,36 Z"
              fill={color} fillOpacity={p.fillOpacity * 0.5}
              stroke={color} strokeOpacity={p.strokeOpacity * 0.5} strokeWidth={p.strokeWidth * 0.6} />
      </G>
      {p.showDetail && (
        <G id="produce_tropical_detail">
          {/* Diamond cross-hatch texture */}
          {[
            { y: 46 }, { y: 54 }, { y: 62 }, { y: 70 },
          ].map((row, i) => (
            <G key={`row_${i}`}>
              <Line x1="36" y1={row.y} x2="64" y2={row.y} stroke={color} strokeOpacity="0.2" strokeWidth="0.6" />
              <Line x1="36" y1={row.y - 4} x2="64" y2={row.y + 4} stroke={color} strokeOpacity="0.15" strokeWidth="0.5" />
              <Line x1="36" y1={row.y + 4} x2="64" y2={row.y - 4} stroke={color} strokeOpacity="0.15" strokeWidth="0.5" />
            </G>
          ))}
        </G>
      )}
    </G>
  )
}

function HerbsIcon({ tier, color }) {
  const p = TIER_PROPS[tier]
  return (
    <G id="produce_herbs_container">
      <G id="produce_herbs_outline">
        {/* Mint sprig: stem + alternating small leaves */}
        <Path d="M 50,85 Q 50,65 50,40 Q 50,25 50,15"
              stroke={color} strokeOpacity={p.strokeOpacity} strokeWidth={p.strokeWidth * 1.2} fill="none" strokeLinecap="round" />
        {/* Alternating leaves */}
        <Path d="M 50,68 Q 40,64 34,58 Q 42,60 50,68 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,68 Q 60,64 66,58 Q 58,60 50,68 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,52 Q 38,48 32,40 Q 42,44 50,52 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,52 Q 62,48 68,40 Q 58,44 50,52 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,36 Q 40,32 35,24 Q 44,28 50,36 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
        <Path d="M 50,36 Q 60,32 65,24 Q 56,28 50,36 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
        {/* Top leaf */}
        <Path d="M 50,22 Q 46,18 44,14 Q 50,16 50,22 Q 50,16 56,14 Q 54,18 50,22 Z" fill={color} fillOpacity={p.fillOpacity} stroke={color} strokeOpacity={p.strokeOpacity * 0.7} strokeWidth={p.strokeWidth * 0.7} />
      </G>
      {p.showDetail && (
        <G id="produce_herbs_detail">
          {/* Leaf vein details */}
          <Line x1="50" y1="68" x2="36" y2="60" stroke={color} strokeOpacity="0.25" strokeWidth="0.5" />
          <Line x1="50" y1="68" x2="64" y2="60" stroke={color} strokeOpacity="0.25" strokeWidth="0.5" />
          <Line x1="50" y1="52" x2="34" y2="42" stroke={color} strokeOpacity="0.25" strokeWidth="0.5" />
          <Line x1="50" y1="52" x2="66" y2="42" stroke={color} strokeOpacity="0.25" strokeWidth="0.5" />
        </G>
      )}
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
