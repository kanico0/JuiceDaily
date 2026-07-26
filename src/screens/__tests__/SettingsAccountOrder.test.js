const fs = require('fs')
const path = require('path')

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', 'SettingsScreen.js'),
  'utf8'
)

describe('Settings section order — Account first', () => {
  // 1. Account is the first settings section
  test('Account is the first settings section below the header', () => {
    const scrollViewStart = settingsSource.indexOf('<ScrollView')
    const accountPos = settingsSource.indexOf('<AccountSection')
    const weightPos = settingsSource.indexOf('Weight Display')

    expect(accountPos).toBeGreaterThan(scrollViewStart)
    expect(accountPos).toBeLessThan(weightPos)
  })

  // 2. No settings section heading appears before Account
  test('no settings section heading appears before Account', () => {
    const scrollViewStart = settingsSource.indexOf('<ScrollView')
    const accountPos = settingsSource.indexOf('<AccountSection')

    // Extract the section between ScrollView open and AccountSection
    const beforeAccount = settingsSource.slice(scrollViewStart, accountPos)

    // No SectionHeader should appear before Account
    expect(beforeAccount).not.toContain('<SectionHeader')
    // No Weight Display card
    expect(beforeAccount).not.toContain('Weight Display')
    // No Notification Intensity
    expect(beforeAccount).not.toContain('Notification Intensity')
    // No Organic Default
    expect(beforeAccount).not.toContain('Organic Default')
    // No Juicer Type
    expect(beforeAccount).not.toContain('My Juicer Type')
  })

  // 3. Account renders only once
  test('Account renders only once', () => {
    const matches = settingsSource.match(/<AccountSection/g)
    expect(matches).toHaveLength(1)
  })

  // 4. Signed-out users see Sign In or Create Account at the top
  test('signed-out users see Sign In or Create Account', () => {
    expect(settingsSource).toContain('Sign In or Create Account')
  })

  // 5. Signed-in users see email, plan, and remaining scans
  test('signed-in users see email, plan, and remaining scans', () => {
    expect(settingsSource).toContain('Signed in as')
    expect(settingsSource).toContain('RawLifeFlow Pro')
    expect(settingsSource).toContain('Free Plan')
    expect(settingsSource).toContain('formatCanonicalQuotaLabel')
    expect(settingsSource).toContain('Manual ingredient entry is always unlimited')
  })

  // 6. Sign-in still opens the existing authentication modal
  test('sign-in opens the existing authentication modal', () => {
    expect(settingsSource).toContain('<AccountGateModal')
    expect(settingsSource).toContain('openGate')
    expect(settingsSource).toContain('setGateVisible(true)')
  })

  // 7. Sign-out still refreshes quota and subscription state
  test('sign-out refreshes quota and subscription state', () => {
    const signOutBlock = settingsSource.match(/handleSignOut[\s\S]*?loadAccount\(\)[\s\S]*?\n\s*\}/)
    expect(signOutBlock).toBeTruthy()
    expect(signOutBlock[0]).toContain('refreshQuota()')
    expect(signOutBlock[0]).toContain('refreshSubscription()')
  })

  // 8. Delete Account remains available
  test('Delete Account remains available', () => {
    expect(settingsSource).toContain('<DeleteAccountModal')
    expect(settingsSource).toContain('openDeleteAccount')
    expect(settingsSource).toContain('setDeleteVisible(true)')
  })

  // 9. Notifications and all other settings still render
  test('notifications and all other settings still render', () => {
    expect(settingsSource).toContain('Notification Intensity')
    expect(settingsSource).toContain('The Pulse')
    expect(settingsSource).toContain('The Social Feed')
    expect(settingsSource).toContain('The Kitchen')
    expect(settingsSource).toContain('My Resting Hours')
    expect(settingsSource).toContain('Weight Display')
    expect(settingsSource).toContain('Organic Default')
    expect(settingsSource).toContain('My Juicer Type')
    expect(settingsSource).toContain('Help & Support')
    expect(settingsSource).toContain('SubscriptionSection')
  })

  // 10. No legacy Vault, Architect, Freezer Pass, Lifetime, or scan-pack route
  test('no legacy Vault, Architect, Freezer Pass, Lifetime, or scan-pack route', () => {
    expect(settingsSource).not.toContain('Vault')
    expect(settingsSource).not.toContain('Architect')
    expect(settingsSource).not.toContain('FreezerPass')
    expect(settingsSource).not.toContain('freezerPass')
    expect(settingsSource).not.toContain('Lifetime')
    expect(settingsSource).not.toContain('lifetime')
    expect(settingsSource).not.toContain('snapPack')
    expect(settingsSource).not.toContain('SnapPack')
  })
})

describe('Settings section order verification', () => {
  test('order is: Account, Subscription, then other sections', () => {
    const accountPos = settingsSource.indexOf('<AccountSection')
    const subscriptionPos = settingsSource.indexOf('<SubscriptionSection')
    const helpPos = settingsSource.indexOf('Help & Support')
    const weightPos = settingsSource.indexOf('Weight Display')
    const notificationPos = settingsSource.indexOf('Notification Intensity')

    // Account is first
    expect(accountPos).toBeLessThan(subscriptionPos)
    expect(accountPos).toBeLessThan(weightPos)
    expect(accountPos).toBeLessThan(notificationPos)
    expect(accountPos).toBeLessThan(helpPos)

    // Subscription comes after Account
    expect(subscriptionPos).toBeGreaterThan(accountPos)
    expect(subscriptionPos).toBeLessThan(helpPos)
  })
})
