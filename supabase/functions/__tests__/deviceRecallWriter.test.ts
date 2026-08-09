// ─────────────────────────────────────────────────────────────
// deviceRecallWriter.test.ts — Tests for the server-to-server
// Device Recall write implementation with bounded retries.
//
// Tests:
// - Successful write on first attempt
// - Retryable failure then success on retry 2
// - All 3 attempts fail with retryable errors
// - Non-retryable failure (4xx) stops immediately
// - Empty write values returns immediately
// - Total attempts = 3 (not 4)
// - Residual risk classification
// ─────────────────────────────────────────────────────────────

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock the getAccessToken function from playIntegrityVerifier
jest.mock('../_shared/playIntegrityVerifier', () => ({
  getAccessToken: jest.fn().mockResolvedValue('mock-oauth-token'),
}))

// Mock the integrityServerLog
jest.mock('../_shared/integrityServerLog', () => ({
  serverIntegrityLog: jest.fn(),
}))

import { writeDeviceRecall } from '../_shared/deviceRecallWriter'

const baseOpts = {
  integrityToken: 'mock-token',
  packageName: 'com.juicingapp.app',
  serviceAccountJson: '{}',
  operation: 'snap',
}

describe('writeDeviceRecall', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('succeeds on first attempt', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(1)
    expect(result.residualRisk).toBe('none')
  })

  it('retries on 500 and succeeds on attempt 2', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { message: 'server error' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(result.residualRisk).toBe('none')
  })

  it('retries on 429 and succeeds on attempt 3', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: { message: 'rate limited' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(3)
  })

  it('fails after 3 retryable attempts with bounded best-effort undercount risk', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(3)
    expect(result.residualRisk).toBe('bounded_best_effort_undercount')
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('does NOT retry on non-retryable 400 error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(1)
    expect(result.residualRisk).toBe('bounded_best_effort_undercount')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns immediately with no write when newValues is empty', async () => {
    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: {},
    })

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(0)
    expect(result.reasonCode).toBe('no_bits_to_write')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('retries on network error (fetch throws)', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
  })

  it('classifies all-retries-failed as bounded_best_effort_undercount (not self-healing)', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitSecond: true, bitThird: false },
      operation: 'blend',
    })

    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(3)
    expect(result.residualRisk).toBe('bounded_best_effort_undercount')
  })

  it('total attempts never exceeds 3', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      // This 4th mock should never be called
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const result = await writeDeviceRecall({
      ...baseOpts,
      newValues: { bitFirst: true },
    })

    expect(result.attempts).toBe(3)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})
