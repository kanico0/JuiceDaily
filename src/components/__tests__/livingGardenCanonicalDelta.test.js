// ─────────────────────────────────────────────────────────────
// livingGardenCanonicalDelta.test.js
// CANONICAL RESTORATION: Verifies Greens Harvesting artwork is
// restored to the pre-Gate-1.1 approved canonical state.
//
// Gate 1.1/1.2/1.3 experimental artwork has been surgically removed.
// Harvesting is again 4 canonical outline rosettes at [-18,-6,+6,+18].
// Growing remains unchanged.
// ─────────────────────────────────────────────────────────────

import 'react-native'
import React from 'react'
import fs from 'fs'
import path from 'path'

import { STAGE_CHROMA, STAGE_ALPHA, STAGE_BLOOM } from '../LivingGardenBed'

// Read source for invariant checks
const SRC_PATH = path.resolve(__dirname, '../LivingGardenBed.js')
const SRC = fs.readFileSync(SRC_PATH, 'utf8')

describe('Canonical Restoration — Greens Harvesting pre-Gate state', () => {
  // ── 1. Growing unchanged ──
  describe('Growing unchanged', () => {
    test('Growing heightScale remains 0.55', () => {
      expect(SRC).toMatch(/STAGE_GROWING \? 0\.55/)
    })

    test('Growing plantCount remains 2', () => {
      expect(SRC).toMatch(/STAGE_GROWING[\s\S]*?\? 2/)
    })

    test('Growing uses uniform spacing', () => {
      expect(SRC).toMatch(/\(i - \(plantCount - 1\) \/ 2\) \* 12/)
    })

    test('Growing chroma remains 0.58', () => {
      expect(STAGE_CHROMA.growing).toBe(0.58)
    })

    test('Growing alpha remains 0.78', () => {
      expect(STAGE_ALPHA.growing).toBe(0.78)
    })

    test('Growing bloom remains 0.15', () => {
      expect(STAGE_BLOOM.growing).toBe(0.15)
    })
  })

  // ── 2. Harvesting restored to pre-Gate geometry ──
  describe('Harvesting restored to 4 canonical rosettes', () => {
    test('Harvesting plantCount is 4', () => {
      expect(SRC).toMatch(/STAGE_HARVESTING[\s\S]*?\? 4/)
    })

    test('Harvesting heightScale is 1.0 (else branch)', () => {
      // heightScale: Sprout=0.25, Growing=0.55, else=1.0
      expect(SRC).toMatch(/STAGE_GROWING \? 0\.55 : 1\.0/)
    })

    test('Harvesting uses uniform spacing (i - 1.5) * 12', () => {
      // With plantCount=4: (i - 1.5) * 12 = [-18, -6, +6, +18]
      expect(SRC).toMatch(/\(i - \(plantCount - 1\) \/ 2\) \* 12/)
    })

    test('Harvesting offsets compute to [-18, -6, +6, +18]', () => {
      const plantCount = 4
      const offsets = []
      for (let i = 0; i < plantCount; i++) {
        offsets.push((i - (plantCount - 1) / 2) * 12)
      }
      expect(offsets).toEqual([-18, -6, 6, 18])
    })

    test('Harvesting uses h = 18 * heightScale (literal 18)', () => {
      expect(SRC).toMatch(/const h = 18 \* heightScale/)
    })

    test('Harvesting uses strokeWidth 1.4 (literal)', () => {
      expect(SRC).toMatch(/strokeWidth="1\.4"/)
    })

    test('Harvesting uses fill="none" (outline strokes, not filled)', () => {
      expect(SRC).toMatch(/fill="none"/)
    })

    test('Harvesting uses canonical outer path Q px±6 py-h*0.6 px±4 py-h', () => {
      expect(SRC).toMatch(/Q \$\{px - 6\} \$\{py - h \* 0\.6\} \$\{px - 4\} \$\{py - h\}/)
      expect(SRC).toMatch(/Q \$\{px \+ 6\} \$\{py - h \* 0\.6\} \$\{px \+ 4\} \$\{py - h\}/)
    })

    test('Harvesting uses canonical inner path Q px±3 py-h*0.7 px±1 py-h*1.1', () => {
      expect(SRC).toMatch(/Q \$\{px - 3\} \$\{py - h \* 0\.7\} \$\{px - 1\} \$\{py - h \* 1\.1\}/)
      expect(SRC).toMatch(/Q \$\{px \+ 3\} \$\{py - h \* 0\.7\} \$\{px \+ 1\} \$\{py - h \* 1\.1\}/)
    })
  })

  // ── 3. Harvesting stage color/alpha/bloom preserved ──
  describe('Harvesting stage values preserved', () => {
    test('Harvesting chroma remains 0.86', () => {
      expect(STAGE_CHROMA.harvesting).toBe(0.86)
    })

    test('Harvesting alpha remains 0.93', () => {
      expect(STAGE_ALPHA.harvesting).toBe(0.93)
    })

    test('Harvesting bloom remains 0.45', () => {
      expect(STAGE_BLOOM.harvesting).toBe(0.45)
    })

    test('Warm soil rim present for Harvesting', () => {
      expect(SRC).toMatch(/isWarm.*STAGE_HARVESTING.*STAGE_FLOURISHING/)
    })
  })

  // ── 4. No Gate 1.1/1.2/1.3 experimental production rendering remains ──
  describe('No Gate experimental artifacts in production code', () => {
    test('No HARVEST_ANCHORS constant', () => {
      expect(SRC).not.toMatch(/const HARVEST_ANCHORS/)
    })

    test('No HARVEST_ROSETTES constant', () => {
      expect(SRC).not.toMatch(/const HARVEST_ROSETTES/)
    })

    test('No HARVEST_OFFSETS constant', () => {
      expect(SRC).not.toMatch(/const HARVEST_OFFSETS/)
    })

    test('No HARVEST_LEAF_TEMPLATES_REAR constant', () => {
      expect(SRC).not.toMatch(/const HARVEST_LEAF_TEMPLATES_REAR/)
    })

    test('No HARVEST_LEAF_TEMPLATES_FRONT constant', () => {
      expect(SRC).not.toMatch(/const HARVEST_LEAF_TEMPLATES_FRONT/)
    })

    test('No HARVEST_MICRO_LEAF_COUNT constant', () => {
      expect(SRC).not.toMatch(/HARVEST_MICRO_LEAF_COUNT/)
    })

    test('No microLeafPath function', () => {
      expect(SRC).not.toMatch(/function microLeafPath/)
    })

    test('No renderHarvestMicroFoliage function', () => {
      expect(SRC).not.toMatch(/function renderHarvestMicroFoliage/)
    })

    test('No GREENS_LEAF_HEIGHT_BASE constant', () => {
      expect(SRC).not.toMatch(/const GREENS_LEAF_HEIGHT_BASE/)
    })

    test('No GREENS_STROKE_WIDTH constant', () => {
      expect(SRC).not.toMatch(/const GREENS_STROKE_WIDTH/)
    })

    test('No HARVEST_OUTWARD constants', () => {
      expect(SRC).not.toMatch(/HARVEST_OUTWARD/)
    })

    test('No HARVEST_FILLER constants', () => {
      expect(SRC).not.toMatch(/HARVEST_FILLER/)
    })

    test('No Harvesting early-return branch', () => {
      expect(SRC).not.toMatch(/stageKey === STAGE_HARVESTING[\s\S]*?return renderHarvest/)
    })

    test('No filled micro-foliage Path in GreensArt', () => {
      // GreensArt should only have fill="none" paths
      const greensMatch = SRC.match(/function GreensArt[\s\S]*?^}/m)
      expect(greensMatch).toBeTruthy()
      expect(greensMatch[0]).not.toMatch(/fill=\{color\}/)
    })
  })

  // ── 5. Deterministic rendering ──
  describe('Deterministic rendering', () => {
    test('No Math.random in source', () => {
      const codeLines = SRC.split('\n').filter((l) => !l.trim().startsWith('//'))
      const code = codeLines.join('\n')
      expect(code).not.toMatch(/Math\.random/)
    })

    test('No Date.now in source', () => {
      expect(SRC).not.toMatch(/Date\.now/)
    })

    test('No random/jitter/shuffle/uuid in source', () => {
      expect(SRC).not.toMatch(/[^a-zA-Z]random[^a-zA-Z]/)
      expect(SRC).not.toMatch(/jitter/)
      expect(SRC).not.toMatch(/shuffle/)
      expect(SRC).not.toMatch(/uuid/)
    })
  })

  // ── 6. Stage thresholds unchanged ──
  describe('Stage thresholds unchanged', () => {
    test('Six stages remain', () => {
      const stages = Object.keys(STAGE_CHROMA).sort()
      expect(stages).toEqual(['empty', 'flourishing', 'growing', 'harvesting', 'seed', 'sprout'])
    })

    test('Flourishing chroma remains 1.0', () => {
      expect(STAGE_CHROMA.flourishing).toBe(1.0)
    })
  })

  // ── 7. Single GreensArt code path (no Harvesting branch) ──
  describe('Single GreensArt code path', () => {
    test('GreensArt has no Harvesting-specific early return', () => {
      const greensMatch = SRC.match(/function GreensArt[\s\S]*?^}/m)
      expect(greensMatch).toBeTruthy()
      expect(greensMatch[0]).not.toMatch(/if \(stageKey === STAGE_HARVESTING\)/)
    })

    test('GreensArt uses single loop for all non-Seed stages', () => {
      const greensMatch = SRC.match(/function GreensArt[\s\S]*?^}/m)
      expect(greensMatch).toBeTruthy()
      expect(greensMatch[0]).toMatch(/for \(let i = 0; i < plantCount; i\+\+\)/)
    })
  })
})
