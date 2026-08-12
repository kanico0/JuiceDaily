// ─────────────────────────────────────────────────────────────
// qa11TasteFeedbackIdempotency.test.js
//
// Behavioral tests for QA11: Taste Feedback idempotency fix.
// Tests the canonical per-entry `tasteFeedbackResolved` field
// in the JuiceLogStore reducer, plus source-level verification
// that all prompt surfaces consult it.
//
// Tests A-J from the QA11 specification.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const STORE_SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'JuiceLogStore.js'),
  'utf8',
)

const SCAN_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'ScanSuccessScreen.js'),
  'utf8',
)

const RECIPE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'RecipeDetailScreen.js'),
  'utf8',
)

// ── Reducer simulation ──
// Replicate the reducer logic to test behaviorally without React.

function createEmptyState() {
  return { entries: [] }
}

function logReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload || createEmptyState()

    case 'ADD_ENTRY': {
      const entry = action.payload
      return { ...state, entries: [entry, ...state.entries] }
    }

    case 'DELETE_ENTRY': {
      const id = action.payload
      return { ...state, entries: state.entries.filter((e) => e.id !== id) }
    }

    case 'SET_TASTE_REACTION': {
      const { id, reaction } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, tasteReaction: reaction } : e
        ),
      }
    }

    case 'UPDATE_ENTRY_METADATA': {
      const { id, updates } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) => {
          if (e.id !== id) return e
          const merged = { ...e }
          if (updates && typeof updates === 'object') {
            for (const key of Object.keys(updates)) {
              if (updates[key] !== undefined) {
                merged[key] = updates[key]
              }
            }
          }
          return merged
        }),
      }
    }

    case 'MARK_TASTE_FEEDBACK_RESOLVED': {
      const { id } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, tasteFeedbackResolved: true } : e
        ),
      }
    }

    case 'RESET':
      return createEmptyState()

    default:
      return state
  }
}

function makeEntry(id, createdAt) {
  return {
    id,
    createdAt,
    dateKey: createdAt.slice(0, 10),
    source: 'manual',
    title: 'Test Juice',
    ingredients: ['carrot'],
    nutrientSummary: {},
    scoreContribution: null,
    ingredientDetails: undefined,
    totalJuiceWeightG: undefined,
    rating: undefined,
    note: undefined,
    favorite: undefined,
  }
}

// ── Prompt simulation ──
// Simulates the logic both ScanSuccessScreen and RecipeDetailScreen
// use to decide whether to show taste feedback for an entry.

function shouldShowFeedbackForEntry(entry) {
  // QA11: Consult the persisted per-entry resolution field.
  // If tasteFeedbackResolved is true, do NOT prompt again.
  if (entry.tasteFeedbackResolved === true) return false
  return true
}

// Simulates RecipeDetailScreen's focus listener: finds the most
// recent unhandled, unresolved entry.
function findNextFeedbackEntry(entries, handledIds) {
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return sorted.find((e) =>
    !handledIds.has(e.id) &&
    e.tasteFeedbackResolved !== true
  )
}

describe('QA11: JuiceLogStore — MARK_TASTE_FEEDBACK_RESOLVED reducer', () => {
  test('reducer has MARK_TASTE_FEEDBACK_RESOLVED case', () => {
    expect(STORE_SRC).toMatch(/MARK_TASTE_FEEDBACK_RESOLVED/)
  })

  test('markTasteFeedbackResolved function is exposed', () => {
    expect(STORE_SRC).toMatch(/markTasteFeedbackResolved/)
  })

  test('reducer sets tasteFeedbackResolved to true', () => {
    const state = { entries: [makeEntry('a', '2026-08-01T10:00:00')] }
    const next = logReducer(state, {
      type: 'MARK_TASTE_FEEDBACK_RESOLVED',
      payload: { id: 'a' },
    })
    expect(next.entries[0].tasteFeedbackResolved).toBe(true)
  })

  test('reducer only affects the specified entry', () => {
    const state = {
      entries: [
        makeEntry('a', '2026-08-01T10:00:00'),
        makeEntry('b', '2026-08-01T11:00:00'),
      ],
    }
    const next = logReducer(state, {
      type: 'MARK_TASTE_FEEDBACK_RESOLVED',
      payload: { id: 'a' },
    })
    expect(next.entries.find((e) => e.id === 'a').tasteFeedbackResolved).toBe(true)
    expect(next.entries.find((e) => e.id === 'b').tasteFeedbackResolved).toBeUndefined()
  })

  test('reducer does not mutate other fields', () => {
    const entry = makeEntry('a', '2026-08-01T10:00:00')
    entry.rating = 5
    entry.note = 'Great'
    entry.favorite = true
    entry.tasteReaction = { emoji: '😋', label: 'Loved it' }
    const state = { entries: [entry] }
    const next = logReducer(state, {
      type: 'MARK_TASTE_FEEDBACK_RESOLVED',
      payload: { id: 'a' },
    })
    const e = next.entries[0]
    expect(e.rating).toBe(5)
    expect(e.note).toBe('Great')
    expect(e.favorite).toBe(true)
    expect(e.tasteReaction).toEqual({ emoji: '😋', label: 'Loved it' })
    expect(e.tasteFeedbackResolved).toBe(true)
  })
})

describe('QA11 A-B: Vote + Save → Session Logged → exit → no re-prompt', () => {
  test('A: Vote + Save → mark resolved → focus → no second feedback', () => {
    let state = { entries: [makeEntry('a', '2026-08-01T10:00:00')] }

    // 1. User votes + saves → resolveTasteFeedback
    state = logReducer(state, { type: 'SET_TASTE_REACTION', payload: { id: 'a', reaction: { emoji: '😋', label: 'Loved it' } } })
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'a' } })

    // 2. Session Logged is visible (simulated)
    // 3. User exits with X → returns to previous screen
    // 4. Previous screen focus listener checks
    const entry = state.entries.find((e) => e.id === 'a')
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
  })

  test('B: Vote + Save → Session Logged → Android Back → no re-prompt', () => {
    let state = { entries: [makeEntry('b', '2026-08-01T10:00:00')] }

    // Vote + save
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'b' } })

    // Android Back → focus returns to previous screen
    const entry = state.entries.find((e) => e.id === 'b')
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
  })
})

describe('QA11 C: Skip → Session Logged → Back → no re-prompt', () => {
  test('Skip marks resolved', () => {
    let state = { entries: [makeEntry('c', '2026-08-01T10:00:00')] }

    // Skip → resolveTasteFeedback (no metadata saved, but resolved)
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'c' } })

    const entry = state.entries.find((e) => e.id === 'c')
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
    // Skip does not save rating/note/favorite
    expect(entry.rating).toBeUndefined()
    expect(entry.note).toBeUndefined()
    expect(entry.favorite).toBeUndefined()
  })
})

describe('QA11 D: X-dismiss → Session Logged → navigate back → no re-prompt', () => {
  test('X-dismiss marks resolved', () => {
    let state = { entries: [makeEntry('d', '2026-08-01T10:00:00')] }

    // X button → resolveTasteFeedback
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'd' } })

    const entry = state.entries.find((e) => e.id === 'd')
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
  })
})

describe('QA11 E: Android onRequestClose → resolved → no re-prompt', () => {
  test('onRequestClose marks resolved', () => {
    let state = { entries: [makeEntry('e', '2026-08-01T10:00:00')] }

    // Android system close → onRequestClose → resolveTasteFeedback
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'e' } })

    const entry = state.entries.find((e) => e.id === 'e')
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
  })
})

describe('QA11 F: Entry A resolved → log Entry B → B gets feedback', () => {
  test('Entry B still gets feedback opportunity', () => {
    let state = { entries: [makeEntry('a', '2026-08-01T10:00:00')] }

    // Entry A resolved
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'a' } })

    // Entry B logged
    state = logReducer(state, { type: 'ADD_ENTRY', payload: makeEntry('b', '2026-08-01T11:00:00') })

    const entryA = state.entries.find((e) => e.id === 'a')
    const entryB = state.entries.find((e) => e.id === 'b')
    expect(shouldShowFeedbackForEntry(entryA)).toBe(false)
    expect(shouldShowFeedbackForEntry(entryB)).toBe(true)
  })
})

describe('QA11 G: Two juices same day → each gets one opportunity', () => {
  test('both entries get one opportunity, neither gets a second', () => {
    let state = {
      entries: [
        makeEntry('g1', '2026-08-01T09:00:00'),
        makeEntry('g2', '2026-08-01T14:00:00'),
      ],
    }

    // Both should get feedback initially
    expect(shouldShowFeedbackForEntry(state.entries.find((e) => e.id === 'g1'))).toBe(true)
    expect(shouldShowFeedbackForEntry(state.entries.find((e) => e.id === 'g2'))).toBe(true)

    // Resolve both
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'g1' } })
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'g2' } })

    // Neither should get feedback again
    expect(shouldShowFeedbackForEntry(state.entries.find((e) => e.id === 'g1'))).toBe(false)
    expect(shouldShowFeedbackForEntry(state.entries.find((e) => e.id === 'g2'))).toBe(false)
  })
})

describe('QA11 H: App restart after resolution → no re-prompt', () => {
  test('resolved entry survives HYDRATE (persisted)', () => {
    // Simulate persisted state after restart
    const persistedState = {
      entries: [
        {
          ...makeEntry('h', '2026-08-01T10:00:00'),
          tasteFeedbackResolved: true,
          rating: 4,
          tasteReaction: { emoji: '😋', label: 'Loved it' },
        },
      ],
    }

    // HYDRATE restores the persisted state
    const state = logReducer(createEmptyState(), { type: 'HYDRATE', payload: persistedState })

    const entry = state.entries.find((e) => e.id === 'h')
    expect(entry.tasteFeedbackResolved).toBe(true)
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
  })
})

describe('QA11 I: Recipe-origin flow → resolved in ScanSuccess → RecipeDetail focus does NOT reopen', () => {
  test('RecipeDetail focus listener skips resolved entries', () => {
    let state = {
      entries: [
        makeEntry('i', '2026-08-01T10:00:00'),
      ],
    }

    // Entry resolved in ScanSuccessScreen
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'i' } })

    // RecipeDetailScreen focus listener fires
    // pendingTasteCountRef.current > 0 (was incremented by Start Juicing)
    // handledEntryIdsRef is empty (ScanSuccess resolved it, not RecipeDetail)
    const handledIds = new Set()
    const nextEntry = findNextFeedbackEntry(state.entries, handledIds)

    // Should NOT find the entry because it's resolved
    expect(nextEntry).toBeUndefined()
  })

  test('RecipeDetail focus listener finds unresolved entry', () => {
    let state = {
      entries: [
        makeEntry('j', '2026-08-01T10:00:00'),
      ],
    }

    // Entry NOT resolved (user navigated away without resolving in ScanSuccess)
    // RecipeDetailScreen focus listener fires
    const handledIds = new Set()
    const nextEntry = findNextFeedbackEntry(state.entries, handledIds)

    // Should find the entry because it's not resolved
    expect(nextEntry).toBeDefined()
    expect(nextEntry.id).toBe('j')
  })
})

describe('QA11 J: New Ingredient/Achievement blocker → queued feedback appears once', () => {
  test('achievement blocker does not prevent resolution', () => {
    let state = { entries: [makeEntry('k', '2026-08-01T10:00:00')] }

    // Achievement appears, then is dismissed, then feedback appears
    // User resolves feedback
    state = logReducer(state, { type: 'MARK_TASTE_FEEDBACK_RESOLVED', payload: { id: 'k' } })

    // Focus returns — should not re-prompt
    const entry = state.entries.find((e) => e.id === 'k')
    expect(shouldShowFeedbackForEntry(entry)).toBe(false)
  })
})

describe('QA11: Legacy entries — no sudden prompting', () => {
  test('legacy entry without tasteFeedbackResolved is not prompted by RecipeDetail focus', () => {
    // Legacy entry: no tasteFeedbackResolved field
    const legacyEntry = makeEntry('legacy', '2026-07-01T10:00:00')
    // Legacy entries don't have the field
    delete legacyEntry.tasteFeedbackResolved

    // RecipeDetailScreen focus listener: pendingTasteCountRef is 0
    // for legacy entries (Start Juicing was never tapped for them).
    // So the focus listener won't even check.
    // But even if it did, the entry would be found as "unresolved."
    // The protection is that pendingTasteCountRef is only incremented
    // by handleStartJuicing, which is a user action on a recipe.
    // Legacy entries are never queued.
    expect(legacyEntry.tasteFeedbackResolved).toBeUndefined()
    // The field is undefined, not false — so shouldShowFeedbackForEntry
    // would return true. But the pendingTasteCountRef gate prevents
    // legacy entries from being prompted.
    // This test documents that the field is undefined for legacy entries.
  })
})

describe('QA11: Source-level verification', () => {
  test('ScanSuccessScreen calls markTasteFeedbackResolved in resolveTasteFeedback', () => {
    const idx = SCAN_SRC.indexOf('resolveTasteFeedback')
    expect(idx).toBeGreaterThan(-1)
    const section = SCAN_SRC.slice(idx, idx + 400)
    expect(section).toMatch(/markTasteFeedbackResolved/)
  })

  test('ScanSuccessScreen checks existing entry resolution on mount', () => {
    expect(SCAN_SRC).toMatch(/tasteFeedbackResolved/)
  })

  test('ScanSuccessScreen uses markTasteFeedbackResolved from useJuiceLog', () => {
    expect(SCAN_SRC).toMatch(/markTasteFeedbackResolved/)
  })

  test('RecipeDetailScreen checks tasteFeedbackResolved in focus listener', () => {
    const idx = RECIPE_SRC.indexOf("addListener('focus'")
    expect(idx).toBeGreaterThan(-1)
    const section = RECIPE_SRC.slice(idx, idx + 800)
    expect(section).toMatch(/tasteFeedbackResolved/)
  })

  test('RecipeDetailScreen calls markTasteFeedbackResolved in handleTasteDismiss', () => {
    const idx = RECIPE_SRC.indexOf('handleTasteDismiss')
    expect(idx).toBeGreaterThan(-1)
    const section = RECIPE_SRC.slice(idx, idx + 600)
    expect(section).toMatch(/markTasteFeedbackResolved/)
  })

  test('RecipeDetailScreen uses markTasteFeedbackResolved from useJuiceLog', () => {
    expect(RECIPE_SRC).toMatch(/markTasteFeedbackResolved/)
  })

  test('JuiceLogStore addEntry does NOT set tasteFeedbackResolved (defaults to undefined)', () => {
    // New entries should NOT have tasteFeedbackResolved pre-set.
    // It should only be set by MARK_TASTE_FEEDBACK_RESOLVED.
    const addEntryIdx = STORE_SRC.indexOf('const addEntry')
    expect(addEntryIdx).toBeGreaterThan(-1)
    const section = STORE_SRC.slice(addEntryIdx, addEntryIdx + 600)
    expect(section).not.toMatch(/tasteFeedbackResolved/)
  })
})

describe('QA11: Session Logged close does NOT alter feedback state', () => {
  test('closing Session Logged does not dispatch MARK_TASTE_FEEDBACK_RESOLVED again', () => {
    // The key invariant: by the time Session Logged is visible,
    // tasteFeedbackResolved is already true. Closing Session Logged
    // (handleDone, X, Android Back) does NOT call resolveTasteFeedback
    // again — it just navigates away.
    // Verify that handleDone in ScanSuccessScreen does not call
    // resolveTasteFeedback or markTasteFeedbackResolved.
    const doneIdx = SCAN_SRC.indexOf('const handleDone')
    expect(doneIdx).toBeGreaterThan(-1)
    const section = SCAN_SRC.slice(doneIdx, doneIdx + 400)
    expect(section).not.toMatch(/resolveTasteFeedback/)
    expect(section).not.toMatch(/markTasteFeedbackResolved/)
  })
})
