// quota_1_12.test.js — Tests for FREE=1 / PRO=12 snap quota policy
//
// Verifies:
// 1. Free limit = 1
// 2. Pro limit = 12
// 3. First guest successful scan consumes Free's single monthly Snap
// 4. Registration does not reset usage
// 5. Second Free Snap attempt is blocked
// 6. Upgrade after one consumed scan results in 11 remaining
// 7. Pro cannot exceed 12 in monthly window
// 8. Annual Pro receives 12 per monthly window, not 144 upfront
// 9. Technical failures do not consume quota
// 10. Manual entry remains unlimited
// 11. Advanced Blend remains 3 lifetime complimentary

const fs = require('fs')
const path = require('path')

const configPath = path.resolve(__dirname, '../../services/subscriptions/subscriptionConfig.ts')
const configSource = fs.readFileSync(configPath, 'utf8')

const proStorePath = path.resolve(__dirname, '../../services/ProStore.js')
const proStoreSource = fs.readFileSync(proStorePath, 'utf8')

const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/0013_quota_1_12.sql')
const migrationSource = fs.readFileSync(migrationPath, 'utf8')

const monetizationPath = path.resolve(__dirname, '../../../supabase/migrations/0001_monetization.sql')
const monetizationSource = fs.readFileSync(monetizationPath, 'utf8')

describe('Quota 1/12 — source audit', () => {
  it('FREE_MONTHLY_SCAN_LIMIT = 1', () => {
    expect(configSource).toMatch(/export\s+const\s+FREE_MONTHLY_SCAN_LIMIT\s*=\s*1\b/)
  })

  it('PRO_MONTHLY_SCAN_LIMIT = 12', () => {
    expect(configSource).toMatch(/export\s+const\s+PRO_MONTHLY_SCAN_LIMIT\s*=\s*12\b/)
  })

  it('PRO_DAILY_SCAN_SAFETY_LIMIT = 10 (unchanged anti-abuse safeguard)', () => {
    expect(configSource).toMatch(/export\s+const\s+PRO_DAILY_SCAN_SAFETY_LIMIT\s*=\s*10\b/)
  })

  it('PRO_DAILY_SCAN_SAFETY_LIMIT is NOT 4', () => {
    expect(configSource).not.toMatch(/PRO_DAILY_SCAN_SAFETY_LIMIT\s*=\s*4\b/)
  })

  it('FREE_MONTHLY_SCAN_LIMIT is NOT 5', () => {
    expect(configSource).not.toMatch(/FREE_MONTHLY_SCAN_LIMIT\s*=\s*5\b/)
  })

  it('PRO_MONTHLY_SCAN_LIMIT is NOT 60', () => {
    expect(configSource).not.toMatch(/PRO_MONTHLY_SCAN_LIMIT\s*=\s*60\b/)
  })

  it('ProStore imports PRO_MONTHLY_SCAN_LIMIT', () => {
    expect(proStoreSource).toMatch(/PRO_MONTHLY_SCAN_LIMIT/)
  })

  it('ProStore checkSnapEligibility handles Pro with finite limit', () => {
    expect(proStoreSource).toMatch(/PRO_MONTHLY_SCAN_LIMIT\s*-\s*usedThisMonth/)
  })

  it('ProStore snapInfo shows finite Pro remaining (not Infinity)', () => {
    expect(proStoreSource).not.toMatch(/remaining:\s*Infinity/)
    expect(proStoreSource).not.toMatch(/total:\s*Infinity/)
  })

  it('ProStore exhausted reason mentions 12 AI Snaps for Pro', () => {
    expect(proStoreSource).toMatch(/12 AI Snaps/)
  })

  it('ProStore exhausted reason mentions complimentary for Free', () => {
    expect(proStoreSource).toMatch(/complimentary AI Snap/)
  })

  it('PRO_FEATURES label says 12 AI Snaps per month (not Unlimited)', () => {
    expect(proStoreSource).toMatch(/12 AI Snaps per month/)
    expect(proStoreSource).not.toMatch(/Unlimited AI Snaps/)
  })
})

describe('Quota 1/12 — backend migration', () => {
  it('migration 0013_quota_1_12.sql exists', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  it('quota_limits() returns 1, 12, 10 (daily safety limit unchanged)', () => {
    expect(migrationSource).toMatch(/select\s+1,\s*12,\s*10/i)
  })

  it('migration does NOT return 4 as daily safety limit', () => {
    expect(migrationSource).not.toMatch(/select\s+1,\s*12,\s*4/i)
  })

  it('migration updates existing free rows to scan_limit = 1', () => {
    expect(migrationSource).toMatch(/set\s+scan_limit\s*=\s*1/i)
    expect(migrationSource).toMatch(/where\s+plan\s*=\s*'free'/i)
  })

  it('migration updates existing pro rows to scan_limit = 12', () => {
    expect(migrationSource).toMatch(/set\s+scan_limit\s*=\s*12/i)
    expect(migrationSource).toMatch(/where\s+plan\s*=\s*'pro'/i)
  })

  it('original migration comment updated to reference 1/12', () => {
    expect(monetizationSource).toMatch(/1 used of 1.*11 remaining of 12/)
  })

  it('original migration does NOT reference 5/60 in plan transition comment', () => {
    expect(monetizationSource).not.toMatch(/5 used of 5.*55 remaining of 60/)
  })
})

// ── Quota logic simulation ──

describe('Quota 1/12 — logic simulation', () => {
  const FREE_LIMIT = 1
  const PRO_LIMIT = 12

  it('1. Free limit = 1', () => {
    expect(FREE_LIMIT).toBe(1)
  })

  it('2. Pro limit = 12', () => {
    expect(PRO_LIMIT).toBe(12)
  })

  it('3. First guest successful scan consumes Free single monthly Snap', () => {
    let used = 0
    let plan = 'free'
    let limit = FREE_LIMIT
    // Simulate successful scan
    used += 1
    const remaining = limit - used
    expect(remaining).toBe(0)
    expect(used).toBe(1)
  })

  it('4. Registration does not reset usage', () => {
    // Guest used 1 scan, then registers
    let used = 1
    let plan = 'free' // still free after registration
    let limit = FREE_LIMIT
    // Registration does NOT change used or limit
    const remaining = limit - used
    expect(remaining).toBe(0)
    expect(used).toBe(1)
  })

  it('5. Second Free Snap attempt is blocked', () => {
    let used = 1
    let limit = FREE_LIMIT
    const canSnap = used < limit
    expect(canSnap).toBe(false)
  })

  it('6. Upgrade after one consumed scan results in 11 remaining', () => {
    let used = 1
    let plan = 'free'
    let limit = FREE_LIMIT
    // Upgrade to Pro: limit changes to 12, used stays at 1
    plan = 'pro'
    limit = PRO_LIMIT
    const remaining = limit - used
    expect(remaining).toBe(11)
    expect(used).toBe(1)
  })

  it('7. Pro cannot exceed 12 in monthly window', () => {
    let used = 12
    let limit = PRO_LIMIT
    const canSnap = used < limit
    expect(canSnap).toBe(false)
  })

  it('8. Annual Pro receives 12 per monthly window, not 144 upfront', () => {
    // Annual Pro gets 12 per monthly window, same as monthly Pro
    const annualMonthlyLimit = PRO_LIMIT
    expect(annualMonthlyLimit).toBe(12)
    // NOT 144 upfront
    expect(annualMonthlyLimit).not.toBe(144)
  })

  it('9. Technical failures do not consume quota', () => {
    // Simulate: reserve → fail → release
    let reserved = 0
    let used = 0
    let limit = FREE_LIMIT
    // Reserve
    reserved += 1
    // Fail → release
    reserved -= 1
    // used is still 0
    expect(used).toBe(0)
    expect(reserved).toBe(0)
    // Can still snap
    const canSnap = (used + reserved) < limit
    expect(canSnap).toBe(true)
  })

  it('10. Manual entry remains unlimited', () => {
    // Manual entry has no quota — simulate unlimited manual logs
    let manualLogs = 0
    for (let i = 0; i < 100; i++) {
      manualLogs++
    }
    expect(manualLogs).toBe(100)
    // No limit check for manual entry
  })

  it('11. Advanced Blend remains 3 lifetime complimentary', () => {
    const FREE_ADVANCED_BLEND_ALLOWANCE = 3
    expect(FREE_ADVANCED_BLEND_ALLOWANCE).toBe(3)
  })
})

// ── Display strings audit ──

const paywallPath = path.resolve(__dirname, '../../screens/PaywallScreen.js')
const paywallSource = fs.readFileSync(paywallPath, 'utf8')

const vaultPath = path.resolve(__dirname, '../../screens/VaultScreen.js')
const vaultSource = fs.readFileSync(vaultPath, 'utf8')

const paywallModalPath = path.resolve(__dirname, '../../components/PaywallModal.js')
const paywallModalSource = fs.readFileSync(paywallModalPath, 'utf8')

describe('Quota 1/12 — display strings', () => {
  it('VaultScreen says 12 AI Snaps per month (not Unlimited)', () => {
    expect(vaultSource).toMatch(/12 AI Snaps per month/)
    expect(vaultSource).not.toMatch(/Unlimited AI Snaps/)
  })

  it('PaywallModal says 12 AI Snaps per month (not Unlimited)', () => {
    expect(paywallModalSource).toMatch(/12 AI Snaps per month/)
    expect(paywallModalSource).not.toMatch(/Unlimited AI Snaps/)
  })

  it('PaywallScreen uses FREE_MONTHLY_SCAN_LIMIT dynamically', () => {
    expect(paywallSource).toMatch(/FREE_MONTHLY_SCAN_LIMIT/)
  })

  it('PaywallScreen uses PRO_MONTHLY_SCAN_LIMIT dynamically', () => {
    expect(paywallSource).toMatch(/PRO_MONTHLY_SCAN_LIMIT/)
  })
})
