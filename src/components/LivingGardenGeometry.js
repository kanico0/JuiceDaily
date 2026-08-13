// ─────────────────────────────────────────────────────────────
// LivingGardenGeometry.js — Precomputed seeded scatter constants
//
// All grass tufts, dapple pools, bed fringes, and mote positions
// are precomputed at module load using a deterministic seeded PRNG.
// Nothing generates geometry during React renders.
//
// Spec §4: "All scatter comes from a seeded PRNG, so the garden
// is pixel-identical on every launch."
//
// Spec §22: "Precompute every path string as a module constant.
// Nothing generates geometry at render time."
//
// No Math.random. Deterministic. Stable across launches.
// ─────────────────────────────────────────────────────────────

// ── Deterministic PRNG (mulberry32) ───────────────────────────
// Same seed → same sequence, every launch, every device.
function mulberry32(seed) {
  let a = seed | 0
  return function () {
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SCATTER_SEED = 20250101 // fixed scene seed

// ── Scene canvas constants ────────────────────────────────────
export const SCENE_WIDTH = 390
export const SCENE_HEIGHT = 720
export const HORIZON_Y = 268

// ── Bed placement map (spec §7) ───────────────────────────────
// Centre, bed radii, sprite scale, band.
export const BED_PLACEMENT = {
  orchard:  { cx: 318, cy: 388, rx: 46, ry: 14, scale: 1.02, band: 'far' },
  citrus:   { cx: 72,  cy: 394, rx: 46, ry: 14, scale: 1.05, band: 'far' },
  berries:  { cx: 330, cy: 478, rx: 56, ry: 18, scale: 1.22, band: 'mid' },
  tropical: { cx: 58,  cy: 490, rx: 58, ry: 19, scale: 1.26, band: 'mid' },
  herbs:    { cx: 322, cy: 596, rx: 66, ry: 22, scale: 1.46, band: 'near' },
  greens:   { cx: 62,  cy: 610, rx: 72, ry: 24, scale: 1.52, band: 'near' },
  roots:    { cx: 262, cy: 694, rx: 92, ry: 28, scale: 1.72, band: 'near' },
}

// ── Journey Tree placement (spec §10) ─────────────────────────
export const TREE_BASE = { x: 196, y: 344 }

// ── Arbor placement (spec §12) ────────────────────────────────
export const ARBOR = {
  postLeftX: 128,
  postRightX: 264,
  footingY: 410,
  springlineY: 330,
  apexY: 262,
  headRailUpperY: 356,
  headRailLowerY: 384,
}

// ── Precomputed grass tufts (static layer z05) ────────────────
// 28 tufts along the ground plane, deterministic positions.
function precomputeGrassTufts() {
  const rng = mulberry32(SCATTER_SEED)
  const tufts = []
  for (let i = 0; i < 28; i++) {
    tufts.push({
      x: 4 + rng() * (SCENE_WIDTH - 8),
      y: HORIZON_Y + 16 + rng() * (SCENE_HEIGHT - HORIZON_Y - 32),
      h: 3 + rng() * 5,
      lean: (rng() - 0.5) * 2.4,
    })
  }
  return tufts
}
export const GRASS_TUFTS = precomputeGrassTufts()

// ── Precomputed dapple pools (z02 ground detail) ──────────────
// 6 soft light pools on the ground, deterministic.
function precomputeDapplePools() {
  const rng = mulberry32(SCATTER_SEED + 100)
  const pools = []
  for (let i = 0; i < 6; i++) {
    pools.push({
      cx: 30 + rng() * (SCENE_WIDTH - 60),
      cy: HORIZON_Y + 30 + rng() * 200,
      rx: 40 + rng() * 60,
      ry: 14 + rng() * 18,
    })
  }
  return pools
}
export const DAPPLE_POOLS = precomputeDapplePools()

// ── Precomputed mote positions (z10 ambient motes) ────────────
// Up to 12 motes, deterministic. Actual count rendered depends on
// Journey atmosphere config. Positions are fixed; only opacity
// and animation differ by stage.
function precomputeMotes() {
  const rng = mulberry32(SCATTER_SEED + 200)
  const motes = []
  for (let i = 0; i < 12; i++) {
    motes.push({
      x: 20 + rng() * (SCENE_WIDTH - 40),
      y: HORIZON_Y - 20 + rng() * 300,
      r: 0.8 + rng() * 1.4,
      driftX: 4 + rng() * 8,
      driftY: -16 - rng() * 14,
      delay: -(rng() * 14),
      duration: 14 + rng() * 8,
    })
  }
  return motes
}
export const MOTE_POSITIONS = precomputeMotes()

// ── Precomputed bed fringe grass (per-bed) ────────────────────
// Each bed gets 4-6 fringe grass tufts at its soil line.
function precomputeBedFringes() {
  const fringes = {}
  const beds = Object.keys(BED_PLACEMENT)
  beds.forEach((bedKey, bedIdx) => {
    const rng = mulberry32(SCATTER_SEED + 300 + bedIdx * 17)
    const placement = BED_PLACEMENT[bedKey]
    const count = 4 + Math.floor(rng() * 3)
    const tufts = []
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.3
      tufts.push({
        x: placement.cx + Math.cos(angle) * placement.rx * 0.9,
        y: placement.cy + Math.sin(angle) * placement.ry * 0.9,
        h: 2.5 + rng() * 3.5,
        lean: (rng() - 0.5) * 2,
      })
    }
    fringes[bedKey] = tufts
  })
  return fringes
}
export const BED_FRINGES = precomputeBedFringes()

// ── Precomputed stepping stones along the path (z05) ──────────
function precomputeSteppingStones() {
  const rng = mulberry32(SCATTER_SEED + 400)
  const stones = []
  // Path enters bottom-left, curves right, straightens to Tree.
  // 7 stones along the path.
  for (let i = 0; i < 7; i++) {
    const t = (i + 1) / 8
    // Curve from (40, 660) through (196, 520) to (196, 420)
    const x = 40 + (196 - 40) * t + Math.sin(t * Math.PI) * 30
    const y = 660 - (660 - 420) * t
    stones.push({
      cx: x + (rng() - 0.5) * 6,
      cy: y + (rng() - 0.5) * 4,
      rx: 8 + rng() * 4,
      ry: 4 + rng() * 2,
    })
  }
  return stones
}
export const STEPPING_STONES = precomputeSteppingStones()

// ── Path geometry (z04) — static path string ──────────────────
// Path enters bottom-left, curves right, straightens toward Tree.
// Precomputed as a constant path string.
export const PATH_D = 'M 30 700 Q 60 640 110 580 Q 180 500 196 460 L 196 420'

// ── Treeline path (z01) — static distant treeline ─────────────
// A gentle wavy treeline along the horizon.
function precomputeTreeline() {
  const rng = mulberry32(SCATTER_SEED + 500)
  const points = []
  const segments = 24
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * SCENE_WIDTH
    const y = HORIZON_Y - 8 + Math.sin(i * 0.7) * 6 + (rng() - 0.5) * 8
    points.push({ x, y })
  }
  // Build path string
  let d = `M 0 ${HORIZON_Y} L 0 ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const midX = (prev.x + curr.x) / 2
    const midY = (prev.y + curr.y) / 2
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`
  }
  d += ` L ${SCENE_WIDTH} ${HORIZON_Y} Z`
  return d
}
export const TREELINE_D = precomputeTreeline()

// ── Bed soil blob paths (per-bed organic blob shape) ──────────
// Each bed has a seeded organic blob, not an ellipse (spec §7).
function precomputeBedBlobs() {
  const blobs = {}
  const beds = Object.keys(BED_PLACEMENT)
  beds.forEach((bedKey, bedIdx) => {
    const rng = mulberry32(SCATTER_SEED + 600 + bedIdx * 23)
    const placement = BED_PLACEMENT[bedKey]
    const segments = 12
    const points = []
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const variance = 0.85 + rng() * 0.3
      points.push({
        x: placement.cx + Math.cos(angle) * placement.rx * variance,
        y: placement.cy + Math.sin(angle) * placement.ry * variance,
      })
    }
    // Build smooth blob path
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
    for (let i = 0; i < segments; i++) {
      const curr = points[i]
      const next = points[(i + 1) % segments]
      const midX = ((curr.x + next.x) / 2).toFixed(2)
      const midY = ((curr.y + next.y) / 2).toFixed(2)
      d += ` Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${midX} ${midY}`
    }
    d += ' Z'
    blobs[bedKey] = d
  })
  return blobs
}
export const BED_BLOBS = precomputeBedBlobs()

// ── Produce palette (spec §3) ─────────────────────────────────
// Slightly deepened for the dark scene, but identity carried by
// growth form before colour (spec §8).
export const PRODUCE_COLORS = {
  greens: '#35A96B',
  roots: '#E8853A',
  citrus: '#F0C34E',
  orchard: '#E8574C',
  berries: '#C2415E',
  tropical: '#F2B23C',
  herbs: '#63AC84',
}

// ── Scene palette (spec §3) ───────────────────────────────────
export const SCENE_PALETTE = {
  nightTop: '#04100A',
  nightMid: '#081C12',
  horizon: '#123322',
  groundFar: '#12291B',
  groundMid: '#0F2417',
  groundNear: '#0A1710',
  loam: '#241A12',
  loamLit: '#3A2A1B',
  loamDark: '#1A120C',
  bark: '#4A3524',
  barkDark: '#2E2016',
  barkLight: '#6B4E33',
  timber: '#54402B',
  timberDark: '#3A2B1D',
  timberLight: '#7A5C3D',
  gold: '#D9A441',
  goldPale: '#F0D9A0',
  mist: '#A8C4B0',
  treeline: '#061309',
  pathColor: '#3E3626',
  pathColorNear: '#5A4E36',
}
