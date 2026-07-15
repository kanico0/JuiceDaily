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

## 2. Supabase dashboard settings that MUST be enabled (human)

1. **Authentication → Sign In / Up → Anonymous sign-ins**: ON (already in use).
2. **Authentication → Sign In / Up → Email**: ON, with **Email OTP** enabled.
3. **Authentication → Email → Secure email change**: recommend **OFF** for
   anonymous upgrades (anonymous users have no old email to confirm; a single
   OTP to the new address is the correct UX). If left ON, Supabase still sends
   only one confirmation for users without an existing email.
4. **Authentication → Rate limits**: review OTP send limits (default is fine).
5. **Manual identity linking** (`Authentication → Settings`): NOT required for
   this flow — `updateUser({ email })` upgrades in place. Only enable if you
   later add OAuth providers via `linkIdentity()`.

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

- The gate is client-side UX; the **server remains authoritative** for quota.
  Note: the `analyze-scan` Edge Function currently accepts any valid JWT,
  including anonymous ones. Recommended hardening (human/server task): reject
  `is_anonymous` JWT claims in `analyze-scan` so the gate cannot be bypassed
  by a modified client. This is listed under remaining actions.
- OTP verification is required for ALL identity changes — no unverified merge.
- `shouldCreateUser: false` prevents account creation via the sign-in path.
- Sign-out is local-only; server data stays keyed to the UUID.
- No secrets added; only public Supabase anon-key flows are used.
- Failed auth consumes nothing; failed analysis still releases reservations
  (unchanged server logic).

## 7. Remaining human actions

- [ ] Enable Email OTP provider + configure production SMTP (Section 2–3).
- [ ] **Server hardening**: update `supabase/functions/analyze-scan` to reject
      anonymous JWTs (defense-in-depth for the client gate) and redeploy.
- [ ] Customize the OTP email template with RawLifeFlow branding.
- [ ] Sandbox test the full reinstall → sign-in → entitlement flow (Section 5).
- [ ] RevenueCat dashboard: no changes needed (App User ID strategy unchanged).

## 8. Is the reinstall quota-reset vulnerability closed?

**Substantially closed at the product level; one server-side hardening step
remains.**

- Honest users can no longer reset their allowance: funded scans require a
  verified email identity, and signing back in restores the original UUID and
  its usage. Creating a new allowance now requires a **new email address**,
  not merely a reinstall.
- A technically skilled attacker with a modified client could still call the
  Edge Function with an anonymous JWT until the server-side anonymous-JWT
  rejection (Section 7) is deployed. That change is small (check
  `is_anonymous` claim in `analyze-scan`) and should ship before launch.
- Disposable-email abuse is a residual, accepted risk typical of email-gated
  free tiers.

---

## Verification (run 2026-07-14)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS |
| `npm test` | ✅ 6 suites, 127/127 tests (28 new identity/gate tests) |
| `npx expo export` | ✅ PASS |

Unchanged as required: `com.juicingapp.app`, entitlement `pro`, offering
`default`, Apple product IDs, Google subscription/base-plan IDs.
