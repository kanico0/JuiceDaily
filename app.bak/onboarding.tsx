// ─────────────────────────────────────────────────────────────
// app/onboarding.tsx — 3-slide onboarding carousel
// Slides 1-2: Next + Skip. Slide 3: final CTA only.
// Completion persists to AsyncStorage + ActivationStore,
// then navigates to /home.
// Preview mode (?mode=preview): no completion change,
// shows "Close" instead of "Skip", returns to /home.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Sparkles, Leaf, Droplets, ChevronRight, Scan } from 'lucide-react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  withSequence,
  withRepeat,
} from 'react-native-reanimated'
import { setOnboardingComplete } from '../lib/onboarding'

// ── Slide Data ─────────────────────────────────────────────

const SLIDES = [
  {
    icon: (props: any) => <Droplets {...props} />,
    iconColor: '#81C784',
    title: 'Juicing Daily',
    body: 'Your calm, intentional\ndaily wellness ritual',
    pills: [
      { icon: <Leaf size={14} color="#81C784" />, label: 'Track nutrients' },
      { icon: <Sparkles size={14} color="#FFB74D" />, label: 'Build streaks' },
      { icon: <Droplets size={14} color="#64B5F6" />, label: 'Daily insights' },
    ],
  },
  {
    icon: (props: any) => <Scan {...props} />,
    iconColor: '#64B5F6',
    title: 'Scan & Log',
    body: 'Point your camera at produce\nand we identify the nutrients instantly',
    pills: [],
  },
  {
    icon: (props: any) => <Sparkles {...props} />,
    iconColor: '#FFB74D',
    title: 'Build Your Streak',
    body: 'One juice a day keeps\nthe streak alive',
    pills: [],
  },
]

export default function OnboardingScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ mode?: string }>()
  const isPreview = params.mode === 'preview'

  const [slideIndex, setSlideIndex] = useState(0)
  const fadeOut = useSharedValue(1)
  const orbBreath = useSharedValue(1)

  // Breathing animation on logo orb
  useEffect(() => {
    orbBreath.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.98, { duration: 2500, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    )
  }, [])

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOut.value,
  }))

  const orbBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbBreath.value }],
  }))

  // ── Navigation handlers ──────────────────────────────────

  const goHome = useCallback(() => {
    router.replace('/(tabs)/home')
  }, [router])

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex(slideIndex + 1)
    }
  }, [slideIndex])

  const handleSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isPreview) {
      router.replace('/(tabs)/home')
      return
    }
    await setOnboardingComplete(true)
    fadeOut.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(goHome)()
    })
  }, [isPreview, router, fadeOut, goHome])

  const handleFinish = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (!isPreview) {
      await setOnboardingComplete(true)
    }
    fadeOut.value = withTiming(0, { duration: 350, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(goHome)()
    })
  }, [isPreview, fadeOut, goHome])

  // ── Render ───────────────────────────────────────────────

  const slide = SLIDES[slideIndex]
  const isLastSlide = slideIndex === SLIDES.length - 1

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D1117', '#1A2332', '#0D1117']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Animated.View style={[styles.content, fadeStyle]} pointerEvents="box-none">
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Skip / Close — slides 1-2 only (or preview mode on any slide) */}
          {(!isLastSlide || isPreview) && (
            <View style={styles.skipRow}>
              <Pressable
                onPress={handleSkip}
                hitSlop={16}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isPreview ? 'Close preview' : 'Skip onboarding'}
              >
                <Text style={styles.skipText}>{isPreview ? 'Close' : 'Skip'}</Text>
              </Pressable>
            </View>
          )}

          {/* Slide content */}
          <View style={styles.slideContainer}>
            {/* Icon orb */}
            <View style={styles.iconCluster}>
              <Animated.View style={[styles.orbGlow, orbBreathStyle]}>
                {slide.icon({ size: 48, color: slide.iconColor, strokeWidth: 1.5 })}
              </Animated.View>
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>

            {/* Pills (slide 1 only) */}
            {slide.pills.length > 0 && (
              <View style={styles.pills}>
                {slide.pills.map((p, i) => (
                  <View key={i} style={styles.pill}>
                    {p.icon}
                    <Text style={styles.pillText}>{p.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Dot indicators */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === slideIndex && styles.dotActive]}
              />
            ))}
          </View>

          {/* Bottom CTA */}
          <View style={styles.bottomArea}>
            {isLastSlide ? (
              <Pressable
                onPress={handleFinish}
                style={({ pressed }) => [
                  styles.ctaButton,
                  pressed && styles.ctaPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Start Exploring"
              >
                <LinearGradient
                  colors={['#66BB6A', '#43A047']}
                  style={styles.ctaGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Sparkles size={20} color="#fff" strokeWidth={2} />
                  <Text style={styles.ctaText}>Start Exploring</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Next slide"
              >
                <Text style={styles.nextText}>Next</Text>
                <ChevronRight size={18} color="#81C784" strokeWidth={2.5} />
              </Pressable>
            )}

            <Text style={styles.footerText}>
              No account needed. Your data stays on your device.
            </Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  content: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },

  // Skip
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.5)',
  },

  // Slide
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCluster: {
    marginBottom: 28,
  },
  orbGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(129, 199, 132, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(129, 199, 132, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F0F6FC',
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontSize: 17,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.55)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(240, 246, 252, 0.7)',
  },

  // Dots
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(240, 246, 252, 0.15)',
  },
  dotActive: {
    backgroundColor: '#81C784',
    width: 24,
  },

  // Bottom
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: 'rgba(129, 199, 132, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129, 199, 132, 0.2)',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#81C784',
  },
  ctaButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.6,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(240, 246, 252, 0.3)',
    textAlign: 'center',
  },
})
