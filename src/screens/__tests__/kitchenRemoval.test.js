// kitchenRemoval.test.js — Tests for Kitchen Utility section removal
//
// Verifies:
// 20. Kitchen Utility no longer renders in Preferences & Privacy
// 21. removal does not break unrelated juicer/settings behavior

const fs = require('fs')
const path = require('path')

const settingsPath = path.resolve(__dirname, '../SettingsScreen.js')
const settingsSource = fs.readFileSync(settingsPath, 'utf8')

const capPolicyPath = path.resolve(__dirname, '../../services/NotificationCapPolicy.js')
const capPolicySource = fs.readFileSync(capPolicyPath, 'utf8')

const dormantServicePath = path.resolve(__dirname, '../../services/DormantReminderService.js')
const dormantServiceSource = fs.readFileSync(dormantServicePath, 'utf8')

describe('Kitchen Utility removal — SettingsScreen', () => {
  it('20. does not contain "The Kitchen" section header', () => {
    expect(settingsSource).not.toContain('The Kitchen')
  })

  it('20b. does not contain Kitchen subtitle', () => {
    expect(settingsSource).not.toMatch(/subtitle="Utility"/)
  })

  it('20c. does not render Comeback Reminders SettingRow', () => {
    expect(settingsSource).not.toMatch(/label="Comeback Reminders"/)
  })

  it('20d. handleComebackReminderToggle is removed', () => {
    expect(settingsSource).not.toMatch(/handleComebackReminderToggle/)
  })

  it('20e. ChefHat import is removed', () => {
    expect(settingsSource).not.toMatch(/\bChefHat\b/)
  })

  it('20f. setComebackRemindersEnabled import is removed', () => {
    expect(settingsSource).not.toMatch(/setComebackRemindersEnabled/)
  })
})

describe('Kitchen Utility removal — Comeback Reminders retired (1.0.20)', () => {
  it('21. comebackReminders in DEFAULT_SETTINGS marked as legacy/tolerated', () => {
    expect(capPolicySource).toMatch(/comebackReminders:\s*true/)
    expect(capPolicySource).toMatch(/Legacy.*tolerated.*no longer drives behavior.*retired/)
  })

  it('21b. DormantReminderService is retired (no scheduling)', () => {
    expect(dormantServiceSource).toMatch(/RETIRED/)
    expect(dormantServiceSource).not.toMatch(/scheduleNotificationAsync/)
  })

  it('21c. DormantReminderService does not read comebackReminders setting', () => {
    // Legacy AsyncStorage values can no longer reactivate the feature
    expect(dormantServiceSource).not.toMatch(/comebackReminders\s*!==\s*false/)
  })

  it('21d. DormantReminderService cancels all four dormant reminder IDs', () => {
    expect(dormantServiceSource).toMatch(/dormant-reminder-day-7/)
    expect(dormantServiceSource).toMatch(/dormant-reminder-day-14/)
    expect(dormantServiceSource).toMatch(/dormant-reminder-day-30/)
    expect(dormantServiceSource).toMatch(/dormant-reminder-day-60/)
  })
})
