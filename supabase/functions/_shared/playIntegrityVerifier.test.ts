// ─────────────────────────────────────────────────────────────
// playIntegrityVerifier.test.ts — Deno tests for the pure
// classification and mock verification functions.
// ─────────────────────────────────────────────────────────────

import {
  classifyIntegrityFailure,
  shouldBlockScan,
  verifyMockIntegrity,
  type IntegrityFailureCategory,
} from './playIntegrityVerifier.ts'
import { assertEquals, assertNotEquals } from 'jsr:@std/assert'

// ── classifyIntegrityFailure tests ───────────────────────────

Deno.test('classifyIntegrityFailure: security failures', () => {
  const securityCodes = [
    'request_hash_mismatch',
    'package_name_mismatch',
    'stale_token',
    'integrity_failed',
    'mock_token_invalid',
  ]
  for (const code of securityCodes) {
    assertEquals(
      classifyIntegrityFailure(code, 'failed', 'unknown', 'unknown'),
      'confirmed_security_failure',
      `Expected ${code} to be confirmed_security_failure`,
    )
  }
})

Deno.test('classifyIntegrityFailure: unrecognized app = security failure', () => {
  assertEquals(
    classifyIntegrityFailure('some_code', 'failed', 'unrecognized', 'unknown'),
    'confirmed_security_failure',
  )
})

Deno.test('classifyIntegrityFailure: device integrity failed = security failure', () => {
  assertEquals(
    classifyIntegrityFailure('some_code', 'failed', 'recognized', 'failed'),
    'confirmed_security_failure',
  )
})

Deno.test('classifyIntegrityFailure: user remediable platform state', () => {
  const remediableCodes = [
    'play_store_outdated',
    'play_services_outdated',
    'app_not_installed_from_play',
  ]
  for (const code of remediableCodes) {
    assertEquals(
      classifyIntegrityFailure(code, 'failed', 'recognized', 'passed'),
      'user_remediable_platform_state',
      `Expected ${code} to be user_remediable_platform_state`,
    )
  }
})

Deno.test('classifyIntegrityFailure: configuration errors', () => {
  const configCodes = ['missing_credentials', 'invalid_service_account', 'google_api_config']
  for (const code of configCodes) {
    assertEquals(
      classifyIntegrityFailure(code, 'unavailable', 'unknown', 'unknown'),
      'configuration_error',
      `Expected ${code} to be configuration_error`,
    )
  }
})

Deno.test('classifyIntegrityFailure: retryable technical failures', () => {
  // Note: no_payload is classified as confirmed_security_failure by the
  // classifier (it's in the securityFailures set), but the return object in
  // verifyPlayIntegrity assigns retryable_technical_failure directly.
  // The return object's assignment takes precedence at the call site.
  const retryableCodes = [
    'google_api_transient',
    'google_api_error',
    'verification_error',
  ]
  for (const code of retryableCodes) {
    assertEquals(
      classifyIntegrityFailure(code, 'unavailable', 'unknown', 'unknown'),
      'retryable_technical_failure',
      `Expected ${code} to be retryable_technical_failure`,
    )
  }
})

Deno.test('classifyIntegrityFailure: unsupported environment', () => {
  assertEquals(
    classifyIntegrityFailure('device_recall_unavailable', 'unavailable', 'recognized', 'passed'),
    'unsupported_environment',
  )
})

Deno.test('classifyIntegrityFailure: default is retryable', () => {
  assertEquals(
    classifyIntegrityFailure('unknown_code', 'failed', 'recognized', 'passed'),
    'retryable_technical_failure',
  )
})

// ── shouldBlockScan tests ────────────────────────────────────

Deno.test('shouldBlockScan: null category never blocks', () => {
  assertEquals(shouldBlockScan(null, 'enforce'), false)
  assertEquals(shouldBlockScan(null, 'observe'), false)
  assertEquals(shouldBlockScan(null, 'off'), false)
})

Deno.test('shouldBlockScan: confirmed_security_failure always blocks', () => {
  assertEquals(shouldBlockScan('confirmed_security_failure', 'enforce'), true)
  assertEquals(shouldBlockScan('confirmed_security_failure', 'observe'), true)
})

Deno.test('shouldBlockScan: user_remediable_platform_state always blocks', () => {
  assertEquals(shouldBlockScan('user_remediable_platform_state', 'enforce'), true)
  assertEquals(shouldBlockScan('user_remediable_platform_state', 'observe'), true)
})

Deno.test('shouldBlockScan: unsupported_environment never blocks', () => {
  assertEquals(shouldBlockScan('unsupported_environment', 'enforce'), false)
  assertEquals(shouldBlockScan('unsupported_environment', 'observe'), false)
})

Deno.test('shouldBlockScan: configuration_error blocks only in enforce', () => {
  assertEquals(shouldBlockScan('configuration_error', 'enforce'), true)
  assertEquals(shouldBlockScan('configuration_error', 'observe'), false)
})

Deno.test('shouldBlockScan: retryable_technical_failure blocks only in enforce', () => {
  assertEquals(shouldBlockScan('retryable_technical_failure', 'enforce'), true)
  assertEquals(shouldBlockScan('retryable_technical_failure', 'observe'), false)
})

// ── verifyMockIntegrity tests ────────────────────────────────

Deno.test('verifyMockIntegrity: valid mock token returns success', () => {
  const hash = 'testhash|analyze_scan|abc'
  const token = `mock_integrity:install1:testhash:analyze_scan`
  const result = verifyMockIntegrity(token, hash)
  assertEquals(result.verificationStatus, 'success')
  assertEquals(result.failureCategory, null)
  assertEquals(result.ok, true)
  assertEquals(result.integrityStatus, 'mock')
  assertEquals(result.appRecognition, 'recognized')
  assertEquals(result.deviceIntegrity, 'passed')
  assertEquals(result.deviceUsed, 0)
  assertEquals(result.deviceRemaining, 5)
})

Deno.test('verifyMockIntegrity: invalid mock token returns failure', () => {
  const result = verifyMockIntegrity('not_a_mock_token', 'hash')
  assertEquals(result.verificationStatus, 'failure')
  assertEquals(result.failureCategory, 'confirmed_security_failure')
  assertEquals(result.ok, false)
  assertEquals(result.reasonCode, 'mock_token_invalid')
})

Deno.test('verifyMockIntegrity: hash mismatch returns failure', () => {
  const token = 'mock_integrity:install1:wronghash:analyze_scan'
  const result = verifyMockIntegrity(token, 'correcthash|analyze_scan|abc')
  assertEquals(result.verificationStatus, 'failure')
  assertEquals(result.failureCategory, 'confirmed_security_failure')
  assertEquals(result.ok, false)
  assertEquals(result.reasonCode, 'request_hash_mismatch')
})

Deno.test('verifyMockIntegrity: all return objects have verificationStatus', () => {
  // Test all code paths in verifyMockIntegrity to ensure verificationStatus is present
  const cases = [
    { token: 'bad', hash: 'h', expectedStatus: 'failure' as const },
    { token: 'mock_integrity:a:b:c', hash: 'different', expectedStatus: 'failure' as const },
    { token: 'mock_integrity:a:testhash:c', hash: 'testhash|x', expectedStatus: 'success' as const },
  ]
  for (const c of cases) {
    const result = verifyMockIntegrity(c.token, c.hash)
    assertEquals(result.verificationStatus, c.expectedStatus)
    assertNotEquals(result.failureCategory, 'success')
  }
})
