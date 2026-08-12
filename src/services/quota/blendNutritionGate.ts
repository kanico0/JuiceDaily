// ─────────────────────────────────────────────────────────────
// blendNutritionGate.ts — Authoritative enforcement boundary for
// Advanced Blend nutrition calculations.
//
// This module wraps processJuiceBatch with the server-authoritative
// allowance check using the reserve → finalize/release pattern.
//
// All nutrition entry paths must go through authorizeAndProcessBatch
// instead of calling processJuiceBatch directly for Advanced Blends.
//
// Flow:
//   1. Classify blend (simple vs advanced)
//   2. If simple: call processJuiceBatch directly (no server call)
//   3. If advanced: reserve allowance → processJuiceBatch → finalize/release
//   4. On reserve failure (limit reached, network error): throw, no nutrition
//   5. On nutrition success: finalize, return result
//   6. On nutrition failure: release, rethrow
//
// The operationId parameter ensures idempotency: one ID per user
// confirmation, reused across retries. A new attempt gets a new ID.
// ─────────────────────────────────────────────────────────────

import {
  processJuiceBatch,
  type ScannedIngredient,
  type JuiceResult,
  type JuiceMethod,
} from '../JuiceEngine'
import {
  reserveBlendAllowance,
  finalizeBlendAllowance,
  releaseBlendAllowance,
  classifyBlend,
  countDistinctProduceIds,
  BlendAllowanceError,
  isDevBypass,
  type BlendAllowanceResult,
} from './blendAllowanceService'
import { getAccessToken } from '../supabase/identity'
import { isDevicePoolEnabled } from '../devicePool/devicePoolConfig'
import { getDevicePromotionProvider } from '../devicePool/devicePromotionProviderFactory'
import type { AttestationRequestContext } from '../devicePool/devicePromotionProvider'
import {
  markInstallExpandedIngredientConsumed,
  checkInstallExpandedIngredientEligibility,
  selfHealInstallExpandedIngredient,
} from './installExpandedIngredientGuard'
import { fetchBlendAllowance } from './blendAllowanceService'

export interface AuthorizedJuiceResult extends JuiceResult {
  allowance: BlendAllowanceResult | null
}

// ── Device pool attestation for Advanced Blend ────────────────
// Requests a Play Integrity token bound to the blend request.
// Only requested when the device pool is enabled.
async function getBlendAttestation(
  requestId: string,
  userId: string,
): Promise<{ token: string; isMock: boolean } | null> {
  if (!isDevicePoolEnabled()) return null

  const provider = getDevicePromotionProvider()
  if (!provider.isSupported()) return null

  const ctx: AttestationRequestContext = {
    challenge: requestId,
    userId,
    action: 'analyze_blend',
    requestPayloadDigest: 'reserve',
  }

  try {
    const result = await provider.getAttestationForScan(ctx)
    if (!result.token) return null
    return { token: result.token, isMock: result.isMock }
  } catch {
    return null
  }
}

function extractUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload))
    return decoded?.sub ?? null
  } catch {
    return null
  }
}

export async function authorizeAndProcessBatch(
  scannedItems: ScannedIngredient[],
  juiceMethod: JuiceMethod = 'cold_pressed',
  operationId?: string,
  effectiveIsPro?: boolean,
): Promise<AuthorizedJuiceResult> {
  const distinctCount = countDistinctProduceIds(scannedItems)
  const blendType = classifyBlend(distinctCount)

  // Simple Blends: no allowance check needed, process directly.
  if (blendType === 'simple') {
    const result = processJuiceBatch(scannedItems, juiceMethod)
    return { ...result, allowance: null }
  }

  // Advanced Blends: reserve → process → finalize/release.
  // operationId is required for Advanced Blends — the caller must
  // create it via createOperationId() at confirmation time.
  // All users (including anonymous guests) go through the
  // server-authoritative analyze-blend Edge Function. The guest's
  // first Advanced Blend consumes allowance 1 of 3, keyed to the
  // Supabase UUID which is preserved across email upgrade.
  const requestId =
    operationId ?? `advanced-blend-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // ── Central install-guard enforcement (before reserve) ──────
  // Fetch the authoritative account allowance and check the
  // install guard BEFORE making any server call or doing expensive
  // nutrition work. This prevents a fresh Free UUID from bypassing
  // the same-install lifetime guard by calling the central gate
  // directly.
  //
  // Pro users bypass this check entirely (unlimited).
  // Unknown account allowance → fail-closed (blocked).
  // Dev bypass (no Supabase configured) skips this check.
  //
  // effectiveIsPro (from useEffectivePlanAccess) allows QA Pro
  // Simulation to bypass the client-side install guard. The server
  // still enforces the real quota via reserveBlendAllowance below.
  const clientIsPro = effectiveIsPro === true
  if (!isDevBypass() && !clientIsPro) {
    const accountSnapshot = await fetchBlendAllowance()
    const isProFromSnapshot = accountSnapshot?.plan === 'pro'
    const accountRemaining = accountSnapshot?.remaining ?? null
    // Self-heal from the authoritative account used count before
    // checking eligibility. This ensures the install guard is
    // up-to-date even if no UI surface has performed the self-heal.
    if (accountSnapshot && !isProFromSnapshot) {
      await selfHealInstallExpandedIngredient(accountSnapshot.used, false)
    }
    const eligibility = await checkInstallExpandedIngredientEligibility(
      accountRemaining,
      isProFromSnapshot,
    )
    if (!eligibility.allowed) {
      throw new BlendAllowanceError(
        eligibility.code,
        eligibility.code === 'allowance_unknown'
          ? 'Unable to verify Expanded Ingredient Analysis allowance. Please try again.'
          : 'You have used all 3 complimentary Expanded Ingredient Analyses on this device.',
        null,
      )
    }
  }

  // ── Request Play Integrity token for device pool verification ──
  let integrityToken: string | undefined
  let integrityTokenIsMock: boolean | undefined

  if (isDevicePoolEnabled()) {
    const accessToken = await getAccessToken()
    if (accessToken) {
      const userId = extractUserIdFromToken(accessToken)
      if (userId) {
        const attestation = await getBlendAttestation(requestId, userId)
        if (attestation) {
          integrityToken = attestation.token
          integrityTokenIsMock = attestation.isMock
        }
      }
    }
  }

  const reservation = await reserveBlendAllowance(
    scannedItems,
    requestId,
    integrityToken,
    integrityTokenIsMock,
  )

  try {
    const result = processJuiceBatch(scannedItems, juiceMethod)
    // Pass the same integrity token to finalize for Device Recall write.
    // The server reuses the same request hash as reserve so the token
    // is valid for both operations (Google allows token reuse for
    // Device Recall writes for up to 14 days).
    await finalizeBlendAllowance(reservation.requestId, integrityToken, integrityTokenIsMock)
    // Mark the install-level Expanded Ingredient guard as consumed.
    // This is idempotent (same requestId won't double-consume) and
    // is a no-op for Pro users (Pro usage does NOT consume the Free
    // lifetime pool).
    const isPro = reservation.plan === 'pro'
    await markInstallExpandedIngredientConsumed(reservation.requestId, isPro)
    return { ...result, allowance: reservation }
  } catch (err) {
    await releaseBlendAllowance(reservation.requestId)
    throw err
  }
}

export { BlendAllowanceError, classifyBlend, countDistinctProduceIds }
