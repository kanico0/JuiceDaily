// ─────────────────────────────────────────────────────────────
// deviceRecallWriter.ts — Server-to-server Device Recall write
// implementation for Google Play Integrity.
//
// Google's Device Recall API requires a server-to-server call to
// modify device recall values. The client NEVER writes Device
// Recall bits directly.
//
// API endpoint:
//   POST https://playintegrity.googleapis.com/v1/{packageName}/deviceRecall:write
//
// The integrity token from a verified Play Integrity request is
// valid for Device Recall writes for up to 14 days after
// verification. The user account must be Play-licensed.
//
// Retry policy:
//   Total attempts = 3.
//   Attempt 1: immediate.
//   Retry 2: after 1 second.
//   Retry 3: after 2 seconds.
//
// Retryable failures: network errors, 429, 5xx.
// Non-retryable failures: 4xx (except 429), permission denied,
//   unevaluated device recall.
//
// If all retries fail:
//   - Account usage is retained (AI result was delivered).
//   - Sanitized telemetry is emitted.
//   - Residual risk is classified as bounded best-effort undercount.
//
// NEVER log raw integrity tokens, Google credentials, or
// Supabase access tokens.
// ─────────────────────────────────────────────────────────────

import { serverIntegrityLog } from './integrityServerLog.ts'
import { getAccessToken } from './playIntegrityVerifier.ts'

export interface DeviceRecallWriteValues {
  bitFirst?: boolean
  bitSecond?: boolean
  bitThird?: boolean
}

export interface DeviceRecallWriteResult {
  ok: boolean
  attempts: number
  reasonCode: string
  retryable: boolean
  residualRisk: 'none' | 'bounded_best_effort_undercount'
}

export interface DeviceRecallWriteOptions {
  integrityToken: string
  packageName: string
  serviceAccountJson: string
  newValues: DeviceRecallWriteValues
  operation: string // 'snap' | 'blend' — for telemetry only
}

// ── Retryable HTTP status codes ───────────────────────────────

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500
}

// ── Sleep helper ──────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Single write attempt ──────────────────────────────────────

async function attemptDeviceRecallWrite(
  opts: DeviceRecallWriteOptions,
  attemptNumber: number,
): Promise<{ ok: boolean; retryable: boolean; reasonCode: string; httpStatus?: number }> {
  const url = `https://playintegrity.googleapis.com/v1/${opts.packageName}/deviceRecall:write`

  serverIntegrityLog('device_recall_write_attempted', 'unknown', true, undefined, {
    operation: opts.operation,
    attempt: attemptNumber,
    bitsToWrite: Object.keys(opts.newValues).join(','),
  })

  try {
    // Obtain OAuth2 access token using the service account credentials.
    // Reuses the same getAccessToken function as the verifier.
    // The scope 'https://www.googleapis.com/auth/playintegrity' covers
    // both decodeIntegrityToken and deviceRecall:write.
    const oauthToken = await getAccessToken(opts.serviceAccountJson)

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${oauthToken}`,
      },
      body: JSON.stringify({
        integrityToken: opts.integrityToken,
        newValues: opts.newValues,
      }),
    })

    if (resp.ok) {
      serverIntegrityLog('device_recall_write_succeeded', 'unknown', true, undefined, {
        operation: opts.operation,
        attempt: attemptNumber,
      })
      return { ok: true, retryable: false, reasonCode: 'write_succeeded' }
    }

    const httpStatus = resp.status
    const retryable = isRetryableHttpStatus(httpStatus)

    // Try to read error body for better reason code (sanitized)
    let errorBody = ''
    try {
      const body = await resp.json()
      errorBody = body?.error?.message ?? ''
    } catch {
      // Ignore body parse failure
    }

    const reasonCode = retryable
      ? `write_http_${httpStatus}_retryable`
      : `write_http_${httpStatus}_non_retryable`

    serverIntegrityLog('device_recall_write_failed', 'unknown', false, reasonCode, {
      operation: opts.operation,
      attempt: attemptNumber,
      httpStatus,
      retryable,
      errorMessage: errorBody.slice(0, 200), // Sanitized — truncated
    })

    return { ok: false, retryable, reasonCode, httpStatus }
  } catch (e) {
    // Network error or fetch failure — retryable
    const msg = (e as Error)?.message ?? 'unknown'
    serverIntegrityLog('device_recall_write_failed', 'unknown', false, 'write_network_error', {
      operation: opts.operation,
      attempt: attemptNumber,
      retryable: true,
      errorMessage: msg.slice(0, 200),
    })
    return { ok: false, retryable: true, reasonCode: 'write_network_error' }
  }
}

// ── Main write function with bounded retries ──────────────────
//
// Total attempts = 3.
// Attempt 1: immediate.
// Retry 2: after 1 second.
// Retry 3: after 2 seconds.
//
// If all attempts fail, returns a result with residualRisk =
// 'bounded_best_effort_undercount'. The caller should:
//   - retain account usage (AI result was delivered)
//   - log the failure
//   - NOT attempt to invent a device fingerprint to compensate

export async function writeDeviceRecall(
  opts: DeviceRecallWriteOptions,
): Promise<DeviceRecallWriteResult> {
  // If there are no bits to write, return immediately.
  if (Object.keys(opts.newValues).length === 0) {
    serverIntegrityLog('device_recall_write_not_attempted', 'unknown', true, undefined, {
      reason: 'no_bits_to_write',
      operation: opts.operation,
    })
    return {
      ok: true,
      attempts: 0,
      reasonCode: 'no_bits_to_write',
      retryable: false,
      residualRisk: 'none',
    }
  }

  const retryDelays = [0, 1000, 2000] // Attempt 1: 0ms, Retry 2: 1s, Retry 3: 2s
  let lastResult: { ok: boolean; retryable: boolean; reasonCode: string } | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelays[attempt])
    }

    lastResult = await attemptDeviceRecallWrite(opts, attempt + 1)

    if (lastResult.ok) {
      return {
        ok: true,
        attempts: attempt + 1,
        reasonCode: lastResult.reasonCode,
        retryable: false,
        residualRisk: 'none',
      }
    }

    if (!lastResult.retryable) {
      // Non-retryable failure — stop immediately
      return {
        ok: false,
        attempts: attempt + 1,
        reasonCode: lastResult.reasonCode,
        retryable: false,
        residualRisk: 'bounded_best_effort_undercount',
      }
    }
  }

  // All 3 attempts failed with retryable errors
  serverIntegrityLog('device_recall_write_failed', 'unknown', false, 'all_retries_exhausted', {
    operation: opts.operation,
    retryCount: 3,
    residualRisk: 'bounded_best_effort_undercount',
  })

  return {
    ok: false,
    attempts: 3,
    reasonCode: lastResult?.reasonCode ?? 'all_retries_exhausted',
    retryable: true,
    residualRisk: 'bounded_best_effort_undercount',
  }
}
