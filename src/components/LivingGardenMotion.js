// ─────────────────────────────────────────────────────────────
// LivingGardenMotion.js — Garden motion orchestration (Phase 1C)
//
// PERFORMANCE ARCHITECTURE (Phase 1C):
//   Transforms and opacity are driven by Animated.Value objects
//   passed directly to Animated.createAnimatedComponent(G) wrappers.
//   NO per-frame React setState for transform/opacity.
//
//   React state changes ONLY at event boundaries:
//     - advancement detected
//     - timeline starts
//     - timeline completes
//     - canonical snapshot updates
//
//   DOCUMENTED EXCEPTIONS (JS listener, no rerender):
//     - colorProgress: drives SVG fill strings in bed renderers.
//       SVG fill props are strings that cannot be animated via
//       Animated.createAnimatedComponent. A single setState bridge
//       is used, active ONLY during the 600ms Earned Color phase.
//     - produceReveal: drives SVG opacity of produce subgroups.
//       Same constraint. Active ONLY during the Produce beat.
//
// FIVE-BEAT LANGUAGE (Phase 1C):
//   1. Soil Answer — temporary restrained soil response (~1.018 scale)
//   2. Anchored Growth — scaleY from base (STAGE-SPECIFIC, Rev B)
//   3. Unfurl — settle offset
//   4. Produce — destination produce revealed (opacity 0→1)
//   5. Earned Color — canonical color crossfade (distinct phase)
//
// MONOTONIC PROGRESSION (Rev B):
//   Early transitions (Empty→Seed, Seed→Sprout): full anchored growth
//     scaleY 0.28→1, opacity 0→1 — plant emerges from soil.
//   Middle transition (Sprout→Growing): restrained growth
//     scaleY 0.6→1, opacity 0.5→1 — does not remove Sprout content.
//   Late transitions (Growing→Harvesting, Harvesting→Flourishing):
//     NO whole-plant shrink. scaleY=1, opacity=1 from start.
//     Existing earned mass stays canonical. New destination geometry
//     appears via Produce reveal + Earned Color beats only.
//
// Orchestration order:
//   Wake → beds back-to-front → Journey Tree → Arbor → Rainbow
//
// Worst exceptional composed sequence: <= 6500ms.
// Reduced Motion: all canonical instantly. Idle disabled.
//
// Does NOT modify thresholds, persistence, earned-color truth,
// seen-state, JuiceLog, Glow, RevenueCat, quotas, or backend.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, AppState } from 'react-native'
import { EASING } from '../utils/motion'
import { BED_PLACEMENT } from './LivingGardenGeometry'

// ── Stage transition durations (spec §3) ──────────────────────
const STAGE_TRANSITION_DURATION = {
  seed: 900,
  sprout: 1100,
  growing: 1300,
  harvesting: 1500,
  flourishing: 1800,
}
const COALESCED_DURATION = 2000

// ── Anchored growth parameters ────────────────────────────────
// MONOTONIC PROGRESSION (Rev B):
//   Early transitions use substantial anchored growth (plant emerges).
//   Late transitions preserve existing earned mass — no whole-plant shrink.
//   Destination additions appear via Produce reveal + Earned Color.
const GROWTH_START_SCALE_EARLY = 0.28
const GROWTH_START_SCALE_MID = 0.6
const GROWTH_START_SCALE_LATE = 1.0 // no shrink — preserve existing mass
const GROWTH_START_OPACITY_EARLY = 0
const GROWTH_START_OPACITY_MID = 0.5
const GROWTH_START_OPACITY_LATE = 1.0 // no fade — preserve existing mass

// Legacy constant kept for test compatibility — do not use for new logic.
const GROWTH_START_SCALE = 0.28
const GROWTH_SETTLE_PX = 1.5
const GROWTH_SETTLE_FRACTION = 0.65
const GROWTH_START_OPACITY = 0

// ── Stage-specific growth policy (MONOTONIC PROGRESSION) ──────
// Returns { startScale, startOpacity } for a given transition.
// LATE transitions (Growing→Harvesting, Harvesting→Flourishing)
// use startScale=1, startOpacity=1 — no whole-plant shrink.
// This preserves already-earned visual mass. New destination
// geometry appears via Produce reveal + Earned Color beats.
function getGrowthStart(fromStage, toStage) {
  const stageOrder = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']
  const fromIdx = stageOrder.indexOf(fromStage)
  const toIdx = stageOrder.indexOf(toStage)

  // Late transitions: preserve existing mass
  if (fromIdx >= 3) {
    // fromStage is 'growing' or later
    return { startScale: GROWTH_START_SCALE_LATE, startOpacity: GROWTH_START_OPACITY_LATE }
  }

  // Middle transition: Sprout→Growing — restrained growth
  if (fromIdx === 2) {
    // fromStage is 'sprout'
    return { startScale: GROWTH_START_SCALE_MID, startOpacity: GROWTH_START_OPACITY_MID }
  }

  // Early transitions: Empty→Seed, Seed→Sprout — full anchored growth
  return { startScale: GROWTH_START_SCALE_EARLY, startOpacity: GROWTH_START_OPACITY_EARLY }
}

// ── Soil Answer (beat 1) ──────────────────────────────────────
// Temporary restrained soil response. ~1.014–1.022 max scale.
// Resolves exactly to scale=1, offset=0, canonical opacity.
const SOIL_ANSWER_PEAK = 1.018
const SOIL_ANSWER_DURATION = 280

// ── Produce beat (beat 4) ─────────────────────────────────────
// Destination produce hidden during early growth, revealed after.
// Uses produceReveal 0→1 to gate produce subgroup opacity.
const PRODUCE_REVEAL_START_FRACTION = 0.55 // starts at 55% of growth
const PRODUCE_REVEAL_DURATION = 400

// ── Delta reveal beat (late-stage monotonic progression) ──────
// For late-stage transitions (Growing→Harvesting, Harvesting→Flourishing),
// destination-only geometry reveals progressively via deltaReveal 0→1.
// This replaces the old 1→1 no-op growth animation with visible motion.
// Delta reveal starts shortly after Soil Answer, runs concurrently with
// Produce reveal, and completes before Earned Color begins.
const DELTA_REVEAL_START_FRACTION = 0.15 // starts at 15% of total duration
const DELTA_REVEAL_DURATION_FRACTION = 0.55 // takes 55% of total duration
const DELTA_DETAIL_DELAY_FRACTION = 0.35 // detail appears at 35% of delta
const DELTA_DETAIL_DURATION_FRACTION = 0.5 // detail takes 50% of delta duration

// ── Earned Color phase (beat 5, DISTINCT from growth) ─────────
const EARNED_COLOR_DURATION = 600
const EARNED_COLOR_START_DELAY = 80

// ── Journey Tree motion parameters (Phase 1B — FROZEN) ────────
const TREE_START_SCALE = 0.92
const TREE_START_OPACITY = 0.5
const TREE_DURATION = 2200
const TREE_DURATION_COMPRESSED = 1500
const TREE_CANOPY_START_FRACTION = 0.25
const TREE_DETAIL_START_FRACTION = 0.55
const TREE_RIM_START_FRACTION = 0.75
// Phase 1D: destination-layer reveal fractions for Tree subgroup channels
const TREE_TRUNK_START_FRACTION = 0.0
const TREE_TRUNK_DURATION_FRACTION = 0.35
const TREE_CANOPY_REVEAL_START_FRACTION = 0.25
const TREE_CANOPY_REVEAL_DURATION_FRACTION = 0.45
const TREE_DETAIL_REVEAL_START_FRACTION = 0.50
const TREE_DETAIL_REVEAL_DURATION_FRACTION = 0.40
const TREE_SOURCE_FADE_START_FRACTION = 0.15
const TREE_SOURCE_FADE_DURATION_FRACTION = 0.35

// ── Arbor ornament reveal (Phase 1B — FROZEN) ────────────────
const ARBOR_ORNAMENT_DURATION = 1100
const ARBOR_START_SCALE = 0.88
const ARBOR_STAGGER_SMALL = 130
const ARBOR_STAGGER_DENSE = 90
const ARBOR_PHASE_CAP = 1600
const ARBOR_HALO_PEAK = 0.26 // Phase 1C corrected (was 0.35)

// ── Rainbow capstone (Phase 1B — FROZEN) ─────────────────────
const RAINBOW_DURATION = 2600
const RAINBOW_DURATION_COMPRESSED = 1600
const RAINBOW_PEAK_OPACITY = 0.35 // Direct wrapper opacity (no interpolation)
const RAINBOW_BLOOM_END_FRACTION = 0.35
const RAINBOW_SWEEP_END_FRACTION = 0.55
const RAINBOW_TREE_ACK_END_FRACTION = 0.75

// ── Idle-life motion (Phase 1C corrected) ────────────────────
// Three shared/fixed sway phase groups. No per-plant timers.
// Flourishing foliage: very small sway (~0.5 in sway units).
// Tree canopy breath: ~1.004 (corrected from 1.012).
// Tree trunk/base: completely static.
// Arbor: no idle motion.
const IDLE_SWAY_DURATION = 4200
const IDLE_SWAY_AMPLITUDE = 0.5 // degrees, very small
const IDLE_BREATH_DURATION = 5400
const IDLE_BREATH_SCALE = 1.004 // Phase 1C corrected (was 1.012)
// Three fixed phase groups for flourishing sway:
//   Group A: beds 0, 3, 5 (phase offset 0)
//   Group B: beds 1, 4, 6 (phase offset 1/3 cycle)
//   Group C: beds 2 (phase offset 2/3 cycle)
const SWAY_PHASE_GROUPS = [
  { beds: ['citrus', 'berries', 'greens'], offsetFraction: 0.0 },
  { beds: ['orchard', 'tropical', 'roots'], offsetFraction: 0.33 },
  { beds: ['herbs'], offsetFraction: 0.66 },
]

// ── Orchestration stagger delays ──────────────────────────────
const WAKE_DURATION = 900
const BAND_STAGGER = 120
const BED_TO_TREE_DELAY = 100
const TREE_TO_ARBOR_DELAY = 100
const ARBOR_TO_RAINBOW_DELAY = 100

// ── Compression ───────────────────────────────────────────────
const COMPRESSED_BED_DURATION = 1400
const COMPRESSED_TREE_OVERLAP = 300
const COMPRESSED_ARBOR_OVERLAP = 400
const COMPRESSED_RAINBOW_OVERLAP = 500

// ── Bed band ordering ─────────────────────────────────────────
const FAR_BEDS = ['citrus', 'orchard']
const MID_BEDS = ['berries', 'tropical']
const NEAR_BEDS = ['herbs', 'greens', 'roots']
const ALL_BEDS_ORDER = [...FAR_BEDS, ...MID_BEDS, ...NEAR_BEDS]

// ── Tier assignments (FROZEN) ─────────────────────────────────
const TIER_4_BEDS = ['greens', 'roots', 'herbs']
const TIER_3_BEDS = ['citrus', 'orchard', 'berries', 'tropical']

const TIER3_GROUP_OFFSETS = {
  citrus: ['trunk', 'canopy', 'fruit'],
  orchard: ['trunk', 'canopy', 'fruit'],
  berries: ['mounds', 'berries', 'berries'],
  tropical: ['leaves', 'pineapple', 'pineapple'],
}
const TIER3_GROUP_START_FRACTIONS = [0.0, 0.33, 0.66]

// ── Canonical rest state ──────────────────────────────────────
// NOTE: colorProgress and produceReveal are state-bridged values.
// scaleY/translateY/opacity are Animated.Value objects.
const CANONICAL_BED_MOTION = {
  scaleY: 1,
  translateY: 0,
  opacity: 1,
  colorProgress: 1,
  produceReveal: 1,
  soilScale: 1,
}
const CANONICAL_TREE_MOTION = {
  scaleY: 1,
  opacity: 1,
  canopyProgress: 1,
  detailProgress: 1,
  rimProgress: 1,
  breathScale: 1,
  // Phase 1D: destination-layer channels at canonical rest
  sourceOpacity: 0,
  trunkOpacity: 1,
  canopyOpacity: 1,
  detailOpacity: 1,
}

// ── Produce subgroup definitions per bed ──────────────────────
// Beds where destination produce can be safely separated and gated.
// Greens has no safely separable produce subgroup — reported as-is.
const PRODUCE_SUBGROUPS = {
  greens: null, // No safely separable produce — see report
  roots: ['carrotShoulders', 'beetRadish'],
  citrus: ['fruit'],
  orchard: ['fruit'],
  berries: ['berries'],
  tropical: ['pineapple'],
  herbs: ['flowerHead', 'lilacFlowers'],
}

// ── Compute transition duration for a bed advancement ─────────
function getBedDuration(fromStage, toStage) {
  const stageOrder = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']
  const fromIdx = stageOrder.indexOf(fromStage)
  const toIdx = stageOrder.indexOf(toStage)
  if (toIdx < 0) return COALESCED_DURATION
  if (toIdx - fromIdx > 1) return COALESCED_DURATION
  return STAGE_TRANSITION_DURATION[toStage] || COALESCED_DURATION
}

// ── Compute orchestration start delay for a bed ───────────────
function getBedStartDelay(bedKey) {
  let bandStart = 0
  let posInBand = 0
  if (FAR_BEDS.includes(bedKey)) {
    bandStart = 0
    posInBand = FAR_BEDS.indexOf(bedKey)
  } else if (MID_BEDS.includes(bedKey)) {
    bandStart = FAR_BEDS.length * BAND_STAGGER
    posInBand = MID_BEDS.indexOf(bedKey)
  } else {
    bandStart = (FAR_BEDS.length + MID_BEDS.length) * BAND_STAGGER
    posInBand = NEAR_BEDS.indexOf(bedKey)
  }
  return WAKE_DURATION + bandStart + posInBand * BAND_STAGGER
}

// ── Determine if compression is needed ────────────────────────
function needsCompression(advancements) {
  const hasBeds = advancements.bedAdvancements && advancements.bedAdvancements.length > 0
  const hasJourney = !!advancements.journeyAdvancement
  const hasArbor = advancements.newMilestoneIds && advancements.newMilestoneIds.length > 0
  const hasRainbow = !!advancements.rainbowComplete
  const classCount = [hasBeds, hasJourney, hasArbor, hasRainbow].filter(Boolean).length
  return classCount >= 3
}

// ── Compute total orchestration duration ──────────────────────
function computeTotalDuration(advancements) {
  if (!advancements || advancements.isFirstOpen) return 0

  const hasBeds = advancements.bedAdvancements && advancements.bedAdvancements.length > 0
  const hasJourney = !!advancements.journeyAdvancement
  const hasArbor = advancements.newMilestoneIds && advancements.newMilestoneIds.length > 0
  const hasRainbow = !!advancements.rainbowComplete

  if (!hasBeds && !hasJourney && !hasArbor && !hasRainbow) return 0

  const compress = needsCompression(advancements)

  let bedEnd = WAKE_DURATION
  if (hasBeds) {
    const lastBedKey = ALL_BEDS_ORDER[ALL_BEDS_ORDER.length - 1]
    const lastBedDelay = getBedStartDelay(lastBedKey)
    const maxBedDuration = Math.max(
      ...advancements.bedAdvancements.map((a) =>
        compress
          ? Math.min(getBedDuration(a.fromStage, a.toStage), COMPRESSED_BED_DURATION)
          : getBedDuration(a.fromStage, a.toStage),
      ),
    )
    bedEnd = lastBedDelay + maxBedDuration
  }

  let treeStart = WAKE_DURATION
  if (hasBeds) {
    const firstBedDelay = getBedStartDelay(ALL_BEDS_ORDER[0])
    const firstBedDuration = compress
      ? Math.min(
          getBedDuration(
            advancements.bedAdvancements[0].fromStage,
            advancements.bedAdvancements[0].toStage,
          ),
          COMPRESSED_BED_DURATION,
        )
      : getBedDuration(
          advancements.bedAdvancements[0].fromStage,
          advancements.bedAdvancements[0].toStage,
        )
    treeStart = compress
      ? firstBedDelay + firstBedDuration - COMPRESSED_TREE_OVERLAP
      : firstBedDelay + firstBedDuration
  }
  const treeDuration = compress ? TREE_DURATION_COMPRESSED : TREE_DURATION
  let treeEnd = hasJourney ? treeStart + treeDuration : treeStart

  let arborStart = treeEnd
  if (hasJourney && compress) {
    arborStart = treeEnd - COMPRESSED_ARBOR_OVERLAP
  }
  const arborDuration = hasArbor
    ? Math.min(ARBOR_PHASE_CAP, computeArborPhaseDuration(advancements.newMilestoneIds))
    : 0
  let arborEnd = hasArbor ? arborStart + arborDuration : arborStart

  let rainbowStart = arborEnd
  if (hasArbor && compress) {
    rainbowStart = arborEnd - COMPRESSED_RAINBOW_OVERLAP
  }
  const rainbowDuration = compress ? RAINBOW_DURATION_COMPRESSED : RAINBOW_DURATION
  let rainbowEnd = hasRainbow ? rainbowStart + rainbowDuration : rainbowStart

  if (!hasJourney && !hasArbor && !hasRainbow) {
    return Math.max(bedEnd, WAKE_DURATION)
  }

  return Math.max(bedEnd, rainbowEnd)
}

// ── Compute Arbor phase duration ──────────────────────────────
function computeArborPhaseDuration(newMilestoneIds) {
  if (!newMilestoneIds || newMilestoneIds.length === 0) return 0
  const count = newMilestoneIds.length
  const stagger = count >= 5 ? ARBOR_STAGGER_DENSE : ARBOR_STAGGER_SMALL
  const total = ARBOR_ORNAMENT_DURATION + (count - 1) * stagger
  return Math.min(total, ARBOR_PHASE_CAP)
}

function getArborStagger(count) {
  if (count >= 5) return ARBOR_STAGGER_DENSE
  return ARBOR_STAGGER_SMALL
}

// ── useGardenMotion hook ──────────────────────────────────────
// PERFORMANCE: Returns Animated.Value objects for transform/opacity.
// Components use Animated.createAnimatedComponent(G) to apply them
// directly — NO per-frame React setState for transforms/opacity.
//
// State-bridged values (DOCUMENTED EXCEPTIONS):
//   - bedColorProgress: { [bedKey]: 0..1 } — active only during
//     the 600ms Earned Color phase. Drives SVG fill strings.
//   - bedProduceReveal: { [bedKey]: 0..1 } — active only during
//     the Produce beat. Drives SVG opacity of produce subgroups.
//   - bedDeltaReveal: { [bedKey]: 0..1 } — active only during
//     late-stage delta reveal. Drives SVG opacity/transform of
//     destination-only geometry (Rev B monotonic progression).
//
// All other motion (scaleY, translateY, opacity, soilScale,
// tree channels, arborReveal, rainbowBloom) are Animated.Value
// objects consumed directly by Animated.createAnimatedComponent.
export function useGardenMotion({ advancements, isReduced, sceneId: _sceneId, onRainbowMotionDebug }) {
  // ── Animated.Value refs (NOT state-bridged) ────────────────
  // These are passed directly to Animated.createAnimatedComponent.
  // No listener, no setState, no rerender per frame.
  const bedAnimRefs = useRef({})
  const bedSoilRefs = useRef({})
  const treeScaleRef = useRef(new Animated.Value(1))
  const treeOpacityRef = useRef(new Animated.Value(1))
  const treeCanopyRef = useRef(new Animated.Value(1))
  const treeDetailRef = useRef(new Animated.Value(1))
  const treeRimRef = useRef(new Animated.Value(0))
  const treeBreathRef = useRef(new Animated.Value(1))
  // Phase 1D: destination-layer reveal channels for Tree
  const treeSourceOpacityRef = useRef(new Animated.Value(0))
  const treeTrunkOpacityRef = useRef(new Animated.Value(1))
  const treeCanopyOpacityRef = useRef(new Animated.Value(1))
  const treeDetailOpacityRef = useRef(new Animated.Value(1))
  const arborRevealRef = useRef(new Animated.Value(1))
  const rainbowRef = useRef(new Animated.Value(0))

  // ── State-bridged values (DOCUMENTED EXCEPTIONS) ──────────
  // Only colorProgress and produceReveal use setState.
  // Active only during their respective phases (not during growth).
  const [bedColorProgress, setBedColorProgress] = useState(() => {
    const r = {}
    ALL_BEDS_ORDER.forEach((k) => (r[k] = 1))
    return r
  })
  const [bedProduceReveal, setBedProduceReveal] = useState(() => {
    const r = {}
    ALL_BEDS_ORDER.forEach((k) => (r[k] = 1))
    return r
  })
  const [bedDeltaReveal, setBedDeltaReveal] = useState(() => {
    const r = {}
    ALL_BEDS_ORDER.forEach((k) => (r[k] = 1))
    return r
  })

  // ── Event-boundary state ──────────────────────────────────
  // Changes only when advancement detected / timeline starts / ends.
  const [activeAdvancement, setActiveAdvancement] = useState(null)
  const [newlyEarnedIds, setNewlyEarnedIds] = useState([])

  // ── Idle sway shared loops (3 phase groups) ───────────────
  const idleSwayRefs = useRef([null, null, null])
  const idleBreathRef = useRef(null)

  // ── Tracking ──────────────────────────────────────────────
  const timelineRef = useRef(null)
  const pendingTimeoutsRef = useRef(new Set())
  const processedAdvancementsRef = useRef(null)
  // Phase 1D: transition generation counter — increments each time
  // the motion hook processes a new advancement. Exposed to Tree
  // component so the guard can detect if the hook has processed the
  // current transition (for background cancellation detection).
  const transitionGenerationRef = useRef(0)
  const colorProgressRefs = useRef({})
  const produceRevealRefs = useRef({})
  const deltaRevealRefs = useRef({})
  // Rainbow motion diagnostic callback ref (dev-preview only)
  const rainbowMotionDebugRef = useRef(onRainbowMotionDebug)
  rainbowMotionDebugRef.current = onRainbowMotionDebug
  const reportRainbowMotion = useCallback((values) => {
    if (rainbowMotionDebugRef.current) {
      rainbowMotionDebugRef.current(values)
    }
  }, [])

  // ── Helper: tracked timeout ────────────────────────────────
  const trackedTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id)
      fn()
    }, delay)
    pendingTimeoutsRef.current.add(id)
    return id
  }, [])

  const clearAllTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach((id) => clearTimeout(id))
    pendingTimeoutsRef.current.clear()
  }, [])

  const cancelTimeline = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.stop()
      timelineRef.current = null
    }
    clearAllTimeouts()
  }, [clearAllTimeouts])

  // ── Helper: stop idle motion ───────────────────────────────
  const stopIdleMotion = useCallback(() => {
    idleSwayRefs.current.forEach((loop) => {
      if (loop) {
        loop.stop()
      }
    })
    idleSwayRefs.current = [null, null, null]
    if (idleBreathRef.current) {
      idleBreathRef.current.stop()
      idleBreathRef.current = null
    }
    // Reset breath to canonical
    treeBreathRef.current.setValue(1)
  }, [])

  // ── Helper: resolve all motion to canonical rest ───────────
  // Called at event boundaries: background, unmount, reduced motion.
  const resolveToCanonicalRest = useCallback(() => {
    stopIdleMotion()
    // Stop all Animated.Values and set to canonical
    ALL_BEDS_ORDER.forEach((bedKey) => {
      const refs = bedAnimRefs.current[bedKey]
      if (refs) {
        refs.scaleY.setValue(1)
        refs.translateY.setValue(0)
        refs.opacity.setValue(1)
      }
      const soilRef = bedSoilRefs.current[bedKey]
      if (soilRef) {
        soilRef.setValue(1)
      }
      const colorRef = colorProgressRefs.current[bedKey]
      if (colorRef) {
        colorRef.setValue(1)
      }
      const produceRef = produceRevealRefs.current[bedKey]
      if (produceRef) {
        produceRef.setValue(1)
      }
      const deltaRef = deltaRevealRefs.current[bedKey]
      if (deltaRef) {
        deltaRef.setValue(1)
      }
    })
    treeScaleRef.current.setValue(1)
    treeOpacityRef.current.setValue(1)
    treeCanopyRef.current.setValue(1)
    treeDetailRef.current.setValue(1)
    treeRimRef.current.setValue(0)
    treeBreathRef.current.setValue(1)
    // Phase 1D: destination-layer channels canonical at rest
    treeSourceOpacityRef.current.setValue(0)
    treeTrunkOpacityRef.current.setValue(1)
    treeCanopyOpacityRef.current.setValue(1)
    treeDetailOpacityRef.current.setValue(1)
    arborRevealRef.current.setValue(1)
    rainbowRef.current.setValue(0)
    // Reset state-bridged values
    const canonicalColors = {}
    const canonicalProduce = {}
    ALL_BEDS_ORDER.forEach((k) => {
      canonicalColors[k] = 1
      canonicalProduce[k] = 1
    })
    setBedColorProgress(canonicalColors)
    setBedProduceReveal(canonicalProduce)
    setActiveAdvancement(null)
  }, [stopIdleMotion])

  // ── Helper: ensure bed anim refs exist ─────────────────────
  const ensureBedRefs = useCallback((bedKey) => {
    if (!bedAnimRefs.current[bedKey]) {
      bedAnimRefs.current[bedKey] = {
        scaleY: new Animated.Value(1),
        translateY: new Animated.Value(0),
        opacity: new Animated.Value(1),
      }
    }
    if (!bedSoilRefs.current[bedKey]) {
      bedSoilRefs.current[bedKey] = new Animated.Value(1)
    }
    if (!colorProgressRefs.current[bedKey]) {
      colorProgressRefs.current[bedKey] = new Animated.Value(1)
    }
    if (!produceRevealRefs.current[bedKey]) {
      produceRevealRefs.current[bedKey] = new Animated.Value(1)
    }
    if (!deltaRevealRefs.current[bedKey]) {
      deltaRevealRefs.current[bedKey] = new Animated.Value(1)
    }
    return bedAnimRefs.current[bedKey]
  }, [])

  // ── Helper: run bed motion (5 beats) ───────────────────────
  // Beat 1: Soil Answer (temporary soil scale response)
  // Beat 2: Anchored Growth (scaleY from base) — early/mid only
  // Beat 2b: Delta Reveal (destination-only geometry) — late-stage only
  // Beat 3: Unfurl (settle offset) — early/mid only
  // Beat 4: Produce (produceReveal 0→1, state-bridged exception)
  // Beat 5: Earned Color (colorProgress 0→1, state-bridged exception)
  //
  // PERFORMANCE: scaleY/translateY/opacity/soilScale are Animated.Value
  // objects — NO setState per frame. Only produceReveal, colorProgress,
  // and deltaReveal use setState (documented exceptions).
  const runBedMotion = useCallback(
    (bedKey, fromStage, toStage, startDelay, compress) => {
      const refs = ensureBedRefs(bedKey)
      const soilRef = bedSoilRefs.current[bedKey]
      const colorRef = colorProgressRefs.current[bedKey]
      const produceRef = produceRevealRefs.current[bedKey]
      const deltaRef = deltaRevealRefs.current[bedKey]
      const placement = BED_PLACEMENT[bedKey]
      if (!placement) return
      const growthDuration = compress
        ? Math.min(getBedDuration(fromStage, toStage), COMPRESSED_BED_DURATION)
        : getBedDuration(fromStage, toStage)

      // ── Determine if this is a late-stage transition ──────
      // Late-stage: delta reveal instead of whole-plant growth
      const stageOrder = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']
      const fromIdx = stageOrder.indexOf(fromStage)
      const isLateStage = fromIdx >= 3 // fromStage is 'growing' or later

      // ── Beat 1: Soil Answer — temporary restrained response ──
      soilRef.setValue(1)

      // ── Beat 2: Anchored Growth — stage-specific initial state ──
      // MONOTONIC PROGRESSION: late-stage transitions start at
      // canonical scale/opacity (no shrink). Early transitions
      // use compressed start for emergence effect.
      const growthStart = getGrowthStart(fromStage, toStage)
      refs.scaleY.setValue(growthStart.startScale)
      refs.translateY.setValue(0)
      refs.opacity.setValue(growthStart.startOpacity)

      // ── Beat 2b: Delta Reveal — for late-stage transitions ──
      // deltaReveal 0→1 drives destination-only geometry opacity/transform.
      // For early/mid transitions, deltaReveal stays at 1 (no delta geometry).
      if (isLateStage) {
        deltaRef.setValue(0)
      } else {
        deltaRef.setValue(1)
      }

      // ── Beat 4: Produce — hidden initially (produceReveal=0) ──
      produceRef.setValue(0)

      // ── Beat 5: Earned Color — starts at previous state ──
      colorRef.setValue(0)

      // ── State-bridged initial values (event boundary) ──────
      setBedProduceReveal((prev) => ({ ...prev, [bedKey]: 0 }))
      setBedColorProgress((prev) => ({ ...prev, [bedKey]: 0 }))
      if (isLateStage) {
        setBedDeltaReveal((prev) => ({ ...prev, [bedKey]: 0 }))
      } else {
        setBedDeltaReveal((prev) => ({ ...prev, [bedKey]: 1 }))
      }

      // ── Beat 1: Soil Answer animation ──────────────────────
      const soilAnim = Animated.sequence([
        Animated.timing(soilRef, {
          toValue: SOIL_ANSWER_PEAK,
          duration: SOIL_ANSWER_DURATION * 0.5,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
        Animated.timing(soilRef, {
          toValue: 1,
          duration: SOIL_ANSWER_DURATION * 0.5,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
      ])

      // ── Beat 2: Anchored Growth ────────────────────────────
      // For late-stage: 1→1 no-op (timing preserved for Produce/Color)
      // For early/mid: actual growth animation
      const growthAnim = Animated.parallel([
        Animated.timing(refs.scaleY, {
          toValue: 1,
          duration: growthDuration,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
        Animated.timing(refs.opacity, {
          toValue: 1,
          duration: Math.min(growthDuration, 600),
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
      ])

      // ── Beat 2b: Delta Reveal (late-stage only) ────────────
      // Replaces invisible no-op with visible delta geometry reveal.
      // deltaReveal 0→1 over a meaningful portion of the duration.
      const deltaListener = deltaRef.addListener(({ value }) => {
        setBedDeltaReveal((prev) => ({ ...prev, [bedKey]: value }))
      })
      const deltaStart = growthDuration * DELTA_REVEAL_START_FRACTION
      const deltaDuration = Math.max(
        growthDuration * DELTA_REVEAL_DURATION_FRACTION,
        400,
      )
      const deltaAnim = isLateStage
        ? Animated.sequence([
            Animated.delay(deltaStart),
            Animated.timing(deltaRef, {
              toValue: 1,
              duration: deltaDuration,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ])
        : Animated.delay(0) // no-op for early/mid

      // ── Beat 3: Unfurl — settle offset (early/mid only) ────
      // For late-stage, no settle (plant stays canonical)
      const settleDelay = growthDuration * GROWTH_SETTLE_FRACTION
      const settleAnim = isLateStage
        ? Animated.delay(0) // no settle for late-stage
        : Animated.sequence([
            Animated.delay(settleDelay),
            Animated.timing(refs.translateY, {
              toValue: GROWTH_SETTLE_PX,
              duration: 120,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
            Animated.timing(refs.translateY, {
              toValue: 0,
              duration: 180,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ])

      // ── Beat 4: Produce reveal (state-bridged exception) ───
      // produceReveal 0→1 during the Produce beat.
      // For late-stage, starts concurrently with delta reveal.
      const produceStart = isLateStage
        ? growthDuration * (DELTA_REVEAL_START_FRACTION + 0.1)
        : growthDuration * PRODUCE_REVEAL_START_FRACTION
      const produceListener = produceRef.addListener(({ value }) => {
        setBedProduceReveal((prev) => ({ ...prev, [bedKey]: value }))
      })
      const produceAnim = Animated.sequence([
        Animated.delay(produceStart),
        Animated.timing(produceRef, {
          toValue: 1,
          duration: PRODUCE_REVEAL_DURATION,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
      ])

      // ── Beat 5: Earned Color (state-bridged exception) ─────
      // colorProgress 0→1 AFTER delta/growth completes (distinct phase).
      // For late-stage, starts after delta reveal completes.
      const colorStartDelay = isLateStage
        ? deltaStart + deltaDuration + EARNED_COLOR_START_DELAY
        : growthDuration + EARNED_COLOR_START_DELAY
      const colorListener = colorRef.addListener(({ value }) => {
        setBedColorProgress((prev) => ({ ...prev, [bedKey]: value }))
      })
      const earnedColorAnim = Animated.sequence([
        Animated.delay(colorStartDelay),
        Animated.timing(colorRef, {
          toValue: 1,
          duration: EARNED_COLOR_DURATION,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
      ])

      // ── Start all beats after delay ────────────────────────
      trackedTimeout(() => {
        Animated.parallel([
          soilAnim,
          growthAnim,
          deltaAnim,
          settleAnim,
          produceAnim,
          earnedColorAnim,
        ]).start(() => {
          // ── Event boundary: timeline complete ──────────
          produceRef.removeListener(produceListener)
          colorRef.removeListener(colorListener)
          deltaRef.removeListener(deltaListener)
          // Ensure canonical
          setBedProduceReveal((prev) => ({ ...prev, [bedKey]: 1 }))
          setBedColorProgress((prev) => ({ ...prev, [bedKey]: 1 }))
          setBedDeltaReveal((prev) => ({ ...prev, [bedKey]: 1 }))
        })
      }, startDelay)
    },
    [ensureBedRefs, trackedTimeout],
  )

  // ── Helper: run Journey Tree growth (multi-channel) ────────
  // Phase 1D: destination-layer reveal architecture.
  // Source canonical Tree fades out while destination canonical Tree
  // subgroups (trunk → branches → canopy → detail) reveal progressively.
  // Rim/glow remains the last event. No whole-tree stretch as primary.
  // All channels are Animated.Value — NO setState per frame.
  const runTreeGrowth = useCallback(
    (fromStage, toStage, startDelay, compress) => {
      const duration = compress ? TREE_DURATION_COMPRESSED : TREE_DURATION

      // Legacy channels (kept for backward compat, set to canonical)
      treeScaleRef.current.setValue(1)
      treeOpacityRef.current.setValue(1)
      treeCanopyRef.current.setValue(1)
      treeDetailRef.current.setValue(1)
      treeBreathRef.current.setValue(1)

      // Phase 1D: source layer visible, destination subgroups hidden
      treeSourceOpacityRef.current.setValue(1)
      treeTrunkOpacityRef.current.setValue(0)
      treeCanopyOpacityRef.current.setValue(0)
      treeDetailOpacityRef.current.setValue(0)
      treeRimRef.current.setValue(0)

      const trunkStart = duration * TREE_TRUNK_START_FRACTION
      const trunkDuration = Math.round(duration * TREE_TRUNK_DURATION_FRACTION)
      const canopyStart = duration * TREE_CANOPY_REVEAL_START_FRACTION
      const canopyDuration = Math.round(duration * TREE_CANOPY_REVEAL_DURATION_FRACTION)
      const detailStart = duration * TREE_DETAIL_REVEAL_START_FRACTION
      const detailDuration = Math.round(duration * TREE_DETAIL_REVEAL_DURATION_FRACTION)
      const sourceFadeStart = duration * TREE_SOURCE_FADE_START_FRACTION
      const sourceFadeDuration = Math.round(duration * TREE_SOURCE_FADE_DURATION_FRACTION)
      const rimStart = duration * TREE_RIM_START_FRACTION

      trackedTimeout(() => {
        Animated.parallel([
          // Source layer fade-out (source Seed remains briefly, then fades)
          Animated.sequence([
            Animated.delay(sourceFadeStart),
            Animated.timing(treeSourceOpacityRef.current, {
              toValue: 0,
              duration: sourceFadeDuration,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ]),
          // Trunk/base establishes first
          Animated.sequence([
            Animated.delay(trunkStart),
            Animated.timing(treeTrunkOpacityRef.current, {
              toValue: 1,
              duration: trunkDuration,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ]),
          // Canopy develops after trunk is underway
          Animated.sequence([
            Animated.delay(canopyStart),
            Animated.timing(treeCanopyOpacityRef.current, {
              toValue: 1,
              duration: canopyDuration,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ]),
          // Detail settles after canopy has begun
          Animated.sequence([
            Animated.delay(detailStart),
            Animated.timing(treeDetailOpacityRef.current, {
              toValue: 1,
              duration: detailDuration,
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ]),
          // Rim/glow channel (temporary, resolves to 0)
          Animated.sequence([
            Animated.delay(rimStart),
            Animated.timing(treeRimRef.current, {
              toValue: 1,
              duration: Math.round(duration * 0.15),
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
            Animated.timing(treeRimRef.current, {
              toValue: 0,
              duration: Math.round(duration * 0.1),
              easing: EASING.decelerate,
              useNativeDriver: false,
            }),
          ]),
        ]).start(() => {
          // Event boundary: Tree timeline complete — canonical rest
          treeRimRef.current.setValue(0)
          treeSourceOpacityRef.current.setValue(0)
          treeTrunkOpacityRef.current.setValue(1)
          treeCanopyOpacityRef.current.setValue(1)
          treeDetailOpacityRef.current.setValue(1)
        })
      }, startDelay)
    },
    [trackedTimeout],
  )

  // ── Helper: run Arbor ornament reveal ──────────────────────
  // arborReveal is Animated.Value — NO setState per frame.
  // Per-ornament progress is computed in the Arbor component from
  // the single arborReveal value (no per-ornament listeners).
  const runArborReveal = useCallback(
    (newMilestoneIds, startDelay) => {
      if (!newMilestoneIds || newMilestoneIds.length === 0) return
      arborRevealRef.current.setValue(0)

      const count = newMilestoneIds.length
      const stagger = getArborStagger(count)
      const totalRevealDuration = Math.min(
        ARBOR_ORNAMENT_DURATION + (count - 1) * stagger,
        ARBOR_PHASE_CAP,
      )

      trackedTimeout(() => {
        Animated.timing(arborRevealRef.current, {
          toValue: 1,
          duration: totalRevealDuration,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }).start(() => {
          // Event boundary: Arbor reveal complete
          arborRevealRef.current.setValue(1)
        })
      }, startDelay)
    },
    [trackedTimeout],
  )

  // ── Helper: run Rainbow capstone ───────────────────────────
  // rainbowBloom is Animated.Value — NO setState per frame.
  // Direct wrapper opacity: 0 → RAINBOW_PEAK_OPACITY → 0
  // No interpolation. The Animated.Value IS the wrapper opacity.
  const runRainbowBloom = useCallback(
    (startDelay, compress) => {
      const totalDuration = compress ? RAINBOW_DURATION_COMPRESSED : RAINBOW_DURATION
      const halfDuration = Math.round(totalDuration / 2)
      rainbowRef.current.setValue(0)
      reportRainbowMotion({
        runCalled: 1,
        delay: startDelay,
        durationArg: totalDuration,
        peakTarget: RAINBOW_PEAK_OPACITY,
        started: 0,
        cancelled: 0,
        completed: 0,
        finished: 0,
        startValue: 0,
        elapsed: 0,
      })

      trackedTimeout(() => {
        const startValue = rainbowRef.current.__getValue()
        const startedAt = Date.now()

        reportRainbowMotion({
          runCalled: 1,
          delay: startDelay,
          durationArg: totalDuration,
          peakTarget: RAINBOW_PEAK_OPACITY,
          started: 1,
          cancelled: 0,
          completed: 0,
          finished: 0,
          startValue,
          elapsed: 0,
        })

        // Direct opacity sequence: 0 → peak → 0
        Animated.sequence([
          Animated.timing(rainbowRef.current, {
            toValue: RAINBOW_PEAK_OPACITY,
            duration: halfDuration,
            easing: EASING.decelerate,
            useNativeDriver: true,
          }),
          Animated.timing(rainbowRef.current, {
            toValue: 0,
            duration: halfDuration,
            easing: EASING.accelerate,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          const callbackAt = Date.now()
          // Event boundary: Rainbow complete — ensure opacity is exactly 0
          if (finished) {
            rainbowRef.current.setValue(0)
          }
          reportRainbowMotion({
            runCalled: 1,
            delay: startDelay,
            durationArg: totalDuration,
            peakTarget: RAINBOW_PEAK_OPACITY,
            started: 1,
            cancelled: finished ? 0 : 1,
            completed: 1,
            finished: finished ? 1 : 0,
            startValue,
            elapsed: callbackAt - startedAt,
          })
        })
      }, startDelay)
    },
    [trackedTimeout, reportRainbowMotion],
  )

  // ── Helper: start idle-life motion ────────────────────────
  // 3 shared/fixed sway phase groups + 1 tree breath loop.
  // No per-plant timers. Reduced Motion: disabled.
  const startIdleMotion = useCallback(() => {
    if (isReduced) return
    stopIdleMotion()

    // ── Tree canopy breath (idle, ~1.004 amplitude) ────────
    // Tree trunk/base remains completely static.
    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(treeBreathRef.current, {
          toValue: IDLE_BREATH_SCALE,
          duration: IDLE_BREATH_DURATION / 2,
          easing: EASING.linear,
          useNativeDriver: false,
        }),
        Animated.timing(treeBreathRef.current, {
          toValue: 1,
          duration: IDLE_BREATH_DURATION / 2,
          easing: EASING.linear,
          useNativeDriver: false,
        }),
      ]),
    )
    idleBreathRef.current = breath
    breath.start()

    // ── Flourishing foliage sway (3 phase groups) ──────────
    // Each group is a single Animated.loop driving a shared
    // sway value. Beds in the same group share the same phase.
    // Very small amplitude (~0.5 degrees).
    SWAY_PHASE_GROUPS.forEach((group, groupIdx) => {
      const swayLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(IDLE_SWAY_DURATION * group.offsetFraction),
          Animated.timing(treeBreathRef.current, {
            toValue: 1 + IDLE_SWAY_AMPLITUDE * 0.001, // tiny
            duration: IDLE_SWAY_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
          Animated.timing(treeBreathRef.current, {
            toValue: 1,
            duration: IDLE_SWAY_DURATION / 2,
            easing: EASING.linear,
            useNativeDriver: false,
          }),
        ]),
      )
      idleSwayRefs.current[groupIdx] = swayLoop
      swayLoop.start()
    })
  }, [isReduced, stopIdleMotion])

  // ── Ambient entrance replay (no new progression) ────────────
  // Plays a presentation-only reveal of the CURRENT canonical Garden
  // state. Invoked exclusively from the orchestration effect below
  // (the single authority over these Animated.Values) whenever an
  // intentional open produces no new bed/tree/arbor/rainbow
  // advancement — so every intentional open still shows an entrance,
  // not just opens with real progression. Reuses the same restrained
  // "mid transition" and FROZEN duration/easing constants as the real
  // advancement timeline (GROWTH_START_SCALE_MID, GROWTH_START_OPACITY_MID,
  // TREE_START_SCALE, TREE_START_OPACITY, TREE_DURATION_COMPRESSED,
  // ARBOR_ORNAMENT_DURATION, WAKE_DURATION, BAND_STAGGER,
  // EASING.decelerate) rather than inventing new motion. Does not
  // affect advancements, seen-state, milestones, or persisted progress
  // — animation/presentation values only.
  const playAmbientEntranceReplay = useCallback(() => {
    cancelTimeline()
    stopIdleMotion()
    // Reset to a restrained "mid transition" starting frame (not a
    // full empty-to-seed emergence — the garden already has earned
    // content; this is a gentle reveal, not a regrowth from nothing).
    ALL_BEDS_ORDER.forEach((bedKey) => {
      const refs = ensureBedRefs(bedKey)
      refs.scaleY.setValue(GROWTH_START_SCALE_MID)
      refs.translateY.setValue(0)
      refs.opacity.setValue(GROWTH_START_OPACITY_MID)
    })
    treeScaleRef.current.setValue(TREE_START_SCALE)
    treeOpacityRef.current.setValue(TREE_START_OPACITY)
    arborRevealRef.current.setValue(0)

    // Animate beds to canonical with staggered delays (same stagger
    // language as the real per-bed motion, starting after the wake
    // fade so it reads as one coherent entrance).
    ALL_BEDS_ORDER.forEach((bedKey, idx) => {
      const refs = ensureBedRefs(bedKey)
      const delay = WAKE_DURATION + idx * BAND_STAGGER
      trackedTimeout(() => {
        Animated.parallel([
          Animated.timing(refs.scaleY, {
            toValue: 1,
            duration: STAGE_TRANSITION_DURATION.sprout,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
          Animated.timing(refs.opacity, {
            toValue: 1,
            duration: STAGE_TRANSITION_DURATION.sprout,
            easing: EASING.decelerate,
            useNativeDriver: false,
          }),
        ]).start()
      }, delay)
    })

    // Tree reveal — same FROZEN compressed duration used elsewhere
    // for ambient/no-op orchestration timing.
    const treeDelay = WAKE_DURATION + ALL_BEDS_ORDER.length * BAND_STAGGER + BED_TO_TREE_DELAY
    trackedTimeout(() => {
      Animated.parallel([
        Animated.timing(treeScaleRef.current, {
          toValue: 1,
          duration: TREE_DURATION_COMPRESSED,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
        Animated.timing(treeOpacityRef.current, {
          toValue: 1,
          duration: TREE_DURATION_COMPRESSED,
          easing: EASING.decelerate,
          useNativeDriver: false,
        }),
      ]).start()
    }, treeDelay)

    // Arbor reveal — same FROZEN ornament reveal duration/easing used
    // by the real runArborReveal, applied to the existing earned set.
    const arborDelay = treeDelay + TREE_DURATION_COMPRESSED + TREE_TO_ARBOR_DELAY
    trackedTimeout(() => {
      Animated.timing(arborRevealRef.current, {
        toValue: 1,
        duration: ARBOR_ORNAMENT_DURATION,
        easing: EASING.decelerate,
        useNativeDriver: false,
      }).start()
    }, arborDelay)

    // Start idle motion after the ambient reveal completes.
    const totalAmbientDuration = arborDelay + ARBOR_ORNAMENT_DURATION + 300
    const idleTimer = trackedTimeout(() => startIdleMotion(), totalAmbientDuration)
    pendingTimeoutsRef.current.add(idleTimer)
  }, [cancelTimeline, stopIdleMotion, ensureBedRefs, trackedTimeout, startIdleMotion])

  // ── Orchestration effect (event boundary) ──────────────────
  useEffect(() => {
    if (!advancements) return
    if (processedAdvancementsRef.current === advancements) return
    processedAdvancementsRef.current = advancements
    // Phase 1D: increment transition generation for guard lifecycle
    transitionGenerationRef.current += 1

    // First open: no motion
    if (advancements.isFirstOpen) {
      resolveToCanonicalRest()
      return
    }

    const hasBeds = advancements.bedAdvancements && advancements.bedAdvancements.length > 0
    const hasJourney = !!advancements.journeyAdvancement
    const hasArbor = advancements.newMilestoneIds && advancements.newMilestoneIds.length > 0
    const hasRainbow = !!advancements.rainbowComplete

    if (!hasBeds && !hasJourney && !hasArbor && !hasRainbow) {
      // No new progression since last open — this is a repeat,
      // intentional Garden entry. Still replay a presentation-only
      // ambient entrance reveal of the current canonical state so
      // every intentional open shows the intended entrance animation
      // (not just opens with real progression). Reduced Motion still
      // resolves instantly.
      if (isReduced) {
        resolveToCanonicalRest()
        return
      }
      playAmbientEntranceReplay()
      return
    }

    // Reduced motion: instant canonical
    if (isReduced) {
      resolveToCanonicalRest()
      return
    }

    // ── Event boundary: timeline starts ─────────────────────
    cancelTimeline()
    stopIdleMotion()
    setActiveAdvancement(advancements)
    setNewlyEarnedIds(advancements.newMilestoneIds || [])

    const compress = needsCompression(advancements)

    // 1. Beds back-to-front (5 beats each)
    // PRODUCTION INTEGRATION: V6 Spotlight handles bed visualization.
    // The old per-bed motion is suppressed when bed advancements exist.
    // Tree/Arbor timing is still computed from bed advancement durations
    // so they fire at the correct orchestration points.
    // (Spotlight runs independently in the Scene's sceneCanvas overlay.)
    if (hasBeds) {
      advancements.bedAdvancements.forEach((adv) => {
        // Suppress old per-bed motion — V6 Spotlight owns bed presentation
        // runBedMotion(adv.bedKey, adv.fromStage, adv.toStage, getBedStartDelay(adv.bedKey), compress)
      })
    }

    // 2. Journey Tree
    if (hasJourney) {
      let treeDelay
      if (hasBeds && compress) {
        const firstBedDelay = getBedStartDelay(ALL_BEDS_ORDER[0])
        const firstBedDuration = Math.min(
          getBedDuration(
            advancements.bedAdvancements[0].fromStage,
            advancements.bedAdvancements[0].toStage,
          ),
          COMPRESSED_BED_DURATION,
        )
        treeDelay = firstBedDelay + firstBedDuration - COMPRESSED_TREE_OVERLAP + BED_TO_TREE_DELAY
      } else if (hasBeds) {
        const firstBedDelay = getBedStartDelay(ALL_BEDS_ORDER[0])
        const firstBedDuration = getBedDuration(
          advancements.bedAdvancements[0].fromStage,
          advancements.bedAdvancements[0].toStage,
        )
        treeDelay = firstBedDelay + firstBedDuration + BED_TO_TREE_DELAY
      } else {
        treeDelay = WAKE_DURATION + BED_TO_TREE_DELAY
      }
      runTreeGrowth(hasJourney.fromStage, hasJourney.toStage, treeDelay, compress)
    }

    // 3. Arbor
    if (hasArbor) {
      let arborDelay
      const treeDuration = compress ? TREE_DURATION_COMPRESSED : TREE_DURATION
      if (hasJourney && compress) {
        const firstBedDelay = hasBeds ? getBedStartDelay(ALL_BEDS_ORDER[0]) : WAKE_DURATION
        const firstBedDuration = hasBeds
          ? Math.min(
              getBedDuration(
                advancements.bedAdvancements[0].fromStage,
                advancements.bedAdvancements[0].toStage,
              ),
              COMPRESSED_BED_DURATION,
            )
          : 0
        const treeStart =
          firstBedDelay + firstBedDuration - COMPRESSED_TREE_OVERLAP + BED_TO_TREE_DELAY
        arborDelay = treeStart + treeDuration - COMPRESSED_ARBOR_OVERLAP + TREE_TO_ARBOR_DELAY
      } else if (hasJourney) {
        const firstBedDelay = hasBeds ? getBedStartDelay(ALL_BEDS_ORDER[0]) : WAKE_DURATION
        const firstBedDuration = hasBeds
          ? getBedDuration(
              advancements.bedAdvancements[0].fromStage,
              advancements.bedAdvancements[0].toStage,
            )
          : 0
        const treeStart = firstBedDelay + firstBedDuration + BED_TO_TREE_DELAY
        arborDelay = treeStart + treeDuration + TREE_TO_ARBOR_DELAY
      } else {
        arborDelay = WAKE_DURATION + ALL_BEDS_ORDER.length * BAND_STAGGER + TREE_TO_ARBOR_DELAY
      }
      runArborReveal(advancements.newMilestoneIds, arborDelay)
    }

    // 4. Rainbow
    if (hasRainbow) {
      reportRainbowMotion({ eventSeen: 1, runCalled: 0, delay: 0, started: 0, cancelled: 0, completed: 0 })
      let rainbowDelay
      const treeDuration = compress ? TREE_DURATION_COMPRESSED : TREE_DURATION
      const arborDuration = computeArborPhaseDuration(advancements.newMilestoneIds)
      if (hasArbor && compress) {
        const firstBedDelay = hasBeds ? getBedStartDelay(ALL_BEDS_ORDER[0]) : WAKE_DURATION
        const firstBedDuration = hasBeds
          ? Math.min(
              getBedDuration(
                advancements.bedAdvancements[0].fromStage,
                advancements.bedAdvancements[0].toStage,
              ),
              COMPRESSED_BED_DURATION,
            )
          : 0
        const treeStart = hasJourney
          ? firstBedDelay + firstBedDuration - COMPRESSED_TREE_OVERLAP + BED_TO_TREE_DELAY
          : WAKE_DURATION
        const arborStart = hasJourney
          ? treeStart + treeDuration - COMPRESSED_ARBOR_OVERLAP + TREE_TO_ARBOR_DELAY
          : treeStart + TREE_TO_ARBOR_DELAY
        rainbowDelay =
          arborStart + arborDuration - COMPRESSED_RAINBOW_OVERLAP + ARBOR_TO_RAINBOW_DELAY
      } else if (hasArbor) {
        const firstBedDelay = hasBeds ? getBedStartDelay(ALL_BEDS_ORDER[0]) : WAKE_DURATION
        const firstBedDuration = hasBeds
          ? getBedDuration(
              advancements.bedAdvancements[0].fromStage,
              advancements.bedAdvancements[0].toStage,
            )
          : 0
        const treeStart = hasJourney
          ? firstBedDelay + firstBedDuration + BED_TO_TREE_DELAY
          : WAKE_DURATION
        const arborStart = treeStart + treeDuration + TREE_TO_ARBOR_DELAY
        rainbowDelay = arborStart + arborDuration + ARBOR_TO_RAINBOW_DELAY
      } else if (hasJourney) {
        const firstBedDelay = hasBeds ? getBedStartDelay(ALL_BEDS_ORDER[0]) : WAKE_DURATION
        const firstBedDuration = hasBeds
          ? getBedDuration(
              advancements.bedAdvancements[0].fromStage,
              advancements.bedAdvancements[0].toStage,
            )
          : 0
        const treeStart = firstBedDelay + firstBedDuration + BED_TO_TREE_DELAY
        rainbowDelay = treeStart + treeDuration + ARBOR_TO_RAINBOW_DELAY
      } else {
        rainbowDelay = WAKE_DURATION + ALL_BEDS_ORDER.length * BAND_STAGGER + ARBOR_TO_RAINBOW_DELAY
      }
      runRainbowBloom(rainbowDelay, compress)
    }

    // Start idle motion after orchestration completes
    const totalDuration = computeTotalDuration(advancements)
    const idleTimer = setTimeout(() => startIdleMotion(), totalDuration + 300)
    pendingTimeoutsRef.current.add(idleTimer)
  }, [
    advancements,
    isReduced,
    cancelTimeline,
    stopIdleMotion,
    resolveToCanonicalRest,
    playAmbientEntranceReplay,
    runBedMotion,
    runTreeGrowth,
    runArborReveal,
    runRainbowBloom,
    startIdleMotion,
    reportRainbowMotion,
  ])

  // ── AppState background/inactive: resolve to canonical ─────
  // Mirrors Glow interruption philosophy:
  //   1. stop all pending motion
  //   2. clear queued delays/timeouts
  //   3. resolve immediately to CURRENT canonical destination state
  //   4. do NOT resume old choreography when app becomes active
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        cancelTimeline()
        stopIdleMotion()
        resolveToCanonicalRest()
      }
    })
    return () => {
      cancelTimeline()
      stopIdleMotion()
      subscription.remove()
    }
  }, [cancelTimeline, stopIdleMotion, resolveToCanonicalRest])

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelTimeline()
      stopIdleMotion()
      ALL_BEDS_ORDER.forEach((bedKey) => {
        const refs = bedAnimRefs.current[bedKey]
        if (refs) {
          refs.scaleY.removeAllListeners()
          refs.translateY.removeAllListeners()
          refs.opacity.removeAllListeners()
        }
        const soilRef = bedSoilRefs.current[bedKey]
        if (soilRef) soilRef.removeAllListeners()
        const colorRef = colorProgressRefs.current[bedKey]
        if (colorRef) colorRef.removeAllListeners()
        const produceRef = produceRevealRefs.current[bedKey]
        if (produceRef) produceRef.removeAllListeners()
        const deltaRef = deltaRevealRefs.current[bedKey]
        if (deltaRef) deltaRef.removeAllListeners()
      })
      treeScaleRef.current.removeAllListeners()
      treeOpacityRef.current.removeAllListeners()
      treeCanopyRef.current.removeAllListeners()
      treeDetailRef.current.removeAllListeners()
      treeRimRef.current.removeAllListeners()
      treeBreathRef.current.removeAllListeners()
      arborRevealRef.current.removeAllListeners()
      rainbowRef.current.removeAllListeners()
    }
  }, [cancelTimeline, stopIdleMotion])

  return {
    // Animated.Value objects — consumed directly by components.
    // NO per-frame setState for these.
    bedAnimRefs: bedAnimRefs.current,
    bedSoilRefs: bedSoilRefs.current,
    treeAnimValues: {
      scaleY: treeScaleRef.current,
      opacity: treeOpacityRef.current,
      canopy: treeCanopyRef.current,
      detail: treeDetailRef.current,
      rim: treeRimRef.current,
      breath: treeBreathRef.current,
      // Phase 1D: destination-layer reveal channels
      sourceOpacity: treeSourceOpacityRef.current,
      trunkOpacity: treeTrunkOpacityRef.current,
      canopyOpacity: treeCanopyOpacityRef.current,
      detailOpacity: treeDetailOpacityRef.current,
      // Phase 1D: transition generation (non-animated, plain number)
      transitionGeneration: transitionGenerationRef.current,
    },
    arborRevealValue: arborRevealRef.current,
    rainbowBloomValue: rainbowRef.current,

    // State-bridged values (DOCUMENTED EXCEPTIONS).
    // Active only during their respective phases.
    bedColorProgress,
    bedProduceReveal,
    bedDeltaReveal,

    // Event-boundary state
    activeAdvancement,
    newlyEarnedIds,
  }
}

// ── Exports for testing ───────────────────────────────────────
export {
  STAGE_TRANSITION_DURATION,
  COALESCED_DURATION,
  GROWTH_START_SCALE,
  GROWTH_SETTLE_PX,
  GROWTH_START_OPACITY,
  SOIL_ANSWER_PEAK,
  SOIL_ANSWER_DURATION,
  PRODUCE_REVEAL_START_FRACTION,
  PRODUCE_REVEAL_DURATION,
  EARNED_COLOR_DURATION,
  EARNED_COLOR_START_DELAY,
  TREE_START_SCALE,
  TREE_START_OPACITY,
  TREE_DURATION,
  TREE_DURATION_COMPRESSED,
  TREE_CANOPY_START_FRACTION,
  TREE_DETAIL_START_FRACTION,
  TREE_RIM_START_FRACTION,
  TREE_TRUNK_START_FRACTION,
  TREE_TRUNK_DURATION_FRACTION,
  TREE_CANOPY_REVEAL_START_FRACTION,
  TREE_CANOPY_REVEAL_DURATION_FRACTION,
  TREE_DETAIL_REVEAL_START_FRACTION,
  TREE_DETAIL_REVEAL_DURATION_FRACTION,
  TREE_SOURCE_FADE_START_FRACTION,
  TREE_SOURCE_FADE_DURATION_FRACTION,
  ARBOR_ORNAMENT_DURATION,
  ARBOR_START_SCALE,
  ARBOR_STAGGER_SMALL,
  ARBOR_STAGGER_DENSE,
  ARBOR_PHASE_CAP,
  ARBOR_HALO_PEAK,
  RAINBOW_DURATION,
  RAINBOW_DURATION_COMPRESSED,
  RAINBOW_PEAK_OPACITY,
  RAINBOW_BLOOM_END_FRACTION,
  RAINBOW_SWEEP_END_FRACTION,
  RAINBOW_TREE_ACK_END_FRACTION,
  IDLE_SWAY_DURATION,
  IDLE_SWAY_AMPLITUDE,
  IDLE_BREATH_DURATION,
  IDLE_BREATH_SCALE,
  SWAY_PHASE_GROUPS,
  WAKE_DURATION,
  BAND_STAGGER,
  FAR_BEDS,
  MID_BEDS,
  NEAR_BEDS,
  ALL_BEDS_ORDER,
  TIER_3_BEDS,
  TIER_4_BEDS,
  TIER3_GROUP_OFFSETS,
  TIER3_GROUP_START_FRACTIONS,
  PRODUCE_SUBGROUPS,
  CANONICAL_BED_MOTION,
  CANONICAL_TREE_MOTION,
  getBedDuration,
  getBedStartDelay,
  computeTotalDuration,
  computeArborPhaseDuration,
  getArborStagger,
  needsCompression,
  // Monotonic progression (Rev B)
  GROWTH_START_SCALE_EARLY,
  GROWTH_START_SCALE_MID,
  GROWTH_START_SCALE_LATE,
  GROWTH_START_OPACITY_EARLY,
  GROWTH_START_OPACITY_MID,
  GROWTH_START_OPACITY_LATE,
  getGrowthStart,
  // Delta reveal (Rev B — late-stage destination-delta)
  DELTA_REVEAL_START_FRACTION,
  DELTA_REVEAL_DURATION_FRACTION,
  DELTA_DETAIL_DELAY_FRACTION,
  DELTA_DETAIL_DURATION_FRACTION,
}
