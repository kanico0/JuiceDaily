// ─────────────────────────────────────────────────────────────
// LivingGardenAtmosphere.js — Journey stage → atmosphere config
//
// Pure static lookup from the existing 7-value Journey stage enum
// to environmental visual props. No new metric, no persistence.
//
// Spec §11 — environmental treatment per Journey stage:
//   Seed:    darkest world, glow 0.05, no motes
//   Sprout:  glow 0.07
//   Growing: glow 0.10
//   Blooming:glow 0.14, motes appear
//   Thriving:glow 0.18, dapple strengthens
//   Radiant: glow 0.26, motes brighten
//   Legend:  glow 0.32, crown breath, treeline echo
//
// RENDER EXISTING TRUTH. No new Journey progression.
// ─────────────────────────────────────────────────────────────

// ── Atmosphere config per Journey stage key ───────────────────
// All values are static visual configuration only.
export const JOURNEY_ATMOSPHERE = {
  seed: {
    horizonGlow: 0.10,
    moteCount: 0,
    moteOpacity: 0,
    dappleStrength: 0.5,
    rimLight: 0,
    crownBreath: 0,
    treelineEcho: false,
  },
  sprout: {
    horizonGlow: 0.10,
    moteCount: 0,
    moteOpacity: 0,
    dappleStrength: 0.55,
    rimLight: 0,
    crownBreath: 0,
    treelineEcho: false,
  },
  growing: {
    horizonGlow: 0.10,
    moteCount: 0,
    moteOpacity: 0,
    dappleStrength: 0.65,
    rimLight: 0,
    crownBreath: 0,
    treelineEcho: false,
  },
  blooming: {
    horizonGlow: 0.14,
    moteCount: 6,
    moteOpacity: 0.4,
    dappleStrength: 0.75,
    rimLight: 0,
    crownBreath: 0,
    treelineEcho: false,
  },
  thriving: {
    horizonGlow: 0.18,
    moteCount: 8,
    moteOpacity: 0.55,
    dappleStrength: 0.85,
    rimLight: 0,
    crownBreath: 0,
    treelineEcho: false,
  },
  radiant: {
    horizonGlow: 0.26,
    moteCount: 10,
    moteOpacity: 0.9,
    dappleStrength: 1.0,
    rimLight: 0.7,
    crownBreath: 0,
    treelineEcho: false,
  },
  legend: {
    horizonGlow: 0.32,
    moteCount: 12,
    moteOpacity: 0.9,
    dappleStrength: 1.0,
    rimLight: 1.0,
    crownBreath: 1,
    treelineEcho: true,
  },
}

// ── Default fallback (no journey stage yet) ───────────────────
const DEFAULT_ATMOSPHERE = JOURNEY_ATMOSPHERE.seed

// ── Lookup function ───────────────────────────────────────────
// Accepts the canonical journeyStageKey from existing Glow Journey.
// Returns a frozen atmosphere config object. Pure function.
export function getAtmosphere(journeyStageKey) {
  if (!journeyStageKey) return DEFAULT_ATMOSPHERE
  return JOURNEY_ATMOSPHERE[journeyStageKey] || DEFAULT_ATMOSPHERE
}

// ── All valid Journey stage keys (mirror existing source) ─────
export const JOURNEY_STAGE_KEYS = [
  'seed',
  'sprout',
  'growing',
  'blooming',
  'thriving',
  'radiant',
  'legend',
]
