// ─────────────────────────────────────────────────────────────
// GardenArtwork.js — Full-screen Garden SVG composition.
// Renders all 7 beds in their positioned layout with
// toggleable growth layers, color markers, and Rainbow Harvest.
//
// viewBox: 0 0 400 520
// Named groups: garden_canvas, garden_beds, garden_color_markers,
//               garden_rainbow_harvest
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { G, Rect, Circle, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg'
import GardenBedArtwork from './GardenBedArtwork'
import {
  GARDEN_PALETTE,
  BED_POSITIONS,
  getColorMarkerColor,
} from './GardenVisualState'
import { GARDEN_BEDS, GARDEN_COLORS, BED_METADATA } from '../constants/gardenTaxonomy'

// Bed accent colors (provisional palette)
const BED_COLORS = {
  greens: '#81C784',
  roots: '#FFB74D',
  citrus: '#FFD54F',
  orchard: '#E91E63',
  berries: '#AB47BC',
  tropical: '#FF7043',
  herbs: '#66BB6A',
}

// Color marker positions on the full canvas (bottom strip)
const COLOR_MARKER_POSITIONS = {
  green:  { cx: 50,  cy: 500 },
  red:    { cx: 110, cy: 500 },
  orange: { cx: 170, cy: 500 },
  yellow: { cx: 230, cy: 500 },
  purple: { cx: 290, cy: 500 },
  tan:    { cx: 350, cy: 500 },
}

function GardenArtwork({
  visualState,
  size = 380,
  isReduced = false,
  highlightBed = null,
  rainbowGlow = false,
}) {
  const rainbowGradId = useMemo(
    () => `garden_rainbow_${Math.random().toString(36).slice(2, 8)}`,
    []
  )

  if (!visualState) {
    return (
      <View style={[styles.container, { width: size, height: size * 1.3 }]} />
    )
  }

  const { bedVisuals, colorMarkers, rainbowComplete } = visualState

  return (
    <View style={[styles.container, { width: size, height: size * 1.3 }]}>
      <Svg
        width={size}
        height={size * 1.3}
        viewBox="0 0 400 520"
        accessibilityLabel="RawLife Garden progress visualization"
        accessibilityRole="image"
      >
        <Defs>
          <RadialGradient id={rainbowGradId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F5D98B" stopOpacity="0.15" />
            <Stop offset="50%" stopColor="#81C784" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#81C784" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* garden_canvas */}
        <G id="garden_canvas">
          <Rect x="0" y="0" width="400" height="520" fill={GARDEN_PALETTE.canvasColor} rx="16" />
        </G>

        {/* garden_rainbow_harvest glow */}
        <G id="garden_rainbow_harvest" display={rainbowComplete || rainbowGlow ? 'inline' : 'none'}>
          <Rect x="0" y="0" width="400" height="520" fill={`url(#${rainbowGradId})`} />
        </G>

        {/* garden_beds */}
        <G id="garden_beds">
          {GARDEN_BEDS.map((bedKey) => {
            const bedVisual = bedVisuals[bedKey]
            if (!bedVisual) return null
            return (
              <G key={bedKey} id={`garden_bed_${bedKey}`}>
                <GardenBedArtwork
                  bedKey={bedKey}
                  stageKey={bedVisual.stageKey}
                  position={BED_POSITIONS[bedKey]}
                  bedColor={BED_COLORS[bedKey]}
                  isCompact={false}
                  highlight={highlightBed === bedKey}
                />
                {/* Bed label */}
                <SvgText
                  x={BED_POSITIONS[bedKey].x + BED_POSITIONS[bedKey].w / 2}
                  y={BED_POSITIONS[bedKey].y + BED_POSITIONS[bedKey].h + 14}
                  fontSize="9"
                  fill={GARDEN_PALETTE.textSecondary}
                  textAnchor="middle"
                  opacity={bedVisual.count > 0 ? 1 : 0.4}
                >
                  {BED_METADATA[bedKey].shortLabel}
                </SvgText>
              </G>
            )
          })}
        </G>

        {/* garden_color_markers */}
        <G id="garden_color_markers">
          {GARDEN_COLORS.map((colorKey) => {
            const marker = colorMarkers[colorKey]
            if (!marker) return null
            const pos = COLOR_MARKER_POSITIONS[colorKey]
            return (
              <G key={colorKey} id={`garden_color_${colorKey}`}>
                <Circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={marker.discovered ? 8 : 6}
                  fill={marker.discovered ? marker.color : 'rgba(255,255,255,0.08)'}
                  opacity={marker.discovered ? 0.9 : 0.3}
                />
                {marker.discovered && (
                  <Circle
                    cx={pos.cx}
                    cy={pos.cy}
                    r={11}
                    fill="none"
                    stroke={marker.color}
                    strokeWidth="1"
                    opacity="0.3"
                  />
                )}
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

export default GardenArtwork
