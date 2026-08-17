// ─────────────────────────────────────────────────────────────
// LivingGardenBedV3HeroCalibration.js
// Motion V3 HERO calibration prototype — Greens: Growing → Harvesting
//
// PREVIEW ONLY. Not production. Not propagated to other beds.
// Enabled only when motionVariant='v3-hero' is passed through
// the Garden Visual Preview.
//
// V3 HERO four-phase motion:
//   Phase 1: Anticipation    — soil compression → strong rise + illumination
//   Phase 2: Hero Growth     — new outer plants surge upward + existing reaction
//   Phase 3: Leaf Unfurl     — dramatic leaf opening (stronger than V2)
//   Phase 4: Vitality Wave   — traveling light from soil → leaf tips
//   Settle: all transforms resolve to canonical Harvesting
//
// HERO STRENGTH (high end of V3 approved ranges):
//   - Soil scale peak: 1.12
//   - Soil lift: 9px
//   - Existing plant lift: 7px, lean 6°, scale reaction 1.06
//   - New plant start scale: 0.38, travel 28px
//   - Unfurl scaleX: 0.62, rotation 17°
//   - Overshoot: 1.05 on new geometry only
//   - Scene-level: localized illumination + neighbor acknowledgment
//
// HARD RULES:
//   - Existing/shared geometry NEVER shrinks below Growing state
//   - Shared plants react (lift/lean/scale) but settle to canonical
//   - New plants receive Hero emergence with structural zero-progress gate
//   - No G opacity (react-native-svg 15.x safe)
//   - Final frame = canonical Harvesting artwork
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react'
import { Animated, Easing, AppState } from 'react-native'
import { G, Path, Ellipse, Circle, Rect, Line } from 'react-native-svg'
import {
  BED_PLACEMENT,
  BED_BLOBS,
  BED_FRINGES,
  PRODUCE_COLORS,
  SCENE_PALETTE,
} from './LivingGardenGeometry'
import {
  STAGE_CHROMA,
  STAGE_ALPHA,
  BED_PALETTES,
  mixColor,
  gateColor,
} from './LivingGardenBed'

// ── V3 HERO Calibration Constants ─────────────────────────────
const TOTAL_DURATION = 2400 // ms (target: 2.3–2.6s)

// Phase windows as fractions of total timeline (0→1)
// Overlap intentionally — no dead gaps
const ANTICIPATION_START = 0.000, ANTICIPATION_END = 0.188 // 0–450ms
const HERO_GROWTH_START = 0.146, HERO_GROWTH_END = 0.542 // 350–1300ms
const UNFURL_START = 0.292, UNFURL_END = 0.667 // 700–1600ms
const VITALITY_START = 0.458, VITALITY_END = 0.875 // 1100–2100ms
const SETTLE_START = 0.750, SETTLE_END = 1.000 // 1800–2400ms

// Anticipation sub-phases (within ANTICIPATION window)
const SOIL_COMPRESS_END = 0.063 // ~150ms compression
const SOIL_RISE_START = 0.042 // ~100ms (overlap with compression tail)

// HERO strength values (HIGH end of V3 approved ranges)
const SOIL_PEAK_SCALE = 1.12
const SOIL_COMPRESS_SCALE = 0.96
const SOIL_LIFT_PX = 9
const SOIL_WARM_BLOOM_PEAK = 0.28

const EXISTING_LIFT_PX = 7
const EXISTING_LEAN_DEG = 6
const EXISTING_SCALE_REACTION = 1.06

const HERO_START_SCALE = 0.38
const HERO_TRAVEL_PX = 28
const HERO_OVERSHOOT = 1.05
const HERO_LEFT_STAGGER = 0.04 // ~96ms stagger between left/right outer rosettes

const UNFURL_START_SCALE_X = 0.62
const UNFURL_ROTATION_DEG = 17
const LEAF_STAGGER = 0.025 // ~60ms per-leaf stagger within a plant

const GROWING_HEIGHT_SCALE = 0.55
const HARVESTING_HEIGHT_SCALE = 1.0
const GROWING_ALPHA = STAGE_ALPHA.growing // 0.78
const HARVESTING_ALPHA = STAGE_ALPHA.harvesting // 0.93
const PATH_BASE_OPACITY = 0.9

// Scene-level
const SCENE_ILLUMINATION_PEAK = 0.15
const NEIGHBOR_REACTION_PEAK = 0.04

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
const easeBackOut = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const linearToEaseOut = (t) => (t < 0.5 ? t / 0.5 * 0.5 : 0.5 + easeOut((t - 0.5) / 0.5) * 0.5)

// ── Color helpers for V3 ──────────────────────────────────────
const FROM_STAGE = 'growing'
const TO_STAGE = 'harvesting'

function v3LeafColor(progress) {
  const fromColor = gateColor(BED_PALETTES.greens.leaf, FROM_STAGE)
  const toColor = gateColor(BED_PALETTES.greens.leaf, TO_STAGE)
  return mixColor(fromColor, toColor, progress)
}

function v3BloomColor(progress) {
  const fromColor = gateColor(BED_PALETTES.greens.bloom, FROM_STAGE)
  const toColor = gateColor(BED_PALETTES.greens.bloom, TO_STAGE)
  return mixColor(fromColor, toColor, progress)
}

// ── SoilBed (Harvesting stage, replicated for V3 isolation) ───
function V3SoilBed({ bedKey, sceneId }) {
  const blob = BED_BLOBS[bedKey]
  const placement = BED_PLACEMENT[bedKey]
  const warmSoilColor = mixColor('#46271B', BED_PALETTES[bedKey].produce, 0.16)
  return (
    <G>
      <Path d={blob} fill={SCENE_PALETTE.loamDark} />
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
          key={`v3-fringe-${bedKey}-${i}`}
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

// ── GroundBloom (Harvesting level, replicated for V3) ─────────
function V3GroundBloom({ bedKey, placement, illuminationOpacity }) {
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

// ── Greens plant path generator (V3 HERO) ─────────────────────
// Renders 4 ruffled strap-leaf paths for a single rosette.
// Each leaf can have individual stagger, rotation, and opacity.
// Opacity applied to individual paths (no G opacity — react-native-svg safe).
function V3GreensPlantPaths({ px, py, h, color, opacity, rotationDeg, scaleX, leafStaggerProgress }) {
  const transform =
    rotationDeg !== 0 || scaleX !== 1
      ? `rotate(${rotationDeg} ${px} ${py}) scale(${scaleX} 1)`
      : undefined
  const baseOp = opacity * PATH_BASE_OPACITY
  // Per-leaf stagger: each of the 4 leaves gets a slightly delayed opacity
  // leafStaggerProgress is the overall unfurl progress for this plant
  // Individual leaves start at slightly different times
  const leafOpacities = [
    clamp(leafStaggerProgress / (1 - LEAF_STAGGER * 0), 0, 1),
    clamp((leafStaggerProgress - LEAF_STAGGER) / (1 - LEAF_STAGGER), 0, 1),
    clamp((leafStaggerProgress - LEAF_STAGGER * 2) / (1 - LEAF_STAGGER * 2), 0, 1),
    clamp((leafStaggerProgress - LEAF_STAGGER * 3) / (1 - LEAF_STAGGER * 3), 0, 1),
  ]
  return (
    <G transform={transform}>
      <Path
        d={`M ${px} ${py} Q ${px - 6} ${py - h * 0.6} ${px - 4} ${py - h}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={baseOp * leafOpacities[0]}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px + 6} ${py - h * 0.6} ${px + 4} ${py - h}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={baseOp * leafOpacities[1]}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px - 3} ${py - h * 0.7} ${px - 1} ${py - h * 1.1}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={baseOp * leafOpacities[2]}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px + 3} ${py - h * 0.7} ${px + 1} ${py - h * 1.1}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={baseOp * leafOpacities[3]}
        strokeLinecap="round"
      />
    </G>
  )
}

// ── Scene-level illumination overlay ──────────────────────────
// A soft warm glow centered on the Greens bed that peaks during
// the Hero Moment and fades during settle.
function V3SceneIllumination({ placement, opacity }) {
  if (opacity <= 0) return null
  return (
    <Ellipse
      cx={placement.cx}
      cy={placement.cy - placement.ry * 0.5}
      rx={placement.rx * 2.2}
      ry={placement.ry * 1.8}
      fill={BED_PALETTES.greens.bloom}
      opacity={opacity}
    />
  )
}

// ── Neighbor bed reaction (scene-level) ───────────────────────
// The closest neighboring bed (roots) gives a brief small reaction.
// This is environmental only — no progression change.
function V3NeighborReaction({ bedKey, placement, opacity }) {
  if (opacity <= 0) return null
  const palette = BED_PALETTES[bedKey]
  return (
    <Ellipse
      cx={placement.cx}
      cy={placement.cy + placement.ry * 0.3}
      rx={placement.rx * 1.5}
      ry={placement.ry * 0.6}
      fill={palette.bloom}
      opacity={opacity}
    />
  )
}

// ── Main V3 HERO Calibration Bed Component ────────────────────
export const GreensV3HeroCalibrationBed = React.memo(
  function GreensV3HeroCalibrationBed({
    bedKey,
    stageKey,
    sceneId,
    advancements,
    isReduced,
    onV3Debug,
  }) {
    const placement = BED_PLACEMENT[bedKey]
    const timelineRef = useRef(new Animated.Value(isReduced ? 1 : 0))
    const animRef = useRef(null)
    const processedAdvancementRef = useRef(null)

    // Single state object updated by one listener (one setState per frame)
    const [motion, setMotion] = useState({
      soilScale: 1,
      soilLift: 0,
      warmBloomOpacity: 0,
      sceneIllumination: 0,
      neighborReaction: 0,
      heroGrowth: 0,
      heroGrowthOvershoot: 0,
      unfurl: 0,
      existingLift: 0,
      existingLean: 0,
      existingScaleReaction: 0,
      heightGrowth: 0,
      vitality: 0,
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
        // ── Phase 1: Anticipation ──
        // Two-stage: brief compression → strong rise + illumination
        const compressRaw = clamp(t / SOIL_COMPRESS_END, 0, 1)
        const compress = easeOut(compressRaw)
        const riseRaw = clamp((t - SOIL_RISE_START) / (ANTICIPATION_END - SOIL_RISE_START), 0, 1)
        const rise = easeOutCubic(riseRaw)
        // Soil scale: compress down first, then rise above 1
        // During compression: 1 → 0.96
        // During rise: 0.96 → 1.12 → settle back
        const isCompressing = t < SOIL_COMPRESS_END
        const soilScale = isCompressing
          ? 1 - (1 - SOIL_COMPRESS_SCALE) * compress
          : 1 + (SOIL_PEAK_SCALE - 1) * Math.sin(rise * Math.PI)
        const soilLift = isCompressing ? 0 : SOIL_LIFT_PX * Math.sin(rise * Math.PI)
        const warmBloomOpacity = isCompressing
          ? 0
          : SOIL_WARM_BLOOM_PEAK * Math.sin(rise * Math.PI)

        // ── Phase 2: Hero Growth ──
        const heroRaw = clamp((t - HERO_GROWTH_START) / (HERO_GROWTH_END - HERO_GROWTH_START), 0, 1)
        const heroGrowth = easeOutCubic(heroRaw)
        // Overshoot: small controlled growth overshoot on new geometry
        // Peaks near end of hero growth, resolves during settle
        const heroOvershootRaw = clamp((t - HERO_GROWTH_START) / (HERO_GROWTH_END - HERO_GROWTH_START), 0, 1)
        const heroOvershoot = heroOvershootRaw > 0.8
          ? Math.sin((heroOvershootRaw - 0.8) / 0.2 * Math.PI) * (HERO_OVERSHOOT - 1)
          : 0

        // ── Phase 3: Leaf Unfurl ──
        const unfurlRaw = clamp((t - UNFURL_START) / (UNFURL_END - UNFURL_START), 0, 1)
        const unfurl = easeOut(unfurlRaw)

        // ── Existing plant reaction ──
        // Lift, lean, and scale reaction peak during Hero Growth, settle during Settle
        const reactionRaw = clamp((t - HERO_GROWTH_START) / (HERO_GROWTH_END - HERO_GROWTH_START), 0, 1)
        const reaction = easeInOut(reactionRaw)
        const settleRaw = clamp((t - SETTLE_START) / (SETTLE_END - SETTLE_START), 0, 1)
        const settle = easeInOutCubic(settleRaw)
        // Reaction peaks at ~0.7 of hero growth, then settles
        const reactionEnvelope = reaction * (1 - settle * 0.5)
        const existingLift = EXISTING_LIFT_PX * reactionEnvelope
        const existingLean = EXISTING_LEAN_DEG * reactionEnvelope
        const existingScaleReaction = 1 + (EXISTING_SCALE_REACTION - 1) * reactionEnvelope

        // ── Height growth (shared plants) ──
        // Starts during hero growth, completes during settle
        const heightRaw = clamp((t - HERO_GROWTH_START) / (SETTLE_END - HERO_GROWTH_START), 0, 1)
        const heightGrowth = easeOutCubic(heightRaw)

        // ── Phase 4: Vitality Wave ──
        // Traveling light from soil → plant base → stem → leaf tips
        const vitalityRaw = clamp((t - VITALITY_START) / (VITALITY_END - VITALITY_START), 0, 1)
        const vitality = linearToEaseOut(vitalityRaw)

        // ── Scene-level illumination ──
        // Peaks during Hero Moment (~700-1200ms), fades during settle
        const illuminationRaw = clamp((t - HERO_GROWTH_START) / (UNFURL_END - HERO_GROWTH_START), 0, 1)
        const sceneIllumination = SCENE_ILLUMINATION_PEAK * Math.sin(illuminationRaw * Math.PI) * (1 - settle * 0.3)

        // ── Neighbor reaction ──
        const neighborRaw = clamp((t - HERO_GROWTH_START) / (HERO_GROWTH_END - HERO_GROWTH_START), 0, 1)
        const neighborReaction = NEIGHBOR_REACTION_PEAK * Math.sin(neighborRaw * Math.PI)

        // ── Current phase for diagnostic ──
        let currentPhase = 0
        if (t >= SETTLE_START) currentPhase = 5
        else if (t >= VITALITY_START) currentPhase = 4
        else if (t >= UNFURL_START) currentPhase = 3
        else if (t >= HERO_GROWTH_START) currentPhase = 2
        else if (t >= ANTICIPATION_START) currentPhase = 1

        setMotion({
          soilScale,
          soilLift,
          warmBloomOpacity,
          sceneIllumination,
          neighborReaction,
          heroGrowth,
          heroGrowthOvershoot: heroOvershoot,
          unfurl,
          existingLift,
          existingLean,
          existingScaleReaction,
          heightGrowth,
          vitality,
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
      if (!onV3Debug) return
      const phaseNames = ['IDLE', 'ANTICIPATION', 'HERO_GROWTH', 'UNFURL', 'VITALITY', 'SETTLE']
      onV3Debug({
        phase: motion.currentPhase,
        phaseName: phaseNames[motion.currentPhase] || 'IDLE',
        progress: motion.timelineProgress,
        soilScale: motion.soilScale,
        heroGrowth: motion.heroGrowth,
        unfurl: motion.unfurl,
        vitality: motion.vitality,
        existingLift: motion.existingLift,
        sceneIllumination: motion.sceneIllumination,
      })
    }, [onV3Debug, motion])

    // ── Render ─────────────────────────────────────────────
    if (!placement) return null

    const cx = placement.cx
    const cy = placement.cy

    // Soil transform (Phase 1: anticipation)
    const soilTransform = `translate(0 ${-motion.soilLift}) scale(1 ${motion.soilScale})`

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
      const color = v3LeafColor(plantColorProgress)

      if (isNew) {
        // ── New plant: HERO growth + unfurl ──
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
        // Unfurl: scaleX and rotation
        const scaleX = UNFURL_START_SCALE_X + (1 - UNFURL_START_SCALE_X) * motion.unfurl
        const rotation = (i === 0 ? -1 : 1) * UNFURL_ROTATION_DEG * (1 - motion.unfurl)
        const h = LEAF_HEIGHT_BASE * HARVESTING_HEIGHT_SCALE

        // Transform: translate up from below, scale from small, rotate from angled
        const transform = `translate(0 ${translateY}) translate(${px} ${py}) scale(${scale}) rotate(${rotation}) scale(${scaleX} 1) translate(${-px} ${-py})`

        plants.push(
          <G key={`v3-greens-${i}`} transform={transform}>
            <V3GreensPlantPaths
              px={px}
              py={py}
              h={h}
              color={color}
              opacity={opacity}
              rotationDeg={0}
              scaleX={1}
              leafStaggerProgress={motion.unfurl}
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

        // Existing plant reaction: lift, lean, scale
        const lift = motion.existingLift
        const lean = (i === 1 ? 1 : -1) * motion.existingLean // lean outward (away from center)
        const scaleReaction = motion.existingScaleReaction

        const transform =
          lift !== 0 || lean !== 0 || scaleReaction !== 1
            ? `translate(0 ${-lift}) translate(${px} ${py}) scale(${scaleReaction}) rotate(${lean}) translate(${-px} ${-py})`
            : undefined

        plants.push(
          <G key={`v3-greens-${i}`} transform={transform}>
            <V3GreensPlantPaths
              px={px}
              py={py}
              h={h}
              color={color}
              opacity={alpha}
              rotationDeg={0}
              scaleX={1}
              leafStaggerProgress={1}
            />
          </G>,
        )
      }
    }

    // Neighbor bed (roots) for scene-level reaction
    const rootsPlacement = BED_PLACEMENT.roots

    return (
      <G>
        {/* Scene-level illumination (peaks during Hero Moment) */}
        <V3SceneIllumination placement={placement} opacity={motion.sceneIllumination} />
        {/* Neighbor reaction (roots — closest bed) */}
        <V3NeighborReaction
          bedKey="roots"
          placement={rootsPlacement}
          opacity={motion.neighborReaction}
        />
        {/* Ground bloom at Harvesting level + illumination boost */}
        <V3GroundBloom
          bedKey={bedKey}
          placement={placement}
          illuminationOpacity={motion.sceneIllumination * 0.5}
        />
        {/* Phase 1: warm bloom beneath soil (stronger than V2) */}
        {motion.warmBloomOpacity > 0 && (
          <Ellipse
            cx={cx}
            cy={cy + placement.ry * 0.2}
            rx={placement.rx * 1.5}
            ry={placement.ry * 0.6}
            fill={v3BloomColor(clamp(motion.vitality, 0, 1))}
            opacity={motion.warmBloomOpacity}
          />
        )}
        {/* Soil bed with Phase 1 transform */}
        <G transform={soilTransform}>
          <V3SoilBed bedKey={bedKey} sceneId={sceneId} />
        </G>
        {/* Plants */}
        {plants}
      </G>
    )
  },
  (prev, next) =>
    prev.bedKey === next.bedKey &&
    prev.stageKey === next.stageKey &&
    prev.advancements === next.advancements &&
    prev.isReduced === next.isReduced &&
    prev.onV3Debug === next.onV3Debug,
)

export default GreensV3HeroCalibrationBed
