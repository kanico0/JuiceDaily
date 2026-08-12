import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Defs, ClipPath, Path, G, Rect, Circle, Ellipse, Line, LinearGradient, Stop } from 'react-native-svg'
import { SEMANTIC_COLORS } from '../constants/tokens'
import { GLOW_JOURNEY_PALETTE, getLiquidFillGeometry, clampProgress } from './GlowJourneyVisualState'
import GlowJourneyStageIcon from './GlowJourneyStageIcon'

const DROP_PATH = 'M 200,90 C 144.8,194.5 115.0,280.0 115.0,280.0 A 85,85 0 1 0 285.0,280.0 C 285.0,280.0 255.2,194.5 200,90 Z'
const LIQUID_HIGHLIGHT_PATH = 'M 160,150 C 145,220 150,280 165,310 C 155,260 152,190 170,145 Z'
const FALLING_DROPLET_PATH = 'M 200,20 C 191,35 191,47 200,47 C 209,47 209,35 200,20 Z'
const RIPPLE_PATH = 'M 127.8,186.2 Q 166.0,179.2 200.0,186.2 Q 234.0,193.2 272.2,186.2'

const LEAF_PATHS = [
  'M 50.3,280.1 Q 32.9,295.1 5.8,292.0 Q 27.7,275.8 50.3,280.1 Z',
  'M 54.3,187.0 Q 31.5,189.3 11.1,171.3 Q 38.3,170.5 54.3,187.0 Z',
  'M 111.1,113.0 Q 91.0,101.8 84.7,75.4 Q 107.4,90.3 111.1,113.0 Z',
  'M 200.0,85.0 Q 190.0,64.3 200.0,39.0 Q 210.0,64.3 200.0,85.0 Z',
  'M 288.9,113.0 Q 309.0,101.8 315.3,75.4 Q 292.6,90.3 288.9,113.0 Z',
  'M 345.7,187.0 Q 368.5,189.3 388.9,171.3 Q 361.7,170.5 345.7,187.0 Z',
  'M 349.7,280.1 Q 367.1,295.1 394.2,292.0 Q 372.3,275.8 349.7,280.1 Z',
]

const LEAF_VEIN_PATHS = [
  'M 50.3,280.1 L 5.8,292.0',
  'M 54.3,187.0 L 11.1,171.3',
  'M 111.1,113.0 L 84.7,75.4',
  'M 200.0,85.0 L 200.0,39.0',
  'M 288.9,113.0 L 315.3,75.4',
  'M 345.7,187.0 L 388.9,171.3',
  'M 349.7,280.1 L 394.2,292.0',
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

  const activeParticleCount = Math.min(particleCount, 7)
  const activeLeafScales = leafStates.map((_, i) =>
    leafScaleOverrides[i] !== undefined ? leafScaleOverrides[i] : 1
  )

  // Juice-colored two-tone liquid: warm orange base with a thin
  // mint/green band near the top of the fill (FINAL handoff §5.2).
  // The top band sits at the liquid surface; the body below is warm.
  const fillTop = liquidGeometry.y
  const fillBottom = liquidGeometry.y + liquidGeometry.height
  const bandThickness = Math.max(8, liquidGeometry.height * 0.12)
  const bandTop = fillTop
  const bandBottom = Math.min(fillTop + bandThickness, fillBottom)

  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 400 460" accessibilityLabel="Glow Journey progress indicator">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={DROP_PATH} />
        </ClipPath>
        {/* Juice two-tone: mint band at surface, warm orange body */}
        <LinearGradient id={liquidGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidTopBand} stopOpacity="0.85" />
          <Stop offset="12%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidTopBand} stopOpacity="0.7" />
          <Stop offset="13%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidBase} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={GLOW_JOURNEY_PALETTE.juiceLiquidBase} stopOpacity="0.75" />
        </LinearGradient>
        <LinearGradient id={outlineGradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={stageProps.outlineColor} stopOpacity="0.6" />
          <Stop offset="100%" stopColor={stageProps.outlineColor} stopOpacity="0.3" />
        </LinearGradient>
      </Defs>

      {/* glowjourney_drop_container */}
      <G id="glowjourney_drop_container">
        {/* glowjourney_drop_glass */}
        <G id="glowjourney_drop_glass" clipPath={`url(#${clipId})`}>
          <Rect x="105" y="80" width="190" height="305" fill={GLOW_JOURNEY_PALETTE.juiceLiquidBase} opacity="0.06" />
        </G>

        {/* glowjourney_glow_ring */}
        <G id="glowjourney_glow_ring">
          <Circle cx="200" cy="240" r="190" fill={GLOW_JOURNEY_PALETTE.particleColor} opacity={glowRingOpacity} />
        </G>

        {/* glowjourney_leaf_halo */}
        <G id="glowjourney_leaf_halo">
          {LEAF_PATHS.map((leafPath, i) => {
            const leaf = leafStates[i]
            if (!leaf) return null
            const scale = activeLeafScales[i] || 1
            const leafCx = 200
            const leafCy = 240
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
          <Circle cx="200" cy="240" r="175" fill="none"
                  stroke={stageProps.liquidColor} strokeWidth="1.5" opacity="0.35" />
        </G>
      )
    case 'blooming':
      return (
        <G id="glowjourney_stage_blooming">
          <Circle cx="46.8" cy="179.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="51.0" cy="182.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="49.4" cy="187.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="44.2" cy="187.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="42.6" cy="182.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="46.8" cy="184.3" r="1.6" fill="#F2C14E" />
          <Circle cx="200.0" cy="72.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="204.2" cy="75.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="202.6" cy="80.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="197.4" cy="80.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="195.8" cy="75.6" r="2.2" fill="#F3D6DC" />
          <Circle cx="200.0" cy="77.0" r="1.6" fill="#F2C14E" />
          <Circle cx="353.2" cy="179.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="357.4" cy="182.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="355.8" cy="187.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="350.6" cy="187.8" r="2.2" fill="#F3D6DC" />
          <Circle cx="349.0" cy="182.9" r="2.2" fill="#F3D6DC" />
          <Circle cx="353.2" cy="184.3" r="1.6" fill="#F2C14E" />
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
            { x1: 200, y1: 240, x2: 200, y2: 30 },
            { x1: 200, y1: 240, x2: 370, y2: 100 },
            { x1: 200, y1: 240, x2: 400, y2: 240 },
            { x1: 200, y1: 240, x2: 370, y2: 380 },
            { x1: 200, y1: 240, x2: 200, y2: 450 },
            { x1: 200, y1: 240, x2: 30, y2: 380 },
            { x1: 200, y1: 240, x2: 0, y2: 240 },
            { x1: 200, y1: 240, x2: 30, y2: 100 },
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
          <Path d="M 50.3,280.1 Q 200,460 349.7,280.1"
                fill="none" stroke={goldTrim} strokeWidth="1.2" opacity="0.5" />
          {/* Badge accent at base */}
          <Circle cx="200" cy="385" r="6" fill={goldTrim} opacity="0.6" />
          <Circle cx="200" cy="385" r="3" fill={GLOW_JOURNEY_PALETTE.particleColor} opacity="0.8" />
        </G>
      )
    default:
      return null
  }
}

export default GlowJourneyDropArtwork
