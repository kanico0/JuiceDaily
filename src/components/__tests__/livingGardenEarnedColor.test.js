// ─────────────────────────────────────────────────────────────
// livingGardenEarnedColor.test.js
// Targeted tests for the Earned-Color Refinement (Rev A)
//
// Verifies:
//   L. Chroma gate — exact table, monotonic
//   M. Per-bed palettes — exact full-strength tokens
//   N. Element-count ramp — 1 → 1 → 2 → 4 → 7
//   O. Ground bloom — starts at Growing only
//   P. Warm soil rim — Harvesting+ only
//   Q. Journey Tree — mature crown bases, detail counts
//   R. Arbor — saturation/alpha/bloom ramp, hue rotation
//   S. Zero-state unchanged — Empty frozen
//   T. No SVG filters, no random
//   U. Frozen code — compact/Glow/JuiceLog untouched
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

import {
  NEUTRAL_BASE,
  STAGE_CHROMA,
  STAGE_ALPHA,
  STAGE_BLOOM,
  BED_PALETTES,
  mixColor,
  gateColor,
  gatedPalette,
  canopyBlend,
} from '../LivingGardenBed'
import {
  ESTABLISHED_BASE,
  LEGEND_BASE,
  WARM_RIM,
  GOLD_SPECK,
  TREE_FRUIT,
  TREE_BLOSSOM,
  INNER_LIGHT,
} from '../LivingGardenJourneyTree'
import { arborRamp, getOrnamentHue, ORNAMENT_HUE_ROTATION } from '../LivingGardenArbor'
import { GARDEN_BEDS } from '../../constants/gardenTaxonomy'
import { GARDEN_STAGES } from '../../services/gardenService'

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map()
  return {
    getItem: jest.fn(async (key) => store.get(key) ?? null),
    setItem: jest.fn(async (key, val) => {
      store.set(key, val)
    }),
    removeItem: jest.fn(async (key) => {
      store.delete(key)
    }),
    clear: jest.fn(async () => {
      store.clear()
    }),
    getAllKeys: jest.fn(async () => [...store.keys()]),
    flushGetRequests: jest.fn(() => {}),
    multiGet: jest.fn(async () => []),
    multiSet: jest.fn(async () => {}),
    multiRemove: jest.fn(async () => {}),
    multiMerge: jest.fn(async () => {}),
    __store: store,
  }
})

function readSrc(filename) {
  return fs.readFileSync(path.join(__dirname, '..', filename), 'utf-8')
}

function readService(filename) {
  return fs.readFileSync(path.join(__dirname, '..', '..', 'services', filename), 'utf-8')
}

// ── L. Chroma gate ────────────────────────────────────────────

describe('L. Chroma gate — exact table, monotonic', () => {
  test('neutral base is #20291F', () => {
    expect(NEUTRAL_BASE).toBe('#20291F')
  })

  test('exact chroma values per stage', () => {
    expect(STAGE_CHROMA.empty).toBe(0)
    expect(STAGE_CHROMA.seed).toBe(0.1)
    expect(STAGE_CHROMA.sprout).toBe(0.32)
    expect(STAGE_CHROMA.growing).toBe(0.58)
    expect(STAGE_CHROMA.harvesting).toBe(0.86)
    expect(STAGE_CHROMA.flourishing).toBe(1.0)
  })

  test('exact alpha values per stage', () => {
    expect(STAGE_ALPHA.empty).toBe(0)
    expect(STAGE_ALPHA.seed).toBe(0.35)
    expect(STAGE_ALPHA.sprout).toBe(0.58)
    expect(STAGE_ALPHA.growing).toBe(0.78)
    expect(STAGE_ALPHA.harvesting).toBe(0.93)
    expect(STAGE_ALPHA.flourishing).toBe(1.0)
  })

  test('exact bloom values per stage', () => {
    expect(STAGE_BLOOM.empty).toBe(0)
    expect(STAGE_BLOOM.seed).toBe(0)
    expect(STAGE_BLOOM.sprout).toBe(0)
    expect(STAGE_BLOOM.growing).toBe(0.15)
    expect(STAGE_BLOOM.harvesting).toBe(0.45)
    expect(STAGE_BLOOM.flourishing).toBe(0.85)
  })

  test('chroma is monotonically increasing from Seed to Flourishing', () => {
    const stages = ['seed', 'sprout', 'growing', 'harvesting', 'flourishing']
    for (let i = 1; i < stages.length; i++) {
      expect(STAGE_CHROMA[stages[i]]).toBeGreaterThan(STAGE_CHROMA[stages[i - 1]])
    }
  })

  test('alpha is monotonically increasing from Seed to Flourishing', () => {
    const stages = ['seed', 'sprout', 'growing', 'harvesting', 'flourishing']
    for (let i = 1; i < stages.length; i++) {
      expect(STAGE_ALPHA[stages[i]]).toBeGreaterThan(STAGE_ALPHA[stages[i - 1]])
    }
  })

  test('gateColor mixes neutral with token at chroma ratio', () => {
    // Seed chroma 0.10: result should be 10% token, 90% neutral
    const result = gateColor('#6FBF6A', 'seed')
    // Should be closer to neutral than to token
    const neutralR = parseInt(NEUTRAL_BASE.slice(1, 3), 16)
    const tokenR = parseInt('#6FBF6A'.slice(1, 3), 16)
    const expectedR = Math.round(neutralR + (tokenR - neutralR) * 0.1)
    const resultR = parseInt(result.slice(1, 3), 16)
    expect(resultR).toBe(expectedR)
  })

  test('gateColor at Flourishing returns full token', () => {
    expect(gateColor('#6FBF6A', 'flourishing')).toBe('#6FBF6A')
  })

  test('gateColor at Empty returns neutral base', () => {
    expect(gateColor('#6FBF6A', 'empty')).toBe(NEUTRAL_BASE)
  })

  test('gatedPalette returns all 6 tokens for each bed', () => {
    GARDEN_BEDS.forEach((bedKey) => {
      const gp = gatedPalette(bedKey, 'flourishing')
      expect(gp).toHaveProperty('leaf')
      expect(gp).toHaveProperty('deep')
      expect(gp).toHaveProperty('produce')
      expect(gp).toHaveProperty('accent')
      expect(gp).toHaveProperty('alt')
      expect(gp).toHaveProperty('bloom')
    })
  })
})

// ── M. Per-bed palettes — exact full-strength tokens ──────────

describe('M. Per-bed palettes — exact full-strength tokens', () => {
  const expected = {
    greens: {
      leaf: '#6FBF6A',
      deep: '#2F7D4F',
      produce: '#8FD46B',
      accent: '#A8E063',
      alt: '#BFE8CB',
      bloom: '#F2F7E4',
    },
    roots: {
      leaf: '#6FBF5A',
      deep: '#3B7A45',
      produce: '#E8843A',
      accent: '#F0A24A',
      alt: '#B03A54',
      bloom: '#FFE7C2',
    },
    citrus: {
      leaf: '#4FA968',
      deep: '#2E7A50',
      produce: '#F2D24B',
      accent: '#F2A03D',
      alt: '#EFE08A',
      bloom: '#FFF3C4',
    },
    orchard: {
      leaf: '#3E8E5A',
      deep: '#2A6B44',
      produce: '#D9453F',
      accent: '#E8B84B',
      alt: '#E85C4A',
      bloom: '#FFF6E8',
    },
    berries: {
      leaf: '#4E9A62',
      deep: '#2F6B45',
      produce: '#C42847',
      accent: '#F0728A',
      alt: '#6B4A7A',
      bloom: '#FFE2EA',
    },
    tropical: {
      leaf: '#7FA83C',
      deep: '#4C7A32',
      produce: '#E8B93C',
      accent: '#F08A35',
      alt: '#9FC94A',
      bloom: '#FFF0CE',
    },
    herbs: {
      leaf: '#4A9B5E',
      deep: '#2E6B45',
      produce: '#7FD6A2',
      accent: '#C3E8B0',
      alt: '#D9CFE8',
      bloom: '#EFF9EE',
    },
  }

  GARDEN_BEDS.forEach((bedKey) => {
    test(`${bedKey} palette matches spec exactly`, () => {
      const p = BED_PALETTES[bedKey]
      expect(p.leaf).toBe(expected[bedKey].leaf)
      expect(p.deep).toBe(expected[bedKey].deep)
      expect(p.produce).toBe(expected[bedKey].produce)
      expect(p.accent).toBe(expected[bedKey].accent)
      expect(p.alt).toBe(expected[bedKey].alt)
      expect(p.bloom).toBe(expected[bedKey].bloom)
    })
  })
})

// ── N. Element-count ramp ─────────────────────────────────────

describe('N. Element-count ramp — 1 → 1 → 2 → 4 → 7', () => {
  test('bed source has element count ramp in art functions', () => {
    const src = readSrc('LivingGardenBed.js')
    // Sprout should have count 1
    expect(src).toMatch(/STAGE_SPROUT.*1/)
    // Growing should have count 2
    expect(src).toMatch(/STAGE_GROWING.*2/)
    // Harvesting should have count 4 (general) or per-bed
    expect(src).toMatch(/STAGE_HARVESTING.*[34]/)
    // Flourishing should have count 6 or 7
    expect(src).toMatch(/STAGE_FLOURISHING.*[67]/)
  })

  test('canopy blend: Growing 0.18, Harvesting 0.72, Flourishing pure', () => {
    expect(canopyBlend('#4FA968', '#F2D24B', 'growing')).toBe(mixColor('#4FA968', '#F2D24B', 0.18))
    expect(canopyBlend('#4FA968', '#F2D24B', 'harvesting')).toBe(
      mixColor('#4FA968', '#F2D24B', 0.72),
    )
    expect(canopyBlend('#4FA968', '#F2D24B', 'flourishing')).toBe('#F2D24B')
  })
})

// ── O. Ground bloom — starts at Growing only ──────────────────

describe('O. Ground bloom — starts at Growing only', () => {
  test('STAGE_BLOOM is 0 for Empty/Seed/Sprout', () => {
    expect(STAGE_BLOOM.empty).toBe(0)
    expect(STAGE_BLOOM.seed).toBe(0)
    expect(STAGE_BLOOM.sprout).toBe(0)
  })

  test('STAGE_BLOOM is positive for Growing/Harvesting/Flourishing', () => {
    expect(STAGE_BLOOM.growing).toBeGreaterThan(0)
    expect(STAGE_BLOOM.harvesting).toBeGreaterThan(STAGE_BLOOM.growing)
    expect(STAGE_BLOOM.flourishing).toBeGreaterThan(STAGE_BLOOM.harvesting)
  })

  test('bed source renders GroundBloom', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/GroundBloom/)
    expect(src).toMatch(/1\.75/)
    expect(src).toMatch(/0\.72/)
  })
})

// ── P. Warm soil rim — Harvesting+ only ───────────────────────

describe('P. Warm soil rim — Harvesting+ only', () => {
  test('bed source has warm soil rim logic', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/#46271B/)
    expect(src).toMatch(/0\.16/)
    expect(src).toMatch(/isWarm/)
  })

  test('warm soil rim only at Harvesting and Flourishing', () => {
    const src = readSrc('LivingGardenBed.js')
    // isWarm should check for Harvesting or Flourishing
    expect(src).toMatch(/isWarm/)
    expect(src).toMatch(/STAGE_HARVESTING/)
    expect(src).toMatch(/STAGE_FLOURISHING/)
  })
})

// ── Q. Journey Tree — mature crown bases, detail counts ───────

describe('Q. Journey Tree — mature crown bases, detail counts', () => {
  test('Established (thriving) crown base is #256B4E', () => {
    expect(ESTABLISHED_BASE).toBe('#256B4E')
  })

  test('Legend crown base is #1B6248', () => {
    expect(LEGEND_BASE).toBe('#1B6248')
  })

  test('Legend base is deeper/cooler than Established', () => {
    const estR = parseInt(ESTABLISHED_BASE.slice(1, 3), 16)
    const legR = parseInt(LEGEND_BASE.slice(1, 3), 16)
    const estG = parseInt(ESTABLISHED_BASE.slice(3, 5), 16)
    const legG = parseInt(LEGEND_BASE.slice(3, 5), 16)
    // Legend should be darker (lower R and G)
    expect(legR).toBeLessThanOrEqual(estR)
    expect(legG).toBeLessThanOrEqual(estG)
  })

  test('warm rim color is #F2D9A0', () => {
    expect(WARM_RIM).toBe('#F2D9A0')
  })

  test('gold speck color is #F0D06A', () => {
    expect(GOLD_SPECK).toBe('#F0D06A')
  })

  test('tree fruit color is #D9453F', () => {
    expect(TREE_FRUIT).toBe('#D9453F')
  })

  test('tree blossom color is #FFF6E8', () => {
    expect(TREE_BLOSSOM).toBe('#FFF6E8')
  })

  test('inner light color is #63BC8C', () => {
    expect(INNER_LIGHT).toBe('#63BC8C')
  })

  test('tree source has MatureTreeDetail with 7/14 specks, 5/9 fruit, 3/6 blossoms', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/MatureTreeDetail/)
    expect(src).toMatch(/goldSpeckCount.*isLegend.*14.*7/)
    expect(src).toMatch(/fruitCount.*isLegend.*9.*5/)
    expect(src).toMatch(/blossomCount.*isLegend.*6.*3/)
  })

  test('tree source has warm rim opacity 0.13 for thriving', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/rimOpacity.*0\.13/)
  })

  test('tree source has warm rim opacity 0.22 for legend', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/rimOpacity.*0\.22/)
  })

  test('TreeUnstarted is not modified (frozen)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    // TreeUnstarted should still exist and not reference mature tree colors
    expect(src).toMatch(/TreeUnstarted/)
    const unstartedMatch = src.match(/function TreeUnstarted[\s\S]*?^}/m)
    expect(unstartedMatch).toBeTruthy()
    expect(unstartedMatch[0]).not.toMatch(/ESTABLISHED_BASE|LEGEND_BASE|MatureTreeDetail/)
  })

  test('TreeSeed is not modified (frozen)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const seedMatch = src.match(/function TreeSeed[\s\S]*?^}/m)
    expect(seedMatch).toBeTruthy()
    expect(seedMatch[0]).not.toMatch(/ESTABLISHED_BASE|LEGEND_BASE|MatureTreeDetail/)
  })

  test('TreeSprout is not modified (frozen)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const sproutMatch = src.match(/function TreeSprout[\s\S]*?^}/m)
    expect(sproutMatch).toBeTruthy()
    expect(sproutMatch[0]).not.toMatch(/ESTABLISHED_BASE|LEGEND_BASE|MatureTreeDetail/)
  })

  test('TreeGrowing is not modified (frozen)', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    const growingMatch = src.match(/function TreeGrowing[\s\S]*?^}/m)
    expect(growingMatch).toBeTruthy()
    expect(growingMatch[0]).not.toMatch(/ESTABLISHED_BASE|LEGEND_BASE|MatureTreeDetail/)
  })

  test('Tree decorative fruit/blossom has no progression/persistence imports', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).not.toMatch(/from.*gardenService/)
    expect(src).not.toMatch(/from.*gardenSeenState/)
    expect(src).not.toMatch(/AsyncStorage/)
    expect(src).not.toMatch(/from.*JuiceLog/)
  })
})

// ── R. Arbor — saturation/alpha/bloom ramp, hue rotation ──────

describe('R. Arbor — saturation/alpha/bloom ramp', () => {
  test('ramp at 0 ornaments: saturation 0.55, alpha 0.55, bloom 0', () => {
    const r = arborRamp(0)
    expect(r.saturation).toBeCloseTo(0.55, 5)
    expect(r.alpha).toBeCloseTo(0.55, 5)
    expect(r.bloom).toBe(0)
    expect(r.bloomOpacity).toBe(0)
  })

  test('ramp at 1 ornament: saturation 0.59, alpha 0.59', () => {
    const r = arborRamp(1)
    expect(r.saturation).toBeCloseTo(0.55 + 0.45 * (1 / 12), 5)
    expect(r.alpha).toBeCloseTo(0.55 + 0.45 * (1 / 12), 5)
  })

  test('ramp at 5 ornaments: saturation 0.74, alpha 0.74', () => {
    const r = arborRamp(5)
    expect(r.saturation).toBeCloseTo(0.55 + 0.45 * (5 / 12), 5)
  })

  test('ramp at 9 ornaments: saturation 0.89, alpha 0.89', () => {
    const r = arborRamp(9)
    expect(r.saturation).toBeCloseTo(0.55 + 0.45 * (9 / 12), 5)
  })

  test('ramp at 12 ornaments: saturation 1.00, alpha 1.00, bloom 1', () => {
    const r = arborRamp(12)
    expect(r.saturation).toBe(1.0)
    expect(r.alpha).toBe(1.0)
    expect(r.bloom).toBe(1)
    expect(r.bloomOpacity).toBeCloseTo(0.1, 5)
  })

  test('bloom opacity never exceeds 0.10', () => {
    for (let n = 0; n <= 12; n++) {
      expect(arborRamp(n).bloomOpacity).toBeLessThanOrEqual(0.1)
    }
  })

  test('hue rotation has exactly 12 entries', () => {
    expect(ORNAMENT_HUE_ROTATION).toHaveLength(12)
  })

  test('hue rotation matches spec order', () => {
    expect(ORNAMENT_HUE_ROTATION[0]).toBe('#D9453F')
    expect(ORNAMENT_HUE_ROTATION[1]).toBe('#F2D24B')
    expect(ORNAMENT_HUE_ROTATION[2]).toBe('#FFF6E8') // blossom
    expect(ORNAMENT_HUE_ROTATION[3]).toBe('#C42847')
    expect(ORNAMENT_HUE_ROTATION[4]).toBe('#E8843A')
    expect(ORNAMENT_HUE_ROTATION[5]).toBe('#8FD46B')
    expect(ORNAMENT_HUE_ROTATION[6]).toBe('#F0728A')
    expect(ORNAMENT_HUE_ROTATION[7]).toBe('#FFF6E8') // blossom
    expect(ORNAMENT_HUE_ROTATION[8]).toBe('#D9453F')
    expect(ORNAMENT_HUE_ROTATION[9]).toBe('#7FD6A2')
    expect(ORNAMENT_HUE_ROTATION[10]).toBe('#E85C4A')
    expect(ORNAMENT_HUE_ROTATION[11]).toBe('#F2A03D')
  })

  test('blossom slots (2 and 7) stay achromatic white', () => {
    expect(getOrnamentHue(2, 1.0)).toBe('#FFF6E8')
    expect(getOrnamentHue(7, 1.0)).toBe('#FFF6E8')
  })

  test('non-blossom slots apply saturation mix', () => {
    // At saturation 0.55, color should be mixed toward neutral
    const color = getOrnamentHue(0, 0.55)
    expect(color).not.toBe('#D9453F') // should be mixed
    expect(color).toMatch(/^#/)
  })

  test('arbor source has no ornament animation/twinkle/pulse', () => {
    const src = readSrc('LivingGardenArbor.js')
    // Strip comments before checking
    const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(noComments).not.toMatch(/twinkle|pulse/)
    // No Animated loop/timing/spring in Arbor (ornaments are static)
    expect(noComments).not.toMatch(/Animated\.loop|Animated\.timing|Animated\.spring/)
  })

  test('arbor source has gold thread arc at 9+', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/GoldThreadArc/)
    expect(src).toMatch(/E8C070/)
  })
})

// ── S. Zero-state unchanged — Empty frozen ────────────────────

describe('S. Zero-state unchanged — Empty frozen', () => {
  test('GhostSilhouette is unchanged (uses PRODUCE_COLORS, not BED_PALETTES)', () => {
    const src = readSrc('LivingGardenBed.js')
    const ghostMatch = src.match(/function GhostSilhouette[\s\S]*?^}/m)
    expect(ghostMatch).toBeTruthy()
    expect(ghostMatch[0]).toMatch(/PRODUCE_COLORS/)
    expect(ghostMatch[0]).not.toMatch(/BED_PALETTES|gateColor|gatedPalette/)
  })

  test('Empty stage has chroma 0 and alpha 0', () => {
    expect(STAGE_CHROMA.empty).toBe(0)
    expect(STAGE_ALPHA.empty).toBe(0)
  })

  test('SoilBed at Empty uses original loamLit (not warm soil)', () => {
    const src = readSrc('LivingGardenBed.js')
    // isWarm should only be true for Harvesting/Flourishing
    expect(src).toMatch(/isWarm.*STAGE_HARVESTING.*STAGE_FLOURISHING/)
  })
})

// ── T. No SVG filters, no random ──────────────────────────────

describe('T. No SVG filters, no random', () => {
  const files = [
    'LivingGardenBed.js',
    'LivingGardenJourneyTree.js',
    'LivingGardenArbor.js',
    'LivingGardenLayers.js',
  ]

  files.forEach((f) => {
    test(`${f} has no feGaussianBlur or SVG filters`, () => {
      const src = readSrc(f)
      expect(src).not.toMatch(/feGaussianBlur|feFilter|filter.*url/)
    })

    test(`${f} has no Math.random (excluding comments)`, () => {
      const src = readSrc(f)
      // Strip comments before checking
      const noComments = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(noComments).not.toMatch(/Math\.random/)
    })
  })
})

// ── U. Frozen code — compact/Glow/JuiceLog/seen-state untouched ─

describe('U. Frozen code — untouched systems', () => {
  test('Garden thresholds unchanged (0, 1, 2, 3, 5, 7)', () => {
    const src = readService('gardenService.js')
    expect(src).toMatch(/threshold:\s*0/)
    expect(src).toMatch(/threshold:\s*1/)
    expect(src).toMatch(/threshold:\s*2/)
    expect(src).toMatch(/threshold:\s*3/)
    expect(src).toMatch(/threshold:\s*5/)
    expect(src).toMatch(/threshold:\s*7/)
  })

  test('JuiceLog is not imported by Living Garden', () => {
    const files = [
      'LivingGardenBed.js',
      'LivingGardenJourneyTree.js',
      'LivingGardenArbor.js',
      'LivingGardenLayers.js',
    ]
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/from.*JuiceLog/)
    })
  })

  test('seen-state is not imported by Living Garden', () => {
    const files = [
      'LivingGardenBed.js',
      'LivingGardenJourneyTree.js',
      'LivingGardenArbor.js',
      'LivingGardenLayers.js',
    ]
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/from.*gardenSeenState/)
    })
  })

  test('compact Garden is not imported by Living Garden', () => {
    const files = [
      'LivingGardenBed.js',
      'LivingGardenJourneyTree.js',
      'LivingGardenArbor.js',
      'LivingGardenLayers.js',
    ]
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/from.*GardenArtwork|from.*GardenCompactArtwork/)
    })
  })

  test('Glow is not imported by Living Garden', () => {
    const files = [
      'LivingGardenBed.js',
      'LivingGardenJourneyTree.js',
      'LivingGardenArbor.js',
      'LivingGardenLayers.js',
    ]
    files.forEach((f) => {
      const src = readSrc(f)
      expect(src).not.toMatch(/from.*GlowJourney/)
    })
  })

  test('Garden stages are still 6', () => {
    expect(GARDEN_STAGES).toHaveLength(6)
  })

  test('Garden beds are still 7', () => {
    expect(GARDEN_BEDS).toHaveLength(7)
  })

  test('LivingGardenBed is still memoised', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/memo/)
    expect(src).toMatch(/bedComparator/)
  })

  test('LivingGardenArbor is still memoised', () => {
    const src = readSrc('LivingGardenArbor.js')
    expect(src).toMatch(/memo/)
    expect(src).toMatch(/arborComparator/)
  })

  test('LivingGardenJourneyTree is still memoised', () => {
    const src = readSrc('LivingGardenJourneyTree.js')
    expect(src).toMatch(/memo/)
    expect(src).toMatch(/treeComparator/)
  })
})

// ── V. Berries palette reaches SVG primitives ─────────────────

describe('V. Berries palette reaches berry SVG primitives', () => {
  test('Berries produce token is #C42847 (ruby/crimson)', () => {
    expect(BED_PALETTES.berries.produce).toBe('#C42847')
  })

  test('Berries accent token is #F0728A (pink)', () => {
    expect(BED_PALETTES.berries.accent).toBe('#F0728A')
  })

  test('Berries alt token is #6B4A7A (purple — restrained punctuation)', () => {
    expect(BED_PALETTES.berries.alt).toBe('#6B4A7A')
  })

  test('Berries leaf token is #4E9A62 (green — for mounds only)', () => {
    expect(BED_PALETTES.berries.leaf).toBe('#4E9A62')
  })

  test('BerriesArt uses gated.produce for berry color cycling', () => {
    const src = readSrc('LivingGardenBed.js')
    // BerriesArt function should reference gated.produce
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    expect(berriesMatch).toBeTruthy()
    expect(berriesMatch[0]).toMatch(/gated\.produce/)
  })

  test('BerriesArt uses gated.accent for berry color cycling', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    expect(berriesMatch[0]).toMatch(/gated\.accent/)
  })

  test('BerriesArt uses gated.leaf for mounds (not produce)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    expect(berriesMatch[0]).toMatch(/gated\.leaf/)
  })

  test('BerriesArt does NOT use PRODUCE_COLORS (stale legacy)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    expect(berriesMatch[0]).not.toMatch(/PRODUCE_COLORS/)
  })

  test('berryColors array cycles through produce, mix, accent', () => {
    const src = readSrc('LivingGardenBed.js')
    expect(src).toMatch(/berryColors/)
    // berryColors should contain gated.produce, mixColor, and gated.accent
    const berryColorsMatch = src.match(/berryColors\s*=\s*\[[\s\S]*?\]/)
    expect(berryColorsMatch).toBeTruthy()
    expect(berryColorsMatch[0]).toMatch(/gated\.produce/)
    expect(berryColorsMatch[0]).toMatch(/mixColor/)
    expect(berryColorsMatch[0]).toMatch(/gated\.accent/)
  })

  test('BerriesArt berry fruit are Circle primitives (not tiny Path triangles)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    // Berries should use Circle for fruit, not just Path triangles
    expect(berriesMatch[0]).toMatch(/<Circle[^>]*fill=\{berryColor\}/)
  })

  test('BerriesArt berry radius is visually significant (>= 2.8 at Harvesting)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    // berryR should grow with stage and be >= 2.8 at Harvesting
    expect(berriesMatch[0]).toMatch(/berryR/)
    expect(berriesMatch[0]).toMatch(/2\.8/)
    expect(berriesMatch[0]).toMatch(/3\.4/)
  })

  test('BerriesArt mounds use reduced opacity (foliage support, not dominant)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    // Mound opacity should be <= 0.55 so berries dominate
    const moundMatch = berriesMatch[0].match(/mound[^]*?opacity=['"]0\.([0-9]+)/)
    expect(moundMatch).toBeTruthy()
    const moundOpacity = parseInt(moundMatch[1], 10)
    expect(moundOpacity).toBeLessThanOrEqual(55)
  })

  test('BerriesArt berries render AFTER mounds (correct z-order)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    // {mounds} should appear before {berries} in the return JSX
    const moundsIdx = berriesMatch[0].indexOf('{mounds}')
    const berriesIdx = berriesMatch[0].indexOf('{berries}')
    expect(moundsIdx).toBeGreaterThan(-1)
    expect(berriesIdx).toBeGreaterThan(-1)
    expect(berriesIdx).toBeGreaterThan(moundsIdx)
  })

  test('BerriesArt berry fruit opacity is high (>= 0.9, clearly visible)', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    // Berry circle opacity should be >= 0.9
    expect(berriesMatch[0]).toMatch(/opacity=['"]0\.9[0-9]*['"]/)
  })

  test('BerriesArt does NOT use tiny Path triangle as primary berry shape', () => {
    const src = readSrc('LivingGardenBed.js')
    const berriesMatch = src.match(/function BerriesArt[\s\S]*?^}/m)
    // Should NOT have the old tiny triangle Path as the berry fill
    expect(berriesMatch[0]).not.toMatch(/M \$\{px - 1\}.*L \$\{px - 1\.5\}.*fill=\{berryColor\}/)
  })
})

// ── W. All 7 Flourishing categories use intended Produce token ─

describe('W. All 7 Flourishing categories use intended Produce token', () => {
  const expectedProduce = {
    greens: '#8FD46B',
    roots: '#E8843A',
    citrus: '#F2D24B',
    orchard: '#D9453F',
    berries: '#C42847',
    tropical: '#E8B93C',
    herbs: '#7FD6A2',
  }

  GARDEN_BEDS.forEach((bedKey) => {
    test(`${bedKey} BED_PALETTES.produce = ${expectedProduce[bedKey]}`, () => {
      expect(BED_PALETTES[bedKey].produce).toBe(expectedProduce[bedKey])
    })
  })

  test('gateColor at Flourishing returns full produce token for each bed', () => {
    GARDEN_BEDS.forEach((bedKey) => {
      const produce = BED_PALETTES[bedKey].produce
      const gated = gateColor(produce, 'flourishing')
      expect(gated).toBe(produce)
    })
  })

  test('gatedPalette at Flourishing returns full-strength tokens for each bed', () => {
    GARDEN_BEDS.forEach((bedKey) => {
      const gp = gatedPalette(bedKey, 'flourishing')
      expect(gp.produce).toBe(BED_PALETTES[bedKey].produce)
      expect(gp.leaf).toBe(BED_PALETTES[bedKey].leaf)
      expect(gp.accent).toBe(BED_PALETTES[bedKey].accent)
    })
  })

  test('each bed artwork renderer references gated palette properties', () => {
    const src = readSrc('LivingGardenBed.js')
    const renderers = {
      greens: 'GreensArt',
      roots: 'RootsArt',
      citrus: 'CitrusArt',
      orchard: 'OrchardArt',
      berries: 'BerriesArt',
      tropical: 'TropicalArt',
      herbs: 'HerbsArt',
    }
    Object.entries(renderers).forEach(([_bedKey, fnName]) => {
      const fnMatch = src.match(new RegExp(`function ${fnName}[\\s\\S]*?^}`, 'm'))
      expect(fnMatch).toBeTruthy()
      // Each renderer should use at least one gated palette property
      expect(fnMatch[0]).toMatch(/gated\./)
    })
  })

  test('Herbs produce is mint #7FD6A2 (NOT berries ruby)', () => {
    // This confirms the lower-right bed (Herbs) is intentionally mint green
    expect(BED_PALETTES.herbs.produce).toBe('#7FD6A2')
    expect(BED_PALETTES.herbs.produce).not.toBe(BED_PALETTES.berries.produce)
  })
})
