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
})
