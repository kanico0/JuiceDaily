import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage } from '../constants/glowJourneyStages'

// ─────────────────────────────────────────────────────────────
// Living Juice Glow — visual state (GLOW_RECONSTRUCTION_FINAL)
//
// Renderer-only state. No new product logic. All inputs come from
// existing glowJourneyService / glowStreak / useGlowJourney.
// ─────────────────────────────────────────────────────────────

// ── Design tokens (spec §2) ───────────────────────────────────
export const GLOW_PALETTE = {
  // surfaces
  bg: '#080F0C',
  surfaceTop: '#12201A',
  surfaceBottom: '#0B1512',
  hairline: '#1E3129',
  // ink
  ink: '#EAF4EE',
  inkMuted: '#7E948A',
  // juice gold
  juiceGoldLight: '#FFD98A',
  juiceGold: '#FFB23F',
  juiceGoldMid: '#F0891F',
  juiceGoldDeep: '#A63C08',
  juiceHighlight: '#FFCE72',
  // mint stratum
  juiceMintLight: '#C3FADD',
  juiceMint: '#7BE3B0',
  juiceMintDeep: '#3FC287',
  // glow line
  glowLine: '#F4FFFA',
  // week vine
  weekLeafOffFill: '#16241D',
  weekLeafOffStroke: '#4E7462',
  weekStem: '#2A4437',
  // legacy compatibility (preserved for GlowJourneyStageIcon + tests)
  stageGoldTrim: '#D9A63E',
  haloFilledColor: '#7BE3B0',
  haloUnfilledStroke: '#4E7462',
  particleColor: '#F5D98B',
  fallingDropletColor: '#7BE3B0',
  liquidHighlightColor: '#FFFFFF',
  juiceLiquidBase: '#F0891F',
  juiceLiquidTopBand: '#7BE3B0',
  ambientGlowGold: '#FF9D2E',
  ambientGlowMint: '#7BE3B0',
}

// Backward-compatible alias — some imports may still reference it
export const GLOW_JOURNEY_PALETTE = GLOW_PALETTE

// ── Stage visual props (preserved for GlowJourneyStageIcon) ──
// These are no longer used by the hero; the hero's appearance is
// driven by weekly progress, not lifetime stage. Kept for the
// Journey row's stage icon component.
const STAGE_VISUAL_PROPS = {
  seed: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0, motifKey: 'seed' },
  sprout: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0, motifKey: 'sprout' },
  growing: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0.05, motifKey: 'growing' },
  blooming: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0.08, motifKey: 'blooming' },
  thriving: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0.11, motifKey: 'thriving' },
  radiant: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0.14, motifKey: 'radiant' },
  legend: { liquidColor: '#7BE3B0', outlineColor: '#7BE3B0', outlineWidth: 2, glowRingOpacity: 0.18, motifKey: 'legend' },
}

export function clampProgress(value) {
  if (typeof value !== 'number' || isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function getStageVisualProps(stageKey) {
  if (!stageKey) return STAGE_VISUAL_PROPS.seed
  return STAGE_VISUAL_PROPS[stageKey] || STAGE_VISUAL_PROPS.seed
}

// ── Liquid fill model (spec §5) ──────────────────────────────
// f = min(q, 3) / 3 — capped at the 3-day goal.
// surfaceY(f) = 238 - 196 * f
// At q=0 the vessel has a resting pool at y=238 (not empty).
// At q>=3 the fill is complete at y=42.
// q>3 does NOT raise the fill — only radiance increases.
export function getFillRatio(weeklyQualifyingDays) {
  return clampProgress(Math.min(weeklyQualifyingDays, WEEKLY_GLOW_GOAL) / WEEKLY_GLOW_GOAL)
}

export function surfaceY(f) {
  return 238 - 196 * clampProgress(f)
}

// ── Hero visual state (spec §5, §7) ──────────────────────────
export function getHeroVisualState(weeklyQualifyingDays) {
  const q = weeklyQualifyingDays || 0
  const f = getFillRatio(q)
  const y = surfaceY(f)
  const beyondGoal = q > WEEKLY_GLOW_GOAL

  return {
    q,
    f,
    surfaceY: y,
    beyondGoal,
    // progress-driven opacities (spec §5)
    ambientOpacity: 0.16 + 0.46 * f + (beyondGoal ? 0.12 : 0),
    rimMintOpacity: 0.60 + 0.40 * f,
    rimGoldOpacity: 0.40 + 0.55 * f,
    rimLightLowerRight: 0.18 + 0.40 * f,
    surfaceBloomOpacity: 0.15 + 0.18 * f,
    completionBloomOpacity: f >= 1 ? (beyondGoal ? 1.0 : 0.7) : 0,
    pulpCount: beyondGoal ? 9 : 5,
    isComplete: f >= 1,
  }
}

// ── Vine leaf visual state (spec §6) ─────────────────────────
// 7 leaves, Monday-Sunday. Logged = gold gradient + midrib + glow.
// Unlogged = dark fill + stroke, no glow.
export function getVineLeafVisualState(leaf) {
  const logged = leaf.hasLog
  return {
    logged,
    isToday: leaf.isToday,
    isFuture: leaf.isFuture,
    // logged: warm gold gradient; unlogged: dark resting fill
    fillType: logged ? 'gradient' : 'flat',
    fillColor: logged ? GLOW_PALETTE.juiceGold : GLOW_PALETTE.weekLeafOffFill,
    fillColorEnd: logged ? GLOW_PALETTE.juiceGoldMid : GLOW_PALETTE.weekLeafOffFill,
    strokeColor: logged ? '#FFE9C2' : GLOW_PALETTE.weekLeafOffStroke,
    strokeWidth: logged ? 1.6 : 2,
    strokeOpacity: logged ? 0.75 : 1,
    midribColor: '#B85B12',
    midribOpacity: logged ? 0.55 : 0,
    glowOpacity: logged ? 0.5 : 0,
    initialColor: logged ? GLOW_PALETTE.ink : GLOW_PALETTE.inkMuted,
    initialWeight: logged ? '600' : '500',
  }
}

// ── Backward-compatible leaf visual state ────────────────────
// Preserved for any consumer that still expects the old shape.
export function getLeafVisualState(leaf, _stageProps) {
  const vs = getVineLeafVisualState(leaf)
  return {
    filled: vs.logged,
    fillColor: vs.fillType === 'gradient' ? vs.fillColor : 'none',
    strokeColor: vs.strokeColor,
    strokeWidth: vs.strokeWidth,
    opacity: vs.isFuture ? 0.4 : 1,
    scale: vs.isToday ? 1.25 : 1,
    showGoldDot: false,
    goldDotColor: GLOW_PALETTE.stageGoldTrim,
  }
}

// ── Legacy liquid geometry (preserved for compatibility) ─────
export function getLiquidFillGeometry(fillRatio) {
  const clamped = clampProgress(fillRatio)
  const y = surfaceY(clamped)
  return {
    y,
    height: 252 - y,
    x: 0,
    width: 200,
  }
}

// ── Build full visual state (preserved contract) ─────────────
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
  const fillRatio = getFillRatio(weeklyQualifyingDays)
  const heroState = getHeroVisualState(weeklyQualifyingDays)
  const liquidGeometry = getLiquidFillGeometry(fillRatio)

  const leafStates = (weeklyLeafStates || []).map((leaf) => ({
    ...leaf,
    visual: getVineLeafVisualState(leaf),
  }))

  return {
    stage,
    stageKey,
    stageProps,
    nextStage,
    daysToNext,
    fillRatio,
    liquidGeometry,
    heroState,
    leafStates,
    streakCount,
    weeklyQualifyingDays,
    lifetimeDays,
    weeklyGoal: WEEKLY_GLOW_GOAL,
  }
}
