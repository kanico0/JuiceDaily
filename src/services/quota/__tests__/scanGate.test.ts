// ─────────────────────────────────────────────────────────────
// scanGate.test.ts — First-funded-scan durable-auth gate tests.
//
// Proves: the first funded scan requires durable authentication,
// no scan is reserved or consumed before auth, quota remains
// server-authoritative, and clearing local storage cannot mint a
// new free allowance (the gate blocks anonymous scans entirely).
// ─────────────────────────────────────────────────────────────

const mockIsDurableUser = jest.fn()
const mockRefreshDurable = jest.fn()
jest.mock('../../supabase/accountLink', () => ({
  isDurableUser: () => mockIsDurableUser(),
  refreshSessionAndCheckDurable: () => mockRefreshDurable(),
}))

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
}))

jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
}))

jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test-project.supabase.co',
}))

import { analyzeScanOnServer, ScanQuotaError } from '../quotaService'

const originalFetch = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

describe('durable-account scan gate', () => {
  it('anonymous users cannot start a funded scan', async () => {
    mockIsDurableUser.mockResolvedValue(false)

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-1')
    ).rejects.toMatchObject({ name: 'ScanQuotaError', code: 'account_required' })
  })

  it('no scan is reserved or consumed before authentication', async () => {
    mockIsDurableUser.mockResolvedValue(false)

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-2')
    ).rejects.toBeInstanceOf(ScanQuotaError)

    // The gate throws BEFORE any network request — the server never
    // sees the scan, so nothing can be reserved or consumed.
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('clearing local storage cannot issue another free allowance', async () => {
    // Simulates a fresh anonymous session after storage was cleared:
    // the user is anonymous again, so funded scans stay blocked and
    // the server-side quota (keyed to the durable UUID) is untouched.
    mockIsDurableUser.mockResolvedValue(false)

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-3')
    ).rejects.toMatchObject({ code: 'account_required' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('durable users pass through to the server-authoritative path', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        rawText: '[]',
        quota: {
          plan: 'free',
          limit: 5,
          used: 1,
          remaining: 4,
          periodStart: '2026-07-01',
          periodEnd: '2026-08-01',
        },
      }),
    })

    const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-4')

    expect(result.rawText).toBe('[]')
    // Quota values come from the SERVER response — never client-side.
    expect(result.quota).toMatchObject({ plan: 'free', limit: 5, used: 1, remaining: 4 })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-project.supabase.co/functions/v1/analyze-scan',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      })
    )
  })

  it('server 429 remains authoritative for limits', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ code: 'monthly_limit_reached', message: 'Limit reached' }),
    })

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-5')
    ).rejects.toMatchObject({ code: 'monthly_limit_reached' })
  })

  it('failed authentication surfaces without consuming quota', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    })

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-6')
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

describe('stale-token session refresh (post email upgrade)', () => {
  function reject403 () {
    return {
      ok: false,
      status: 403,
      json: async () => ({ code: 'account_required', message: 'Account required' }),
    }
  }

  it('refreshes once and retries with the SAME requestId when the refreshed user is permanent', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockRefreshDurable.mockResolvedValue(true)
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(reject403())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ rawText: '[]', quota: null }),
      })

    const result = await analyzeScanOnServer('base64data', 'image/jpeg', 'req-stale-1')

    expect(result.rawText).toBe('[]')
    expect(mockRefreshDurable).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    // Idempotent retry: identical requestId on both attempts — the
    // server dedupes, so no duplicate charge is possible.
    const firstBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    const secondBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
    expect(firstBody.requestId).toBe('req-stale-1')
    expect(secondBody.requestId).toBe('req-stale-1')
  })

  it('does NOT retry when the refreshed user is still anonymous', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockRefreshDurable.mockResolvedValue(false)
    ;(global.fetch as jest.Mock).mockResolvedValue(reject403())

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-stale-2')
    ).rejects.toMatchObject({ code: 'account_required' })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries at most once — a second 403 is surfaced, not looped', async () => {
    mockIsDurableUser.mockResolvedValue(true)
    mockRefreshDurable.mockResolvedValue(true)
    ;(global.fetch as jest.Mock).mockResolvedValue(reject403())

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-stale-3')
    ).rejects.toMatchObject({ code: 'account_required' })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(mockRefreshDurable).toHaveBeenCalledTimes(1)
  })

  it('local anonymous gate never triggers a network call or refresh', async () => {
    mockIsDurableUser.mockResolvedValue(false)

    await expect(
      analyzeScanOnServer('base64data', 'image/jpeg', 'req-stale-4')
    ).rejects.toMatchObject({ code: 'account_required' })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockRefreshDurable).not.toHaveBeenCalled()
  })
})
