// ─────────────────────────────────────────────────────────────
// revenueCatClient.ts — Thin wrapper over react-native-purchases.
//
// Responsibilities:
//   - Configure RevenueCat with the PUBLIC SDK key + stable App User ID
//   - Fetch offerings and map to localized display packages
//   - Purchase monthly/annual, restore, refresh CustomerInfo
//   - Derive entitlement state from CustomerInfo
//   - Provide a management URL when available
//
// Only public SDK keys live here. No secrets. All display prices come
// from localized store metadata (never hardcoded).
// ─────────────────────────────────────────────────────────────

import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases'

import {
  DEFAULT_OFFERING_ID,
  PRO_ENTITLEMENT_ID,
  REVENUECAT_PUBLIC_API_KEY,
} from './subscriptionConfig'
import type {
  DisplayPackage,
  OfferingSnapshot,
  PlanId,
  PurchaseOutcome,
  RestoreOutcome,
  SubscriptionState,
} from './subscriptionTypes'

let configured = false

export function isRevenueCatConfigured (): boolean {
  return Boolean(REVENUECAT_PUBLIC_API_KEY)
}

export async function configureRevenueCat (appUserId: string): Promise<boolean> {
  if (!REVENUECAT_PUBLIC_API_KEY) return false
  if (configured) {
    await logIn(appUserId)
    return true
  }
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN)
  Purchases.configure({ apiKey: REVENUECAT_PUBLIC_API_KEY, appUserID: appUserId })
  configured = true
  return true
}

export async function logIn (appUserId: string): Promise<void> {
  if (!configured) return
  try {
    await Purchases.logIn(appUserId)
  } catch (e) {
    if (__DEV__) console.warn('[revenueCat] logIn failed', e)
  }
}

export async function logOut (): Promise<void> {
  if (!configured) return
  try {
    await Purchases.logOut()
  } catch {
    // Anonymous users cannot log out; safe to ignore.
  }
}

// ── Offerings ────────────────────────────────────────────────

function toDisplayPackage (
  pkg: PurchasesPackage | null,
  plan: Extract<PlanId, 'pro_monthly' | 'pro_annual'>,
): DisplayPackage | null {
  if (!pkg) return null
  const product = pkg.product
  return {
    packageId: pkg.identifier,
    plan,
    productId: product.identifier,
    localizedPriceString: product.priceString,
    priceAmount: product.price,
    currencyCode: product.currencyCode,
    billingPeriodIso: (product as { subscriptionPeriod?: string }).subscriptionPeriod ?? null,
  }
}

function computeAnnualSavings (
  monthly: DisplayPackage | null,
  annual: DisplayPackage | null,
): number | null {
  if (!monthly || !annual || monthly.priceAmount <= 0 || annual.priceAmount <= 0) return null
  const yearlyAtMonthly = monthly.priceAmount * 12
  if (yearlyAtMonthly <= 0) return null
  const savings = (1 - annual.priceAmount / yearlyAtMonthly) * 100
  return savings > 0 ? Math.round(savings) : null
}

export async function fetchOffering (): Promise<OfferingSnapshot | null> {
  if (!configured) return null
  try {
    const offerings = await Purchases.getOfferings()
    const offering: PurchasesOffering | null =
      offerings.all[DEFAULT_OFFERING_ID] ?? offerings.current ?? null
    if (!offering) return null

    const monthly = toDisplayPackage(offering.monthly ?? null, 'pro_monthly')
    const annual = toDisplayPackage(offering.annual ?? null, 'pro_annual')

    return {
      offeringId: offering.identifier,
      monthly,
      annual,
      annualSavingsPercent: computeAnnualSavings(monthly, annual),
    }
  } catch (e) {
    if (__DEV__) console.warn('[revenueCat] fetchOffering failed', e)
    return null
  }
}

// ── Entitlement state ────────────────────────────────────────

function planFromProductId (
  productId: string | null,
): Extract<PlanId, 'pro_monthly' | 'pro_annual'> {
  if (!productId) return 'pro_monthly'
  const id = productId.toLowerCase()
  if (id.includes('annual') || id.includes('year')) return 'pro_annual'
  return 'pro_monthly'
}

export function deriveState (info: CustomerInfo): Partial<SubscriptionState> {
  const entitlement = info.entitlements.active[PRO_ENTITLEMENT_ID]
  const isProActive = Boolean(entitlement)

  if (!isProActive) {
    return {
      isProActive: false,
      currentPlan: 'free',
      source: null,
      productId: null,
      expirationDate: null,
      willRenew: null,
      isInGracePeriod: false,
      managementUrl: info.managementURL ?? null,
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  const store = entitlement.store
  const source =
    store === 'APP_STORE' || store === 'MAC_APP_STORE'
      ? 'app_store'
      : store === 'PLAY_STORE'
        ? 'play_store'
        : store === 'PROMOTIONAL'
          ? 'promotional'
          : null

  return {
    isProActive: true,
    currentPlan: planFromProductId(entitlement.productIdentifier),
    source,
    productId: entitlement.productIdentifier ?? null,
    expirationDate: entitlement.expirationDate ?? null,
    willRenew: entitlement.willRenew ?? null,
    isInGracePeriod: Boolean(
      (entitlement as { billingIssueDetectedAt?: string | null }).billingIssueDetectedAt
    ),
    managementUrl: info.managementURL ?? null,
    lastUpdatedAt: new Date().toISOString(),
  }
}

export async function getCustomerInfo (): Promise<CustomerInfo | null> {
  if (!configured) return null
  try {
    return await Purchases.getCustomerInfo()
  } catch (e) {
    if (__DEV__) console.warn('[revenueCat] getCustomerInfo failed', e)
    return null
  }
}

export function addCustomerInfoListener (cb: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {}
  Purchases.addCustomerInfoUpdateListener(cb)
  return () => Purchases.removeCustomerInfoUpdateListener(cb)
}

// ── Purchase / restore ───────────────────────────────────────

function entitlementActive (info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID])
}

export async function purchasePackage (pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!configured) return { status: 'unavailable' }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg)
    // Do NOT trust a non-throwing return; confirm the entitlement.
    if (!entitlementActive(customerInfo)) {
      return { status: 'pending' }
    }
    const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]
    return { status: 'success', plan: planFromProductId(entitlement?.productIdentifier ?? null) }
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean; message?: string }
    if (err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { status: 'cancelled' }
    }
    if (err.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
      return { status: 'pending' }
    }
    if (err.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
      return { status: 'already_owned' }
    }
    if (
      err.code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR ||
      err.code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
      err.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR
    ) {
      return { status: 'unavailable' }
    }
    return { status: 'error', message: err.code ?? 'purchase_failed' }
  }
}

export async function restorePurchases (): Promise<RestoreOutcome> {
  if (!configured) return { status: 'error', message: 'not_configured' }
  try {
    const info = await Purchases.restorePurchases()
    if (!entitlementActive(info)) return { status: 'no_purchases' }
    const entitlement = info.entitlements.active[PRO_ENTITLEMENT_ID]
    return { status: 'restored', plan: planFromProductId(entitlement?.productIdentifier ?? null) }
  } catch (e) {
    const err = e as { code?: string }
    return { status: 'error', message: err.code ?? 'restore_failed' }
  }
}

export async function getManagementUrl (): Promise<string | null> {
  const info = await getCustomerInfo()
  return info?.managementURL ?? null
}
