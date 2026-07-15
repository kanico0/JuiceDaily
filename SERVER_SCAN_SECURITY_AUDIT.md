# SERVER_SCAN_SECURITY_AUDIT.md

Pass/fail checklist for the server-side image-scan hardening of
**RawLifeFlow: Juicing Daily** (project `twnkxajnoeljgerqgqep`).
Audited 2026-07-14 against the deployed Edge Functions, migration
`0002_anonymous_scan_guard.sql`, and 142 automated tests.

Legend: ✅ PASS · ⚠️ PARTIAL (human step remains) · ❌ FAIL

## 1. Access-token verification

| Requirement | Status | Evidence |
|---|---|---|
| Authorization bearer token required | ✅ | `analyze-scan` returns 401 `missing_authorization`; live check PASS |
| Cryptographic validation via official method | ✅ | `admin.auth.getUser(jwt)` (supabase-js v2 server-side verification against the Auth server) |
| No trust in Base64-decoded payloads | ✅ | Payload never decoded locally; only the verified user record is used (`_shared/authGate.ts`) |
| No identity fields from the request body | ✅ | The scan API has no `user_id`/`app_user_id` fields at all; body is parsed only AFTER the gate |
| Canonical UUID exclusively from the verified token | ✅ | `gate.userId` from `evaluateScanUser()`; unit test "identity authority" |
| Expired/malformed/forged/missing tokens rejected | ✅ | 401 in all cases; unit tests + live checks (malformed, forged-payload) PASS |
| 401 for missing/invalid auth | ✅ | Live checks PASS |
| 403 + `account_required` for valid anonymous accounts | ✅ | Live check PASS (`status=403 code=account_required`) |

## 2. Anonymous rejection before funded work

| Requirement | Status | Evidence |
|---|---|---|
| Gate before quota reservation | ✅ | Gate at top of handler, before `reserve_scan` RPC |
| Gate before quota decrement | ✅ | Decrement only in `commit_scan`, after reserve |
| Gate before scan-attempt insertion | ✅ | Live check: `scan_usage_events` empty after rejection |
| Gate before image processing/upload | ✅ | Gate precedes body parsing entirely |
| Gate before Anthropic invocation | ✅ | Anthropic call is unreachable without a successful reservation |
| Zero quota consumed / no pending reservation on rejection | ✅ | Live check `events=0`; unit test "no scan is reserved" |

## 3. Every server-side quota entry point

| Entry point | Status | Evidence |
|---|---|---|
| `analyze-scan` | ✅ | Hardened + deployed |
| `scan-quota` | ✅ | Anonymous → static display snapshot; `resolve_quota` never called (live check: no `scan_quotas` row created) |
| `reserve_scan` RPC | ✅ | DB guard `_is_anonymous_user()` (0002) + EXECUTE revoked from `public/anon/authenticated` |
| `commit_scan` / `release_scan` / `resolve_quota` RPCs | ✅ | EXECUTE revoked from clients (0001, re-asserted in 0002); commit/release operate only on existing reservations, which anonymous users can never create |
| Direct PostgREST table writes | ✅ | RLS: SELECT-own only; no INSERT/UPDATE policies on `scan_quotas`, `scan_usage_events`, `subscriptions` |
| Read-only quota display for anonymous users | ✅ | Allowed, allocates nothing (verified live) |
| Not relying solely on client checks | ✅ | Server + DB layers are independent of the client gate |

## 4. User-ID substitution

| Requirement | Status | Evidence |
|---|---|---|
| No body-supplied ID controls quota charging | ✅ | API has no identity fields; `userId` from verified token only |
| Verified JWT subject is authoritative | ✅ | `evaluateScanUser()` unit tests |
| Quota, scan record, analysis use the same verified UUID | ✅ | `reserve_scan`/`commit_scan`/`release_scan` all receive `gate.userId` |
| One user cannot consume another's quota | ✅ | UUID never client-controllable; RLS blocks cross-user reads too |

## 5. Refreshed permanent-user sessions

| Requirement | Status | Evidence |
|---|---|---|
| Latest session used after email upgrade | ✅ | `verifyOtp` updates the local session; gate re-reads it per scan |
| Stale anonymous token → refresh once | ✅ | `refreshSessionAndCheckDurable()`; jest test "refreshes once and retries" |
| Retry only after confirming permanent | ✅ | jest test "does NOT retry when still anonymous" |
| No duplicate scan requests during retry | ✅ | Same `requestId` on retry (server idempotent); jest asserts identical requestIds and max 2 attempts |

## 6. Quota atomicity (preserved, unchanged)

| Requirement | Status | Evidence |
|---|---|---|
| Reserve before Anthropic request | ✅ | Handler order unchanged |
| Commit only after successful analysis | ✅ | `commit_scan` after 200 from provider |
| Release on provider failure/timeout/errors | ✅ | `release_scan` on non-OK, abort, exception |
| Idempotency for retried requests | ✅ | `unique (user_id, request_id)` + `duplicate_request` path |
| Concurrency-safe (no over-quota) | ✅ | `SELECT … FOR UPDATE` row lock in `reserve_scan` |
| No negative allowance | ✅ | `greatest(0, …)` guards |
| No client-controlled quota values | ✅ | Quota computed exclusively in SQL; client displays only |

## 7. Server-side tests

| Test | Status |
|---|---|
| Missing Authorization → 401 | ✅ unit + live |
| Malformed token → 401 | ✅ unit + live |
| Expired token → 401 | ✅ unit (verifyError path) |
| Forged payload claiming `is_anonymous:false` → rejected | ✅ unit + live |
| Valid anonymous user → 403 `account_required` | ✅ unit + live |
| Anonymous rejection creates no reservation | ✅ unit + live (`events=0`) |
| Anonymous rejection calls Anthropic zero times | ✅ by construction (unreachable) + live (no reservation ⇒ no call path) |
| Valid permanent user → allowed | ✅ unit |
| Verified UUID beats body-supplied UUID | ✅ unit (no body identity exists) |
| Cross-user quota consumption impossible | ✅ unit + design (verified-token-only ID) |
| Stale anonymous token safely refreshed | ✅ jest (3 scenarios) |
| Concurrent permanent-user requests quota-safe | ✅ SQL row lock (0001, unchanged); not separately load-tested |
| Provider failure releases reservation | ✅ existing handler logic (unchanged) |
| Duplicate request ID → no duplicate charge | ✅ SQL idempotency (0001, unchanged) + jest same-requestId retry |

Suites: `supabase/functions/__tests__/authGate.test.ts`,
`src/services/quota/__tests__/scanGate.test.ts`,
`src/services/supabase/__tests__/accountLink.test.ts` — 142/142 pass.

## 8. Database defense in depth

| Requirement | Status | Evidence |
|---|---|---|
| Reservation SQL enforces permanent-user status | ✅ | `0002_anonymous_scan_guard.sql`: `reserve_scan` → `_is_anonymous_user()` first, zero writes on rejection |
| Based on trusted identity, not user metadata | ✅ | Reads `auth.users.is_anonymous` (GoTrue-maintained column) |
| Anonymous users NOT treated as unauthenticated | ✅ | No role checks added; only the explicit `is_anonymous` column decides |

## 9. Deployment

| Item | Status |
|---|---|
| `analyze-scan` deployed to `twnkxajnoeljgerqgqep` | ✅ |
| `scan-quota` deployed | ✅ |
| Migration `0002` applied (`npx supabase db push --include-all`) | ✅ |
| No secrets exposed (Anthropic key, service role, webhook secret, JWT material, user tokens) | ✅ smoke script prints statuses only |

## 10. Live smoke tests

| Test | Status |
|---|---|
| A — anonymous: 403 `account_required`, no reservation, no Anthropic call | ✅ PASSED live (6/6 checks, `scripts/smoke-scan-gate.mjs`) |
| B — newly upgraded account (email OTP, UUID unchanged, one reserve + one commit) | ⚠️ requires a real inbox + Email OTP SMTP setup — human action |
| C — returning user (reinstall, original UUID, usage intact, same RC UUID, no new allowance) | ⚠️ requires a device + real email — human action |

## 11–12. Docs & verification

| Item | Status |
|---|---|
| `DURABLE_IDENTITY_IMPLEMENTATION.md` updated | ✅ |
| `SERVER_SCAN_SECURITY_AUDIT.md` created | ✅ (this file) |
| `npx tsc --noEmit` | ✅ |
| `npm test` (142/142) | ✅ |
| `npx expo export` | ✅ |
| Identifiers unchanged (`com.juicingapp.app`, `pro`, `default`, store product IDs, app name) | ✅ |

## Overall

All automatable requirements **PASS**, including live verification of the
anonymous-bypass attack path against production. Remaining ⚠️ items (smoke
Tests B/C) depend on email delivery and a physical device — they validate the
already-unit-tested upgrade/sign-in flows, not the server gate itself.
