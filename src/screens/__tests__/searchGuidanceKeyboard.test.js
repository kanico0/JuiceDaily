// ─────────────────────────────────────────────────────────────
// searchGuidanceKeyboard.test.js — Tests for Juice Snap
// ingredient-search guidance paragraphs 7 and 8, keyboard
// clearance, and scrolling behavior.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc (relPath) {
  const full = path.join(__dirname, relPath)
  return fs.readFileSync(full, 'utf8')
}

const HOME_SRC = readSrc('../../screens/HomeScreen.js')
const SCAN_SRC = readSrc('../../screens/ScanScreen.js')

// ── Approved paragraph text ───────────────────────────────────

const SIX_EXISTING_PARAGRAPHS = [
  "If no ingredients matched your search, don't worry—the ingredient may be listed under a shorter, simpler, or more familiar name in the app.",
  'Check the spelling carefully, remove any unnecessary words, and try entering the ingredient again using the name you would normally use while shopping.',
  'Try using a shorter or more general ingredient name, especially if you entered a color, variety, brand, preparation style, or other descriptive wording.',
  "For example, enter 'pepper' instead of a longer or more specific variety name, then review the available results for the closest matching ingredient.",
  'You can also test the search with a familiar fruit or vegetable such as spinach, carrot, cucumber, apple, celery, or kale to confirm that ingredient matching is working.',
  'If the ingredient still does not appear, clear the search completely, try another ingredient, and return later using a broader or more commonly recognized name.',
]

const PARAGRAPH_7 = 'If you are not seeing the exact ingredient you expected, try thinking of the most common everyday name that shoppers usually use in stores, kitchens, or recipes. A simpler name often makes it easier for the app to find the closest supported fruit, vegetable, herb, or ingredient.'

const PARAGRAPH_8 = 'Once you find the closest match, add it to your ingredient list and continue building your juice. You can review the full list before continuing, making the produce-entry process practical, flexible, and easier to complete even when an ingredient uses a slightly different name.'

const ALL_EIGHT = [...SIX_EXISTING_PARAGRAPHS, PARAGRAPH_7, PARAGRAPH_8]

// ══════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════

describe('Juice Snap Guidance — Paragraphs 7 and 8', () => {

  // ── 1. Six existing paragraphs remain unchanged ─────────────

  test('1. The six existing paragraphs remain unchanged', () => {
    for (const para of SIX_EXISTING_PARAGRAPHS) {
      expect(HOME_SRC).toContain(para)
    }
  })

  // ── 2. Paragraph 7 renders exactly ──────────────────────────

  test('2. Paragraph 7 renders exactly', () => {
    expect(HOME_SRC).toContain(PARAGRAPH_7)
  })

  // ── 3. Paragraph 8 renders exactly ──────────────────────────

  test('3. Paragraph 8 renders exactly', () => {
    expect(HOME_SRC).toContain(PARAGRAPH_8)
  })

  // ── 4. Exactly eight guidance paragraphs ────────────────────

  test('4. There are exactly eight guidance paragraphs', () => {
    let count = 0
    for (const para of ALL_EIGHT) {
      const escaped = para.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`<Text[^>]*>${escaped}</Text>`)
      if (regex.test(HOME_SRC)) count++
    }
    expect(count).toBe(8)
  })

  // ── 5. Paragraph ordering is 1 through 8 ────────────────────

  test('5. Paragraph ordering is 1 through 8', () => {
    const indices = ALL_EIGHT.map((para) => HOME_SRC.indexOf(para))
    // Each index must be found
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(-1)
    }
    // Each index must be greater than the previous
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })

  // ── 6. Paragraph spacing is consistent ──────────────────────

  test('6. Paragraph spacing is consistent', () => {
    // Paragraphs 1-7 use searchTipsParagraph style (with marginBottom)
    // Paragraph 8 uses searchTipsLastParagraph style (no marginBottom)
    expect(HOME_SRC).toContain('searchTipsParagraph')
    expect(HOME_SRC).toContain('searchTipsLastParagraph')

    // The 6th paragraph (index 5) should now use searchTipsParagraph
    // (not searchTipsLastParagraph) since it's no longer the last.
    const sixthIdx = HOME_SRC.indexOf(SIX_EXISTING_PARAGRAPHS[5])
    const sixthEnd = HOME_SRC.indexOf('</Text>', sixthIdx)
    const sixthSlice = HOME_SRC.substring(sixthIdx - 80, sixthEnd + 7)
    expect(sixthSlice).toContain('searchTipsParagraph')
    expect(sixthSlice).not.toContain('searchTipsLastParagraph')

    // The 8th paragraph should use searchTipsLastParagraph
    const eighthIdx = HOME_SRC.indexOf(PARAGRAPH_8)
    const eighthEnd = HOME_SRC.indexOf('</Text>', eighthIdx)
    const eighthSlice = HOME_SRC.substring(eighthIdx - 80, eighthEnd + 7)
    expect(eighthSlice).toContain('searchTipsLastParagraph')
  })

  // ── 7. Paragraph 8 is inside the scrollable content ─────────

  test('7. Paragraph 8 is inside the scrollable content', () => {
    const scrollViewIdx = HOME_SRC.indexOf('<ScrollView')
    const scrollViewEndIdx = HOME_SRC.indexOf('</ScrollView>')
    const para8Idx = HOME_SRC.indexOf(PARAGRAPH_8)
    expect(para8Idx).toBeGreaterThan(scrollViewIdx)
    expect(para8Idx).toBeLessThan(scrollViewEndIdx)
  })

  // ── 8. Keyboard-open state preserves scrolling ──────────────

  test('8. Keyboard-open state preserves scrolling', () => {
    // KeyboardAvoidingView wraps the ScrollView
    expect(HOME_SRC).toContain('KeyboardAvoidingView')
    // ScrollView is inside KeyboardAvoidingView
    const kavIdx = HOME_SRC.indexOf('KeyboardAvoidingView')
    const svIdx = HOME_SRC.indexOf('<ScrollView')
    expect(svIdx).toBeGreaterThan(kavIdx)
    // ScrollView has flex: 1
    expect(HOME_SRC).toContain("style={{ flex: 1 }}")
  })

  // ── 9. Bottom content padding/inset is sufficient ───────────

  test('9. Bottom content padding/inset is sufficient', () => {
    // The content container should have enough paddingBottom to
    // allow scrolling above the keyboard.
    const contentMatch = HOME_SRC.match(/content:\s*\{[^}]*\}/)
    expect(contentMatch).toBeTruthy()
    const content = contentMatch[0]
    // paddingBottom should be at least 60 (was 40, now 80)
    const pbMatch = content.match(/paddingBottom:\s*(\d+)/)
    expect(pbMatch).toBeTruthy()
    expect(parseInt(pbMatch[1], 10)).toBeGreaterThanOrEqual(60)
    // Keyboard height spacer also exists
    expect(HOME_SRC).toContain('keyboardHeight')
  })

  // ── 10. Search results remain selectable ────────────────────

  test('10. Search results remain selectable', () => {
    expect(HOME_SRC).toContain('keyboardShouldPersistTaps="handled"')
  })

  // ── 11. Produce chips remain selectable ─────────────────────

  test('11. Produce chips remain selectable', () => {
    expect(HOME_SRC).toContain('IngredientCloud')
    // Find the IngredientCloud render inside the ScrollView
    const svIdx = HOME_SRC.indexOf('<ScrollView')
    const svEndIdx = HOME_SRC.indexOf('</ScrollView>')
    const cloudRenderIdx = HOME_SRC.indexOf('IngredientCloud', svIdx)
    expect(cloudRenderIdx).toBeGreaterThan(svIdx)
    expect(cloudRenderIdx).toBeLessThan(svEndIdx)
  })

  // ── 12. Keyboard listeners are cleaned up ───────────────────

  test('12. Keyboard listeners are cleaned up', () => {
    expect(HOME_SRC).toContain('keyboardDidShow')
    expect(HOME_SRC).toContain('keyboardDidHide')
    expect(HOME_SRC).toContain('showSub.remove()')
    expect(HOME_SRC).toContain('hideSub.remove()')
  })

  // ── 13. No hook appears after BrowseIdeasModal early return ─

  test('13. No hook appears after BrowseIdeasModal early return', () => {
    // BrowseIdeasModal is in ScanScreen.js — verify the hook-order
    // crash fix is still in place: no hooks after the early return.
    expect(SCAN_SRC).toContain('BrowseIdeasModal')
    const modalStart = SCAN_SRC.indexOf('function BrowseIdeasModal(')
    expect(modalStart).toBeGreaterThan(-1)
    const modalBody = SCAN_SRC.substring(modalStart)
    const earlyReturn = modalBody.indexOf('if (!visible) return null')
    expect(earlyReturn).toBeGreaterThan(-1)
    // After the early return, there should be no hook calls
    // (useState, useEffect, useCallback, useRef, useMemo)
    const afterReturn = modalBody.substring(earlyReturn + 'if (!visible) return null'.length)
    // Check the next ~2000 chars for hook calls (before next function def)
    const nextFuncIdx = afterReturn.search(/\nfunction |\nconst \w+ = /)
    const checkRegion = nextFuncIdx > 0 ? afterReturn.substring(0, nextFuncIdx) : afterReturn.substring(0, 2000)
    expect(checkRegion).not.toContain('useState')
    expect(checkRegion).not.toContain('useEffect')
    expect(checkRegion).not.toContain('useCallback')
    expect(checkRegion).not.toContain('useRef')
    expect(checkRegion).not.toContain('useMemo')
  })

  // ── 14. Existing search guidance tests remain passing ───────

  test('14. Existing search guidance tests remain passing', () => {
    // Verify the existing test assertions from betaQaRound3 still hold
    expect(HOME_SRC).toContain('Permanent Search Tips — always visible')
    expect(HOME_SRC).toContain('accessibilityLabel="Search tips"')
    // All six original paragraphs are still present (tested in test 1)
    // The search tips card is not conditional on search state
    const tipsSection = HOME_SRC.substring(
      HOME_SRC.indexOf('Permanent Search Tips'),
      HOME_SRC.indexOf('searchTipsLastParagraph') + 50
    )
    expect(tipsSection).not.toContain('manualSearch.length')
    expect(tipsSection).not.toContain('{manualSearch &&')
  })
})
