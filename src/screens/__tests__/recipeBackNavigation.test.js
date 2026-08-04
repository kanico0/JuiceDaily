const fs = require('fs')
const path = require('path')

const SCAN_SCREEN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ScanScreen.js'),
  'utf8',
)

const RECIPE_DETAIL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'RecipeDetailScreen.js'),
  'utf8',
)

describe('Recipe Back Navigation Returns to Juice Ideas Origin', () => {
  // 1. RecipeDetail extracts origin params from route
  test('1. RecipeDetailScreen extracts origin from route params', () => {
    const idx = RECIPE_DETAIL_SRC.indexOf('recipeId, origin')
    expect(idx).toBeGreaterThan(-1)
  })

  // 2. RecipeDetail has handleBack callback
  test('2. RecipeDetailScreen has handleBack callback', () => {
    expect(RECIPE_DETAIL_SRC).toContain('handleBack')
  })

  // 3. handleBack navigates to ExploreHome with restore params for browseIdeas origin
  test('3. handleBack navigates to ExploreHome with restoreBrowseIdeas for browseIdeas origin', () => {
    const idx = RECIPE_DETAIL_SRC.indexOf('handleBack')
    const section = RECIPE_DETAIL_SRC.substring(idx, idx + 600)
    expect(section).toContain("origin === 'browseIdeas'")
    expect(section).toContain('restoreBrowseIdeas')
    expect(section).toContain('restorePage')
    expect(section).toContain('restoreSearchQuery')
    expect(section).toContain('ExploreHome')
  })

  // 4. handleBack falls back to goBack for non-browseIdeas origins
  test('4. handleBack falls back to navigation.goBack() for other origins', () => {
    const idx = RECIPE_DETAIL_SRC.indexOf('handleBack')
    const section = RECIPE_DETAIL_SRC.substring(idx, idx + 600)
    expect(section).toContain('navigation.goBack()')
  })

  // 5. Back button uses handleBack
  test('5. Back button onPress uses handleBack', () => {
    // Find the ArrowLeft in JSX (not the import)
    const idx = RECIPE_DETAIL_SRC.indexOf('<ArrowLeft')
    const section = RECIPE_DETAIL_SRC.substring(idx - 200, idx + 50)
    expect(section).toContain('handleBack')
  })

  // 6. ScanScreen accepts route prop
  test('6. ScanScreen accepts route prop', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('export default function ScanScreen')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 80)
    expect(section).toContain('route')
  })

  // 7. ScanScreen has browse restore state
  test('7. ScanScreen has browseRestorePage state', () => {
    expect(SCAN_SCREEN_SRC).toContain('browseRestorePage')
    expect(SCAN_SCREEN_SRC).toContain('browseRestoreSearch')
  })

  // 8. ScanScreen restores browse modal from route params
  test('8. ScanScreen restores browse modal from route params', () => {
    expect(SCAN_SCREEN_SRC).toContain('restoreBrowseIdeas')
    expect(SCAN_SCREEN_SRC).toContain('setShowBrowseModal(true)')
  })

  // 9. ScanScreen clears restore params after applying
  test('9. ScanScreen clears restore params after applying', () => {
    expect(SCAN_SCREEN_SRC).toContain('navigation.setParams')
    expect(SCAN_SCREEN_SRC).toContain('restoreBrowseIdeas: undefined')
  })

  // 10. BrowseIdeasModal accepts restorePage prop
  test('10. BrowseIdeasModal accepts restorePage prop', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('function BrowseIdeasModal')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 200)
    expect(section).toContain('restorePage')
    expect(section).toContain('restoreSearchQuery')
  })

  // 11. BrowseIdeasModal restores page and search on visible
  test('11. BrowseIdeasModal restores page and search query when visible', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('Restore state when returning from RecipeDetail')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 200)
    expect(section).toContain('restorePage')
    expect(section).toContain('setSearchQuery')
    expect(section).toContain('setCurrentPage')
  })

  // 12. BrowseIdeasModal passes origin metadata to RecipeDetail
  test('12. handleRecipePress passes origin metadata to RecipeDetail', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('handleRecipePress')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 500)
    expect(section).toContain("origin: 'browseIdeas'")
    expect(section).toContain('originPage: currentPage')
    expect(section).toContain('originSearchQuery: searchQuery')
  })

  // 13. ScanScreen passes restore props to BrowseIdeasModal
  test('13. ScanScreen passes restorePage and restoreSearchQuery to BrowseIdeasModal', () => {
    const idx = SCAN_SCREEN_SRC.indexOf('<BrowseIdeasModal')
    const section = SCAN_SCREEN_SRC.substring(idx, idx + 300)
    expect(section).toContain('restorePage={browseRestorePage}')
    expect(section).toContain('restoreSearchQuery={browseRestoreSearch}')
  })

  // 14. RecipeDetail passes originPage in restore params
  test('14. handleBack passes originPage in restore params', () => {
    const idx = RECIPE_DETAIL_SRC.indexOf('handleBack')
    const section = RECIPE_DETAIL_SRC.substring(idx, idx + 600)
    expect(section).toContain('restorePage: originPage')
  })

  // 15. RecipeDetail passes originSearchQuery in restore params
  test('15. handleBack passes originSearchQuery in restore params', () => {
    const idx = RECIPE_DETAIL_SRC.indexOf('handleBack')
    const section = RECIPE_DETAIL_SRC.substring(idx, idx + 600)
    expect(section).toContain('restoreSearchQuery: originSearchQuery')
  })

  // 16. Android hardware back uses handleBack for consistent navigation
  test('16. Android hardware back press calls handleBack', () => {
    expect(RECIPE_DETAIL_SRC).toContain('BackHandler')
    expect(RECIPE_DETAIL_SRC).toContain('hardwareBackPress')
    const idx = RECIPE_DETAIL_SRC.indexOf('hardwareBackPress')
    const section = RECIPE_DETAIL_SRC.substring(idx, idx + 200)
    expect(section).toContain('handleBack')
  })
})
