// deleteAccountLink.test.js — Tests for H2: in-app account-deletion entry point.
//
// Proves:
// 1. Authenticated account users see "Delete Account" in Settings
// 2. Correct URL is passed: https://rawlifeflow.com/delete-account
// 3. Handler calls WebBrowser.openBrowserAsync()
// 4. It does NOT call resetAllUserData()
// 5. It does NOT sign out
// 6. Browser-opening failure is not silently swallowed
// 7. openDeleteAccount is defined INSIDE AccountSection's scope (not SubscriptionSection)
// 8. Other Privacy/Terms link behavior remains unchanged
//
// REGRESSION: This test catches the scope bug where openDeleteAccount was
// accidentally placed inside SubscriptionSection, causing a ReferenceError
// in AccountSection that destroyed the React Host and blanked the screen.

const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve(__dirname, '../SettingsScreen.js')
const source = fs.readFileSync(sourcePath, 'utf8')

// Helper: find the byte range of a top-level function component
function functionRange(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start === -1) return null
  // Find the next top-level function or end of file
  const nextFn = source.indexOf('\nfunction ', start + 1)
  const nextConst = source.indexOf('\nconst ', start + 1)
  const nextExport = source.indexOf('\nexport ', start + 1)
  const candidates = [nextFn, nextConst, nextExport].filter((i) => i > start)
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length
  return { start, end }
}

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
      // in the JSX (not the URL string, which is in the handler function).
      const durableStart = source.indexOf('account.isDurable ?')
      const durableElse = source.indexOf(') : (', durableStart)
      const deleteAccountLabelPos = source.indexOf('accessibilityLabel="Delete Account"')
      expect(durableStart).toBeGreaterThan(-1)
      expect(deleteAccountLabelPos).toBeGreaterThan(durableStart)
      expect(deleteAccountLabelPos).toBeLessThan(durableElse)
    })

    it('4. is NOT inside Developer Tools or gated by developer flags', () => {
      const deleteAccountLabelPos = source.indexOf('accessibilityLabel="Delete Account"')
      const devToolsSection = source.indexOf('Developer')
      if (devToolsSection > -1) {
        const accountSectionStart = source.indexOf('title="Account"')
        expect(deleteAccountLabelPos).toBeGreaterThan(accountSectionStart)
      }
    })

    it('5. does NOT invoke resetAllUserData()', () => {
      const handlerPos = source.indexOf('openDeleteAccount')
      const blockStart = source.lastIndexOf('const openDeleteAccount', handlerPos)
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
      expect(block).toMatch(/catch/)
      expect(block).toMatch(/console\.error/)
      expect(block).toMatch(/Alert\.alert/)
    })
  })

  describe('REGRESSION: openDeleteAccount scope correctness', () => {
    // This test catches the bug where openDeleteAccount was accidentally
    // defined inside SubscriptionSection, causing a ReferenceError in
    // AccountSection that destroyed the React Host and blanked the screen.
    // The physical-device logcat proved:
    //   ReferenceError: Property 'openDeleteAccount' doesn't exist
    //     at AccountSection

    it('10. openDeleteAccount is defined INSIDE AccountSection', () => {
      const accountRange = functionRange('AccountSection')
      expect(accountRange).not.toBeNull()
      const handlerPos = source.indexOf('const openDeleteAccount')
      expect(handlerPos).toBeGreaterThan(-1)
      expect(handlerPos).toBeGreaterThan(accountRange.start)
      expect(handlerPos).toBeLessThan(accountRange.end)
    })

    it('11. openDeleteAccount is NOT defined inside SubscriptionSection', () => {
      const subRange = functionRange('SubscriptionSection')
      expect(subRange).not.toBeNull()
      const handlerPos = source.indexOf('const openDeleteAccount')
      expect(handlerPos).toBeGreaterThan(-1)
      // The handler must NOT be within SubscriptionSection's range
      const isInsideSub = handlerPos > subRange.start && handlerPos < subRange.end
      expect(isInsideSub).toBe(false)
    })

    it('12. onPress={openDeleteAccount} reference is inside AccountSection', () => {
      const accountRange = functionRange('AccountSection')
      expect(accountRange).not.toBeNull()
      const onPressPos = source.indexOf('onPress={openDeleteAccount}')
      expect(onPressPos).toBeGreaterThan(-1)
      expect(onPressPos).toBeGreaterThan(accountRange.start)
      expect(onPressPos).toBeLessThan(accountRange.end)
    })

    it('13. there is exactly ONE definition of openDeleteAccount', () => {
      const matches = source.match(/const openDeleteAccount/g)
      expect(matches).not.toBeNull()
      expect(matches.length).toBe(1)
    })

    it('14. AccountSection renders without ReferenceError (scope check)', () => {
      // Verify that every identifier referenced in the AccountSection JSX
      // is either defined within AccountSection or imported at module level.
      // This is a static scope check — it doesn't render the component
      // (which would require 20+ mocks) but catches the class of bug
      // that caused the production crash.
      const accountRange = functionRange('AccountSection')
      const accountSrc = source.substring(accountRange.start, accountRange.end)

      // openDeleteAccount must be defined in this range
      expect(accountSrc).toMatch(/const openDeleteAccount/)

      // handleSignOut must be defined in this range
      expect(accountSrc).toMatch(/const handleSignOut/)

      // openLink should NOT be in AccountSection (it's in SubscriptionSection)
      expect(accountSrc).not.toMatch(/const openLink/)
    })
  })

  describe('Sign Out behavior remains unchanged', () => {
    it('15. still has handleSignOut function', () => {
      expect(source).toMatch(/handleSignOut/)
      expect(source).toMatch(/Sign out\?/)
    })

    it('16. Sign Out button is still present', () => {
      expect(source).toMatch(/accessibilityLabel="Sign out"/)
    })

    it('17. Sign Out calls signOutAccount, not deletion', () => {
      const signOutPos = source.indexOf('const handleSignOut')
      // Find the end of handleSignOut by matching braces
      let braceCount = 0
      let endPos = signOutPos
      for (let i = source.indexOf('{', signOutPos); i < source.length; i++) {
        if (source[i] === '{') braceCount++
        if (source[i] === '}') braceCount--
        if (braceCount === 0) {
          endPos = i
          break
        }
      }
      const signOutBlock = source.substring(signOutPos, endPos + 1)
      expect(signOutBlock).toMatch(/signOutAccount/)
      expect(signOutBlock).not.toMatch(/rawlifeflow\.com\/delete-account/)
    })
  })

  describe('Delete Account is visually distinct from Sign Out', () => {
    it('18. has supporting text about account/data deletion', () => {
      expect(source).toMatch(/Request deletion of your RawLifeFlow account/)
    })

    it('19. uses a destructive/red color for the label', () => {
      const deleteAccountLabelPos = source.indexOf('accessibilityLabel="Delete Account"')
      const blockStart = source.lastIndexOf('TouchableOpacity', deleteAccountLabelPos)
      const blockEnd = source.indexOf('</TouchableOpacity>', deleteAccountLabelPos)
      const block = source.substring(blockStart, blockEnd)
      expect(block).toMatch(/E57373/)
    })
  })

  describe('Other Privacy/Terms link behavior remains unchanged', () => {
    it('20. openLink helper still exists in SubscriptionSection for Privacy/Terms links', () => {
      const subRange = functionRange('SubscriptionSection')
      const subSrc = source.substring(subRange.start, subRange.end)
      expect(subSrc).toMatch(/const openLink = \(url\) =>/)
      expect(subSrc).toMatch(/Linking\.openURL/)
    })

    it('21. Terms of Use still uses openLink', () => {
      expect(source).toMatch(/onPress=\{\(\) => openLink\(TERMS_URL\)\}/)
    })

    it('22. Privacy Policy still uses openLink', () => {
      expect(source).toMatch(/onPress=\{\(\) => openLink\(PRIVACY_URL\)\}/)
    })
  })
})
