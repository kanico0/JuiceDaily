// ─────────────────────────────────────────────────────────────
// LivingGardenScene.js — Main immersive scene renderer
//
// Composes all z-layers (spec §6):
//   z00 Sky gradient + horizon glow (Journey-driven)
//   z01 Distant treeline (static)
//   z02 Ground plane + dapple pools (static)
//   z03 Journey Tree (Journey-driven)
//   z04 Path (static)
//   z05 Ground detail (static, seeded)
//   z06 Far beds — Citrus, Orchard (bed stage)
//   z07 Milestone Arbor (earned milestones)
//   z08 Mid beds — Berries, Tropical (bed stage)
//   z09 Near beds — Herbs, Greens, Roots (bed stage)
//   z10 Ambient motes (Journey stage ≥ Blooming)
//   z11 Vignette (static, non-interactive)
//   z12 UI overlay (React Native views, not SVG)
//
// One <Svg viewBox="0 0 390 720" preserveAspectRatio="xMidYMax slice">
// filling the screen. UI chrome is ordinary React Native views
// layered above it (spec §22).
//
// Wake animation: unconditional 900ms scene opacity 0.55 → 1.0,
// brightness 0.72 → 1.0 (spec §21). No date input.
//
// RENDER EXISTING TRUTH. No new progression.
// ─────────────────────────────────────────────────────────────

import React, { memo, useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import Svg from 'react-native-svg'
import { G, Ellipse, Path, Circle } from 'react-native-svg'
import { SCENE_WIDTH, SCENE_HEIGHT, BED_PLACEMENT, SCENE_PALETTE } from './LivingGardenGeometry'
import { getAtmosphere } from './LivingGardenAtmosphere'
import { LivingGardenSpotlight } from './LivingGardenSpotlight'
import {
  Sky,
  Treeline,
  Ground,
  PathLayer,
  GroundDetail,
  Motes,
  Vignette,
} from './LivingGardenLayers'
import { LivingGardenBed } from './LivingGardenBed'
import { LivingGardenJourneyTree } from './LivingGardenJourneyTree'
import { LivingGardenArbor } from './LivingGardenArbor'
import { useGardenMotion } from './LivingGardenMotion'
import { GreensV2CalibrationBed } from './LivingGardenBedV2Calibration'
import { GreensV3HeroCalibrationBed } from './LivingGardenBedV3HeroCalibration'
import { GreensV4HeroFocusCalibrationBed } from './LivingGardenBedV4HeroFocusCalibration'
import { GreensV5MergeProofCalibrationBed } from './LivingGardenBedV5MergeProofCalibration'

// ── SVG transform strings (NOT animated G wrapper — react-native-svg
// crashes with "Underflow in restore" when an animated G wrapper
// receives RN transform arrays or interpolated opacity).
// DOCUMENTED EXCEPTION: listener-based state updates.

// ── Bed band ordering (spec §6 z-order) ───────────────────────
// Far band: citrus, orchard (z06)
// Mid band: berries, tropical (z08)
// Near band: herbs, greens, roots (z09)
const FAR_BEDS = ['citrus', 'orchard']
const MID_BEDS = ['berries', 'tropical']
const NEAR_BEDS = ['herbs', 'greens', 'roots']

// ── Tap target bounding boxes (for overlay Pressables) ────────
// Each bed's hit target is sized to its bounding box with 44×44 min.
function getBedHitBox(bedKey) {
  const p = BED_PLACEMENT[bedKey]
  if (!p) return null
  const w = Math.max(p.rx * 2 * p.scale, 44)
  const h = Math.max(p.ry * 2 * p.scale + 30, 44) // include plant height
  return {
    left: p.cx - w / 2,
    top: p.cy - h / 2 - 10,
    width: w,
    height: h,
  }
}

// ── Rainbow Capstone (Phase 1C — direct Animated opacity) ────
// Multi-part temporary capstone treatment when rainbowComplete=true.
// DIRECT Animated.View opacity — NO interpolation, NO per-frame React state.
// rainbowBloom Animated.Value IS the wrapper opacity directly:
//   0 → RAINBOW_PEAK_OPACITY (0.35) → 0
// No interpolate() call. No listener. No setState.
// PROBE MODE: when rainbowProbeActive=true, wrapper opacity is a
// constant 0.50 for static visibility diagnostics (dev-preview only).
function RainbowCapstone({ rainbowBloom, rainbowProbeActive = false }) {
  // If not an Animated.Value (e.g. plain 0 from test), render nothing.
  // In probe mode, we still render even if rainbowBloom is 0/null.
  if (!rainbowProbeActive) {
    if (rainbowBloom == null || rainbowBloom === 0 || typeof rainbowBloom === 'number') {
      return null
    }
  }

  // Direct opacity — the Animated.Value IS the wrapper opacity.
  // No interpolate(). No React state. Native driver handles it.
  // In probe mode, use constant opacity 0.50 for visibility testing.
  const wrapperOpacity = rainbowProbeActive
    ? 0.5
    : rainbowBloom

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          opacity: wrapperOpacity,
          zIndex: 10,
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}>
        {/* Static Rainbow artwork — element multipliers preserved exactly */}
        <Ellipse cx={195} cy={400} rx={180} ry={60} fill={SCENE_PALETTE.goldPale} opacity={0.5} />
        <Path
          d="M 40 620 Q 195 600 350 620"
          stroke={SCENE_PALETTE.gold}
          strokeWidth="2"
          fill="none"
          opacity={0.6}
          strokeLinecap="round"
        />
        <Circle cx={196} cy={250} r={50} fill={SCENE_PALETTE.goldPale} opacity={0.4} />
        <Ellipse cx={195} cy={360} rx={140} ry={100} fill={SCENE_PALETTE.goldPale} opacity={0.3} />
      </Svg>
    </Animated.View>
  )
}

// ── Scene component ───────────────────────────────────────────
function LivingGardenSceneComponent({
  bedStages, // { greens: { key, label, ... }, ... } from getBedStages
  journeyStageKey, // string from existing Glow Journey
  arborCtx, // { unlockedAchievementIds, bedStages, rainbowComplete }
  isReduced = false,
  onBedPress = null, // (bedKey) => void
  onTreePress = null, // () => void
  onArborPress = null, // () => void
  sceneId = 'living-garden', // stable SVG ID prefix
  advancements = null, // from detectAdvancements (seen-state architecture)
  onArborDebugValues = null, // QA-only: (values) => void
  onRainbowMotionDebug = null, // QA-only: (values) => void
  motionVariant = null, // QA-only: 'v2-calibration', 'v3-hero', 'v4-hero-focus', 'v5-merge-proof'
  onV2Debug = null, // QA-only: Motion V2 diagnostic callback
  entryToken = 0, // increments on each intentional Garden open → replays wake animation
  onV3Debug = null, // QA-only: Motion V3 HERO diagnostic callback
  onV4Debug = null, // QA-only: Motion V4 HERO FOCUS diagnostic callback
  onV5Debug = null, // QA-only: Motion V5 MERGE PROOF diagnostic callback
  v5HeroScalePreset = 'C', // QA-only: V5 hero scale preset ('B', 'C', 'C+')
  v5ReplayToken = 0, // QA-only: V5 explicit replay trigger token
  // V6 Spotlight presentation-only support
  spotlightActive = false, // when true, hide in-grid spotlight bed (overlay owns the screen)
  spotlightBedKey = null, // which bed is in spotlight (e.g. 'greens', 'roots')
  spotlightTargetStage = null, // when spotlight active, pre-warm in-grid bed to this stage
  rainbowProbeActive = false, // QA-only: static Rainbow visibility probe (constant opacity 0.50)
}) {
  const atmosphere = getAtmosphere(journeyStageKey)
  const wakeOpacity = useRef(new Animated.Value(isReduced ? 1 : 0.55))
  const wakeBrightness = useRef(new Animated.Value(isReduced ? 1 : 0.72))

  // ── Garden motion orchestration (Phase 1C architecture) ───
  // Returns Animated.Value objects for transforms/opacity (no per-frame
  // setState) plus state-bridged values for color/produce (documented
  // exceptions). Reduced Motion: instant canonical (inside hook).
  // AppState background/inactive: resolves to canonical (inside hook).
  const {
    bedAnimRefs,
    bedSoilRefs,
    treeAnimValues,
    arborRevealValue,
    rainbowBloomValue,
    bedColorProgress,
    bedProduceReveal,
    bedDeltaReveal,
    newlyEarnedIds,
  } = useGardenMotion({
    advancements,
    isReduced,
    sceneId,
    onRainbowMotionDebug,
  })

  // ── V6 Spotlight production integration ───────────────────
  // When advancements contain bed advancements, the V6 Spotlight
  // overlay handles bed visualization (not the old per-bed motion).
  // The Scene manages a queue of bed advancements and renders the
  // Spotlight overlay inside sceneCanvas for each advancing bed.
  // External spotlight props (from preview) are merged with internal
  // state so both production and preview paths work.
  //
  // CRITICAL: The queue is computed via useMemo (during render), NOT
  // via useEffect (after render). This eliminates any effect scheduling
  // dependency — the queue is populated IMMEDIATELY when advancements
  // changes, without waiting for an effect to run. The previous
  // useEffect-based approach could fail if the useGardenMotion hook's
  // effect (which runs first) caused state changes that interfered
  // with the queue effect's execution.
  const spotlightQueue = useMemo(() => {
    if (!advancements || advancements.isFirstOpen) return []
    return advancements.bedAdvancements || []
  }, [advancements])

  const [spotlightIdx, setSpotlightIdx] = useState(-1)
  const [spotlightReplayToken, setSpotlightReplayToken] = useState(0)

  // Reset spotlightIdx when the queue changes (new advancement arrived)
  useEffect(() => {
    if (spotlightQueue.length > 0) {
      setSpotlightIdx(0)
      setSpotlightReplayToken((t) => t + 1)
    } else {
      setSpotlightIdx(-1)
    }
  }, [spotlightQueue])

  const handleSpotlightComplete = useCallback(() => {
    setSpotlightIdx((prev) => {
      const next = prev + 1
      if (next >= spotlightQueue.length) {
        return -1
      }
      setSpotlightReplayToken((t) => t + 1)
      return next
    })
  }, [spotlightQueue.length])

  // Internal spotlight state (from advancement queue)
  const internalSpotlightActive = spotlightIdx >= 0 && spotlightIdx < spotlightQueue.length
  const internalSpotlightBed = internalSpotlightActive ? spotlightQueue[spotlightIdx]?.bedKey : null
  const internalSpotlightTarget = internalSpotlightActive ? spotlightQueue[spotlightIdx]?.toStage : null
  const internalSpotlightSource = internalSpotlightActive ? spotlightQueue[spotlightIdx]?.fromStage : null

  // Merge internal (production) and external (preview) spotlight state
  const effectiveSpotlightActive = internalSpotlightActive || spotlightActive
  const effectiveSpotlightBedKey = internalSpotlightActive ? internalSpotlightBed : spotlightBedKey
  const effectiveSpotlightTargetStage = internalSpotlightActive ? internalSpotlightTarget : spotlightTargetStage

  // ── Build per-bed motion payload ───────────────────────────
  // Combines Animated.Value objects (transforms, no setState) with
  // state-bridged values (color/produce/delta, documented exceptions).
  const buildBedMotion = useCallback(
    (bedKey) => {
      const animValues = bedAnimRefs[bedKey]
      const soilScale = bedSoilRefs[bedKey]
      if (!animValues) return null
      return {
        animValues,
        soilScale,
        colorProgress: bedColorProgress[bedKey] != null ? bedColorProgress[bedKey] : 1,
        produceReveal: bedProduceReveal[bedKey] != null ? bedProduceReveal[bedKey] : 1,
        deltaReveal: bedDeltaReveal[bedKey] != null ? bedDeltaReveal[bedKey] : 1,
      }
    },
    [bedAnimRefs, bedSoilRefs, bedColorProgress, bedProduceReveal, bedDeltaReveal],
  )

  // ── Wake animation (unconditional, no date input) ───────────
  // Replays on each intentional Garden entry (entryToken change),
  // resetting to the initial animation frame before animating into
  // the current persisted Garden state. Presentation-only.
  useEffect(() => {
    if (isReduced) {
      wakeOpacity.current.setValue(1)
      wakeBrightness.current.setValue(1)
      return
    }
    // Reset to initial frame on each replay
    wakeOpacity.current.setValue(0.55)
    wakeBrightness.current.setValue(0.72)
    // Phase 1C: both use useNativeDriver: false because the Animated.View
    // wraps SVG content with AnimatedG children. Using useNativeDriver: true
    // on opacity moves the animated node to native, which then conflicts
    // with JS-driven SVG animations (animated G wrapper).
    const opacityAnim = Animated.timing(wakeOpacity.current, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    })
    const brightnessAnim = Animated.timing(wakeBrightness.current, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    })
    opacityAnim.start()
    brightnessAnim.start()
    return () => {
      opacityAnim.stop()
      brightnessAnim.stop()
    }
  }, [isReduced, entryToken])

  // ── Scene SVG ───────────────────────────────────────────────
  const sceneSvg = (
    <Svg
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
      viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      accessibilityLabel="Your Living RawLife Garden"
      accessibilityRole="image"
    >
      {/* z00 Sky gradient + horizon glow */}
      <Sky atmosphere={atmosphere} isReduced={isReduced} sceneId={sceneId} />
      {/* z01 Distant treeline */}
      <Treeline sceneId={sceneId} />
      {/* z02 Ground plane + dapple pools */}
      <Ground atmosphere={atmosphere} sceneId={sceneId} />
      {/* z03 Journey Tree (behind everything) */}
      <LivingGardenJourneyTree
        journeyStageKey={journeyStageKey}
        fromStage={advancements?.journeyAdvancement?.fromStage || null}
        transitionId={advancements || null}
        atmosphere={atmosphere}
        isReduced={isReduced}
        sceneId={sceneId}
        treeMotion={treeAnimValues}
      />
      {/* z04 Path */}
      <PathLayer sceneId={sceneId} />
      {/* z05 Ground detail — grass tufts, stepping stones */}
      <GroundDetail sceneId={sceneId} />
      {/* z06 Far beds — Citrus, Orchard */}
      {FAR_BEDS.map((bedKey) => (
        <LivingGardenBed
          key={`bed-${bedKey}`}
          bedKey={bedKey}
          stageKey={bedStages?.[bedKey]?.key || 'empty'}
          sceneId={sceneId}
          bedMotion={buildBedMotion(bedKey)}
        />
      ))}
      {/* z07 Milestone Arbor */}
      <LivingGardenArbor
        ctx={arborCtx}
        sceneId={sceneId}
        newlyEarnedIds={newlyEarnedIds}
        arborReveal={arborRevealValue}
        advancementMilestoneIds={advancements?.newMilestoneIds || null}
        advancementId={advancements || null}
        isReduced={isReduced}
        onDebugValues={onArborDebugValues}
      />
      {/* z08 Mid beds — Berries, Tropical */}
      {MID_BEDS.map((bedKey) => (
        <LivingGardenBed
          key={`bed-${bedKey}`}
          bedKey={bedKey}
          stageKey={bedStages?.[bedKey]?.key || 'empty'}
          sceneId={sceneId}
          bedMotion={buildBedMotion(bedKey)}
        />
      ))}
      {/* z09 Near beds — Herbs, Greens, Roots */}
      {NEAR_BEDS.map((bedKey) => {
        // Motion V5 MERGE PROOF: skip Greens here — rendered as Hero layer below
        if (bedKey === 'greens' && motionVariant === 'v5-merge-proof') {
          return null
        }
        // Motion V4 HERO FOCUS: skip Greens here — rendered as Hero layer below
        // (above all other beds in z-order for magnification to extend over neighbors)
        if (bedKey === 'greens' && motionVariant === 'v4-hero-focus') {
          return null
        }
        // Motion V3 HERO calibration: replace Greens bed with V3 prototype
        if (bedKey === 'greens' && motionVariant === 'v3-hero') {
          return (
            <GreensV3HeroCalibrationBed
              key={`bed-${bedKey}`}
              bedKey={bedKey}
              stageKey={bedStages?.[bedKey]?.key || 'empty'}
              sceneId={sceneId}
              advancements={advancements}
              isReduced={isReduced}
              onV3Debug={onV3Debug}
            />
          )
        }
        // Motion V2 calibration: replace Greens bed with V2 prototype
        if (bedKey === 'greens' && motionVariant === 'v2-calibration') {
          return (
            <GreensV2CalibrationBed
              key={`bed-${bedKey}`}
              bedKey={bedKey}
              stageKey={bedStages?.[bedKey]?.key || 'empty'}
              sceneId={sceneId}
              advancements={advancements}
              isReduced={isReduced}
              onV2Debug={onV2Debug}
            />
          )
        }
        // V6 Spotlight: hide in-grid spotlight bed (overlay owns the screen).
        // Keep cell mounted so layout does not change. Pre-warm to target stage.
        if (bedKey === effectiveSpotlightBedKey && effectiveSpotlightActive) {
          return (
            <G key={`bed-${bedKey}`} opacity="0">
              <LivingGardenBed
                bedKey={bedKey}
                stageKey={effectiveSpotlightTargetStage || bedStages?.[bedKey]?.key || 'empty'}
                sceneId={sceneId}
                bedMotion={buildBedMotion(bedKey)}
              />
            </G>
          )
        }
        return (
          <LivingGardenBed
            key={`bed-${bedKey}`}
            bedKey={bedKey}
            stageKey={bedStages?.[bedKey]?.key || 'empty'}
            sceneId={sceneId}
            bedMotion={buildBedMotion(bedKey)}
          />
        )
      })}
      {/* z09b V4 HERO FOCUS layer — Greens rendered ABOVE all other beds */}
      {/* for anchored magnification to extend beyond its cell without clipping */}
      {motionVariant === 'v4-hero-focus' && (
        <GreensV4HeroFocusCalibrationBed
          key="bed-greens-v4-hero"
          bedKey="greens"
          stageKey={bedStages?.greens?.key || 'empty'}
          sceneId={sceneId}
          advancements={advancements}
          isReduced={isReduced}
          onV4Debug={onV4Debug}
        />
      )}
      {/* z09c V5 MERGE PROOF layer — Greens rendered ABOVE all other beds */}
      {/* Hero presentation layer with convergence + crossfade merge */}
      {motionVariant === 'v5-merge-proof' && (
        <GreensV5MergeProofCalibrationBed
          key="bed-greens-v5-merge"
          bedKey="greens"
          stageKey={bedStages?.greens?.key || 'empty'}
          sceneId={sceneId}
          advancements={advancements}
          isReduced={isReduced}
          heroScalePreset={v5HeroScalePreset}
          onV5Debug={onV5Debug}
          replayToken={v5ReplayToken}
        />
      )}
      {/* z10 Ambient motes (Journey-driven, hue-sampled from mature beds) */}
      <Motes
        atmosphere={atmosphere}
        isReduced={isReduced}
        sceneId={sceneId}
        bedStages={bedStages}
        journeyStageKey={journeyStageKey}
      />
      {/* z10b Rainbow capstone — MOVED outside SVG to Animated.View overlay */}
      {/* (was inside SVG with listener-based opacity; now direct Animated.View) */}
      {/* z11 Vignette */}
      <Vignette sceneId={sceneId} />
    </Svg>
  )

  // ── UI overlay — React Native views above SVG (spec §22) ────
  // Hit targets are absolutely positioned Pressable views.
  const allBeds = [...FAR_BEDS, ...MID_BEDS, ...NEAR_BEDS]

  return (
    <View style={styles.container}>
      {/* Canonical 390×720 scene container — SVG + Rainbow overlay share this space */}
      <View style={styles.sceneCanvas}>
        <Animated.View
          style={{
            opacity: wakeOpacity.current,
            transform: [{ scale: wakeBrightness.current }],
          }}
        >
          {sceneSvg}
        </Animated.View>

        {/* z10b Rainbow capstone — Animated.View overlay (direct opacity) */}
        {/* Rendered AFTER SVG sibling to ensure correct paint order */}
        <RainbowCapstone
          rainbowBloom={rainbowBloomValue}
          rainbowProbeActive={rainbowProbeActive}
        />

        {/* z10c V6 Spotlight overlay — production bed advancement presentation */}
        {/* Rendered AFTER SVG and Rainbow to ensure correct paint order */}
        {internalSpotlightActive && (
          <LivingGardenSpotlight
            bedKey={internalSpotlightBed}
            sourceStage={internalSpotlightSource}
            targetStage={internalSpotlightTarget}
            isReduced={isReduced}
            replayToken={spotlightReplayToken}
            sceneId={`${sceneId}-spotlight`}
            onComplete={handleSpotlightComplete}
            availableWidth={SCENE_WIDTH}
            availableHeight={SCENE_HEIGHT}
          />
        )}
      </View>

      {/* Tap overlay — beds */}
      {allBeds.map((bedKey) => {
        if (!onBedPress) return null
        const box = getBedHitBox(bedKey)
        if (!box) return null
        const stage = bedStages?.[bedKey]
        const stageLabel = stage ? stage.label : 'Empty'
        return (
          <Pressable
            key={`hit-${bedKey}`}
            onPress={() => onBedPress(bedKey)}
            accessibilityLabel={`${bedKey}, ${stageLabel}. Opens details.`}
            accessibilityRole="button"
            style={[
              styles.hitTarget,
              {
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
              },
            ]}
          />
        )
      })}

      {/* Tap overlay — Journey Tree */}
      {onTreePress && (
        <Pressable
          onPress={onTreePress}
          accessibilityLabel="Journey Tree. Opens details."
          accessibilityRole="button"
          style={[styles.hitTarget, styles.treeHit]}
        />
      )}

      {/* Tap overlay — Arbor */}
      {onArborPress && (
        <Pressable
          onPress={onArborPress}
          accessibilityLabel="Milestone Arbor. Opens details."
          accessibilityRole="button"
          style={[styles.hitTarget, styles.arborHit]}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneCanvas: {
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  hitTarget: {
    position: 'absolute',
    // Transparent hit area — sized per bed bounding box
  },
  treeHit: {
    left: 150,
    top: 200,
    width: 92,
    height: 150,
  },
  arborHit: {
    left: 120,
    top: 250,
    width: 152,
    height: 170,
  },
})

function sceneComparator(prev, next) {
  // Re-render only when meaningful props change
  return (
    prev.isReduced === next.isReduced &&
    prev.journeyStageKey === next.journeyStageKey &&
    prev.sceneId === next.sceneId &&
    prev.arborCtx === next.arborCtx &&
    prev.bedStages === next.bedStages &&
    prev.advancements === next.advancements &&
    prev.onArborDebugValues === next.onArborDebugValues &&
    prev.onRainbowMotionDebug === next.onRainbowMotionDebug &&
    prev.spotlightActive === next.spotlightActive &&
    prev.spotlightBedKey === next.spotlightBedKey &&
    prev.spotlightTargetStage === next.spotlightTargetStage &&
    prev.rainbowProbeActive === next.rainbowProbeActive &&
    prev.entryToken === next.entryToken
  )
}

export const LivingGardenScene = memo(LivingGardenSceneComponent, sceneComparator)

export default LivingGardenScene
