// ─────────────────────────────────────────────────────────────
// LivingGardenLayers.js — Static scene layers
//
// Layers z00–z05, z10, z11 from spec §6:
//   z00 Sky gradient + horizon glow (Journey-driven)
//   z01 Distant treeline (static)
//   z02 Ground plane + dapple pools (static)
//   z04 Path (static)
//   z05 Ground detail — grass tufts, stepping stones (static, seeded)
//   z10 Ambient motes (Journey-driven)
//   z11 Vignette (static, non-interactive)
//
// All geometry is precomputed in LivingGardenGeometry.js.
// No filters, no masks, no clipPaths. Soft light faked with
// layered low-opacity ellipses and gradients (spec §22).
// ─────────────────────────────────────────────────────────────

import React, { memo } from 'react'
import { Animated } from 'react-native'
import Svg, {
  G,
  Rect,
  Ellipse,
  Path,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg'
import {
  SCENE_WIDTH,
  SCENE_HEIGHT,
  HORIZON_Y,
  TREELINE_D,
  PATH_D,
  GRASS_TUFTS,
  DAPPLE_POOLS,
  MOTE_POSITIONS,
  STEPPING_STONES,
  BED_PLACEMENT,
  SCENE_PALETTE,
} from './LivingGardenGeometry'

// ── Mote hue sampling (spec §6.3) ─────────────────────────────
// Existing ambient particles take the nearest mature bed's hue at
// mix(#6E8A72, hue, k) where k = 0.10 at One-Month, 0.20 at Established, 0.30 at Legend.
const MOTE_NEUTRAL = '#6E8A72'
const MOTE_K_BY_JOURNEY = {
  blooming: 0.1,
  thriving: 0.2,
  radiant: 0.3,
  legend: 0.3,
}

// Full-strength produce hues for mote sampling (matches BED_PALETTES)
const MOTE_BED_HUES = {
  greens: '#8FD46B',
  roots: '#E8843A',
  citrus: '#F2D24B',
  orchard: '#D9453F',
  berries: '#C42847',
  tropical: '#E8B93C',
  herbs: '#7FD6A2',
}

function mixHex(hex, mixHex, ratio) {
  const r1 = parseInt(hex.slice(1, 3), 16)
  const g1 = parseInt(hex.slice(3, 5), 16)
  const b1 = parseInt(hex.slice(5, 7), 16)
  const r2 = parseInt(mixHex.slice(1, 3), 16)
  const g2 = parseInt(mixHex.slice(3, 5), 16)
  const b2 = parseInt(mixHex.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * ratio)
  const g = Math.round(g1 + (g2 - g1) * ratio)
  const b = Math.round(b1 + (b2 - b1) * ratio)
  const toHex2 = (v) => v.toString(16).padStart(2, '0').toUpperCase()
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`
}

// Find the nearest mature (Harvesting/Flourishing) bed to a given position
function nearestMatureBedHue(x, y, bedStages) {
  if (!bedStages) return null
  let nearestHue = null
  let nearestDist = Infinity
  Object.keys(BED_PLACEMENT).forEach((bedKey) => {
    const stage = bedStages[bedKey]
    if (!stage) return
    const sk = stage.key || stage
    if (sk !== 'harvesting' && sk !== 'flourishing') return
    const p = BED_PLACEMENT[bedKey]
    const dx = x - p.cx
    const dy = y - p.cy
    const dist = dx * dx + dy * dy
    if (dist < nearestDist) {
      nearestDist = dist
      nearestHue = MOTE_BED_HUES[bedKey]
    }
  })
  return nearestHue
}

// Compute mote color: mix neutral with nearest mature bed hue
function moteColor(mote, bedStages, journeyStageKey) {
  const k = MOTE_K_BY_JOURNEY[journeyStageKey] || 0
  if (k <= 0) return SCENE_PALETTE.goldPale
  const hue = nearestMatureBedHue(mote.x, mote.y, bedStages)
  if (!hue) return SCENE_PALETTE.goldPale
  return mixHex(MOTE_NEUTRAL, hue, k)
}

// ── z00: Sky gradient + horizon glow ──────────────────────────
// Horizon glow opacity is Journey-driven (atmosphere.horizonGlow).
function SkyComponent({ atmosphere, isReduced, sceneId }) {
  const glowOpacity = atmosphere.horizonGlow
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SCENE_PALETTE.nightTop} />
          <Stop offset="0.62" stopColor={SCENE_PALETTE.nightMid} />
          <Stop offset="1" stopColor={SCENE_PALETTE.horizon} />
        </LinearGradient>
        <RadialGradient id={`${sceneId}-horizonGlow`} cx="0.5" cy="1" r="0.72">
          <Stop offset="0" stopColor={SCENE_PALETTE.gold} stopOpacity="0.26" />
          <Stop offset="0.5" stopColor={SCENE_PALETTE.gold} stopOpacity="0.091" />
          <Stop offset="1" stopColor={SCENE_PALETTE.gold} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={`url(#${sceneId}-sky)`} />
      <Ellipse
        cx={196}
        cy={300}
        rx={300}
        ry={130}
        fill={`url(#${sceneId}-horizonGlow)`}
        opacity={glowOpacity}
      />
    </G>
  )
}

// ── z01: Distant treeline ─────────────────────────────────────
function TreelineComponent({ sceneId }) {
  return (
    <G>
      <Path d={TREELINE_D} fill={SCENE_PALETTE.treeline} />
      <Path
        d={TREELINE_D}
        fill="none"
        stroke={SCENE_PALETTE.gold}
        strokeWidth="0.8"
        opacity="0.07"
      />
    </G>
  )
}

// ── z02: Ground plane + dapple pools ──────────────────────────
function GroundComponent({ atmosphere, sceneId }) {
  const dapple = atmosphere.dappleStrength
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-ground`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SCENE_PALETTE.groundFar} />
          <Stop offset="0.45" stopColor={SCENE_PALETTE.groundMid} />
          <Stop offset="1" stopColor={SCENE_PALETTE.groundNear} />
        </LinearGradient>
      </Defs>
      <Path
        d={`M 0 ${HORIZON_Y} L ${SCENE_WIDTH} ${HORIZON_Y} L ${SCENE_WIDTH} ${SCENE_HEIGHT} L 0 ${SCENE_HEIGHT} Z`}
        fill={`url(#${sceneId}-ground)`}
      />
      <Ellipse cx={196} cy={276} rx={240} ry={26} fill={SCENE_PALETTE.horizon} opacity="0.55" />
      {/* Dapple pools — soft light ellipses, no filters */}
      {DAPPLE_POOLS.map((pool, i) => (
        <Ellipse
          key={`dapple-${i}`}
          cx={pool.cx}
          cy={pool.cy}
          rx={pool.rx}
          ry={pool.ry}
          fill={SCENE_PALETTE.gold}
          opacity={0.05 * dapple}
        />
      ))}
    </G>
  )
}

// ── z04: Path ─────────────────────────────────────────────────
function PathComponent({ sceneId }) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`${sceneId}-path`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SCENE_PALETTE.pathColor} stopOpacity="0.40" />
          <Stop offset="1" stopColor={SCENE_PALETTE.pathColorNear} stopOpacity="0.65" />
        </LinearGradient>
      </Defs>
      <Path
        d={PATH_D}
        stroke={`url(#${sceneId}-path)`}
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
      />
    </G>
  )
}

// ── z05: Ground detail — grass tufts + stepping stones ────────
function GroundDetailComponent({ sceneId }) {
  return (
    <G>
      {/* Stepping stones along the path */}
      {STEPPING_STONES.map((stone, i) => (
        <Ellipse
          key={`stone-${i}`}
          cx={stone.cx}
          cy={stone.cy}
          rx={stone.rx}
          ry={stone.ry}
          fill={SCENE_PALETTE.pathColorNear}
          opacity="0.35"
        />
      ))}
      {/* Grass tufts — precomputed deterministic positions */}
      {GRASS_TUFTS.map((tuft, i) => (
        <Path
          key={`grass-${i}`}
          d={`M ${tuft.x.toFixed(2)} ${(tuft.y + tuft.h).toFixed(2)} L ${(tuft.x + tuft.lean).toFixed(2)} ${tuft.y.toFixed(2)}`}
          stroke={SCENE_PALETTE.groundFar}
          strokeWidth="0.8"
          opacity="0.6"
          strokeLinecap="round"
        />
      ))}
    </G>
  )
}

// ── z10: Ambient motes (Journey-driven) ───────────────────────
// Motes drift upward and fade. Up to 12, count depends on Journey.
// In reduced-motion mode, motes are static at 0.3 opacity.
// Hue-sampled motes (spec §6.3): take nearest mature bed's hue.
function MotesComponent({ atmosphere, isReduced, sceneId, bedStages, journeyStageKey }) {
  const count = atmosphere.moteCount
  const baseOpacity = atmosphere.moteOpacity
  if (count === 0) return null

  const motes = MOTE_POSITIONS.slice(0, count)

  if (isReduced) {
    return (
      <G>
        {motes.map((mote, i) => (
          <Circle
            key={`mote-${i}`}
            cx={mote.x}
            cy={mote.y}
            r={mote.r}
            fill={moteColor(mote, bedStages, journeyStageKey)}
            opacity="0.3"
          />
        ))}
      </G>
    )
  }

  // Animated motes — each drifts independently via Animated.loop
  return (
    <G>
      {motes.map((mote, i) => (
        <AnimatedMote
          key={`mote-${i}`}
          mote={mote}
          baseOpacity={baseOpacity}
          color={moteColor(mote, bedStages, journeyStageKey)}
        />
      ))}
    </G>
  )
}

// ── Single animated mote ──────────────────────────────────────
// Uses RN Animated to drive opacity + translateY drift.
// Period 14–22s, staggered negative delays (spec §19).
function AnimatedMote({ mote, baseOpacity, color }) {
  const opacityRef = React.useRef(new Animated.Value(0))
  const translateYRef = React.useRef(new Animated.Value(0))

  React.useEffect(() => {
    const { current: opacity } = opacityRef
    const { current: translateY } = translateYRef

    // Start at mid-point (negative delay simulation)
    opacity.setValue(baseOpacity * 0.3)
    translateY.setValue(0)

    const driftAnim = Animated.loop(
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: baseOpacity,
          duration: mote.duration * 500,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: mote.driftY,
          duration: mote.duration * 1000,
          useNativeDriver: true,
        }),
      ]),
    )

    driftAnim.start()
    return () => driftAnim.stop()
  }, [baseOpacity, mote.driftY, mote.duration])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: mote.x - mote.r,
        top: mote.y - mote.r,
        width: mote.r * 2,
        height: mote.r * 2,
        opacity: opacityRef.current,
        transform: [{ translateY: translateYRef.current }],
      }}
      pointerEvents="none"
    >
      <Svg width={mote.r * 2} height={mote.r * 2} viewBox={`0 0 ${mote.r * 2} ${mote.r * 2}`}>
        <Circle cx={mote.r} cy={mote.r} r={mote.r} fill={color || SCENE_PALETTE.goldPale} />
      </Svg>
    </Animated.View>
  )
}

// ── z11: Vignette ─────────────────────────────────────────────
function VignetteComponent({ sceneId }) {
  return (
    <G pointerEvents="none">
      <Defs>
        <RadialGradient id={`${sceneId}-vig`} cx="0.5" cy="0.45" r="0.78">
          <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.40" />
        </RadialGradient>
      </Defs>
      <Rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill={`url(#${sceneId}-vig)`} />
    </G>
  )
}

// ── Memoised exports ──────────────────────────────────────────
export const Sky = memo(SkyComponent)
export const Treeline = memo(TreelineComponent)
export const Ground = memo(GroundComponent)
export const PathLayer = memo(PathComponent)
export const GroundDetail = memo(GroundDetailComponent)
export const Motes = memo(MotesComponent)
export const Vignette = memo(VignetteComponent)
