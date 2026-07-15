// ─────────────────────────────────────────────────────────────
// PaywallScreen.js — RawLifeFlow Pro upsell.
//
// Rules: localized prices only (no hardcoding), auto-renewal
// disclosure, Restore Purchases, Terms + Privacy links, close
// control, no dark patterns, double-tap protection (store-level).
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { X, Check, Sparkles } from 'lucide-react-native'

import { useSubscription } from '../services/subscriptions/SubscriptionStore'
import { useQuota } from '../services/quota/QuotaStore'
import {
  FREE_MONTHLY_SCAN_LIMIT,
  PRO_MONTHLY_SCAN_LIMIT,
  PRIVACY_URL,
  TERMS_URL,
} from '../services/subscriptions/subscriptionConfig'
import { formatSavingsBadge } from '../services/subscriptions/subscriptionSelectors'
import { subscriptionAnalytics } from '../services/subscriptions/subscriptionAnalytics'

const FREE_FEATURES = [
  `${FREE_MONTHLY_SCAN_LIMIT} AI scans per quota month`,
  'Unlimited manual logging',
  'Basic Glow Streak',
  'Weekly Momentum',
  'Basic progress history',
]

const PRO_FEATURES = [
  `${PRO_MONTHLY_SCAN_LIMIT} AI scans per quota month`,
  'Advanced Glow Reports',
  'Ingredient and consistency trends',
  'Personalized challenges',
  'Custom goals',
  'Photo recaps',
  'Advanced reminders',
  'Premium achievements',
]

export default function PaywallScreen({ navigation, route }) {
  const source = route?.params?.source ?? 'unknown'
  const { state, offering, purchasing, isPro, purchase, restore } = useSubscription()
  const { refresh: refreshQuota } = useQuota()
  const [selectedPlan, setSelectedPlan] = useState('pro_annual')
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    subscriptionAnalytics.paywallViewed(source)
  }, [source])

  const savingsBadge = useMemo(
    () => formatSavingsBadge(offering?.annualSavingsPercent ?? null),
    [offering]
  )

  const close = () => {
    subscriptionAnalytics.paywallDismissed(source)
    navigation.goBack()
  }

  const handleSelect = (plan) => {
    setSelectedPlan(plan)
    subscriptionAnalytics.packageSelected(plan === 'pro_annual' ? 'annual' : 'monthly', source)
  }

  const handlePurchase = async () => {
    const outcome = await purchase(selectedPlan, source)
    switch (outcome.status) {
      case 'success':
        await refreshQuota()
        Alert.alert('Welcome to Pro!', 'Your Pro features are now active.', [
          { text: 'Continue', onPress: () => navigation.goBack() },
        ])
        break
      case 'cancelled':
        break
      case 'pending':
        Alert.alert('Purchase Pending', 'Your purchase is being processed. Pro will activate automatically once it completes.')
        break
      case 'already_owned':
        Alert.alert('Already Subscribed', 'Try Restore Purchases to re-activate Pro on this device.')
        break
      case 'unavailable':
        Alert.alert('Store Unavailable', 'Subscriptions are not available right now. Please try again later.')
        break
      default:
        Alert.alert('Purchase Failed', 'Something went wrong. You have not been charged. Please try again.')
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const outcome = await restore()
      if (outcome.status === 'restored') {
        await refreshQuota()
        Alert.alert('Purchases Restored', 'Your Pro subscription is active again.')
      } else if (outcome.status === 'no_purchases') {
        Alert.alert('No Purchases Found', 'We could not find a previous subscription for this account.')
      } else {
        Alert.alert('Restore Failed', 'Please try again later.')
      }
    } finally {
      setRestoring(false)
    }
  }

  const openLink = (url) => {
    if (url) Linking.openURL(url).catch(() => {})
  }

  const monthly = offering?.monthly ?? null
  const annual = offering?.annual ?? null
  const storeUnavailable = state.initialized && !state.loading && !monthly && !annual

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close paywall and continue free"
      >
        <X size={22} color="#8B949E" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Sparkles size={28} color="#7EE787" />
          <Text style={styles.title}>Build Your Juicing Habit with Pro</Text>
          <Text style={styles.subtitle}>
            Scan your juices faster, understand your progress, and stay motivated with deeper
            reports, personalized challenges, and monthly insights.
          </Text>
        </View>

        {isPro && (
          <View style={styles.proActiveBanner}>
            <Check size={16} color="#7EE787" />
            <Text style={styles.proActiveText}>Pro is active on this account</Text>
          </View>
        )}

        {/* Plan comparison */}
        <View style={styles.compareRow}>
          <View style={styles.compareCol}>
            <Text style={styles.compareTitle}>Free</Text>
            {FREE_FEATURES.map((f) => (
              <Text key={f} style={styles.compareItem}>• {f}</Text>
            ))}
          </View>
          <View style={[styles.compareCol, styles.compareColPro]}>
            <Text style={[styles.compareTitle, styles.compareTitlePro]}>Pro</Text>
            {PRO_FEATURES.map((f) => (
              <Text key={f} style={[styles.compareItem, styles.compareItemPro]}>• {f}</Text>
            ))}
          </View>
        </View>

        {/* Package selection */}
        {state.loading && !offering ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#7EE787" />
            <Text style={styles.loadingText}>Loading plans…</Text>
          </View>
        ) : storeUnavailable ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>
              Subscriptions are unavailable right now. You can keep logging manually for free.
            </Text>
          </View>
        ) : (
          <View style={styles.packages}>
            {annual && (
              <TouchableOpacity
                style={[styles.packageCard, selectedPlan === 'pro_annual' && styles.packageSelected]}
                onPress={() => handleSelect('pro_annual')}
                accessibilityRole="button"
                accessibilityLabel={`Annual plan, ${annual.localizedPriceString} per year`}
              >
                {savingsBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Best Value · {savingsBadge}</Text>
                  </View>
                )}
                <Text style={styles.packageName}>Annual</Text>
                <Text style={styles.packagePrice}>{annual.localizedPriceString} / year</Text>
              </TouchableOpacity>
            )}
            {monthly && (
              <TouchableOpacity
                style={[styles.packageCard, selectedPlan === 'pro_monthly' && styles.packageSelected]}
                onPress={() => handleSelect('pro_monthly')}
                accessibilityRole="button"
                accessibilityLabel={`Monthly plan, ${monthly.localizedPriceString} per month`}
              >
                <Text style={styles.packageName}>Monthly</Text>
                <Text style={styles.packagePrice}>{monthly.localizedPriceString} / month</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* CTA */}
        {!isPro && (monthly || annual) && (
          <TouchableOpacity
            style={[styles.cta, purchasing && styles.ctaDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
            accessibilityRole="button"
            accessibilityLabel="Subscribe to RawLifeFlow Pro"
          >
            {purchasing ? (
              <ActivityIndicator color="#0D1117" />
            ) : (
              <Text style={styles.ctaText}>Continue</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.disclosure}>
          {PRO_MONTHLY_SCAN_LIMIT} image-recognition scans per quota month. Unused scans do not
          roll over. Manual logging remains unlimited.{'\n\n'}
          Subscriptions auto-renew until cancelled. Payment is charged to your Apple or Google
          account. Cancel anytime in your store subscription settings.
        </Text>

        <View style={styles.footerLinks}>
          <TouchableOpacity
            onPress={handleRestore}
            disabled={restoring}
            accessibilityRole="button"
            accessibilityLabel="Restore previous purchases"
          >
            <Text style={styles.footerLink}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
          </TouchableOpacity>
          {TERMS_URL ? (
            <TouchableOpacity onPress={() => openLink(TERMS_URL)} accessibilityRole="link">
              <Text style={styles.footerLink}>Terms of Use</Text>
            </TouchableOpacity>
          ) : null}
          {PRIVACY_URL ? (
            <TouchableOpacity onPress={() => openLink(PRIVACY_URL)} accessibilityRole="link">
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161B22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingTop: 96,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  proActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(126, 231, 135, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  proActiveText: {
    color: '#7EE787',
    fontSize: 13,
    fontWeight: '600',
  },
  compareRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  compareCol: {
    flex: 1,
    backgroundColor: '#161B22',
    borderRadius: 12,
    padding: 14,
  },
  compareColPro: {
    borderWidth: 1,
    borderColor: '#7EE787',
  },
  compareTitle: {
    color: '#8B949E',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  compareTitlePro: {
    color: '#7EE787',
  },
  compareItem: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 20,
  },
  compareItemPro: {
    color: '#C9D1D9',
  },
  loadingBox: {
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    color: '#8B949E',
    fontSize: 13,
    textAlign: 'center',
  },
  packages: {
    gap: 12,
    marginBottom: 20,
  },
  packageCard: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageSelected: {
    borderColor: '#7EE787',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#7EE787',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 8,
  },
  badgeText: {
    color: '#0D1117',
    fontSize: 11,
    fontWeight: '700',
  },
  packageName: {
    color: '#E6EDF3',
    fontSize: 16,
    fontWeight: '700',
  },
  packagePrice: {
    color: '#8B949E',
    fontSize: 14,
    marginTop: 4,
  },
  cta: {
    backgroundColor: '#7EE787',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#0D1117',
    fontSize: 16,
    fontWeight: '700',
  },
  disclosure: {
    color: '#6E7681',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 20,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  footerLink: {
    color: '#58A6FF',
    fontSize: 13,
  },
})
