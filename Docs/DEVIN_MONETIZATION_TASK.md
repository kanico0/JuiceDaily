# Devin Task: Implement Juicing Daily Monetization

You are a senior React Native, Expo, mobile-subscription, backend-security, RevenueCat, Apple App Store, and Google Play Billing engineer.

You are working in the existing **Juicing Daily** repository.

The authoritative specification is:

```text
docs/MONETIZATION_IMPLEMENTATION_SPEC.md
```

Read the entire specification before modifying code. Do not rely only on the abbreviated requirements in this task file.

## Objective

Implement Juicing Daily’s production-minded freemium and Pro monetization system for iOS and Android.

At launch:

- iOS purchases use Apple App Store In-App Purchase
- Android purchases use Google Play Billing
- RevenueCat provides one shared `pro` entitlement
- Stripe is not used for mobile subscriptions
- Free users receive 5 completed AI image-recognition scans per quota month
- Pro users receive 60 completed scans per quota month
- Pro Monthly targets $7.99/month in the U.S.
- Pro Annual targets $59.99/year in the U.S.
- Annual subscribers receive 60 scans during each monthly quota window, not 720 upfront
- Manual juice logging remains unlimited
- Scan quotas are enforced by the backend
- Failed technical scans and internal retries do not consume extra credits
- Existing user data remains accessible after cancellation or expiration
- Real purchases are tested in native development builds, not Expo Go

## First action: audit

Before making major changes, inspect:

- Expo and React Native versions
- App identifiers
- Authentication
- Backend and database
- Existing scan endpoint
- Existing billing, Stripe, or RevenueCat code
- State management and navigation
- Environment handling
- Tests and native/EAS build setup
- Privacy Policy and Terms links

Report:

1. Current architecture
2. Subscription and backend infrastructure already present
3. Gaps and security risks
4. Exact files to add
5. Exact files to modify
6. Database and migration plan
7. Phased implementation plan
8. Apple tasks requiring human access
9. Google tasks requiring human access
10. RevenueCat tasks requiring human access

After reporting, continue implementation. Do not stop at the plan.

## Required implementation

Complete all repository-side work possible for:

1. Compatible RevenueCat/Expo setup
2. Stable RevenueCat App User ID integration
3. Centralized subscription service and selectors
4. Store offering retrieval
5. Localized monthly and annual products
6. Juicing Daily Pro paywall
7. Monthly and annual purchases
8. Restore Purchases
9. Manage Subscription
10. CustomerInfo refresh and listener
11. Secure RevenueCat webhook
12. Backend subscription record
13. Server-authoritative scan quota
14. Monthly quota windows
15. Annual synthetic monthly quota windows
16. Idempotent scan reservation and commit
17. Daily abuse and cost limit
18. Centralized Pro feature gating
19. Scan-usage UI and warnings
20. Subscription settings
21. Analytics and operational monitoring
22. Automated tests
23. Apple, Google, and RevenueCat setup guides
24. Manual QA checklist

## Non-negotiable guardrails

- Do not add Stripe checkout to either mobile app
- Do not implement local-only `isPro` authorization
- Do not trust a client-provided scan balance
- Do not expose store, RevenueCat, webhook, or AI-provider secrets
- Do not hardcode displayed prices
- Do not provide unlimited scans
- Do not add trials, lifetime plans, weekly plans, or scan packs
- Do not delete user history after downgrade
- Do not block manual logging
- Do not count failed technical requests as completed scans
- Do not grant duplicate credits from webhook retries
- Do not test native purchases through Expo Go
- Do not claim external console work was completed unless verified

## Implementation process

Work in small phases:

### Phase 0
Audit, run the app and tests, and establish baseline behavior.

### Phase 1
RevenueCat client, identity, offerings, entitlement state, and native development build.

### Phase 2
Paywall, localized products, monthly/annual purchases, restore, and subscription management.

### Phase 3
Backend subscription record, secure webhook, and lifecycle synchronization.

### Phase 4
Quota schema, monthly reset logic, annual monthly windows, reservation/commit, and cost safeguards.

### Phase 5
Feature gating, scan meter, limit messages, settings, and upgrade entry points.

### Phase 6
Automated tests, sandbox/internal testing, security review, documentation, and final QA.

At the end of each phase report:

- Files changed
- Work completed
- Tests run
- Results
- Known risks
- Manual tasks remaining

Use small reviewable commits or clearly labeled checkpoints where repository permissions allow.

## Definition of success

Do not mark the assignment complete until the definition of done in `docs/MONETIZATION_IMPLEMENTATION_SPEC.md` has been checked item by item.

When credentials or external console access are unavailable:

- Complete all code and configuration files possible
- Add safe placeholders for public configuration only
- Never place secrets in source control
- Produce exact human instructions
- Label the work unverified rather than complete

Begin now by reading `docs/MONETIZATION_IMPLEMENTATION_SPEC.md`, auditing the repository, and presenting the file-by-file implementation plan. Then proceed with implementation.
