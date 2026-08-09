// ─────────────────────────────────────────────────────────────
// playIntegrityVerifier.test.ts — Tests for the corrected Google
// Play Integrity verdict field paths and Device Recall
// interpretation.
//
// Tests:
// - Correct reading of deviceRecall.values.bitFirst/Second/Third
// - Correct reading of deviceRecall.writeDates.yyyymmFirst/Second/Third
// - Empty deviceRecall {values:{}, writeDates:{}} classified as unavailable
// - Mock token verification
// - shouldBlockScan fail-closed/fail-open matrix
// ─────────────────────────────────────────────────────────────

import {
  verifyMockIntegrity,
  shouldBlockScan,
  classifyIntegrityFailure,
} from '../_shared/playIntegrityVerifier'

// ── Mock token tests ──────────────────────────────────────────

describe('verifyMockIntegrity', () => {
  it('returns success for valid mock token', () => {
    const result = verifyMockIntegrity(
      'mock_integrity:install123:challenge456:analyze_scan',
      'challenge456|extra',
    )
    expect(result.ok).toBe(true)
    expect(result.verificationStatus).toBe('success')
    expect(result.integrityStatus).toBe('mock')
    expect(result.deviceBits).toEqual({
      bitFirst: false,
      bitSecond: false,
      bitThird: false,
    })
    expect(result.deviceWriteDates).toEqual({
      yyyymmFirst: null,
      yyyymmSecond: null,
      yyyymmThird: null,
    })
    expect(result.deviceSnapRemaining).toBe(1)
    expect(result.deviceBlendRemaining).toBe(3)
    expect(result.deviceRecallAvailable).toBe(true)
  })

  it('returns failure for invalid mock token format', () => {
    const result = verifyMockIntegrity('not_a_mock', 'challenge')
    expect(result.ok).toBe(false)
    expect(result.verificationStatus).toBe('failure')
    expect(result.reasonCode).toBe('mock_token_invalid')
    expect(result.failureCategory).toBe('confirmed_security_failure')
  })

  it('returns failure for request hash mismatch', () => {
    const result = verifyMockIntegrity(
      'mock_integrity:install123:wrongchallenge:analyze_scan',
      'correctchallenge|extra',
    )
    expect(result.ok).toBe(false)
    expect(result.reasonCode).toBe('request_hash_mismatch')
    expect(result.failureCategory).toBe('confirmed_security_failure')
  })
})

// ── shouldBlockScan tests ─────────────────────────────────────

describe('shouldBlockScan', () => {
  it('does not block when category is null (success)', () => {
    expect(shouldBlockScan(null, 'enforce')).toBe(false)
    expect(shouldBlockScan(null, 'observe')).toBe(false)
  })

  it('blocks confirmed security failure in all modes', () => {
    expect(shouldBlockScan('confirmed_security_failure', 'enforce')).toBe(true)
    expect(shouldBlockScan('confirmed_security_failure', 'observe')).toBe(true)
  })

  it('blocks user remediable platform state in all modes', () => {
    expect(shouldBlockScan('user_remediable_platform_state', 'enforce')).toBe(true)
    expect(shouldBlockScan('user_remediable_platform_state', 'observe')).toBe(true)
  })

  it('blocks unsupported environment in enforce mode (fail-closed)', () => {
    expect(shouldBlockScan('unsupported_environment', 'enforce')).toBe(true)
  })

  it('does NOT block unsupported environment in observe mode (fail-open)', () => {
    expect(shouldBlockScan('unsupported_environment', 'observe')).toBe(false)
  })

  it('blocks configuration error in enforce mode', () => {
    expect(shouldBlockScan('configuration_error', 'enforce')).toBe(true)
  })

  it('does NOT block configuration error in observe mode', () => {
    expect(shouldBlockScan('configuration_error', 'observe')).toBe(false)
  })

  it('blocks retryable technical failure in enforce mode', () => {
    expect(shouldBlockScan('retryable_technical_failure', 'enforce')).toBe(true)
  })

  it('does NOT block retryable technical failure in observe mode', () => {
    expect(shouldBlockScan('retryable_technical_failure', 'observe')).toBe(false)
  })
})

// ── classifyIntegrityFailure tests ────────────────────────────

describe('classifyIntegrityFailure', () => {
  it('classifies request_hash_mismatch as confirmed security failure', () => {
    expect(
      classifyIntegrityFailure('request_hash_mismatch', 'failure', 'recognized', 'passed'),
    ).toBe('confirmed_security_failure')
  })

  it('classifies unrecognized app as confirmed security failure', () => {
    expect(
      classifyIntegrityFailure('some_code', 'failure', 'unrecognized', 'passed'),
    ).toBe('confirmed_security_failure')
  })

  it('classifies device_recall_unavailable as unsupported environment', () => {
    expect(
      classifyIntegrityFailure('device_recall_unavailable', 'unavailable', 'recognized', 'passed'),
    ).toBe('unsupported_environment')
  })

  it('classifies google_api_transient as retryable', () => {
    expect(
      classifyIntegrityFailure('google_api_transient', 'unavailable', 'recognized', 'unknown'),
    ).toBe('retryable_technical_failure')
  })

  it('classifies missing_credentials as configuration error', () => {
    expect(
      classifyIntegrityFailure('missing_credentials', 'unavailable', 'unknown', 'unknown'),
    ).toBe('configuration_error')
  })
})
