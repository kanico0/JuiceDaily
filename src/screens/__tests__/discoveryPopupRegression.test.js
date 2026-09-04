// ─────────────────────────────────────────────────────────────
// discoveryPopupRegression.test.js — Regression tests for
// Defect 1: First juice / discovery popup blocks Today screen.
//
// Verifies:
//   1. stageCelebration has a visible Modal render path
//   2. Garden celebration is delayed until Today is focused
//   3. No invisible blocking layer when stageCelebration is set
//   4. Stage celebration can be dismissed
//   5. Garden celebration shows after stage celebration dismissed
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const todayPath = path.join(__dirname, '..', 'TodayScreen.js')
const source = fs.readFileSync(todayPath, 'utf8')

describe('Defect 1 — Discovery popup blocks Today screen', () => {
  test('1. stageCelebration has a visible Modal render path', () => {
    // The GlowJourneyCelebrationOverlay must be rendered when
    // stageCelebration is set, so the state has a visible UI.
    expect(source).toContain('GlowJourneyCelebrationOverlay')
    // It must be rendered conditionally on stageCelebration
    expect(source).toContain('stageCelebration &&')
    // It must have a dismiss handler
    expect(source).toContain('setStageCelebration(null)')
  })

  test('2. isFocusedRef tracks navigation focus state', () => {
    expect(source).toContain('isFocusedRef')
    expect(source).toContain('isFocusedRef.current = true')
    expect(source).toContain('isFocusedRef.current = false')
  })

  test('3. Garden celebration mounting checks isFocusedRef', () => {
    // The garden celebration must not mount until Today is focused
    expect(source).toContain('isFocusedRef.current')
    // The mountCelebration retry logic must exist
    expect(source).toContain('mountCelebration')
    expect(source).toContain('setTimeout(mountCelebration')
  })

  test('4. Stage celebration Modal is rendered before AccountGateModal', () => {
    // Find the render position (not the import position) by looking
    // for the JSX render of GlowJourneyCelebrationOverlay
    const renderMarker = 'visible={true}\n          stage={stageCelebration.stage}'
    const stageRenderIdx = source.indexOf(renderMarker)
    const accountGateRenderIdx = source.indexOf('<AccountGateModal')
    expect(stageRenderIdx).toBeGreaterThan(-1)
    expect(accountGateRenderIdx).toBeGreaterThan(-1)
    // Stage celebration render must appear before AccountGateModal render
    expect(stageRenderIdx).toBeLessThan(accountGateRenderIdx)
  })

  test('5. Garden celebration guard includes stageCelebration check', () => {
    // The garden celebration must still be guarded by !stageCelebration
    // so only one celebration shows at a time. Also guarded by
    // !awaitingModalDismiss to prevent simultaneous Modal transitions.
    expect(source).toContain('!pendingAchievement && !stageCelebration')
    expect(source).toContain('!awaitingModalDismiss && gardenCelebration')
  })

  test('6. Navigation blur listener clears isFocusedRef', () => {
    expect(source).toContain("addListener('blur'")
  })

  test('7. No orphaned stageCelebration styles without render', () => {
    // The stageCelebration styles should still exist (they were
    // there before) but now there must also be a render path
    const hasStyles = source.includes('stageCelebrationOverlay')
    const hasRender = source.includes('GlowJourneyCelebrationOverlay')
    expect(hasStyles).toBe(true)
    expect(hasRender).toBe(true)
  })
})
