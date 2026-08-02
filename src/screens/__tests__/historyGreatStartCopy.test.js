// History "Great start" paragraph copy tests
// Verifies the updated copy explains Free vs Pro detailed-history model.

const fs = require('fs')
const path = require('path')

const historySource = fs.readFileSync(
  path.join(__dirname, '..', 'HistoryScreen.js'),
  'utf8',
)

// Extract the ENCOURAGEMENT_COPY array — find the closing bracket on its own line
const copyStart = historySource.indexOf('export const ENCOURAGEMENT_COPY = [')
const copyEnd = historySource.indexOf('\n]', copyStart + 1)
const copySection = historySource.substring(copyStart, copyEnd + 2)

describe('History "Great start" copy: presence and content', () => {
  test('1. "Great start" title is present', () => {
    expect(copySection).toContain("title: 'Great start'")
  })

  test('2. Copy says complete basic Juice History remains available', () => {
    expect(copySection).toContain('complete basic Juice History')
  })

  test('3. Copy explains Free users get advanced details for latest juice', () => {
    expect(copySection).toContain('Free members')
    expect(copySection).toContain('advanced details')
    expect(copySection).toContain('latest juice')
  })

  test('4. Copy explains RawLifeFlow Pro unlocks detailed history for every juice', () => {
    expect(copySection).toContain('RawLifeFlow Pro')
    expect(copySection).toContain('detailed history')
    expect(copySection).toContain('every juice')
  })

  test('5. Copy does not say older entries are deleted', () => {
    const greatStartIdx = copySection.indexOf("title: 'Great start'")
    const bodyStart = copySection.indexOf('body:', greatStartIdx)
    const bodyEnd = copySection.indexOf("',", bodyStart)
    const body = copySection.substring(bodyStart, bodyEnd)
    expect(body).not.toContain('deleted')
    expect(body).not.toContain('removed')
    expect(body).not.toContain('expire')
  })

  test('6. Copy does not imply Free users see only one history record', () => {
    const greatStartIdx = copySection.indexOf("title: 'Great start'")
    const bodyStart = copySection.indexOf('body:', greatStartIdx)
    const bodyEnd = copySection.indexOf("',", bodyStart)
    const body = copySection.substring(bodyStart, bodyEnd)
    expect(body).not.toContain('only one')
    expect(body).not.toContain('limited to one')
  })

  test('7. Copy uses "RawLifeFlow Pro" (not "premium users")', () => {
    const greatStartIdx = copySection.indexOf("title: 'Great start'")
    const bodyStart = copySection.indexOf('body:', greatStartIdx)
    const bodyEnd = copySection.indexOf("',", bodyStart)
    const body = copySection.substring(bodyStart, bodyEnd)
    expect(body).toContain('RawLifeFlow Pro')
    expect(body).not.toContain('premium users')
  })

  test('8. Copy does not say users must pay to recover records', () => {
    const greatStartIdx = copySection.indexOf("title: 'Great start'")
    const bodyStart = copySection.indexOf('body:', greatStartIdx)
    const bodyEnd = copySection.indexOf("',", bodyStart)
    const body = copySection.substring(bodyStart, bodyEnd)
    expect(body).not.toContain('recover')
    expect(body).not.toContain('must pay')
  })
})

describe('History "Great start" copy: text token and readability', () => {
  test('9. encouragementBody uses SEMANTIC_COLORS.textSecondary', () => {
    expect(historySource).toContain('SEMANTIC_COLORS.textSecondary')
    // Verify it's used in the encouragementBody style
    const styleIdx = historySource.indexOf('encouragementBody:')
    const styleSection = historySource.substring(styleIdx, styleIdx + 200)
    expect(styleSection).toContain('SEMANTIC_COLORS.textSecondary')
  })

  test('10. encouragementBody has lineHeight for readability', () => {
    const styleIdx = historySource.indexOf('encouragementBody:')
    const styleSection = historySource.substring(styleIdx, styleIdx + 200)
    expect(styleSection).toContain('lineHeight')
  })

  test('11. EncouragementCard uses accessibilityRole="summary"', () => {
    expect(historySource).toContain('accessibilityRole="summary"')
  })

  test('12. Encouragement body text is rendered (not hidden)', () => {
    expect(historySource).toContain('style={s.encouragementBody}')
  })
})

describe('History "Great start" copy: entitlement and state behavior', () => {
  test('13. Encouragement copy is the same for all entitlement states (no conditional copy)', () => {
    // The ENCOURAGEMENT_COPY is a static array, not dependent on isPro
    const copyStart = historySource.indexOf('export const ENCOURAGEMENT_COPY = [')
    const copyEnd = historySource.indexOf(']', copyStart + 1)
    const copySection = historySource.substring(copyStart, copyEnd + 1)
    // Should not contain isPro or entitlement checks in the copy array
    expect(copySection).not.toContain('isPro')
    expect(copySection).not.toContain('entitlement')
  })

  test('14. getEncouragementCopy does not depend on entitlement', () => {
    const funcIdx = historySource.indexOf('export function getEncouragementCopy')
    const funcSection = historySource.substring(funcIdx, funcIdx + 200)
    expect(funcSection).not.toContain('isPro')
    expect(funcSection).not.toContain('entitlement')
  })

  test('15. EncouragementCard renders for both empty and populated history', () => {
    // The encouragement card is rendered when encouragement is truthy
    expect(historySource).toContain('{encouragement && (')
    expect(historySource).toContain('<EncouragementCard')
  })
})

describe('History "Great start" copy: existing UI preserved', () => {
  test('16. Advanced Preview badge copy remains unchanged', () => {
    expect(historySource).toContain('Advanced Preview')
  })

  test('17. Locked detail copy remains unchanged', () => {
    expect(historySource).toContain('advanced details')
    expect(historySource).toContain('Unlock')
  })

  test('18. Loading placeholder copy remains unchanged', () => {
    expect(historySource).toContain('Checking history access')
  })

  test('19. Other encouragement entries are unchanged (index 0)', () => {
    expect(copySection).toContain('Start your juice journey')
  })

  test('20. Other encouragement entries are unchanged (index 2)', () => {
    expect(copySection).toContain('building momentum')
  })
})
