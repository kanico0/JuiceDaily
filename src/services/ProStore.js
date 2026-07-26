// ─────────────────────────────────────────────────────────────
// ProStore.js — Compatibility display store for subscription state
// Authoritative quota comes from Supabase; authoritative Pro entitlement
// comes from RevenueCat via SubscriptionStore. This store provides
// dev-toggle Pro, local snap counter display, and feature access checks.
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'

// ── Subscription Plans ──────────────────────────────────────

export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'pro_monthly',
    label: 'Monthly',
    price: '$7.99',
    priceValue: 7.99,
    period: '/mo',
    tagline: 'RawLifeFlow Pro Monthly',
    savings: null,
  },
  annual: {
    id: 'pro_annual',
    label: 'Annual',
    price: '$59.99',
    priceValue: 59.99,
    period: '/yr',
    tagline: 'RawLifeFlow Pro Annual',
    savings: null,
    badge: 'BEST VALUE',
  },
}

// ── Pro Feature Flags ───────────────────────────────────────
// Only verified, implemented features are listed here.
export const PRO_FEATURES = {
  aiScans: { label: '60 successful AI Juice Snaps per month', icon: 'Camera', tier: 'pro' },
  ingredientAnalysis: { label: 'Full ingredient and estimated-nutrition analysis', icon: 'Microscope', tier: 'pro' },
  manualEntry: { label: 'Unlimited manual ingredient entry', icon: 'Edit3', tier: 'free' },
  juiceHistory: { label: 'Save and revisit your juice history and progress', icon: 'Archive', tier: 'free' },
  restoreAccess: { label: 'Restore Pro access when signed into the same account', icon: 'RefreshCw', tier: 'pro' },
}

// ── Constants ───────────────────────────────────────────────

const FREE_MONTHLY_SNAPS = 5
const PRO_MONTHLY_SNAPS = 60

// ── State ───────────────────────────────────────────────────

function createInitialProState() {
  const now = new Date()
  return {
    tier: 'free', // 'free' | 'pro'
    subscriptionPlan: null, // 'monthly' | 'annual' | null
    subscriptionExpiry: null,
    monthlySnapCount: 0,
    currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  }
}

// ── Reducer ─────────────────────────────────────────────────

function proReducer(state, action) {
  switch (action.type) {
    case 'SUBSCRIBE': {
      const { plan } = action.payload
      const expiry = new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 86400000).toISOString()
      return {
        ...state,
        tier: 'pro',
        subscriptionPlan: plan,
        subscriptionExpiry: expiry,
      }
    }
    case 'CANCEL_SUBSCRIPTION': {
      return {
        ...state,
        tier: 'free',
        subscriptionPlan: null,
        subscriptionExpiry: null,
      }
    }
    case 'USE_SNAP': {
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      // Reset counter if new month
      const isNewMonth = currentMonth !== state.currentMonth
      const newMonthlyCount = isNewMonth ? 1 : state.monthlySnapCount + 1
      // If pro, don't decrement anything
      if (state.tier === 'pro') {
        return { ...state, monthlySnapCount: newMonthlyCount, currentMonth }
      }
      // Free user using monthly allotment
      return { ...state, monthlySnapCount: newMonthlyCount, currentMonth }
    }
    case 'RESET_MONTHLY_SNAPS': {
      const now = new Date()
      return {
        ...state,
        monthlySnapCount: 0,
        currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      }
    }
    case 'DEV_TOGGLE_PRO': {
      const isCurrentlyPro = state.tier === 'pro'
      return {
        ...state,
        tier: isCurrentlyPro ? 'free' : 'pro',
        subscriptionPlan: isCurrentlyPro ? null : 'dev_override',
        subscriptionExpiry: null,
        devProActive: !isCurrentlyPro,
      }
    }
    default:
      return state
  }
}

// ── Context ─────────────────────────────────────────────────

const ProContext = createContext(null)

export function ProProvider({ children }) {
  const [state, dispatch] = useReducer(proReducer, createInitialProState())

  const isPro = state.tier === 'pro'

  const subscribe = useCallback((plan) => {
    dispatch({ type: 'SUBSCRIBE', payload: { plan } })
  }, [])

  const cancelSubscription = useCallback(() => {
    dispatch({ type: 'CANCEL_SUBSCRIPTION' })
  }, [])

  const useSnap = useCallback(() => {
    dispatch({ type: 'USE_SNAP' })
  }, [])

  const toggleDevPro = useCallback(() => {
    dispatch({ type: 'DEV_TOGGLE_PRO' })
  }, [])

  // ── Snap Eligibility Check ──────────────────────────────────

  const checkSnapEligibility = useCallback(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const isNewMonth = currentMonth !== state.currentMonth
    const monthName = now.toLocaleDateString('en-US', { month: 'long' })
    const usedThisMonth = isNewMonth ? 0 : state.monthlySnapCount

    if (isPro) {
      const proUsedThisMonth = usedThisMonth
      return {
        eligible: proUsedThisMonth < PRO_MONTHLY_SNAPS,
        remaining: Math.max(0, PRO_MONTHLY_SNAPS - proUsedThisMonth),
        reason: proUsedThisMonth >= PRO_MONTHLY_SNAPS
          ? `You've used your ${PRO_MONTHLY_SNAPS} Pro scans for ${monthName}. Your allowance resets next month.`
          : null,
      }
    }

    // Free monthly allotment
    if (usedThisMonth < FREE_MONTHLY_SNAPS) {
      return {
        eligible: true,
        remaining: FREE_MONTHLY_SNAPS - usedThisMonth,
        reason: null,
        source: 'free',
      }
    }

    // Out of snaps
    return {
      eligible: false,
      remaining: 0,
      reason: `You've used your ${FREE_MONTHLY_SNAPS} free Juice Snaps for ${monthName}. Upgrade to RawLifeFlow Pro for 60 successful Juice Snaps each month, or continue entering ingredients manually.`,
      source: 'exhausted',
    }
  }, [isPro, state.monthlySnapCount, state.currentMonth])

  // ── Feature Access Check ────────────────────────────────────

  const hasFeatureAccess = useCallback((featureKey) => {
    if (isPro) return true
    const feature = PRO_FEATURES[featureKey]
    if (!feature) return true // unknown features are free
    return feature.tier !== 'pro'
  }, [isPro])

  const value = useMemo(() => ({
    pro: state,
    isPro,
    subscribe,
    cancelSubscription,
    useSnap,
    checkSnapEligibility,
    hasFeatureAccess,
    toggleDevPro,
  }), [
    state, isPro, subscribe, cancelSubscription, useSnap,
    checkSnapEligibility, hasFeatureAccess,
    toggleDevPro,
  ])

  return (
    <ProContext.Provider value={value}>
      {children}
    </ProContext.Provider>
  )
}

export function usePro() {
  const ctx = useContext(ProContext)
  if (!ctx) throw new Error('usePro must be used within ProProvider')
  return ctx
}
