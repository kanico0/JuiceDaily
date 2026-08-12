// ─────────────────────────────────────────────────────────────
// qa9OrganicHistory.test.js
//
// Tests that:
// A. Organic ingredient logged → History preserves Organic
// B. Conventional ingredient logged → preserves Conventional
// C. Mixed juice → status preserved independently per ingredient
// D. History row renders correct indicator for Organic
// E. History row renders correct indicator for Conventional
// F. Legacy entry without field → no fabricated status
// G. Make Again from mixed Organic/Conventional → matching status
// H. Changing organic after Make Again affects only current draft
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const HOME_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HomeScreen.js'),
  'utf8',
)
const HISTORY_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HistoryScreen.js'),
  'utf8',
)
const MAKE_AGAIN_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'makeAgainHelper.js'),
  'utf8',
)

// Import the actual makeAgainHelper function
const {
  createEditableDraftFromHistoryEntry,
  draftToPreloadIngredients,
} = require('../../services/makeAgainHelper')

const { PRODUCE_DATA } = require('../../services/JuiceEngine')

describe('QA9 P1-3: Organic status persisted in ingredientDetails — source-level', () => {
  test('HomeScreen ingredientDetails includes isOrganic', () => {
    // The detail object must include isOrganic
    const idx = HOME_SRC.indexOf('ingredientDetails')
    expect(idx).toBeGreaterThan(-1)
    const section = HOME_SRC.slice(idx, idx + 2000)
    expect(section).toMatch(/isOrganic/)
  })

  test('isOrganic uses undefined for unset values (not false)', () => {
    const idx = HOME_SRC.indexOf('isOrganic: typeof i.isOrganic')
    expect(idx).toBeGreaterThan(-1)
    const section = HOME_SRC.slice(idx, idx + 200)
    expect(section).toMatch(/undefined/)
  })
})

describe('QA9 P1-3: History organic indicator — source-level', () => {
  test('HistoryScreen renders organic indicator per ingredient', () => {
    expect(HISTORY_SRC).toMatch(/organicIndicator/)
    expect(HISTORY_SRC).toMatch(/showOrganicIndicator/)
  })

  test('HistoryScreen uses Leaf icon for organic indicator', () => {
    // The Leaf icon is already imported and used for the indicator
    const idx = HISTORY_SRC.indexOf('organicIndicator')
    const section = HISTORY_SRC.slice(idx, idx + 500)
    expect(section).toMatch(/Leaf/)
  })

  test('HistoryScreen shows indicator only when isOrganic is boolean', () => {
    expect(HISTORY_SRC).toMatch(/typeof ingredientIsOrganic === 'boolean'/)
  })

  test('HistoryScreen uses green for organic, gray for conventional', () => {
    const idx = HISTORY_SRC.indexOf('organicIndicator')
    const section = HISTORY_SRC.slice(idx, idx + 800)
    expect(section).toMatch(/#81C784/)
    expect(section).toMatch(/#90A4AE/)
  })

  test('HistoryScreen shows "Organic" or "Conv." label', () => {
    const idx = HISTORY_SRC.indexOf('organicIndicator')
    const section = HISTORY_SRC.slice(idx, idx + 800)
    expect(section).toMatch(/Organic/)
    expect(section).toMatch(/Conv/)
  })
})

describe('QA9 P1-4: Make Again preserves organic status — source-level', () => {
  test('makeAgainHelper extracts isOrganic from ingredientDetails', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/d\.isOrganic/)
  })

  test('makeAgainHelper uses undefined for legacy entries (not false)', () => {
    // The default should be undefined, not false
    expect(MAKE_AGAIN_SRC).toMatch(/typeof rawOrganic === 'boolean' \? rawOrganic : undefined/)
  })

  test('draftToPreloadIngredients passes isOrganic through', () => {
    expect(MAKE_AGAIN_SRC).toMatch(/isOrganic: ing\.isOrganic/)
  })
})

describe('QA9 P1-4: Make Again organic preservation — runtime', () => {
  // Helper: create a history entry with ingredientDetails
  function makeHistoryEntry(ingredients, ingredientDetails) {
    return {
      id: 'test-entry-1',
      createdAt: new Date().toISOString(),
      source: 'manual',
      ingredients,
      ingredientDetails,
    }
  }

  test('G. Make Again from mixed Organic/Conventional → matching status', () => {
    const entry = makeHistoryEntry(
      ['carrot', 'apple', 'kale'],
      [
        { produceId: 'carrot', weightG: 80, isOrganic: true },
        { produceId: 'apple', weightG: 150, isOrganic: false },
        { produceId: 'kale', weightG: 40, isOrganic: true },
      ],
    )

    const draft = createEditableDraftFromHistoryEntry(entry)
    expect(draft.ingredients).toHaveLength(3)

    const carrot = draft.ingredients.find((i) => i.produceId === 'carrot')
    const apple = draft.ingredients.find((i) => i.produceId === 'apple')
    const kale = draft.ingredients.find((i) => i.produceId === 'kale')

    expect(carrot.isOrganic).toBe(true)
    expect(apple.isOrganic).toBe(false)
    expect(kale.isOrganic).toBe(true)
  })

  test('F. Legacy entry without isOrganic → undefined (not false)', () => {
    const entry = makeHistoryEntry(
      ['carrot', 'apple'],
      [
        { produceId: 'carrot', weightG: 80 },
        { produceId: 'apple', weightG: 150 },
      ],
    )

    const draft = createEditableDraftFromHistoryEntry(entry)
    expect(draft.ingredients).toHaveLength(2)

    const carrot = draft.ingredients.find((i) => i.produceId === 'carrot')
    const apple = draft.ingredients.find((i) => i.produceId === 'apple')

    // Legacy entries should have undefined isOrganic, not false
    expect(carrot.isOrganic).toBeUndefined()
    expect(apple.isOrganic).toBeUndefined()
  })

  test('H. Changing organic after Make Again affects only current draft', () => {
    const entry = makeHistoryEntry(
      ['carrot', 'apple'],
      [
        { produceId: 'carrot', weightG: 80, isOrganic: true },
        { produceId: 'apple', weightG: 150, isOrganic: false },
      ],
    )

    const draft1 = createEditableDraftFromHistoryEntry(entry)
    const draft2 = createEditableDraftFromHistoryEntry(entry)

    // Modify draft1
    const carrot1 = draft1.ingredients.find((i) => i.produceId === 'carrot')
    carrot1.isOrganic = false

    // draft2 should be unaffected
    const carrot2 = draft2.ingredients.find((i) => i.produceId === 'carrot')
    expect(carrot2.isOrganic).toBe(true)

    // Original entry should be unaffected
    expect(entry.ingredientDetails[0].isOrganic).toBe(true)
  })

  test('draftToPreloadIngredients preserves isOrganic', () => {
    const entry = makeHistoryEntry(
      ['carrot', 'apple'],
      [
        { produceId: 'carrot', weightG: 80, isOrganic: true },
        { produceId: 'apple', weightG: 150, isOrganic: false },
      ],
    )

    const draft = createEditableDraftFromHistoryEntry(entry)
    const preload = draftToPreloadIngredients(draft.ingredients)

    const carrotPreload = preload.find((p) => p.produceId === 'carrot')
    const applePreload = preload.find((p) => p.produceId === 'apple')

    expect(carrotPreload.isOrganic).toBe(true)
    expect(applePreload.isOrganic).toBe(false)
  })

  test('draftToPreloadIngredients preserves undefined for legacy', () => {
    const entry = makeHistoryEntry(
      ['carrot'],
      [{ produceId: 'carrot', weightG: 80 }],
    )

    const draft = createEditableDraftFromHistoryEntry(entry)
    const preload = draftToPreloadIngredients(draft.ingredients)

    expect(preload[0].isOrganic).toBeUndefined()
  })
})
