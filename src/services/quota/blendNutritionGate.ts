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

import { processJuiceBatch, type ScannedIngredient, type JuiceResult, type JuiceMethod } from '../JuiceEngine'
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
export interface AuthorizedJuiceResult extends JuiceResult {
  allowance: BlendAllowanceResult | null
}

export async function authorizeAndProcessBatch (
  scannedItems: ScannedIngredient[],
  juiceMethod: JuiceMethod = 'cold_pressed',
  operationId?: string,
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
  const requestId = operationId ?? `advanced-blend-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const reservation = await reserveBlendAllowance(scannedItems, requestId)

  try {
    const result = processJuiceBatch(scannedItems, juiceMethod)
    await finalizeBlendAllowance(reservation.requestId)
    return { ...result, allowance: reservation }
  } catch (err) {
    await releaseBlendAllowance(reservation.requestId)
    throw err
  }
}

export { BlendAllowanceError, classifyBlend, countDistinctProduceIds }
