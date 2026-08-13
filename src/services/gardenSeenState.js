// ─────────────────────────────────────────────────────────────
// gardenSeenState.js — Minimal local-only seen-state snapshot
//
// Records what the user has ALREADY VISUALLY SEEN in the Living
// Garden. This is NOT progression truth. It records only visual
// seen-state. If deleted, actual user progress is unchanged.
//
// Authorized shape (spec §11):
// {
//   bedStages: { greens, roots, citrus, orchard, berries, tropical, herbs },
//   journeyStageKey,
//   earnedMilestoneIds
// }
//
// Does NOT include:
//   - timestamps
//   - days since last open
//   - per-bed advanced_at
//   - event history
//   - chronological queue
//   - backend IDs
//   - analytics
//   - Rainbow state
//   - JuiceLog entries
//
// First-open behavior (spec §12):
//   If no snapshot exists, initialize to CURRENT state.
//   Do NOT replay historical growth.
//
// Later-open behavior (spec §13-15):
//   Compare current vs last-seen. Detect advancements.
//   Coalesce multi-stage jumps into one transition.
//
// Update timing (spec §16):
//   Update AFTER wake/advancement presentation completes, not
//   before the user has seen the current state.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY_SEEN_STATE = 'garden_last_seen_state_v1'
const KEY_INTRO_SEEN = 'garden_living_intro_seen'

// ── Garden bed keys (mirror existing taxonomy) ────────────────
const BED_KEYS = ['greens', 'roots', 'citrus', 'orchard', 'berries', 'tropical', 'herbs']

// ── Load last-seen snapshot ───────────────────────────────────
// Returns null if no snapshot exists (first open).
export async function getLastSeenState() {
  try {
    const raw = await AsyncStorage.getItem(KEY_SEEN_STATE)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return normalizeSeenState(parsed)
  } catch {
    return null
  }
}

// ── Save current state as last-seen ───────────────────────────
// Called AFTER the user has seen the current Garden state.
export async function saveLastSeenState(currentState) {
  try {
    const normalized = normalizeSeenState(currentState)
    await AsyncStorage.setItem(KEY_SEEN_STATE, JSON.stringify(normalized))
    return normalized
  } catch {
    return null
  }
}

// ── Initialize first-open snapshot ────────────────────────────
// If no snapshot exists, save CURRENT state as last seen.
// Returns true if this was a first-open initialization.
export async function initializeIfAbsent(currentState) {
  try {
    const existing = await AsyncStorage.getItem(KEY_SEEN_STATE)
    if (existing) return false
    await saveLastSeenState(currentState)
    return true
  } catch {
    return false
  }
}

// ── Detect advancements between last-seen and current ────────
// Returns a coalesced advancement descriptor. Does NOT replay
// intermediate stages.
export function detectAdvancements(lastSeen, current) {
  if (!lastSeen) {
    return { isFirstOpen: true, bedAdvancements: [], journeyAdvancement: null, newMilestoneIds: [] }
  }

  const bedAdvancements = []
  for (const bedKey of BED_KEYS) {
    const lastStage = lastSeen.bedStages?.[bedKey] || 'empty'
    const currentStage = current.bedStages?.[bedKey] || 'empty'
    if (currentStage !== lastStage) {
      // Only forward advancement (no decay)
      if (stageOrder(currentStage) > stageOrder(lastStage)) {
        bedAdvancements.push({
          bedKey,
          fromStage: lastStage,
          toStage: currentStage,
        })
      }
    }
  }

  const lastJourney = lastSeen.journeyStageKey || 'seed'
  const currentJourney = current.journeyStageKey || 'seed'
  let journeyAdvancement = null
  if (currentJourney !== lastJourney) {
    if (journeyOrder(currentJourney) > journeyOrder(lastJourney)) {
      journeyAdvancement = {
        fromStage: lastJourney,
        toStage: currentJourney,
      }
    }
  }

  const lastMilestones = new Set(lastSeen.earnedMilestoneIds || [])
  const currentMilestones = current.earnedMilestoneIds || []
  const newMilestoneIds = currentMilestones.filter((id) => !lastMilestones.has(id))

  return {
    isFirstOpen: false,
    bedAdvancements,
    journeyAdvancement,
    newMilestoneIds,
  }
}

// ── Stage ordering (for forward-only comparison) ──────────────
const STAGE_ORDER = ['empty', 'seed', 'sprout', 'growing', 'harvesting', 'flourishing']
function stageOrder(key) {
  const idx = STAGE_ORDER.indexOf(key)
  return idx >= 0 ? idx : 0
}

const JOURNEY_ORDER = ['seed', 'sprout', 'growing', 'blooming', 'thriving', 'radiant', 'legend']
function journeyOrder(key) {
  const idx = JOURNEY_ORDER.indexOf(key)
  return idx >= 0 ? idx : 0
}

// ── Normalize seen state to canonical shape ───────────────────
function normalizeSeenState(state) {
  const bedStages = {}
  for (const bedKey of BED_KEYS) {
    bedStages[bedKey] = state?.bedStages?.[bedKey || 'empty'] || 'empty'
  }
  return {
    bedStages,
    journeyStageKey: state?.journeyStageKey || 'seed',
    earnedMilestoneIds: Array.isArray(state?.earnedMilestoneIds) ? state.earnedMilestoneIds : [],
  }
}

// ── Build current seen-state from existing derived data ───────
// Helper for GardenDetail to construct the snapshot from data it
// already has. Does NOT read or write storage.
export function buildCurrentSeenState({ bedStages, journeyStageKey, earnedMilestoneIds }) {
  const normalizedBeds = {}
  for (const bedKey of BED_KEYS) {
    normalizedBeds[bedKey] = bedStages?.[bedKey]?.key || 'empty'
  }
  return {
    bedStages: normalizedBeds,
    journeyStageKey: journeyStageKey || 'seed',
    earnedMilestoneIds: earnedMilestoneIds || [],
  }
}

// ── Intro-seen boolean ────────────────────────────────────────
export async function isIntroSeen() {
  try {
    const val = await AsyncStorage.getItem(KEY_INTRO_SEEN)
    return val === 'true'
  } catch {
    return false
  }
}

export async function markIntroSeen() {
  try {
    await AsyncStorage.setItem(KEY_INTRO_SEEN, 'true')
  } catch {
    // non-fatal
  }
}

// ── Reset (for testing) ───────────────────────────────────────
export async function resetSeenState() {
  try {
    await AsyncStorage.removeItem(KEY_SEEN_STATE)
    await AsyncStorage.removeItem(KEY_INTRO_SEEN)
  } catch {
    // non-fatal
  }
}

// ── Exported constants ────────────────────────────────────────
export { KEY_SEEN_STATE, KEY_INTRO_SEEN, BED_KEYS }
