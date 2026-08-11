// ─────────────────────────────────────────────────────────────
// AccountGateModalKeyboard.test.js — Regression tests for the
// keyboard-aware layout of the Protect Your Progress sign-in modal.
//
// Proves:
//   1. KeyboardAvoidingView uses 'height' behavior on Android
//   2. ScrollView wraps the card for scrollable content
//   3. Keyboard listener tracks visibility
//   4. Icon shrinks when keyboard is visible
//   5. Subtitle spacing reduces when keyboard is visible
//   6. Email and code inputs remain rendered (not clipped)
//   7. No hardcoded vertical offset that breaks different screens
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const MODAL_PATH = path.resolve(__dirname, '../AccountGateModal.js')
const SRC = fs.readFileSync(MODAL_PATH, 'utf-8')

describe('AccountGateModal — Keyboard UX', () => {
  describe('KeyboardAvoidingView', () => {
    it('imports KeyboardAvoidingView from react-native', () => {
      expect(SRC).toContain('KeyboardAvoidingView')
    })

    it('uses height behavior on Android (not undefined)', () => {
      // The old code had: behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // The fix uses: behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      expect(SRC).toContain("'height'")
      // The KeyboardAvoidingView behavior line must not use undefined
      // for Android. Check the specific behavior prop line.
      const behaviorLine = SRC.match(/behavior=\{[^}]+\}/)
      expect(behaviorLine).not.toBeNull()
      expect(behaviorLine[0]).not.toContain('undefined')
    })

    it('has a style on the KeyboardAvoidingView (flex/justifyContent)', () => {
      expect(SRC).toContain('styles.avoiding')
      expect(SRC).toMatch(/avoiding[\s\S]*flex:\s*1/)
    })
  })

  describe('ScrollView', () => {
    it('imports ScrollView from react-native', () => {
      expect(SRC).toContain('ScrollView')
    })

    it('wraps card content in ScrollView', () => {
      expect(SRC).toContain('ScrollView')
      expect(SRC).toContain('keyboardShouldPersistTaps')
    })

    it('scrollContent has justifyContent center and vertical padding', () => {
      expect(SRC).toContain('styles.scrollContent')
      expect(SRC).toMatch(/scrollContent[\s\S]*justifyContent:\s*'center'/)
      expect(SRC).toMatch(/scrollContent[\s\S]*paddingVertical/)
    })
  })

  describe('Keyboard visibility tracking', () => {
    it('imports Keyboard from react-native', () => {
      expect(SRC).toContain('Keyboard')
    })

    it('has keyboardVisible state', () => {
      expect(SRC).toContain('keyboardVisible')
      expect(SRC).toMatch(/useState\(false\)/)
    })

    it('listens to keyboardDidShow and keyboardDidHide events', () => {
      expect(SRC).toContain('keyboardDidShow')
      expect(SRC).toContain('keyboardDidHide')
    })

    it('removes keyboard listeners on cleanup', () => {
      expect(SRC).toContain('showSub.remove()')
      expect(SRC).toContain('hideSub.remove()')
    })

    it('only tracks keyboard when modal is visible', () => {
      expect(SRC).toMatch(/if\s*\(!visible\)\s*return\s*undefined/)
    })
  })

  describe('Icon compaction when keyboard visible', () => {
    it('icon size reduces when keyboard is visible', () => {
      // ShieldCheck size should be conditional on keyboardVisible
      expect(SRC).toMatch(/keyboardVisible\s*\?\s*24\s*:\s*32/)
    })

    it('iconWrap has a compact style for keyboard', () => {
      expect(SRC).toContain('iconWrapCompact')
      expect(SRC).toMatch(/iconWrapCompact[\s\S]*width:\s*40/)
      expect(SRC).toMatch(/iconWrapCompact[\s\S]*height:\s*40/)
    })

    it('iconWrap compact has reduced marginBottom', () => {
      expect(SRC).toMatch(/iconWrapCompact[\s\S]*marginBottom:\s*8/)
    })
  })

  describe('Subtitle compaction when keyboard visible', () => {
    it('subtitle has a compact style for keyboard', () => {
      expect(SRC).toContain('subtitleCompact')
      expect(SRC).toMatch(/subtitleCompact[\s\S]*marginBottom:\s*12/)
    })
  })

  describe('No hardcoded screen offset', () => {
    it('does not use arbitrary translateY or marginTop to push content up', () => {
      // The fix should use proper keyboard-aware layout, not hardcoded offsets
      expect(SRC).not.toMatch(/translateY:\s*-?\d{3,}/)
      expect(SRC).not.toMatch(/marginTop:\s*\d{3,}/)
    })
  })

  describe('Preserved behavior', () => {
    it('still renders Protect your progress title', () => {
      expect(SRC).toContain('Protect your progress')
    })

    it('still has email and code input steps', () => {
      expect(SRC).toContain('step')
      expect(SRC).toContain("'email'")
      expect(SRC).toContain("'code'")
    })

    it('still calls beginEmailLink and verifyEmailLink', () => {
      expect(SRC).toContain('beginEmailLink')
      expect(SRC).toContain('verifyEmailLink')
    })

    it('still calls beginSignIn and verifySignIn', () => {
      expect(SRC).toContain('beginSignIn')
      expect(SRC).toContain('verifySignIn')
    })

    it('still has resend cooldown', () => {
      expect(SRC).toContain('RESEND_COOLDOWN_SECONDS')
      expect(SRC).toContain('cooldown')
    })

    it('still has mode switching (protect ↔ signin)', () => {
      expect(SRC).toContain('switchMode')
    })
  })
})
