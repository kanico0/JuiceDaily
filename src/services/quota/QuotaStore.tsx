// ─────────────────────────────────────────────────────────────
// QuotaStore.tsx — React context caching the server scan quota.
//
// Display-only cache; the server remains authoritative. Exposes
// refresh(), applySnapshot() (after scans return fresh quota), and
// derived warning levels per the spec (Free 2/1, Pro 10/5).
//
// The exposed `quota` is the *effective* quota — the server snapshot
// composed with the install-level Free Snap guard. For Free users:
//   effective remaining = min(server remaining, install remaining)
// This prevents the logout → new anonymous UUID → fresh quota
// loophole. Pro users bypass the install guard entirely.
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
import {
  composeEffectiveQuota,
  getInstallFreeSnapRemaining,
  markInstallFreeSnapConsumed,
} from './installFreeSnapGuard'
import type { ScanQuotaSnapshot } from '../subscriptions/subscriptionTypes'

export type QuotaWarningLevel = 'none' | 'low' | 'critical' | 'exhausted'

interface QuotaContextValue {
  // Effective quota — server snapshot composed with the install
  // guard. All display selectors should use this value.
  quota: ScanQuotaSnapshot | null
  loading: boolean
  warningLevel: QuotaWarningLevel
  refresh: () => Promise<ScanQuotaSnapshot | null>
  applySnapshot: (snapshot: ScanQuotaSnapshot | null) => void
  // Mark the install-level Free Snap as consumed for the current
  // server quota window. Called after a successful Free AI Snap.
  // No-op for Pro users. Idempotent.
  markInstallSnapConsumed: () => Promise<void>
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
  // Raw server quota (before install guard composition)
  const [serverQuota, setServerQuota] = useState<ScanQuotaSnapshot | null>(null)
  // Install-level remaining for Free users (0, 1, or null while loading)
  const [installRemaining, setInstallRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Effective quota — composed from server quota and install guard.
  // This is what all display selectors and camera eligibility checks use.
  const quota = useMemo(
    () => composeEffectiveQuota(serverQuota, installRemaining),
    [serverQuota, installRemaining],
  )

  const refresh = useCallback(async (): Promise<ScanQuotaSnapshot | null> => {
    if (!SUPABASE_CONFIGURED) {
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const snapshot = await fetchScanQuota()
      if (snapshot) {
        setServerQuota(snapshot)
        // Compute install remaining synchronously so the returned
        // value is the effective quota, not just the raw server
        // snapshot. This prevents attemptCameraOpen from seeing
        // a fresh 0/1 allowance before the install guard is read.
        const installRem = snapshot.plan === 'free'
          ? await getInstallFreeSnapRemaining(snapshot)
          : null
        setInstallRemaining(installRem)
        return composeEffectiveQuota(snapshot, installRem)
      }
      return null
    } catch {
      // Keep the last known snapshot on failure.
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const applySnapshot = useCallback((snapshot: ScanQuotaSnapshot | null) => {
    if (!snapshot) return
    setServerQuota(snapshot)
    // Read install guard for the new snapshot. After a successful
    // scan the server quota shows 0 remaining, so the effective
    // quota is 0 regardless of the install guard state. The
    // install guard matters when a NEW identity is created later.
    if (snapshot.plan === 'free') {
      getInstallFreeSnapRemaining(snapshot)
        .then(setInstallRemaining)
        .catch(() => setInstallRemaining(null))
    } else {
      setInstallRemaining(null)
    }
  }, [])

  // Mark the install-level Free Snap as consumed for the current
  // server quota window. Called after a successful Free AI Snap.
  // Persists the marker to AsyncStorage and updates installRemaining
  // synchronously so the effective quota reflects exhaustion.
  const markInstallSnapConsumed = useCallback(async () => {
    if (!serverQuota || serverQuota.plan !== 'free') return
    await markInstallFreeSnapConsumed(serverQuota.periodStart)
    setInstallRemaining(0)
  }, [serverQuota])

  useEffect(() => {
    refresh()
    // Re-fetch when the canonical user changes (account linked or a
    // returning user signed back into their original identity).
    // The install guard persists across identity changes (it is
    // keyed by the monthly window, not the UUID), so only the
    // server quota is cleared and re-fetched.
    const remove = addIdentityChangeListener(() => {
      setServerQuota(null)
      setInstallRemaining(null)
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
    markInstallSnapConsumed,
  }), [quota, loading, refresh, applySnapshot, markInstallSnapConsumed])

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
      refresh: async () => null,
      applySnapshot: () => {},
      markInstallSnapConsumed: async () => {},
    }
  }
  return ctx
}
