// ─────────────────────────────────────────────────────────────
// FreezerPassModal.js — "Mercy" modal when a Freezer Pass is
// used, plus the "Thaw Streak" confirmation flow
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

// ── Mercy Modal (shown after a pass was auto-used) ───────────

export function MercyModal({ visible, onDismiss, streak, passesRemaining }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
    } else {
      scaleAnim.setValue(0.8)
      opacityAnim.setValue(0)
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.iceEmoji}>🧊</Text>
          <Text style={styles.mercyTitle}>Streak Frozen!</Text>
          <Text style={styles.mercyBody}>
            Phew! Your streak was frozen. We saved your{' '}
            <Text style={styles.mercyHighlight}>{streak}-day</Text> progress.
          </Text>
          <Text style={styles.mercyPasses}>
            You have <Text style={styles.mercyHighlight}>{passesRemaining}</Text> pass{passesRemaining !== 1 ? 'es' : ''} remaining.
          </Text>
          <Text style={styles.mercySub}>Ready to get back to liquid gold?</Text>

          <TouchableOpacity
            style={styles.mercyBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onDismiss()
            }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#64B5F6', '#42A5F5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mercyBtnGradient}
            >
              <Text style={styles.mercyBtnText}>Let's Juice!</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

// ── Thaw Confirmation Modal ──────────────────────────────────

export function ThawConfirmModal({ visible, onConfirm, onCancel, passesRemaining }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.iceEmoji}>🧊</Text>
          <Text style={styles.mercyTitle}>Use Freezer Pass?</Text>
          <Text style={styles.mercyBody}>
            This will protect your streak for today. You have{' '}
            <Text style={styles.mercyHighlight}>{passesRemaining}</Text> pass{passesRemaining !== 1 ? 'es' : ''} left.
          </Text>
          <Text style={styles.mercySub}>
            Earn more by completing Weekly Rainbows 🌈
          </Text>

          <View style={styles.thawBtnRow}>
            <TouchableOpacity
              style={styles.thawCancelBtn}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.thawCancelText}>Not Yet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.thawConfirmBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                onConfirm()
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#90CAF9', '#64B5F6']}
                style={styles.thawConfirmGradient}
              >
                <Text style={styles.thawConfirmText}>Freeze Streak</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Quick Thaw Recipe Suggestion ─────────────────────────────

export function ThawRecipeSuggestion({ onPress }) {
  return (
    <TouchableOpacity
      style={styles.thawRecipe}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.thawRecipeEmoji}>🍋</Text>
      <View style={styles.thawRecipeContent}>
        <Text style={styles.thawRecipeTitle}>Quick Thaw Shot</Text>
        <Text style={styles.thawRecipeSub}>
          Half a lemon + pinch of cayenne in water. Counts as a Kick shot!
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(13,17,23,0.92)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  card: {
    backgroundColor: 'rgba(13,17,23,0.95)', borderRadius: 32, padding: 28,
    alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(100,181,246,0.15)',
    width: '100%', maxWidth: 340,
    shadowColor: '#64B5F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1, shadowRadius: 24,
  },
  iceEmoji: { fontSize: 56, marginBottom: 12 },
  mercyTitle: {
    fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginBottom: 12,
  },
  mercyBody: {
    fontSize: 14, color: '#8B949E', textAlign: 'center', lineHeight: 20,
    marginBottom: 8,
  },
  mercyHighlight: { color: '#64B5F6', fontWeight: '800' },
  mercyPasses: {
    fontSize: 13, color: '#8B949E', textAlign: 'center', marginBottom: 8,
  },
  mercySub: {
    fontSize: 12, color: '#484F58', textAlign: 'center',
    fontStyle: 'italic', marginBottom: 20,
  },
  mercyBtn: { width: '100%', borderRadius: 28, overflow: 'hidden' },
  mercyBtnGradient: {
    paddingVertical: 16, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  mercyBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  // Thaw confirm
  thawBtnRow: {
    flexDirection: 'row', gap: 12, marginTop: 16, width: '100%',
  },
  thawCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  thawCancelText: { fontSize: 14, fontWeight: '700', color: '#8B949E' },
  thawConfirmBtn: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  thawConfirmGradient: {
    paddingVertical: 14, borderRadius: 24, alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  thawConfirmText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  // Thaw recipe
  thawRecipe: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(100,181,246,0.06)',
    borderRadius: 24, padding: 16, gap: 12,
    borderWidth: 0.5, borderColor: 'rgba(100,181,246,0.12)',
  },
  thawRecipeEmoji: { fontSize: 28 },
  thawRecipeContent: { flex: 1 },
  thawRecipeTitle: { fontSize: 14, fontWeight: '800', color: '#64B5F6' },
  thawRecipeSub: { fontSize: 12, color: '#8B949E', marginTop: 2, lineHeight: 16 },
})
