// ─────────────────────────────────────────────────────────────
// VaultScreen.js — RawLifeFlow Pro subscription screen
// Two plans only: Monthly ($7.99/mo) and Annual ($59.99/yr)
// 60 successful AI Juice Snaps per month, unlimited manual entry
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  Check,
  Camera,
  Sparkles,
} from 'lucide-react-native'
import { usePro, SUBSCRIPTION_PLANS } from '../services/ProStore'
import {
  PRO_MONTHLY_SCAN_LIMIT,
  FREE_MONTHLY_SCAN_LIMIT,
  MONTHLY_FALLBACK_PRICE,
  ANNUAL_FALLBACK_PRICE,
} from '../services/subscriptions/subscriptionConfig'
import MeshGradientBg from '../components/MeshGradientBg'

const PLAN_KEYS = ['monthly', 'annual']

const PRO_BENEFITS = [
  { icon: <Camera size={16} color="#7EE787" />, text: `${PRO_MONTHLY_SCAN_LIMIT} successful AI Juice Snaps each month` },
  { icon: <Check size={16} color="#7EE787" />, text: 'Full ingredient and estimated-nutrition analysis' },
  { icon: <Check size={16} color="#7EE787" />, text: 'Unlimited manual ingredient entry' },
  { icon: <Check size={16} color="#7EE787" />, text: 'Save and revisit your juice history and progress' },
  { icon: <Check size={16} color="#7EE787" />, text: 'Restore Pro access when signed into the same account' },
]

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  )
}

export default function VaultScreen({ navigation }) {
  const { pro, isPro, subscribe, snapInfo } = usePro()
  const [selectedPlan, setSelectedPlan] = useState('annual')
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 100,
      useNativeDriver: true,
    }).start()
  }, [])

  const handleSubscribe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    subscribe(selectedPlan)
  }

  const ctaPrice = selectedPlan === 'monthly' ? MONTHLY_FALLBACK_PRICE : ANNUAL_FALLBACK_PRICE
  const ctaLabel = selectedPlan === 'monthly'
    ? `Start RawLifeFlow Pro Monthly — ${ctaPrice}/month`
    : `Start RawLifeFlow Pro Annual — ${ctaPrice}/year`

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>RawLifeFlow Pro</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* ═══ PRO STATUS ═══════════════════════════════════ */}
            {isPro && (
              <View style={styles.proStatusCard}>
                <LinearGradient
                  colors={['rgba(126,231,135,0.12)', 'rgba(46,160,67,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.proStatusGradient}
                >
                  <Check size={24} color="#7EE787" />
                  <View style={styles.proStatusInfo}>
                    <Text style={styles.proStatusTitle}>RawLifeFlow Pro Active</Text>
                    <Text style={styles.proStatusDesc}>
                      {pro.subscriptionPlan === 'annual' ? 'Annual plan' : 'Monthly plan'} — {PRO_MONTHLY_SCAN_LIMIT} successful Juice Snaps per month
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* ═══ SUBSCRIPTION PLANS ═══════════════════════════ */}
            {!isPro && (
              <>
                <SectionHeader
                  icon={<Sparkles size={20} color="#7EE787" />}
                  title="RawLifeFlow Pro"
                  subtitle="Unlock more Juice Snaps each month"
                />

                <View style={styles.perksCard}>
                  {PRO_BENEFITS.map((perk, i) => (
                    <View key={i} style={styles.perkRow}>
                      {perk.icon}
                      <Text style={styles.perkText}>{perk.text}</Text>
                      <Check size={14} color="#7EE787" />
                    </View>
                  ))}
                </View>

                {/* Plan cards — exactly 2 */}
                <View style={styles.planRow}>
                  {PLAN_KEYS.map((key) => {
                    const plan = SUBSCRIPTION_PLANS[key]
                    const isSelected = selectedPlan === key
                    const displayPrice = key === 'monthly' ? MONTHLY_FALLBACK_PRICE : ANNUAL_FALLBACK_PRICE
                    const periodLabel = key === 'monthly' ? 'per month' : 'per year'
                    const planName = key === 'monthly' ? 'RawLifeFlow Pro Monthly' : 'RawLifeFlow Pro Annual'
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.planCard, isSelected && styles.planCardSelected]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setSelectedPlan(key)
                        }}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${planName}, ${displayPrice} ${periodLabel}, ${PRO_MONTHLY_SCAN_LIMIT} successful Juice Snaps each month`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        {plan.badge && (
                          <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>{plan.badge}</Text>
                          </View>
                        )}
                        <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                          {key === 'monthly' ? 'Monthly' : 'Annual'}
                        </Text>
                        <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                          {displayPrice}
                        </Text>
                        <Text style={styles.planPeriod}>{periodLabel}</Text>
                        <Text style={styles.planScans}>{PRO_MONTHLY_SCAN_LIMIT} scans monthly</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <TouchableOpacity
                  style={styles.subscribeCta}
                  onPress={handleSubscribe}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={ctaLabel}
                >
                  <LinearGradient
                    colors={['#7EE787', '#2EA043']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.subscribeCtaGradient}
                  >
                    <Text style={styles.subscribeCtaText}>{ctaLabel}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.legalText}>
                  Cancel anytime. Restore purchases available in Settings.{'\n'}
                  Manual ingredient entry always remains unlimited.
                </Text>
              </>
            )}

            {/* ═══ SCAN BALANCE ══════════════════════════════════ */}
            <View style={styles.snapBalanceCard}>
              <Camera size={16} color="#7EE787" />
              <Text style={styles.snapBalanceText}>
                Juice Snaps: <Text style={styles.snapBalanceValue}>{snapInfo.label}</Text>
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D0A' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },

  proStatusCard: {
    marginBottom: 20,
    borderRadius: 28,
    overflow: 'hidden',
  },
  proStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(126,231,135,0.15)',
  },
  proStatusInfo: { flex: 1 },
  proStatusTitle: { fontSize: 18, fontWeight: '900', color: '#7EE787' },
  proStatusDesc: { fontSize: 12, color: '#8B949E', marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  sectionSubtitle: { fontSize: 12, color: '#484F58', marginTop: 1 },

  perksCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    gap: 10,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#C9D1D9',
  },

  planRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: 'rgba(126,231,135,0.4)',
    backgroundColor: 'rgba(126,231,135,0.06)',
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#7EE787',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 24,
  },
  planBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0D1117',
    letterSpacing: 0.5,
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B949E',
    marginTop: 4,
  },
  planLabelSelected: { color: '#FFFFFF' },
  planPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: '#C9D1D9',
    marginTop: 4,
  },
  planPriceSelected: { color: '#FFFFFF' },
  planPeriod: {
    fontSize: 11,
    color: '#484F58',
    marginTop: 2,
  },
  planScans: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7EE787',
    marginTop: 6,
  },

  subscribeCta: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#2EA043',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  subscribeCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  subscribeCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  legalText: {
    fontSize: 11,
    color: '#484F58',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 16,
  },

  snapBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(126,231,135,0.04)',
    borderRadius: 24,
    padding: 14,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(126,231,135,0.1)',
  },
  snapBalanceText: {
    fontSize: 13,
    color: '#8B949E',
    fontWeight: '600',
  },
  snapBalanceValue: {
    color: '#7EE787',
    fontWeight: '800',
  },
})
