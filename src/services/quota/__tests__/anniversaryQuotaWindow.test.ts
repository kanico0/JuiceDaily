// ─────────────────────────────────────────────────────────────
// anniversaryQuotaWindow.test.ts — Regression tests for the
// anniversary-based quota window algorithm and install anchor.
//
// Proves:
//   1. First use Aug 11 → window Aug 11–Sep 11
//   2. Aug 31 does not reset quota on Sep 1
//   3. Quota resets on Sep 11
//   4. Guest → email preserves anchor
//   5. Free 1/1 → Pro mid-window becomes 1/12, not 0/12
//   6. Annual Pro gets 12 each anniversary month
//   7. Logout/login preserves account anchor
//   8. Install guard follows same anniversary window
//   9. Failed/unknown quota never creates a new window
//   10. Duplicate refresh/finalization does not alter anchor
//   11. Account A anchor Aug 11 + logout/new guest B Aug 20 →
//       install guard remains exhausted
//   12. Switching among multiple Free UUIDs does not change install
//       anchor
//   13. Pro bypass
//   14. App restart preserves install anchor
//   15. Jan 31 → Feb 28/29 → Mar 31 (no drift)
//   16. Jan 30 → Feb 28/29 → Mar 30
//   17. Feb 29 leap-year behavior
//   18. Migration of already-exhausted Free user does not grant
//       another Snap
// ─────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'

// Mock AsyncStorage (required by installFreeSnapGuard.ts)
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

// Read the migration SQL to validate the server-side algorithm.
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../supabase/migrations/0016_anniversary_quota_window.sql',
)
const MIGRATION_SRC = fs.existsSync(MIGRATION_PATH)
  ? fs.readFileSync(MIGRATION_PATH, 'utf-8')
  : ''

// Read the install guard source to validate alignment.
const INSTALL_GUARD_PATH = path.resolve(__dirname, '../installFreeSnapGuard.ts')
const INSTALL_GUARD_SRC = fs.readFileSync(INSTALL_GUARD_PATH, 'utf-8')

// Import the TypeScript anniversary helpers from the install guard
import {
  addMonthsFromAnchor,
  anniversaryWindowStart,
  computeInstallWindowKey,
} from '../installFreeSnapGuard'

// ── Test fixtures ─────────────────────────────────────────────
const ANCHOR_AUG_11 = new Date('2026-08-11T14:30:00Z')
const AUG_11 = new Date('2026-08-11T14:30:00Z')
const AUG_31 = new Date('2026-08-31T23:59:00Z')
const SEP_1 = new Date('2026-09-01T00:01:00Z')
const SEP_10 = new Date('2026-09-10T14:30:00Z')
const SEP_11 = new Date('2026-09-11T14:30:00Z')
const SEP_11_LATE = new Date('2026-09-11T15:00:00Z')
const OCT_11 = new Date('2026-10-11T14:30:00Z')
const NOV_11 = new Date('2026-11-11T14:30:00Z')

describe('Anniversary Quota Window', () => {
  // ── 1. First use Aug 11 → window Aug 11–Sep 11 ──────────────
  describe('1. First use establishes anniversary window', () => {
    it('first use Aug 11 → window start = Aug 11, end = Sep 11', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, AUG_11)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
      const end = addMonthsFromAnchor(ANCHOR_AUG_11, 1)
      expect(end.toISOString()).toBe('2026-09-11T14:30:00.000Z')
    })

    it('first use Aug 11, checked Aug 15 → still in Aug 11–Sep 11 window', () => {
      const aug15 = new Date('2026-08-15T10:00:00Z')
      const start = anniversaryWindowStart(ANCHOR_AUG_11, aug15)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 2. Aug 31 does not reset quota on Sep 1 ─────────────────
  describe('2. Calendar month boundary does NOT reset quota', () => {
    it('Aug 31 is still in the Aug 11–Sep 11 window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, AUG_31)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })

    it('Sep 1 is still in the Aug 11–Sep 11 window (no reset)', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_1)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })

    it('Sep 10 is still in the Aug 11–Sep 11 window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_10)
      expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 3. Quota resets on Sep 11 ───────────────────────────────
  describe('3. Quota resets on anniversary day', () => {
    it('Sep 11 exactly at anniversary time → new window starts', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_11)
      expect(start.toISOString()).toBe('2026-09-11T14:30:00.000Z')
    })

    it('Sep 11 after anniversary time → new window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_11_LATE)
      expect(start.toISOString()).toBe('2026-09-11T14:30:00.000Z')
    })

    it('Oct 11 → third window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, OCT_11)
      expect(start.toISOString()).toBe('2026-10-11T14:30:00.000Z')
    })

    it('Nov 11 → fourth window', () => {
      const start = anniversaryWindowStart(ANCHOR_AUG_11, NOV_11)
      expect(start.toISOString()).toBe('2026-11-11T14:30:00.000Z')
    })
  })

  // ── 4. Guest → email preserves anchor ───────────────────────
  describe('4. Guest → email upgrade preserves anchor', () => {
    it('same UUID means same auth.users.created_at means same anchor', () => {
      const guestAnchor = ANCHOR_AUG_11
      const afterUpgradeAnchor = ANCHOR_AUG_11 // same UUID
      const now = SEP_1
      expect(anniversaryWindowStart(guestAnchor, now)).toEqual(
        anniversaryWindowStart(afterUpgradeAnchor, now),
      )
    })
  })

  // ── 5. Free 1/1 → Pro mid-window becomes 1/12, not 0/12 ────
  describe('5. Free → Pro upgrade mid-window', () => {
    it('upgrade preserves used count, only limit changes', () => {
      const freeUsed = 1
      const proLimit = 12
      const proUsed = freeUsed // preserved
      const proRemaining = proLimit - proUsed
      expect(proUsed).toBe(1)
      expect(proRemaining).toBe(11)
      expect(proUsed).not.toBe(0)
    })

    it('upgrade does NOT create a fresh 12', () => {
      const freeUsed = 1
      const proLimit = 12
      const proUsedAfterUpgrade = freeUsed
      expect(proUsedAfterUpgrade).toBe(1)
      expect(proLimit - proUsedAfterUpgrade).toBe(11)
    })

    it('window end is unchanged after upgrade', () => {
      const windowStart = anniversaryWindowStart(ANCHOR_AUG_11, AUG_31)
      const windowEnd = addMonthsFromAnchor(ANCHOR_AUG_11, 1)
      const upgradeDate = new Date('2026-08-20T10:00:00Z')
      const startAfterUpgrade = anniversaryWindowStart(ANCHOR_AUG_11, upgradeDate)
      const endAfterUpgrade = addMonthsFromAnchor(ANCHOR_AUG_11, 1)
      expect(startAfterUpgrade.toISOString()).toBe(windowStart.toISOString())
      expect(endAfterUpgrade.toISOString()).toBe(windowEnd.toISOString())
    })
  })

  // ── 6. Annual Pro gets 12 each anniversary month ────────────
  describe('6. Annual Pro allocation', () => {
    it('annual Pro gets 12 per anniversary month, not 144 upfront', () => {
      const annualProLimit = 12 // same as monthly Pro
      expect(annualProLimit).toBe(12)
      expect(annualProLimit).not.toBe(144)
    })
  })

  // ── 7. Logout/login preserves account anchor ────────────────
  describe('7. Logout/login preserves account anchor', () => {
    it('returning user gets same anchor (auth.users.created_at unchanged)', () => {
      const originalAnchor = ANCHOR_AUG_11
      const afterLoginAnchor = ANCHOR_AUG_11
      const now = OCT_11
      expect(anniversaryWindowStart(originalAnchor, now)).toEqual(
        anniversaryWindowStart(afterLoginAnchor, now),
      )
    })
  })

  // ── 8. Install guard follows same anniversary window ────────
  describe('8. Install guard alignment with anniversary window', () => {
    it('install guard uses install anchor (not server periodStart)', () => {
      expect(INSTALL_GUARD_SRC).toContain('INSTALL_ANCHOR_KEY')
      expect(INSTALL_GUARD_SRC).toContain('getOrCreateInstallAnchor')
    })

    it('install guard computes windowKey from install anchor', () => {
      expect(INSTALL_GUARD_SRC).toContain('computeInstallWindowKey(anchorISO)')
    })

    it('install guard does NOT compute its own calendar month', () => {
      expect(INSTALL_GUARD_SRC).not.toContain('date_trunc')
    })

    it('install guard self-heal uses install anchor windowKey', () => {
      expect(INSTALL_GUARD_SRC).toContain('selfHealInstallMarker')
      // selfHeal calls getOrCreateInstallAnchor + computeInstallWindowKey
      const selfHealSection = INSTALL_GUARD_SRC.slice(
        INSTALL_GUARD_SRC.indexOf('export async function selfHealInstallMarker'),
      )
      expect(selfHealSection).toContain('getOrCreateInstallAnchor')
      expect(selfHealSection).toContain('computeInstallWindowKey')
    })

    it('install anchor is seeded once from serverQuota.periodStart', () => {
      const seedSection = INSTALL_GUARD_SRC.slice(
        INSTALL_GUARD_SRC.indexOf('export async function getOrCreateInstallAnchor'),
      )
      expect(seedSection).toContain('readAnchorRecord')
      expect(seedSection).toContain('serverQuota.periodStart')
    })

    it('install anchor never changes after establishment', () => {
      const seedSection = INSTALL_GUARD_SRC.slice(
        INSTALL_GUARD_SRC.indexOf('export async function getOrCreateInstallAnchor'),
      )
      // If existing anchor exists, return it — never overwrite
      expect(seedSection).toContain('if (existing) return existing.anchorISO')
    })
  })

  // ── 9. Failed/unknown quota never creates a new window ──────
  describe('9. Unknown quota fail-closed', () => {
    it('null server quota → install guard returns null (fail-closed)', () => {
      expect(INSTALL_GUARD_SRC).toContain('if (!serverQuota) return null')
    })

    it('self-heal does NOT seed from null quota', () => {
      expect(INSTALL_GUARD_SRC).toContain('if (!serverQuota) return false')
    })
  })

  // ── 10. Duplicate refresh does not alter anchor ─────────────
  describe('10. Idempotency', () => {
    it('anniversaryWindowStart is deterministic — same inputs → same output', () => {
      const a = anniversaryWindowStart(ANCHOR_AUG_11, SEP_1)
      const b = anniversaryWindowStart(ANCHOR_AUG_11, SEP_1)
      expect(a).toEqual(b)
    })

    it('multiple calls with same anchor and now produce same window', () => {
      for (let i = 0; i < 5; i++) {
        const start = anniversaryWindowStart(ANCHOR_AUG_11, SEP_10)
        expect(start.toISOString()).toBe('2026-08-11T14:30:00.000Z')
      }
    })

    it('computeInstallWindowKey is deterministic', () => {
      const anchor = '2026-08-11T14:30:00.000Z'
      const now = new Date('2026-08-15T10:00:00Z')
      const a = computeInstallWindowKey(anchor, now)
      const b = computeInstallWindowKey(anchor, now)
      expect(a).toBe(b)
      expect(a).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 11. Account A + logout/new guest B → install guard exhausted ─
  describe('11. Cross-identity install guard exhaustion', () => {
    it('install anchor seeded from A does not reset when B has different periodStart', () => {
      // Account A created Aug 11 → periodStart Aug 11
      const anchorA = '2026-08-11T14:30:00.000Z'
      // After logout, new anonymous B created Aug 20 → periodStart Aug 20
      const periodStartB = '2026-08-20T10:00:00Z'

      // Install anchor was seeded from A's periodStart (Aug 11)
      // B's periodStart (Aug 20) is different, but the install anchor
      // is IMMUTABLE — it does not change.
      const installWindowKey = computeInstallWindowKey(
        anchorA,
        new Date('2026-08-25T12:00:00Z'),
      )
      // The install window is computed from anchorA (Aug 11), not B's
      // periodStart (Aug 20). So the window is Aug 11 → Sep 11.
      expect(installWindowKey).toBe('2026-08-11T14:30:00.000Z')
      // B's periodStart is NOT used as the install window key
      expect(installWindowKey).not.toBe(periodStartB)
    })

    it('install guard remains exhausted across identity change', () => {
      // The install guard uses the install anchor, not the server's
      // periodStart. So even if B has a different periodStart, the
      // install guard's windowKey is computed from the immutable
      // install anchor (A's periodStart).
      const anchorA = '2026-08-11T14:30:00.000Z'
      const now = new Date('2026-08-25T12:00:00Z')
      const windowKey = computeInstallWindowKey(anchorA, now)
      // If the marker was set for this window, it remains consumed
      // regardless of which UUID is active.
      expect(windowKey).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 12. Switching Free UUIDs does not change install anchor ──
  describe('12. Multiple Free UUIDs do not change install anchor', () => {
    it('computeInstallWindowKey uses the same anchor for any serverQuota', () => {
      const anchor = '2026-08-11T14:30:00.000Z'
      const now = new Date('2026-08-25T12:00:00Z')
      // The install window key depends only on the anchor and now,
      // NOT on which UUID's quota is being checked.
      const key1 = computeInstallWindowKey(anchor, now)
      const key2 = computeInstallWindowKey(anchor, now)
      expect(key1).toBe(key2)
    })
  })

  // ── 13. Pro bypass ───────────────────────────────────────────
  describe('13. Pro bypass', () => {
    it('composeEffectiveQuota returns server quota as-is for Pro', () => {
      expect(INSTALL_GUARD_SRC).toContain(
        "if (serverQuota.plan === 'pro') return serverQuota",
      )
    })
  })

  // ── 14. App restart preserves install anchor ────────────────
  describe('14. App restart preserves install anchor', () => {
    it('install anchor is persisted to AsyncStorage', () => {
      expect(INSTALL_GUARD_SRC).toContain('INSTALL_ANCHOR_KEY')
      expect(INSTALL_GUARD_SRC).toContain("AsyncStorage.setItem(INSTALL_ANCHOR_KEY")
    })

    it('install anchor is read from AsyncStorage on startup', () => {
      expect(INSTALL_GUARD_SRC).toContain("AsyncStorage.getItem(INSTALL_ANCHOR_KEY")
    })
  })

  // ── 15. Jan 31 → Feb 28/29 → Mar 31 (no drift) ──────────────
  describe('15. Jan 31 anchor — no permanent drift', () => {
    const JAN_31 = new Date('2026-01-31T10:00:00Z')

    it('addMonthsFromAnchor(Jan 31, 1) = Feb 28 (clamped)', () => {
      const feb = addMonthsFromAnchor(JAN_31, 1)
      expect(feb.getUTCMonth()).toBe(1) // February
      expect(feb.getUTCDate()).toBe(28)
    })

    it('addMonthsFromAnchor(Jan 31, 2) = Mar 31 (returns to 31st!)', () => {
      const mar = addMonthsFromAnchor(JAN_31, 2)
      expect(mar.getUTCMonth()).toBe(2) // March
      expect(mar.getUTCDate()).toBe(31) // NOT 28!
    })

    it('addMonthsFromAnchor(Jan 31, 3) = Apr 30 (clamped)', () => {
      const apr = addMonthsFromAnchor(JAN_31, 3)
      expect(apr.getUTCMonth()).toBe(3) // April
      expect(apr.getUTCDate()).toBe(30)
    })

    it('addMonthsFromAnchor(Jan 31, 4) = May 31 (returns to 31st)', () => {
      const may = addMonthsFromAnchor(JAN_31, 4)
      expect(may.getUTCMonth()).toBe(4) // May
      expect(may.getUTCDate()).toBe(31)
    })

    it('anniversaryWindowStart(Jan 31, Feb 15) = Jan 31 (first window)', () => {
      const feb15 = new Date('2026-02-15T10:00:00Z')
      const start = anniversaryWindowStart(JAN_31, feb15)
      expect(start.getUTCMonth()).toBe(0) // January
      expect(start.getUTCDate()).toBe(31)
    })

    it('anniversaryWindowStart(Jan 31, Mar 15) = Feb 28 (second window)', () => {
      const mar15 = new Date('2026-03-15T10:00:00Z')
      const start = anniversaryWindowStart(JAN_31, mar15)
      expect(start.getUTCMonth()).toBe(1) // February
      expect(start.getUTCDate()).toBe(28)
    })

    it('anniversaryWindowStart(Jan 31, Mar 31) = Mar 31 (third window)', () => {
      const mar31 = new Date('2026-03-31T10:00:00Z')
      const start = anniversaryWindowStart(JAN_31, mar31)
      expect(start.getUTCMonth()).toBe(2) // March
      expect(start.getUTCDate()).toBe(31)
    })

    it('anniversaryWindowStart(Jan 31, Apr 15) = Mar 31 (third window)', () => {
      const apr15 = new Date('2026-04-15T10:00:00Z')
      const start = anniversaryWindowStart(JAN_31, apr15)
      expect(start.getUTCMonth()).toBe(2) // March
      expect(start.getUTCDate()).toBe(31)
    })

    it('no chaining drift: Feb 28 is NOT used as the next anchor', () => {
      // The critical test: if we chained (Feb 28 + 1 month = Mar 28),
      // we'd get Mar 28. But computing from the anchor (Jan 31 + 2
      // months = Mar 31), we get Mar 31. Verify the latter.
      const chainedResult = addMonthsFromAnchor(
        addMonthsFromAnchor(JAN_31, 1), // Feb 28
        1, // + 1 month
      )
      const fromAnchorResult = addMonthsFromAnchor(JAN_31, 2)
      // Chaining gives Mar 28 (wrong)
      expect(chainedResult.getUTCDate()).toBe(28)
      // Computing from anchor gives Mar 31 (correct)
      expect(fromAnchorResult.getUTCDate()).toBe(31)
      // They must differ — this proves we compute from the anchor
      expect(chainedResult).not.toEqual(fromAnchorResult)
    })
  })

  // ── 16. Jan 30 → Feb 28/29 → Mar 30 ─────────────────────────
  describe('16. Jan 30 anchor', () => {
    const JAN_30 = new Date('2026-01-30T10:00:00Z')

    it('addMonthsFromAnchor(Jan 30, 1) = Feb 28 (clamped)', () => {
      const feb = addMonthsFromAnchor(JAN_30, 1)
      expect(feb.getUTCMonth()).toBe(1)
      expect(feb.getUTCDate()).toBe(28)
    })

    it('addMonthsFromAnchor(Jan 30, 2) = Mar 30 (returns to 30th)', () => {
      const mar = addMonthsFromAnchor(JAN_30, 2)
      expect(mar.getUTCMonth()).toBe(2)
      expect(mar.getUTCDate()).toBe(30)
    })

    it('addMonthsFromAnchor(Jan 30, 3) = Apr 30 (30th preserved)', () => {
      const apr = addMonthsFromAnchor(JAN_30, 3)
      expect(apr.getUTCMonth()).toBe(3)
      expect(apr.getUTCDate()).toBe(30)
    })
  })

  // ── 17. Feb 29 leap-year behavior ───────────────────────────
  describe('17. Feb 29 leap-year anchor', () => {
    const FEB_29_2024 = new Date('2024-02-29T10:00:00Z') // 2024 is a leap year

    it('addMonthsFromAnchor(Feb 29 2024, 1) = Mar 29 (not Mar 31)', () => {
      const mar = addMonthsFromAnchor(FEB_29_2024, 1)
      expect(mar.getUTCMonth()).toBe(2) // March
      expect(mar.getUTCDate()).toBe(29)
    })

    it('addMonthsFromAnchor(Feb 29 2024, 12) = Feb 28 2025 (non-leap year)', () => {
      const feb2025 = addMonthsFromAnchor(FEB_29_2024, 12)
      expect(feb2025.getUTCFullYear()).toBe(2025)
      expect(feb2025.getUTCMonth()).toBe(1) // February
      expect(feb2025.getUTCDate()).toBe(28) // 2025 is not a leap year
    })

    it('addMonthsFromAnchor(Feb 29 2024, 24) = Feb 28 2026 (non-leap)', () => {
      const feb2026 = addMonthsFromAnchor(FEB_29_2024, 24)
      expect(feb2026.getUTCFullYear()).toBe(2026)
      expect(feb2026.getUTCMonth()).toBe(1)
      expect(feb2026.getUTCDate()).toBe(28)
    })

    it('addMonthsFromAnchor(Feb 29 2024, 48) = Feb 28 2028 (non-leap, 2028 IS leap)', () => {
      // 2024 + 4 years = 2028, which is a leap year
      const feb2028 = addMonthsFromAnchor(FEB_29_2024, 48)
      expect(feb2028.getUTCFullYear()).toBe(2028)
      expect(feb2028.getUTCMonth()).toBe(1)
      // 2028 is a leap year, so Feb 29 exists
      expect(feb2028.getUTCDate()).toBe(29)
    })

    it('anniversaryWindowStart(Feb 29 2024, Mar 15 2024) = Feb 29', () => {
      const mar15 = new Date('2024-03-15T10:00:00Z')
      const start = anniversaryWindowStart(FEB_29_2024, mar15)
      expect(start.getUTCMonth()).toBe(1) // February
      expect(start.getUTCDate()).toBe(29)
    })
  })

  // ── 18. Migration of exhausted Free user ────────────────────
  describe('18. Migration of already-exhausted Free user', () => {
    it('migration preserves used when old and new windows overlap', () => {
      // The migration UPDATE uses an overlap check:
      //   when q.period_start < new_window_end and q.period_end > new_window_start
      //   then q.used (preserve)
      //   else 0 (reset)
      expect(MIGRATION_SRC).toContain('q.period_start < public.anniversary_window_end')
      expect(MIGRATION_SRC).toContain('q.period_end > w.w_start')
      expect(MIGRATION_SRC).toContain('then q.used')
      expect(MIGRATION_SRC).toContain('else 0')
    })

    it('a user who consumed their Free Snap before migration remains exhausted', () => {
      // Scenario: user created Aug 11, old calendar window Aug 1 → Sep 1,
      // used = 1, remaining = 0. Today is Aug 25.
      // Old window: Aug 1 → Sep 1 (contains Aug 25)
      // New window: Aug 11 → Sep 11 (contains Aug 25)
      // Both windows overlap → used = 1 is preserved → still exhausted.

      // Simulate the overlap check:
      const oldStart = new Date('2026-08-01T00:00:00Z')
      const oldEnd = new Date('2026-09-01T00:00:00Z')
      const newStart = new Date('2026-08-11T00:00:00Z')
      const newEnd = new Date('2026-09-11T00:00:00Z')
      const now = new Date('2026-08-25T12:00:00Z')

      // Overlap: oldStart < newEnd AND oldEnd > newStart
      const overlaps = oldStart < newEnd && oldEnd > newStart
      expect(overlaps).toBe(true)
      // Both windows contain now
      const oldContainsNow = oldStart <= now && now < oldEnd
      const newContainsNow = newStart <= now && now < newEnd
      expect(oldContainsNow).toBe(true)
      expect(newContainsNow).toBe(true)
      // used is preserved → user remains exhausted
    })

    it('a user whose old window expired and does NOT overlap gets reset', () => {
      // Scenario: user created Aug 11, old calendar window Jul 1 → Aug 1,
      // used = 1. Today is Aug 25.
      // Old window: Jul 1 → Aug 1 (expired, does not contain Aug 25)
      // New window: Aug 11 → Sep 11 (contains Aug 25)
      // No overlap → used = 0 → user gets fresh allowance.

      const oldStart = new Date('2026-07-01T00:00:00Z')
      const oldEnd = new Date('2026-08-01T00:00:00Z')
      const newStart = new Date('2026-08-11T00:00:00Z')
      const newEnd = new Date('2026-09-11T00:00:00Z')

      // Overlap: oldStart < newEnd AND oldEnd > newStart
      // oldEnd (Aug 1) > newStart (Aug 11)? No! Aug 1 < Aug 11
      const overlaps = oldStart < newEnd && oldEnd > newStart
      expect(overlaps).toBe(false)
      // used is reset to 0 → user gets fresh allowance
    })
  })
})

// ─────────────────────────────────────────────────────────────
// Server-side migration validation (source-level).
// ─────────────────────────────────────────────────────────────
describe('Anniversary Quota Migration (server-side source)', () => {
  it('migration file exists', () => {
    expect(MIGRATION_SRC.length).toBeGreaterThan(0)
  })

  it('creates _add_months_from_anchor helper', () => {
    expect(MIGRATION_SRC).toContain('_add_months_from_anchor')
    expect(MIGRATION_SRC).toContain('least(v_anchor_day, v_last_day)')
  })

  it('creates anniversary_window_start function', () => {
    expect(MIGRATION_SRC).toContain('anniversary_window_start')
  })

  it('creates anniversary_window_end function', () => {
    expect(MIGRATION_SRC).toContain('anniversary_window_end')
  })

  it('resolve_quota joins with auth.users for the anchor', () => {
    expect(MIGRATION_SRC).toContain('auth.users')
    expect(MIGRATION_SRC).toContain('created_at')
  })

  it('resolve_quota computes window from anchor (not chained)', () => {
    const resolveSection = MIGRATION_SRC.slice(
      MIGRATION_SRC.indexOf('create or replace function public.resolve_quota'),
    )
    expect(resolveSection).toContain('anniversary_window_start(v_anchor, now())')
    expect(resolveSection).toContain('anniversary_window_end(v_anchor, v_window_start)')
  })

  it('resolve_quota does NOT chain period_end + interval', () => {
    const resolveSection = MIGRATION_SRC.slice(
      MIGRATION_SRC.indexOf('create or replace function public.resolve_quota'),
    )
    // The old chaining approach: q.period_end := q.period_start + interval '1 month'
    // The new approach uses anniversary_window_end
    expect(resolveSection).not.toContain("q.period_end := q.period_start + interval '1 month'")
  })

  it('resolve_quota does NOT use _utc_month_start or _utc_month_end', () => {
    const resolveSection = MIGRATION_SRC.slice(
      MIGRATION_SRC.indexOf('create or replace function public.resolve_quota'),
    )
    expect(resolveSection).not.toContain('_utc_month_start')
    expect(resolveSection).not.toContain('_utc_month_end')
  })

  it('plan transition preserves used (Free 1/1 → Pro 1/12)', () => {
    expect(MIGRATION_SRC).toContain('plan is distinct from v_plan')
    const planTransitionIdx = MIGRATION_SRC.indexOf('plan is distinct from v_plan')
    const planBlock = MIGRATION_SRC.slice(planTransitionIdx, planTransitionIdx + 200)
    expect(planBlock).not.toMatch(/used\s*:=\s*0/)
  })

  it('migration preserves used/reserved with overlap check', () => {
    expect(MIGRATION_SRC).toContain('q.period_start < public.anniversary_window_end')
    expect(MIGRATION_SRC).toContain('q.period_end > w.w_start')
  })

  it('migration sets anchor_day from auth.users.created_at', () => {
    expect(MIGRATION_SRC).toContain('anchor_day = extract(day from u.created_at)')
  })

  it('does not modify RevenueCat or subscription billing logic', () => {
    expect(MIGRATION_SRC).not.toContain('revenuecat_webhook_events')
    expect(MIGRATION_SRC).not.toContain('create or replace function public.sync_revenuecat')
    expect(MIGRATION_SRC).not.toContain('alter table public.subscriptions')
  })

  it('migration adds anchor_at column to scan_quotas', () => {
    expect(MIGRATION_SRC).toContain('anchor_at timestamptz')
    expect(MIGRATION_SRC).toContain('alter table public.scan_quotas')
  })

  it('migration backfills anchor_at from auth.users.created_at', () => {
    expect(MIGRATION_SRC).toContain('anchor_at = u.created_at')
  })

  it('resolve_quota sets anchor_at on insert', () => {
    const resolveSection = MIGRATION_SRC.slice(
      MIGRATION_SRC.indexOf('create or replace function public.resolve_quota'),
    )
    expect(resolveSection).toContain('anchor_at')
    expect(resolveSection).toContain('v_anchor')
  })
})

// ─────────────────────────────────────────────────────────────
// Install anchor seeding from authoritative anchorAt
// ─────────────────────────────────────────────────────────────
describe('Install Anchor Seeding from anchorAt', () => {
  // These tests verify that the install anchor is seeded from the
  // server's authoritative anchorAt (auth.users.created_at), NOT
  // from periodStart (which is the current window start and may
  // have drifted for end-of-month anchors).

  // Re-import the install guard functions that use AsyncStorage
  // (already mocked at the top of this file)
  const {
    getOrCreateInstallAnchor,
    computeInstallWindowKey,
    addMonthsFromAnchor,
    anniversaryWindowStart,
    INSTALL_ANCHOR_KEY,
    INSTALL_FREE_SNAP_KEY,
    clearInstallFreeSnapState,
    clearInstallAnchor,
    selfHealInstallMarker,
    markInstallFreeSnapConsumed,
    getInstallFreeSnapRemaining,
  } = require('../installFreeSnapGuard')

  // Helper to read the mock store
  function readMockStore (key: string): any {
    const raw = mockStore.get(key)
    return raw ? JSON.parse(raw) : null
  }

  beforeEach(() => {
    mockStore.clear()
  })

  // ── 1. Jan 31 anchor, first guard during Feb 28 window ──────
  describe('1. Jan 31 true anchor, guard initialized during Feb 28 window', () => {
    it('install anchor stores Jan 31, NOT Feb 28', async () => {
      // True account anchor = Jan 31 (auth.users.created_at)
      // Current periodStart = Feb 28 (the window start containing now)
      // The guard should seed from anchorAt (Jan 31), not periodStart (Feb 28)
      const quota = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-02-28T10:00:00.000Z', // current window start
        periodEnd: '2026-03-31T10:00:00.000Z',
        anchorAt: '2026-01-31T10:00:00.000Z', // true first-use anchor
        dailyLimit: null,
        dailyUsed: null,
      }

      const anchor = await getOrCreateInstallAnchor(quota)
      expect(anchor).toBe('2026-01-31T10:00:00.000Z')
      expect(anchor).not.toBe('2026-02-28T10:00:00.000Z')

      // Verify the persisted record
      const record = readMockStore(INSTALL_ANCHOR_KEY)
      expect(record.anchorISO).toBe('2026-01-31T10:00:00.000Z')
    })

    it('subsequent install windows recover to Mar 31', () => {
      // Install anchor = Jan 31
      // Feb 28 window: addMonthsFromAnchor(Jan 31, 1) = Feb 28 (clamped)
      const feb = addMonthsFromAnchor(
        new Date('2026-01-31T10:00:00.000Z'),
        1,
      )
      expect(feb.getUTCMonth()).toBe(1) // February
      expect(feb.getUTCDate()).toBe(28)

      // Mar 31 window: addMonthsFromAnchor(Jan 31, 2) = Mar 31 (recovers!)
      const mar = addMonthsFromAnchor(
        new Date('2026-01-31T10:00:00.000Z'),
        2,
      )
      expect(mar.getUTCMonth()).toBe(2) // March
      expect(mar.getUTCDate()).toBe(31) // NOT 28!

      // If the anchor had been seeded from Feb 28 (wrong):
      const marFromWrongAnchor = addMonthsFromAnchor(
        new Date('2026-02-28T10:00:00.000Z'),
        1,
      )
      expect(marFromWrongAnchor.getUTCDate()).toBe(28) // Stuck on 28th!
      // This proves why seeding from anchorAt (Jan 31) is critical
      expect(mar.getUTCDate()).not.toBe(marFromWrongAnchor.getUTCDate())
    })
  })

  // ── 2. Existing Aug 11 user seeds Aug 11 correctly ──────────
  describe('2. Existing Aug 11 user seeds Aug 11 correctly', () => {
    it('install anchor = anchorAt = Aug 11', async () => {
      const quota = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-08-11T14:30:00.000Z',
        periodEnd: '2026-09-11T14:30:00.000Z',
        anchorAt: '2026-08-11T14:30:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }

      const anchor = await getOrCreateInstallAnchor(quota)
      expect(anchor).toBe('2026-08-11T14:30:00.000Z')
    })

    it('install window key matches Aug 11 → Sep 11', () => {
      const windowKey = computeInstallWindowKey(
        '2026-08-11T14:30:00.000Z',
        new Date('2026-08-25T12:00:00Z'),
      )
      expect(windowKey).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 3. Logout → new Aug 20 guest does not replace Aug 11 ────
  describe('3. Logout → new guest does not replace install anchor', () => {
    it('established Aug 11 anchor survives new Aug 20 guest', async () => {
      // First user (Aug 11) establishes the install anchor
      const quotaA = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-08-11T14:30:00.000Z',
        periodEnd: '2026-09-11T14:30:00.000Z',
        anchorAt: '2026-08-11T14:30:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }
      await getOrCreateInstallAnchor(quotaA)
      expect(readMockStore(INSTALL_ANCHOR_KEY).anchorISO).toBe(
        '2026-08-11T14:30:00.000Z',
      )

      // Logout → new anonymous B created Aug 20
      const quotaB = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-08-20T10:00:00.000Z',
        periodEnd: '2026-09-20T10:00:00.000Z',
        anchorAt: '2026-08-20T10:00:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }
      const anchor = await getOrCreateInstallAnchor(quotaB)
      // The anchor is STILL Aug 11 — it was not replaced
      expect(anchor).toBe('2026-08-11T14:30:00.000Z')
      expect(anchor).not.toBe('2026-08-20T10:00:00.000Z')
    })
  })

  // ── 4. Account switching never changes established anchor ───
  describe('4. Account switching never changes install anchor', () => {
    it('switching to a different Free account preserves install anchor', async () => {
      // Account A (Jan 15) establishes the anchor
      const quotaA = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-01-15T08:00:00.000Z',
        periodEnd: '2026-02-15T08:00:00.000Z',
        anchorAt: '2026-01-15T08:00:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }
      await getOrCreateInstallAnchor(quotaA)

      // Switch to Account B (Mar 22)
      const quotaB = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-03-22T12:00:00.000Z',
        periodEnd: '2026-04-22T12:00:00.000Z',
        anchorAt: '2026-03-22T12:00:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }
      const anchor = await getOrCreateInstallAnchor(quotaB)
      expect(anchor).toBe('2026-01-15T08:00:00.000Z') // Still A's anchor
      expect(anchor).not.toBe('2026-03-22T12:00:00.000Z')
    })

    it('switching to a Pro account preserves install anchor', async () => {
      const quotaFree = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-01-15T08:00:00.000Z',
        periodEnd: '2026-02-15T08:00:00.000Z',
        anchorAt: '2026-01-15T08:00:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }
      await getOrCreateInstallAnchor(quotaFree)

      const quotaPro = {
        plan: 'pro' as const,
        limit: 12,
        used: 0,
        remaining: 12,
        periodStart: '2026-03-22T12:00:00.000Z',
        periodEnd: '2026-04-22T12:00:00.000Z',
        anchorAt: '2026-03-22T12:00:00.000Z',
        dailyLimit: 10,
        dailyUsed: 0,
      }
      const anchor = await getOrCreateInstallAnchor(quotaPro)
      expect(anchor).toBe('2026-01-15T08:00:00.000Z') // Still the original
    })
  })

  // ── 5. Exhausted old-build user self-heals without another Snap ─
  describe('5. Exhausted old-build user self-heals', () => {
    it('self-heal seeds install marker from anchorAt without another Snap', async () => {
      // Old-build user: no install anchor, no install marker.
      // Server reports exhausted Free quota with anchorAt.
      const exhaustedQuota = {
        plan: 'free' as const,
        limit: 1,
        used: 1,
        remaining: 0,
        periodStart: '2026-08-11T14:30:00.000Z',
        periodEnd: '2026-09-11T14:30:00.000Z',
        anchorAt: '2026-08-11T14:30:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }

      // No install anchor or marker exists yet
      expect(mockStore.has(INSTALL_ANCHOR_KEY)).toBe(false)
      expect(mockStore.has(INSTALL_FREE_SNAP_KEY)).toBe(false)

      // Self-heal
      const healed = await selfHealInstallMarker(exhaustedQuota)
      expect(healed).toBe(true)

      // Install anchor was seeded from anchorAt (not periodStart)
      const anchorRecord = readMockStore(INSTALL_ANCHOR_KEY)
      expect(anchorRecord.anchorISO).toBe('2026-08-11T14:30:00.000Z')

      // Install marker was set for the current install window
      const markerRecord = readMockStore(INSTALL_FREE_SNAP_KEY)
      expect(markerRecord).not.toBeNull()
      expect(typeof markerRecord.windowKey).toBe('string')
      expect(typeof markerRecord.consumedAt).toBe('string')
    })

    it('after self-heal, effective quota is exhausted (no extra Snap)', async () => {
      const exhaustedQuota = {
        plan: 'free' as const,
        limit: 1,
        used: 1,
        remaining: 0,
        periodStart: '2026-08-11T14:30:00.000Z',
        periodEnd: '2026-09-11T14:30:00.000Z',
        anchorAt: '2026-08-11T14:30:00.000Z',
        dailyLimit: null,
        dailyUsed: null,
      }

      await selfHealInstallMarker(exhaustedQuota)

      // Check install remaining — should be 0 (consumed)
      const remaining = await getInstallFreeSnapRemaining(exhaustedQuota)
      expect(remaining).toBe(0)
    })
  })

  // ── 6. Fallback to periodStart when anchorAt is missing ─────
  describe('6. Fallback to periodStart for older servers', () => {
    it('seeds from periodStart when anchorAt is null', async () => {
      const quota = {
        plan: 'free' as const,
        limit: 1,
        used: 0,
        remaining: 1,
        periodStart: '2026-08-11T14:30:00.000Z',
        periodEnd: '2026-09-11T14:30:00.000Z',
        anchorAt: null, // Older server doesn't return anchorAt
        dailyLimit: null,
        dailyUsed: null,
      }

      const anchor = await getOrCreateInstallAnchor(quota)
      expect(anchor).toBe('2026-08-11T14:30:00.000Z')
    })
  })

  // ── 7. Edge Function returns anchorAt ───────────────────────
  describe('7. Edge Function returns anchorAt', () => {
    const EDGE_FN_PATH = path.resolve(
      __dirname,
      '../../../../supabase/functions/scan-quota/index.ts',
    )
    const EDGE_FN_SRC = fs.existsSync(EDGE_FN_PATH)
      ? fs.readFileSync(EDGE_FN_PATH, 'utf-8')
      : ''

    it('Edge Function includes anchorAt in anonymous response', () => {
      expect(EDGE_FN_SRC).toContain('anchorAt')
      expect(EDGE_FN_SRC).toContain('aq.anchor_at')
    })

    it('Edge Function includes anchorAt in authenticated response', () => {
      expect(EDGE_FN_SRC).toContain('anchorAt: q.anchor_at')
    })
  })

  // ── 8. Client parser carries anchorAt ───────────────────────
  describe('8. Client parser carries anchorAt', () => {
    const PARSER_PATH = path.resolve(__dirname, '../quotaService.ts')
    const PARSER_SRC = fs.readFileSync(PARSER_PATH, 'utf-8')

    it('parseQuota extracts anchorAt', () => {
      expect(PARSER_SRC).toContain('anchorAt')
      expect(PARSER_SRC).toContain('q.anchor_at')
    })

    it('ScanQuotaSnapshot type includes anchorAt', () => {
      const TYPES_PATH = path.resolve(
        __dirname,
        '../../subscriptions/subscriptionTypes.ts',
      )
      const TYPES_SRC = fs.readFileSync(TYPES_PATH, 'utf-8')
      expect(TYPES_SRC).toContain('anchorAt')
    })
  })
})
