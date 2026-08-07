// ─────────────────────────────────────────────────────────────
// integrityLog.test.ts — Tests for sanitized Play Integrity
// observability logging.
//
// Proves:
//   1. sanitizeRequestId extracts the last hyphen-delimited segment
//      and truncates to 8 characters.
//   2. sanitizeRequestId returns 'unknown' for empty input.
//   3. integrityLog emits a structured [integrity-js] line with
//      stage, sid, ok, and optional reason/extra fields.
//   4. integrityLog never includes the full request ID.
//   5. integrityLog never includes tokens or credentials.
// ─────────────────────────────────────────────────────────────

import { sanitizeRequestId, integrityLog } from '../devicePool/integrityLog'

describe('sanitizeRequestId', () => {
  test('extracts last segment of a hyphenated UUID', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const sid = sanitizeRequestId(id)
    expect(sid).toBe('44665544')
    expect(sid.length).toBeLessThanOrEqual(8)
  })

  test('returns "unknown" for empty input', () => {
    expect(sanitizeRequestId('')).toBe('unknown')
  })

  test('handles whitespace-only input', () => {
    expect(sanitizeRequestId('   ')).toBe('   ')
  })

  test('handles short non-hyphenated IDs', () => {
    expect(sanitizeRequestId('abc123')).toBe('abc123')
  })

  test('truncates long last segments to 8 chars', () => {
    expect(sanitizeRequestId('prefix-abcdefgh123456')).toBe('abcdefgh')
  })
})

describe('integrityLog', () => {
  let debugSpy: jest.SpyInstance

  beforeEach(() => {
    debugSpy = jest.spyOn(console, 'debug').mockImplementation()
  })

  afterEach(() => {
    debugSpy.mockRestore()
  })

  test('emits structured line with stage, sid, ok', () => {
    integrityLog('pool_mode_resolved', 'req-abc12345', true)
    expect(debugSpy).toHaveBeenCalledTimes(1)
    const line = debugSpy.mock.calls[0][0] as string
    expect(line).toContain('[integrity-js]')
    expect(line).toContain('stage=pool_mode_resolved')
    expect(line).toContain('sid=abc12345')
    expect(line).toContain('ok=true')
  })

  test('includes reason code when provided', () => {
    integrityLog('native_error', 'req-abc12345', false, 'prepare_failed')
    const line = debugSpy.mock.calls[0][0] as string
    expect(line).toContain('reason=prepare_failed')
    expect(line).toContain('ok=false')
  })

  test('includes extra fields when provided', () => {
    integrityLog('provider_selected', 'req-abc12345', true, undefined, {
      provider: 'android_play_integrity',
    })
    const line = debugSpy.mock.calls[0][0] as string
    expect(line).toContain('provider=android_play_integrity')
  })

  test('never includes the full request ID', () => {
    const fullId = '550e8400-e29b-41d4-a716-446655440000'
    integrityLog('scan_request_sent', fullId, true)
    const line = debugSpy.mock.calls[0][0] as string
    expect(line).not.toContain(fullId)
    expect(line).toContain('sid=44665544')
  })

  test('never includes token-like values', () => {
    integrityLog('native_token_received', 'req-abc12345', true, 'success', {
      tokenPresent: true,
    })
    const line = debugSpy.mock.calls[0][0] as string
    expect(line).not.toMatch(/token=[A-Za-z0-9+\/=]{20,}/)
    expect(line).toContain('tokenPresent=true')
  })
})
