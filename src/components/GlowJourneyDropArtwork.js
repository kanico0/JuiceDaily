import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Defs, ClipPath, Path, G, Rect, Circle, Ellipse, Line, LinearGradient, RadialGradient, Stop } from 'react-native-svg'
import { SEMANTIC_COLORS } from '../constants/tokens'
import { GLOW_JOURNEY_PALETTE, getLiquidFillGeometry, clampProgress } from './GlowJourneyVisualState'
import GlowJourneyStageIcon from './GlowJourneyStageIcon'

// ── Enlarged drop (correction addendum §1.2) ────────────────
// Drop scaled ~10% larger to occupy ~55-65% of card height.
// Apex at y=75, bulb center at y=284, bulb radius 94.
const DROP_PATH = 'M 200,75 C 139.3,190.0 106.5,284.0 106.5,284.0 A 94,94 0 1 0 293.5,284.0 C 293.5,284.0 260.7,190.0 200,75 Z'
const LIQUID_HIGHLIGHT_PATH = 'M 155,135 C 140,210 145,275 160,305 C 150,255 147,185 165,130 Z'
const FALLING_DROPLET_PATH = 'M 200,20 C 191,35 191,47 200,47 C 209,47 209,35 200,20 Z'
const RIPPLE_PATH = 'M 120,190 Q 160,183 200,190 Q 240,197 280,190'

// ── Halo leaves: larger, thicker, tighter radius ─────────────
// Positions scaled to 0.8 radius (closer to drop), leaf shapes
// scaled 1.2x (larger). Stroke width increased ~40%.
const LEAF_PATHS = [
  'M 80.2,272.1 Q 59.4,290.1 26.8,286.4 Q 53.1,266.9 80.2,272.1 Z',
  'M 83.4,197.6 Q 56.0,200.4 31.6,178.8 Q 64.2,177.8 83.4,197.6 Z',
  'M 128.9,138.4 Q 104.8,125.0 97.2,93.3 Q 124.5,111.2 128.9,138.4 Z',
  'M 200.0,116.0 Q 188.0,91.2 200.0,60.8 Q 212.0,91.2 200.0,116.0 Z',
  'M 271.1,138.4 Q 295.2,125.0 302.8,93.3 Q 275.5,111.2 271.1,138.4 Z',
  'M 316.6,197.6 Q 344.0,200.4 368.4,178.8 Q 335.8,177.8 316.6,197.6 Z',
  'M 319.8,272.1 Q 340.7,290.1 373.2,286.4 Q 346.9,266.9 319.8,272.1 Z',
]

const LEAF_VEIN_PATHS = [
  'M 80.2,272.1 L 26.8,286.4',
  'M 83.4,197.6 L 31.6,178.8',
  'M 128.9,138.4 L 97.2,93.3',
  'M 200.0,116.0 L 200.0,60.8',
  'M 271.1,138.4 L 302.8,93.3',
  'M 316.6,197.6 L 368.4,178.8',
  'M 319.8,272.1 L 373.2,286.4',
]

// Gold center dot positions for filled leaves (midpoint of each leaf)
const LEAF_DOT_POSITIONS = [
  { cx: 53.5, cy: 279.3 },
  { cx: 57.5, cy: 188.2 },
  { cx: 113.1, cy: 115.9 },
  { cx: 200.0, cy: 88.4 },
  { cx: 287.0, cy: 115.9 },
  { cx: 342.5, cy: 188.2 },
  { cx: 346.5, cy: 279.3 },
]

const PARTICLE_POSITIONS = [
  { cx: 335.3, cy: 72.9 },
  { cx: 155.3, cy: 29.7 },
  { cx: 8.4, cy: 142.4 },
  { cx: 3.6, cy: 327.4 },
  { cx: 144.4, cy: 447.7 },
  { cx: 326.4, cy: 413.9 },
  { cx: 414.7, cy: 251.3 },
]

function GlowJourneyDropArtwork({
  visualState,
  size = 180,
  showFallingDroplet = false,
  showRipple = false,
  showParticles = false,
  particleCount = 0,
  glowRingOpacityOverride = null,
  fallingDropletOpacity = 0,
  rippleOpacity = 0,
  particleOpacities = [],
  leafScaleOverrides = [],
  isReduced = false,
}) {
  const {
    stageProps,
    liquidGeometry,
    leafStates,
    fillRatio,
  } = visualState

  const glowRingOpacity = glowRingOpacityOverride !== null
    ? glowRingOpacityOverride
    : stageProps.glowRingOpacity

  const liquidGradId = useMemo(() => `glowjourney_liquid_grad_${Math.random().toString(36).slice(2, 8)}`, [])
  const outlineGradId = useMemo(() => `glowjourney_outline_grad_${Math.random().toString(36).slice(2, 8)}`, [])
  const clipId = useMemo(() => `glowjourney_liquid_clip_${Math.random().toString(36).slice(2, 8)}`, [])
  const goldGlowId = useMemo(() => `glowjourney_gold_glow_${Math.random().toString(36).slice(2, 8)}`, [])
  const mintGlowId = useMemo(() => `glowjourney_mint_glow_${Math.random().toString(36).slice(2, 8)}`, [])

  const activeParticleCount = Math.min(particleCount, 7)
  const activeLeafScales = leafStates.map((_, i) =>
    leafScaleOverrides[i] !== undefined ? leafScaleOverrides[i] : 1
  )

  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 400 460" accessibilityLabel="Glow Journey progress indicator">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={DROP_PATH} />
        </ClipPath>
        {/* Ambient glow: warm gold + cool mint, edgeless, low opacity */}
        <RadialGradient id={goldGlowId} cx="50%" cy="52%" r="55%">
          <Stop offset="0%" stopColor={GLOW_JOURNEY_PALETTE.ambientGlowGold} stopOpacity="0.07" />
          <Stop offset="60%" stopColor={GLOW_JOURNEY_PALETTE.ambientGlowGold} stopOpacity="0.03" />
          <Stop offset="100%" stopColor={GLOW_JOURNEY_PALETTE.ambientGlowGold} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={mintGlowId} cx="50%" cy="52%" r="40%">
          <Stop offset="0%" stopColor={GLOW_JOURNEY_PALETTE.ambientGlowMint} stopOpacity="0.06" />
          <Stop offset="60%" stopColor={GLOW_JOURNEY_PALETTE.ambientGlowMint} stopOpacity="0.025" />
          <Stop offset="100%" stopColor={GLOW_JOURNEY_PALETTE.ambientGlowMint} stopOpacity="0" />
        </RadialGradient>
        {/* Juice two-tone: mint band at surface, warm orange body */}
        <LinearGradient id={liquidGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidTopBand} stopOpacity="0.85" />
          <Stop offset="12%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidTopBand} stopOpacity="0.7" />
          <Stop offset="13%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidBase} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidBase} stopOpacity="0.75" />
        </LinearGradient>
        <LinearGradient id={outlineGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={GLOW_JOURNEY_PALETTE.haloFilledColor} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={GLOW_JOURNEY_PALETTE.haloFilledColor} stopOpacity="0.4" />
        </LinearGradient>
      </Defs>

      {/* glowjourney_drop_container */}
      <G id="glowjourney_drop_container">
        {/* glowjourney_ambient_glow — soft edgeless, no visible circle */}
        <G id="glowjourney_ambient_glow">
          <Rect x="0" y="0" width="400" height="460" fill={`url(#${goldGlowId})`} />
          <Rect x="0" y="0" width="400" height="460" fill={`url(#${mintGlowId})`} />
        </G>

        {/* glowjourney_drop_glass */}
        <G id="glowjourney_drop_glass" clipPath={`url(#${clipId})`}>
          <Rect x="100" y="65" width="200" height="320" fill={GLOW_JOURNEY_PALETTE.juiceLiquidBase} opacity="0.06" />
        </G>

        {/* glowjourney_leaf_halo — leaves closer, larger, thicker */}
        <G id="glowjourney_leaf_halo">
          {LEAF_PATHS.map((leafPath, i) => {
            const leaf = leafStates[i]
            if (!leaf) return null
            const scale = activeLeafScales[i] || 1
            const leafCx = 200
            const leafCy = 200
            return (
              <G key={`leaf_${i}`} id={`glowjourney_leaf_${String(i + 1).padStart(2, '0')}`}
                 transform={`translate(${leafCx}, ${leafCy}) scale(${scale}) translate(${-leafCx}, ${-leafCy})`}>
                {/* _outline */}
                <G id={`glowjourney_leaf_${String(i + 1).padStart(2, '0')}_outline`}>
                  <Path d={leafPath} fill="none" opacity={leaf.visual.opacity}
                        stroke={leaf.visual.strokeColor} strokeWidth={leaf.visual.strokeWidth} />
                  <Path d={LEAF_VEIN_PATHS[i]} stroke={leaf.visual.strokeColor}
                        strokeOpacity="0.35" strokeWidth="1" fill="none" />
                </G>
                {/* _fill */}
                {leaf.visual.filled && (
                  <G id={`glowjourney_leaf_${String(i + 1).padStart(2, '0')}_fill`}>
                    <Path d={leafPath} fill={leaf.visual.fillColor} opacity={leaf.visual.opacity} />
                    <Path d={LEAF_VEIN_PATHS[i]} stroke={leaf.visual.fillColor}
                          strokeOpacity="0.35" strokeWidth="1" fill="none" />
                    {/* Gold center dot on filled leaves */}
                    {leaf.visual.showGoldDot && (
                      <Circle cx={LEAF_DOT_POSITIONS[i].cx} cy={LEAF_DOT_POSITIONS[i].cy}
                              r="3.5" fill={leaf.visual.goldDotColor} opacity="0.9" />
                    )}
                  </G>
                )}
              </G>
            )
          })}
        </G>

        {/* glowjourney_liquid_fill */}
        <G id="glowjourney_liquid_fill" clipPath={`url(#${clipId})`}>
          {liquidGeometry.height > 0 && (
            <Rect
              x={liquidGeometry.x}
              y={liquidGeometry.y}
              width={liquidGeometry.width}
              height={liquidGeometry.height}
              fill={`url(#${liquidGradId})`}
            />
          )}
        </G>

        {/* glowjourney_liquid_highlight */}
        <G id="glowjourney_liquid_highlight" clipPath={`url(#${clipId})`}>
          <Path d={LIQUID_HIGHLIGHT_PATH} fill={GLOW_JOURNEY_PALETTE.liquidHighlightColor} opacity="0.30" />
        </G>

        {/* glowjourney_drop_outline */}
        <G id="glowjourney_drop_outline">
          <Path d={DROP_PATH} fill="none" stroke={`url(#${outlineGradId})`} strokeWidth={stageProps.outlineWidth} />
        </G>

        {/* glowjourney_liquid_ripple */}
        {showRipple && (
          <G id="glowjourney_liquid_ripple">
            <Path d={RIPPLE_PATH} stroke={GLOW_JOURNEY_PALETTE.liquidHighlightColor}
                  strokeWidth="3" fill="none" opacity={rippleOpacity} />
          </G>
        )}

        {/* glowjourney_falling_droplet */}
        {showFallingDroplet && (
          <G id="glowjourney_falling_droplet">
            <Path d={FALLING_DROPLET_PATH} fill={GLOW_JOURNEY_PALETTE.fallingDropletColor}
                  opacity={fallingDropletOpacity} />
          </G>
        )}

        {/* glowjourney_stage_ornamentation */}
        <GlowJourneyStageMotif stageKey={visualState.stageKey} stageProps={stageProps} />

        {/* glowjourney_particle_01…07 */}
        {showParticles && PARTICLE_POSITIONS.slice(0, activeParticleCount).map((pos, i) => (
          <G key={`particle_${i}`} id={`glowjourney_particle_${String(i + 1).padStart(2, '0')}`}>
            <Circle cx={pos.cx} cy={pos.cy} r="5"
                    fill={GLOW_JOURNEY_PALETTE.particleColor}
                    opacity={particleOpacities[i] !== undefined ? particleOpacities[i] : 0} />
          </G>
        ))}
      </G>
    </Svg>
  )
}

function GlowJourneyStageMotif({ stageKey, stageProps }) {
  if (!stageKey) return null

  const goldTrim = GLOW_JOURNEY_PALETTE.stageGoldTrim

  switch (stageKey) {
    case 'seed':
      return (
        <G id="glowjourney_stage_seed">
          <Ellipse cx="200" cy="379" rx="10" ry="3.5" fill={GLOW_JOURNEY_PALETTE.haloUnfilledStroke} opacity="0.6" />
        </G>
      )
    case 'sprout':
      return (
        <G id="glowjourney_stage_sprout">
          <Path d="M 200.0,84.0 Q 194.2,79.1 194.4,70.1 Q 200.7,76.4 200.0,84.0 Z"
                fill={GLOW_JOURNEY_PALETTE.fallingDropletColor} opacity="1.0" />
          <Path d="M 200.0,84.0 Q 199.3,76.4 205.6,70.1 Q 205.8,79.1 200.0,84.0 Z"
                fill={GLOW_JOURNEY_PALETTE.fallingDropletColor} opacity="1.0" />
        </G>
      )
    case 'growing':
      return (
        <G id="glowjourney_stage_growing">
          <Circle cx="200" cy="200" r="140" fill="none"
                  stroke={GLOW_JOURNEY_PALETTE.haloFilledColor} strokeWidth="1.5" opacity="0.25" />
        </G>
      )
    case 'blooming':
      return (
        <G id="glowjourney_stage_blooming">
          <Circle cx="76.8" cy="174.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="81.0" cy="177.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="79.4" cy="182.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="74.2" cy="182.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="72.6" cy="177.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="76.8" cy="179.3" r="1.6" fill="#F2C14E" />
          <Circle cx="200.0" cy="82.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="204.2" cy="85.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="202.6" cy="90.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="197.4" cy="90.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="195.8" cy="85.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="200.0" cy="87.0" r="1.6" fill="#F2C14E" />
          <Circle cx="323.2" cy="174.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="327.4" cy="177.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="325.8" cy="182.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="320.6" cy="182.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="319.0" cy="177.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="323.2" cy="179.3" r="1.6" fill="#F2C14E" />
        </G>
      )
    case 'thriving':
      return (
        <G id="glowjourney_stage_thriving">
          {LEAF_VEIN_PATHS.map((vein, i) => {
            const [x1, y1, x2, y2] = vein.match(/-?\d+\.?\d*/g).map(Number)
            return (
              <Line key={`vein_${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={goldTrim} strokeWidth="1.4" opacity="0.7" />
            )
          })}
        </G>
      )
    case 'radiant':
      return (
        <G id="glowjourney_stage_radiant">
          {LEAF_VEIN_PATHS.map((vein, i) => {
            const [x1, y1, x2, y2] = vein.match(/-?\d+\.?\d*/g).map(Number)
            return (
              <Line key={`vein_${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={goldTrim} strokeWidth="1.4" opacity="0.7" />
            )
          })}
          {/* Soft gold rays */}
          {[
            { x1: 200, y1: 200, x2: 200, y2: 20 },
            { x1: 200, y1: 200, x2: 370, y2: 80 },
            { x1: 200, y1: 200, x2: 400, y2: 200 },
            { x1: 200, y1: 200, x2: 370, y2: 360 },
            { x1: 200, y1: 200, x2: 200, y2: 440 },
            { x1: 200, y1: 200, x2: 30, y2: 360 },
            { x1: 200, y1: 200, x2: 0, y2: 200 },
            { x1: 200, y1: 200, x2: 30, y2: 80 },
          ].map((ray, i) => (
            <Line key={`ray_${i}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
                  stroke={goldTrim} strokeWidth="1.0" opacity="0.15" />
          ))}
        </G>
      )
    case 'legend':
      return (
        <G id="glowjourney_stage_legend">
          {LEAF_VEIN_PATHS.map((vein, i) => {
            const [x1, y1, x2, y2] = vein.match(/-?\d+\.?\d*/g).map(Number)
            return (
              <Line key={`vein_${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={goldTrim} strokeWidth="1.4" opacity="0.7" />
            )
          })}
          {/* Connecting flourish between outermost leaves */}
          <Path d="M 80.2,272.1 Q 200,440 319.8,272.1"
                fill="none" stroke={goldTrim} strokeWidth="1.2" opacity="0.5" />
          {/* Badge accent at base */}
          <Circle cx="200" cy="395" r="6" fill={goldTrim} opacity="0.6" />
          <Circle cx="200" cy="395" r="3" fill={GLOW_JOURNEY_PALETTE.particleColor} opacity="0.8" />
        </G>
      )
    default:
      return null
  }
}

export default GlowJourneyDropArtwork
