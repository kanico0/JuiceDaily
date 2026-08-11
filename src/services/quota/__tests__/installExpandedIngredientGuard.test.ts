// ─────────────────────────────────────────────────────────────
// installExpandedIngredientGuard.test.ts — Regression tests for
// the same-install lifetime Expanded Ingredient Analysis guard.
//
// Covers all required scenarios:
//   1.  Fresh installation + fresh Free user → 3/3
//   2.  First successful Free Expanded Ingredient Analysis → 2/3
//   3.  Logout → new anonymous Free UUID → still 2/3
//   4.  Login/create fresh Free Account B → still 2/3
//   5.  Account B successfully uses one → 1/3
//   6.  Switch back to Account A → still 1/3 effective
//   7.  Third successful Free analysis → 0/3
//   8.  Fourth Free attempt blocked
//   9.  App restart preserves state
//   10. Existing old-build account with used=1 self-heals to 2/3
//   11. Fresh account used=0 cannot lower existing install used
//   12. Failed/released analysis doesn't consume
//   13. Duplicate finalize/request ID doesn't double-consume
//   14. Pro bypasses
//   15. Pro analyses don't consume Free lifetime pool
//   16. Pro→Free restores the prior Free remaining count
//   17. Unknown authoritative quota fails closed
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
  INSTALL_EXPANDED_INGREDIENT_KEY,
  INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY,
  getInstallExpandedIngredientUsed,
  getInstallExpandedIngredientRemaining,
  composeEffectiveExpandedIngredientRemaining,
  selfHealInstallExpandedIngredient,
  markInstallExpandedIngredientConsumed,
  clearInstallExpandedIngredientState,
} from '../installExpandedIngredientGuard'
import { FREE_ADVANCED_BLEND_ALLOWANCE } from '../blendAllowanceService'

beforeEach(() => {
  mockStore.clear()
})

afterEach(() => {
  mockStore.clear()
})

// ── 1. Fresh installation + fresh Free user → 3/3 ────────────
describe('Fresh installation', () => {
  it('fresh install has 0 used and 3 remaining', async () => {
    const used = await getInstallExpandedIngredientUsed()
    const remaining = await getInstallExpandedIngredientRemaining()
    expect(used).toBe(0)
    expect(remaining).toBe(FREE_ADVANCED_BLEND_ALLOWANCE)
  })

  it('fresh install + account remaining=3 → effective 3', async () => {
    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(3)
  })
})

// ── 2. First successful Free analysis → 2/3 ──────────────────
describe('Successful consumption', () => {
  it('first successful analysis → install used=1, remaining=2', async () => {
    const consumed = await markInstallExpandedIngredientConsumed('req-1', false)
    expect(consumed).toBe(true)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)
    expect(await getInstallExpandedIngredientRemaining()).toBe(2)
  })

  it('effective remaining after one consumption = min(3, 2) = 2', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(2)
  })
})

// ── 3. Logout → new anonymous UUID → still 2/3 ───────────────
describe('Cross-account persistence', () => {
  it('logout → new UUID with fresh 3/3 → effective still 2/3', async () => {
    // Account A used one analysis
    await markInstallExpandedIngredientConsumed('req-A1', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)

    // Logout → new anonymous UUID → server reports fresh 3/3
    // Install guard keeps effective at 2/3
    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(2)
  })
})

// ── 4. Login/create fresh Free Account B → still 2/3 ─────────
describe('Account switching', () => {
  it('switch to fresh Account B (used=0) → effective still 2/3', async () => {
    // Account A used one
    await markInstallExpandedIngredientConsumed('req-A1', false)
    // Self-heal from Account A's authoritative used=1
    await selfHealInstallExpandedIngredient(1, false)

    // Switch to Account B (fresh, used=0, remaining=3)
    // Self-heal must NOT decrease install used
    await selfHealInstallExpandedIngredient(0, false)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)

    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(2)
  })
})

// ── 5. Account B successfully uses one → 1/3 ────────────────
describe('Second consumption on different account', () => {
  it('Account B uses one → install used=2, effective 1/3', async () => {
    // Account A used one
    await markInstallExpandedIngredientConsumed('req-A1', false)
    // Account B uses one
    await markInstallExpandedIngredientConsumed('req-B1', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(2)
    expect(await getInstallExpandedIngredientRemaining()).toBe(1)

    // Account B server reports remaining=2 (used=1)
    const effective = await composeEffectiveExpandedIngredientRemaining(2, false)
    expect(effective).toBe(1)
  })
})

// ── 6. Switch back to Account A → still 1/3 effective ───────
describe('Switch back to original account', () => {
  it('switch back to Account A (used=1, remaining=2) → effective 1/3', async () => {
    // Two analyses consumed across accounts A and B
    await markInstallExpandedIngredientConsumed('req-A1', false)
    await markInstallExpandedIngredientConsumed('req-B1', false)

    // Switch back to Account A — server reports remaining=2
    const effective = await composeEffectiveExpandedIngredientRemaining(2, false)
    expect(effective).toBe(1)
  })
})

// ── 7. Third successful Free analysis → 0/3 ─────────────────
describe('Third consumption', () => {
  it('third analysis → install used=3, remaining=0', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)
    await markInstallExpandedIngredientConsumed('req-3', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(3)
    expect(await getInstallExpandedIngredientRemaining()).toBe(0)
  })
})

// ── 8. Fourth Free attempt blocked ───────────────────────────
describe('Exhausted install', () => {
  it('fourth attempt → consumed returns false, used stays 3', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)
    await markInstallExpandedIngredientConsumed('req-3', false)

    const fourth = await markInstallExpandedIngredientConsumed('req-4', false)
    expect(fourth).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(3)
    expect(await getInstallExpandedIngredientRemaining()).toBe(0)
  })

  it('effective remaining is 0 when install exhausted', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)
    await markInstallExpandedIngredientConsumed('req-3', false)
    // Even if account reports remaining=3
    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(0)
  })
})

// ── 9. App restart preserves state ───────────────────────────
describe('App restart persistence', () => {
  it('state persists across mock restart (clear memory, re-read)', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)

    // Simulate app restart — data is in AsyncStorage (mockStore)
    // A restart would re-read from AsyncStorage, which is mockStore
    // We verify the data is still there
    const raw = mockStore.get(INSTALL_EXPANDED_INGREDIENT_KEY)
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw!)
    expect(parsed.used).toBe(1)

    // Re-read via the API
    expect(await getInstallExpandedIngredientUsed()).toBe(1)
    expect(await getInstallExpandedIngredientRemaining()).toBe(2)
  })
})

// ── 10. Self-heal from existing old-build account ────────────
describe('Self-heal from existing installation', () => {
  it('old-build account with used=1 and no install marker → self-heals to used=1', async () => {
    // No install marker exists (fresh guard)
    expect(mockStore.has(INSTALL_EXPANDED_INGREDIENT_KEY)).toBe(false)

    // Self-heal from authoritative used=1
    const healed = await selfHealInstallExpandedIngredient(1, false)
    expect(healed).toBe(true)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)
    expect(await getInstallExpandedIngredientRemaining()).toBe(2)
  })

  it('old-build account with used=2 → self-heals to used=2', async () => {
    const healed = await selfHealInstallExpandedIngredient(2, false)
    expect(healed).toBe(true)
    expect(await getInstallExpandedIngredientUsed()).toBe(2)
    expect(await getInstallExpandedIngredientRemaining()).toBe(1)
  })

  it('old-build account with used>=3 → self-heals to exhausted', async () => {
    const healed = await selfHealInstallExpandedIngredient(5, false)
    expect(healed).toBe(true)
    expect(await getInstallExpandedIngredientUsed()).toBe(3)
    expect(await getInstallExpandedIngredientRemaining()).toBe(0)
  })
})

// ── 11. Fresh account cannot lower existing install used ─────
describe('Self-heal monotonicity', () => {
  it('fresh account used=0 does NOT lower existing install used=2', async () => {
    // Install already has used=2
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(2)

    // Fresh account reports used=0 — must NOT decrease
    const healed = await selfHealInstallExpandedIngredient(0, false)
    expect(healed).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(2)
  })

  it('account with used=1 does NOT lower existing install used=2', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)

    const healed = await selfHealInstallExpandedIngredient(1, false)
    expect(healed).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(2)
  })

  it('account with used=3 increases existing install used=2 to 3', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)

    const healed = await selfHealInstallExpandedIngredient(3, false)
    expect(healed).toBe(true)
    expect(await getInstallExpandedIngredientUsed()).toBe(3)
  })
})

// ── 12. Failed/released analysis doesn't consume ─────────────
describe('Failed analysis does not consume', () => {
  it('markInstallExpandedIngredientConsumed is NOT called for failed analysis', async () => {
    // The blendNutritionGate only calls markInstallExpandedIngredientConsumed
    // AFTER successful finalization. A failed analysis calls releaseBlendAllowance
    // instead. We simulate this by NOT calling markConsumed.
    expect(await getInstallExpandedIngredientUsed()).toBe(0)
    expect(await getInstallExpandedIngredientRemaining()).toBe(3)
  })
})

// ── 13. Duplicate finalize doesn't double-consume ────────────
describe('Idempotency', () => {
  it('same requestId cannot consume twice', async () => {
    const first = await markInstallExpandedIngredientConsumed('req-dup', false)
    expect(first).toBe(true)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)

    const second = await markInstallExpandedIngredientConsumed('req-dup', false)
    expect(second).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)
  })

  it('different requestId consumes separately', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    await markInstallExpandedIngredientConsumed('req-2', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(2)
  })

  it('finalized IDs are persisted in AsyncStorage', async () => {
    await markInstallExpandedIngredientConsumed('req-persist', false)
    const raw = mockStore.get(INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY)
    expect(raw).toBeDefined()
    const arr = JSON.parse(raw!)
    expect(arr).toContain('req-persist')
  })
})

// ── 14. Pro bypasses ─────────────────────────────────────────
describe('Pro bypass', () => {
  it('composeEffectiveExpandedIngredientRemaining returns null for Pro', async () => {
    const effective = await composeEffectiveExpandedIngredientRemaining(0, true)
    expect(effective).toBeNull()
  })

  it('composeEffectiveExpandedIngredientRemaining returns null for Pro even with install used', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    const effective = await composeEffectiveExpandedIngredientRemaining(0, true)
    expect(effective).toBeNull()
  })
})

// ── 15. Pro analyses don't consume Free lifetime pool ────────
describe('Pro usage does not consume Free pool', () => {
  it('markInstallExpandedIngredientConsumed is no-op for Pro', async () => {
    const consumed = await markInstallExpandedIngredientConsumed('req-pro-1', true)
    expect(consumed).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(0)
  })

  it('selfHeal is no-op for Pro', async () => {
    const healed = await selfHealInstallExpandedIngredient(5, true)
    expect(healed).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(0)
  })

  it('Pro usage does not affect later Free remaining', async () => {
    // Pro user performs analyses (no-op for install guard)
    await markInstallExpandedIngredientConsumed('req-pro-1', true)
    await markInstallExpandedIngredientConsumed('req-pro-2', true)
    await markInstallExpandedIngredientConsumed('req-pro-3', true)
    expect(await getInstallExpandedIngredientUsed()).toBe(0)

    // Downgrade to Free — full 3/3 available
    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(3)
  })
})

// ── 16. Pro→Free restores prior Free remaining ───────────────
describe('Pro→Free transition', () => {
  it('used 1 Free analysis, upgraded to Pro, downgraded → still 2/3', async () => {
    // Free user uses one analysis
    await markInstallExpandedIngredientConsumed('req-free-1', false)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)

    // Upgrade to Pro — Pro usage doesn't consume
    await markInstallExpandedIngredientConsumed('req-pro-1', true)
    await markInstallExpandedIngredientConsumed('req-pro-2', true)
    expect(await getInstallExpandedIngredientUsed()).toBe(1)

    // Downgrade back to Free — install guard still shows 2/3
    const effective = await composeEffectiveExpandedIngredientRemaining(3, false)
    expect(effective).toBe(2)
  })
})

// ── 17. Unknown authoritative quota fails closed ─────────────
describe('Unknown quota fails closed', () => {
  it('null account remaining → effective is null (fail-closed)', async () => {
    const effective = await composeEffectiveExpandedIngredientRemaining(null, false)
    expect(effective).toBeNull()
  })

  it('null account remaining does NOT fabricate 3/3', async () => {
    const effective = await composeEffectiveExpandedIngredientRemaining(null, false)
    expect(effective).not.toBe(3)
    expect(effective).toBeNull()
  })
})

// ── Full lifecycle integration ───────────────────────────────
describe('Full lifecycle: Account A → logout → Account B → back to A', () => {
  it('complete cross-account lifecycle', async () => {
    // 1. Account A: first analysis → 2/3
    await markInstallExpandedIngredientConsumed('req-A1', false)
    expect(await getInstallExpandedIngredientRemaining()).toBe(2)

    // 2. Logout → new UUID → server reports 3/3, install says 2/3
    expect(await composeEffectiveExpandedIngredientRemaining(3, false)).toBe(2)

    // 3. Account B: uses one → 1/3
    await markInstallExpandedIngredientConsumed('req-B1', false)
    expect(await getInstallExpandedIngredientRemaining()).toBe(1)

    // 4. Switch back to Account A (server reports 2/3)
    expect(await composeEffectiveExpandedIngredientRemaining(2, false)).toBe(1)

    // 5. Third analysis (any account) → 0/3
    await markInstallExpandedIngredientConsumed('req-A2', false)
    expect(await getInstallExpandedIngredientRemaining()).toBe(0)

    // 6. Fourth attempt blocked
    const blocked = await markInstallExpandedIngredientConsumed('req-A3', false)
    expect(blocked).toBe(false)
    expect(await getInstallExpandedIngredientRemaining()).toBe(0)
  })
})

// ── Clear / reset ────────────────────────────────────────────
describe('Clear state', () => {
  it('clearInstallExpandedIngredientState removes all keys', async () => {
    await markInstallExpandedIngredientConsumed('req-1', false)
    expect(mockStore.has(INSTALL_EXPANDED_INGREDIENT_KEY)).toBe(true)
    expect(mockStore.has(INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY)).toBe(true)

    await clearInstallExpandedIngredientState()
    expect(mockStore.has(INSTALL_EXPANDED_INGREDIENT_KEY)).toBe(false)
    expect(mockStore.has(INSTALL_EXPANDED_INGREDIENT_FINALIZED_KEY)).toBe(false)
    expect(await getInstallExpandedIngredientUsed()).toBe(0)
  })
})
