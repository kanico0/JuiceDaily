// ─────────────────────────────────────────────────────────────
// historyAccessPolicy.js — Centralized access policy for
// Advanced History Preview and Make This Juice Again.
//
// Pure, testable helper. No side effects, no React, no storage.
// Entitlement is passed in — this module never queries it.
//
// Supports three entitlement states:
//   - loading: entitlement not yet resolved (neutral, no premium UI)
//   - pro: active Pro entitlement
//   - free: no Pro entitlement (preview + locked states)
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} HistoryAccess
 * @property {boolean} isLoading
 * @property {boolean} isPro
 * @property {boolean} isAdvancedPreview
 * @property {boolean} canViewBasicHistory
 * @property {boolean} canViewAdvancedDetails
 * @property {boolean} canMakeAgain
 * @property {boolean} shouldShowPreviewBadge
 * @property {boolean} shouldShowPreviewExplanation
 * @property {boolean} shouldShowAdvancedUpgrade
 * @property {boolean} shouldShowMakeAgainUpgrade
 */

/**
 * Compute the access policy for a single history entry.
 *
 * @param {boolean} isPro - Whether the user has active Pro entitlement.
 * @param {boolean} isAdvancedPreview - Whether this entry is the rotating preview.
 * @param {boolean} [entitlementInitialized=true] - Whether entitlement has resolved.
 * @returns {HistoryAccess}
 */
export function getHistoryAccessPolicy(isPro, isAdvancedPreview, entitlementInitialized = true) {
  // ── Loading state: neutral, no premium or locked UI ──
  if (!entitlementInitialized) {
    return {
      isLoading: true,
      isPro: false,
      isAdvancedPreview: false,
      canViewBasicHistory: true,
      canViewAdvancedDetails: false,
      canMakeAgain: false,
      shouldShowPreviewBadge: false,
      shouldShowPreviewExplanation: false,
      shouldShowAdvancedUpgrade: false,
      shouldShowMakeAgainUpgrade: false,
    }
  }

  // ── Resolved states ──
  if (isPro) {
    return {
      isLoading: false,
      isPro: true,
      isAdvancedPreview: false,
      canViewBasicHistory: true,
      canViewAdvancedDetails: true,
      canMakeAgain: true,
      shouldShowPreviewBadge: false,
      shouldShowPreviewExplanation: false,
      shouldShowAdvancedUpgrade: false,
      shouldShowMakeAgainUpgrade: false,
    }
  }

  if (isAdvancedPreview) {
    return {
      isLoading: false,
      isPro: false,
      isAdvancedPreview: true,
      canViewBasicHistory: true,
      canViewAdvancedDetails: true,
      canMakeAgain: true,
      shouldShowPreviewBadge: true,
      shouldShowPreviewExplanation: true,
      shouldShowAdvancedUpgrade: false,
      shouldShowMakeAgainUpgrade: false,
    }
  }

  return {
    isLoading: false,
    isPro: false,
    isAdvancedPreview: false,
    canViewBasicHistory: true,
    canViewAdvancedDetails: false,
    canMakeAgain: false,
    shouldShowPreviewBadge: false,
    shouldShowPreviewExplanation: false,
    shouldShowAdvancedUpgrade: true,
    shouldShowMakeAgainUpgrade: true,
  }
}

/**
 * Convenience: returns the access_type string for analytics.
 * Returns 'loading' for unresolved entitlement — callers should
 * suppress analytics while loading.
 * @param {HistoryAccess} policy
 * @returns {'loading'|'pro'|'free_preview'|'free_locked'}
 */
export function getAccessType(policy) {
  if (policy.isLoading) return 'loading'
  if (policy.isPro) return 'pro'
  if (policy.isAdvancedPreview) return 'free_preview'
  return 'free_locked'
}

/**
 * Convenience: returns the entry_position string for analytics.
 * @param {boolean} isAdvancedPreview
 * @returns {'newest'|'older'}
 */
export function getEntryPosition(isAdvancedPreview) {
  return isAdvancedPreview ? 'newest' : 'older'
}
