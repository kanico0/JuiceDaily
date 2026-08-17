// ─────────────────────────────────────────────────────────────
// LivingGardenBedV2Calibration.js
// Motion V2 calibration prototype — Greens: Growing → Harvesting
//
// PREVIEW ONLY. Not production. Not propagated to other beds.
// Enabled only when motionVariant='v2-calibration' is passed
// through the Garden Visual Preview.
//
// Five-act witnessed-growth motion:
//   Act 1: Soil Awakens     — soil scale pulse + warm bloom
//   Act 2: Botanical Emergence — new plants push upward
//   Act 3: Leaves Unfurl    — new plants open outward
//   Act 4: Height Growth    — shared plants grow taller
//   Act 5: Vitality Sweep   — color arrives directionally
//
// HARD RULES:
//   - Existing/shared geometry NEVER shrinks from 1.0
//   - Shared plants start at Growing state and grow to Harvesting
//   - New plants emerge with strong visible motion
//   - No G opacity (react-native-svg 15.x safe)
//   - Structural zero-progress gate on new plants
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

// ── V2 Calibration Constants ──────────────────────────────────
const TOTAL_DURATION = 3000 // ms (target: 2.5–3.5s)

// Act windows as fractions of total timeline (0→1)
const ACT1_START = 0.000, ACT1_END = 0.133 // 0–400ms   Soil Awakens
const ACT2_START = 0.067, ACT2_END = 0.267 // 200–800ms Botanical Emergence
const ACT3_START = 0.167, ACT3_END = 0.367 // 500–1100ms Leaves Unfurl
const ACT4_START = 0.200, ACT4_END = 0.467 // 600–1400ms Height Growth
const ACT5_START = 0.267, ACT5_END = 1.000 // 800–3000ms Vitality Sweep

// Calibration strength values (mid/upper-mid of approved bands)
const SOIL_PEAK_SCALE = 1.055
const SOIL_LIFT_PX = 3
const EMERGENCE_START_SCALE = 0.62
const EMERGENCE_TRAVEL_PX = 10
const UNFURL_START_SCALE_X = 0.82
const UNFURL_ROTATION_DEG = 7
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
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const linearToEaseOut = (t) => (t < 0.4 ? (t / 0.4) * 0.4 : 0.4 + easeOut((t - 0.4) / 0.6) * 0.6)

// ── Color helpers for V2 ──────────────────────────────────────
const FROM_STAGE = 'growing'
const TO_STAGE = 'harvesting'

function v2LeafColor(progress) {
  const fromColor = gateColor(BED_PALETTES.greens.leaf, FROM_STAGE)
  const toColor = gateColor(BED_PALETTES.greens.leaf, TO_STAGE)
  return mixColor(fromColor, toColor, progress)
}

// ── SoilBed (Harvesting stage, replicated for V2 isolation) ───
function V2SoilBed({ bedKey, sceneId }) {
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
          key={`v2-fringe-${bedKey}-${i}`}
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

// ── GroundBloom (Harvesting level, replicated for V2) ─────────
function V2GroundBloom({ bedKey, placement }) {
  const palette = BED_PALETTES[bedKey]
  const bloomFactor = 0.45 // STAGE_BLOOM.harvesting
  const opacity = 0.1 * bloomFactor
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

// ── Greens plant path generator ───────────────────────────────
// Renders 4 ruffled strap-leaf paths for a single rosette.
// Opacity applied to individual paths (no G opacity — react-native-svg safe).
function GreensPlantPaths({ px, py, h, color, opacity, rotationDeg, scaleX }) {
  const transform =
    rotationDeg !== 0 || scaleX !== 1
      ? `rotate(${rotationDeg} ${px} ${py}) scale(${scaleX} 1)`
      : undefined
  const op = opacity * PATH_BASE_OPACITY
  return (
    <G transform={transform}>
      <Path
        d={`M ${px} ${py} Q ${px - 6} ${py - h * 0.6} ${px - 4} ${py - h}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px + 6} ${py - h * 0.6} ${px + 4} ${py - h}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px - 3} ${py - h * 0.7} ${px - 1} ${py - h * 1.1}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
      <Path
        d={`M ${px} ${py} Q ${px + 3} ${py - h * 0.7} ${px + 1} ${py - h * 1.1}`}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        opacity={op}
        strokeLinecap="round"
      />
    </G>
  )
}

// ── Main V2 Calibration Bed Component ─────────────────────────
export const GreensV2CalibrationBed = React.memo(
  function GreensV2CalibrationBed({
    bedKey,
    stageKey,
    sceneId,
    advancements,
    isReduced,
    onV2Debug,
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
      emergence: 0,
      unfurl: 0,
      heightGrowth: 0,
      vitality: 0,
      currentAct: 0,
      timelineProgress: 0,
    })

    // ── Detect advancement and start animation ──────────────
    const greensAdvancement = advancements?.bedAdvancements?.find(
      (a) => a.bedKey === 'greens' && a.fromStage === 'growing' && a.toStage === 'harvesting',
    )

    useEffect(() => {
      if (!greensAdvancement) return
      // Dedup by object identity (same pattern as production motion hook)
      if (processedAdvancementRef.current === advancements) return
      processedAdvancementRef.current = advancements

      if (isReduced) {
        timelineRef.current.setValue(1)
        return
      }

      // Cancel any running animation
      if (animRef.current) animRef.current.stop()

      // Start the 5-act timeline
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
          // Ensure canonical terminal state
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
          timelineRef.current.setValue(1) // canonical Harvesting
        }
      }
      const sub = AppState.addEventListener('change', handleAppState)
      return () => sub.remove()
    }, [])

    // ── Single listener: compute all act progresses ────────
    useEffect(() => {
      const update = ({ value: t }) => {
        const act1Raw = clamp((t - ACT1_START) / (ACT1_END - ACT1_START), 0, 1)
        const act1 = easeOut(act1Raw)
        const act2Raw = clamp((t - ACT2_START) / (ACT2_END - ACT2_START), 0, 1)
        const act2 = easeOut(act2Raw)
        const act3Raw = clamp((t - ACT3_START) / (ACT3_END - ACT3_START), 0, 1)
        const act3 = easeInOut(act3Raw)
        const act4Raw = clamp((t - ACT4_START) / (ACT4_END - ACT4_START), 0, 1)
        const act4 = easeOut(act4Raw)
        const act5Raw = clamp((t - ACT5_START) / (ACT5_END - ACT5_START), 0, 1)
        const act5 = linearToEaseOut(act5Raw)

        // Determine current act for diagnostic
        let currentAct = 0
        if (t >= ACT5_START) currentAct = 5
        else if (t >= ACT4_START) currentAct = 4
        else if (t >= ACT3_START) currentAct = 3
        else if (t >= ACT2_START) currentAct = 2
        else if (t >= ACT1_START) currentAct = 1

        setMotion({
          soilScale: 1 + Math.sin(act1 * Math.PI) * (SOIL_PEAK_SCALE - 1),
          soilLift: Math.sin(act1 * Math.PI) * SOIL_LIFT_PX,
          warmBloomOpacity: Math.sin(act1 * Math.PI) * 0.15,
          emergence: act2,
          unfurl: act3,
          heightGrowth: act4,
          vitality: act5,
          currentAct,
          timelineProgress: t,
        })
      }
      const id = timelineRef.current.addListener(update)
      update({ value: timelineRef.current.__getValue() })
      return () => timelineRef.current.removeListener(id)
    }, [])

    // ── Diagnostic callback ────────────────────────────────
    useEffect(() => {
      if (!onV2Debug) return
      const actNames = ['IDLE', 'SOIL', 'EMERGENCE', 'UNFURL', 'HEIGHT', 'VITALITY']
      onV2Debug({
        act: motion.currentAct,
        actName: actNames[motion.currentAct] || 'IDLE',
        progress: motion.timelineProgress,
        soilScale: motion.soilScale,
        emergence: motion.emergence,
        unfurl: motion.unfurl,
        heightGrowth: motion.heightGrowth,
        vitality: motion.vitality,
      })
    }, [onV2Debug, motion])

    // ── Render ─────────────────────────────────────────────
    if (!placement) return null

    const cx = placement.cx
    const cy = placement.cy

    // Soil transform (Act 1)
    const soilTransform = `translate(0 ${-motion.soilLift}) scale(1 ${motion.soilScale})`

    // Compute per-plant values for Harvesting layout (4 plants)
    const plants = []
    for (let i = 0; i < HARVEST_PLANT_COUNT; i++) {
      const offset = (i - (HARVEST_PLANT_COUNT - 1) / 2) * PLANT_SPACING
      const px = cx + offset
      const py = cy
      const isNew = i === 0 || i === 3 // offsets -18 and +18 are new

      // Per-plant color progress (directional left-to-right sweep)
      const colorDelay = i * 0.08
      const plantColorProgress = clamp((motion.vitality - colorDelay) / (1 - colorDelay), 0, 1)
      const color = v2LeafColor(plantColorProgress)

      if (isNew) {
        // ── New plant: emergence + unfurl ──
        // Structural zero-progress gate: don't render at emergence=0
        if (motion.emergence <= 0) continue

        const opacity = HARVESTING_ALPHA * motion.emergence
        const scale = EMERGENCE_START_SCALE + (1 - EMERGENCE_START_SCALE) * motion.emergence
        const translateY = EMERGENCE_TRAVEL_PX * (1 - motion.emergence)
        const scaleX = UNFURL_START_SCALE_X + (1 - UNFURL_START_SCALE_X) * motion.unfurl
        const rotation = (i === 0 ? -1 : 1) * UNFURL_ROTATION_DEG * (1 - motion.unfurl)
        const h = LEAF_HEIGHT_BASE * HARVESTING_HEIGHT_SCALE

        // Transform: translate up from below, scale from small, rotate from angled
        const transform = `translate(0 ${translateY}) translate(${px} ${py}) scale(${scale}) rotate(${rotation}) scale(${scaleX} 1) translate(${-px} ${-py})`

        plants.push(
          <G key={`v2-greens-${i}`} transform={transform}>
            <GreensPlantPaths
              px={px}
              py={py}
              h={h}
              color={color}
              opacity={opacity}
              rotationDeg={0}
              scaleX={1}
            />
          </G>,
        )
      } else {
        // ── Shared plant: height growth + color sweep ──
        // Starts at Growing height, grows to Harvesting height (NO shrink)
        const heightScale =
          GROWING_HEIGHT_SCALE +
          (HARVESTING_HEIGHT_SCALE - GROWING_HEIGHT_SCALE) * motion.heightGrowth
        const alpha = GROWING_ALPHA + (HARVESTING_ALPHA - GROWING_ALPHA) * motion.heightGrowth
        const h = LEAF_HEIGHT_BASE * heightScale

        plants.push(
          <G key={`v2-greens-${i}`}>
            <GreensPlantPaths
              px={px}
              py={py}
              h={h}
              color={color}
              opacity={alpha}
              rotationDeg={0}
              scaleX={1}
            />
          </G>,
        )
      }
    }

    return (
      <G>
        {/* Ground bloom at Harvesting level */}
        <V2GroundBloom bedKey={bedKey} placement={placement} />
        {/* Act 1: warm bloom beneath soil (fades in and out) */}
        {motion.warmBloomOpacity > 0 && (
          <Ellipse
            cx={cx}
            cy={cy + placement.ry * 0.2}
            rx={placement.rx * 1.3}
            ry={placement.ry * 0.5}
            fill={BED_PALETTES[bedKey].bloom}
            opacity={motion.warmBloomOpacity}
          />
        )}
        {/* Soil bed with Act 1 transform */}
        <G transform={soilTransform}>
          <V2SoilBed bedKey={bedKey} sceneId={sceneId} />
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
    prev.onV2Debug === next.onV2Debug,
)

export default GreensV2CalibrationBed
