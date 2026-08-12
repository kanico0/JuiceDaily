// ─────────────────────────────────────────────────────────────
// MilestoneArborArtwork.js — Permanent achievement structure
// rendered as a wooden trellis with variable ornament slots.
//
// FINAL handoff 03_tree_and_arbor_addendum.md §3:
//   - Visual frame + ornament-tier system + slot mechanic
//   - Variable number of slots (not hardcoded count)
//   - Unearned slots = generic empty peg marks (always)
//   - No preview of eventual ornament icon in unearned slots
//   - Four ornament tiers: leaf, blossom, fruit, medallion
//   - "X earned so far" (open-ended, no fixed denominator)
//
// The 12-slot v1 launch catalog (from implementation spec §8):
//   1. first_juice        — LEAF       — existing achievement
//   2. streak_3           — BLOSSOM    — existing achievement
//   3. streak_7           — FRUIT      — existing achievement
//   4. logs_10            — MEDALLION  — existing achievement
//   5-11. *_flourishing   — FRUIT      — existing bed stage = Flourishing
//   12. rainbow_harvest   — MEDALLION  — existing isRainbowHarvestComplete
//
// Qualification reads ONLY existing state. No new thresholds.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import Svg, { G, Path, Circle, Line, Ellipse, Polygon } from 'react-native-svg'
import { GLOW_JOURNEY_PALETTE } from './GlowJourneyVisualState'

// ── Ornament tier keys ───────────────────────────────────────
export const ORNAMENT_TIERS = {
  LEAF: 'leaf',
  BLOSSOM: 'blossom',
  FRUIT: 'fruit',
  MEDALLION: 'medallion',
}

// ── v1 Launch catalog (12 slots) ─────────────────────────────
// Each entry has: id, tier, and a qualification function that
// reads ONLY existing state passed in via the `ctx` prop.
// ctx shape: {
//   unlockedAchievementIds: string[],   // from achievements.js
//   bedStages: { [bedKey]: { key, label, threshold } },  // from gardenService
//   rainbowComplete: boolean,           // from gardenService
// }
export const ARBOR_CATALOG = [
  { id: 'first_juice', tier: ORNAMENT_TIERS.LEAF, label: 'First Juice', qualifies: (ctx) => ctx.unlockedAchievementIds.includes('first_juice') },
  { id: 'streak_3', tier: ORNAMENT_TIERS.BLOSSOM, label: '3-Day Streak', qualifies: (ctx) => ctx.unlockedAchievementIds.includes('streak_3') },
  { id: 'streak_7', tier: ORNAMENT_TIERS.FRUIT, label: '7-Day Streak', qualifies: (ctx) => ctx.unlockedAchievementIds.includes('streak_7') },
  { id: 'logs_10', tier: ORNAMENT_TIERS.MEDALLION, label: '10 Juices', qualifies: (ctx) => ctx.unlockedAchievementIds.includes('logs_10') },
  { id: 'greens_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Greens Flourishing', qualifies: (ctx) => ctx.bedStages?.greens?.key === 'flourishing' },
  { id: 'roots_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Roots Flourishing', qualifies: (ctx) => ctx.bedStages?.roots?.key === 'flourishing' },
  { id: 'citrus_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Citrus Flourishing', qualifies: (ctx) => ctx.bedStages?.citrus?.key === 'flourishing' },
  { id: 'orchard_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Orchard Flourishing', qualifies: (ctx) => ctx.bedStages?.orchard?.key === 'flourishing' },
  { id: 'berries_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Berries Flourishing', qualifies: (ctx) => ctx.bedStages?.berries?.key === 'flourishing' },
  { id: 'tropical_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Tropical Flourishing', qualifies: (ctx) => ctx.bedStages?.tropical?.key === 'flourishing' },
  { id: 'herbs_flourishing', tier: ORNAMENT_TIERS.FRUIT, label: 'Herbs Flourishing', qualifies: (ctx) => ctx.bedStages?.herbs?.key === 'flourishing' },
  { id: 'rainbow_harvest', tier: ORNAMENT_TIERS.MEDALLION, label: 'Rainbow Harvest', qualifies: (ctx) => ctx.rainbowComplete === true },
]

// ── Compute earned count from context ────────────────────────
export function getArborEarnedCount(ctx) {
  return ARBOR_CATALOG.filter((entry) => entry.qualifies(ctx)).length
}

// ── Compute slot states from context ─────────────────────────
export function getArborSlotStates(ctx) {
  return ARBOR_CATALOG.map((entry) => ({
    id: entry.id,
    tier: entry.tier,
    label: entry.label,
    earned: entry.qualifies(ctx),
  }))
}

// ── Ornament shapes ──────────────────────────────────────────
const PEG_STROKE = '#5C4632'

function LeafOrnament({ cx, cy, color }) {
  return (
    <G id="arbor_ornament_leaf">
      <Path d={`M ${cx},${cy + 8} Q ${cx - 8},${cy + 4} ${cx - 8},${cy - 2} Q ${cx - 4},${cy - 8} ${cx},${cy - 8} Q ${cx + 4},${cy - 8} ${cx + 8},${cy - 2} Q ${cx + 8},${cy + 4} ${cx},${cy + 8} Z`}
          fill={color} opacity="0.9" />
      <Path d={`M ${cx},${cy + 6} Q ${cx},${cy} ${cx},${cy - 6}`} stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="0.8" fill="none" />
    </G>
  )
}

function BlossomOrnament({ cx, cy, color }) {
  const petals = [0, 72, 144, 216, 288]
  return (
    <G id="arbor_ornament_blossom">
      {petals.map((angle) => (
        <Circle key={`petal_${angle}`} cx={cx + Math.cos((angle - 90) * Math.PI / 180) * 5} cy={cy + Math.sin((angle - 90) * Math.PI / 180) * 5} r="3"
                fill={color} opacity="0.85" />
      ))}
      <Circle cx={cx} cy={cy} r="2" fill="#F2C14E" opacity="0.9" />
    </G>
  )
}

function FruitOrnament({ cx, cy, color }) {
  return (
    <G id="arbor_ornament_fruit">
      <Circle cx={cx} cy={cy} r="6" fill={color} opacity="0.9" />
      <Circle cx={cx} cy={cy} r="6" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      {/* Highlight */}
      <Circle cx={cx - 2} cy={cy - 2} r="1.5" fill="#FFFFFF" opacity="0.15" />
    </G>
  )
}

function MedallionOrnament({ cx, cy, color }) {
  const goldTrim = GLOW_JOURNEY_PALETTE.stageGoldTrim
  return (
    <G id="arbor_ornament_medallion">
      {/* Gold ring */}
      <Circle cx={cx} cy={cy} r="8" fill="none" stroke={goldTrim} strokeWidth="1.5" opacity="0.85" />
      {/* Inner circle */}
      <Circle cx={cx} cy={cy} r="5" fill={color} opacity="0.9" />
      <Circle cx={cx} cy={cy} r="5" fill="none" stroke={goldTrim} strokeWidth="0.8" opacity="0.6" />
      {/* Center accent */}
      <Circle cx={cx} cy={cy} r="2" fill={goldTrim} opacity="0.8" />
    </G>
  )
}

function EmptyPeg({ cx, cy }) {
  // Correction addendum §2.2: empty pegs should be small, faint, hollow.
  return (
    <G id="arbor_slot_empty">
      <Circle cx={cx} cy={cy} r="2.5" fill="none" stroke={PEG_STROKE} strokeWidth="0.8" opacity="0.35" />
    </G>
  )
}

const ORNAMENT_RENDERERS = {
  leaf: LeafOrnament,
  blossom: BlossomOrnament,
  fruit: FruitOrnament,
  medallion: MedallionOrnament,
}

// ── Ornament colors by tier ──────────────────────────────────
const TIER_COLORS = {
  leaf: GLOW_JOURNEY_PALETTE.juiceLiquidTopBand,
  blossom: '#F3D6DC',
  fruit: GLOW_JOURNEY_PALETTE.juiceLiquidBase,
  medallion: GLOW_JOURNEY_PALETTE.stageGoldTrim,
}

// ── Main Arbor component ─────────────────────────────────────
function MilestoneArborArtwork({ ctx, size = 118 }) {
  const slotStates = useMemo(() => getArborSlotStates(ctx), [ctx])
  const earnedCount = useMemo(() => getArborEarnedCount(ctx), [ctx])

  // Correction addendum §2.2: arrange ornaments along the frame/crossbeam
  // rather than as a rigid interior grid. Two crossbeams with ornaments
  // hanging from each, reading architecturally (things hanging on a trellis).
  // 12 slots: 6 hanging from upper beam, 6 hanging from lower beam.
  const upperY = 28
  const lowerY = 62
  const leftX = 16
  const rightX = 84
  const span = rightX - leftX
  const slotPositions = slotStates.map((_, i) => {
    const onUpper = i < 6
    const idx = onUpper ? i : i - 6
    const cx = leftX + (span / 5) * idx
    const cy = onUpper ? upperY : lowerY
    return { cx, cy }
  })

  const frameColor = '#7A5B44'
  const goldTrim = GLOW_JOURNEY_PALETTE.stageGoldTrim

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100"
         accessibilityLabel={`Milestone Arbor: ${earnedCount} earned so far`}>
      <G id="arbor_container">
        {/* Arbor frame — two posts and two crossbeams */}
        <G id="arbor_frame">
          {/* Left post */}
          <Line x1="10" y1="15" x2="10" y2="88" stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
          {/* Right post */}
          <Line x1="90" y1="15" x2="90" y2="88" stroke={frameColor} strokeWidth="3" strokeLinecap="round" />
          {/* Upper crossbeam */}
          <Line x1="10" y1="22" x2="90" y2="22" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Lower crossbeam */}
          <Line x1="10" y1="56" x2="90" y2="56" stroke={frameColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Lower rail */}
          <Line x1="10" y1="85" x2="90" y2="85" stroke={frameColor} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          {/* Decorative top caps */}
          <Circle cx="10" cy="15" r="2" fill={frameColor} opacity="0.8" />
          <Circle cx="90" cy="15" r="2" fill={frameColor} opacity="0.8" />
        </G>

        {/* Slots — ornaments hanging from crossbeams */}
        {slotStates.map((slot, i) => {
          const pos = slotPositions[i]
          const OrnamentRenderer = ORNAMENT_RENDERERS[slot.tier]
          const ornamentColor = TIER_COLORS[slot.tier]
          return (
            <G key={slot.id} id={`arbor_slot_${String(i + 1).padStart(2, '0')}`}>
              {/* Small hanger line from beam to ornament */}
              <Line x1={pos.cx} y1={pos.cy - 6} x2={pos.cx} y2={pos.cy - 2}
                    stroke={frameColor} strokeWidth="0.6" opacity="0.5" />
              {slot.earned && OrnamentRenderer ? (
                <OrnamentRenderer cx={pos.cx} cy={pos.cy} color={ornamentColor} />
              ) : (
                <EmptyPeg cx={pos.cx} cy={pos.cy} />
              )}
            </G>
          )
        })}

        {/* Subtle gold border accent for permanent structure */}
        <G id="arbor_gold_accent" opacity="0.3">
          <Line x1="8" y1="13" x2="92" y2="13" stroke={goldTrim} strokeWidth="0.8" opacity="0.4" />
        </G>
      </G>
    </Svg>
  )
}

export default MilestoneArborArtwork
