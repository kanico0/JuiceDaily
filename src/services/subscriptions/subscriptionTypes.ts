// ─────────────────────────────────────────────────────────────
// subscriptionTypes.ts — Shared types for the subscription layer.
// ─────────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro_monthly' | 'pro_annual'

export type SubscriptionSource = 'app_store' | 'play_store' | 'promotional' | null

export interface SubscriptionState {
  initialized: boolean
  loading: boolean
  isProActive: boolean
  currentPlan: PlanId
  source: SubscriptionSource
  productId: string | null
  expirationDate: string | null
  willRenew: boolean | null
  isInGracePeriod: boolean
  managementUrl: string | null
  lastUpdatedAt: string | null
  error: string | null
}

export function createInitialSubscriptionState (): SubscriptionState {
  return {
    initialized: false,
    loading: false,
    isProActive: false,
    currentPlan: 'free',
    source: null,
    productId: null,
    expirationDate: null,
    willRenew: null,
    isInGracePeriod: false,
    managementUrl: null,
    lastUpdatedAt: null,
    error: null,
  }
}

// ── Offerings / packages ─────────────────────────────────────

export interface DisplayPackage {
  packageId: string
  plan: Extract<PlanId, 'pro_monthly' | 'pro_annual'>
  productId: string
  localizedPriceString: string
  priceAmount: number
  currencyCode: string
  billingPeriodIso: string | null
}

export interface OfferingSnapshot {
  offeringId: string
  monthly: DisplayPackage | null
  annual: DisplayPackage | null
  annualSavingsPercent: number | null
}

// ── Purchase / restore outcomes ──────────────────────────────

export type PurchaseOutcome =
  | { status: 'success'; plan: Extract<PlanId, 'pro_monthly' | 'pro_annual'> }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'already_owned' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

export type RestoreOutcome =
  | { status: 'restored'; plan: Extract<PlanId, 'pro_monthly' | 'pro_annual'> }
  | { status: 'no_purchases' }
  | { status: 'error'; message: string }

// ── Quota ────────────────────────────────────────────────────

export interface ScanQuotaSnapshot {
  plan: 'free' | 'pro'
  limit: number
  used: number
  remaining: number
  periodStart: string
  periodEnd: string
  dailyLimit: number | null
  dailyUsed: number | null
}

export type ScanQuotaErrorCode =
  | 'monthly_limit_reached'
  | 'daily_limit_reached'
  | 'unauthenticated'
  | 'server_error'
