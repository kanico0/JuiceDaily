// ─────────────────────────────────────────────────────────────
// useEffectivePlanAccess.js — Canonical client-side effective plan
//
// Extends useEffectiveProAccess with plan-level fields needed by
// quota gates and UI displays:
//   - effectiveTier: 'pro' | 'free'
//   - isPro: effective Pro status (real || dev override)
//   - isQaProSimulation: whether QA Pro simulation is active
//   - snapMonthlyLimit: 12 for Pro, 1 for Free
//   - expandedIngredientUnlimited: true for Pro
//   - realIsPro / realTier: the real RevenueCat state (unchanged)
//
// ALL client-side plan-level gating should consume this hook.
// Service-layer functions that cannot use hooks should accept
// an effectiveIsPro parameter from the calling screen.
//
// The dev override is CLIENT-LOCAL ONLY:
//   - Does NOT call RevenueCat
//   - Does NOT create a purchase
//   - Does NOT write to Supabase
//   - Does NOT alter server quotas
//   - Only affects local UI gating for QA testing
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import { useEffectiveProAccess } from './useEffectiveProAccess'
import {
  FREE_MONTHLY_SCAN_LIMIT,
  PRO_MONTHLY_SCAN_LIMIT,
} from '../services/subscriptions/subscriptionConfig'

/**
 * Canonical client-side effective plan hook.
 *
 * @returns {Object}
 */
export function useEffectivePlanAccess() {
  const {
    isPro,
    entitlementInitialized,
    realIsPro,
    devProActive,
    isDevOverridePossible,
  } = useEffectiveProAccess()

  return useMemo(() => {
    const isQaProSimulation = devProActive && !realIsPro

    return {
      // Effective plan
      effectiveTier: isPro ? 'pro' : 'free',
      isPro,
      isQaProSimulation,

      // Plan-level allowances (client-side for UI/display)
      snapMonthlyLimit: isPro ? PRO_MONTHLY_SCAN_LIMIT : FREE_MONTHLY_SCAN_LIMIT,
      expandedIngredientUnlimited: isPro,

      // Entitlement state
      entitlementInitialized,

      // Real state (for server-bound operations)
      realIsPro,
      realTier: realIsPro ? 'pro' : 'free',

      // Dev tools
      devProActive,
      isDevOverridePossible,
    }
  }, [isPro, entitlementInitialized, realIsPro, devProActive, isDevOverridePossible])
}
