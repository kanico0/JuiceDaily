import { SEMANTIC_COLORS } from '../constants/tokens'
import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage } from '../constants/glowJourneyStages'

const STAGE_VISUAL_PROPS = {
  seed: {
    liquidColor: '#DCE7D3',
    outlineColor: '#B9C9AE',
    outlineWidth: 1.5,
    glowRingOpacity: 0,
    motifKey: 'seed',
  },
  sprout: {
    liquidColor: '#A9D1AE',
    outlineColor: '#A9D1AE',
    outlineWidth: 1.5,
    glowRingOpacity: 0,
    motifKey: 'sprout',
  },
  growing: {
    liquidColor: '#6FA97D',
    outlineColor: '#6FA97D',
    outlineWidth: 2.0,
    glowRingOpacity: 0.05,
    motifKey: 'growing',
  },
  blooming: {
    liquidColor: '#4C8F63',
    outlineColor: '#4C8F63',
    outlineWidth: 2.0,
    glowRingOpacity: 0.08,
    motifKey: 'blooming',
  },
  thriving: {
    liquidColor: '#3F7D5C',
    outlineColor: '#3F7D5C',
    outlineWidth: 2.2,
    glowRingOpacity: 0.11,
    motifKey: 'thriving',
  },
  radiant: {
    liquidColor: '#2C5940',
    outlineColor: '#2C5940',
    outlineWidth: 2.4,
    glowRingOpacity: 0.14,
    motifKey: 'radiant',
  },
  legend: {
    liquidColor: '#244833',
    outlineColor: '#244833',
    outlineWidth: 2.6,
    glowRingOpacity: 0.18,
    motifKey: 'legend',
  },
}

const HALO_UNFILLED_STROKE = '#4A6B57'
const HALO_FILLED_COLOR = '#8FE8A8'
const HALO_GOLD_DOT_COLOR = '#E8B84B'
const PARTICLE_COLOR = '#F5D98B'
const FALLING_DROPLET_COLOR = '#8FBF9F'
const LIQUID_HIGHLIGHT_COLOR = '#FFFFFF'
const STAGE_GOLD_TRIM = '#D9A63E'
const AMBIENT_GLOW_GOLD = '#E8B84B'
const AMBIENT_GLOW_MINT = '#4ADE9C'

// ── Juice-colored liquid (FINAL handoff §5.2) ────────────────
// Warm carrot/orange dominant base with a thin mint/green
// secondary band near the top — reads as "juice" on sight.
const JUICE_LIQUID_BASE = '#E8873A'
const JUICE_LIQUID_TOP_BAND = '#8FBF9F'

export const GLOW_JOURNEY_PALETTE = {
  haloUnfilledStroke: HALO_UNFILLED_STROKE,
  haloFilledColor: HALO_FILLED_COLOR,
  haloGoldDotColor: HALO_GOLD_DOT_COLOR,
  particleColor: PARTICLE_COLOR,
  fallingDropletColor: FALLING_DROPLET_COLOR,
  liquidHighlightColor: LIQUID_HIGHLIGHT_COLOR,
  stageGoldTrim: STAGE_GOLD_TRIM,
  juiceLiquidBase: JUICE_LIQUID_BASE,
  juiceLiquidTopBand: JUICE_LIQUID_TOP_BAND,
  ambientGlowGold: AMBIENT_GLOW_GOLD,
  ambientGlowMint: AMBIENT_GLOW_MINT,
}

export function clampProgress(value) {
  if (typeof value !== 'number' || isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function getStageVisualProps(stageKey) {
  if (!stageKey) return STAGE_VISUAL_PROPS.seed
  return STAGE_VISUAL_PROPS[stageKey] || STAGE_VISUAL_PROPS.seed
}

export function getLeafVisualState(leaf, stageProps) {
  const filled = leaf.hasLog
  // Correction addendum §1.2: high contrast between filled and unfilled.
  // Filled: solid bright green/mint fill + gold center dot.
  // Unfilled: thin dim outline only, no fill.
  return {
    filled,
    fillColor: filled ? GLOW_JOURNEY_PALETTE.haloFilledColor : 'none',
    strokeColor: filled ? GLOW_JOURNEY_PALETTE.haloFilledColor : GLOW_JOURNEY_PALETTE.haloUnfilledStroke,
    strokeWidth: leaf.isToday ? 2.8 : 1.4,
    opacity: leaf.isFuture ? 0.4 : 1,
    scale: leaf.isToday ? 1.25 : 1,
    showGoldDot: filled,
    goldDotColor: GLOW_JOURNEY_PALETTE.haloGoldDotColor,
  }
}

export function getLiquidFillGeometry(fillRatio, viewBoxHeight = 385, liquidTop = 65, liquidBottom = 378) {
  const clamped = clampProgress(fillRatio)
  const fillHeight = (liquidBottom - liquidTop) * clamped
  const y = liquidBottom - fillHeight
  return {
    y,
    height: fillHeight,
    x: 100,
    width: 200,
  }
}

export function buildGlowJourneyVisualState({
  lifetimeDays,
  weeklyQualifyingDays,
  weeklyLeafStates,
  streakCount,
}) {
  const stage = getJourneyStage(lifetimeDays)
  const nextStage = getNextStage(lifetimeDays)
  const daysToNext = getDaysToNextStage(lifetimeDays)
  const stageKey = stage ? stage.key : null
  const stageProps = getStageVisualProps(stageKey)
  const fillRatio = clampProgress(weeklyQualifyingDays / WEEKLY_GLOW_GOAL)
  const liquidGeometry = getLiquidFillGeometry(fillRatio)

  const leafStates = (weeklyLeafStates || []).map((leaf) => ({
    ...leaf,
    visual: getLeafVisualState(leaf, stageProps),
  }))

  return {
    stage,
    stageKey,
    stageProps,
    nextStage,
    daysToNext,
    fillRatio,
    liquidGeometry,
    leafStates,
    streakCount,
    weeklyQualifyingDays,
    lifetimeDays,
    weeklyGoal: WEEKLY_GLOW_GOAL,
  }
}
