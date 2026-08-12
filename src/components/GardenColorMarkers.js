// ─────────────────────────────────────────────────────────────
// GardenColorMarkers.js — Distinct shaped color-coverage markers.
//
// FINAL handoff §5.1: "give the six color-coverage dots distinct
// shapes, not just hue — leaf / circle / diamond / sun-rays /
// berry-cluster / seed."
//
// Each marker has two states:
//   discovered  — full shape at full opacity
//   not discovered — faint outline only
//
// Named groups: color_marker_<key> with _discovered / _empty
// children matching the system's earned/unearned pattern.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import Svg, { G, Path, Circle, Polygon, Line, Ellipse } from 'react-native-svg'

const MARKER_SIZE = 24

function LeafMarker({ color, discovered }) {
  const opacity = discovered ? 1 : 0.3
  const fill = discovered ? color : 'none'
  const stroke = discovered ? 'none' : color
  return (
    <G id="color_marker_green">
      <Path d="M 12,4 Q 4,8 4,16 Q 4,20 12,20 Q 20,20 20,16 Q 20,8 12,4 Z"
            fill={fill} fillOpacity={opacity}
            stroke={stroke} strokeOpacity={0.4} strokeWidth="1.2" />
      {discovered && (
        <Path d="M 12,6 Q 12,14 12,18" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="0.8" fill="none" />
      )}
    </G>
  )
}

function CircleMarker({ color, discovered }) {
  const opacity = discovered ? 1 : 0.3
  const fill = discovered ? color : 'none'
  const stroke = discovered ? 'none' : color
  return (
    <G id="color_marker_red">
      <Circle cx="12" cy="12" r="8"
              fill={fill} fillOpacity={opacity}
              stroke={stroke} strokeOpacity={0.4} strokeWidth="1.2" />
    </G>
  )
}

function DiamondMarker({ color, discovered }) {
  const opacity = discovered ? 1 : 0.3
  const fill = discovered ? color : 'none'
  const stroke = discovered ? 'none' : color
  return (
    <G id="color_marker_orange">
      <Polygon points="12,3 21,12 12,21 3,12"
               fill={fill} fillOpacity={opacity}
               stroke={stroke} strokeOpacity={0.4} strokeWidth="1.2" />
    </G>
  )
}

function SunRaysMarker({ color, discovered }) {
  const opacity = discovered ? 1 : 0.3
  const fill = discovered ? color : 'none'
  const stroke = discovered ? 'none' : color
  const rays = [
    { x1: 12, y1: 2, x2: 12, y2: 5 },
    { x1: 12, y1: 19, x2: 12, y2: 22 },
    { x1: 2, y1: 12, x2: 5, y2: 12 },
    { x1: 19, y1: 12, x2: 22, y2: 12 },
    { x1: 5, y1: 5, x2: 7, y2: 7 },
    { x1: 17, y1: 17, x2: 19, y2: 19 },
    { x1: 5, y1: 19, x2: 7, y2: 17 },
    { x1: 17, y1: 7, x2: 19, y2: 5 },
  ]
  return (
    <G id="color_marker_yellow">
      <Circle cx="12" cy="12" r="5"
              fill={fill} fillOpacity={opacity}
              stroke={stroke} strokeOpacity={0.4} strokeWidth="1" />
      {rays.map((ray, i) => (
        <Line key={`ray_${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
              stroke={color} strokeOpacity={opacity * 0.7} strokeWidth="1.2" strokeLinecap="round" />
      ))}
    </G>
  )
}

function BerryClusterMarker({ color, discovered }) {
  const opacity = discovered ? 1 : 0.3
  const fill = discovered ? color : 'none'
  const stroke = discovered ? 'none' : color
  return (
    <G id="color_marker_purple">
      <Circle cx="8" cy="14" r="4" fill={fill} fillOpacity={opacity} stroke={stroke} strokeOpacity={0.4} strokeWidth="1" />
      <Circle cx="15" cy="10" r="4" fill={fill} fillOpacity={opacity} stroke={stroke} strokeOpacity={0.4} strokeWidth="1" />
      <Circle cx="12" cy="16" r="3.5" fill={fill} fillOpacity={opacity} stroke={stroke} strokeOpacity={0.4} strokeWidth="1" />
    </G>
  )
}

function SeedMarker({ color, discovered }) {
  const opacity = discovered ? 1 : 0.3
  const fill = discovered ? color : 'none'
  const stroke = discovered ? 'none' : color
  return (
    <G id="color_marker_tan">
      <Ellipse cx="12" cy="12" rx="4" ry="8"
               fill={fill} fillOpacity={opacity}
               stroke={stroke} strokeOpacity={0.4} strokeWidth="1.2"
               transform="rotate(20 12 12)" />
    </G>
  )
}

const MARKER_COMPONENTS = {
  green: LeafMarker,
  red: CircleMarker,
  orange: DiamondMarker,
  yellow: SunRaysMarker,
  purple: BerryClusterMarker,
  tan: SeedMarker,
}

function GardenColorMarker({ colorKey, discovered, color, size = MARKER_SIZE }) {
  const MarkerComponent = MARKER_COMPONENTS[colorKey]
  if (!MarkerComponent) return null
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24"
         accessibilityLabel={`${colorKey} color ${discovered ? 'discovered' : 'not yet discovered'}`}>
      <MarkerComponent color={color} discovered={discovered} />
    </Svg>
  )
}

export default GardenColorMarker
