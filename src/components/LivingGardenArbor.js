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

import React, { useMemo, useCallback, useState, useEffect, useRef, memo } from 'react'
import { Animated } from 'react-native'
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
// Each renderer accepts an optional `opacity` prop (0–1).
// react-native-svg 15.x bug: G with opacity prop does not reliably
// suppress child rendering. Opacity MUST be applied to individual
// SVG elements, NOT to a G wrapper.
function LeafOrnament({ cx, cy, color, opacity = 1 }) {
  return (
    <G>
      {/* Cord from peg */}
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity={0.8 * opacity}
      />
      {/* Teardrop leaf with midrib */}
      <Path
        d={`M ${cx} ${cy} C ${cx + 4} ${cy + 1}, ${cx + 6} ${cy + 5}, ${cx} ${cy + 9} C ${cx - 6} ${cy + 5}, ${cx - 4} ${cy + 1}, ${cx} ${cy} Z`}
        fill={color}
        opacity={opacity}
      />
      <Path
        d={`M ${cx} ${cy + 1} L ${cx} ${cy + 8}`}
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="0.5"
        opacity={0.7 * opacity}
      />
    </G>
  )
}

function BlossomOrnament({ cx, cy, color, opacity = 1 }) {
  return (
    <G>
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity={0.8 * opacity}
      />
      {/* Five petals */}
      <G transform={`translate(${cx} ${cy + 5})`}>
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity={0.92 * opacity} />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity={0.92 * opacity} transform="rotate(72)" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity={0.92 * opacity} transform="rotate(144)" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity={0.92 * opacity} transform="rotate(216)" />
        <Ellipse cy="-3" rx="1.8" ry="2.8" fill="#F3E3D2" opacity={0.92 * opacity} transform="rotate(288)" />
        {/* Gold centre */}
        <Circle r="1.5" fill={SCENE_PALETTE.gold} opacity={opacity} />
      </G>
    </G>
  )
}

function FruitOrnament({ cx, cy, color, opacity = 1 }) {
  return (
    <G>
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity={0.8 * opacity}
      />
      {/* Round fruit with highlight */}
      <Circle cx={cx} cy={cy + 5} r="3" fill={color} opacity={opacity} />
      <Circle cx={cx - 1} cy={cy + 4} r="1" fill={SCENE_PALETTE.goldPale} opacity={0.5 * opacity} />
      {/* Stem */}
      <Path
        d={`M ${cx} ${cy + 2} L ${cx + 1} ${cy}`}
        stroke={SCENE_PALETTE.bark}
        strokeWidth="0.5"
        opacity={opacity}
      />
    </G>
  )
}

function MedallionOrnament({ cx, cy, color, opacity = 1 }) {
  return (
    <G>
      <Path
        d={`M ${cx} ${cy - 4} L ${cx} ${cy}`}
        stroke={SCENE_PALETTE.timberLight}
        strokeWidth="0.7"
        opacity={0.8 * opacity}
      />
      {/* Gold disc with inner ring and highlight */}
      <Circle cx={cx} cy={cy + 5} r="3.5" fill={SCENE_PALETTE.gold} opacity={opacity} />
      <Circle
        cx={cx}
        cy={cy + 5}
        r="2.2"
        fill="none"
        stroke={SCENE_PALETTE.goldPale}
        strokeWidth="0.5"
        opacity={0.8 * opacity}
      />
      <Circle cx={cx - 1} cy={cy + 4} r="1" fill={SCENE_PALETTE.goldPale} opacity={0.6 * opacity} />
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
// newlyEarnedIds (optional): IDs of ornaments earned since last seen.
// arborReveal (optional): 0 → 1 progress for newly-earned ornament reveal.
// When provided, newly-earned ornaments receive temporary restrained
// scale + transient highlight/halo treatment with deterministic stagger.
// At rest (arborReveal=1), all ornaments are canonical/static.
//
// Phase 1B corrections:
//   - Single ornament reveal ~1100ms (driven externally)
//   - Restrained scale delta (start 0.88, not 0.4)
//   - Transient highlight/halo resolving to zero
//   - 130ms stagger for 2–4 ornaments, 90ms for 5+
//   - Phase cap ~1600ms
//   - Ornaments categorically static after reveal
function LivingGardenArborComponent({
  ctx,
  sceneId,
  newlyEarnedIds,
  arborReveal,
  advancementMilestoneIds = null,
  advancementId = null,
  isReduced = false,
  onDebugValues = null,
}) {
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

  // ── Newly-earned ornament reveal (Phase 1B corrected) ─────
  // Phase 1D: newEarnedSet uses effectiveNewIds which includes
  // advancementMilestoneIds during UNPREPARED guard phase.
  // NOTE: newEarnedSet is computed AFTER effectiveNewIds is declared
  // (below) to avoid TDZ violation. It is a cheap Set creation that
  // does not require useMemo.

  // ── Phase 1D pre-paint Arbor reveal guard (one-shot per generation) ──
  // PROBLEM: When the parent changes arborCtx (new milestone IDs) AND passes
  // advancements simultaneously, the Arbor re-renders with target ornaments
  // BEFORE the motion hook's useEffect runs to set newlyEarnedIds and
  // arborReveal=0. On the first target render:
  //   - newlyEarnedIds is still [] (stale state)
  //   - arborReveal is still 1 (canonical)
  //   - All new ornaments paint at full appearance (flash)
  //
  // FIX: A one-shot guard with explicit lifecycle phases:
  //   UNPREPARED → RUNNING → COMPLETE
  //
  // GENERATION-OWNED NEW-ID SET:
  // eventNewIdsRef stores the new milestone IDs synchronously when a new
  // advancement is detected. These IDs remain the authoritative new-ID set
  // for the ENTIRE reveal lifecycle (UNPREPARED + RUNNING). They do NOT
  // depend on the delayed newlyEarnedIds React state handoff.
  //
  // UNPREPARED: New advancement detected (advancementId changed). Store
  //   advancementMilestoneIds in eventNewIdsRef. Force revealProgress=0.
  // RUNNING: Motion hook has initialized (arborReveal < 1). Guard releases
  //   progress forcing but STILL uses eventNewIdsRef for new-ID identity.
  // COMPLETE: Animation finished (arborReveal back to 1). Guard never
  //   reactivates for this generation. Ornaments canonical.
  //
  // Reduced Motion bypasses guard entirely — ornaments immediately canonical.
  const prevAdvancementIdRef = useRef(null)
  const arborGuardPhaseRef = useRef(0) // 0=IDLE, 1=UNPREPARED, 2=RUNNING, 3=COMPLETE
  const eventNewIdsRef = useRef(null) // generation-owned new-ID set

  const hasNewMilestones = advancementMilestoneIds && advancementMilestoneIds.length > 0

  // Detect new advancement by object reference
  if (hasNewMilestones && advancementId && advancementId !== prevAdvancementIdRef.current) {
    prevAdvancementIdRef.current = advancementId
    // Store generation-owned new IDs synchronously
    eventNewIdsRef.current = advancementMilestoneIds
    // Only arm guard if not Reduced Motion
    arborGuardPhaseRef.current = isReduced ? 3 : 1 // UNPREPARED (or COMPLETE if reduced)
  }
  // If advancement ends, reset to IDLE
  if (!hasNewMilestones && arborGuardPhaseRef.current !== 0) {
    arborGuardPhaseRef.current = 0
    prevAdvancementIdRef.current = null
    eventNewIdsRef.current = null
  }

  // ── Arbor reveal (Phase 1C: Animated.Value bridge) ──────
  // arborReveal is an Animated.Value from useGardenMotion.
  // DOCUMENTED EXCEPTION: Per-ornament progress requires reading
  // the value to compute staggered opacity/scale. A single listener
  // bridges to state, active ONLY during the reveal phase (≤1600ms).
  // At rest (arborReveal=1): no listener, no setState, canonical.
  //
  // Phase 1D: Also read synchronously via __getValue() for guard logic.
  const isAnimValue = arborReveal instanceof Animated.Value
  const readSyncReveal = isAnimValue ? arborReveal.__getValue() : (arborReveal != null ? arborReveal : 1)
  const [revealProgress, setRevealProgress] = useState(
    isAnimValue ? 1 : arborReveal != null ? arborReveal : 1,
  )

  useEffect(() => {
    if (!isAnimValue) return
    // If at rest AND no active guard, don't bridge (performance).
    // CRITICAL: When guard is UNPREPARED or RUNNING, ALWAYS set up the
    // listener — even if the current value is 1. The motion hook will
    // call setValue(0) AFTER this effect runs (effects run child-first,
    // and the motion hook's orchestration effect is in the Scene parent).
    // If we skip the listener here, setValue(0) fires with no listener,
    // no setRevealProgress, no re-render → Arbor stuck at UNPREPARED forever.
    //
    // ROOT-CAUSE FIX: The effect dependency array MUST include advancementId
    // so the effect re-runs when a new advancement arrives. Without this,
    // the effect only runs once on mount (when advancements is null, guard
    // is IDLE, value is 1 → early return → no listener). When advancements
    // arrives later, the guard arms but the effect never re-runs, so
    // setValue(0) has no listener → guard stuck at UNPREPARED forever.
    const guardActive = arborGuardPhaseRef.current === 1 || arborGuardPhaseRef.current === 2
    if (arborReveal.__getValue() >= 1 && !guardActive) {
      setRevealProgress(1)
      return
    }
    // DOCUMENTED EXCEPTION: bridge during reveal phase only
    const id = arborReveal.addListener(({ value }) => {
      setRevealProgress(value)
    })
    return () => {
      arborReveal.removeListener(id)
    }
  }, [isAnimValue, arborReveal, advancementId])

  // ── Guard phase transitions (during render, synchronous) ──
  if (arborGuardPhaseRef.current === 1) {
    // UNPREPARED: check if motion hook has initialized
    if (readSyncReveal < 1) {
      // Motion hook has set arborReveal=0 → RUNNING
      arborGuardPhaseRef.current = 2
    }
  } else if (arborGuardPhaseRef.current === 2) {
    // RUNNING: check if animation completed (arborReveal back to 1)
    if (readSyncReveal >= 1) {
      arborGuardPhaseRef.current = 3
    }
  }

  // ── Effective reveal progress and new ID set ──
  // Generation-owned: eventNewIdsRef is the authoritative new-ID set for
  // the ENTIRE reveal lifecycle (UNPREPARED + RUNNING). It does NOT depend
  // on the delayed newlyEarnedIds React state, which may still be [] when
  // the guard transitions to RUNNING.
  //
  // PROGRESS SOURCE FIX:
  // UNPREPARED: force progress=0 (motion hook hasn't initialized yet)
  // RUNNING: use readSyncReveal (synchronous Animated.Value __getValue())
  //   NOT the bridged revealProgress React state, which can lag behind.
  //   The React state is only needed to TRIGGER re-renders; the numerical
  //   value during RUNNING must come from the live Animated.Value.
  //   This is safe because useNativeDriver=false (JS-driven animation).
  // COMPLETE: use readSyncReveal (will be 1, canonical)
  let effectiveRevealProgress
  let effectiveNewIds = eventNewIdsRef.current
  if (arborGuardPhaseRef.current === 1) {
    // UNPREPARED: force progress=0 before motion hook initializes
    effectiveRevealProgress = 0
    effectiveNewIds = eventNewIdsRef.current
  } else if (arborGuardPhaseRef.current === 2) {
    // RUNNING: use synchronous Animated.Value read (NOT stale React state)
    effectiveRevealProgress = readSyncReveal
    effectiveNewIds = eventNewIdsRef.current
  } else {
    // IDLE or COMPLETE: canonical (readSyncReveal will be 1)
    effectiveRevealProgress = readSyncReveal
  }

  const hasRevealMotion = effectiveRevealProgress < 1

  // ── newEarnedSet: computed AFTER effectiveNewIds declaration ──
  // Cheap Set creation — no useMemo needed. This fixes the TDZ
  // violation where effectiveNewIds was referenced before declaration.
  const newEarnedSet = new Set(effectiveNewIds || [])

  // Compute per-ornament stagger parameters
  const newCount = effectiveNewIds ? effectiveNewIds.length : 0
  const stagger = newCount >= 5 ? 90 : 130
  const ornamentDuration = 1100
  const totalRevealDuration = Math.min(ornamentDuration + Math.max(0, newCount - 1) * stagger, 1600)

  // Compute per-ornament reveal progress based on stagger
  const computeOrnamentProgress = useCallback(
    (ornamentId) => {
      if (!hasRevealMotion || !effectiveNewIds) return 1
      const idx = effectiveNewIds.indexOf(ornamentId)
      if (idx < 0) return 1 // not newly earned — fully visible
      const ornamentDelay = idx * stagger
      const elapsed = effectiveRevealProgress * totalRevealDuration - ornamentDelay
      return Math.max(0, Math.min(1, elapsed / ornamentDuration))
    },
    [hasRevealMotion, effectiveNewIds, effectiveRevealProgress, stagger, totalRevealDuration],
  )

  // ── QA-only debug values (for Garden Preview diagnostic) ──
  // Exposes the actual values consumed by the renderer for each new ID.
  // No persistence. No production-visible UI. Only active when onDebugValues
  // callback is supplied (preview only).
  useEffect(() => {
    if (!onDebugValues || !effectiveNewIds) return
    const phaseNames = ['IDLE', 'UNPREPARED', 'RUNNING', 'COMPLETE']
    // run: whether the Animated.Value has been initialized to 0 (motion started)
    const run = readSyncReveal < 1 ? 1 : 0
    // processed: whether the guard has transitioned past UNPREPARED
    const processed = arborGuardPhaseRef.current >= 2 ? 1 : 0
    const perId = {}
    effectiveNewIds.forEach((id) => {
      const idx = effectiveNewIds.indexOf(id)
      const p = computeOrnamentProgress(id)
      const isNew = hasRevealMotion && idx >= 0
      // render: actual JSX branch decision (structural zero-progress gate)
      const render = !(isNew && p <= 0) ? 1 : 0
      perId[id] = {
        index: idx,
        individualProgress: p,
        ornamentOpacity: isNew ? p : 1,
        ornamentScale: isNew ? 0.88 + 0.12 * p : 1,
        haloOpacity: isNew && p < 1 ? Math.sin(p * Math.PI) * 0.26 : 0,
        render,
      }
    })
    onDebugValues({
      phase: phaseNames[arborGuardPhaseRef.current],
      syncReveal: readSyncReveal,
      stateReveal: revealProgress,
      effectiveRevealProgress,
      run,
      processed,
      effectiveNewIds,
      perId,
    })
  }, [onDebugValues, effectiveNewIds, effectiveRevealProgress, hasRevealMotion, computeOrnamentProgress])

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
          // ── Newly-earned ornament reveal (Phase 1B corrected) ──
          // Restrained scale delta (0.88 → 1.0, not 0.4 → 1.0).
          // Transient highlight/halo peaks at midpoint, resolves to 0.
          // Per-ornament stagger based on index in eventNewIdsRef (generation-owned).
          // At rest (individualProgress=1): scale=1, opacity=1, halo=0 (canonical).
          const isNewlyEarned = hasRevealMotion && newEarnedSet.has(slot.id)
          const individualProgress = isNewlyEarned ? computeOrnamentProgress(slot.id) : 1
          const ornamentOpacity = isNewlyEarned ? individualProgress : 1
          // Restrained scale: 0.88 → 1.0 (not 0.4 → 1.0)
          const ornamentScale = isNewlyEarned ? 0.88 + 0.12 * individualProgress : 1
          // Transient highlight/halo: peaks at 0.5 progress, resolves to 0
          // Phase 1C: peak reduced to 0.26 (was 0.35)
          const haloOpacity =
            isNewlyEarned && individualProgress < 1
              ? Math.sin(individualProgress * Math.PI) * 0.26
              : 0
          const ornamentTransform =
            ornamentScale !== 1
              ? `translate(${pos.cx} ${pos.cy}) scale(${ornamentScale}) translate(${-pos.cx} ${-pos.cy})`
              : undefined
          // ── STRUCTURAL ZERO-PROGRESS HARD GATE ──
          // At progress exactly 0, do NOT render any earned ornament geometry.
          // This is a structural gate (not opacity-based) to guarantee that
          // newly-earned ornaments are invisible at their exact pre-start state.
          // The peg/frame/background structure is NOT affected.
          // At progress > 0, render the normal animated ornament path.
          const shouldRenderOrnament = !(isNewlyEarned && individualProgress <= 0)
          return (
            <G
              key={`arbor-peg-${slot.id}`}
              transform={ornamentTransform}
              // react-native-svg 15.x bug: G opacity prop does NOT reliably
              // suppress child rendering. Opacity is applied to individual
              // SVG elements inside each renderer instead.
            >
              {/* Transient highlight/halo (resolves to 0 at rest) */}
              {shouldRenderOrnament && haloOpacity > 0 && (
                <Circle
                  cx={pos.cx}
                  cy={pos.cy}
                  r={ramp.bloomRadius * 1.4}
                  fill={ornamentColor}
                  opacity={haloOpacity}
                />
              )}
              {/* Bloom halo (spec §5) — opacity <= 0.10, permanent */}
              {/* Bloom fades with ornamentOpacity for newly-earned ornaments */}
              {/* Zero-progress gate: no bloom for newly-earned at progress=0 */}
              {shouldRenderOrnament && (
                <OrnamentBloom
                  cx={pos.cx}
                  cy={pos.cy}
                  radius={ramp.bloomRadius}
                  opacity={ramp.bloomOpacity * ornamentOpacity}
                  hue={ornamentColor}
                />
              )}
              {/* Ornament renderer receives opacity prop (applied to individual elements) */}
              {/* Zero-progress gate: no ornament geometry for newly-earned at progress=0 */}
              {shouldRenderOrnament && (
                <OrnamentRenderer
                  cx={pos.cx}
                  cy={pos.cy}
                  color={ornamentColor}
                  opacity={ornamentOpacity}
                />
              )}
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
  return (
    prev.sceneId === next.sceneId &&
    prev.ctx === next.ctx &&
    prev.newlyEarnedIds === next.newlyEarnedIds &&
    prev.arborReveal === next.arborReveal &&
    prev.advancementMilestoneIds === next.advancementMilestoneIds &&
    prev.advancementId === next.advancementId &&
    prev.isReduced === next.isReduced &&
    prev.onDebugValues === next.onDebugValues
  )
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
