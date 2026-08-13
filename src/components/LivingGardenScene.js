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

import React, { memo, useEffect, useRef } from 'react'
import { Animated, View, Pressable, StyleSheet } from 'react-native'
import Svg from 'react-native-svg'
import { SCENE_WIDTH, SCENE_HEIGHT, BED_PLACEMENT } from './LivingGardenGeometry'
import { getAtmosphere } from './LivingGardenAtmosphere'
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
}) {
  const atmosphere = getAtmosphere(journeyStageKey)
  const wakeOpacity = useRef(new Animated.Value(isReduced ? 1 : 0.55))
  const wakeBrightness = useRef(new Animated.Value(isReduced ? 1 : 0.72))

  // ── Wake animation (unconditional, no date input) ───────────
  useEffect(() => {
    if (isReduced) {
      wakeOpacity.current.setValue(1)
      wakeBrightness.current.setValue(1)
      return
    }
    const opacityAnim = Animated.timing(wakeOpacity.current, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
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
  }, [isReduced])

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
        atmosphere={atmosphere}
        isReduced={isReduced}
        sceneId={sceneId}
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
        />
      ))}
      {/* z07 Milestone Arbor */}
      <LivingGardenArbor ctx={arborCtx} sceneId={sceneId} />
      {/* z08 Mid beds — Berries, Tropical */}
      {MID_BEDS.map((bedKey) => (
        <LivingGardenBed
          key={`bed-${bedKey}`}
          bedKey={bedKey}
          stageKey={bedStages?.[bedKey]?.key || 'empty'}
          sceneId={sceneId}
        />
      ))}
      {/* z09 Near beds — Herbs, Greens, Roots */}
      {NEAR_BEDS.map((bedKey) => (
        <LivingGardenBed
          key={`bed-${bedKey}`}
          bedKey={bedKey}
          stageKey={bedStages?.[bedKey]?.key || 'empty'}
          sceneId={sceneId}
        />
      ))}
      {/* z10 Ambient motes (Journey-driven, hue-sampled from mature beds) */}
      <Motes
        atmosphere={atmosphere}
        isReduced={isReduced}
        sceneId={sceneId}
        bedStages={bedStages}
        journeyStageKey={journeyStageKey}
      />
      {/* z11 Vignette */}
      <Vignette sceneId={sceneId} />
    </Svg>
  )

  // ── UI overlay — React Native views above SVG (spec §22) ────
  // Hit targets are absolutely positioned Pressable views.
  const allBeds = [...FAR_BEDS, ...MID_BEDS, ...NEAR_BEDS]

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: wakeOpacity.current,
          transform: [{ scale: wakeBrightness.current }],
        }}
      >
        {sceneSvg}
      </Animated.View>

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
    prev.bedStages === next.bedStages
  )
}

export const LivingGardenScene = memo(LivingGardenSceneComponent, sceneComparator)

export default LivingGardenScene
