import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Camera, FlaskConical, Crown } from 'lucide-react-native'
import { useQuota } from '../services/quota/QuotaStore'
import { useEffectiveProAccess } from '../hooks/useEffectiveProAccess'
import { fetchEffectiveBlendAllowance, FREE_ADVANCED_BLEND_ALLOWANCE } from '../services/quota/blendAllowanceService'
import { FREE_MONTHLY_SCAN_LIMIT, PRO_MONTHLY_SCAN_LIMIT } from '../services/subscriptions/subscriptionConfig'
import { trackEvent } from '../services/AnalyticsService'

export default function FreePlanUsageCard ({ onUpgrade, refreshTrigger }) {
  const { quota, loading: quotaLoading, refresh: refreshQuota } = useQuota()
  const { isPro } = useEffectiveProAccess()
  const [blendRemaining, setBlendRemaining] = useState(null)
  const [blendLoading, setBlendLoading] = useState(true)
  const [hasViewed, setHasViewed] = useState(false)

  const refreshBlend = useCallback(async () => {
    setBlendLoading(true)
    try {
      const result = await fetchEffectiveBlendAllowance(isPro)
      if (result) {
        setBlendRemaining(result.remaining)
      } else {
        setBlendRemaining(FREE_ADVANCED_BLEND_ALLOWANCE)
      }
    } catch {
      setBlendRemaining(FREE_ADVANCED_BLEND_ALLOWANCE)
    } finally {
      setBlendLoading(false)
    }
  }, [isPro])

  useEffect(() => {
    if (isPro) return
    refreshQuota()
    refreshBlend()
  }, [isPro, refreshQuota, refreshBlend, refreshTrigger])

  useEffect(() => {
    if (isPro || hasViewed) return
    if (!quotaLoading && !blendLoading) {
      setHasViewed(true)
      trackEvent('today_usage_card_viewed', {
        plan: 'free',
        scan_remaining: quota?.remaining ?? null,
        blend_remaining: blendRemaining,
      })
    }
  }, [isPro, hasViewed, quotaLoading, blendLoading, quota, blendRemaining])

  if (isPro) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Crown size={16} color="#7EE787" />
          <Text style={styles.headerText}>RawLifeFlow Pro</Text>
        </View>
        <Text style={styles.proBody}>
          Up to {PRO_MONTHLY_SCAN_LIMIT} AI scans per month and unlimited Expanded Ingredient Analysis.
        </Text>
      </View>
    )
  }

  const scanRemaining = quotaLoading ? null : (quota?.remaining ?? FREE_MONTHLY_SCAN_LIMIT)
  const blendDisplay = blendLoading ? null : (blendRemaining ?? FREE_ADVANCED_BLEND_ALLOWANCE)

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityRole="header">Your Free Plan</Text>

      <Pressable
        style={styles.row}
        onPress={() => {
          trackEvent('today_usage_row_tapped', { row: 'ai_scans', plan: 'free' })
        }}
        accessibilityRole="button"
        accessibilityLabel={`AI image scans, ${scanRemaining === null ? 'loading' : scanRemaining + ' left this month'}`}
      >
        <View style={styles.rowLeft}>
          <Camera size={16} color="#B8C8BD" />
          <Text style={styles.rowLabel}>AI image scans</Text>
        </View>
        <Text style={styles.rowValue}>
          {scanRemaining === null ? '—' : `${scanRemaining} left this month`}
        </Text>
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() => {
          trackEvent('today_usage_row_tapped', { row: 'advanced_blend', plan: 'free' })
        }}
        accessibilityRole="button"
        accessibilityLabel={`Expanded Ingredient Analysis, ${blendDisplay === null ? 'loading' : blendDisplay + ' lifetime analyses left'}`}
      >
        <View style={styles.rowLeft}>
          <FlaskConical size={16} color="#B8C8BD" />
          <Text style={styles.rowLabel}>Expanded Ingredient Analysis</Text>
        </View>
        <Text style={styles.rowValue}>
          {blendDisplay === null ? '—' : `${blendDisplay} lifetime analyses left`}
        </Text>
      </Pressable>

      <Text style={styles.supportingLine}>
        Manual logging and blends with 1-4 ingredients are unlimited.
      </Text>

      {(scanRemaining === 0 || blendDisplay === 0) && (
        <Pressable
          style={({ pressed }) => [styles.upgradeBtn, pressed && styles.btnPressed]}
          onPress={onUpgrade}
          accessibilityRole="button"
          accessibilityLabel="View Pro plan"
        >
          <Crown size={14} color="#7EE787" />
          <Text style={styles.upgradeText}>View Pro</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(13, 17, 23, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(126, 231, 135, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7EE787',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7EE787',
  },
  proBody: {
    fontSize: 13,
    color: '#B8C8BD',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: '#E6EDF3',
  },
  rowValue: {
    fontSize: 13,
    color: '#B8C8BD',
  },
  supportingLine: {
    fontSize: 12,
    color: '#6E7681',
    marginTop: 8,
    lineHeight: 16,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(126, 231, 135, 0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7EE787',
  },
  btnPressed: {
    opacity: 0.7,
  },
})
