// ─────────────────────────────────────────────────────────────
// glowJourneyStages.js — Permanent lifetime journey stage config
//
// Single source of truth for stage thresholds and labels.
// Adjust here to tune the journey progression.
// ─────────────────────────────────────────────────────────────

export const GLOW_JOURNEY_STAGES = [
  { key: 'seed', label: 'Seed', min: 1, max: 4, emoji: '🌱' },
  { key: 'sprout', label: 'Sprout', min: 5, max: 14, emoji: '🌿' },
  { key: 'growing', label: 'Growing', min: 15, max: 29, emoji: '🌳' },
  { key: 'blooming', label: 'Blooming', min: 30, max: 59, emoji: '🌸' },
  { key: 'thriving', label: 'Thriving', min: 60, max: 99, emoji: '✨' },
  { key: 'radiant', label: 'Radiant', min: 100, max: 199, emoji: '🌅' },
  { key: 'legend', label: 'RawLife Legend', min: 200, max: Infinity, emoji: '👑' },
]

export const WEEKLY_GLOW_GOAL = 3

export function getJourneyStage(lifetimeDays) {
  if (!lifetimeDays || lifetimeDays < 1) return null
  for (const stage of GLOW_JOURNEY_STAGES) {
    if (lifetimeDays >= stage.min && lifetimeDays <= stage.max) {
      return stage
    }
  }
  return GLOW_JOURNEY_STAGES[GLOW_JOURNEY_STAGES.length - 1]
}

export function getNextStage(lifetimeDays) {
  if (!lifetimeDays || lifetimeDays < 1) return GLOW_JOURNEY_STAGES[0]
  const currentIdx = GLOW_JOURNEY_STAGES.findIndex(
    (s) => lifetimeDays >= s.min && lifetimeDays <= s.max
  )
  if (currentIdx === -1 || currentIdx >= GLOW_JOURNEY_STAGES.length - 1) return null
  return GLOW_JOURNEY_STAGES[currentIdx + 1]
}

export function getDaysToNextStage(lifetimeDays) {
  const next = getNextStage(lifetimeDays)
  if (!next) return 0
  return next.min - lifetimeDays
}
