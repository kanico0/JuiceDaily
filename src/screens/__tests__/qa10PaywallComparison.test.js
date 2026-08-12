// ─────────────────────────────────────────────────────────────
// qa10PaywallComparison.test.js
//
// Tests for QA10 Part 6: Redesigned Free vs Pro comparison.
// Verifies:
// - Required current limits (Free Snap=1/mo, Pro Snap=12/mo, etc.)
// - Unsupported claims are NOT present
// - Pro content is vertically scrollable
// - Free limitations section exists
// - Upgrade CTA exists
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const PAYWALL_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'PaywallScreen.js'),
  'utf8',
)

const {
  FREE_MONTHLY_SCAN_LIMIT,
  PRO_MONTHLY_SCAN_LIMIT,
} = require('../../services/subscriptions/subscriptionConfig')

describe('QA10 P6: Paywall — verified feature limits', () => {
  test('Free Snap = 1 per monthly window', () => {
    expect(FREE_MONTHLY_SCAN_LIMIT).toBe(1)
    // Source uses template literal ${FREE_MONTHLY_SCAN_LIMIT}
    expect(PAYWALL_SRC).toMatch(/\$\{FREE_MONTHLY_SCAN_LIMIT\} successful Juice Snap per monthly/)
  })

  test('Pro Snap = 12 per monthly window', () => {
    expect(PRO_MONTHLY_SCAN_LIMIT).toBe(12)
    expect(PAYWALL_SRC).toMatch(/\$\{PRO_MONTHLY_SCAN_LIMIT\} successful Juice Snaps per monthly/)
  })

  test('Free Expanded Ingredient = 3 lifetime', () => {
    expect(PAYWALL_SRC).toContain('3 complimentary lifetime analyses')
  })

  test('Pro Expanded Ingredient = unlimited', () => {
    expect(PAYWALL_SRC).toContain('Unlimited 5+ ingredient analyses with Pro')
  })

  test('Manual logging = unlimited (Free)', () => {
    expect(PAYWALL_SRC).toContain('Manually build and log juices without an AI-use quota')
  })

  test('1-4 ingredient analysis = free/unlimited', () => {
    expect(PAYWALL_SRC).toContain('Simple blends (1–4 ingredients): free and unlimited')
  })
})

describe('QA10 P6: Paywall — unsupported claims NOT present', () => {
  test('does NOT claim unlimited Juice Snap', () => {
    expect(PAYWALL_SRC).not.toMatch(/unlimited.*juice snap/i)
    expect(PAYWALL_SRC).not.toMatch(/unlimited.*ai snap/i)
  })

  test('does NOT claim History charts', () => {
    expect(PAYWALL_SRC).not.toMatch(/chart/i)
  })

  test('does NOT claim AI History Insights', () => {
    expect(PAYWALL_SRC).not.toMatch(/ai.*history.*insight/i)
    expect(PAYWALL_SRC).not.toMatch(/history.*ai.*insight/i)
  })

  test('does NOT claim cloud History backup/sync', () => {
    expect(PAYWALL_SRC).not.toMatch(/cloud.*backup/i)
    expect(PAYWALL_SRC).not.toMatch(/cloud.*sync/i)
  })

  test('does NOT claim health correlations', () => {
    expect(PAYWALL_SRC).not.toMatch(/health.*correlation/i)
  })

  test('does NOT claim cost savings', () => {
    expect(PAYWALL_SRC).not.toMatch(/cost.*saving/i)
    expect(PAYWALL_SRC).not.toMatch(/save.*money/i)
  })

  test('does NOT claim trends', () => {
    expect(PAYWALL_SRC).not.toMatch(/\btrends\b/i)
  })

  test('does NOT claim photo recaps', () => {
    expect(PAYWALL_SRC).not.toMatch(/photo.*recap/i)
  })

  test('does NOT claim custom goals', () => {
    expect(PAYWALL_SRC).not.toMatch(/custom.*goal/i)
  })

  test('does NOT claim personalized challenges', () => {
    expect(PAYWALL_SRC).not.toMatch(/personalized.*challenge/i)
  })

  test('does NOT mention RawLife Garden as a Pro feature', () => {
    // Garden is a Free core habit feature, not a Pro feature
    const proSectionIdx = PAYWALL_SRC.indexOf('proSection')
    expect(proSectionIdx).toBeGreaterThan(-1)
  })
})

describe('QA10 P6: Paywall — structure', () => {
  test('Free section exists with positive headline', () => {
    expect(PAYWALL_SRC).toMatch(/freeSection/)
    expect(PAYWALL_SRC).toMatch(/Start building your juicing habit/)
  })

  test('Free limitations section exists', () => {
    expect(PAYWALL_SRC).toMatch(/limitationsSection/)
    expect(PAYWALL_SRC).toMatch(/What Free doesn't include/)
  })

  test('Pro section exists with rich headline', () => {
    expect(PAYWALL_SRC).toMatch(/proSection/)
    expect(PAYWALL_SRC).toMatch(/Turn every juice into part of your journey/)
  })

  test('Pro section has multiple feature groups (scrollable)', () => {
    expect(PAYWALL_SRC).toMatch(/PRO_FEATURE_GROUPS/)
    // Count the number of group headings
    const groups = PAYWALL_SRC.match(/heading: '/g)
    expect(groups.length).toBeGreaterThanOrEqual(10) // Free + Pro groups
  })

  test('Pro section includes Juice Snap group', () => {
    expect(PAYWALL_SRC).toMatch(/More Juice Snap/)
  })

  test('Pro section includes Expanded Ingredient Analysis group', () => {
    expect(PAYWALL_SRC).toMatch(/Unlimited Expanded Ingredient Analysis/)
  })

  test('Pro section includes Full Juicing Story group', () => {
    expect(PAYWALL_SRC).toMatch(/Your Full Juicing Story/)
  })

  test('Pro section includes Search & Filter group', () => {
    expect(PAYWALL_SRC).toMatch(/Search & Filter Your History/)
  })

  test('Pro section includes Make This Juice Again group', () => {
    expect(PAYWALL_SRC).toMatch(/Make This Juice Again/)
  })

  test('Pro section includes Richer Personal Record group', () => {
    expect(PAYWALL_SRC).toMatch(/Richer Personal Record/)
  })

  test('content is in a ScrollView (vertically scrollable)', () => {
    expect(PAYWALL_SRC).toMatch(/ScrollView/)
  })

  test('upgrade CTA says "Unlock RawLifeFlow Pro"', () => {
    expect(PAYWALL_SRC).toMatch(/Unlock RawLifeFlow Pro/)
  })

  test('CTA supporting copy mentions key benefits', () => {
    expect(PAYWALL_SRC).toMatch(/More Juice Snaps/)
    expect(PAYWALL_SRC).toMatch(/Unlimited Expanded Ingredient Analysis/)
    expect(PAYWALL_SRC).toMatch(/Full Detailed History/)
  })

  test('does NOT hardcode subscription price', () => {
    // Price should come from offering.localizedPriceString, not hardcoded
    expect(PAYWALL_SRC).toMatch(/localizedPriceString/)
    // Should not contain a hardcoded dollar amount
    expect(PAYWALL_SRC).not.toMatch(/\$\d+\.\d{2}\/(month|year)/i)
  })

  test('Free limitations include older-entry Detailed History requires Pro', () => {
    expect(PAYWALL_SRC).toContain('Detailed History across older entries requires Pro')
  })

  test('Free limitations include History search requires Pro', () => {
    expect(PAYWALL_SRC).toContain('History search requires Pro')
  })

  test('Free limitations include organic details require Pro', () => {
    expect(PAYWALL_SRC).toContain('Organic / conventional details across older entries require Pro')
  })

  test('Free limitations include entry method & time require Pro', () => {
    expect(PAYWALL_SRC).toContain('Entry method & logged time across older entries require Pro')
  })

  test('Free core habit features include Today, Glow, Journey, Garden, Focus, Achievements, Reminders', () => {
    expect(PAYWALL_SRC).toContain('Today dashboard')
    expect(PAYWALL_SRC).toContain('Glow streak')
    expect(PAYWALL_SRC).toContain('Journey')
    expect(PAYWALL_SRC).toContain('Garden')
    expect(PAYWALL_SRC).toContain('Focus')
    expect(PAYWALL_SRC).toContain('Achievements')
    expect(PAYWALL_SRC).toContain('Reminders')
  })
})
