// ─────────────────────────────────────────────────────────────
// nullKeyHardening.test.ts — Tests proving that blank, missing,
// or invalid Supabase anon keys are rejected BEFORE any network
// request is made, and that no empty apikey header is ever sent.
// ─────────────────────────────────────────────────────────────

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getUserId: jest.fn().mockResolvedValue('test-user-id'),
}))

jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabase: jest.fn(() => null),
}))

jest.mock('../../supabase/accountLink', () => ({
  isDurableUser: jest.fn().mockResolvedValue(true),
  refreshSessionAndCheckDurable: jest.fn().mockResolvedValue(false),
}))

const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

function mockFetchOk (body: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  })
}

function getFetchHeaders (callIndex = 0): Record<string, string> {
  const call = (global.fetch as jest.Mock).mock.calls[callIndex]
  if (!call) return {}
  return call[1]?.headers ?? {}
}

const GUEST_MOCK = {
  isDurableUser: jest.fn().mockResolvedValue(true),
  checkGuestJourney: jest.fn().mockResolvedValue({
    status: 'available',
    journeyId: null,
    scanRequestId: null,
    logOperationId: null,
    scanCompletedAt: null,
    logCompletedAt: null,
  }),
  reserveGuestJourney: jest.fn().mockResolvedValue({ ok: true, code: 'reserved' }),
  releaseGuestJourney: jest.fn().mockResolvedValue({ ok: true, code: 'released' }),
  createJourneyId: jest.fn(() => 'guest-test-journey-id'),
  finalizeGuestScan: jest.fn(),
  finalizeGuestLog: jest.fn(),
  isGuestJourneyAvailable: jest.fn(),
  isGuestJourneyCompleted: jest.fn(),
}

function setupConfig (anonKey: string | null, withGuestMock = false) {
  jest.doMock('../../subscriptions/subscriptionConfig', () => ({
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_CONFIGURED: true,
    FREE_MONTHLY_SCAN_LIMIT: 5,
    PRO_MONTHLY_SCAN_LIMIT: 60,
    PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
    FREE_ADVANCED_BLEND_ALLOWANCE: 3,
  }))
  if (withGuestMock) {
    jest.doMock('../guestJourneyService', () => GUEST_MOCK)
  }
  jest.resetModules()
}

function restoreConfig () {
  jest.dontMock('../../subscriptions/subscriptionConfig')
  jest.dontMock('../guestJourneyService')
  jest.resetModules()
}

// ── Tests for supabaseHeaders helper ──

describe('buildAuthedHeaders — null/blank key rejection', () => {
  afterEach(() => restoreConfig())

  it('throws on null anon key before any fetch', () => {
    setupConfig(null)
    const { buildAuthedHeaders, SupabaseConfigError } = require('../supabaseHeaders')
    expect(() => buildAuthedHeaders('token')).toThrow(SupabaseConfigError)
    expect(() => buildAuthedHeaders('token')).toThrow('not configured')
  })

  it('throws on empty string anon key', () => {
    setupConfig('')
    const { buildAuthedHeaders, SupabaseConfigError } = require('../supabaseHeaders')
    expect(() => buildAuthedHeaders('token')).toThrow(SupabaseConfigError)
  })

  it('throws on whitespace-only anon key', () => {
    setupConfig('   ')
    const { buildAuthedHeaders, SupabaseConfigError } = require('../supabaseHeaders')
    expect(() => buildAuthedHeaders('token')).toThrow(SupabaseConfigError)
  })

  it('throws on service-role key (sb_secret_ prefix)', () => {
    setupConfig('sb_secret_abc123')
    const { buildAuthedHeaders, SupabaseConfigError } = require('../supabaseHeaders')
    expect(() => buildAuthedHeaders('token')).toThrow(SupabaseConfigError)
    expect(() => buildAuthedHeaders('token')).toThrow('Invalid Supabase key type')
  })

  it('throws on key containing service_role', () => {
    setupConfig('eyJservice_role_abc')
    const { buildAuthedHeaders, SupabaseConfigError } = require('../supabaseHeaders')
    expect(() => buildAuthedHeaders('token')).toThrow(SupabaseConfigError)
  })

  it('returns correct headers for valid anon key', () => {
    setupConfig('valid-anon-key-xxxx')
    const { buildAuthedHeaders } = require('../supabaseHeaders')
    const headers = buildAuthedHeaders('my-jwt-token')
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer my-jwt-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('preserves extra headers without overriding apikey or Authorization', () => {
    setupConfig('valid-anon-key-xxxx')
    const { buildAuthedHeaders } = require('../supabaseHeaders')
    const headers = buildAuthedHeaders('my-jwt-token', { 'X-Custom': 'yes' })
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer my-jwt-token')
    expect(headers['X-Custom']).toBe('yes')
  })
})

// ── Tests for quotaService (analyze-scan path) ──

describe('quotaService — null key prevents fetch', () => {
  afterEach(() => restoreConfig())

  it('null anon key: analyzeScanOnServer rejects with ScanQuotaError, fetch never called', async () => {
    setupConfig(null, true)
    const { analyzeScanOnServer } = require('../quotaService')
    mockFetchOk({ rawText: '[]', quota: null })

    await expect(
      analyzeScanOnServer('base64', 'image/jpeg', 'req-null')
    ).rejects.toMatchObject({
      name: 'ScanQuotaError',
      code: 'server_error',
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('empty anon key: analyzeScanOnServer rejects, fetch never called', async () => {
    setupConfig('', true)
    const { analyzeScanOnServer } = require('../quotaService')
    mockFetchOk({ rawText: '[]', quota: null })

    await expect(
      analyzeScanOnServer('base64', 'image/jpeg', 'req-empty')
    ).rejects.toMatchObject({ name: 'ScanQuotaError' })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('valid anon key: fetch is called with correct headers including apikey', async () => {
    setupConfig('valid-anon-key-xxxx', true)
    const { analyzeScanOnServer } = require('../quotaService')
    mockFetchOk({ rawText: '[]', quota: { plan: 'free', limit: 5, used: 1, remaining: 4 } })

    await analyzeScanOnServer('base64', 'image/jpeg', 'req-valid')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('valid anon key: 502 from server surfaces as server_error with Vision provider error', async () => {
    setupConfig('valid-anon-key-xxxx', true)
    const { analyzeScanOnServer } = require('../quotaService')
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: 'Vision provider error' }),
    })

    await expect(
      analyzeScanOnServer('base64', 'image/jpeg', 'req-502')
    ).rejects.toMatchObject({
      code: 'server_error',
      message: 'Vision provider error',
    })
  })
})

// ── Tests for guestJourneyService ──

describe('guestJourneyService — null key prevents fetch', () => {
  afterEach(() => restoreConfig())

  it('null anon key: reserveGuestJourney returns server_not_configured, fetch never called', async () => {
    setupConfig(null)
    const { reserveGuestJourney } = require('../guestJourneyService')
    mockFetchOk({ ok: true, code: 'reserved' })

    const result = await reserveGuestJourney('journey-1', 'scan')

    expect(result.ok).toBe(false)
    expect(result.code).toBe('server_not_configured')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('empty anon key: checkGuestJourney returns unavailable state, fetch never called', async () => {
    setupConfig('')
    const { checkGuestJourney } = require('../guestJourneyService')
    mockFetchOk({ status: 'available' })

    const state = await checkGuestJourney()

    expect(state.status).toBe('available')
    expect(state.journeyId).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('valid anon key: reserveGuestJourney sends apikey header', async () => {
    setupConfig('valid-anon-key-xxxx')
    const { reserveGuestJourney } = require('../guestJourneyService')
    mockFetchOk({ ok: true, code: 'reserved' })

    await reserveGuestJourney('journey-1', 'scan')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })

  it('valid anon key: releaseGuestJourney sends apikey header', async () => {
    setupConfig('valid-anon-key-xxxx')
    const { releaseGuestJourney } = require('../guestJourneyService')
    mockFetchOk({ ok: true, code: 'released' })

    await releaseGuestJourney('journey-1')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
  })
})

// ── Tests for blendAllowanceService ──

describe('blendAllowanceService — null key prevents fetch', () => {
  afterEach(() => restoreConfig())

  it('null anon key: reserveBlendAllowance throws BlendAllowanceError, fetch never called', async () => {
    setupConfig(null)
    const { reserveBlendAllowance, BlendAllowanceError } = require('../blendAllowanceService')
    mockFetchOk({ allowed: true, code: 'ok' })

    await expect(
      reserveBlendAllowance([{ produceId: 'apple' }, { produceId: 'carrot' }, { produceId: 'spinach' }, { produceId: 'ginger' }, { produceId: 'lemon' }], 'op-1')
    ).rejects.toMatchObject({
      name: 'BlendAllowanceError',
      code: 'server_not_configured',
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('valid anon key: reserveBlendAllowance sends apikey header', async () => {
    setupConfig('valid-anon-key-xxxx')
    const { reserveBlendAllowance } = require('../blendAllowanceService')
    mockFetchOk({
      allowed: true,
      code: 'ok',
      remaining: 2,
      used: 1,
      reserved: 0,
      limit: 3,
      plan: 'free',
      blend_type: 'advanced',
      request_id: 'op-1',
    })

    await reserveBlendAllowance(
      [{ produceId: 'apple' }, { produceId: 'carrot' }, { produceId: 'spinach' }, { produceId: 'ginger' }, { produceId: 'lemon' }],
      'op-1',
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('valid anon key: finalizeBlendAllowance sends apikey header', async () => {
    setupConfig('valid-anon-key-xxxx')
    const { finalizeBlendAllowance } = require('../blendAllowanceService')
    mockFetchOk({ ok: true })

    await finalizeBlendAllowance('op-1')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
  })

  it('valid anon key: releaseBlendAllowance sends apikey header', async () => {
    setupConfig('valid-anon-key-xxxx')
    const { releaseBlendAllowance } = require('../blendAllowanceService')
    mockFetchOk({ ok: true })

    await releaseBlendAllowance('op-1')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('valid-anon-key-xxxx')
  })
})

// ── Test: no empty apikey header is ever sent ──

describe('no empty apikey header is ever sent', () => {
  afterEach(() => restoreConfig())

  it('null key: no fetch call means no empty apikey header', async () => {
    setupConfig(null, true)
    const { analyzeScanOnServer } = require('../quotaService')
    mockFetchOk({ rawText: '[]' })

    try {
      await analyzeScanOnServer('base64', 'image/jpeg', 'req-no-empty')
    } catch {
      // expected
    }

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('valid key: apikey header is never empty string', async () => {
    setupConfig('valid-anon-key-xxxx', true)
    const { analyzeScanOnServer } = require('../quotaService')
    mockFetchOk({ rawText: '[]', quota: null })

    await analyzeScanOnServer('base64', 'image/jpeg', 'req-non-empty')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBeTruthy()
    expect(headers.apikey).not.toBe('')
    expect(headers.apikey.length).toBeGreaterThan(10)
  })
})
