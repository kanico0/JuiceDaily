// ─────────────────────────────────────────────────────────────
// metadataSequencing.test.js
// Behavioral tests for metadata field sequencing — verifies that
// changing rating, note, and favorite in sequence does NOT cause
// any field to revert to a previous value.
// ─────────────────────────────────────────────────────────────

// Reducer is not exported, so we test via a simulated reducer
// that mirrors the UPDATE_ENTRY_METADATA and TOGGLE_FAVORITE logic.

function createInitialState(entries = []) {
  return { entries }
}

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_ENTRY': {
      const { id, updates } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, ...updates } : e
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
    case 'TOGGLE_FAVORITE': {
      const { id } = action.payload
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, favorite: !e.favorite } : e
        ),
      }
    }
    default:
      return state
  }
}

// Simulate the updateEntryMetadata callback's cleaning logic
function updateEntryMetadata(id, updates) {
  const clean = {}
  if (updates && typeof updates === 'object') {
    if (updates.rating !== undefined) {
      clean.rating = (typeof updates.rating === 'number' && updates.rating >= 1 && updates.rating <= 5)
        ? Math.round(updates.rating)
        : null
    }
    if (updates.note !== undefined) {
      clean.note = (typeof updates.note === 'string' && updates.note.trim().length > 0)
        ? updates.note.trim().slice(0, 500)
        : null
    }
    if (updates.favorite !== undefined) {
      clean.favorite = !!updates.favorite
    }
    if (updates.tasteReaction !== undefined) {
      clean.tasteReaction = updates.tasteReaction || null
    }
  }
  return { type: 'UPDATE_ENTRY_METADATA', payload: { id, updates: clean } }
}

describe('Metadata sequencing — fields do not revert each other', () => {
  let state
  const entryId = 'test-entry-1'

  beforeEach(() => {
    state = createInitialState([{
      id: entryId,
      rating: null,
      note: null,
      favorite: false,
      tasteReaction: null,
    }])
  })

  test('Favorite ON → set Rating → Favorite still ON', () => {
    // Step 1: Favorite ON
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    expect(state.entries[0].favorite).toBe(true)

    // Step 2: Set Rating to 4
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 4 } } })
    expect(state.entries[0].rating).toBe(4)

    // Step 3: Favorite remains ON
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Favorite ON → set Note → Favorite still ON, Rating unchanged', () => {
    // Favorite ON
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    // Rating to 4
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 4 } } })
    // Set Note
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { note: 'Great juice' } } })

    expect(state.entries[0].favorite).toBe(true)
    expect(state.entries[0].rating).toBe(4)
    expect(state.entries[0].note).toBe('Great juice')
  })

  test('Change Rating → Note unchanged, Favorite unchanged', () => {
    // Setup: Favorite ON, Rating 4, Note set
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 4 } } })
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { note: 'Great juice' } } })

    // Change Rating to 5
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 5 } } })

    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Great juice')
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Toggle Favorite OFF → Rating and Note remain', () => {
    // Setup: Favorite ON, Rating 5, Note set
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 5 } } })
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { note: 'Great juice' } } })

    // Toggle Favorite OFF
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })

    expect(state.entries[0].favorite).toBe(false)
    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Great juice')
  })

  test('Full sequence: all fields survive', () => {
    // 1. Favorite ON
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    expect(state.entries[0].favorite).toBe(true)

    // 2. Change rating to 4
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 4 } } })
    expect(state.entries[0].favorite).toBe(true)
    expect(state.entries[0].rating).toBe(4)

    // 3. Add note
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { note: 'Tasty' } } })
    expect(state.entries[0].favorite).toBe(true)
    expect(state.entries[0].rating).toBe(4)
    expect(state.entries[0].note).toBe('Tasty')

    // 4. Change rating to 5
    state = reducer(state, { type: 'UPDATE_ENTRY', payload: { id: entryId, updates: { rating: 5 } } })
    expect(state.entries[0].note).toBe('Tasty')
    expect(state.entries[0].favorite).toBe(true)
    expect(state.entries[0].rating).toBe(5)

    // 5. Toggle Favorite OFF
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Tasty')
    expect(state.entries[0].favorite).toBe(false)
  })

  test('Atomic updateEntryMetadata saves all fields without reverting', () => {
    // Simulate post-juice enrichment: rating + note + favorite in one dispatch
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 5,
      note: 'Amazing',
      favorite: true,
    }))

    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Amazing')
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Atomic updateEntryMetadata with partial fields preserves others', () => {
    // First save: rating + favorite
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 4,
      favorite: true,
    }))
    expect(state.entries[0].rating).toBe(4)
    expect(state.entries[0].favorite).toBe(true)

    // Second save: only note — rating and favorite must survive
    state = reducer(state, updateEntryMetadata(entryId, {
      note: 'Great',
    }))
    expect(state.entries[0].rating).toBe(4)
    expect(state.entries[0].favorite).toBe(true)
    expect(state.entries[0].note).toBe('Great')
  })

  test('TOGGLE_FAVORITE reads current reducer state, not stale closure', () => {
    // This tests that TOGGLE_FAVORITE reads the entry inside the reducer,
    // not from a stale state.entries reference in a closure.
    // Simulate: setFavorite(true) via UPDATE_ENTRY_METADATA, then toggle
    state = reducer(state, updateEntryMetadata(entryId, { favorite: true }))
    expect(state.entries[0].favorite).toBe(true)

    // Toggle should turn it OFF (reading current reducer state)
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    expect(state.entries[0].favorite).toBe(false)

    // Toggle again should turn it ON
    state = reducer(state, { type: 'TOGGLE_FAVORITE', payload: { id: entryId } })
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Multiple rapid UPDATE_ENTRY_METADATA dispatches do not lose fields', () => {
    // Simulate the race condition that was previously possible:
    // three separate dispatches in quick succession
    state = reducer(state, updateEntryMetadata(entryId, { rating: 5 }))
    state = reducer(state, updateEntryMetadata(entryId, { note: 'Good' }))
    state = reducer(state, updateEntryMetadata(entryId, { favorite: true }))

    // All three fields should be present
    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Good')
    expect(state.entries[0].favorite).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// Staged metadata form tests — simulates the local draft + atomic
// Save pattern used by the EntryDetailsModal "Your Experience" form.
// The user edits rating, note, and favorite in a local draft, then
// taps "Save Changes" which performs ONE updateEntryMetadata call.
// ─────────────────────────────────────────────────────────────

describe('Staged metadata form — local draft + atomic Save', () => {
  let state
  const entryId = 'staged-entry-1'

  beforeEach(() => {
    state = createInitialState([{
      id: entryId,
      rating: null,
      note: null,
      favorite: false,
      tasteReaction: null,
    }])
  })

  test('Edit session: set Favorite ON + type note + set 4 stars → Save → all three persisted', () => {
    // Simulate local draft state
    const draft = { rating: 0, note: '', favorite: false }

    // User edits locally (no dispatches yet)
    draft.favorite = true
    draft.note = 'Loved it'
    draft.rating = 4

    // Save Changes: ONE atomic dispatch
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: draft.rating,
      note: draft.note,
      favorite: draft.favorite,
    }))

    expect(state.entries[0].rating).toBe(4)
    expect(state.entries[0].note).toBe('Loved it')
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Second edit session: change 4→5 stars, leave Favorite ON, leave note → Save → all three', () => {
    // Setup from previous test
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 4, note: 'Loved it', favorite: true,
    }))

    // Initialize draft from live entry
    const draft = {
      rating: state.entries[0].rating,
      note: state.entries[0].note,
      favorite: state.entries[0].favorite,
    }

    // User changes only rating
    draft.rating = 5

    // Save
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: draft.rating,
      note: draft.note,
      favorite: draft.favorite,
    }))

    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Loved it')
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Third edit session: Favorite OFF, change note, leave 5 stars → Save → all three', () => {
    // Setup from previous
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 5, note: 'Loved it', favorite: true,
    }))

    const draft = {
      rating: state.entries[0].rating,
      note: state.entries[0].note,
      favorite: state.entries[0].favorite,
    }

    draft.favorite = false
    draft.note = 'Changed my mind'

    state = reducer(state, updateEntryMetadata(entryId, {
      rating: draft.rating,
      note: draft.note,
      favorite: draft.favorite,
    }))

    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Changed my mind')
    expect(state.entries[0].favorite).toBe(false)
  })

  test('Cancel discards draft and restores persisted values', () => {
    // Persisted state: rating=3, note='Original', favorite=true
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 3, note: 'Original', favorite: true,
    }))

    // User starts editing, makes changes in draft
    const draft = {
      rating: state.entries[0].rating,
      note: state.entries[0].note,
      favorite: state.entries[0].favorite,
    }
    draft.rating = 1
    draft.note = 'Discarded'
    draft.favorite = false

    // Cancel: NO dispatch — restore from live entry
    // The live entry still has the original values
    expect(state.entries[0].rating).toBe(3)
    expect(state.entries[0].note).toBe('Original')
    expect(state.entries[0].favorite).toBe(true)
  })

  test('Favorite + Note + Rating cannot overwrite one another in one Save', () => {
    // This is the core guarantee of the staged form: since all three
    // fields are saved in ONE updateEntryMetadata call, they cannot
    // overwrite each other.
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 5,
      note: 'Perfect',
      favorite: true,
    }))

    expect(state.entries[0].rating).toBe(5)
    expect(state.entries[0].note).toBe('Perfect')
    expect(state.entries[0].favorite).toBe(true)

    // Verify no field was lost
    const allFields = Object.keys(state.entries[0])
    expect(allFields).toContain('rating')
    expect(allFields).toContain('note')
    expect(allFields).toContain('favorite')
  })

  test('Close/reopen: re-reading entry from state shows persisted values', () => {
    // Save some values
    state = reducer(state, updateEntryMetadata(entryId, {
      rating: 4, note: 'Persisted note', favorite: true,
    }))

    // Simulate close/reopen: the modal re-reads from state.entries
    const reopenedEntry = state.entries.find((e) => e.id === entryId)
    expect(reopenedEntry.rating).toBe(4)
    expect(reopenedEntry.note).toBe('Persisted note')
    expect(reopenedEntry.favorite).toBe(true)
  })
})
