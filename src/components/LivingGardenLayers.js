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
import Svg, { G, Rect, Ellipse, Path, Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg'
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
  SCENE_PALETTE,
} from './LivingGardenGeometry'

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
      <Path d={TREELINE_D} fill="none" stroke={SCENE_PALETTE.gold} strokeWidth="0.8" opacity="0.07" />
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
      <Path d={`M 0 ${HORIZON_Y} L ${SCENE_WIDTH} ${HORIZON_Y} L ${SCENE_WIDTH} ${SCENE_HEIGHT} L 0 ${SCENE_HEIGHT} Z`} fill={`url(#${sceneId}-ground)`} />
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
      <Path d={PATH_D} stroke={`url(#${sceneId}-path)`} strokeWidth="14" fill="none" strokeLinecap="round" />
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
function MotesComponent({ atmosphere, isReduced, sceneId }) {
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
            fill={SCENE_PALETTE.goldPale}
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
        />
      ))}
    </G>
  )
}

// ── Single animated mote ──────────────────────────────────────
// Uses RN Animated to drive opacity + translateY drift.
// Period 14–22s, staggered negative delays (spec §19).
function AnimatedMote({ mote, baseOpacity }) {
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
      ])
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
        <Circle cx={mote.r} cy={mote.r} r={mote.r} fill={SCENE_PALETTE.goldPale} />
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
