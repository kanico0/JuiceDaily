const fs = require('fs')
const path = require('path')

const BLEND_SERVICE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'quota', 'blendAllowanceService.ts'),
  'utf8',
)

const MODAL_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'AdvancedBlendModal.js'),
  'utf8',
)

const HOME_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)

describe('Advanced Blend Remaining Count Correction', () => {
  // 1. Shared selector exists
  test('1. getAdvancedBlendRemaining function exists in blendAllowanceService', () => {
    expect(BLEND_SERVICE_SRC).toContain('getAdvancedBlendRemaining')
  })

  // 2. Selector computes max(0, limit - usedCount)
  test('2. Selector uses max(0, FREE_ADVANCED_BLEND_ALLOWANCE - usedCount)', () => {
    const idx = BLEND_SERVICE_SRC.indexOf('getAdvancedBlendRemaining')
    const section = BLEND_SRC_SECTION(BLEND_SERVICE_SRC, idx, 300)
    expect(section).toContain('Math.max(0')
    expect(section).toContain('FREE_ADVANCED_BLEND_ALLOWANCE')
  })

  // 3. Pro users get unlimited (null)
  test('3. Selector returns null for Pro users', () => {
    const idx = BLEND_SERVICE_SRC.indexOf('getAdvancedBlendRemaining')
    const section = BLEND_SRC_SECTION(BLEND_SERVICE_SRC, idx, 300)
    expect(section).toContain('isPro')
    expect(section).toContain('return null')
  })

  // 4. Display text helper exists
  test('4. getAdvancedBlendRemainingText function exists', () => {
    expect(BLEND_SERVICE_SRC).toContain('getAdvancedBlendRemainingText')
  })

  // 5. Singular grammar for one remaining
  test('5. Singular grammar for one remaining analysis', () => {
    const idx = BLEND_SERVICE_SRC.indexOf('getAdvancedBlendRemainingText')
    const section = BLEND_SRC_SECTION(BLEND_SERVICE_SRC, idx, 600)
    expect(section).toContain('1 complimentary Expanded Ingredient Analysis remaining')
  })

  // 6. Plural grammar for multiple remaining
  test('6. Plural grammar for multiple remaining analyses', () => {
    const idx = BLEND_SERVICE_SRC.indexOf('getAdvancedBlendRemainingText')
    const section = BLEND_SRC_SECTION(BLEND_SERVICE_SRC, idx, 600)
    expect(section).toContain('Analyses remaining')
  })

  // 7. Zero remaining shows exhausted text
  test('7. Zero remaining shows exhausted text', () => {
    const idx = BLEND_SERVICE_SRC.indexOf('getAdvancedBlendRemainingText')
    const section = BLEND_SRC_SECTION(BLEND_SERVICE_SRC, idx, 600)
    expect(section).toContain('used all 3 complimentary')
  })

  // 8. Modal uses shared selector for display text
  test('8. AdvancedBlendModal imports getAdvancedBlendRemainingText', () => {
    expect(MODAL_SRC).toContain('getAdvancedBlendRemainingText')
  })

  // 9. Modal accepts isPro prop
  test('9. AdvancedBlendModal accepts isPro prop', () => {
    expect(MODAL_SRC).toContain('isPro')
  })

  // 10. HomeScreen uses shared selector
  test('10. HomeScreen imports getAdvancedBlendRemaining', () => {
    expect(HOME_SCREEN_SRC).toContain('getAdvancedBlendRemaining')
  })

  // 11. HomeScreen has blendUsedCount state
  test('11. HomeScreen tracks blendUsedCount state', () => {
    expect(HOME_SCREEN_SRC).toContain('blendUsedCount')
    expect(HOME_SCREEN_SRC).toContain('setBlendUsedCount')
  })

  // 12. Pre-analysis confirmation uses computed remaining
  test('12. Pre-analysis confirmation uses getAdvancedBlendRemaining', () => {
    const idx = HOME_SCREEN_SRC.indexOf("setAdvancedBlendStage('pre_analysis_confirmation')")
    const section = HOME_SCREEN_SRC.substring(idx, idx + 300)
    expect(section).toContain('currentRemaining')
    // Verify currentRemaining is derived from getAdvancedBlendRemaining
    const calcIdx = HOME_SCREEN_SRC.indexOf('const currentRemaining = getAdvancedBlendRemaining')
    expect(calcIdx).toBeGreaterThan(-1)
  })

  // 13. Fifth-ingredient notice uses computed remaining
  test('13. Fifth-ingredient notice uses getAdvancedBlendRemaining', () => {
    const idx = HOME_SCREEN_SRC.indexOf("setAdvancedBlendStage('fifth_ingredient_notice')")
    const section = HOME_SCREEN_SRC.substring(idx, idx + 300)
    // H3A fix: uses effectiveIsPro (canonical Pro) not legacy isPro
    expect(section).toContain('getAdvancedBlendRemaining(blendUsedCount, effectiveIsPro)')
  })

  // 14. Completion confirmation updates blendUsedCount from server
  test('14. Completion confirmation updates blendUsedCount from server result', () => {
    const idx = HOME_SCREEN_SRC.indexOf('setBlendUsedCount(allowanceResult')
    expect(idx).toBeGreaterThan(-1)
  })

  // 15. Allowance exhausted updates blendUsedCount
  test('15. Allowance exhausted updates blendUsedCount', () => {
    const idx = HOME_SCREEN_SRC.indexOf('setBlendUsedCount(err.result')
    expect(idx).toBeGreaterThan(-1)
  })

  // 16. No hard-coded 3 for remaining display
  test('16. No hard-coded FREE_ADVANCED_BLEND_ALLOWANCE for remaining display', () => {
    // The setAdvancedBlendRemaining calls should use getAdvancedBlendRemaining, not raw constant
    const pattern = /setAdvancedBlendRemaining\(FREE_ADVANCED_BLEND_ALLOWANCE\)/
    expect(pattern.test(HOME_SCREEN_SRC)).toBe(false)
  })

  // 17. Lifetime limit remains 3
  test('17. FREE_ADVANCED_BLEND_ALLOWANCE remains 3', () => {
    expect(BLEND_SERVICE_SRC).toContain('FREE_ADVANCED_BLEND_ALLOWANCE = 3')
  })

  // 18. Modal passes isPro to getAdvancedBlendModalContent
  test('18. Modal passes isPro to getAdvancedBlendModalContent', () => {
    expect(MODAL_SRC).toContain('getAdvancedBlendModalContent(stage, remaining, isPro)')
  })

  // 19. HomeScreen passes isPro to AdvancedBlendModal
  test('19. HomeScreen passes isPro to AdvancedBlendModal', () => {
    const idx = HOME_SCREEN_SRC.indexOf('<AdvancedBlendModal')
    const section = HOME_SCREEN_SRC.substring(idx, idx + 200)
    // H3A fix: passes effectiveIsPro (canonical Pro) not legacy isPro
    expect(section).toContain('isPro={effectiveIsPro}')
  })

  // 20. trackEvent for confirmation uses actual remaining
  test('20. trackEvent for confirmation uses actual remaining count', () => {
    const idx = HOME_SCREEN_SRC.indexOf('advanced_blend_confirmation_shown')
    const section = HOME_SCREEN_SRC.substring(idx, idx + 300)
    expect(section).toContain('currentRemaining')
  })
})

function BLEND_SRC_SECTION (src, idx, len) {
  return src.substring(idx, idx + len)
}
