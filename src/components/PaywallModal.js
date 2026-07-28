// ─────────────────────────────────────────────────────────────
// PaywallModal.js — RawLifeFlow Pro subscription modal
// Two plans only: Monthly ($7.99/mo) and Annual ($59.99/yr)
// 60 successful AI Juice Snaps per month, unlimited manual entry
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
  X,
  Camera,
  Check,
  Sparkles,
} from 'lucide-react-native'
import { usePro, SUBSCRIPTION_PLANS } from '../services/ProStore'
import {
  PRO_MONTHLY_SCAN_LIMIT,
  MONTHLY_FALLBACK_PRICE,
  ANNUAL_FALLBACK_PRICE,
} from '../services/subscriptions/subscriptionConfig'

const PLAN_KEYS = ['monthly', 'annual']

const PRO_BENEFITS = [
  { icon: <Camera size={16} color="#7EE787" />, text: `${PRO_MONTHLY_SCAN_LIMIT} successful AI Juice Snaps each month` },
  { icon: <Check size={16} color="#7EE787" />, text: 'Full ingredient and estimated-nutrition analysis' },
  { icon: <Check size={16} color="#7EE787" />, text: 'Unlimited manual ingredient entry' },
  { icon: <Check size={16} color="#7EE787" />, text: 'Save and revisit your juice history and progress' },
  { icon: <Check size={16} color="#7EE787" />, text: 'Restore Pro access when signed into the same account' },
]

export default function PaywallModal({ visible, onDismiss, trigger }) {
  const { subscribe, isPro } = usePro()
  const [selectedPlan, setSelectedPlan] = React.useState('annual')
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    } else {
      scaleAnim.setValue(0.9)
      opacityAnim.setValue(0)
    }
  }, [visible])

  const handleSubscribe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    subscribe(selectedPlan)
    onDismiss()
  }

  const ctaPrice = selectedPlan === 'monthly' ? MONTHLY_FALLBACK_PRICE : ANNUAL_FALLBACK_PRICE
  const ctaLabel = selectedPlan === 'monthly'
    ? `Start RawLifeFlow Pro Monthly — ${ctaPrice}/month`
    : `Start RawLifeFlow Pro Annual — ${ctaPrice}/year`

  if (isPro) {
    return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
        <BlurView intensity={40} tint="dark" style={styles.overlay}>
          <Animated.View style={[
            styles.card,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}>
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color="#8B949E" />
            </TouchableOpacity>
            <View style={styles.crownWrap}>
              <LinearGradient
                colors={['#7EE787', '#2EA043']}
                style={styles.crownCircle}
              >
                <Check size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.headline}>RawLifeFlow Pro is Active</Text>
            <Text style={styles.subheadline}>
              You have {PRO_MONTHLY_SCAN_LIMIT} successful AI Juice Snaps each month.{'\n'}
              Manual ingredient entry remains unlimited.
            </Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={onDismiss} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Continue">
              <LinearGradient
                colors={['#7EE787', '#2EA043']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </BlurView>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <BlurView intensity={40} tint="dark" style={styles.overlay}>
        <Animated.View style={[
          styles.card,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close paywall"
          >
            <X size={20} color="#8B949E" />
          </TouchableOpacity>

          <View style={styles.crownWrap}>
            <LinearGradient
              colors={['#7EE787', '#2EA043']}
              style={styles.crownCircle}
            >
              <Sparkles size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={styles.headline}>RawLifeFlow Pro</Text>
          <Text style={styles.subheadline}>
            Get more Juice Snaps each month and keep building your RawLifeFlow routine.
          </Text>

          <View style={styles.perksSection}>
            {PRO_BENEFITS.map((perk, i) => (
              <View key={i} style={styles.perkRow}>
                {perk.icon}
                <Text style={styles.perkText}>{perk.text}</Text>
              </View>
            ))}
          </View>

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
            style={styles.ctaBtn}
            onPress={handleSubscribe}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            <LinearGradient
              colors={['#7EE787', '#2EA043']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Cancel anytime. Restore purchases available in Settings.{'\n'}
            Manual ingredient entry always remains unlimited.
          </Text>
        </Animated.View>
      </BlurView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderRadius: 32,
    padding: 26,
    borderWidth: 0.5,
    borderColor: 'rgba(126,231,135,0.12)',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  crownWrap: {
    marginBottom: 16,
    marginTop: 8,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7EE787',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  perksSection: {
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  perkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#C9D1D9',
  },
  planRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
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
  planLabelSelected: {
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#C9D1D9',
    marginTop: 4,
  },
  planPriceSelected: {
    color: '#FFFFFF',
  },
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
  ctaBtn: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#2EA043',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  legalText: {
    fontSize: 11,
    color: '#484F58',
    textAlign: 'center',
    lineHeight: 16,
  },
})
