// ─────────────────────────────────────────────────────────────
// GlowJourneyStageIcon.js — Custom vector stage icon replacing
// the platform-dependent emoji presentation.
//
// A small two-leaf sprout mark (~36x36pt) rendered in the same
// stroke-based line-art language as the rest of the system.
// No emoji anywhere in this system (FINAL handoff §5.2).
//
// The icon grows in richness with the Journey stage:
//   Seed      — single seed dot
//   Sprout    — stem + two tiny leaves
//   Growing   — taller stem + two leaves
//   Blooming  — stem + leaves + blossom dots
//   Thriving  — fuller + gold vein trim
//   Radiant   — gold rays behind
//   Legend    — gold trim + resting glow + badge
// ─────────────────────────────────────────────────────────────

import React from 'react'
import Svg, { G, Path, Circle, Line, Ellipse } from 'react-native-svg'
import { GLOW_JOURNEY_PALETTE } from './GlowJourneyVisualState'

function GlowJourneyStageIcon({ stageKey, size = 18, color = '#E8EDE9' }) {
  if (!stageKey) return null

  const goldTrim = GLOW_JOURNEY_PALETTE.stageGoldTrim
  const leafColor = GLOW_JOURNEY_PALETTE.juiceLiquidTopBand
  const stemColor = color

  switch (stageKey) {
    case 'seed':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Seed stage icon">
          <G id="stage_icon_seed">
            <Ellipse cx="18" cy="24" rx="5" ry="3" fill={leafColor} opacity="0.7" />
            <Ellipse cx="18" cy="23" rx="3" ry="1.5" fill={stemColor} opacity="0.5" />
          </G>
        </Svg>
      )
    case 'sprout':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Sprout stage icon">
          <G id="stage_icon_sprout">
            <Path d="M 18,30 Q 18,22 18,16" stroke={stemColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <Path d="M 18,20 Q 13,18 11,14 Q 15,15 18,20 Z" fill={leafColor} opacity="0.85" />
            <Path d="M 18,20 Q 23,18 25,14 Q 21,15 18,20 Z" fill={leafColor} opacity="0.85" />
          </G>
        </Svg>
      )
    case 'growing':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Growing stage icon">
          <G id="stage_icon_growing">
            <Path d="M 18,32 Q 18,20 18,10" stroke={stemColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <Path d="M 18,22 Q 11,20 8,14 Q 14,15 18,22 Z" fill={leafColor} opacity="0.9" />
            <Path d="M 18,22 Q 25,20 28,14 Q 22,15 18,22 Z" fill={leafColor} opacity="0.9" />
            <Path d="M 18,14 Q 12,12 10,7 Q 15,8 18,14 Z" fill={leafColor} opacity="0.75" />
            <Path d="M 18,14 Q 24,12 26,7 Q 21,8 18,14 Z" fill={leafColor} opacity="0.75" />
          </G>
        </Svg>
      )
    case 'blooming':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Blooming stage icon">
          <G id="stage_icon_blooming">
            <Path d="M 18,32 Q 18,18 18,8" stroke={stemColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <Path d="M 18,24 Q 10,22 7,16 Q 13,17 18,24 Z" fill={leafColor} opacity="0.9" />
            <Path d="M 18,24 Q 26,22 29,16 Q 23,17 18,24 Z" fill={leafColor} opacity="0.9" />
            <Path d="M 18,14 Q 11,12 9,6 Q 15,7 18,14 Z" fill={leafColor} opacity="0.8" />
            <Path d="M 18,14 Q 25,12 27,6 Q 21,7 18,14 Z" fill={leafColor} opacity="0.8" />
            {/* Blossom dots */}
            <Circle cx="18" cy="8" r="2" fill="#F3D6DC" opacity="0.9" />
            <Circle cx="15" cy="6" r="1.5" fill="#F3D6DC" opacity="0.7" />
            <Circle cx="21" cy="6" r="1.5" fill="#F3D6DC" opacity="0.7" />
          </G>
        </Svg>
      )
    case 'thriving':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Thriving stage icon">
          <G id="stage_icon_thriving">
            <Path d="M 18,32 Q 18,16 18,6" stroke={stemColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <Path d="M 18,26 Q 9,24 6,17 Q 12,18 18,26 Z" fill={leafColor} opacity="0.95" />
            <Path d="M 18,26 Q 27,24 30,17 Q 24,18 18,26 Z" fill={leafColor} opacity="0.95" />
            <Path d="M 18,16 Q 10,14 8,7 Q 14,8 18,16 Z" fill={leafColor} opacity="0.85" />
            <Path d="M 18,16 Q 26,14 28,7 Q 22,8 18,16 Z" fill={leafColor} opacity="0.85" />
            {/* Gold vein trim */}
            <Line x1="18" y1="26" x2="6" y2="17" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
            <Line x1="18" y1="26" x2="30" y2="17" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
            <Line x1="18" y1="16" x2="8" y2="7" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
            <Line x1="18" y1="16" x2="28" y2="7" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
            <Circle cx="18" cy="6" r="2" fill="#F3D6DC" opacity="0.9" />
          </G>
        </Svg>
      )
    case 'radiant':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="Radiant stage icon">
          <G id="stage_icon_radiant">
            {/* Soft gold rays */}
            {[
              { x1: 18, y1: 18, x2: 18, y2: 2 },
              { x1: 18, y1: 18, x2: 30, y2: 6 },
              { x1: 18, y1: 18, x2: 34, y2: 18 },
              { x1: 18, y1: 18, x2: 30, y2: 30 },
              { x1: 18, y1: 18, x2: 18, y2: 34 },
              { x1: 18, y1: 18, x2: 6, y2: 30 },
              { x1: 18, y1: 18, x2: 2, y2: 18 },
              { x1: 18, y1: 18, x2: 6, y2: 6 },
            ].map((ray, i) => (
              <Line key={`ray_${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
                    stroke={goldTrim} strokeWidth="0.6" opacity="0.2" />
            ))}
            <Path d="M 18,32 Q 18,14 18,4" stroke={stemColor} strokeWidth="2" fill="none" strokeLinecap="round" />
            <Path d="M 18,26 Q 8,24 5,16 Q 12,17 18,26 Z" fill={leafColor} opacity="0.95" />
            <Path d="M 18,26 Q 28,24 31,16 Q 24,17 18,26 Z" fill={leafColor} opacity="0.95" />
            <Path d="M 18,14 Q 9,12 7,5 Q 14,6 18,14 Z" fill={leafColor} opacity="0.9" />
            <Path d="M 18,14 Q 27,12 29,5 Q 22,6 18,14 Z" fill={leafColor} opacity="0.9" />
            <Line x1="18" y1="26" x2="5" y2="16" stroke={goldTrim} strokeWidth="0.8" opacity="0.7" />
            <Line x1="18" y1="26" x2="31" y2="16" stroke={goldTrim} strokeWidth="0.8" opacity="0.7" />
            <Line x1="18" y1="14" x2="7" y2="5" stroke={goldTrim} strokeWidth="0.8" opacity="0.7" />
            <Line x1="18" y1="14" x2="29" y2="5" stroke={goldTrim} strokeWidth="0.8" opacity="0.7" />
            <Circle cx="18" cy="4" r="2.5" fill={goldTrim} opacity="0.8" />
          </G>
        </Svg>
      )
    case 'legend':
      return (
        <Svg width={size} height={size} viewBox="0 0 36 36" accessibilityLabel="RawLife Legend stage icon">
          <G id="stage_icon_legend">
            {/* Resting glow */}
            <Circle cx="18" cy="18" r="16" fill={goldTrim} opacity="0.06" />
            {/* Gold rays */}
            {[
              { x1: 18, y1: 18, x2: 18, y2: 1 },
              { x1: 18, y1: 18, x2: 31, y2: 5 },
              { x1: 18, y1: 18, x2: 35, y2: 18 },
              { x1: 18, y1: 18, x2: 31, y2: 31 },
              { x1: 18, y1: 18, x2: 18, y2: 35 },
              { x1: 18, y1: 18, x2: 5, y2: 31 },
              { x1: 18, y1: 18, x2: 1, y2: 18 },
              { x1: 18, y1: 18, x2: 5, y2: 5 },
            ].map((ray, i) => (
              <Line key={`ray_${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
                    stroke={goldTrim} strokeWidth="0.7" opacity="0.25" />
            ))}
            <Path d="M 18,32 Q 18,12 18,2" stroke={stemColor} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <Path d="M 18,27 Q 7,25 4,15 Q 11,16 18,27 Z" fill={leafColor} opacity="1" />
            <Path d="M 18,27 Q 29,25 32,15 Q 25,16 18,27 Z" fill={leafColor} opacity="1" />
            <Path d="M 18,13 Q 8,11 6,3 Q 13,4 18,13 Z" fill={leafColor} opacity="0.95" />
            <Path d="M 18,13 Q 28,11 30,3 Q 23,4 18,13 Z" fill={leafColor} opacity="0.95" />
            <Line x1="18" y1="27" x2="4" y2="15" stroke={goldTrim} strokeWidth="1" opacity="0.7" />
            <Line x1="18" y1="27" x2="32" y2="15" stroke={goldTrim} strokeWidth="1" opacity="0.7" />
            <Line x1="18" y1="13" x2="6" y2="3" stroke={goldTrim} strokeWidth="1" opacity="0.7" />
            <Line x1="18" y1="13" x2="30" y2="3" stroke={goldTrim} strokeWidth="1" opacity="0.7" />
            {/* Badge accent */}
            <Circle cx="18" cy="2" r="3" fill={goldTrim} opacity="0.85" />
            <Circle cx="18" cy="2" r="1.5" fill={GLOW_JOURNEY_PALETTE.particleColor} opacity="0.9" />
          </G>
        </Svg>
      )
    default:
      return null
  }
}

export default GlowJourneyStageIcon
