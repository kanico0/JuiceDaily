// ─────────────────────────────────────────────────────────────
// DeveloperToolsPanel.js — Read-only diagnostics for internal use.
//
// Displays safe, non-sensitive diagnostic information.
// No entitlement-changing or destructive actions.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import Constants from 'expo-constants'
import { useSubscription } from '../services/subscriptions/SubscriptionStore'
import { useQuota } from '../services/quota/QuotaStore'
import { getQuotaDisplay } from '../services/subscriptions/subscriptionSelectors'
import { getAccountStatus } from '../services/supabase/accountLink'
import { getDevicePoolMode } from '../services/devicePool/devicePoolConfig'
import { selectProviderType } from '../services/devicePool/devicePoolConfig'
import { MONETIZATION_ENABLED, SUPABASE_CONFIGURED } from '../services/subscriptions/subscriptionConfig'
import { BUILD_TARGET } from '../utils/buildTarget'
import { ensurePermissions } from '../services/NotificationNudges'
import * as Notifications from 'expo-notifications'

function maskUuid (uuid) {
  if (!uuid || uuid.length < 8) return '…'
  return '…' + uuid.slice(-8)
}

function DiagnosticRow ({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function SectionTitle ({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>
}

export default function DeveloperToolsPanel ({ authResult }) {
  const { state, isPro, offering, refresh: refreshSubscription } = useSubscription()
  const { quota, loading: quotaLoading, refresh: refreshQuota } = useQuota()
  const [account, setAccount] = useState({ userId: null, email: null, isDurable: false })
  const [notifStatus, setNotifStatus] = useState('unknown')
  const [scheduledCount, setScheduledCount] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadDiagnostics = useCallback(async () => {
    const status = await getAccountStatus()
    setAccount(status)

    try {
      const { status: permStatus } = await Notifications.getPermissionsAsync()
      setNotifStatus(permStatus)
    } catch {
      setNotifStatus('error')
    }

    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync()
      setScheduledCount(scheduled.length)
    } catch {
      setScheduledCount(null)
    }
  }, [])

  useEffect(() => {
    loadDiagnostics()
  }, [loadDiagnostics])

  const handleRefreshAll = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setRefreshing(true)
    try {
      await Promise.all([
        refreshSubscription(),
        refreshQuota(),
        loadDiagnostics(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [refreshSubscription, refreshQuota, loadDiagnostics])

  const handleRefreshQuota = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await refreshQuota()
  }, [refreshQuota])

  const handleRefreshSubscription = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await refreshSubscription()
  }, [refreshSubscription])

  const handleCopyReport = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const appVersion = Constants.expoConfig?.version || 'unknown'
    const buildNumber = Constants.expoConfig?.extra?.eas?.buildVersion || 'unknown'
    const packageName = Constants.expoConfig?.android?.package || 'unknown'
    const osVersion = Platform.Version

    const quotaDisplay = getQuotaDisplay(quota, isPro, quotaLoading)
    const deviceMode = getDevicePoolMode()
    const providerType = selectProviderType()

    const lines = [
      '=== RawLifeFlow: Juicing Daily — Diagnostic Report ===',
      `Timestamp: ${new Date().toISOString()}`,
      '',
      '--- APP ---',
      `App name: ${Constants.expoConfig?.name || 'unknown'}`,
      `Version: ${appVersion}`,
      `Build: ${buildNumber}`,
      `Package: ${packageName}`,
      `Platform: Android ${osVersion}`,
      `Build target: ${BUILD_TARGET}`,
      `Mode: ${__DEV__ ? 'development' : 'production'}`,
      '',
      '--- ACCOUNT ---',
      `Signed in: ${account.isDurable ? 'yes' : 'no'}`,
      `User UUID: ${maskUuid(account.userId)}`,
      `Account type: ${account.isDurable ? 'durable' : 'anonymous'}`,
      `Developer authorized: ${authResult?.authorized ? 'yes' : 'no'}`,
      '',
      '--- SUBSCRIPTION ---',
      `RevenueCat initialized: ${state.initialized ? 'yes' : 'no'}`,
      `Entitlement: ${isPro ? 'Pro' : 'Free'}`,
      `Offering available: ${offering ? 'yes' : 'no'}`,
      `Monthly package: ${offering?.monthly ? 'yes' : 'no'}`,
      `Annual package: ${offering?.annual ? 'yes' : 'no'}`,
      `Monetization enabled: ${MONETIZATION_ENABLED ? 'yes' : 'no'}`,
      '',
      '--- QUOTA ---',
      `Plan: ${quota?.plan || 'unknown'}`,
      `Limit: ${quota?.limit ?? 'unknown'}`,
      `Used: ${quota?.used ?? 'unknown'}`,
      `Remaining: ${quota?.remaining ?? 'unknown'}`,
      `Effective remaining: ${quotaDisplay.effectiveRemaining ?? 'unknown'}`,
      `Device remaining: ${quotaDisplay.deviceRemaining ?? 'n/a'}`,
      `Period start: ${quota?.periodStart || 'unknown'}`,
      `Period end: ${quota?.periodEnd || 'unknown'}`,
      '',
      '--- DEVICE RECALL ---',
      `Client mode: ${deviceMode}`,
      `Provider: ${providerType}`,
      '',
      '--- SUPABASE ---',
      `Configured: ${SUPABASE_CONFIGURED ? 'yes' : 'no'}`,
      `Auth session: ${account.userId ? 'present' : 'none'}`,
      '',
      '--- NOTIFICATIONS ---',
      `Permission: ${notifStatus}`,
      `Scheduled: ${scheduledCount ?? 'unknown'}`,
      '',
      '=== End of Report ===',
    ]

    const report = lines.join('\n')

    try {
      await Share.share({ message: report, title: 'Diagnostic Report' })
    } catch {
      // Share may fail on some devices — silently ignore
    }
  }, [account, authResult, quota, isPro, quotaLoading, offering, state, scheduledCount, notifStatus])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Developer Tools</Text>
        <Text style={styles.headerSubtitle}>Internal diagnostics and testing</Text>
      </View>

      <View style={styles.section}>
        <SectionTitle title="APP" />
        <DiagnosticRow label="App name" value={Constants.expoConfig?.name || 'unknown'} />
        <DiagnosticRow label="Version" value={Constants.expoConfig?.version || 'unknown'} />
        <DiagnosticRow label="Build number" value={String(Constants.expoConfig?.extra?.eas?.buildVersion || 'unknown')} />
        <DiagnosticRow label="Android package" value={Constants.expoConfig?.android?.package || 'unknown'} />
        <DiagnosticRow label="Build target" value={BUILD_TARGET} />
        <DiagnosticRow label="Mode" value={__DEV__ ? 'development' : 'production'} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="ACCOUNT" />
        <DiagnosticRow label="Signed in" value={account.isDurable ? 'yes' : 'no'} />
        <DiagnosticRow label="User UUID" value={maskUuid(account.userId)} />
        <DiagnosticRow label="Account type" value={account.isDurable ? 'durable' : 'anonymous'} />
        <DiagnosticRow label="Email confirmed" value={account.isDurable ? 'yes' : 'no'} />
        <DiagnosticRow label="Developer auth" value={authResult?.authorized ? 'authorized' : 'not authorized'} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="SUBSCRIPTION" />
        <DiagnosticRow label="RevenueCat initialized" value={state.initialized ? 'yes' : 'no'} />
        <DiagnosticRow label="Entitlement" value={isPro ? 'Pro' : 'Free'} />
        <DiagnosticRow label="Offering available" value={offering ? 'yes' : 'no'} />
        <DiagnosticRow label="Monthly package" value={offering?.monthly ? 'yes' : 'no'} />
        <DiagnosticRow label="Annual package" value={offering?.annual ? 'yes' : 'no'} />
        <DiagnosticRow label="Monetization enabled" value={MONETIZATION_ENABLED ? 'yes' : 'no'} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="QUOTA" />
        <DiagnosticRow label="Plan" value={quota?.plan || 'unknown'} />
        <DiagnosticRow label="Plan limit" value={String(quota?.limit ?? 'unknown')} />
        <DiagnosticRow label="Used scans" value={String(quota?.used ?? 'unknown')} />
        <DiagnosticRow label="Remaining" value={String(quota?.remaining ?? 'unknown')} />
        <DiagnosticRow label="Effective remaining" value={String(getQuotaDisplay(quota, isPro, quotaLoading).effectiveRemaining ?? 'unknown')} />
        <DiagnosticRow label="Device remaining" value={String(getQuotaDisplay(quota, isPro, quotaLoading).deviceRemaining ?? 'n/a')} />
        <DiagnosticRow label="Period start" value={quota?.periodStart || 'unknown'} />
        <DiagnosticRow label="Period end" value={quota?.periodEnd || 'unknown'} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="DEVICE RECALL" />
        <DiagnosticRow label="Client mode" value={getDevicePoolMode()} />
        <DiagnosticRow label="Provider available" value={selectProviderType() !== 'unsupported' ? 'yes' : 'no'} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="SUPABASE" />
        <DiagnosticRow label="Configured" value={SUPABASE_CONFIGURED ? 'yes' : 'no'} />
        <DiagnosticRow label="Auth session" value={account.userId ? 'present' : 'none'} />
      </View>

      <View style={styles.section}>
        <SectionTitle title="NOTIFICATIONS" />
        <DiagnosticRow label="Permission status" value={notifStatus} />
        <DiagnosticRow label="Scheduled count" value={scheduledCount != null ? String(scheduledCount) : 'unknown'} />
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRefreshSubscription} activeOpacity={0.7}>
          <Text style={styles.actionBtnText}>Refresh Subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRefreshQuota} activeOpacity={0.7}>
          <Text style={styles.actionBtnText}>Refresh Quota</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRefreshAll} disabled={refreshing} activeOpacity={0.7}>
          <Text style={styles.actionBtnText}>{refreshing ? 'Refreshing…' : 'Refresh All Diagnostics'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.copyBtn]} onPress={handleCopyReport} activeOpacity={0.7}>
          <Text style={[styles.actionBtnText, styles.copyBtnText]}>Copy Diagnostic Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,183,77,0.04)',
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.2)',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,183,77,0.15)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFB74D',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,183,77,0.5)',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,183,77,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C9D1D9',
    textAlign: 'right',
    flex: 1,
  },
  actionsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,183,77,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,183,77,0.2)',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFB74D',
  },
  copyBtn: {
    backgroundColor: 'rgba(100,181,246,0.08)',
    borderColor: 'rgba(100,181,246,0.2)',
  },
  copyBtnText: {
    color: '#64B5F6',
  },
})
