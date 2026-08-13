// ─────────────────────────────────────────────────────────────
// LivingGardenArbor.js — Cedar arch Arbor for the immersive scene
//
// A cedar arch straddling the path (spec §12):
//   posts at x 128 and 264, footing y 410
//   springline y 330, apex y 262
//   two head rails at y 356 and 384 with lattice between
//
// 12 pegs at launch: 7 along the arch curve, 5 along upper rail.
// Slots fill in sorted-ID → sequential peg position order.
//
// Spec §13: Peg assignment without new persistence:
//   peg index = stable hash of achievement id, modulo slot count,
//   with linear probing on collision.
//
// Implementation uses SORTED STABLE MILESTONE ID → SEQUENTIAL PEG
// (simpler, most stable, no reshuffling of original 12 when
// future IDs are added after them).
//
// Reuses ARBOR_CATALOG and qualification truth from the frozen
// MilestoneArborArtwork.js. Does NOT modify it.
//
// Four ornament families (spec §13):
//   leaf (teardrop with midrib)
//   blossom (five petals, gold centre)
//   fruit (round, warm, with highlight)
//   medallion (gold disc, inner ring, highlight)
//
// Vine coverage = earned ÷ slots. Tendrils climb posts, leaves
// appear along the arch. At 100% the arch is fully dressed.
//
// Wing panels (6 further slots each) are future-safe visual
// capacity — not rendered for v1's 12 slots.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, memo } from 'react'
import { G, Path, Ellipse, Circle, Line, Rect } from 'react-native-svg'
import { ARBOR_CATALOG, getArborEarnedCount, ORNAMENT_TIERS } from './MilestoneArborArtwork'
import { ARBOR, SCENE_PALETTE } from './LivingGardenGeometry'

// ── Deterministic peg placement: sorted-ID → sequential slot ──
// Sort the catalog IDs lexicographically, then assign pegs 0..n-1.
// This is stable across launches, reinstalls, and devices.
// Adding a new ID only affects slots at or after its sorted position.
function computePegAssignment(catalog) {
  const sorted = [...catalog].sort((a, b) => a.id.localeCompare(b.id))
  return sorted.map((entry, index) => ({
    ...entry,
    pegIndex: index,
  }))
}

// ── Peg positions on the arch and upper rail ──────────────────
// 12 slots: 7 along the arch curve, 5 along the upper head rail.
function computePegPositions() {
  const positions = []
  const { postLeftX, postRightX, footingY, springlineY, apexY, headRailUpperY } = ARBOR
  const archSpan = postRightX - postLeftX

  // 7 pegs along the arch curve (parabolic from springline to apex)
  for (let i = 0; i < 7; i++) {
    const t = i / 6 // 0 to 1
    const x = postLeftX + archSpan * t
    // Parabolic arch: y = springline at edges, apex at centre
    const y = springlineY - (springlineY - apexY) * (1 - Math.pow(2 * t - 1, 2))
    positions.push({ cx: x, cy: y, onArch: true })
  }

  // 5 pegs along the upper head rail
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6 // evenly spaced, not at edges
    const x = postLeftX + archSpan * t
    const y = headRailUpperY
    positions.push({ cx: x, cy: y, onArch: false })
  }

  return positions
}

const PEG_POSITIONS = computePegPositions()

// ── Ornament renderers ────────────────────────────────────────
function LeafOrnament({ cx, cy, color }) {
  return (
    <G>
      {/* Cord from peg */}
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity="0.8"
      />
      {/* Teardrop leaf with midrib */}
      <Path
        d={`M ${cx} ${cy} C ${cx + 4} ${cy + 1}, ${cx + 6} ${cy + 5}, ${cx} ${cy + 9} C ${cx - 6} ${cy + 5}, ${cx - 4} ${cy + 1}, ${cx} ${cy} Z`}
        fill={color}
      />
      <Path
        d={`M ${cx} ${cy + 1} L ${cx} ${cy + 8}`}
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="0.5"
        opacity="0.7"
      />
    </G>
  )
}

function BlossomOrnament({ cx, cy, color }) {
  return (
    <G>
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity="0.8"
      />
      {/* Five petals */}
      <G transform={`translate(${cx} ${cy + 5})`}>
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity="0.92" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity="0.92" transform="rotate(72)" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity="0.92" transform="rotate(144)" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity="0.92" transform="rotate(216)" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity="0.92" transform="rotate(288)" />
        {/* Gold centre */}
        <Circle r="1.5" fill={SCENE_PALETTE.gold} />
      </G>
    </G>
  )
}

function FruitOrnament({ cx, cy, color }) {
  return (
    <G>
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity="0.8"
      />
      {/* Round fruit with highlight */}
      <Circle cx={cx} cy={cy + 5} r="3" fill={color} />
      <Circle cx={cx - 1} cy={cy + 4} r="1" fill={SCENE_PALETTE.goldPale} opacity="0.5" />
      {/* Stem */}
      <Path
        d={`M ${cx} ${cy + 2} L ${cx + 1} ${cy}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="0.5"
      />
    </G>
  )
}

function MedallionOrnament({ cx, cy, color }) {
  return (
    <G>
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity="0.8"
      />
      {/* Gold disc with inner ring and highlight */}
      <Circle cx={cx} cy={cy + 5} r="3.5" fill={SCENE_PALETTE.gold} />
      <Circle
        cx={cx}
        cy={cy + 5}
        r="2.2"
        fill="none"
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="0.5"
        opacity="0.8"
      />
      <Circle cx={cx - 1} cy={cy + 4} r="1" fill={SCENE_PALETTE.goldPale} opacity="0.6" />
    </G>
  )
}

const ORNAMENT_RENDERERS = {
  [ORNAMENT_TIERS.LEAF]: LeafOrnament,
  [ORNAMENT_TIERS.BLOSSOM]: BlossomOrnament,
  [ORNAMENT_TIERS.FRUIT]: FruitOrnament,
  [ORNAMENT_TIERS.MEDALLION]: MedallionOrnament,
}

const ORNAMENT_COLORS = {
  [ORNAMENT_TIERS.LEAF]: '#54AA71',
  [ORNAMENT_TIERS.BLOSSOM]: '#F3E3D2',
  [ORNAMENT_TIERS.FRUIT]: '#E8574C',
  [ORNAMENT_TIERS.MEDALLION]: SCENE_PALETTE.gold,
}

// ── Earned-color ramp (spec §5) ───────────────────────────────
// t = min(1, n / 12)
// saturation = 0.55 + 0.45 * t
// alpha = 0.55 + 0.45 * t
// bloom = t (radial halo, radius 9 + 7*t, opacity 0.10 * t)
//
// Ornament hue rotation (slot order):
// #D9453F, #F2D24B, blossom #FFF6E8, #C42847, #E8843A,
// #8FD46B, #F0728A, blossom #FFF6E8, #D9453F, #7FD6A2, #E85C4A, #F2A03D
//
// Anti-Christmas-lights guardrails:
// - bloom opacity <= 0.10
// - ornament radius fixed at 7.5px
// - blossom slots stay achromatic white
// - no twinkle, no pulse, no ornament animation
const ORNAMENT_HUE_ROTATION = [
  '#D9453F',
  '#F2D24B',
  '#FFF6E8',
  '#C42847',
  '#E8843A',
  '#8FD46B',
  '#F0728A',
  '#FFF6E8',
  '#D9453F',
  '#7FD6A2',
  '#E85C4A',
  '#F2A03D',
]

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

const ACHROMATIC_NEUTRAL = '#6E8A72'

function arborRamp(earnedCount) {
  const n = Math.max(0, Math.min(12, earnedCount))
  const t = Math.min(1, n / 12)
  return {
    t,
    saturation: 0.55 + 0.45 * t,
    alpha: 0.55 + 0.45 * t,
    bloom: t,
    bloomRadius: 9 + 7 * t,
    bloomOpacity: 0.1 * t,
  }
}

// Get the hue-rotated color for an earned ornament at a given peg index
function getOrnamentHue(pegIndex, saturation) {
  const hue = ORNAMENT_HUE_ROTATION[pegIndex % 12] || '#D9453F'
  // Blossom slots (index 2 and 7) stay achromatic white
  if (pegIndex % 12 === 2 || pegIndex % 12 === 7) return hue
  // Apply saturation: mix toward achromatic neutral
  return mixHex(ACHROMATIC_NEUTRAL, hue, saturation)
}

// ── Empty peg (spec §13) ──────────────────────────────────────
// Hollow ring, 2pt radius, timber-highlight stroke at 60%.
// Generic. Identical for every unearned slot.
function EmptyPeg({ cx, cy }) {
  return (
    <Circle
      cx={cx}
      cy={cy}
      r="2"
      fill="none"
      stroke={SCENE_PALETTE.timberLight}
      strokeWidth="0.8"
      opacity="0.6"
    />
  )
}

// ── Vine coverage (spec §13) ──────────────────────────────────
// Coverage = earned ÷ slots. Tendrils climb posts, leaves along arch.
function VineCoverage({ earnedCount, totalSlots, sceneId }) {
  const ratio = Math.min(earnedCount / totalSlots, 1)
  if (ratio <= 0) return null

  const { postLeftX, postRightX, footingY, springlineY, apexY } = ARBOR

  // Tendrils on posts — height proportional to coverage
  const tendrilHeight = (footingY - springlineY) * ratio
  const leftTendrilTop = footingY - tendrilHeight
  const rightTendrilTop = footingY - tendrilHeight

  // Leaves along arch — count proportional to coverage
  const leafCount = Math.round(7 * ratio)
  const archLeaves = []
  for (let i = 0; i < leafCount; i++) {
    const t = (i + 0.5) / 7
    const x = postLeftX + (postRightX - postLeftX) * t
    const y = springlineY - (springlineY - apexY) * (1 - Math.pow(2 * t - 1, 2))
    archLeaves.push(
      <Ellipse
        key={`vine-leaf-${i}`}
        cx={x}
        cy={y - 3}
        rx="2.5"
        ry="1.5"
        fill="#3F8F5C"
        opacity="0.7"
        transform={`rotate(${(t - 0.5) * 40} ${x} ${y - 3})`}
      />,
    )
  }

  return (
    <G>
      {/* Left post tendril */}
      <Path
        d={`M ${postLeftX} ${footingY} C ${postLeftX - 4} ${leftTendrilTop + 20}, ${postLeftX + 4} ${leftTendrilTop + 10}, ${postLeftX} ${leftTendrilTop}`}
        stroke="#3F8F5C"
        strokeWidth="1.2"
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
      />
      {/* Right post tendril */}
      <Path
        d={`M ${postRightX} ${footingY} C ${postRightX + 4} ${rightTendrilTop + 20}, ${postRightX - 4} ${rightTendrilTop + 10}, ${postRightX} ${rightTendrilTop}`}
        stroke="#3F8F5C"
        strokeWidth="1.2"
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
      />
      {archLeaves}
    </G>
  )
}

// ── Ornament bloom halo (spec §5) ─────────────────────────────
// Radial halo behind earned ornaments. Bloom opacity <= 0.10.
function OrnamentBloom({ cx, cy, radius, opacity, hue }) {
  if (opacity <= 0) return null
  return <Circle cx={cx} cy={cy + 5} r={radius} fill={hue} opacity={opacity} />
}

// ── Gold thread arc at 9+ ornaments (spec §5) ─────────────────
function GoldThreadArc({ earnedCount, postLeftX, postRightX, springlineY, apexY }) {
  if (earnedCount < 9) return null
  const arcOpacity = earnedCount >= 12 ? 0.25 : 0.21
  return (
    <Path
      d={`M ${postLeftX} ${springlineY} Q ${(postLeftX + postRightX) / 2} ${apexY - 8} ${postRightX} ${springlineY}`}
      fill="none"
      stroke="#E8C070"
      strokeWidth="0.8"
      opacity={arcOpacity}
      strokeLinecap="round"
    />
  )
}

// ── Main Arbor component ──────────────────────────────────────
function LivingGardenArborComponent({ ctx, sceneId }) {
  const { postLeftX, postRightX, footingY, springlineY, apexY, headRailUpperY, headRailLowerY } =
    ARBOR

  // Compute deterministic peg assignment
  const assignment = useMemo(() => computePegAssignment(ARBOR_CATALOG), [])
  const slotStates = useMemo(() => {
    return assignment.map((entry) => ({
      id: entry.id,
      tier: entry.tier,
      label: entry.label,
      earned: entry.qualifies(ctx),
      pegIndex: entry.pegIndex,
    }))
  }, [assignment, ctx])
  const earnedCount = useMemo(() => slotStates.filter((s) => s.earned).length, [slotStates])
  const totalSlots = slotStates.length

  // Earned-color ramp (spec §5)
  const ramp = useMemo(() => arborRamp(earnedCount), [earnedCount])

  return (
    <G>
      {/* Cedar arch frame */}
      <G>
        <Rect
          x={postLeftX - 3}
          y={springlineY}
          width="6"
          height={footingY - springlineY}
          fill={SCENE_PALETTE.timber}
          rx="2"
        />
        <Rect
          x={postRightX - 3}
          y={springlineY}
          width="6"
          height={footingY - springlineY}
          fill={SCENE_PALETTE.timber}
          rx="2"
        />
        <Path
          d={`M ${postLeftX} ${springlineY} Q ${(postLeftX + postRightX) / 2} ${apexY - 8} ${postRightX} ${springlineY}`}
          stroke={SCENE_PALETTE.timber}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d={`M ${postLeftX} ${springlineY} Q ${(postLeftX + postRightX) / 2} ${apexY - 8} ${postRightX} ${springlineY}`}
          stroke={SCENE_PALETTE.timberLight}
          strokeWidth="1"
          fill="none"
          opacity="0.4"
          strokeLinecap="round"
        />
        <Line
          x1={postLeftX + 3}
          y1={headRailUpperY}
          x2={postRightX - 3}
          y2={headRailUpperY}
          stroke={SCENE_PALETTE.timber}
          strokeWidth="2"
          opacity="0.85"
        />
        <Line
          x1={postLeftX + 3}
          y1={headRailLowerY}
          x2={postRightX - 3}
          y2={headRailLowerY}
          stroke={SCENE_PALETTE.timber}
          strokeWidth="2"
          opacity="0.85"
        />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const t = i / 7
          const x = postLeftX + 6 + (postRightX - postLeftX - 12) * t
          return (
            <Line
              key={`lattice-v-${i}`}
              x1={x}
              y1={headRailUpperY}
              x2={x}
              y2={headRailLowerY}
              stroke={SCENE_PALETTE.timberLight}
              strokeWidth="0.4"
              opacity="0.3"
            />
          )
        })}
      </G>

      {/* Vine coverage — climbs posts, leaves along arch */}
      <VineCoverage earnedCount={earnedCount} totalSlots={totalSlots} sceneId={sceneId} />

      {/* Gold thread arc at 9+ ornaments (spec §5) */}
      <GoldThreadArc
        earnedCount={earnedCount}
        postLeftX={postLeftX}
        postRightX={postRightX}
        springlineY={springlineY}
        apexY={apexY}
      />

      {/* Pegs and ornaments with earned-color ramp */}
      {slotStates.map((slot) => {
        const pos = PEG_POSITIONS[slot.pegIndex] || PEG_POSITIONS[0]
        const OrnamentRenderer = ORNAMENT_RENDERERS[slot.tier]
        if (slot.earned && OrnamentRenderer) {
          // Hue-rotated color with saturation ramp
          const ornamentColor = getOrnamentHue(slot.pegIndex, ramp.saturation)
          return (
            <G key={`arbor-peg-${slot.id}`}>
              {/* Bloom halo (spec §5) — opacity <= 0.10 */}
              <OrnamentBloom
                cx={pos.cx}
                cy={pos.cy}
                radius={ramp.bloomRadius}
                opacity={ramp.bloomOpacity}
                hue={ornamentColor}
              />
              <OrnamentRenderer cx={pos.cx} cy={pos.cy} color={ornamentColor} />
            </G>
          )
        }
        return (
          <G key={`arbor-peg-${slot.id}`}>
            <EmptyPeg cx={pos.cx} cy={pos.cy} />
          </G>
        )
      })}

      {/* Subtle gold border accent for permanent structure */}
      <Line
        x1={postLeftX - 4}
        y1={springlineY - 2}
        x2={postRightX + 4}
        y2={springlineY - 2}
        stroke={SCENE_PALETTE.gold}
        strokeWidth="0.6"
        opacity="0.25"
      />
    </G>
  )
}

function arborComparator(prev, next) {
  return prev.sceneId === next.sceneId && prev.ctx === next.ctx
}

export const LivingGardenArbor = memo(LivingGardenArborComponent, arborComparator)

// ── Exported helpers for testing ──────────────────────────────
export {
  computePegAssignment,
  computePegPositions,
  PEG_POSITIONS,
  arborRamp,
  getOrnamentHue,
  ORNAMENT_HUE_ROTATION,
}

export default LivingGardenArbor
