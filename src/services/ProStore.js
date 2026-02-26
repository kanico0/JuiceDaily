// ─────────────────────────────────────────────────────────────
// ProStore.js — Hybrid Monetization Engine
// Freemium 2.0: subscription tiers, snap gating, IAP packs
// ─────────────────────────────────────────────────────────────

import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'

// ── Subscription Plans ──────────────────────────────────────

export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'pro_monthly',
    label: 'Monthly',
    price: '$5.99',
    priceValue: 5.99,
    period: '/mo',
    tagline: 'The "Coffee" price point',
    savings: null,
  },
  annual: {
    id: 'pro_annual',
    label: 'Annual',
    price: '$39.99',
    priceValue: 39.99,
    period: '/yr',
    tagline: 'Deep Commitment — best value',
    savings: 'Save 44%',
    badge: 'BEST VALUE',
  },
  lifetime: {
    id: 'pro_lifetime',
    label: 'Lifetime',
    price: '$89.99',
    priceValue: 89.99,
    period: 'once',
    tagline: 'One and Done — yours forever',
    savings: null,
    badge: 'FOREVER',
  },
}

// ── IAP Packs ───────────────────────────────────────────────

export const IAP_PACKS = {
  freezer_3: {
    id: 'freezer_pack_3',
    label: '3 Freezer Passes',
    price: '$1.99',
    priceValue: 1.99,
    emoji: '❄️',
    description: 'Protect your streak when life gets busy',
    quantity: 3,
    type: 'freezer',
  },
  snap_10: {
    id: 'snap_pack_10',
    label: '10 AI Snaps',
    price: '$2.99',
    priceValue: 2.99,
    emoji: '📸',
    description: 'Instant produce identification with Claude AI',
    quantity: 10,
    type: 'snap',
  },
  recipe_reset: {
    id: 'recipe_3day_reset',
    label: 'The 3-Day Reset',
    price: '$2.99',
    priceValue: 2.99,
    emoji: '🧬',
    description: 'Curated anti-inflammatory juice protocol',
    type: 'recipe_pack',
    category: 'anti_inflammatory',
  },
  recipe_glow: {
    id: 'recipe_glow_up',
    label: 'The Glow-Up Pack',
    price: '$2.99',
    priceValue: 2.99,
    emoji: '✨',
    description: 'Skin-brightening juice recipes with collagen boosters',
    type: 'recipe_pack',
    category: 'skin_glow',
  },
  recipe_energy: {
    id: 'recipe_energy_surge',
    label: 'Energy Surge Pack',
    price: '$2.99',
    priceValue: 2.99,
    emoji: '⚡',
    description: 'High-octane morning juices for peak performance',
    type: 'recipe_pack',
    category: 'energy',
  },
}

// ── Pro Feature Flags ───────────────────────────────────────

export const PRO_FEATURES = {
  weeklyReports: { label: 'Weekly Reports', icon: 'BarChart3', tier: 'pro' },
  advancedNutrients: { label: 'Advanced Nutrient Data', icon: 'Microscope', tier: 'pro' },
  proRecipes: { label: 'Pro Recipe Categories', icon: 'ChefHat', tier: 'pro' },
  unlimitedSnaps: { label: 'Unlimited AI Snaps', icon: 'Camera', tier: 'pro' },
  monthlyWrap: { label: 'Monthly Vitality Wrap', icon: 'Gift', tier: 'pro' },
  fridgeForager: { label: 'Fridge Forager', icon: 'Refrigerator', tier: 'pro' },
}

// ── Constants ───────────────────────────────────────────────

const FREE_MONTHLY_SNAPS = 3
const SNAP_PACK_BONUS = 10

// ── State ───────────────────────────────────────────────────

function createInitialProState() {
  const now = new Date()
  return {
    tier: 'free', // 'free' | 'pro'
    subscriptionPlan: null, // 'monthly' | 'annual' | 'lifetime' | null
    subscriptionExpiry: null,
    monthlySnapCount: 0,
    snapPackBalance: 0,
    currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    purchasedPacks: [], // ['recipe_3day_reset', ...]
    purchasedFreezerPasses: 0,
    goldenFreezerPasses: 0, // from referrals, never expire
    referralCount: 0,
    hasSeenPaywall: false,
    lastPaywallTrigger: null, // 'streak_3' | 'badge_unlock' | 'snap_limit' | etc.
  }
}

// ── Reducer ─────────────────────────────────────────────────

function proReducer(state, action) {
  switch (action.type) {
    case 'SUBSCRIBE': {
      const { plan } = action.payload
      const expiry = plan === 'lifetime'
        ? null
        : new Date(Date.now() + (plan === 'annual' ? 365 : 30) * 86400000).toISOString()
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
      // If free but has snap pack balance, use that
      if (state.snapPackBalance > 0) {
        return {
          ...state,
          snapPackBalance: state.snapPackBalance - 1,
          monthlySnapCount: newMonthlyCount,
          currentMonth,
        }
      }
      // Free user using monthly allotment
      return { ...state, monthlySnapCount: newMonthlyCount, currentMonth }
    }
    case 'BUY_SNAP_PACK': {
      return {
        ...state,
        snapPackBalance: state.snapPackBalance + SNAP_PACK_BONUS,
      }
    }
    case 'BUY_FREEZER_PACK': {
      return {
        ...state,
        purchasedFreezerPasses: state.purchasedFreezerPasses + (action.payload?.quantity || 3),
      }
    }
    case 'BUY_RECIPE_PACK': {
      const { packId } = action.payload
      return {
        ...state,
        purchasedPacks: [...new Set([...state.purchasedPacks, packId])],
      }
    }
    case 'EARN_GOLDEN_PASS': {
      return {
        ...state,
        goldenFreezerPasses: state.goldenFreezerPasses + 1,
        referralCount: state.referralCount + 1,
      }
    }
    case 'SET_PAYWALL_SEEN': {
      return {
        ...state,
        hasSeenPaywall: true,
        lastPaywallTrigger: action.payload?.trigger || null,
      }
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

  const buySnapPack = useCallback(() => {
    dispatch({ type: 'BUY_SNAP_PACK' })
  }, [])

  const buyFreezerPack = useCallback((quantity) => {
    dispatch({ type: 'BUY_FREEZER_PACK', payload: { quantity } })
  }, [])

  const buyRecipePack = useCallback((packId) => {
    dispatch({ type: 'BUY_RECIPE_PACK', payload: { packId } })
  }, [])

  const earnGoldenPass = useCallback(() => {
    dispatch({ type: 'EARN_GOLDEN_PASS' })
  }, [])

  const setPaywallSeen = useCallback((trigger) => {
    dispatch({ type: 'SET_PAYWALL_SEEN', payload: { trigger } })
  }, [])

  const toggleDevPro = useCallback(() => {
    dispatch({ type: 'DEV_TOGGLE_PRO' })
  }, [])

  // ── Snap Eligibility Check ──────────────────────────────────

  const checkSnapEligibility = useCallback(() => {
    if (isPro) return { eligible: true, remaining: Infinity, reason: null }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const isNewMonth = currentMonth !== state.currentMonth
    const usedThisMonth = isNewMonth ? 0 : state.monthlySnapCount

    // Has snap pack balance
    if (state.snapPackBalance > 0) {
      return {
        eligible: true,
        remaining: state.snapPackBalance,
        reason: null,
        source: 'snap_pack',
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
    const monthName = now.toLocaleDateString('en-US', { month: 'long' })
    return {
      eligible: false,
      remaining: 0,
      reason: `You've used your ${FREE_MONTHLY_SNAPS} Free Snaps for ${monthName}. Wellness Architects get unlimited AI scanning, instant nutrient breakdown, and Fridge Forager integration.`,
      source: 'exhausted',
    }
  }, [isPro, state.monthlySnapCount, state.snapPackBalance, state.currentMonth])

  // ── Feature Access Check ────────────────────────────────────

  const hasFeatureAccess = useCallback((featureKey) => {
    if (isPro) return true
    const feature = PRO_FEATURES[featureKey]
    if (!feature) return true // unknown features are free
    return feature.tier !== 'pro'
  }, [isPro])

  const hasRecipePack = useCallback((packId) => {
    if (isPro) return true
    return state.purchasedPacks.includes(packId)
  }, [isPro, state.purchasedPacks])

  // ── Snap Display Info ───────────────────────────────────────

  const snapInfo = useMemo(() => {
    if (isPro) return { label: '∞ Pro', remaining: Infinity, total: Infinity }

    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const isNewMonth = currentMonth !== state.currentMonth
    const usedThisMonth = isNewMonth ? 0 : state.monthlySnapCount

    if (state.snapPackBalance > 0) {
      return {
        label: `${state.snapPackBalance} Pack`,
        remaining: state.snapPackBalance,
        total: state.snapPackBalance,
      }
    }

    const remaining = Math.max(0, FREE_MONTHLY_SNAPS - usedThisMonth)
    return {
      label: `${remaining}/${FREE_MONTHLY_SNAPS} Free`,
      remaining,
      total: FREE_MONTHLY_SNAPS,
    }
  }, [isPro, state.monthlySnapCount, state.snapPackBalance, state.currentMonth])

  const value = useMemo(() => ({
    pro: state,
    isPro,
    subscribe,
    cancelSubscription,
    useSnap,
    buySnapPack,
    buyFreezerPack,
    buyRecipePack,
    earnGoldenPass,
    setPaywallSeen,
    checkSnapEligibility,
    hasFeatureAccess,
    hasRecipePack,
    snapInfo,
    toggleDevPro,
  }), [
    state, isPro, subscribe, cancelSubscription, useSnap, buySnapPack,
    buyFreezerPack, buyRecipePack, earnGoldenPass, setPaywallSeen,
    checkSnapEligibility, hasFeatureAccess, hasRecipePack, snapInfo,
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
