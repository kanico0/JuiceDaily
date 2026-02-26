// ─────────────────────────────────────────────────────────────
// SnapGateModal.js — Teaser modal when free snaps exhausted
// Shows what user is missing + upgrade/buy snap pack options
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
  Crown,
  Sparkles,
  Zap,
  ShoppingBag,
} from 'lucide-react-native'
import { SUBSCRIPTION_PLANS, IAP_PACKS, usePro } from '../services/ProStore'

export default function SnapGateModal({ visible, onDismiss, onUpgrade, onBuyPack }) {
  const { snapInfo } = usePro()
  const scaleAnim = useRef(new Animated.Value(0.9)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    } else {
      scaleAnim.setValue(0.9)
      opacityAnim.setValue(0)
    }
  }, [visible])

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })

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

          {/* Camera icon */}
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Camera size={28} color="#64B5F6" />
            </View>
            <View style={styles.iconBadge}>
              <Text style={styles.iconBadgeText}>0</Text>
            </View>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>Snaps Exhausted</Text>
          <Text style={styles.body}>
            You've used your 3 Free Snaps for {monthName}.{' '}
            <Text style={styles.proHighlight}>Wellness Architects</Text> get unlimited AI scanning,
            instant nutrient breakdown, and Fridge Forager integration.
          </Text>

          {/* What you're missing preview */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>What you're missing</Text>
            <View style={styles.previewRow}>
              <Sparkles size={14} color="#FFD54F" />
              <Text style={styles.previewText}>Instant produce identification</Text>
            </View>
            <View style={styles.previewRow}>
              <Zap size={14} color="#81C784" />
              <Text style={styles.previewText}>Nutrient breakdown per juice</Text>
            </View>
            <View style={styles.previewRow}>
              <ShoppingBag size={14} color="#CE93D8" />
              <Text style={styles.previewText}>Fridge Forager recipe matching</Text>
            </View>
          </View>

          {/* Option 1: Upgrade to Pro */}
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
              onDismiss()
              if (onUpgrade) onUpgrade()
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeBtnGradient}
            >
              <Crown size={18} color="#FFFFFF" />
              <Text style={styles.upgradeBtnText}>
                Upgrade to Pro — {SUBSCRIPTION_PLANS.monthly.price}/mo
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Option 2: Buy Snap Pack */}
          <TouchableOpacity
            style={styles.packBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onDismiss()
              if (onBuyPack) onBuyPack()
            }}
            activeOpacity={0.7}
          >
            <Camera size={16} color="#64B5F6" />
            <Text style={styles.packBtnText}>
              Buy {IAP_PACKS.snap_10.label} — {IAP_PACKS.snap_10.price}
            </Text>
          </TouchableOpacity>
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

  // Icon
  iconWrap: {
    marginBottom: 16,
    marginTop: 8,
    position: 'relative',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(100,181,246,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.2)',
  },
  iconBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E91E63',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(13,17,23,0.95)',
  },
  iconBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Text
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  proHighlight: {
    color: '#FFD54F',
    fontWeight: '800',
  },

  // Preview
  previewCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    gap: 10,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C9D1D9',
  },

  // Buttons
  upgradeBtn: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  upgradeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  upgradeBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  packBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    width: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(100,181,246,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  packBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64B5F6',
  },
})
