// ─────────────────────────────────────────────────────────────
// historyModalScrolling.test.js — Integration/regression tests
// for the EntryDetailsModal restructuring that fixes the Galaxy
// S22 Ultra scrolling / Make This Juice Again reachability defect.
//
// Proves:
//   1. Modal overlay is a View (not a Pressable wrapper).
//   2. Backdrop is a separate Pressable with absoluteFill.
//   3. Card is a View (not a Pressable with stopPropagation).
//   4. Card parent does not use overflow:hidden.
//   5. ScrollView contains Make Again and Delete.
//   6. Overlay applies safe-area top inset.
//   7. Overlay applies safe-area bottom inset.
//   8. Newest free preview still receives canMakeAgain.
//   9. Locked non-preview behavior unchanged.
//  10. Backdrop Pressable is behind the card (appears before card).
//  11. ScrollView has nestedScrollEnabled.
//  12. Card header has top border radius for corner treatment.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const HISTORY_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HistoryScreen.js'),
  'utf8',
)

// Extract the EntryDetailsModal return block
const MODAL_BLOCK = HISTORY_SRC.substring(
  HISTORY_SRC.indexOf('function EntryDetailsModal'),
  HISTORY_SRC.indexOf('// ── Day Section'),
)

describe('History EntryDetailsModal — scrolling restructuring', () => {
  test('1. modal overlay is a View, not a Pressable wrapper', () => {
    // The overlay should be a <View> not a <Pressable> so it doesn't
    // intercept scroll gestures
    const overlayIdx = MODAL_BLOCK.indexOf('ms.overlay')
    const section = MODAL_BLOCK.substring(overlayIdx - 50, overlayIdx + 100)
    expect(section).toContain('<View')
    expect(section).not.toContain('<Pressable style={ms.overlay}')
  })

  test('2. backdrop is a separate Pressable with absoluteFill', () => {
    expect(MODAL_BLOCK).toContain('StyleSheet.absoluteFill')
    // The backdrop Pressable should be for outside-tap dismissal
    const backdropIdx = MODAL_BLOCK.indexOf('StyleSheet.absoluteFill')
    const section = MODAL_BLOCK.substring(backdropIdx - 80, backdropIdx + 80)
    expect(section).toContain('Pressable')
    expect(section).toContain('onPress={onClose}')
  })

  test('3. card is a View, not a Pressable with stopPropagation', () => {
    // The card should NOT be wrapped in a Pressable with stopPropagation
    expect(MODAL_BLOCK).not.toContain('stopPropagation')
    // Card should be a <View style={ms.card}>
    const cardIdx = MODAL_BLOCK.indexOf('ms.card')
    const section = MODAL_BLOCK.substring(cardIdx - 30, cardIdx + 50)
    expect(section).toContain('<View')
  })

  test('4. card style does not use overflow:hidden', () => {
    // Find the card style definition
    const cardStyleIdx = HISTORY_SRC.indexOf('card: {')
    const cardStyle = HISTORY_SRC.substring(cardStyleIdx, cardStyleIdx + 200)
    expect(cardStyle).not.toContain("overflow: 'hidden'")
  })

  test('5. ScrollView contains Make Again and Delete', () => {
    // Make Again and Delete should be inside the ScrollView
    const scrollViewIdx = MODAL_BLOCK.indexOf('<ScrollView')
    const scrollViewEnd = MODAL_BLOCK.indexOf('</ScrollView>')
    const scrollContent = MODAL_BLOCK.substring(scrollViewIdx, scrollViewEnd)

    // Make Again button
    const makeAgainIdx = scrollContent.indexOf('canMakeAgain')
    expect(makeAgainIdx).toBeGreaterThan(-1)

    // Delete button
    const deleteIdx = scrollContent.indexOf('Delete Entry')
    expect(deleteIdx).toBeGreaterThan(-1)
  })

  test('6. overlay applies safe-area top inset', () => {
    expect(MODAL_BLOCK).toContain('insets.top')
    const insetIdx = MODAL_BLOCK.indexOf('insets.top')
    const section = MODAL_BLOCK.substring(insetIdx - 40, insetIdx + 80)
    expect(section).toContain('paddingTop')
  })

  test('7. overlay applies safe-area bottom inset', () => {
    expect(MODAL_BLOCK).toContain('insets.bottom')
    // Check the overlay-level padding (not just the ScrollView padding)
    const overlayBottomIdx = MODAL_BLOCK.indexOf('insets.bottom')
    const section = MODAL_BLOCK.substring(overlayBottomIdx - 40, overlayBottomIdx + 80)
    expect(section).toContain('paddingBottom')
  })

  test('8. newest free preview still receives canMakeAgain', () => {
    // The policy.canMakeAgain flag should still be checked
    expect(MODAL_BLOCK).toContain('policy.canMakeAgain')
    expect(MODAL_BLOCK).toContain('MakeAgainButton')
  })

  test('9. locked non-preview behavior unchanged', () => {
    // shouldShowAdvancedUpgrade and LockedAdvancedCard should remain
    expect(MODAL_BLOCK).toContain('policy.shouldShowAdvancedUpgrade')
    expect(MODAL_BLOCK).toContain('LockedAdvancedCard')
  })

  test('10. backdrop Pressable appears before the card in JSX order', () => {
    // The backdrop should be rendered BEFORE the card so it's behind
    const backdropIdx = MODAL_BLOCK.indexOf('StyleSheet.absoluteFill')
    const cardIdx = MODAL_BLOCK.indexOf('ms.card')
    expect(backdropIdx).toBeGreaterThan(-1)
    expect(cardIdx).toBeGreaterThan(-1)
    expect(backdropIdx).toBeLessThan(cardIdx)
  })

  test('11. ScrollView has nestedScrollEnabled', () => {
    expect(MODAL_BLOCK).toContain('nestedScrollEnabled')
  })

  test('12. card header has top border radius for corner treatment', () => {
    // Since overflow:hidden was removed, the header needs top radius
    const headerStyleIdx = HISTORY_SRC.indexOf('cardHeader: {')
    const headerStyle = HISTORY_SRC.substring(headerStyleIdx, headerStyleIdx + 400)
    expect(headerStyle).toContain('borderTopLeftRadius')
    expect(headerStyle).toContain('borderTopRightRadius')
  })
})
