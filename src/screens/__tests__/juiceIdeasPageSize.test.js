const fs = require('fs')
const path = require('path')

const SCAN_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ScanScreen.js'),
  'utf8',
)

describe('Juice Ideas Page Size to 100', () => {
  // 1. Page size is 100
  test('1. BROWSE_PAGE_SIZE is 100', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('BROWSE_PAGE_SIZE')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 50)
    expect(section).toContain('100')
  })

  // 2. Page size is not 25
  test('2. BROWSE_PAGE_SIZE is not 25', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('BROWSE_PAGE_SIZE')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 50)
    expect(section).not.toMatch(/=\s*25\b/)
  })

  // 3. Pagination still works with the new page size
  test('3. totalPages uses BROWSE_PAGE_SIZE for calculation', () => {
    expect(SCAN_SCREEN_SRC).toContain('searchResults.length / BROWSE_PAGE_SIZE')
  })

  // 4. Page slicing uses BROWSE_PAGE_SIZE
  test('4. Page slice uses BROWSE_PAGE_SIZE', () => {
    expect(SCAN_SCREEN_SRC).toContain('startIndex + BROWSE_PAGE_SIZE')
  })

  // 5. Previous/Next controls exist
  test('5. Previous page control exists', () => {
    expect(SCAN_SCREEN_SRC).toContain('handlePrevPage')
  })

  // 6. Next page control exists
  test('6. Next page control exists', () => {
    expect(SCAN_SCREEN_SRC).toContain('handleNextPage')
  })

  // 7. Page count display exists
  test('7. Page count display exists', () => {
    expect(SCAN_SCREEN_SRC).toContain('totalPages')
    expect(SCAN_SCREEN_SRC).toContain('safePage')
  })

  // 8. Search resets to page 1
  test('8. Search query resets current page to 1', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('searchQuery')
    const resetIdx = SCAN_SCREEN_SRC.indexOf('setCurrentPage(1)', idx)
    expect(resetIdx).toBeGreaterThan(-1)
  })

  // 9. Partial pages are handled (Math.ceil)
  test('9. Partial pages handled with Math.ceil', () => {
    expect(SCAN_SCREEN_SRC).toContain('Math.ceil(searchResults.length / BROWSE_PAGE_SIZE)')
  })

  // 10. Page size constant is defined once
  test('10. BROWSE_PAGE_SIZE defined exactly once', () => {
    const matches = SCAN_SCREEN_SRC.match(/BROWSE_PAGE_SIZE\s*=/g)
    expect(matches).toHaveLength(1)
  })

  // 11. Search results fetch enough records for page size 100
  test('11. Search results fetch at least 1000 records for pagination', () => {
    expect(SCAN_SCREEN_SRC).toContain('searchRecipes(searchQuery, undefined, 1000)')
  })

  // 12. Page navigation scrolls to top
  test('12. Page navigation scrolls list to top', () => {
    expect(SCAN_SCREEN_SRC).toContain('scrollToOffset')
  })

  // 13. Safe page clamping prevents out-of-bounds
  test('13. Safe page clamping prevents out-of-bounds access', () => {
    expect(SCAN_SCREEN_SRC).toContain('Math.min(currentPage, totalPages)')
  })
})
