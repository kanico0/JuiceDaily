// ─────────────────────────────────────────────────────────────
// IntroLaunchScreen.js — Branded first-launch intro with
// subtle icon micro-animation. Shown only once before tabs.
// ─────────────────────────────────────────────────────────────

import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Camera, Home } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import MeshGradientBg from '../components/MeshGradientBg'
import LiquidNutrientOrb from '../components/LiquidNutrientOrb'
import { useReducedMotion } from '../utils/motion'
import { BRAND } from '../constants/tokens'

export default function IntroLaunchScreen({ onReveal, onSeeHow, onExplore }) {
  const isReduced = useReducedMotion()

  // ── Subtle pulse/float animation on the orb ──────────────
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)

  React.useEffect(() => {
    if (isReduced) return
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
    translateY.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.ease) })),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [isReduced])

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }))

  const handleReveal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    onReveal()
  }, [onReveal])

  const handleSeeHow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSeeHow()
  }, [onSeeHow])

  const handleExplore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onExplore()
  }, [onExplore])

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* Animated Orb */}
          <Animated.View style={[styles.orbWrap, orbAnimStyle]}>
            <LiquidNutrientOrb isReduced={isReduced} />
          </Animated.View>

          {/* Headline */}
          <Text style={styles.headline}>What's really in{'\n'}your juice?</Text>
          <Text style={styles.sub}>Let's find out.</Text>

          {/* Primary CTA */}
          <Pressable
            style={styles.primaryBtn}
            onPress={handleReveal}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Reveal my nutrients"
          >
            <LinearGradient
              colors={['#43A047', '#2E7D32', '#1B5E20']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.primaryGradient}
            >
              <Camera size={22} color="#FFFFFF" />
              <Text style={styles.primaryText}>Reveal My Nutrients</Text>
            </LinearGradient>
          </Pressable>

          <Text style={styles.reassurance}>No account needed. Just point and discover.</Text>

          {/* Secondary actions */}
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.5 }]}
            onPress={handleSeeHow}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="See how it works"
          >
            <Text style={styles.secondaryText}>See how it works</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.exploreBtn, pressed && { opacity: 0.5 }]}
            onPress={handleExplore}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Explore first"
          >
            <Home size={14} color="rgba(240, 246, 252, 0.35)" />
            <Text style={styles.exploreText}>Explore first</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060D0A',
  },
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  orbWrap: {
    marginBottom: 32,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F0F6FC',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.5)',
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reassurance: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.3)',
    textAlign: 'center',
    marginBottom: 24,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(240, 246, 252, 0.5)',
    textAlign: 'center',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  exploreText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.35)',
  },
})
