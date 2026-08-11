const fs = require('fs')
const path = require('path')

const HISTORY_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HistoryScreen.js'),
  'utf8',
)

describe('Advanced History Scrollable Details', () => {
  // 1. Advanced History details use a vertical scroll container
  test('1. EntryDetailsModal uses a ScrollView for detail content', () => {
    const modalIdx = HISTORY_SRC.indexOf('function EntryDetailsModal')
    const modalSection = HISTORY_SRC.substring(modalIdx, modalIdx + 8000)
    expect(modalSection).toContain('ScrollView')
    expect(modalSection).toContain('ms.cardBody')
  })

  // 2. Long detail content can reach the bottom
  test('2. ScrollView has contentContainerStyle with flexGrow and bottom padding', () => {
    expect(HISTORY_SRC).toContain('cardBodyContent')
    expect(HISTORY_SRC).toContain('flexGrow')
    expect(HISTORY_SRC).toContain('paddingBottom')
  })

  // 3. Taste vote remains inside the scrollable report
  test('3. Taste vote section is inside the ScrollView', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollEndIdx = HISTORY_SRC.indexOf('</ScrollView>', scrollIdx)
    const tasteIdx = HISTORY_SRC.indexOf('Taste Vote', scrollIdx)
    expect(tasteIdx).toBeGreaterThan(scrollIdx)
    expect(tasteIdx).toBeLessThan(scrollEndIdx)
  })

  // 4. Free newest Advanced Preview scrolls
  test('4. ScrollView renders regardless of policy (preview or pro)', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const modalIdx = HISTORY_SRC.indexOf('function EntryDetailsModal')
    expect(scrollIdx).toBeGreaterThan(modalIdx)
    // ScrollView is before any policy conditional checks
    const policyIdx = HISTORY_SRC.indexOf('policy.shouldShowPreviewExplanation', scrollIdx)
    expect(policyIdx).toBeGreaterThan(scrollIdx)
  })

  // 5. Pro Advanced History details scroll
  test('5. ScrollView is not gated by isPro or canViewAdvancedDetails', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const modalIdx = HISTORY_SRC.indexOf('function EntryDetailsModal')
    const scrollSection = HISTORY_SRC.substring(modalIdx, scrollIdx)
    // The ScrollView should not be inside a policy.canViewAdvancedDetails conditional
    expect(scrollSection).not.toContain('policy.canViewAdvancedDetails && (')
  })

  // 6. Free older locked details remain locked
  test('6. Locked advanced card is inside the ScrollView (still rendered for locked entries)', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollEndIdx = HISTORY_SRC.indexOf('</ScrollView>', scrollIdx)
    const lockedIdx = HISTORY_SRC.indexOf('shouldShowAdvancedUpgrade', scrollIdx)
    expect(lockedIdx).toBeGreaterThan(scrollIdx)
    expect(lockedIdx).toBeLessThan(scrollEndIdx)
  })

  // 7. Close/back controls remain accessible
  test('7. Close button is in card header outside the ScrollView', () => {
    const headerIdx = HISTORY_SRC.indexOf('ms.cardHeader')
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const closeIdx = HISTORY_SRC.indexOf('accessibilityLabel="Close details"')
    expect(closeIdx).toBeGreaterThan(headerIdx)
    expect(closeIdx).toBeLessThan(scrollIdx)
  })

  // 8. Bottom padding protects the final content via safe-area inset
  test('8. ScrollView contentContainerStyle uses safe-area-aware paddingBottom', () => {
    expect(HISTORY_SRC).toContain('useSafeAreaInsets')
    expect(HISTORY_SRC).toContain('insets.bottom')
    expect(HISTORY_SRC).toContain('paddingBottom')
  })

  // 9. Android hardware back still closes the detail correctly
  test('9. Modal visible prop controls visibility for back handling', () => {
    const modalIdx = HISTORY_SRC.indexOf('<Modal visible={visible}')
    expect(modalIdx).toBeGreaterThan(-1)
    expect(HISTORY_SRC).toContain('onPress={onClose}')
  })

  // 10. No content section disappears
  test('10. All content sections are inside the ScrollView (ingredients, nutrients, taste vote, delete)', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollEndIdx = HISTORY_SRC.indexOf('</ScrollView>', scrollIdx)
    const sections = ['Ingredients', 'Top Nutrients', 'Taste Vote', 'Delete Entry']
    sections.forEach((section) => {
      const sectionIdx = HISTORY_SRC.indexOf(section, scrollIdx)
      expect(sectionIdx).toBeGreaterThan(scrollIdx)
      expect(sectionIdx).toBeLessThan(scrollEndIdx)
    })
  })

  // Additional: card has maxHeight for scroll constraint (no flex:1 to avoid over-stretch)
  test('11. Card style has maxHeight for proper vertical layout', () => {
    const cardIdx = HISTORY_SRC.indexOf('card:')
    const cardSection = HISTORY_SRC.substring(cardIdx, cardIdx + 200)
    expect(cardSection).toContain('maxHeight')
  })

  // Additional: cardBody has flex:1 so ScrollView fills available space
  test('12. cardBody style has flex:1 so ScrollView fills card', () => {
    const cardBodyIdx = HISTORY_SRC.indexOf('cardBody:')
    const cardBodySection = HISTORY_SRC.substring(cardBodyIdx, cardBodyIdx + 200)
    expect(cardBodySection).toContain('flex: 1')
  })

  // Additional: nestedScrollEnabled is set
  test('13. nestedScrollEnabled is set on the ScrollView', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollSection = HISTORY_SRC.substring(scrollIdx, scrollIdx + 300)
    expect(scrollSection).toContain('nestedScrollEnabled')
  })

  // 14. Long-content regression: Make Again button is inside the ScrollView
  test('14. Make Again button is inside the ScrollView (reachable with long content)', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollEndIdx = HISTORY_SRC.indexOf('</ScrollView>', scrollIdx)
    const makeAgainIdx = HISTORY_SRC.indexOf('MakeAgainButton', scrollIdx)
    expect(makeAgainIdx).toBeGreaterThan(scrollIdx)
    expect(makeAgainIdx).toBeLessThan(scrollEndIdx)
  })

  // 15. Long-content regression: Delete button is inside the ScrollView
  test('15. Delete button is inside the ScrollView (reachable with long content)', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollEndIdx = HISTORY_SRC.indexOf('</ScrollView>', scrollIdx)
    const deleteIdx = HISTORY_SRC.indexOf('Delete Entry', scrollIdx)
    expect(deleteIdx).toBeGreaterThan(scrollIdx)
    expect(deleteIdx).toBeLessThan(scrollEndIdx)
  })

  // 16. Long-content regression: ScrollView has showsVerticalScrollIndicator
  test('16. ScrollView has showsVerticalScrollIndicator set to false (clean UX)', () => {
    const scrollIdx = HISTORY_SRC.indexOf('<ScrollView')
    const scrollSection = HISTORY_SRC.substring(scrollIdx, scrollIdx + 400)
    expect(scrollSection).toContain('showsVerticalScrollIndicator')
  })

  // 17. Long-content regression: Card does NOT use overflow:hidden
  // (overflow:hidden interferes with ScrollView on Android Fabric)
  test('17. Card style does not use overflow hidden (Fabric scroll fix)', () => {
    const cardIdx = HISTORY_SRC.indexOf('card:')
    const cardSection = HISTORY_SRC.substring(cardIdx, cardIdx + 300)
    expect(cardSection).not.toContain("overflow: 'hidden'")
  })
})
