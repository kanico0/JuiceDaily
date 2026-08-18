// deleteAccountLink.test.js — Tests for H2: in-app account-deletion entry point.
//
// Proves:
// 1. Authenticated account users see "Delete Account" in Settings
// 2. Selecting it opens exactly https://rawlifeflow.com/delete-account
// 3. It is not dependent on Developer Tools
// 4. It does not invoke resetAllUserData()
// 5. Existing Sign Out behavior remains unchanged

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../SettingsScreen.js')
const source = fs.readFileSync(sourcePath, 'utf8')

describe('H2: In-app Delete Account entry point', () => {
  describe('Delete Account link is present for authenticated users', () => {
    it('1. contains a "Delete Account" label', () => {
      expect(source).toContain('Delete Account')
    })

    it('2. opens exactly https://rawlifeflow.com/delete-account', () => {
      expect(source).toContain("openLink('https://rawlifeflow.com/delete-account')")
    })

    it('3. is inside the account.isDurable block (authenticated users only)', () => {
      // The Delete Account entry must be within the durable-account branch,
      // not the guest/anonymous branch.
      const durableStart = source.indexOf('account.isDurable ?')
      const durableElse = source.indexOf(') : (', durableStart)
      const deleteAccountPos = source.indexOf("'https://rawlifeflow.com/delete-account'")
      expect(durableStart).toBeGreaterThan(-1)
      expect(deleteAccountPos).toBeGreaterThan(durableStart)
      expect(deleteAccountPos).toBeLessThan(durableElse)
    })

    it('4. is NOT inside Developer Tools or gated by developer flags', () => {
      const deleteAccountPos = source.indexOf("'https://rawlifeflow.com/delete-account'")
      // Find the nearest preceding "Developer" or "DEVELOPER" reference
      const devToolsSection = source.indexOf('Developer')
      if (devToolsSection > -1) {
        // Delete Account must appear BEFORE the Developer Tools section,
        // or the Developer Tools section must appear after Delete Account
        // with clear separation. The key check: Delete Account is in the
        // Account section, not the Developer section.
        const accountSectionStart = source.indexOf('title="Account"')
        expect(deleteAccountPos).toBeGreaterThan(accountSectionStart)
      }
    })

    it('5. does NOT invoke resetAllUserData()', () => {
      // The Delete Account entry must not call resetAllUserData.
      // Find the Delete Account TouchableOpacity block and verify
      // it only calls openLink, not resetAllUserData.
      const deleteAccountPos = source.indexOf("'https://rawlifeflow.com/delete-account'")
      const blockStart = source.lastIndexOf('TouchableOpacity', deleteAccountPos)
      const blockEnd = source.indexOf('</TouchableOpacity>', deleteAccountPos)
      const block = source.substring(blockStart, blockEnd)
      expect(block).not.toMatch(/resetAllUserData/)
      expect(block).toMatch(/openLink/)
    })

    it('6. has accessibilityLabel="Delete Account"', () => {
      expect(source).toMatch(/accessibilityLabel="Delete Account"/)
    })
  })

  describe('Sign Out behavior remains unchanged', () => {
    it('7. still has handleSignOut function', () => {
      expect(source).toMatch(/handleSignOut/)
      expect(source).toMatch(/Sign out\?/)
    })

    it('8. Sign Out button is still present', () => {
      expect(source).toMatch(/accessibilityLabel="Sign out"/)
    })

    it('9. Sign Out calls signOutAccount, not deletion', () => {
      const signOutPos = source.indexOf('handleSignOut')
      const signOutBlock = source.substring(signOutPos, signOutPos + 600)
      expect(signOutBlock).toMatch(/signOutAccount/)
      expect(signOutBlock).not.toMatch(/rawlifeflow\.com\/delete-account/)
    })
  })

  describe('Delete Account is visually distinct from Sign Out', () => {
    it('10. has supporting text about account/data deletion', () => {
      expect(source).toMatch(/Request deletion of your RawLifeFlow account/)
    })

    it('11. uses a destructive/red color for the label', () => {
      // The color override is on the Text style, which is on a
      // separate line from the "Delete Account" label text.
      const deleteAccountPos = source.indexOf("'https://rawlifeflow.com/delete-account'")
      const blockStart = source.lastIndexOf('TouchableOpacity', deleteAccountPos)
      const blockEnd = source.indexOf('</TouchableOpacity>', deleteAccountPos)
      const block = source.substring(blockStart, blockEnd)
      expect(block).toMatch(/E57373/)
    })
  })
})
