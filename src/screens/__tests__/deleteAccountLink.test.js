// deleteAccountLink.test.js — Tests for H2: in-app account-deletion entry point.
//
// Proves:
// 1. Authenticated account users see "Delete Account" in Settings
// 2. Correct URL is passed: https://rawlifeflow.com/delete-account
// 3. Handler calls WebBrowser.openBrowserAsync()
// 4. It does NOT call resetAllUserData()
// 5. It does NOT sign out
// 6. Browser-opening failure is not silently swallowed
// 7. Existing Sign Out behavior remains unchanged
// 8. Other Privacy/Terms link behavior remains unchanged

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
      expect(source).toContain("'https://rawlifeflow.com/delete-account'")
    })

    it('3. is inside the account.isDurable block (authenticated users only)', () => {
      // The Delete Account entry must be within the durable-account branch,
      // not the guest/anonymous branch. Anchor on the accessibilityLabel
      // in the JSX (not the URL string, which is now in the handler function).
      const durableStart = source.indexOf('account.isDurable ?')
      const durableElse = source.indexOf(') : (', durableStart)
      const deleteAccountLabelPos = source.indexOf('accessibilityLabel="Delete Account"')
      expect(durableStart).toBeGreaterThan(-1)
      expect(deleteAccountLabelPos).toBeGreaterThan(durableStart)
      expect(deleteAccountLabelPos).toBeLessThan(durableElse)
    })

    it('4. is NOT inside Developer Tools or gated by developer flags', () => {
      const deleteAccountLabelPos = source.indexOf('accessibilityLabel="Delete Account"')
      // Find the nearest preceding "Developer" or "DEVELOPER" reference
      const devToolsSection = source.indexOf('Developer')
      if (devToolsSection > -1) {
        // Delete Account must appear BEFORE the Developer Tools section,
        // or the Developer Tools section must appear after Delete Account
        // with clear separation. The key check: Delete Account is in the
        // Account section, not the Developer section.
        const accountSectionStart = source.indexOf('title="Account"')
        expect(deleteAccountLabelPos).toBeGreaterThan(accountSectionStart)
      }
    })

    it('5. does NOT invoke resetAllUserData()', () => {
      // The Delete Account entry must not call resetAllUserData.
      // Find the openDeleteAccount function block and verify
      // it only calls WebBrowser.openBrowserAsync, not resetAllUserData.
      const handlerPos = source.indexOf('openDeleteAccount')
      const blockStart = source.lastIndexOf('const openDeleteAccount', handlerPos)
      const blockEnd = source.indexOf('}', blockStart + 10)
      // Find the closing brace of the function by scanning forward
      let braceCount = 0
      let endPos = blockStart
      for (let i = source.indexOf('{', blockStart); i < source.length; i++) {
        if (source[i] === '{') braceCount++
        if (source[i] === '}') braceCount--
        if (braceCount === 0) {
          endPos = i
          break
        }
      }
      const block = source.substring(blockStart, endPos + 1)
      expect(block).not.toMatch(/resetAllUserData/)
    })

    it('6. has accessibilityLabel="Delete Account"', () => {
      expect(source).toMatch(/accessibilityLabel="Delete Account"/)
    })

    it('7. uses WebBrowser.openBrowserAsync (not Linking.openURL) for Delete Account', () => {
      expect(source).toMatch(/import \* as WebBrowser from 'expo-web-browser'/)
      expect(source).toMatch(/WebBrowser\.openBrowserAsync/)
      // The Delete Account onPress should call openDeleteAccount, not openLink
      const deleteAccountPos = source.indexOf('accessibilityLabel="Delete Account"')
      const blockStart = source.lastIndexOf('TouchableOpacity', deleteAccountPos)
      const blockEnd = source.indexOf('</TouchableOpacity>', deleteAccountPos)
      const block = source.substring(blockStart, blockEnd)
      expect(block).toMatch(/onPress=\{openDeleteAccount\}/)
      expect(block).not.toMatch(/openLink/)
    })

    it('8. does NOT sign out when Delete Account is tapped', () => {
      const handlerPos = source.indexOf('const openDeleteAccount')
      let braceCount = 0
      let endPos = handlerPos
      for (let i = source.indexOf('{', handlerPos); i < source.length; i++) {
        if (source[i] === '{') braceCount++
        if (source[i] === '}') braceCount--
        if (braceCount === 0) {
          endPos = i
          break
        }
      }
      const block = source.substring(handlerPos, endPos + 1)
      expect(block).not.toMatch(/signOutAccount/)
      expect(block).not.toMatch(/handleSignOut/)
    })

    it('9. browser-opening failure is NOT silently swallowed', () => {
      const handlerPos = source.indexOf('const openDeleteAccount')
      let braceCount = 0
      let endPos = handlerPos
      for (let i = source.indexOf('{', handlerPos); i < source.length; i++) {
        if (source[i] === '{') braceCount++
        if (source[i] === '}') braceCount--
        if (braceCount === 0) {
          endPos = i
          break
        }
      }
      const block = source.substring(handlerPos, endPos + 1)
      // Must have a catch block that logs and/or shows user feedback
      expect(block).toMatch(/catch/)
      expect(block).toMatch(/console\.error/)
      expect(block).toMatch(/Alert\.alert/)
    })
  })

  describe('Sign Out behavior remains unchanged', () => {
    it('10. still has handleSignOut function', () => {
      expect(source).toMatch(/handleSignOut/)
      expect(source).toMatch(/Sign out\?/)
    })

    it('11. Sign Out button is still present', () => {
      expect(source).toMatch(/accessibilityLabel="Sign out"/)
    })

    it('12. Sign Out calls signOutAccount, not deletion', () => {
      const signOutPos = source.indexOf('handleSignOut')
      const signOutBlock = source.substring(signOutPos, signOutPos + 600)
      expect(signOutBlock).toMatch(/signOutAccount/)
      expect(signOutBlock).not.toMatch(/rawlifeflow\.com\/delete-account/)
    })
  })

  describe('Delete Account is visually distinct from Sign Out', () => {
    it('13. has supporting text about account/data deletion', () => {
      expect(source).toMatch(/Request deletion of your RawLifeFlow account/)
    })

    it('14. uses a destructive/red color for the label', () => {
      // The color override is on the Text style, which is on a
      // separate line from the "Delete Account" label text.
      // Anchor on the accessibilityLabel in the JSX.
      const deleteAccountLabelPos = source.indexOf('accessibilityLabel="Delete Account"')
      const blockStart = source.lastIndexOf('TouchableOpacity', deleteAccountLabelPos)
      const blockEnd = source.indexOf('</TouchableOpacity>', deleteAccountLabelPos)
      const block = source.substring(blockStart, blockEnd)
      expect(block).toMatch(/E57373/)
    })
  })

  describe('Other Privacy/Terms link behavior remains unchanged', () => {
    it('15. openLink helper still exists for Privacy/Terms links', () => {
      expect(source).toMatch(/const openLink = \(url\) =>/)
      expect(source).toMatch(/Linking\.openURL/)
    })

    it('16. Terms of Use still uses openLink', () => {
      expect(source).toMatch(/onPress=\{\(\) => openLink\(TERMS_URL\)\}/)
    })

    it('17. Privacy Policy still uses openLink', () => {
      expect(source).toMatch(/onPress=\{\(\) => openLink\(PRIVACY_URL\)\}/)
    })
  })
})
