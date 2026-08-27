// ─────────────────────────────────────────────────────────────
// SettingsOrderRegression.test.js — Proves the exact Settings
// render order: Recent Notifications → Account → Subscription
// → Help & Support.
//
// Verifies:
//   index(Recent Notifications) < index(Account)
//   index(Account) < index(Subscription)
//   index(Subscription) < index(Help & Support)
//
// Also verifies Account is NOT gated by SUPABASE_CONFIGURED.
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

const settingsPath = path.join(__dirname, '..', 'SettingsScreen.js')
const source = fs.readFileSync(settingsPath, 'utf8')

// Helper: find the line index of a section marker in the render
// function's JSX. We look for the comment markers and the
// component render lines.
function findSectionIndices (src) {
  const lines = src.split('\n')

  // Recent Notifications section
  const recentNotificationsIdx = lines.findIndex(l =>
    l.includes('RECENT NOTIFICATIONS') && l.includes('═══'),
  )

  // Account section — the <AccountSection /> render line
  // (NOT the function definition)
  const accountSectionIdx = lines.findIndex((l, i) =>
    i > 200 && l.includes('<AccountSection') && !l.includes('function'),
  )

  // Subscription section — the <SubscriptionSection render line
  const subscriptionSectionIdx = lines.findIndex((l, i) =>
    i > 200 && l.includes('<SubscriptionSection') && !l.includes('function'),
  )

  // Help & Support section — the actual title="Help & Support"
  // render line (NOT the comment marker which is a section divider
  // that precedes Account and Subscription)
  const helpSupportIdx = lines.findIndex((l, i) =>
    i > 200 && l.includes('title="Help & Support"'),
  )

  return {
    recentNotifications: recentNotificationsIdx,
    account: accountSectionIdx,
    subscription: subscriptionSectionIdx,
    helpSupport: helpSupportIdx,
  }
}

describe('Settings section render order', () => {
  const indices = findSectionIndices(source)

  test('all four section markers are found', () => {
    expect(indices.recentNotifications).toBeGreaterThanOrEqual(0)
    expect(indices.account).toBeGreaterThanOrEqual(0)
    expect(indices.subscription).toBeGreaterThanOrEqual(0)
    expect(indices.helpSupport).toBeGreaterThanOrEqual(0)
  })

  test('index(Recent Notifications) < index(Account)', () => {
    expect(indices.recentNotifications).toBeLessThan(indices.account)
  })

  test('index(Account) < index(Subscription)', () => {
    expect(indices.account).toBeLessThan(indices.subscription)
  })

  test('index(Subscription) < index(Help & Support)', () => {
    expect(indices.subscription).toBeLessThan(indices.helpSupport)
  })

  test('full order: Recent Notifications → Account → Subscription → Help & Support', () => {
    expect(indices.recentNotifications).toBeLessThan(indices.account)
    expect(indices.account).toBeLessThan(indices.subscription)
    expect(indices.subscription).toBeLessThan(indices.helpSupport)
  })

  test('Account section is NOT gated by SUPABASE_CONFIGURED', () => {
    // The AccountSection render line should NOT be wrapped in
    // a SUPABASE_CONFIGURED conditional.
    const lines = source.split('\n')
    const accountLine = lines[indices.account]
    // The line should be just <AccountSection /> or <AccountSection>
    // NOT {SUPABASE_CONFIGURED && <AccountSection />}
    expect(accountLine).not.toContain('SUPABASE_CONFIGURED')
  })

  test('Account section renders unconditionally (no conditional wrapper on preceding line)', () => {
    const lines = source.split('\n')
    // Check the line before <AccountSection /> — it should not be
    // a conditional wrapper like {SUPABASE_CONFIGURED && (
    const prevLine = lines[indices.account - 1]
    if (prevLine && prevLine.trim()) {
      expect(prevLine).not.toContain('SUPABASE_CONFIGURED')
    }
  })

  test('Account section is between Recent Notifications and Help & Support even if Subscription is disabled', () => {
    // The Account section must be between Recent Notifications and
    // Help & Support regardless of whether Subscription is rendered.
    // Since Subscription is gated by MONETIZATION_ENABLED, Account
    // must still be in the right position.
    expect(indices.recentNotifications).toBeLessThan(indices.account)
    expect(indices.account).toBeLessThan(indices.helpSupport)
  })
})

describe('Settings section order — Gradle preflight integration', () => {
  test('android/app/build.gradle wires preflightProduction to bundleRelease', () => {
    const gradlePath = path.join(__dirname, '..', '..', '..', 'android', 'app', 'build.gradle')
    const gradle = fs.readFileSync(gradlePath, 'utf8')

    // The preflight task must exist
    expect(gradle).toContain('preflightProduction')

    // It must be wired to bundleRelease
    expect(gradle).toContain("bundleRelease")

    // It must be wired to assembleRelease
    expect(gradle).toContain("assembleRelease")

    // The dependency must be configured
    expect(gradle).toContain("dependsOn 'preflightProduction'")
  })

  test('preflight script exists at scripts/preflight-production.mjs', () => {
    const preflightPath = path.join(__dirname, '..', '..', '..', 'scripts', 'preflight-production.mjs')
    expect(fs.existsSync(preflightPath)).toBe(true)
  })

  test('package.json has preflight:production script', () => {
    const pkgPath = path.join(__dirname, '..', '..', '..', 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    expect(pkg.scripts['preflight:production']).toBeDefined()
  })
})
