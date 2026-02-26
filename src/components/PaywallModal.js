// ─────────────────────────────────────────────────────────────
// PaywallModal.js — Strategic conversion modal
// Triggered on success states (3-day streak, badge unlock)
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
  Crown,
  Zap,
  Camera,
  BarChart3,
  ChefHat,
  Infinity,
  Check,
} from 'lucide-react-native'
import { SUBSCRIPTION_PLANS, usePro } from '../services/ProStore'

const PLAN_KEYS = ['monthly', 'annual', 'lifetime']

const PRO_PERKS = [
  { icon: <Camera size={16} color="#64B5F6" />, text: 'Unlimited AI Snaps' },
  { icon: <BarChart3 size={16} color="#81C784" />, text: 'Weekly Vitality Reports' },
  { icon: <ChefHat size={16} color="#FFB74D" />, text: 'Pro Recipe Categories' },
  { icon: <Zap size={16} color="#FFD54F" />, text: 'Advanced Nutrient Data' },
  { icon: <Infinity size={16} color="#CE93D8" />, text: 'Monthly Vitality Wraps' },
]

export default function PaywallModal({ visible, onDismiss, trigger }) {
  const { subscribe, setPaywallSeen } = usePro()
  const [selectedPlan, setSelectedPlan] = React.useState('annual')
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      setPaywallSeen(trigger)
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

  const triggerMessage = trigger === 'streak_3'
    ? 'You\'re building an incredible foundation.'
    : trigger === 'badge_unlock'
      ? 'You just unlocked a new achievement!'
      : 'You\'re making real progress.'

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <BlurView intensity={40} tint="dark" style={styles.overlay}>
        <Animated.View style={[
          styles.card,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}>
          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss}>
            <X size={20} color="#8B949E" />
          </TouchableOpacity>

          {/* Crown */}
          <View style={styles.crownWrap}>
            <LinearGradient
              colors={['#FFD54F', '#FF9800']}
              style={styles.crownCircle}
            >
              <Crown size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>{triggerMessage}</Text>
          <Text style={styles.subheadline}>
            Want to see the full impact on your cells? Unlock{' '}
            <Text style={styles.proText}>Architect Pro</Text> for a deep-dive into your nutrients.
          </Text>

          {/* Perks */}
          <View style={styles.perksSection}>
            {PRO_PERKS.map((perk, i) => (
              <View key={i} style={styles.perkRow}>
                {perk.icon}
                <Text style={styles.perkText}>{perk.text}</Text>
                <Check size={14} color="#81C784" />
              </View>
            ))}
          </View>

          {/* Plan Selector */}
          <View style={styles.planRow}>
            {PLAN_KEYS.map((key) => {
              const plan = SUBSCRIPTION_PLANS[key]
              const isSelected = selectedPlan === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedPlan(key)
                  }}
                  activeOpacity={0.7}
                >
                  {plan.badge && (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                  <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                    {plan.label}
                  </Text>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {plan.price}
                  </Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                  {plan.savings && (
                    <Text style={styles.planSavings}>{plan.savings}</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleSubscribe}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Crown size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>
                Unlock Architect Pro — {SUBSCRIPTION_PLANS[selectedPlan].price}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Cancel anytime. Restore purchases available in Settings.
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
    borderColor: 'rgba(255,255,255,0.08)',
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
    shadowColor: '#FFD54F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  headline: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subheadline: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  proText: {
    color: '#FFD54F',
    fontWeight: '800',
  },

  // Perks
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
    fontSize: 14,
    fontWeight: '600',
    color: '#C9D1D9',
  },

  // Plan selector
  planRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: 'rgba(129,199,132,0.3)',
    backgroundColor: 'rgba(129,199,132,0.06)',
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FFD54F',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#8B949E',
    marginTop: 4,
  },
  planLabelSelected: {
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#C9D1D9',
    marginTop: 4,
  },
  planPriceSelected: {
    color: '#FFFFFF',
  },
  planPeriod: {
    fontSize: 10,
    color: '#484F58',
    marginTop: 2,
  },
  planSavings: {
    fontSize: 10,
    fontWeight: '800',
    color: '#81C784',
    marginTop: 4,
  },

  // CTA
  ctaBtn: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#2D6A4F',
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
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  legalText: {
    fontSize: 11,
    color: '#484F58',
    textAlign: 'center',
  },
})
