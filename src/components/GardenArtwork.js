// ─────────────────────────────────────────────────────────────
// GardenArtwork.js — Full-screen Garden SVG composition.
// Renders the 3×3 grid: 7 produce beds + Journey Tree +
// Milestone Arbor, with shaped color markers and Rainbow Harvest.
//
// FINAL handoff layout (03_tree_and_arbor_addendum.md §1):
//   Greens      Roots       Citrus
//   Orchard     Tropical    Berries
//   Journey     Herbs       Milestone
//    Tree                    Arbor
//
// viewBox: 0 0 400 520
// Named groups: garden_canvas, garden_beds, garden_color_markers,
//               garden_rainbow_harvest, garden_tree, garden_arbor
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { G, Rect, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg'
import GardenProduceIcon, { getRevealTier } from './GardenProduceIcons'
import GardenColorMarker from './GardenColorMarkers'
import JourneyTreeArtwork from './JourneyTreeArtwork'
import MilestoneArborArtwork from './MilestoneArborArtwork'
import {
  GARDEN_PALETTE,
  BED_POSITIONS,
  TREE_POSITION,
  ARBOR_POSITION,
  getColorMarkerColor,
} from './GardenVisualState'
import { GARDEN_BEDS, GARDEN_COLORS, BED_METADATA } from '../constants/gardenTaxonomy'

// Bed accent colors (FINAL handoff dark palette)
const BED_COLORS = {
  greens: '#5FD98A',
  roots: '#E8873A',
  citrus: '#F2C14E',
  orchard: '#E0605A',
  berries: '#A374C9',
  tropical: '#B9D94A',
  herbs: '#8FBF9F',
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

const GOLD_BORDER = '#E8B84B'

function GardenArtwork({
  visualState,
  size = 380,
  isReduced = false,
  highlightBed = null,
  rainbowGlow = false,
  journeyStageKey = null,
  arborCtx = null,
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
            <Stop offset="0%" stopColor="#E8B84B" stopOpacity="0.15" />
            <Stop offset="50%" stopColor="#5FD98A" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#5FD98A" stopOpacity="0" />
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

        {/* garden_beds — 7 produce beds with literal icons */}
        <G id="garden_beds">
          {GARDEN_BEDS.map((bedKey) => {
            const bedVisual = bedVisuals[bedKey]
            if (!bedVisual) return null
            const pos = BED_POSITIONS[bedKey]
            const tier = getRevealTier(bedVisual.stageKey)
            const isPermanent = false
            const iconSize = Math.min(pos.w, pos.h) * 0.7
            const iconX = pos.x + (pos.w - iconSize) / 2
            const iconY = pos.y + (pos.h - iconSize) / 2 - 5
            return (
              <G key={bedKey} id={`garden_bed_${bedKey}`}>
                {/* Card background */}
                <Rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx={12}
                  fill={GARDEN_PALETTE.bedSoilColor}
                  stroke={highlightBed === bedKey ? 'rgba(95,217,138,0.35)' : GARDEN_PALETTE.bedBorder}
                  strokeWidth={highlightBed === bedKey ? 1.5 : 0.8}
                />
                {/* Literal produce icon */}
                <G transform={`translate(${iconX}, ${iconY})`}>
                  <GardenProduceIcon
                    bedKey={bedKey}
                    stageKey={bedVisual.stageKey}
                    color={BED_COLORS[bedKey]}
                    size={iconSize}
                  />
                </G>
                {/* Bed label */}
                <SvgText
                  x={pos.x + pos.w / 2}
                  y={pos.y + pos.h - 8}
                  fontSize="10"
                  fontWeight="600"
                  fill={GARDEN_PALETTE.textSecondary}
                  textAnchor="middle"
                  opacity={bedVisual.count > 0 ? 1 : 0.5}
                >
                  {BED_METADATA[bedKey].shortLabel}
                </SvgText>
              </G>
            )
          })}
        </G>

        {/* garden_tree — Journey Tree (bottom-left) */}
        <G id="garden_tree">
          <Rect
            x={TREE_POSITION.x}
            y={TREE_POSITION.y}
            width={TREE_POSITION.w}
            height={TREE_POSITION.h}
            rx={12}
            fill={GARDEN_PALETTE.bedSoilColor}
            stroke={GOLD_BORDER}
            strokeWidth="1.4"
            strokeOpacity="0.55"
          />
          <G transform={`translate(${TREE_POSITION.x + 15}, ${TREE_POSITION.y + 10})`}>
            <JourneyTreeArtwork stageKey={journeyStageKey} size={70} />
          </G>
          <SvgText
            x={TREE_POSITION.x + TREE_POSITION.w / 2}
            y={TREE_POSITION.y + TREE_POSITION.h - 8}
            fontSize="9"
            fontWeight="700"
            fill={GARDEN_PALETTE.textPrimary}
            textAnchor="middle"
          >
            Journey Tree
          </SvgText>
        </G>

        {/* garden_arbor — Milestone Arbor (bottom-right) */}
        <G id="garden_arbor">
          <Rect
            x={ARBOR_POSITION.x}
            y={ARBOR_POSITION.y}
            width={ARBOR_POSITION.w}
            height={ARBOR_POSITION.h}
            rx={12}
            fill={GARDEN_PALETTE.bedSoilColor}
            stroke={GOLD_BORDER}
            strokeWidth="1.4"
            strokeOpacity="0.55"
          />
          <G transform={`translate(${ARBOR_POSITION.x + 15}, ${ARBOR_POSITION.y + 10})`}>
            <MilestoneArborArtwork ctx={arborCtx} size={70} />
          </G>
          <SvgText
            x={ARBOR_POSITION.x + ARBOR_POSITION.w / 2}
            y={ARBOR_POSITION.y + ARBOR_POSITION.h - 8}
            fontSize="9"
            fontWeight="700"
            fill={GARDEN_PALETTE.textPrimary}
            textAnchor="middle"
          >
            Milestone Arbor
          </SvgText>
        </G>

        {/* garden_color_markers — shaped markers */}
        <G id="garden_color_markers">
          {GARDEN_COLORS.map((colorKey) => {
            const marker = colorMarkers[colorKey]
            if (!marker) return null
            const pos = COLOR_MARKER_POSITIONS[colorKey]
            const markerColor = getColorMarkerColor(colorKey)
            return (
              <G key={colorKey} id={`garden_color_${colorKey}`}
                 transform={`translate(${pos.cx - 10}, ${pos.cy - 10})`}>
                <GardenColorMarker
                  colorKey={colorKey}
                  discovered={marker.discovered}
                  color={markerColor}
                  size={20}
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

export default GardenArtwork
