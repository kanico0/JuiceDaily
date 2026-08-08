// ─────────────────────────────────────────────────────────────
// exploreLayout.test.js — Regression test for the Explore screen
// layout correction: LiquidNutrientOrb removed from BrowseHome.
//
// Verifies:
//   1. BrowseHome no longer renders LiquidNutrientOrb
//   2. GlowJourneyDrop remains present exactly once in BrowseHome
//   3. "Welcome to Juicing" heading remains immediately after Glow
//   4. LiquidNutrientOrb is still used in other onboarding variants
//      (HeroStep, ScanHome) — not removed globally
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ScanScreen.js'), 'utf8')

// Extract the BrowseHome function body
function extractBrowseHome(source) {
  const start = source.indexOf('function BrowseHome(')
  expect(start).toBeGreaterThan(-1)
  // Find the next top-level function or export after BrowseHome
  const afterBrowse = source.indexOf('export default function', start)
  expect(afterBrowse).toBeGreaterThan(start)
  return source.substring(start, afterBrowse)
}

describe('Explore Layout — LiquidNutrientOrb removal from BrowseHome', () => {
  const browseHome = extractBrowseHome(SRC)

  test('1. BrowseHome does not render LiquidNutrientOrb', () => {
    expect(browseHome).not.toContain('<LiquidNutrientOrb')
  })

  test('2. BrowseHome does not reference orbWrap style', () => {
    // The orb wrapper View was removed along with the orb
    expect(browseHome).not.toContain('obStyles.orbWrap')
  })

  test('3. GlowJourneyDrop is present exactly once in BrowseHome', () => {
    const matches = browseHome.match(/<GlowJourneyDrop/g)
    expect(matches).not.toBeNull()
    expect(matches.length).toBe(1)
  })

  test('4. Welcome to Juicing heading is present in BrowseHome', () => {
    expect(browseHome).toContain('Welcome to Juicing')
  })

  test('5. GlowJourneyDrop appears before Welcome to Juicing', () => {
    const glowIdx = browseHome.indexOf('<GlowJourneyDrop')
    const welcomeIdx = browseHome.indexOf('Welcome to Juicing')
    expect(glowIdx).toBeGreaterThan(-1)
    expect(welcomeIdx).toBeGreaterThan(-1)
    expect(glowIdx).toBeLessThan(welcomeIdx)
  })

  test('6. LiquidNutrientOrb is still used in HeroStep (not removed globally)', () => {
    // HeroStep is an onboarding variant — should still have the orb
    const heroStart = SRC.indexOf('function HeroStep(')
    const heroEnd = SRC.indexOf('function TrackingHookStep(')
    const heroBody = SRC.substring(heroStart, heroEnd)
    expect(heroBody).toContain('<LiquidNutrientOrb')
  })

  test('7. LiquidNutrientOrb is still used in ScanHome (not removed globally)', () => {
    // ScanHome is another onboarding variant — should still have the orb
    const scanStart = SRC.indexOf('function ScanHome(')
    const scanEnd = SRC.indexOf('function BrowseHome(')
    const scanBody = SRC.substring(scanStart, scanEnd)
    expect(scanBody).toContain('<LiquidNutrientOrb')
  })

  test('8. LiquidNutrientOrb import remains (used by HeroStep/ScanHome)', () => {
    expect(SRC).toContain("import LiquidNutrientOrb from '../components/LiquidNutrientOrb'")
  })

  test('9. BrowseHome return starts with GlowJourneyDrop (no orb before it)', () => {
    // The return block should start with the Glow Journey comment/JSX
    const returnIdx = browseHome.indexOf('return (')
    expect(returnIdx).toBeGreaterThan(-1)
    const afterReturn = browseHome.substring(returnIdx)
    // The first content after return should be GlowJourneyDrop, not orbWrap
    const orbWrapIdx = afterReturn.indexOf('orbWrap')
    const glowIdx = afterReturn.indexOf('GlowJourneyDrop')
    expect(glowIdx).toBeGreaterThan(-1)
    // orbWrap should not appear at all in the return block
    expect(orbWrapIdx).toBe(-1)
  })
})
