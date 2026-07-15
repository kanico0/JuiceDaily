// ─────────────────────────────────────────────────────────────
// SubscriptionStore.tsx — React context for the subscription layer.
//
// Ties together: Supabase identity (stable user id) → RevenueCat
// configure/login → CustomerInfo → derived entitlement state and
// localized offerings. Exposes purchase/restore/refresh/manage.
//
// Rollback-safe: when monetization is not configured, it provides a
// stable Free state and no-op actions so the app behaves as before.
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Linking } from 'react-native'
import type { PurchasesPackage } from 'react-native-purchases'

import { MONETIZATION_ENABLED } from './subscriptionConfig'
import {
  addCustomerInfoListener,
  configureRevenueCat,
  deriveState,
  fetchOffering,
  getCustomerInfo,
  purchasePackage as rcPurchasePackage,
  restorePurchases as rcRestore,
} from './revenueCatClient'
import { ensureUser } from '../supabase/identity'
import { addIdentityChangeListener } from '../supabase/accountLink'
import { subscriptionAnalytics } from './subscriptionAnalytics'
import {
  createInitialSubscriptionState,
  type OfferingSnapshot,
  type PlanId,
  type PurchaseOutcome,
  type RestoreOutcome,
  type SubscriptionState,
} from './subscriptionTypes'

interface SubscriptionContextValue {
  state: SubscriptionState
  offering: OfferingSnapshot | null
  purchasing: boolean
  isPro: boolean
  purchase: (plan: Extract<PlanId, 'pro_monthly' | 'pro_annual'>, source?: string) => Promise<PurchaseOutcome>
  restore: () => Promise<RestoreOutcome>
  refresh: () => Promise<void>
  openManagement: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider ({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(createInitialSubscriptionState())
  const [offering, setOffering] = useState<OfferingSnapshot | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const purchasingRef = useRef(false)
  const packagesRef = useRef<{ monthly: PurchasesPackage | null; annual: PurchasesPackage | null }>({
    monthly: null,
    annual: null,
  })
  const wasProRef = useRef(false)

  const applyCustomerInfo = useCallback((infoDerived: Partial<SubscriptionState>) => {
    setState((prev) => {
      const next = { ...prev, ...infoDerived, initialized: true, loading: false }
      // Fire entitlement transition analytics.
      if (!wasProRef.current && next.isProActive) subscriptionAnalytics.entitlementActivated()
      if (wasProRef.current && !next.isProActive) subscriptionAnalytics.entitlementExpired()
      wasProRef.current = next.isProActive
      return next
    })
  }, [])

  // Keep raw PurchasesPackage refs so purchase() can hand the exact
  // package back to RevenueCat.
  const loadOffering = useCallback(async () => {
    const snapshot = await fetchOffering()
    setOffering(snapshot)
    if (!snapshot) return
    try {
      const Purchases = (await import('react-native-purchases')).default
      const offerings = await Purchases.getOfferings()
      const off = offerings.all[snapshot.offeringId] ?? offerings.current
      packagesRef.current = {
        monthly: off?.monthly ?? null,
        annual: off?.annual ?? null,
      }
    } catch {
      packagesRef.current = { monthly: null, annual: null }
    }
  }, [])

  // ── Bootstrap ──────────────────────────────────────────────
  useEffect(() => {
    let removeListener: (() => void) | null = null
    let cancelled = false

    async function boot () {
      if (!MONETIZATION_ENABLED) {
        setState((prev) => ({ ...prev, initialized: true }))
        return
      }
      setState((prev) => ({ ...prev, loading: true }))

      const identity = await ensureUser()
      if (!identity || cancelled) {
        setState((prev) => ({ ...prev, initialized: true, loading: false, error: 'identity_unavailable' }))
        return
      }

      const ok = await configureRevenueCat(identity.userId)
      if (!ok || cancelled) {
        setState((prev) => ({ ...prev, initialized: true, loading: false }))
        return
      }

      const info = await getCustomerInfo()
      if (info && !cancelled) applyCustomerInfo(deriveState(info))

      await loadOffering()

      removeListener = addCustomerInfoListener((updated) => {
        applyCustomerInfo(deriveState(updated))
      })

      if (!cancelled) setState((prev) => ({ ...prev, initialized: true, loading: false }))
    }

    boot()

    // When the canonical user changes (account linked or returning
    // user signed in), accountLink already re-logged RevenueCat with
    // the new UUID — re-derive entitlements from fresh CustomerInfo.
    const removeIdentityListener = addIdentityChangeListener(async () => {
      if (!MONETIZATION_ENABLED) return
      const info = await getCustomerInfo()
      if (info && !cancelled) applyCustomerInfo(deriveState(info))
    })

    return () => {
      cancelled = true
      if (removeListener) removeListener()
      removeIdentityListener()
    }
  }, [applyCustomerInfo, loadOffering])

  // ── Actions ────────────────────────────────────────────────

  const purchase = useCallback(async (
    plan: Extract<PlanId, 'pro_monthly' | 'pro_annual'>,
    source?: string,
  ): Promise<PurchaseOutcome> => {
    if (!MONETIZATION_ENABLED) return { status: 'unavailable' }
    // Double-tap protection.
    if (purchasingRef.current) return { status: 'pending' }

    const pkg = plan === 'pro_annual' ? packagesRef.current.annual : packagesRef.current.monthly
    if (!pkg) return { status: 'unavailable' }

    const packageType = plan === 'pro_annual' ? 'annual' : 'monthly'
    purchasingRef.current = true
    setPurchasing(true)
    subscriptionAnalytics.purchaseStarted(packageType, source)

    try {
      const outcome = await rcPurchasePackage(pkg)
      if (outcome.status === 'success') {
        subscriptionAnalytics.purchaseSucceeded(packageType, source)
        const info = await getCustomerInfo()
        if (info) applyCustomerInfo(deriveState(info))
      } else if (outcome.status === 'cancelled') {
        subscriptionAnalytics.purchaseCancelled(packageType, source)
      } else if (outcome.status === 'error') {
        subscriptionAnalytics.purchaseFailed(packageType, outcome.message)
      }
      return outcome
    } finally {
      purchasingRef.current = false
      setPurchasing(false)
    }
  }, [applyCustomerInfo])

  const restore = useCallback(async (): Promise<RestoreOutcome> => {
    if (!MONETIZATION_ENABLED) return { status: 'error', message: 'not_configured' }
    subscriptionAnalytics.restoreStarted()
    const outcome = await rcRestore()
    if (outcome.status === 'restored') {
      subscriptionAnalytics.restoreSucceeded(outcome.plan === 'pro_annual' ? 'annual' : 'monthly')
      const info = await getCustomerInfo()
      if (info) applyCustomerInfo(deriveState(info))
    } else if (outcome.status === 'error') {
      subscriptionAnalytics.restoreFailed(outcome.message)
    }
    return outcome
  }, [applyCustomerInfo])

  const refresh = useCallback(async () => {
    if (!MONETIZATION_ENABLED) return
    const info = await getCustomerInfo()
    if (info) applyCustomerInfo(deriveState(info))
    await loadOffering()
  }, [applyCustomerInfo, loadOffering])

  const openManagement = useCallback(async () => {
    const url = state.managementUrl
    if (url) {
      try {
        await Linking.openURL(url)
      } catch {
        // Silently ignore — user can manage via store apps directly.
      }
    }
  }, [state.managementUrl])

  const value = useMemo<SubscriptionContextValue>(() => ({
    state,
    offering,
    purchasing,
    isPro: state.isProActive,
    purchase,
    restore,
    refresh,
    openManagement,
  }), [state, offering, purchasing, purchase, restore, refresh, openManagement])

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

// Rollback-safe hook: returns a stable Free state when the provider
// is absent so existing screens never crash.
export function useSubscription (): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    return {
      state: { ...createInitialSubscriptionState(), initialized: true },
      offering: null,
      purchasing: false,
      isPro: false,
      purchase: async () => ({ status: 'unavailable' }),
      restore: async () => ({ status: 'error', message: 'not_configured' }),
      refresh: async () => {},
      openManagement: async () => {},
    }
  }
  return ctx
}
