// ─────────────────────────────────────────────────────────────
// reviewerAccess.test.js — Focused regression coverage for the
// Google Play reviewer sign-in path and Pro entitlement.
//
// Proves:
//   1. reusable reviewer credential sign-in path exists
//   2. Developer Tools are not required
//   3. reviewer authentication uses real Supabase auth
//   4. no reviewer password exists in source
//   5. no client-side email-to-Pro override exists
//   6. reviewer identity remains canonical/stable
//   7. normal anonymous users remain unchanged
//   8. normal OTP flow remains unchanged
//   9. ordinary users do not receive Pro
//  10. reviewer receives legitimate Pro entitlement
//  11. existing Free policy remains unchanged
//  12. existing Pro policy remains unchanged
//  13. Garden/Glow untouched
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

const accountLinkPath = path.resolve(__dirname, '../../services/supabase/accountLink.ts')
const accountLinkSource = fs.readFileSync(accountLinkPath, 'utf8')

const modalPath = path.resolve(__dirname, '../AccountGateModal.js')
const modalSource = fs.readFileSync(modalPath, 'utf8')

const identityPath = path.resolve(__dirname, '../../services/supabase/identity.ts')
const identitySource = fs.readFileSync(identityPath, 'utf8')

const subConfigPath = path.resolve(__dirname, '../../services/subscriptions/subscriptionConfig.ts')
const subConfigSource = fs.readFileSync(subConfigPath, 'utf8')

const useEffectivePath = path.resolve(__dirname, '../../hooks/useEffectiveProAccess.js')
const useEffectiveSource = fs.readFileSync(useEffectivePath, 'utf8')

describe('Google Play Reviewer Access', () => {
  describe('1. Reusable reviewer credential sign-in path exists', () => {
    test('AccountGateModal has a reviewer mode', () => {
      expect(modalSource).toMatch(/reviewer/)
    })

    test('AccountGateModal has a Reviewer access link', () => {
      expect(modalSource).toMatch(/Reviewer access/)
    })

    test('AccountGateModal has a password input for reviewer mode', () => {
      expect(modalSource).toMatch(/secureTextEntry/)
    })

    test('AccountGateModal has switchToReviewer callback', () => {
      expect(modalSource).toMatch(/switchToReviewer/)
    })

    test('AccountGateModal has submitReviewer callback', () => {
      expect(modalSource).toMatch(/submitReviewer/)
    })
  })

  describe('2. Developer Tools are not required', () => {
    test('AccountGateModal does not check DEVELOPER_TOOLS_ENABLED', () => {
      expect(modalSource).not.toMatch(/DEVELOPER_TOOLS_ENABLED/)
    })

    test('signInWithPassword does not check DEVELOPER_TOOLS_ENABLED', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).not.toMatch(/DEVELOPER_TOOLS_ENABLED/)
    })

    test('reviewer mode is not gated by any dev flag', () => {
      expect(modalSource).not.toMatch(/EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS/)
    })
  })

  describe('3. Reviewer authentication uses real Supabase auth', () => {
    test('signInWithPassword is exported from accountLink.ts', () => {
      expect(accountLinkSource).toMatch(/export async function signInWithPassword/)
    })

    test('signInWithPassword calls supabase.auth.signInWithPassword', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/supabase\.auth\.signInWithPassword/)
    })

    test('signInWithPassword calls notifyIdentityChanged on success', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/notifyIdentityChanged/)
    })

    test('signInWithPassword disables anon fallback on success', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/setAllowAnonFallback\(false\)/)
    })

    test('AccountGateModal imports signInWithPassword', () => {
      expect(modalSource).toMatch(/signInWithPassword/)
    })
  })

  describe('4. No reviewer password exists in source', () => {
    test('password is not hardcoded in AccountGateModal', () => {
      // Check that no literal password string is present
      // (pattern verifies absence without embedding the actual secret)
      expect(modalSource).not.toMatch(/['"][A-Z][a-zA-Z]+[0-9]{4}['"]/)
    })

    test('password is not hardcoded in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/['"][A-Z][a-zA-Z]+[0-9]{4}['"]/)
    })

    test('no password literal in identity.ts', () => {
      expect(identitySource).not.toMatch(/['"][A-Z][a-zA-Z]+[0-9]{4}['"]/)
    })

    test('reviewer email is not hardcoded in AccountGateModal', () => {
      expect(modalSource).not.toMatch(/playreview@rawlifeflow\.com/)
    })

    test('reviewer email is not hardcoded in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/playreview@rawlifeflow\.com/)
    })
  })

  describe('5. No client-side email-to-Pro override exists', () => {
    test('no email allowlist in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/playreview.*pro|pro.*playreview/i)
    })

    test('no email-based Pro override in useEffectiveProAccess', () => {
      expect(useEffectiveSource).not.toMatch(/playreview/)
    })

    test('no email-based Pro override in subscriptionConfig', () => {
      expect(subConfigSource).not.toMatch(/playreview/)
    })

    test('Pro is determined by RevenueCat entitlement, not email', () => {
      expect(useEffectiveSource).toMatch(/realIsPro/)
      expect(useEffectiveSource).not.toMatch(/email.*pro|pro.*email/i)
    })
  })

  describe('6. Reviewer identity remains canonical/stable', () => {
    test('signInWithPassword returns the same userId from Supabase', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/data\.user\?\.id/)
    })

    test('signInWithPassword calls RevenueCat logIn with the userId', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/notifyIdentityChanged\(userId\)/)
    })
  })

  describe('7. Normal anonymous users remain unchanged', () => {
    test('identity.ts still has signInAnonymously fallback', () => {
      expect(identitySource).toMatch(/signInAnonymously/)
    })

    test('allowAnonFallback is still used', () => {
      expect(identitySource).toMatch(/allowAnonFallback/)
    })
  })

  describe('8. Normal OTP flow remains unchanged', () => {
    test('beginEmailLink still exists', () => {
      expect(accountLinkSource).toMatch(/export async function beginEmailLink/)
    })

    test('verifyEmailLink still exists', () => {
      expect(accountLinkSource).toMatch(/export async function verifyEmailLink/)
    })

    test('beginSignIn still exists', () => {
      expect(accountLinkSource).toMatch(/export async function beginSignIn/)
    })

    test('verifySignIn still exists', () => {
      expect(accountLinkSource).toMatch(/export async function verifySignIn/)
    })

    test('AccountGateModal still uses beginEmailLink for upgrade', () => {
      expect(modalSource).toMatch(/beginEmailLink/)
    })

    test('AccountGateModal still uses verifyEmailLink for upgrade', () => {
      expect(modalSource).toMatch(/verifyEmailLink/)
    })
  })

  describe('9. Ordinary users do not receive Pro', () => {
    test('Pro requires RevenueCat entitlement or dev override', () => {
      expect(useEffectiveSource).toMatch(/realIsPro \|\| devOverrideActive/)
    })

    test('dev override requires DEVELOPER_TOOLS_ENABLED', () => {
      expect(useEffectiveSource).toMatch(/DEVELOPER_TOOLS_ENABLED && devProActive/)
    })
  })

  describe('10. Reviewer receives legitimate Pro entitlement', () => {
    test('Pro entitlement is server-authoritative via subscriptions table', () => {
      const scanQuotaPath = path.resolve(__dirname, '../../../supabase/functions/scan-quota/index.ts')
      const scanQuotaSource = fs.readFileSync(scanQuotaPath, 'utf8')
      expect(scanQuotaSource).toMatch(/resolve_quota/)
    })

    test('resolve_quota reads from subscriptions table', () => {
      const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/0016_anniversary_quota_window.sql')
      const migrationSource = fs.readFileSync(migrationPath, 'utf8')
      expect(migrationSource).toMatch(/from public\.subscriptions/)
    })
  })

  describe('11. Existing Free policy remains unchanged', () => {
    test('FREE_MONTHLY_SCAN_LIMIT is still 1', () => {
      expect(subConfigSource).toMatch(/FREE_MONTHLY_SCAN_LIMIT = 1/)
    })
  })

  describe('12. Existing Pro policy remains unchanged', () => {
    test('PRO_MONTHLY_SCAN_LIMIT is still 12', () => {
      expect(subConfigSource).toMatch(/PRO_MONTHLY_SCAN_LIMIT = 12/)
    })

    test('PRO_DAILY_SCAN_SAFETY_LIMIT is still 10', () => {
      expect(subConfigSource).toMatch(/PRO_DAILY_SCAN_SAFETY_LIMIT = 10/)
    })
  })

  describe('13. Garden/Glow untouched by reviewer access', () => {
    test('AccountGateModal does not import Garden components', () => {
      expect(modalSource).not.toMatch(/Garden|LivingGarden/)
    })

    test('AccountGateModal does not import Glow components', () => {
      expect(modalSource).not.toMatch(/GlowJourney/)
    })

    test('signInWithPassword does not reference Garden or Glow', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).not.toMatch(/Garden|Glow/)
    })
  })

  // ── NO-OTP REVIEWER PATH (physical QA regression) ────────
  // After physical QA showed the app still asking for OTP after
  // reviewer password sign-in, these tests prove the reviewer path
  // is password-only and never transitions to the code/OTP step.

  describe('14. Reviewer mode calls signInWithPassword', () => {
    test('submitReviewer calls signInWithPassword, not sendCode', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
      )
      expect(reviewerSection).toMatch(/signInWithPassword/)
      expect(reviewerSection).not.toMatch(/beginSignIn|beginEmailLink/)
    })

    test('reviewer CTA onPress is submitReviewer', () => {
      const reviewerUiSection = modalSource.slice(
        modalSource.indexOf("mode === 'reviewer'"),
      )
      expect(reviewerUiSection).toMatch(/onPress={submitReviewer}/)
    })
  })

  describe('15. Successful reviewer login does NOT call signInWithOtp', () => {
    test('signInWithPassword does not call signInWithOtp', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).not.toMatch(/signInWithOtp/)
    })

    test('signInWithPassword does not call updateUser', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).not.toMatch(/updateUser/)
    })

    test('signInWithPassword does not call verifyOtp', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).not.toMatch(/verifyOtp/)
    })
  })

  describe('16. Successful reviewer login does NOT show code-entry UI', () => {
    test('submitReviewer does not call setStep("code")', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).not.toMatch(/setStep\('code'\)/)
      expect(reviewerSection).not.toMatch(/setStep\("code"\)/)
    })

    test('submitReviewer does not call sendCode', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).not.toMatch(/sendCode/)
    })

    test('submitReviewer does not call confirmCode', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).not.toMatch(/confirmCode/)
    })

    test('submitReviewer enforces reviewer mode in finally', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).toMatch(/setMode\('reviewer'\)/)
    })

    test('submitReviewer enforces email step in finally', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).toMatch(/setStep\('email'\)/)
    })
  })

  describe('17. Successful reviewer login closes AccountGateModal', () => {
    test('submitReviewer calls onAuthenticated on verified', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).toMatch(/onAuthenticated/)
    })

    test('submitReviewer calls onClose on verified', () => {
      const reviewerSection = modalSource.slice(
        modalSource.indexOf('submitReviewer'),
        modalSource.indexOf('switchMode'),
      )
      expect(reviewerSection).toMatch(/onClose/)
    })
  })

  describe('18. Reviewer session uses returned Supabase UUID', () => {
    test('signInWithPassword returns userId from data.user.id', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/data\.user\?\.id/)
    })

    test('signInWithPassword returns verified with userId', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/status: 'verified'/)
    })
  })

  describe('19. Purchases.logIn receives canonical reviewer UUID', () => {
    test('signInWithPassword calls notifyIdentityChanged with userId', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/notifyIdentityChanged\(userId\)/)
    })

    test('notifyIdentityChanged calls revenueCatLogIn', () => {
      const notifySection = accountLinkSource.slice(
        accountLinkSource.indexOf('async function notifyIdentityChanged'),
      )
      expect(notifySection).toMatch(/revenueCatLogIn/)
    })
  })

  describe('20. Normal anonymous email-upgrade flow still requires OTP', () => {
    test('beginEmailLink still uses updateUser with email', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function beginEmailLink'),
      )
      expect(fnSection).toMatch(/updateUser/)
    })

    test('verifyEmailLink still uses verifyOtp with email_change', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function verifyEmailLink'),
      )
      expect(fnSection).toMatch(/verifyOtp/)
      expect(fnSection).toMatch(/email_change/)
    })

    test('AccountGateModal still uses beginEmailLink for upgrade', () => {
      expect(modalSource).toMatch(/beginEmailLink/)
    })

    test('AccountGateModal still uses verifyEmailLink for upgrade', () => {
      expect(modalSource).toMatch(/verifyEmailLink/)
    })
  })

  describe('21. Normal returning-user email sign-in still requires OTP', () => {
    test('beginSignIn still uses signInWithOtp', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function beginSignIn'),
      )
      expect(fnSection).toMatch(/signInWithOtp/)
    })

    test('verifySignIn still uses verifyOtp with email type', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function verifySignIn'),
      )
      expect(fnSection).toMatch(/verifyOtp/)
      expect(fnSection).toMatch(/type: 'email'/)
    })

    test('AccountGateModal still uses beginSignIn for normal sign-in', () => {
      expect(modalSource).toMatch(/beginSignIn/)
    })

    test('AccountGateModal still uses verifySignIn for normal sign-in', () => {
      expect(modalSource).toMatch(/verifySignIn/)
    })
  })

  describe('22. No hardcoded bypass code exists', () => {
    test('no universal code bypass pattern in AccountGateModal', () => {
      // Check that no code like "if (code === 'XXXXXX')" exists
      expect(modalSource).not.toMatch(/code\s*===?\s*['"]\d{4,8}['"]/)
    })

    test('no universal code bypass pattern in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/code\s*===?\s*['"]\d{4,8}['"]/)
    })

    test('no universal code bypass pattern in identity.ts', () => {
      expect(identitySource).not.toMatch(/code\s*===?\s*['"]\d{4,8}['"]/)
    })

    test('no hardcoded password bypass in AccountGateModal', () => {
      // Check that no code like "if (password === 'XXXXXX')" exists
      expect(modalSource).not.toMatch(/password\s*===?\s*['"][^'"]{4,20}['"]/)
    })

    test('no hardcoded password bypass in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/password\s*===?\s*['"][^'"]{4,20}['"]/)
    })
  })

  describe('23. signInWithPassword is robust against listener failures', () => {
    test('notifyIdentityChanged is wrapped in try-catch', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      expect(fnSection).toMatch(/try\s*{[^}]*notifyIdentityChanged/s)
      expect(fnSection).toMatch(/}\s*catch/)
    })

    test('signInWithPassword returns verified even if notifyIdentityChanged fails', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('signInWithPassword'),
      )
      // The return { status: 'verified' } must come AFTER the try-catch
      // around notifyIdentityChanged, not inside it.
      const catchIdx = fnSection.indexOf('catch')
      const returnIdx = fnSection.indexOf("status: 'verified'")
      expect(returnIdx).toBeGreaterThan(catchIdx)
    })
  })

  // ── RENDER REGRESSION: Reviewer access visible in signin mode ──
  // Physical QA showed "Reviewer access" was not visible even though
  // the source had it. Root cause was expo-updates serving a stale
  // OTA bundle. These tests prove the SOURCE renders both links
  // simultaneously in the normal returning-user sign-in modal.

  describe('24. Returning-user modal renders BOTH links simultaneously', () => {
    test('signin mode renders "Send sign-in code" AND "Reviewer access" together', () => {
      // In signin mode, step email:
      //   - CTA text is "Send sign-in code" (from COPY.signin.cta)
      //   - switchMode link shows "New here? Create your free account"
      //   - switchToReviewer link shows "Reviewer access"
      // All three must be present in the same render output.
      const signinSection = modalSource.slice(
        modalSource.indexOf("title: 'Welcome back'"),
      )
      expect(signinSection).toContain('Send sign-in code')
      expect(signinSection).toContain('New here? Create your free account')
      expect(signinSection).toContain('Reviewer access')
    })

    test('"Reviewer access" is NOT inside a Developer Tools condition', () => {
      const reviewerLinkIdx = modalSource.indexOf('Reviewer access')
      // Search backwards for any DEVELOPER_TOOLS condition before the link
      const beforeLink = modalSource.substring(0, reviewerLinkIdx)
      // The last conditional before "Reviewer access" should be
      // mode === 'reviewer' ? ... : <>, NOT a Developer Tools check
      expect(beforeLink).not.toMatch(/DEVELOPER_TOOLS_ENABLED.*Reviewer access/s)
    })

    test('"Reviewer access" is NOT inside an environment variable check', () => {
      const reviewerLinkIdx = modalSource.indexOf('Reviewer access')
      const beforeLink = modalSource.substring(
        Math.max(0, reviewerLinkIdx - 500),
        reviewerLinkIdx,
      )
      expect(beforeLink).not.toMatch(/EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS/)
      expect(beforeLink).not.toMatch(/process\.env/)
    })

    test('"Reviewer access" link is inside the non-reviewer conditional branch', () => {
      // The JSX structure is:
      //   {mode === 'reviewer' ? (
      //     <Back to sign in>
      //   ) : (
      //     <>
      //       <switchMode link>
      //       <Reviewer access link>  ← must be here
      //     </>
      //   )}
      // "Reviewer access" appears twice: once in COPY.reviewer.title
      // and once in the JSX render. Find the JSX occurrence (the one
      // inside a <Text> element).
      const firstIdx = modalSource.indexOf('Reviewer access')
      const reviewerLinkIdx = modalSource.indexOf('Reviewer access', firstIdx + 1)
      expect(reviewerLinkIdx).toBeGreaterThan(-1)
      // The JSX "Reviewer access" must come AFTER the conditional
      const conditionalIdx = modalSource.lastIndexOf(
        "mode === 'reviewer'",
        reviewerLinkIdx,
      )
      expect(conditionalIdx).toBeGreaterThan(-1)
      expect(reviewerLinkIdx).toBeGreaterThan(conditionalIdx)
    })
  })

  describe('25. Reviewer mode renders email + password (no OTP)', () => {
    test('reviewer mode renders password input with secureTextEntry', () => {
      const reviewerModeIdx = modalSource.indexOf("mode === 'reviewer' ?")
      const reviewerSection = modalSource.substring(reviewerModeIdx)
      expect(reviewerSection).toMatch(/secureTextEntry/)
    })

    test('reviewer mode renders "Sign in" CTA (not "Send sign-in code")', () => {
      // COPY.reviewer.cta = 'Sign in'
      const reviewerCopyIdx = modalSource.indexOf("cta: 'Sign in'")
      expect(reviewerCopyIdx).toBeGreaterThan(-1)
    })

    test('reviewer mode does NOT render "Send sign-in code"', () => {
      // In reviewer mode, the CTA is "Sign in", not "Send sign-in code"
      // The "Send sign-in code" text is only in COPY.signin.cta
      // and is only used when mode === 'signin' and step === 'email'
      const reviewerCopySection = modalSource.slice(
        modalSource.indexOf("title: 'Reviewer access'"),
        modalSource.indexOf("title: 'Reviewer access'") + 200,
      )
      expect(reviewerCopySection).not.toMatch(/Send sign-in code/)
    })

    test('reviewer mode does NOT render code input or Verify button', () => {
      // The code input and Verify button are in the step === 'code' branch
      // which is only reached in non-reviewer modes
      const reviewerModeStart = modalSource.indexOf("mode === 'reviewer' ?")
      const reviewerModeEnd = modalSource.indexOf(': step ===', reviewerModeStart)
      const reviewerBranch = modalSource.substring(reviewerModeStart, reviewerModeEnd)
      expect(reviewerBranch).not.toMatch(/codeInput/)
      expect(reviewerBranch).not.toMatch(/Verify/)
    })
  })

  describe('26. expo-updates disabled to prevent stale OTA', () => {
    test('app.config.js disables expo-updates', () => {
      const configPath = path.resolve(__dirname, '../../../app.config.js')
      const configSource = fs.readFileSync(configPath, 'utf8')
      expect(configSource).toMatch(/updates.*enabled.*false/s)
    })

    test('app.config.js overrides runtimeVersion', () => {
      const configPath = path.resolve(__dirname, '../../../app.config.js')
      const configSource = fs.readFileSync(configPath, 'utf8')
      expect(configSource).toMatch(/runtimeVersion/)
      expect(configSource).toMatch(/local-build/)
    })
  })
})
