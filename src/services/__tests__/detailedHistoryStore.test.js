// ─────────────────────────────────────────────────────────────
// detailedHistoryStore.test.js
// Focused regression tests for JuiceLogStore rating/note/favorite
// and ingredientDetails persistence.
//
// Uses source inspection patterns matching the existing test suite
// style (e.g. multipleSameDayLogging.test.js, scanQuotaAuthority.test.js)
// since the reducer is not exported and @testing-library/react-hooks
// is not available in this project.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const STORE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'JuiceLogStore.js'),
  'utf8',
)

const MAKE_AGAIN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'makeAgainHelper.js'),
  'utf8',
)

const HISTORY_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'HistoryScreen.js'),
  'utf8',
)

// ── JuiceLogStore source inspection ───────────────────────────

describe('JuiceLogStore — Detailed History fields (source inspection)', () => {
  test('addEntry accepts ingredientDetails parameter', () => {
    expect(STORE_SRC).toMatch(/ingredientDetails/)
    expect(STORE_SRC).toMatch(/addEntry = useCallback.*ingredientDetails/)
  })

  test('addEntry stores ingredientDetails in the entry', () => {
    expect(STORE_SRC).toMatch(/ingredientDetails:.*Array\.isArray\(ingredientDetails\)/)
  })

  test('addEntry initializes rating, note, favorite as undefined', () => {
    expect(STORE_SRC).toMatch(/rating: undefined/)
    expect(STORE_SRC).toMatch(/note: undefined/)
    expect(STORE_SRC).toMatch(/favorite: undefined/)
  })

  test('UPDATE_ENTRY reducer case exists', () => {
    expect(STORE_SRC).toMatch(/case 'UPDATE_ENTRY'/)
    expect(STORE_SRC).toMatch(/\.\.\.updates/)
  })

  test('UPDATE_ENTRY preserves other fields via spread', () => {
    const updateMatch = STORE_SRC.match(/case 'UPDATE_ENTRY'[\s\S]*?\n    \}/)
    expect(updateMatch).toBeTruthy()
    expect(updateMatch[0]).toMatch(/\.\.\.e/)
    expect(updateMatch[0]).toMatch(/\.\.\.updates/)
  })

  test('setRating validates 1-5 range and rounds', () => {
    expect(STORE_SRC).toMatch(/setRating = useCallback/)
    expect(STORE_SRC).toMatch(/rating >= 1 && rating <= 5/)
    expect(STORE_SRC).toMatch(/Math\.round/)
  })

  test('setRating clears rating with null', () => {
    expect(STORE_SRC).toMatch(/validRating[\s\S]*?null/)
  })

  test('setNote trims and limits to 500 chars', () => {
    expect(STORE_SRC).toMatch(/setNote = useCallback/)
    expect(STORE_SRC).toMatch(/\.trim\(\)/)
    expect(STORE_SRC).toMatch(/\.slice\(0, 500\)/)
  })

  test('setNote clears with empty string', () => {
    expect(STORE_SRC).toMatch(/note\.trim\(\)\.length > 0/)
  })

  test('toggleFavorite flips the current value', () => {
    expect(STORE_SRC).toMatch(/toggleFavorite = useCallback/)
    expect(STORE_SRC).toMatch(/entry\?\.favorite === true/)
    expect(STORE_SRC).toMatch(/favorite: !current/)
  })

  test('context value exposes new functions', () => {
    expect(STORE_SRC).toMatch(/setRating,/)
    expect(STORE_SRC).toMatch(/setNote,/)
    expect(STORE_SRC).toMatch(/toggleFavorite,/)
  })

  test('existing functions are preserved', () => {
    expect(STORE_SRC).toMatch(/addEntry/)
    expect(STORE_SRC).toMatch(/deleteEntry/)
    expect(STORE_SRC).toMatch(/setTasteReaction/)
    expect(STORE_SRC).toMatch(/resetLog/)
  })

  test('SET_TASTE_REACTION is still present', () => {
    expect(STORE_SRC).toMatch(/case 'SET_TASTE_REACTION'/)
  })

  test('DELETE_ENTRY is still present', () => {
    expect(STORE_SRC).toMatch(/case 'DELETE_ENTRY'/)
  })

  test('ADD_ENTRY is still present', () => {
    expect(STORE_SRC).toMatch(/case 'ADD_ENTRY'/)
  })

  test('RESET is still present', () => {
    expect(STORE_SRC).toMatch(/case 'RESET'/)
  })

  test('sanitizeLogState does not reject entries with new fields', () => {
    const sanitizeMatch = STORE_SRC.match(/function sanitizeLogState[\s\S]*?\n\}/)
    expect(sanitizeMatch).toBeTruthy()
    // Sanitize only checks id and createdAt — new fields pass through
    expect(sanitizeMatch[0]).toMatch(/typeof e\.id === 'string'/)
    expect(sanitizeMatch[0]).toMatch(/typeof e\.createdAt === 'string'/)
    // Should NOT filter on rating/note/favorite presence
    expect(sanitizeMatch[0]).not.toMatch(/rating/)
    expect(sanitizeMatch[0]).not.toMatch(/note/)
    expect(sanitizeMatch[0]).not.toMatch(/favorite/)
  })
})

// ── Make Again helper source inspection ───────────────────────

describe('Make Again — ingredientDetails support (source inspection)', () => {
  test('reads ingredientDetails from entry', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/entry\.ingredientDetails/)
  })

  test('extracts weightG from ingredientDetails', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/rawWeightG = typeof d\.weightG/)
  })

  test('extracts portionMetadata from ingredientDetails', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/d\.portionMetadata/)
    expect(MAKE_AGAIN_SRC).toMatch(/d\.portionMetadata\.enteredQuantity/)
  })

  test('uses weightG in draft ingredients', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/weightG,/)
  })

  test('draftToPreloadIngredients uses weightG from draft', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/ing\.weightG/)
  })

  test('falls back to 150 when weightG missing', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/150/)
  })
})

// ── HistoryScreen source inspection ───────────────────────────

describe('HistoryScreen — Detailed History UI (source inspection)', () => {
  test('imports detailedHistoryHelpers', () => {
    expect(HISTORY_SRC).toMatch(/detailedHistoryHelpers/)
    expect(HISTORY_SRC).toMatch(/formatIngredientPortion/)
    expect(HISTORY_SRC).toMatch(/computeProduceBalance/)
    expect(HISTORY_SRC).toMatch(/getTopNutrients/)
    expect(HISTORY_SRC).toMatch(/getBasicNutritionStats/)
  })

  test('imports Star, Pencil, Check icons', () => {
    expect(HISTORY_SRC).toMatch(/\bStar\b/)
    expect(HISTORY_SRC).toMatch(/\bPencil\b/)
    expect(HISTORY_SRC).toMatch(/\bCheck\b/)
  })

  test('imports TextInput', () => {
    expect(HISTORY_SRC).toMatch(/TextInput/)
  })

  test('EntryDetailsModal accepts new callbacks', () => {
    expect(HISTORY_SRC).toMatch(/onSetRating/)
    expect(HISTORY_SRC).toMatch(/onSetNote/)
    expect(HISTORY_SRC).toMatch(/onToggleFavorite/)
  })

  test('modal has note editing state', () => {
    expect(HISTORY_SRC).toMatch(/noteDraft/)
    expect(HISTORY_SRC).toMatch(/isEditingNote/)
  })

  test('modal renders ingredient portions for Pro', () => {
    expect(HISTORY_SRC).toMatch(/formatIngredientPortion/)
    expect(HISTORY_SRC).toMatch(/ingredientPortion/)
  })

  test('modal shows Portion not recorded for legacy entries', () => {
    expect(HISTORY_SRC).toMatch(/Portion not recorded/)
  })

  test('modal renders Produce Balance section', () => {
    expect(HISTORY_SRC).toMatch(/Produce Balance/)
    expect(HISTORY_SRC).toMatch(/produceBalance/)
  })

  test('Produce Balance weight mode is labeled as by ingredient weight', () => {
    expect(HISTORY_SRC).toMatch(/By ingredient weight/)
  })

  test('Produce Balance count mode is labeled as by ingredient count', () => {
    expect(HISTORY_SRC).toMatch(/By ingredient count/)
  })

  test('modal renders Nutrition section with calories and sugar', () => {
    expect(HISTORY_SRC).toMatch(/Nutrition/)
    expect(HISTORY_SRC).toMatch(/basicStats/)
  })

  test('modal renders Rating section with 5 stars', () => {
    expect(HISTORY_SRC).toMatch(/Rating/)
    expect(HISTORY_SRC).toMatch(/\[1, 2, 3, 4, 5\]/)
  })

  test('modal renders Personal Note section', () => {
    expect(HISTORY_SRC).toMatch(/Personal Note/)
  })

  test('modal renders Favorite button', () => {
    expect(HISTORY_SRC).toMatch(/Add to Favorites/)
    expect(HISTORY_SRC).toMatch(/Favorited/)
  })

  test('Locked card shows feature previews', () => {
    expect(HISTORY_SRC).toMatch(/lockedPreviewList/)
    expect(HISTORY_SRC).toMatch(/Portions — Recreate this juice accurately/)
    expect(HISTORY_SRC).toMatch(/Nutrition Details/)
    expect(HISTORY_SRC).toMatch(/Produce Balance — See your fruit and vegetable mix/)
    expect(HISTORY_SRC).toMatch(/Rating & Personal Notes/)
  })

  test('existing behavior preserved — Entry Details title', () => {
    expect(HISTORY_SRC).toMatch(/Entry Details/)
  })

  test('existing behavior preserved — Make Again button', () => {
    expect(HISTORY_SRC).toMatch(/Make This Juice Again/)
  })

  test('existing behavior preserved — Delete button', () => {
    expect(HISTORY_SRC).toMatch(/Delete Entry/)
  })

  test('existing behavior preserved — Taste Vote', () => {
    expect(HISTORY_SRC).toMatch(/Taste Vote/)
  })

  test('existing behavior preserved — Advanced Preview Banner', () => {
    expect(HISTORY_SRC).toMatch(/AdvancedPreviewBanner/)
  })

  test('uses existing entitlement policy for gating', () => {
    expect(HISTORY_SRC).toMatch(/getHistoryAccessPolicy/)
    expect(HISTORY_SRC).toMatch(/canViewAdvancedDetails/)
  })

  test('new sections are gated behind canViewAdvancedDetails', () => {
    // Rating, Note, Favorite should all check policy.canViewAdvancedDetails
    const ratingSection = HISTORY_SRC.match(/handleRatingPress[\s\S]*?\n  \}/)
    expect(ratingSection).toBeTruthy()
    expect(ratingSection[0]).toMatch(/canViewAdvancedDetails/)
  })

  test('no cross-history analytics were added', () => {
    expect(HISTORY_SRC).not.toMatch(/monthlySummary|monthly_summary/)
    expect(HISTORY_SRC).not.toMatch(/trendAnalysis|trend_analysis/)
    expect(HISTORY_SRC).not.toMatch(/ingredientFrequency/)
    expect(HISTORY_SRC).not.toMatch(/glycemicLoad|glycemic_load/)
    expect(HISTORY_SRC).not.toMatch(/costPerJuice/)
  })
})
