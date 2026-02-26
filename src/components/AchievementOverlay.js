// ─────────────────────────────────────────────────────────────
// AchievementOverlay.js — Minimal achievement unlock overlay
//
// Shows a subtle bottom-sheet style overlay when an achievement
// is unlocked. Elegant glow animation + "Nice ✨" dismiss.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
} from 'react-native'
import * as Haptics from 'expo-haptics'

export default function AchievementOverlay({ achievement, visible, onDismiss }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start()
      // Glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
        ])
      ).start()
    } else {
      scaleAnim.setValue(0.8)
      opacityAnim.setValue(0)
      glowAnim.setValue(0)
    }
  }, [visible])

  if (!achievement) return null

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.18],
  })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          {/* Glow ring */}
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

          <Text style={styles.emoji}>{achievement.emoji}</Text>
          <Text style={styles.title}>Achievement Unlocked</Text>
          <Text style={styles.subtitle}>{achievement.title}</Text>
          <Text style={styles.desc}>{achievement.subtitle}</Text>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onDismiss()
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss achievement"
          >
            <Text style={styles.btnText}>Nice ✨</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0D1A14',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.2)',
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(76,175,80,0.3)',
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  desc: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
})
