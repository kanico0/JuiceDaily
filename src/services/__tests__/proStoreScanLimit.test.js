// ─────────────────────────────────────────────────────────────
// proStoreScanLimit.test.js — Verify ProStore uses the
// centralized FREE_MONTHLY_SCAN_LIMIT (1) from
// subscriptionConfig, not a hard-coded value.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function readSrc (relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8')
}

const PROSTORE_SRC = readSrc('../../services/ProStore.js')
const CONFIG_SRC = readSrc('../../services/subscriptions/subscriptionConfig.ts')

describe('ProStore scan limit audit', () => {
  test('ProStore imports FREE_MONTHLY_SCAN_LIMIT from subscriptionConfig', () => {
    expect(PROSTORE_SRC).toContain('FREE_MONTHLY_SCAN_LIMIT')
    expect(PROSTORE_SRC).toContain("from './subscriptions/subscriptionConfig'")
  })

  test('ProStore no longer hard-codes FREE_MONTHLY_SNAPS = 3', () => {
    expect(PROSTORE_SRC).not.toMatch(/FREE_MONTHLY_SNAPS\s*=\s*3\b/)
  })

  test('ProStore derives FREE_MONTHLY_SNAPS from centralized config', () => {
    expect(PROSTORE_SRC).toMatch(/FREE_MONTHLY_SNAPS\s*=\s*FREE_MONTHLY_SCAN_LIMIT/)
  })

  test('subscriptionConfig exports FREE_MONTHLY_SCAN_LIMIT = 1', () => {
    expect(CONFIG_SRC).toMatch(/export\s+const\s+FREE_MONTHLY_SCAN_LIMIT\s*=\s*1/)
  })

  test('checkSnapEligibility uses FREE_MONTHLY_SNAPS (now 1)', () => {
    expect(PROSTORE_SRC).toContain('usedThisMonth < FREE_MONTHLY_SNAPS')
    expect(PROSTORE_SRC).toContain('FREE_MONTHLY_SNAPS - usedThisMonth')
  })

  test('snapInfo label uses FREE_MONTHLY_SNAPS (now 1)', () => {
    expect(PROSTORE_SRC).toContain('${remaining}/${FREE_MONTHLY_SNAPS} Free')
    expect(PROSTORE_SRC).toContain('total: FREE_MONTHLY_SNAPS')
  })
})
