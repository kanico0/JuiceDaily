// ─────────────────────────────────────────────────────────────
// integrityServerLog.test.ts — Tests for server-side sanitized
// Play Integrity observability logging.
//
// Proves:
//   1. sanitizeRequestId extracts last hyphen segment, truncates to 8.
//   2. maskUserId masks all but first 4 chars.
//   3. maskDeviceRecallKey masks all but first 6 chars.
//   4. serverIntegrityLog emits [integrity-server] structured line.
//   5. serverIntegrityLog never includes full request IDs or tokens.
// ─────────────────────────────────────────────────────────────

import {
  sanitizeRequestId,
  maskUserId,
  maskDeviceRecallKey,
  serverIntegrityLog,
} from '../_shared/integrityServerLog'

describe('sanitizeRequestId (server)', () => {
  it('extracts last segment of a hyphenated UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(sanitizeRequestId(id)).toBe('44665544')
  })

  it('returns "unknown" for empty input', () => {
    expect(sanitizeRequestId('')).toBe('unknown')
  })

  it('truncates long last segments to 8 chars', () => {
    expect(sanitizeRequestId('prefix-abcdefgh123456')).toBe('abcdefgh')
  })
})

describe('maskUserId', () => {
  it('masks all but first 4 chars of a UUID', () => {
    const uid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const masked = maskUserId(uid)
    expect(masked).toBe('aaaa****')
    expect(masked).not.toContain(uid)
  })

  it('returns "****" for short IDs', () => {
    expect(maskUserId('abc')).toBe('****')
  })
})

describe('maskDeviceRecallKey', () => {
  it('masks all but first 6 chars', () => {
    const key = 'dr_110_2024-01-15T00:00:00Z'
    const masked = maskDeviceRecallKey(key)
    expect(masked).toBe('dr_110****')
    expect(masked).not.toContain(key.slice(6))
  })

  it('returns "****" for short keys', () => {
    expect(maskDeviceRecallKey('short')).toBe('****')
  })
})

describe('serverIntegrityLog', () => {
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('emits structured [integrity-server] line with stage, sid, ok', () => {
    serverIntegrityLog('request_accepted', 'req-abc12345', true)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const line = logSpy.mock.calls[0][0] as string
    expect(line).toContain('[integrity-server]')
    expect(line).toContain('stage=request_accepted')
    expect(line).toContain('sid=abc12345')
    expect(line).toContain('ok=true')
  })

  it('includes reason code when provided', () => {
    serverIntegrityLog('verification_result', 'req-abc12345', false, 'stale_token')
    const line = logSpy.mock.calls[0][0] as string
    expect(line).toContain('reason=stale_token')
    expect(line).toContain('ok=false')
  })

  it('includes extra fields when provided', () => {
    serverIntegrityLog('pool_mode', 'req-abc12345', true, undefined, { mode: 'observe' })
    const line = logSpy.mock.calls[0][0] as string
    expect(line).toContain('mode=observe')
  })

  it('never includes the full request ID', () => {
    const fullId = '550e8400-e29b-41d4-a716-446655440000'
    serverIntegrityLog('verify_called', fullId, true)
    const line = logSpy.mock.calls[0][0] as string
    expect(line).not.toContain(fullId)
    expect(line).toContain('sid=44665544')
  })
})
