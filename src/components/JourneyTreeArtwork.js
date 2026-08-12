// ─────────────────────────────────────────────────────────────
// JourneyTreeArtwork.js — Pure second renderer of the existing
// canonical Journey Stage (same data the Glow Journey Drop uses).
//
// FINAL handoff 03_tree_and_arbor_addendum.md §2:
//   - No new metric, threshold, persistence, or progression engine
//   - Bound directly to existing journeyStage value
//   - Canonical stage name is primary label
//   - Tree descriptor is secondary visual language
//   - Exists from Day 1 (as Seed, not absent)
//   - Never resets or regresses
//   - Ghost the next canopy layer above current growth
//
// Visual stage matrix (03_tree_and_arbor_addendum.md §2.3):
//   Seed           -> Seed           (none, none, pale soil mark)
//   Sprout         -> Sprout         (thin line, two tiny leaves)
//   Growing        -> Sapling        (thin trunk, one canopy circle)
//   Blooming       -> Young Tree     (fuller trunk, two canopy circles, blossoms)
//   Thriving       -> Established Tree (full trunk, three-lobe canopy, gold vein trim)
//   Radiant        -> Elder Tree     (full trunk, fuller canopy, gold rays)
//   RawLife Legend -> Heritage Tree  (richest bark, fullest canopy, gold trim + rays + resting glow)
//
// No Heritage bird for this release.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import Svg, { G, Path, Circle, Line, Ellipse } from 'react-native-svg'
import { GLOW_JOURNEY_PALETTE } from './GlowJourneyVisualState'

// ── Tree descriptors (secondary labels) ──────────────────────
export const TREE_DESCRIPTORS = {
  seed: 'Seed',
  sprout: 'Sprout',
  growing: 'Sapling',
  blooming: 'Young Tree',
  thriving: 'Established Tree',
  radiant: 'Elder Tree',
  legend: 'Heritage Tree',
}

function JourneyTreeArtwork({ stageKey, size = 118 }) {
  if (!stageKey) {
    // Before first juice — render as Seed (tree exists from Day 1)
    stageKey = 'seed'
  }

  const goldTrim = GLOW_JOURNEY_PALETTE.stageGoldTrim
  // Correction addendum §2.2: deepen canopy green for better visual presence.
  // Use a deeper mint/green than the juice top band.
  const canopyColor = '#4C8F63'
  const trunkColor = '#7A5B44'
  const soilColor = GLOW_JOURNEY_PALETTE.haloUnfilledStroke

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100"
         accessibilityLabel={`Journey Tree: ${stageKey} stage`}>
      <G id="tree_container">
        <JourneyTreeStage
          stageKey={stageKey}
          goldTrim={goldTrim}
          canopyColor={canopyColor}
          trunkColor={trunkColor}
          soilColor={soilColor}
        />
      </G>
    </Svg>
  )
}

function JourneyTreeStage({ stageKey, goldTrim, canopyColor, trunkColor, soilColor }) {
  switch (stageKey) {
    case 'seed':
      return (
        <G id="tree_seed">
          {/* Small pale soil mark at base */}
          <Ellipse cx="50" cy="82" rx="12" ry="4" fill={soilColor} opacity="0.5" />
          <Circle cx="50" cy="80" r="3" fill={canopyColor} opacity="0.4" />
          {/* Ghost next: sprout */}
          <G id="tree_canopy_ghost_next" opacity="0.35">
            <Line x1="50" y1="80" x2="50" y2="65" stroke={canopyColor} strokeWidth="1" />
            <Path d="M 50,70 Q 44,68 42,64 Q 47,65 50,70 Z" fill="none" stroke={canopyColor} strokeWidth="0.8" />
            <Path d="M 50,70 Q 56,68 58,64 Q 53,65 50,70 Z" fill="none" stroke={canopyColor} strokeWidth="0.8" />
          </G>
        </G>
      )
    case 'sprout':
      return (
        <G id="tree_sprout">
          <Ellipse cx="50" cy="84" rx="10" ry="3" fill={soilColor} opacity="0.4" />
          {/* Thin single line trunk */}
          <Line x1="50" y1="84" x2="50" y2="55" stroke={trunkColor} strokeWidth="2" strokeLinecap="round" />
          {/* Two tiny leaves */}
          <Path d="M 50,68 Q 42,66 38,60 Q 45,62 50,68 Z" fill={canopyColor} opacity="0.85" />
          <Path d="M 50,68 Q 58,66 62,60 Q 55,62 50,68 Z" fill={canopyColor} opacity="0.85" />
          {/* Ghost next: sapling */}
          <G id="tree_canopy_ghost_next" opacity="0.35">
            <Circle cx="50" cy="48" r="10" fill="none" stroke={canopyColor} strokeWidth="0.8" />
          </G>
        </G>
      )
    case 'growing':
      return (
        <G id="tree_growing">
          <Ellipse cx="50" cy="86" rx="14" ry="3" fill={soilColor} opacity="0.3" />
          {/* Thin trunk */}
          <Path d="M 50,86 Q 49,70 50,50" stroke={trunkColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* One small canopy circle */}
          <Circle cx="50" cy="42" r="14" fill={canopyColor} opacity="0.8" />
          <Circle cx="50" cy="42" r="14" fill="none" stroke={canopyColor} strokeWidth="1" opacity="0.4" />
          {/* Ghost next: two canopy circles */}
          <G id="tree_canopy_ghost_next" opacity="0.35">
            <Circle cx="40" cy="36" r="9" fill="none" stroke={canopyColor} strokeWidth="0.8" />
            <Circle cx="60" cy="36" r="9" fill="none" stroke={canopyColor} strokeWidth="0.8" />
          </G>
        </G>
      )
    case 'blooming':
      return (
        <G id="tree_blooming">
          <Ellipse cx="50" cy="88" rx="16" ry="3" fill={soilColor} opacity="0.25" />
          {/* Fuller trunk */}
          <Path d="M 50,88 Q 48,70 50,45" stroke={trunkColor} strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Two canopy circles */}
          <Circle cx="40" cy="38" r="12" fill={canopyColor} opacity="0.85" />
          <Circle cx="60" cy="38" r="12" fill={canopyColor} opacity="0.85" />
          <Circle cx="50" cy="30" r="10" fill={canopyColor} opacity="0.8" />
          {/* Blossom dots */}
          <G id="tree_blossoms">
            <Circle cx="38" cy="36" r="1.5" fill="#F3D6DC" opacity="0.9" />
            <Circle cx="42" cy="34" r="1.5" fill="#F3D6DC" opacity="0.9" />
            <Circle cx="58" cy="36" r="1.5" fill="#F3D6DC" opacity="0.9" />
            <Circle cx="62" cy="34" r="1.5" fill="#F3D6DC" opacity="0.9" />
            <Circle cx="50" cy="28" r="1.5" fill="#F3D6DC" opacity="0.9" />
          </G>
          {/* Ghost next: three-lobe canopy */}
          <G id="tree_canopy_ghost_next" opacity="0.35">
            <Circle cx="30" cy="40" r="8" fill="none" stroke={canopyColor} strokeWidth="0.8" />
            <Circle cx="70" cy="40" r="8" fill="none" stroke={canopyColor} strokeWidth="0.8" />
          </G>
        </G>
      )
    case 'thriving':
      return (
        <G id="tree_thriving">
          <Ellipse cx="50" cy="90" rx="18" ry="3" fill={soilColor} opacity="0.2" />
          {/* Full trunk */}
          <Path d="M 50,90 Q 47,65 50,40" stroke={trunkColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {/* Three-lobe canopy */}
          <Circle cx="35" cy="38" r="14" fill={canopyColor} opacity="0.9" />
          <Circle cx="65" cy="38" r="14" fill={canopyColor} opacity="0.9" />
          <Circle cx="50" cy="26" r="13" fill={canopyColor} opacity="0.9" />
          {/* Gold vein trim (reuses Drop's Thriving motif) */}
          <G id="tree_gold_vein_trim">
            <Line x1="35" y1="38" x2="50" y2="26" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
            <Line x1="65" y1="38" x2="50" y2="26" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
            <Line x1="35" y1="38" x2="65" y2="38" stroke={goldTrim} strokeWidth="0.8" opacity="0.5" />
          </G>
          {/* Blossoms */}
          <G id="tree_blossoms">
            <Circle cx="35" cy="36" r="1.5" fill="#F3D6DC" opacity="0.8" />
            <Circle cx="65" cy="36" r="1.5" fill="#F3D6DC" opacity="0.8" />
            <Circle cx="50" cy="24" r="1.5" fill="#F3D6DC" opacity="0.8" />
          </G>
          {/* Ghost next: fuller canopy */}
          <G id="tree_canopy_ghost_next" opacity="0.35">
            <Circle cx="25" cy="42" r="7" fill="none" stroke={canopyColor} strokeWidth="0.8" />
            <Circle cx="75" cy="42" r="7" fill="none" stroke={canopyColor} strokeWidth="0.8" />
          </G>
        </G>
      )
    case 'radiant':
      return (
        <G id="tree_radiant">
          <Ellipse cx="50" cy="90" rx="20" ry="3" fill={soilColor} opacity="0.15" />
          {/* Full trunk, richer bark tone */}
          <Path d="M 50,90 Q 46,62 50,35" stroke={trunkColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          {/* Fuller, denser canopy */}
          <Circle cx="30" cy="38" r="16" fill={canopyColor} opacity="0.95" />
          <Circle cx="70" cy="38" r="16" fill={canopyColor} opacity="0.95" />
          <Circle cx="50" cy="22" r="15" fill={canopyColor} opacity="0.95" />
          <Circle cx="40" cy="30" r="10" fill={canopyColor} opacity="0.9" />
          <Circle cx="60" cy="30" r="10" fill={canopyColor} opacity="0.9" />
          {/* Soft gold rays behind canopy (reuses Drop's Radiant motif) */}
          <G id="tree_rays">
            {[
              { x1: 50, y1: 30, x2: 50, y2: 0 },
              { x1: 50, y1: 30, x2: 75, y2: 10 },
              { x1: 50, y1: 30, x2: 100, y2: 30 },
              { x1: 50, y1: 30, x2: 75, y2: 50 },
              { x1: 50, y1: 30, x2: 25, y2: 50 },
              { x1: 50, y1: 30, x2: 0, y2: 30 },
              { x1: 50, y1: 30, x2: 25, y2: 10 },
            ].map((ray, i) => (
              <Line key={`ray_${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
                    stroke={goldTrim} strokeWidth="0.8" opacity="0.2" />
            ))}
          </G>
          {/* Gold vein trim */}
          <G id="tree_gold_vein_trim">
            <Line x1="30" y1="38" x2="50" y2="22" stroke={goldTrim} strokeWidth="1" opacity="0.7" />
            <Line x1="70" y1="38" x2="50" y2="22" stroke={goldTrim} strokeWidth="1" opacity="0.7" />
            <Line x1="30" y1="38" x2="70" y2="38" stroke={goldTrim} strokeWidth="1" opacity="0.6" />
          </G>
          {/* Ghost next: fullest canopy */}
          <G id="tree_canopy_ghost_next" opacity="0.3">
            <Circle cx="20" cy="44" r="6" fill="none" stroke={canopyColor} strokeWidth="0.8" />
            <Circle cx="80" cy="44" r="6" fill="none" stroke={canopyColor} strokeWidth="0.8" />
          </G>
        </G>
      )
    case 'legend':
      return (
        <G id="tree_legend">
          {/* Resting glow (static) */}
          <G id="tree_resting_glow">
            <Circle cx="50" cy="32" r="40" fill={goldTrim} opacity="0.05" />
            <Circle cx="50" cy="32" r="30" fill={goldTrim} opacity="0.08" />
          </G>
          <Ellipse cx="50" cy="92" rx="22" ry="3" fill={soilColor} opacity="0.1" />
          {/* Richest bark tone */}
          <Path d="M 50,92 Q 45,60 50,30" stroke={trunkColor} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {/* Fullest canopy */}
          <Circle cx="25" cy="40" r="18" fill={canopyColor} opacity="1" />
          <Circle cx="75" cy="40" r="18" fill={canopyColor} opacity="1" />
          <Circle cx="50" cy="18" r="17" fill={canopyColor} opacity="1" />
          <Circle cx="35" cy="28" r="12" fill={canopyColor} opacity="0.95" />
          <Circle cx="65" cy="28" r="12" fill={canopyColor} opacity="0.95" />
          <Circle cx="40" cy="45" r="10" fill={canopyColor} opacity="0.9" />
          <Circle cx="60" cy="45" r="10" fill={canopyColor} opacity="0.9" />
          {/* Gold rays */}
          <G id="tree_rays">
            {[
              { x1: 50, y1: 28, x2: 50, y2: -5 },
              { x1: 50, y1: 28, x2: 80, y2: 5 },
              { x1: 50, y1: 28, x2: 105, y2: 28 },
              { x1: 50, y1: 28, x2: 80, y2: 55 },
              { x1: 50, y1: 28, x2: 20, y2: 55 },
              { x1: 50, y1: 28, x2: -5, y2: 28 },
              { x1: 50, y1: 28, x2: 20, y2: 5 },
            ].map((ray, i) => (
              <Line key={`ray_${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
                    stroke={goldTrim} strokeWidth="1" opacity="0.25" />
            ))}
          </G>
          {/* Gold vein trim */}
          <G id="tree_gold_vein_trim">
            <Line x1="25" y1="40" x2="50" y2="18" stroke={goldTrim} strokeWidth="1.2" opacity="0.7" />
            <Line x1="75" y1="40" x2="50" y2="18" stroke={goldTrim} strokeWidth="1.2" opacity="0.7" />
            <Line x1="25" y1="40" x2="75" y2="40" stroke={goldTrim} strokeWidth="1.2" opacity="0.6" />
            <Line x1="35" y1="28" x2="65" y2="28" stroke={goldTrim} strokeWidth="1" opacity="0.5" />
          </G>
        </G>
      )
    default:
      return null
  }
}

export default JourneyTreeArtwork
