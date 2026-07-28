const fs = require('fs')
const path = require('path')

const modalSource = fs.readFileSync(
  path.join(__dirname, '..', 'AccountGateModal.js'),
  'utf8'
)

const cameraSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'CameraScreen.js'),
  'utf8'
)

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'SettingsScreen.js'),
  'utf8'
)

describe('AccountGateModal keyboard and layout correction', () => {
  // 1. The authentication container is top-aligned
  test('backdrop uses flex-start, not center', () => {
    const backdropMatch = modalSource.match(/backdrop:[\s\S]*?justifyContent:\s*'([^']+)'/)
    expect(backdropMatch).toBeTruthy()
    expect(backdropMatch[1]).toBe('flex-start')
  })

  // 2. The modal no longer uses vertical centering
  test('backdrop does not use vertical centering through flex layout', () => {
    // Extract the backdrop style block and verify it uses flex-start
    const backdropMatch = modalSource.match(/backdrop:[\s\S]*?justifyContent:\s*'([^']+)'/)
    expect(backdropMatch).toBeTruthy()
    expect(backdropMatch[1]).toBe('flex-start')
    // Top padding uses safe area insets, not fixed coordinates
    expect(modalSource).toContain('useSafeAreaInsets')
    expect(modalSource).toContain('insets.top')
  })

  // 3. KeyboardAvoidingView or the approved equivalent is present
  test('KeyboardAvoidingView is present with Android behavior', () => {
    expect(modalSource).toContain('KeyboardAvoidingView')
    // Android must use 'height' behavior, not undefined
    expect(modalSource).toContain("'height'")
    expect(modalSource).not.toContain("Platform.OS === 'ios' ? 'padding' : undefined")
  })

  // 4. The form is scrollable when the keyboard is open
  test('form is wrapped in ScrollView', () => {
    expect(modalSource).toContain('<ScrollView')
    expect(modalSource).toContain('styles.scroll')
    expect(modalSource).toContain('styles.scrollContent')
  })

  // 5. keyboardShouldPersistTaps is configured
  test('keyboardShouldPersistTaps is set to always', () => {
    expect(modalSource).toContain('keyboardShouldPersistTaps="always"')
  })

  // 6. Email mode remains usable
  test('email (OTP) mode renders email input and send code button', () => {
    expect(modalSource).toContain('sendCode')
    expect(modalSource).toContain("placeholder=\"you@example.com\"")
    expect(modalSource).toContain('keyboardType="email-address"')
  })

  // 7. Password mode remains usable
  test('password mode renders email and password inputs with Sign In button', () => {
    expect(modalSource).toContain('submitPassword')
    expect(modalSource).toContain('secureTextEntry')
    expect(modalSource).toContain('"Sign In"')
  })

  // 8. Email Next focuses password
  test('email field in password mode has returnKeyType next and focuses password', () => {
    expect(modalSource).toContain('returnKeyType="next"')
    expect(modalSource).toContain('passwordRef')
    expect(modalSource).toContain('passwordRef.current?.focus()')
  })

  // 9. Password Done/Go behavior remains correct
  test('password field has returnKeyType go and conditional submit', () => {
    expect(modalSource).toContain('returnKeyType="go"')
    expect(modalSource).toContain('onSubmitEditing')
    // Submit only when email is valid and password is non-empty
    expect(modalSource).toContain('isValidEmail(email)')
    expect(modalSource).toContain('password.length > 0')
  })

  // 10. Error messages remain inside the scrollable form
  test('error message is inside the ScrollView/card, not in a fixed area', () => {
    const errorPos = modalSource.indexOf('{error && <Text style={styles.error}>')
    const scrollViewPos = modalSource.indexOf('<ScrollView')
    const scrollViewEnd = modalSource.indexOf('</ScrollView>')
    expect(errorPos).toBeGreaterThan(scrollViewPos)
    expect(errorPos).toBeLessThan(scrollViewEnd)
  })

  // 11. Close and Cancel remain accessible
  test('close button is present and accessible', () => {
    expect(modalSource).toContain('accessibilityLabel="Close"')
    expect(modalSource).toContain('onPress={onClose}')
  })

  // 12. Settings and CameraScreen use the corrected shared component
  test('Settings and CameraScreen both import AccountGateModal', () => {
    expect(settingsSource).toContain('AccountGateModal')
    expect(cameraSource).toContain('AccountGateModal')
  })

  // 13. No duplicate authentication interface was created
  test('AccountGateModal is imported once in each consumer', () => {
    const settingsImports = settingsSource.match(/import AccountGateModal/g)
    expect(settingsImports).toHaveLength(1)
    const cameraImports = cameraSource.match(/import AccountGateModal/g)
    expect(cameraImports).toHaveLength(1)
  })

  // 14. Reviewer password login remains supported
  test('reviewer password login remains supported', () => {
    expect(modalSource).toContain('signInWithPassword')
    expect(modalSource).toContain('switchToPassword')
    expect(modalSource).toContain('Use Password Instead')
  })

  // 15. OTP login remains supported
  test('OTP login remains supported', () => {
    expect(modalSource).toContain('beginSignIn')
    expect(modalSource).toContain('verifySignIn')
    expect(modalSource).toContain('beginEmailLink')
    expect(modalSource).toContain('verifyEmailLink')
    expect(modalSource).toContain('confirmCode')
    expect(modalSource).toContain('Use Email Code Instead')
  })
})

describe('Keyboard layout compliance', () => {
  test('keyboardDismissMode is set', () => {
    expect(modalSource).toContain('keyboardDismissMode="on-drag"')
  })

  test('keyboardVerticalOffset is configured for Android', () => {
    expect(modalSource).toContain('keyboardVerticalOffset')
    expect(modalSource).toContain('StatusBar.currentHeight')
  })

  test('no fixed screen height or absolute positioning for top alignment', () => {
    expect(modalSource).not.toContain('Dimensions.get')
  })

  test('mode switching does not recenter (no justifyContent change on switch)', () => {
    const switchToPassword = modalSource.match(/switchToPassword[\s\S]*?}, \[/)
    expect(switchToPassword).toBeTruthy()
    expect(switchToPassword[0]).not.toContain('justifyContent')
  })

  test('close button is inside the card (above keyboard via ScrollView)', () => {
    const closeBtnPos = modalSource.indexOf('styles.closeBtn')
    const scrollViewPos = modalSource.indexOf('<ScrollView')
    const scrollViewEnd = modalSource.indexOf('</ScrollView>')
    expect(closeBtnPos).toBeGreaterThan(scrollViewPos)
    expect(closeBtnPos).toBeLessThan(scrollViewEnd)
  })
})
