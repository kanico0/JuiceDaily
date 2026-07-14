// ─────────────────────────────────────────────────────────────
// subscriptionAnalytics.ts — Typed wrappers around AnalyticsService
// for monetization events. Non-sensitive properties only.
// ─────────────────────────────────────────────────────────────

import { Platform } from 'react-native'
import { trackEvent } from '../AnalyticsService'

type PackageType = 'monthly' | 'annual'

const platform = Platform.OS

export const subscriptionAnalytics = {
  paywallViewed (source?: string) {
    trackEvent('paywall_viewed', { paywall_source: source, platform })
  },
  paywallDismissed (source?: string) {
    trackEvent('paywall_dismissed', { paywall_source: source })
  },
  packageSelected (packageType: PackageType, source?: string) {
    trackEvent('subscription_package_selected', { package_type: packageType, paywall_source: source })
  },
  purchaseStarted (packageType: PackageType, source?: string) {
    trackEvent('subscription_purchase_started', { package_type: packageType, paywall_source: source, platform })
  },
  purchaseSucceeded (packageType: PackageType, source?: string) {
    trackEvent('subscription_purchase_succeeded', { package_type: packageType, paywall_source: source, platform })
  },
  purchaseCancelled (packageType: PackageType, source?: string) {
    trackEvent('subscription_purchase_cancelled', { package_type: packageType, paywall_source: source })
  },
  purchaseFailed (packageType: PackageType, errorCode?: string) {
    trackEvent('subscription_purchase_failed', { package_type: packageType, error_code: errorCode })
  },
  restoreStarted (source?: string) {
    trackEvent('subscription_restore_started', { source })
  },
  restoreSucceeded (packageType?: PackageType) {
    trackEvent('subscription_restore_succeeded', { package_type: packageType })
  },
  restoreFailed (errorCode?: string) {
    trackEvent('subscription_restore_failed', { error_code: errorCode })
  },
  entitlementActivated (packageType?: PackageType) {
    trackEvent('pro_entitlement_activated', { package_type: packageType, platform })
  },
  entitlementExpired () {
    trackEvent('pro_entitlement_expired', {})
  },
  billingIssueDetected () {
    trackEvent('billing_issue_detected', { platform })
  },
  quotaViewed (plan: string, used: number, remaining: number) {
    trackEvent('scan_quota_viewed', { plan, scans_used: used, scans_remaining: remaining })
  },
  quotaWarningShown (plan: string, remaining: number, level: string) {
    trackEvent('scan_quota_warning_shown', { plan, scans_remaining: remaining, warning_level: level })
  },
  quotaReached (plan: string) {
    trackEvent('scan_quota_reached', { plan })
  },
  scanBlockedMonthly (plan: string) {
    trackEvent('scan_blocked_monthly_limit', { plan })
  },
  scanBlockedDaily (plan: string) {
    trackEvent('scan_blocked_daily_limit', { plan })
  },
  manualLogAfterLimit (plan: string) {
    trackEvent('manual_log_selected_after_scan_limit', { plan })
  },
  upgradeStartedFromScanLimit (plan: string) {
    trackEvent('upgrade_started_from_scan_limit', { plan })
  },
  upgradeCompletedFromScanLimit (packageType?: PackageType) {
    trackEvent('upgrade_completed_from_scan_limit', { package_type: packageType })
  },
}
