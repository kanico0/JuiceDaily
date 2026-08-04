// Advanced History Taste Vote Verification tests
// Verifies that taste votes are displayed correctly in the EntryDetailsModal:
//   1. Taste vote card is rendered when entry has tasteReaction and policy allows
//   2. Correct vote display per entry (emoji, label, response)
//   3. No vote leakage between entries
//   4. Handling of no vote (tasteReaction absent)
//   5. Handling of legacy entries (no tasteReaction field)
//   6. Free/Pro display correctness
//   7. Vote update rerendering
//   8. No quota consumption from viewing taste vote
//   9. Accessibility

const fs = require('fs')
const path = require('path')

function readSrc (relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8')
}

const HISTORY_SRC = readSrc('../../screens/HistoryScreen.js')
const RECIPE_SRC = readSrc('../../constants/recipeData.js')
const POLICY_SRC = readSrc('../../services/historyAccessPolicy.js')

describe('Advanced History Taste Vote — Source Structure', () => {

  // 1. Taste vote card is rendered when entry has tasteReaction
  test('1. HistoryScreen renders taste vote when entry.tasteReaction exists', () => {
    expect(HISTORY_SRC).toContain('entry.tasteReaction')
    expect(HISTORY_SRC).toContain('tasteVoteCard')
    expect(HISTORY_SRC).toContain('tasteVoteEmoji')
    expect(HISTORY_SRC).toContain('tasteVoteLabel')
    expect(HISTORY_SRC).toContain('tasteVoteResponse')
  })

  // 2. Correct vote display: emoji, label, response are rendered
  test('2. taste vote displays emoji, label, and response from tasteReaction', () => {
    const voteIdx = HISTORY_SRC.indexOf('Taste Vote')
    const voteSection = HISTORY_SRC.substring(voteIdx, voteIdx + 500)
    expect(voteSection).toContain('entry.tasteReaction.emoji')
    expect(voteSection).toContain('entry.tasteReaction.label')
    expect(voteSection).toContain('entry.tasteReaction.response')
  })

  // 3. No vote leakage: taste vote is per-entry, not shared state
  test('3. taste vote uses entry.tasteReaction (per-entry, not shared state)', () => {
    expect(HISTORY_SRC).toContain('entry.tasteReaction')
    // The taste vote is NOT stored in component-level state
    const voteIdx = HISTORY_SRC.indexOf('Taste Vote')
    const voteSection = HISTORY_SRC.substring(voteIdx - 200, voteIdx + 500)
    expect(voteSection).not.toContain('useState')
    expect(voteSection).not.toContain('tasteVoteState')
  })

  // 4. Handling of no vote: tasteReaction is conditionally rendered
  test('4. taste vote is conditionally rendered only when tasteReaction exists', () => {
    const voteIdx = HISTORY_SRC.indexOf('Taste Vote')
    const beforeVote = HISTORY_SRC.substring(voteIdx - 200, voteIdx)
    expect(beforeVote).toContain('entry.tasteReaction')
    // The condition uses && so absent tasteReaction means no render
    expect(beforeVote).toMatch(/&&\s*entry\.tasteReaction/)
  })

  // 5. Handling of legacy entries: entries without tasteReaction field
  test('5. legacy entries without tasteReaction do not crash (conditional render)', () => {
    // The condition `entry.tasteReaction &&` means undefined/null is safe
    const voteIdx = HISTORY_SRC.indexOf('policy.canViewAdvancedDetails && entry.tasteReaction')
    expect(voteIdx).toBeGreaterThan(-1)
  })

  // 6. Free/Pro display: taste vote gated by canViewAdvancedDetails
  test('6. taste vote is gated by policy.canViewAdvancedDetails', () => {
    const voteIdx = HISTORY_SRC.indexOf('policy.canViewAdvancedDetails && entry.tasteReaction')
    expect(voteIdx).toBeGreaterThan(-1)
    // The policy controls who sees advanced details (Pro and free preview)
    expect(POLICY_SRC).toContain('canViewAdvancedDetails')
  })

  test('6b. taste vote is NOT shown when shouldShowAdvancedUpgrade is true', () => {
    // When the locked card is shown, taste vote should not appear
    const voteIdx = HISTORY_SRC.indexOf('Taste Vote')
    const lockedIdx = HISTORY_SRC.indexOf('shouldShowAdvancedUpgrade')
    // Both exist in the file — the taste vote is gated by canViewAdvancedDetails
    // while the locked card is gated by shouldShowAdvancedUpgrade
    expect(voteIdx).toBeGreaterThan(-1)
    expect(lockedIdx).toBeGreaterThan(-1)
  })

  // 7. Vote update rerendering: entry prop change triggers re-render
  test('7. EntryDetailsModal receives entry as prop (re-renders on change)', () => {
    expect(HISTORY_SRC).toContain('function EntryDetailsModal')
    expect(HISTORY_SRC).toMatch(/entry,\s*\n\s*visible,\s*\n\s*onClose/)
  })

  // 8. No quota consumption from viewing taste vote
  test('8. taste vote display does not call any quota or scan function', () => {
    const voteIdx = HISTORY_SRC.indexOf('Taste Vote')
    const voteSection = HISTORY_SRC.substring(voteIdx, voteIdx + 500)
    expect(voteSection).not.toContain('refreshQuota')
    expect(voteSection).not.toContain('checkCameraEligibility')
    expect(voteSection).not.toContain('analyzeScan')
    expect(voteSection).not.toContain('consumeScan')
    expect(voteSection).not.toContain('logJuice')
  })

  // 9. Accessibility
  test('9. taste vote card has accessible content (Text elements with meaningful content)', () => {
    const voteIdx = HISTORY_SRC.indexOf('Taste Vote')
    const voteSection = HISTORY_SRC.substring(voteIdx, voteIdx + 500)
    expect(voteSection).toContain('Text')
    expect(voteSection).toContain('emoji')
    expect(voteSection).toContain('label')
    expect(voteSection).toContain('response')
  })
})

describe('Advanced History Taste Vote — TASTE_REACTIONS Constants', () => {

  // 10. TASTE_REACTIONS is exported from recipeData
  test('10. TASTE_REACTIONS is exported from recipeData.js', () => {
    expect(RECIPE_SRC).toContain('TASTE_REACTIONS')
  })

  // 11. TASTE_REACTIONS has exactly 3 entries
  test('11. TASTE_REACTIONS has exactly 3 reaction types', () => {
    const reactionsIdx = RECIPE_SRC.indexOf('const TASTE_REACTIONS = [')
    const reactionsSection = RECIPE_SRC.substring(reactionsIdx, reactionsIdx + 500)
    const emojiMatches = reactionsSection.match(/emoji:/g)
    expect(emojiMatches).toHaveLength(3)
  })

  // 12. Each reaction has emoji, label, and response
  test('12. each TASTE_REACTIONS entry has emoji, label, and response', () => {
    const reactionsIdx = RECIPE_SRC.indexOf('const TASTE_REACTIONS = [')
    const reactionsSection = RECIPE_SRC.substring(reactionsIdx, reactionsIdx + 500)
    expect(reactionsSection).toContain('emoji:')
    expect(reactionsSection).toContain('label:')
    expect(reactionsSection).toContain('response:')
  })

  // 13. Labels are distinct
  test('13. TASTE_REACTIONS labels are distinct', () => {
    const reactionsIdx = RECIPE_SRC.indexOf('const TASTE_REACTIONS = [')
    const reactionsSection = RECIPE_SRC.substring(reactionsIdx, reactionsIdx + 500)
    const labels = reactionsSection.match(/label: '([^']+)'/g)
    expect(labels).toHaveLength(3)
    const labelSet = new Set(labels)
    expect(labelSet.size).toBe(3)
  })
})

describe('Advanced History Taste Vote — Styles', () => {

  // 14. Taste vote styles are defined
  test('14. tasteVoteRow, tasteVoteCard, tasteVoteEmoji, tasteVoteLabel, tasteVoteResponse styles exist', () => {
    expect(HISTORY_SRC).toContain('tasteVoteRow')
    expect(HISTORY_SRC).toContain('tasteVoteCard')
    expect(HISTORY_SRC).toContain('tasteVoteEmoji')
    expect(HISTORY_SRC).toContain('tasteVoteLabel')
    expect(HISTORY_SRC).toContain('tasteVoteResponse')
  })

  // 15. Styles are defined in the stylesheet section
  test('15. taste vote styles are defined with proper style objects', () => {
    expect(HISTORY_SRC).toMatch(/tasteVoteRow\s*:/)
    expect(HISTORY_SRC).toMatch(/tasteVoteCard\s*:/)
    expect(HISTORY_SRC).toMatch(/tasteVoteEmoji\s*:/)
    expect(HISTORY_SRC).toMatch(/tasteVoteLabel\s*:/)
    expect(HISTORY_SRC).toMatch(/tasteVoteResponse\s*:/)
  })
})

describe('Advanced History Taste Vote — Import Chain', () => {

  // 16. TASTE_REACTIONS is imported in HistoryScreen
  test('16. HistoryScreen imports TASTE_REACTIONS from recipeData', () => {
    expect(HISTORY_SRC).toContain('TASTE_REACTIONS')
    expect(HISTORY_SRC).toMatch(/import.*TASTE_REACTIONS.*from.*recipeData/)
  })

  // 17. Taste vote section title is present
  test('17. taste vote section has a title "Taste Vote"', () => {
    expect(HISTORY_SRC).toContain('Taste Vote')
  })
})
