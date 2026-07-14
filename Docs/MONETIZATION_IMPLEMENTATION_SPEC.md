# Juicing Daily Monetization Implementation Specification

**Status:** Launch specification  
**Product:** Juicing Daily  
**Platforms:** Apple App Store and Google Play  
**Billing:** Apple In-App Purchase on iOS; Google Play Billing on Android  
**Entitlement layer:** RevenueCat, unless the repository already has an equally reliable production system  
**Stripe:** Not used for mobile subscriptions in this launch phase

---

## 1. Purpose

This document is the authoritative product and engineering specification for monetizing Juicing Daily.

The implementation must:

1. Keep the Free plan genuinely useful.
2. Convert engaged users to Juicing Daily Pro.
3. Protect the business from uncontrolled image-recognition API costs.
4. Use Apple and Google’s native subscription systems for mobile purchases.
5. Provide one consistent Pro entitlement across iOS and Android.
6. Enforce scan limits on the server rather than trusting the phone.
7. Preserve user data after cancellation, expiration, or downgrade.
8. Keep manual juice logging available without payment.
9. Avoid dark patterns and misleading “unlimited” claims.
10. Remain maintainable as pricing, quotas, trials, web billing, or new tiers evolve later.

Inspect the existing repository before selecting exact libraries, files, services, or migrations. The codebase is the source of truth for the current architecture.

---

## 2. Launch business model

### 2.1 Juicing Daily Free

**Price:** $0

Includes:

- 5 completed AI image-recognition scans per quota month
- Unlimited manual juice logging
- Basic Glow Streak
- Weekly Momentum
- Basic juice history
- Basic achievements
- Basic reminders
- Access to all previously created records and scan results
- Manual correction after an image scan
- A manual logging option after the scan quota is exhausted

Free users must never lose access to their history because they do not subscribe.

### 2.2 Juicing Daily Pro Monthly

**Target U.S. price:** $7.99 per month

Includes:

- 60 completed AI image-recognition scans per quota month
- Unlimited manual juice logging
- Advanced Weekly Glow Reports
- Advanced consistency and ingredient trends
- Expanded or personalized challenges
- Custom weekly juicing goals
- Ingredient-diversity insights
- Photo history and visual recaps
- Saved juices and one-tap relogging
- Advanced reminder scheduling
- Premium achievements and profile customization
- Cloud backup or cross-device synchronization only if the current account/backend architecture supports it reliably

### 2.3 Juicing Daily Pro Annual

**Target U.S. price:** $59.99 per year

Includes the same Pro features as the monthly plan.

Annual subscribers receive **60 scans per quota month**, not 720 scans immediately. A fresh 60-scan allowance begins on each monthly anniversary inside the annual subscription period.

### 2.4 Not included at launch

Do not implement these unless this specification is later amended:

- Stripe checkout inside the mobile apps
- Website subscriptions
- Weekly subscriptions
- Lifetime subscriptions
- Unlimited scans
- Multiple paid tiers
- Consumable scan packs
- Free trials
- Introductory pricing
- Public leaderboards
- Family plans
- Coach or enterprise plans

Architect the system so these can be added later without rewriting entitlement and quota logic.

---

## 3. Billing and entitlement architecture

### 3.1 Responsibilities

Use:

- Apple App Store In-App Purchase for purchases made inside the iOS app
- Google Play Billing for purchases made inside the Android app
- RevenueCat to normalize store purchases into one app entitlement
- The Juicing Daily backend to authorize paid API usage and enforce scan quotas

RevenueCat is not the payment processor. Apple and Google bill the customer and manage the recurring transaction.

### 3.2 Shared entitlement

Create one RevenueCat entitlement:

```text
pro
```

All four store products activate it:

```text
Apple monthly ─┐
Apple annual ──┤
               ├── RevenueCat entitlement: pro
Google monthly ┤
Google annual ─┘
```

Feature access must depend on the `pro` entitlement, not scattered checks for individual product IDs.

### 3.3 Recommended identifiers

First verify the real iOS bundle ID and Android application ID.

Recommended Apple products:

```text
<BUNDLE_ID>.pro.monthly
<BUNDLE_ID>.pro.annual
```

Recommended Apple subscription group:

```text
Juicing Daily Pro
```

Recommended Google Play subscription:

```text
juicing_daily_pro
```

Recommended Google base plans:

```text
monthly
annual
```

Recommended RevenueCat configuration:

```text
Entitlement: pro
Offering: default
Monthly package: $rc_monthly
Annual package: $rc_annual
```

Do not use placeholder identifiers in production without verifying the repository and store consoles.

### 3.4 Localized pricing

Target U.S. prices:

```text
Monthly: $7.99
Annual: $59.99
```

Do not hardcode displayed prices, currencies, billing periods, or savings percentages. Display localized store metadata returned through RevenueCat. Calculate any displayed annual savings from the localized monthly and annual prices.

### 3.5 Sources of truth

Use these layers deliberately:

1. Apple/Google: financial transaction source of truth
2. RevenueCat: normalized subscription and entitlement source of truth
3. Backend subscription record: server authorization cache and audit record
4. Mobile cache: responsive display only

Never authorize a paid API request from a permanent local boolean such as `isPro = true`.

---

## 4. Repository audit before implementation

Before editing code, inspect and report:

- `package.json` and lockfile
- Expo SDK and React Native version
- App and EAS configuration
- iOS bundle ID and Android package ID
- Navigation and state management
- Authentication and immutable user IDs
- Backend and database
- Existing image-recognition endpoint and image storage
- Existing API-cost controls
- Existing Stripe, RevenueCat, or billing code
- Analytics and error reporting
- Feature flags
- Existing Free/Pro logic and scan counters
- Paywall and subscription settings
- Privacy policy and Terms of Use links
- User account deletion flow
- Test framework and CI/CD
- Whether the app currently runs only in Expo Go

The first implementation report must include:

1. Audit summary
2. Existing architecture
3. Risks and technical debt
4. Exact files to add
5. Exact files to modify
6. Database changes
7. Migration plan
8. Backend changes
9. Apple tasks requiring human access
10. Google tasks requiring human access
11. RevenueCat tasks requiring human access
12. Phased implementation plan

Continue implementation after the report. Do not stop at recommendations.

---

## 5. Expo and native build requirement

In-app purchases require native modules. Do not test real mobile billing in Expo Go.

Configure and use an Expo development build, EAS development build, or the repository’s established native build workflow.

Requirements:

- Verify RevenueCat SDK compatibility with the installed Expo and React Native versions
- Use a current stable compatible SDK rather than blindly installing the newest release
- Add required native configuration
- Separate sandbox/development and production configuration
- Document exact build and test commands
- Verify iOS and Android independently
- Never expose secret keys in the app bundle

---

## 6. User identity

### 6.1 Existing authenticated accounts

If accounts already exist:

- Use the backend’s immutable user UUID as the RevenueCat App User ID
- Do not use a changeable email address as the primary identifier
- Associate RevenueCat after the authenticated user is known
- Handle login, logout, and account switching safely
- Refresh entitlement and quota data after login
- Clear account-specific cached state on logout
- Prevent one account’s subscription state from leaking into another

### 6.2 No current account system

If there is no account system, report the limitations for:

- Cross-device quotas
- Cross-platform identity
- Reliable restoration
- Reinstall abuse
- Server-authoritative usage
- Account deletion

Implement the smallest secure identity solution compatible with the existing architecture. Do not implement a client-only quota system. A stable authenticated user is required before invoking a paid image-recognition API in production.

---

## 7. Client subscription architecture

Create or adapt a centralized module using repository conventions.

Suggested structure:

```text
src/services/subscriptions/
  subscriptionConfig.ts
  subscriptionTypes.ts
  revenueCatClient.ts
  subscriptionService.ts
  subscriptionSelectors.ts
  subscriptionAnalytics.ts
```

Provide a centralized state model similar to:

```ts
type SubscriptionState = {
  initialized: boolean;
  loading: boolean;
  isProActive: boolean;
  currentPlan: "free" | "pro_monthly" | "pro_annual";
  source: "app_store" | "play_store" | "promotional" | null;
  productId: string | null;
  expirationDate: string | null;
  willRenew: boolean | null;
  isInGracePeriod: boolean;
  managementUrl: string | null;
  lastUpdatedAt: string | null;
  error: string | null;
};
```

Required operations:

- Initialize RevenueCat
- Associate a stable App User ID
- Fetch offerings and localized packages
- Purchase monthly or annual
- Restore purchases
- Refresh CustomerInfo
- Listen for CustomerInfo updates
- Determine whether `pro` is active
- Retrieve a management URL where supported
- Handle login, logout, and account switching
- Handle sandbox and production configuration
- Handle unavailable offerings, networks, pending purchases, and cancellation
- Prevent duplicate purchase taps

Only RevenueCat public SDK keys may exist in the mobile app.

Never include Apple shared secrets, Google service-account credentials, RevenueCat secret keys, webhook secrets, or image-recognition API keys in the client.

---

## 8. Paywall

Create a polished paywall that matches Juicing Daily’s design system.

Suggested headline:

> Build Your Juicing Habit with Pro

Suggested supporting copy:

> Scan your juices faster, understand your progress, and stay motivated with deeper reports, personalized challenges, and monthly insights.

### Free comparison

- 5 AI scans per quota month
- Unlimited manual logging
- Basic Glow Streak
- Weekly Momentum
- Basic progress history

### Pro comparison

- 60 AI scans per quota month
- Advanced Glow Reports
- Ingredient and consistency trends
- Personalized challenges
- Custom goals
- Photo recaps
- Advanced reminders
- Premium achievements

Display monthly and annual localized packages. The annual option may show “Best Value.” Calculate savings from localized prices.

Clearly state:

> 60 image-recognition scans per quota month.

Also state:

> Unused scans do not roll over. Manual logging remains unlimited.

Required paywall elements:

- Localized price and billing period
- Auto-renewal disclosure
- Restore Purchases
- Terms of Use
- Privacy Policy
- Close or continue-free option
- Accessible labels
- Loading, unavailable, cancelled, error, and success states
- Double-tap protection

Do not use countdown timers, fake scarcity, hidden close controls, “unlimited scans,” misleading trial language, a Stripe form, or hardcoded prices.

---

## 9. Purchase flow

Implement this flow:

1. Initialize the subscription service.
2. Retrieve the active RevenueCat offering.
3. Display monthly and annual packages from store metadata.
4. Let the user select a package.
5. Disable duplicate purchase attempts.
6. Initiate the Apple or Google purchase through RevenueCat.
7. Retrieve updated CustomerInfo.
8. Confirm that the `pro` entitlement is active.
9. Synchronize entitlement status with the backend.
10. Recalculate or refresh the scan quota.
11. Update the UI immediately.
12. Display a tasteful Pro activation confirmation.
13. Record non-sensitive analytics.

Do not unlock Pro merely because a purchase method returned without throwing an error. Confirm the active `pro` entitlement first.

Handle:

- Successful purchase
- User cancellation
- Pending purchase
- Product or store unavailable
- Network failure
- Already-owned product
- Billing issue or grace period
- Refund or revocation
- Expiration
- Auto-renew disabled while paid access remains active
- Account transfer according to the chosen RevenueCat policy

Turning off renewal must not immediately remove access. Access continues until the entitlement expires.

---

## 10. Restore and manage subscription

Provide **Restore Purchases** in the paywall and subscription/account settings.

After a restore attempt:

- Refresh RevenueCat CustomerInfo
- Refresh backend subscription state
- Refresh the scan quota
- Show success, no-purchase-found, or failure feedback

Provide **Manage Subscription** using the management URL supplied by the active platform or RevenueCat where compatible.

Clearly display either:

- “Your subscription is managed through Apple.”
- “Your subscription is managed through Google Play.”

Do not display Stripe as a billing source in this launch.

---

## 11. Backend subscription record

Use the existing backend and database where suitable.

Suggested normalized record:

```ts
type SubscriptionRecord = {
  userId: string;
  entitlement: "pro";
  isActive: boolean;
  store: "app_store" | "play_store" | "promotional";
  plan: "pro_monthly" | "pro_annual" | null;
  productId: string | null;
  originalTransactionId: string | null;
  purchaseDate: string | null;
  expirationDate: string | null;
  willRenew: boolean | null;
  billingIssueDetectedAt: string | null;
  environment: "sandbox" | "production";
  lastRevenueCatEventId: string | null;
  updatedAt: string;
};
```

Adapt the schema to the current database while retaining these concepts. The backend record is an authorization cache and audit trail; RevenueCat remains the normalized entitlement source of truth.

---

## 12. RevenueCat webhook

Implement a secure RevenueCat webhook endpoint.

Requirements:

- Authenticate webhook requests
- Keep the authorization secret server-side
- Reject unauthorized requests
- Use event IDs for idempotency
- Safely handle retries
- Log failures without exposing secrets
- Separate sandbox and production events
- Map events to the stable App User ID
- Record processing status and time
- Update subscription state transactionally where practical
- Trigger quota transitions safely
- Never grant duplicate quota because an event was retried

Handle applicable events including:

- Initial purchase
- Renewal
- Cancellation
- Uncancellation
- Expiration
- Billing issue
- Product change
- Refund or revocation
- Transfer
- Promotional entitlement if intentionally supported

Rules:

- Cancellation normally means renewal was disabled; it does not necessarily mean access ended
- Preserve access until actual entitlement expiration
- Revoke Pro access when the entitlement is no longer active
- Reflect refunds and revocations promptly
- Respect grace-period state
- Never delete user data on expiration

---

## 13. Server-authoritative scan quota

All scan authorization and usage must be enforced by the backend. The client may display a cached balance but must not decide whether the paid recognition request is allowed.

### 13.1 Limits

```text
Free: 5 completed scans per quota month
Pro: 60 completed scans per quota month
```

Add a configurable cost and abuse safeguard:

```text
Pro daily safety limit: 10 completed scans per server day
```

The daily limit is not a marketed plan benefit. Keep it server-configurable without an app release.

### 13.2 Quota windows

Use explicit server-side windows.

**Pro Monthly**

- Anchor to the subscription billing date where reliable
- Advance one month at a time
- Clamp end-of-month anchors consistently

**Pro Annual**

- Anchor to the annual purchase date
- Create synthetic monthly anniversaries during the annual term
- Grant 60 scans in each monthly window
- Never grant 720 upfront

**Free**

- Use a stable account-specific monthly anchor, such as account creation or first quota activation
- Do not permit reinstalling or changing device time to create a reset
- Store exact start and end timestamps

The server must lazily advance expired windows when quota is requested or a scan begins. Do not depend only on a scheduled midnight job. Use the server clock.

Suggested model:

```ts
type ScanQuota = {
  userId: string;
  plan: "free" | "pro";
  periodStart: string;
  periodEnd: string;
  limit: number;
  used: number;
  reserved: number;
  dailyUsed: number;
  dailyPeriodStart: string;
  anchorDay: number | null;
  updatedAt: string;
};
```

Prefer deriving:

```text
remaining = max(0, limit - used - reserved)
```

### 13.3 Upgrade behavior

When a Free user upgrades during an active window:

- Change the current limit from 5 to 60
- Preserve scans already used
- Do not add 60 on top of the previous allowance

Example:

```text
Free scans used: 5
New Pro limit: 60
Remaining after upgrade: 55
```

### 13.4 Expiration and downgrade

When Pro ends:

- Preserve all data
- Disable new Pro-only actions
- Continue unlimited manual logging
- Move scan authorization to Free
- If five or more scans were already used during the overlapping Free window, remaining Free scans are zero until the next Free window
- Do not reset quota merely because Pro expired

### 13.5 Renewal and idempotency

Renewals and webhook retries must not create duplicate windows or allowances. All transitions must be idempotent.

---

## 14. Scan reservation and commit

Protect against concurrent requests, retries, double taps, and technical failures.

Use this workflow:

1. Authenticate the user.
2. Validate request and image metadata.
3. Accept or generate an idempotency key.
4. Resolve subscription entitlement.
5. Resolve or advance the quota window.
6. Check monthly quota.
7. Check daily safety limit.
8. Atomically reserve one scan.
9. Run image recognition.
10. Commit after a completed usable result.
11. Release after a technical failure.
12. Return structured results and updated quota.

Suggested usage record:

```ts
type ScanUsageEvent = {
  id: string;
  requestId: string;
  userId: string;
  imageHash: string | null;
  planAtTimeOfScan: "free" | "pro";
  status: "reserved" | "committed" | "released" | "failed";
  quotaPeriodStart: string;
  provider: string | null;
  estimatedProviderCost: number | null;
  failureCategory: string | null;
  createdAt: string;
  completedAt: string | null;
};
```

Count one scan when:

- The pipeline completes and returns a usable structured result
- The user later edits detected ingredients
- The user disagrees with part of a completed result
- The backend internally retries the same request but returns one final result

Do not count when:

- Authentication fails
- Upload never reaches the server
- The file is rejected before inference
- The server or provider has a technical failure
- The provider times out
- The same idempotency key is replayed
- Processing never completes and the reservation is released

An internal retry must not consume another user credit.

### 14.1 Cost controls

Implement or preserve:

- Client-side image resizing and compression
- Server-side file-size and dimension limits
- Image-quality preflight where practical
- At most one automatic provider retry unless justified
- Concise structured model output
- Image hashing for accidental duplicate detection
- Provider timeout
- Per-user rate limits
- Global spend or circuit-breaker controls where supported
- Cost logging or estimation per request
- Abnormal-usage alerts
- Configuration-driven Free, Pro, and daily limits

Never expose the recognition provider’s API key to the app.

---

## 15. Quota user experience

Display calm, transparent usage text, for example:

```text
3 of 5 free scans used this month
42 of 60 Pro scans remaining
```

Warn at:

- Free: 2 remaining
- Free: 1 remaining
- Pro: 10 remaining
- Pro: 5 remaining
- Quota exhausted

At the Free limit:

> You’ve used your five free scans for this period. Upgrade to Pro for 60 scans per quota month, or continue logging manually for free.

Actions:

- Upgrade to Pro
- Log Manually
- View Plan

At the Pro limit:

> You’ve used your 60 Pro scans for this period. Your scans refresh on [localized date]. Manual logging is still available.

Actions:

- Log Manually
- View Scan Usage

Do not offer scan packs at launch and never block manual logging.

---

## 16. Centralized feature gating

Create a central feature-access service.

```ts
type FeatureKey =
  | "ai_scan"
  | "advanced_weekly_report"
  | "advanced_trends"
  | "personalized_challenges"
  | "custom_weekly_goals"
  | "photo_recaps"
  | "advanced_reminders"
  | "premium_achievements";
```

Provide a consistent method such as:

```ts
canAccessFeature(entitlements, featureKey)
```

Do not scatter logic such as `plan === "monthly" || plan === "annual"`. Both are Pro.

When Pro expires:

- Preserve history, earned achievements, scan results, and user-created data
- Disable new Pro-only actions where necessary
- Prefer read-only access to personal data rather than hiding or deleting it

---

## 17. Subscription settings

Create or update a section containing:

- Current plan
- Free or Pro status
- Monthly or annual period
- Billing store
- Renewal or expiration date
- Scan allowance
- Scans used and remaining
- Next scan refresh date
- Manage Subscription
- Restore Purchases
- Terms of Use
- Privacy Policy

Do not expose receipts, transaction IDs, RevenueCat internal IDs, webhook IDs, or secrets.

---

## 18. Analytics and monitoring

Use the existing analytics provider. If none exists, create a provider-agnostic interface and development logger.

Track:

```text
paywall_viewed
paywall_dismissed
subscription_package_selected
subscription_purchase_started
subscription_purchase_succeeded
subscription_purchase_cancelled
subscription_purchase_failed
subscription_restore_started
subscription_restore_succeeded
subscription_restore_failed
pro_entitlement_activated
pro_entitlement_expired
billing_issue_detected
scan_quota_viewed
scan_quota_warning_shown
scan_quota_reached
scan_blocked_monthly_limit
scan_blocked_daily_limit
manual_log_selected_after_scan_limit
upgrade_started_from_scan_limit
upgrade_completed_from_scan_limit
```

Useful non-sensitive properties:

- Platform
- Package type
- Paywall source
- Scans used and remaining
- App version
- Environment

Do not log payment credentials, full receipts, secrets, raw images, private notes, or sensitive full model payloads.

Add operational monitoring for:

- Webhook failures
- Quota transaction failures
- Recognition provider errors
- Average cost per completed scan
- 95th-percentile scans per Pro user
- Users hitting daily and monthly limits
- Free-limit-to-Pro conversion
- Refund and cancellation rates

---

## 19. Security

- Authenticate backend endpoints
- Use stable immutable user IDs
- Validate every scan server-side
- Enforce quotas atomically
- Use idempotency keys
- Rate-limit sensitive endpoints
- Validate webhook authorization
- Isolate sandbox and production
- Use server time
- Never trust client `isPro` or `scansRemaining`
- Keep secrets server-side
- Do not commit `.env` or credentials
- Prevent cross-account leakage
- Sanitize logs
- Apply least privilege
- Document secret rotation and webhook replay handling
- Document account deletion effects on RevenueCat identity and internal records

---

## 20. Testing

Use the existing test framework where possible.

### 20.1 Subscription tests

Test:

- Free, monthly Pro, and annual Pro states
- Active and expired entitlement
- Auto-renew disabled with remaining access
- Grace period and billing issue
- Refund or revocation
- Restore success and failure
- Account switching
- Empty offering and store unavailable
- User-cancelled and successful purchase
- Duplicate purchase callback
- Backend synchronization failure and recovery

### 20.2 Quota tests

Test:

- Free scans 1 through 5; sixth blocked
- Pro scans 1 through 60; sixty-first blocked
- Daily Pro safety limit
- Free-to-Pro upgrade
- Pro-to-Free downgrade
- Monthly renewal
- Annual monthly quota refresh
- End-of-month anchor
- Leap year and year boundary
- Concurrent requests
- Duplicate idempotency key
- Internal retry
- Failed request releases reservation
- Successful request commits reservation
- Device clock changes have no effect
- Webhook retry and duplicate event
- Sandbox/production isolation

### 20.3 UI tests

Test:

- Localized prices
- Loading and unavailable states
- Paywall close
- Purchase cancellation and success
- Restore flow
- Scan warnings and exhaustion
- Manual logging remains accessible
- Immediate Pro UI update
- Expiration/downgrade UI
- Accessibility labels
- Reduced motion where applicable

### 20.4 Manual platform tests

Document and perform as credentials permit:

- Apple sandbox monthly and annual purchase
- Apple restore and cancellation/renewal simulation
- TestFlight validation
- Google license-tester monthly and annual purchase
- Google restore and cancellation/renewal simulation
- Internal testing-track validation
- RevenueCat customer and entitlement verification
- Webhook verification
- Monthly quota refresh verification

Do not claim a test passed unless it was performed.

---

## 21. Human configuration checklists

### Apple App Store Connect

Document exact steps for:

- Paid Applications agreement
- Banking and tax setup
- Subscription group
- Monthly and annual products
- Product localization and pricing
- Review notes and screenshot
- Terms and Privacy Policy
- App privacy details
- Sandbox testers
- TestFlight
- Product submission and approval

### Google Play Console

Document exact steps for:

- Merchant/payments setup
- Subscription product
- Monthly and annual base plans
- Regional pricing and descriptions
- License testers
- Internal testing track
- Test purchases and acknowledgement
- Grace period/account hold where used
- Production activation

### RevenueCat

Document exact steps for:

- Project and app creation
- Store credential connections
- Product import
- `pro` entitlement
- Product-to-entitlement mapping
- `default` offering
- Monthly and annual packages
- Public SDK keys
- Sandbox and production testing
- Webhook URL and authorization
- Customer record and purchase/restore verification

Never request that secrets be pasted into source code or chat.

---

## 22. Implementation phases

### Phase 0 — Audit and baseline

- Inspect repository
- Run app and tests
- Identify account/backend gaps
- Record current scan behavior
- Produce exact plan

### Phase 1 — Subscription foundation

- Add compatible RevenueCat SDK
- Configure native development build
- Add public environment keys
- Add identity handling
- Add centralized subscription service
- Add offering retrieval and entitlement state

### Phase 2 — Paywall and purchases

- Build paywall
- Display localized products
- Purchase monthly and annual
- Restore purchases
- Manage subscription
- Handle errors, cancellation, and pending state

### Phase 3 — Backend synchronization

- Add subscription record
- Add secure webhook
- Add idempotency
- Handle subscription lifecycle
- Isolate sandbox and production

### Phase 4 — Scan quotas

- Add quota schema and windows
- Add annual monthly windows
- Add reservation and commit
- Add daily safeguard and cost controls
- Add quota endpoint

### Phase 5 — Feature gating and UX

- Centralize Pro access
- Connect Pro features
- Add scan meter and warnings
- Add upgrade entry points
- Preserve Free fallbacks
- Add subscription settings

### Phase 6 — Testing and release preparation

- Automated tests
- Development-build verification
- Sandbox/internal testing
- Security review
- Console guides
- Final QA and documentation

Use small reviewable commits or clearly labeled checkpoints.

---

## 23. Required deliverables

Deliver:

1. Audit report
2. Architecture decisions
3. Exact file map
4. Database migration
5. RevenueCat client integration
6. iOS and Android purchase flows
7. Paywall
8. Restore and management flows
9. Secure webhook
10. Backend subscription record
11. Server-authoritative quota service
12. Reservation-and-commit accounting
13. Central feature gating
14. Subscription settings
15. Analytics and monitoring
16. Automated tests
17. Apple setup guide
18. Google setup guide
19. RevenueCat setup guide
20. Manual QA checklist
21. Known limitations
22. Deferred improvements
23. Rollback or disable strategy

At the end of each phase report files changed, work completed, tests and results, risks, and human tasks remaining.

---

## 24. Definition of done

The launch implementation is complete only when:

- Apple purchases use Apple In-App Purchase
- Android purchases use Google Play Billing
- No Stripe subscription form appears in the mobile apps
- Monthly and annual products activate one `pro` entitlement
- Store-localized prices are displayed
- Monthly and annual sandbox purchases are verified where credentials permit
- Restore Purchases and Manage Subscription work
- Disabling renewal does not revoke access early
- Expiration removes Pro creation access correctly
- Free users receive 5 scans per quota month
- Pro users receive 60 scans per quota month
- Annual users receive 60 monthly, not 720 upfront
- Quota windows advance correctly
- Technical failures and internal retries do not consume extra credits
- Concurrent scans cannot overspend quota
- Quotas are server-enforced
- Recognition credentials stay server-side
- Free manual logging remains unlimited
- Existing history remains accessible
- Subscription and quota logic has automated tests
- Native development builds are used
- Human console tasks are documented
- No secrets are committed
- The implementation can be disabled or rolled back safely
- Code follows the repository’s architecture and is maintainable

---

## 25. Working rules

- Inspect before assuming
- Treat this document as authoritative
- Preserve the current architecture where reasonable
- Do not rewrite the whole app
- Do not add Stripe mobile subscriptions
- Do not add unlimited scans, trials, or scan packs
- Do not trust client subscription or quota state for authorization
- Do not hardcode localized prices
- Do not delete user data after expiration
- Do not count technical failures as completed scans
- Do not stop after producing a plan
- Complete all repository-side work possible
- Distinguish completed work from human console tasks
- Never claim external configuration or testing was completed without verification

---

## 26. Official references to verify during implementation

Store rules and SDK behavior can change. Verify the latest official documentation before finalizing platform-specific details:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play subscriptions: https://support.google.com/googleplay/android-developer/answer/12154973
- Expo in-app purchases: https://docs.expo.dev/guides/in-app-purchases/
- RevenueCat Expo installation: https://www.revenuecat.com/docs/getting-started/installation/expo
- RevenueCat CustomerInfo: https://www.revenuecat.com/docs/customers/customer-info
- RevenueCat customer identity: https://www.revenuecat.com/docs/customers/identifying-customers
- RevenueCat webhooks: https://www.revenuecat.com/docs/integrations/webhooks
- RevenueCat subscription management: https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions
