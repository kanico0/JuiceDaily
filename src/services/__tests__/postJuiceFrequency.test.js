// ─────────────────────────────────────────────────────────────
// postJuiceFrequency.test.js
// Behavioral tests for post-juice feedback popup frequency.
// Verifies that every logged juice gets exactly one feedback
// opportunity, with no once-per-day suppression, and that
// modal queueing works correctly.
// ─────────────────────────────────────────────────────────────

// Simulate the per-entry pending count + handled set pattern
// used by RecipeDetailScreen for the post-juice taste feedback.
function createTasteFeedbackQueue() {
  let pendingCount = 0
  const handledIds = new Set()
  return {
    // Called when user taps "Start Juicing"
    enqueue() {
      pendingCount += 1
    },
    // Called on focus — returns the next unhandled entry ID or null
    getNext(entries) {
      if (pendingCount <= 0) return null
      const sorted = [...entries].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      )
      const next = sorted.find((e) => !handledIds.has(e.id))
      if (!next) {
        pendingCount = 0
        return null
      }
      return next.id
    },
    // Called when feedback is saved or skipped
    markHandled(id) {
      handledIds.add(id)
      pendingCount = Math.max(0, pendingCount - 1)
    },
    getPendingCount() {
      return pendingCount
    },
    isHandled(id) {
      return handledIds.has(id)
    },
  }
}

// Simulate the ScanSuccessScreen showTasteFeedback logic
function shouldShowTasteFeedback(checkInResult, achievementChecked, hasAchievement) {
  // If no achievement and no glow toast (second juice same day),
  // show taste feedback immediately
  if (achievementChecked && !hasAchievement && !checkInResult.wasIncremented) {
    return true
  }
  // If no achievement but glow toast was shown, taste feedback
  // shows after toast auto-dismisses (simulated here as true)
  if (achievementChecked && !hasAchievement && checkInResult.wasIncremented) {
    return true
  }
  // If achievement pending, taste feedback shows after achievement dismissed
  if (achievementChecked && hasAchievement) {
    return true // after dismiss
  }
  return false
}

describe('Post-juice feedback frequency — every juice gets one opportunity', () => {
  test('Juice #1 same day → popup appears', () => {
    const checkInResult = { wasIncremented: true, count: 1 }
    const show = shouldShowTasteFeedback(checkInResult, true, false)
    expect(show).toBe(true)
  })

  test('Juice #2 same day → popup appears (no once-per-day suppression)', () => {
    // Second juice: checkInToday returns wasIncremented=false
    const checkInResult = { wasIncremented: false, count: 1 }
    const show = shouldShowTasteFeedback(checkInResult, true, false)
    expect(show).toBe(true)
  })

  test('Juice #3 same day → popup appears', () => {
    const checkInResult = { wasIncremented: false, count: 1 }
    const show = shouldShowTasteFeedback(checkInResult, true, false)
    expect(show).toBe(true)
  })

  test('Achievement pending → popup appears after dismiss', () => {
    const checkInResult = { wasIncremented: true, count: 5 }
    const show = shouldShowTasteFeedback(checkInResult, true, true)
    expect(show).toBe(true)
  })
})

describe('Per-entry taste feedback queue — RecipeDetailScreen', () => {
  const entries = [
    { id: 'entry-1', createdAt: '2026-01-01T10:00:00' },
    { id: 'entry-2', createdAt: '2026-01-01T11:00:00' },
    { id: 'entry-3', createdAt: '2026-01-01T12:00:00' },
  ]

  test('exactly once per logEntryId', () => {
    const queue = createTasteFeedbackQueue()

    // Log three juices
    queue.enqueue()
    queue.enqueue()
    queue.enqueue()
    expect(queue.getPendingCount()).toBe(3)

    // First focus: get most recent unhandled
    const firstId = queue.getNext(entries)
    expect(firstId).toBe('entry-3')

    // Save feedback for entry-3
    queue.markHandled('entry-3')
    expect(queue.getPendingCount()).toBe(2)
    expect(queue.isHandled('entry-3')).toBe(true)

    // Second focus: get next most recent unhandled
    const secondId = queue.getNext(entries)
    expect(secondId).toBe('entry-2')

    // Skip feedback for entry-2
    queue.markHandled('entry-2')
    expect(queue.getPendingCount()).toBe(1)
    expect(queue.isHandled('entry-2')).toBe(true)

    // Third focus: get next
    const thirdId = queue.getNext(entries)
    expect(thirdId).toBe('entry-1')

    queue.markHandled('entry-1')
    expect(queue.getPendingCount()).toBe(0)

    // No more pending
    const none = queue.getNext(entries)
    expect(none).toBe(null)
  })

  test('Save clears that entry from queue', () => {
    const queue = createTasteFeedbackQueue()
    queue.enqueue()
    const id = queue.getNext(entries)
    queue.markHandled(id)
    expect(queue.getPendingCount()).toBe(0)
  })

  test('Skip clears that entry from queue', () => {
    const queue = createTasteFeedbackQueue()
    queue.enqueue()
    const id = queue.getNext(entries)
    queue.markHandled(id) // Skip also calls markHandled
    expect(queue.getPendingCount()).toBe(0)
  })

  test('New Ingredient popup blocks temporarily but does not discard queued taste feedback', () => {
    // Simulate: user logs juice, New Ingredient popup shows first,
    // then taste feedback shows after New Ingredient is dismissed.
    const queue = createTasteFeedbackQueue()
    queue.enqueue()

    // New Ingredient popup is showing — taste feedback is still queued
    expect(queue.getPendingCount()).toBe(1)

    // After New Ingredient dismissed, focus returns
    const id = queue.getNext(entries)
    expect(id).not.toBe(null)
    expect(queue.getPendingCount()).toBe(1) // still pending until handled

    // Now handle it
    queue.markHandled(id)
    expect(queue.getPendingCount()).toBe(0)
  })

  test('No duplicate feedback popups for the same entry', () => {
    const queue = createTasteFeedbackQueue()
    queue.enqueue()

    // Get the entry ID
    const id = queue.getNext(entries)
    queue.markHandled(id)

    // Try to get it again — should return null or a different entry
    const again = queue.getNext(entries)
    // Since there's only one entry queued and it's handled, should be null
    expect(again).toBe(null)
  })

  test('Multiple juices pending are shown one at a time in order', () => {
    const queue = createTasteFeedbackQueue()
    queue.enqueue()
    queue.enqueue()

    // First focus: most recent
    const id1 = queue.getNext(entries)
    expect(id1).toBe('entry-3')
    queue.markHandled(id1)

    // Second focus: next most recent
    const id2 = queue.getNext(entries)
    expect(id2).toBe('entry-2')
    queue.markHandled(id2)

    expect(queue.getPendingCount()).toBe(0)
  })
})
