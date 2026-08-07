import { getSupabase } from '../supabase/supabaseClient'

jest.mock('react-native-url-polyfill/auto', () => ({}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}))

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'android' },
}))

jest.mock('../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-1234',
  SUPABASE_CONFIGURED: true,
  MONETIZATION_ENABLED: true,
  FREE_MONTHLY_SCAN_LIMIT: 5,
  PRO_MONTHLY_SCAN_LIMIT: 60,
  PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
  FREE_WARNING_THRESHOLDS: [2, 1],
  PRO_WARNING_THRESHOLDS: [10, 5],
  REVENUECAT_PUBLIC_API_KEY: 'goog_test_key',
  PRO_ENTITLEMENT_ID: 'pro',
  DEFAULT_OFFERING_ID: 'default',
  APPLE_PRODUCT_IDS: { monthly: 'm', annual: 'a' },
  GOOGLE_SUBSCRIPTION_ID: 'sub',
  GOOGLE_BASE_PLANS: { monthly: 'm', annual: 'a' },
  TERMS_URL: null,
  PRIVACY_URL: null,
}))

describe('Supabase fetch interceptor — apikey enforcement', () => {
  let originalFetch: typeof globalThis.fetch
  let mockFetch: jest.Mock

  beforeAll(() => {
    originalFetch = globalThis.fetch
    mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response),
    )
    globalThis.fetch = mockFetch
    getSupabase()
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('16. every production Supabase direct fetch includes apikey', async () => {
    await globalThis.fetch('https://test-project.supabase.co/auth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const call = mockFetch.mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('apikey')).toBe('test-anon-key-1234')
  })

  it('17. background startup request includes apikey', async () => {
    await globalThis.fetch('https://test-project.supabase.co/auth/v1/session', {
      headers: {},
    })

    const call = mockFetch.mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('apikey')).toBeTruthy()
  })

  it('20. caller extras cannot remove or blank apikey', async () => {
    await globalThis.fetch('https://test-project.supabase.co/functions/v1/analyze-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: '',
      },
    })

    const call = mockFetch.mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('apikey')).toBe('test-anon-key-1234')
  })

  it('21. retries preserve required headers', async () => {
    for (let i = 0; i < 3; i++) {
      await globalThis.fetch('https://test-project.supabase.co/auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    }

    for (let i = 0; i < 3; i++) {
      const call = mockFetch.mock.calls[i]
      const init = call[1] as RequestInit
      const headers = new Headers(init.headers)
      expect(headers.get('apikey')).toBe('test-anon-key-1234')
    }
  })

  it('22. missing configuration fails before network activity', () => {
    jest.resetModules()
    jest.doMock('../subscriptions/subscriptionConfig', () => ({
      SUPABASE_URL: null,
      SUPABASE_ANON_KEY: null,
      SUPABASE_CONFIGURED: false,
      MONETIZATION_ENABLED: false,
      FREE_MONTHLY_SCAN_LIMIT: 5,
      PRO_MONTHLY_SCAN_LIMIT: 60,
      PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
      FREE_WARNING_THRESHOLDS: [2, 1],
      PRO_WARNING_THRESHOLDS: [10, 5],
      REVENUECAT_PUBLIC_API_KEY: null,
      PRO_ENTITLEMENT_ID: 'pro',
      DEFAULT_OFFERING_ID: 'default',
      APPLE_PRODUCT_IDS: { monthly: 'm', annual: 'a' },
      GOOGLE_SUBSCRIPTION_ID: 'sub',
      GOOGLE_BASE_PLANS: { monthly: 'm', annual: 'a' },
      TERMS_URL: null,
      PRIVACY_URL: null,
    }))

    const { getSupabase } = require('../supabase/supabaseClient')
    const client = getSupabase()
    expect(client).toBeNull()
  })

  it('does not intercept non-Supabase requests', async () => {
    await globalThis.fetch('https://api.revenuecat.com/v1/subscribers', {
      headers: { Authorization: 'Bearer xyz' },
    })

    const call = mockFetch.mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('apikey')).toBeNull()
  })

  it('25. the exact previously failing request is covered by regression test', async () => {
    await globalThis.fetch(
      'https://test-project.supabase.co/auth/v1/token?grant_type=refresh_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'mock' }),
      },
    )

    const call = mockFetch.mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('apikey')).toBe('test-anon-key-1234')
  })
})
