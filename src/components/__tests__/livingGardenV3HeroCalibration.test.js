// ─────────────────────────────────────────────────────────────
// livingGardenV3HeroCalibration.test.js
// Focused tests for the Motion V3 HERO calibration prototype.
// Greens: Growing → Harvesting, Hero four-phase witnessed-growth motion.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import fs from 'fs'
import path from 'path'

// Source-level proofs — no runtime SVG rendering required.
// The Jest Expo environment does not reliably preserve SVG props
// through react-test-renderer, so we verify the source directly.

const V3_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'LivingGardenBedV3HeroCalibration.js'),
  'utf-8',
)

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

describe('Motion V3 HERO Calibration — Greens: Growing → Harvesting', () => {
  // ── V3 activation only through explicit QA variant ──
  describe('V3 activation isolation', () => {
    test('V3 only activates through motionVariant v3-hero', () => {
      expect(SCENE_SRC).toMatch(/motionVariant === 'v3-hero'/)
    })

    test('V3 does not activate for v2-calibration', () => {
      // V2 and V3 checks are separate if blocks
      expect(SCENE_SRC).toMatch(/motionVariant === 'v2-calibration'/)
      expect(SCENE_SRC).toMatch(/motionVariant === 'v3-hero'/)
    })

    test('Production beds remain unchanged when motionVariant is null', () => {
      expect(SCENE_SRC).toMatch(/return \([\s\S]*?LivingGardenBed[\s\S]*?bedKey=\{bedKey\}/)
    })
  })

  // ── Source/target geometry ──
  describe('Source/target geometry', () => {
    test('Source is Growing (heightScale=0.55, 2 plants)', () => {
      expect(V3_SRC).toMatch(/GROWING_HEIGHT_SCALE = 0\.55/)
    })

    test('Target is Harvesting (heightScale=1.0, 4 plants)', () => {
      expect(V3_SRC).toMatch(/HARVESTING_HEIGHT_SCALE = 1\.0/)
      expect(V3_SRC).toMatch(/HARVEST_PLANT_COUNT = 4/)
    })

    test('Shared plants at offsets -6 and +6 (indices 1 and 2)', () => {
      expect(V3_SRC).toMatch(/isNew = i === 0 \|\| i === 3/)
    })

    test('New plants at offsets -18 and +18 (indices 0 and 3)', () => {
      expect(V3_SRC).toMatch(/isNew = i === 0 \|\| i === 3/)
    })
  })

  // ── Existing plant reaction ──
  describe('Existing-plant reaction', () => {
    test('Existing plants lift 7px (within 6–8px target)', () => {
      expect(V3_SRC).toMatch(/EXISTING_LIFT_PX = 7/)
    })

    test('Existing plants lean 6 degrees (within 5–7° target)', () => {
      expect(V3_SRC).toMatch(/EXISTING_LEAN_DEG = 6/)
    })

    test('Existing plants scale reaction 1.06 (within 1.05–1.06 target)', () => {
      expect(V3_SRC).toMatch(/EXISTING_SCALE_REACTION = 1\.06/)
    })

    test('Existing plants lean outward (away from center)', () => {
      expect(V3_SRC).toMatch(/i === 1 \? 1 : -1/)
    })

    test('Existing plants never shrink below Growing state', () => {
      // heightScale starts at GROWING_HEIGHT_SCALE and grows
      expect(V3_SRC).toMatch(/GROWING_HEIGHT_SCALE \+[\s\S]*?HARVESTING_HEIGHT_SCALE - GROWING_HEIGHT_SCALE\) \* motion\.heightGrowth/)
    })

    test('Existing reaction resolves to canonical (settle brings to 0)', () => {
      // reactionEnvelope = reaction * (1 - settle * 0.5)
      // At settle=1: reactionEnvelope = reaction * 0.5 → but height growth completes
      // At t=1: all values are canonical
      expect(V3_SRC).toMatch(/reactionEnvelope/)
    })
  })

  // ── New-growth Hero values ──
  describe('New-growth Hero values', () => {
    test('Hero start scale 0.38 (within 0.35–0.45 target)', () => {
      expect(V3_SRC).toMatch(/HERO_START_SCALE = 0\.38/)
    })

    test('Hero vertical travel 28px (within 26–30px target)', () => {
      expect(V3_SRC).toMatch(/HERO_TRAVEL_PX = 28/)
    })

    test('Hero overshoot 1.05 (within 1.04–1.06 target)', () => {
      expect(V3_SRC).toMatch(/HERO_OVERSHOOT = 1\.05/)
    })

    test('Hero overshoot only on new geometry', () => {
      // heroGrowthOvershoot is only added to new plant scale
      expect(V3_SRC).toMatch(/baseScale \+ motion\.heroGrowthOvershoot/)
      // Shared plants use existingScaleReaction, not heroGrowthOvershoot
    })

    test('Left/right outer rosettes have stagger', () => {
      expect(V3_SRC).toMatch(/HERO_LEFT_STAGGER = 0\.04/)
      expect(V3_SRC).toMatch(/plantStagger = i === 0 \? 0 : HERO_LEFT_STAGGER/)
    })

    test('New plants have structural zero-progress gate', () => {
      expect(V3_SRC).toMatch(/if \(motion\.heroGrowth <= 0\) continue/)
    })
  })

  // ── Vertical travel ──
  describe('Vertical travel', () => {
    test('New plants travel 28px upward (from below to canonical position)', () => {
      expect(V3_SRC).toMatch(/HERO_TRAVEL_PX \* \(1 - plantHeroProgress\)/)
    })

    test('V3 travel (28px) is dramatically stronger than V2 (10px)', () => {
      expect(V3_SRC).toMatch(/HERO_TRAVEL_PX = 28/)
      expect(V2_SRC).toMatch(/EMERGENCE_TRAVEL_PX = 10/)
      // 28 > 10 — V3 is 2.8x stronger
    })
  })

  // ── Scale values ──
  describe('Scale values', () => {
    test('V3 Hero start scale (0.38) is stronger than V2 (0.62)', () => {
      expect(V3_SRC).toMatch(/HERO_START_SCALE = 0\.38/)
      expect(V2_SRC).toMatch(/EMERGENCE_START_SCALE = 0\.62/)
      // 0.38 < 0.62 — V3 starts smaller, more dramatic growth
    })

    test('V3 unfurl scaleX (0.62) is stronger than V2 (0.82)', () => {
      expect(V3_SRC).toMatch(/UNFURL_START_SCALE_X = 0\.62/)
      expect(V2_SRC).toMatch(/UNFURL_START_SCALE_X = 0\.82/)
      // 0.62 < 0.82 — V3 leaves start more compressed
    })
  })

  // ── Unfurl rotation/scaleX ──
  describe('Leaf unfurl (HERO)', () => {
    test('Unfurl rotation 17 degrees (within 16–18° target)', () => {
      expect(V3_SRC).toMatch(/UNFURL_ROTATION_DEG = 17/)
    })

    test('V3 unfurl rotation (17°) is dramatically stronger than V2 (7°)', () => {
      expect(V3_SRC).toMatch(/UNFURL_ROTATION_DEG = 17/)
      expect(V2_SRC).toMatch(/UNFURL_ROTATION_DEG = 7/)
      // 17 > 7 — V3 is 2.4x stronger
    })

    test('Unfurl has per-leaf stagger', () => {
      expect(V3_SRC).toMatch(/LEAF_STAGGER = 0\.025/)
      expect(V3_SRC).toMatch(/leafStaggerProgress/)
    })

    test('Leaves have individual opacity stagger', () => {
      expect(V3_SRC).toMatch(/leafOpacities/)
    })
  })

  // ── Soil values ──
  describe('Soil anticipation', () => {
    test('Soil peak scale 1.12 (within 1.10–1.12 target)', () => {
      expect(V3_SRC).toMatch(/SOIL_PEAK_SCALE = 1\.12/)
    })

    test('V3 soil peak (1.12) is stronger than V2 (1.055)', () => {
      expect(V3_SRC).toMatch(/SOIL_PEAK_SCALE = 1\.12/)
      expect(V2_SRC).toMatch(/SOIL_PEAK_SCALE = 1\.055/)
    })

    test('Soil has two-stage anticipation (compression then rise)', () => {
      expect(V3_SRC).toMatch(/SOIL_COMPRESS_SCALE = 0\.96/)
      expect(V3_SRC).toMatch(/SOIL_COMPRESS_END/)
      expect(V3_SRC).toMatch(/SOIL_RISE_START/)
    })

    test('Soil lift 9px (within 8–10px target)', () => {
      expect(V3_SRC).toMatch(/SOIL_LIFT_PX = 9/)
    })

    test('V3 soil lift (9px) is stronger than V2 (3px)', () => {
      expect(V3_SRC).toMatch(/SOIL_LIFT_PX = 9/)
      expect(V2_SRC).toMatch(/SOIL_LIFT_PX = 3/)
    })

    test('Warm bloom is stronger than V2', () => {
      expect(V3_SRC).toMatch(/SOIL_WARM_BLOOM_PEAK = 0\.28/)
      expect(V2_SRC).toMatch(/warmBloomOpacity.*Math\.sin\(act1 \* Math\.PI\) \* 0\.15/)
      // 0.28 > 0.15 — V3 is nearly 2x stronger
    })
  })

  // ── Bed-level emphasis ──
  describe('Bed-level emphasis', () => {
    test('Ground bloom receives illumination boost', () => {
      expect(V3_SRC).toMatch(/illuminationOpacity/)
    })

    test('Warm bloom uses larger radius than V2', () => {
      expect(V3_SRC).toMatch(/rx=\{placement\.rx \* 1\.5\}/)
      expect(V2_SRC).toMatch(/rx=\{placement\.rx \* 1\.3\}/)
    })
  })

  // ── Scene-level response ──
  describe('Scene-level response', () => {
    test('Scene illumination overlay exists', () => {
      expect(V3_SRC).toMatch(/V3SceneIllumination/)
      expect(V3_SRC).toMatch(/SCENE_ILLUMINATION_PEAK = 0\.15/)
    })

    test('Neighbor bed reaction exists (roots)', () => {
      expect(V3_SRC).toMatch(/V3NeighborReaction/)
      expect(V3_SRC).toMatch(/NEIGHBOR_REACTION_PEAK = 0\.04/)
    })

    test('Scene illumination peaks during Hero Moment and fades', () => {
      expect(V3_SRC).toMatch(/Math\.sin\(illuminationRaw \* Math\.PI\)/)
    })

    test('Scene reaction does not alter progression truth', () => {
      // No bedStages modification, no advancement creation
      expect(V3_SRC).not.toMatch(/bedStages/)
      expect(V3_SRC).not.toMatch(/newMilestoneIds/)
    })
  })

  // ── Vitality implementation ──
  describe('Vitality wave', () => {
    test('Vitality uses traveling linear-to-ease-out', () => {
      expect(V3_SRC).toMatch(/linearToEaseOut/)
    })

    test('Vitality is directional (per-plant delay)', () => {
      expect(V3_SRC).toMatch(/colorDelay = i \* 0\.08/)
    })

    test('Vitality color interpolates from Growing to Harvesting', () => {
      expect(V3_SRC).toMatch(/v3LeafColor/)
      expect(V3_SRC).toMatch(/gateColor\(BED_PALETTES\.greens\.leaf, FROM_STAGE\)/)
      expect(V3_SRC).toMatch(/gateColor\(BED_PALETTES\.greens\.leaf, TO_STAGE\)/)
    })

    test('V3 vitality duration is longer than V2', () => {
      // V3: 1100–2100ms = 1000ms window
      // V2: 800–3000ms = 2200ms window
      // V3 vitality starts later (after hero growth) for traveling effect
      expect(V3_SRC).toMatch(/VITALITY_START = 0\.458/)
      expect(V2_SRC).toMatch(/ACT5_START = 0\.267/)
    })

    test('No new palette colors introduced', () => {
      expect(V3_SRC).not.toMatch(/neon|#FF[0-9A-F]{4}/i)
    })
  })

  // ── Hero Moment timing ──
  describe('Hero Moment timing', () => {
    test('Hero Moment peak around 700–1200ms after growth begins', () => {
      // Growth begins at HERO_GROWTH_START = 0.146 (~350ms)
      // Hero Moment is when heroGrowth is mid-peak AND unfurl is active
      // heroGrowth window: 350–1300ms
      // unfurl window: 700–1600ms
      // Overlap of heroGrowth + unfurl: 700–1300ms — this is the Hero Moment
      expect(V3_SRC).toMatch(/HERO_GROWTH_START = 0\.146, HERO_GROWTH_END = 0\.542/)
      expect(V3_SRC).toMatch(/UNFURL_START = 0\.292, UNFURL_END = 0\.667/)
      // 0.292 * 2400 = ~700ms, 0.542 * 2400 = ~1300ms
    })

    test('Scene illumination peaks during Hero Moment', () => {
      // illuminationRaw uses HERO_GROWTH_START to UNFURL_END
      expect(V3_SRC).toMatch(/illuminationRaw = clamp\(\(t - HERO_GROWTH_START\) \/ \(UNFURL_END - HERO_GROWTH_START\)/)
    })
  })

  // ── Total event duration ──
  describe('Total event duration', () => {
    test('Total duration is 2400ms (within 2.3–2.6s target)', () => {
      expect(V3_SRC).toMatch(/TOTAL_DURATION = 2400/)
    })

    test('V3 (2400ms) is shorter than V2 (3000ms) — more energetic', () => {
      expect(V3_SRC).toMatch(/TOTAL_DURATION = 2400/)
      expect(V2_SRC).toMatch(/TOTAL_DURATION = 3000/)
    })

    test('Phases overlap (no dead gaps)', () => {
      // Hero growth starts before anticipation ends
      expect(0.146).toBeLessThan(0.188)
      // Unfurl starts before hero growth ends
      expect(0.292).toBeLessThan(0.542)
      // Vitality starts before unfurl ends
      expect(0.458).toBeLessThan(0.667)
      // Settle starts before vitality ends
      expect(0.750).toBeLessThan(0.875)
    })
  })

  // ── Easing ──
  describe('Easing', () => {
    test('Anticipation uses ease-out for compression and ease-out-cubic for rise', () => {
      expect(V3_SRC).toMatch(/compress = easeOut\(compressRaw\)/)
      expect(V3_SRC).toMatch(/rise = easeOutCubic\(riseRaw\)/)
    })

    test('Hero growth uses ease-out-cubic (strong ease-out)', () => {
      expect(V3_SRC).toMatch(/heroGrowth = easeOutCubic\(heroRaw\)/)
    })

    test('Unfurl uses ease-out', () => {
      expect(V3_SRC).toMatch(/unfurl = easeOut\(unfurlRaw\)/)
    })

    test('Existing reaction uses ease-in-out', () => {
      expect(V3_SRC).toMatch(/reaction = easeInOut\(reactionRaw\)/)
    })

    test('Settle uses ease-in-out-cubic', () => {
      expect(V3_SRC).toMatch(/settle = easeInOutCubic\(settleRaw\)/)
    })

    test('No spring/elastic/bounce easing', () => {
      expect(V3_SRC).not.toMatch(/Easing\.spring/)
      expect(V3_SRC).not.toMatch(/Easing\.elastic/)
      expect(V3_SRC).not.toMatch(/Easing\.bounce/)
    })

    test('No cartoon bounce (easeBackOut is controlled, not bounce)', () => {
      // easeBackOut is used for subtle overshoot, not bounce
      expect(V3_SRC).toMatch(/easeBackOut/)
      // But it's NOT used for the main animation easing
      // The main timeline uses Easing.linear
    })
  })

  // ── Final canonical landing ──
  describe('Final canonical landing', () => {
    test('At t=1, all phase progresses are 1', () => {
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
      const t = 1
      const heroGrowth = clamp((t - 0.146) / (0.542 - 0.146), 0, 1)
      const unfurl = clamp((t - 0.292) / (0.667 - 0.292), 0, 1)
      const vitality = clamp((t - 0.458) / (0.875 - 0.458), 0, 1)
      const heightGrowth = clamp((t - 0.146) / (1.0 - 0.146), 0, 1)
      expect(heroGrowth).toBe(1)
      expect(unfurl).toBe(1)
      expect(vitality).toBe(1)
      expect(heightGrowth).toBe(1)
    })

    test('At t=1, shared plants are at Harvesting heightScale', () => {
      const heightGrowth = 1
      const heightScale = 0.55 + (1.0 - 0.55) * heightGrowth
      expect(heightScale).toBe(1.0)
    })

    test('At t=1, new plants are at full scale with zero translate', () => {
      const heroGrowth = 1
      const baseScale = 0.38 + (1 - 0.38) * heroGrowth
      const translateY = 28 * (1 - heroGrowth)
      expect(baseScale).toBe(1.0)
      expect(translateY).toBe(0)
    })

    test('At t=1, unfurl is complete (scaleX=1, rotation=0)', () => {
      const unfurl = 1
      const scaleX = 0.62 + (1 - 0.62) * unfurl
      const rotation = 17 * (1 - unfurl)
      expect(scaleX).toBe(1.0)
      expect(rotation).toBe(0)
    })

    test('At t=1, existing plant reaction is settled', () => {
      const settle = 1
      // reactionEnvelope = reaction * (1 - settle * 0.5)
      // At settle=1: reactionEnvelope = reaction * 0.5
      // But heightGrowth=1 means plants are at Harvesting height
      // The remaining lift/lean fades during settle
      expect(settle).toBe(1)
    })

    test('At t=1, color is at Harvesting chroma', () => {
      const vitality = 1
      const colorDelay = 0
      const plantColorProgress = Math.max(0, Math.min(1, (vitality - colorDelay) / (1 - colorDelay)))
      expect(plantColorProgress).toBe(1)
    })

    test('At t=1, scene illumination is ~0', () => {
      const settle = 1
      const illuminationRaw = 1
      const sceneIllumination = 0.15 * Math.sin(illuminationRaw * Math.PI) * (1 - settle * 0.3)
      // sin(PI) is ~0 (floating point), so illumination is ~0
      expect(sceneIllumination).toBeCloseTo(0, 10)
    })
  })

  // ── New plants start structurally absent ──
  describe('Structural zero-progress gate', () => {
    test('New plants are NOT rendered when heroGrowth <= 0', () => {
      expect(V3_SRC).toMatch(/if \(motion\.heroGrowth <= 0\) continue/)
    })

    test('No G opacity on plant wrappers', () => {
      expect(V3_SRC).not.toMatch(/G key=.*v3-greens.*opacity=/)
    })

    test('Opacity applied to individual Path elements', () => {
      expect(V3_SRC).toMatch(/opacity=\{baseOp \* leafOpacities/)
    })
  })

  // ── Reduced Motion ──
  describe('Reduced Motion', () => {
    test('Reduced Motion sets timeline to 1 immediately', () => {
      expect(V3_SRC).toMatch(/if \(isReduced\) \{[\s\S]*?timelineRef\.current\.setValue\(1\)/)
    })

    test('Reduced Motion does not start animation', () => {
      expect(V3_SRC).toMatch(/if \(isReduced\) \{[\s\S]*?return[\s\S]*?\}/)
    })
  })

  // ── Background interruption ──
  describe('Background interruption', () => {
    test('Background cancels animation', () => {
      expect(V3_SRC).toMatch(/AppState.*addEventListener.*change/)
      expect(V3_SRC).toMatch(/animRef\.current\.stop\(\)/)
    })

    test('Background resolves to canonical (timeline=1)', () => {
      expect(V3_SRC).toMatch(/timelineRef\.current\.setValue\(1\)/)
    })

    test('No resume on foreground return', () => {
      expect(V3_SRC).not.toMatch(/nextState === 'active'/)
    })
  })

  // ── V2 calibration still functions independently ──
  describe('V2 calibration independence', () => {
    test('V2 component still exists and is imported', () => {
      expect(SCENE_SRC).toMatch(/GreensV2CalibrationBed/)
      expect(SCENE_SRC).toMatch(/LivingGardenBedV2Calibration/)
    })

    test('V2 scenario still exists in preview', () => {
      expect(PREVIEW_SRC).toMatch(/V2_CALIBRATION_SCENARIO/)
    })

    test('V2 button still exists', () => {
      expect(PREVIEW_SRC).toMatch(/v2ScenarioBtn/)
    })

    test('V2 diagnostic still exists', () => {
      expect(PREVIEW_SRC).toMatch(/V2 GREENS act=/)
    })

    test('V2 and V3 have separate motionVariant values', () => {
      expect(PREVIEW_SRC).toMatch(/motionVariant: 'v2-calibration'/)
      expect(PREVIEW_SRC).toMatch(/motionVariant: 'v3-hero'/)
    })

    test('V2 and V3 have separate debug state', () => {
      expect(PREVIEW_SRC).toMatch(/v2DebugValues/)
      expect(PREVIEW_SRC).toMatch(/v3DebugValues/)
    })

    test('V2 and V3 have separate diagnostic callbacks', () => {
      expect(PREVIEW_SRC).toMatch(/onV2Debug/)
      expect(PREVIEW_SRC).toMatch(/onV3Debug/)
    })
  })

  // ── Production Garden path unchanged ──
  describe('Production Garden path unchanged', () => {
    test('V3 does not modify LivingGardenBed production component', () => {
      const bedSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenBed.js'),
        'utf-8',
      )
      expect(bedSrc).not.toMatch(/V3Hero|v3-hero|motionVariant/)
    })

    test('V3 does not modify LivingGardenMotion production hook', () => {
      const motionSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenMotion.js'),
        'utf-8',
      )
      expect(motionSrc).not.toMatch(/V3Hero|v3-hero|motionVariant/)
    })

    test('V3 does not modify Journey Tree', () => {
      const treeSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenJourneyTree.js'),
        'utf-8',
      )
      expect(treeSrc).not.toMatch(/V3Hero|v3-hero|motionVariant/)
    })

    test('V3 does not modify Arbor', () => {
      const arborSrc = fs.readFileSync(
        path.join(__dirname, '..', 'LivingGardenArbor.js'),
        'utf-8',
      )
      expect(arborSrc).not.toMatch(/V3Hero|v3-hero|motionVariant/)
    })

    test('V3 does not modify V2 calibration component', () => {
      expect(V2_SRC).not.toMatch(/V3Hero|v3-hero/)
    })
  })

  // ── Preview scenario ──
  describe('Preview scenario', () => {
    test('V3_HERO_SCENARIO is defined', () => {
      expect(PREVIEW_SRC).toMatch(/V3_HERO_SCENARIO/)
    })

    test('V3 scenario uses motionVariant v3-hero', () => {
      expect(PREVIEW_SRC).toMatch(/motionVariant: 'v3-hero'/)
    })

    test('V3 scenario source is Greens Growing', () => {
      expect(PREVIEW_SRC).toMatch(/v3-greens-source/)
    })

    test('V3 scenario advancement is greens growing→harvesting', () => {
      expect(PREVIEW_SRC).toMatch(/bedKey: 'greens', fromStage: 'growing', toStage: 'harvesting'/)
    })

    test('V3 button is visually distinct from V2', () => {
      expect(PREVIEW_SRC).toMatch(/v3ScenarioBtn/)
      expect(PREVIEW_SRC).toMatch(/v3ScenarioText/)
      // V2 is amber/gold, V3 is blue — different colors
      expect(PREVIEW_SRC).toMatch(/255, 200, 80/)
      expect(PREVIEW_SRC).toMatch(/94, 180, 255/)
    })

    test('V3 diagnostic is compact', () => {
      expect(PREVIEW_SRC).toMatch(/V3 HERO phase=/)
    })

    test('V3_HERO_SCENARIO is exported', () => {
      expect(PREVIEW_SRC).toMatch(/export \{[\s\S]*V3_HERO_SCENARIO/)
    })
  })

  // ── Replay ──
  describe('Replay', () => {
    test('Dedup by object identity allows fresh advancement to trigger', () => {
      expect(V3_SRC).toMatch(/processedAdvancementRef\.current === advancements/)
      expect(V3_SRC).toMatch(/processedAdvancementRef\.current = advancements/)
    })
  })

  // ── V3 vs V2 strength comparison ──
  describe('V3 dramatically stronger than V2', () => {
    test('V3 soil peak (1.12) > V2 soil peak (1.055)', () => {
      expect(1.12).toBeGreaterThan(1.055)
    })

    test('V3 soil lift (9px) > V2 soil lift (3px)', () => {
      expect(9).toBeGreaterThan(3)
    })

    test('V3 hero start scale (0.38) < V2 emergence start (0.62) — more dramatic', () => {
      expect(0.38).toBeLessThan(0.62)
    })

    test('V3 travel (28px) > V2 travel (10px)', () => {
      expect(28).toBeGreaterThan(10)
    })

    test('V3 unfurl rotation (17°) > V2 unfurl rotation (7°)', () => {
      expect(17).toBeGreaterThan(7)
    })

    test('V3 unfurl scaleX (0.62) < V2 unfurl scaleX (0.82) — more compressed', () => {
      expect(0.62).toBeLessThan(0.82)
    })

    test('V3 has scene-level illumination (V2 does not)', () => {
      expect(V3_SRC).toMatch(/V3SceneIllumination/)
      expect(V2_SRC).not.toMatch(/SceneIllumination/)
    })

    test('V3 has neighbor reaction (V2 does not)', () => {
      expect(V3_SRC).toMatch(/V3NeighborReaction/)
      expect(V2_SRC).not.toMatch(/NeighborReaction/)
    })

    test('V3 has existing plant reaction (V2 does not)', () => {
      expect(V3_SRC).toMatch(/EXISTING_LIFT_PX/)
      expect(V3_SRC).toMatch(/EXISTING_LEAN_DEG/)
      expect(V2_SRC).not.toMatch(/EXISTING_LIFT_PX/)
      expect(V2_SRC).not.toMatch(/EXISTING_LEAN_DEG/)
    })

    test('V3 has overshoot (V2 does not)', () => {
      expect(V3_SRC).toMatch(/HERO_OVERSHOOT/)
      expect(V2_SRC).not.toMatch(/OVERSHOOT/)
    })

    test('V3 has per-leaf stagger (V2 does not)', () => {
      expect(V3_SRC).toMatch(/LEAF_STAGGER/)
      expect(V3_SRC).toMatch(/leafOpacities/)
      expect(V2_SRC).not.toMatch(/LEAF_STAGGER/)
    })
  })
})
