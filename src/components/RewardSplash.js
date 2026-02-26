// ─────────────────────────────────────────────────────────────
// RewardSplash.js — Post-log celebration overlay
// Motion ON: scale + opacity + haptic (<300ms cap)
// Reduced motion: instant state + haptic (no animation)
// Gated behind ff_reward_splash feature flag.
// Polish enhancements gated behind ff_reward_polish.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'
import { useFlags } from '../services/FeatureFlags'

const { width: SCREEN_W } = Dimensions.get('window')

// ── Micro-insight pool ───────────────────────────────────────

const INSIGHTS = [
  { text: 'Dark leafy greens are among the most nutrient-dense foods on earth.', emoji: '🥬' },
  { text: 'Cold-pressed juice retains up to 94% of active enzymes.', emoji: '❄️' },
  { text: 'Ginger contains gingerol, a powerful anti-inflammatory compound.', emoji: '🫚' },
  { text: 'Beets are rich in nitrates that support healthy blood flow.', emoji: '🟣' },
  { text: 'Vitamin C absorption increases when paired with iron-rich greens.', emoji: '🍋' },
  { text: 'Celery juice provides natural electrolytes: sodium & potassium.', emoji: '🥒' },
  { text: 'Turmeric curcumin is better absorbed with a pinch of black pepper.', emoji: '🟡' },
  { text: 'Consistent juicing builds cumulative nutritional benefits over time.', emoji: '📈' },
]

function pickInsight() {
  return INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)]
}

// ── Juice Splash Droplets ────────────────────────────────────
// Minimal droplet particles that burst outward on log.
// Gated behind ff_juice_splash. Under 350ms.
// Reduced motion = no particles, fade only.

const DROPLET_COUNT = 6
const DROPLET_COLORS = ['#81C784', '#64B5F6', '#FFB74D', '#4DD0E1', '#FFD54F', '#CE93D8']

function JuiceSplashDroplets({ visible, isReduced }) {
  const droplets = useRef(
    Array.from({ length: DROPLET_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current

  useEffect(() => {
    if (!visible || isReduced) return

    const anims = droplets.map((d, i) => {
      const angle = (i / DROPLET_COUNT) * Math.PI * 2
      const dist = 60 + Math.random() * 40
      const targetX = Math.cos(angle) * dist
      const targetY = Math.sin(angle) * dist

      d.x.setValue(0)
      d.y.setValue(0)
      d.scale.setValue(0.3)
      d.opacity.setValue(0.8)

      return Animated.parallel([
        Animated.timing(d.x, {
          toValue: targetX,
          duration: 320,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(d.y, {
          toValue: targetY,
          duration: 320,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(d.scale, {
            toValue: 1,
            duration: 150,
            easing: EASING.decelerate,
            useNativeDriver: true,
          }),
          Animated.timing(d.scale, {
            toValue: 0,
            duration: 170,
            easing: EASING.accelerate,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(d.opacity, {
          toValue: 0,
          duration: 320,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
      ])
    })

    Animated.stagger(30, anims).start()
  }, [visible, isReduced])

  if (!visible || isReduced) return null

  return (
    <View style={dropletStyles.container} pointerEvents="none">
      {droplets.map((d, i) => (
        <Animated.View
          key={i}
          style={[
            dropletStyles.droplet,
            {
              backgroundColor: DROPLET_COLORS[i % DROPLET_COLORS.length],
              opacity: d.opacity,
              transform: [
                { translateX: d.x },
                { translateY: d.y },
                { scale: d.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  )
}

const dropletStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    width: 0,
    height: 0,
  },
  droplet: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
    marginTop: -5,
  },
})

// ── Main Component ───────────────────────────────────────────

// ── Polished duration caps (<300ms) ─────────────────────────

const POLISHED_DURATION = {
  overlay: 180,
  card: 200,
  emoji: 180,
  insight: 250,
  exit: 150,
}

export default function RewardSplash({ visible, onDismiss, autoHideMs = 3500 }) {
  const isReduced = useReducedMotion()
  const { isEnabled } = useFlags()
  const isPolished = isEnabled('ff_reward_polish')
  const isJuiceSplash = isEnabled('ff_juice_splash')
  const insight = useMemo(() => pickInsight(), [visible])

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const cardScale = useRef(new Animated.Value(0.8)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const emojiScale = useRef(new Animated.Value(0.3)).current
  const insightOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) {
      // Exit animation
      const exitDur = isPolished ? POLISHED_DURATION.exit : (isReduced ? DURATION.crossfade : DURATION.exit)
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: exitDur,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: exitDur,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
      ]).start()
      return
    }

    // Fire haptic immediately
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    if (isPolished && isReduced) {
      // Polished + reduced motion: instant state, no animation at all
      overlayOpacity.setValue(1)
      cardScale.setValue(1)
      cardOpacity.setValue(1)
      emojiScale.setValue(1)
      insightOpacity.setValue(1)
      // Haptic already fired above — that's the only feedback
    } else if (isReduced) {
      // Legacy reduced motion: simple crossfade, no transforms
      overlayOpacity.setValue(0)
      cardScale.setValue(1)
      cardOpacity.setValue(0)
      emojiScale.setValue(1)
      insightOpacity.setValue(0)

      Animated.sequence([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: DURATION.crossfade,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: DURATION.crossfade,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
        Animated.timing(insightOpacity, {
          toValue: 1,
          duration: DURATION.crossfade,
          easing: EASING.linear,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (isPolished) {
      // Polished full motion: all animations capped <300ms, no springs
      overlayOpacity.setValue(0)
      cardScale.setValue(0.9)
      cardOpacity.setValue(0)
      emojiScale.setValue(0.5)
      insightOpacity.setValue(0)

      // Single choreographed sequence — total <300ms
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: POLISHED_DURATION.overlay,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: POLISHED_DURATION.card,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: POLISHED_DURATION.card,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(emojiScale, {
          toValue: 1,
          duration: POLISHED_DURATION.emoji,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(insightOpacity, {
          toValue: 1,
          duration: POLISHED_DURATION.insight,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      })
    } else {
      // Legacy full motion: scale + opacity choreography
      overlayOpacity.setValue(0)
      cardScale.setValue(0.8)
      cardOpacity.setValue(0)
      emojiScale.setValue(0.3)
      insightOpacity.setValue(0)

      // Phase 1: Overlay + card entrance
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: DURATION.enter,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale, {
          toValue: 1,
          tension: 200,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: DURATION.enter,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }),
      ]).start()

      // Phase 2: Emoji pop (staggered)
      setTimeout(() => {
        Animated.spring(emojiScale, {
          toValue: 1,
          tension: 300,
          friction: 8,
          useNativeDriver: true,
        }).start()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }, 200)

      // Phase 3: Insight fade in
      setTimeout(() => {
        Animated.timing(insightOpacity, {
          toValue: 1,
          duration: DURATION.standard,
          easing: EASING.decelerate,
          useNativeDriver: true,
        }).start()
      }, 500)
    }

    // Auto-dismiss
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss()
    }, autoHideMs)

    return () => clearTimeout(timer)
  }, [visible, isReduced, isPolished])

  if (!visible) return null

  return (
    <Animated.View style={[splashStyles.overlay, { opacity: overlayOpacity }]}>
      <Animated.View
        style={[
          splashStyles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}
      >
        {/* Juice Splash droplets (behind ff_juice_splash) */}
        {isJuiceSplash && (
          <JuiceSplashDroplets visible={visible} isReduced={isReduced} />
        )}

        {/* Success emoji */}
        <Animated.Text
          style={[
            splashStyles.emoji,
            { transform: [{ scale: emojiScale }] },
          ]}
        >
          {isJuiceSplash ? '🧃' : '✅'}
        </Animated.Text>

        {/* Title */}
        <Text
          style={splashStyles.title}
          accessibilityRole="header"
        >
          Juice Logged!
        </Text>

        {/* Micro-insight card */}
        <Animated.View style={[splashStyles.insightCard, { opacity: insightOpacity }]}>
          <Text style={splashStyles.insightEmoji}>{insight.emoji}</Text>
          <Text style={splashStyles.insightText}>{insight.text}</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
}

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,13,10,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    maxWidth: SCREEN_W * 0.85,
  },
  emoji: {
    fontSize: 64,
    marginBottom: SPACE.lg,
  },
  title: {
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.green,
    marginBottom: SPACE.xl,
    textAlign: 'center',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.xl,
    padding: SPACE.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  insightEmoji: {
    fontSize: 24,
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    lineHeight: 20,
  },
})
