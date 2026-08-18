// ─────────────────────────────────────────────────────────────
// reviewerAccess.test.js — Focused regression coverage for the
// server-validated Google Play reviewer code authentication.
//
// Proves:
//   1. reviewer-specific visible UI no longer exists
//   2. normal Welcome Back screen remains unchanged
//   3. normal Send sign-in code path remains
//   4. code-entry Verify first invokes reviewer verification helper
//   5. reviewer email + accepted server response establishes real
//      Supabase session
//   6. returned reviewer UUID must equal expected UUID
//   7. successful reviewer route does NOT call normal OTP
//      verification with the review code
//   8. rejected/non-reviewer route falls through to existing
//      normal verifyOtp
//   9. ordinary email + review code does NOT receive reviewer
//      authentication
//  10. review code does NOT appear in production React Native source
//  11. server verifier validates exact configured reviewer account
//  12. server verifier does not log submitted code
//  13. privileged Supabase secret never reaches client
//  14. reviewer auth results in notifyIdentityChanged(reviewerUUID)
//  15. normal OTP account flows remain unchanged
//  16. Garden/Glow untouched
// ─────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

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

const edgeFunctionPath = path.resolve(__dirname, '../../../supabase/functions/verify-play-review-access/index.ts')
const edgeFunctionSource = fs.readFileSync(edgeFunctionPath, 'utf8')

describe('Google Play Reviewer Access (server-validated code)', () => {
  // ── 1. Reviewer-specific visible UI no longer exists ──────
  describe('1. Reviewer-specific visible UI no longer exists', () => {
    test('AccountGateModal does not contain "Reviewer access" text', () => {
      expect(modalSource).not.toMatch(/Reviewer access/)
    })

    test('AccountGateModal does not have a reviewer mode', () => {
      expect(modalSource).not.toMatch(/mode === 'reviewer'/)
    })

    test('AccountGateModal does not import signInWithPassword', () => {
      expect(modalSource).not.toMatch(/signInWithPassword/)
    })

    test('AccountGateModal does not have submitReviewer', () => {
      expect(modalSource).not.toMatch(/submitReviewer/)
    })

    test('AccountGateModal does not have switchToReviewer', () => {
      expect(modalSource).not.toMatch(/switchToReviewer/)
    })

    test('AccountGateModal does not have a password input', () => {
      expect(modalSource).not.toMatch(/secureTextEntry/)
    })

    test('AccountGateModal does not have "Back to sign in" reviewer link', () => {
      expect(modalSource).not.toMatch(/Back to sign in/)
    })

    test('AccountGateModal does not import Lock icon', () => {
      expect(modalSource).not.toMatch(/Lock/)
    })

    test('AccountGateModal does not have a reviewer COPY entry', () => {
      expect(modalSource).not.toMatch(/reviewer:\s*\{/)
    })
  })

  // ── 2. Normal Welcome Back screen remains unchanged ───────
  describe('2. Normal Welcome Back screen remains unchanged', () => {
    test('AccountGateModal still has "Welcome back" title', () => {
      expect(modalSource).toMatch(/Welcome back/)
    })

    test('AccountGateModal still has signin mode', () => {
      expect(modalSource).toMatch(/signin/)
    })

    test('AccountGateModal still has "New here? Create your free account"', () => {
      expect(modalSource).toMatch(/New here\? Create your free account/)
    })

    test('AccountGateModal still has "Already have an account? Sign in"', () => {
      expect(modalSource).toMatch(/Already have an account\? Sign in/)
    })
  })

  // ── 3. Normal Send sign-in code path remains ──────────────
  describe('3. Normal Send sign-in code path remains', () => {
    test('AccountGateModal still has "Send sign-in code" CTA', () => {
      expect(modalSource).toMatch(/Send sign-in code/)
    })

    test('AccountGateModal still has sendCode callback', () => {
      expect(modalSource).toMatch(/sendCode/)
    })

    test('AccountGateModal still has beginSignIn import', () => {
      expect(modalSource).toMatch(/beginSignIn/)
    })

    test('AccountGateModal still has Verify button', () => {
      expect(modalSource).toMatch(/Verify/)
    })

    test('AccountGateModal still has confirmCode callback', () => {
      expect(modalSource).toMatch(/confirmCode/)
    })
  })

  // ── 4. Verify first invokes reviewer verification helper ──
  describe('4. Code-entry Verify first invokes reviewer verification helper', () => {
    test('verifySignIn calls tryReviewerCodeVerification before verifyOtp', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function verifySignIn'),
      )
      const reviewerIdx = fnSection.indexOf('tryReviewerCodeVerification')
      const otpIdx = fnSection.indexOf("type: 'email'")
      expect(reviewerIdx).toBeGreaterThan(-1)
      expect(otpIdx).toBeGreaterThan(-1)
      expect(reviewerIdx).toBeLessThan(otpIdx)
    })

    test('tryReviewerCodeVerification is defined in accountLink.ts', () => {
      expect(accountLinkSource).toMatch(/async function tryReviewerCodeVerification/)
    })

    test('tryReviewerCodeVerification calls the Edge Function endpoint', () => {
      expect(accountLinkSource).toMatch(/verify-play-review-access/)
    })
  })

  // ── 5. Reviewer email + accepted server response ─────────
  describe('5. Reviewer email + accepted server response establishes real session', () => {
    test('tryReviewerCodeVerification calls verifyOtp with token_hash', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/token_hash/)
    })

    test('tryReviewerCodeVerification uses magiclink type', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/magiclink/)
    })

    test('tryReviewerCodeVerification checks for status ok from server', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/status !== 'ok'/)
    })
  })

  // ── 6. Returned reviewer UUID must equal expected UUID ────
  describe('6. Returned reviewer UUID must equal expected UUID', () => {
    test('tryReviewerCodeVerification extracts userId from session', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/session\?\.user\?\.id/)
    })

    test('tryReviewerCodeVerification returns verified with userId', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/status: 'verified'/)
    })
  })

  // ── 7. Successful reviewer route does NOT call normal OTP ─
  describe('7. Successful reviewer route does NOT call normal OTP with review code', () => {
    test('tryReviewerCodeVerification returns non-null on success (skips normal OTP)', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function verifySignIn'),
        accountLinkSource.indexOf('async function tryReviewerCodeVerification'),
      )
      // The normal OTP path is only reached when tryReviewerCodeVerification
      // returns null (not_applicable).
      expect(fnSection).toMatch(/reviewerResult !== null/)
    })

    test('normal verifyOtp uses email + token, not token_hash', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function verifySignIn'),
        accountLinkSource.indexOf('async function tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/token: token\.trim\(\)/)
      expect(fnSection).toMatch(/type: 'email'/)
    })
  })

  // ── 8. Rejected/non-reviewer falls through to normal OTP ──
  describe('8. Rejected/non-reviewer route falls through to normal verifyOtp', () => {
    test('tryReviewerCodeVerification returns null on not_applicable', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/return null/)
    })

    test('verifySignIn falls through to normal verifyOtp when reviewer returns null', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function verifySignIn'),
        accountLinkSource.indexOf('async function tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/if \(reviewerResult !== null\) return reviewerResult/)
    })
  })

  // ── 9. Ordinary email + review code does NOT get reviewer ─
  describe('9. Ordinary email + review code does NOT receive reviewer auth', () => {
    test('Edge Function validates exact reviewer email from secret', () => {
      expect(edgeFunctionSource).toMatch(/PLAY_REVIEW_EMAIL/)
      expect(edgeFunctionSource).toMatch(/emailMatch/)
    })

    test('Edge Function validates exact review code from secret', () => {
      expect(edgeFunctionSource).toMatch(/PLAY_REVIEW_CODE/)
      expect(edgeFunctionSource).toMatch(/codeMatch/)
    })

    test('Edge Function requires BOTH email AND code to match', () => {
      expect(edgeFunctionSource).toMatch(/!emailMatch \|\| !codeMatch/)
    })

    test('Edge Function returns not_applicable for non-reviewer', () => {
      expect(edgeFunctionSource).toMatch(/not_applicable/)
    })
  })

  // ── 10. Review code does NOT appear in client source ──────
  // Check for any 6-digit literal in production source without
  // embedding the actual review code in the test file.
  // Excludes the known placeholder "123456" used in the code input.
  describe('10. Review code does NOT appear in production client source', () => {
    // Match 6-digit numbers that are NOT the placeholder 123456
    const sixDigitLiteral = /\b(?!123456\b)\d{6}\b/

    test('no 6-digit code literal in AccountGateModal (excl. placeholder)', () => {
      expect(modalSource).not.toMatch(sixDigitLiteral)
    })

    test('no 6-digit code literal in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(sixDigitLiteral)
    })

    test('no 6-digit code literal in identity.ts', () => {
      expect(identitySource).not.toMatch(sixDigitLiteral)
    })

    test('no 6-digit code literal in subscriptionConfig.ts', () => {
      expect(subConfigSource).not.toMatch(sixDigitLiteral)
    })

    test('no 6-digit code literal in useEffectiveProAccess.js', () => {
      expect(useEffectiveSource).not.toMatch(sixDigitLiteral)
    })

    test('no universal code bypass pattern in AccountGateModal', () => {
      expect(modalSource).not.toMatch(/code\s*===?\s*['"]\d{4,8}['"]/)
    })

    test('no hardcoded password bypass in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/password\s*===?\s*['"][^'"]{4,20}['"]/)
    })

    test('reviewer email is not hardcoded in AccountGateModal', () => {
      expect(modalSource).not.toMatch(/playreview@rawlifeflow\.com/)
    })

    test('reviewer email is not hardcoded in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/playreview@rawlifeflow\.com/)
    })
  })

  // ── 11. Server verifier validates exact reviewer account ──
  describe('11. Server verifier validates exact configured reviewer account', () => {
    test('Edge Function loads PLAY_REVIEW_EMAIL from env', () => {
      expect(edgeFunctionSource).toMatch(/Deno\.env\.get\('PLAY_REVIEW_EMAIL'\)/)
    })

    test('Edge Function loads PLAY_REVIEW_CODE from env', () => {
      expect(edgeFunctionSource).toMatch(/Deno\.env\.get\('PLAY_REVIEW_CODE'\)/)
    })

    test('Edge Function loads PLAY_REVIEW_USER_ID from env', () => {
      expect(edgeFunctionSource).toMatch(/Deno\.env\.get\('PLAY_REVIEW_USER_ID'\)/)
    })

    test('Edge Function asserts returned UUID matches expected', () => {
      expect(edgeFunctionSource).toMatch(/returnedUserId !== reviewerUserId/)
    })

    test('Edge Function fails closed on UUID mismatch', () => {
      const uuidSection = edgeFunctionSource.slice(
        edgeFunctionSource.indexOf('returnedUserId'),
      )
      expect(uuidSection).toMatch(/not_applicable/)
    })
  })

  // ── 12. Server verifier does not log submitted code ───────
  describe('12. Server verifier does not log submitted code', () => {
    test('Edge Function does not console.log the code', () => {
      expect(edgeFunctionSource).not.toMatch(/console\.log.*code/)
    })

    test('Edge Function does not include submitted code in response', () => {
      // The response only contains status, token_hash, verification_type
      const responseSection = edgeFunctionSource.slice(
        edgeFunctionSource.indexOf('return json(200, {'),
        edgeFunctionSource.indexOf('return json(200, {') + 200,
      )
      // Should not echo back the code
      expect(responseSection).not.toMatch(/code:/)
    })

    test('Edge Function does not return user data in response', () => {
      // The "ok" response JSON only contains status, token_hash,
      // and verification_type — no user data, no email.
      const okResponseMatch = edgeFunctionSource.match(
        /return json\(200,\s*\{[^}]*status: 'ok'[^}]*\}\)/s,
      )
      expect(okResponseMatch).not.toBeNull()
      const okResponse = okResponseMatch[0]
      expect(okResponse).not.toMatch(/user:/)
      expect(okResponse).not.toMatch(/email:/)
    })
  })

  // ── 13. Privileged Supabase secret never reaches client ───
  describe('13. Privileged Supabase secret never reaches client', () => {
    test('no service_role key in AccountGateModal', () => {
      expect(modalSource).not.toMatch(/service_role|SERVICE_ROLE/)
    })

    test('no service_role key in accountLink.ts', () => {
      expect(accountLinkSource).not.toMatch(/service_role|SERVICE_ROLE/)
    })

    test('no service_role key in subscriptionConfig.ts', () => {
      expect(subConfigSource).not.toMatch(/service_role|SERVICE_ROLE/)
    })

    test('Edge Function uses service key only server-side', () => {
      expect(edgeFunctionSource).toMatch(/SUPABASE_SERVICE_ROLE_KEY/)
    })

    test('Edge Function never returns the service key', () => {
      expect(edgeFunctionSource).not.toMatch(/return.*service_role/i)
      expect(edgeFunctionSource).not.toMatch(/return.*SUPABASE_SERVICE_ROLE_KEY/i)
    })

    test('tryReviewerCodeVerification uses anon key, not service key', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/SUPABASE_ANON_KEY/)
      expect(fnSection).not.toMatch(/service_role|SERVICE_ROLE/)
    })
  })

  // ── 14. Reviewer auth results in notifyIdentityChanged ────
  describe('14. Reviewer auth results in notifyIdentityChanged(reviewerUUID)', () => {
    test('tryReviewerCodeVerification calls notifyIdentityChanged', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/notifyIdentityChanged\(userId\)/)
    })

    test('notifyIdentityChanged calls revenueCatLogIn', () => {
      const notifySection = accountLinkSource.slice(
        accountLinkSource.indexOf('async function notifyIdentityChanged'),
      )
      expect(notifySection).toMatch(/revenueCatLogIn/)
    })

    test('tryReviewerCodeVerification wraps notifyIdentityChanged in try-catch', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('tryReviewerCodeVerification'),
      )
      expect(fnSection).toMatch(/try\s*{[^}]*notifyIdentityChanged/s)
    })
  })

  // ── 15. Normal OTP account flows remain unchanged ─────────
  describe('15. Normal OTP account flows remain unchanged', () => {
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

    test('beginSignIn still uses signInWithOtp', () => {
      const fnSection = accountLinkSource.slice(
        accountLinkSource.indexOf('export async function beginSignIn'),
      )
      expect(fnSection).toMatch(/signInWithOtp/)
    })

    test('AccountGateModal still uses beginEmailLink for upgrade', () => {
      expect(modalSource).toMatch(/beginEmailLink/)
    })

    test('AccountGateModal still uses verifyEmailLink for upgrade', () => {
      expect(modalSource).toMatch(/verifyEmailLink/)
    })

    test('AccountGateModal still uses beginSignIn for normal sign-in', () => {
      expect(modalSource).toMatch(/beginSignIn/)
    })

    test('AccountGateModal still uses verifySignIn for normal sign-in', () => {
      expect(modalSource).toMatch(/verifySignIn/)
    })
  })

  // ── 16. Garden/Glow untouched ─────────────────────────────
  describe('16. Garden/Glow untouched', () => {
    test('AccountGateModal does not import Garden components', () => {
      expect(modalSource).not.toMatch(/Garden|LivingGarden/)
    })

    test('AccountGateModal does not import Glow components', () => {
      expect(modalSource).not.toMatch(/GlowJourney/)
    })

    test('Edge Function does not reference Garden or Glow', () => {
      expect(edgeFunctionSource).not.toMatch(/Garden|Glow/)
    })
  })

  // ── 17. signInWithPassword removed ────────────────────────
  describe('17. signInWithPassword removed from accountLink.ts', () => {
    test('accountLink.ts does not export signInWithPassword', () => {
      expect(accountLinkSource).not.toMatch(/export async function signInWithPassword/)
    })

    test('accountLink.ts does not call signInWithPassword', () => {
      expect(accountLinkSource).not.toMatch(/signInWithPassword/)
    })
  })

  // ── 18. Rate limiting in Edge Function ────────────────────
  describe('18. Rate limiting/abuse protection', () => {
    test('Edge Function has rate limiting', () => {
      expect(edgeFunctionSource).toMatch(/checkRateLimit|RATE_LIMIT/)
    })

    test('Edge Function limits failures per email', () => {
      expect(edgeFunctionSource).toMatch(/RATE_LIMIT_MAX_FAILURES/)
    })

    test('Edge Function has a time window', () => {
      expect(edgeFunctionSource).toMatch(/RATE_LIMIT_WINDOW_MS/)
    })

    test('Edge Function records failures', () => {
      expect(edgeFunctionSource).toMatch(/recordFailure/)
    })

    test('Edge Function returns 429 on rate limit exceeded', () => {
      expect(edgeFunctionSource).toMatch(/429/)
    })

    test('Edge Function does not expose stack traces', () => {
      // Catch blocks should return not_applicable, not error details
      const catchSection = edgeFunctionSource.slice(
        edgeFunctionSource.lastIndexOf('catch'),
      )
      expect(catchSection).toMatch(/not_applicable/)
      expect(catchSection).not.toMatch(/error\.message|e\.message/)
    })
  })

  // ── 19. expo-updates still disabled ───────────────────────
  describe('19. expo-updates still disabled', () => {
    test('app.config.js still disables expo-updates', () => {
      const configPath = path.resolve(__dirname, '../../../app.config.js')
      const configSource = fs.readFileSync(configPath, 'utf8')
      expect(configSource).toMatch(/updates.*enabled.*false/s)
    })
  })
})
