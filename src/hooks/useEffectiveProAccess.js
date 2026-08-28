// ─────────────────────────────────────────────────────────────
// useEffectiveProAccess.js — Canonical client-side Pro entitlement
//
// Combines the real RevenueCat subscription state (from
// SubscriptionStore) with the QA-only developer Pro override
// (from ProStore) into ONE effective UI entitlement.
//
// ALL client-side Pro UI gating should consume this hook.
// Do NOT independently OR devProActive into random screens.
//
// The dev override is CLIENT-LOCAL ONLY:
//   - Does NOT call RevenueCat
//   - Does NOT create a purchase
//   - Does NOT write to Supabase
//   - Does NOT alter server quotas
//   - Only affects local UI gating for QA testing
//
// When dev Pro is active, entitlementInitialized is forced to
// true so that policy helpers (like getHistoryAccessPolicy) do
// not return a loading state that blocks all advanced UI.
// ─────────────────────────────────────────────────────────────

import { useMemo } from 'react'
import { usePro, PRO_FEATURES } from '../services/ProStore'
import { useSubscription } from '../services/subscriptions/SubscriptionStore'

// Build-time gate: dev override only works in QA/local builds
import { DEVELOPER_TOOLS_ENABLED } from './useDeveloperMode'

/**
 * Canonical client-side Pro entitlement hook.
 *
 * Returns:
 *   - isPro: effective Pro status (real || dev override)
 *   - entitlementInitialized: whether entitlement has resolved
 *     (forced true when dev override is active)
 *   - realIsPro: the real RevenueCat Pro status (unchanged)
 *   - devProActive: whether the dev override is currently active
 *   - isDevOverridePossible: whether dev tools are enabled in this build
 *
 * @returns {Object}
 */
export function useEffectiveProAccess() {
  const { isPro: realIsProActive, state: subState } = useSubscription()
  const { isPro: devProActive } = usePro()

  return useMemo(() => {
    const realInitialized = subState.initialized
    const realIsPro = realInitialized ? realIsProActive : false

    // Dev override only works when developer tools are enabled
    // at build time AND the user has toggled it on.
    const devOverrideActive = DEVELOPER_TOOLS_ENABLED && devProActive

    // Effective Pro = real Pro OR dev override
    const isPro = realIsPro || devOverrideActive

    // When dev override is active, treat entitlement as initialized
    // so policy helpers don't return a loading state that blocks UI.
    const entitlementInitialized = realInitialized || devOverrideActive

    return {
      isPro,
      entitlementInitialized,
      realIsPro,
      devProActive: devOverrideActive,
      isDevOverridePossible: DEVELOPER_TOOLS_ENABLED,
    }
  }, [realIsProActive, subState.initialized, devProActive])
}

/**
 * Canonical, fail-closed feature-access check for the effective Pro
 * state returned by useEffectiveProAccess()/useEffectivePlanAccess().
 *
 * Unlike the legacy ProStore.hasFeatureAccess (which defaults to
 * `true` for unrecognized feature keys), this helper fails CLOSED:
 * an unknown feature key never grants access, regardless of Pro
 * status. Only keys present in PRO_FEATURES are recognized.
 *
 * @param {boolean} isPro - effective Pro status (from useEffectiveProAccess)
 * @param {string} featureKey - key from PRO_FEATURES
 * @returns {boolean}
 */
export function hasEffectiveFeatureAccess(isPro, featureKey) {
  if (!Object.prototype.hasOwnProperty.call(PRO_FEATURES, featureKey)) return false
  return Boolean(isPro)
}
