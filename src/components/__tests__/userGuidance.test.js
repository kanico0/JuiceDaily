// ─────────────────────────────────────────────────────────────
// Regression tests for user guidance banners (Items 7 & 8)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const GARDEN_DETAIL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'GardenDetail.js'),
  'utf8',
)

const GLOW_JOURNEY_DETAIL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'GlowJourneyDetail.js'),
  'utf8',
)

describe('Item 7: RawLife Garden user guidance', () => {
  test('1. GardenDetail has a guidance banner section', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/guidanceBanner/)
  })

  test('2. guidance banner has a title', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/guidanceTitle/)
  })

  test('3. guidance banner has body text explaining how the garden works', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/guidanceBody/)
    expect(GARDEN_DETAIL_SRC).toContain('scan or log')
    expect(GARDEN_DETAIL_SRC).toContain('planted here')
  })

  test('4. guidance banner mentions discovering ingredients and colors', () => {
    expect(GARDEN_DETAIL_SRC).toContain('discover')
    expect(GARDEN_DETAIL_SRC).toContain('colors')
    expect(GARDEN_DETAIL_SRC).toContain('Rainbow Harvest')
  })

  test('5. guidance banner is placed before stats summary', () => {
    const guidanceIdx = GARDEN_DETAIL_SRC.indexOf('guidanceBanner')
    const statsIdx = GARDEN_DETAIL_SRC.indexOf('Stats summary')
    expect(guidanceIdx).toBeGreaterThan(-1)
    expect(statsIdx).toBeGreaterThan(-1)
    expect(guidanceIdx).toBeLessThan(statsIdx)
  })

  test('6. guidance banner styles are defined', () => {
    expect(GARDEN_DETAIL_SRC).toMatch(/guidanceBanner:\s*\{/)
    expect(GARDEN_DETAIL_SRC).toMatch(/guidanceTitle:\s*\{/)
    expect(GARDEN_DETAIL_SRC).toMatch(/guidanceBody:\s*\{/)
  })
})

describe('Item 8: Glow Journey user guidance', () => {
  test('7. GlowJourneyDetail has a guidance banner section', () => {
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/guidanceBanner/)
  })

  test('8. guidance banner has a title', () => {
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/guidanceTitle/)
  })

  test('9. guidance banner has body text explaining the Glow Journey', () => {
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/guidanceBody/)
    expect(GLOW_JOURNEY_DETAIL_SRC).toContain('streaks')
    expect(GLOW_JOURNEY_DETAIL_SRC).toContain('weekly goal')
  })

  test('10. guidance banner mentions lifetime stages', () => {
    expect(GLOW_JOURNEY_DETAIL_SRC).toContain('lifetime stages')
  })

  test('11. guidance banner references WEEKLY_GLOW_GOAL', () => {
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/WEEKLY_GLOW_GOAL/)
  })

  test('12. guidance banner is placed after artwork and before streak row', () => {
    const artworkIdx = GLOW_JOURNEY_DETAIL_SRC.indexOf('dropArtworkContainer')
    const guidanceIdx = GLOW_JOURNEY_DETAIL_SRC.indexOf('guidanceBanner')
    const streakIdx = GLOW_JOURNEY_DETAIL_SRC.indexOf('Glow Streak')
    expect(artworkIdx).toBeGreaterThan(-1)
    expect(guidanceIdx).toBeGreaterThan(-1)
    expect(streakIdx).toBeGreaterThan(-1)
    expect(guidanceIdx).toBeGreaterThan(artworkIdx)
    expect(guidanceIdx).toBeLessThan(streakIdx)
  })

  test('13. guidance banner styles are defined', () => {
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/guidanceBanner:\s*\{/)
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/guidanceTitle:\s*\{/)
    expect(GLOW_JOURNEY_DETAIL_SRC).toMatch(/guidanceBody:\s*\{/)
  })
})
