// ─────────────────────────────────────────────────────────────
// featureAccess.ts — Centralized Pro feature gating.
//
// All gating goes through canAccessFeature(); never scatter
// plan === 'pro_monthly' || plan === 'pro_annual' checks in UI.
// When Pro expires, history stays readable — only NEW Pro-only
// actions are gated.
// ─────────────────────────────────────────────────────────────

import type { SubscriptionState } from './subscriptionTypes'

export type FeatureKey =
  | 'ai_scan'
  | 'advanced_weekly_report'
  | 'advanced_trends'
  | 'personalized_challenges'
  | 'custom_weekly_goals'
  | 'photo_recaps'
  | 'advanced_reminders'
  | 'premium_achievements'

// Features every user has, regardless of plan. AI scan is "free"
// in the sense that Free users get a monthly quota — the server
// enforces the actual limit.
const FREE_FEATURES: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
  'ai_scan',
])

export function canAccessFeature (
  state: Pick<SubscriptionState, 'isProActive'>,
  feature: FeatureKey,
): boolean {
  if (FREE_FEATURES.has(feature)) return true
  return state.isProActive
}

// Convenience helper for lists/menus.
export function accessibleFeatures (
  state: Pick<SubscriptionState, 'isProActive'>,
): FeatureKey[] {
  const all: FeatureKey[] = [
    'ai_scan',
    'advanced_weekly_report',
    'advanced_trends',
    'personalized_challenges',
    'custom_weekly_goals',
    'photo_recaps',
    'advanced_reminders',
    'premium_achievements',
  ]
  return all.filter((f) => canAccessFeature(state, f))
}
