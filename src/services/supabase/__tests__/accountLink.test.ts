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
  it('signs out locally (server data stays keyed to the UUID)', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    expect(await signOutAccount()).toBe(true)
  })

  it('reports failure', async () => {
    mockAuth.signOut.mockResolvedValue({ error: { message: 'network' } })
    expect(await signOutAccount()).toBe(false)
  })
})
