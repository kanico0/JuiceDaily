// ─────────────────────────────────────────────────────────────
// GardenCompactArtwork.js — Compact Garden SVG for the
// Today-screen card. 3×3 grid with 7 produce beds + Tree + Arbor.
//
// FINAL handoff layout:
//   Greens      Roots       Citrus
//   Orchard     Tropical    Berries
//   Journey     Herbs       Milestone
//    Tree                    Arbor
//
// viewBox: 0 0 160 200
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { G, Rect, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg'
import GardenProduceIcon, { getRevealTier } from './GardenProduceIcons'
import GardenColorMarker from './GardenColorMarkers'
import JourneyTreeArtwork from './JourneyTreeArtwork'
import MilestoneArborArtwork from './MilestoneArborArtwork'
import {
  GARDEN_PALETTE,
  BED_POSITIONS_COMPACT,
  TREE_POSITION_COMPACT,
  ARBOR_POSITION_COMPACT,
  getColorMarkerColor,
} from './GardenVisualState'
import { GARDEN_BEDS, GARDEN_COLORS, BED_METADATA } from '../constants/gardenTaxonomy'

const BED_COLORS = {
  greens: '#5FD98A',
  roots: '#E8873A',
  citrus: '#F2C14E',
  orchard: '#E0605A',
  berries: '#A374C9',
  tropical: '#B9D94A',
  herbs: '#8FBF9F',
}

const COLOR_MARKER_POSITIONS_COMPACT = {
  green:  { cx: 20,  cy: 194 },
  red:    { cx: 44,  cy: 194 },
  orange: { cx: 68,  cy: 194 },
  yellow: { cx: 92,  cy: 194 },
  purple: { cx: 116, cy: 194 },
  tan:    { cx: 140, cy: 194 },
}

const GOLD_BORDER = '#E8B84B'

function GardenCompactArtwork({
  visualState,
  size = 140,
  isReduced = false,
  journeyStageKey = null,
  arborCtx = null,
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
            <Stop offset="0%" stopColor="#E8B84B" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#5FD98A" stopOpacity="0" />
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

        {/* garden_compact_beds — 7 produce beds */}
        <G id="garden_compact_beds">
          {GARDEN_BEDS.map((bedKey) => {
            const bedVisual = bedVisuals[bedKey]
            if (!bedVisual) return null
            const pos = BED_POSITIONS_COMPACT[bedKey]
            const iconSize = Math.min(pos.w, pos.h) * 0.7
            const iconX = pos.x + (pos.w - iconSize) / 2
            const iconY = pos.y + (pos.h - iconSize) / 2 - 2
            return (
              <G key={bedKey} id={`garden_compact_bed_${bedKey}`}>
                <Rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx={5}
                  fill={GARDEN_PALETTE.bedSoilColor}
                  stroke={GARDEN_PALETTE.bedBorder}
                  strokeWidth="0.5"
                />
                <G transform={`translate(${iconX}, ${iconY})`}>
                  <GardenProduceIcon
                    bedKey={bedKey}
                    stageKey={bedVisual.stageKey}
                    color={BED_COLORS[bedKey]}
                    size={iconSize}
                  />
                </G>
                {/* Label */}
                <SvgText
                  x={pos.x + pos.w / 2}
                  y={pos.y + pos.h - 3}
                  fontSize="4"
                  fontWeight="600"
                  fill={GARDEN_PALETTE.textSecondary}
                  textAnchor="middle"
                  opacity={bedVisual.count > 0 ? 0.9 : 0.4}
                >
                  {BED_METADATA[bedKey].shortLabel}
                </SvgText>
              </G>
            )
          })}
        </G>

        {/* garden_compact_tree — Journey Tree (bottom-left) */}
        <G id="garden_compact_tree">
          <Rect
            x={TREE_POSITION_COMPACT.x}
            y={TREE_POSITION_COMPACT.y}
            width={TREE_POSITION_COMPACT.w}
            height={TREE_POSITION_COMPACT.h}
            rx={5}
            fill={GARDEN_PALETTE.bedSoilColor}
            stroke={GOLD_BORDER}
            strokeWidth="0.8"
            strokeOpacity="0.55"
          />
          <G transform={`translate(${TREE_POSITION_COMPACT.x + 4}, ${TREE_POSITION_COMPACT.y + 4})`}>
            <JourneyTreeArtwork stageKey={journeyStageKey} size={32} />
          </G>
          <SvgText
            x={TREE_POSITION_COMPACT.x + TREE_POSITION_COMPACT.w / 2}
            y={TREE_POSITION_COMPACT.y + TREE_POSITION_COMPACT.h - 3}
            fontSize="4"
            fontWeight="700"
            fill={GARDEN_PALETTE.textPrimary}
            textAnchor="middle"
          >
            Tree
          </SvgText>
        </G>

        {/* garden_compact_arbor — Milestone Arbor (bottom-right) */}
        <G id="garden_compact_arbor">
          <Rect
            x={ARBOR_POSITION_COMPACT.x}
            y={ARBOR_POSITION_COMPACT.y}
            width={ARBOR_POSITION_COMPACT.w}
            height={ARBOR_POSITION_COMPACT.h}
            rx={5}
            fill={GARDEN_PALETTE.bedSoilColor}
            stroke={GOLD_BORDER}
            strokeWidth="0.8"
            strokeOpacity="0.55"
          />
          <G transform={`translate(${ARBOR_POSITION_COMPACT.x + 4}, ${ARBOR_POSITION_COMPACT.y + 4})`}>
            <MilestoneArborArtwork ctx={arborCtx} size={32} />
          </G>
          <SvgText
            x={ARBOR_POSITION_COMPACT.x + ARBOR_POSITION_COMPACT.w / 2}
            y={ARBOR_POSITION_COMPACT.y + ARBOR_POSITION_COMPACT.h - 3}
            fontSize="4"
            fontWeight="700"
            fill={GARDEN_PALETTE.textPrimary}
            textAnchor="middle"
          >
            Arbor
          </SvgText>
        </G>

        {/* garden_compact_color_markers — shaped markers */}
        <G id="garden_compact_color_markers">
          {GARDEN_COLORS.map((colorKey) => {
            const marker = colorMarkers[colorKey]
            if (!marker) return null
            const pos = COLOR_MARKER_POSITIONS_COMPACT[colorKey]
            const markerColor = getColorMarkerColor(colorKey)
            return (
              <G key={colorKey} id={`garden_compact_color_${colorKey}`}
                 transform={`translate(${pos.cx - 5}, ${pos.cy - 5})`}>
                <GardenColorMarker
                  colorKey={colorKey}
                  discovered={marker.discovered}
                  color={markerColor}
                  size={10}
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
