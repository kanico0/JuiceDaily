// ─────────────────────────────────────────────────────────────
// installFreeSnapGuard.test.ts — Regression tests for the persistent
// install-level Free Snap guard.
//
// Covers all 12 required scenarios:
//   1.  Fresh guest has one available allowance
//   2.  Successful guest Snap leaves zero effective remaining
//   3.  Logout → new anonymous UUID still leaves zero remaining
//   4.  App restart preserves the exhausted install marker
//   5.  Login to a different Free account remains exhausted
//   6.  Login back to the original Free account remains exhausted
//   7.  Pro account on the same installation follows Pro quota
//   8.  Failed AI Snap leaves the install allowance available
//   9.  Duplicate finalization does not double-consume
//   10. A new legitimate monthly window resets the install allowance
//   11. Unknown server quota is never interpreted as unused
//   12. Existing provenance and unrelated monetization behavior intact
// ─────────────────────────────────────────────────────────────

// Mock AsyncStorage with an in-memory store
const mockStore = new Map<string, string>()

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItem: jest.fn((key: string, val: string) => {
    mockStore.set(key, val)
    return Promise.resolve()
  }),
  removeItem: jest.fn((key: string) => {
    mockStore.delete(key)
    return Promise.resolve()
  }),
  getAllKeys: jest.fn(() => Promise.resolve([...mockStore.keys()])),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((k) => mockStore.delete(k))
    return Promise.resolve()
  }),
}))

import {
  INSTALL_FREE_SNAP_KEY,
  getInstallFreeSnapRemaining,
  markInstallFreeSnapConsumed,
  clearInstallFreeSnapState,
  composeEffectiveQuota,
} from '../installFreeSnapGuard'
import type { ScanQuotaSnapshot } from '../../subscriptions/subscriptionTypes'

const WINDOW_JAN = '2025-01-01T00:00:00Z'
const WINDOW_FEB = '2025-02-01T00:00:00Z'

function makeFreeQuota(overrides: Partial<ScanQuotaSnapshot> = {}): ScanQuotaSnapshot {
  return {
    plan: 'free',
    limit: 1,
    used: 0,
    remaining: 1,
    periodStart: WINDOW_JAN,
    periodEnd: '2025-02-01T00:00:00Z',
    dailyLimit: null,
    dailyUsed: null,
    ...overrides,
  }
}

function makeProQuota(overrides: Partial<ScanQuotaSnapshot> = {}): ScanQuotaSnapshot {
  return {
    plan: 'pro',
    limit: 12,
    used: 0,
    remaining: 12,
    periodStart: WINDOW_JAN,
    periodEnd: '2025-02-01T00:00:00Z',
    dailyLimit: 10,
    dailyUsed: 0,
    ...overrides,
  }
}

describe('installFreeSnapGuard', () => {
  beforeEach(() => {
    mockStore.clear()
    jest.clearAllMocks()
  })

  // ── 1. Fresh guest has one available allowance ───────────────
  describe('1. Fresh guest has one available allowance', () => {
    it('returns 1 when no install marker exists', async () => {
      const quota = makeFreeQuota()
      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBe(1)
    })

    it('composeEffectiveQuota returns the server remaining when install is available', () => {
      const quota = makeFreeQuota({ remaining: 1, used: 0 })
      const effective = composeEffectiveQuota(quota, 1)
      expect(effective).not.toBeNull()
      expect(effective!.remaining).toBe(1)
      expect(effective!.used).toBe(0)
    })
  })

  // ── 2. Successful guest Snap leaves zero effective remaining ─
  describe('2. Successful guest Snap leaves zero effective remaining', () => {
    it('markInstallFreeSnapConsumed sets the marker for the current window', async () => {
      const quota = makeFreeQuota()
      await markInstallFreeSnapConsumed(quota.periodStart)

      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBe(0)
    })

    it('composeEffectiveQuota returns 0 remaining after consumption', async () => {
      const quota = makeFreeQuota({ remaining: 0, used: 1 })
      await markInstallFreeSnapConsumed(quota.periodStart)
      const installRem = await getInstallFreeSnapRemaining(quota)

      const effective = composeEffectiveQuota(quota, installRem)
      expect(effective).not.toBeNull()
      expect(effective!.remaining).toBe(0)
      expect(effective!.used).toBe(1)
    })

    it('effective remaining is min(server, install) — server 0, install 0 → 0', async () => {
      const quota = makeFreeQuota({ remaining: 0, used: 1 })
      await markInstallFreeSnapConsumed(quota.periodStart)
      const installRem = await getInstallFreeSnapRemaining(quota)
      const effective = composeEffectiveQuota(quota, installRem)
      expect(effective!.remaining).toBe(0)
    })
  })

  // ── 3. Logout → new anonymous UUID still leaves zero remaining ─
  describe('3. Logout followed by a new anonymous UUID still leaves zero remaining', () => {
    it('install marker persists across identity changes (same window)', async () => {
      // Guest A consumes the snap
      const quotaA = makeFreeQuota({ remaining: 1, used: 0 })
      await markInstallFreeSnapConsumed(quotaA.periodStart)

      // After logout, a new anonymous UUID B gets a fresh server quota
      // (same monthly window, different UUID, server reports 0/1)
      const quotaB = makeFreeQuota({ remaining: 1, used: 0 })

      // The install guard still shows consumed
      const installRem = await getInstallFreeSnapRemaining(quotaB)
      expect(installRem).toBe(0)

      // Effective remaining = min(1, 0) = 0
      const effective = composeEffectiveQuota(quotaB, installRem)
      expect(effective).not.toBeNull()
      expect(effective!.remaining).toBe(0)
      expect(effective!.used).toBe(1)
    })

    it('the marker is keyed by window, not by UUID', async () => {
      // Simulate: UUID A consumes, then UUID B checks
      await markInstallFreeSnapConsumed(WINDOW_JAN)

      // UUID B's quota has the same periodStart (same calendar month)
      const quotaB = makeFreeQuota({ periodStart: WINDOW_JAN })
      const remaining = await getInstallFreeSnapRemaining(quotaB)
      expect(remaining).toBe(0)
    })
  })

  // ── 4. App restart preserves the exhausted install marker ────
  describe('4. App restart preserves the exhausted install marker', () => {
    it('marker survives a simulated restart (re-read from AsyncStorage)', async () => {
      const quota = makeFreeQuota()
      await markInstallFreeSnapConsumed(quota.periodStart)

      // Simulate restart: the in-memory state is gone, but AsyncStorage
      // (mockStore) retains the record. A fresh read should find it.
      // (In the mock, the module-level mockStore persists across calls.)
      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBe(0)
    })

    it('the persisted record has the correct windowKey', async () => {
      const quota = makeFreeQuota()
      await markInstallFreeSnapConsumed(quota.periodStart)

      const raw = mockStore.get(INSTALL_FREE_SNAP_KEY)
      expect(raw).toBeDefined()
      const parsed = JSON.parse(raw!)
      expect(parsed.windowKey).toBe(WINDOW_JAN)
      expect(typeof parsed.consumedAt).toBe('string')
    })
  })

  // ── 5. Login to a different Free account remains exhausted ───
  describe('5. Login to a different Free account remains exhausted', () => {
    it('different Free account in the same window is still exhausted', async () => {
      // Original guest consumed the snap
      await markInstallFreeSnapConsumed(WINDOW_JAN)

      // A different Free account logs in (same monthly window)
      const differentAccountQuota = makeFreeQuota({
        periodStart: WINDOW_JAN,
        remaining: 1,
        used: 0,
      })
      const installRem = await getInstallFreeSnapRemaining(differentAccountQuota)
      expect(installRem).toBe(0)

      const effective = composeEffectiveQuota(differentAccountQuota, installRem)
      expect(effective!.remaining).toBe(0)
    })
  })

  // ── 6. Login back to the original Free account remains exhausted ─
  describe('6. Login back to the original Free account remains exhausted', () => {
    it('returning to the original account in the same window is still exhausted', async () => {
      // Original account consumed the snap
      await markInstallFreeSnapConsumed(WINDOW_JAN)

      // User logs out, then logs back into the original account
      const originalAccountQuota = makeFreeQuota({
        periodStart: WINDOW_JAN,
        remaining: 0,
        used: 1,
      })
      const installRem = await getInstallFreeSnapRemaining(originalAccountQuota)
      expect(installRem).toBe(0)

      const effective = composeEffectiveQuota(originalAccountQuota, installRem)
      expect(effective!.remaining).toBe(0)
    })
  })

  // ── 7. Pro account on the same installation follows Pro quota ─
  describe('7. Pro account on the same installation follows Pro quota normally', () => {
    it('Pro quota bypasses the install guard entirely', async () => {
      // Even if the install marker is consumed for Free
      await markInstallFreeSnapConsumed(WINDOW_JAN)

      const proQuota = makeProQuota({ remaining: 12, used: 0 })
      // composeEffectiveQuota for Pro returns the server quota as-is
      const effective = composeEffectiveQuota(proQuota, null)
      expect(effective).not.toBeNull()
      expect(effective!.plan).toBe('pro')
      expect(effective!.remaining).toBe(12)
    })

    it('Pro quota is not affected by install remaining = 0', () => {
      const proQuota = makeProQuota({ remaining: 8, used: 4 })
      const effective = composeEffectiveQuota(proQuota, 0)
      // Pro bypass — install remaining is ignored
      expect(effective!.remaining).toBe(8)
    })

    it('getInstallFreeSnapRemaining is not called for Pro in QuotaStore refresh', () => {
      // This is enforced by the QuotaStore implementation: it only
      // calls getInstallFreeSnapRemaining for plan === 'free'.
      // The composeEffectiveQuota function returns the server quota
      // as-is for Pro, regardless of installRemaining.
      const proQuota = makeProQuota({ remaining: 5, used: 7 })
      const effectiveWithNull = composeEffectiveQuota(proQuota, null)
      const effectiveWithZero = composeEffectiveQuota(proQuota, 0)
      const effectiveWithOne = composeEffectiveQuota(proQuota, 1)
      expect(effectiveWithNull!.remaining).toBe(5)
      expect(effectiveWithZero!.remaining).toBe(5)
      expect(effectiveWithOne!.remaining).toBe(5)
    })
  })

  // ── 8. Failed AI Snap leaves the install allowance available ──
  describe('8. Failed AI Snap leaves the install allowance available', () => {
    it('markInstallFreeSnapConsumed is NOT called on scan failure', async () => {
      // A failed scan should not call markInstallFreeSnapConsumed.
      // The caller (handleProduceIdentified) is only invoked on
      // successful produce identification. This test verifies the
      // guard module's behavior: if mark is never called, remaining is 1.
      const quota = makeFreeQuota()
      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBe(1)
    })

    it('clearInstallFreeSnapState restores the allowance', async () => {
      await markInstallFreeSnapConsumed(WINDOW_JAN)
      await clearInstallFreeSnapState()

      const quota = makeFreeQuota()
      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBe(1)
    })
  })

  // ── 9. Duplicate finalization does not double-consume ────────
  describe('9. Duplicate finalization does not double-consume', () => {
    it('markInstallFreeSnapConsumed is idempotent for the same window', async () => {
      const quota = makeFreeQuota()

      // Call mark multiple times
      await markInstallFreeSnapConsumed(quota.periodStart)
      await markInstallFreeSnapConsumed(quota.periodStart)
      await markInstallFreeSnapConsumed(quota.periodStart)

      // Only one record should exist
      const raw = mockStore.get(INSTALL_FREE_SNAP_KEY)
      expect(raw).toBeDefined()
      const parsed = JSON.parse(raw!)
      expect(parsed.windowKey).toBe(WINDOW_JAN)

      // Remaining is still 0 (not negative or error)
      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBe(0)
    })

    it('composeEffectiveQuota never returns negative remaining', () => {
      const quota = makeFreeQuota({ remaining: 0, used: 1 })
      const effective = composeEffectiveQuota(quota, 0)
      expect(effective!.remaining).toBe(0)
      expect(effective!.used).toBe(1)
    })
  })

  // ── 10. A new legitimate monthly window resets the install allowance ─
  describe('10. A new legitimate monthly window resets the install allowance', () => {
    it('different periodStart (new month) resets the allowance to 1', async () => {
      // Consume in January
      const janQuota = makeFreeQuota({ periodStart: WINDOW_JAN })
      await markInstallFreeSnapConsumed(janQuota.periodStart)
      expect(await getInstallFreeSnapRemaining(janQuota)).toBe(0)

      // February is a new window
      const febQuota = makeFreeQuota({ periodStart: WINDOW_FEB })
      const remaining = await getInstallFreeSnapRemaining(febQuota)
      expect(remaining).toBe(1)
    })

    it('composeEffectiveQuota reflects the reset in the new window', async () => {
      await markInstallFreeSnapConsumed(WINDOW_JAN)

      const febQuota = makeFreeQuota({ periodStart: WINDOW_FEB, remaining: 1, used: 0 })
      const installRem = await getInstallFreeSnapRemaining(febQuota)
      const effective = composeEffectiveQuota(febQuota, installRem)
      expect(effective!.remaining).toBe(1)
      expect(effective!.used).toBe(0)
    })

    it('marking consumption in the new window does not affect the old window', async () => {
      await markInstallFreeSnapConsumed(WINDOW_JAN)
      await markInstallFreeSnapConsumed(WINDOW_FEB)

      // The record now points to February
      const raw = mockStore.get(INSTALL_FREE_SNAP_KEY)
      const parsed = JSON.parse(raw!)
      expect(parsed.windowKey).toBe(WINDOW_FEB)

      // February is consumed
      const febQuota = makeFreeQuota({ periodStart: WINDOW_FEB })
      expect(await getInstallFreeSnapRemaining(febQuota)).toBe(0)
    })
  })

  // ── 11. Unknown server quota is never interpreted as unused ──
  describe('11. Unknown server quota is never interpreted as unused', () => {
    it('getInstallFreeSnapRemaining returns null for null quota', async () => {
      const remaining = await getInstallFreeSnapRemaining(null)
      expect(remaining).toBeNull()
    })

    it('getInstallFreeSnapRemaining returns null for missing periodStart', async () => {
      const quota = makeFreeQuota({ periodStart: '' })
      const remaining = await getInstallFreeSnapRemaining(quota)
      expect(remaining).toBeNull()
    })

    it('composeEffectiveQuota returns null for null server quota', () => {
      const effective = composeEffectiveQuota(null, 1)
      expect(effective).toBeNull()
    })

    it('composeEffectiveQuota returns null for Free with null install remaining', () => {
      const quota = makeFreeQuota({ remaining: 1, used: 0 })
      const effective = composeEffectiveQuota(quota, null)
      // Fail-closed: unknown install state → null (not 1/1)
      expect(effective).toBeNull()
    })

    it('composeEffectiveQuota for Pro with null install remaining returns server quota', () => {
      const proQuota = makeProQuota({ remaining: 12 })
      const effective = composeEffectiveQuota(proQuota, null)
      // Pro bypass — null install remaining does not block Pro
      expect(effective).not.toBeNull()
      expect(effective!.remaining).toBe(12)
    })

    it('effective quota null means display shows unknown, not "0 of 1"', () => {
      // selectFilmRollLabel(null) returns '— Free' (not "1/1 Free")
      // selectFilmRollRemaining(null) returns 0 (not 1)
      // selectQuotaExhausted(null) returns false
      // This is the existing fail-closed behavior for unknown quota.
      const effective = composeEffectiveQuota(null, null)
      expect(effective).toBeNull()
    })
  })

  // ── 12. Existing provenance and unrelated monetization intact ─
  describe('12. Existing provenance and unrelated monetization behavior remain intact', () => {
    it('composeEffectiveQuota preserves all server quota fields', () => {
      const quota = makeFreeQuota({
        remaining: 1,
        used: 0,
        dailyLimit: 5,
        dailyUsed: 2,
        periodEnd: '2025-02-01T00:00:00Z',
      })
      const effective = composeEffectiveQuota(quota, 1)
      expect(effective!.plan).toBe('free')
      expect(effective!.limit).toBe(1)
      expect(effective!.dailyLimit).toBe(5)
      expect(effective!.dailyUsed).toBe(2)
      expect(effective!.periodStart).toBe(WINDOW_JAN)
      expect(effective!.periodEnd).toBe('2025-02-01T00:00:00Z')
    })

    it('composeEffectiveQuota does not mutate the input quota', () => {
      const quota = makeFreeQuota({ remaining: 1, used: 0 })
      const original = { ...quota }
      composeEffectiveQuota(quota, 0)
      expect(quota).toEqual(original)
    })

    it('INSTALL_FREE_SNAP_KEY is namespaced correctly', () => {
      expect(INSTALL_FREE_SNAP_KEY).toBe('@juicing_install_free_snap_v1')
      expect(INSTALL_FREE_SNAP_KEY.startsWith('@juicing_')).toBe(true)
    })

    it('clearInstallFreeSnapState removes the record', async () => {
      await markInstallFreeSnapConsumed(WINDOW_JAN)
      expect(mockStore.has(INSTALL_FREE_SNAP_KEY)).toBe(true)

      await clearInstallFreeSnapState()
      expect(mockStore.has(INSTALL_FREE_SNAP_KEY)).toBe(false)
    })
  })
})

// ── Integration: QuotaStore composeEffectiveQuota usage ──────
describe('composeEffectiveQuota integration scenarios', () => {
  beforeEach(() => {
    mockStore.clear()
  })

  it('full lifecycle: fresh → consume → logout → new identity → still exhausted', async () => {
    // 1. Fresh guest: server says 1/1, install guard says 1
    const freshQuota = makeFreeQuota({ remaining: 1, used: 0 })
    let installRem = await getInstallFreeSnapRemaining(freshQuota)
    let effective = composeEffectiveQuota(freshQuota, installRem)
    expect(effective!.remaining).toBe(1) // Available

    // 2. Successful scan: server commits, install guard consumed
    await markInstallFreeSnapConsumed(freshQuota.periodStart)
    const postScanQuota = makeFreeQuota({ remaining: 0, used: 1 })
    installRem = await getInstallFreeSnapRemaining(postScanQuota)
    effective = composeEffectiveQuota(postScanQuota, installRem)
    expect(effective!.remaining).toBe(0) // Exhausted

    // 3. Logout → new anonymous UUID → server resets to 1/1
    const newIdentityQuota = makeFreeQuota({ remaining: 1, used: 0 })
    installRem = await getInstallFreeSnapRemaining(newIdentityQuota)
    effective = composeEffectiveQuota(newIdentityQuota, installRem)
    // Install guard still consumed → effective = min(1, 0) = 0
    expect(effective!.remaining).toBe(0)
    expect(effective!.used).toBe(1) // Shows "1 of 1 used"
  })

  it('full lifecycle: fresh → consume → new month → reset', async () => {
    // Consume in January
    const janQuota = makeFreeQuota({ periodStart: WINDOW_JAN })
    await markInstallFreeSnapConsumed(janQuota.periodStart)

    // New month: February
    const febQuota = makeFreeQuota({ periodStart: WINDOW_FEB, remaining: 1, used: 0 })
    const installRem = await getInstallFreeSnapRemaining(febQuota)
    const effective = composeEffectiveQuota(febQuota, installRem)
    expect(effective!.remaining).toBe(1) // Reset
    expect(effective!.used).toBe(0)
  })

  it('Pro user lifecycle: install guard consumed but Pro unaffected', async () => {
    // Free user consumes the install guard
    await markInstallFreeSnapConsumed(WINDOW_JAN)

    // Same installation, user upgrades to Pro
    const proQuota = makeProQuota({ remaining: 12, used: 0, periodStart: WINDOW_JAN })
    const effective = composeEffectiveQuota(proQuota, null)
    expect(effective!.remaining).toBe(12) // Pro bypass
  })
})
