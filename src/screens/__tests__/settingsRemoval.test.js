// settingsRemoval.test.js — Tests for removed dormant Settings features
//
// Verifies:
// - App FAQ row ("Rings, streaks & more") is removed
// - Social Feed section (Glass Clinks, Weekly Leaderboard, Ghost Mode) is removed
// - Inventory Alerts SettingRow is removed
// - Shopping Reminders SettingRow is removed
// - Unused icon imports (Users, Eye, EyeOff, MessageCircle) are removed
// - Ghost Mode styles are removed

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../SettingsScreen.js')
const source = fs.readFileSync(sourcePath, 'utf8')

describe('SettingsScreen — dormant feature removal', () => {
  describe('App FAQ row removed', () => {
    it('does not contain "App FAQ" label', () => {
      expect(source).not.toContain('App FAQ')
    })

    it('does not contain "Rings, streaks & more" description', () => {
      expect(source).not.toContain('Rings, streaks & more')
    })
  })

  describe('Social Feed section removed', () => {
    it('does not contain "The Social Feed" section header', () => {
      expect(source).not.toContain('The Social Feed')
    })

    it('does not contain "Glass Clinks" setting', () => {
      expect(source).not.toContain('Glass Clinks')
    })

    it('does not contain "Weekly Leaderboard" setting', () => {
      expect(source).not.toContain('Weekly Leaderboard')
    })

    it('does not contain "Ghost Mode" setting', () => {
      expect(source).not.toContain('Ghost Mode')
    })

    it('does not reference glassClinks setting key', () => {
      expect(source).not.toMatch(/glassClinks/)
    })

    it('does not reference weeklyLeaderboard setting key', () => {
      expect(source).not.toMatch(/weeklyLeaderboard/)
    })

    it('does not reference privacyMode setting key', () => {
      expect(source).not.toMatch(/privacyMode/)
    })
  })

  describe('Inventory Alerts removed', () => {
    it('does not contain "Inventory Alerts" label', () => {
      expect(source).not.toContain('Inventory Alerts')
    })

    it('does not reference inventoryAlerts setting key', () => {
      expect(source).not.toMatch(/inventoryAlerts/)
    })
  })

  describe('Shopping Reminders removed', () => {
    it('does not contain "Shopping Reminders" label', () => {
      expect(source).not.toContain('Shopping Reminders')
    })

    it('does not reference shoppingReminders setting key', () => {
      expect(source).not.toMatch(/shoppingReminders/)
    })
  })

  describe('unused imports removed', () => {
    it('does not import Users icon', () => {
      // Check the import block — Users should not be in the lucide import
      const importBlock = source.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]lucide-react-native['"]/)
      expect(importBlock).not.toBeNull()
      expect(importBlock[0]).not.toMatch(/\bUsers\b/)
    })

    it('does not import Eye icon', () => {
      const importBlock = source.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]lucide-react-native['"]/)
      expect(importBlock).not.toBeNull()
      expect(importBlock[0]).not.toMatch(/\bEye\b/)
    })

    it('does not import EyeOff icon', () => {
      const importBlock = source.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]lucide-react-native['"]/)
      expect(importBlock).not.toBeNull()
      expect(importBlock[0]).not.toMatch(/\bEyeOff\b/)
    })

    it('does not import MessageCircle icon', () => {
      const importBlock = source.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]lucide-react-native['"]/)
      expect(importBlock).not.toBeNull()
      expect(importBlock[0]).not.toMatch(/\bMessageCircle\b/)
    })
  })

  describe('Ghost Mode styles removed', () => {
    it('does not define ghostRow style', () => {
      expect(source).not.toMatch(/ghostRow\s*:/)
    })

    it('does not define ghostInfo style', () => {
      expect(source).not.toMatch(/ghostInfo\s*:/)
    })

    it('does not define ghostLabel style', () => {
      expect(source).not.toMatch(/ghostLabel\s*:/)
    })

    it('does not define ghostDesc style', () => {
      expect(source).not.toMatch(/ghostDesc\s*:/)
    })
  })

  describe('Comeback Reminders UI retired (Kitchen Utility removed)', () => {
    it('no longer contains "Comeback Reminders" setting in UI', () => {
      expect(source).not.toContain('Comeback Reminders')
    })

    it('still references comebackReminders setting key in comments/defaults', () => {
      // The setting remains in DEFAULT_SETTINGS and DormantReminderService,
      // but the SettingsScreen no longer renders it as a user toggle.
      // The comment in SettingsScreen may still mention it.
      expect(source).toMatch(/comebackReminders/)
    })
  })
})

// ── NotificationCapPolicy defaults verification ──

const capPolicyPath = path.resolve(__dirname, '../../services/NotificationCapPolicy.js')
const capPolicySource = fs.readFileSync(capPolicyPath, 'utf8')

describe('NotificationCapPolicy — retired settings defaults removed', () => {
  it('DEFAULT_SETTINGS does not include glassClinks', () => {
    expect(capPolicySource).not.toMatch(/glassClinks/)
  })

  it('DEFAULT_SETTINGS does not include weeklyLeaderboard', () => {
    expect(capPolicySource).not.toMatch(/weeklyLeaderboard/)
  })

  it('DEFAULT_SETTINGS does not include privacyMode', () => {
    expect(capPolicySource).not.toMatch(/privacyMode/)
  })

  it('DEFAULT_SETTINGS does not include inventoryAlerts', () => {
    expect(capPolicySource).not.toMatch(/inventoryAlerts/)
  })

  it('DEFAULT_SETTINGS does not include shoppingReminders', () => {
    expect(capPolicySource).not.toMatch(/shoppingReminders/)
  })

  it('DEFAULT_SETTINGS still includes comebackReminders as legacy/tolerated', () => {
    expect(capPolicySource).toMatch(/comebackReminders/)
    expect(capPolicySource).toMatch(/Legacy.*retired/)
  })
})

// ── NotificationService retirement verification ──

const notifServicePath = path.resolve(__dirname, '../../services/NotificationService.js')
const notifServiceSource = fs.readFileSync(notifServicePath, 'utf8')

describe('NotificationService — wilt-warning and saturday-rainbow-nudge retired', () => {
  it('scheduleWiltWarning is a no-op that only cancels', () => {
    const fnMatch = notifServiceSource.match(/export async function scheduleWiltWarning[\s\S]*?\n\}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch[0]).toContain('safeCancel')
    expect(fnMatch[0]).not.toContain('scheduleNotif')
  })

  it('scheduleSaturdayNudge is a no-op that only cancels', () => {
    const fnMatch = notifServiceSource.match(/export async function scheduleSaturdayNudge[\s\S]*?\n\}/)
    expect(fnMatch).not.toBeNull()
    expect(fnMatch[0]).toContain('safeCancel')
    expect(fnMatch[0]).not.toContain('scheduleNotif')
  })

  it('does not import WILT_WARNINGS', () => {
    expect(notifServiceSource).not.toMatch(/WILT_WARNINGS/)
  })

  it('does not import COLOR_EMOJI', () => {
    expect(notifServiceSource).not.toMatch(/COLOR_EMOJI/)
  })

  it('does not register WILT_WARNING notification category', () => {
    expect(notifServiceSource).not.toMatch(/setNotificationCategoryAsync\('WILT_WARNING'/)
  })

  it('does not register SOCIAL notification category', () => {
    expect(notifServiceSource).not.toMatch(/setNotificationCategoryAsync\('SOCIAL'/)
  })

  it('reconcileNotificationSchedule still cancels wilt-warning', () => {
    const reconcileStart = notifServiceSource.indexOf('export async function reconcileNotificationSchedule')
    const reconcileSection = notifServiceSource.substring(reconcileStart, reconcileStart + 2000)
    expect(reconcileSection).toContain("safeCancel('wilt-warning')")
  })

  it('reconcileNotificationSchedule still cancels saturday-rainbow-nudge', () => {
    const reconcileStart = notifServiceSource.indexOf('export async function reconcileNotificationSchedule')
    const reconcileSection = notifServiceSource.substring(reconcileStart, reconcileStart + 2000)
    expect(reconcileSection).toContain("safeCancel('saturday-rainbow-nudge')")
  })

  it('reconcileNotificationSchedule cancels dormant-reminder-day-7', () => {
    const reconcileStart = notifServiceSource.indexOf('export async function reconcileNotificationSchedule')
    const reconcileSection = notifServiceSource.substring(reconcileStart, reconcileStart + 2500)
    expect(reconcileSection).toContain("safeCancel('dormant-reminder-day-7')")
  })

  it('reconcileNotificationSchedule cancels dormant-reminder-day-14', () => {
    const reconcileStart = notifServiceSource.indexOf('export async function reconcileNotificationSchedule')
    const reconcileSection = notifServiceSource.substring(reconcileStart, reconcileStart + 2500)
    expect(reconcileSection).toContain("safeCancel('dormant-reminder-day-14')")
  })

  it('reconcileNotificationSchedule cancels dormant-reminder-day-30', () => {
    const reconcileStart = notifServiceSource.indexOf('export async function reconcileNotificationSchedule')
    const reconcileSection = notifServiceSource.substring(reconcileStart, reconcileStart + 2500)
    expect(reconcileSection).toContain("safeCancel('dormant-reminder-day-30')")
  })

  it('reconcileNotificationSchedule cancels dormant-reminder-day-60', () => {
    const reconcileStart = notifServiceSource.indexOf('export async function reconcileNotificationSchedule')
    const reconcileSection = notifServiceSource.substring(reconcileStart, reconcileStart + 2500)
    expect(reconcileSection).toContain("safeCancel('dormant-reminder-day-60')")
  })
})
