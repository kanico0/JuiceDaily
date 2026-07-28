/* eslint-env jest, node */

const fs = require('fs')
const path = require('path')

const modalPath = path.join(__dirname, '..', 'AccountGateModal.js')
const settingsPath = path.join(__dirname, '..', '..', 'screens', 'SettingsScreen.js')
const cameraPath = path.join(__dirname, '..', '..', 'screens', 'CameraScreen.js')
const homePath = path.join(__dirname, '..', '..', 'screens', 'HomeScreen.js')

function read (file) {
  return fs.readFileSync(file, 'utf8')
}

describe('AccountGateModal first-tap authentication fix', () => {
  const source = read(modalPath)

  // 1. Send Sign-In Code fires on one press while the keyboard is considered open
  test('ScrollView uses keyboardShouldPersistTaps="always" so first tap reaches button', () => {
    expect(source).toContain('keyboardShouldPersistTaps="always"')
  })

  // 2. One press creates exactly one Supabase send-code request
  test('sendCode uses busyRef to prevent duplicate requests', () => {
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    expect(sendCodeMatch).toBeTruthy()
    expect(sendCodeMatch[1]).toContain('if (busyRef.current) return')
    expect(sendCodeMatch[1]).toContain('busyRef.current = true')
  })

  // 3. The first press sets the loading state immediately
  test('sendCode sets busy state before async call', () => {
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    const body = sendCodeMatch[1]
    const busyIdx = body.indexOf('busyRef.current = true')
    const apiIdx = body.indexOf('await beginSignIn')
    expect(busyIdx).toBeGreaterThan(-1)
    expect(apiIdx).toBeGreaterThan(-1)
    expect(busyIdx).toBeLessThan(apiIdx)
  })

  // 4. Keyboard dismissal is not required before sendCode executes
  test('sendCode does not call Keyboard.dismiss before submission', () => {
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    expect(sendCodeMatch[1]).not.toContain('Keyboard.dismiss')
  })

  // 5. Verify fires on one press while the keyboard is considered open
  test('Verify button onPress calls confirmCode directly', () => {
    expect(source).toContain('onPress={confirmCode}')
  })

  // 6. One press creates exactly one Supabase verify request
  test('confirmCode uses busyRef to prevent duplicate verification requests', () => {
    const confirmMatch = source.match(/const confirmCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/)
    expect(confirmMatch).toBeTruthy()
    expect(confirmMatch[1]).toContain('if (busyRef.current) return')
    expect(confirmMatch[1]).toContain('busyRef.current = true')
  })

  // 7. The first Verify press sets loading immediately
  test('confirmCode sets busy state before async call', () => {
    const confirmMatch = source.match(/const confirmCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/)
    const body = confirmMatch[1]
    const busyIdx = body.indexOf('busyRef.current = true')
    const apiIdx = body.indexOf('await verifySignIn')
    expect(busyIdx).toBeGreaterThan(-1)
    expect(apiIdx).toBeGreaterThan(-1)
    expect(busyIdx).toBeLessThan(apiIdx)
  })

  // 8. The final OTP digit is recognized without requiring blur
  test('confirmCode reads code from state (no blur dependency)', () => {
    const confirmMatch = source.match(/const confirmCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/)
    expect(confirmMatch[1]).toContain('const normalizedCode = code.trim()')
    // Code is read directly from state, not from a ref or blur event
    expect(source).toContain('onChangeText={setCode}')
  })

  // 9. A valid email is recognized without requiring blur
  test('sendCode reads email from state (no blur dependency)', () => {
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    expect(sendCodeMatch[1]).toContain('const normalizedEmail = email.trim().toLowerCase()')
    // Email is read directly from state, not from a ref or blur event
    expect(source).toContain('onChangeText={setEmail}')
  })

  // 10. The local normalized email is used in the same handler invocation
  test('sendCode uses normalizedEmail variable for both validation and API call', () => {
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    const body = sendCodeMatch[1]
    expect(body).toContain('isValidEmail(normalizedEmail)')
    expect(body).toContain('beginSignIn(normalizedEmail)')
    expect(body).toContain('beginEmailLink(normalizedEmail)')
  })

  // 11. The local normalized code is used in the same handler invocation
  test('confirmCode uses normalizedCode variable for both validation and API call', () => {
    const confirmMatch = source.match(/const confirmCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/)
    const body = confirmMatch[1]
    expect(body).toContain('normalizedCode.length < 6')
    expect(body).toContain('verifySignIn(email, normalizedCode)')
    expect(body).toContain('verifyEmailLink(email, normalizedCode)')
  })

  // 12. No parent backdrop consumes child-button taps
  test('no TouchableWithoutFeedback or Pressable wraps the authentication card', () => {
    expect(source).not.toContain('TouchableWithoutFeedback')
    expect(source).not.toContain('Pressable')
    expect(source).not.toContain('Keyboard.dismiss')
  })

  // 13. Relevant ScrollView ancestors use keyboardShouldPersistTaps="always"
  test('ScrollView has keyboardShouldPersistTaps="always" and keyboardDismissMode="on-drag"', () => {
    expect(source).toContain('keyboardShouldPersistTaps="always"')
    expect(source).toContain('keyboardDismissMode="on-drag"')
  })

  // 14. Rapid repeated taps are blocked
  test('busyRef.current guard prevents duplicate requests on rapid taps', () => {
    // sendCode guard
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    expect(sendCodeMatch[1]).toContain('if (busyRef.current) return')
    // confirmCode guard
    const confirmMatch = source.match(/const confirmCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/)
    expect(confirmMatch[1]).toContain('if (busyRef.current) return')
    // Button disabled state
    expect(source).toContain('disabled={busy}')
  })

  // 15. Invalid input still does not submit
  test('sendCode rejects invalid email before API call', () => {
    const sendCodeMatch = source.match(/const sendCode = useCallback\(async \(\) => \{([\s\S]*?)\}, \[email, mode\]\)/)
    const body = sendCodeMatch[1]
    const validateIdx = body.indexOf('isValidEmail(normalizedEmail)')
    const busyIdx = body.indexOf('busyRef.current = true')
    expect(validateIdx).toBeGreaterThan(-1)
    expect(busyIdx).toBeGreaterThan(-1)
    expect(validateIdx).toBeLessThan(busyIdx)
  })

  // 16. Password sign-in remains functional
  test('password sign-in handler and button remain intact', () => {
    expect(source).toContain('submitPassword')
    expect(source).toContain('onPress={submitPassword}')
    expect(source).toContain('signInWithPassword')
    expect(source).toContain('Use Password Instead')
    expect(source).toContain('Use Email Code Instead')
  })

  // 17. Forgot Password remains functional
  test('Forgot Password link and ResetPasswordModal remain intact', () => {
    expect(source).toContain('Forgot your password?')
    expect(source).toContain('setShowReset(true)')
    expect(source).toContain('ResetPasswordModal')
  })

  // 18. Android Back and drag-to-dismiss remain functional
  test('Modal onRequestClose and keyboardDismissMode="on-drag" remain intact', () => {
    expect(source).toContain('onRequestClose={onClose}')
    expect(source).toContain('keyboardDismissMode="on-drag"')
  })

  // 19. No duplicate authentication modal is created
  test('AccountGateModal is imported once in each consumer screen', () => {
    const settingsSource = read(settingsPath)
    const cameraSource = read(cameraPath)
    const homeSource = read(homePath)

    const settingsImports = settingsSource.match(/import AccountGateModal/g)
    expect(settingsImports).toHaveLength(1)

    const cameraImports = cameraSource.match(/import AccountGateModal/g)
    expect(cameraImports).toHaveLength(1)

    const homeImports = homeSource.match(/import AccountGateModal/g)
    expect(homeImports).toHaveLength(1)
  })
})
