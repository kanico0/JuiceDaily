# HUMAN_MONETIZATION_SETUP.md

Non-secret configuration values actually present in this project, for use in the
Apple, Google Play, RevenueCat, Expo, and Supabase dashboards.
Generated 2026-07-14. No private keys, webhook secrets, or service-role keys are shown.

---

## 1. Branding

| Item | Value | Source |
|---|---|---|
| Expo app name | `RawLifeFlow: Juicing Daily` | `app.json` → `expo.name` |
| Expo slug | `rawlifeflow-juicing-daily` | `app.json` → `expo.slug` |
| Android application label | `RawLifeFlow: Juicing Daily` | `android/app/src/main/res/values/strings.xml` → `app_name` |
| iOS display name | Derived from Expo name (`RawLifeFlow: Juicing Daily`) — no `ios/` native project or `Info.plist` override exists in the repo | `app.json` |

**Confirmed:** the public app name is exactly `RawLifeFlow: Juicing Daily`. ✅

## 2. Permanent application identifiers (DO NOT CHANGE)

| Item | Value | Source |
|---|---|---|
| `android.package` | `com.juicingapp.app` | `app.json`; matches `applicationId`/`namespace` in `android/app/build.gradle` |
| `ios.bundleIdentifier` | `com.juicingapp.app` | `app.config.js` |
| EAS project ID | `20be049d-1a88-4fe1-b72e-926d83ef6b2c` | `app.json` → `expo.extra.eas.projectId` (owner: `kanico`) |

## 3. RevenueCat configuration expected by the code

Source: `src/services/subscriptions/subscriptionConfig.ts`

| Item | Value |
|---|---|
| Entitlement identifier | `pro` |
| Offering identifier | `default` |
| Monthly package identifier | `$rc_monthly` (standard RevenueCat monthly package) |
| Annual package identifier | `$rc_annual` (standard RevenueCat annual package) |
| Android public SDK env var | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` |
| iOS public SDK env var | `EXPO_PUBLIC_REVENUECAT_IOS_KEY` |
| Monetization-enabled env var | `EXPO_PUBLIC_MONETIZATION_ENABLED` |

RevenueCat dashboard display names requested (dashboard-only, not code):
- Project display name: `RawLifeFlow`
- Subscription display name: `RawLifeFlow Pro`

## 4. Store product identifiers

Source: `src/services/subscriptions/subscriptionConfig.ts`

| Item | Value |
|---|---|
| Apple monthly product ID | `com.juicingapp.app.pro.monthly` |
| Apple annual product ID | `com.juicingapp.app.pro.annual` |
| Google subscription product ID | `juicing_daily_pro` |
| Google monthly base plan ID | `monthly` |
| Google annual base plan ID | `annual` |

Note: these identifiers intentionally retain the original "juicingapp"/"juicing_daily"
naming. They are internal identifiers and MUST NOT be renamed for the rebrand.

## 5. Supabase configuration

| Item | Value |
|---|---|
| Supabase project reference | `twnkxajnoeljgerqgqep` |
| Deployed Edge Functions | `analyze-scan`, `scan-quota`, `revenuecat-webhook` |
| Expected RevenueCat webhook URL | `https://twnkxajnoeljgerqgqep.supabase.co/functions/v1/revenuecat-webhook` |
| Webhook authorization secret variable name | `REVENUECAT_WEBHOOK_SECRET` (Supabase function secret; sent by RevenueCat as `Authorization: Bearer <secret>`) |

Other required Supabase function secrets (names only, values not shown):
- `ANTHROPIC_API_KEY` (used by `analyze-scan`)
- `SUPABASE_URL` (auto-provided by Supabase runtime)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-provided by Supabase runtime)

## 6. Monetization safety

- **Monetization defaults to disabled**: ✅ `.env` sets `EXPO_PUBLIC_MONETIZATION_ENABLED=false`, and `MONETIZATION_ENABLED` in `subscriptionConfig.ts` requires Supabase config AND a real RevenueCat key AND no explicit `false` flag.
- **Placeholder / missing RevenueCat keys auto-disable monetization**: ✅ `isRealKey()` rejects null keys and any key containing `your-` (current keys are `appl_your-…` / `goog_your-…` placeholders).
- **No private credentials in EXPO_PUBLIC vars or client code**: ✅ All `EXPO_PUBLIC_*` values are public by design (Supabase URL/anon key, RevenueCat public SDK keys, legal URLs, kill switch). Secrets in `.env` (`ANTHROPIC_API_KEY`, `SUPABASE_PROD_*`) are not `EXPO_PUBLIC_` prefixed and are not inlined into the client bundle. `.env` is gitignored.
- **Free-quota reset via reinstall / clearing storage**: ⚠️ **YES, currently possible.** Identity uses Supabase anonymous auth with the session persisted in AsyncStorage (`src/services/supabase/identity.ts`). Reinstalling the app or clearing app storage creates a new anonymous user with a fresh free scan allowance.
- **🚫 LAUNCH BLOCKER**: durable identity protection (e.g., device-attested identity, sign-in linking, or server-side device fingerprinting) has NOT been implemented. Free-quota abuse via reinstall is currently unmitigated.

## 7. Verification results (run 2026-07-14)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS (no errors) |
| `npm test` | ✅ PASS — 4 suites, 99/99 tests (one expected `console.warn` in `storage.test.ts`) |
| `npx expo export` | ✅ PASS — Android bundle 8.29 MB, iOS bundle 8.27 MB, 3283 modules each |

## 8. Git status

- **Rebrand commit**: `bfbc8e1` — "Rebrand customer-facing name to RawLifeFlow: Juicing Daily"
- **Working tree**: ✅ clean (excluding gitignored build output such as `dist/` from `expo export`)
- **Commit `f4548a5`** (monetization layer rebuild): ✅ intact in history (`bfbc8e1` → `f4548a5` → `6e15b05`)

## Mismatches / notes

- No mismatches between code identifiers and this report — all values above are as
  actually present in the project.
- Google Play listing title, iOS App Store name, RevenueCat display names, and store
  product creation are **dashboard tasks** and cannot be verified from code.
- `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL` are currently **empty** in `.env`.
  Apple/Google require working Terms and Privacy links on the paywall before review.

---

# STATUS: READY FOR CONSOLE SETUP

(Not production-ready: Apple, Google Play, RevenueCat dashboard configuration and
sandbox purchase testing still require human access. The anonymous-identity quota
reset issue is a launch blocker to resolve before public release.)
