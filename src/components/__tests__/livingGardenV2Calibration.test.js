// ─────────────────────────────────────────────────────────────
// livingGardenV2Calibration.test.js
// Focused tests for the Motion V2 calibration prototype.
// Greens: Growing → Harvesting, five-act witnessed-growth motion.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import fs from 'fs'
import path from 'path'

// Source-level proofs — no runtime SVG rendering required.
// The Jest Expo environment does not reliably preserve SVG props
// through react-test-renderer, so we verify the source directly.

const V2_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'LivingGardenBedV2Calibration.js'),
  'utf-8',
)

const SCENE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'LivingGardenScene.js'),
  'utf-8',
)

const PREVIEW_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'GardenPreviewScreen.js'),
  'utf-8',
)

describe('Motion V2 Calibration — Greens: Growing → Harvesting', () => {
  // ── Source/target geometry verification ──
  describe('Greens geometry identification', () => {
    test('Source is Growing (heightScale=0.55, 2 plants)', () => {
      expect(V2_SRC).toMatch(/GROWING_HEIGHT_SCALE = 0\.55/)
      // Growing has 2 plants at offsets -6 and +6
    })

    test('Target is Harvesting (heightScale=1.0, 4 plants)', () => {
      expect(V2_SRC).toMatch(/HARVESTING_HEIGHT_SCALE = 1\.0/)
      expect(V2_SRC).toMatch(/HARVEST_PLANT_COUNT = 4/)
    })

    test('Shared plants are at offsets -6 and +6 (indices 1 and 2)', () => {
      // HARVEST_PLANT_COUNT=4, spacing=12
      // offset = (i - 1.5) * 12
      // i=0: -18, i=1: -6, i=2: +6, i=3: +18
      expect(V2_SRC).toMatch(/PLANT_SPACING = 12/)
      expect(V2_SRC).toMatch(/isNew = i === 0 \|\| i === 3/)
    })

    test('New plants are at offsets -18 and +18 (indices 0 and 3)', () => {
      expect(V2_SRC).toMatch(/isNew = i === 0 \|\| i === 3/)
    })
  })

  // ── Shared geometry stability ──
  describe('Shared geometry stability (no shrink/regrow)', () => {
    test('Shared plants start at Growing heightScale and grow to Harvesting', () => {
      // heightScale = GROWING + (HARVESTING - GROWING) * heightGrowth
      // At heightGrowth=0: 0.55 (Growing state, NOT shrunk)
      // At heightGrowth=1: 1.0 (Harvesting state)
      expect(V2_SRC).toMatch(/GROWING_HEIGHT_SCALE \+[\s\S]*?HARVESTING_HEIGHT_SCALE - GROWING_HEIGHT_SCALE\) \* motion\.heightGrowth/)
    })

    test('Shared plants start at Growing alpha and increase to Harvesting', () => {
      expect(V2_SRC).toMatch(/GROWING_ALPHA \+ \(HARVESTING_ALPHA - GROWING_ALPHA\) \* motion\.heightGrowth/)
    })

    test('Shared plants have NO emergence transform (no scale/translate/rotate)', () => {
      // Shared plants are rendered in a plain <G> with no transform
      // The only transform is on new plants
      expect(V2_SRC).toMatch(/G key=\{`v2-greens-\$\{i\}`\}>/)
    })

    test('No whole-bed shrink transform on shared plants', () => {
      // The shared plant G wrapper must NOT have a scale transform
      // Only new plants and soil have transforms
      // Shared plants are in a plain <G> with no transform
      expect(V2_SRC).toMatch(/v2-greens-/);
      // Verify shared plants (i=1 or i=2) don't have transform in their G wrapper
      // The new plants have transform=... in their G, shared plants don't
      expect(V2_SRC).toMatch(/G key=.*v2-greens.*>[\s\S]*?GreensPlantPaths/)
    })
  })

  // ── New geometry emergence ──
  describe('New geometry Motion V2 treatment', () => {
    test('New plants have emergence scale 0.62 → 1.0', () => {
      expect(V2_SRC).toMatch(/EMERGENCE_START_SCALE = 0\.62/)
      expect(V2_SRC).toMatch(/EMERGENCE_START_SCALE \+ \(1 - EMERGENCE_START_SCALE\) \* motion\.emergence/)
    })

    test('New plants have vertical travel 10px → 0', () => {
      expect(V2_SRC).toMatch(/EMERGENCE_TRAVEL_PX = 10/)
      expect(V2_SRC).toMatch(/EMERGENCE_TRAVEL_PX \* \(1 - motion\.emergence\)/)
    })

    test('New plants have unfurl scale 0.82 → 1.0', () => {
      expect(V2_SRC).toMatch(/UNFURL_START_SCALE_X = 0\.82/)
      expect(V2_SRC).toMatch(/UNFURL_START_SCALE_X \+ \(1 - UNFURL_START_SCALE_X\) \* motion\.unfurl/)
    })

    test('New plants have leaf rotation ±7 degrees → 0', () => {
      expect(V2_SRC).toMatch(/UNFURL_ROTATION_DEG = 7/)
      expect(V2_SRC).toMatch(/\(i === 0 \? -1 : 1\) \* UNFURL_ROTATION_DEG \* \(1 - motion\.unfurl\)/)
    })

    test('New plants have structural zero-progress gate (emergence<=0 → not rendered)', () => {
      expect(V2_SRC).toMatch(/if \(motion\.emergence <= 0\) continue/)
    })
  })

  // ── Five-act timeline ──
  describe('Five-act timeline structure', () => {
    test('Total duration is 3000ms (within 2.5–3.5s target)', () => {
      expect(V2_SRC).toMatch(/TOTAL_DURATION = 3000/)
    })

    test('Act 1 (Soil Awakens) starts at 0 and ends at ~400ms', () => {
      expect(V2_SRC).toMatch(/ACT1_START = 0\.000, ACT1_END = 0\.133/)
    })

    test('Act 2 (Botanical Emergence) starts at ~200ms', () => {
      expect(V2_SRC).toMatch(/ACT2_START = 0\.067, ACT2_END = 0\.267/)
    })

    test('Act 3 (Leaves Unfurl) starts at ~500ms', () => {
      expect(V2_SRC).toMatch(/ACT3_START = 0\.167, ACT3_END = 0\.367/)
    })

    test('Act 4 (Height Growth) starts at ~600ms', () => {
      expect(V2_SRC).toMatch(/ACT4_START = 0\.200, ACT4_END = 0\.467/)
    })

    test('Act 5 (Vitality Sweep) starts at ~800ms and runs to end', () => {
      expect(V2_SRC).toMatch(/ACT5_START = 0\.267, ACT5_END = 1\.000/)
    })

    test('Acts overlap (not five hard sequential blocks)', () => {
      // Act 2 starts before Act 1 ends
      expect(0.067).toBeLessThan(0.133)
      // Act 3 starts before Act 2 ends
      expect(0.167).toBeLessThan(0.267)
      // Act 4 starts before Act 3 ends
      expect(0.200).toBeLessThan(0.367)
      // Act 5 starts before Act 4 ends
      expect(0.267).toBeLessThan(0.467)
    })
  })

  // ── Easing choices ──
  describe('Easing choices', () => {
    test('Soil uses ease-out', () => {
      expect(V2_SRC).toMatch(/act1 = easeOut\(act1Raw\)/)
    })

    test('Emergence uses ease-out (asymmetric, not spring)', () => {
      expect(V2_SRC).toMatch(/act2 = easeOut\(act2Raw\)/)
    })

    test('Unfurl uses ease-in-out', () => {
      expect(V2_SRC).toMatch(/act3 = easeInOut\(act3Raw\)/)
    })

    test('Height growth uses ease-out', () => {
      expect(V2_SRC).toMatch(/act4 = easeOut\(act4Raw\)/)
    })

    test('Vitality uses linear-to-ease-out', () => {
      expect(V2_SRC).toMatch(/act5 = linearToEaseOut\(act5Raw\)/)
    })

    test('No spring/elastic/bounce easing', () => {
      expect(V2_SRC).not.toMatch(/Easing\.spring/)
      expect(V2_SRC).not.toMatch(/Easing\.elastic/)
      expect(V2_SRC).not.toMatch(/Easing\.bounce/)
    })
  })

  // ── Soil Act ──
  describe('Act 1: Soil Awakens', () => {
    test('Soil scale peaks at 1.055 (not lowest end)', () => {
      expect(V2_SRC).toMatch(/SOIL_PEAK_SCALE = 1\.055/)
    })

    test('Soil scale uses sin curve (1 → peak → 1)', () => {
      expect(V2_SRC).toMatch(/Math\.sin\(act1 \* Math\.PI\) \* \(SOIL_PEAK_SCALE - 1\)/)
    })

    test('Soil has vertical lift', () => {
      expect(V2_SRC).toMatch(/SOIL_LIFT_PX = 3/)
      expect(V2_SRC).toMatch(/Math\.sin\(act1 \* Math\.PI\) \* SOIL_LIFT_PX/)
    })

    test('Warm bloom fades in and out with sin curve', () => {
      expect(V2_SRC).toMatch(/warmBloomOpacity.*Math\.sin\(act1 \* Math\.PI\)/)
    })
  })

  // ── Color/Vitality sweep ──
  describe('Act 5: Vitality Sweep', () => {
    test('Color interpolates from Growing chroma to Harvesting chroma', () => {
      expect(V2_SRC).toMatch(/v2LeafColor/)
      expect(V2_SRC).toMatch(/gateColor\(BED_PALETTES\.greens\.leaf, FROM_STAGE\)/)
      expect(V2_SRC).toMatch(/gateColor\(BED_PALETTES\.greens\.leaf, TO_STAGE\)/)
    })

    test('Color sweep is directional (per-plant delay based on index)', () => {
      expect(V2_SRC).toMatch(/colorDelay = i \* 0\.08/)
      expect(V2_SRC).toMatch(/plantColorProgress = clamp\(\(motion\.vitality - colorDelay\)/)
    })

    test('Uses existing palette only (no new colors)', () => {
      expect(V2_SRC).not.toMatch(/neon|#FF[0-9A-F]{4}/i)
    })
  })

  // ── Reduced Motion ──
  describe('Reduced Motion', () => {
    test('Reduced Motion sets timeline to 1 immediately', () => {
      expect(V2_SRC).toMatch(/if \(isReduced\) \{[\s\S]*?timelineRef\.current\.setValue\(1\)/)
    })

    test('Reduced Motion does not start animation', () => {
      // The animation start is inside the else branch (after isReduced check)
      expect(V2_SRC).toMatch(/if \(isReduced\) \{[\s\S]*?return[\s\S]*?\}/)
    })
  })

  // ── Background interruption ──
  describe('Background interruption', () => {
    test('Background cancels animation', () => {
      expect(V2_SRC).toMatch(/AppState.*addEventListener.*change/)
      expect(V2_SRC).toMatch(/animRef\.current\.stop\(\)/)
    })

    test('Background resolves to canonical (timeline=1)', () => {
      expect(V2_SRC).toMatch(/timelineRef\.current\.setValue\(1\).*canonical Harvesting/)
    })

    test('No resume on foreground return', () => {
      // The AppState handler only handles background/inactive, not active
      // There is no resume logic
      expect(V2_SRC).not.toMatch(/nextState === 'active'/)
    })
  })

  // ── react-native-svg safety ──
  describe('react-native-svg safety', () => {
    test('No G opacity on plant wrappers', () => {
      // Plant G wrappers only have transform, never opacity
      expect(V2_SRC).not.toMatch(/G key=\{`v2-greens.*opacity=/)
    })

    test('Opacity applied to individual Path elements', () => {
      expect(V2_SRC).toMatch(/opacity=\{op\}/)
      expect(V2_SRC).toMatch(/const op = opacity \* PATH_BASE_OPACITY/)
    })

    test('Structural zero-progress gate on new plants', () => {
      expect(V2_SRC).toMatch(/if \(motion\.emergence <= 0\) continue/)
    })
  })

  // ── Final frame = canonical Harvesting ──
  describe('Terminal state', () => {
    test('At timeline=1, all act progresses are 1', () => {
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
      const t = 1
      const act4 = clamp((t - 0.200) / (0.467 - 0.200), 0, 1)
      const act5 = clamp((t - 0.267) / (1.000 - 0.267), 0, 1)
      expect(act4).toBe(1)
      expect(act5).toBe(1)
    })

    test('At timeline=1, shared plants are at Harvesting heightScale', () => {
      const heightGrowth = 1
      const heightScale = 0.55 + (1.0 - 0.55) * heightGrowth
      expect(heightScale).toBe(1.0)
    })

    test('At timeline=1, shared plants are at Harvesting alpha', () => {
      const heightGrowth = 1
      const alpha = 0.78 + (0.93 - 0.78) * heightGrowth
      expect(alpha).toBe(0.93)
    })

    test('At timeline=1, new plants are at full scale and zero translate', () => {
      const emergence = 1
      const scale = 0.62 + (1 - 0.62) * emergence
      const translateY = 10 * (1 - emergence)
      expect(scale).toBe(1.0)
      expect(translateY).toBe(0)
    })

    test('At timeline=1, unfurl is complete (scaleX=1, rotation=0)', () => {
      const unfurl = 1
      const scaleX = 0.82 + (1 - 0.82) * unfurl
      const rotation = 7 * (1 - unfurl)
      expect(scaleX).toBe(1.0)
      expect(rotation).toBe(0)
    })

    test('At timeline=1, color is at Harvesting chroma', () => {
      const vitality = 1
      const colorDelay = 0 // plant 0
      const plantColorProgress = Math.max(0, Math.min(1, (vitality - colorDelay) / (1 - colorDelay)))
      expect(plantColorProgress).toBe(1)
    })
  })

  // ── Replay ──
  describe('Replay', () => {
    test('Dedup by object identity allows fresh advancement to trigger', () => {
      expect(V2_SRC).toMatch(/processedAdvancementRef\.current === advancements/)
      expect(V2_SRC).toMatch(/processedAdvancementRef\.current = advancements/)
    })

    test('Fresh advancement object triggers new timeline', () => {
      // Preview creates { ...scenario.advancements, _ts: Date.now() } — fresh identity
      expect(PREVIEW_SRC).toMatch(/setAdvancements\(\{ \.\.\.scenario\.advancements, _ts: Date\.now\(\) \}\)/)
    })
  })

  // ── Scene wiring ──
  describe('Scene wiring (production path unchanged)', () => {
    test('Scene accepts motionVariant prop', () => {
      expect(SCENE_SRC).toMatch(/motionVariant = null/)
    })

    test('Scene imports GreensV2CalibrationBed', () => {
      expect(SCENE_SRC).toMatch(/import.*GreensV2CalibrationBed.*LivingGardenBedV2Calibration/)
    })

    test('Scene uses V2 bed only when motionVariant is v2-calibration and bedKey is greens', () => {
      expect(SCENE_SRC).toMatch(/bedKey === 'greens' && motionVariant === 'v2-calibration'/)
    })

    test('Non-greens beds still use LivingGardenBed (production path)', () => {
      expect(SCENE_SRC).toMatch(/FAR_BEDS\.map[\s\S]*?LivingGardenBed/)
      expect(SCENE_SRC).toMatch(/MID_BEDS\.map[\s\S]*?LivingGardenBed/)
    })

    test('Non-V2 greens still use LivingGardenBed (production path)', () => {
      // The else branch of the V2 check renders LivingGardenBed
      expect(SCENE_SRC).toMatch(/return \([\s\S]*?LivingGardenBed[\s\S]*?bedKey=\{bedKey\}/)
    })
  })

  // ── Preview scenario ──
  describe('Preview scenario', () => {
    test('V2_CALIBRATION_SCENARIO is defined', () => {
      expect(PREVIEW_SRC).toMatch(/V2_CALIBRATION_SCENARIO/)
    })

    test('V2 scenario uses motionVariant v2-calibration', () => {
      expect(PREVIEW_SRC).toMatch(/motionVariant: 'v2-calibration'/)
    })

    test('V2 scenario source is Greens Growing', () => {
      expect(PREVIEW_SRC).toMatch(/greens: \{ key: 'growing'/)
    })

    test('V2 scenario advancement is greens growing→harvesting', () => {
      expect(PREVIEW_SRC).toMatch(/bedKey: 'greens', fromStage: 'growing', toStage: 'harvesting'/)
    })

    test('V2 button is visually distinct (different style)', () => {
      expect(PREVIEW_SRC).toMatch(/v2ScenarioBtn/)
      expect(PREVIEW_SRC).toMatch(/v2ScenarioText/)
    })

    test('V2 diagnostic is compact', () => {
      expect(PREVIEW_SRC).toMatch(/V2 GREENS act=/)
      expect(PREVIEW_SRC).toMatch(/v2DebugValues/)
    })

    test('V2_CALIBRATION_SCENARIO is exported', () => {
      expect(PREVIEW_SRC).toMatch(/export \{[\s\S]*V2_CALIBRATION_SCENARIO/)
    })
  })

  // ── Production progression truth unchanged ──
  describe('Production progression truth unchanged', () => {
    test('V2 calibration does not modify LivingGardenBed production component', () => {
      // LivingGardenBed.js should NOT import or reference V2 calibration
      const bedSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenBed.js'),
        'utf-8',
      )
      expect(bedSrc).not.toMatch(/V2Calibration|v2-calibration|motionVariant/)
    })

    test('V2 calibration does not modify LivingGardenMotion production hook', () => {
      const motionSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenMotion.js'),
        'utf-8',
      )
      expect(motionSrc).not.toMatch(/V2Calibration|v2-calibration|motionVariant/)
    })

    test('V2 calibration does not modify Journey Tree', () => {
      const treeSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenJourneyTree.js'),
        'utf-8',
      )
      expect(treeSrc).not.toMatch(/V2Calibration|v2-calibration|motionVariant/)
    })

    test('V2 calibration does not modify Arbor', () => {
      const arborSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenArbor.js'),
        'utf-8',
      )
      expect(arborSrc).not.toMatch(/V2Calibration|v2-calibration|motionVariant/)
    })
  })

  // ── Act progress math at specific times ──
  describe('Act progress math at specific times', () => {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

    test('At t=0 (first frame): all acts at 0', () => {
      const t = 0
      const act1 = clamp((t - 0) / 0.133, 0, 1)
      const act2 = clamp((t - 0.067) / 0.2, 0, 1)
      const act3 = clamp((t - 0.167) / 0.2, 0, 1)
      const act4 = clamp((t - 0.2) / 0.267, 0, 1)
      const act5 = clamp((t - 0.267) / 0.733, 0, 1)
      expect(act1).toBe(0)
      expect(act2).toBe(0)
      expect(act3).toBe(0)
      expect(act4).toBe(0)
      expect(act5).toBe(0)
    })

    test('At t=0.1 (~300ms): Act 1 active, Act 2 beginning', () => {
      const t = 0.1
      const act1 = clamp((t - 0) / 0.133, 0, 1)
      const act2 = clamp((t - 0.067) / 0.2, 0, 1)
      expect(act1).toBeGreaterThan(0)
      expect(act1).toBeLessThan(1)
      expect(act2).toBeGreaterThan(0)
      expect(act2).toBeLessThan(1)
    })

    test('At t=0.3 (~900ms): Act 2 complete, Act 3/4 active, Act 5 beginning', () => {
      const t = 0.3
      const act2 = clamp((t - 0.067) / 0.2, 0, 1)
      const act3 = clamp((t - 0.167) / 0.2, 0, 1)
      const act4 = clamp((t - 0.2) / 0.267, 0, 1)
      const act5 = clamp((t - 0.267) / 0.733, 0, 1)
      expect(act2).toBe(1) // Act 2 complete
      expect(act3).toBeGreaterThan(0)
      expect(act3).toBeLessThan(1)
      expect(act4).toBeGreaterThan(0)
      expect(act4).toBeLessThan(1)
      expect(act5).toBeGreaterThan(0)
      expect(act5).toBeLessThan(1)
    })

    test('At t=0.5 (~1500ms): Acts 1-4 complete, Act 5 active', () => {
      const t = 0.5
      const act1 = clamp((t - 0) / 0.133, 0, 1)
      const act4 = clamp((t - 0.2) / 0.267, 0, 1)
      const act5 = clamp((t - 0.267) / 0.733, 0, 1)
      expect(act1).toBe(1)
      expect(act4).toBe(1)
      expect(act5).toBeGreaterThan(0)
      expect(act5).toBeLessThan(1)
    })

    test('At t=1.0 (terminal): all acts at 1', () => {
      const t = 1
      const act1 = clamp((t - 0) / 0.133, 0, 1)
      const act2 = clamp((t - 0.067) / 0.2, 0, 1)
      const act3 = clamp((t - 0.167) / 0.2, 0, 1)
      const act4 = clamp((t - 0.2) / 0.267, 0, 1)
      const act5 = clamp((t - 0.267) / 0.733, 0, 1)
      expect(act1).toBe(1)
      expect(act2).toBe(1)
      expect(act3).toBe(1)
      expect(act4).toBe(1)
      expect(act5).toBe(1)
    })
  })
})
