// ─────────────────────────────────────────────────────────────
// subscriptionSelectors.ts — Pure selectors over SubscriptionState
// and quota snapshots for display. No side effects, fully testable.
// ─────────────────────────────────────────────────────────────

import type { ScanQuotaSnapshot, SubscriptionState } from './subscriptionTypes'

export function selectIsPro (state: Pick<SubscriptionState, 'isProActive'>): boolean {
  return state.isProActive
}

export function selectPlanLabel (state: Pick<SubscriptionState, 'isProActive' | 'currentPlan'>): string {
  if (!state.isProActive) return 'Free'
  return state.currentPlan === 'pro_annual' ? 'Pro (Annual)' : 'Pro (Monthly)'
}

export function selectBillingStoreLabel (state: Pick<SubscriptionState, 'source'>): string | null {
  switch (state.source) {
    case 'app_store':
      return 'Your subscription is managed through Apple.'
    case 'play_store':
      return 'Your subscription is managed through Google Play.'
    case 'promotional':
      return 'Promotional access.'
    default:
      return null
  }
}

// Renewal / expiration copy. Turning off renewal must not read as
// losing access immediately — access continues until expiration.
export function selectRenewalLabel (
  state: Pick<SubscriptionState, 'isProActive' | 'expirationDate' | 'willRenew' | 'isInGracePeriod'>,
): string | null {
  if (!state.isProActive || !state.expirationDate) return null
  const date = new Date(state.expirationDate)
  if (Number.isNaN(date.getTime())) return null
  const formatted = date.toLocaleDateString()
  if (state.isInGracePeriod) return `Billing issue — access until ${formatted}`
  if (state.willRenew === false) return `Active until ${formatted}`
  return `Renews on ${formatted}`
}

// ── Shared quota display selector ────────────────────────────
// Single source of truth for quota display values used by
// CameraScreen badge, SettingsScreen Account section, and
// ScanPlanModal. All three must consume the same selector.

export interface QuotaDisplay {
  planLimit: number | null
  accountUsed: number | null
  accountRemaining: number | null
  deviceRemaining: number | null
  effectiveRemaining: number | null
  effectiveUsed: number | null
  displayLimit: number | null
  loading: boolean
  error: boolean
  isPro: boolean
  isDevicePoolActive: boolean
}

export function getQuotaDisplay (
  quota: ScanQuotaSnapshot | null,
  isPro: boolean,
  loading = false,
): QuotaDisplay {
  if (!quota) {
    return {
      planLimit: null,
      accountUsed: null,
      accountRemaining: null,
      deviceRemaining: null,
      effectiveRemaining: null,
      effectiveUsed: null,
      displayLimit: null,
      loading,
      error: !loading,
      isPro,
      isDevicePoolActive: false,
    }
  }

  const planLimit = quota.limit
  const accountUsed = quota.used
  const accountRemaining = quota.remaining
  const deviceRemaining = quota.deviceRemaining ?? null
  const isDevicePoolActive = quota.plan === 'free' && quota.effectiveRemaining != null

  // For Pro: account-based quota, device pool does not apply
  if (quota.plan === 'pro') {
    return {
      planLimit,
      accountUsed,
      accountRemaining,
      deviceRemaining: null,
      effectiveRemaining: accountRemaining,
      effectiveUsed: accountUsed,
      displayLimit: planLimit,
      loading,
      error: false,
      isPro: true,
      isDevicePoolActive: false,
    }
  }

  // For Free: use effective remaining if device pool is active
  const effectiveRemaining = isDevicePoolActive
    ? (quota.effectiveRemaining as number)
    : accountRemaining
  const effectiveUsed = Math.max(0, planLimit - effectiveRemaining)

  return {
    planLimit,
    accountUsed,
    accountRemaining,
    deviceRemaining,
    effectiveRemaining,
    effectiveUsed,
    displayLimit: planLimit,
    loading,
    error: false,
    isPro: false,
    isDevicePoolActive,
  }
}

// ── Canonical quota label formatter ──────────────────────────
// Single source of truth for the long-form quota display string.
// Format: "X of Y AI scans used this month"
// X = effectiveUsed, Y = displayLimit, both derived from getQuotaDisplay().

export function formatCanonicalQuotaLabel (display: QuotaDisplay): string | null {
  if (display.loading) return null
  if (display.error || display.effectiveUsed == null || display.displayLimit == null) return null
  return `${display.effectiveUsed} of ${display.displayLimit} AI scans used this month`
}

// ── Legacy label selectors (updated to use canonical format) ──

export function selectQuotaLabel (quota: ScanQuotaSnapshot | null): string | null {
  if (!quota) return null
  const display = getQuotaDisplay(quota, quota.plan === 'pro', false)
  return formatCanonicalQuotaLabel(display)
}

export function selectQuotaExhausted (quota: ScanQuotaSnapshot | null): boolean {
  if (!quota) return false
  // For free users with device pool, use effective remaining
  if (quota.plan === 'free' && quota.effectiveRemaining != null) {
    return quota.effectiveRemaining <= 0
  }
  return quota.remaining <= 0
}

export function selectNextRefreshLabel (quota: ScanQuotaSnapshot | null): string | null {
  if (!quota || !quota.periodEnd) return null
  const date = new Date(quota.periodEnd)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString()
}

// ── Device pool display ──────────────────────────────────────

export function selectDevicePoolSharedLabel (quota: ScanQuotaSnapshot | null): string | null {
  if (!quota || quota.plan === 'pro') return null
  if (quota.effectiveRemaining == null) return null
  return 'Free Juice Snaps are shared across free accounts used on this device.'
}

export function selectDevicePoolExhausted (quota: ScanQuotaSnapshot | null): boolean {
  if (!quota || quota.plan === 'pro') return false
  if (quota.effectiveRemaining == null) return false
  return quota.effectiveRemaining <= 0 && quota.remaining > 0
}

// Annual savings display, computed from localized prices upstream.
export function formatSavingsBadge (annualSavingsPercent: number | null): string | null {
  if (!annualSavingsPercent || annualSavingsPercent <= 0) return null
  return `Save ${annualSavingsPercent}%`
}
