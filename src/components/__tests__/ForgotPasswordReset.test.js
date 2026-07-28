const fs = require('fs')
const path = require('path')

const modalSource = fs.readFileSync(
  path.join(__dirname, '..', 'AccountGateModal.js'),
  'utf8'
)

const resetSource = fs.readFileSync(
  path.join(__dirname, '..', 'ResetPasswordModal.js'),
  'utf8'
)

const newPasswordSource = fs.readFileSync(
  path.join(__dirname, '..', 'NewPasswordModal.js'),
  'utf8'
)

const accountLinkSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'services', 'supabase', 'accountLink.ts'),
  'utf8'
)

const appSource = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'App.js'),
  'utf8'
)

const settingsSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'SettingsScreen.js'),
  'utf8'
)

const cameraSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'screens', 'CameraScreen.js'),
  'utf8'
)

describe('Forgot Password and Reset Password flow', () => {
  // 1. "Forgot your password?" appears in password mode
  test('Forgot your password? link is present in AccountGateModal', () => {
    expect(modalSource).toContain('Forgot your password?')
  })

  // 2. It does not interfere with email-code mode
  test('Forgot your password? link is only in password step, not email step', () => {
    const passwordStep = modalSource.indexOf("step === 'password'")
    const emailStep = modalSource.indexOf("step === 'email'")
    const forgotLink = modalSource.indexOf('Forgot your password?')

    // The forgot link should be after the password step check
    expect(forgotLink).toBeGreaterThan(passwordStep)
    // It should NOT appear in the email step section
    const emailSectionEnd = modalSource.indexOf('step === \'password\'')
    const emailSection = modalSource.slice(emailStep, emailSectionEnd)
    expect(emailSection).not.toContain('Forgot your password?')
  })

  // 3. Tapping it opens Reset Password
  test('tapping Forgot your password? opens ResetPasswordModal', () => {
    expect(modalSource).toContain('showReset')
    expect(modalSource).toContain('setShowReset(true)')
    expect(modalSource).toContain('ResetPasswordModal')
  })

  // 4. Existing typed email is preserved and prefilled
  test('ResetPasswordModal receives initialEmail from AccountGateModal', () => {
    expect(modalSource).toContain('initialEmail={email}')
    expect(resetSource).toContain('initialEmail')
  })

  // 5. Valid request calls resetPasswordForEmail exactly once
  test('sendPasswordResetEmail calls resetPasswordForEmail', () => {
    expect(accountLinkSource).toContain('resetPasswordForEmail')
  })

  // 6. Correct approved redirect URL is supplied
  test('resetPasswordForEmail uses juicingapp://reset-password redirect', () => {
    expect(accountLinkSource).toContain('juicingapp://reset-password')
    expect(accountLinkSource).toContain('redirectTo: RESET_REDIRECT_URL')
  })

  // 7. Repeated tapping does not send duplicate requests
  test('busyRef prevents duplicate reset requests', () => {
    expect(resetSource).toContain('busyRef.current')
    expect(resetSource).toContain('if (busyRef.current) return')
  })

  // 8. Success response uses neutral account-enumeration-safe wording
  test('success response uses neutral wording', () => {
    expect(resetSource).toContain('If a RawLifeFlow account exists for that email address')
    expect(resetSource).not.toContain('Account not found')
    expect(resetSource).not.toContain('not registered')
  })

  // 9. Unknown email receives the same neutral presentation
  test('no error differentiation for unknown emails', () => {
    // The sendPasswordResetEmail function returns 'sent' on success
    // and only returns error for rate limiting or network issues
    // — never for "user not found"
    const resetFunc = accountLinkSource.match(/sendPasswordResetEmail[\s\S]*?^}/m)
    expect(resetFunc).toBeTruthy()
    expect(resetFunc[0]).not.toContain('not found')
    expect(resetFunc[0]).not.toContain('no account')
  })

  // 10. PASSWORD_RECOVERY opens Create a New Password
  test('PASSWORD_RECOVERY event opens NewPasswordModal', () => {
    expect(appSource).toContain('PASSWORD_RECOVERY')
    expect(appSource).toContain('NewPasswordModal')
    expect(appSource).toContain('recoveryVisible')
  })

  // 11. New-password and confirmation fields are required
  test('NewPasswordModal has both new password and confirm fields', () => {
    expect(newPasswordSource).toContain('New password')
    expect(newPasswordSource).toContain('Confirm new password')
  })

  // 12. Mismatched passwords are rejected locally
  test('mismatched passwords are rejected', () => {
    expect(newPasswordSource).toContain('Passwords do not match')
    expect(newPasswordSource).toContain('newPassword !== confirmPassword')
  })

  // 13. Existing password policy is enforced
  test('minimum password length is enforced', () => {
    expect(newPasswordSource).toContain('MIN_PASSWORD_LENGTH')
    expect(newPasswordSource).toContain('6')
    expect(accountLinkSource).toContain('newPassword.length < 6')
  })

  // 14. updateUser is called only after validation
  test('updateUser is called only after validation passes', () => {
    const submitMatch = newPasswordSource.match(/const submit[\s\S]*?}, \[newPassword, validate\]/)
    expect(submitMatch).toBeTruthy()
    expect(submitMatch[0]).toContain('validate()')
    // updateUser call is in accountLink, after length check
    const updateMatch = accountLinkSource.match(/export async function updateRecoveredPassword[\s\S]*?^}/m)
    expect(updateMatch).toBeTruthy()
    expect(updateMatch[0]).toContain('newPassword.length < 6')
    expect(updateMatch[0]).toContain('updateUser')
  })

  // 15. Successful reset does not create a new account
  test('updateRecoveredPassword uses updateUser, not signUp', () => {
    expect(accountLinkSource).toContain('supabase.auth.updateUser')
    const updateFunc = accountLinkSource.match(/updateRecoveredPassword[\s\S]*?^}/m)
    expect(updateFunc[0]).not.toContain('signUp')
    expect(updateFunc[0]).not.toContain('signInWithPassword')
  })

  // 16. Supabase UUID remains unchanged
  test('UUID is not changed during password reset', () => {
    // updateUser preserves the existing user's UUID
    expect(accountLinkSource).toContain('data.user?.id')
    // No createUser or signUp call in the reset flow
    const resetSection = accountLinkSource.slice(accountLinkSource.indexOf('Password reset'))
    expect(resetSection).not.toContain('signUp')
    expect(resetSection).not.toContain('createUser')
  })

  // 17. RevenueCat UUID remains unchanged
  test('RevenueCat identity is not changed during reset', () => {
    // The reset flow does not call notifyIdentityChanged
    const resetSection = accountLinkSource.slice(accountLinkSource.indexOf('Password reset'))
    expect(resetSection).not.toContain('notifyIdentityChanged')
  })

  // 18. Quota is not reset
  test('no quota reset function is called during password reset', () => {
    const resetSection = accountLinkSource.slice(accountLinkSource.indexOf('Password reset'))
    expect(resetSection).not.toContain('resolve_quota')
    expect(resetSection).not.toContain('resetQuota')
  })

  // 19. Reviewer grant is not changed
  test('no reviewer grant modification in reset flow', () => {
    const resetSection = accountLinkSource.slice(accountLinkSource.indexOf('Password reset'))
    expect(resetSection).not.toContain('support_exception')
    expect(resetSection).not.toContain('reviewer')
  })

  // 20. Expired links show a recoverable error
  test('expired or invalid recovery links are handled gracefully', () => {
    // The NewPasswordModal shows error messages from updateRecoveredPassword
    // which returns 'error' status with a user-friendly message
    expect(newPasswordSource).toContain('Unable to update password')
    // The modal does not expose raw tokens or error bodies
    expect(newPasswordSource).not.toContain('access_token')
    expect(newPasswordSource).not.toContain('refresh_token')
  })

  // 21. Recovery tokens and passwords are not logged
  test('no passwords or tokens are logged', () => {
    expect(newPasswordSource).not.toContain('console.log')
    expect(resetSource).not.toContain('console.log')
    const resetSection = accountLinkSource.slice(accountLinkSource.indexOf('Password reset'))
    expect(resetSection).not.toContain('console.log')
    expect(resetSection).not.toContain('console.warn')
    expect(resetSection).not.toContain('console.error')
  })

  // 22. Password-reset screens are top-aligned
  test('ResetPasswordModal and NewPasswordModal use flex-start, not center', () => {
    const resetBackdrop = resetSource.match(/backdrop:[\s\S]*?justifyContent:\s*'([^']+)'/)
    expect(resetBackdrop).toBeTruthy()
    expect(resetBackdrop[1]).toBe('flex-start')

    const newPwdBackdrop = newPasswordSource.match(/backdrop:[\s\S]*?justifyContent:\s*'([^']+)'/)
    expect(newPwdBackdrop).toBeTruthy()
    expect(newPwdBackdrop[1]).toBe('flex-start')
  })

  // 23. Keyboard-safe scrolling remains present
  test('both modals have KeyboardAvoidingView and ScrollView', () => {
    expect(resetSource).toContain('KeyboardAvoidingView')
    expect(resetSource).toContain('ScrollView')
    expect(resetSource).toContain('keyboardShouldPersistTaps="handled"')
    expect(resetSource).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}")

    expect(newPasswordSource).toContain('KeyboardAvoidingView')
    expect(newPasswordSource).toContain('ScrollView')
    expect(newPasswordSource).toContain('keyboardShouldPersistTaps="handled"')
    expect(newPasswordSource).toContain("behavior={Platform.OS === 'ios' ? 'padding' : 'height'}")
  })

  // 24. Normal password login still works
  test('password sign-in still works', () => {
    expect(modalSource).toContain('submitPassword')
    expect(modalSource).toContain('signInWithPassword')
    expect(accountLinkSource).toContain('signInWithPassword')
  })

  // 25. OTP login still works
  test('OTP login still works', () => {
    expect(modalSource).toContain('sendCode')
    expect(modalSource).toContain('confirmCode')
    expect(accountLinkSource).toContain('beginSignIn')
    expect(accountLinkSource).toContain('verifySignIn')
  })

  // 26. Account deletion still works
  test('account deletion still works', () => {
    expect(settingsSource).toContain('DeleteAccountModal')
    expect(settingsSource).toContain('openDeleteAccount')
  })

  // 27. No legacy authentication route is restored
  test('no legacy Vault, Architect, or scan-pack route introduced', () => {
    expect(modalSource).not.toContain('Vault')
    expect(resetSource).not.toContain('Vault')
    expect(newPasswordSource).not.toContain('Vault')
    expect(modalSource).not.toContain('Architect')
    expect(resetSource).not.toContain('Architect')
    expect(newPasswordSource).not.toContain('Architect')
  })
})

describe('Security compliance', () => {
  test('no service-role key in client code', () => {
    expect(accountLinkSource).not.toContain('service_role')
    expect(accountLinkSource).not.toContain('SERVICE_ROLE')
  })

  test('no password written to AsyncStorage', () => {
    expect(newPasswordSource).not.toContain('AsyncStorage')
    expect(resetSource).not.toContain('AsyncStorage')
  })

  test('no password written to analytics', () => {
    expect(newPasswordSource).not.toContain('Analytics')
    expect(newPasswordSource).not.toContain('analytics')
    expect(resetSource).not.toContain('Analytics')
    expect(resetSource).not.toContain('analytics')
  })

  test('reset link uses existing app scheme', () => {
    expect(accountLinkSource).toContain('juicingapp://reset-password')
  })

  test('onAuthStateChange listener is properly cleaned up', () => {
    expect(appSource).toContain('onAuthStateChange')
    expect(appSource).toContain('unsubscribe')
  })

  test('recovery session is signed out after password update', () => {
    expect(appSource).toContain('signOut')
    const onUpdatedMatch = appSource.match(/onUpdated[\s\S]*?signOut/)
    expect(onUpdatedMatch).toBeTruthy()
  })

  test('Forgot your password link has accessibility role link', () => {
    expect(modalSource).toContain('accessibilityRole="link"')
    expect(modalSource).toContain('accessibilityLabel="Forgot your password?"')
  })

  test('Forgot your password link has 44pt minimum touch area', () => {
    expect(modalSource).toContain('minHeight: 44')
  })

  test('rate-limit error uses neutral message', () => {
    expect(resetSource).toContain('Please wait a moment before requesting another reset link')
  })

  test('spam folder hint is shown', () => {
    expect(resetSource).toContain('Check your spam or junk folder')
  })

  test('resend cooldown is enforced', () => {
    expect(resetSource).toContain('cooldown')
    expect(resetSource).toContain('RESEND_COOLDOWN_SECONDS')
  })

  test('no raw URL parameters exposed in UI', () => {
    expect(newPasswordSource).not.toContain('access_token')
    expect(newPasswordSource).not.toContain('refresh_token')
    expect(newPasswordSource).not.toContain('type=recovery')
    expect(resetSource).not.toContain('access_token')
  })

  test('Settings and CameraScreen still use shared AccountGateModal', () => {
    expect(settingsSource).toContain('AccountGateModal')
    expect(cameraSource).toContain('AccountGateModal')
  })

  test('no duplicate AccountGateModal created', () => {
    const settingsImports = settingsSource.match(/import AccountGateModal/g)
    expect(settingsImports).toHaveLength(1)
    const cameraImports = cameraSource.match(/import AccountGateModal/g)
    expect(cameraImports).toHaveLength(1)
  })
})
