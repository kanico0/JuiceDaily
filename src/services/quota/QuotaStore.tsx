// ─────────────────────────────────────────────────────────────
// QuotaStore.tsx — React context caching the server scan quota.
//
// Display-only cache; the server remains authoritative. Exposes
// refresh(), applySnapshot() (after scans return fresh quota), and
// derived warning levels per the spec (Free 2/1, Pro 10/5).
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  FREE_WARNING_THRESHOLDS,
  PRO_WARNING_THRESHOLDS,
  SUPABASE_CONFIGURED,
} from '../subscriptions/subscriptionConfig'
import { fetchScanQuota } from './quotaService'
import { addIdentityChangeListener } from '../supabase/accountLink'
import type { ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'

export type QuotaWarningLevel = 'none' | 'low' | 'critical' | 'exhausted'

interface QuotaContextValue {
  quota: ScanQuotaSnapshot | null
  loading: boolean
  warningLevel: QuotaWarningLevel
  refresh: () => Promise<void>
  applySnapshot: (snapshot: ScanQuotaSnapshot | null) => void
}

const QuotaContext = createContext<QuotaContextValue | null>(null)

export function computeWarningLevel (quota: ScanQuotaSnapshot | null): QuotaWarningLevel {
  if (!quota) return 'none'
  const remaining = quota.remaining
  if (remaining <= 0) return 'exhausted'
  const [low, critical] = quota.plan === 'pro' ? PRO_WARNING_THRESHOLDS : FREE_WARNING_THRESHOLDS
  if (remaining <= critical) return 'critical'
  if (remaining <= low) return 'low'
  return 'none'
}

export function QuotaProvider ({ children }: { children: React.ReactNode }) {
  const [quota, setQuota] = useState<ScanQuotaSnapshot | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!SUPABASE_CONFIGURED) return
    setLoading(true)
    try {
      const snapshot = await fetchScanQuota()
      if (snapshot) setQuota(snapshot)
    } catch {
      // Keep the last known snapshot on failure.
    } finally {
      setLoading(false)
    }
  }, [])

  const applySnapshot = useCallback((snapshot: ScanQuotaSnapshot | null) => {
    if (snapshot) setQuota(snapshot)
  }, [])

  useEffect(() => {
    refresh()
    // Re-fetch when the canonical user changes (account linked or a
    // returning user signed back into their original identity).
    const remove = addIdentityChangeListener(() => {
      setQuota(null)
      refresh()
    })
    return remove
  }, [refresh])

  const value = useMemo<QuotaContextValue>(() => ({
    quota,
    loading,
    warningLevel: computeWarningLevel(quota),
    refresh,
    applySnapshot,
  }), [quota, loading, refresh, applySnapshot])

  return (
    <QuotaContext.Provider value={value}>
      {children}
    </QuotaContext.Provider>
  )
}

export function useQuota (): QuotaContextValue {
  const ctx = useContext(QuotaContext)
  if (!ctx) {
    // Rollback-safe default when the provider is absent.
    return {
      quota: null,
      loading: false,
      warningLevel: 'none',
      refresh: async () => {},
      applySnapshot: () => {},
    }
  }
  return ctx
}
