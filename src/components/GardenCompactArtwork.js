// ─────────────────────────────────────────────────────────────
// GardenCompactArtwork.js — Compact Garden SVG for the
// Today-screen card. Scaled-down composition with all 7 beds
// and color marker strip.
//
// viewBox: 0 0 160 200
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { G, Rect, Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import GardenBedArtwork from './GardenBedArtwork'
import {
  GARDEN_PALETTE,
  BED_POSITIONS_COMPACT,
} from './GardenVisualState'
import { GARDEN_BEDS, GARDEN_COLORS } from '../constants/gardenTaxonomy'

const BED_COLORS = {
  greens: '#81C784',
  roots: '#FFB74D',
  citrus: '#FFD54F',
  orchard: '#E91E63',
  berries: '#AB47BC',
  tropical: '#FF7043',
  herbs: '#66BB6A',
}

const COLOR_MARKER_POSITIONS_COMPACT = {
  green:  { cx: 20,  cy: 194 },
  red:    { cx: 44,  cy: 194 },
  orange: { cx: 68,  cy: 194 },
  yellow: { cx: 92,  cy: 194 },
  purple: { cx: 116, cy: 194 },
  tan:    { cx: 140, cy: 194 },
}

function GardenCompactArtwork({
  visualState,
  size = 140,
  isReduced = false,
}) {
  if (!visualState) {
    return <View style={[styles.container, { width: size, height: size * 1.25 }]} />
  }

  const { bedVisuals, colorMarkers, rainbowComplete } = visualState

  return (
    <View style={[styles.container, { width: size, height: size * 1.25 }]}>
      <Svg
        width={size}
        height={size * 1.25}
        viewBox="0 0 160 200"
        accessibilityLabel="RawLife Garden compact progress"
        accessibilityRole="image"
      >
        <Defs>
          <RadialGradient id="garden_compact_rainbow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F5D98B" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#81C784" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* garden_compact_canvas */}
        <G id="garden_compact_canvas">
          <Rect x="0" y="0" width="160" height="200" fill={GARDEN_PALETTE.canvasColor} rx="8" />
        </G>

        {/* garden_compact_rainbow */}
        <G id="garden_compact_rainbow" display={rainbowComplete ? 'inline' : 'none'}>
          <Rect x="0" y="0" width="160" height="200" fill="url(#garden_compact_rainbow)" />
        </G>

        {/* garden_compact_beds */}
        <G id="garden_compact_beds">
          {GARDEN_BEDS.map((bedKey) => {
            const bedVisual = bedVisuals[bedKey]
            if (!bedVisual) return null
            return (
              <G key={bedKey} id={`garden_compact_bed_${bedKey}`}>
                <GardenBedArtwork
                  bedKey={bedKey}
                  stageKey={bedVisual.stageKey}
                  position={BED_POSITIONS_COMPACT[bedKey]}
                  bedColor={BED_COLORS[bedKey]}
                  isCompact={true}
                />
              </G>
            )
          })}
        </G>

        {/* garden_compact_color_markers */}
        <G id="garden_compact_color_markers">
          {GARDEN_COLORS.map((colorKey) => {
            const marker = colorMarkers[colorKey]
            if (!marker) return null
            const pos = COLOR_MARKER_POSITIONS_COMPACT[colorKey]
            return (
              <G key={colorKey} id={`garden_compact_color_${colorKey}`}>
                <Circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={marker.discovered ? 3 : 2}
                  fill={marker.discovered ? marker.color : 'rgba(255,255,255,0.08)'}
                  opacity={marker.discovered ? 0.9 : 0.3}
                />
              </G>
            )
          })}
        </G>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default GardenCompactArtwork
