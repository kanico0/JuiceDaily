// ─────────────────────────────────────────────────────────────
// LivingGardenBedV4HeroFocusCalibration.js
// Motion V4 HERO FOCUS calibration prototype — Greens: Growing → Harvesting
//
// PREVIEW ONLY. Not production. Not propagated to other beds.
// Enabled only when motionVariant='v4-hero-focus' is passed through
// the Garden Visual Preview.
//
// V4 core insight: THE PROBLEM WAS NOT JUST AMPLITUDE —
// THE ACTIVE BED WAS TOO SMALL ON THE PHONE.
//
// V4 solution: ANCHORED BED MAGNIFICATION
// The active Greens bed temporarily borrows more screen authority
// by magnifying up to ~1.42x anchored at the soil line, rendering
// above neighboring beds in z-order.
//
// Seven-phase motion:
//   Phase 1: Attention       — scene focus, soil darkens
//   Phase 2: Bed Comes Alive — magnification begins, existing plants react
//   Phase 3: Hero Growth     — new outer rosettes surge upward
//   Phase 4: Major Unfurl    — dramatic leaf opening (32-36°)
//   Phase 5: Full Bed Bloom  — peak Hero frame hold
//   Phase 6: Vitality Through Plants — traveling wave through geometry
//   Phase 7: Merge/Settle    — resolve to canonical Harvesting
//
// HARD RULES:
//   - Existing/shared geometry NEVER shrinks below Growing state
//   - Bed magnification anchored at SOIL LINE (cy), not geometric center
//   - Hero bed renders ABOVE neighboring beds (z-order)
//   - No G opacity (react-native-svg 15.x safe)
//   - Structural zero-progress gate on new plants
//   - Ground light never more visually dominant than plant geometry
//   - Final frame = pixel-equivalent canonical Harvesting artwork
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react'
import { Animated, Easing, AppState } from 'react-native'
import { G, Path, Ellipse, Circle, Rect, Line, Defs, RadialGradient, Stop } from 'react-native-svg'
import {
  BED_PLACEMENT,
  BED_BLOBS,
  BED_FRINGES,
  PRODUCE_COLORS,
  SCENE_PALETTE,
  SCENE_WIDTH,
  SCENE_HEIGHT,
} from './LivingGardenGeometry'
import {
  STAGE_CHROMA,
  STAGE_ALPHA,
  BED_PALETTES,
  mixColor,
  gateColor,
} from './LivingGardenBed'

// ── V4 HERO FOCUS Constants ───────────────────────────────────
const TOTAL_DURATION = 3000 // ms (target: 2.8–3.3s)

// Phase windows as fractions of total timeline (0→1)
// Overlap intentionally — no dead gaps
const ATTENTION_START = 0.000, ATTENTION_END = 0.133 // 0–400ms
const BED_ALIVE_START = 0.083, BED_ALIVE_END = 0.433 // 250–1300ms
const HERO_GROWTH_START = 0.167, HERO_GROWTH_END = 0.567 // 500–1700ms
const UNFURL_START = 0.233, UNFURL_END = 0.667 // 700–2000ms
const BLOOM_HOLD_START = 0.500, BLOOM_HOLD_END = 0.567 // 1500–1700ms (~200ms hold)
const VITALITY_START = 0.367, VITALITY_END = 0.833 // 1100–2500ms
const SETTLE_START = 0.600, SETTLE_END = 1.000 // 1800–3000ms

// ── Bed magnification timeline ──
// 1.00 → ~1.15 (@500ms) → ~1.30 (@750ms) → peak ~1.42 → settle 1.00
const BED_SCALE_PEAK = 1.42
const BED_LIFT_PX = 6 // bed visual lift in SVG units

// ── Existing plant reaction ──
const EXISTING_LIFT_PX = 8
const EXISTING_LEAN_DEG = 11 // within 10–12° target
const EXISTING_SPREAD_PX = 14 // lateral spread each
const EXISTING_SCALE_REACTION = 1.06

// ── New-growth Hero values ──
const HERO_START_SCALE = 0.35
const HERO_TRAVEL_PX = 36 // local SVG travel (post-bed-scale: 36 * 1.42 ≈ 51 SVG px)
const HERO_OVERSHOOT = 1.05
const HERO_LEFT_STAGGER = 0.04 // ~120ms stagger

// ── Unfurl (MAJOR) ──
const UNFURL_START_SCALE_X = 0.55
const UNFURL_ROTATION_DEG = 34 // within 32–36° target
const LEAF_STAGGER = 0.022 // ~66ms per-leaf stagger

// ── Scene focus ──
const SCENE_DESATURATION = 0.08 // 8% temporary desaturation
const SCENE_BRIGHTNESS_REDUCTION = 0.05 // 5% temporary brightness reduction
const ACTIVE_WARMTH_BOOST = 0.10 // +10% warmth on active bed

// ── Ground light (supporting, NOT dominant) ──
const GROUND_LIGHT_PEAK = 0.12 // capped low — botanical geometry is the hero
const GROUND_LIGHT_RADIUS_RX = 1.3 // rx multiplier (not too large)
const GROUND_LIGHT_RADIUS_RY = 0.5 // ry multiplier

// ── Vitality through plants ──
// 6 geometry groups per plant (soil node, base, lower stem, mid-leaf, upper leaf, tip)
const VITALITY_GROUPS_PER_PLANT = 6
const VITALITY_GROUP_STAGGER = 0.022 // ~66ms stagger between groups
const VITALITY_GROUP_HOLD = 0.044 // ~133ms local hold per group

// ── Stage constants ──
const GROWING_HEIGHT_SCALE = 0.55
const HARVESTING_HEIGHT_SCALE = 1.0
const GROWING_ALPHA = STAGE_ALPHA.growing // 0.78
const HARVESTING_ALPHA = STAGE_ALPHA.harvesting // 0.93
const PATH_BASE_OPACITY = 0.9

// Plant layout for Harvesting (4 rosettes)
const HARVEST_PLANT_COUNT = 4
const PLANT_SPACING = 12
const LEAF_HEIGHT_BASE = 18 // h = 18 * heightScale

// ── Easing helpers ────────────────────────────────────────────
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const easeOut = (t) => 1 - (1 - t) * (1 - t)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const linearToEaseOut = (t) => (t < 0.5 ? (t / 0.5) * 0.5 : 0.5 + easeOut((t - 0.5) / 0.5) * 0.5)

// ── Color helpers for V4 ──────────────────────────────────────
const FROM_STAGE = 'growing'
const TO_STAGE = 'harvesting'

function v4LeafColor(progress) {
  const fromColor = gateColor(BED_PALETTES.greens.leaf, FROM_STAGE)
  const toColor = gateColor(BED_PALETTES.greens.leaf, TO_STAGE)
  return mixColor(fromColor, toColor, progress)
}

function v4BloomColor(progress) {
  const fromColor = gateColor(BED_PALETTES.greens.bloom, FROM_STAGE)
  const toColor = gateColor(BED_PALETTES.greens.bloom, TO_STAGE)
  return mixColor(fromColor, toColor, progress)
}

// ── SoilBed (Harvesting stage, replicated for V4 isolation) ───
function V4SoilBed({ bedKey, sceneId, soilDarken }) {
  const blob = BED_BLOBS[bedKey]
  const placement = BED_PLACEMENT[bedKey]
  const warmSoilColor = mixColor('#46271B', BED_PALETTES[bedKey].produce, 0.16)
  // Soil darkens slightly during attention phase (moisture/awakening cue)
  const darkSoilColor = mixColor(SCENE_PALETTE.loamDark, '#000000', soilDarken || 0)
  return (
    <G>
      <Path d={blob} fill={darkSoilColor} />
      <Path d={blob} fill={warmSoilColor} opacity={0.5} />
      <Path d={blob} fill="none" stroke={SCENE_PALETTE.loamLit} strokeWidth="0.8" opacity="0.60" />
      <Rect
        x={placement.cx - 2.5}
        y={placement.cy - placement.ry - 8}
        width="5"
        height="8"
        fill={PRODUCE_COLORS[bedKey]}
        opacity="0.7"
        rx="1"
      />
      {BED_FRINGES[bedKey].map((tuft, i) => (
        <Path
          key={`v4-fringe-${bedKey}-${i}`}
          d={`M ${tuft.x.toFixed(2)} ${(tuft.y + tuft.h).toFixed(2)} L ${(tuft.x + tuft.lean).toFixed(2)} ${tuft.y.toFixed(2)}`}
          stroke={SCENE_PALETTE.groundFar}
          strokeWidth="0.7"
          opacity="0.7"
          strokeLinecap="round"
        />
      ))}
    </G>
  )
}

// ── GroundBloom (Harvesting level, V4 — supporting only) ──────
function V4GroundBloom({ bedKey, placement, illuminationOpacity }) {
  const palette = BED_PALETTES[bedKey]
  const bloomFactor = 0.45
  const baseOpacity = 0.1 * bloomFactor
  const opacity = baseOpacity + (illuminationOpacity || 0)
  if (opacity <= 0) return null
  return (
    <Ellipse
      cx={placement.cx}
      cy={placement.cy + placement.ry * 0.3}
      rx={placement.rx * 1.75}
      ry={placement.ry * 0.72}
      fill={palette.produce}
      opacity={opacity}
    />
  )
}

// ── V4 Greens plant path generator ────────────────────────────
// Renders 4 ruffled strap-leaf paths with per-leaf vitality stagger.
// Each leaf can have individual rotation, opacity, and vitality highlight.
function V4GreensPlantPaths({
  px,
  py,
  h,
  color,
  opacity,
  rotationDeg,
  scaleX,
  leafStaggerProgress,
  vitalityProgress,
}) {
  const transform =
    rotationDeg !== 0 || scaleX !== 1
      ? `rotate(${rotationDeg} ${px} ${py}) scale(${scaleX} 1)`
      : undefined
  const baseOp = opacity * PATH_BASE_OPACITY

  // Per-leaf unfurl stagger
  const leafOpacities = [
    clamp(leafStaggerProgress / (1 - LEAF_STAGGER * 0), 0, 1),
    clamp((leafStaggerProgress - LEAF_STAGGER) / (1 - LEAF_STAGGER), 0, 1),
    clamp((leafStaggerProgress - LEAF_STAGGER * 2) / (1 - LEAF_STAGGER * 2), 0, 1),
    clamp((leafStaggerProgress - LEAF_STAGGER * 3) / (1 - LEAF_STAGGER * 3), 0, 1),
  ]

  // Per-leaf vitality: each leaf has 4 segments (base, lower, mid, tip)
  // The vitality wave travels through: soil node → base → stem → mid → leaf → tip
  // We approximate by giving each leaf a vitality delay based on its index
  // and each path within a leaf gets a sub-delay based on its height
  const leafPaths = [
    { dx: -6, dy: -h * 0.6, ex: -4, ey: -h, vitalitySeg: 0.2 }, // outer left
    { dx: 6, dy: -h * 0.6, ex: 4, ey: -h, vitalitySeg: 0.3 }, // outer right
    { dx: -3, dy: -h * 0.7, ex: -1, ey: -h * 1.1, vitalitySeg: 0.4 }, // inner left (taller)
    { dx: 3, dy: -h * 0.7, ex: 1, ey: -h * 1.1, vitalitySeg: 0.5 }, // inner right (taller)
  ]

  return (
    <G transform={transform}>
      {leafPaths.map((lp, idx) => {
        // Vitality highlight: temporary brightness on this leaf segment
        const vitalityDelay = idx * VITALITY_GROUP_STAGGER + lp.vitalitySeg * 0.1
        const vitalityLocal = clamp(
          (vitalityProgress - vitalityDelay) / (VITALITY_GROUP_HOLD + VITALITY_GROUP_STAGGER),
          0, 1,
        )
        const vitalityHighlight = Math.sin(vitalityLocal * Math.PI) * 0.15
        // Mix color toward bloom (brighter) during vitality peak
        const leafColor = vitalityHighlight > 0
          ? mixColor(color, BED_PALETTES.greens.bloom, vitalityHighlight)
          : color
        return (
          <Path
            key={`v4-leaf-${idx}`}
            d={`M ${px} ${py} Q ${px + lp.dx} ${py + lp.dy} ${px + lp.ex} ${py + lp.ey}`}
            stroke={leafColor}
            strokeWidth="1.4"
            fill="none"
            opacity={baseOp * leafOpacities[idx]}
            strokeLinecap="round"
          />
        )
      })}
    </G>
  )
}

// ── Scene focus overlay (subtle desaturation/brightness reduction) ──
// A semi-transparent dark overlay on the ENTIRE scene except the active bed area.
// This is subtle — not a modal/dim-overlay appearance.
function V4SceneFocusOverlay({ placement, intensity }) {
  if (intensity <= 0) return null
  // Render a dark rectangle covering the scene with a "hole" over the active bed.
  // Since react-native-svg doesn't support mask easily, we use 4 rectangles around the bed.
  // But that's complex. Instead, we use a subtle full-scene overlay with low opacity.
  // The active bed's warmth/brightness boost will make it stand out.
  return (
    <Rect
      x={0}
      y={0}
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
      fill="#000000"
      opacity={intensity * SCENE_BRIGHTNESS_REDUCTION}
    />
  )
}

// ── Active bed warmth boost overlay ───────────────────────────
function V4ActiveWarmthOverlay({ placement, intensity }) {
  if (intensity <= 0) return null
  return (
    <Ellipse
      cx={placement.cx}
      cy={placement.cy - placement.ry * 0.3}
      rx={placement.rx * 2.0}
      ry={placement.ry * 1.5}
      fill={BED_PALETTES.greens.bloom}
      opacity={intensity * ACTIVE_WARMTH_BOOST}
    />
  )
}

// ── Directional ground cue (points attention toward Greens) ───
function V4DirectionalCue({ placement, intensity }) {
  if (intensity <= 0) return null
  // A soft warm gradient path from the scene center toward the active bed
  const fromX = SCENE_WIDTH * 0.5
  const fromY = SCENE_HEIGHT * 0.5
  const toX = placement.cx
  const toY = placement.cy
  return (
    <Ellipse
      cx={(fromX + toX) / 2}
      cy={(fromY + toY) / 2}
      rx={Math.abs(toX - fromX) * 0.6}
      ry={Math.abs(toY - fromY) * 0.3}
      fill={BED_PALETTES.greens.bloom}
      opacity={intensity * 0.04}
    />
  )
}

// ── Main V4 HERO FOCUS Calibration Bed Component ──────────────
export const GreensV4HeroFocusCalibrationBed = React.memo(
  function GreensV4HeroFocusCalibrationBed({
    bedKey,
    stageKey,
    sceneId,
    advancements,
    isReduced,
    onV4Debug,
  }) {
    const placement = BED_PLACEMENT[bedKey]
    const timelineRef = useRef(new Animated.Value(isReduced ? 1 : 0))
    const animRef = useRef(null)
    const processedAdvancementRef = useRef(null)

    // Single state object updated by one listener (one setState per frame)
    const [motion, setMotion] = useState({
      bedScale: 1,
      bedLift: 0,
      soilDarken: 0,
      sceneFocus: 0,
      activeWarmth: 0,
      directionalCue: 0,
      groundLight: 0,
      heroGrowth: 0,
      heroGrowthOvershoot: 0,
      unfurl: 0,
      existingLift: 0,
      existingLean: 0,
      existingSpread: 0,
      existingScaleReaction: 0,
      heightGrowth: 0,
      vitality: 0,
      bloomHold: 0,
      currentPhase: 0,
      timelineProgress: 0,
    })

    // ── Detect advancement and start animation ──────────────
    const greensAdvancement = advancements?.bedAdvancements?.find(
      (a) => a.bedKey === 'greens' && a.fromStage === 'growing' && a.toStage === 'harvesting',
    )

    useEffect(() => {
      if (!greensAdvancement) return
      if (processedAdvancementRef.current === advancements) return
      processedAdvancementRef.current = advancements

      if (isReduced) {
        timelineRef.current.setValue(1)
        return
      }

      if (animRef.current) animRef.current.stop()

      timelineRef.current.setValue(0)
      const anim = Animated.timing(timelineRef.current, {
        toValue: 1,
        duration: TOTAL_DURATION,
        easing: Easing.linear,
        useNativeDriver: false,
      })
      animRef.current = anim
      anim.start(({ finished }) => {
        if (finished) {
          timelineRef.current.setValue(1)
        }
        animRef.current = null
      })

      return () => {
        if (animRef.current) {
          animRef.current.stop()
          animRef.current = null
        }
      }
    }, [advancements, greensAdvancement, isReduced])

    // ── Background interruption: cancel + canonical ────────
    useEffect(() => {
      const handleAppState = (nextState) => {
        if (nextState === 'background' || nextState === 'inactive') {
          if (animRef.current) {
            animRef.current.stop()
            animRef.current = null
          }
          timelineRef.current.setValue(1)
        }
      }
      const sub = AppState.addEventListener('change', handleAppState)
      return () => sub.remove()
    }, [])

    // ── Single listener: compute all phase progresses ──────
    useEffect(() => {
      const update = ({ value: t }) => {
        // ── Phase 1: Attention ──
        const attentionRaw = clamp((t - ATTENTION_START) / (ATTENTION_END - ATTENTION_START), 0, 1)
        const attention = easeOut(attentionRaw)
        // Scene focus peaks then fades during settle
        const settleRaw = clamp((t - SETTLE_START) / (SETTLE_END - SETTLE_START), 0, 1)
        const settle = easeInOutCubic(settleRaw)
        const sceneFocusEnvelope = attention * (1 - settle)
        const sceneFocus = SCENE_DESATURATION * sceneFocusEnvelope
        const soilDarken = 0.12 * sceneFocusEnvelope // soil darkens slightly
        const activeWarmth = ACTIVE_WARMTH_BOOST * sceneFocusEnvelope
        const directionalCue = 0.04 * sceneFocusEnvelope

        // ── Phase 2: Bed Comes Alive (magnification) ──
        // 1.0 → 1.15 (@500ms) → 1.30 (@750ms) → peak 1.42 → settle 1.0
        const bedAliveRaw = clamp((t - BED_ALIVE_START) / (BED_ALIVE_END - BED_ALIVE_START), 0, 1)
        const bedAlive = easeOutCubic(bedAliveRaw)
        // Bed scale: rises to peak, holds during bloom, settles
        // Use a piecewise: ramp up with ease-out-cubic, hold, then settle
        const bedScaleRamp = bedAlive // 0→1 during bed alive phase
        const bedScaleHold = t >= BLOOM_HOLD_START && t <= BLOOM_HOLD_END ? 1 : bedScaleRamp
        // During settle, scale resolves from peak to 1.0
        const bedScale = settle > 0
          ? 1 + (BED_SCALE_PEAK - 1) * (1 - settle)
          : 1 + (BED_SCALE_PEAK - 1) * bedScaleHold
        const bedLift = settle > 0
          ? BED_LIFT_PX * (1 - settle)
          : BED_LIFT_PX * bedAlive

        // ── Phase 3: Hero Growth ──
        const heroRaw = clamp((t - HERO_GROWTH_START) / (HERO_GROWTH_END - HERO_GROWTH_START), 0, 1)
        const heroGrowth = easeOutCubic(heroRaw)
        // Overshoot: small controlled growth overshoot on new geometry
        const heroOvershootRaw = clamp(
          (t - HERO_GROWTH_START) / (HERO_GROWTH_END - HERO_GROWTH_START), 0, 1,
        )
        const heroOvershoot = heroOvershootRaw > 0.8
          ? Math.sin((heroOvershootRaw - 0.8) / 0.2 * Math.PI) * (HERO_OVERSHOOT - 1)
          : 0

        // ── Phase 4: Major Unfurl ──
        const unfurlRaw = clamp((t - UNFURL_START) / (UNFURL_END - UNFURL_START), 0, 1)
        const unfurl = easeOut(unfurlRaw)

        // ── Phase 5: Bloom Hold ──
        const bloomHoldRaw = clamp((t - BLOOM_HOLD_START) / (BLOOM_HOLD_END - BLOOM_HOLD_START), 0, 1)
        const bloomHold = bloomHoldRaw > 0 && bloomHoldRaw < 1 ? 1 : 0

        // ── Existing plant reaction ──
        const reactionRaw = clamp((t - BED_ALIVE_START) / (BED_ALIVE_END - BED_ALIVE_START), 0, 1)
        const reaction = easeInOut(reactionRaw)
        const reactionEnvelope = reaction * (1 - settle * 0.5)
        const existingLift = EXISTING_LIFT_PX * reactionEnvelope
        const existingLean = EXISTING_LEAN_DEG * reactionEnvelope
        const existingSpread = EXISTING_SPREAD_PX * reactionEnvelope
        const existingScaleReaction = 1 + (EXISTING_SCALE_REACTION - 1) * reactionEnvelope

        // ── Height growth (shared plants) ──
        const heightRaw = clamp((t - HERO_GROWTH_START) / (SETTLE_END - HERO_GROWTH_START), 0, 1)
        const heightGrowth = easeOutCubic(heightRaw)

        // ── Phase 6: Vitality Through Plants ──
        const vitalityRaw = clamp((t - VITALITY_START) / (VITALITY_END - VITALITY_START), 0, 1)
        const vitality = linearToEaseOut(vitalityRaw)

        // ── Ground light (supporting, NOT dominant) ──
        // Caps at GROUND_LIGHT_PEAK, peaks during hero growth, fades during settle
        const groundLightRaw = clamp(
          (t - HERO_GROWTH_START) / (UNFURL_END - HERO_GROWTH_START), 0, 1,
        )
        const groundLight = GROUND_LIGHT_PEAK * Math.sin(groundLightRaw * Math.PI) * (1 - settle * 0.3)

        // ── Current phase for diagnostic ──
        let currentPhase = 0
        if (t >= SETTLE_START) currentPhase = 7
        else if (t >= VITALITY_START) currentPhase = 6
        else if (t >= BLOOM_HOLD_START) currentPhase = 5
        else if (t >= UNFURL_START) currentPhase = 4
        else if (t >= HERO_GROWTH_START) currentPhase = 3
        else if (t >= BED_ALIVE_START) currentPhase = 2
        else if (t >= ATTENTION_START) currentPhase = 1

        setMotion({
          bedScale,
          bedLift,
          soilDarken,
          sceneFocus,
          activeWarmth,
          directionalCue,
          groundLight,
          heroGrowth,
          heroGrowthOvershoot: heroOvershoot,
          unfurl,
          existingLift,
          existingLean,
          existingSpread,
          existingScaleReaction,
          heightGrowth,
          vitality,
          bloomHold,
          currentPhase,
          timelineProgress: t,
        })
      }
      const id = timelineRef.current.addListener(update)
      update({ value: timelineRef.current.__getValue() })
      return () => timelineRef.current.removeListener(id)
    }, [])

    // ── Diagnostic callback ────────────────────────────────
    useEffect(() => {
      if (!onV4Debug) return
      const phaseNames = ['IDLE', 'ATTENTION', 'BED_ALIVE', 'HERO_GROWTH', 'UNFURL', 'BLOOM_HOLD', 'VITALITY', 'SETTLE']
      // Calculate apparent travel: local travel * bed scale
      const apparentTravel = HERO_TRAVEL_PX * motion.bedScale
      onV4Debug({
        phase: motion.currentPhase,
        phaseName: phaseNames[motion.currentPhase] || 'IDLE',
        progress: motion.timelineProgress,
        bedScale: motion.bedScale,
        heroGrowth: motion.heroGrowth,
        unfurl: motion.unfurl,
        vitality: motion.vitality,
        localTravel: HERO_TRAVEL_PX,
        apparentTravel: apparentTravel,
        existingLift: motion.existingLift,
        sceneFocus: motion.sceneFocus,
        groundLight: motion.groundLight,
      })
    }, [onV4Debug, motion])

    // ── Render ─────────────────────────────────────────────
    if (!placement) return null

    const cx = placement.cx
    const cy = placement.cy // SOIL LINE ANCHOR — scale around this point

    // ── Bed magnification transform (anchored at soil line) ──
    // translate to anchor → scale → translate back, plus lift
    const bedMagnifyTransform =
      `translate(0 ${-motion.bedLift}) translate(${cx} ${cy}) scale(${motion.bedScale}) translate(${-cx} ${-cy})`

    // Compute per-plant values for Harvesting layout (4 plants)
    const plants = []
    for (let i = 0; i < HARVEST_PLANT_COUNT; i++) {
      const offset = (i - (HARVEST_PLANT_COUNT - 1) / 2) * PLANT_SPACING
      const px = cx + offset
      const py = cy
      const isNew = i === 0 || i === 3 // offsets -18 and +18 are new

      // Per-plant color progress (directional vitality sweep)
      const colorDelay = i * 0.08
      const plantColorProgress = clamp((motion.vitality - colorDelay) / (1 - colorDelay), 0, 1)
      const color = v4LeafColor(plantColorProgress)

      if (isNew) {
        // ── New plant: HERO growth + major unfurl ──
        // Structural zero-progress gate: don't render at heroGrowth=0
        if (motion.heroGrowth <= 0) continue

        // Stagger: left outer (i=0) starts slightly before right outer (i=3)
        const plantStagger = i === 0 ? 0 : HERO_LEFT_STAGGER
        const plantHeroProgress = clamp(
          (motion.heroGrowth - plantStagger) / (1 - plantStagger),
          0, 1,
        )

        const opacity = HARVESTING_ALPHA * plantHeroProgress
        // Scale with controlled overshoot
        const baseScale = HERO_START_SCALE + (1 - HERO_START_SCALE) * plantHeroProgress
        const scale = baseScale + motion.heroGrowthOvershoot
        // Vertical travel: starts below, moves up
        const translateY = HERO_TRAVEL_PX * (1 - plantHeroProgress)
        // Major unfurl: scaleX and rotation (stronger than V3)
        const scaleX = UNFURL_START_SCALE_X + (1 - UNFURL_START_SCALE_X) * motion.unfurl
        const rotation = (i === 0 ? -1 : 1) * UNFURL_ROTATION_DEG * (1 - motion.unfurl)
        const h = LEAF_HEIGHT_BASE * HARVESTING_HEIGHT_SCALE

        // Transform: translate up from below, scale from small, rotate from angled
        const transform = `translate(0 ${translateY}) translate(${px} ${py}) scale(${scale}) rotate(${rotation}) scale(${scaleX} 1) translate(${-px} ${-py})`

        plants.push(
          <G key={`v4-greens-${i}`} transform={transform}>
            <V4GreensPlantPaths
              px={px}
              py={py}
              h={h}
              color={color}
              opacity={opacity}
              rotationDeg={0}
              scaleX={1}
              leafStaggerProgress={motion.unfurl}
              vitalityProgress={motion.vitality}
            />
          </G>,
        )
      } else {
        // ── Shared plant: reaction + height growth + color ──
        // Starts at Growing height, grows to Harvesting height (NO shrink)
        const heightScale =
          GROWING_HEIGHT_SCALE +
          (HARVESTING_HEIGHT_SCALE - GROWING_HEIGHT_SCALE) * motion.heightGrowth
        const alpha = GROWING_ALPHA + (HARVESTING_ALPHA - GROWING_ALPHA) * motion.heightGrowth
        const h = LEAF_HEIGHT_BASE * heightScale

        // Existing plant reaction: lift, lean, spread, scale
        const lift = motion.existingLift
        const lean = (i === 1 ? 1 : -1) * motion.existingLean // lean outward
        const spread = (i === 1 ? 1 : -1) * motion.existingSpread // spread outward
        const scaleReaction = motion.existingScaleReaction

        // Apply spread as horizontal translate, lift as vertical, lean as rotation
        const transform =
          `translate(${spread} ${-lift}) translate(${px} ${py}) scale(${scaleReaction}) rotate(${lean}) translate(${-px} ${-py})`

        plants.push(
          <G key={`v4-greens-${i}`} transform={transform}>
            <V4GreensPlantPaths
              px={px}
              py={py}
              h={h}
              color={color}
              opacity={alpha}
              rotationDeg={0}
              scaleX={1}
              leafStaggerProgress={1}
              vitalityProgress={motion.vitality}
            />
          </G>,
        )
      }
    }

    return (
      <G>
        {/* Scene focus overlay (subtle darkening of non-active area) */}
        <V4SceneFocusOverlay placement={placement} intensity={motion.sceneFocus > 0 ? 1 : 0} />
        {/* Directional cue (soft warm path toward Greens) */}
        <V4DirectionalCue placement={placement} intensity={motion.directionalCue > 0 ? 1 : 0} />
        {/* Active bed warmth boost */}
        <V4ActiveWarmthOverlay placement={placement} intensity={motion.activeWarmth} />
        {/* Ground bloom at Harvesting level + ground light (supporting) */}
        <V4GroundBloom
          bedKey={bedKey}
          placement={placement}
          illuminationOpacity={motion.groundLight}
        />
        {/* Ground light glow (supporting, NOT dominant — capped) */}
        {motion.groundLight > 0 && (
          <Ellipse
            cx={cx}
            cy={cy + placement.ry * 0.2}
            rx={placement.rx * GROUND_LIGHT_RADIUS_RX}
            ry={placement.ry * GROUND_LIGHT_RADIUS_RY}
            fill={v4BloomColor(clamp(motion.vitality, 0, 1))}
            opacity={motion.groundLight}
          />
        )}
        {/* ── HERO BED: magnified, anchored at soil line ── */}
        {/* Renders ABOVE neighboring beds via z-order in Scene */}
        <G transform={bedMagnifyTransform}>
          {/* Soil bed with attention-phase darkening */}
          <V4SoilBed bedKey={bedKey} sceneId={sceneId} soilDarken={motion.soilDarken} />
          {/* Plants (inside magnification transform) */}
          {plants}
        </G>
      </G>
    )
  },
  (prev, next) =>
    prev.bedKey === next.bedKey &&
    prev.stageKey === next.stageKey &&
    prev.advancements === next.advancements &&
    prev.isReduced === next.isReduced &&
    prev.onV4Debug === next.onV4Debug,
)

export default GreensV4HeroFocusCalibrationBed
