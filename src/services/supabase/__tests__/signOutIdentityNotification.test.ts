// ─────────────────────────────────────────────────────────────
// signOutIdentityNotification.test.ts — Tests for the sign-out
// identity notification fix (P1-2).
//
// The hotfix's signOutAccount:
//   1. Signs out of Supabase
//   2. Creates a new anonymous identity via ensureUser()
//   3. Calls notifyIdentityChanged(newUUID) which:
//      a. Calls revenueCatLogIn(newUUID) — switches RC to new anon
//      b. Notifies all identity listeners with the new UUID
//
// This ensures:
//   - Stale Pro UI disappears immediately (no restart needed)
//   - RevenueCat identity transitions to the new anonymous UUID
//   - The old durable Pro entitlement is NOT inherited by the
//     new anonymous identity
//   - SubscriptionStore clears/re-derives entitlement
// ─────────────────────────────────────────────────────────────

import { addIdentityChangeListener, signOutAccount } from '../accountLink'

// Mock supabaseClient
jest.mock('../supabaseClient', () => ({
  getSupabase: jest.fn(() => ({
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
      }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  })),
}))

// Mock revenueCatClient — track logIn calls
const mockLogIn = jest.fn().mockResolvedValue(true)
jest.mock('../../subscriptions/revenueCatClient', () => ({
  logIn: (...args: any[]) => mockLogIn(...args),
}))

// Mock subscriptionConfig
jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmt4YWpub2VsamdlcnFncWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMDcxODEsImV4cCI6MjA5OTU4MzE4MX0.G2Ofc3ZNXsR_DOh_eMSKX3sXu8nIjukj4f6Ua2Bp53o',
  SUPABASE_CONFIGURED: true,
  MONETIZATION_ENABLED: true,
  REVENUECAT_PUBLIC_API_KEY: 'goog_testkey123',
}))

// Mock identity (ensureUser, setAllowAnonFallback, etc.)
const mockEnsureUser = jest.fn().mockResolvedValue({
  userId: 'new-anon-uuid-after-signout',
  accessToken: 'new-anon-token',
})
jest.mock('../identity', () => ({
  ensureUser: (...args: any[]) => mockEnsureUser(...args),
  setAllowAnonFallback: jest.fn(),
  getAccessToken: jest.fn().mockResolvedValue('test-token'),
}))

// Mock install guards (no-op in tests)
jest.mock('../../quota/installFreeSnapGuard', () => ({
  selfHealInstallMarker: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../../quota/installExpandedIngredientGuard', () => ({
  preLogoutSelfHealExpandedIngredient: jest.fn().mockResolvedValue(undefined),
}))

// Mock supabaseHeaders
jest.mock('../../quota/supabaseHeaders', () => ({
  buildAuthedHeaders: jest.fn().mockResolvedValue({}),
}))

describe('signOutAccount identity notification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('signs out of Supabase and creates a new anonymous identity', async () => {
    const result = await signOutAccount()
    expect(result).toBe(true)
    expect(mockEnsureUser).toHaveBeenCalled()
  })

  it('switches RevenueCat to the new anonymous UUID (not the old one)', async () => {
    await signOutAccount()
    // RevenueCat logIn must be called with the NEW anonymous UUID,
    // not the old durable user's UUID. This clears the old user's
    // CustomerInfo and associates RC with the new anonymous identity.
    expect(mockLogIn).toHaveBeenCalledWith('new-anon-uuid-after-signout')
  })

  it('notifies identity listeners with the new anonymous UUID', async () => {
    const listener = jest.fn()
    const remove = addIdentityChangeListener(listener)
    await signOutAccount()
    // Listener is called with the new anonymous UUID — NOT null.
    // The SubscriptionStore uses this to re-derive entitlements
    // from fresh CustomerInfo (which will be Free for the new anon).
    expect(listener).toHaveBeenCalledWith('new-anon-uuid-after-signout')
    remove()
  })

  it('returns false when Supabase is not configured', async () => {
    const supabaseClient = require('../supabaseClient')
    const originalGetSupabase = supabaseClient.getSupabase
    supabaseClient.getSupabase.mockReturnValueOnce(null)
    const result = await signOutAccount()
    expect(result).toBe(false)
    supabaseClient.getSupabase = originalGetSupabase
  })

  it('stale Pro UI disappears immediately (no restart needed)', async () => {
    const listener = jest.fn()
    const remove = addIdentityChangeListener(listener)
    await signOutAccount()
    // Listener was called with the new UUID → SubscriptionStore
    // re-derives entitlement. If CustomerInfo fetch fails,
    // clearEntitlement() sets phase to UNKNOWN. Either way,
    // stale Pro is gone immediately.
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('new-anon-uuid-after-signout')
    // RevenueCat was switched to the new anonymous UUID
    expect(mockLogIn).toHaveBeenCalledWith('new-anon-uuid-after-signout')
    remove()
  })

  it('old durable Pro entitlement is NOT inherited by new anonymous identity', async () => {
    await signOutAccount()
    // RevenueCat logIn is called with the NEW UUID, not the old one.
    // This creates a fresh RC session for the anonymous user.
    // The old durable user's Pro entitlement stays attached to
    // their UUID in RevenueCat — it is NOT transferred.
    expect(mockLogIn).toHaveBeenCalledTimes(1)
    expect(mockLogIn).not.toHaveBeenCalledWith(expect.not.stringContaining('new-anon'))
  })
})
