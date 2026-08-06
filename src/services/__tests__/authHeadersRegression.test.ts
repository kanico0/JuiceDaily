// ─────────────────────────────────────────────────────────────
// authHeadersRegression.test.ts — Regression tests for Defect 2:
// missing apikey header in authenticated scan requests after login.
//
// Proves:
//   1. buildAuthedHeaders always includes apikey, even when extra
//      headers are provided.
//   2. buildAuthedHeaders does not allow extra to override apikey
//      or Authorization.
//   3. buildAuthedHeaders throws SupabaseConfigError when the anon
//      key is missing/blank (tested via jest.resetModules).
//   4. buildAuthedHeaders throws when a service-role key is detected.
//   5. getAccessToken does not fall back to signInAnonymously when
//      allowAnonFallback is false (post-login protection).
//   6. setAllowAnonFallback(true) re-enables the fallback.
//   7. buildAuthedHeaders preserves Content-Type from extra while
//      keeping apikey and Authorization authoritative.
// ─────────────────────────────────────────────────────────────

import { buildAuthedHeaders } from '../quota/supabaseHeaders'

jest.mock('../subscriptions/subscriptionConfig', () => ({
  SUPABASE_CONFIGURED: true,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-12345',
}))

describe('buildAuthedHeaders (Defect 2 — apikey always present)', () => {
  test('includes apikey, Authorization, and Content-Type', () => {
    const headers = buildAuthedHeaders('my-token-123')
    expect(headers.apikey).toBe('test-anon-key-12345')
    expect(headers.Authorization).toBe('Bearer my-token-123')
    expect(headers['Content-Type']).toBe('application/json')
  })

  test('extra headers cannot override apikey', () => {
    const headers = buildAuthedHeaders('my-token', {
      apikey: '',
      Authorization: 'Bearer wrong-token',
    })
    expect(headers.apikey).toBe('test-anon-key-12345')
    expect(headers.Authorization).toBe('Bearer my-token')
  })

  test('extra headers can override Content-Type but not apikey', () => {
    const headers = buildAuthedHeaders('tok', {
      'Content-Type': 'text/plain',
    })
    expect(headers['Content-Type']).toBe('text/plain')
    expect(headers.apikey).toBe('test-anon-key-12345')
    expect(headers.Authorization).toBe('Bearer tok')
  })

  test('defensive check restores apikey if extra sets it to undefined', () => {
    const headers = buildAuthedHeaders('tok', {
      apikey: undefined as unknown as string,
    })
    expect(headers.apikey).toBe('test-anon-key-12345')
  })

  test('throws SupabaseConfigError when anon key is blank', () => {
    jest.resetModules()
    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: '',
    }))
    const {
      buildAuthedHeaders: build,
      SupabaseConfigError: Err,
    } = require('../quota/supabaseHeaders')
    expect(() => build('token')).toThrow(Err)
    expect(() => build('token')).toThrow('Supabase anon key is not configured')
    jest.dontMock('../subscriptions/subscriptionConfig')
  })

  test('throws SupabaseConfigError when anon key is whitespace', () => {
    jest.resetModules()
    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: '   ',
    }))
    const {
      buildAuthedHeaders: build,
      SupabaseConfigError: Err,
    } = require('../quota/supabaseHeaders')
    expect(() => build('token')).toThrow(Err)
    jest.dontMock('../subscriptions/subscriptionConfig')
  })

  test('throws when a service-role key is detected', () => {
    jest.resetModules()
    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'sb_secret_service_role_key',
    }))
    const {
      buildAuthedHeaders: build,
      SupabaseConfigError: Err,
    } = require('../quota/supabaseHeaders')
    expect(() => build('token')).toThrow(Err)
    expect(() => build('token')).toThrow('Invalid Supabase key type')
    jest.dontMock('../subscriptions/subscriptionConfig')
  })
})

describe('getAccessToken anon fallback guard (Defect 2)', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('getAccessToken returns null when no session and fallback disabled', async () => {
    const mockGetSession = jest.fn().mockResolvedValue({
      data: { session: null },
    })

    jest.doMock('../supabase/supabaseClient', () => ({
      getSupabase: () => ({
        auth: {
          getSession: mockGetSession,
          signInAnonymously: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'new-anon' }, access_token: 'anon-token' } },
          }),
        },
      }),
      isSupabaseConfigured: () => true,
    }))

    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    }))

    const { getAccessToken, setAllowAnonFallback } = require('../supabase/identity')

    setAllowAnonFallback(false)

    const token = await getAccessToken()
    expect(token).toBeNull()
    expect(mockGetSession).toHaveBeenCalled()
  })

  test('getAccessToken returns token from session when available (fallback disabled)', async () => {
    const mockGetSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'durable-token-123',
          user: { id: 'user-123', email: 'test@test.com' },
        },
      },
    })

    jest.doMock('../supabase/supabaseClient', () => ({
      getSupabase: () => ({
        auth: {
          getSession: mockGetSession,
        },
      }),
      isSupabaseConfigured: () => true,
    }))

    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    }))

    const { getAccessToken, setAllowAnonFallback } = require('../supabase/identity')

    setAllowAnonFallback(false)

    const token = await getAccessToken()
    expect(token).toBe('durable-token-123')
  })

  test('getAccessToken falls back to ensureUser when fallback is enabled', async () => {
    const mockGetSession = jest.fn().mockResolvedValue({
      data: { session: null },
    })
    const mockSignInAnon = jest.fn().mockResolvedValue({
      data: { session: { user: { id: 'new-anon' }, access_token: 'anon-token' } },
      error: null,
    })

    jest.doMock('../supabase/supabaseClient', () => ({
      getSupabase: () => ({
        auth: {
          getSession: mockGetSession,
          signInAnonymously: mockSignInAnon,
        },
      }),
      isSupabaseConfigured: () => true,
    }))

    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    }))

    const { getAccessToken, setAllowAnonFallback } = require('../supabase/identity')

    setAllowAnonFallback(true)

    const token = await getAccessToken()
    expect(token).toBe('anon-token')
    expect(mockSignInAnon).toHaveBeenCalled()
  })

  test('setAllowAnonFallback(true) re-enables fallback after sign out', async () => {
    const mockGetSession = jest.fn().mockResolvedValue({
      data: { session: null },
    })

    const mockSignInAnon = jest.fn().mockResolvedValue({
      data: { session: { user: { id: 'new-anon' }, access_token: 'anon-token' } },
      error: null,
    })

    jest.doMock('../supabase/supabaseClient', () => ({
      getSupabase: () => ({
        auth: {
          getSession: mockGetSession,
          signInAnonymously: mockSignInAnon,
        },
      }),
      isSupabaseConfigured: () => true,
    }))

    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_CONFIGURED: true,
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    }))

    const { getAccessToken, setAllowAnonFallback } = require('../supabase/identity')

    // First: fallback disabled — should return null
    setAllowAnonFallback(false)
    const token1 = await getAccessToken()
    expect(token1).toBeNull()
    expect(mockSignInAnon).not.toHaveBeenCalled()

    // Re-enable — should create anon user
    setAllowAnonFallback(true)
    const token2 = await getAccessToken()
    expect(token2).toBe('anon-token')
    expect(mockSignInAnon).toHaveBeenCalled()
  })
})
