// ─────────────────────────────────────────────────────────────
// PaywallScreen.js — RawLifeFlow Pro upsell.
//
// Rules: localized prices only (no hardcoding), auto-renewal
// disclosure, Restore Purchases, Terms + Privacy links, close
// control, no dark patterns, double-tap protection (store-level).
//
// QA10: Redesigned with accurate, verified feature lists only.
// Free side: positive but honest about limits.
// Pro side: substantial, scrollable, organized into sections.
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
import { X, Check, Sparkles, Camera, BookOpen, RefreshCw, Search, Leaf, Clock, Heart, Beaker, TrendingUp } from 'lucide-react-native'

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
import AccountGateModal from '../components/AccountGateModal'

// ── Free feature groups ──
const FREE_FEATURE_GROUPS = [
  {
    heading: 'Unlimited Manual Juicing',
    items: [
      'Manually build and log juices without an AI-use quota',
      'Simple blends (1–4 ingredients): free and unlimited',
    ],
  },
  {
    heading: 'Juice Snap',
    items: [
      `${FREE_MONTHLY_SCAN_LIMIT} successful Juice Snap per monthly RawLifeFlow window`,
    ],
  },
  {
    heading: 'Expanded Ingredient Analysis',
    items: [
      '3 complimentary lifetime analyses for blends with 5+ ingredients',
    ],
  },
  {
    heading: 'History',
    items: [
      'Basic History list — always available',
      'Detailed History preview of your newest juice',
    ],
  },
  {
    heading: 'Core Habit Experience',
    items: [
      'Today dashboard',
      'Glow streak',
      'Journey',
      'Garden',
      'Focus',
      'Achievements',
      'Reminders',
    ],
  },
]

const FREE_LIMITATIONS = [
  `Only ${FREE_MONTHLY_SCAN_LIMIT} Juice Snap per monthly window`,
  'Only 3 lifetime Expanded Ingredient Analyses for 5+ ingredient juices',
  'Detailed History across older entries requires Pro',
  'History search requires Pro',
  'Advanced History filters require Pro',
  'Make This Juice Again on older entries requires Pro',
  'Ratings, notes & favorites across full History require Pro',
  'Organic / conventional details across older entries require Pro',
  'Entry method & logged time across older entries require Pro',
]

// ── Pro feature groups ──
const PRO_FEATURE_GROUPS = [
  {
    heading: 'More Juice Snap',
    icon: Camera,
    items: [
      `${PRO_MONTHLY_SCAN_LIMIT} successful Juice Snaps per monthly RawLifeFlow window`,
      'Use the camera more often instead of manually identifying produce',
    ],
  },
  {
    heading: 'Unlimited Expanded Ingredient Analysis',
    icon: Beaker,
    items: [
      'Unlimited 5+ ingredient analyses with Pro',
      'Analyze complex juices without exhausting the Free lifetime allowance',
    ],
  },
  {
    heading: 'Your Full Juicing Story',
    icon: BookOpen,
    items: [
      'Ingredient portions',
      'Organic vs. conventional status',
      'Entry method',
      'Logged time / time of day',
      'Estimated Nutrition',
      'Top Nutrients (% Daily Reference)',
      'Estimated Yield',
      'Produce Balance',
      'Rating, notes & favorites',
    ],
  },
  {
    heading: 'Search & Filter Your History',
    icon: Search,
    items: [
      'Text search across ingredients, notes, and titles',
      'Filter by favorites, rating, recorded portions',
      'Filter by Estimated Nutrition nutrient threshold',
      'Filter by ≥ / ≤ Daily Reference threshold',
    ],
  },
  {
    heading: 'Make This Juice Again',
    icon: RefreshCw,
    items: [
      'Revisit an older juice and repopulate the builder',
      'Preserved metadata: produce, quantity, unit, size, organic setting',
      'Creates a new current juice — original timestamp stays with the original entry',
    ],
  },
  {
    heading: 'Richer Personal Record',
    icon: Heart,
    items: [
      'Remember how you made it — portions and organic choices stay attached',
      'Remember when you made it — see the logged time and part of day',
      'Remember what you thought — ratings, notes and favorites',
      'Repeat what worked — use Make This Juice Again',
    ],
  },
  {
    heading: 'Core Habit Experience',
    icon: TrendingUp,
    items: [
      'Everything in Free, plus full Detailed History for every saved juice',
      'History search and advanced filters across your entire juicing journey',
    ],
  },
]

export default function PaywallScreen({ navigation, route }) {
  const source = route?.params?.source ?? 'unknown'
  const { state, offering, purchasing, isPro, purchase, restore } = useSubscription()
  const { refresh: refreshQuota } = useQuota()
  const [selectedPlan, setSelectedPlan] = useState('pro_annual')
  const [restoring, setRestoring] = useState(false)
  const [accountGateVisible, setAccountGateVisible] = useState(false)
  // The plan the user tried to purchase before the account gate.
  // Resumed once after successful account upgrade.
  const [pendingPurchasePlan, setPendingPurchasePlan] = useState(null)

  useEffect(() => {
    subscriptionAnalytics.paywallViewed(source)
  }, [source])

  const savingsBadge = useMemo(
    () => formatSavingsBadge(offering?.annualSavingsPercent ?? null),
    [offering],
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
        Alert.alert(
          'Purchase Pending',
          'Your purchase is being processed. Pro will activate automatically once it completes.',
        )
        break
      case 'already_owned':
        Alert.alert(
          'Already Subscribed',
          'Try Restore Purchases to re-activate Pro on this device.',
        )
        break
      case 'account_required':
        // Guest must create/link a recoverable account before purchase.
        // The upgrade preserves the same UUID — no quota reset.
        // Resume the originally selected purchase after upgrade.
        setPendingPurchasePlan(selectedPlan)
        setAccountGateVisible(true)
        break
      case 'unavailable':
        Alert.alert(
          'Store Unavailable',
          'Subscriptions are not available right now. Please try again later.',
        )
        break
      default:
        Alert.alert(
          'Purchase Failed',
          'Something went wrong. You have not been charged. Please try again.',
        )
    }
  }

  // Resume the originally selected purchase once after account upgrade.
  // The upgrade preserved the same UUID, so RevenueCat is still the
  // same custom App User ID. Subject to normal cancellation/error handling.
  const handleAccountAuthenticated = async () => {
    const planToResume = pendingPurchasePlan
    setPendingPurchasePlan(null)
    if (!planToResume) return
    // Resume the purchase exactly once.
    const outcome = await purchase(planToResume, source)
    if (outcome.status === 'success') {
      await refreshQuota()
      Alert.alert('Welcome to Pro!', 'Your Pro features are now active.', [
        { text: 'Continue', onPress: () => navigation.goBack() },
      ])
    }
    // Other outcomes (cancelled, error, unavailable) are handled
    // silently here — the user can tap the plan again if needed.
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const outcome = await restore()
      if (outcome.status === 'restored') {
        await refreshQuota()
        Alert.alert('Purchases Restored', 'Your Pro subscription is active again.')
      } else if (outcome.status === 'no_purchases') {
        Alert.alert(
          'No Purchases Found',
          'We could not find a previous subscription for this account.',
        )
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
          <Text style={styles.title}>Build Your Juicing Habit</Text>
          <Text style={styles.subtitle}>
            Free is a complete way to start and manually build your habit.
            Pro adds more convenience, more detail, and a richer long-term record
            of your juicing journey.
          </Text>
        </View>

        {isPro && (
          <View style={styles.proActiveBanner}>
            <Check size={16} color="#7EE787" />
            <Text style={styles.proActiveText}>Pro is active on this account</Text>
          </View>
        )}

        {/* ── FREE section ── */}
        <View style={styles.freeSection}>
          <Text style={styles.freeHeading}>Free</Text>
          <Text style={styles.freeSubheading}>Start building your juicing habit</Text>
          {FREE_FEATURE_GROUPS.map((group) => (
            <View key={group.heading} style={styles.featureGroup}>
              <Text style={styles.featureGroupHeading}>{group.heading}</Text>
              {group.items.map((item) => (
                <View key={item} style={styles.featureItemRow}>
                  <Check size={12} color="#7EE787" />
                  <Text style={styles.featureItemText}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ── Free limitations ── */}
        <View style={styles.limitationsSection}>
          <Text style={styles.limitationsHeading}>What Free doesn't include</Text>
          {FREE_LIMITATIONS.map((item) => (
            <View key={item} style={styles.limitationRow}>
              <Text style={styles.limitationDot}>·</Text>
              <Text style={styles.limitationText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* ── PRO section ── */}
        <View style={styles.proSection}>
          <Text style={styles.proHeading}>Pro</Text>
          <Text style={styles.proSubheading}>Turn every juice into part of your journey</Text>
          {PRO_FEATURE_GROUPS.map((group) => {
            const Icon = group.icon
            return (
              <View key={group.heading} style={styles.proFeatureGroup}>
                <View style={styles.proFeatureGroupHeader}>
                  <Icon size={16} color="#7EE787" />
                  <Text style={styles.proFeatureGroupHeading}>{group.heading}</Text>
                </View>
                {group.items.map((item) => (
                  <View key={item} style={styles.proFeatureItemRow}>
                    <Check size={12} color="#7EE787" />
                    <Text style={styles.proFeatureItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>

        {/* ── Package selection ── */}
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
                style={[
                  styles.packageCard,
                  selectedPlan === 'pro_annual' && styles.packageSelected,
                ]}
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
                style={[
                  styles.packageCard,
                  selectedPlan === 'pro_monthly' && styles.packageSelected,
                ]}
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

        {/* ── CTA ── */}
        {!isPro && (monthly || annual) && (
          <TouchableOpacity
            style={[styles.cta, purchasing && styles.ctaDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
            accessibilityRole="button"
            accessibilityLabel="Unlock RawLifeFlow Pro"
          >
            {purchasing ? (
              <ActivityIndicator color="#0D1117" />
            ) : (
              <View style={styles.ctaContent}>
                <Text style={styles.ctaText}>Unlock RawLifeFlow Pro</Text>
                <Text style={styles.ctaSubtext}>
                  More Juice Snaps. Unlimited Expanded Ingredient Analysis. Full Detailed History.
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.disclosure}>
          {PRO_MONTHLY_SCAN_LIMIT} image-recognition scans per quota month. Unused scans do not roll
          over. Manual logging remains unlimited.{'\n\n'}
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

      {/* Account gate for guest purchase — UUID preserved on upgrade */}
      <AccountGateModal
        visible={accountGateVisible}
        onClose={() => {
          setAccountGateVisible(false)
          setPendingPurchasePlan(null)
        }}
        onAuthenticated={handleAccountAuthenticated}
        initialMode="protect"
      />
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
  // ── Free section ──
  freeSection: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  freeHeading: {
    color: '#8B949E',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  freeSubheading: {
    color: '#8B949E',
    fontSize: 13,
    marginBottom: 16,
  },
  featureGroup: {
    marginBottom: 14,
  },
  featureGroupHeading: {
    color: '#C9D1D9',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  featureItemText: {
    color: '#8B949E',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  // ── Limitations ──
  limitationsSection: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  limitationsHeading: {
    color: '#8B949E',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  limitationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  limitationDot: {
    color: '#6E7681',
    fontSize: 13,
    lineHeight: 19,
  },
  limitationText: {
    color: '#6E7681',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  // ── Pro section ──
  proSection: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#7EE787',
  },
  proHeading: {
    color: '#7EE787',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  proSubheading: {
    color: '#C9D1D9',
    fontSize: 13,
    marginBottom: 16,
  },
  proFeatureGroup: {
    marginBottom: 18,
  },
  proFeatureGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  proFeatureGroupHeading: {
    color: '#E6EDF3',
    fontSize: 15,
    fontWeight: '600',
  },
  proFeatureItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  proFeatureItemText: {
    color: '#C9D1D9',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  // ── Packages ──
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
  // ── CTA ──
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
  ctaContent: {
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    color: '#0D1117',
    fontSize: 16,
    fontWeight: '700',
  },
  ctaSubtext: {
    color: '#0D1117',
    fontSize: 11,
    opacity: 0.8,
    textAlign: 'center',
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
