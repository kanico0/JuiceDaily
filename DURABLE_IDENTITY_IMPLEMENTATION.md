# DURABLE_IDENTITY_IMPLEMENTATION.md

Durable account protection for **RawLifeFlow: Juicing Daily** — prevents free
scan-quota resets via reinstall, cleared storage, or lost anonymous sessions.
Implemented against `@supabase/supabase-js` **2.110.5** and
`react-native-purchases` **10.4.2**. No existing subscription, RevenueCat,
quota, or Supabase architecture was redesigned.

---

## 1. Completed architecture

### Identity model (unchanged core, new upgrade path)
- App start: Supabase **anonymous auth** creates/restores the user UUID
  (`src/services/supabase/identity.ts`, unchanged).
- The Supabase UUID remains the **RevenueCat App User ID** and the server-side
  key for quotas and subscriptions.
- **New**: `src/services/supabase/accountLink.ts` upgrades the anonymous user to
  a permanent email identity using the officially supported supabase-js v2 flow:

| Flow | Step 1 | Step 2 | UUID |
|---|---|---|---|
| Anonymous → permanent | `auth.updateUser({ email })` (sends 6-digit OTP) | `auth.verifyOtp({ type: 'email_change' })` | **Preserved** — same user, same UUID |
| Returning user sign-in | `auth.signInWithOtp({ email, shouldCreateUser: false })` | `auth.verifyOtp({ type: 'email' })` | **Original UUID restored** |

- `shouldCreateUser: false` guarantees a typo or reinstall can never mint a new
  user (and therefore never a new free quota).
- No `signUp` call is used anywhere — the anonymous UUID is never replaced
  except when the user intentionally signs into an existing account.

### Scan gate (first funded scan)
- `src/services/quota/quotaService.ts` → `analyzeScanOnServer()` now checks
  `isDurableUser()` **before any network request**. Anonymous users get a
  `ScanQuotaError('account_required')` — nothing is reserved or consumed.
- `src/screens/CameraScreen.js` catches `account_required` and triggers
  `onAccountRequired` instead of showing an error.
- `src/screens/HomeScreen.js` presents `AccountGateModal` — a friendly
  account-protection screen framed around saving history and keeping the
  monthly allowance (not fraud prevention).
- Anonymous exploration is fully preserved: browsing, manual logging, recipes,
  streaks, and quota display all work without an account. Only the funded AI
  scan requires durable auth.

### UI
- `src/components/AccountGateModal.js` (reusable): email validation, 6-digit
  OTP entry, 60-second resend cooldown, loading + double-submit protection,
  friendly errors, mode toggle (create vs. sign-in), collision messaging.
- `src/screens/SettingsScreen.js` → new **Account** section: shows the
  authenticated email, "Protect Your Account" / "Sign In" for anonymous users,
  and Sign Out with a warning that signing in again is needed to recover
  history and plan.

### Identity-change propagation
- `accountLink.notifyIdentityChanged(uuid)` runs after every successful
  verification:
  - Calls RevenueCat `Purchases.logIn(uuid)` with the canonical Supabase UUID.
  - Notifies listeners: `QuotaStore` clears + refetches the quota;
    `SubscriptionStore` re-derives entitlements from fresh `CustomerInfo`.

### Existing-account collision handling
- `updateUser({ email })` fails when the email belongs to another account →
  classified as `email_in_use` → the modal switches to **sign-in mode** with a
  clear, nontechnical message. No automatic merge; access requires OTP
  verification of the email. Quota, purchases, and history are never
  transferred between users.

### RevenueCat integration
- Same-UUID linking (`email_change` flow) calls `logIn` with the **same** App
  User ID — RevenueCat treats this as a no-op, no unnecessary alias.
- Account switch (sign-in to an existing account) calls `logIn` with the new
  canonical UUID directly (no intermediate `logOut`, which would create a
  fresh anonymous RC user and risk stranding purchases).
- Entitlements refresh after authentication via the identity listener.
- Purchases cannot strand: RC is always configured/logged-in with a Supabase
  UUID, never a device-random ID.

## 2. Supabase auth settings (CONFIGURED 2026-07-15 via `config push`)

Managed in `supabase/config.toml` and applied with `npx supabase config push`:

1. **Anonymous sign-ins**: ON (`enable_anonymous_sign_ins = true`).
2. **Email confirmations**: ON (`enable_confirmations = true`) — **this was the
   root cause of the "invalid code" error**: with confirmations OFF, Supabase
   auto-confirmed `updateUser({ email })` instantly, never sent an OTP, and
   let anyone claim an unowned inbox (bypassing the durable-account gate).
3. **Secure email change**: OFF (`double_confirm_changes = false`) — anonymous
   upgrades have no old email; a single OTP to the new address is correct.
4. **OTP length**: 6 digits (`otp_length = 6`) to match the in-app entry UI.
5. **Manual identity linking**: NOT required — `updateUser({ email })`
   upgrades in place.

⚠️ `config push` applies **CLI defaults for any undeclared [auth] key** —
always edit `supabase/config.toml` (which declares every production-critical
key) rather than pushing a partial file.

## 3. Email provider and redirect configuration (human)

- Default Supabase SMTP works for testing but is heavily rate-limited
  (~2 emails/hour). For production, configure a custom SMTP provider
  (e.g. Resend, Postmark) under **Project Settings → Auth → SMTP**.
- Customize the **Magic Link / OTP email template** to show the 6-digit
  `{{ .Token }}` and the app name **RawLifeFlow: Juicing Daily**.
- **No redirect URL is required**: the app uses 6-digit OTP codes typed into
  the app, not magic-link redirects.

## 4. Expo deep-link configuration

- **None required.** The OTP-code flow avoids deep links entirely. The
  existing `scheme: "juicingapp"` in `app.json` is untouched. If you later
  switch to magic links, add the scheme URL to Supabase **Redirect URLs** and
  handle `expo-linking` URL events.

## 5. Manual testing instructions

1. Fresh install → explore app anonymously (recipes, manual logging) — works.
2. Tap the scan shutter → account-protection modal appears; confirm **no scan
   was consumed** (check `scan_usage_events` is empty for the user).
3. Enter email → receive OTP → verify. In Supabase **Auth → Users**, confirm
   the SAME user row now has the email (`is_anonymous` false, UUID unchanged).
4. Scan → succeeds; quota decrements server-side.
5. Uninstall + reinstall (or clear app storage) → app starts with a NEW
   anonymous user → scanning is blocked again → choose **Sign In** → OTP →
   original UUID restored; quota usage identical to before reinstall.
6. Collision: from a new anonymous session, try to protect with an
   already-used email → modal switches to sign-in with a friendly message.
7. Pro flow (sandbox): purchase Pro as durable user → reinstall → sign in →
   entitlement restored (same RevenueCat App User ID).
8. Settings → Account: email shown; Sign Out shows the warning; after sign-out
   the app continues anonymously.

## 6. Security considerations

- The client gate is UX; the **server is authoritative**. As of 2026-07-14 the
  deployed `analyze-scan` function rejects anonymous users server-side (see
  Section 9 below) — a modified client or direct HTTP request cannot bypass
  the account gate.
- OTP verification is required for ALL identity changes — no unverified merge.
- `shouldCreateUser: false` prevents account creation via the sign-in path.
- Sign-out is local-only; server data stays keyed to the UUID.
- No secrets added; only public Supabase anon-key flows are used.
- Failed auth consumes nothing; failed analysis still releases reservations
  (unchanged server logic).

## 7. Remaining human actions

- [x] ~~Server hardening: reject anonymous JWTs in `analyze-scan`~~ — **done and
      deployed** (see Section 9).
- [x] ~~Enable email confirmations / OTP flow~~ — **done via `config push`
      2026-07-15** (Section 2). Verified live: `updateUser` now returns a
      pending `new_email` + `email_change_sent_at` instead of auto-confirming.
- [ ] **Update the "Confirm email change" + "Magic Link" email templates to
      show `{{ .Token }}`** (the default templates contain a link, not the
      6-digit code the app expects) and brand them for RawLifeFlow.
- [ ] Configure production SMTP (default SMTP only delivers to project team
      members, ~2 emails/hour — test with the account-owner email until then).
- [ ] Dashboard cleanup: delete the throwaway smoke-test users (anonymous +
      `otp-smoke-*@example.com`).
- [ ] Live smoke Tests B and C (email OTP upgrade + reinstall sign-in) — need a
      real inbox and device; Test A passed live (Section 9).
- [ ] Sandbox test the full reinstall → sign-in → entitlement flow (Section 5).
- [ ] RevenueCat dashboard: no changes needed (App User ID strategy unchanged).

## 8. Is the reinstall quota-reset vulnerability closed?

**Yes — closed at both the client and server layers** (verified live against
production on 2026-07-14):

- Funded scans require a verified email identity. Reinstalling or clearing
  storage yields an anonymous user that is rejected **server-side** with
  403 `account_required` before any reservation or Anthropic call.
- Signing back in restores the original UUID and its existing usage.
- Creating a new allowance now requires a **new email address**.
- Disposable-email abuse is a residual, accepted risk typical of email-gated
  free tiers.

## 9. Deployed server-side protection (2026-07-14)

### JWT verification
- `analyze-scan` and `scan-quota` validate every bearer token with
  `admin.auth.getUser(jwt)` — the Supabase Auth server checks signature and
  expiry and returns the canonical user record. Base64-decoded payloads are
  never trusted; request-body identity fields do not exist in the API.

### Where `is_anonymous` is checked
1. **`supabase/functions/_shared/authGate.ts`** — `evaluateScanUser()` (shared,
   unit-tested): requires `is_anonymous !== true` on the VERIFIED user record.
   Used by `analyze-scan` before body parsing, quota reservation, scan-record
   insertion, and the Anthropic call.
2. **`scan-quota`** — anonymous users receive a static display-only free
   snapshot; `resolve_quota` (which creates/renews allowance rows) is never
   invoked for them.
3. **Database (defense in depth)** — migration `0002_anonymous_scan_guard.sql`:
   `reserve_scan()` first consults `public._is_anonymous_user()` (reads the
   server-trusted `auth.users.is_anonymous` column — not JWT role, not user
   metadata) and returns `account_required` with zero writes. All quota RPCs
   remain revoked from `public/anon/authenticated` (clients cannot call them).

### HTTP behavior
| Condition | Status | Body code |
|---|---|---|
| Missing Authorization | 401 | `missing_authorization` |
| Malformed / expired / forged token | 401 | `invalid_token` |
| Valid anonymous user | 403 | `account_required` |
| Valid permanent user | proceeds | — |

### Session-refresh behavior (client)
- `quotaService.analyzeScanOnServer()`: on server 403 `account_required`,
  `refreshSessionAndCheckDurable()` refreshes the Supabase session **once**;
  it retries **once** only if the refreshed user is confirmed permanent, using
  the SAME `requestId` (server idempotency ⇒ no duplicate charge).

### Deployment commands used
```
npx supabase db push --include-all        # applies 0002_anonymous_scan_guard.sql
npx supabase functions deploy analyze-scan
npx supabase functions deploy scan-quota
```
Project: `twnkxajnoeljgerqgqep`. No secrets were exposed or changed.

### Live smoke-test results (Test A, production, 2026-07-14)
```
PASS  anonymous direct analyze-scan rejected — status=403 code=account_required
PASS  anonymous rejection created no reservation — events=0
PASS  anonymous quota display works without allocating a row — status=200 rows=0
PASS  missing Authorization → 401
PASS  malformed token → 401
PASS  forged is_anonymous:false payload rejected → 401
```
Re-run anytime with `node scripts/smoke-scan-gate.mjs`. Tests B (email OTP
upgrade) and C (reinstall sign-in) require a real inbox/device — see
Section 5 manual steps.

### Remaining launch blockers
- Production SMTP + Email OTP provider configuration (Section 2–3).
- Live Tests B and C on a device with a real email address.
- RevenueCat store setup (unchanged from HUMAN_MONETIZATION_SETUP.md).

---

## Verification (run 2026-07-14)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS |
| `npm test` | ✅ 7 suites, 142/142 tests (43 identity/gate tests incl. server authGate) |
| `npx expo export` | ✅ PASS |
| `node scripts/smoke-scan-gate.mjs` | ✅ 6/6 live checks against production |

Unchanged as required: `com.juicingapp.app`, entitlement `pro`, offering
`default`, Apple product IDs, Google subscription/base-plan IDs.
