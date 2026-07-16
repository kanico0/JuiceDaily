# RevenueCat SDK Configuration Check — RawLifeFlow: Juicing Daily

## Current Git commit

c304efc265d3abca4f49183a6614d57823b6c29b

## 1) App configuration

- **Android package**
  - `com.juicingapp.app` (from `app.json` → `expo.android.package`)
- **EAS project ID**
  - `20be049d-1a88-4fe1-b72e-926d83ef6b2c` (from `app.json` → `expo.extra.eas.projectId`)
- **RevenueCat SDK installed**
  - `react-native-purchases` is present in `package.json` dependencies.
- **Native RevenueCat module included in Expo/EAS project**
  - The project uses EAS Build + `expo-dev-client`.
  - In this setup, `react-native-purchases` is expected to be autolinked into the generated native projects during EAS builds.
- **Android uses `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`**
  - Confirmed in `src/services/subscriptions/subscriptionConfig.ts` via:
    - `Platform.select({ android: readPublic('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY') })`
- **iOS and Android keys not accidentally reversed (code path)**
  - Code selects iOS key only on iOS and Android key only on Android.
- **RevenueCat configured only once**
  - `src/services/subscriptions/revenueCatClient.ts` uses a module-level `configured` flag.
  - Subsequent calls call `Purchases.logIn(appUserId)` instead of configuring again.

## 2) Android RevenueCat public SDK key (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`)

Checked from local `.env` (file exists locally; it is gitignored).

- **present**: yes
- **placeholder**: yes
- **correct platform type**: yes (starts with `goog_`)
- **masked**: `goog…-key`

Additional safety checks (without revealing the key):

- **not iOS key**: yes (does not start with `appl_`)
- **not a secret API key**: no evidence it is a secret key based on prefix heuristics
- **not a RevenueCat Test Store key**: not detected (no test-store key pattern detected)

## 3) Relevant environments (where env vars are defined)

### Local environment files

- `.env`: present locally and includes:
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`: yes (placeholder)
  - `EXPO_PUBLIC_MONETIZATION_ENABLED`: yes

Note: `.env` is gitignored, so it is not committed.

### `eas.json` build profiles and their env

From `eas.json`:

- **development**
  - `developmentClient: true`
  - `distribution: internal`
  - `android.buildType: apk`
  - `env`: none declared in `eas.json`

- **beta**
  - `developmentClient: true`
  - `distribution: internal`
  - `android.buildType: apk`
  - `channel: beta`
  - `env` declared:
    - `EXPO_PUBLIC_BUILD_TARGET=beta`

- **preview**
  - `distribution: internal`
  - `android.buildType: apk`
  - `env`: none declared in `eas.json`

- **production**
  - `channel: production`
  - `env`: none declared in `eas.json`

### EAS dev/preview/prod environments

This repo does not contain EAS environment values for:

- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- `EXPO_PUBLIC_MONETIZATION_ENABLED`

because they are not declared in `eas.json` and EAS secrets/remote env values are not visible from this codebase.

## 4) Monetization switch (`EXPO_PUBLIC_MONETIZATION_ENABLED`)

From local `.env`:

- **raw value**: `"false"`
- **final parsed boolean value** (as implemented):
  - In `subscriptionConfig.ts`:
    - `explicitlyDisabled = envFlag !== null && envFlag.toLowerCase() === 'false'`
    - Therefore: `explicitlyDisabled === true`
- **whitespace / quotes / capitalization**:
  - Capitalization is handled (`FALSE` works).
  - Whitespace is *not* trimmed. For example, `" false"` would *not* be detected as false.
  - Quotes are not stripped. For example, `"\"false\""` would *not* be detected as false.
- **missing/placeholder-key detection overrides it**:
  - Yes. Even if the flag were true, `MONETIZATION_ENABLED` also requires:
    - Supabase URL + anon key present
    - a non-placeholder RevenueCat key (`!key.includes('your-')`)

**Effective status on Android right now (local `.env`):** monetization is disabled.

## 5) Startup code inspection

### Initialization timing

- RevenueCat initialization happens during normal app startup inside:
  - `SubscriptionProvider` (`src/services/subscriptions/SubscriptionStore.tsx`)
  - `SubscriptionProvider` is mounted in `App.js`.

### Android passes Android public SDK key to `Purchases.configure()`

- `Purchases.configure({ apiKey: REVENUECAT_PUBLIC_API_KEY, appUserID: appUserId })` is called in `configureRevenueCat()`.
- `REVENUECAT_PUBLIC_API_KEY` resolves to Android key on Android via `Platform.select`.

### Initialization skipped when monetization is disabled

- `SubscriptionStore.tsx` exits early when `MONETIZATION_ENABLED` is false.

### Initialization skipped when key is missing or placeholder

- The master `MONETIZATION_ENABLED` requires `isRealKey(REVENUECAT_PUBLIC_API_KEY)`.
- Current `isRealKey()` placeholder detection is:
  - `return !key.includes('your-')`

### App User ID correctness (canonical Supabase UUID)

- `SubscriptionStore.tsx` calls `ensureUser()` (Supabase auth) to obtain `identity.userId`.
- That `identity.userId` (Supabase UUID) is passed as `appUserId` to `configureRevenueCat()`.
- Email is not used as the RevenueCat App User ID.

### Initialization does not happen more than once

- `revenueCatClient.ts` uses a module-level `configured` flag.

## 6) What can be tested without Google Play setup

No native-device verification was performed in this check.

What can be tested in a **native Android dev client / preview build** once you set a real Android public SDK key and enable monetization:

- Native module loads (no missing native module error on import)
- `Purchases.configure()` completes without initialization error
- `Purchases.getCustomerInfo()` returns successfully
- RevenueCat dashboard shows a customer with App User ID equal to the canonical Supabase UUID

Important: missing Google Play products / empty offerings are expected right now and do not prove the SDK key is incorrect.

## 7) Intentionally deferred (per request)

- Google Play subscription products
- Monthly and annual base plans
- Localized Google Play prices
- RevenueCat Google product imports
- Purchasable monthly or annual packages
- Sandbox purchases
- Subscription restoration
- Entitlement activation through a purchase

## 8) Project verification (run results)

- `npx tsc --noEmit`: pass
- `npm test`: pass
- `npx expo export`: pass

## 9) Configuration errors and minimal corrections

### Findings

- Local `.env` contains **placeholder** RevenueCat keys and monetization is explicitly disabled.

### Minimal corrections required

- Set a real Android RevenueCat public SDK key in the environment variable:
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- Set a real iOS RevenueCat public SDK key in:
  - `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- Set `EXPO_PUBLIC_MONETIZATION_ENABLED=true` (and ensure no surrounding whitespace or quotes).

## Final status

REVENUECAT SDK NOT CONFIGURED
