// ─────────────────────────────────────────────────────────────
// LivingGardenSpotlight.js — V6 Spotlight Prototype 1
//
// DEV-PREVIEW PROTOTYPE ONLY.
// Not wired to real advancement events, persistence, or logging.
//
// ARCHITECTURE: Identity Handoff
//   The canonical grid remains structurally mounted.
//   A foreground SVG overlay renders a temporary copy of the
//   Greens bed, scaled and lit to communicate:
//   "THIS BED ADVANCED."
//
// THE BED IS PROMOTED. THE PLANT IS NOT.
//   No individual foliage element receives independent scaling,
//   animation, or timing. The entire bed is the animated unit.
//
// THREE AUTHORITATIVE ANIMATED VALUES:
//   1. spotlightProgress — drives scale, translateY, scrim,
//      warm light, contact shadow
//   2. stageProgress — drives source/target crossfade
//   3. breathProgress — drives 1.50 → 1.52 → 1.50 vitality breath
//
// CANONICAL ARTWORK IS FROZEN.
//   Renders existing LivingGardenBed at canonical positions.
//   No artwork modification, no new geometry, no silhouette
//   overflow, no micro-foliage, no per-leaf animation.
//
// Does NOT modify thresholds, persistence, progression truth,
// RevenueCat, quotas, backend, or real advancement events.
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Animated, AppState, Easing, View, StyleSheet } from 'react-native'
import { Svg, G, Rect, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg'
import { LivingGardenBed } from './LivingGardenBed'
import { BED_PLACEMENT, SCENE_WIDTH, SCENE_HEIGHT } from './LivingGardenGeometry'

// ── V6 Spotlight constants ────────────────────────────────────
export const SPOTLIGHT_HOLD_SCALE = 1.50
export const SPOTLIGHT_BREATH_PEAK = 1.52
export const SPOTLIGHT_ABSOLUTE_PEAK = 1.52
export const SPOTLIGHT_DURATION_MS = 2500
export const SPOTLIGHT_SCRIM_MAX = 0.28
export const SPOTLIGHT_WARM_MAX = 0.17
export const SPOTLIGHT_WARM_HOLD = 0.13
export const SPOTLIGHT_WARM_LIFT = 0.12
export const SPOTLIGHT_SHADOW_MAX = 0.18
export const SPOTLIGHT_MAX_CONTAINMENT = 12

export const SPOTLIGHT_DEFAULT_SOURCE = 'growing'
export const SPOTLIGHT_DEFAULT_TARGET = 'harvesting'
export const SPOTLIGHT_BED_KEY = 'greens'

// Bed-specific foliage bounds at Harvesting (for containment + tests)
export const FOLIAGE_BOUNDS = {
  greens: { halfWidth: 24, topHeight: 19.8 },   // 4 rosettes, offsets ±18, outer path ±6, h*1.1
  roots: { halfWidth: 18, topHeight: 14.4 },     // 3 tufts, offsets ±14, frond ±4, h*1.2
  citrus: { halfWidth: 24, topHeight: 42 },      // crownR=23.92, trunkH=18, total ~42
  orchard: { halfWidth: 24, topHeight: 46 },     // crownR=23.92, trunkH=22, total ~46
  tropical: { halfWidth: 20, topHeight: 20 },    // 3 rosettes, offsets ±14, frond ±6, h*1.25
  berries: { halfWidth: 18, topHeight: 8.3 },    // 3 mounds, offsets ±12, berry top h*0.55+berryR
  herbs: { halfWidth: 10.5, topHeight: 12 },     // 4 cushions, r=8, flower stem 12
}

// Per-bed scale caps to keep largest individual element <= 34dp at peak.
// Default: hold=1.50, peak=1.52 (global V6 ceiling).
// Citrus + Orchard: crownR=23.92dp → 34/23.92=1.421 → hold=1.40, peak=1.42
export const BED_SCALE_CONFIG = {
  greens: { holdScale: SPOTLIGHT_HOLD_SCALE, peakScale: SPOTLIGHT_BREATH_PEAK },
  roots: { holdScale: SPOTLIGHT_HOLD_SCALE, peakScale: SPOTLIGHT_BREATH_PEAK },
  citrus: { holdScale: 1.40, peakScale: 1.42 },
  orchard: { holdScale: 1.40, peakScale: 1.42 },
  tropical: { holdScale: SPOTLIGHT_HOLD_SCALE, peakScale: SPOTLIGHT_BREATH_PEAK },
  berries: { holdScale: SPOTLIGHT_HOLD_SCALE, peakScale: SPOTLIGHT_BREATH_PEAK },
  herbs: { holdScale: SPOTLIGHT_HOLD_SCALE, peakScale: SPOTLIGHT_BREATH_PEAK },
}

// Reduced motion timing
export const REDUCED_DURATION_MS = 700
const REDUCED_SCRIM_IN = 100
const REDUCED_CROSSFADE_START = 100
const REDUCED_CROSSFADE_DURATION = 260
const REDUCED_READ_END = 500
const REDUCED_SCRIM_OUT_DURATION = 200

// Easing curves
const LIFT_EASING = Easing.bezier(0.05, 0.70, 0.10, 1.00)
const SETTLE_EASING = Easing.bezier(0.30, 0.00, 0.00, 1.00)
const BREATH_EASING = Easing.inOut(Easing.ease)

// ── Linear interpolation helper ───────────────────────────────
function interp(value, input, output) {
  if (value <= input[0]) return output[0]
  if (value >= input[input.length - 1]) return output[output.length - 1]
  for (let i = 0; i < input.length - 1; i++) {
    if (value >= input[i] && value <= input[i + 1]) {
      const t = (value - input[i]) / (input[i + 1] - input[i])
      return output[i] + t * (output[i + 1] - output[i])
    }
  }
  return output[output.length - 1]
}

// ── Containment calculation ───────────────────────────────────
// At HOLD_SCALE, check if foliage stays within scene bounds.
// Only foliage bounds are checked — soil extending below is acceptable.
// Returns { x, y } containment offset, capped at MAX_CONTAINMENT.
function computeContainment(bedKey, placement, scale) {
  if (!placement) return { x: 0, y: 0 }
  const bounds = FOLIAGE_BOUNDS[bedKey] || FOLIAGE_BOUNDS.greens
  const s = scale
  const leftFoliageX = placement.cx - bounds.halfWidth
  const rightFoliageX = placement.cx + bounds.halfWidth
  const topFoliageY = placement.cy - bounds.topHeight

  // Scaled positions around (cx, cy)
  const scaledLeft = placement.cx + (leftFoliageX - placement.cx) * s
  const scaledRight = placement.cx + (rightFoliageX - placement.cx) * s
  const scaledTop = placement.cy + (topFoliageY - placement.cy) * s

  let x = 0
  let y = 0

  // Keep foliage within 8dp safe margin
  if (scaledLeft < 8) {
    x = Math.min(SPOTLIGHT_MAX_CONTAINMENT, 8 - scaledLeft)
  }
  if (scaledRight > SCENE_WIDTH - 8) {
    x = Math.max(-SPOTLIGHT_MAX_CONTAINMENT, (SCENE_WIDTH - 8) - scaledRight)
  }
  if (scaledTop < 8) {
    y = Math.min(SPOTLIGHT_MAX_CONTAINMENT, 8 - scaledTop)
  }
  // No bottom check — soil extending below scene is acceptable

  return { x, y }
}

// ── Spotlight overlay component ───────────────────────────────
export function LivingGardenSpotlight({
  bedKey = SPOTLIGHT_BED_KEY,
  sourceStage = SPOTLIGHT_DEFAULT_SOURCE,
  targetStage = SPOTLIGHT_DEFAULT_TARGET,
  isReduced = false,
  replayToken = 0,
  sceneId = 'spotlight',
  onComplete = null,
  availableWidth = SCENE_WIDTH,
  availableHeight = SCENE_HEIGHT,
}) {
  const placement = BED_PLACEMENT[bedKey]

  // ── 3 authoritative Animated.Values ────────────────────────
  const spotlightProgress = useRef(new Animated.Value(0))
  const stageProgress = useRef(new Animated.Value(0))
  const breathProgress = useRef(new Animated.Value(0))

  // ── SVG render state (listener-based, same pattern as LivingGardenBed) ──
  const [bedTransform, setBedTransform] = useState('')
  const [scrimOpacity, setScrimOpacity] = useState(0)
  const [warmLightOpacity, setWarmLightOpacity] = useState(0)
  const [shadowOpacity, setShadowOpacity] = useState(0)
  const [shadowTransform, setShadowTransform] = useState('')
  const [sourceBedOpacity, setSourceBedOpacity] = useState(1)
  const [targetBedOpacity, setTargetBedOpacity] = useState(0)
  const [overlayVisible, setOverlayVisible] = useState(true)

  // ── Timeline and cleanup refs ──────────────────────────────
  const timelineRef = useRef(null)
  const exitTimerRef = useRef(null)
  const appStateSubRef = useRef(null)
  const mountedRef = useRef(true)
  const completedRef = useRef(false)

  // ── Per-bed scale config (34dp element cap) ──────────────
  const bedScale = BED_SCALE_CONFIG[bedKey] || BED_SCALE_CONFIG.greens
  const holdScale = bedScale.holdScale
  const peakScale = bedScale.peakScale

  // ── Containment (computed once for hold scale) ─────────────
  const containment = useMemo(
    () => computeContainment(bedKey, placement, holdScale),
    [bedKey, placement, holdScale],
  )

  // ── Compute all SVG values from the 3 Animated.Values ──────
  const updateAllSvgValues = useCallback(() => {
    if (!mountedRef.current || !placement) return

    const sp = spotlightProgress.current.__getValue()
    const stp = stageProgress.current.__getValue()
    const bp = breathProgress.current.__getValue()

    // Scale: 1.0 → 0.985 → holdScale → holdScale → 1.0
    // In reduced motion: scale stays at 1.0 (no Hero scale, no lift)
    const baseScale = isReduced
      ? 1.0
      : interp(
          sp,
          [0, 0.032, 0.184, 0.72, 1.0],
          [1.0, 0.985, holdScale, holdScale, 1.0],
        )
    // Breath: sin(pi * bp) * (peakScale - holdScale)
    // In reduced motion: no breath
    const breathDelta = isReduced ? 0 : Math.sin(Math.PI * bp) * (peakScale - holdScale)
    const scale = baseScale + breathDelta

    // TranslateY: small upward lift, 2-3% of bed height
    // In reduced motion: no translate
    const translateY = isReduced ? 0 : interp(
      sp,
      [0, 0.032, 0.184, 0.72, 1.0],
      [0, -0.5, -3, -3, 0],
    )

    // Containment interpolates with spotlight progress
    // In reduced motion: no containment (scale = 1.0)
    const contX = isReduced ? 0 : containment.x * interp(sp, [0, 0.184, 0.72, 1.0], [0, 1, 1, 0])
    const contY = isReduced ? 0 : containment.y * interp(sp, [0, 0.184, 0.72, 1.0], [0, 1, 1, 0])

    // SVG transform: scale around soil line (cx, cy) with translateY and containment
    const cx = placement.cx
    const cy = placement.cy
    setBedTransform(
      `translate(${cx + contX} ${cy + translateY + contY}) scale(${scale}) translate(${-cx} ${-cy})`,
    )

    // Scrim: 0 → 0.28 (starts at 40ms), holds, → 0
    // In reduced motion: scrim still animates (focus/scrim appears)
    setScrimOpacity(
      interp(sp, [0, 0.016, 0.184, 0.72, 1.0], [0, 0, SPOTLIGHT_SCRIM_MAX, SPOTLIGHT_SCRIM_MAX, 0]),
    )

    // Warm light: 0 → 0.03 → 0.12 → 0.13 → 0.13 → 0, plus breath crest
    // In reduced motion: warm light still appears (soft focus)
    const baseWarm = interp(
      sp,
      [0, 0.032, 0.184, 0.392, 0.72, 1.0],
      [0, 0.03, SPOTLIGHT_WARM_LIFT, SPOTLIGHT_WARM_HOLD, SPOTLIGHT_WARM_HOLD, 0],
    )
    const breathWarm = isReduced ? 0 : Math.sin(Math.PI * bp) * (SPOTLIGHT_WARM_MAX - SPOTLIGHT_WARM_HOLD)
    setWarmLightOpacity(baseWarm + breathWarm)

    // Shadow: opacity 0 → 0.18, scale 0.90 → 1.12
    // In reduced motion: no shadow movement
    setShadowOpacity(
      isReduced ? 0 : interp(sp, [0, 0.032, 0.184, 0.72, 1.0], [0, 0, SPOTLIGHT_SHADOW_MAX, SPOTLIGHT_SHADOW_MAX, 0]),
    )
    const shadowScale = isReduced ? 1.0 : interp(sp, [0, 0.184, 0.72, 1.0], [0.90, 1.12, 1.12, 0.90])
    const shadowOffsetY = isReduced ? 0 : interp(sp, [0, 0.184, 0.72, 1.0], [0, 2, 2, 0])
    setShadowTransform(
      `translate(${cx} ${cy + placement.ry + shadowOffsetY}) scale(${shadowScale} 1) translate(${-cx} ${-(cy + placement.ry)})`,
    )

    // Stage crossfade: source 1→0, target 0→1
    setSourceBedOpacity(1 - stp)
    setTargetBedOpacity(stp)
  }, [placement, containment, isReduced, holdScale, peakScale])

  // ── Listener setup ─────────────────────────────────────────
  useEffect(() => {
    if (!placement) return
    mountedRef.current = true

    const update = () => updateAllSvgValues()
    update() // initial values

    const l1 = spotlightProgress.current.addListener(update)
    const l2 = stageProgress.current.addListener(update)
    const l3 = breathProgress.current.addListener(update)

    return () => {
      mountedRef.current = false
      spotlightProgress.current.removeListener(l1)
      stageProgress.current.removeListener(l2)
      breathProgress.current.removeListener(l3)
    }
  }, [placement, updateAllSvgValues])

  // ── Build normal timeline (2500ms) ─────────────────────────
  const buildNormalTimeline = useCallback(() => {
    spotlightProgress.current.setValue(0)
    stageProgress.current.setValue(0)
    breathProgress.current.setValue(0)
    completedRef.current = false

    return Animated.parallel([
      // Spotlight progress (scale/translate/scrim/warm/shadow)
      Animated.sequence([
        // Beat 0: 0-80ms — answer
        Animated.timing(spotlightProgress.current, {
          toValue: 0.032,
          duration: 80,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        // Beat 1: 80-460ms — lift
        Animated.timing(spotlightProgress.current, {
          toValue: 0.184,
          duration: 380,
          easing: LIFT_EASING,
          useNativeDriver: false,
        }),
        // Beat 4: 460-1800ms — hold (includes breath)
        Animated.delay(1340),
        // Beat 5: 1800-2500ms — settle
        Animated.timing(spotlightProgress.current, {
          toValue: 1.0,
          duration: 700,
          easing: SETTLE_EASING,
          useNativeDriver: false,
        }),
      ]),
      // Stage progress (Beat 2: 420-720ms — canonical state arrival)
      Animated.sequence([
        Animated.delay(420),
        Animated.timing(stageProgress.current, {
          toValue: 1,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
      // Breath (Beat 3: 720-980ms — one vitality breath)
      Animated.sequence([
        Animated.delay(720),
        Animated.timing(breathProgress.current, {
          toValue: 1,
          duration: 130,
          easing: BREATH_EASING,
          useNativeDriver: false,
        }),
        Animated.timing(breathProgress.current, {
          toValue: 0,
          duration: 130,
          easing: BREATH_EASING,
          useNativeDriver: false,
        }),
      ]),
    ])
  }, [])

  // ── Build reduced motion timeline (700ms) ──────────────────
  const buildReducedTimeline = useCallback(() => {
    spotlightProgress.current.setValue(0)
    stageProgress.current.setValue(0)
    breathProgress.current.setValue(0)
    completedRef.current = false

    // In reduced motion: no scale, no lift, no breath, no shadow
    // spotlightProgress stays at 0 (scale 1.0, no transform)
    // Only scrim, warm light, and stage crossfade animate
    return Animated.parallel([
      // Scrim: in 100ms, hold, out 200ms
      Animated.sequence([
        Animated.timing(spotlightProgress.current, {
          toValue: 0.184, // reach hold level for scrim (but scale stays 1.0 via interp)
          duration: REDUCED_SCRIM_IN,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(REDUCED_READ_END - REDUCED_SCRIM_IN),
        Animated.timing(spotlightProgress.current, {
          toValue: 1.0, // settle → scrim 0
          duration: REDUCED_SCRIM_OUT_DURATION,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
      // Stage crossfade: 100-360ms
      Animated.sequence([
        Animated.delay(REDUCED_CROSSFADE_START),
        Animated.timing(stageProgress.current, {
          toValue: 1,
          duration: REDUCED_CROSSFADE_DURATION,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
    ])
  }, [])

  // ── Cancel and resolve to target ───────────────────────────
  const cancelAndResolve = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.stop()
      timelineRef.current = null
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    // Resolve to target state immediately
    spotlightProgress.current.setValue(1.0)
    stageProgress.current.setValue(1.0)
    breathProgress.current.setValue(0)
    updateAllSvgValues()
    completedRef.current = true
    setOverlayVisible(false)
    if (onComplete) onComplete()
  }, [updateAllSvgValues, onComplete])

  // ── Start timeline ─────────────────────────────────────────
  const startTimeline = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.stop()
    }
    setOverlayVisible(true)
    completedRef.current = false

    const timeline = isReduced ? buildReducedTimeline() : buildNormalTimeline()
    timelineRef.current = timeline

    timeline.start(() => {
      if (!mountedRef.current || completedRef.current) return
      completedRef.current = true
      // Beat 6: Exit identity handoff
      // Grid bed already renders target (pre-warmed by parent).
      // Hold ~2 frames for render commitment, then unmount overlay.
      exitTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        setOverlayVisible(false)
        exitTimerRef.current = null
        if (onComplete) onComplete()
      }, 33) // ~2 frames at 60fps
    })
  }, [isReduced, buildNormalTimeline, buildReducedTimeline, onComplete])

  // ── Replay trigger ─────────────────────────────────────────
  useEffect(() => {
    if (replayToken > 0) {
      startTimeline()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayToken])

  // ── AppState background interruption ───────────────────────
  useEffect(() => {
    const handleAppStateChange = (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        cancelAndResolve()
      }
    }
    appStateSubRef.current = AppState.addEventListener('change', handleAppStateChange)
    return () => {
      if (appStateSubRef.current && appStateSubRef.current.remove) {
        appStateSubRef.current.remove()
      }
      appStateSubRef.current = null
    }
  }, [cancelAndResolve])

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timelineRef.current) {
        timelineRef.current.stop()
        timelineRef.current = null
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      if (appStateSubRef.current && appStateSubRef.current.remove) {
        appStateSubRef.current.remove()
        appStateSubRef.current = null
      }
    }
  }, [])

  // ── Compute overlay scaling (same as FittedScene) ──────────
  const fitScale = Math.min(availableWidth / SCENE_WIDTH, availableHeight / SCENE_HEIGHT)
  const scaledW = SCENE_WIDTH * fitScale
  const scaledH = SCENE_HEIGHT * fitScale

  if (!placement || !overlayVisible) return null

  const cx = placement.cx
  const cy = placement.cy
  const soilRx = placement.rx
  const soilRy = placement.ry

  return (
    <View
      style={{
        position: 'absolute',
        width: scaledW,
        height: scaledH,
        left: (availableWidth - scaledW) / 2,
        top: (availableHeight - scaledH) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
      pointerEvents="none"
    >
      <View
        style={{
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          transform: [{ scale: fitScale }],
        }}
      >
        <Svg
          width={SCENE_WIDTH}
          height={SCENE_HEIGHT}
          viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
          preserveAspectRatio="xMidYMax slice"
        >
          <Defs>
            {/* Scrim radial gradient — transparent at hero center, darkening toward edges */}
            <RadialGradient
              id={`spotlight-scrim-${sceneId}`}
              cx={cx}
              cy={cy}
              r={SCENE_WIDTH * 0.65}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#0a1208" stopOpacity="0" />
              <Stop offset="0.4" stopColor="#0a1208" stopOpacity="0" />
              <Stop offset="1" stopColor="#0a1208" stopOpacity="1" />
            </RadialGradient>
            {/* Warm light radial gradient — soft sunlight behind bed */}
            <RadialGradient
              id={`spotlight-warm-${sceneId}`}
              cx={cx}
              cy={cy - soilRy}
              r={soilRx * 2.2}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#F4D9A8" stopOpacity="1" />
              <Stop offset="0.5" stopColor="#E8C896" stopOpacity="0.6" />
              <Stop offset="1" stopColor="#D4B888" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Scrim — full scene, transparent at hero center */}
          <Rect
            x="0"
            y="0"
            width={SCENE_WIDTH}
            height={SCENE_HEIGHT}
            fill={`url(#spotlight-scrim-${sceneId})`}
            opacity={scrimOpacity}
          />

          {/* Warm light — behind bed, no defined halo edge */}
          <Ellipse
            cx={cx}
            cy={cy - soilRy * 0.5}
            rx={soilRx * 2.2}
            ry={soilRy * 2.8}
            fill={`url(#spotlight-warm-${sceneId})`}
            opacity={warmLightOpacity}
          />

          {/* Contact shadow — soft ellipse beneath bed */}
          <G transform={shadowTransform}>
            <Ellipse
              cx={cx}
              cy={cy + soilRy}
              rx={soilRx * 1.1}
              ry={soilRy * 0.4}
              fill="#0a1208"
              opacity={shadowOpacity}
            />
          </G>

          {/* Source bed (canonical Growing) — opacity driven by stageProgress */}
          <G transform={bedTransform} opacity={sourceBedOpacity}>
            <LivingGardenBed
              bedKey={bedKey}
              stageKey={sourceStage}
              sceneId={`${sceneId}-src`}
            />
          </G>

          {/* Target bed (canonical Harvesting) — pre-mounted, opacity driven by stageProgress */}
          <G transform={bedTransform} opacity={targetBedOpacity}>
            <LivingGardenBed
              bedKey={bedKey}
              stageKey={targetStage}
              sceneId={`${sceneId}-tgt`}
            />
          </G>
        </Svg>
      </View>
    </View>
  )
}

export default LivingGardenSpotlight
