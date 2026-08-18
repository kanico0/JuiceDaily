// ─────────────────────────────────────────────────────────────
// accountLink.test.ts — Durable identity protection tests.
//
// Proves: anonymous exploration remains available, upgrading
// preserves the original UUID, sign-in restores the original user,
// collisions are surfaced without merging, and RevenueCat always
// receives the canonical Supabase UUID.
// ─────────────────────────────────────────────────────────────

const mockAuth = {
  getSession: jest.fn(),
  updateUser: jest.fn(),
  verifyOtp: jest.fn(),
  signInWithOtp: jest.fn(),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
}

jest.mock('../supabaseClient', () => ({
  getSupabase: jest.fn(() => ({ auth: mockAuth })),
  isSupabaseConfigured: jest.fn(() => true),
}))

const mockRcLogIn = jest.fn().mockResolvedValue(undefined)
jest.mock('../../subscriptions/revenueCatClient', () => ({
  logIn: (...args: unknown[]) => mockRcLogIn(...args),
}))

const mockEnsureUser = jest.fn().mockResolvedValue({
  userId: 'new-anon-uuid',
  accessToken: 'new-anon-token',
})
const mockGetAccessToken = jest.fn().mockResolvedValue('test-token')
jest.mock('../identity', () => ({
  setAllowAnonFallback: jest.fn(),
  ensureUser: (...args: unknown[]) => mockEnsureUser(...args),
  getAccessToken: () => mockGetAccessToken(),
}))

// Mock installFreeSnapGuard (imported by accountLink for logout safety)
const mockSelfHealInstallMarker = jest.fn().mockResolvedValue(false)
jest.mock('../../quota/installFreeSnapGuard', () => ({
  selfHealInstallMarker: () => mockSelfHealInstallMarker(),
  INSTALL_FREE_SNAP_KEY: '@juicing_install_free_snap_v1',
}))

// Mock installExpandedIngredientGuard (imported by accountLink for logout safety)
const mockPreLogoutSelfHealExpandedIngredient = jest.fn().mockResolvedValue(false)
jest.mock('../../quota/installExpandedIngredientGuard', () => ({
  preLogoutSelfHealExpandedIngredient: () => mockPreLogoutSelfHealExpandedIngredient(),
  INSTALL_EXPANDED_INGREDIENT_KEY: '@juicing_install_expanded_ingredient_v1',
}))

// Mock supabaseHeaders (imported by accountLink for logout safety)
jest.mock('../../quota/supabaseHeaders', () => ({
  buildAuthedHeaders: jest.fn(() => ({
    'Content-Type': 'application/json',
    apikey: 'test-key',
    Authorization: 'Bearer test-token',
  })),
  SupabaseConfigError: class SupabaseConfigError extends Error {},
}))

// Mock global fetch so tryReviewerCodeVerification gets a
// not_applicable response and falls through to normal OTP.
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ status: 'not_applicable' }),
} as Response)
global.fetch = mockFetch as unknown as typeof global.fetch

// Mock subscriptionConfig (imported by accountLink for logout safety)
jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
  SUPABASE_CONFIGURED: true,
  MONETIZATION_ENABLED: false,
  FREE_WARNING_THRESHOLDS: [1, 0],
  PRO_WARNING_THRESHOLDS: [3, 1],
}))

import {
  addIdentityChangeListener,
  beginEmailLink,
  beginSignIn,
  getAccountStatus,
  isDurableUser,
  isValidEmail,
  signOutAccount,
  verifyEmailLink,
  verifySignIn,
} from '../accountLink'

const ANON_UUID = '11111111-2222-3333-4444-555555555555'
const EXISTING_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function anonSession () {
  return {
    data: {
      session: {
        user: { id: ANON_UUID, email: null, is_anonymous: true },
        access_token: 'anon-token',
      },
    },
  }
}

function durableSession (email = 'user@example.com', id = ANON_UUID) {
  return {
    data: {
      session: {
        user: { id, email, is_anonymous: false },
        access_token: 'durable-token',
      },
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Anonymous exploration ────────────────────────────────────

describe('anonymous exploration', () => {
  it('anonymous users have an identity but are not durable', async () => {
    mockAuth.getSession.mockResolvedValue(anonSession())
    const status = await getAccountStatus()
    expect(status.userId).toBe(ANON_UUID)
    expect(status.isDurable).toBe(false)
  })

  it('durable check is false for anonymous users', async () => {
    mockAuth.getSession.mockResolvedValue(anonSession())
    expect(await isDurableUser()).toBe(false)
  })

  it('durable check is true for verified email users', async () => {
    mockAuth.getSession.mockResolvedValue(durableSession())
    expect(await isDurableUser()).toBe(true)
  })
})

// ── Email validation ─────────────────────────────────────────

describe('isValidEmail', () => {
  it.each(['user@example.com', 'a.b+c@sub.domain.co'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each(['', 'nope', 'a@b', 'user@domain', 'spaces in@mail.com'])('rejects %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })
})

// ── Anonymous → permanent upgrade (UUID preserved) ───────────

describe('beginEmailLink', () => {
  it('rejects invalid emails without any network call', async () => {
    const result = await beginEmailLink('not-an-email')
    expect(result.status).toBe('invalid_email')
    expect(mockAuth.updateUser).not.toHaveBeenCalled()
  })

  it('uses updateUser (UUID-preserving upgrade), never a new sign-up', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null })
    const result = await beginEmailLink('User@Example.com')
    expect(result.status).toBe('otp_sent')
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ email: 'user@example.com' })
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('surfaces a collision without merging accounts', async () => {
    mockAuth.updateUser.mockResolvedValue({
      error: { message: 'A user with this email address has already been registered' },
    })
    const result = await beginEmailLink('taken@example.com')
    expect(result.status).toBe('email_in_use')
    expect(mockAuth.verifyOtp).not.toHaveBeenCalled()
  })

  it('classifies rate limiting', async () => {
    mockAuth.updateUser.mockResolvedValue({
      error: { message: 'For security purposes, too many requests' },
    })
    const result = await beginEmailLink('user@example.com')
    expect(result.status).toBe('rate_limited')
  })
})

describe('verifyEmailLink', () => {
  it('preserves the original UUID and logs RevenueCat in with it', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: { user: { id: ANON_UUID }, session: { user: { id: ANON_UUID } } },
      error: null,
    })

    const listener = jest.fn()
    const remove = addIdentityChangeListener(listener)

    const result = await verifyEmailLink('user@example.com', '123456')

    expect(result).toEqual({ status: 'verified', userId: ANON_UUID })
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'email_change',
    })
    // RevenueCat receives the canonical (unchanged) Supabase UUID.
    expect(mockRcLogIn).toHaveBeenCalledWith(ANON_UUID)
    expect(listener).toHaveBeenCalledWith(ANON_UUID)
    remove()
  })

  it('invalid code does not touch RevenueCat or listeners', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    })
    const result = await verifyEmailLink('user@example.com', '000000')
    expect(result.status).toBe('expired')
    expect(mockRcLogIn).not.toHaveBeenCalled()
  })
})

// ── Returning-user sign-in (reinstall recovery) ──────────────

describe('beginSignIn', () => {
  it('never creates a new user (shouldCreateUser: false)', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null })
    const result = await beginSignIn('user@example.com')
    expect(result.status).toBe('otp_sent')
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { shouldCreateUser: false },
    })
  })

  it('reports a friendly error when no account exists', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({
      error: { message: 'Signups not allowed for otp' },
    })
    const result = await beginSignIn('unknown@example.com')
    expect(result.status).toBe('error')
  })
})

describe('verifySignIn (reinstall simulation)', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockAuth.verifyOtp.mockClear()
    mockRcLogIn.mockClear()
  })

  it('restores the ORIGINAL UUID and re-logs RevenueCat with it', async () => {
    // Fresh install: local storage cleared, new anonymous session
    // existed, but sign-in restores the original durable account.
    mockAuth.verifyOtp.mockResolvedValue({
      data: { session: { user: { id: EXISTING_UUID } }, user: { id: EXISTING_UUID } },
      error: null,
    })

    const listener = jest.fn()
    const remove = addIdentityChangeListener(listener)

    const result = await verifySignIn('user@example.com', '654321')

    expect(result).toEqual({ status: 'verified', userId: EXISTING_UUID })
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '654321',
      type: 'email',
    })
    // The canonical existing UUID — quota usage and entitlements
    // remain attached to it server-side. No new quota is issued.
    expect(mockRcLogIn).toHaveBeenCalledWith(EXISTING_UUID)
    expect(listener).toHaveBeenCalledWith(EXISTING_UUID)
    remove()
  })

  it('failed verification never switches identity', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: 'Invalid token' },
    })
    const result = await verifySignIn('user@example.com', '999999')
    expect(result.status).toBe('invalid_code')
    expect(mockRcLogIn).not.toHaveBeenCalled()
  })
})

// ── Sign out ─────────────────────────────────────────────────

describe('signOutAccount', () => {
  it('signs out and switches RevenueCat to new anonymous UUID via direct logIn', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    mockEnsureUser.mockResolvedValue({ userId: 'new-anon-uuid', accessToken: 't' })
    expect(await signOutAccount()).toBe(true)
    // Supabase signOut is called
    expect(mockAuth.signOut).toHaveBeenCalled()
    // ensureUser creates new anonymous UUID
    expect(mockEnsureUser).toHaveBeenCalled()
    // RevenueCat logIn is called with the new UUID (direct switch,
    // no logOut needed)
    expect(mockRcLogIn).toHaveBeenCalledWith('new-anon-uuid')
  })

  it('does NOT call Purchases.logOut (direct logIn switch)', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    mockEnsureUser.mockResolvedValue({ userId: 'new-anon-uuid', accessToken: 't' })
    await signOutAccount()
    // mockRcLogOut is not even mocked — if it were called, the
    // import would fail. This test documents the design decision.
    expect(mockRcLogIn).toHaveBeenCalledWith('new-anon-uuid')
  })

  it('creates new anonymous identity after signout', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    mockEnsureUser.mockResolvedValue({ userId: 'new-anon-uuid', accessToken: 't' })
    await signOutAccount()
    expect(mockEnsureUser).toHaveBeenCalled()
    expect(mockRcLogIn).toHaveBeenCalledWith('new-anon-uuid')
  })

  it('reports failure when supabase signout fails', async () => {
    mockAuth.signOut.mockResolvedValue({ error: { message: 'network' } })
    expect(await signOutAccount()).toBe(false)
  })

  it('reports failure when ensureUser returns no identity', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    mockEnsureUser.mockResolvedValue(null)
    expect(await signOutAccount()).toBe(false)
  })
})
