// ─────────────────────────────────────────────────────────────
// qa10HistoryMetadataGating.test.js
//
// Tests for QA10:
// - Organic gating (Free newest, Free older, Pro, legacy)
// - Entry method (canonical source, Free newest, Free older, Pro, legacy)
// - Time/daypart (existing timestamp, Free newest, Free older, Pro)
// - Make Again does NOT copy original timestamp
// - Organic Make Again preservation (QA9 behavior retained)
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const HISTORY_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'HistoryScreen.js'),
  'utf8',
)

const { getHistoryAccessPolicy } = require('../../services/historyAccessPolicy')
const {
  createEditableDraftFromHistoryEntry,
  draftToPreloadIngredients,
} = require('../../services/makeAgainHelper')

describe('QA10 P1: Organic gating — source-level', () => {
  test('organic indicator is gated by canViewAdvancedDetails', () => {
    const idx = HISTORY_SRC.indexOf('ingredientIsOrganic')
    expect(idx).toBeGreaterThan(-1)
    const section = HISTORY_SRC.slice(idx, idx + 300)
    expect(section).toMatch(/canViewAdvancedDetails/)
  })

  test('organic indicator is NOT in the basic History list', () => {
    // The basic list is in DaySection. The organic indicator should
    // only appear in EntryDetailsModal.
    const daySectionIdx = HISTORY_SRC.indexOf('function DaySection')
    expect(daySectionIdx).toBeGreaterThan(-1)
    const daySectionEnd = HISTORY_SRC.indexOf('// ── Compact Dropdown', daySectionIdx)
    const daySection = HISTORY_SRC.slice(daySectionIdx, daySectionEnd)
    expect(daySection).not.toMatch(/organicIndicator/)
    expect(daySection).not.toMatch(/ingredientIsOrganic/)
  })
})

describe('QA10 P2: Entry method — source-level', () => {
  test('source badge in modal is gated by canViewAdvancedDetails', () => {
    // The source badge at the top of EntryDetailsModal must be gated
    const badgeIdx = HISTORY_SRC.indexOf('entrySourceBadge')
    expect(badgeIdx).toBeGreaterThan(-1)
    const section = HISTORY_SRC.slice(badgeIdx - 400, badgeIdx + 200)
    expect(section).toMatch(/canViewAdvancedDetails/)
  })

  test('Juice Details section exists with Entry Method', () => {
    expect(HISTORY_SRC).toMatch(/Juice Details/)
    expect(HISTORY_SRC).toMatch(/Entry Method/)
  })

  test('Entry Method uses getSourceLabel for display', () => {
    const idx = HISTORY_SRC.indexOf('Entry Method')
    const section = HISTORY_SRC.slice(idx, idx + 700)
    expect(section).toMatch(/getSourceLabel/)
  })

  test('legacy entries show "Entry method not recorded"', () => {
    expect(HISTORY_SRC).toMatch(/Entry method not recorded/)
  })

  test('Juice Details section is gated by canViewAdvancedDetails', () => {
    const idx = HISTORY_SRC.indexOf('Juice Details')
    // The canViewAdvancedDetails gate comes AFTER the comment
    const section = HISTORY_SRC.slice(idx, idx + 400)
    expect(section).toMatch(/canViewAdvancedDetails/)
  })
})

describe('QA10 P3: Time / daypart — source-level', () => {
  test('getDaypart function exists', () => {
    expect(HISTORY_SRC).toMatch(/function getDaypart/)
  })

  test('daypart uses Morning/Afternoon/Evening/Night', () => {
    const idx = HISTORY_SRC.indexOf('function getDaypart')
    const section = HISTORY_SRC.slice(idx, idx + 400)
    expect(section).toMatch(/Morning/)
    expect(section).toMatch(/Afternoon/)
    expect(section).toMatch(/Evening/)
    expect(section).toMatch(/Night/)
  })

  test('Logged time + daypart displayed in Juice Details', () => {
    // Find the "Logged" detail label inside Juice Details section
    const juiceDetailsIdx = HISTORY_SRC.indexOf('Juice Details')
    // Search for the detailLabel "Logged" after the Juice Details section
    const loggedLabelIdx = HISTORY_SRC.indexOf("detailLabel}>Logged", juiceDetailsIdx)
    expect(loggedLabelIdx).toBeGreaterThan(-1)
    const section = HISTORY_SRC.slice(loggedLabelIdx, loggedLabelIdx + 400)
    expect(section).toMatch(/formatTime/)
    expect(section).toMatch(/getDaypart/)
  })

  test('time in source row is gated by canViewAdvancedDetails', () => {
    // The time display next to the source badge must be gated
    const timeIdx = HISTORY_SRC.indexOf('formatTime(entry.createdAt)')
    expect(timeIdx).toBeGreaterThan(-1)
    const section = HISTORY_SRC.slice(timeIdx - 300, timeIdx + 100)
    expect(section).toMatch(/canViewAdvancedDetails/)
  })
})

describe('QA10 P5: Free older-entry teaser — source-level', () => {
  test('LockedAdvancedCard mentions organic vs. conventional', () => {
    const idx = HISTORY_SRC.indexOf('LockedAdvancedCard')
    const section = HISTORY_SRC.slice(idx, idx + 2000)
    expect(section).toMatch(/organic/i)
    expect(section).toMatch(/conventional/i)
  })

  test('LockedAdvancedCard mentions entry method & time', () => {
    const idx = HISTORY_SRC.indexOf('LockedAdvancedCard')
    const section = HISTORY_SRC.slice(idx, idx + 2000)
    expect(section).toMatch(/entry method/i)
    expect(section).toMatch(/time logged/i)
  })

  test('LockedAdvancedCard title is "More details with Pro"', () => {
    const idx = HISTORY_SRC.indexOf('LockedAdvancedCard')
    const section = HISTORY_SRC.slice(idx, idx + 2000)
    expect(section).toMatch(/More details with Pro/)
  })

  test('AdvancedPreviewBanner mentions organic, portions, entry method, time', () => {
    const idx = HISTORY_SRC.indexOf('AdvancedPreviewBanner')
    const section = HISTORY_SRC.slice(idx, idx + 1000)
    expect(section).toMatch(/organic/i)
    expect(section).toMatch(/entry method/i)
    expect(section).toMatch(/time logged/i)
  })
})

describe('QA10: Access policy gating — runtime', () => {
  test('Pro user: canViewAdvancedDetails = true', () => {
    const policy = getHistoryAccessPolicy(true, false, true)
    expect(policy.canViewAdvancedDetails).toBe(true)
  })

  test('Free newest-entry preview: canViewAdvancedDetails = true', () => {
    const policy = getHistoryAccessPolicy(false, true, true)
    expect(policy.canViewAdvancedDetails).toBe(true)
  })

  test('Free older entry: canViewAdvancedDetails = false', () => {
    const policy = getHistoryAccessPolicy(false, false, true)
    expect(policy.canViewAdvancedDetails).toBe(false)
    expect(policy.shouldShowAdvancedUpgrade).toBe(true)
  })

  test('Loading state: canViewAdvancedDetails = false', () => {
    const policy = getHistoryAccessPolicy(false, false, false)
    expect(policy.canViewAdvancedDetails).toBe(false)
  })
})

describe('QA10: Make Again does NOT copy original timestamp', () => {
  test('createEditableDraftFromHistoryEntry does not include createdAt', () => {
    const entry = {
      id: 'test-1',
      createdAt: '2026-07-15T08:42:00',
      dateKey: '2026-07-15',
      source: 'manual',
      ingredients: ['carrot', 'apple'],
      ingredientDetails: [
        { produceId: 'carrot', weightG: 80, isOrganic: true },
        { produceId: 'apple', weightG: 150, isOrganic: false },
      ],
    }

    const draft = createEditableDraftFromHistoryEntry(entry)
    expect(draft.ingredients).toHaveLength(2)

    // The draft ingredients should NOT carry the original entry's
    // createdAt or dateKey — Make Again creates a NEW entry.
    draft.ingredients.forEach((ing) => {
      expect(ing.createdAt).toBeUndefined()
      expect(ing.dateKey).toBeUndefined()
      expect(ing.source).toBeUndefined()
    })
  })

  test('draftToPreloadIngredients does not include createdAt', () => {
    const entry = {
      id: 'test-2',
      createdAt: '2026-07-15T08:42:00',
      source: 'manual',
      ingredients: ['carrot'],
      ingredientDetails: [
        { produceId: 'carrot', weightG: 80, isOrganic: true },
      ],
    }

    const draft = createEditableDraftFromHistoryEntry(entry)
    const preload = draftToPreloadIngredients(draft.ingredients)
    preload.forEach((p) => {
      expect(p.createdAt).toBeUndefined()
      expect(p.dateKey).toBeUndefined()
      expect(p.source).toBeUndefined()
    })
  })
})

describe('QA10: Organic Make Again preservation (QA9 behavior retained)', () => {
  test('mixed Organic/Conventional values reproduced correctly', () => {
    const entry = {
      id: 'test-3',
      createdAt: '2026-07-15T08:42:00',
      source: 'manual',
      ingredients: ['carrot', 'apple', 'kale'],
      ingredientDetails: [
        { produceId: 'carrot', weightG: 80, isOrganic: true },
        { produceId: 'apple', weightG: 150, isOrganic: false },
        { produceId: 'kale', weightG: 40, isOrganic: true },
      ],
    }

    const draft = createEditableDraftFromHistoryEntry(entry)
    const carrot = draft.ingredients.find((i) => i.produceId === 'carrot')
    const apple = draft.ingredients.find((i) => i.produceId === 'apple')
    const kale = draft.ingredients.find((i) => i.produceId === 'kale')

    expect(carrot.isOrganic).toBe(true)
    expect(apple.isOrganic).toBe(false)
    expect(kale.isOrganic).toBe(true)
  })

  test('legacy entry without isOrganic → undefined (not fabricated)', () => {
    const entry = {
      id: 'test-4',
      createdAt: '2026-07-15T08:42:00',
      source: 'manual',
      ingredients: ['carrot'],
      ingredientDetails: [
        { produceId: 'carrot', weightG: 80 },
      ],
    }

    const draft = createEditableDraftFromHistoryEntry(entry)
    expect(draft.ingredients[0].isOrganic).toBeUndefined()
  })
})
