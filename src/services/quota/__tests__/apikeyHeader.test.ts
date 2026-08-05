// ─────────────────────────────────────────────────────────────
// apikeyHeader.test.ts — Focused tests proving the Supabase
// apikey header is present on all Edge Function requests and
// that guest reservation lifecycle is correct on failure.
// ─────────────────────────────────────────────────────────────

const mockIsDurableUser = jest.fn()
const mockRefreshDurable = jest.fn()
const mockCheckGuestJourney = jest.fn()
const mockReserveGuestJourney = jest.fn()
const mockReleaseGuestJourney = jest.fn()

jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-xxxx',
  SUPABASE_CONFIGURED: true,
  FREE_MONTHLY_SCAN_LIMIT: 5,
  PRO_MONTHLY_SCAN_LIMIT: 60,
  PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
  FREE_ADVANCED_BLEND_ALLOWANCE: 3,
}))

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getUserId: jest.fn().mockResolvedValue('test-user-id'),
}))

jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabase: jest.fn(() => null),
}))

jest.mock('../../supabase/accountLink', () => ({
  isDurableUser: () => mockIsDurableUser(),
  refreshSessionAndCheckDurable: () => mockRefreshDurable(),
}))

jest.mock('../guestJourneyService', () => ({
  isDurableUser: () => mockIsDurableUser(),
  checkGuestJourney: () => mockCheckGuestJourney(),
  reserveGuestJourney: (...args: unknown[]) => mockReserveGuestJourney(...args),
  releaseGuestJourney: (...args: unknown[]) => mockReleaseGuestJourney(...args),
  createJourneyId: jest.fn(() => 'guest-test-journey-id'),
  finalizeGuestScan: jest.fn(),
  finalizeGuestLog: jest.fn(),
  isGuestJourneyAvailable: jest.fn(),
  isGuestJourneyCompleted: jest.fn(),
}))

import { analyzeScanOnServer } from '../quotaService'

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

function mockFetchStatus (status: number, body: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  })
}

function getFetchHeaders (callIndex = 0): Record<string, string> {
  const call = (global.fetch as jest.Mock).mock.calls[callIndex]
  if (!call) return {}
  return call[1]?.headers ?? {}
}

const AVAILABLE_GUEST = {
  status: 'available',
  journeyId: null,
  scanRequestId: null,
  logOperationId: null,
  scanCompletedAt: null,
  logCompletedAt: null,
}

const SCAN_COMPLETED_GUEST = {
  status: 'completed',
  journeyId: 'past',
  scanRequestId: null,
  logOperationId: null,
  scanCompletedAt: '2026-01-01T00:00:00Z',
  logCompletedAt: null,
}

// ── Tests 1-5: apikey header verification ──

describe('apikey header verification', () => {
  it('1. guest analysis request includes apikey header', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFetchOk({ rawText: '[]', quota: null })

    await analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('2. guest analysis request includes the current guest access token', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFetchOk({ rawText: '[]', quota: null })

    await analyzeScanOnServer('base64data', 'image/jpeg', 'req-2')

    const headers = getFetchHeaders(0)
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })

  it('3. registered-user requests remain correctly authenticated with apikey', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockFetchOk({ rawText: '[]', quota: { plan: 'free', limit: 5, used: 1, remaining: 4 } })

    await analyzeScanOnServer('base64data', 'image/jpeg', 'req-3')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('4. no service-role key is used client-side — only the anon key', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockFetchOk({ rawText: '[]', quota: null })

    await analyzeScanOnServer('base64data', 'image/jpeg', 'req-4')

    const headers = getFetchHeaders(0)
    const headerValues = Object.values(headers).join(' ')
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headerValues).not.toContain('service_role')
    expect(headerValues).not.toContain('service-role')
  })

  it('5. missing Supabase anon key fails safely with a sanitized error', async () => {
    // Re-mock subscriptionConfig with null anon key
    jest.doMock('../../subscriptions/subscriptionConfig', () => ({
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_ANON_KEY: null,
      SUPABASE_CONFIGURED: true,
      FREE_MONTHLY_SCAN_LIMIT: 5,
      PRO_MONTHLY_SCAN_LIMIT: 60,
      PRO_DAILY_SCAN_SAFETY_LIMIT: 10,
      FREE_ADVANCED_BLEND_ALLOWANCE: 3,
    }))
    jest.resetModules()

    const { analyzeScanOnServer: analyzeNoKey } = require('../quotaService')
    mockIsDurableUser.mockResolvedValue(true)

    await expect(
      analyzeNoKey('base64data', 'image/jpeg', 'req-5')
    ).rejects.toMatchObject({
      name: 'ScanQuotaError',
      code: 'server_error',
    })

    // Restore original mock
    jest.dontMock('../../subscriptions/subscriptionConfig')
    jest.resetModules()
  })
})

// ── Tests 6-8: Guest reservation release on failure ──

describe('guest reservation release on gateway failure', () => {
  it('6. a gateway authentication failure (401) releases the guest reservation', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFetchStatus(401, { message: 'No API key found in request' })

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-gateway-fail')
    ).rejects.toMatchObject({ code: 'unauthenticated' })

    expect(mockReleaseGuestJourney).toHaveBeenCalledWith('guest-test-journey-id')
  })

  it('7. scan_completed_at is not finalized on failed analysis', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFetchStatus(502, { message: 'Vision provider error' })

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-fail-no-finalize')
    ).rejects.toMatchObject({ code: 'server_error' })

    // The guest journey was released — not finalized
    expect(mockReleaseGuestJourney).toHaveBeenCalled()
  })
})

// ── Test 8: Guest can retry after failure ──

describe('guest retry after failure', () => {
  it('8. guest can retry after a failed analysis (reservation released)', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockReleaseGuestJourney.mockResolvedValue({ ok: true, code: 'released' })

    // First attempt fails
    mockFetchStatus(502, { message: 'Vision provider error' })
    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-retry-1')
    ).rejects.toMatchObject({ code: 'server_error' })

    expect(mockReleaseGuestJourney).toHaveBeenCalledTimes(1)

    // Second attempt succeeds — guest journey is available again
    jest.clearAllMocks()
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFetchOk({ rawText: '[{"produceId":"apple","name":"Apple","count":1,"estimatedWeightG":180,"confidence":0.9}]', quota: null })

    const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-retry-2')
    expect(result.rawText).toContain('apple')
    expect(mockReserveGuestJourney).toHaveBeenCalledWith(expect.any(String), 'scan')
  })
})

// ── Test 9: Successful first scan ──

describe('successful first scan', () => {
  it('9. a successful first scan completes without error and fetch is called once', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(AVAILABLE_GUEST)
    mockReserveGuestJourney.mockResolvedValue({ ok: true, code: 'reserved' })
    mockFetchOk({ rawText: '[]', quota: { plan: 'free', limit: 5, used: 1, remaining: 4 } })

    const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-success')

    expect(result.rawText).toBe('[]')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(mockReleaseGuestJourney).not.toHaveBeenCalled()
  })
})

// ── Test 10: True second guest scan remains blocked ──

describe('second guest scan blocked', () => {
  it('10. a true second guest scan (scanCompletedAt set) is blocked with account_required', async () => {
    mockIsDurableUser.mockResolvedValue(false)
    mockCheckGuestJourney.mockResolvedValue(SCAN_COMPLETED_GUEST)

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-second-scan')
    ).rejects.toMatchObject({ code: 'account_required' })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockReserveGuestJourney).not.toHaveBeenCalled()
  })
})

// ── Test 11: Deterministic auth error is not retried three times ──

describe('no triple retry for deterministic auth errors', () => {
  it('11. a deterministic 401 gateway error is NOT retried (fetch called once)', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockFetchStatus(401, { message: 'No API key found in request' })

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-no-retry')
    ).rejects.toMatchObject({ code: 'unauthenticated' })

    // The durable-user retry path only retries on 'account_required' (403),
    // NOT on 'unauthenticated' (401). So fetch is called exactly once.
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(mockRefreshDurable).not.toHaveBeenCalled()
  })

  it('11b. a 403 account_required retries at most once (2 fetch calls total)', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockRefreshDurable.mockResolvedValue(true)
    mockFetchStatus(403, { code: 'account_required', message: 'Account required' })

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-retry-once')
    ).rejects.toMatchObject({ code: 'account_required' })

    // Retried once after refresh, then second 403 is surfaced — total 2 calls
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(mockRefreshDurable).toHaveBeenCalledTimes(1)
  })
})
