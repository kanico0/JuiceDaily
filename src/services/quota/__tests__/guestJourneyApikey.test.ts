// ─────────────────────────────────────────────────────────────
// guestJourneyApikey.test.ts — Verifies that guestJourneyService
// fetch calls include the Supabase apikey header.
// Does NOT mock guestJourneyService — only its dependencies.
// ─────────────────────────────────────────────────────────────

jest.mock('../../subscriptions/subscriptionConfig', () => ({
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-xxxx',
  SUPABASE_CONFIGURED: true,
}))

jest.mock('../../supabase/identity', () => ({
  getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  getUserId: jest.fn().mockResolvedValue('test-user-id'),
}))

jest.mock('../../supabase/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  getSupabase: jest.fn(() => null),
}))

import {
  checkGuestJourney,
  reserveGuestJourney,
  finalizeGuestScan,
  finalizeGuestLog,
  releaseGuestJourney,
} from '../guestJourneyService'

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

describe('guestJourneyService apikey header', () => {
  it('checkGuestJourney sends apikey header', async () => {
    mockFetchOk({ status: 'available' })

    await checkGuestJourney()

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })

  it('reserveGuestJourney sends apikey header', async () => {
    mockFetchOk({ ok: true, code: 'reserved' })

    await reserveGuestJourney('journey-1', 'scan')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('finalizeGuestScan sends apikey header', async () => {
    mockFetchOk({ ok: true, code: 'completed' })

    await finalizeGuestScan('journey-1')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })

  it('finalizeGuestLog sends apikey header', async () => {
    mockFetchOk({ ok: true, code: 'completed' })

    await finalizeGuestLog('journey-1', 'op-1')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })

  it('releaseGuestJourney sends apikey header', async () => {
    mockFetchOk({ ok: true, code: 'released' })

    await releaseGuestJourney('journey-1')

    const headers = getFetchHeaders(0)
    expect(headers.apikey).toBe('test-anon-key-xxxx')
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })
})
